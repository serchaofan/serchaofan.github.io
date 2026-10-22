---
title: Docker存储
date: 2018-07-06 13:33:01
tags: [Docker, 存储]
categories: [Docker]
comments: false
---

Docker 存储要区分两个层面：

- **镜像/容器层存储**：由 storage driver 或 containerd snapshotter 管理，负责镜像层、容器可写层、写时复制。
- **数据持久化**：由 volume、bind mount、tmpfs 提供，把数据放在容器可写层之外。

本文基于 Docker Engine 29.9.x（2026-10）官方文档重写，重点说明 Docker 29 默认的 containerd image store、overlay2、三种挂载方式、备份恢复和空间治理。

<!-- more -->

- [Docker 存储分层](#docker-%E5%AD%98%E5%82%A8%E5%88%86%E5%B1%82)
- [Docker 29 的镜像存储](#docker-29-%E7%9A%84%E9%95%9C%E5%83%8F%E5%AD%98%E5%82%A8)
- [存储驱动](#%E5%AD%98%E5%82%A8%E9%A9%B1%E5%8A%A8)
- [三种挂载方式](#%E4%B8%89%E7%A7%8D%E6%8C%82%E8%BD%BD%E6%96%B9%E5%BC%8F)
- [Volume 数据卷](#volume-%E6%95%B0%E6%8D%AE%E5%8D%B7)
- [Bind mount](#bind-mount)
- [tmpfs](#tmpfs)
- [容器可写层与导入导出](#%E5%AE%B9%E5%99%A8%E5%8F%AF%E5%86%99%E5%B1%82%E4%B8%8E%E5%AF%BC%E5%85%A5%E5%AF%BC%E5%87%BA)
- [空间管理与清理](#%E7%A9%BA%E9%97%B4%E7%AE%A1%E7%90%86%E4%B8%8E%E6%B8%85%E7%90%86)
- [生产最佳实践](#%E7%94%9F%E4%BA%A7%E6%9C%80%E4%BD%B3%E5%AE%9E%E8%B7%B5)
- [常见问题](#%E5%B8%B8%E8%A7%81%E9%97%AE%E9%A2%98)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# Docker 存储分层

```text
镜像只读层（多个 layer）
        │
        ▼
容器可写层（container layer，Copy-on-Write）
        │
        ├── volume       → Docker 管理的持久化目录
        ├── bind mount   → 宿主机任意目录/文件
        └── tmpfs        → 内存
```

| 类型 | 数据位置 | 容器删除后 | 典型用途 |
| ---- | -------- | ---------- | -------- |
| 容器可写层 | storage driver/snapshotter 管理 | 丢失 | 临时文件、运行时生成文件 |
| volume | Docker 管理（默认 `/var/lib/docker/volumes`） | 保留 | 数据库、应用持久化数据 |
| bind mount | 宿主机任意路径 | 保留 | 配置文件、代码、宿主机已有数据 |
| tmpfs | 内存 | 丢失 | 临时文件、缓存、敏感数据 |

原则：**容器可写层不适合持久化数据**。写可写层需要经过联合文件系统/快照层，性能不如直接写 volume；容器删除后数据也会丢失。

# Docker 29 的镜像存储

Docker Engine 29.0+ **全新安装**默认使用 **containerd image store**：

- 使用 containerd snapshotter，默认 `overlayfs`。
- 镜像内容由 containerd 管理，不再走经典 graphdriver。
- 支持本地多平台镜像、attestations（provenance/SBOM）、Wasm 容器、lazy pulling 等。
- 升级安装的环境仍可能继续使用经典 `overlay2`，需要手动启用 containerd image store。

## 检查当前存储后端

```bash
docker info
docker info -f '{{ .DriverStatus }}'
```

- 经典驱动：`Storage Driver: overlay2`。
- containerd image store：`[[driver-type io.containerd.snapshotter.v1]]`。

## 升级环境启用 containerd image store

`/etc/docker/daemon.json`：

```json
{
  "features": {
    "containerd-snapshotter": true
  }
}
```

```bash
sudo systemctl restart docker
docker info -f '{{ .DriverStatus }}'
```

注意：

- 切换后，旧的 overlay2 镜像/容器会暂时隐藏，但数据仍在磁盘；切回旧配置可恢复。
- 需要继续使用旧镜像时，先推送到 registry 或 `docker save`。
- `userns-remap` 与 containerd image store 目前不兼容。
- Docker 29 中 cgroup v1 已弃用，建议使用 cgroup v2。

## containerd image store 的影响

- `docker image ls` 可能显示多平台镜像索引。
- `docker save` 的行为与经典存储不同，可能包含多平台内容；脚本要验证。
- 镜像内容路径由 containerd root 决定，常见为 `/var/lib/containerd`，不要手工修改。
- 构建多平台镜像不再必须依赖外部 builder。

# 存储驱动

## 经典 storage driver

Docker Engine 29 升级环境仍可能使用经典驱动；全新安装默认 containerd snapshotter。

| 驱动 | 说明 | 适用 |
| ---- | ---- | ---- |
| `overlay2` | 联合文件系统，性能/稳定性好 | 大多数 Linux |
| `fuse-overlayfs` | 用户态 overlay，rootless 常用 | rootless、无内核 overlay 支持 |
| `btrfs` | 依赖 btrfs 文件系统，支持快照 | btrfs 环境 |
| `zfs` | 依赖 zfs，支持快照 | zfs 环境 |
| `vfs` | 无 CoW，每层完整复制 | 调试/兜底，不推荐生产 |

查看：

```bash
docker info | grep -A2 'Storage Driver'
```

## 支持的 backing filesystem

| 驱动 | 支持的 backing filesystem |
| ---- | ------------------------ |
| `overlay2` | `xfs`（ftype=1）、`ext4`、`btrfs` 等 |
| `fuse-overlayfs` | 任意文件系统 |
| `btrfs` | `btrfs` |
| `zfs` | `zfs` |
| `vfs` | 任意文件系统 |

注意：

- XFS 必须启用 `ftype=1`，否则 overlay2 可能无法正常工作。
- 不建议把 `/var/lib/docker` 放在 NFS 上；网络文件系统的一致性、锁和性能不适合作为 Docker data-root。
- `vfs` 空间占用大、性能差，只用于调试或没有 CoW 文件系统的场景。

## 更换存储驱动

更换 storage driver 后，旧镜像/容器会不可见，因为新驱动无法使用旧层。切换前备份、推送镜像，切换后重新拉取/构建。

```json
{
  "storage-driver": "overlay2"
}
```

```bash
sudo systemctl restart docker
docker info
```

# 三种挂载方式

## 对比

| 方式 | 管理方 | 宿主机可见 | 典型用途 |
| ---- | ------ | ---------- | -------- |
| volume | Docker | 在 Docker 数据目录 | 数据库、持久化数据 |
| bind mount | 用户 | 任意路径 | 配置、代码、宿主机已有数据 |
| tmpfs | 内核 | 不可见（内存） | 临时文件、缓存、敏感数据 |

## `-v` 与 `--mount`

```bash
# 短语法
docker run -v myvol:/data myapp:1.0
docker run -v /host/config:/app/config:ro myapp:1.0

# 长语法（推荐，语义清晰）
docker run --mount type=volume,src=myvol,dst=/data myapp:1.0
docker run --mount type=bind,src=/host/config,dst=/app/config,readonly myapp:1.0
```

区别：

- `-v` 对宿主机路径不存在时会自动创建目录；`--mount` 对 bind source 不存在会报错。
- `--mount` 参数更明确，适合脚本和 Compose。
- volume 的 `-v` 和 `--mount` 都会在卷为空时把镜像目标目录内容复制进卷；`volume-nocopy` 可禁用。

# Volume 数据卷

Volume 由 Docker 管理，是持久化数据的首选。

## 创建与使用

```bash
docker volume create myvol
docker volume ls
docker volume inspect myvol

docker run -d \
  --name db \
  --mount type=volume,src=myvol,dst=/var/lib/postgresql/data \
  postgres:16
```

短语法：

```bash
docker run -d -v myvol:/data --name app myapp:1.0
```

## 匿名卷与命名卷

- **匿名卷**：不指定名字，Docker 生成随机 ID；`docker run -v /data`。
- **命名卷**：显式命名，便于备份、迁移和复用；`docker run -v myvol:/data`。

生产建议使用命名卷，并在 Compose/编排中显式声明。

## 只读挂载

```bash
docker run --mount type=volume,src=myvol,dst=/data,readonly myapp:1.0
docker run -v myvol:/data:ro myapp:1.0
```

## volume-nocopy

默认情况下，如果卷为空，Docker 会把镜像中目标目录的内容复制到卷里。禁用复制：

```bash
docker run --mount type=volume,src=myvol,dst=/data,volume-nocopy myapp:1.0
```

适合希望卷完全由应用初始化的场景。

## volume-subpath

只挂载卷中的子目录：

```bash
docker run --mount type=volume,src=myvol,dst=/data,volume-subpath=/tenant-a myapp:1.0
```

要求子目录在卷中已存在。

## NFS 卷

使用 `local` 驱动挂载 NFS：

```bash
docker volume create --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.10,rw,nfsvers=4 \
  --opt device=:/export/data \
  nfsvol
```

```bash
docker run --mount type=volume,src=nfsvol,dst=/data myapp:1.0
```

注意：

- NFS 的锁、延迟、故障恢复与本地盘不同，数据库类负载要谨慎评估。
- 建议使用支持 NFSv4 的服务端，并测试断网/重连。
- 生产可考虑云厂商文件存储、CSI 驱动或专用 volume plugin。

## 备份与恢复

备份卷：

```bash
docker run --rm \
  --volumes-from db \
  -v "$PWD":/backup \
  ubuntu \
  tar cvf /backup/db-backup.tar /var/lib/postgresql/data
```

恢复：

```bash
docker run --rm \
  --volumes-from db-restore \
  -v "$PWD":/backup \
  ubuntu \
  bash -c "cd /var/lib/postgresql/data && tar xvf /backup/db-backup.tar --strip 1"
```

注意：

- 备份前尽量停止写入或使用数据库自己的备份工具（pg_dump、mysqldump、xtrabackup）。
- 直接 tar 正在写入的数据文件可能得到不一致备份。
- 恢复后检查文件权限、UID/GID、SELinux 标签。
- 定期做恢复演练，不要只验证备份文件存在。

## 删除卷

```bash
docker volume rm myvol
docker volume prune
```

卷被容器占用时无法删除，需要先删除/断开容器。`docker volume prune` 会删除所有未使用卷，执行前确认。

# Bind mount

Bind mount 把宿主机路径直接挂载到容器：

```bash
docker run -d \
  --name nginx \
  --mount type=bind,src=/etc/nginx/conf.d,dst=/etc/nginx/conf.d,readonly \
  nginx:1.27
```

短语法：

```bash
docker run -d -v /etc/nginx/conf.d:/etc/nginx/conf.d:ro nginx:1.27
```

## 特点

- 宿主机和容器共享同一份数据，任一方的修改立即可见。
- 适合配置文件、开发代码、宿主机已有数据目录。
- 依赖宿主机目录结构，可移植性差。
- 容器可以修改宿主机文件，需谨慎控制权限和只读挂载。
- 源路径必须是绝对路径（`--mount` 要求存在；`-v` 会自动创建目录）。

## 只读与 SELinux

```bash
# 只读
docker run --mount type=bind,src=/data,dst=/data,readonly myapp:1.0

# SELinux：z 私有标签，Z 共享标签
docker run -v /host/data:/data:z myapp:1.0
docker run -v /host/data:/data:Z myapp:1.0
```

- `z`：给挂载内容打上私有 SELinux 标签，适合多个容器共享。
- `Z`：打上独占标签，适合单容器。
- 不使用 SELinux 的环境可忽略。

## bind-propagation

挂载传播控制宿主机和容器之间挂载事件如何传播：

| 值 | 说明 |
| -- | ---- |
| `private` | 默认，挂载事件不传播 |
| `rprivate` | 递归 private |
| `shared` | 挂载事件双向传播 |
| `rshared` | 递归 shared |
| `slave` | 单向传播（宿主机 → 容器） |
| `rslave` | 递归 slave |

```bash
docker run --mount type=bind,src=/host,dst=/container,bind-propagation=rslave myapp:1.0
```

使用场景：宿主机上动态挂载/卸载目录，容器需要感知变化（如 CSI、NFS、Kubernetes 挂载）。

## Docker Desktop

macOS/Windows 的 Docker Desktop 通过虚拟机运行 Linux 引擎，bind mount 需要跨文件系统共享，性能低于 Linux 原生。大量小文件读写场景建议使用 volume，或把代码放在虚拟机文件系统中。

# tmpfs

tmpfs 把数据放在内存，适合临时文件、缓存、敏感数据：

```bash
docker run -d \
  --name app \
  --mount type=tmpfs,dst=/tmp,tmpfs-size=64m,tmpfs-mode=1777 \
  myapp:1.0
```

短语法：

```bash
docker run -d --tmpfs /tmp:rw,noexec,nosuid,size=64m myapp:1.0
```

特点：

- 容器停止后数据丢失。
- 不写入宿主机磁盘（可能使用 swap，取决于系统配置）。
- 适合存放临时 token、缓存、运行时 socket。
- 大小受内存和 `tmpfs-size` 限制，过大会影响宿主机内存。

# 容器可写层与导入导出

## 可写层

- 容器启动时在镜像只读层之上创建一个可写层。
- 写文件时使用 Copy-on-Write：首次写入才复制到可写层。
- 容器删除后，可写层删除，数据丢失。
- 可写层不适合数据库等持久化数据。

```bash
docker diff <container>          # 查看可写层变化
docker cp <container>:/path ./   # 从容器复制文件
```

## commit

```bash
docker commit <container> myimage:snapshot
```

`docker commit` 会把可写层保存为新镜像，但不推荐用于生产：

- 不可重复、不可审计。
- 可能包含临时文件、密钥、日志。
- 镜像层会越来越大。
- 应使用 Dockerfile 构建可复现镜像。

## save/load 与 export/import

| 命令 | 对象 | 是否保留镜像历史/层 |
| ---- | ---- | ------------------- |
| `docker save` / `load` | 镜像 | 保留 |
| `docker export` / `import` | 容器文件系统 | 不保留 |

```bash
# 镜像迁移
docker save -o app.tar app:1.0
docker load -i app.tar

# 容器文件系统快照（不保留历史）
docker export <container> -o container.tar
docker import container.tar app:snapshot
```

# 空间管理与清理

## 查看占用

```bash
docker system df
docker system df -v
```

`docker system df` 会统计镜像、容器、卷、构建缓存；`-v` 显示明细。

## 清理

```bash
# 停止并删除所有容器（危险）
docker container prune

# 删除未使用镜像
docker image prune
docker image prune -a

# 删除未使用卷（危险）
docker volume prune
docker volume prune --filter "label!=keep"

# 删除构建缓存
docker builder prune
docker builder prune --filter until=24h

# 删除未使用网络
docker network prune

# 综合清理（危险）
docker system prune
docker system prune -a --volumes
```

注意：

- `docker system prune -a --volumes` 会删除未使用镜像、容器、网络、卷和构建缓存。
- 生产执行前确认没有依赖匿名卷/未使用卷的数据。
- 可以用 `--filter until=24h` 避免删除最近使用的数据。

## 日志占用

默认 `json-file` 日志可能占满磁盘。配置轮转：

```json
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
```

## 手动排查目录

```bash
sudo du -sh /var/lib/docker/*
sudo du -sh /var/lib/docker/overlay2/* 2>/dev/null | sort -h | tail
sudo du -sh /var/lib/docker/volumes/* 2>/dev/null | sort -h | tail
```

不要在 daemon 运行时手动删除 `/var/lib/docker` 下的文件，可能导致元数据不一致。使用 Docker 命令清理。

# 生产最佳实践

- 数据持久化用 volume，不要依赖容器可写层。
- 数据库使用专用卷，配合数据库原生备份，不要只 tar 数据目录。
- 配置文件用只读 bind mount 或 ConfigMap/Secret（Kubernetes）。
- 临时/敏感数据用 tmpfs，并限制大小。
- 卷命名规范清晰，Compose/编排中显式声明，避免匿名卷失控。
- 关注 UID/GID、文件权限、SELinux 标签，尤其是非 root 容器。
- 不要把 `/var/lib/docker` 放在 NFS 上；数据库更不要直接跑在 NFS 上。
- 定期 `docker system df`、清理构建缓存和旧镜像。
- 备份策略要覆盖卷、数据库、Compose 文件、镜像 tag/digest。
- 恢复演练比备份本身更重要。
- 升级 Docker 29 前确认 image store、cgroup、网络后端和存储驱动兼容性。

# 常见问题

## 磁盘空间不足

```bash
docker system df -v
docker builder prune
docker image prune -a
docker volume prune
```

检查日志轮转、容器可写层、未使用卷、构建缓存。

## overlay2 报错

- XFS 未启用 `ftype=1`：`xfs_info /var/lib/docker | grep ftype`。
- 内核不支持 overlay2：检查内核版本和文件系统。
- 存储驱动切换后旧镜像不可见：切回原驱动或重新拉取。

## 权限拒绝

- 容器内 UID 与宿主机目录权限不匹配。
- SELinux 阻止访问：使用 `:z`/`:Z` 或调整策略。
- rootless 模式下 UID 映射不同，检查 `subuid/subgid`。

## 卷删除失败

- 卷仍被容器使用：`docker ps -a`，删除/断开容器。
- 卷被外部进程占用：检查挂载点和文件句柄。

## 数据丢失

- 容器删除导致可写层丢失：使用 volume。
- 误执行 `docker volume prune`：从备份恢复。
- 数据库直接 tar 备份不一致：使用数据库原生备份工具。

## containerd image store 切换后镜像不见

- 旧镜像仍在磁盘，切回 overlay2 可恢复。
- 需要在新 store 中使用时，重新 pull 或 `docker save`/`load`。
- 不要手工删除 containerd content store。

# 参考资料

- [Docker Storage](https://docs.docker.com/engine/storage/)
- [Select a storage driver](https://docs.docker.com/engine/storage/drivers/select-storage-driver/)
- [containerd image store](https://docs.docker.com/engine/storage/containerd/)
- [Volumes](https://docs.docker.com/engine/storage/volumes/)
- [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [tmpfs mounts](https://docs.docker.com/engine/storage/tmpfs/)
- [docker system df](https://docs.docker.com/reference/cli/docker/system/df/)
- [docker system prune](https://docs.docker.com/reference/cli/docker/system/prune/)
- [Docker Engine 29 release notes](https://docs.docker.com/engine/release-notes/)

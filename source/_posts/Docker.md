---
title: Docker
date: 2018-10-12 12:21:24
tags: [Docker]
categories: [Docker]
comments: false
---

Docker 是一个开源的容器化平台，把应用及其依赖打包成标准化的镜像，并以容器的方式隔离运行。它解决了「在我机器上能跑」的环境一致性问题，也是 CI/CD、微服务和云原生基础设施的基础组件。

本文基于 Docker Engine 29.9.x（2026-10）和官方最新文档重写。Docker 29 的重要变化：全新安装默认使用 containerd image store，cgroup v1 已弃用，nftables 后端仍为实验特性。

<!-- more -->

- [Docker 是什么](#docker-%E6%98%AF%E4%BB%80%E4%B9%88)
- [核心架构](#%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84)
- [安装与版本](#%E5%AE%89%E8%A3%85%E4%B8%8E%E7%89%88%E6%9C%AC)
- [核心概念](#%E6%A0%B8%E5%BF%83%E6%A6%82%E5%BF%B5)
- [常用命令](#%E5%B8%B8%E7%94%A8%E5%91%BD%E4%BB%A4)
- [镜像与构建](#%E9%95%9C%E5%83%8F%E4%B8%8E%E6%9E%84%E5%BB%BA)
- [容器生命周期](#%E5%AE%B9%E5%99%A8%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F)
- [资源限制](#%E8%B5%84%E6%BA%90%E9%99%90%E5%88%B6)
- [日志管理](#%E6%97%A5%E5%BF%97%E7%AE%A1%E7%90%86)
- [存储与网络](#%E5%AD%98%E5%82%A8%E4%B8%8E%E7%BD%91%E7%BB%9C)
- [安全基线](#%E5%AE%89%E5%85%A8%E5%9F%BA%E7%BA%BF)
- [daemon 配置](#daemon-%E9%85%8D%E7%BD%AE)
- [Docker Engine 29 变化](#docker-engine-29-%E5%8F%98%E5%8C%96)
- [常见问题](#%E5%B8%B8%E8%A7%81%E9%97%AE%E9%A2%98)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# Docker 是什么

Docker 的核心价值：

- **环境一致**：镜像包含应用、运行时、依赖和配置，开发、测试、生产一致。
- **隔离**：容器拥有独立的进程、网络、文件系统和用户空间。
- **轻量**：共享宿主机内核，启动快，资源开销小于虚拟机。
- **可移植**：镜像可以在任何支持 OCI 标准的运行时上运行。
- **可编排**：通过 Compose、Swarm、Kubernetes 管理多容器应用。

Docker 不是虚拟机。虚拟机虚拟化硬件并运行完整操作系统；容器通过 Linux Namespace 做隔离，通过 cgroups 做资源限制，共享宿主机内核。因此容器更轻，但隔离边界弱于虚拟机。

# 核心架构

```text
docker CLI
   │ REST API（/var/run/docker.sock）
   ▼
dockerd（Docker daemon）
   │
   ├── containerd（镜像、容器生命周期、snapshotter）
   │      │
   │      └── runc / crun（OCI runtime，创建容器进程）
   │
   ├── BuildKit（镜像构建）
   └── 网络 / 存储 / 日志驱动
```

| 组件 | 作用 |
| ---- | ---- |
| docker CLI | 用户命令行客户端 |
| dockerd | Docker 守护进程，提供 API、管理镜像/容器/网络/卷 |
| containerd | 工业标准容器运行时，管理镜像内容和容器生命周期 |
| runc | OCI 运行时，真正创建 Namespace/cgroups 并启动进程 |
| BuildKit | 现代镜像构建引擎，Docker 29 默认 |
| snapshotter | containerd 的存储层管理，默认 `overlayfs` |

## 隔离与限制

- **Namespaces**：PID、NET、MNT、UTS、IPC、USER、CGROUP、TIME 等，提供隔离视图。
- **cgroups v2**：限制 CPU、内存、IO、PIDs 等资源。Docker 29 中 cgroup v1 已弃用，建议使用 cgroup v2。
- **Capabilities**：把 root 权限拆成细粒度能力，默认丢弃大部分危险能力。
- **seccomp / AppArmor / SELinux**：限制系统调用和访问控制。
- **User namespace**：`userns-remap` 或 rootless 模式，降低容器逃逸影响。

# 安装与版本

## 版本选择

- **Docker Engine**：Linux 服务器上的核心引擎，包含 `dockerd`、CLI、containerd、Buildx、Compose 插件。
- **Docker Desktop**：macOS/Windows/Linux 桌面版，内置 Engine、Compose、Buildx、Kubernetes 等，底层使用虚拟机运行 Linux 引擎。

生产 Linux 服务器通常安装 Docker Engine，不安装 Docker Desktop。

截至 2026-10，Docker Engine 最新为 **29.9.2**（2026-10-20）。安装前查看官方 release notes 和支持的发行版/内核版本。

## Ubuntu/Debian 安装

以 Ubuntu 为例，按官方文档添加 Docker 仓库：

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
sudo docker version
sudo docker info
```

Debian、RHEL、Rocky、Fedora 等发行版的仓库地址和包名不同，以官方安装文档为准。

## 安装后配置

```bash
# 允许普通用户使用 docker（等同于授予 root 权限，谨慎）
sudo usermod -aG docker "$USER"
newgrp docker

# 验证
docker run --rm hello-world
```

安全提示：加入 `docker` 组等价于 root 权限，因为可以挂载宿主机目录、运行特权容器。更安全的方式是 rootless 模式。

## Rootless 模式

Rootless 让 Docker daemon 和容器以普通用户运行，降低 daemon 被攻破后的影响：

```bash
sudo apt-get install -y uidmap dbus-user-session
dockerd-rootless-setuptool.sh install

systemctl --user enable --now docker
export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock
docker info
```

限制：

- 不能使用特权端口（除非调整 `net.ipv4.ip_unprivileged_port_start`）。
- 部分网络驱动/功能受限。
- 性能略低于 rootful。
- cgroup v2 和内核版本有要求。

## cgroup 与 nftables

- Docker 29 中 cgroup v1 已弃用，支持至少到 2029-05，建议尽快迁移 cgroup v2。
- 检查：`stat -fc %T /sys/fs/cgroup` 返回 `cgroup2fs` 表示 cgroup v2。
- nftables 后端是 Docker 29 的实验特性，通过 `firewall-backend: nftables` 开启；默认仍使用 iptables 兼容路径。生产开启前需要测试端口发布、Docker 网络和防火墙规则。

# 核心概念

## 镜像 Image

镜像是只读模板，由多层文件系统组成：

- 每一层对应 Dockerfile 中的一条构建指令。
- 层可以被多个镜像共享。
- 镜像通过 `name:tag` 或 `name@digest` 标识。
- `latest` 只是默认 tag，不代表最新版本；生产应使用明确版本或 digest。

## 容器 Container

容器是镜像的运行实例：

- 在镜像只读层之上增加一个可写层。
- 容器删除后，可写层数据丢失。
- 需要持久化的数据应使用 volume 或 bind mount。
- 容器本质是宿主机上的一个进程（或一组进程），由 Namespace/cgroups 隔离。

## 仓库 Registry

- Docker Hub 是默认公共仓库。
- 企业常用 Harbor、GitLab Container Registry、云厂商 ACR/ECR/GCR。
- `docker login`、`docker pull`、`docker push`。
- 生产应启用镜像签名、扫描、不可变 tag、保留策略。

## 卷 Volume

由 Docker 管理的持久化存储，默认位于 `/var/lib/docker/volumes`（containerd image store 下容器数据位置不同，卷仍在 Docker 管理目录）。适合数据库、应用数据。

## 网络 Network

Docker 网络驱动决定容器如何通信：bridge、host、overlay、macvlan、ipvlan、none。详见《Docker网络》笔记。

## Context

`docker context` 用于管理多个 Docker 端点，例如本地、远程服务器、Docker Desktop：

```bash
docker context ls
docker context use remote
docker context create remote --docker "host=ssh://user@server"
```

# 常用命令

## 容器

```bash
# 运行
docker run -d --name web -p 8080:80 nginx:1.27
docker run --rm -it alpine sh

# 查看
docker ps
docker ps -a
docker logs -f --tail=100 web
docker inspect web
docker stats
docker top web
docker port web

# 进入容器
docker exec -it web sh
docker exec -it web bash

# 文件复制
docker cp web:/etc/nginx/nginx.conf ./nginx.conf
docker cp ./index.html web:/usr/share/nginx/html/

# 生命周期
docker stop web
docker start web
docker restart web
docker kill web
docker rm -f web

# 资源/配置更新
docker update --restart=always web
```

## 镜像

```bash
docker pull nginx:1.27
docker images
docker image inspect nginx:1.27
docker tag nginx:1.27 registry.example.com/web/nginx:1.27
docker push registry.example.com/web/nginx:1.27

# 导出/导入（保留镜像层和历史）
docker save -o nginx.tar nginx:1.27
docker load -i nginx.tar

# 导出/导入容器文件系统（不保留镜像历史）
docker export web -o web.tar
docker import web.tar myimage:snapshot

# 清理
docker image prune
docker image prune -a
```

## 系统

```bash
docker system df
docker system df -v
docker system prune
docker system prune -a --volumes   # 危险：删除未使用镜像、网络、卷、构建缓存
docker builder prune
docker volume prune
docker network prune
```

## Compose

```bash
docker compose up -d
docker compose ps
docker compose logs -f
docker compose exec web sh
docker compose down
docker compose down -v   # 同时删除卷，危险
docker compose config
```

# 镜像与构建

## Dockerfile 示例

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src

COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 \
    mvn -q -DskipTests dependency:go-offline

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 app
WORKDIR /app

COPY --from=build /src/target/app.jar app.jar
USER 10001
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

## 构建

```bash
# BuildKit 默认启用
docker build -t app:1.0 .

# 指定 Dockerfile
docker build -f docker/Dockerfile -t app:1.0 .

# 多平台构建（需要 buildx + containerd image store 或 registry 推送）
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t registry.example.com/app:1.0 \
  --push .
```

## 多阶段构建

多阶段构建把编译环境和运行环境分开：

- 最终镜像只包含运行时和产物。
- 减小镜像体积和攻击面。
- 构建缓存可以复用。
- 不要把源码、测试依赖、构建工具带进生产镜像。

## 构建最佳实践

- 使用 `.dockerignore` 排除 `.git`、`target`、`node_modules`、日志、密钥。
- 固定基础镜像版本或 digest，避免 `latest`。
- 合并 `RUN` 指令，减少层数，及时清理缓存。
- 使用 BuildKit cache mount 加速依赖下载。
- 使用非 root 用户运行。
- 不要把密钥、token 写入镜像层；使用 BuildKit secret。
- 使用多阶段构建，只复制产物。
- 添加 `HEALTHCHECK`、`LABEL`、`EXPOSE`（文档用途）。
- 生产启用 SBOM/provenance：

```bash
docker buildx build \
  --sbom=true \
  --provenance=true \
  -t registry.example.com/app:1.0 \
  --push .
```

## 镜像分层与缓存

- Dockerfile 指令顺序影响缓存命中率：变化频繁的指令放后面。
- `COPY package.json` 先于 `COPY .`，可以复用依赖层。
- 构建缓存默认在 BuildKit 中管理，`docker builder prune` 清理。
- 多阶段构建的中间阶段默认不进入最终镜像，但会占用构建缓存。

# 容器生命周期

## 重启策略

| 策略 | 说明 |
| ---- | ---- |
| `no` | 不自动重启（默认） |
| `on-failure[:max]` | 非 0 退出时重启，可限制次数 |
| `always` | 总是重启，包括 daemon 重启后 |
| `unless-stopped` | 总是重启，除非手动 stop |

```bash
docker run -d --restart=unless-stopped nginx:1.27
docker update --restart=unless-stopped web
```

## 停止与信号

- `docker stop` 先发 `SIGTERM`，超时后 `SIGKILL`。
- 默认超时 10 秒，可用 `--stop-timeout` 或 `docker stop -t` 调整。
- 应用应正确处理 `SIGTERM`，完成优雅退出。
- `STOPSIGNAL` 可以自定义停止信号。
- PID 1 需要处理僵尸进程时，使用 `--init` 或 `tini`。

```bash
docker run --init -d --stop-timeout=30 myapp:1.0
```

## 一次性容器

```bash
docker run --rm -it alpine sh
docker run --rm -v "$PWD":/work -w /work alpine ls -la
```

# 资源限制

cgroups v2 下常用限制：

```bash
docker run -d \
  --name app \
  --cpus=1.5 \
  --cpu-shares=512 \
  --cpuset-cpus="0-1" \
  --memory=512m \
  --memory-swap=1g \
  --pids-limit=200 \
  --ulimit nofile=65535:65535 \
  myapp:1.0
```

| 参数 | 作用 |
| ---- | ---- |
| `--cpus` | CPU 核数上限（CFS quota） |
| `--cpu-shares` | CPU 相对权重，不是硬限制 |
| `--cpuset-cpus` | 绑定到指定 CPU |
| `--memory` | 内存硬限制，超出会被 OOM Kill |
| `--memory-swap` | 内存 + swap 总限制 |
| `--memory-reservation` | 软限制 |
| `--pids-limit` | 进程/线程数上限 |
| `--ulimit` | 文件描述符等限制 |
| `--blkio-weight` | 块 IO 相对权重 |

注意：

- 容器内看到的 CPU/内存可能仍是宿主机总量，限制由 cgroups 执行。
- JVM 等运行时需要感知 cgroup 限制；现代 JDK 默认支持。
- 内存限制过小会导致 JVM/应用 OOMKill，需结合堆外内存评估。

# 日志管理

Docker 默认日志驱动是 `json-file`，日志文件会持续增长，必须配置轮转。

`/etc/docker/daemon.json`：

```json
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
```

推荐 `local` 驱动，压缩和轮转更高效；需要 `docker logs` 兼容时可用 `json-file` + 轮转。

常用日志驱动：

| 驱动 | 说明 |
| ---- | ---- |
| `json-file` | 默认，支持 `docker logs` |
| `local` | 本地压缩轮转，推荐 |
| `journald` | 交给 systemd journal |
| `syslog` | 系统日志 |
| `fluentd` / `fluent-bit` | 日志采集 |
| `gelf` | Graylog |
| `awslogs` | CloudWatch |
| `splunk` | Splunk |

```bash
docker logs -f --tail=200 web
docker info -f '{{ .LoggingDriver }}'
```

注意：非 `json-file`/`local` 驱动通常不能用 `docker logs` 查看，需要到对应日志系统查询。

# 存储与网络

- 数据持久化、volume、bind mount、tmpfs、存储驱动、空间清理：见《Docker存储》笔记。
- bridge/host/overlay/macvlan/ipvlan、端口发布、DNS、防火墙：见《Docker网络》笔记。

速查：

```bash
# 存储
docker volume ls
docker volume inspect myvol
docker system df

# 网络
docker network ls
docker network inspect bridge
docker port web
```

# 安全基线

## 容器运行安全

```bash
docker run -d \
  --name app \
  --user 10001:10001 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  --security-opt=no-new-privileges:true \
  --pids-limit=200 \
  --memory=512m \
  myapp:1.0
```

原则：

- 使用非 root 用户。
- 根文件系统只读，临时目录用 tmpfs。
- `--cap-drop=ALL`，只加必要 capability。
- `no-new-privileges` 防止提权。
- 避免 `--privileged`、挂载 `/var/run/docker.sock`、挂载宿主机根目录。
- 使用默认 seccomp/AppArmor/SELinux，必要时自定义。
- 镜像最小化，定期扫描漏洞。
- 固定镜像 digest，启用签名/ provenance。
- 密钥使用 Docker secrets、BuildKit secret 或外部 Secret Manager，不要写进镜像。

## userns-remap

开启用户命名空间重映射，把容器内 root 映射到宿主机非 root 用户：

```json
{
  "userns-remap": "default"
}
```

注意：userns-remap 与 containerd image store 目前不兼容（Docker 官方已知限制），选择时要评估。

## Rootless

Rootless 模式进一步降低 daemon 权限，适合多租户/开发机/边缘环境。生产使用前验证网络、存储、端口和性能。

# daemon 配置

配置文件：`/etc/docker/daemon.json`（Linux）。

```json
{
  "data-root": "/var/lib/docker",
  "log-driver": "local",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  },
  "live-restore": true,
  "default-address-pools": [
    {
      "base": "172.30.0.0/16",
      "size": 24
    }
  ]
}
```

| 配置 | 作用 |
| ---- | ---- |
| `data-root` | Docker 数据目录（镜像、容器、卷、网络） |
| `log-driver` / `log-opts` | 默认日志驱动和轮转 |
| `live-restore` | daemon 重启时保持容器运行（非 Swarm） |
| `default-address-pools` | 自定义网络地址池，避免与内网冲突 |
| `registry-mirrors` | 镜像加速器（地址经常变化，按当前可用配置） |
| `features.containerd-snapshotter` | 启用 containerd image store（升级环境） |
| `firewall-backend` | `iptables` 或实验性的 `nftables` |

应用配置：

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
docker info
```

注意：

- `data-root` 变更后，旧镜像/容器不会自动迁移。
- `live-restore` 不适用于 Swarm 模式。
- 修改存储驱动或 image store 会导致旧镜像暂时不可见，切换前备份/推送镜像。

# Docker Engine 29 变化

| 变化 | 说明 |
| ---- | ---- |
| containerd image store 默认 | 全新安装默认使用 containerd snapshotter（`overlayfs`），升级环境仍用 overlay2，需手动启用 |
| cgroup v1 弃用 | 支持到至少 2029-05，建议迁移 cgroup v2 |
| nftables 实验支持 | `firewall-backend: nftables`，默认仍为 iptables 兼容路径 |
| Docker Content Trust 移除 | CLI 不再内置，需要单独插件 |
| API 最低版本 | daemon 要求 API v1.44+（Docker 25.0+） |
| 多平台镜像 | containerd image store 支持本地构建/存储多平台镜像和 attestations |

检查当前 image store：

```bash
docker info -f '{{ .DriverStatus }}'
# [[driver-type io.containerd.snapshotter.v1]] 表示 containerd image store
```

从 overlay2 迁移到 containerd image store：

```json
{
  "features": {
    "containerd-snapshotter": true
  }
}
```

重启后旧镜像/容器会暂时隐藏，但数据仍在磁盘；切回旧配置可恢复。迁移前建议把镜像推送到 registry 或 `docker save`。

# 常见问题

## 权限拒绝

```text
permission denied while trying to connect to the Docker daemon socket
```

- 用户不在 `docker` 组：`sudo usermod -aG docker $USER`，重新登录。
- 使用 rootless：设置 `DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock`。
- 检查 `/var/run/docker.sock` 权限。

## 端口被占用

```bash
ss -lntp | grep 8080
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

## 容器启动后立即退出

```bash
docker ps -a
docker logs <container>
docker inspect <container> --format '{{.State.ExitCode}} {{.State.Error}}'
```

常见原因：命令不存在、配置错误、权限不足、依赖服务不可达、OOMKill。

## 磁盘空间不足

```bash
docker system df -v
docker builder prune
docker image prune -a
docker volume prune
```

注意：`docker system prune -a --volumes` 会删除未使用的卷，执行前确认。

## 镜像平台不匹配

```text
exec format error
```

- 检查 `docker image inspect <image> --format '{{.Architecture}}'`。
- 使用 `--platform linux/amd64` 或构建多平台镜像。
- Apple Silicon 上运行 amd64 镜像需要模拟，性能较差。

## 修改配置不生效

- 确认修改的是 `/etc/docker/daemon.json`。
- `systemctl daemon-reload && systemctl restart docker`。
- 查看 `journalctl -u docker`。
- `docker info` 验证实际配置。

# 参考资料

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Engine 安装](https://docs.docker.com/engine/install/)
- [Docker Engine 29 release notes](https://docs.docker.com/engine/release-notes/)
- [Docker 存储](https://docs.docker.com/engine/storage/)
- [Docker 网络](https://docs.docker.com/engine/network/)
- [Docker 构建](https://docs.docker.com/build/)
- [Docker 资源限制](https://docs.docker.com/engine/containers/resource_constraints/)
- [Docker 日志](https://docs.docker.com/engine/logging/configure/)
- [Docker Rootless](https://docs.docker.com/engine/security/rootless/)
- [Docker Compose](https://docs.docker.com/compose/)

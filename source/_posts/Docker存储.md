---
title: Docker存储
date: 2018-07-06 13:33:01
tags: [Docker, 存储]
categories: [Docker]
comments: false
---

**主要是对 docker 文档(v18.03)的翻译以及自己的学习笔记**（存储驱动相关行为已按 Docker 29 更新，历史驱动会单独标注）
本篇主要包含以下内容

- [Docker 存储介绍](#docker-存储介绍)
- [BindMount](#bindmount)
  - [bind-propagation 传播挂载](#bind-propagation-传播挂载)
  - [Selinux 标签](#selinux-标签)
- [Volume 数据卷](#volume-数据卷)
- [Tmpfs](#tmpfs)
- [数据卷容器](#数据卷容器)
  - [数据卷备份、还原与迁移](#数据卷备份还原与迁移)
    - [备份一个容器](#备份一个容器)
    - [还原一个容器](#还原一个容器)
    - [删除一个数据卷](#删除一个数据卷)
- [存储引擎](#存储引擎)
- [常见问题](#常见问题)
- [参考资料](#参考资料)
  <!-- more -->

## Docker 存储介绍

Docker 里要区分两类存储：

- **storage driver（存储驱动）**：管理镜像层和容器可写层，负责联合文件系统与写时复制。overlay2 是经典默认；Docker 29 起全新安装默认使用 containerd image store 的 snapshotter。
- **挂载（mount）**：把数据放在容器可写层之外，分三种：
  - volume：由 Docker 管理，默认在 `/var/lib/docker/volumes`，适合持久化数据
  - bind mount：直接挂载宿主机目录/文件，适合配置、代码和需要宿主机访问的数据
  - tmpfs：只存在内存，容器停止即丢失

容器可写层由 storage driver 管理；volume、bind mount、tmpfs 都不经过联合文件系统。

**存储驱动：**主流是 overlay2；btrfs、zfs 属可选方案，vfs 仅作兜底。Docker 29 起全新安装默认使用 containerd image store（snapshotter），不再走经典 graphdriver，详见[存储引擎](#存储引擎)。

**原理：**

1. Copy-On-Write 写时复制
   大多数驱动使用 CoW：所有容器共享只读的镜像层，需要写入时才把文件复制到容器自己的可写层，修改的是副本。vfs 不使用 CoW，而是为每个容器完整复制一份，空间占用大。
2. allocate-on-demand 用时分配
   在要写入一个文件时才按需分配空间

**驱动（历史）：**

1. AUFS：一种 Union FS 联合文件系统，文件级存储。Docker v24.0 已移除。
2. Overlay：旧版 UnionFS 驱动，只有 upper/lower 两层，Docker v24.0 已移除，改用 overlay2。
3. Device Mapper：曾用于旧内核，Docker v25.0 已移除。

默认情况下，容器内创建的所有文件都写入**容器可写层**。该层位于宿主机磁盘（由 storage driver 管理，经典 overlay2 下为 `/var/lib/docker/overlay2/<容器ID>/diff`；Docker 29 全新安装使用 containerd image store 时在 `/var/lib/containerd`），容器停止后仍然存在，但容器被删除（`docker rm`）时一并删除。因此需要 bind mount 或 volume 来持久化数据；tmpfs 则是显式指定的内存挂载，容器停止即丢失。

三种挂载方式的对比：

| 方式 | 数据位置 | 容器删除后 | 典型场景 |
| --- | --- | --- | --- |
| volume | `/var/lib/docker/volumes` | 保留 | 数据库、应用持久化数据 |
| bind mount | 宿主机任意路径 | 保留 | 配置文件、代码、宿主机已有数据 |
| tmpfs | 内存 | 丢失 | 临时文件、缓存、敏感数据 |

- [`bind mount`](#BindMount)：可将容器数据存放在宿主机的任何位置。
- [`volumes`](#Volume数据卷)：通过创建数据卷将容器数据持久化到文件系统。
- [`tmpfs`](#Tmpfs)：数据存放在内存中，不会写入文件系统。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120042240.png)

## BindMount

`bind mount`可使容器中的文件存储在主机系统的任何位置。Docker 主机或 Docker 容器上的非 Docker 进程可以随时修改它们。bind mount 非常高效，但它们依赖于具有特定目录结构的主机文件系统。

docker 提供两种选项进行 bind mount。

- `-v`或`--volume`：三个字段组成，冒号分隔。

1. 第一个字段：bind mount 为宿主机路径，volume 为卷名；匿名卷可省略
2. 第二个字段：文件或目录在容器中的路径
3. 第三个字段：可选项，例如`ro`、`z`、`Z`，默认可读可写

- `--mount`：由多个键值对组成，用逗号分隔，键和值用`=`连接。以下是提供的键：

1. `type`：挂载的类型，可以是 bind，volume 或 tmpfs。
2. `source`或`src`：挂载源。bind 为宿主机路径，volume 为卷名；匿名卷可省略。
3. `destination`或`dst`或`target`：挂载到的容器中的指定目录或文件路径
4. `readonly`或`ro`：以只读方式挂载，可选。
5. `volume-nocopy`：卷为空时不把容器目标目录的内容复制进卷（仅 volume）
6. `volume-opt`：卷选项，可指定多次，也是键值对形式
7. `bind-propagation`：绑定传播，有以下选择：`rprivate`，`private`，`rshared`，`shared`，`rslave`，`slave`
   注：`--mount` 不支持设置 selinux 的`z`或`Z`选项，需要 SELinux 标签时用 `-v`

**如果使用`-v`或`--volume`绑定安装 Docker 主机上尚不存在的文件或目录，则-v 会为您创建端点。它始终作为目录创建。而如果使用`--mount`，Docker 不会自动为您创建它，但会生成错误。**

**注：**bind mount 允许访问敏感文件
使用 bind mount 的一个副作用：可以通过容器中运行的进程更改主机文件系统，包括创建，修改或删除重要的系统文件或目录。这是一种强大的功能，可能会产生安全隐患，包括影响主机系统上的非 Docker 进程。

当挂载一个 bind mount 或非空数据卷到容器中的一个非空目录，则该目录中原有的文件会被掩盖（并非删除），而只显示挂载的卷内容。当挂载一个空数据卷到容器中的一个非空目录，则该目录中的文件都会复制到该卷中。若启动容器时指定了一个不存在的数据卷，则会自动创建一个卷。

```
使用-v挂载
docker run -v <源目录或文件>:<容器中目录或文件>
# 路径都需要绝对路径
# 若添加单个文件，主机源文件必须存在，否则会当做一个新目录挂载到容器
使用--mount挂载
docker run --mount type=bind,src=<源目录或文件>,dst=<容器目录或文件>
```

`docker inspect 容器`查看是否挂载了数据卷

### bind-propagation 传播挂载

在指定的 bind mount 或数据卷上挂载是否能被复制到挂载的目录中去。用于做动态，可通过编排工具方便实现。

有以下几种选项：

- shared：源挂载的子挂载会暴露给副本挂载，副本挂载的子挂载也会复制到源挂载。
- slave：类似于 shared，但只在一个方向上。如果源挂载暴露了子挂载，则副本挂载可以看到它。但是，如果副本挂载暴露了子挂载，则源装载无法看到它。
- private：此挂载是私人的。其中的子挂载不会暴露给副本挂载，副本挂载的子挂载不会暴露给源挂载。
- rshared：与 shared 相同，但传播也扩展到嵌套在任何源或副本挂载中的挂载点。
- rslave：与 slave 相同，但传播也扩展到嵌套在任何源或副本挂载中的挂载点。
- rprivate：默认值。与 private 相同，源或副本挂载中任何位置的挂载点都不会沿任一方向传播。

### Selinux 标签

如果使用 selinux，则可以添加`z`或`Z`选项以修改要挂载到容器的主机文件或目录的 selinux 标签。这会影响主机本身上的文件或目录，并且可能会影响到 Docker 外部。

- `z`选项表示绑定装载内容在多个容器之间共享。
- `Z`选项表示绑定装载内容是私有且非共享的。使用`Z`选项绑定安装系统目录（例如`/home`或`/usr`）会导致主机无法运行。

当 bind mount 和 service 一起使用时，会自动忽略 selinux 标签（`z`和`Z`）还有`ro`。

## Volume 数据卷
卷是保存 Docker 容器生成和使用的数据的首选机制，并且卷完全由 Docker 管理。
写入容器的可写层需要 storage driver 管理联合文件系统，会带来额外开销；volume 是 Docker 管理的目录，直接使用宿主机文件系统，绕过联合文件系统，性能和持久化都更好。数据卷独立于容器的生命周期，容器删除时卷不会被删除。

特点：

- 卷比 bind mount 更容易备份或迁移。
- 卷适用于 Linux 和 Windows 容器。
- 可以在多个容器之间更安全地共享卷。
- 在容器启动时初始化：如果卷为空，容器挂载点中已有的数据会被复制进卷（可用 `volume-nocopy` 关闭）
- 数据卷变化不会影响镜像更新
- 卷驱动程序允许在远程主机或云提供程序上存储卷，加密卷的内容或添加其他功能。

可通过`docker volume create 数据卷名`创建数据卷。每创建一个 volume，就会在`/var/lib/docker/volumes`中创建一个同名目录。若不指定数据卷名，就会随机生成一个 volume ID 作为数据卷名。

`docker volume`命令

```
  create 创建数据卷
  inspect 查看数据卷信息
  ls 查看所有数据卷
  prune 删除未使用的数据卷
  rm 删除指定数据卷
```

**使用卷**

```bash
docker volume create app-data

docker run -d --name app \
  --mount type=volume,src=app-data,dst=/data \
  nginx

# 只读挂载
docker run --rm --mount type=volume,src=app-data,dst=/data,ro alpine ls /data

# 不把镜像中目标目录的内容复制进空卷
docker run --rm \
  --mount type=volume,src=app-data,dst=/data,volume-nocopy alpine ls /data

docker volume inspect app-data
```

- 默认情况下，如果卷是空的，容器目标目录中已有的内容会被复制进卷；`volume-nocopy` 可关闭
- 同一个卷可以同时挂给多个容器，也可以对不同容器分别以 rw/ro 挂载
- 默认只删除未被使用的匿名卷；加 `-a/--all` 才会连命名卷一起删除，执行前先确认

在创建 volume 时，或启动使用尚未创建卷的容器时，可以指定卷的驱动。
数据卷驱动可通过`docker plugin install [选项] 驱动名`。
**如果卷驱动程序要求您传递选项，则必须使用`--mount`标志来装入卷**

docker 提供`-v`和`--mount`选项进行挂载。使用与 bind mount 基本一致。
如果需要指定卷驱动程序选项，则必须使用`--mount`。将卷与服务一起使用时，仅支持`--mount`。

**注：挂载数据卷不支持单个文件，只能是目录。卷默认可读写，可通过 `ro` 或 `readonly` 挂载为只读。**
因为容器配置文件里的可以指定`docker inspect`查看，发现`Mounts`中的`Source`字段，其中已指定了源，源为：`/var/lib/docker/volumes/容器长ID/_data`。

以上两种方法数据源其实还是宿主机中的，并不是真正放在 volume container 中，可以在通过 dockerfile 的`ADD`将数据打包进镜像并指定`VOLUME`，将`ADD`指定的目录与`VOLUME`设为一致，此法称为`data-packed volume container`。

## Tmpfs

使用`tmpfs mount`创建容器时，容器可以在容器的可写层之外创建文件。tmpfs 挂载是临时的，仅保留在主机内存中。当容器停止时，将删除 tmpfs 挂载，该数据不可被共享。Docker 默认使用 storage driver 的可写层，tmpfs 需要显式指定（`/dev/shm` 是默认 tmpfs 的特例）。
`--tmpfs`：安装 tmpfs 挂载，可带选项，例如 `--tmpfs /tmp:rw,size=64m`，只能与独立容器一起使用。
也可以通过 `--mount` 指定 `type=tmpfs`，例如 `--mount type=tmpfs,dst=/tmp,tmpfs-size=64m`。

- tmpfs 只支持 Linux 容器
- tmpfs 不能在不同容器之间共享
- 数据只存在内存中，容器停止或宿主机重启后丢失
- 未设置 `size` 时默认不受限，可能耗尽宿主机内存

## 数据卷容器

容器挂载数据卷，其他容器通过挂载该容器实现数据共享，挂载数据卷的容器称为数据卷容器。现在更推荐直接用命名卷 + `--mount`；数据卷容器主要用于兼容旧方案。

创建容器时`--volumes-from 数据卷容器`创建数据卷容器
**注：由于数据卷容器仅是提供数据，所以只要 create，不用 run**
`docker rm -v 容器` 会删除该容器的匿名卷；命名卷仍会保留，需要 `docker volume rm` 单独删除。只要有容器还在使用该数据卷，数据卷就不会删除。宿主机上的数据卷若删除，就真的没了。

```
> docker volume create volume_1
> docker volume create volume_2
# 创建数据卷容器，挂载volume_1，volume_2
> docker create \
    -v volume_1:/volume1 \
    -v volume_2:/volume2 \
    --name vol_container \
    alpine
# 创建容器挂载数据卷容器
> docker run -it \
    --volumes-from vol_container \
    --name test \
    alpine
/ # ls
bin       home      mnt       run       sys       var
dev       lib       proc      sbin      tmp       volume1
etc       media     root      srv       usr       volume2
# 数据卷容器中挂载的数据卷也被挂载到新容器的根目录了，也可通过-v设置挂载点
```

### 数据卷备份、还原与迁移

使用数据卷能方便地进行数据备份、迁移和还原。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120042859.jpg)

#### 备份一个容器

首先创建一个数据卷，用于存放备份数据。
`docker volume create vol_backup`
然后创建一个数据卷容器，挂载该数据卷

```
docker create --name backup_container\
     -v vol_backup:/backup \
     alpine
```

接着运行要备份容器，挂载数据卷容器 backup_container，并将要备份的数据打包放入数据卷。下面把备份写到宿主机当前目录（把 `/usr /var` 换成实际要备份的目录）：

```
docker run --rm \
    --volumes-from backup_container \
    -v "$(pwd)":/backup \
    alpine tar -cvf /backup/data.tar /usr /var
```

若想直接写进 vol_backup，去掉 `-v "$(pwd)":/backup` 即可，文件会出现在 `/var/lib/docker/volumes/vol_backup/_data/`。

#### 还原一个容器

还原时目标容器必须已经把数据卷挂在 `/dbdata`，且 tar 中的路径要与目标目录对应：

```
docker run --rm \
    --volumes-from target_container \
    -v "$(pwd)":/backup \
    alpine \
    bash -c "cd /dbdata && tar xvf /backup/data.tar --strip 1"
```

#### 删除一个数据卷

删除的数据卷有两种情况：

- 命名卷在容器外部有指定源，删除了容器，数据卷并不会被删除
- 匿名卷没有指定源，删除容器时默认仍会保留，只有 `docker rm -v` 或创建容器时加 `--rm` 才会一并删除。

## 存储引擎

Docker 通过 storage driver 管理镜像层与容器层。经典场景下现代 Linux 发行版默认使用 **overlay2**；btrfs、zfs 仍可选，vfs 仅作兜底（无写时复制、空间浪费大），不建议生产使用。devicemapper 在 v25 移除，aufs 与旧版 overlay 在 v24 移除。

Docker 29 起全新安装默认使用 **containerd image store**（snapshotter），此时镜像与快照位于 `/var/lib/containerd`，下文 overlay2 的路径与行为只适用于经典 graphdriver。`docker info` 中可看到当前使用的存储方式。

只有容器可写层由 storage driver 管理，bind mount 和 volume 不经过 overlay2。

选择存储驱动时优先 overlay2；btrfs、zfs 需要底层文件系统支持；vfs 只在没有 CoW 文件系统且不关心性能时使用。更换存储驱动需要先停 Docker、修改 daemon.json 的 `storage-driver`，旧镜像和容器不会自动迁移，需要重新拉取/重建。`docker info` 中可以看到当前存储驱动和 `Supports d_type` 等信息。

overlay2 基于内核 OverlayFS，把多个目录叠加成单一视图：

- **lowerdir**：只读的镜像层，可以有多个，按顺序叠加
- **upperdir**：容器可写层，位于宿主机磁盘（如 `/var/lib/docker/overlay2/<id>/diff`）
- **merged**：容器内看到的合并目录
- **workdir**：OverlayFS 内部工作目录，必须与 upperdir 在同一文件系统且为空，内核用它完成 copy-up、rename 等需要原子性的操作；不挂入容器，也不能被多个 overlay 挂载共用

读取文件时从上层往下找，命中即返回。写入时如果文件位于 lowerdir，会先**整个文件**复制到 upperdir 再修改（`chmod`/`chown` 等元数据变更也会触发，且只在首次写入时复制），这就是**写时复制**。OverlayFS 是文件级而非块级，改大文件的一小部分也要整文件拷贝。由此带来几个运维上要注意的点：

- 容器内删除 lowerdir 中的文件，会在 upperdir 生成 **whiteout 文件**；删除目录同样生成 whiteout。只有需要在可写层屏蔽 lower 同名目录的全部内容（如 `rm -rf` 后重建同名目录）时，才会使用 **opaque 目录**。镜像层本身不变，所以镜像层空间不会释放（只要镜像还在、仍被引用），容器层反而会多占少量 inode
- 大量小文件写入会让 upperdir 持续膨胀；镜像层数过多也会拖慢查找，构建时应合并 RUN 指令减少层数（overlay2 最多 128 个 lower 层，超过会构建失败）
- `docker diff` 可查看容器自创建以来文件的变化，输出 `A` 新增、`C` 修改、`D` 删除，只列路径，不含内容差异和大小

查看当前驱动与数据目录：

```bash
docker info | grep "Storage Driver"
docker info | grep "Docker Root Dir"
```

overlay2 要求内核 ≥ 4.0（RHEL/CentOS 7 为 3.10.0-514+），且 `/var/lib/docker` 所在文件系统支持 `d_type`（xfs 需以 `ftype=1` 格式化），可用 `xfs_info "$(findmnt -no TARGET /var/lib/docker)" | grep ftype=1` 或 `docker info` 中的 `Supports d_type: true` 验证。

磁盘满或 inode 耗尽时，先查 `docker system df -v`：镜像的 SIZE 会把共享层重复计入，应看 SHARED SIZE / UNIQUE SIZE；inode 用 `df -i` 检查。`/var/lib/docker` 只读查看，切勿手工删除或修改其中的文件。

> **注意**：`docker system prune` 默认会删除所有已停止的容器、未使用网络、悬空镜像和构建缓存；加 `-a` 删除所有未被容器引用的镜像，加 `--volumes` 删除未使用的匿名卷。生产环境建议先用 `docker system df -v` 确认，再按需使用 `docker container prune`、`docker image prune`、`docker builder prune` 等更细粒度的命令，避免误删仍需保留的停止容器。

## 常见问题

**磁盘满 / inode 耗尽**

```bash
docker system df -v      # 镜像、容器、卷、构建缓存
df -i                    # inode
du -sh /var/lib/docker/overlay2 2>/dev/null
du -sh /var/lib/containerd 2>/dev/null
```

- 日志占满：检查 `/var/lib/docker/containers/*/*-json.log`，配置日志轮转
- 镜像/构建缓存占满：`docker image prune`、`docker builder prune`
- 卷占满：`docker system df -v` 后逐个确认，不要直接 `docker volume prune`

**容器内写文件很慢 / 磁盘占用异常**

写容器可写层会经过 storage driver（overlay2 的 copy-up），大文件、数据库、日志应放 volume 或 bind mount。

**权限问题**

容器内 UID/GID 与宿主机不一致会导致 Permission denied。可用 `--user` 指定运行用户，或在镜像中固定 UID/GID；K8s 用 `fsGroup` 调整卷属组。启用 userns-remap/rootless 时，宿主机看到的 UID 会再次映射。

**bind mount 覆盖了镜像里的文件**

挂载到非空目录会遮住镜像原有内容，这是预期行为；需要保留镜像内容时改用 volume（空卷会先复制目标目录内容），或换挂载路径。

**NFS / 远程存储**

可以用 local 卷驱动的 `volume-opt` 挂 NFS，例如：

```bash
docker volume create --driver local \
  --opt type=nfs \
  --opt o=addr=10.0.0.10,rw,nfsvers=4 \
  --opt device=:/data/nfs \
  nfs-vol
```

rootless 模式对 NFS 和部分挂载选项支持有限，需先验证。

## 参考资料

[Docker 官方文档-存储](https://docs.docker.com/storage/)
每天 5 分钟玩转 docker 容器技术

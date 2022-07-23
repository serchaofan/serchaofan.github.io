---
title: Docker存储
date: 2018-07-06 13:33:01
tags: [Docker, 存储]
categories: [Docker]
comments: false
---

**主要是对 docker 文档(v18.03)的翻译以及自己的学习笔记**
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
- [参考资料](#参考资料)
  <!-- more -->

## Docker 存储介绍

Docker 为容器提供了两种存放数据的资源：

- storage driver：管理的镜像层和容器层
  特点：Copy-on-Write。新数据会存放在最上层容器层，修改现有数据会先从镜像层复制到容器层，修改后的数据直接保存在容器中，镜像层保持不变。若多层中有同名文件，用户只能看到最上层的文件。
  可通过 docker info 查看到。Docker 优先使用默认的 storage driver。
- data volume 数据卷
  特点：是目录或文件，不是磁盘，volume 数据可以被永久的保存，即使使用它的容器已经销毁。
  分为两种 volume：bind mount 和 docker managed volume

**存储驱动：**目前 docker 支持五种存储驱动。详见[存储引擎](#存储引擎)

1. AUFS
2. Btrfs
3. Device Mapper
4. Overlay
5. ZFS

**原理：**

1. Copy-On-Write 写时复制
   所有驱动都是用到 Cow 写时复制（copy-on-write），只在需要写时才复制。可以让所有容器都共享一个 image 文件系统，所有数据都从 image 读取，容器需要写操作时，才将要写的文件从 image 复制到自己的文件系统，即所有写操作都是对 image 中副本的修改。有效提高了磁盘利用率。
2. allocate-on-demand 用时分配
   在要写入一个文件时才按需分配空间

**驱动：**

1. AUFS：一种 Union FS 联合文件系统，文件级存储。支持将不同目录挂载到同一个虚拟文件系统，下层文件系统只可读，最上层可写。若要修改，AUFS 会创建一个该文件的副本，放在可写层，结果也保存在可写层。
2. Overlay：一种 UnionFS，文件级存储。只有两层：upper 层和 lower 层
3. Device Mapper：RHEL 下 Docker Engine 的默认存储驱动，基于同名级卷管理技术框架的存储引擎。

默认情况下，在容器内创建的所有文件都存储在可写容器层中，仅存储在主机系统的内存中，即`tmpfs`方式，永远不会写入主机系统的文件系统，因此一旦容器停止，容器内所有文件的改动都会丢失，所以需要通过一些机制将文件保存以至于在容易停止后仍不会丢失。

docker 有三种存储容器数据的方式：

- [`bind mount`](#BindMount)：可将容器数据存放在宿主机的任何位置。
- [`volumes`](#Volume数据卷)：通过创建数据卷将容器数据持久化到文件系统。
- [`tmpfs`](#Tmpfs)：数据存放在内存中，不会写入文件系统。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120042240.png)

## BindMount

`bind mount`可使容器中的文件存储在主机系统的任何位置。Docker 主机或 Docker 容器上的非 Docker 进程可以随时修改它们。bind mount 非常高效，但它们依赖于具有特定目录结构的主机文件系统。

docker 提供两种选项进行 bind mount。

- `-v`或`--volume`：三个字段组成，冒号分隔。

1. 第一个字段：卷名，若是匿名卷，则可省略
2. 第二个字段：文件或目录在容器中安装的路径
3. 第三个字段：可选项，例如`ro`，默认是可读可写

- `--mount`：由多个键值对组成，用逗号分隔，键和值用`=`连接。以下是提供的键：

1. `type`：挂载的类型，可以是 bind，volume 或 tmpfs。
2. `source`或`src`：挂载源，即卷名。匿名卷可省略。
3. `destination`或`dst`或`target`：挂载到的容器中的指定目录或文件路径
4. `readonly`：以只读方式挂载，可选。
5. `volume-opt`：卷选项，可指定多次，也是键值对形式
6. `bind-propagation`：绑定传播，有以下选择：`rprivate`，`private`，`rshared`，`shared`，`rslave`，`slave`
   注：--mount 不支持设置 selinux 的`z`或`Z`选项

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
写入容器的可写层需要存储驱动程序来管理文件系统，存储驱动程序使用 Linux 内核提供联合文件系统 UFS。而数据卷是经过特殊设计的目录，可以绕过联合文件系统，为多个容器提供访问。数据卷的目的在于数据永久化，完全独立于容器的生存周期，容器删除时挂载的数据卷不会被删除。

特点：

- 卷比 bind mount 更容易备份或迁移。
- 卷适用于 Linux 和 Windows 容器。
- 可以在多个容器之间更安全地共享卷。
- 在容器启动时初始化，若挂载点已有数据，则会被拷贝到新初始化的数据卷中
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

在创建 volume 时或启动使用为创建卷的容器时，可以指定卷的驱动。
数据卷驱动可通过`docker plugin install [选项] 驱动名`。
**如果卷驱动程序要求您传递选项，则必须使用`--mount`标志来装入卷**

docker 提供`-v`和`--mount`选项进行挂载。使用与 bind mount 基本一致。
如果需要指定卷驱动程序选项，则必须使用`--mount`。将卷与服务一起使用时，仅支持`--mount`。

**注：挂载数据卷不支持单个文件，只能是目录。且不权限控制，均为可读写。**
因为容器配置文件里的可以指定`docker inspect`查看，发现`Mounts`中的`Source`字段，其中已指定了源，源为：`/var/lib/docker/volumes/容器长ID/_data`。

以上两种方法数据源其实还是宿主机中的，并不是真正放在 volume container 中，可以在通过 dockerfile 的`ADD`将数据打包进镜像并指定`VOLUME`，将`ADD`指定的目录与`VOLUME`设为一致，此法称为`data-packed volume container`。

## Tmpfs

使用`tmpfs mount`创建容器时，容器可以在容器的可写层之外创建文件。tmpfs 挂载是临时的，仅保留在主机内存中。当容器停止时，将删除 tmpfs 挂载，该数据不可被共享，Docker 默认使用 tmpfs 挂载。
`--tmpfs`：安装 tmpfs 挂载而不允许指定任何可配置选项，并且只能与独立容器一起使用。
也可以通过`--mount`指定`type=tmpfs`。

## 数据卷容器

容器挂载数据卷，其他容器通过挂载该容器实现数据共享，挂载数据卷的容器称为数据卷容器。

创建容器时`--volumes-from 数据卷容器`创建数据卷容器
**注：由于数据卷容器仅是提供数据，所以只要 create，不用 run**
`docker rm -v 容器` 在删除容器时一并删除数据卷。但是，只要有容器还在使用该数据卷，数据卷就不会删除。宿主机上的数据卷若删除，就真的没了。

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

接着运行要备份容器，挂载数据卷容器 backup_container，并将要备份的数据打包放入数据卷。

```
docker run --rm \
    --volumes-from backup_container \
    -v /backup \
    alpine tar -cvf /backup/data.tar /usr /var
```

在主机的`/var/lib/docker/volumes/vol_backup/_data/`中出现了打包后的`data.tar`

#### 还原一个容器

```
docker run --rm \
    --volumes-from backup_container \
    -v /backup \
    alpine \
    bash -c "cd /dbdata && tar xvf /backup/data.tar --strip 1"
```

#### 删除一个数据卷

删除的数据卷有两种情况：

- 命名卷在容器外部有指定源，删除了容器，数据卷并不会被删除
- 匿名卷没有指定源，在删除容器时，该匿名卷也会被删除。也可在创建容器时，加上`--rm`参数，关闭时自动删除容器和匿名卷。

## 存储引擎

## 参考资料

[Docker 官方文档-存储](#https://docs.docker.com/storage/)
每天 5 分钟玩转 docker 容器技术

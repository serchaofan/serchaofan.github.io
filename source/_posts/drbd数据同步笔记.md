---
title: DRBD数据同步笔记
date: 2018-09-30 20:50:41
tags: [DRBD, 同步, 集群, 高可用]
categories: [应用运维]
---

- [DRBD 概述](#drbd-%e6%a6%82%e8%bf%b0)
  - [DRBD 功能](#drbd-%e5%8a%9f%e8%83%bd)
- [DRBD 基础搭建](#drbd-%e5%9f%ba%e7%a1%80%e6%90%ad%e5%bb%ba)
  - [准备](#%e5%87%86%e5%a4%87)
  - [搭建](#%e6%90%ad%e5%bb%ba)

<!--more-->

# DRBD 概述

**Distributed Replicated Block Device 分布式复制块设备**是一种基于软件的，无共享，复制的存储解决方案。可以实现在网络中的两台服务器之间**基于块设备级别**的实时或异步镜像或同步复制，类似于 rsync+inotify，是基于 TCP/IP 网络的 RAID1。DRBD 是基于文件系统底层的，即 block 层级同步，效率较 rsync 更快。块设备可以是磁盘分区、LVM 逻辑卷、磁盘等。

DRBD 工作在文件系统的层级以下，比文件系统更加靠近操作系统内核以及 I/O。当 DRBD 使用在两台 HA 服务器上，一旦数据写入其中一台的本地磁盘，则该数据会被实时发送到另一台主机，以相同形式记录在文件系统中，实现主备数据同步。

DRBD 镜像的特点：

- 实时：应用程序修改设备上的数据时，会不断进行复制。
- 透明：应用程序无需知道数据存储在多个主机上。
- 同步或异步。使用同步镜像，在所有主机上执行**写入后**，应用程序会收到写入完成的通知。使用异步镜像，当**写入在本地完成时**，应用程序会收到写入完成的通知，这通常是在数据传播到其他主机之前。

DRBD 的核心功能是通过 Linux 内核模块实现的。具体而言，DRBD 构成虚拟块设备的驱动程序，因此 DRBD 位于系统 I / O 堆栈的底部附近。因为 DRBD 的定义以及 Linux 内核体系结构强制要求，DRBD 不依赖于它上面的层，也就无法管理上一层（即文件系统层），例如 DRBD 无法自动检测文件系统损坏。

{% asset_img 0.png %}

其中，**File system**为 API 向外输出的接口，**Buffer cache**用来缓存数据与元数据的，**Disk Scheduler**是用来排序内存中即将要写入磁盘的数据合并读请求。

DRBD 的两种同步模式：

- 实时同步：当数据写入到本地磁盘和远端所有服务器磁盘都成功后才返回成功写入信息，可以防止本地和远端数据丢失或不一致，在生产环境中最常用。
- 异步同步：当数据写入到本地服务器成功后就直接返回成功写入信息，不管远端服务器是否写入成功。

## DRBD 功能

两种工作模式：

- **单主模式（Single-primary mode）**：资源在任何给定时间仅在一个集群节点上的主要角色（primary role）中。由于保证只有一个集群节点可以随时处理数据，因此该模式可以与任何传统文件系统（ext3，ext4，XFS 等）一起使用。**在单主模式下部署 DRBD 是高可用性（具有故障切换功能）集群的规范方法。**
- **双主模式（Dual-primary mode）**：资源在任何给定时间都在集群节点上的主要角色中。由于可以同时访问数据，因此该模式**需要使用利用分布式锁管理器的共享集群文件系统**，如 GFS 和 OCFS2。在双主模式下部署 DRBD 是**负载均衡集群**的首选方法，这些集群需要从两个节点进行并发数据访问。默认禁用此模式，必须在 DRBD 的配置文件中显式启用。

**复制模型（Replication modes）**：DRBD 支持三种不同的复制模式，允许三种复制同步性。

- **Protocol A：异步复制协议**。一旦**本地磁盘写入完成**，则认为主节点上的本地写入操作已完成，并且复制数据包已放置在本地 TCP 发送缓冲区中。在强制故障转移的情况下，可能会发生数据丢失。**故障转移后备用节点上的数据是一致的，但是崩溃之前执行的最新更新可能会丢失**。**协议 A 最常用于远程复制方案**。与 DRBD Proxy 结合使用时，它可以提供有效的灾难恢复解决方案。

- **Protocol B：内存同步（半同步）复制协议。** 一旦发生本地磁盘写入，**并且复制数据包已到达对端节点**，则认为主节点上的本地写入操作已完成。通常，**在强制故障转移的情况下不会丢失写入**。但是，**如果两个节点同时出现电源故障并且主要数据存储的并发**，出现不可逆转的破坏，则在主节点上完成的最近写入可能会丢失。

- **Protocol C：同步复制协议。**只有在**确认了本地和远程磁盘写入后**，才认为主节点上的本地写操作已完成。因此，单个节点的宕机不会导致任何数据丢失。但是如果两个节点（或其存储子系统）同时被不可逆转地销毁，数据丢失也是不可避免的。

  **生产环境最常用的就是协议 C**

> 复制协议的选择会影响部署的两个要素：保护（protection）和延迟（latency）。吞吐量（thoughput）很大程度上与所选的复制协议无关。

**脑裂与自动修复**

DRBD 脑裂：节点间由于网络故障或集群软件错误导致 DRBD 两个节点都切换为主节点而断开连接。在 8 版本后，DRBD 实现了脑裂的自动修复以及脑裂通知。DRBD 提供以下的修复策略：

- 丢弃较新的主节点的修改，即因脑裂升为主节点的节点。
- 丢弃老的主节点的修改
- 丢弃修改较少的主节点的修改。会先比较两个节点的数据，再丢弃修改较少的节点的数据
- 一个节点数据没有发生变化的情况下完美修复脑裂

# DRBD 基础搭建

## 准备

实验继续沿用 heartbeat 的实验环境：

- Ubuntu18.04，heartbeat3.0

- ubuntu-s1：172.16.246.155（ens33）

  heartbeat（ens37）：192.168.60.100

- ubuntu-s2：172.16.246.156（ens33）

  heartbeat（ens37）：192.168.60.101

heartbeat 配置沿用实验的。

```
# ha.cf的配置
node    ubuntu-s1
node    ubuntu-s2
auto_failback on
mcast ens33 225.0.0.1 694 1 0
bcast   ens37
debugfile /var/log/ha-debug
logfile /var/log/heartbeat.log
logfacility     local2
keepalive 2
deadtime 30
warntime 10
initdead 120

# authkeys的配置
auth 1
1 sha1 3c767c41afb12ada140190ed82db3fd930e2efa3

# haresources的配置
ubuntu-s1 IPaddr::172.16.246.200/24/ens33
ubuntu-s2 IPaddr::172.16.246.201/24/ens33
```

重启 heartbeat 服务，查看两台主机的 IP 地址

```
# ubuntu-s1
inet 172.16.246.155/24 brd 172.16.246.255 scope global dynamic ens33
inet 172.16.246.200/24 brd 172.16.246.255 scope global secondary ens33:6
# ubuntu-s2
inet 172.16.246.156/24 brd 172.16.246.255 scope global dynamic ens33
inet 172.16.246.201/24 brd 172.16.246.255 scope global secondary ens33:6
```

并且**一定要做到时间同步**。两台虚拟机都加上一块硬盘，大小设为 1G。并且对新加磁盘`sdb`分区。分两个主分区，一个约 800M，一个约 200M。800M 的作为存储实际业务数据的分区，200M 的作为 meta data 分区，存储 drbd 同步的状态信息。

```
Device     Boot   Start     End Sectors  Size Id Type
/dev/sdb1          2048 1640447 1638400  800M 83 Linux
/dev/sdb2       1640448 2097151  456704  223M 83 Linux
```

> 在生产环境中，meta data 分区一般给 1-2G 大小。

分区完后，meta data 分区不要格式化建文件系统，且暂时都不要挂载。在`sdb1`上建文件系统。`mkfs.ext4 /dev/sdb1`

> 注：如果数据大小超过 2T，则需要用`parted`命令分区，不能用`fdisk`了。

安装 DRBD，在 ubuntu18.04 的库中软件叫做`drbd-utils`，安装即可，版本为 8.9，两台都要装。

安装完成后，查看 drbd 模块是否加载

```
# lsmod | grep drbd
drbd                  360448  0
lru_cache              16384  1 drbd
libcrc32c              16384  4 nf_conntrack,nf_nat,drbd,raid456
```

源码编译安装 drbd 驱动，版本为 9.0.16。[下载源码包](https://www.linbit.com/en/drbd-community/drbd-download/)，进入解压目录。

直接`make && make install`，然后要`modprobe drbd`。在查看是否加载成功

```
# lsmod | grep drbd
drbd                  550058  0
libcrc32c              12644  4 xfs,drbd,nf_nat,nf_conntrack
```

还是该网站下载 drbd-utils，版本需要看编译驱动后的说明。

```
  Again: to manage DRBD 9 kernel modules and above,
  you want drbd-utils >= 9.3 from above url.
```

这里下载了 drbd-utils-9.6 的包，进入解压目录

```
./configure --prefix=/usr/local/drbd9  \
            --with-heartbeat \         允许heartbeat的haresources脚本
            --sysconfdir=/etc/         设置配置文件目录
```

然后`make && make install`即可。

可能会报错`make[1]: *** [drbdsetup.8] 错误 4`，需要安装依赖`docbook-style-xsl`

## 搭建

drbd 的配置文件为`/etc/drbd.conf`和`/etc/drbd.d/`中的`global_common.conf`以及所有`.res`结尾文件，`.res`结尾的文件是专门用来配置资源的。用于配置 drbd 参数的文件是`global_common.conf`，有模板文件`/usr/share/doc/drbd-utils/examples/drbd.conf.example.gz`参考。

```
global {        # 全局配置
  usage-count no;     # 不允许网站统计开源软件的安装量
}
common {
  handlers { }
  startup { }
  options { }
  disk { }
  net {
    protocol C;
  }
}
```

创建资源配置文件`heartbeat.res`

```
resource data {   # 资源名，随便起
	protocol C;     # 采用协议C

	disk {          # 磁盘配置，可不配
		on-io-error detach;
	}

	on ubuntu-s1 {   # 服务器配置
    device    /dev/drbd1;   # drbd会用专门的设备写数据
    disk      /dev/sdb1;    # 数据存放磁盘
    address   192.168.60.200:7789;   # 主机的心跳线IP地址，后面的端口不用改
    meta-disk /dev/sdb2[0]; # 存放meta data的分区
  }
  on ubuntu-s2 {
    device    /dev/drbd1;
    disk      /dev/sdb1;
    address   192.168.60.201:7789;
    meta-disk /dev/sdb2[0];
  }
}
```

初始化 DRBD 的 meta data，创建 DRBD 记录信息的 meta data 分区元数据。

`drbdadm create-md data`，其中 data 就是在 res 文件中配置的资源名

初始化启动 DRBD`drbdadm up data`，没报错说明启动成功。查看进程

```
# ps -ef | grep drbd
root        507      2  0 17:25 ?        00:00:00 [drbd-reissue]
root       2682      2  0 20:15 ?        00:00:00 [drbd1_submit]
root       2689      2  0 20:15 ?        00:00:00 [drbd_w_data]
root       2877      2  0 21:06 ?        00:00:00 [drbd_r_data]
root       2902      2  0 21:11 ?        00:00:00 [drbd_a_data]
root       2903      2  0 21:11 ?        00:00:00 [drbd_as_data]
```

如果报错，可能是磁盘分区的问题，或者 drbd 的 meta data 创建的问题。

可以通过`cat /proc/drbd`查看 DRBD 的状态。以下是初始时的状态。

```
version: 8.4.10 (api:1/proto:86-101)
srcversion: 17A0C3A0AF9492ED4B9A418

 1: cs:WFConnection ro:Secondary/Unknown ds:Inconsistent/DUnknown C r-----
    ns:0 nr:0 dw:0 dr:0 al:8 bm:0 lo:0 pe:0 ua:0 ap:0 ep:1 wo:f oos:818944
```

如果 ro 为`Secondary/Unknown`，说明 DRBD 没有连通，是网络的问题，检查网卡、路由。修复后再查看。

```
1: cs:Connected ro:Secondary/Secondary ds:Inconsistent/Inconsistent C r-----
    ns:0 nr:0 dw:0 dr:0 al:8 bm:0 lo:0 pe:0 ua:0 ap:0 ep:1 wo:f oos:818944
```

两台 drbd 都是`Secondary/Secondary`则成功。`ds`为`Inconsistent`表示两端的数据还不一致。

在 ubuntu-s1 上使自身成为 primary 节点，`drbdadm primary data`，如果报错，可以加`--force`强制执行。

```
1: State change failed: (-2) Need access to UpToDate data
```

再查看两台主机的`/proc/drbd`，两台主机的 ro 是相反的。并且已完成了同步

```
# ubuntu-s1
 1: cs:SyncSource ro:Primary/Secondary ds:UpToDate/Inconsistent C r-----
    ns:16976 nr:0 dw:0 dr:17616 al:0 bm:0 lo:0 pe:0 ua:0 ap:0 ep:1 wo:f oos:802224
	[>....................] sync'ed:  3.0% (802224/819200)K
	finish: 0:04:39 speed: 2,828 (2,828) K/sec

# ubuntu-s2
1: cs:SyncTarget ro:Secondary/Primary ds:Inconsistent/UpToDate C r-----
    ns:0 nr:41984 dw:41984 dr:0 al:0 bm:0 lo:1 pe:1 ua:0 ap:0 ep:1 wo:f oos:777216
	[>...................] sync'ed:  6.0% (777216/819200)K
	finish: 0:03:05 speed: 4,196 (4,196) want: 8,120 K/sec
```

如果状态为`Secondary/Unknown`，还有可能是出现了脑裂。可以在备节点上操作

```
drbdadm secondary data
drbdadm connect --discard-my-data data
```

然后在主节点操作`drbdadm connect data`，再查看是否解决。

在主节点挂载 DRBD 设备`mount /dev/drbd1 /data`，备节点是不能挂载的。

在主节点上测试`dd if=/dev/zero of=/data/zero count=1000000`，然后在备节点上查看`/proc/drbd`

```
 1: cs:Connected ro:Secondary/Primary ds:UpToDate/UpToDate C r-----
    ns:0 nr:575700 dw:575700 dr:0 al:0 bm:0 lo:0 pe:0 ua:0 ap:0 ep:1 wo:f oos:0
```

容量也同步为 500 多 M，说明数据同步成功。

> 参考文章
>
> [DRBD 工作原理及安装配置详解](http://www.ywnds.com/?p=6619)
>
> [DRBD 原理知识](https://www.cnblogs.com/guoting1202/p/3975685.html)
>
> [DRBD 官方文档](https://docs.linbit.com/docs/users-guide-8.4)
>
> [【高可用 HA】HA 之 DRBD 详解（基于 CentOS7.0）](https://blog.csdn.net/wylfengyujiancheng/article/details/50669947)

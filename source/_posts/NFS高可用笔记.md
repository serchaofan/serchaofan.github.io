---
title: NFS高可用笔记
date: 2018-11-27 08:27:27
tags: [nfs, 高可用]
categories: [应用运维]
---

- [NFS 高可用概述](#nfs-%e9%ab%98%e5%8f%af%e7%94%a8%e6%a6%82%e8%bf%b0)
- [NFS+Keepalived+DRBD 搭建](#nfskeepaliveddrbd-%e6%90%ad%e5%bb%ba)

<!--more-->

# NFS 高可用概述

NFS 的物理磁盘往往做 RAID10 或 RAID0，再通过 DRBD 同步 NFS，以及设置 VIP 进行主从热备。若主 NFS 宕机后，默认情况在几秒内，新的主 NFS 就可以启动同步程序自动把数据同步到所有从 NFS 中。

{% asset_img 1.png %}

# NFS+Keepalived+DRBD 搭建

实验环境：

- host1：NFS-Master
  - ens32：192.168.60.134
  - ens34：192.168.70.128（Heartbeat 线网卡）
  - ens35：192.168.80.128（DRBD 线网卡）
  - sdb：2G（NFS 存数据）
- host2：NFS-Backup
  - ens32：192.168.60.135
  - ens34：192.168.70.129（Heartbeat 线网卡）
  - ens35：192.168.80.129（DRBD 线网卡）
  - sdb：2G（NFS 存数据）
- host3：NFS-Slave
  - ens32：192.168.60.136

首先在 host1 和 host2 上安装 Cluster Glue，[cluster-glue 下载](https://github.com/ClusterLabs/cluster-glue/releases)

解压后，进入目录，执行`autogen.sh`，生成`configure`文件

安装可能需要的依赖：

```
yum install -y glib2-devel libxml2-devel bzip2-devel flex-devel bison-devel OpenIPMI-devel net-snmp-devel ipmitool ipmiutil ipmiutil-devel asciidoc
```

编译安装

```
./configure --prefix=/usr/local/glue \
            LIBS='/lib64/libuuid.so.1'    # 一定要指定否则会报错
```

然后`make && make install`

下载 heartbeat 源码包，[下载地址](http://www.linux-ha.org/wiki/Downloads)，解压进入目录执行`./bootstrap`生成`configure`文件，开始构建

```
./configure --prefix=/usr/local/heartbeat \
            CFLAGS=-l/usr/local/heartbeat/include -L/usr/local/heartbeat/lib
```

编译安装 keepalived。先检查依赖`libnl-devel`与`libnl3-devel`

```
./configure --prefix=/usr/local/keepalived \
            --bindir=/usr/bin \
            --sbindir=/usr/sbin \
            --sysconfdir=/etc
```

首先配置分区一个是 400M，用于存放元数据，一个是 1.6G，用于存放业务数据。

安装 DRBD，可通过 yum 安装，但要先安装 elrepo 源，[下载地址](https://elrepo.org/tiki/tiki-index.php)，安装完成后，查看该 repo 文件，将`enabled`设为 1。

安装 DRBD，先`yum search` 查看要安装的版本，安装 9 的版本需要安装`drbd90-utils`和`kmod-drbd90`。

导入 drbd 内核`modprobe drbd`，再查看`lsmod | grep drbd`

```
# lsmod | grep drbd
drbd                  541356  0
libcrc32c              12644  2 xfs,drbd
```

drbd 模块导入成功。

编辑`/etc/drbd.d/nfs.res`配置，两台主机上要一致。

```
resource data {
  protocol C;
  on host1 {
    device    /dev/drbd1;
    disk      /dev/sdb2;
    address   192.168.80.128:7789;      # 心跳线
    meta-disk /dev/sdb1[0];
  }
  on host2 {
    device    /dev/drbd1;
    disk      /dev/sdb2;
    address   192.168.80.129:7789;
    meta-disk /dev/sdb1[0];
  }
}
```

创建 drbd 磁盘`drbdadm create-md data`并启动`drbdadm up data`，两台都要执行。

查看是否正常启动，以下为 drbd9 的显示，与 8 版本不同。

```
# cat /proc/drbd
version: 9.0.14-1 (api:2/proto:86-113)
GIT-hash: 62f906cf44ef02a30ce0c148fec223b40c51c533 build by mockbuild@, 2018-05-04 03:32:42
Transports (api:16): tcp (9.0.14-1)
```

使 host1 变为角色变为 primary。`drbdadm primary data --force`

在 host1 上挂载`mount /dev/drbd1 /var/drbd1`，并在其中创建文件。

> 一定要在设置了 primary 角色后才挂载，否则挂载不上。

然后 host1 卸载挂载，并角色转为 secondary

```
umount /var/drbd1
drbdadm secondary data
```

在 host2 上转变角色为 primary，并挂载

```
drbdadm primary data
mount /dev/drbd1 /var/drbd1
```

进入目录后查看，能看到在 host1 上创建的文件，同步实现。实验完后切换回来，仍然是 host1 为 primary，host2 为 secondary。

安装 NFS 服务，在两台主机上`yum install nfs-utils rpcbind`

`systemctl start nfs-server.service rpcbind.service`应该是先启动 rpcbind、再启动 nfs-server。

在两台 host 上修改 nfs 配置文件`/etc/exports`

```
/var/drbd1   192.168.60.*(rw,sync)
```

命令`exportfs -r`重新导入`/etc/exports`中的目录。

使用`showmount -e 192.168.60.134`查看是否配置成功

```
# showmount -e 192.168.60.134
Export list for 192.168.60.134:
/var/drbd1 192.168.60.*
```

开启一台同网段客户端验证。先安装`nfs-utils`和`rpcbind`

执行`mount -t nfs 192.168.60.134:/var/drbd1 /var/drbd1`

查看该目录，里面有创建的文件，NFS 获取成功。

> 错误解决参考文章：
>
> http://doc.okbase.net/zhangjie830621/archive/79242.html
>
> https://www.linuxidc.com/Linux/2012-11/73620.htm
>
> http://www.bubuko.com/infodetail-1848309.html

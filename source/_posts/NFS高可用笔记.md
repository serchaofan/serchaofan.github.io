---
title: NFS高可用笔记
date: 2018-11-27 08:27:27
tags: [nfs, 高可用]
---

* [NFS高可用概述](#NFS高可用概述)
* [NFS+Keepalived+DRBD搭建](#NFS+Keepalived+DRBD搭建)
* []()



<!--more-->



# NFS高可用概述

NFS的物理磁盘往往做RAID10或RAID0，再通过DRBD同步NFS，以及设置VIP进行主从热备。若主NFS宕机后，默认情况在几秒内，新的主NFS就可以启动同步程序自动把数据同步到所有从NFS中。

{% asset_img 1.png %}



# NFS+Keepalived+DRBD搭建

实验环境：

* host1：NFS-Master
  * ens32：192.168.60.134
  * ens34：192.168.70.128（Heartbeat线网卡）
  * ens35：192.168.80.128（DRBD线网卡）
  * sdb：2G（NFS存数据）
* host2：NFS-Backup
  * ens32：192.168.60.135
  * ens34：192.168.70.129（Heartbeat线网卡）
  * ens35：192.168.80.129（DRBD线网卡）
  * sdb：2G（NFS存数据）
* host3：NFS-Slave
  * ens32：192.168.60.136



首先在host1和host2上安装Cluster Glue，[cluster-glue下载](https://github.com/ClusterLabs/cluster-glue/releases)

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

下载heartbeat源码包，[下载地址](http://www.linux-ha.org/wiki/Downloads)，解压进入目录执行`./bootstrap`生成`configure`文件，开始构建

```
./configure --prefix=/usr/local/heartbeat \
            CFLAGS=-l/usr/local/heartbeat/include -L/usr/local/heartbeat/lib
```

编译安装keepalived。先检查依赖`libnl-devel`与`libnl3-devel`

```
./configure --prefix=/usr/local/keepalived \
            --bindir=/usr/bin \
            --sbindir=/usr/sbin \
            --sysconfdir=/etc
```



首先配置分区一个是400M，用于存放元数据，一个是1.6G，用于存放业务数据。

安装DRBD，可通过yum安装，但要先安装elrepo源，[下载地址](https://elrepo.org/tiki/tiki-index.php)，安装完成后，查看该repo文件，将`enabled`设为1。

安装DRBD，先`yum search` 查看要安装的版本，安装9的版本需要安装`drbd90-utils`和`kmod-drbd90`。

导入drbd内核`modprobe drbd`，再查看`lsmod | grep drbd`

```
# lsmod | grep drbd
drbd                  541356  0 
libcrc32c              12644  2 xfs,drbd
```

drbd模块导入成功。

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

创建drbd磁盘`drbdadm create-md data`并启动`drbdadm up data`，两台都要执行。

查看是否正常启动，以下为drbd9的显示，与8版本不同。

```
# cat /proc/drbd 
version: 9.0.14-1 (api:2/proto:86-113)
GIT-hash: 62f906cf44ef02a30ce0c148fec223b40c51c533 build by mockbuild@, 2018-05-04 03:32:42
Transports (api:16): tcp (9.0.14-1)
```

使host1变为角色变为primary。`drbdadm  primary data --force`

在host1上挂载`mount /dev/drbd1 /var/drbd1`，并在其中创建文件。

> 一定要在设置了primary角色后才挂载，否则挂载不上。

然后host1卸载挂载，并角色转为secondary

```
umount /var/drbd1
drbdadm secondary data
```

在host2上转变角色为primary，并挂载

```
drbdadm primary data
mount /dev/drbd1 /var/drbd1
```

进入目录后查看，能看到在host1上创建的文件，同步实现。实验完后切换回来，仍然是host1为primary，host2为secondary。



安装NFS服务，在两台主机上`yum install nfs-utils rpcbind`

`systemctl start nfs-server.service rpcbind.service`应该是先启动rpcbind、再启动nfs-server。

在两台host上修改nfs配置文件`/etc/exports`

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

查看该目录，里面有创建的文件，NFS获取成功。



>  错误解决参考文章：
>
> http://doc.okbase.net/zhangjie830621/archive/79242.html
>
> https://www.linuxidc.com/Linux/2012-11/73620.htm
>
> http://www.bubuko.com/infodetail-1848309.html














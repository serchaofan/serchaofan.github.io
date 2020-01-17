---
title: Heartbeat笔记
date: 2018-09-30 18:27:26
tags: [heartbeat, server, 高可用, 集群]
categories: [应用运维]
---

- [Heartbeat 概念](#Heartbeat概念)
- [Heartbeat 配置](#Heartbeat配置)

<!--more-->

# Heartbeat 概念

Heartbeat 项目是 Linux-HA 工程的一个组成部分，它实现了一个高可用集群系统。可以将资源（IP 及程序服务等资源）从一台故障计算机快速转移到另一台运转正常的机器继续提供服务。

通过修改 heartbeat 的配置文件，可以指定一台 heartbeat 服务器作为**主服务器**，另一台自动成为**热备服务器**。在**热备服务器**上面配置 heartbeat 守护程序来**监听来自主服务器的心跳信息**。如果**在规定时间内，无法监听到心跳信息，那么就启动故障转移，取得主服务器上的相关资源的所有权，接替主服务器继续不间断的提供服务**，从而达到资源以及服务高可用的目的。而 heartbeat 还支持**主主模式**，即两台服务器互为主备，互相监听，发送心跳报文。

注：heartbeat 的业务切换时间大概在 5 到 20 秒，所谓的**业务不间断其实是保障业务一致，不会造成数据错误**。heartbeat 的高可用是**服务器级别的**，而不是服务级别的。

业务切换的常见条件为：

- 服务器宕机
- 心跳线故障
- heartheat 服务本身故障

heartbeat 服务器间通信的方法：

- 串口线缆。线缆专门进行心跳通信，稳定，且不用配 IP 地址。缺点：服务器距离不能远。
- 两台服务器网卡通过以太网线直连。推荐使用
- 两台服务器网卡通过以太网设备连接。不稳定

heartbeat 应用场景：

- 主要用于双机场景，如：web 服务器、数据库、文件服务器、负载均衡器、代理服务器
- 而如果负载均衡采用了 LVS，则最好不要使用 heartbeat，而是使用 keepalived，因为 heartbeat 没有对下面节点 RS 的健康状态检查。
- heartbeat 适合更多机器的连接，keepalived 在多机（超过两台）上可能会出问题
- 需要数据同步的业务最好使用 heartbeat，如：mysql 双主多从、NFS/MFS 等。也可配合 drbd 服务同步。如果使用 inotify+rsync 解决了同步问题，也可以用 keepalived。

## 脑裂

两台正常运行的高可用服务器在心跳超时内无法监听到对方心跳报文，于是各自启动了故障转移，获取了资源的所有权，两台服务器都拥有同一个 VIP 地址，数据会出现不一致或丢失，这种情况称为脑裂（split brain）。

**发生脑裂的原因：**

- 高可用服务器对之间的心跳链路故障，导致无法正常通信
  - 心跳线故障
  - 网卡或相关驱动故障
  - IP 配置冲突
  - 心跳线间连接的设备故障，如交换机
  - 仲裁机器故障
- 高可用服务器上开启了防火墙，过滤掉了心跳报文
- 心跳配置不一致，如心跳方式、心跳广播冲突，以及软件 BUG 等

**防止脑裂的方法：**

- 同时使用串口线缆和以太网线缆，组成**两条心跳线**
- **检测到脑裂时强行关闭一个节点，若备节点认为主节点故障，则会自动向主节点发送关机命令**（此功能需要特殊设备支持，如 STONITH、fencing）
- 对脑裂的告警，及时采取措施
- 启用磁盘锁，正在提供服务的一方锁住共享磁盘，即使发生脑裂也不会出现数据不一致或丢失情况。
- 增加仲裁机制。例如设置参考 IP 地址，若能 ping 通的服务器则接管服务，ping 不通的服务器主动放弃竞争。

> STONITH：Shoot-The-Other-Node-In-The-Head，是 heartbeat 的一个组件，能够保护数据使其不会因为节点异常或者同时访问而遭到损坏。**用于集群服务无法停下的情况，在这种情况下，集群可以使用 STONITH 来强制整个节点离线，并让服务在其它节点上安全启用。**

## heartbeat 消息类型

三种 heartbeat 消息类型：

- 心跳消息：控制心跳频率和出现故障后进行故障转换的等待时间。可以单播广播和组播，约 150 字节。

- 集群转换消息：`ip-request`和`ip-request-resp`

  当主服务器恢复后，使用`ip-request`消息要求备机将服务的提供权交还给主服务器。备服务器将服务提供权释放后，通过`ip-request-resp`通知主服务器，主节点收到后开始正常提供服务

- 重传消息：`rexmit-request`控制重传心跳请求

## heartbeat IP 地址接管及故障转移

heartbeat 通过 IP 地址接管和 ARP 广播进行故障转移。为防止 ARP 老化时间内，客户端仍请求已故障的服务器，备服务器会进行强制所有客户端进行 ARP 表项刷新。

VIP 为对外提供服务的 IP 地址，因此需要在 DNS 上配置将网站的域名解析到这个 VIP。有两种手工配置 VIP 的方法：

- `ifconfig eth0:1 [IP地址] netmask [掩码] up`
- `ip addr add [IP地址/掩码] broadcast [该网段广播地址] dev eth1`

注：`ip addr`能看到网卡别名和 VIP，而`ifconfig`无法看到。

# Heartbeat 配置

在红帽系的库（包括 epel）中已经没有 heartbeat 了，在 ubuntu 的库中还有，所以用 ubuntu 做实验。ubuntu 版本 18.04，heartbeat 版本 3.0.6。

heartbeat 的默认配置文件目录为`/etc/ha.d`，主要的配置文件存放在`/usr/share/doc/heartbeat`中。

- `ha.cf.gz`，是被 gz 压缩的，解压后得到`ha.cf`。是 heartbeat 的参数配置文件

- `authkeys`，是 heartbeat 认证文件

- `haresources.gz`，也是 gz 压缩，解压得到`haresources`，是 heartbeat 资源配置文件

将这三个文件复制到`/etc/ha.d`中

heartbeat 的资源目录为`/etc/ha.d/resources.d/`，可以将开发的程序直接放在该目录中，然后在`haresources`中调用。

实验环境：

两台 ubuntu 作为负载均衡器，要有双网卡，一个提供服务，一个做心跳线

- 负载均衡器 1（master）：172.16.246.155（网卡 ens33）

  heartbeat 网卡：192.168.60.100（网卡 ens37）

- 负载均衡器 2（backup）：172.16.246.156（网卡 ens33）

  heartbeat 网卡：192.168.60.101（网卡 ens37）

{% asset_img 1.png %}

设置好`/etc/hosts`，使能通过主机名访问，主机名要和`uname -n`的结果一致。

## 配置文件参数

列举的是常用参数，并没有修改为实验用的值

### ha.cf

```
debugfile    /var/log/ha-debug    # 调试日志位置
logfile      /var/log/ha-log      # 日志位置
logfacility     local0            # 日志设备
keepalive       2     # 心跳间隔
deadtime        30    # 认为主节点宕机的超时时间
warntime        10    # 心跳延迟时间，备份节点无法接收主节点的心跳时就会往日志写入一个警告日志
initdead        120   # heartbeat在首次运行后，需等待120秒才能启动主服务器的资源。取值至少为deadtime的两倍
udpport         694   # UDP端口，默认为694
mcast eth0 225.0.0.1 694 1 0    # 多播端口
auto_failback on      # 是否开启自动故障恢复。因故障而切换的资源是否要在主节点恢复后再切回主节点
bcast  eth0           # 广播端口
node  XXX             # 节点名，先定义的是主节点，后定义的都是备用节点
```

### authkeys

```
# 可用的加密算法：crc、sha1、md5。crc不需要密码。官方推荐sha1和md5。crc没有安全性
auth 1
1 crc
2 sha1 HI!
3 md5 Hello!
```

**注：`authkeys`文件的权限必须是`600`，否则无法启动 heartbeat**

### haresources

只要添加 heartbeat 的两台主机即可，指定 VIP，无须手动创建

```
ubuntu-s1 IPaddr::172.16.246.200/24/ens33
ubuntu-s2 IPaddr::172.16.246.201/24/ens33
# 其中的IPaddr是/etc/ha.d/resources.d/中的IPaddr脚本
```

### 实际配置

`ha.cf`配置，两台都要配

```
debugfile /var/log/ha-debug
logfile /var/log/heartbeat.log
logfacility     local2
keepalive 2
deadtime 30
warntime 10
initdead 120
mcast ens33 225.0.0.1 694 1 0
bcast   ens37
auto_failback on
node    ubuntu-s1
node    ubuntu-s2
```

`authkeys`配置，先用命令`sha1sum -t`输入密码生成密钥。然后复制到文件中，只保留 sha1。

```
auth 1
1 sha1 3c767c41afb12ada140190ed82db3fd930e2efa3
```

修改`haresources`，配置的是 VIP，不需要手动创建

```
ubuntu-s1 IPaddr::172.16.246.200/24/ens33
ubuntu-s2 IPaddr::172.16.246.201/24/ens33
```

这三个文件都要做到两端一致（除了日志的设定可以不一致）。然后启动 heartbeat，`systemctl start hearthbeat`

等待`initdead`的时间后，查看网卡，可以发现 VIP 的网卡已自动创建

```
ens33:1: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.16.246.200  netmask 255.255.255.0  broadcast 172.16.246.255
        ether 00:0c:29:93:da:9b  txqueuelen 1000  (Ethernet)
```

模拟一台宕机，关闭`ubuntu-s1`的 heartbeat，查看 ubuntu-s2。发现成功迁移。

```
ens33:1: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.16.246.201  netmask 255.255.255.0  broadcast 172.16.246.255
        ether 00:0c:29:e5:d5:55  txqueuelen 1000  (Ethernet)

ens33:2: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.16.246.200  netmask 255.255.255.0  broadcast 172.16.246.255
        ether 00:0c:29:e5:d5:55  txqueuelen 1000  (Ethernet)
```

重启 ubuntu-s1 的 heartbeat，再查看 ubuntu-s2 的网卡，已经迁移回去，因为开启了`auto_failback`

```
ens33:1: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.16.246.201  netmask 255.255.255.0  broadcast 172.16.246.255
        ether 00:0c:29:e5:d5:55  txqueuelen 1000  (Ethernet)
```

### 将 apache 交给 heartbeat 管理

将命令`apachectl`复制到`/etc/ha.d/resource.d/`中，然后修改`haresources`文件，在一个主机的最后加上`apachectl`

```
ubuntu-s1 IPaddr::172.16.246.200/24/ens33 apachectl
```

注意：

- 脚本要放在`/etc/ha.d/resource.d/`中
- 脚本的执行要有 start 和 stop 两个参数
- 脚本要有可执行权限
- `haresources`文件中的脚本名一定是`resource.d`中的指定脚本

关闭 apache 和 heartbeat，然后只启动 heartbeat，但是 apache 也被启动了。可看到日志中

```
ResourceManager(default)[8373]:    info: Running /etc/ha.d/resource.d/apachectl  start
```

heartbeat 两种方法实现高可用：

- 仅控制 VIP 资源转移，而不负责资源的启动与关闭。一般用于 web 服务
- 既控制 VIP 资源转移，又负责资源的启动与关闭。一般用于数据库、存储服务，为了控制数据一致性，防止两台都在写。

### 故障排查

若主节点出现故障，可以使用命令`hb_standby`将业务推到备节点，再对主节点配置进行检查。该脚本存放在`/usr/share/heartbeat/`中。

将故障排除后，还可执行脚本`/usr/share/heartbeat/hb_takeover`再次接管业务。

# 参考文章

- [Heartbeat 介绍](https://blog.csdn.net/zyd_15221378768/article/details/78982353)
- [Heartbeat 高可用解决方案](https://www.cnblogs.com/zhangsubai/p/5393447.html)
- [heartbeat 单独提供高可用服务](https://www.cnblogs.com/f-ck-need-u/p/8587882.html)

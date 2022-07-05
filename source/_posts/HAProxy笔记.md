---
title: HAProxy笔记
date: 2018-05-31 12:01:06
tags: [HAproxy, 代理, server, 负载均衡]
categories: [Web服务器与负载]
comments: false
---

本篇包含以下内容：

- [HAProxy 介绍](#haproxy-介绍)
- [HAProxy 配置文件](#haproxy-配置文件)
  - [源码包安装](#源码包安装)
  - [HAProxy 操作](#haproxy-操作)
    - [HAproxy 配置文件](#haproxy-配置文件-1)
    - [web 查看状态](#web-查看状态)
    - [ACL 配置](#acl-配置)
- [HAProxy+Keepalived 搭建](#haproxykeepalived-搭建)
- [参考文章](#参考文章)

<!--more-->

# HAProxy 介绍

HAProxy 是一个提供高可用性、负载均衡，以及可基于 TCP（第四层）和 HTTP（第七层）的应用代理软件。

HAProxy 适合处理高负载 Web 站点的 HTTP 请求，这些站点通常需要**会话保持或七层处理**，HAProxy 完全支持数以万计的并发连接，并且能使后端的 Web 服务器不会暴露。HAProxy 还支持**服务器健康检查**，当后端服务器出现故障后，HAProxy 会自动移除该服务器，在故障排除后自动将该服务器加入。

HAProxy 特点：

- 支持连接拒绝：通过限制连接防御攻击蠕虫，降低被 DDOS 攻陷的可能
- 支持全透明代理
- 支持健康检查
- 实现会话保持
- 实现 HTTP 重写与重定向
- 自带服务器状态监控页面，实现监控统计
- 原生配置了 SSL 证书
- 支持虚拟主机
- 支持双机热备
- 支持服务器健康检查
- 单进程
- 支持 RDP 协议（远程桌面协议）

HAProxy 支持的代理模式：

- 基于四层的 TCP 代理：仅在客户端和服务器间进行流量转发。可用于邮件服务（SMTP、POP3 等）、内部协议通信服务器、MySQL、https 等

  **四层根据负载均衡算法直接修改报文的目的 IP 地址，然后发送给后端，相当于一个转发的功能。**

- 基于七层的 HTTP 代理：能分析应用层协议，且能根据协议信息灵活控制访问。

  **七层是查看请求报文内容，根据内容选择后端服务器。不仅可以根据 IP 和端口进行负载分流，还能根据 URL、域名、浏览器、语言等报文参数决定负载均衡策略。**

  在七层模式下，负载均衡器与客户端还有后端服务器会分别建立一次 TCP 连接，因此七层负载对设备的要求更高，而处理能力也不如四层负载。

**HAProxy 的 frontend 和 backend 功能：**

- **frontend**：ACL 规则匹配，根据任意 HTTP 请求头内容做规则匹配，然后将请求重定向到指定的 backend
- **backend**：事先定义的 server pool，等待前端将请求转到的服务器组

HAproxy 实现性能最大化的做法：

- **单进程、事件驱动模型**降低了**上下文切换的开销和内存占用**
- O(1)事件检查器允许其在高并发连接中对任何连接的任何事件实现即时探测
- 在任何可用情况下，**单缓冲（Single Buffering）机制**能以**不复制任何数据的方式完成读写操作**，能够节约大量 CPU 时钟周期（CPU 主频的倒数。周期小说明执行速度变快）及内存带宽。
- MRU 内存分配器在固定大小的内存池中可实现即时内存分配，能显著减少创建一个会话的时长。
- 借助内核的`splice()`系统调用，可实现**零复制转发（Zero-copy forwarding）**，还可实现零复制启动（Zero-Starting）。
- 树型存储：实现了`O(logN)`的低开销保持计时器命令、保持运行队列命令、管理轮询和最少连接队列。
- 优化了 HTTP 首部分析，避免在分析过程中重读任何内存区域
- 降低了系统调用，大部分工作在用户空间中完成，如时间读取、缓冲聚合、问价描述符的启用和禁用等。

HAproxy 进程消耗比系统空间消耗低 20 倍以上，在某些系统上，HAproxy 的七层性能可能超过硬件负载均衡设备。

**负载均衡器的性能评估要素**

- **会话率**：单位时间内的处理请求数。该指标决定了一个负载均衡器是否能将所有请求分发出去，依赖于 CPU 性能。

  当关闭了 keep-alive 连接保持功能，session/s（每秒会话数）和 requests/s（每秒请求数）或者 hits/s（每秒命中数）是一样的。

  当开启了 keep-alive 连接保持功能，requests/s 或者 hits/s 要高很多

- **会话并发能力**：并发处理能力。当并发会话数上升时，session/s 会下降。该指标被系统允许的最大文件描述符数量以及内存大小限制。

- **数据率**：处理数据能力。当传输大的对象时，会增加并发会话数，可获得更高的数据率，这时 session 的创建与销毁是最少的。使用 MB/s 或 GB/s 为单位

**HAProxy 与 LVS 的异同**

- LVS 是基于**Linux 内核**实现的一种负载，HAProxy 是基于**第三方应用**实现的负载
- LVS 仅是四层 IP 负载均衡，HAProxy 提供四层与七层负载，提供 TCP 和 HTTP 应用的负载
- LVS 的状态检测功能单一，HAProxy 因为能在四层和七层负载，可支持端口、URL、脚本等多种状态检测方式
- HAProxy 的整体性能低于 LVS，LVS 拥有接近硬件设备的网络吞吐和连接负载能力

**HAProxy 负载均衡算法：**

- roundrobin：与 LVS 的轮询一致。
- static-rr：与 LVS 的 wrr 一致。
- leastconn：与 LVS 的 Least conn 一致。
- source：类似 LVS 的源地址散列 source hashing。对源 IP 进行哈希。同一客户端 IP 访问同一台服务器
- uri：类似 LVS 的目的地址散列 destination hashing。对目的地址进行哈希，同一请求的 URI 总是访问同一个服务器
- url_param：根据 URL 参数调度。将同一个用户信息都发往同一个后端服务器。
- hdr(name)：根据 HTTP 请求头锁定每一次 HTTP 请求。若缺少头，则用 rr 代替
- rdp-cookie(name)：查询每个 TCP 请求，并哈希 RDP cookie，用于退化的持久模式，使同一个用户或会话 ID 总是发送到同一台服务器。若没有 cookie，则使用 rr 代替。

# HAProxy 配置文件

直接通过`yum install haproxy`安装（版本可能很老），版本为 1.6。或者在[haproxy 下载](https://www.haproxy.org/download/)源码包，版本会更加新。安装后会自动创建用户 haproxy。可以通过`systemctl`管理。

## 源码包安装

下载的是 1.8.14 版本的源码包。进入解压目录

```
make PREFIX=/usr/local/haproxy1.8 TARGET=linux2628
# 其中TARGET是指定Linux内核版本，一定要写，Linux2.6以及3.X都是写linux2628
make install PREFIX=/usr/local/haproxy1.8
```

若使用源码安装，则不会自动创建 haproxy 用户及用户组，需要手动创建。并且没有任何配置文件，都要手动创建。有模板文件，在解压目录的`example/`目录中，叫`option-http_proxy.cfg`，在安装目录中创建一个`conf`目录，再将该配置文件复制过去。

## HAProxy 操作

HAProxy 命令：

```
haproxy
        -v 显示版本
        -vv 显示详细的构建选项信息
        -d 进入debug模式
        -f 指定配置文件
        -dM[<byte>] poisons memory with <byte> (defaults to 0x50)
        -D 后台运行; -C changes to <dir> before loading files.
        -q 静默模式
        -c 检查配置文件语法
        -n 设置最大连接数，默认2000
        -m 限制可用的内存量，单位MB
        -N sets the default, per-proxy maximum # of connections (2000)
        -L 设置本地peer name，默认为主机名
        -p writes pids of all children to this file
        -de 禁止使用epoll()函数
        -dp 禁止使用poll()函数
        -dS disables splice usage (broken on old kernels)
        -dR disables SO_REUSEPORT usage
        -dV 禁止服务器端的SSL
        -sf/-st [pid ]* finishes/terminates old pids.
常用操作：选项不可连起来，只能分开
haproxy -c -f /etc/haproxy/haproxy.cfg  检查配置文件，一定要-c -f都指定
haproxy -D -f /etc/haproxy/haproxy.cfg  以daemon模式启动
haproxy -vv       显示编译与启动信息
killall haproxy   关闭HAProxy
```

### HAproxy 配置文件

HAProxy 主配置文件`/etc/haproxy/haproxy.cfg`

HAProxy 的配置有五个部分：`global`，`defaults`，`frontend`，`backend`，`listen`

- global：设置全局配置参数，属于进程级的配置，和操作系统配置有关
- defaults：默认参数的配置。默认会自动被引用到下面的 frontend、backend 和 listen 部分中。如果在 frontend、backend 和 listen 部分中也配置了与 defaults 部分一样的参数，那么 **defaults 部分参数对应的值自动被覆盖。**
- frontend：设置接收用户请求的**前端虚拟节点**
- backend：设置后端服务器集群的配置
- listen：是 frontend 部分和 backend 部分的结合体。是为了兼容 1.3 版本以前的配置而保留下来的。可以不用。

全局 global 配置：

```
global
进程管理与安全性参数
  log     127.0.0.1 local2 [level]           #日志使用local2输出到本地，后面还可以添加日志等级
  chroot      /var/lib/haproxy        #改变haproxy的工作目录
  pidfile     /var/run/haproxy.pid    #指定PID文件路径
  user        haproxy       #执行HAProxy进程的用户
  group       haproxy       #执行HAProxy进程的用户组
  daemon                    #后台执行
  stats socket /var/lib/haproxy/stats #用户访问统计数据的接口
  stats maxconn 10          #默认stats socket仅限10个并发连接
  nbproc      1             #启动的haproxy进程的个数，只能用于守护进程模式
性能调整参数
  maxconn     4000          #最大连接数
  spread-checks             #设置HealthCheck时间间隔
  noepoll                   #禁用使用epoll事件轮询系统
  nopoll                    #禁用poll事件轮询系统
  nosplice                  #禁用套接字之间使用内核tcp拼接
```

为了配置文件中的日志参数，创建独立的日志文件，需要修改`/etc/rsyslog.conf`，添加以下参数，然后重启`rsyslog`服务

```
local2.*                       /var/log/haproxy.log
```

**注：HAProxy 要求`ulimit -n`的值（即最大打开文件数）要大于`maxconn * 2 + 18`。**

默认 defaults 配置：

```
defaults
  mode http                 # 默认模式，tcp为4层，http为7层，health只返回ok
  option httplog            # 采用http日志格式
  option httpclose          # 防止多余的cookie信息影响到客户端请求的处理结果
  retries  3               # 尝试连接的次数，若连接失败则认为服务器不可用
  option http_proxy        # 开启代理（仅是基本的代理功能）
  option dontlognull       # 不记录空连接
  option http-server-close # 开启connection closing
  option forwardfor except 127.0.0.0/8     # 服务器能获取客户端的真实IP地址
  option redispatch        # 当客户端将请求发往了故障的服务器，则会自动将请求发往其他正常的机器
  # option abortonclose    # 当服务器负载很高的时候，自动结束掉当前队列处理比较久的链接
  # 时间单位可以是us（微秒）|ms（毫秒）|s（秒）|m（分）|h（时）|d（天）
  timeout http-request 10s   # http请求超时时间
  timeout queue        1m    # 队列超时时间
  timeout connect      10s   # 连接超时时间
  timeout client       1m    # 客户端响应超时时间
  timeout server       1m    # 服务器端响应超时时间
  timeout http-keep-alive 10s # keepalive持久连接超时时间
  timeout check        10s    # 检查时间间隔
```

前端服务 frontend 配置：

```
frontend  main *:5000        # 在1.8版本中不能这么写，而是用bind
    # 设置acl规则
    acl url_static       path_beg       -i /static /images /javascript /stylesheets
    acl url_static       path_end       -i .jpg .gif .png .css .js

    use_backend static          if url_static # 调用后端服务器并检查是否匹配acl规则
    default_backend             app  # 客户端访问时默认调用后端服务器地址池，与backend关联
    stats  uri  /stats    # 开启HAProxy的状态查看网页，通过/stats查看
```

后端服务 backend 配置：

```
backend static       # 定义后端服务器，static是配置存放静态资源的后端服务器
    balance     roundrobin   # 算法
    server      static 127.0.0.1:4331 check     # 对后端进行健康检查

backend app          # 运行应用的动态服务器
    balance     roundrobin
    server  app1 127.0.0.1:5001 check
    server  app2 127.0.0.1:5002 check
```

例：

```
backend static
    balance     roundrobin
    server      static 172.16.246.135:80 check
    server      static 172.16.246.136:80 check

backend app
    balance     roundrobin
    server  tomcat1  172.16.246.151:8080 check
    server  tomcat2  172.16.246.136:8080 check
```

访问 HAproxy 服务器的 5000 端口，就能访问后端服务器

### web 查看状态

可以配置专门的 frontend 设置 haproxy 自带的 stats，监控 haproxy 状态。

```
frontend   stats
    bind *:8080
    stats enable           # 开启stats
    stats refresh 3s       # 刷新间隔
    stats uri /stats       # 访问uri
    stats auth admin:redhat   # 认证用户密码
    stats admin if TRUE       # 开启认证
```

### ACL 配置

ACL 操作通常包括阻止请求，选择后端或添加报文头。

- 从数据流，表或环境中提取数据样本
- 可选地对提取的样本进行一些格式转换
- 在此样本上应用一个或多个模式匹配方法
- 仅在模式与样本匹配时执行操作

ACL 的数量没有强制限制。 未使用的不会影响性能，只消耗少量内存。

acl 格式：

```
acl   acl名   acl方法（也称测试标准）   [flags]  匹配路径或文件
```

常用 acl 方法：

- hdr_reg(host)：正则匹配

  ```
  # 匹配URL是www.exam.com和www1.exam.com的请求
  acl  www hdr_reg(host)  -i  ^(www.exam.com|www1.exam.com)
  ```

- hdr_dom(host)：

- hdr_beg(host)：测试请求报文的指定首部的开头部分是否符合指定的模式

  ```
  # 匹配提供静态请求的主机img\video\ftp
  acl  host_static  hdr_beg(host)  -i  img. video. ftp.
  ```

- url_sub：

- url_dir：

- path_beg：测试请求的 URL 是否以后面指定的模式开头

  ```
  acl url_static  path_beg  -i  /static  #匹配url以/static开头
  ```

- path_end：测试请求的 URL 是否以后面指定的模式结尾

  ```
  acl url_static  path_end  -i  .jpg .js #匹配url以.jpg或.js结尾
  ```

```
frontend  main
    bind          *:5000
    acl host_1           hdr_dom(name) -i host1.example.com
    acl host_2           hdr_dom(name) -i host2.example.com
    use_backend host1   if host_1
    use_backend host2   if host_2

backend host1
    balance     roundrobin
    server host1 192.168.60.130:80 check

backend host2
    balance     roundrobin
    server host2 192.168.60.131:80 check
```

然后通过`host1.example.com`可访问 host1 的后端主机池，`host2.example.com`访问 host2 的后端主机池。

# HAProxy+Keepalived 搭建

安装 keepalived，可以直接 yum 安装，也可以源码安装。源码安装版本 2.0.10。

```
./configure --prefix=/usr/local/keepalived \
            --bindir=/usr/bin \
            --sbindir=/usr/sbin \
            --sysconfdir=/etc
```

然后直接`make && make install`即可。

修改配置`/etc/keepalived/keepalived.conf`

```
# Master配置
global_defs {      # 可以不用改
   notification_email {
     acassen@firewall.loc
     failover@firewall.loc
     sysadmin@firewall.loc
   }
   notification_email_from Alexandre.Cassen@firewall.loc
   smtp_server 192.168.60.1
   smtp_connect_timeout 30
   router_id LVS_DEVEL
   vrrp_skip_check_adv_addr
   vrrp_strict
   vrrp_garp_interval 0
   vrrp_gna_interval 0
}

vrrp_instance VI_1 {
    state MASTER        # master这边要改
    interface ens32     # 改为面向集群的网卡（内网网卡）
    virtual_router_id 51
    priority 120        # master的优先级一定要比backup高
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass 1111
    }
    virtual_ipaddress {
        192.168.60.200    # VIP
    }
}

# backup配置
vrrp_instance VI_1 {
    state BACKUP           #backup这里要改
    interface ens32
    virtual_router_id 51
    priority 100
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass 1111
    }
    virtual_ipaddress {
        192.168.60.200
    }
}
```

修改完后直接`systemctl restart keepalived`，查看 Master 的网卡

```
2: ens32: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 00:0c:29:38:e9:f3 brd ff:ff:ff:ff:ff:ff
    inet 192.168.60.134/24 brd 192.168.60.255 scope global noprefixroute ens32
       valid_lft forever preferred_lft forever
    inet 192.168.60.200/32 scope global ens32    #VIP在Master这，Backup上是没有该VIP的
       valid_lft forever preferred_lft forever
....
```

关闭 Master，再查看 Backup，发现 VIP 已转移到此主机上，且已变为 Master。

# 参考文章

- [HAProxy 用法详解 全网最详细中文文档](http://www.ttlsa.com/linux/haproxy-study-tutorial/)
- [HAproxy 负载均衡-特性篇](http://blog.51cto.com/yijiu/1428649)
- [转 笔记 1. HAProxy 介绍](https://www.jianshu.com/p/9290f1ccbc62)
- [http 反向代理之 haproxy 详解](http://blog.51cto.com/freeloda/1294094)
- [Haproxy 的负载均衡、动静分离、状态监控、近期网络架构](http://blog.51cto.com/dengaosky/2050231?utm_source=oschina-app)
- [CentOS7 haproxy+keepalived 实现高可用集群搭建](https://blog.csdn.net/sj349781478/article/details/78862315)
- [Haproxy 原理(1)](https://www.cnblogs.com/skyflask/p/6970151.html)
- [HAProxy 从零开始到掌握](https://www.jianshu.com/p/c9f6d55288c0)
- [HAProxy 骏马金龙](https://www.cnblogs.com/f-ck-need-u/p/7576137.html)
- Linux 集群与自动化运维

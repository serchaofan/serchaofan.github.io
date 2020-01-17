---
title: Squid笔记
date: 2018-05-31 12:00:16
tags: [squid, 缓存, server, 代理]
---

- [Squid 介绍](#Squid介绍)
- [代理服务器概念](#代理服务器概念)
- [Squid 安装](#Squid安装)
- [Squid 常规配置](#Squid常规配置)
- [Squid 访问控制](#Squid访问控制)
- [Squid 多级代理配置](#Squid多级代理配置)
- [Squid 实验](#Squid实验)
- [cachemgr.cgi 管理 Squid](#cachemgr.cgi管理Squid)
- [Squid 日志](#Squid日志)
- [Squid 调优](#Squid调优)

<!--more-->

# Squid 介绍

Squid 是一个支持 HTTP、HTTPS、FTP 等服务的 Web 缓存软件，可通过缓存页面实现降低带宽占用并优化页面相应时间。

**Squid 特点与功能：**

- 不仅能缓存 Web 页面资源，还能对 DNS 查询结果进行缓存
- 强大的访问控制功能
- 保护内网，并加速内网对外网的连接
- 记录内网用户访问外网行为
- 提供用户认证
- 减少出口流量
- 工作在 TCP/IP 的应用层，TCP 端口 3128

Squid 支持的网络协议：HTTP、FTP、Gopher（信息查找协议）、WAIS（广域信息查询系统）、SSL

Squid 支持的内部缓存和管理协议：HTTP、ICP（互联网缓存协议，用于从缓存中查找指定对象）、Cache Digests（用于生成缓存中对象的索引）、SNMP（用于为外部工具提供缓存信息）、HTCP（用于发现 HTTP 缓存区，存储管理 HTTP 数据）

Squid 请求过程：

- 客户端访问 Squid 服务器，由代理服务器代表客户端向 web 服务器（后端 Real Server）请求资源
- Web 服务器将相应数据返回给代理服务器
- 代理服务器将数据返回给客户端，并保留一份在本地
- 其他客户端向该代理服务器请求相同的资源
- 代理服务器直接将本地的该资源缓存返回给客户端

{% asset_img 1.png %}

squid 的硬件环境：内存与磁盘是缓存性能的重要体现。所有对象都会尽可能缓存到内存中，更大的磁盘空间实现更多的缓存目标和更高的命中率，最好使用 SAS，尽量不用 SATA。磁盘与内存间也有关联，最好每 G 的磁盘空间有 32M 的内存对应。

# 代理服务器概念

代理服务器一般构建于内网和 Internet 间，负责转发内网对 Internet 的访问，并进行访问控制与记录，可实现安全保护、缓存数据、内容过滤、访问控制等功能。

Web 代理维护着庞大的缓存数据，因此对内存和硬盘的要求很高，更大的内存和硬盘意味着更多的缓存和更高的缓存命中率。

**Web 缓存类型：**

- 客户端缓存：一般就存放在浏览器中。有两个缺点：1.缓存容量小，不能存储大的 Web 对象，因此命中率较低。2.缓存在本地，不能共享，因此存在大量重复数据。
- 代理服务器缓存：位于网络中间位置。容量大，缓存能与内网所有客户端共享。但若性能达不到要求，反而会造成网络瓶颈。代理缓存应具有健壮性、可扩展性、稳定性、负载均衡的特点
- 服务器缓存：是为了减轻 web 服务器的负载，并不是为了提高资源命中率。服务器缓存减少了 web 服务器的流量、并保护了 web 服务器的安全，因为 web 服务器仅向服务器缓存提供数据，并不直接面向客户机。并且提高了网站的可靠性，因为各个服务器缓存间可实现共享。

**三种典型代理方式：**

- 传统代理：在浏览器中设置，指出代理服务器的 IP 地址和网络端口。便于用户对访问管理控制，配置简单。

- 透明代理（正向代理）：为内网提供外网的访问，即普通的代理服务器。但增加了网络设备的负担，并需要做好更详细的配置，会有一定的延时。若程序的一系列请求是相关的并涉及多个目标对象，有可能会出问题。
- 反向代理：能代理外部网络访问内网服务器。主要为本地网站做缓存，加快 web 服务器的响应速度。相当于服务器缓存。反向代理结合智能 DNS 即可实现基本的 CDN

# Squid 安装

Squid 版本：3.5

可直接通过`yum install squid`安装。然后`systemctl start squid`启动。

安装时会自动创建用户 squid，并且是系统用户，家目录为/var/spool/squid，且禁止登录。

**注：一定要做到 squid 服务器的时间同步，否则无法进行缓存**

Squid 的相关配置文件：

- `/etc/httpd/conf.d/squid.conf`：用于在 Apache 中添加运行`cachemgr.cgi`的配置
- `/etc/logrotate.d/squid`：Squid 的日志轮替配置
- `/etc/squid/squid.conf`：Squid 主配置文件
- `/etc/squid/cachemgr.conf`：设置可通过`cachemgr.cgi`管理的主机
- `/etc/squid/mime.conf`：定义 MIME 类型的文件

Squid 其他相关文件：

- `/var/log/squid/`：存放 squid 日志的目录
- `/var/spool/squid/`：存放 squid 缓存的目录
- `/usr/share/squid/errors/`：存放给客户端的报错信息 HTML，目录中包含各个语言的子目录
- `/usr/lib64/squid/cachemgr.cgi`：squid cache manager，用于管理主机的动态网页

squid 提供两个命令：

- `squid`：用于管理 squid 守护进程
- `squidclinet`：用于管理 squid 客户端

```
squid [options]
    -a port   指定HTTP端口，默认3128
    -d level  将指定调试等级的信息发送到标准错误输出
    -f file   指定配置文件启动
    -k        向squid服务器发送指令
        reconfigure 重载配置文件
        rotate      轮替日志文件
        shutdown    安全关闭
        restart     重启服务
        interrupt   中断服务
        kill        杀死服务
        debug       开启debug
        check       检查运行状态
        parse       检查配置文件
    -s       启用syslog
    -u port  指定ICP端口，默认3130，若要关闭，就指定0
    -z        创建缓存目录，即初始化缓存
    -C        不捕获fatal信号
    -D        不进行DNS参数测试
    -F        不响应任何请求直到存储重建
    -N        不使用daemon模式
    -S        在重建期间仔细检查swap分区
    -X        强制进入完全调试模式
```

```
squidclient [Basic Options] [HTTP Options]
    -s | --quiet    静默模式，不打印输出
    -v | --verbose  显示详细信息，最多-vv
      -v：显示向外发的请求信息
      -vv：显示动作跟踪信息
    -h | --host host     指定将信息发给的主机，默认为localhost
    -l | --local host    指定绑定的本地IP地址，默认为空
    -p | --port port     指定服务端口，默认3128
    -T timeout           指定读写操作的超时时间
    --ping [options]     允许ping模式
    -g count        指定ping包的个数，默认一直ping
    -I interval     指定ping包发送间隔，默认1s

HTTP Options:
    -a           不包含“accept:header”
    -j hosthdr   Host header content
    -k           保持长连接，默认只接收一个请求就关闭连接
    -m method    指定请求方法，默认GET
    -n           代理协商认证（kerberos）
    -N           www协商认证（kerberos）
    -P file      将指定文件作为请求载荷
    -r           强制缓存重新加载URL
    -t count     跟踪计数缓存跳数
    -u user      代理认证用户名
    -U user      www认证用户名
    -w password  代理认证密码
    -W password  www认证密码
```

# Squid 常规配置

```
http_port    3128  [模式] [options]             #Squid监听的端口
# 若要添加多个端口，用空格隔开
    常用模式：
      accel：加速或反向代理模式
      intercept：支持IP层NAT拦截传输到该Squid端口的流量
      从squid3开始就没有transparent透明模式了

icp_port     3130              #ICP端口
# ICP是专门运行在代理服务器间交换缓存数据的协议。ICP使用UDP端口3130

cache_effective_user  squid    #运行squid进程的用户
#squid进程是root启动的，但启动后会由指定的普通用户继续运行
cache_effective_group  squid    #运行squid进程的用户组

pid_filename /var/run/squid.pid #squid的PID文件位置
# 此文件由root在启动squid时创建

logformat squid %ts.%03tu %6tr %>a %Ss/%03>Hs %<st %rm %ru %un %Sh/%<A %mt  #指定日志记录格式
access_log /var/log/squid/access.log squid  #日志路径，类型为squid

cache_mem   8 MB       #cache内存
#设定squid能用多少额外的内存来缓存对象的限制值

cache_dir  ufs /var/spool/squid 100 16 256  #指定缓存类型为ufs，保存在/var/spool/squid，是默认值
#大小限制为100MB，第1层子目录为16个，第2层子目录为256个

cache_store_log /var/log/squid/store.log   #数据缓存的日志，是默认值

maximum_object_size_in_memory 8 KB   #squid保存在内存中的对象最大为8KB
#内存中的对象访问速度最快，但内存有限，需要根据内存大小设置

maximum_object_size      4096 KB  #最大的缓存对象的字节数4096KB
#只有小于该值的对象才会被缓存，若硬盘足够大，可适度提高

cache_swap_low  90     #设置Squid缓存空间的使用策略。
cache_swap_high 95     #当缓存中数据占到整个缓存大小的95%时
                       #就会按算法删除缓存中的数据
                       #直到缓存数据占到整个缓存大小的90%
                       #可以最大限度利用缓存空间，但也不会出现空间溢出

coredump_dir /var/spool/squid  #放置squid进程运行时coredump文件的目录
cache_mgr   root       #Squid管理员用户的Email
visible_hostname  proxy.example.com   #设置对外可见的主机名，会在错误信息中显示
```

> [logformat 日志格式设置](http://www.squid-cache.org/Doc/config/logformat/)

Squid 会设置在缓存目录下建立多个目录，每个目录又建立多个子目录，在最里层的目录存放缓存文件，缓存文件是通过对客户端请求的 URL 进行哈希运算生成的。Squid 会在内存建立一张哈希表，记录硬盘中缓存文件配置的情形。

使用`squid -k parse`检查配置文件语法，确认没有报错后`squid -z`初始化缓存目录，会显示`Making directories in /var/spool/squid/00`等信息，发现，第一层的目录数量是 16，第二层目录的数量是 256，目录名都是由十六进制标号，与配置文件`cache_dir`配置的一致。若无法创建，可能是该目录的权限问题。

再使用`squid -N -d1`测试，没有报错，则说明启动完成。

通过浏览器测试，设置代理服务器

{% asset_img 4.png %}

# Squid 访问控制

```
acl name type value1 value2...    #设置ACL名字和对象的值
http_access <allow|deny> [!]ACL对象1 ...  #将客户端请求与http_access的对象匹配，指定allow或deny。!为取反。
#若一个请求与所有http_access都不匹配，则执行与最后一条http_access指定的动作相反的动作
```

常见的 ACL 类型：

| 类型          | 含义                                                    |
| ------------- | ------------------------------------------------------- |
| src           | 源 IP 地址，可以单个 IP 地址，可以是地址范围            |
| dst           | 目的 IP 地址，同上                                      |
| myip          | 本地网络接口 IP 地址                                    |
| srcdomain     | 客户所属的域，Squid 会根据客户 IP 地址进行反向 DNS 查询 |
| dstdomain     | 服务器所属的域，与客户请求的 URL 匹配                   |
| time          | 时间段                                                  |
| port          | 指向其他计算机的网络端口，即是目标服务器上的端口        |
| myport        | 指向 squid 服务器的端口，是 squid 服务器上的端口        |
| proto         | 客户端请求所使用的协议，如 http、https、ftp、gopher     |
| method        | HTTP 请求方法                                           |
| proxy_auth    | squid 认证的用户名                                      |
| url_regex     | 关于 URL 的正则表达式（域名）                           |
| urlpath_regex | 关于 URL 资源的正则表达式（资源路径，不带有域名）       |
| ident         | 指定用户                                                |

acl 对象的值间的关系为”或“，只要满足一个就匹配了该 acl 规则。而 http_access 与其他规则的设置使用”与“逻辑。squid 默认配置拒绝每个请求，因此在使用代理前，必须先添加访问控制规则。

若 value 为文件名，对象的值实际上是文件的内容。

常见案例：

```
Squid3已默认定义acl名：all、localhost、manager、to_localhost
    acl all src 0.0.0.0/0
    acl localhost src 127.0.0.1/32
    acl manager proto cache_object   #cache_object是squid自定义的协议，用于访问squid的缓存管理接口
    acl to_localhost dst 127.0.0.1/8
因此以上四个acl名字不能再使用，且可以直接调用，无需再定义

acl worktime time MTWHF 08:00-17:00
#时间从周一到周五，早上8点到下午5点
  S-Sun M-Mon T-Tue W-Wed H-Thu F-Fri A-Sat

acl mynet src 10.1.1.1/24
#源10.1.1.1/24的子网命名为mynet

acl aim dstdomain .baidu.com .google.com
#匹配指定目的域名

acl giffile url_regex -i \.gif$
#匹配以.gif结尾的URL

acl other srcdomain "/etc/squid/other"
#匹配文件中指定的源域名

acl safe_port port 80
#匹配指定的目标服务器端口

acl Users ident tom
http_access allow tom
#只允许tom访问

acl mynet src 10.1.1.1-10.1.1.10
http_access allow mynet
http_access deny all
#仅允许mynet子网访问

acl user1 src 10.1.1.1
acl user2 src 10.1.1.2
acl user1_time time MTWHT 08:00-12:00
acl user2_time time MTWHT 08:00-13:00
http_access allow user1 user1_time
http_access allow user2 user2_time
#给两个用户分别指定上外网的时间

acl ftpmp3 url_regex -i "^ftp://.*\.mp3$"
http_access deny ftpmp3
#禁止从任何ftp上下载mp3文件

acl cgi urlpath_regex -i "^/cgi-bin"
http_access deny cgi
#禁止访问cgi网页

acl limit maxconn 16
http_access deny limit
#限制同一IP客户端的最大连接数
```

squid 默认 acl 配置：

```
#所有内网
acl localnet src 10.0.0.0/8
acl localnet src 172.16.0.0/12
acl localnet src 192.168.0.0/16
acl localnet src fc00::/7
acl localnet src fe80::/10

acl SSL_ports port 443      #SSL443端口
acl Safe_ports port 80		# 放行http
acl Safe_ports port 21		# 放行ftp
acl Safe_ports port 443		# 放行https
.....                       #放行的其他服务

acl CONNECT method CONNECT  #connect方法，是HTTP中用于代理的方法

http_access deny !Safe_ports        ##只允许本机转发客户机对非Safe_ports的请求
http_access deny CONNECT !SSL_ports #拒绝所有非SSL_ports的CONNECT请求，只允许本机用connect连接非SSL_ports
http_access allow localhost manager #允许localhost使用cache_object协议
http_access deny manager      #拒绝所有其他网络使用cache_object
http_access allow localnet    #允许内网访问
http_access allow localhost   #允许本地访问
http_access deny all         #剩下的都不允许
http_port 3128
coredump_dir /var/spool/squid
refresh_pattern ^ftp:		1440	20%	10080
refresh_pattern ^gopher:	1440	0%	1440
refresh_pattern -i (/cgi-bin/|\?) 0	0%	0
refresh_pattern .		0	20%	4320
```

# Squid 多级代理配置

在大型网络中一台 Squid 服务器的性能不能应对巨大的访问量，需要构建多级代理服务器，类似与计算机集群，使用 ICP 交换缓存，形成一个逻辑上的大型 Squid 服务器。

代理服务器间的结构可分为：同级结构、层次结构、网状结构。最常见是层次结构。

需要配置参数`cache_peer hostname type http_port icp_port options`

- `hostname`为另一台 Squid 服务器的域名或 IP 地址
- `type`为 ICP 请求的类型：`parent`或`sibling`
- `http_port`为对端的 Squid 监听请求端口
- `icp_port`为对端 ICP 的端口

ICP 的两种请求类型 type：

- `parent`：会把客户端的请求发送给对方，对方的缓存中若有请求的数据，则返回，若没有，则对方向 web 服务器读取数据，再返回。（类似 DNS 的递归查询）一般对象处于上一级时使用此类型，因为上一级会更加接近于 web 服务器。
- `sibling`：不会把客户端请求发给对方，仅仅询问有没有缓存。如果没有，则对方仅仅告诉回复没有，并不会向 web 服务器请求数据。一般对象处于同等级别时用此类型。de

常见的 options 参数：

| 选项                | 含义                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| proxy-only          | 从对方得到的数据不做缓存，默认会做                                                 |
| weight=n            | 指定对方的权重，有多个 cache_peer 时会按权重选择，默认根据网络响应时间自动选择     |
| no-query            | 不向对方发送 ICP 请求，只发送 HTTP 代理请求，一般用于对方不支持 ICP 或不可用的情况 |
| default             | 与 no-query 一起用，当对方都不支持 ICP 时，就用该 peer                             |
| no-digest           | 不使用内存摘要表查询，直接 ICP 通信                                                |
| login=user:password | 若对方需要认证，就提供用户名和密码                                                 |

示例：

```
cache_peer system3.example.com parent 3128 3130 proxy-only default
cache_peer system4.example.com sibling 3128 3130 proxy-only
```

若要通过规则选择不同的上级代理服务器，达到负载均衡，还需要配置：

`cache_peer_domain cache-host domain ...`

`cache_peer_access cache-host allow|deny [!]ACL对象...`

示例：

```
cache_peer system1.example.com parent 3128 3130
cache_peer system2.example.com sibling 3128 3130 proxy-only
cache_peer_domain system1.example.com example
cache_peer_domain system2.example.com !example
#system1为example域的代理服务器，system2为非example域的代理服务器
```

# Squid 实验

## 透明二级代理

环境：

- client1：192.168.1.128
- server1：192.168.1.129
- server2：192.168.1.130,192.168.205.140
- web1：192.168.205.139

{% asset_img 2.png %}

server1 上的配置`squid.conf`添加或修改以下内容：

```
http_port    3128   accel     #配置为透明代理
icp_port     3130
cache_effective_user  squid
pid_filename /var/run/squid.pid
logformat squid %ts.%03tu %6tr %>a %Ss/%03>Hs %<st %rm %ru %un %Sh/%<A %mt
access_log   /var/log/squid/access.log squid
cache_dir  ufs /var/spool/squid 100 16 256
cache_store_log /var/log/squid/store.log
hosts_file   /etc/hosts           #用于解析IP地址
visible_hostname  system1.example.com  #错误信息中显示的主机名
cache_effective_user  squid    #若不设置user和group，会默认使用nobody
cache_effective_group  squid

acl PURGE   method PURGE          #purge是squid自定义的方法，用于删除squid缓存中的对象（能让管理员强制删除）
                                  #squid是默认拒绝Purge请求的

http_access allow localhost manager  #只允许本机使用cache_object协议
http_access allow localhost PURGE    #只允许本机使用purge方法
http_access deny manager PURGE

icp_access allow all         #允许所有客户机访问ICP端口
http_reply_access allow all  #允许对所有客户机进行请求的回复
```

并且需要进行端口转发，即重定向，因为代理服务器需要将客户端发往 80 端口的数据包改为发往自己的 3128 端口，实现代理。因此需要开启防火墙 firewalld 或 iptables 服务。

若是使用 firewalld，则先要确定是否开启了伪装 IP 功能（Masquerade）

`firewall-cmd --query-masquerade`，若为 no，则需要开启`firewall-cmd --add-masquerade --permanent`。

设置端口转发：`firewall-cmd --add-forward-port=port=80:proto=tcp:toport=3128 --permanent`

若为 iptables，则添加两条规则：

```
iptables -t nat -A PREROUTING -i ens33 -p tcp --dport 80 -j --REDIRECT --to-ports=3128
iptables -t nat -A POSTROUTING -o ens36 -s 192.168.205.0/24 MASQUERADE
# ens33为内网卡，ens36为外网卡
```

然后打开转发，无论是 firewalld 还是 iptables，都要打开。

```
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p
```

最后放行 80 和 443 端口，放行 http 和 https 服务

```
firewall-cmd --permanent --add-port=80/tcp --add-port=443/tcp
firewall-cmd --permanent --add-service=http --add-service=https
```

## 反向二级代理

# cachemgr.cgi 管理 Squid

通过 web 界面管理 Squid，需要`cachemgr.cgi`动态网页文件，存放在`/usr/lib64/squid/`中。可以将该 cgi 文件复制到`/var/www/cgi-bin`中，也可不动，但要注意文件的权限问题，一定要改为`apache`。然后在 httpd 的主配置文件中添加，Location 配置

```
ScriptAlias "/squidcgi" "/var/www/cgi-bin/cachemgr.cgi"
<Location "/squidcgi">
    Order deny,allow     #逗号后不能有空格
    Allow from all
</Location>
```

然后浏览器通过`主机IP/squidcgi`访问。

{% asset_img 4.png %}

默认不需要填用户名密码即可登录。若要设置登录用户名密码，只需要在主配置文件中添加`cachemgr_password`参数。

```
cachemgr 密码  行为action
要禁用一个操作，就把密码设为disable，后面跟上要禁止的操作
要允许不输入密码的操作，就把密码设为none，后面跟上允许的操作
action为all表示为所有操作设置相同密码
```

# Squid 日志

Squid 日志不仅记录服务器进程的运行，还记录用户的访问情况、缓存存储状况、缓存访问状况等。

Squid 三个日志：access.log，cache.log，store.log

和日志文件相关的配置：

- `cache_log /var/log/squid/cache.log`：指定缓存信息日志的路径。包含了缓存的起始配置信息，分类的错误信息，性能警告。
- `cache_store_log /var/log/squid/store.log`：指定对象存储记录日志的路径。包含被写入缓存空间的对象、被从缓存空间清除的对象等。可设为`none`禁止
- `cache_swap_log /var/spool/squid/cache_swap.log`：指定每个交换日志的路径。包含存储在交换空间的对象元数据。这类日志最好不要删除，否则可能会导致 Squid 故障。
- `debug_options ALL,1`：控制日志记录内容的多少，第一个参数决定对哪些行为做记录，ALL 表示对所有行为做记录，第二个参数表示详细程度，1 表示详细程度最低。
- `log_fqdn`：控制 access.log 日志中客户机地址的记录方式。on 表示会记录客户机的域名，off 则记录 IP 地址。开启会增加系统负担

* `logformat squid %ts.%03tu %6tr %>a %Ss/%03Hs %<st %rm %ru %un %Sh/%<A %mt`是在配置文件中日志格式的参数配置。
  - `%ts.03tu`：记录请求完成时间。`%ts`为相对于 Unix 纪元（1970-1-1）的秒数，`%03tu`表示 3 个宽度的毫秒数，`.`为写入日志的固定符号。
  - `%6tr`：响应时间，表明了 Squid 处理请求的时间（接收到 HTTP 请求到响应报文发出），单位毫秒。ICP 响应时间一般为 0，非常快速。
  - `%>a`：记录客户端地址，若开启了`log_fqdn`，则会记录客户端主机名。还可通过`client_netmask`隐藏客户端 IP 的一部分
  - `%Ss/%03Hs`：记录请求结果和状态码，`%Ss`是 Squid 特有的请求结果码，`%03Hs`是 HTTP 状态码
  - `%<st`：记录传输的字节数。是整个数据包的大小，会比实际载荷信息大。
  - `%rm`：记录请求的方法。HTTP 的常见请求和 ICP 的 ICP_QUERY 请求
  - `%ru`：记录客户端请求的 URI。默认不会记录 URL 中第一个`?`后所有信息
  - `%un`：记录客户端用户身份。Squid 使用 RFC1413 或 HTTP 的验证头部确认用户身份
  - `%Sh/%<A`：记录 peer 主机（其他代理服务器）信息
  - `%mt`：记录 MIME 类型。从响应的`Content-type`域获取信息，若没有就使用一个`-`代替。
* `logfile_rotate`：轮询保存的文件数，超过限制就会从头开始覆盖

## 日志轮询

Squid 并没有自动轮询的机制，只能使用`squid -k rotate`命令，并编写脚本通过 cron 周期执行。

```
#!/bin/bash
cd /var/log/squid/
[ -f access.log ] && mv access.log access_$(date +%F).log
squid -k rotate
```

## Sarg 工具分析日志

Sarg 是一个 Squid 的日志分析工具，输出为 html 文件。[Sarg 下载-tar.gz 包](https://nchc.dl.sourceforge.net/project/sarg/sarg/sarg-2.3.11/sarg-2.3.11.tar.gz)

依赖 gd 库，pcre 库。在 sarg 安装完成后，进入安装目录的`bin`目录，执行`sarg`命令，sarg 会自动寻找 Squid 的日志文件，并分析。`SARG: Records in file: 595935, reading: 100.00%`，然后会生成一个目录，是自动存放在`/var/www/html/squid-reports`下，目录名为`起始日期-结束日期`，该目录下有`index.html`

通过浏览器访问该 index 文件，数据量相当庞大，并提供图表和日期时间的数据记录

{% asset_img 5.png %}

sarg 命令：

```
sarg [options]
     --convert      将access.log文件转换为易读的日期格式
     -d DATE        指定报告的日志范围dd/mm/yyyy-dd/mm/yyyy
     -e MAIL        将报告发送给指定email
     -f FILE        指定配置文件，默认为安装目录的etc/sarg.conf
     --keeplogs     保留以前生成的每个报告
     -l FILE        指定日志文件
     -n             使用rDNS将IP地址解析成域名
     -o DIR         报告存放目录
     -p             使用IP地址而不是userid
     --split        按-d指定的日期切割日志文件
     -t TIME        指定时间范围[HH:MM 或 HH:MM-HH:MM]
     -u USER        只报告指定用户的行为
     -x             开始分析，且会先输出完整的配置信息
     -z             显示完整的输出信息
```

Sarg 配置，存放在安装目录的`etc/sarg.conf`

```
access_log /usr/local/squid/var/logs/access.log  #squid日志路径
output_dir /var/www/html/squid-reports    #报告输出目录
date_format u      #日期格式，u为美国格式mm/dd/yy，e为欧洲格式dd/mm/yy
overwrite_report no   #是否对已存在的日期的报告覆盖
```

# Squid 调优

## 调整文件描述符

Squid 在高负载下，需要大量内核资源，又因为 Squid 是做缓存服务器，所以极度消耗文件描述符，而 unix 对文件描述符是有限制的（1024），这样会造成极大的性能影响，当 squid 用完所有文件描述符后，就不能接收新的请求了，并且 squid 发现文件描述符短缺后，就会发布警告。

因此，需要先查看文件描述符是否满足使用，大多数情况 1024 已经足够使用，当出现高负载情况时，则需要更多，因此最好将系统限制的文件描述符数量设为每个进程限制的两倍。

```
ulimit -a  查看当前的资源限制信息
找到open files，就是同时能打开的文件数量，即文件描述符，默认为1024
优化性能，将此值设为2048
ulimit -Hn 2048
# -H 设定资源的硬性限制，也就是管理员所设下的限制
# -n 设置同时最多能打开的文件数
```

注：**ulimit 仅仅作为临时设置，可以作用于通过使用其命令登录的 shell 会话，在会话终止时便结束限制，并不影响于其他 shell 会话。**

**若要永久设置，可写入`/etc/profile`：`echo "ulimit -Hn 2048">>/etc/profile` **

**或写入`/etc/security/limits.conf`：`echo "* - nofile 2048">>/etc/security/limits.conf`**

## 调整临时端口范围

临时端口是 TCP/IP 栈分配出连接的本地端口，当 squid 发起一条连接到另一台服务器，内核给本地 socket 分配一个端口号。CentOS 默认的临时端口范围是 32768 到 60999

当 squid 高负载时，若临时端口号短缺，会造成很大的性能影响，因为一些 TCP 连接在关闭时会进入`TIME_WAIT`状态，此状态下临时端口不能重用。

可通过`sysctl -a | grep net.ipv4.ip_local_port_range`查看

设置范围 4000 到 65000，`sysctl -w net.ipv4.ip_local_port_range="4000 65000"`

# 参考文章

- Linux 服务器架设指南（第二版）
- Linux 系统管理与网络管理（第二版）
- Linux 运维之道（第二版）
- 高性能网站构建实战

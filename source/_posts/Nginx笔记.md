---
title: Nginx笔记
date: 2018-05-02 17:20:03
tags: [server, Nginx, LNMP, 集群, 缓存, 代理, 负载均衡]
categories: [应用运维]
---

基于 Nginx1.14-1.16

<!-- more -->

- [Nginx 介绍](#nginx-%e4%bb%8b%e7%bb%8d)
- [Nginx 安装](#nginx-%e5%ae%89%e8%a3%85)
- [Nginx 配置文件解析](#nginx-%e9%85%8d%e7%bd%ae%e6%96%87%e4%bb%b6%e8%a7%a3%e6%9e%90)
  - [全局配置](#%e5%85%a8%e5%b1%80%e9%85%8d%e7%bd%ae)
    - [main 块](#main-%e5%9d%97)
  - [模块配置](#%e6%a8%a1%e5%9d%97%e9%85%8d%e7%bd%ae)
    - [events 块](#events-%e5%9d%97)
    - [http 块](#http-%e5%9d%97)
    - [server 块](#server-%e5%9d%97)
    - [location 块](#location-%e5%9d%97)
- [访问控制、身份认证与 SSL](#%e8%ae%bf%e9%97%ae%e6%8e%a7%e5%88%b6%e8%ba%ab%e4%bb%bd%e8%ae%a4%e8%af%81%e4%b8%8e-ssl)
- [Nginx 日志](#nginx-%e6%97%a5%e5%bf%97)
  - [日志切割](#%e6%97%a5%e5%bf%97%e5%88%87%e5%89%b2)
- [Nginx 的其他常见 HTTP 功能](#nginx-%e7%9a%84%e5%85%b6%e4%bb%96%e5%b8%b8%e8%a7%81-http-%e5%8a%9f%e8%83%bd)
  - [文件查找规则](#%e6%96%87%e4%bb%b6%e6%9f%a5%e6%89%be%e8%a7%84%e5%88%99)
  - [域名解析](#%e5%9f%9f%e5%90%8d%e8%a7%a3%e6%9e%90)
  - [客户端交互](#%e5%ae%a2%e6%88%b7%e7%ab%af%e4%ba%a4%e4%ba%92)
- [Nginx 缓存](#nginx-%e7%bc%93%e5%ad%98)
  - [清除缓存](#%e6%b8%85%e9%99%a4%e7%bc%93%e5%ad%98)
- [Nginx 负载均衡](#nginx-%e8%b4%9f%e8%bd%bd%e5%9d%87%e8%a1%a1)
  - [轮询](#%e8%bd%ae%e8%af%a2)
  - [权重](#%e6%9d%83%e9%87%8d)
  - [ip_hash](#iphash)
- [Nginx 反向代理](#nginx-%e5%8f%8d%e5%90%91%e4%bb%a3%e7%90%86)
  - [非 HTTP 型上游服务器](#%e9%9d%9e-http-%e5%9e%8b%e4%b8%8a%e6%b8%b8%e6%9c%8d%e5%8a%a1%e5%99%a8)
    - [Memcached 服务器](#memcached-%e6%9c%8d%e5%8a%a1%e5%99%a8)
    - [FastCGI 服务器](#fastcgi-%e6%9c%8d%e5%8a%a1%e5%99%a8)
- [Nginx 邮件服务](#nginx-%e9%82%ae%e4%bb%b6%e6%9c%8d%e5%8a%a1)
- [重写与重定向](#%e9%87%8d%e5%86%99%e4%b8%8e%e9%87%8d%e5%ae%9a%e5%90%91)
  - [重写](#%e9%87%8d%e5%86%99)
- [Nginx 优化](#nginx-%e4%bc%98%e5%8c%96)
  - [安全优化](#%e5%ae%89%e5%85%a8%e4%bc%98%e5%8c%96)
    - [隐藏 Nginx 版本号](#%e9%9a%90%e8%97%8f-nginx-%e7%89%88%e6%9c%ac%e5%8f%b7)
    - [文件解析漏洞](#%e6%96%87%e4%bb%b6%e8%a7%a3%e6%9e%90%e6%bc%8f%e6%b4%9e)
    - [CRLF注入漏洞](#crlf%e6%b3%a8%e5%85%a5%e6%bc%8f%e6%b4%9e)
    - [目录遍历漏洞](#%e7%9b%ae%e5%bd%95%e9%81%8d%e5%8e%86%e6%bc%8f%e6%b4%9e)
    - [服务器请求伪造漏洞](#%e6%9c%8d%e5%8a%a1%e5%99%a8%e8%af%b7%e6%b1%82%e4%bc%aa%e9%80%a0%e6%bc%8f%e6%b4%9e)
    - [整数溢出漏洞](#%e6%95%b4%e6%95%b0%e6%ba%a2%e5%87%ba%e6%bc%8f%e6%b4%9e)
  - [性能优化](#%e6%80%a7%e8%83%bd%e4%bc%98%e5%8c%96)
    - [nginx 单个进程允许的客户端最大连接数](#nginx-%e5%8d%95%e4%b8%aa%e8%bf%9b%e7%a8%8b%e5%85%81%e8%ae%b8%e7%9a%84%e5%ae%a2%e6%88%b7%e7%ab%af%e6%9c%80%e5%a4%a7%e8%bf%9e%e6%8e%a5%e6%95%b0)
    - [worker 进程最大打开文件数](#worker-%e8%bf%9b%e7%a8%8b%e6%9c%80%e5%a4%a7%e6%89%93%e5%bc%80%e6%96%87%e4%bb%b6%e6%95%b0)
    - [优化服务器域名的散列表](#%e4%bc%98%e5%8c%96%e6%9c%8d%e5%8a%a1%e5%99%a8%e5%9f%9f%e5%90%8d%e7%9a%84%e6%95%a3%e5%88%97%e8%a1%a8)
    - [nginx 连接参数优化](#nginx-%e8%bf%9e%e6%8e%a5%e5%8f%82%e6%95%b0%e4%bc%98%e5%8c%96)
    - [上传文件大小限制](#%e4%b8%8a%e4%bc%a0%e6%96%87%e4%bb%b6%e5%a4%a7%e5%b0%8f%e9%99%90%e5%88%b6)
    - [FastCGI 优化](#fastcgi-%e4%bc%98%e5%8c%96)
    - [gzip 压缩](#gzip-%e5%8e%8b%e7%bc%a9)
    - [expires 缓存](#expires-%e7%bc%93%e5%ad%98)
  - [放盗链](#%e6%94%be%e7%9b%97%e9%93%be)
  - [防爬虫](#%e9%98%b2%e7%88%ac%e8%99%ab)
  - [CDN 加速](#cdn-%e5%8a%a0%e9%80%9f)
  - [Nginx 降权](#nginx-%e9%99%8d%e6%9d%83)
- [Nginx 与 PHP](#nginx-%e4%b8%8e-php)
- [Nginx 常见模块](#nginx-%e5%b8%b8%e8%a7%81%e6%a8%a1%e5%9d%97)
  - [gzip 压缩](#gzip-%e5%8e%8b%e7%bc%a9-1)
- [LNMP 分布式集群方案](#lnmp-%e5%88%86%e5%b8%83%e5%bc%8f%e9%9b%86%e7%be%a4%e6%96%b9%e6%a1%88)
  - [搭建 Nginx+PHP 环境](#%e6%90%ad%e5%bb%ba-nginxphp-%e7%8e%af%e5%a2%83)
  - [Nginx+Apache 动静分离](#nginxapache-%e5%8a%a8%e9%9d%99%e5%88%86%e7%a6%bb)
- [参考文章](#%e5%8f%82%e8%80%83%e6%96%87%e7%ab%a0)

# Nginx 介绍

Nginx 有以下功能：

- 负载均衡
- HTTP web 服务器
- http 协议的反向代理服务器
- pop3\smtp\imap4 等邮件协议的反向代理
- 能缓存打开的文件（元数据） ，支持 FastCGI、uWSGI 协议，作为缓存服务器
- 模块化（非 DSO 机制），过滤器 zip，SSI，SSL

特性：

- 模块化设计，较好扩展性
- 高可靠性：master/worker 支持多进程，也支持多线程
- 支持热备份：不停机更新配置文件，更换日志，更新服务器程序版本
- 低内存消耗：10000 个 keep-alive 连接模式下非活动连接仅消耗 2.5M 内存
- 热部署（平滑升级）：旧的配置维持现状，新的配置立刻使用，并在使用中逐步自动将旧配置替换为新配置。

**Nginx 架构：**
nginx 会以 daemon 方式启动进程，后台进程包含一个 master 进程和多个 worker 进程。
master 进程用于启动管理多个 worker 进程，若取消 master 进程，则 nginx 会以单进程运行
一个请求只能在一个 worker 进程中处理，一个 worker 进程只能处理一个请求。worker 进程个数一般设置为 cpu 核数

- master：加载配置文件、管理 worker 进程、平滑升级
- worker：http 服务、http 代理、fastcgi 代理
- 事件驱动：epoll
- 消息通知：select、poll、rt signals
- 模块类型：核心模块、标准 http 模块、可选 http 模块、邮件模块、第三方模块

{% asset_img nginx_jiagou.png %}

**Master 进程完成的工作：**

- 读取并验证配置文件
- 创建、绑定及关闭套接字
- 启动、终止及维护 worker 进程
- 无需终止服务而重新配置
- 控制非中断式程序升级（平滑升级），启用新的二进制程序，并且能在需要时回滚到老版本
- 重新打开日志文件
- 可编译嵌入式 perl 脚本

**Worker 进程完成的工作：**

- 接收、传入并处理来自客户端的请求
- 提供反向代理及过滤功能

**请求过程：**

1. 在 master 进程里面，先建立好需要 listen 的 socket（listenfd）之后，然后再 fork 出多个 worker 进程
2. 所有 worker 进程的 listenfd 会在新连接到来时变得可读，为**保证只有一个进程处理该连接**，所有 worker 进程在注册 listenfd 读事件前抢 accept_mutex，抢到互斥锁的那个进程注册 listenfd 读事件，在读事件里调用 accept 接受该连接。
3. 当一个 worker 进程在 accept 这个连接之后，就开始读取请求，解析请求，处理请求，产生数据后，再返回给客户端，最后才断开连接

**IO 复用**：

​ 单进程模型：阻塞，一次仅处理一个请求，无法应对高并发场景

​ 多进程模型：每个进程响应一个请求。缺陷：当请求量庞大时，会占用大量 CPU 及内存资源，因为每个请求访问的页面都会单独缓存，若访问的页面相同，会造成内存使用效率低，且进程间切换会消耗大量 CPU 资源

​ Linux 原生并不支持线程，Windows 和 SunOS 都支持。Linux 将线程当做进程来处理，但称作 LWP 轻量级进程（Light Weight Process），Linux 进行线程管理是通过调用各种线程库实现的。

​ 多线程单请求模型：每个线程响应一个请求。线程和进程类似，也需要切换，但线程是轻量级的进程，切换消耗的资源很小。且同一进程内的线程共享一片存储空间，若有访问同一资源的请求，也可直接从存储空间调用该资源。线程对内存资源的需求量也比进程要小。而如果 CPU 数量只有 1 个，则多线程的优势基本无法体现，只有在多颗 CPU 的情况下，多线程才能发挥出极高的效率。

​ 多线程多请求模型：一个线程响应多个请求。

# Nginx 安装

在安装 nginx 前需要安装以下环境：

- gcc 与 gcc-c++等，可直接组安装 Development Tools
- prce-devel(perl 的正则表达库)
- zlib 与 zlib-devel(资料压缩的函数库)
- openssl 与 openssl-devel(安全套接字密码库)

> **注：带 devel 的包是一定要安装的。**

创建系统用户组`groupadd -r nginx`
创建系统`useradd -r nginx -M -g nginx`

> `-r`创建系统用户（组），`-M`不创建该用户家目录

创建目录`/var/tmp/nginx/client`，否则在后面运行时可能报错。

**初始化文件模块配置**

```
./configure --prefix=/usr/local/nginx \ # 设置nginx安装目录
	--sbin-path=/usr/sbin/nginx \  # 命令放在/sbin下
	--conf-path=/etc/nginx/nginx.conf \  # 配置文件位置
	--pid-path=/var/run/nginx/nginx.pid \  # nginx进程号文件
	--lock-path=/var/lock/nginx.lock \  # nginx锁文件
	--user=nginx \  # 指定用户
	--group=nginx \  # 指定用户组
	--http-log-path=/var/log/nginx/access.log \  # 运行日志位置
	--error-log-path=/var/log/nginx/error.log \  # 报错日志
	--http-client-body-temp-path=/var/tmp/nginx/client \
	# 指定客户端post上传的$_FILES上传的文件地址，该目录需要自己创
	--with-http_ssl_module \   # 加载ssl模块，默认没加载
	--with-http_stub_status_module \  # 加载监控模块
	--with-http_gzip_static_module \  # 加载gzip压缩模块
	--with-debug  # 允许debug
```

之后`make && make install`

也可以通过配置的 yum 源安装，此例是 centos7 的 repo 配置。然后直接`yum install`最新的版本。

```
[nginx]
name=nginx.repo
baseurl=https://nginx.org/packages/centos/7/x86_64/
gpgcheck=0
enabled=1
```

nginx 命令

```
nginx
  -t           #检查配置文件语法
  -c           #指定配置文件
  -V           #查看编译信息
  -s           #指定对nginx的操作
    stop      #停止（快速关闭）
    quit      #退出（优雅关闭，所有worker进程会停止接收新连接，然后将所有未处理完的请求处理完后关闭）
    reopen    #重新打开日志文件
    reload    #重新读取配置文件（平滑重启）
  -q           #在配置测试期间不显示非错误消息
```

# Nginx 配置文件解析

配置文件`/etc/nginx.conf`
配置文件组织结构：

- 全局配置：main
- 模块配置：events，http，server，location

**注：配置的每条指令的结尾必须加上分号`;`**

## 全局配置

### main 块

- 正常运行配置：

```
user Username [Groupname]  # 指定运行worker进程的用户
pid PATH  # 指定nginx进程的pid文件
worker_rlimit_nofile   # 指定一个worker进程所能打开的最大文件描述符数量
worker_rlimit_sigpending  # 指定每个用户能发给worker进程的最大的信号数量
```

- 性能优化配置：

```
worker_processes  # worker进程个数，通常为物理CPU核心数量-1
可填auto，自动使用所有CPU。
worker_cpu_affinity CPUMask # 指定使用的cpu，cpumask为cpu掩码。
# cpumask：0001,0010,0100,1000
work_priority NICE  # 指定nice值，即优先级
```

`worker_processes`和`work_connections`决定了最大并发数量。最大并发量即为`worker_processes × work_connections`

而在反向代理场景，因为 nginx 既要维持和客户端的连接，又要维持和后端服务器的连接，因此处理一次连接要占用 2 个连接，所以最大并发数为：`worker_processes × worker_connections/2`

Nginx 可能还会打开其他的连接，这些都会占用文件描述符，影响并发数量

最大并发数量还受"允许打开的最大文件描述符数量"限制，可以使用`worker_rlimit_nofile`指令修改。或直接通过`ulimit -n`修改

- 调试定位配置：

```
daemon {on|off}  # 是否以守护进程方式启动
master_process {on|off}  # 是否以master模型运行
error_log PATH [level]  # 错误日志文件路径及日志等级。
#日志等级：debug|info|notice|warn|error|crit|alert|emerg，默认为error
# 可设置为debug，但需要在编译时指定--with-debug才能用
# 若要禁用error_log 则可设置为error_log /dev/null;
```

## 模块配置

### events 块

`events { }`事件驱动，并发响应连接。控制 Nginx 处理连接的方式
包含以下配置：

```
worker_connections  # 每个worker进程能响应的最大并发请求数量
use {epoll | select | poll }  # 选择使用事件类型，最好让nginx自动选择
accept_mutex {on|off}  # 是否开启负载均衡锁，启用时，表示让多个worker进程轮流响应请求。默认开启
lock_file PATH   # 锁文件路径
```

### http 块

`http { }`处理 http 响应的配置

注：http 块下的文件相对路径是相对于 Nginx 的配置文件目录

包含以下配置：

```
#include  用于引入配置文件
#设置mime.types文件路径，若是相对地址则是相对于nginx.conf配置文件
include       mime.types;

#default_type用于设置默认文件类型
#若在编译时设置了配置文件目录，则此项路径为/usr/share/mime/application/octet-stream.xml
default_type  application/octet-stream;

#日志格式
#log_format  main  '$remote_addr - $remote_user [$time_local] "$request" ' '$status $body_bytes_sent "$http_referer" ' '"$http_user_agent" "$http_x_forwarded_for"';
#日志文件路径，由于已设置了/var/log/nginx/access.log，所以不需要改
#access_log  logs/access.log  main;

#开启高效传输文件模式，默认为on。
#可以让Nginx在传输文件时直接在磁盘和tcp socket之间传输数据，而不用经过任何buffer
sendfile        on;

#在sendfile为on时，确定是否启用tcp_nopush(FreeBSD)或tcp_cork(linux)
#会将多个http首部打包为单个报文。用于防止网络阻塞，但会额外占用资源
#tcp_nopush     on;

tcp_nodelay {on| off}
#tcp 有一个nagle算法，将多个小的数据块打包传输以提高带宽利用率。
#有时只需要访问一个较小页面，但由于nagle算法，要等待其他响应以打包为大数据块，所以会等较长时间才会返回页面。对keepalive模式下连接是否使用tcp_nodelay。通常关闭。

#设置keepalive长连接的超时时间。默认为65。若为0则保持长连接
#keepalive_timeout  0;

#设置keepalive连接上最大请求资源数，默认100
keepalive_requests 数量

#指明禁止指定浏览器使用keepalive功能
keepalive_disable {none|browser}

#设置发送响应报文的超时时长，默认60s
send_timeout  时长

#接收客户端报文body的缓冲区大小，默认8k（32位|16k--64位）超出该大小时，会被存储于磁盘
client_body_buffer_size  数值

#指定存储客户端报文的路径及子目录的结构数量
#就是编译时--http-client-body-temp-path指定的路径
client_body_temp_path PATH {level1 | level2 | level3}
#例：client_body_temp_path /var/tmp/client_body  2 2 表示该目录下有2层目录，每层有两个子目录



#是否开启gzip压缩响应报文
#gzip  on;

#指定错误页面
#error_page  404  /404.html;
error_page   500 502 503 504  /50x.html;
#更改响应状态码，隐藏服务器的真实状态码信息
#error_page  404=200 /404.html;
#设置由重定向后实际的处理结果来决定状态码
#error_page  404=/404.html;

server { }  # 虚拟主机模块
```

### server 块

```
#虚拟主机监听的本地端口和主机名
listen       80;
server_name  localhost;

#设置编码类型，为防止网页出现乱码，需要将charset设置gb2312或utf-8。
#charset koi8-r;

#Location，URI的根
location / {
    root   html;
    index  index.html index.htm;
}

location /XXX {}  #location块

#在响应首部中添加字段
add_header 字段名 值

try_files  [页面] [uri | =code]
#设置尝试打开的文件，若都找不到再返回最后一个uri
#最后一个uri必须存在，且必须由别的location定义，不能在当前的location中，否则会死循环
#例：try_files $uri xxx.html 先找用户需要的uri，若找不到返回xxx.html

#显示访问连接信息。
#stub_status   on;  #注：要放入server块
# 然后设置location
#location /status {
#  stub_status;
#}
#便可通过域名/status 查看。
Active connections: 164
server accepts handled requests
 7595 7595 7601
Reading: 0 Writing: 164 Waiting: 0
# 当前活动连接数
已接收的连接个数，已处理的连接个数，已经处理的请求个数
正在读取客户端的Header个数（Reading），正在返回给客户端的Header个数（Writing），长连接或等待状态的请求个数（Waiting）（当开启Keepalive时，该值为Active-Reading-Writing）。
```

### location 块

目录映射。允许根据用户请求的 URI 匹配定义的 location，匹配到就按该 location 中的配置处理

location 的第一个`/`为 root 中指定路径的最后的`/`

`alias` 设置别名，用于定义路径别名，**只用于 location 配置段**。

```
location /images {
  root /data/www/imgs/ ;
  # 即表示在URL中访问/images即为访问服务器中/data/www/imgs/images/目录
  # root为将location接在root指定的路径后
}
location /images {
  alias /data/www/imgs/ ;
  # 即表示在URL中访问/images即为访问服务器的/data/www/imgs/ 目录
  # alias为整段替换
}
```

与 root 和 alias 指令相关的变量为`$document_root`、`$realpath_root`。

**`$document_root`的值即是 root 指令、alias 指令的值**

**`$realpath_root`的值是对 root、alias 指令进行绝对路径换算后的值**

**`location`匹配**

- 不带符号 URI：匹配该资源目录下的所有资源

- `=` URL 精确匹配，只匹配该资源

- `~` 正则表达式匹配，区分大小写

- `~*` 正则表达式匹配，不区分大小写（例如 `location ~* \.(gif|jpg)$` 匹配`.gif`或`jpg`结尾的文件）

- `^~` URI 左半部分匹配，非正则匹配，不区分大小写

**优先级：`=` > `^~`>`~`或`~*`> 不带符号的 URI**

若要将 Nginx 作为文件存放服务器，在 location 块中添加`autoindex on;`即可，并且要确保文件存放的目录中没有首页文件。

# 访问控制、身份认证与 SSL

Nginx 的两个配置访问控制的指令`allow`和`deny`，由模块`ngx_http_access_module`提供。

```
allow|deny  IP地址[/mask]
allow|deny  all
```

若同一个块中同时配置了多条`deny`或`allow`，则先出现的访问权限生效。若多个块中都配置了权限指令，则内层的优先级高于外层的。

被访问控制 deny 的 IP 地址访问时会返回**403**状态码。

Nginx 的 basic 身份认证指令`auth_basic`和`auth_basic_user_file`由模块`ngx_http_auth_basic_module`提供。可配置在 http、server、location 块中

```
auth_basic  描述 | off;   是否开启http_basic对用户认证
auth_basic_user_file  FILE;  指定用户认证的账号文件
```

可通过 Apache 的工具`htpasswd`创建用户认证文件

`htpasswd -c -m -b /etc/nginx/secret mike 123456`

使用 SSL 将网站配置为 HTTPS

注：如果是编译安装，需要在构建时添加`--with_http_ssl_module`支持 SSL。

首先进入目录`/etc/pki/CA/private`下创建服务器 RSA 私钥，叫`server.key`。

`openssl genrsa -out server.key 2048`

生成服务器的 CSR 证书请求文件。CSR 证书请求文件是服务器的公钥，用于提交给 CA 机构进行签名。

`openssl req -new -key server.key -out server.csr`按要求填写信息即可

```
Country Name (2 letter code) [XX]:CN
State or Province Name (full name) []:Jiangsu
Locality Name (eg, city) [Default City]:Yangzhou
....
Common Name (eg, your name or your server's hostname) []:system3.example.com
```

CSR 参数含义：

| 参数                     | 说明                                   |
| ------------------------ | -------------------------------------- |
| Country Name             | 符合 ISO 的两个字母的国家代码，中国 CN |
| State or Province Name   | 省份                                   |
| Locality Name            | 城市                                   |
| Organization Name        | 公司名                                 |
| Organizational Unit Name | 组织名/部门名                          |
| Common Name              | 使用 SSL 加密的域名，不能填错          |
| Email Address            | 邮箱，可省略                           |
| A challenge password     | 有的 CA 机构需要此密码，通常省略即可   |
| An optional company name | 可选的公司名，可省略                   |

CA 为服务器认证证书

`openssl x509 -req -days 30 -in server.csr -signkey server.key -out server.crt`

> 在 CA 用私钥签名了证书后，该证书将用于浏览器验证请求的网站是否真实，防止网络通信过程中被篡改。
>
> 浏览器保存了受信任的 CA 机构的公钥，在请求 HTTPS 网站时，会利用 CA 公钥验证服务器证书，并检查域名是否吻合、证书是否过期等。

在 Nginx 配置文件中设置 https 配置。Nginx 配置文件中已默认存在 SSL 配置，只是注释了，取消注释，并修改 crt 文件路径即可。

```
    server {
        listen       443 ssl;
        server_name  system3.example.com;
				ssl          on;         # 这条配置文件可能没有，要加上
        ssl_certificate      /etc/pki/CA/private/server.crt; # SSL认证证书路径
        ssl_certificate_key  /etc/pki/CA/private/server.key; # SSL认证密钥路径

        ssl_session_cache    shared:SSL:1m;  # 用于存储SSL会话的高速缓存的类型和大小
        ssl_session_timeout  5m; # 客户端可以重复使用存储在缓存中的会话参数的时间
        ssl_ciphers  HIGH:!aNULL:!MD5;   # openssl允许的加密类型
        ssl_prefer_server_ciphers  on;
        location / {
            root   html;
            index  index.html index.htm;
        }
    }
    location / {
      proxy_set_header X-FORWARDED-PROTO  https;  #将http协议头换为https
      proxy_pass http://upstream;
    }
}
```

在`/etc/hosts`中确定配置了 system3 的条目。在浏览器上输入`https://system3.example.com`会说明此连接不安全。是因为当前的证书是服务器自己作为 CA 签名的，所以浏览器无法信任。点添加例外，可查看该证书，与配置的一致。

{% asset_img 1.png %}

{% asset_img 2.png %}

添加安全例外后，即可访问网页

# Nginx 日志

关于 Nginx 日志的指令如下：

- `log_format`：日志格式。格式：`log_format 格式名 格式（由变量组成）`，默认格式如下：

  `'$remote_addr - $remote_user [$time_local] "$request" ' '$status $body_bytes_sent "$http_referer" ' '"$http_user_agent" "$http_x_forwarded_for"'`

  - `$remote_addr`：客户端的地址。如果 Nginx 服务器在后端，则该变量只能获取到前端（代理或负载均衡服务器）的 IP 地址
  - `$remote_user`：远程客户端用户名称
  - `$time_local`：记录访问时间和时区信息
  - `$request`：记录用户访问时的 url 和 http 协议信息
  - `$status`：记录客户端请求时返回的状态码
  - `$body_bytes_sent`：记录服务器响应给客户端的主体大小
  - `$http_referer`：记录此次请求是从哪个链接过来的，需要模块`ngx_http_referer_module`支持，默认已装，可以防止盗链问题
  - `$http_user_agent`：记录客户端的浏览器信息。如使用什么浏览器发起的请求，是否是压力测试工具在测试等
  - `$http_x_forward_for`：若要在`$remote_addr`中获取的是真正客户端的 IP，则要添加此项，并且在前端的服务器要开启`x_forward_for`

- `access_log`：访问日志的路径和采用的日志格式名。格式：`access_log path [format [buffer=size] [gzip[=level]] [flush=time] [if=condition]];`。若不指定格式名，默认为 combined。buffer 为日志缓冲区的大小，默认 64K。flush 为日志刷盘时间，即日志保存在缓冲区的最大时间。gzip 为日志刷盘前是否压缩以及压缩级别。if 指定条件。

- `open_log_file_cache`：设置日志文件缓存。默认关闭，即每一条日志都是打开文件，写入后关闭，这样会消耗一定量的 IO。而设置了缓存后，会等日志数量达到一个指标后一下写入日志文件。

  格式：`open_log_file_cache max=N [inactive=time] [min_uses=N] [valid=time];`。其中 max 为缓存中的最大文件描述符数量。inactive 为存活时间，默认是 10s。min_uses 为在 inactive 时间段内，日志文件最少使用多少次后，该日志文件描述符记入缓存中，默认是 1 次。valid 为检查频率，默认 60s。

- `log_subrequest`：是否在 access.log 中记录子请求的访问日志。默认不记录

- `rewrite_log`：是否在 error.log 中记录 notice 级别的重写日志。默认关闭

## 日志切割

默认 Nginx 不会自动切割日志。

**手动切割**：

```
mv access.log access-XXXX.log
nginx -s reopen
```

**自动切割**：

创建 shell 脚本

```
#!/bin/bash
ACCESS_LOG=/var/log/nginx/access.log
NEW_ACCESS_LOG=/var/log/nginx/access-$(date -d yesterday +%Y%m%d).log
[ -f $ACCESS_LOG ] || exit 1
  mv $ACCESS_LOG $NEW_ACCESS_LOG
  /sbin/nginx -s reopen
```

添加定时任务

```
0 0 * * * /bin/sh XXX.sh &> /dev/null   #每天晚上12点切割日志
```

# Nginx 的其他常见 HTTP 功能

## 文件查找规则

Nginx 为了响应一个请求，它将请求传递给一个内容处理程序，由配置文件中的`location`指令决定处理。

**无条件内容处理程序**首先被尝试 ：`perl` 、`proxy_pass`、`flv`、`mp4`等。如果这些处理程序都不匹配，那么 Nginx 会将该请求按顺序传递给下列操作之一，顺序依次是 ：`random index` 、 `index` 、 `autoindex` 、`gzip_static`、 `static` 。

**处理以斜线结束请求的是 index 处理程序**。如果 gzip 没有被激活，那么 static 模块会处理该请求。

这些模块如何在文件系统上找到适当的文件或者目录则由某些指令组合来决定。**`root` 指令最好定义在一个默认的 `server` 指令内 ， 或者至少在一个特定的 `location` 指令之外定义，以便它的有效界限为整个 server。**

文件路径指令：

| 指令      | 说明                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------ |
| root      | 设置文档根目录，URI 后设置，可在文件系统中找到具体文件                                           |
| try_files | 测试文件的存在性，若前面的文件没找到，则最后的条目作为备用，需要确保最后一个路径或 location 存在 |

例：

```
location / {
  try_files $uri $uri/ /40x.html;
}
```

## 域名解析

| 指令             | 说明                                                                |
| ---------------- | ------------------------------------------------------------------- |
| resolver         | 设置一个或多个域名解析服务器。可选 valid 参数，会覆盖域名记录的 TTL |
| resolver_timeout | 当解析服务器不可达时的等待时间，尽量设置的小。目前只适用于商业订阅  |

该指令需要配置在 server 块中

```
server {
  resolver 8.8.8.8 valid=300s;
  resolver_timeout 2s;
}
```

## 客户端交互

Nginx 与客户端交互的方式有多种，这些方式可以从连接本身 （IP 地址、超时、存活时间等）到内容协商头的属性。

| 指令                   | 说明                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| default_type           | 设置响应的默认 MIME 类型。只有文件的 MIME 类型不匹配任何 types，才会用此项      |
| types                  | 设置 MIME 类型到文件扩展名的映射，一般不用设置。只需要载入`conf/mime.types`即可 |
| ignore_invalid_headers | 禁止忽略无效名字的头。一个有效的名字由 ASCII 字母、数字、连字符号组成           |
| recursie_error_pages   | 启用 error_page 实现多个重定向                                                  |

# Nginx 缓存

Nginx 的模块`ngx_http_proxy_module`自带缓存功能，Nginx 可实现几种缓存：网页内容缓存，日志缓存，打开文件缓存，fastcgi 缓存。Nginx 的缓存功能主要由`proxy_chache`相关的命令集和`fastcgi_cache`相关命令集构成，前者用于反向代理，后者用于对 FastCGI 缓存。

需要下载第三方的 Nginx 模块`ngx_cache_purge`，用于清除指定的 URL 缓存，[下载地址](http://labs.frickle.com/nginx_ngx_cache_purge/)

下载后解压，然后重新编译 Nginx，通过`nginx -V`查看编译选项，复制过去然后加上解压后的模块目录（不是里面的.c 文件）

```
./configure
........
   --add-module=/root/ngx_cache_purge-2.3
```

编译后能看到新的模块添加成功的信息

```
configuring additional modules
adding module in /root/ngx_cache_purge-2.3
 + ngx_http_cache_purge_module was configured
```

然后**只要`make`就行，不能`make install`，不然就是重新安装 Nginx 了**

最后还要替换 nginx 启动文件，在重新编译后，nginx 的下载目录中有个`objs`目录，将里面的`nginx`启动脚本复制到`/usr/sbin/`下，替换原来的`nginx`

```
rm -f /usr/sbin/nginx
cp /root/nginx-1.14.0/objs/nginx /usr/sbin/
```

通过`nginx -V`查看，`--add-module=/root/ngx_cache_purge-2.3`已成功编译

Nginx 自带的缓存相关指令有三个：

- `proxy_cache_path`：配置缓存存放路径。常用格式：`proxy_cache_path path [levels=levels] keys_zone=name:size [max_size=size] [inactive=time];`。
  - `levels`：缓存目录级别以及缓存目录名的字符数，数字间用冒号分隔。最多可有三层目录，目录名最多两个字符。例：`levels=1:2:2`表示一共三层目录，第一层目录名 1 字符，第二和第三层目录名为 2 字符。
  - `keys_zone`：缓存标识名和内存中缓存的最大空间。名字必须唯一。可在`keys_zone`的值后加上`:内存缓存空间`指定内存中的缓存空间大小
  - `max_size`：磁盘中缓存目录的最大空间
  - `inactive`：缓存的默认时长，到达指定时间却没被访问的缓存会被自动删除
- `proxy_cache`：指定要使用的缓存方法，使用`proxy_cache_path`中`keys_zone`指定的名称。格式：`proxy_cache 缓存标识名;`
- `proxy_cache_valid`：根据状态码指定缓存有效期。格式：`proxy_cache_valid 状态码（可指定多个，或直接指定any） 时间（支持m|h等时间单位）;`

在配置文件添加缓存配置。首先在 http 块下（server 块外）添加缓存路径，路径可根据需要自定义

```
proxy_temp_path   /data/ngxcache/proxy_temp_dir;
proxy_cache_path  /data/ngxcache/proxy_cache_dir levels=1:2 keys_zone=cache_one:1000m max_size=1g;
```

**Nginx 启动后，缓存加载程序只进行加载一次**，加载时会将缓存的元数据加载到共享内存区域，但是如果**一次加载整个缓存全部内容可能会使 Nginx 刚启动的前几分钟性能消耗严重，大幅度降低 Nginx 的性能**。所以可以在 proxy_cache_path 命令中**配置缓存迭代加载**。缓存迭代加载一共可以设置三个参数：

```
loader_threshold - 迭代的持续时间，以毫秒为单位(默认为200)
loader_files     - 在一次迭代期间加载的最大项目数(默认为100)
loader_sleeps    - 迭代之间的延迟(以毫秒为单位)(默认为50)
```

例：`proxy_cache_path /data/ngxcache/proxy_cache_dir keys_zone=cache_one:10m loader_threshold=300 loader_files=200;`

```
proxy_cache_methods[GET HEAD POST];
```

在虚拟服务器下配置`proxy_cache_methods`命令可以指定该虚拟服务器下什么类型的 HTTP 方法可以被缓存。默认情况下 GET 请求及 HEAD 请求会被缓存，而 POST 请求不会被缓存。

```
proxy_cache_bypass  $cookie_nocache  $arg_nocache$arg_comment;
```

`proxy_cache_bypass`命令可以配置不会向客户端响应缓存，而是直接将请求转发给后端服务进行请求数据。可以通过上述命令配置需要绕过缓存的请求 URL，也就是说 URL 中包含该配置的值，则这次请求会直接跳过缓存直接请求后端服务去获取数据。

```
proxy_cache_min_uses 2;
```

`proxy_cache_min_uses`命令可以设置当某请求最少响应几次后会被缓存。若设置为 2 则表示每个请求最少被请求 2 次后会加入到缓存中。

例：简单添加 location 缓存配置

```
location / {
    proxy_cache cache_one;
    proxy_cache_valid  200 1h;      # 状态码为200的缓存1小时
    proxy_cache_valid  404 1m;
    proxy_cache_valid  any 5m;      # 剩余的所有状态都缓存5分钟
}
```

当开启缓存后，Nginx 会生成进程`cache_manager`对缓存进行管理。

```
nginx      1359   1356  0 11:23 ?        00:00:00 nginx: cache manager process
nginx      1360   1356  0 11:23 ?        00:00:00 nginx: cache loader process
```

可在`server`块中添加`add_header X-Cache $upstream_cache_status;`，该参数用于显示缓存状态返回值，一共有七种：

| 返回值      | 说明                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| HIT         | 缓存                                                                                                                                    |
| MISS        | 未命中，请求被传送到后端                                                                                                                |
| EXPIRED     | 缓存已过期，请求被传到后端                                                                                                              |
| UPDATING    | 正在更新缓存，将使用旧的应答                                                                                                            |
| STALE       | 无法从后端服务器更新缓存时，返回了旧的缓存                                                                                              |
| BYPASS      | 缓存被绕过了                                                                                                                            |
| REVALIDATED | 在启用 proxy_cache_revalidate 后，当缓存内容过期后时，Nginx 通过一次 If-Modified-Since 的请求头去验证缓存内容是否过期，此时会返回该状态 |

```
add_header X-Cache "$upstream_cache_status from $server_addr";
```

完整的配置：

```
proxy_temp_path     /data/ngxcache/proxy_temp_dir;
proxy_cache_path    /data/ngxcache/proxy_cache_dir levels=1:2 keys_zone=cache_one:1000m max_size=1g;
upstream web {
  server 172.16.246.134;
  server 172.16.246.135;
}
server {
  listen       80;
  server_name  web;
  root         /usr/share/nginx/html;
  add_header X-Cache "$upstream_cache_status from $server_addr";
  location / {
    proxy_cache cache_one;
    proxy_cache_valid  200 1h;
    proxy_pass http://web;
}
```

通过浏览器访问`http://web`。如果是第一次访问，会发现状态是 MISS

{% asset_img 5.png %}

若再次访问，则状态会变为 HIT。

{% asset_img 6.png %}

并且可以看到缓存目录下已建立缓存

```
/data/ngxcache/proxy_cache_dir/
├── 5
│   └── a4
│       └── 383e066904ed363cfafab47f9f53fa45
└── 6
    └── 01
        └── abca5f5d9926bd7fbfc52390d3d35016
```

另外常用的三种缓存：

- `open_log_cache`：日志缓存
- `open_file_cache`：文件缓存
- `fastcgi_cache`：fastcgi 缓存

## 清除缓存

如果缓存过期则需要从缓存中删除过期的缓存文件，防止新旧缓存出现交错出错，当 Nginx 接收到自定义 HTTP 头或者 PURGE 请求时，缓存将会被清除。

在 HTTP 节点下创建一个新变量\$purge_method 来标识使用 PURGE 方法的请求并删除匹配的 URL。

```
http {
  map $request_method $purge_method {
    PURGE 1;
    default 0;
  }
}
```

进入虚拟服务器配置，在 location 中配置高速缓存，并且指定缓存清除请求命令`proxy_cache_purge`。

```
server {
  listen 80;
  server_name web;
  location / {
    proxy_cache cache_one;
    proxy_cache_purge $purge_method;
  }
}
```

发送清除命令

配置`proxy_cache_purge`指令后需要发送 PURGE 请求来清除缓存。例如使用 PURGE 方式请求 url:

```
PURGE web/app
```

则 app 对应的缓存中的数据将被删除。但是，这些高速缓存数据不会从缓存中完全删除，它们将保留在磁盘上，直到它们被删除为非活动状态，或由缓存清除进程处理。

限制 IP 访问清除命令：清除缓存这种命令一般需要权限才可进行操作，所以一般需要配置允许发送缓存清除请求的 IP 地址：

```
geo $purge_allowed {
 default 0;
 192.168.0.1/24 1;
}
map $request_method $purge_method {
 PURGE $purge_allowed;
 default 0;
}
```

当 Nginx 接收到清除缓存请求时，Nginx 检查客户端 IP 地址，若 IP 地址已经获得清除缓存权限，则$purge_method设置为$purge_allowed，值为 1 表示允许清除缓存，值为 0 表示表示 IP 地址未获得权限。

从缓存中完全删除文件：高速缓存数据不会从缓存中完全删除，它们将保留在磁盘上，直到它们被删除为非活动状态，或由缓存清除进程处理。要完全删除与 getArticle 相匹配的缓存数据，需要在`proxy_cache_path`添加参数 purger，该参数表示永久的遍历所有缓存条目，并删除与通配符相匹配的条目。

```
proxy_cache_path /data/ngx_cache/proxy_cache_dir keys_zone=cache_one:10m purger=on;
```

# Nginx 负载均衡

Nginx 提供负载均衡模块`ngx_http_upstream_module`，且 Nginx 有四种典型的负载均衡配置方式。

| 配置方式               | 说明                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 轮询 round-robin       | 默认配置方式，每个请求按照时间顺序逐一分配到不同后端服务器                                                                                                                                                               |
| 权重                   | 利用 weight 指定轮询的权重比率，weight 与访问比率成正比。用于后端服务器性能不均的情况                                                                                                                                    |
| ip_hash                | 每个请求按访问 IP 的 hash 结果分配，使每个访客固定访问一个后端服务器，可解决 Session 问题                                                                                                                                |
| fair（第三方）         | 按后端服务器响应时间来分配请求，响应时间短的优先                                                                                                                                                                         |
| url_hash（第三方）     | 按访问 URL 的哈希结果来分配请求，使每个 URL 固定访问一个后端服务器。适用于后端服务器做缓存的情况                                                                                                                         |
| 一致性 Hash（Tengine） | 将每个服务器虚拟成 N 个节点，均匀分布在哈希环上，每次请求时会根据配置参数计算出一个 Hash，在哈希环上查找离这个哈希值最近的虚拟节点，对应服务器作为该次请求的后端服务器。好处：若增加或减少了机器，对整个集群的影响会最小 |

Nginx 作负载均衡的优点：

- 配置简单
- 成本低
- 支持 Rewrite 重写规则
- 有内置的健康检查功能
- 节省带宽：支持 Gzip，可添加浏览器本地缓存的 Header
- 稳定性高：高并发的情况下也基本不会宕机

## 轮询

实验环境：

- 负载均衡器：172.16.246.133
- 后端服务器 1：172.16.246.134
- 后端服务器 2：172.16.246.135

仅需在负载均衡服务器上配置

```
server{
  listen  80;
  server_name  sys1.example.com;
  location / {
    proxy_pass http://sys1.example.com;
  }
}

upstream sys1.example.com {
  server 172.16.246.134;
  server 172.16.246.135;
}
# 实际上，轮询也是有weight的，只是所有的server的weight都为默认的1。
```

在本机上进行访问

```
> curl sys1.example.com
WEB1
> curl sys1.example.com
WEB2
> curl sys1.example.com
WEB1
> curl sys1.example.com
WEB2
```

## 权重

仍在负载均衡器上配置，仅修改 upstream 块

```
upstream sys1.example.com {
  server 172.16.246.134 weight=1 max_fails=1 fail_timeout=2;
  server 172.16.246.135 weight=3 max_fails=2 fail_timeout=2;
}
```

| 参数         | 说明                                                                                  |
| ------------ | ------------------------------------------------------------------------------------- |
| weight       | 权重                                                                                  |
| max_fails    | 允许请求失败次数，默认为 1。当超过最大次数时，返回 proxy_next_upstream 指令定义的错误 |
| fail_timeout | 在经历 max_fails 次失败后，暂停服务的时间                                             |
| backup       | 预备备份机器，当所有其他主机都 down 后，就会启用该主机                                |
| down         | 指定的 server 暂不参与负载均衡                                                        |

查看现象

```
> curl sys1.example.com       # 一共四次访问，访问web1和web2的比例正好为1:3
WEB2
> curl sys1.example.com
WEB1
> curl sys1.example.com
WEB2
> curl sys1.example.com
WEB2
```

## ip_hash

```
upstream sys1.example.com {
  ip_hash;
  server 172.16.246.134;
  server 172.16.246.135;
}
```

测试：

```
> curl sys1.example.com
WEB2
> curl sys1.example.com
WEB2
> curl sys1.example.com
WEB2
> curl sys1.example.com
WEB2
```

每个 IP 地址绑定一个 web 服务器，可能会导致某些 web 服务器负载很大，有的很少，反而无法保证负载均衡。

upstream 块补充指令：

- `keepalive`：指定每个 worker 进程缓存到上游服务器的连接数。需要先将`proxy_http_version`设为 1.1，`proxy_set_header`设为`Connection ""`

  ```
  upstream apache {
    server  127.0.0.1:8080;
    keepalive  32;
  }
  location / {
    proxy_http_version  1.1;
    proxy_set_header  Connection "";
    proxy_pass  http://apache;
  }
  ```

- `least_conn`：直接激活最少连接算法，将请求发送至活跃连接数最少的服务器。

# Nginx 反向代理

在模块`ngx_http_proxy_module`中与 Nginx 反向代理有关的指令：`proxy_pass`，用于设置后端服务器的地址，仅用于`location`块。可以设置代理服务器的协议和地址以及映射位置的可选 URI。

实验环境：

- 代理服务器：172.16.246.133
- 后端服务器 1：172.16.246.134
- 后端服务器 2：172.16.246.135

只需要在代理服务器上配置即可

```
    server{
        listen 80;
        server_name web1;
        location / {
            proxy_pass http://172.16.246.134;
        }
    }
    server{
        listen 80;
        server_name web2;
        location / {
            proxy_pass http://172.16.246.135;
        }
    }
```

然后在本机上配置 hosts 文件

```
172.16.246.133  web1 web2
```

确保代理服务器和后端服务器的端口都打开。然后在本机测试

```
> curl web1
WEB1
> curl web2
WEB2
```

如果代理的是动态内容服务器，要使用`fastcgi_pass`指令进行代理

```
location ~* \.php$ {
  fastcgi_pass http://phpserver;
}
```

补充指令：

- **`proxy_set_header`**：在将客户端请求转交给后端服务器前，更改请求头信息。默认只重新定义了两个字段

  ```
  proxy_set_header Host       $proxy_host;
  # 最好使用$host变量，它的值等于“Host”请求头字段中的服务器名称，如果此字段不存在则等于主服务器名称
  proxy_set_header Host       $host;
  # 服务器名称可以与代理服务器的端口一起传递
  proxy_set_header Host       $host:$proxy_port;
  # 请求host为代理主机
  proxy_set_header Host       $proxy_host;
  # 添加客户端IP
  proxy_set_header X-Real-IP  $remote_addr;
  proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
  proxy_set_header Connection close;
  ```

  若设置了`X-Real-IP`，且后端服务器是 httpd，则可以修改 httpd 配置文件中的`LogFormat`，添加一个`%{X-Real-IP}i`。而若后端是 Nginx，则不用修改了，因为 Nginx 的`log_format`中已默认配置了`$remote_addr`，即客户端 IP。

  如果启用了缓存，则标题字段为“If-Modified-Since”，“If-Unmodified-Since”，“If-None-Match”，“If-Match”，“Range”和“If-Range”来自原始请求不会传递给代理服务器。

- **`proxy_connect_timeout`**：配置 Nginx 与后端代理服务器尝试连接的超时时间，默认 60s，且通常不会大于 75 秒。

  ```
  proxy_connect_timeout  30;
  ```

- **`proxy_read_timeout`**：配置 Nginx 向后端服务器组发出 read 请求后，等待响应的超时时间。仅在**两个连续的读操作之间**设置超时，而不是整个响应。如果代理服务器在此时间内未传输任何内容，则关闭连接。默认为 60 秒。

  ```
  proxy_read_timeout  15;
  ```

- **`proxy_send_timeout`**：配置 Nginx 向后端服务器组发出 write 请求后，等待响应的超时时间。仅在**两个连续的写操作之间**设置超时，而不是整个请求。如果代理服务器在此时间内未收到任何内容，则关闭连接。默认为 60 秒。

  ```
  proxy_send_timeout  15;
  ```

- **`proxy_redirect`**：用于修改后端服务器返回的响应头中的 Location 和 Refresh

  ```
  proxy_redirect  off;
  ```

- **`proxy_buffer_size`**：用于读取从代理服务器接收的响应的第一部分的**缓冲区的大小**，这部分通常包含一个小的响应头。默认情况下，缓冲区大小等于一个内存页面，默认为 4K 或 8K。

  ```
  proxy_buffer_size  4k;
  ```

- **`proxy_buffers`**：用于从代理服务器读取响应的缓冲区的数量(number)和大小(size)，用于单个连接。默认情况下，缓冲区大小等于一个内存页面。默认为 4K 或 8K。语法：`proxy_buffers number size;`

  ```
  proxy_buffers  32  4k;
  # 那么最多支持的并发活动连接数 = 分配给nginx的内存量（字节）/ (number×size×1024)
  ```

- **`proxy_temp_file_write_size`**：当启用从代理服务器到临时文件的响应缓冲时，限制一次写入临时文件的数据大小。默认情况下，size 由`proxy_buffer_size`和`proxy_buffers`指令设置的两个缓冲区限制。默认为 8k 或 16k。

  ```
  proxy_temp_file_write_size  64k;
  ```

可以讲这些代理指令单独存放为一个配置文件，然后在主配置文件的代理块中`include`应用。

## 非 HTTP 型上游服务器

### Memcached 服务器

Nginx 提供 memcached 模块并默认开启，用于与 memcached 守护进程通信，此时 Nginx 并不是充当反向代理，而是使 Nginx 使用 memcached 协议会话，因此 key 的查询能够在请求传递到应用服务器之前完成。

```
upstream memcaches {
  server  xxxx:11211;
  server  xxxx:11211;
}
server {
  location / {
    set  $memcached_key  "$uri?args";
    memcached_pass  memcaches;
  }
}
```

`memcached_pass`将使用`$memcached_key`变量实现 key 查找。

### FastCGI 服务器

fastcgi 模块也是默认开启。开启后 Nginx 可使用 FastCGI 协议与多个上游服务器会话。

```
upstream fastcgis {
  server xxxx:9000;
  server xxxx:9000;
}
location / {
  fastcgi_pass  fastcgis;
}
```

SCGI 与 uWSGI 服务器与 FastCGI 类似，分别使用`scgi_pass`与`uwsgi_pass`指定上游服务器。

# Nginx 邮件服务

Nginx 提供邮件代理服务，能代理 POP3、IMAP、SMTP。

每一个进入的请求都会基于相应的协议处理，对于每一个协议，Nginx 都需要一个用户名密码认证服务，如果认证成功，则连接被代理到邮件服务器。

{% asset_img 7.png %}

Nginx 邮件服务，若是编译安装，则需要在构建时指定`--with-mail`。

如果代理 pop3 服务，在配置文件中添加以下配置

```
mail {
  auth_http  localhost:9000/auth;  # 查询认证服务
  server {
    listen 110;        # pop3的TCP端口110，监听POP3服务
    protocol pop3;
    proxy on;
  }
}
```

如果是代理 imap 服务，则同理，而可以不用指定`protocol imap;`，因为 imap 是默认值。而端口号改为 143。

如果代理 smtp 服务，则修改`protocol`后，再修改端口号为 25。

Nginx 还为三种服务提供了可选指令，能做到根据服务器的情况灵活代理。

最好在`mail`块中，指定`server_name`，为邮件代理提供统一入口。

# 重写与重定向

Nginx 提供模块`ngx_http_rewrite_module`实现 URL 重写与重定向。`rewrite`指令能用于`server`、`location`、`if`块中。Nginx 的 rewrite 需要 pcre 的支持。

`rewrite regex replacement [flag];`

其中 regex 为正则表达式，replacement 为符合正则的替换算法。flag 为进一步处理的标识。以下为 flag 的可选值：

| 参数值    | 说明                                 |
| --------- | ------------------------------------ |
| last      | 终止 rewrite，继续匹配               |
| break     | 终止 rewrite，不再继续匹配           |
| redirect  | 临时重定向，返回的 HTTP 状态码为 302 |
| permanent | 永久重定向，返回的 HTTP 状态码为 301 |

例：

```
rewrite ^/(.*) http://www1.example.com/$1 permanent;
# ^/(.*) 正则表达式，表示匹配全部
# 匹配成功就跳转到www1.example.com/$1
# $1对应的是前面正则表达式的()部分
```

rewrite 有以下的作用：

- 使 URL 更加规范，方便开发
- 使搜索引擎收录网站内容
- 网站换域名后，让旧域名的访问跳转到新域名上
- 根据特殊变量、目录、客户端信息进行 URL 跳转

应用实验：使 www1.example.com 和 example.com 访问同一个地址

```
server {
  listen 80;
  server_name example.com;
  rewrite ^/(.*) http://www1.example.com/$1 permanent;
}
server {
  listen 80;
  server_name www1.example.com;
  location / {
    root html/www;
    index index.html;
  }
}
```

## 重写

两种匹配规则：

- `break`：本条规则匹配完成后，不再继续匹配后续任何规则
- `last`：本条规则匹配完成后，继续向下匹配新的 location URI 规则

在 server 块中添加以下内容：

```
# !-e判断请求指定的资源是否不存在，若不存在就执行if块中的指令。$request_filename表示当前请求的文件路径
if (!-e $request_filename) {
  rewrite "^/.*" /40x.html break;
  # 重写符合规则的请求地址。"^/.*"表示匹配当前网站下的所有请求
}
```

试验：

```
> curl http://web/asdasd
400 ERROR
```

若使用 last 标记：

```

```

常用的测试：

- 双目测试：

  - `~`，`!~`：正则匹配与不匹配（区分大小写）
  - `=`，`!=`：精确匹配与不匹配
  - `~*`，`!~*`：正则匹配与不匹配（不区分大小写）

  使用案例：

  ```
  if ($request_method="POST"){}
  if ($request_uri ~* "/forum"){}
  ```

- 单目测试：
  - `-f`，`!-f`：文件存在与不存在
  - `-d`，`!-d`：目录存在与不存在
  - `-e`，`!-e`：文件或目录存在与不存在
  - `-x`，`!-x`：判断是否可执行与不可执行

# Nginx 优化

## 安全优化

### 隐藏 Nginx 版本号

```
# curl -I localhost
HTTP/1.1 200 OK
Server: nginx/1.14.1     # nginx的版本号会被轻松获取
Content-Type: text/html
Content-Length: 4057
......
```

通过修改配置，在 http 块中添加

```
server_tokens off;
```

再次访问

```
# curl -I localhost
HTTP/1.1 200 OK
Server: nginx
Content-Type: text/html
Content-Length: 4057
.....
```

这样配置，在 nginx 的报错页面中也不会出现版本号。

### 文件解析漏洞

### CRLF注入漏洞

### 目录遍历漏洞
属于配置不当的漏洞，错误的配置会使目录被遍历，导致源码或重要信息泄露。
解决：对某location路径添加`autoindex off;`，默认就是off的。

### 服务器请求伪造漏洞

### 整数溢出漏洞

## 性能优化

### nginx 单个进程允许的客户端最大连接数

`worker_connections`为 nginx 单个进程允许的客户端最大连接数，这个连接数包含了所有连接，如代理连接、客户端连接等，需要根据服务器性能和内存消耗来指定，同时还与最大打开文件数（worker_rlimit_nofile）有关，在配置`ulimit -HSn 65535`后，该配置才能生效。
该参数配置在`event`块。

nginx 的总并发连接 = worker 数量 \* worker_connections

### worker 进程最大打开文件数

`worker_rlimit_nofile`为 nginx worker 进程最大打开文件数，可设置为`ulimit -n`的大小。配置在主标签段，不属于任何块。

### 优化服务器域名的散列表

散列表和监听端口关联，每个端口都最多关联到三张表：

- 确切名字的散列表
- 以星号起始的通配符名字的散列表
- 以星号结束的通配符名字的散列表

Nginx 会按以上的顺序依次查找域名，为了尽快找到域名，尽量使用确切名字。若定义了大量名字，或定义了非常长的名字，则需要在 HTTP 配置块中调整`server_names_hash_max_size`和`server_names_hash_bucket_size`的值。nginx 默认的值取决于 cpu 缓存行长度，可能是 32 或 64 或 128。配置在主标签段。

先尝试设置`server_names_hash_max_size`，差不多为名字列表的名字总量，若不能解决问题再设置`server_names_hash_bucket_size`。

`server_names_hash_max_size`默认为 512kb，一般是 cpu L1 的 4-5 倍，不要加单位，默认单位为 kb。

### nginx 连接参数优化

`keepalive_timeout`设置连接会话保持时间，默认 65。
`client_header_timeout`设置读取客户端请求头数据的超时时间，若超过这个时间，客户端还没发送完整的 header 数据，nginx 会返回 408（request time out）错误，默认 60，推荐为 15，有单位。设置在 http 或 server 块。
`client_body_timeout`同上，是客户端请求体的超时时间，默认为 60s。设置在 http 或 server 块或 location 块。
`send_timeout`指定响应客户端的超时时间，仅限于两个连接活动之间的时间，若超过这个时间客户端没有活动，则 nginx 连接关闭，默认 60s，推荐 25s，有单位。设置在 http 或 server 块或 location 块。

### 上传文件大小限制

`client_max_body_size`限制上传文件大小，具体根据业务调整，默认为 1m，推荐先设为 8m。设置在 http 或 server 块或 location 块。

### FastCGI 优化

### gzip 压缩

### expires 缓存

## 放盗链

## 防爬虫

## CDN 加速

## Nginx 降权

# Nginx 与 PHP

Nginx 自带的 FastCGI 模块，不仅能接受 php-fpm，还能与任何兼容 FastCGI 的服务器通信，该模块默认启用。

常用指令：

| FastCGI 指令            | 说明                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| fastcgi_buffer_size     | 来自 FastCGI 服务器响应头的第一部分设置缓冲大小                              |
| fastcgi_buffers         | 设置来自 FastCGI 服务器响应的缓冲数量和大小，用于单个连接                    |
| fastcgi_cache           | 定义一个共享的内存 zone，用于缓存                                            |
| fastcgi_no_cache        | 指定一个或多个字符串，Nginx 不会将来自 FastCGI 服务器的响应保存在缓存中      |
| fastcgi_keep_conn       | 服务器不立即关闭连接以保持到 FastCGI 服务器的连接                            |
| fastcgi_pass            | 指定 FastCGI 服务器如何传递请求，格式：`address:port`                        |
| fastcgi_cache_path      | 该指令用于设置存储缓存响应的目录和存储活跃的 key 和响应元数据的共享内存 zone |
| fastcgi_connect_timeout | 指定 Nignx 将等待它接受连接的最长时间                                        |
| fastcgi_hide_header     | 指定不应该传递到客户端的头列表                                               |

# Nginx 常见模块

## gzip 压缩

gzip 模块默认启用。

```
http {
  gzip on;
  gzip_comp_level 2;    # 指定gzip压缩等级（1-9）
  gzip_types text/plain text/css application/xml application/json;
  #指定除了text/html，其他需要压缩的MIME类型

  gzip_min_length 1024;
  # 在启用压缩前先确定响应的长度，若高于此处设定的值，则启用压缩
  gzip_buffers  40 4k;  # 用于压缩响应使用的缓存数量和大小
}
```

# LNMP 分布式集群方案

## 搭建 Nginx+PHP 环境

编译安装 PHP，php 版本 7.2.11。

确保`zlib`及其库`zlib-devel`，`gd`及其库`gd-devel`，`curl`及其库`libcurl`、`libcurl-devel`，`openssl`及其库`openssl-devel`，`libxml2`和`libxml2-devel`（php 编译必须的依赖包），`libjpeg`及其库`libjpeg-devel`，`libpng`及其库`libpng-devel`，`freetype-devel`

```
./configure   --prefix=/usr/local/php7.2 \
   --enable-fpm \            # 开启PHP的FPM功能
   --with-zlib \
   --enable-zip \
   --enable-mbstring \       # 用于多字节字符串处理
   --with-mysqli \           # 增强版Mysql数据库访问支持
   --with-pdo-mysql \        # 基于PDO（php data object）的MySQL数据库访问支持
   --with-gd \               # gd库支持，用于php图像处理
   --with-jpeg-dir \         # jpeg图像处理库
   --with-png-dir \          # png图像处理库
   --with-freetype-dir \     # freetype字体图像处理库
   --with-curl \             # curl支持
   --with-openssl \
   --with-mhash \            # mhash加密支持
   --enable-bcmath \         # 精确计算功能
   --enable-opcache          # 开启opcache，一种php代码优化器

make && make install
```

安装完成后，php-fpm 是无法通过`systemctl`管理的。需要以下配置

php 配置文件目录

```
/usr/local/php7.2/etc/
├── pear.conf
├── php-fpm.conf.default
└── php-fpm.d
    └── www.conf.default
```

需要将`php-fpm.conf.default`改名为`php-fpm.conf`。然后进入解压包的目录中`sapi/fpm`目录，里面有一个`php-fpm.service`，将该文件的权限改为`754`，然后复制到`/usr/lib/systemd/system/`中。

如果是 CentOS/Redhat 6 系列，则将`init.d.php-fpm`复制到`/etc/init.d/`中并改名为`php-fpm`，添加执行权限，然后`chkconfig --add php-fpm`。

查看`php-fpm.service`，确保 PID 文件、配置文件路径正确。

```
[Unit]
Description=The PHP FastCGI Process Manager
After=network.target

[Service]
Type=simple
PIDFile=/usr/local/php7.2/var/run/php-fpm.pid
ExecStart=/usr/local/php7.2/sbin/php-fpm --nodaemonize --fpm-config /usr/local/php7.2/etc/php-fpm.conf
ExecReload=/bin/kill -USR2 $MAINPID
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

其中配置文件的路径为安装目录的`etc/php-fpm.conf`，所以该配置文件原来的`.default`文件一定要改名为`php-fpm.conf`。并且还需要将`php-fpm.d/`下的`www.conf.default`改名为`www.conf`，否则还会报错。

`/usr/local/php7.2/sbin/php-fpm -t`检查配置文件是否正确。

再启动 php-fpm，`systemctl start php-fpm.service`

```
ps -ef | grep php-fpm
root      47197      1  0 22:53 ?        00:00:00 php-fpm: master process (/usr/local/php7.2/etc/php-fpm.conf)
nobody    47198  47197  0 22:53 ?        00:00:00 php-fpm: pool www
nobody    47199  47197  0 22:53 ?        00:00:00 php-fpm: pool www

ss -anpt | grep php-fpm
LISTEN     0      128    127.0.0.1:9000                     *:*                   users:(("php-fpm",pid=47199,fd=5),("php-fpm",pid=47198,fd=5),("php-fpm",pid=47197,fd=7))
```

可以看出，php-fpm 监听了 9000 端口，主进程用户为 root，子进程用户为 nobody。

可以将`bin`和`sbin`目录添加到环境变量中，将配置文件软连接到`/etc/php/`中，方便操作。

php-fpm 主配置文件`php-fpm.conf`，该配置文件采用的是 INI 的格式

```
[global]          # 全局配置
pid = run/php-fpm.pid       # pid文件路径
error_log = log/php-fpm.log # 日志路径
syslog.ident = php-fpm      # syslog标识名称
log_level = notice          # 日志等级。alert, error, warning, notice, debug
daemonize = yes             # 是否在后台运行
events.mechanism = epoll    # 事件机制。
include=/usr/local/php7.2/etc/php-fpm.d/*.conf  # 进程池配置存放目录
; process.max = 128
```

php-fpm 进程池配置文件`www.conf`，采用的也是 INI 格式

```
[www]              # 进程池配置
user = nobody      # 工作用户
group = nobody     # 工作组
listen = 127.0.0.1:9000     # 监听IP地址与端口
;listen.owner = nobody      # socket文件所属用户
;listen.group = nobody      # socket文件所属组
;listen.allowed_clients = 127.0.0.1   # 指定允许连接的客户端IP，默认为环回口
pm = dynamic                # 控制子进程的数量，默认为dynamic（动态控制）
pm.max_children = 5        # 最多子进程数
pm.start_servers = 2       # 启动进程数，对应了php-fpm:pool www的个数
pm.min_spare_servers = 1   # 最少空闲进程数，若少于该数，则会自动创建空闲进程
pm.max_spare_servers = 3   # 最多空闲进程数，若多于该数，则会自动删除空闲进程
access.log = log/$pool.access.log     # 日志文件，默认不记录日志
;php_admin_value[memory_limit] = 32M  # 以php_admin_value的方式替换php.ini中memory_limit的值
;php_flag[display_errors] = off    # 以php_flag的方式替换php.ini中display_errors的值
```

在 php 的解压包中，有两个关于`php.ini`的配置文件：`php.ini-production`和`php.ini-development`，其中 production 适用于实际上线环境（安全性高），development 适合于开发环境（便于调试）。选择其中一个复制到 php 安装目录下`lib/php/`中，并改名为`php.ini`。

```
[PHP]            # PHP核心配置
output_buffering = 4096             # 输出缓冲，单位字节
;open_basedir =                     # 限制php脚本可访问的路径
disable_functions =                 # 禁用的函数列表
max_execution_time = 30             # 每个PHP脚本最长时间限制，单位秒
memory_limit = 128M                 # 每个PHP脚本最大内存使用限制
display_errors = On                 # 是否输出错误信息
log_errors = On                     # 是否开启错误日志
;error_log = php_errors.log         # 错误日志路径
post_max_size = 8M                  # 通过POST提交的最大限制
default_mimetype = "text/html"      # 默认MIME类型
default_charset = "UTF-8"           # 默认编码
file_uploads = On                   # 是否开启文件上传
;upload_tmp_dir =                   # 上传文件临时保存目录
upload_max_filesize = 2M            # 上传文件最大限制
allow_url_fopen = On                # 是否允许打开远程文件
;cgi.fix_pathinfo=1                 # 开启在CGI模式下自动识别PATHINFO
# PATHINFO用于在某个脚本后添加自定义内容
# 开启后，若要访问的资源不存在，则会执行上一级的文件，若上一级的文件仍不存在，则返回“File not found”
# 若不开启，要访问的文件不存在，则直接返回错误“No input file specified”

[Date]               # 时间与日期配置
;date.timezone = Asia/Shanghai      # 时区

[Session]            # 会话配置
session.save_handler = files        # 将会话以文件形式保存
;session.save_path = "/tmp"         # 会话保存目录
```

修改 Nginx 配置文件，取消以下行的注释：

```
location ~ \.php$ {
  root           html;
  fastcgi_pass   127.0.0.1:9000;         # 将动态请求交给该端口处理
  fastcgi_index  index.php;
  fastcgi_param  SCRIPT_FILENAME  /scripts$fastcgi_script_name; # 额外参数文件
  include        fastcgi.conf;  # 包含了当前目录下的fastcgi_params配置
  # 一定要设置为fastcgi.conf，不能设为fastcgi_params
  # 因为.conf文件不_params文件多了一条
  # fastcgi_param  SCRIPT_FILENAME    $document_root$fastcgi_script_name;
  # 这是指定了脚本的路径
}
```

查看`/etc/nginx/fasstcgi_params`文件

```
# 请求字符串（/xxx.php?xxx=xxxx&xxx=xxxx）
fastcgi_param  QUERY_STRING       $query_string;
# 请求方法（get、post）
fastcgi_param  REQUEST_METHOD     $request_method;
# 内容的类型（即MIME类型）
fastcgi_param  CONTENT_TYPE       $content_type;
# 内容长度
fastcgi_param  CONTENT_LENGTH     $content_length;
# CGI脚本名
fastcgi_param  SCRIPT_NAME        $fastcgi_script_name;
# 请求URI
fastcgi_param  REQUEST_URI        $request_uri;
# 文件URI
fastcgi_param  DOCUMENT_URI       $document_uri;
# 文件根目录
fastcgi_param  DOCUMENT_ROOT      $document_root;
......
```

在`index.php`中写入`<? phpinfo(); ?>`。刷新配置，浏览器访问。

{% asset_img 3.png %}

## Nginx+Apache 动静分离

Nginx 提供外部访问，静态请求直接由 Nginx 处理，动态请求转交给 Apache 处理，实现动静分离。

{% asset_img 4.png %}

首先要确保 Apache 已支持 PHP。确保 Apache 是`--enable-so`的，会在 Apache 的`bin/`下有一个`apxs`命令，是 Apache 的一个扩展工具（Apache extension tools），用于编译模块。php 的 configure 可用 apxs 编译用于 Apache 访问 PHP 的模块。

使用`php -i | grep configure`查看 php 的编译参数

```
Configure Command =>  './configure'  '--prefix=/usr/local/php7.2' '--enable-fpm' '--with-zlib' '--enable-zip' '--enable-mbstring' '--with-mcrypt' '--with-mysql' '--with-mysqli' '--with-pdo-mysql' '--with-gd' '--with-jpeg-dir' '--with-png-dir' '--with-freetype-dir' '--with-curl' '--with-openssl' '--with-mhash' '--enable-bcmath' '--enable-opcache'
```

重新整理并添加`--with-apxs2=/usr/local/httpd-2.4/bin/apxs`。

**注：**如果此时直接编译仍然会报错，错误来自于`apxs`命令。报错信息如下：

```
./configure: /usr/local/httpd-2.4/bin/apxs: /replace/with/path/to/perl/interpreter:
bad interpreter: No such file or directory
```

查看`apxs`命令。第一行是`#!/replace/with/path/to/perl/interpreter -w`肯定是不存在的，需要替换为`#!/usr/bin/perl -w`。重试`./configure`，然后`make`（不要`make install`）。

修改 httpd 的配置文件，以下为要修改的内容

```
Listen 81     # 防止与Nginx冲突，要修改端口号

# 修改httpd虚拟主机
<VirtualHost *:81>
  Servername "system3.example.com"
  DocumentRoot "htdocs/php"
</VirtualHost>
```

修改 Nginx 配置文件，将以下行取消注释并修改

```
location ~ \.php$ {
  proxy_pass   http://127.0.0.1:81;     # 代理客户端浏览器请求Apache服务器
  proxy_set_header Host $host;   # 发送Host消息头
  # 因为Nginx在代理时能传递客户端的请求头，但无法传递Host消息头
  # $host保存了请求的主机名（system3.example.com）
}
```

# 参考文章

- [nginx 基础及提供 web 服务(nginx.conf 详解)](http://www.cnblogs.com/f-ck-need-u/p/7683027.html)
- [nginx 日志配置](http://www.ttlsa.com/linux/the-nginx-log-configuration/)
- [Nginx 缓存原理及机制](https://mp.weixin.qq.com/s?__biz=MzU5MTc1ODA0OQ==&mid=2247484867&idx=1&sn=0ef618a9ee29fdae99e5da1517acf085&chksm=fe2b524dc95cdb5bd4da28a7384a0da17f73b4d3af463a3004c06e5e01195b2a83995eb3d4b7&scene=21#wechat_redirect)
- Nginx 高性能 Web 服务器实战教程
- 高性能网站构建实战
- 跟老男孩学 Linux 运维 Web 集群实战
- 精通 Nginx（第二版）

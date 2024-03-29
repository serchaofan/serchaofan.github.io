---
title: Zabbix搭建笔记
date: 2018-09-28 18:23:06
tags: [zabbix, 监控, 运维]
categories: [监控]
comments: false
---

- [zabbix 概述](#zabbix-概述)
- [zabbix 搭建](#zabbix-搭建)
  - [LNMP/LAMP 环境搭建 Zabbix](#lnmplamp-环境搭建-zabbix)
- [zabbix 操作](#zabbix-操作)
  - [监控一台主机](#监控一台主机)
    - [配置用户](#配置用户)
    - [配置主机](#配置主机)
    - [添加监控项](#添加监控项)
    - [新建触发器](#新建触发器)
    - [设置通知](#设置通知)
    - [使用服务器本地邮箱发送报警邮件](#使用服务器本地邮箱发送报警邮件)
    - [新建模板](#新建模板)
    - [新建图表](#新建图表)
  - [详细配置操作](#详细配置操作)
    - [主机资产管理](#主机资产管理)
    - [批量更新](#批量更新)
    - [Zabbix 事件](#zabbix-事件)
    - [触发器](#触发器)
    - [action](#action)
    - [自动发现与自动注册](#自动发现与自动注册)
    - [低级别发现](#低级别发现)
    - [自定义监控项](#自定义监控项)
  - [zabbix 主动与被动模式](#zabbix-主动与被动模式)
- [zabbix 实战](#zabbix-实战)
  - [监控 MySQL](#监控-mysql)
  - [监控 Apache](#监控-apache)
  - [监控 Nginx](#监控-nginx)
  - [监控 PHP-FTPM](#监控-php-ftpm)
  - [监控 Tomcat](#监控-tomcat)
  - [监控 Redis](#监控-redis)
  - [zabbix 与微信整合](#zabbix-与微信整合)
  - [zabbix 与 Logstash 整合](#zabbix-与-logstash-整合)

<!--more-->

# zabbix 概述

Zabbix 是一个企业级开源的分布式监控套件，可以监控网络和服务的监控状况。

**zabbix 组成**：`zabbix server`和`zabbix agent`

- Zabbix Server 可通过 SNMP、Zabbix_agent、ping、端口扫描等方法提供对远程服务器的监视
- Zabbix Agent 安装在需要被监控的目录服务器上收集信息。监听端口 10050

**zabbix 核心组件：**

- zabbix server：收集 agent 的监控信息，对数据统计操作，设置配置。zabbix server 可单独监控，也可与 agent 结合。可轮询 agent 主动接收监控数据，也可被动接收。监听端口 10051
- zabbix databases：存储所有配置信息，以及监控数据。一般可以是：mysql，oracle，sqlite
- zabbix web GUI：通常与 server 运行在同一主机上（可在不同主机），用于可视化操作

**zabbix 可选组件：**

- proxy：代理服务器，用于分布式监控环境，代理 server 接收 agent 的监控数据，汇总后统一发往 server
- agent：被监控主机，收集本地数据

zabbix 也可用于监控 java 应用，可基于 JMX 组件监控 JVM

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291812857.png)

**zabbix 服务进程：**

- zabbix_agentd：zabbix agent 的守护进程
- zabbix_server：zabbix server 的守护进程
- zabbix_get：zabbix 的一个工具，用于拉取远端客户端的信息，通常用于排错。需要安装 zabbix-get
- zabbix_sender：zabbix 的一个工具，用于主动推送数据给 server 或 proxy，通常用于耗时较长的检查或大量主机监控的场景。需要安装 zabbix-sender
- zabbix_proxy：zabbix proxy 的守护进程。需要安装 zabbix-proxy-mysql|pgsql|sqlite3
- zabbix_java_gateway：java 网关，用于监控 java 应用环境，类似 agentd。只能主动推送数据。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291813066.png)

**常用术语：**

- 监控项 item：一个特定的监控指标的数据，**监控项是 zabbix 数据收集的核心**
- 触发器 trigger：一个表达式，用于**评估某监控对象的某特定 item 内所接收的数据是否在合理范围内**，即阈值。当数据量大于阈值时，触发器状态从 ok 变为 problem
- 事件 event：发生的事情，如触发器状态的变化，新的 agent 或 agent 重新注册
- 动作 action：指**对特定事件事先定义的处理方法**，包含操作与条件
- 报警升级 escalation：发送警报或执行远程命令的自定义方案
- 媒介 media：发送通知的手段或通道，如 Email，jabber，SMS
- 通知 notification：通过选定的媒介向用户发送的有关某事件的信息
- 远程命令：预定义的命令，可在被监控主机处于某特定条件下自动执行
- 模板 template：用于快速定义被监控主机的预设条目集合，包含 item，trigger，graph，screen（多个 graph），application，low-level discovery rule。模板可以直接链接到单个主机
- 应用程序 application：一组 item 的集合
- web 场景 web scennaria：用于检测 web 站点可用性的一个或多个 http 请求

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291813029.png)

**Zabbix 特点：**

- 配置简单：可使用模板，直接添加监控设备、可配置组监控、可对模板继承，进行精细设定
- 实时绘图，自定义监控图表（面板），支持网络拓扑图
- 灵活的告警机制：可自定义告警升级（escalation）、接受者和告警方式，还可通过远程命令实现自动化动作 action
- 可进行不同类型数据的收集：性能、SNMP、IPMI、JMX，可自定义收集数据的间隔
- 数据存储：可将数据存放在数据库中，并内置数据清理机制
- 网络自动发现机制：自动发现网络设备、文件系统、网卡等，agent 自动注册
- zabbix 由 C 开发，高性能，内存消耗低。web 前段由 php 编写
- 提供丰富的 API
- 可进行权限认证，并进行访问控制

# zabbix 搭建

**搭建 zabbix 监控服务器端**

zabbix 需要 LAMP 或 LNMP 的环境，先安装以下环境`gcc gcc-c++ autoconf automake zlib zlib-devel openssl openssl-devel pcre-devel`

安装 php 环境：`yum install php php-fpm`

安装 mysql/mariadb 环境：`yum install mariadb*`

## LNMP/LAMP 环境搭建 Zabbix

可通过 yum 安装 nginx，但版本不是最新的。通过源码安装 nginx 版本为 1.14。

首先创建 nginx 用户及用户组。然后下载源码包并解压，进入目录

```
./configure --prefix=/usr/local/nginx \
            --sbin-path=/usr/sbin/nginx \
            --conf-path=/etc/nginx/nginx.conf \
            --error-log-path=/var/log/nginx/error.log \
            --pid-path=/var/run/nginx/nginx.pid \
            --lock-path=/var/lock/nginx.lock \
            --user=nginx \
            --group=nginx \
            --http-log-path=/var/log/nginx/access.log \
            --http-client-body-temp-path=/var/tmp/nginx/client \
            --with-http_ssl_module \
            --with-http_stub_status_module \
            --with-http_gzip_static_module \
            --with-http_dav_module \
            --with-http_stub_status_module \
            --with-http_addition_module \
            --with-http_flv_module \
            --with-http_mp4_module \
            --with-http_sub_module \
            --with-debug
```

进入`/etc/nginx/nginx.conf`添加一行`user nginx nginx`

安装 zabbix，首先去官网选择主机环境版本[下载页](https://www.zabbix.com/download)，安装 zabbix 的 repo 源。

```
rpm -i https://repo.zabbix.com/zabbix/4.0/rhel/7/x86_64/zabbix-release-4.0-1.el7.noarch.rpm
```

若官方的源下载慢，则可使用 aliyun 的源，要自己配 repo

```
[zabbix]
name=Zabbix Official Repository - $basearch
baseurl=https://mirrors.aliyun.com/zabbix/zabbix/4.4/rhel/7/$basearch/
enabled=1
gpgcheck=0
```

然后安装`zabbix-server-mysql zabbix-web-mysql zabbix-agent zabbix-web`

若是客户端，不需要搭建 LAMP 或 LNMP 环境，只需要安装 repo 源和`zabbix-agent`和`zabbix-sender`，并且`zabbix-sender`也不是必须安装，若要主动向 zabbix 服务器发送监控数据时才需要安装。

zabbix 的几个目录：

- `/etc/zabbix`：zabbix 配置目录
- `/var/log/zabbix`：zabbix 日志目录
- `/var/run/zabbix`：zabbix 运行目录
- `/usr/lib/zabbix`：zabbix 库文件目录
- `/usr/share/zabbix`：zabbix 的 web 文件目录

修改 nginx 配置文件，找到下面配置，修改`fastcgi_param`后的路径为`/usr/share/zabbix`

```
location ~ \.php$ {
    root           html;
    fastcgi_pass   127.0.0.1:9000;
    fastcgi_index  index.php;
    fastcgi_param  SCRIPT_FILENAME  /usr/share/zabbix$fastcgi_script_name;
    include        fastcgi_params;
}
```

在 mysql 创建 zabbix 库，和管理数据库的用户 zabbix

```
create database zabbixdb;
grant all on zabbixdb.* to zabbix@127.0.0.1 identified by 'zabbix';
flush privileges;
```

导入 zabbix 的 sql 文件，sql 文件存放在`/usr/share/doc/zabbix-server-mysql-3.4.14/create.sql.gz`中，用`gunzip create.sql.gz`解压，然后导入`mysql -u root -p zabbixdb < create.sql`

修改`/etc/zabbix/zabbix_server.conf`

```
DBHost=localhost
DBName=zabbixdb
DBUser=zabbix
DBPassword=zabbix
```

安装 zabbix 后，会自动创建系统用户 zabbix，但这个用户是设置了无法登录，而 zabbix 不允许。需要重新创建

`zabbix`命令

```
zabbix_server
  -c      指定配置文件，默认/etc/zabbix/zabbix_server.conf
  -f      在前台运行zabbix_server
  -R      执行运行时管理功能，功能如下
      config_cache_reload        重新读取配置缓存
      housekeeper_execute        执行housekeeper
      log_level_increase=target  提升日志等级，若不指定target则影响zabbix所有进程
      log_level_decrease=target  降低日志等级，同上
           #target可以是PID，进程类型

zabbix_agentd
  与zabbix_server参数一致，并多了下面的配置
  -p      显示已知的items
  -t      测试指定的item
```

启动 zabbix_server 服务`systemctl start zabbix-server.service`或`zabbix_server`启动

在 apache 或 nginx 配置文件中创建虚拟主机后，通过浏览器访问

```
# apache虚拟主机配置
<VirtualHost *:80>
  ServerName "zabbix.monitor1.com"
  DocumentRoot "/usr/share/zabbix"
  <Directory "/usr/share/zabbix">
    Require all granted
    AllowOverride None
  </Directory>
</VirtualHost>

# nginx虚拟主机配置
server {
  listen    80;
  server_name zabbix.monitor1.com;
  location / {
    root   /usr/share/zabbix;
    index index.php  index.html;
  }
  location ~ \.php$ {
    root           /usr/share/zabbix;
    fastcgi_pass   127.0.0.1:9000;
    fastcgi_index  index.php;
    fastcgi_param  SCRIPT_FILENAME  /usr/share/zabbix$fastcgi_script_name;
    include        fastcgi_params;
  }
}
```

根据网页提示，修改 php 配置文件`/etc/php.ini`

```
# 时区错误
date.timezone = Asia/Shanghai
```

全部修改完成后重启 php-fpm 和 httpd。再次访问安装界面，完成安装。默认登录用户为`admin`，默认登录密码`zabbix`

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291813985.png)

在监控主机上需要修改配置文件`/etc/zabbix/zabbix_agentd.conf`

```
最基本就只需要修改一项
Server = 监控服务器的IP地址
```

并且默认不能以 root 身份运行 zabbix_agentd，可以修改配置文件

```
AllowRoot=1   # 是否允许root运行agentd，1为允许，0为不允许
或修改
User=zabbix   # 运行agentd的用户，需要取消注释
```

使用 zabbix_get 工具检查是否能获取数据

```
# zabbix_get -s 192.168.80.128 -p 10050 -k "system.uptime"
198526
```

# zabbix 操作

- [监控一台主机](#监控一台主机)
- [详细配置操作](#详细配置操作)

## 监控一台主机

### 配置用户

> Administration --> Users

创建一个用户

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291814214.png)

设置用户媒介（如何通知）

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291814590.png)

[官方文档详细配置说明](https://www.zabbix.com/documentation/4.0/zh/manual/config/hosts/host)

### 配置主机

> Configuration --> Hosts

默认已存在一个主机 Zabbix server，监控本机。在 Create host 添加新主机。

注：如果是虚拟机主机，则需要在同一个网段

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291814565.png)

### 添加监控项

> Configuration --> Hosts --> Items --> create items

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291814343.png)

有几个需要填写的项：

- Name：监控项名
- Key：监控项技术上的名称，即要获取的信息
- Type of information：信息类型，即数据格式，有 Numeric（无符号/浮点）、character、log、text

[其他选项详情](https://www.zabbix.com/documentation/4.0/manual/config/items/item#configuration)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291814603.png)

第一次获得的监控项值最多需要 60 秒才能到达。然后，默认 30 秒更新一次，可通过 Update interval 修改

然后在 Monitoring 的 Lateset data 中添加显示的主机或主机组。然后在下面添加项的右侧 Graph 查看图像。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291814452.png)

### 新建触发器

> Configuration --> Hosts --> Triggers --> Create trigger

触发器表达式可直接 Add 选择，也可手动编写，[触发器表达式语法](https://www.zabbix.com/documentation/4.0/manual/config/triggers/expression)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291814674.png)

可在 Monitroing 的 Problems 中添加问题报告的主机和触发器。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291814802.png)

触发器表达式格式：

```
{<server>:<key>.<function>(<parameter>)}<operator><constant>
# server：主机名
# key：监控项的键
# function：触发器函数
# parameter：触发器函数的参数（如果有的话）
# operator：判断符号。有：>、<、<>、>=、<=、=
# constant：常数值，即判断的数值
```

常见触发器函数

- diff：返回值若为 1 表示最近的值与之前不同，0 为无变化
- last：获取最近的值。需要指定参数#num，为最近的第 num 个值。例：last(#2)
- avg：返回一段时间的平均值。例：avg(5)为最近 5 秒的平均值，avg(#5)为最近五次的平均值，avg(3600,86400)为一天前的一个小时的平均值
- change：返回最近获得值与之前获得值的差值，返回字符串 0 表示相等，1 表示不等。
- nodata：是否能接收到数据，返回 1 表示指定的间隔内未收到数据，0 表示正常接收数据
- count：返回指定时间间隔内数值的统计
- sum：返回指定时间间隔中收集的值的总和。例：sum(600)表示 600s 内接收到所有值的和，sum(#5)表示最后 5 个值的和

### 设置通知

> Administration --> Media Types

zabbix 中提供的几种媒介（Media）类型：

- Email：电子邮件
- SMS：手机短信，通过连接至 zabbix 服务器 GSM Modem 发送通知
- Jabber：jabber 消息。Jabber 是一个开放的基于 XML 的协议，能实现基于 Internet 的即时通讯服务
- 自定义脚本通知：调用位于配置文件的`AlertScriptsPath`变量定义的脚本目录中的脚本

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291815076.png)

### 使用服务器本地邮箱发送报警邮件

首先安装 mailx 软件，直接 yum 安装即可。然后测试

```
echo "test" | mail -s "test" xxxx@qq.com
```

然后进入 zabbix web 的 Administration 中 Media types 新建一个媒介

一个媒体类型必须通过发送地址来关联用户，否则它将无法生效。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291815082.png)

发送通知是 Zabbix 中动作（actions）执行的操作之一，因此为了建立一个通知，需要创建动作。

> Configuration --> Actions --> Create action

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291815159.png)

### 新建模板

> Configuration --> Templates --> Create template

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291816950.png)

在 Configuration 的 Hosts 中选择一个主机的 item，并点击 Copy 进行复制，在复制界面选择目的模板
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291821058.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291821010.png)

通过此法向模板中添加监控项。

在 Host 的主机配置表中，选择 Templates，然后添加模板，先点 select 选模板，然后 add 添加。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291821760.png)

### 新建图表

> Configuration --> Hosts --> Graphs --> Create graph

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291815322.png)

- show legend：是否显示图例

- percentile line：是否显示百分位线，用作参考

- Graph type：有四种图表

  - Normal：普通线图

  - Stacked：堆图

    ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291816287.png)

  - Pie：饼图

  - Exploded：爆炸图（分裂的饼图）

## 详细配置操作

### 主机资产管理

> Configuration --> Hosts --> Host inventory

有三种设置模式：disabled（关闭）、manual（手动）、automatic（自动）

手动模式需要输入设备类型、序列号等信息。自动模式会自动填充，需要在监控项中添加一些项才能实现。

```
system.hw.chassis[full|type|vendor|model|serial] - 默认是 [full], 需要root权限
system.hw.cpu[all|cpunum,full|maxfreq|vendor|model|curfreq] - 默认是[all,full]
system.hw.devices[pci|usb] - 默认是 [pci]
system.hw.macaddr[interface,short|full] - 默认是 [all,full], interface支持正则表达式
system.sw.arch
system.sw.os[name|short|full] - 默认是 [name]
system.sw.packages[package,manager,short|full] - 默认是 [all,all,full], package支持正则表达式
```

可在 Inventory 中的 Hosts 查看配置的主机现有资产数据。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291821977.png)

### 批量更新

一次更改多个主机的某些属性。

> Configuration --> Hosts

选中多个主机，点下方的 Mass update。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291822765.png)

Host 选项卡：

- Replace host groups：从任何现有主机组中删除主机，并替换为该字段中指定的主机
- Add new or existing host groups：从现有主机组指定其他主机组
- Remove host groups：从主机中删除特定主机组

Templates 选项卡：

- Link Templates：指定模板，可选择替换或添加。*Clear when unlinking*选项将不仅可以取消链接任何以前链接的模板，还可以删除所有继承自它们的元素（监控项、触发器等）。

### Zabbix 事件

事件是基于时间戳进行标记的，是采取动作的基础，来源于三个途径：

- 触发器事件：每次触发器状态改变就会生成相应事件
- 发现（discovery）事件：zabbix 会周期性扫描网络发现规则中的指定 IP 范围，一旦发现主机或服务，就会生成发现事件
  - 有 8 类发现事件：Service Up，Service Down，Host Up，Host Down，Service Discovered，Service Lost，Host Discovered，Host Lost
- 主动 agent 自动发现事件：也称自动注册事件，当一个此前状态未知的主动 agent 发起检测请求时会生成该类事件

因此，Zabbix 的通知机制也称为基于事件的通知机制。

### 触发器

当每次采集的数据超出了设置的触发器阈值，则触发器状态会变为**Problem**，若数据在范围之内，则触发器状态变为**OK**。

事件成功迭代（OK event generation）设置，用于控制如何生成正常事件（OK event）

- 表达式（Expression）：当表达式结果为 FALSE，Problem 会生成一个 OK 事件
- 恢复表达式（Recovery expression）：当表达式结果为 FALSE，且恢复表达式结果为 TRUE，Problem 状态会变为 OK 事件。如果触发器的恢复条件和问题标准不同，则可以使用此设置。
- 无（None）：正常事件从来不生成。可以和多重问题事件生成一起结合使用，以便在某事件发生时可以更简单的发送通知。

事件成功关闭（OK event closes）设置，用来控制哪些问题事件（Problem events）被关闭

- 所有问题（All problems）：正常事件（OK event）将关闭触发器创建的所有打开的问题
- 所有问题如果标记的值匹配（All problems if tag values match）：正常事件（OK event）将关闭触发器创建的打开的问题，并且至少有一个匹配的标记值。

触发器的严重性：

- 未分类（Not classified）：未知严重性（灰）
- 信息（Information）：提示（浅蓝）
- 警告（Warning）：警告（黄）
- 一般严重（Average）：一般问题（橙）
- 严重（High）：发生重要的事（浅红）
- 灾难（Disaster）：灾难，财务损失（红）

触发器提示颜色可在 Adminstration --> General --> Trigger severities 中修改

事件关联是一种**设置自定义事件关闭（导致正常事件生成）的规则**，该规则定义了**新的问题事件如何与现有的问题事件配对，并通过生成相应的正常事件来关闭新的事件或匹配事件**。

### action

### 自动发现与自动注册

zabbix 发现包括三种：

- 自动网络发现（network discovery）
- 主动客户端自动注册（active agent auto-registration）
- 低级别发现（low-level discovery）

zabbix 网络发现基于的信息种类：

1. IP 段自动发现
2. 可用外部信息（FTP、SSH、WEB、POP3 等）
3. 从 zabbix 客户端收到的信息
4. 从 SNMP 客户端收到的信息

网络发现由两个步骤组成：发现（discovery）和动作（action）

zabbix 会周期性扫描网络发现规则中的 IP 段，动作是对发现的主机进行设置的过程。

配置自动发现需在 Coufiguration 的 Discovery 配置。修改 IP Range 和 Update interval，并添加 Checks 中选项，指定类型为 zabbix agent，并指定键值，zabbix server 会尝试去指定网段内的所有主机获取该值，若能获取则自动发现成功。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291823670.png)

配置自动发现动作在 Configuration 的 Actions，选择右上角的事件源为 discovery，然后创建 action。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291823930.png)

进入配置后可修改计算方式、触发条件，或创建新的触发条件

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291823286.png)

可进入 Operations 修改或添加操作

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291823886.png)

自动注册用于 Agent 主动向 Server 注册，且主要适用于条件未知情况（agent 的 IP 地址段或 agent 的操作系统信息等）。

配置客户端自动注册的步骤：

1. 在客户端配置文件中设置参数

   修改 zabbix_agentd.conf，修改后重启 zabbix-agentd 服务

   ```
   Server=192.168.1.134  # 本机IP地址
   ServerActive=192.168.1.133   # 主动模式下，Zabbix Server的IP
   Hostname=KubeServer2   # 主机名，仅用于显示，不用和主机名一致
   HostMetadata=linux zabbix.kube2   # 元信息，用于标识识别
   ```

2. 在 zabbix web 中配置一个动作

   在 Configuration 中 actions 的选项 auto-registration 并创建

   ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291824830.png)

   然后直接配置 condition，选择条件包含的内容

   ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291824806.png)

   继续配置 operations，添加几个操作

   ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291824767.png)

### 低级别发现

Low-Level discovery（LLD）：当例如要对网卡进行监控时，由于网卡名可能以 eth 开头或 enps 开头，若分别针对不同网卡名设置会很繁琐，而使用 LLD 就可解决问题。

zabbix 中支持的数据项发现：

- 文件系统发现
- 网络接口发现
- SNMP OID 发现
- CPU 核以及状态

zabbix 自带的 LLD key：

- `vfs.fs.discovery`：适用于 zabbix agent 监控方式
- `snmp.discovery`：适用于 SNMP agent 监控方式
- `net.if.discovery`：适用于 zabbix agent 监控
- `system.cpu.discovery`：适用于 zabbix agent 监控

可通过`zabbix_get`获取 agent 的数据，但不支持 SNMP agent。

```
zabbix_get [options]
  -s 指定主机名或IP地址
  -p 指定agent上获取数据的端口，默认为10050
  -k 指定键
```

### 自定义监控项

agent 的配置文件中`User parameters`用于设置定义项，可设置多个。

首先将`UnsafeUserParameters`设为 1，启动自定义参数。然后设置自定义项

```
UserParameter=<key>, <shell command>
例：
UserParameter=ping, echo 1
```

可以在`/etc/zabbix/zabbix_agentd.d/`中创建配置文件专门配置自定义项。

若要让键能接收参数，只需要在键后添加`[*]`。例：`UserParameter=ping[*], echo $1`

## zabbix 主动与被动模式

默认 zabbix server 会去每个 agent 上抓取数据，即 Agentd 被动模式。但当监控主机数量过大时，可能会导致 web 页面卡顿、监控告警不及时、图标显示终端等问题。

可通过两个方面优化：

1. 部署多个 zabbix proxy，做分布式监控
2. 调整 zabbix agent 为主动模式

Agentd 主动模式指：客户端收集本端监控信息后主动发给 server。

修改客户端配置

```
StartAgents=3   # 指定agentd收集的数据往哪发。默认值为3。
# 若要开启主动模式，需要将该值设为0。
# 关闭被动模式后，agent的10050端口也会关闭
```

同时需要在 server 端修改配置，保证性能

```
StartPollers=5     # 减少主动收集数据的进程。默认为5，也可不改
StartTrappers=200  # 负责处理agentd推送数据的进程调大
```

然后需要在网页端配置，将监控类型从`zabbix agent`改为`zabbix agent(active)`

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291824159.png)

# zabbix 实战

## 监控 MySQL

编写一个监控 mysql 的脚本 check_mysql

```
#!/bin/bash
# 主机IP地址
MYSQL_HOST='127.0.0.1'

# 端口
MYSQL_PORT='3306'

# 数据连接
MYSQL_CONN="/usr/bin/mysqladmin -h${MYSQL_HOST} -P${MYSQL_PORT}"

# 检查参数是否正确
if [ $# -ne "1" ]; then
  echo "arg error"
fi

# 获取数据
case $1 in
  Uptime)
    result=$(${MYSQL_CONN} status | cut -f2 -d':' | cut -f1 -d'T')
    echo $result
    ;;
  Com_update)
    result=$(${MYSQL_CONN} extended-status | grep -w "Com_update" | cut -d'|' -f3)
    echo $result
    ;;
  Slow_queries)
    result=$(${MYSQL_CONN} status | cut -f5 -d':' | cut -f1 -d'O')
    echo $result
    ;;
  Com_select)
    result=$(${MYSQL_CONN} extended-status | grep -w "Com_select" | cut -d'|' -f3)
    echo $result
    ;;
  Com_rollback)
    result=$(${MYSQL_CONN} extended-status | grep -w "Com_rollback" | cut -d'|' -f3)
    echo $result
    ;;
  Questions)
    result=$(${MYSQL_CONN} status | cut -f4 -d':' | cut -f1 -d'S')
    echo $result
    ;;
  Com_insert)
    result=$(${MYSQL_CONN} extended-status | grep -w "Com_insert" | cut -d'|' -f3)
    echo $result
    ;;
  Com_delete)
    result=$(${MYSQL_CONN} extended-status | grep -w "Com_delete" | cut -d'|' -f3)
    echo $result
    ;;
  Com_commit)
    result=$(${MYSQL_CONN} extended-status | grep -w "Com_commit" | cut -d'|' -f3)
    echo $result
    ;;
  Bytes_sent)
    result=$(${MYSQL_CONN} extended-status | grep -w "Bytes_sent" | cut -d'|' -f3)
    echo $result
    ;;
  Bytes_received)
    result=$(${MYSQL_CONN} extended-status | grep -w "Bytes_received" | cut -d'|' -f3)
    echo $result
    ;;
  Com_begin)
    result=$(${MYSQL_CONN} extended-status | grep -w "Com_begin" | cut -d'|' -f3)
    echo $result
    ;;
  *)
    echo "Usage: $0(Uptime|Com_update|Slow_queries|Com_select|Com_rollback|Questions|Com_insert|Com_delete|Com_commit|Bytes_sent|Bytes_received|Com_begin)"
    ;;
esac
```

> 需要先在`/etc/my.cnf`中配置登录用户名和密码
>
> ```
> [mysqladmin]
> user=root
> password=redhat
> ```
>
> 且`mysqladmin status`的执行结果为
>
> ```
> # mysqladmin status
> Uptime: 4707  Threads: 1  Questions: 88227  Slow queries: 0  Opens: 91  Flush tables: 2  Open tables: 117  Queries per second avg: 18.743
> ```

然后将该脚本存放在`/etc/zabbix/shell`中，并修改执行权限以及用户权限为 zabbix

修改`/etc/zabbix/zabbix_agentd.d/userparameter_mysql.conf`，删除没有用或错误的

```
UserParameter=mysql.ping,HOME=/etc /usr/bin/mysqladmin ping 2>/dev/null | grep -c alive
UserParameter=mysql.status[*],/etc/zabbix/shell/check_mysql $1
UserParameter=mysql.version,/usr/bin/mysql -V
```

重启 agentd 后，在网页端进行配置

1. 添加主机，配置 host name 和 agent interfaces

   ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291824456.png)

2. 在主机配置中设置模板为`Template DB MySQL`

   ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291824780.png)

然后在 hosts 的 item 中查看是否全部启用

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291824916.png)

并在 Monitoring 的 Latest Data 查看数据

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291825748.png)

## 监控 Apache

在 zabbix agent 服务器上修改 httpd 的配置文件，添加以下内容，开启检查 httpd 的扩展功能

```
ExtendedStatus On   # 开启扩展的status查看功能
<location /server-status>   # 后面的脚本里就是获取这里的数据，若要改为别的，则还要修改脚本		SetHandler server-status
	Require ip 127.0.0.1 192.168.80.132     # 允许本地和zabbix server查看
</location>
```

下载 zabbix-apache 的监控脚本 www.ixdba.net/zabbix/zabbix-apache.zip

解压后有两个文件，一个是监控 apache 数据脚本 zapache，一个是监控模板 zapache-template.xml

赋予脚本执行权限`chmod 755 zapache`，并存放在`/etc/zabbix/shell`中，并非强制，只是便于管理。与 mysql 监控类似，需要在 agent 端配置文件`/etc/zabbix/zabbix-agentd.d/userparameter_apache.conf`，名字可任起。

```
UserParameter=zapache[*],/etc/zabbix/shell/zapache $1
```

然后重启 zabbix-agentd

在 zabbix web 上添加 zapache 的模板配置

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291825047.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291826240.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291826569.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291826914.png)

能在 LatestData 里查看配置的 item

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291826466.png)

## 监控 Nginx

在被监控主机上操作。配置文件添加

```
location /nginx-status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    allow 192.168.80.132;
    deny all;
}
```

编写 nginx 的监控脚本，可通过<http://www.ixdba.net/zabbix/zabbix-nginx.zip>下载

```shell
#!/bin/bash
HOST=127.0.0.1  # 要监控的apache主机
PORT=80         # 该主机的nginx端口

if [ $# -eq "0" ];then
    echo "Usage:$0(active|reading|writing|waiting|accepts|handled|requests|ping)"
fi

function active {
    /usr/bin/curl "http://$HOST:$PORT/nginx-status" 2>/dev/null | grep 'Active' | awk '{print $NF}'
}
function reading {
    /usr/bin/curl "http://$HOST:$PORT/nginx-status" 2>/dev/null | grep 'Reading' | awk '{print $2}'
}
function writing {
    /usr/bin/curl "http://$HOST:$PORT/nginx-status" 2>/dev/null | grep 'Writing' | awk '{print $4}'
}
function waiting {
    /usr/bin/curl "http://$HOST:$PORT/nginx-status" 2>/dev/null | grep 'Waiting' | awk '{print $6}'
}
function accepts {
    /usr/bin/curl "http://$HOST:$PORT/nginx-status" 2>/dev/null | awk NR==1 | awk '{print $1}'
}
function handled {
    /usr/bin/curl "http://$HOST:$PORT/nginx-status" 2>/dev/null | awk NR==2 | awk '{print $2}'
}
function requests {
    /usr/bin/curl "http://$HOST:$PORT/nginx-status" 2>/dev/null | awk NR==3 | awk '{print $3}'
}
function ping {
    /sbin/pidof nginx | wc -l
}

$1
```

同样将该脚本放在`/etc/zabbix/shell`中，并赋予执行权限，修改所属用户为 zabbix

然后创建 zabbix agent 配置`/etc/zabbix/zabbix_agentd.d/userparameter_nginx.conf`

```
UserParameter=nginx.status[*],/etc/zabbix/shell/nginx-status.sh $1
```

并重启 agent 服务

下载模板配置 xml 文件<http://www.ixdba.net/zabbix/zabbix-nginx.zip>

然后同理导入模板

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291826888.png)

同理在主机上添加模板

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291826776.png)

去 Latest Data 中查看数据是否获取成功

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291826843.png)

## 监控 PHP-FTPM

修改 php 主机上的配置文件`/etc/php-fpm.d/www.conf`，找到`;pm.status_path = /status`取消注释，开启状态页

在 www 块下的一些内容

```
pm = dynamic  # php-fpm开启进程的方式，有static和dynamic

若为dynamic，则将初始进程数设为pm.start_servers的值，会动态增加删除，最大不超过pm.max_spare_servers的值，最小不超过pm.min_spare_servers 的值

若为static，则进程数始终为pm.max_children的值

pm.max_children = 50

pm.start_servers = 5

pm.min_spare_servers = 5

pm.max_spare_servers = 35

若服务器的内存大于16G，则推荐静态，否则推荐动态
```

在 nginx 配置文件中添加

```
location ~ ^/status$ {
   fastcgi_pass 127.0.0.1:9000;
   fastcgi_param  SCRIPT_FILENAME $fastcgi_script_name;
   include   fastcgi_params;
}
```

然后重启 nginx 和 php-fpm，再通过`localhost/status`访问查看

```
\# curl 127.0.0.1/status

pool:                 www             # fpm池子名

process manager:      dynamic    # 进程管理方式

start time:           26/Apr/2019:20:54:52 +0800

start since:          2        # 运行时长

accepted conn:        1       # 当前池子接收的请求数

listen queue:         0      # 请求等待队列

max listen queue:     0       #请求等待队列最高数量

listen queue len:     128     # socket等待队列长度

idle processes:       4        # 空闲进程数量

active processes:     1     # 活跃进程数量

total processes:      5     # 总进程数量

max active processes: 1        # 最大活跃进程数量（从fpm启动开始的）

max children reached: 0       # 达到进程最大数量限制的次数，若不为0，说明上一条可能有点小

slow requests:        0
```

若访问/status?xml 则会以 xml 格式输出

若访问/status?json 则会以 json 格式输出

可通过`curl -s "192.168.80.136/status?xml" | grep "accepted-conn" | awk -F '>|<' '{print $3}'` 获取监控值

因此在 `/etc/zabbix/zabbix_agentd.d/userparameter_phpfpm.conf`配置

```
UserParameter=php-fpm.status[*],/usr/bin/curl -s "http://localhost/status?xml" | grep "<$1>" | awk -F'<|>' '{print $$3}'
```

然后在<https://www.ixdba.net/zabbix/zbx_php-fpm_templates.zip>下载模板文件。同理在 web 中导入

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291826952.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291826388.png)

## 监控 Tomcat

需要在 zabbix_server 上启动 java poller 和 zabbix_java，zabbix_java 相当于一个 java gateway，端口号 10052，还需要在 java 服务器上开启 12345 端口。

zabbix 监控 java 的数据获取顺序：java poller——>java gateway:10052——>tomcat:12345

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291826431.jpeg)

java 主机配置 java 环境

centos7 安装 openjdk

`yum install java-1.8.0-openjdk` 安装 jre

`yum install java-1.8.0-openjdk-devel` 安装 jdk

```
# java -version
openjdk version "1.8.0_212"
OpenJDK Runtime Environment (build 1.8.0_212-b04)
OpenJDK 64-Bit Server VM (build 25.212-b04, mixed mode)

# javac -version
javac 1.8.0_212
```

配置环境变量

```
JAVA_HOME="/usr/lib/jvm/jre-1.8.0-openjdk-1.8.0.212.b04-0.el7_6.x86_64"
CLASSPATH="$JAVA_HOME/lib"
PATH="$JAVA_HOME/bin:​$PATH"
```

下载 tomcat9 <https://tomcat.apache.org/download-90.cgi#9.0.19>

赋予目录下 bin/中 sh 脚本执行权限，并执行`catalina.sh start`启动 tomcat，确认环境配置无问题，然后停止`catalina.sh stop`

配置 Tomcat JMX

JMX：JMX（Java Management Extensions，即 Java 管理扩展）是一个为应用程序、设备、系统等植入管理功能的框架。JMX 可以跨越一系列异构操作系统平台、系统体系结构和网络传输协议，灵活的开发无缝集成的系统、网络和服务管理应用。

修改 catalina.sh 脚本，添加

CATALINA_OPTS="-server -Xms256m -Xmx512m -XX:PermSize=64M -XX:MaxPermSize=128m -Dcom.sun.management.jmxremote -Dcom.sun.management.jmxremote.authenticate=false -Dcom.sun.management.jmxremote.ssl=false -Djava.rmi.server.hostname=192.168.80.132 -Dcom.sun.management.jmxremote.port=12345"

将 Djava.rmi.server.hostname 设为 zabbix server 的 IP 地址

默认 zabbix server 是没有 java 支持的，应该下载 zabbix-java-gateway

如果使用的 zabbix 的官方源，可直接`yum install zabbix-java-gateway`

安装后，会生成一个`/usr/sbin/zabbix_java_gateway`脚本，执行该脚本，开启 zabbix_java_gateway 服务，查看端口 10052 是否开启

修改 zabbix_server 的配置文件，取消以下参数注释，并重启 zabbix_server

```
JavaGateway=127.0.0.1
JavaGatewayPort=10052
StartJavaPollers=5
```

zabbix 默认有 tomcat 的模板，但有问题，先删掉，再重新导入<https://www.ixdba.net/zabbix/zbx_tomcat_templates.zip>

## 监控 Redis

Redis-cli 的获取信息命令

```
redis-cli  info  [参数]
若不填参数，则返回所有信息

可选参数：
server： redis的通用信息
clients：客户端连接信息
memory：内存消耗信息
persistence：持久化信息
stats：通用统计数据
replication：主从复制信息
cpu：CPU消耗数据
commandstats：redis命令统计信息
cluster：Redis集群信息
keyspace：数据库统计信息
```

在<https://www.ixdba.net/zabbix/zbx-redis-template.zip>下载脚本和模板

先检查脚本，确认配置参数正确。如果 redis 没有配置密码，则要修改脚本将\$PASS 删掉，否则会无法获取信息

```
#!/bin/bash
REDISCLI="/usr/local/bin/redis-cli"
HOST="127.0.0.1"
PORT=6379
PASS=""

if [[ $# == 1 ]];then
    case $1 in
        version)
            result=`$REDISCLI -h $HOST  -p $PORT info server | grep -w "redis_version" | awk -F':' '{print $2}'`
            echo $result
        ;;
        uptime)
            result=`$REDISCLI -h $HOST  -p $PORT info server | grep -w "uptime_in_seconds" | awk -F':' '{print $2}'`
            echo $result
        ;;
        connected_clients)
            result=`$REDISCLI -h $HOST  -p $PORT info clients | grep -w "connected_clients" | awk -F':' '{print $2}'`
            echo $result
        ;;
        blocked_clients)
            result=`$REDISCLI -h $HOST  -p $PORT info clients | grep -w "blocked_clients" | awk -F':' '{print $2}'`
            echo $result
        ;;
        used_memory)
            result=`$REDISCLI -h $HOST  -p $PORT info memory | grep -w "used_memory" | awk -F':' '{print $2}'`
            echo $result
        ;;
        used_memory_rss)
            result=`$REDISCLI -h $HOST  -p $PORT info memory | grep -w "used_memory_rss" | awk -F':' '{print $2}'`
            echo $result
        ;;
        used_memory_peak)
            result=`$REDISCLI -h $HOST  -p $PORT info memory | grep -w "used_memory_peak" | awk -F':' '{print $2}'`
            echo $result
        ;;
        used_memory_lua)
            result=`$REDISCLI -h $HOST  -p $PORT info memory | grep -w "used_memory_lua" | awk -F':' '{print $2}'`
            echo $result
        ;;
        used_cpu_sys)
            result=`$REDISCLI -h $HOST  -p $PORT info cpu | grep -w "used_cpu_sys" | awk -F':' '{print $2}'`
            echo $result
        ;;
        used_cpu_user)
            result=`$REDISCLI -h $HOST  -p $PORT info cpu | grep -w "used_cpu_user" | awk -F':' '{print $2}'`
            echo $result
        ;;
        used_cpu_sys_children)
            result=`$REDISCLI -h $HOST  -p $PORT info cpu | grep -w "used_cpu_sys_children" | awk -F':' '{print $2}'`
            echo $result
        ;;
        used_cpu_user_children)
            result=`$REDISCLI -h $HOST  -p $PORT info cpu | grep -w "used_cpu_user_children" | awk -F':' '{print $2}'`
            echo $result
        ;;
        rdb_last_bgsave_status)
            result=`$REDISCLI -h $HOST  -p $PORT info Persistence | grep -w "rdb_last_bgsave_status" | awk -F':' '{print $2}' | grep -c ok`
            echo $result
        ;;
        aof_last_bgrewrite_status)
            result=`$REDISCLI -h $HOST  -p $PORT info Persistence | grep -w "aof_last_bgrewrite_status" | awk -F':' '{print $2}' | grep -c ok`
            echo $result
        ;;
        aof_last_write_status)
            result=`$REDISCLI -h $HOST  -p $PORT info Persistence | grep -w "aof_last_write_status" | awk -F':' '{print $2}' | grep -c ok`
            echo $result
        ;;
        *)
            echo -e "\033[33mUsage: $0 {connected_clients|blocked_clients|used_memory|used_memory_rss|used_memory_peak|used_memory_lua|used_cpu_sys|used_cpu_user|used_cpu_sys_children|used_cpu_user_children|rdb_last_bgsave_status|aof_last_bgrewrite_status|aof_last_write_status}\033[0m"
        ;;
    esac
elif [[ $# == 2 ]];then
    case $2 in
        keys)
            result=`$REDISCLI -h $HOST  -p $PORT info | grep -w "$1" | grep -w "keys" | awk -F'=|,' '{print $2}'`
            echo $result
        ;;
        expires)
            result=`$REDISCLI -h $HOST  -p $PORT info | grep -w "$1" | grep -w "keys" | awk -F'=|,' '{print $4}'`
            echo $result
        ;;
        avg_ttl)
            result=`$REDISCLI -h $HOST  -p $PORT info | grep -w "$1" | grep -w "avg_ttl" | awk -F'=|,' '{print $6}'`
            echo $result
        ;;
        *)
            echo -e "\033[33mUsage: $0 {db0 keys|db0 expires|db0 avg_ttl}\033[0m"
        ;;
    esac
fi
```

创建配置文件`/etc/zabbix/zabbix_agentd.d/userparameter_redis.conf`

```
UserParameter=Redis.Info[*],/etc/zabbix/shell/redis_status $1 $2
UserParameter=Redis.Status,/usr/bin/redis-cli -h 127.0.0.1 -p 6379 ping|grep -c PONG
```

同理在 web 上导入模板文件，并添加到主机

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291827295.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291827815.png)

## zabbix 与微信整合

[进入企业微信网页](https://work.weixin.qq.com/) 按要求填写，并扫码

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291827000.png)

邀请成员

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291827656.png)

进入我的企业->微工作台，可复制下面的二维码，使成员通过微信关注微工作台，即可在微信中接收企业通知和使用企业应用，成员无需下载企业微信客户端。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291827193.png)

当成员关注了企业的微工作台，成员信息详情中的”微工作台“状态变为“已关注”。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291827634.png)

进入应用管理，创建应用

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291827042.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291827120.png)

创建完成后，应用主界面如下，需要注意 AgentID 和 Secret，需要配置到 zabbix 中

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291827767.png)

且“我的企业”中“企业信息”的“企业 ID” 也要注意，也要配置到 zabbix 中的。

下载微信告警脚本[下载地址](https://www.ixdba.net/zabbix/weixin_linux_amd64)，并添加执行权限，将脚本放在目录`/usr/lib/zabbix/alertscripts`，专门存放告警脚本的目录，将脚本改名成 weixin。
先测试脚本是否能用：

```
# 脚本参数：
Usage of /usr/lib/zabbix/alertscripts/weixin:
  -agentid string
        应用AgentID
  -author string
        http://www.oneoaas.com
  -corpid string
        企业ID
  -corpsecret string
        应用的Secret
  -msg string
        消息内容
  -user string
        要发给的用户账号，在用户详情页面的

# 测试：将网页上的参数带入
# /usr/lib/zabbix/alertscripts/weixin -agentid=1000002 -corpid=ww534be49f1c1ded73 -corpsecret=sCtXyz28Nfgaglf51qz9HUZ9MaHuB1TBQJLqEknKNzw -user=GuTianYi -msg="微信告警测试消息"

{"errcode":0,"errmsg":"ok","invaliduser":""}

# 查看手机微信，已获取
```

在 zabbix web 上配置微信告警。进入管理->媒介类型->创建媒介

> 若是 zabbix 是英语环境，则需要媒介名字为英文，否则添加不了。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291828991.png)

进入 Users，选择一个用于发监控的用户，配置媒介。
SendTo 填微信用户账号。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291828888.png)

进入 Actions，创建动作
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291828743.png)

添加操作

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291828031.png)

可修改消息内容

```
示例：
Problem started at {EVENT.TIME} on {EVENT.DATE}
Problem name: {EVENT.NAME}
Host: {HOST.NAME}
Host IP: {HOST.IP}
Item Name: {ITEM.NAME}
Item Value: {ITEM.LASTVALUE}
Severity: {EVENT.SEVERITY}
Trigger Name: {TRIGGER.NAME}
Current Status: {TRIGGER.STATUS}

Original problem ID: {EVENT.ID}
{TRIGGER.URL}
```

还可以通过 Recovery Operations 修改回复以后的通知

修改系统文件即可触发
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291828304.png)
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206291828575.png)

## zabbix 与 Logstash 整合

首先安装 LogStash，版本为 7.6
在`/usr/share/logstash/bin/logstash-plugin`，官方提供了 logstash 的插件管理器

```
logstash-plugin
  list
  install
  update
  remove
```

安装 logstash 的 zabbix 插件

```
/usr/share/logstash/bin/logstash-plugin install logstash-output-zabbix
```

创建配置文件`/etc/logstash/conf.d/zabbix.conf`

```
# input从/var/log/secure 读数据
input {
  file {
    path => ["/var/log/secure"]
    type => "system"
    start_position => "beginning"   # 从头开始读数据
  }
}

filter {
  grok {
    match => { "message" => "%{SYSLOGTIMESTAMP:message_timestamp} %{SYSLOGHOST:hostname} %{DATA:message_program}(?:\[%{POSINT:message_pid}\])?: %{GREEDYDATA:message_content}" }
    #这里通过grok对message字段的数据进行字段划分，这里将message字段划分了5个子字段。其中，message_content字段会在output中用到。
  }
  mutate {
    # 新增的字段，字段名是zabbix_key，值为oslogs。
    add_field => [ "[zabbix_key]", "oslogs" ]

    # 新增的字段，字段名是zabbix_host，值可以在这里直接定义，也可以引用字段变量来获取。
    # 这里的%{host}获取的就是日志数据的主机名，这个主机名与zabbix web中“主机名称”需要保持一致。
    add_field => [ "[zabbix_host]", "%{host}" ]
  }
  mutate { # 这里是删除不需要的字段
    remove_field => "@version"
    remove_field => "message"
  }
  date {
    # 这里是对日志输出中的日期字段进行转换，其中message_timestamp字段是默认输出的时间日期字段，将这个字段的值传给@timestamp字段。
    match => [ "message_timestamp","MMM d HH:mm:ss","MMM dd HH:mm:ss", "ISO8601"]
  }
}

output {
  if  [message_content]  =~ /(ERR|error|ERROR|Failed)/  {
    # 定义在message_content字段中，需要过滤的关键字信息
    # 也就是在message_content字段中出现给出的这些关键字，那么就将这些信息发送给zabbix。
    zabbix {
      #这个zabbix_host将获取上面filter部分定义的字段变量%{host}的值
      zabbix_host => "[zabbix_host]"
      zabbix_key => "[zabbix_key]"    #这个zabbix_key将获取上面filter部分中给出的值
      zabbix_server_host => "172.16.213.140"    #这是指定zabbix server的IP地址
      zabbix_server_port => "10051"    #这是指定zabbix server的监听端口
      zabbix_value => "message_content"
      # 这个很重要，指定要传给zabbix监控项item（oslogs）的值，zabbix_value默认的值是"message"字段
      # 因为上面已经删除了"message"字段，因此，这里需要重新指定，根据上面filter部分对"message"字段的内容划分
      # 这里指定为"message_content"字段，其实，"message_content"字段输出的就是服务器上具体的日志内容。
    }
  }
  # stdout { codec => rubydebug }
  # 这里是开启调试模式，当第一次配置的时候，建议开启
  # 这样过滤后的日志信息直接输出的屏幕，方便进行调试，调试成功后，即可关闭。
}
```

> 参考文章
>
> [zabbix 官方中文手册](https://www.zabbix.com/documentation/3.4/zh/manual)
>
> [51cto 专栏——无监控 不运维](#http://blog.51cto.com/cloumn/detail/33)
>
> [朱双印个人日志-zabbix](http://www.zsythink.net/archives/tag/zabbix/)

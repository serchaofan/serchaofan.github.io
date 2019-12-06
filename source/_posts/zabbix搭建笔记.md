---
title: zabbix搭建笔记
date: 2018-09-28 18:23:06
tags: [zabbix,监控,运维]
---

* [zabbix概述](#zabbix概述)
* [zabbix搭建](#zabbix搭建)
* [zabbix操作](#zabbix操作)



<!--more-->

# zabbix概述

Zabbix是一个企业级开源的分布式监控套件，可以监控网络和服务的监控状况。 

**zabbix组成**：`zabbix server`和`zabbix agent`

* Zabbix Server可通过SNMP、Zabbix_agent、ping、端口扫描等方法提供对远程服务器的监视

* Zabbix Agent安装在需要被监控的目录服务器上收集信息。监听端口10050

**zabbix核心组件：**

* zabbix server：收集agent的监控信息，对数据统计操作，设置配置。zabbix server可单独监控，也可与agent结合。可轮询agent主动接收监控数据，也可被动接收。监听端口10051
* zabbix databases：存储所有配置信息，以及监控数据。一般可以是：mysql，oracle，sqlite
* zabbix web GUI：通常与server运行在同一主机上（可在不同主机），用于可视化操作

**zabbix可选组件：**

* proxy：代理服务器，用于分布式监控环境，代理server接收agent的监控数据，汇总后统一发往server

* agent：被监控主机，收集本地数据

zabbix也可用于监控java应用，可基于JMX组件监控JVM

{% asset_img 1.png %}



**zabbix服务进程：**

* zabbix_agentd：zabbix agent的守护进程
* zabbix_server：zabbix server的守护进程
* zabbix_get：zabbix的一个工具，用于拉取远端客户端的信息，通常用于排错。需要安装zabbix-get
* zabbix_sender：zabbix的一个工具，用于主动推送数据给server或proxy，通常用于耗时较长的检查或大量主机监控的场景。需要安装zabbix-sender
* zabbix_proxy：zabbix proxy的守护进程。需要安装zabbix-proxy-mysql|pgsql|sqlite3
* zabbix_java_gateway：java网关，用于监控java应用环境，类似agentd。只能主动推送数据。

{% asset_img  1-1.png %}



**常用术语：**

* 监控项item：一个特定的监控指标的数据，**监控项是zabbix数据收集的核心**

* 触发器trigger：一个表达式，用于**评估某监控对象的某特定item内所接收的数据是否在合理范围内**，即阈值。当数据量大于阈值时，触发器状态从ok变为problem

* 事件event：发生的事情，如触发器状态的变化，新的agent或agent重新注册

* 动作action：指**对特定事件事先定义的处理方法**，包含操作与条件

* 报警升级escalation：发送警报或执行远程命令的自定义方案

* 媒介media：发送通知的手段或通道，如Email，jabber，SMS

* 通知notification：通过选定的媒介向用户发送的有关某事件的信息

* 远程命令：预定义的命令，可在被监控主机处于某特定条件下自动执行

* 模板template：用于快速定义被监控主机的预设条目集合，包含item，trigger，graph，screen（多个graph），application，low-level discovery rule。模板可以直接链接到单个主机

* 应用程序application：一组item的集合

* web场景web scennaria：用于检测web站点可用性的一个或多个http请求

{% asset_img 2.png %}



**Zabbix特点：**

* 配置简单：可使用模板，直接添加监控设备、可配置组监控、可对模板继承，进行精细设定
* 实时绘图，自定义监控图表（面板），支持网络拓扑图
* 灵活的告警机制：可自定义告警升级（escalation）、接受者和告警方式，还可通过远程命令实现自动化动作action
* 可进行不同类型数据的收集：性能、SNMP、IPMI、JMX，可自定义收集数据的间隔
* 数据存储：可将数据存放在数据库中，并内置数据清理机制
* 网络自动发现机制：自动发现网络设备、文件系统、网卡等，agent自动注册
* zabbix由C开发，高性能，内存消耗低。web前段由php编写
* 提供丰富的API
* 可进行权限认证，并进行访问控制



# zabbix搭建

**搭建zabbix监控服务器端**

zabbix需要LAMP或LNMP的环境，先安装以下环境`gcc gcc-c++ autoconf automake zlib zlib-devel openssl openssl-devel pcre-devel`

安装php环境：`yum install php php-fpm`

安装mysql/mariadb环境：`yum install mariadb*`

## LNMP/LAMP环境搭建Zabbix

可通过yum安装nginx，但版本不是最新的。通过源码安装nginx版本为1.14。

首先创建nginx用户及用户组。然后下载源码包并解压，进入目录

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

安装zabbix，首先去官网选择主机环境版本[下载页](https://www.zabbix.com/download)，安装zabbix的repo源。

````
rpm -i https://repo.zabbix.com/zabbix/4.0/rhel/7/x86_64/zabbix-release-4.0-1.el7.noarch.rpm 
````

然后安装`zabbix-server-mysql zabbix-web-mysql zabbix-agent zabbix-web`

若是客户端，不需要搭建LAMP或LNMP环境，只需要安装repo源和`zabbix-agent`和`zabbix-sender`，并且`zabbix-sender`也不是必须安装，若要主动向zabbix服务器发送监控数据时才需要安装。

zabbix的几个目录：

* `/etc/zabbix`：zabbix配置目录
* `/var/log/zabbix`：zabbix日志目录
* `/var/run/zabbix`：zabbix运行目录
* `/usr/lib/zabbix`：zabbix库文件目录
* `/usr/share/zabbix`：zabbix的web文件目录

修改nginx配置文件，找到下面配置，修改`fastcgi_param`后的路径为`/usr/share/zabbix`

```
location ~ \.php$ {
    root           html;
    fastcgi_pass   127.0.0.1:9000;
    fastcgi_index  index.php;
    fastcgi_param  SCRIPT_FILENAME  /usr/share/zabbix$fastcgi_script_name;
    include        fastcgi_params;
}
```

在mysql创建zabbix库，和管理数据库的用户zabbix

```
create database zabbixdb;
grant all on zabbixdb.* to zabbix@127.0.0.1 identified by 'zabbix';
flush privileges;
```

导入zabbix的sql文件，sql文件存放在`/usr/share/doc/zabbix-server-mysql-3.4.14/create.sql.gz`中，用`gunzip create.sql.gz`解压，然后导入`mysql -u root -p zabbixdb < create.sql`

修改`/etc/zabbix/zabbix_server.conf`

```
DBHost=localhost
DBName=zabbixdb
DBUser=zabbix
DBPassword=zabbix
```

安装zabbix后，会自动创建系统用户zabbix，但这个用户是设置了无法登录，而zabbix不允许。需要重新创建

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

启动zabbix_server服务`systemctl start zabbix-server.service`或`zabbix_server`启动

在apache或nginx配置文件中创建虚拟主机后，通过浏览器访问

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



根据网页提示，修改php配置文件`/etc/php.ini`

```
# 时区错误
date.timezone = Asia/Shanghai
```

全部修改完成后重启php-fpm和httpd。再次访问安装界面，完成安装。默认登录用户为`admin`，默认登录密码`zabbix`

{% asset_img 3.png %}



在监控主机上需要修改配置文件`/etc/zabbix/zabbix_agentd.conf`

```
最基本就只需要修改一项
Server = 监控服务器的IP地址
```

并且默认不能以root身份运行zabbix_agentd，可以修改配置文件

```
AllowRoot=1   # 是否允许root运行agentd，1为允许，0为不允许
或修改
User=zabbix   # 运行agentd的用户，需要取消注释
```

使用zabbix_get工具检查是否能获取数据

```
# zabbix_get -s 192.168.80.128 -p 10050 -k "system.uptime"
198526
```



# zabbix操作

* [监控一台主机](#监控一台主机)
* [详细配置操作](#详细配置操作)



## 监控一台主机

### 配置用户

> Administration --> Users

创建一个用户

{% asset_img 4.png %}

设置用户媒介（如何通知）

{% asset_img 5.png %}

[官方文档详细配置说明](https://www.zabbix.com/documentation/4.0/zh/manual/config/hosts/host)



### 配置主机

> Configuration --> Hosts

默认已存在一个主机Zabbix server，监控本机。在Create host添加新主机。

注：如果是虚拟机主机，则需要在同一个网段

{% asset_img 6.png %}



### 添加监控项

> Configuration --> Hosts --> Items --> create items

{% asset_img 7.png %}

有几个需要填写的项：

* Name：监控项名
* Key：监控项技术上的名称，即要获取的信息
* Type of information：信息类型，即数据格式，有Numeric（无符号/浮点）、character、log、text

[其他选项详情](https://www.zabbix.com/documentation/4.0/manual/config/items/item#configuration)

{% asset_img 8.png %}

第一次获得的监控项值最多需要60秒才能到达。然后，默认30秒更新一次，可通过Update interval修改

然后在Monitoring的Lateset data中添加显示的主机或主机组。然后在下面添加项的右侧Graph查看图像。

{% asset_img 9.png %}



### 新建触发器

> Configuration --> Hosts --> Triggers --> Create trigger 

触发器表达式可直接Add选择，也可手动编写，[触发器表达式语法](https://www.zabbix.com/documentation/4.0/manual/config/triggers/expression)

{% asset_img 10.png %}

可在Monitroing的Problems中添加问题报告的主机和触发器。

{% asset_img 11.png %}

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

* diff：返回值若为1表示最近的值与之前不同，0为无变化
* last：获取最近的值。需要指定参数#num，为最近的第num个值。例：last(#2)
* avg：返回一段时间的平均值。例：avg(5)为最近5秒的平均值，avg(#5)为最近五次的平均值，avg(3600,86400)为一天前的一个小时的平均值
* change：返回最近获得值与之前获得值的差值，返回字符串0表示相等，1表示不等。
* nodata：是否能接收到数据，返回1表示指定的间隔内未收到数据，0表示正常接收数据
* count：返回指定时间间隔内数值的统计
* sum：返回指定时间间隔中收集的值的总和。例：sum(600)表示600s内接收到所有值的和，sum(#5)表示最后5个值的和



### 设置通知

> Administration --> Media Types

zabbix中提供的几种媒介（Media）类型：

- Email：电子邮件
- SMS：手机短信，通过连接至zabbix服务器GSM Modem发送通知
- Jabber：jabber消息。Jabber是一个开放的基于XML的协议，能实现基于Internet的即时通讯服务
- 自定义脚本通知：调用位于配置文件的`AlertScriptsPath`变量定义的脚本目录中的脚本

{% asset_img 12.png %}



### 使用服务器本地邮箱发送报警邮件

首先安装mailx软件，直接yum安装即可。然后测试

```
echo "test" | mail -s "test" xxxx@qq.com
```



然后进入zabbix web的Administration中Media types新建一个媒介



一个媒体类型必须通过发送地址来关联用户，否则它将无法生效。

发送通知是Zabbix中动作（actions）执行的操作之一，因此为了建立一个通知，需要创建动作。

> Configuration --> Actions --> Create action

{% asset_img 14.png %}



### 新建模板

> Configuration --> Templates --> Create template

{% asset_img 17.png %}

在Configuration的Hosts中选择一个主机的item，并点击Copy进行复制，在复制界面选择目的模板

{% asset_img 19.png %}

通过此法向模板中添加监控项。

在Host的主机配置表中，选择Templates，然后添加模板，先点select选模板，然后add添加。

{% asset_img 20.png %}



### 新建图表

> Configuration --> Hosts --> Graphs --> Create graph

{% asset_img 15.png %}

* show legend：是否显示图例

* percentile line：是否显示百分位线，用作参考

* Graph type：有四种图表
  * Normal：普通线图

  * Stacked：堆图

    {% asset_img 16.png %}

  * Pie：饼图

  * Exploded：爆炸图（分裂的饼图）




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

可在Inventory中的Hosts查看配置的主机现有资产数据。

{% asset_img 21.png %}



### 批量更新

一次更改多个主机的某些属性。

> Configuration --> Hosts

选中多个主机，点下方的Mass update。

{% asset_img 22.png %}

Host选项卡：

* Replace host groups：从任何现有主机组中删除主机，并替换为该字段中指定的主机
* Add new or existing host groups：从现有主机组指定其他主机组
* Remove host groups：从主机中删除特定主机组

Templates选项卡：

* Link Templates：指定模板，可选择替换或添加。*Clear when unlinking*选项将不仅可以取消链接任何以前链接的模板，还可以删除所有继承自它们的元素（监控项、触发器等）。 



### Zabbix事件

事件是基于时间戳进行标记的，是采取动作的基础，来源于三个途径：

* 触发器事件：每次触发器状态改变就会生成相应事件
* 发现（discovery）事件：zabbix会周期性扫描网络发现规则中的指定IP范围，一旦发现主机或服务，就会生成发现事件
  * 有8类发现事件：Service Up，Service Down，Host Up，Host Down，Service Discovered，Service Lost，Host Discovered，Host Lost
* 主动agent自动发现事件：也称自动注册事件，当一个此前状态未知的主动agent发起检测请求时会生成该类事件

因此，Zabbix的通知机制也称为基于事件的通知机制。



### 触发器

当每次采集的数据超出了设置的触发器阈值，则触发器状态会变为**Problem**，若数据在范围之内，则触发器状态变为**OK**。

事件成功迭代（OK event generation）设置，用于控制如何生成正常事件（OK event）

- 表达式（Expression）：当表达式结果为FALSE，Problem会生成一个OK事件
- 恢复表达式（Recovery expression）：当表达式结果为FALSE，且恢复表达式结果为TRUE，Problem状态会变为OK事件。如果触发器的恢复条件和问题标准不同，则可以使用此设置。
- 无（None）：正常事件从来不生成。可以和多重问题事件生成一起结合使用，以便在某事件发生时可以更简单的发送通知。

事件成功关闭（OK event closes）设置，用来控制哪些问题事件（Problem events）被关闭

- 所有问题（All problems）：正常事件（OK event）将关闭触发器创建的所有打开的问题
- 所有问题如果标记的值匹配（All problems if tag values match）：正常事件（OK event）将关闭触发器创建的打开的问题，并且至少有一个匹配的标记值。

触发器的严重性：

* 未分类（Not classified）：未知严重性（灰）
* 信息（Information）：提示（浅蓝）
* 警告（Warning）：警告（黄）
* 一般严重（Average）：一般问题（橙）
* 严重（High）：发生重要的事（浅红）
* 灾难（Disaster）：灾难，财务损失（红）

触发器提示颜色可在Adminstration --> General --> Trigger severities中修改



事件关联是一种**设置自定义事件关闭（导致正常事件生成）的规则**，该规则定义了**新的问题事件如何与现有的问题事件配对，并通过生成相应的正常事件来关闭新的事件或匹配事件**。



### action



### 自动发现与自动注册

zabbix发现包括三种：

* 自动网络发现（network discovery）
* 主动客户端自动注册（active agent auto-registration）
* 低级别发现（low-level discovery）

zabbix网络发现基于的信息种类：

1. IP段自动发现
2. 可用外部信息（FTP、SSH、WEB、POP3等）
3. 从zabbix客户端收到的信息
4. 从SNMP客户端收到的信息



网络发现由两个步骤组成：发现（discovery）和动作（action）

zabbix会周期性扫描网络发现规则中的IP段，动作是对发现的主机进行设置的过程。



配置自动发现需在Coufiguration的Discovery配置。修改IP Range和Update interval，并添加Checks中选项，指定类型为zabbix agent，并指定键值，zabbix server会尝试去指定网段内的所有主机获取该值，若能获取则自动发现成功。

{% asset_img 23.png %}

配置自动发现动作在Configuration的Actions，选择右上角的事件源为discovery，然后创建action。

{% asset_img 24.png %}

进入配置后可修改计算方式、触发条件，或创建新的触发条件

{% asset_img 25.png %}

可进入Operations修改或添加操作

{% asset_img 26.png %}



自动注册用于Agent主动向Server注册，且主要适用于条件未知情况（agent的IP地址段或agent的操作系统信息等）。

配置客户端自动注册的步骤：

1. 在客户端配置文件中设置参数

   修改zabbix_agentd.conf，修改后重启zabbix-agentd服务

   ```
   Server=192.168.1.134  # 本机IP地址
   ServerActive=192.168.1.133   # 主动模式下，Zabbix Server的IP
   Hostname=KubeServer2   # 主机名，仅用于显示，不用和主机名一致
   HostMetadata=linux zabbix.kube2   # 元信息，用于标识识别
   ```

2. 在zabbix web中配置一个动作

   在Configuration中actions的选项auto-registration并创建

   {% asset_img 27.png %}

   然后直接配置condition，选择条件包含的内容

   {% asset_img 28.png %}

   继续配置operations，添加几个操作

   {% asset_img 29.png %}



### 低级别发现

Low-Level discovery（LLD）：当例如要对网卡进行监控时，由于网卡名可能以eth开头或enps开头，若分别针对不同网卡名设置会很繁琐，而使用LLD就可解决问题。

zabbix中支持的数据项发现：

* 文件系统发现
* 网络接口发现
* SNMP OID发现
* CPU核以及状态

zabbix自带的LLD key：

* `vfs.fs.discovery`：适用于zabbix agent监控方式
* `snmp.discovery`：适用于SNMP agent监控方式
* `net.if.discovery`：适用于zabbix agent监控
* `system.cpu.discovery`：适用于zabbix agent监控



可通过`zabbix_get`获取agent的数据，但不支持SNMP agent。

```
zabbix_get [options]
  -s 指定主机名或IP地址
  -p 指定agent上获取数据的端口，默认为10050
  -k 指定键
```



### 自定义监控项

agent的配置文件中`User parameters`用于设置定义项，可设置多个。

首先将`UnsafeUserParameters`设为1，启动自定义参数。然后设置自定义项

```
UserParameter=<key>, <shell command>
例：
UserParameter=ping, echo 1
```

可以在`/etc/zabbix/zabbix_agentd.d/`中创建配置文件专门配置自定义项。

若要让键能接收参数，只需要在键后添加`[*]`。例：`UserParameter=ping[*], echo $1`



## zabbix主动与被动模式

默认zabbix server会去每个agent上抓取数据，即Agentd被动模式。但当监控主机数量过大时，可能会导致web页面卡顿、监控告警不及时、图标显示终端等问题。

可通过两个方面优化：

1. 部署多个zabbix proxy，做分布式监控
2. 调整zabbix agent为主动模式



Agentd主动模式指：客户端收集本端监控信息后主动发给server。

修改客户端配置

```
StartAgents=3   # 指定agentd收集的数据往哪发。默认值为3。
# 若要开启主动模式，需要将该值设为0。
# 关闭被动模式后，agent的10050端口也会关闭
```

同时需要在server端修改配置，保证性能

```
StartPollers=5     # 减少主动收集数据的进程。默认为5，也可不改
StartTrappers=200  # 负责处理agentd推送数据的进程调大
```

然后需要在网页端配置，将监控类型从`zabbix agent`改为`zabbix agent(active)`

{% asset_img 30.png %}



# zabbix实战

## 监控MySQL

编写一个监控mysql的脚本check_mysql

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

然后将该脚本存放在`/etc/zabbix/shell`中，并修改执行权限以及用户权限为zabbix

修改`/etc/zabbix/zabbix_agentd.d/userparameter_mysql.conf`，删除没有用或错误的

```
UserParameter=mysql.ping,HOME=/etc /usr/bin/mysqladmin ping 2>/dev/null | grep -c alive
UserParameter=mysql.status[*],/etc/zabbix/shell/check_mysql $1
UserParameter=mysql.version,/usr/bin/mysql -V
```

重启agentd后，在网页端进行配置

1. 添加主机，配置host name和agent interfaces

   {% asset_img 31.png %}

2. 在主机配置中设置模板为`Template DB MySQL`

   {% asset_img 32.png %}

然后在hosts的item中查看是否全部启用

{% asset_img 33.png %}

并在Monitoring的Latest Data查看数据

{% asset_img 34.png %}



## 监控Apache

在zabbix agent服务器上修改httpd的配置文件，添加以下内容，开启检查httpd的扩展功能

```
ExtendedStatus On   # 开启扩展的status查看功能 
<location /server-status>   # 后面的脚本里就是获取这里的数据，若要改为别的，则还要修改脚本		SetHandler server-status
	Require ip 127.0.0.1 192.168.80.132     # 允许本地和zabbix server查看 
</location> 
```

下载zabbix-apache的监控脚本   www.ixdba.net/zabbix/zabbix-apache.zip 

解压后有两个文件，一个是监控apache数据脚本zapache，一个是监控模板zapache-template.xml

赋予脚本执行权限`chmod 755 zapache`，并存放在`/etc/zabbix/shell`中，并非强制，只是便于管理。与mysql监控类似，需要在agent端配置文件`/etc/zabbix/zabbix-agentd.d/userparameter_apache.conf`，名字可任起。

```
UserParameter=zapache[*],/etc/zabbix/shell/zapache $1 
```

然后重启zabbix-agentd 

在zabbix web上添加zapache的模板配置

{% asset_img 37.png %}

{% asset_img 38.png %}

{% asset_img 39.png %}

{% asset_img 40.png %}

能在LatestData里查看配置的item

{% asset_img 41.png %}



## 监控Nginx

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

编写nginx的监控脚本，可通过<http://www.ixdba.net/zabbix/zabbix-nginx.zip>下载

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

同样将该脚本放在`/etc/zabbix/shell`中，并赋予执行权限，修改所属用户为zabbix

然后创建zabbix agent配置`/etc/zabbix/zabbix_agentd.d/userparameter_nginx.conf `

```
UserParameter=nginx.status[*],/etc/zabbix/shell/nginx-status.sh $1
```

并重启agent服务



下载模板配置xml文件<http://www.ixdba.net/zabbix/zabbix-nginx.zip>

然后同理导入模板

{% asset_img 42.png %}

同理在主机上添加模板

{% asset_img 43.png %}

去Latest Data中查看数据是否获取成功

{% asset_img 44.png %}



## 监控PHP-FTPM

修改php主机上的配置文件`/etc/php-fpm.d/www.conf`，找到`;pm.status_path = /status`取消注释，开启状态页

在www块下的一些内容

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

在nginx配置文件中添加

```
location ~ ^/status$ {
   fastcgi_pass 127.0.0.1:9000;
   fastcgi_param  SCRIPT_FILENAME $fastcgi_script_name;
   include   fastcgi_params;
}
```

然后重启nginx和php-fpm，再通过`localhost/status`访问查看

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

若访问/status?xml  则会以xml格式输出

若访问/status?json则会以json格式输出



可通过`curl -s "192.168.80.136/status?xml" | grep "accepted-conn" | awk -F '>|<' '{print $3}' ` 获取监控值

因此在 `/etc/zabbix/zabbix_agentd.d/userparameter_phpfpm.conf`配置

```
UserParameter=php-fpm.status[*],/usr/bin/curl -s "http://localhost/status?xml" | grep "<$1>" | awk -F'<|>' '{print $$3}'
```

然后在<https://www.ixdba.net/zabbix/zbx_php-fpm_templates.zip>下载模板文件。同理在web中导入

{% asset_img 45.png %}

{% asset_img 46.png %}



## 监控Tomcat

需要在zabbix_server上启动java poller和zabbix_java，zabbix_java相当于一个java gateway，端口号10052，还需要在java服务器上开启12345端口。

zabbix监控java的数据获取顺序：java poller——>java gateway:10052——>tomcat:12345

{% asset_img 47.jpeg %}

java主机配置java环境

centos7  安装openjdk

`yum install java-1.8.0-openjdk`   安装jre

`yum install java-1.8.0-openjdk-devel`  安装jdk

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

下载tomcat9   <https://tomcat.apache.org/download-90.cgi#9.0.19>

赋予目录下bin/中sh脚本执行权限，并执行`catalina.sh start`启动tomcat，确认环境配置无问题，然后停止`catalina.sh stop`



配置Tomcat JMX

JMX：JMX（Java Management Extensions，即Java管理扩展）是一个为应用程序、设备、系统等植入管理功能的框架。JMX可以跨越一系列异构操作系统平台、系统体系结构和网络传输协议，灵活的开发无缝集成的系统、网络和服务管理应用。

修改catalina.sh脚本，添加

CATALINA_OPTS="-server -Xms256m -Xmx512m -XX:PermSize=64M -XX:MaxPermSize=128m -Dcom.sun.management.jmxremote -Dcom.sun.management.jmxremote.authenticate=false -Dcom.sun.management.jmxremote.ssl=false -Djava.rmi.server.hostname=192.168.80.132 -Dcom.sun.management.jmxremote.port=12345"

将Djava.rmi.server.hostname设为zabbix server的IP地址



默认zabbix server是没有java支持的，应该下载zabbix-java-gateway

如果使用的zabbix的官方源，可直接`yum install zabbix-java-gateway`

安装后，会生成一个`/usr/sbin/zabbix_java_gateway`脚本，执行该脚本，开启zabbix_java_gateway服务，查看端口10052是否开启

修改zabbix_server的配置文件，取消以下参数注释，并重启zabbix_server

```
JavaGateway=127.0.0.1 
JavaGatewayPort=10052
StartJavaPollers=5
```



zabbix默认有tomcat的模板，但有问题，先删掉，再重新导入<https://www.ixdba.net/zabbix/zbx_tomcat_templates.zip>



## 监控Redis

Redis-cli的获取信息命令

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

先检查脚本，确认配置参数正确。如果redis没有配置密码，则要修改脚本将$PASS删掉，否则会无法获取信息

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



创建配置文件`/etc/zabbix/zabbix_agentd.d/userparameter_redis.conf `

```
UserParameter=Redis.Info[*],/etc/zabbix/shell/redis_status $1 $2
UserParameter=Redis.Status,/usr/bin/redis-cli -h 127.0.0.1 -p 6379 ping|grep -c PONG
```

同理在web上导入模板文件，并添加到主机

{% asset_img 48.png %}

{% asset_img 49.png %}



## ansible部署zabbix



## zabbix与微信整合



## zabbix与ELK整合









# 参考文章

* [zabbix官方中文手册](https://www.zabbix.com/documentation/3.4/zh/manual)
* [51cto专栏——无监控 不运维](#http://blog.51cto.com/cloumn/detail/33)
* [朱双印个人日志-zabbix](http://www.zsythink.net/archives/tag/zabbix/)
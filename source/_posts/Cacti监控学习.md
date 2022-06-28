---
title: Cacti监控学习
date: 2018-09-15 11:27:44
tags: [Cacti, 运维, 监控, server]
categories: [系统运维]
---

本篇笔记包含以下内容：

- [Cacti 原理与安装](#cacti-原理与安装)
  - [Cacti 安装](#cacti-安装)
- [参考文章](#参考文章)

<!-- more -->

# Cacti 原理与安装

Cacti 是一套基于 PHP，MySQL，SNMP 及 RRDTool 开发的网络流量监测图形分析工具。使用 SNMP 服务获取数据，用 rrdtool 存储和更新数据，并可以使用 rrdtool 生成图表。因此 SNMP 和 RRDtool 是 Cacti 的关键。注意，**Cacti 仅仅是一个展示工具，是一个 PHP 网页，真正实现数据收集以及绘图的是 SNMP 和 RRDtool。**

MySQL 与 PHP 用来存储一些变量数据并对变量进行调用，如主机名、主机 IP、Snmp 团体名、端口号、模板信息等，Snmp 抓取的数据并不存放在 MySQL 中，而是存放在 rrdtool 生成的 RRD 文件中，rrdtool 对数据的更新和存储就是对 RRD 文件的处理，RRD 文件是大小固定的档案文件，能存储的数据量在创建时就被定义好了。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290238902.png)

**Cacti 特点：**

- 提供图形化页面操作实现`rrdtool create`命令
- 周期性执行能取得数据的命令，并将取回的数据存储在 rrd 文件中
- 通过 rrdtool 绘图并展示
- 强大的用户管理机制
- 丰富的插件库，如 thold，并提供插件框架允许自定义模板

Cacti 模板分为三类：

- 图形模板：定义图形的绘制
- 数据模板：定义如何获得数据，如何保存数据
- 主机模板：就是分好类的图形模板和数据模板，可直接应用于一个或一类主机

**SNMP 简介**

Simple Network Management Protocol 简单网络管理协议，由一组网络管理的标准组成，包含一个应用层协议、数据库模型（database schema）和一组资源对象。该协议能够支持网络管理系统，用以监测连接到网络上的设备是否有任何引起管理上关注的情况。

SNMP 管理的网络主要由三部分组成：

- 被管理的设备
- SNMP 代理（Agent）
- 网络管理系统（NMS）

三部分之间的关系：

- 网络中被管理的每一个设备都存在一个管理信息库（MIB）用于收集并储存管理信息。通过 SNMP 协议，NMS 能获取这些信息。被管理设备，又称为网络单元或网络节点，可以是支持 SNMP 协议的路由器、交换机、服务器或者主机等等。
- SNMP 代理是被管理设备上的一个网络管理软件模块，拥有本地设备的相关管理信息，并用于将它们转换成与 SNMP 兼容的格式，传递给 NMS。
- NMS 运行应用程序来实现监控被管理设备的功能。另外，NMS 还为网络管理提供大量的处理程序及必须的储存资源。

> 上述资料引用自百度百科 snmp

**RRDtool 简介**

Round Robin Database Tool 轮询式数据库工具，是一个强大的绘图的引擎。其中，`Round Robin`是一种存储数据的方式，使用固定大小的空间来存储数据，并有一个指针指向最新的数据的位置。RRDtool 针对处理的是时序型数据(time-series data)，比如网络带宽，温度，CPU 负载等等这些和时间相关联的数据或者说指标。

> 上述资料引用自百度百科 rrdtool 和[RRDtool 入门详解](https://www.cnblogs.com/yaoyao-start/p/5122289.html)

## Cacti 安装

首先需要搭建 LAMP 环境`yum install httpd php php-devel php-gd gd gd-devel gcc glibc openssl* mariadb* zlib* php-xml libxml libjpeg libpng freetype cairo-devel pango-devel`

> cairo 是一个 2D 图形库
>
> Pango 是一个用于布局和呈现文本的库
>
> gd 也是一个图形库，用于动态生成图片

```
yum install net-snmp \
            net-snmp-devel \
            net-snmp-utils \
            lm_sensors \
            rrdtool*
```

安装 snmp 主程序及相关监控工具。`net-snmp`会提供两个命令`snmpwalk`和`snmpget`

> `lm_sensors`：是一款基于 linux 系统的硬件监控的软件。可以监控主板，CPU 的工作电压，温度等数据。

开启`snmpd`和`snmptrapd`服务`systemctl start snmpd snmptrapd`

修改 snmp 配置文件`/etc/snmp/snmpd.conf`，找到`com2sec notConfigUser default public`一行，复制到下一行并修改

```
com2sec  myuser  127.0.0.1  mycommunity
# 127.0.0.1可配置为要监控的主机或网段
```

找到下面的 group 配置，同样复制一行并修改

```
group  mygroup  v2c  myuser
```

再下面，找到 view 配置，添加一行

```
view    all     included   .1
```

保存并重启 snmpd 服务。执行`snmpwalk -c mycommunity 127.0.0.1 -v2c`可看到大量信息。

注：如果是被监控主机，只需要安装`net-snmp`和`lm_sensors`即可。

cacti 安装完成后，会在`/etc/httpd/conf.d/`中生成一个`cacti.conf`配置文件，可以不用改动，文件中指定的网页存储位置为`/usr/share/cacti/`，该目录中存放着所有 php 网页。

cacti 的 sql 数据存放在`/usr/share/doc/cacti/cacti.sql`需要导入数据库。首先要进入 mariadb，创建数据库`cactidb`，退出后，`mysql -u root -p cactidb < /usr/share/doc/cacti/cacti.sql`导入数据库。

在数据库中创建用户管理`cactidb`，进入数据库`grant all on cactidb.* to cactiadmin@localhost identified by "cactiadmin";`并`flush privileges;`

设置 httpd 虚拟主机，使用户通过`cacti.example.com`直接访问

```
<VirtualHost *:80>
  ServerName cacti.example.com
  DocumentRoot "/usr/share/cacti"
  ErrorLog "log/cacti-access.log"
  CustomLog "log/cacti-error.log" common
</VirtualHost>
<Directory "/usr/share/cacti">
  Require all granted
  Options Indexes
  AllowOverride None
</Directory>
```

修改管理 Cacti 的配置文件`/usr/share/cacti/include/config.php`，修改以下内容：

```
$database_default  = 'cactidb';       设置数据库名
$database_username = 'cactiadmin';    设置数据库中cacti用户名
$database_password = 'cactiadmin';    设置数据库中cacti用户密码
$url_path = '/';     网页访问的路径，可改可不改，若不改就是通过http://localhost/cacti访问
```

创建普通用户用于周期性执行获取数据的 php 脚本，因为为了安全性，不能让管理员执行。`useradd cactiuser`，并且将`cacti`目录中`log`和`rra`目录的所属人和所属组都改为`cactiuser`，`chown -R cactiuser:cactiuser /usr/share/cacti/log /usr/share/cacti/rra`

至此，安装配置完毕，重启 Apache，浏览器输入`cacti.example.com`访问，开始网页配置。

若遇到以下报错：

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290239798.png)

说明 cacti 数据库管理员`cactiadmin`没有对`mysql.time_zone_name`表的`select`权限，需要授权。

```
grant select on mysql.time_zone_name to cactiadmin@localhost;
flush privileges;
```

并且要修改`/etc/my.cnf`配置，在`[mysqld]`下添加：

```
default-time-zone = '+8:00'
```

重启并进入 mysql，使用命令验证

```
show variables like '%time_zone%';
+------------------+--------+
| Variable_name    | Value  |
+------------------+--------+
| system_time_zone | CST    |
| time_zone        | +08:00 |
+------------------+--------+
```

**退出 MySQL，使用命令`mysql_tzinfo_to_sql tz_file tz_name | mysql -u root -p mysql`**

`tz_file`指 timezone 文件，存放在`/usr/share/zoneinfo`中

执行`mysql_tzinfo_to_sql /usr/share/zoneinfo/Asia/Shanghai Shanghai | mysql -u root -p mysql`

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290239565.png)

说明 php 的 timezone 没设置，修改`/etc/php.ini`，把`;date.timezone =`注释去除，设置为`date.timezone = Asia/Shanghai`。[支持的时区表](http://www.php.net/manual/zh/timezones.php)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290239615.png)

网页下拉还有类似的问题，需要修改 mysql 表中相应参数。修改`/etc/my.cnf`文件，在`[mysqld]`下添加报错项，只要满足即可。

```
max_heap_table_size=2048M
tmp_table_size=2048M
join_buffer_size=2048M
innodb_buffer_pool_size=2048M
innodb_doublewrite=off
innodb_flush_log_at_timeout=10
innodb_read_io_threads=32
innodb_write_io_threads=16
```

修改完后重启 php 和 mysql

```
systemctl restart mariadb.service
systemctl restart php-fpm.service
```

重新访问`cacti.example.com`。进入安装选项页面：

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290239126.png)

有两种选项：

```
New Primary Server：若是主节点就选这项
New Remote Poller：若是用于收集主节点无法访问的服务器的信息，就选这项
```

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290239108.png)

Cacti 的各个路径已自动设置好。由于 Spine 还没有安装，所以会提示错误，但不影响安装。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290239869.png)

安装模板，若为 Linux 或 unix 主机，必选`Local Linux Machine`，若为 Windows 主机，必选`Windows Device`。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290239428.png)

用户登录界面，初始的管理员用户名和密码都是`admin`，登陆后会强制要求更改。

**密码设置有几个条件必须满足：**

- 大于 8 位
- 含有字母大小写
- 至少包含一个数字
- 至少包含一个特殊字符

> **若想绕过这些规则，可直接进入 mysql 的 cactidb 库，执行`update user_auth set password = md5("密码") where username="admin";`**

然后就进入了 cacti 主界面。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290239517.png)

查看 Graph 页面，出现以下报错：

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290240987.png)

是因为没有运行`/usr/share/cacti/poller.php`，这个是 cacti 自带的脚本，用于收集数据，并生成图表。默认 cacti 每 5 分钟收集一次信息，所以要设置定时，每五分钟运行该脚本。而 cacti 安装后已生成一个文件`/etc/cron.d/cacti`，内容如下：若带有注释，就将注释去除，并要修改用户名。需要确定`crond`服务是否启动。

```
*/5 * * * * cactiuser /usr/bin/php /usr/share/cacti/poller.php > /dev/null 2>&1
```

最好通过`crontab -e -u cactiuser`输入`*/5 * * * * /usr/bin/php /usr/share/cacti/poller.php > /dev/null 2>&1`设置 cron。

先手动执行一次`php /usr/share/cacti/poller.php > /dev/null 2>&1`，可通过查看`/var/log/cacti/cacti.log`确认是否能获取数据。然后查看`/usr/share/cacti/rra/`是否有 rrd 文件。然后重启 httpd，访问 cacti 的 Graph。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290240367.png)

有可能没有启动的原因是系统时间和 BIOS 时间不符，通过`hwclock -s`同步。

# 参考文章

- Cacti 实战
- Linux 运维之道（第二版）
- 高性能网站构建实战
- [Cacti 完全使用手册 ( 让你快速个性化使用 Cacti )](https://www.cnblogs.com/nov5026/p/7486091.html)
- [服务器监控系统 cacti](http://blog.51cto.com/13555423/2068654)
- [cacti 安装与配置](http://www.tianfeiyu.com/?p=1620)
- [使用 SNMP 和 Cacti 监控 Linux 服务器 ](https://linux.cn/article-5746-1.html)

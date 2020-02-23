---
title: Centreon监控平台搭建笔记
date: 2018-12-24 09:04:56
tags: [Centreon, Ganglia]
categories: [系统运维]
---

- [Ganglia 与 Centreon 概述](#ganglia-%e4%b8%8e-centreon-%e6%a6%82%e8%bf%b0)
  - [统一运维监控平台设计](#%e7%bb%9f%e4%b8%80%e8%bf%90%e7%bb%b4%e7%9b%91%e6%8e%a7%e5%b9%b3%e5%8f%b0%e8%ae%be%e8%ae%a1)
- [Centreon 与 Ganglia 监控部署](#centreon-%e4%b8%8e-ganglia-%e7%9b%91%e6%8e%a7%e9%83%a8%e7%bd%b2)
- [参考文章](#%e5%8f%82%e8%80%83%e6%96%87%e7%ab%a0)

<!--more-->

# Ganglia 与 Centreon 概述

Ganglia 是一个为 HPC（高性能计算）集群而设计的可扩展的分布式监控系统，它可以监视和显示集群中的节点的各种状态信息，它由运行在各个节点上的 gmond 守护进程来采集 CPU 、内存、硬盘利用率、 I/O 负载、网络流量情况等方面的数据，然后汇总到 gmetad 守护进程下，使用 rrdtool 存储数据，最后将历史数据以曲线方式通过 PHP 页面呈现。Ganglia 监控系统有三部分组成，分别是 gmond、 gmetad、 webfrontend。

Ganglia 的特点：具有良好的扩展性、负载开销低、支持高并发、支持各种操作系统与虚拟机

{% asset_img 1.png %}

gmetad 可周期性去多个 gmond 节点收集数据，并且可以去其他 gmetad 收集数据。

Centreon 是一款开源的功能强大的分布式 IT 监控系统，它通过第三方组件可以实现对网络、操作系统和应用程序的监控。

它的底层采用 nagios 作为监控软件，同时 nagios 通过 ndoutil 模块将监控到的数据定时写入数据库中，而 Centreon 实时从数据库读取该数据并通过 Web 界面展现监控数据。可以通过 Centreon 管理和配置 nagios，或者说 Centreon 就是 nagios 的一个管理配置工具，通过 Centreon 提供的 Web 配置界面，可以轻松完成 nagios 的各种繁琐配置。

Centreon 由四部分组成：nagios、centstorage、centcore、ndoutils

- nagios 是 Centreon 的底层监控引擎，完成监控报警的各项功能。Centreon 也支持 Centreon Engine 或 Icinga 等监控引擎
- centstorage 是数据存储模块，用于将日志数据与 rrdtool 数据存储到数据库中
- centcore 是一个基于 perl 的守护进程，负责中心服务器（central server）和扩展节点（poller）间通信和数据同步，如远程对节点 nagios 的启动或关闭以及配置文件更新
- ndoutils 是连接 nagios 和数据库的工具，将 nagios 数据实时写入数据库

{% asset_img 4.png %}

Centreon web、centstorage、centcore、ndo2db 一般位于中心服务器，nagios 和 ndomod 可位于一台独立扩展节点，也可位于中心服务器。

数据通信流程：

1. Centreon web 是 Centreon 的 web 配置管理界面，配置完成后会生成相应配置文件
2. Centcore 会读取配置并结合 nagios 插件将数据发送到 nagios 引擎，并生成日志与 rrds 文件
   - 这步也可以直接 nagios 获取数据，由 centstorage 存入数据库
   - 也可以由 ndomod 进程将 nagios 的数据存入 ndo2db，然后 Centreon web 定期读取数据库
3. centstorage 模块收集这些日志和 rrds 数据存入数据库，供 Centreon web 调用

## 统一运维监控平台设计

要以**运行监控**和**故障报警**为重点，通过消除管理软件的差别、数据采集手段的差别，对不同数据来源实现统一管理、规范等操作。

{% asset_img 2.png %}

# Centreon 与 Ganglia 监控部署

先安装 ganglia。只要通过 epel 源就能安装。

在服务器端安装`ganglia`、`ganglia-devel`、`ganglia-gmetad`、`ganglia-gmond`、`ganglia-web`。客户端只要装`ganglia-gmond`即可。通过 yum 会自动安装依赖，如 rrdtool 等

服务器配置文件`/etc/ganglia/gmetad.conf`

```
data_source "cluster1" localhost         # 数据源，可添加多个客户端
# 格式：data_source  "名称" 拉取间隔（可选） 客户端IP:端口 客户端IP/域名 ....
# 若端口号不写，默认为8249
gridname "MyGrid"      # 网格名称，一个网格由多个服务器集群构成，每个服务器集群由data_source定义
setuid_username ganglia      # 启动用户
xml_port 8651                  # 客户端的数据汇总端口，默认为8651
rrd_rootdir "/var/lib/ganglia/rrds"   # 数据存放位置
interactive_port 8652        # gmetad回应请求的端口
```

客户端配置文件`/etc/ganglia/gmond.conf`

```
globals {
  daemonize = yes              # 是否后台运行
  setuid = yes                 # 是否设置运行用户
  user = ganglia               # 运行用户，默认为ganglia
  debug_level = 0              # 调试级别，默认为0（不输出任何日志）
  max_udp_msg_len = 1472
  mute = no             # 是否发送监控数据到其他节点
                        # no表示本节点将不再广播任何自己收集到的数据到网络上
  deaf = no             # 是否接收其他节点发来的数据，no表示不接收
  allow_extra_data = yes     # 是否发送扩展数据
  host_dmax = 86400         # 是否删除超时节点。若为0表示永不删除。其他则为无响应时间，超时就清除节点信息
  host_tmax = 20
  cleanup_threshold = 300   # gmond清理过期数据的时间
  gexec = no              # 是否使用gexec告知主机是否可用
  send_metadata_interval = 0      # 新添加的节点在多长时间内响应服务器（类似心跳）
                                  # 0为仅在gmond启动时通知
}

cluster {
  name = "cluster1"       # 集群名，要与data_source中的一项一致
  owner = "unspecified"      # 节点管理员
  latlong = "unspecified"    # 节点坐标（一般不用设）
  url = "unspecified"       # 节点url（一般不用设）
}

udp_send_channel {
  mcast_join = 239.2.11.71     # 指定发送的多播地址
  port = 8649       # 监听端口
  ttl = 1
}
```

Ganglia web 配置文件存放在`/usr/share/ganglia/conf_default.php`，需要改名为`conf.php`并存放在`/etc/ganglia/`下。

```
$conf['gweb_root'] = dirname(__FILE__);
$conf['gweb_confdir'] = "/var/lib/ganglia";       # ganglia web根目录
$conf['gmetad_root'] = "/var/lib/ganglia";        # ganglia 程序安装目录
$conf['rrds'] = "${conf['gmetad_root']}/rrds";    # ganglia web读取rrd数据库的路径
# 该目录权限需要修改为777，使rrdtool能够修改：chmod -R 777 /var/lib/ganglia/rrds

$conf['dwoo_compiled_dir'] = "${conf['gweb_confdir']}/dwoo/compiled";
$conf['dwoo_cache_dir'] = "${conf['gweb_confdir']}/dwoo/cache";
# 以上的两个路径需要设为777权限，否则ganglia web无法创建某些需要的文件
# 即：chmod -R 777 /var/lib/ganglia/dwoo

$conf['rrdtool'] = "/usr/bin/rrdtool";           # rrdtool的路径
$conf['graphdir']= $conf['gweb_root'] . '/graph.d';   # 生成图形模板目录
$conf['ganglia_ip'] = "127.0.0.1";       # gmetad服务所在服务器地址
$conf['ganglia_port'] = 8652;            # gmetad服务器的交互式提供监控数据发布端口
                               # 与gmetad.conf中的interactive_port一致
```

配置完成，在服务器端用`systemctl start gmetad.sercive`启动 gmetad，并在客户端上直接`gmond`启动客户端。

需要确认 PHP 环境已搭建。配置 httpd 的虚拟主机，将路径设为`/usr/share/ganglia`，重启 httpd 后通过设置的域名访问

{% asset_img 3.png %}

Ganglia 优势与注意：

- 可监控上万台服务器，延时在 10s 以内
- 分布式架构，易于机房扩展
- 可与 Centreon 整合，实现监控报警一体化
- 需要高性能磁盘，数据存储可能成为瓶颈

部署 Centreon。可以在[官网下载](https://download.centreon.com/)iso 直接类似虚拟机安装（包含了 centos 和 Centreon），或者配置 yum 源下载

```
[centreon]
name=centreon-el7-x86
baseurl="http://yum.centreon.com/standard/18.10/el7/stable/x86_64/"
enabled=1
gpgcheck=0
```

直接`yum install centreon*`

# 参考文章

- 高性能 LINUX 服务器构建实践：系统安全、故障排查、自动化运维与集群架构

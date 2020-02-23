---
title: SaltStack学习笔记
date: 2018-11-16 16:09:09
tags: [SaltStack, 运维, 自动化]
---

{% asset_img logo.svg %}

<!--more-->

- [Salt 概述](#salt-%e6%a6%82%e8%bf%b0)
  - [SaltStack 架构](#saltstack-%e6%9e%b6%e6%9e%84)
- [SaltStack 安装部署](#saltstack-%e5%ae%89%e8%a3%85%e9%83%a8%e7%bd%b2)
  - [Master 迁移](#master-%e8%bf%81%e7%a7%bb)
  - [returner](#returner)
    - [syslog](#syslog)
    - [mysql](#mysql)
  - [event](#event)
  - [分组](#%e5%88%86%e7%bb%84)
  - [常用模块](#%e5%b8%b8%e7%94%a8%e6%a8%a1%e5%9d%97)
    - [archive](#archive)
    - [cmd](#cmd)
    - [cp](#cp)
    - [cron](#cron)
    - [dnsutil](#dnsutil)
    - [file](#file)
    - [network](#network)
    - [pkg](#pkg)
    - [service](#service)
    - [status](#status)
    - [saltutil](#saltutil)
    - [state](#state)
    - [user](#user)
    - [group](#group)
    - [partition](#partition)
    - [system](#system)
    - [pillar](#pillar)
    - [nginx](#nginx)
    - [test](#test)
- [配置管理](#%e9%85%8d%e7%bd%ae%e7%ae%a1%e7%90%86)
  - [使用模板](#%e4%bd%bf%e7%94%a8%e6%a8%a1%e6%9d%bf)
  - [grains](#grains)
  - [pillar](#pillar-1)
  - [syndic](#syndic)
  - [Job](#job)
  - [Schedule](#schedule)
- [Salt SSH](#salt-ssh)

# Salt 概述

Salt 是一个配置管理系统，能够维护预定义状态的远程节点，是一个分布式远程执行系统，用来在远程节点上执行命令和查询数据。Salt 基于 Python 开发，提供大量 python 接口。底层使用 ZeroMQ 消息队列 pub/sub 方式通信。采用 RSA key 认证身份。

Salt 的核心功能

- 使命令发送到远程系统是**并行**的而不是串行的
- 使用安全加密的协议
- 使用最小最快的网络载荷
- 提供简单的编程接口

Salt 同样引入了更加细致化的领域控制系统来远程执行，使得系统成为目标不止可以通过主机名，还可以通过系统属性。

SaltStack 是围绕 Salt 开发的一系列技术栈，具有三大功能：

- 远程管理（Remote Execution）
- 配置管理（Config Management）
- 云管理（Cloud Management）

## SaltStack 架构

SaltStack 基于 C/S 架构，服务器端称为 Master，客户端称为 Minion。中间件使用的是 ZeroMQ。

Salt 的三种运行方式：1. Local 本地 2. Master/Minion（C/S 架构） 3. Salt SSH（无客户端）

# SaltStack 安装部署

先去[saltstack 官网下载源](https://repo.saltstack.com/)，选系统以及 python 版本对应的源，安装后再安装 salt 的所有部件

```
salt                # salt主程序
salt-api            # salt的REST API
salt-cloud          # salt云配置器
salt-minion         # salt的客户端部件
salt-master         # salt的管理部件
salt-ssh            # salt的无客户端版本，使用的是ssh通信
salt-syndic         # salt的master-of-master组件
```

安装完成后，使用`systemctl start salt-master`启动 salt 服务器端，同时会自动开启两个端口`4505`和`4506`。

- 4505：salt 的消息发布专用端口
- 4506：服务器与客户端通信的端口

可以通过`salt-master`命令管理 salt-master。

```
-c           # 指定配置文件
--saltfile   # 指定saltfile路径，若不指定，会在当前目录查找
-u           # 指定运行用户
-d           # 后台运行
--pid-file   # 指定pid文件
--log-level  # 指定日志等级（控制台）
--log-file   # 指定日志文件
--log-file-level  # 指定日志等级（日志文件）
```

在客户端上，只要安装`salt-minion`即可。安装完成后启动`systemctl start salt-minion`即可。

启动进程后，无论是 salt 的哪个部件，都会在`/var/log/salt/`中创建一个日志文件，名字就是组件名，如`master`、`minion`。

日志的默认级别为 warning，可通过 master 配置文件的`log_level`参数配置

在客户端配置文件中，找到参数`master`，配置的是服务器端的主机标识，默认叫`salt`，于是修改`/etc/hosts`，添加服务器端 IP 和标识 salt。

注意：客户端和服务器的防火墙一定要方形 4505 和 4506 端口，否则公钥无法传递。

在服务端查看日志，说明已经开始进行认证了，但此时认证没有通过。

```
[salt.transport.mixins.auth][INFO    ][32699] Authentication request from s4
[salt.transport.mixins.auth][INFO    ][32699] New public key for s4 placed in pending
[salt.transport.mixins.auth][INFO    ][32708] Authentication request from s3
[salt.transport.mixins.auth][INFO    ][32708] New public key for s3 placed in pending
```

在服务端上`salt-key -L`查看公钥

```
# salt-key -L
Accepted Keys:
Denied Keys:
Unaccepted Keys:
s3
s4
Rejected Keys:
```

添加这两个密钥即可`salt-key -a s3`和`salt-key -a s4`即可

在添加前，两个未认证的密钥是存放在`/etc/salt/pki/master/minions_pre`目录下的，在认证后，就会转移到`minions`目录下，并且客户端的`/etc/salt/pki/minion`目录中会生成 master 公钥`minion_master.pub`。

`salt-key`命令

```
-L     # 列出所有公钥
-a     # 允许指定的公钥
-A     # 允许所有公钥
-r     # 拒绝指定公钥
-R     # 拒绝所有公钥
-d     # 删除指定公钥
-D     # 删除所有公钥
```

注：当客户端启动 salt-minion 时，会自动将主机名写入到`/etc/salt/minion_id`中，并且还会生成`/etc/salt/pki/`中的密钥等参数，如果修改了主机名，一定要将该`minion_id`和`pki`目录都删除，然后重启 salt-minion。而且还要在 master 上删除该主机原来的 key，重新接受新的 key，再重启服务。一旦服务端与客户端的 key 不一致，客户端会自动停止 minion 进程。

测试是否与客户端正常通信

```
# salt "*" test.ping            # '*'是正则表达式，匹配所有通过认证的客户端
s4:
    True
s3:
    True
```

可以通过`salt '*' sys.doc`查看可用函数，或通过[网页](http://docs.saltstack.cn/ref/modules/all/index.html)查看

salt 命令匹配主机的常用参数

```
-E        # 正则匹配
-L        # 以主机id为列表匹配
-G        # 根据主机的grains信息匹配
-I        # 根据主机的pillar信息匹配
-N        # 根据master的配置文件中分组匹配
-C        # 根据条件运算符or\not\and匹配
-S        # 根据主机IP或子网匹配
-b        # 设置操作的minion的个数，可设置数字，或百分比（对于所有minion）
```

master 配置文件常用配置参数

```
interface: 0.0.0.0            # 网卡绑定的地址，一般保持默认即可
publish_port: 4505            # 发布端口，默认4505
user: root                    # 启动用户
ret_port: 4506                # 接收消息的端口，默认4506
max_open_files: 100000        # 最大同时打开文件数，尽量设大些
worker_threads: 5             # 启动的线程数，不得小于3
cachedir: /var/cache/salt/master  # 存储任务和缓存的目录
keep_jobs: 24                 # 执行命令结果的缓存时间
timeout: 5                    # salt命令或API的连接超时时间
job_cache: True               # master是否缓存任务执行结果，若管理主机超过5000台，最好换其他方式存储。
```

minion 配置文件常用配置参数

```
master: salt         # 设置master，可以是fqdn，或IP地址
retry_dns: 30        # 使用dns解析域名前等待的时间
master_port: 4506    # 向master发送结果信息的端口
cache_jobs: False    # 是否在本地缓存执行结果，默认不缓存，因为结果都发往master
backup_mode: minion  # 当文件改变时会对该文件备份
```

## Master 迁移

首先在原先的 Master 上将`/etc/salt/pki`目录打包`tar -cf pki.tar /etc/salt/pki`

将该 tar 包传到新的 Master 上的`/etc/salt/`中，然后解压。

在原 Master 上执行操作，更改 minion 客户端上的 hosts 文件。先查看一下客户端上原配置，然后修改为新的 MasterIP 地址。

```
# salt "*" cmd.run 'grep salt /etc/hosts'
s3:
    172.16.246.131    salt
s4:
    172.16.246.131   salt

# salt '*' cmd.run "sed -i 's/172.16.246.131/172.16.246.133/g' /etc/hosts"
s4:
s3:

# salt '*' cmd.run "grep salt /etc/hosts"
s4:
    172.16.246.133   salt
s3:
    172.16.246.133    salt
```

然后仍在原 master 上执行命令，重启客户端的 salt-minion

```
# salt '*' service.restart salt-minion
s3:
    True
s4:
    True
```

执行完成后，原 Master 已经无法对客户端操作了，在新的 Master 上测试。确保新 Master 上将两台主机的密钥接受了。使用`salt '*' test.ping`，操作成功，Master 迁移完成。

## returner

salt 客户端通过 returner 接口，向服务器端返回数据。在服务器端的 salt 命令可以添加参数`--return`决定将返回的数据存储在哪。[returner 列表](http://docs.saltstack.cn/ref/returners/all/index.html#all-salt-returners)

### syslog

将数据返回到主机操作系统的 syslog 工具。必需的 python 模块：syslog，json

syslog returner 只是重用操作系统的 syslog 工具来记录返回数据。

`salt '*' network.interfaces --return syslog`

在客户端上查看`/var/log/messages`，可看到信息返回为 json 格式。

```
s4 /salt-minion: {"return": {"ens33": {"up": true, "hwaddr": "00:0c:29:15:5f:47", "inet6": [{"scope": "link", "address": "fe80::905f:45b9:8486:c538", "prefixlen": "64"}], "inet": [{"label": "ens33", "netmask": "255.255.255.0", "address": "172.16.246.136", "broadcast": "172.16.246.255"}]}, "lo": {"up": true, "hwaddr": "00:00:00:00:00:00", "inet6": [{"scope": "host", "address": "::1", "prefixlen": "128"}], "inet": [{"label": "lo", "netmask": "255.0.0.0", "address": "127.0.0.1", "broadcast": null}]}}, "jid": "20181117111540048278", "success": true, "id": "s4", "fun": "network.interfaces", "retcode": 0, "fun_args": []}
```

### mysql

将数据返回到 mysql 中。需要服务器端有`pymysql`模块，客户端有 python 的 mysql 客户端模块。

master 和 minion 中有关于 returner 的配置，默认包含 mysql，但要启用仍然要配置。在 minion 的配置文件取消`return: mysql`注释，并添加以下参数

```
mysql.host: '172.16.246.133'
mysql.user: 'salt'
mysql.pass: 'salt'
mysql.db: 'salt'
mysql.port: '3306'
```

由于每台服务器都要和 mysql 连接，会使得 mysql 服务器的压力很大，在实际环境中不会这样调用。

## event

Salt Event System 是一个本地的 ZeroMQ pub interface，用于触发事件，使第三方应用程序或外部进程能够对 Salt 内的行为做出反应，发送信息通知 salt 或其他操作系统。

事件系统由两个主要组件组成：

- 发布事件的事件套接字（event sockets）。
- 事件库（event library）可以监听事件并将事件发送到 salt 系统。

每个 event 都有一个标签，事件标签允许快速置顶过滤事件，且每个 event 都有一个数据结构，是一个 dict 类型，包含事件的信息。

## 分组

master 配置文件中`nodegroups`块用于设置分组。也可以在`master.d/`中创建独立的 nodegroups 配置文件。

```YAML
#nodegroups:
#  group1: 'L@foo.domain.com,bar.domain.com,baz.domain.com or bl*.domain.com'
#  group2: 'G@os:Debian and foo.domain.com'
#  group3: 'G@os:Debian and N@group1'
#  group4:        # 列表写法，等同于 G@foo:bar or G@foo: baz
#    - 'G@foo:bar'
#    - 'or'
#    - 'G@foo:baz'
```

分组可设置的匹配规则

| Letter | 含义                                                    | 例                                         |
| ------ | ------------------------------------------------------- | ------------------------------------------ |
| G      | Grains glob 匹配                                        | `G@os: Ubuntu`                             |
| E      | PCRE minion id 匹配                                     | `E@web\d+\.(dev|qa|prod)\.loc`             |
| P      | Grains PCRE 匹配                                        | `P@os: (RedHat | Fedora | CentOS)`         |
| L      | minions 列表                                            | `L@minion1, minion2`                       |
| I      | Pillar glob 匹配                                        | `I@pdata: foobar`                          |
| S      | 子网/IP 匹配                                            | `S@192.168.1.0/24 or S@192.168.1.100`      |
| R      | Range Cluster 匹配                                      | `R@foo.bar`                                |
| D      | Minion Data 匹配                                        | `D@key: value`                             |
| C      | Compound 匹配（可匹配多种上面的匹配规则，称为混搭匹配） | `G@os: Ubuntu and I@pdata: foobar or web*` |

## 常用模块

可使用`sys.list_modules`列出所有可用模块，可使用`sys.doc`查看指定模块的用法

### archive

- `gunzip`：解压 gzip
- `gzip`：gzip 压缩
- `rar`：rar 压缩
- `unrar`：rar 解压
- `unzip`：zip 解压
- `zip`：zip 压缩
- `tar`：打包

```
salt '*' archive.gzip /tmp/file.gz /root/a.yml
salt '*' archive.gunzip /tmp/file.gz /root/
```

### cmd

- `run`：运行命令

```
salt '*' cmd.run 'free -m'
```

- `script`：执行脚本

### cp

- `get_dir`：
- `cache_file`：
- `cache_files`：
- `cache_local_file`：
- `cache_master`：
- `get_file`：
- `get_file_str`：
- `get_url`：

### cron

### dnsutil

### file

### network

### pkg

主机程序安装管理，能根据主机的系统使用不同的包管理工具。

- `install`：安装软件
- `remove`：卸载软件
- `upgrade`：升级软件
- `refresh_db`：检查 repos

### service

主机服务管理

- `enable`：开机自启
- `disable`：开机不自启
- `reload`：重载配置
- `restart`：重启
- `start`：启动
- `stop`：停止
- `status`：状态

### status

### saltutil

### state

### user

- ``

### group

### partition

### system

### pillar

### nginx

### test

# 配置管理

**配置管理（Configuration Management）**，也称组态管理，是一个建立系统工程的过程，用来建立和维持一个产品，使该产品的效能、功能及物理特性在生命周期中都保持稳定和一致性。Salt 的配置描述文件称为 sls 文件（**S**a**l**t **S**tate）。

State 结构：

- Top 文件，配置管理的入口文件，默认为`top.sls`。

- sls 的模块使用点分割。如`salt://apache/install.sls`或`salt://apache/install/init.sls`都可用`apache.install`表示。

  在 top.sls 中若指定了 apache，则在执行时会查找 state 根目录下 apache 目录中的`init.sls`，若找不到则找根目录下的`apache.sls`

- sls 文件间可用`include`或`extend`引用或扩展。

- sls 中 ID 必须唯一，ID 为 state 的名称。

[states 模块列表](http://docs.saltstack.cn/ref/states/all/index.html)

在 master 上查看配置文件`/etc/salt/master`中`file_roots`参数配置

```
file_roots:
  base:              # 基础版，一般只要base版就行
    - /srv/salt/     # 指定salt文件的根目录，需要先手动创建
  dev:               # 开发版
    - /srv/salt/dev/services
    - /srv/salt/dev/states
  prod:              # 生产版
    - /srv/salt/prod/services
    - /srv/salt/prod/states
```

在配置中还有一个`state_top`参数，Salt 在执行自定义 sls 配置时会根据该参数指定的 sls 文件（默认为`top.sls`）中的定义查找要执行的文件

首先在`/srv/salt/`中创建一个 sls 文件`top.sls`

```
base:     # 使用base版
  '*':    # 目标所有主机
    - apache   # 执行的sls文件名
```

然后创建`apache.sls`文件

```
apache-service:        # 功能块ID
  service.running:     # states模块
    - name: httpd      # 指定服务
    - enable: True     # 设置服务开机自启
    - reload: True     # 设置服务重载
```

执行`salt -L 's3' state.highstate`或`salt -L 's3' state.highstate salt://apache`或`salt -L 's3' state.highstate apache`

```
# salt -L 's3' state.highstate
s3:
----------
          ID: apache-service
    Function: service.running
        Name: httpd
      Result: True
     Comment: Service httpd is already enabled, and is running
     Started: 09:36:45.596459
    Duration: 143.647 ms
     Changes:
              ----------
              httpd:
                  True

Summary for s3
------------
Succeeded: 1 (changed=1)
Failed:    0
------------
Total states run:     1
Total run time: 143.647 ms
```

如果 sls 文件中的操作有依赖或先后关系，还可以在 sls 文件中指定以下参数：

- `require`：本 state 执行前需要先执行哪些 state
- `require_in`：
- `watch`：除了 require 外，也监测依赖的 state 状态，若状态发生变化，则做出反应
- `watch_in`：
- `prereq`：通过`test=True`检查所依赖的 state 状态，若状态发生变化，则执行
- `prereq_in`：

```
apache:       # statesID
  pkg.installed:
    - name: httpd
  file.managed:
    - name: /etc/httpd/conf/httpd.conf    # 目标文件
    - source: salt://httpd.conf           # 源文件
    - require:
      - pkg: apache         # 需要httpd已安装，apache为statesID
  service.running:
    - name: httpd
    - enable: True
    - reload: True
    - watch:                # 需要file和pkg同时满足要求
      - pkg: apache
      - file: apache
```

## 使用模板

修改`/srv/salt/`的配置文件`httpd.conf`。

```
Listen {{ http_port }}
ServerName {{ server_name }}
```

修改`apache.sls`的`file.managed`。

```
  file.managed:
    - name: /etc/httpd/conf/httpd.conf
    - source: salt://httpd.conf
    - require:
      - pkg: apache
    - template: jinja        # 指定模板的格式
    - context:
        http_port: 8080
        server_name: s3.example.com
```

然后执行，可看到修改信息

```
     Changes:
              ----------
              diff:
                  ---
                  +++
                  @@ -1,10 +1,10 @@
                   ServerRoot "/etc/httpd"
                  -Listen 81
                  +Listen 8080        # 替换了端口号
                   Include conf.modules.d/*.conf
                   User apache
                   Group apache
                   ServerAdmin root@localhost
                  -ServerName www.example.com:80
                  +ServerName s3.example.com       # 替换了主机域名
                   <Directory />
                       AllowOverride none
                       Require all denied
```

若有多台主机需要配置，则可以使用 Jinja 的 if 判断结合 grains

```
    - context:
        {% if grains['id'] == 's3' %}
        http_port: 81
        server_name: s3.example.com
        {% elif grains['id'] == 's4' %}
        http_port: 82
        server_name: s4.example.com
        {% endif %}
```

或者结合 pillar。先在`/srv/pillar/httpd.sls`中配置

```
apache:
  {% if grains.id == 's3' %}
  http_port: 81
  server_name: s3.example.com
  {% elif grains.id == 's4' %}
  http_port: 82
  server_name: s4.example.com
  {% endif %}
```

然后刷新`salt '*' saltutil.refresh_pillar`，并查看是否能获取

```
# salt '*' pillar.get apache
s4:
    ----------
    http_port:
        82
    server_name:
        s4.example.com
s3:
    ----------
    http_port:
        81
    server_name:
        s3.example.com
```

然后修改`/srv/salt/apache.sls`

```
- context:
  http_port: {{ salt['pillar.get']('apache:http_port', 80) }}
  # 若该项存在就使用该项的值，否则就用括号中另一个值
  server_name: {{ salt['pillar.get']('apache:server_name', 'www.example.com') }}
```

## grains

grains 是 Salt 的重要组件之一，用于收集客户端的信息，包括 CPU、内核、系统等。在 minion 上配置 Grains。

可在 master 上通过 grains 获取 minion 的信息。可用`salt '*' grains.ls`查看可选项

`grains.items`查看所有项与对应值，`grains.item ITEM`查看指定项的值

```
# salt -L 's3' grains.item os
s3:
    ----------
    os:
        CentOS
```

客户端自定义项与值，可以在 minion 的`/etc/salt/minion`配置文件中添加，也可以在`/etc/salt/minion.d/`中创建独立文件。修改完需要重启 minion 服务。

```
grains:
  roles:       # 自定义项
    - web      # 项的值
    - proxy
```

然后在 master 上查看`roles`项的值

```
# salt -L 's3' grains.item roles
s3:
    ----------
    roles:
        - web
        - proxy
```

还可以通过`grains.get`直接获取指定项的值

```
# salt -L 's3' grains.get roles
s3:
    - web
    - proxy
```

## pillar

Pillar 在 Master 上定义，功能类似 Grains，但比 Grains 更加灵活，能给特定的 minion 定义需要的数据。在 master 配置文件中的`pillar_roots`块。

```
#pillar_roots:        # pillar的根目录
#  base:
#    - /srv/pillar      # 需要手动创建
```

在`/srv/pillar`中创建`top.sls`

```
base:
  '*':
    - httpd
```

然后创建`httpd.sls`

```
httpd:
  function: state.sls
  args:
    - 'httpd'
```

使用命令`salt '*' saltutil.refresh_pillar`刷新 pillar，无须重启服务。

```
# salt -L 's3' pillar.data
s3:
    ----------
    httpd:
        ----------
        args:
            - httpd
        function:
            state.sls
```

**Grains 和 Pillar 的区别：**

- 用途不同：Grains 用于存储 Minion 的基本数据信息，Pillar 用于存储 Master 分配给 Minion 的数据信息
- 存储区域不同：Grains 元数据存储在 Minion 端，Pillar 元数据存储在 Master 端
- 更新方式不同：Grains 在 Minion 启动时更新或通过`saltutil.sync_grains`刷新，Pillar 元数据存储在 Master 端，可用`saltutil.refresh_pillar`刷新，更加灵活。

## syndic

syndic 是一个允许建立 salt 命令拓扑结构的工具，当两台 master 上都运行了 syndic，则高一级的 master 可以管理到另一台下的所有 minion，Master 的 Master 也称为**Master of Master**，syndic 常用于代理 proxy。

{% asset_img 2.png %}

加入一台新的 salt 主机，IP 地址为`172.16.246.134`，安装`salt-syndic`，然后在现 master（`172.16.246.158`）的 master 配置文件中找到`syndic_master`参数并修改。

```
syndic_master: 172.16.246.134       # 更高一级的Master的IP地址
syndic_log_file: /var/log/salt/syndic  # 日志文件路径，可不改
order_masters: True                # 更高一级的master能管理低等级的master的syndic接口，默认为False
```

master 和更高级别的 master 都要开启`salt-syndic`服务。在新 salt 主机上添加 master 的密钥，重启服务，然后测试。

```
# salt '*' service.restart httpd    # '*'能包含master所管理的minion和master本身。
sys1.example.com:
    True
s4:
    True
s3:
    True
```

## Job

Salt 的任务管理 job。当 Master 下发指令时，会附带产生的 jid（job id，格式`%Y%m%d%H%M%S%f`），Minion 在接收到指令后开始执行时，会在本地 cachedir（默认`/var/cache/salt/minion`下的`proc`目录）产生以该 jid 命名的文件，用于在执行完毕将结果传给 Master，并删除该临时文件。Master 会将结果存放在`/var/cache/salt/master/jobs`目录，默认缓存 24 小时，可通过 master 配置的`keep_jobs`修改。

可在`salt`命令后添加`-v`显示当前命令的 jid。在 master 上通过命令`salt-run jobs.list_jobs`查看已缓存的 job

`saltutil`中 job 的管理方法

- `running`：查看 minion 正在运行的 Jobs
- `find_job <jid>`：查看指定 jid 的 job
- `signal_job <jid> <signal>`：给指定 jid 进程发送信号
- `term_job <jid>`：终止指定 jid 进程，信号为 15
- `kill_job <jid>`：终止指定 jid 进程，信号为 9

也可通过命令`salt-run`查看 job

`salt-run jobs.active`：查看所有 Minion 当前正在运行的 jobs，即在所有 Minion 上运行`saltutil.running`

`salt-run jobs.lookup_jid <jid>`：查看指定 jid 进程的运行结果

`salt-run jobs.list_jobs`：列出当前 master 的 jobs cache 中的所有 jobs

## Schedule

用于在 Master 或 Minion 定期执行 Schedule 中配置的任务。Master 配置 Schedule 运行 runner，Minion 端配置 Schedule 为远程执行。可以在配置文件中或 pillar 中配置 Schedule。

在`/srv/pillar/`中创建 schedule 文件`schedule.sls`，并在`top.sls`中添加该文件，然后编写 Schedule。然后刷新 pillar。

```yaml
schedule:
  job1:
    function: cmd.run
    args:
      - "date >> /tmp/test.log"
    minutes: 1
```

可通过`salt-run jobs.list_jobs`查看所有 jobs。

# Salt SSH

Salt ssh 基于 ssh，无需 Zeromq 和 agent。salt 也为 ssh 构建了一个系统结构 Roster，为 salt ssh 提供需要连接的主机及权限信息。

Roster 的配置文件：`/etc/salt/roster`

```
salt ID:        # 配置target的ID
  host:         # 目标主机IP地址或域名
  user:         # 登录用户
  passwd:       # 用户密码
  sudo:         # 是否通过sudo执行，可选
  port:         # 连接目标的ssh端口
  priv:         # ssh私钥
  timeout:      # 等待回应的超时时间
```

> 参考文章
>
> [Saltstack 自动化运维工具详细介绍](http://blog.51cto.com/13558754/2063243)
>
> [SaltStack 学习](https://www.jianshu.com/p/624b9cf51c64)
>
> [saltstack 快速入门](https://www.cnblogs.com/wanghui1991/p/6285182.html)
>
> [Saltstack-部署](http://blog.51cto.com/jungiewolf/2096616)

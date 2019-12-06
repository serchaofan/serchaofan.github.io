---
title: SaltStack学习笔记
date: 2018-11-16 16:09:09
tags: [SaltStack, 运维, 自动化]
---

{% asset_img logo.svg %}

* [Salt概述](#Salt概述)
* [SaltStack安装部署](#SaltStack安装部署)
  * [Master迁移](#Master迁移)
  * [returner](#returner)
  * [event](#event)
  * [分组](#分组)
  * [常用模块](#常用模块)

<!--more-->

* [配置管理](#配置管理)
  * [grains](#grains)
  * [pillar](#pillar)
  * [syndic](#syndic)
  * [Job](#Job)
  * [Schedule](#Schedule)
* [Salt SSH](#Salt SSH)



# Salt概述

Salt是一个配置管理系统，能够维护预定义状态的远程节点，是一个分布式远程执行系统，用来在远程节点上执行命令和查询数据。Salt基于Python开发，提供大量python接口。底层使用ZeroMQ消息队列pub/sub方式通信。采用RSA key认证身份。

Salt的核心功能

- 使命令发送到远程系统是**并行**的而不是串行的
- 使用安全加密的协议
- 使用最小最快的网络载荷
- 提供简单的编程接口

Salt同样引入了更加细致化的领域控制系统来远程执行，使得系统成为目标不止可以通过主机名，还可以通过系统属性。

SaltStack是围绕Salt开发的一系列技术栈，具有三大功能：

* 远程管理（Remote Execution）
* 配置管理（Config Management）
* 云管理（Cloud Management）



## SaltStack架构

SaltStack基于C/S架构，服务器端称为Master，客户端称为Minion。中间件使用的是ZeroMQ。

Salt的三种运行方式：1. Local本地 2. Master/Minion（C/S架构） 3. Salt SSH（无客户端）











# SaltStack安装部署

先去[saltstack官网下载源](https://repo.saltstack.com/)，选系统以及python版本对应的源，安装后再安装salt的所有部件

```
salt                # salt主程序
salt-api            # salt的REST API
salt-cloud          # salt云配置器
salt-minion         # salt的客户端部件
salt-master         # salt的管理部件
salt-ssh            # salt的无客户端版本，使用的是ssh通信
salt-syndic         # salt的master-of-master组件
```

安装完成后，使用`systemctl start salt-master`启动salt服务器端，同时会自动开启两个端口`4505`和`4506`。

* 4505：salt的消息发布专用端口
* 4506：服务器与客户端通信的端口

可以通过`salt-master`命令管理salt-master。

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

启动进程后，无论是salt的哪个部件，都会在`/var/log/salt/`中创建一个日志文件，名字就是组件名，如`master`、`minion`。

日志的默认级别为warning，可通过master配置文件的`log_level`参数配置

在客户端配置文件中，找到参数`master`，配置的是服务器端的主机标识，默认叫`salt`，于是修改`/etc/hosts`，添加服务器端IP和标识salt。

注意：客户端和服务器的防火墙一定要方形4505和4506端口，否则公钥无法传递。

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

在添加前，两个未认证的密钥是存放在`/etc/salt/pki/master/minions_pre`目录下的，在认证后，就会转移到`minions`目录下，并且客户端的`/etc/salt/pki/minion`目录中会生成master公钥`minion_master.pub`。

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

注：当客户端启动salt-minion时，会自动将主机名写入到`/etc/salt/minion_id`中，并且还会生成`/etc/salt/pki/`中的密钥等参数，如果修改了主机名，一定要将该`minion_id`和`pki`目录都删除，然后重启salt-minion。而且还要在master上删除该主机原来的key，重新接受新的key，再重启服务。一旦服务端与客户端的key不一致，客户端会自动停止minion进程。

测试是否与客户端正常通信

```
# salt "*" test.ping            # '*'是正则表达式，匹配所有通过认证的客户端
s4:
    True
s3:
    True
```

可以通过`salt '*' sys.doc`查看可用函数，或通过[网页](http://docs.saltstack.cn/ref/modules/all/index.html)查看

salt命令匹配主机的常用参数

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

master配置文件常用配置参数

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

minion配置文件常用配置参数

```
master: salt         # 设置master，可以是fqdn，或IP地址
retry_dns: 30        # 使用dns解析域名前等待的时间
master_port: 4506    # 向master发送结果信息的端口
cache_jobs: False    # 是否在本地缓存执行结果，默认不缓存，因为结果都发往master
backup_mode: minion  # 当文件改变时会对该文件备份
```





## Master迁移

首先在原先的Master上将`/etc/salt/pki`目录打包`tar -cf pki.tar /etc/salt/pki`

将该tar包传到新的Master上的`/etc/salt/`中，然后解压。

在原Master上执行操作，更改minion客户端上的hosts文件。先查看一下客户端上原配置，然后修改为新的MasterIP地址。

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

然后仍在原master上执行命令，重启客户端的salt-minion

```
# salt '*' service.restart salt-minion
s3:
    True
s4:
    True
```

执行完成后，原Master已经无法对客户端操作了，在新的Master上测试。确保新Master上将两台主机的密钥接受了。使用`salt '*' test.ping`，操作成功，Master迁移完成。



## returner

salt客户端通过returner接口，向服务器端返回数据。在服务器端的salt命令可以添加参数`--return`决定将返回的数据存储在哪。[returner列表](http://docs.saltstack.cn/ref/returners/all/index.html#all-salt-returners)

### syslog

将数据返回到主机操作系统的syslog工具。必需的python模块：syslog，json

syslog returner只是重用操作系统的syslog工具来记录返回数据。

`salt '*' network.interfaces --return syslog`

在客户端上查看`/var/log/messages`，可看到信息返回为json格式。

```
s4 /salt-minion: {"return": {"ens33": {"up": true, "hwaddr": "00:0c:29:15:5f:47", "inet6": [{"scope": "link", "address": "fe80::905f:45b9:8486:c538", "prefixlen": "64"}], "inet": [{"label": "ens33", "netmask": "255.255.255.0", "address": "172.16.246.136", "broadcast": "172.16.246.255"}]}, "lo": {"up": true, "hwaddr": "00:00:00:00:00:00", "inet6": [{"scope": "host", "address": "::1", "prefixlen": "128"}], "inet": [{"label": "lo", "netmask": "255.0.0.0", "address": "127.0.0.1", "broadcast": null}]}}, "jid": "20181117111540048278", "success": true, "id": "s4", "fun": "network.interfaces", "retcode": 0, "fun_args": []}
```

### mysql

将数据返回到mysql中。需要服务器端有`pymysql`模块，客户端有python的mysql客户端模块。

master和minion中有关于returner的配置，默认包含mysql，但要启用仍然要配置。在minion的配置文件取消`return: mysql`注释，并添加以下参数

```
mysql.host: '172.16.246.133'
mysql.user: 'salt'
mysql.pass: 'salt'
mysql.db: 'salt'
mysql.port: '3306'
```



由于每台服务器都要和mysql连接，会使得mysql服务器的压力很大，在实际环境中不会这样调用。



## event

Salt Event System是一个本地的ZeroMQ pub interface，用于触发事件，使第三方应用程序或外部进程能够对Salt内的行为做出反应，发送信息通知salt或其他操作系统。

事件系统由两个主要组件组成：

* 发布事件的事件套接字（event sockets）。
* 事件库（event library）可以监听事件并将事件发送到salt系统。

每个event都有一个标签，事件标签允许快速置顶过滤事件，且每个event都有一个数据结构，是一个dict类型，包含事件的信息。



## 分组

master配置文件中`nodegroups`块用于设置分组。也可以在`master.d/`中创建独立的nodegroups配置文件。

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

| Letter | 含义                                                   | 例                                          |
| ------ | ------------------------------------------------------ | ------------------------------------------- |
| G      | Grains glob匹配                                        | `G@os: Ubuntu`                              |
| E      | PCRE minion id匹配                                     | `E@web\d+\.(dev|qa|prod)\.loc`              |
| P      | Grains PCRE匹配                                        | `P@os: (RedHat | Fedora | CentOS)`          |
| L      | minions列表                                            | `L@minion1, minion2`                        |
| I      | Pillar glob匹配                                        | `I@pdata: foobar`                           |
| S      | 子网/IP匹配                                            | `S@192.168.1.0/24 or S@192.168.1.100`       |
| R      | Range Cluster匹配                                      | `R@foo.bar`                                 |
| D      | Minion Data匹配                                        | `D@key: value`                              |
| C      | Compound匹配（可匹配多种上面的匹配规则，称为混搭匹配） | `G@os: Ubuntu and I@pdata: foobar or web* ` |



## 常用模块

可使用`sys.list_modules`列出所有可用模块，可使用`sys.doc`查看指定模块的用法

### archive

* `gunzip`：解压gzip
* `gzip`：gzip压缩
* `rar`：rar压缩
* `unrar`：rar解压
* `unzip`：zip解压
* `zip`：zip压缩
* `tar`：打包

```
salt '*' archive.gzip /tmp/file.gz /root/a.yml
salt '*' archive.gunzip /tmp/file.gz /root/
```



### cmd

* `run`：运行命令

```
salt '*' cmd.run 'free -m'
```

* `script`：执行脚本

### cp

* `get_dir`：
* `cache_file`：
* `cache_files`：
* `cache_local_file`：
* `cache_master`：
* `get_file`：
* `get_file_str`：
* `get_url`：





### cron





### dnsutil



### file



### network



### pkg

主机程序安装管理，能根据主机的系统使用不同的包管理工具。

* `install`：安装软件
* `remove`：卸载软件
* `upgrade`：升级软件
* `refresh_db`：检查repos

### service

主机服务管理

* `enable`：开机自启
* `disable`：开机不自启
* `reload`：重载配置
* `restart`：重启
* `start`：启动
* `stop`：停止
* `status`：状态

### status



### saltutil



### state



### user

* ``

### group



### partition



### system



### pillar





### nginx



### test



# 配置管理

**配置管理（Configuration Management）**，也称组态管理，是一个建立系统工程的过程，用来建立和维持一个产品，使该产品的效能、功能及物理特性在生命周期中都保持稳定和一致性。Salt的配置描述文件称为sls文件（**S**a**l**t **S**tate）。

State结构：

* Top文件，配置管理的入口文件，默认为`top.sls`。

* sls的模块使用点分割。如`salt://apache/install.sls`或`salt://apache/install/init.sls`都可用`apache.install`表示。

  在top.sls中若指定了apache，则在执行时会查找state根目录下apache目录中的`init.sls`，若找不到则找根目录下的`apache.sls`

* sls文件间可用`include`或`extend`引用或扩展。

* sls中ID必须唯一，ID为state的名称。

[states模块列表](http://docs.saltstack.cn/ref/states/all/index.html)

在master上查看配置文件`/etc/salt/master`中`file_roots`参数配置

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

在配置中还有一个`state_top`参数，Salt在执行自定义sls配置时会根据该参数指定的sls文件（默认为`top.sls`）中的定义查找要执行的文件

首先在`/srv/salt/`中创建一个sls文件`top.sls`

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

如果sls文件中的操作有依赖或先后关系，还可以在sls文件中指定以下参数：

* `require`：本state执行前需要先执行哪些state
* `require_in`：
* `watch`：除了require外，也监测依赖的state状态，若状态发生变化，则做出反应
* `watch_in`：
* `prereq`：通过`test=True`检查所依赖的state状态，若状态发生变化，则执行
* `prereq_in`：

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

若有多台主机需要配置，则可以使用Jinja的if判断结合grains

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

或者结合pillar。先在`/srv/pillar/httpd.sls`中配置

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

grains是Salt的重要组件之一，用于收集客户端的信息，包括CPU、内核、系统等。在minion上配置Grains。

可在master上通过grains获取minion的信息。可用`salt '*' grains.ls`查看可选项

`grains.items`查看所有项与对应值，`grains.item ITEM`查看指定项的值

```
# salt -L 's3' grains.item os
s3:
    ----------
    os:
        CentOS
```

客户端自定义项与值，可以在minion的`/etc/salt/minion`配置文件中添加，也可以在`/etc/salt/minion.d/`中创建独立文件。修改完需要重启minion服务。

```
grains:
  roles:       # 自定义项
    - web      # 项的值
    - proxy   
```

然后在master上查看`roles`项的值

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

Pillar在Master上定义，功能类似Grains，但比Grains更加灵活，能给特定的minion定义需要的数据。在master配置文件中的`pillar_roots`块。

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

使用命令`salt '*' saltutil.refresh_pillar`刷新pillar，无须重启服务。

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



**Grains和Pillar的区别：**

* 用途不同：Grains用于存储Minion的基本数据信息，Pillar用于存储Master分配给Minion的数据信息
* 存储区域不同：Grains元数据存储在Minion端，Pillar元数据存储在Master端
* 更新方式不同：Grains在Minion启动时更新或通过`saltutil.sync_grains`刷新，Pillar元数据存储在Master端，可用`saltutil.refresh_pillar`刷新，更加灵活。



## syndic

syndic是一个允许建立salt命令拓扑结构的工具，当两台master上都运行了syndic，则高一级的master可以管理到另一台下的所有minion，Master的Master也称为**Master of Master**，syndic常用于代理proxy。

{% asset_img 2.png %}

加入一台新的salt主机，IP地址为`172.16.246.134`，安装`salt-syndic`，然后在现master（`172.16.246.158`）的master配置文件中找到`syndic_master`参数并修改。

```
syndic_master: 172.16.246.134       # 更高一级的Master的IP地址
syndic_log_file: /var/log/salt/syndic  # 日志文件路径，可不改
order_masters: True                # 更高一级的master能管理低等级的master的syndic接口，默认为False
```

master和更高级别的master都要开启`salt-syndic`服务。在新salt主机上添加master的密钥，重启服务，然后测试。

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

Salt的任务管理job。当Master下发指令时，会附带产生的jid（job id，格式`%Y%m%d%H%M%S%f`），Minion在接收到指令后开始执行时，会在本地cachedir（默认`/var/cache/salt/minion`下的`proc`目录）产生以该jid命名的文件，用于在执行完毕将结果传给Master，并删除该临时文件。Master会将结果存放在`/var/cache/salt/master/jobs`目录，默认缓存24小时，可通过master配置的`keep_jobs`修改。

可在`salt`命令后添加`-v`显示当前命令的jid。在master上通过命令`salt-run jobs.list_jobs`查看已缓存的job

`saltutil`中job的管理方法

* `running`：查看minion正在运行的Jobs
* `find_job <jid>`：查看指定jid的job
* `signal_job <jid> <signal>`：给指定jid进程发送信号
* `term_job <jid>`：终止指定jid进程，信号为15
* `kill_job <jid>`：终止指定jid进程，信号为9

也可通过命令`salt-run`查看job

`salt-run jobs.active`：查看所有Minion当前正在运行的jobs，即在所有Minion上运行`saltutil.running`

`salt-run jobs.lookup_jid <jid>`：查看指定jid进程的运行结果

`salt-run jobs.list_jobs`：列出当前master的jobs cache中的所有jobs



## Schedule

用于在Master或Minion定期执行Schedule中配置的任务。Master配置Schedule运行runner，Minion端配置Schedule为远程执行。可以在配置文件中或pillar中配置Schedule。

在`/srv/pillar/`中创建schedule文件`schedule.sls`，并在`top.sls`中添加该文件，然后编写Schedule。然后刷新pillar。

```yaml
schedule: 
  job1:
    function: cmd.run
    args: 
      - "date >> /tmp/test.log"
    minutes: 1
```

可通过`salt-run jobs.list_jobs`查看所有jobs。



# Salt SSH

Salt ssh基于ssh，无需Zeromq和agent。salt也为ssh构建了一个系统结构Roster，为salt ssh提供需要连接的主机及权限信息。

Roster的配置文件：`/etc/salt/roster`

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
> [SaltStack学习](https://www.jianshu.com/p/624b9cf51c64)
>
> [saltstack快速入门](https://www.cnblogs.com/wanghui1991/p/6285182.html)
>
> [Saltstack-部署](http://blog.51cto.com/jungiewolf/2096616)


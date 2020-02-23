---
title: Nagios监控搭建
date: 2018-05-31 11:56:48
tags: [运维, 监控, Nagios]
categories: [应用运维]
---

本篇包含以下内容

- [Nagios 概述](#nagios-%e6%a6%82%e8%bf%b0)
- [Nagios 搭建](#nagios-%e6%90%ad%e5%bb%ba)
  - [服务器端](#%e6%9c%8d%e5%8a%a1%e5%99%a8%e7%ab%af)
  - [客户端安装](#%e5%ae%a2%e6%88%b7%e7%ab%af%e5%ae%89%e8%a3%85)
  - [目录与配置文件概述](#%e7%9b%ae%e5%bd%95%e4%b8%8e%e9%85%8d%e7%bd%ae%e6%96%87%e4%bb%b6%e6%a6%82%e8%bf%b0)
    - [templates.cfg](#templatescfg)
    - [resource.cfg](#resourcecfg)
    - [Nagios 宏](#nagios-%e5%ae%8f)
    - [commands.cfg](#commandscfg)
    - [hosts.cfg](#hostscfg)
    - [services.cfg](#servicescfg)
    - [contacts.cfg](#contactscfg)
    - [timeperiods.cfg](#timeperiodscfg)
    - [cgi.cfg](#cgicfg)
    - [nagios.cfg](#nagioscfg)
  - [Nagios 监控界面解析](#nagios-%e7%9b%91%e6%8e%a7%e7%95%8c%e9%9d%a2%e8%a7%a3%e6%9e%90)
    - [常用操作](#%e5%b8%b8%e7%94%a8%e6%93%8d%e4%bd%9c)
  - [Nagios 性能分析图表](#nagios-%e6%80%a7%e8%83%bd%e5%88%86%e6%9e%90%e5%9b%be%e8%a1%a8)
  - [邮件告警配置](#%e9%82%ae%e4%bb%b6%e5%91%8a%e8%ad%a6%e9%85%8d%e7%bd%ae)
- [参考资料](#%e5%8f%82%e8%80%83%e8%b5%84%e6%96%99)

<!-- more -->

**基于 Nagios4.4.1，Nagios-Plugin2.2.1**

## Nagios 概述

Nagios 是一款用于监控系统和网络的开源应用软件，能有效的监控 windows，linux 和 unix 的主机状态。采用 C/S 结构。Nagios 由 ANSI C 编写。

**Nagios 结构**
分为 Nagios Core 核心主程序和 Nagios Plugins 插件。核心只提供很少的监控功能，用户需要给 Nagios 安装相应插件以搭建完善的监控系统。

{% asset_img jiegou.png %}

**Nagios 如何工作**

- 监控：监控关键 IT 基础架构组件，包括系统指标，网络协议，应用程序，服务，服务器和网络基础架构。
- 告警：在关键基础架构组件发生故障和恢复时发送警报，为管理员提供重要事件的通知。警报可以通过电子邮件，短信或自定义脚本提供。
- 响应：IT 人员可以确认警报并开始解决中断并立即调查安全警报。如果未及时确认警报，则警报可以升级到不同的组。
- 报告：报告提供中断，事件，通知和警报响应的历史记录，供以后查看。
- 维护：计划停机可防止在计划维护和升级窗口期间发出警报。
- 计划：通过趋势和容量规划图表和报告，运维人员可以在发生故障之前识别必要的基础架构升级。

**Nagios 特点**

- 网络服务监控（SMTP、POP3、HTTP、NNTP、ICMP、SNMP、FTP、SSH、端口，URL，丢包，进程数，网络流量、交换机端口流量，路由器，打印机）
- 本地和远端主机资源监控（CPU、内存、磁盘、日志、负载 uptime、I/O，Raid 级别，温度，passwd 文件的变化，本地所有文件指纹识别），也包括 Windows 主机（使用 NSClient++ plugin）
- 业务数据监控（用户登陆失败次数，用户登陆网站次数，输入验证码失败次数，某个 API 接口流量并发，网站订单，支付交易数量）
- 可以指定自己编写的 Plugin 通过网络收集数据来监控任何情况（温度、警告……）。可以通过配置 Nagios 远程执行插件远程执行脚本
- 远程监控支持 SSH 或 SSL 加通道方式进行监控
- 简单的 plugin 设计允许用户很容易的开发自己需要的检查服务，支持很多开发语言（shell scripts、C++、Perl、ruby、Python、PHP、C#等）
- 包含很多图形化数据 Plugins（Nagiosgraph、Nagiosgrapher、PNP4Nagios 等）
- 可并行服务检查
- 能够定义网络主机的层次，允许逐级检查，就是从父主机开始向下检查
- 当服务或主机出现问题时发出通告，可通过 email, pager, sms 或任意用户自定义的 plugin 进行通知
- 能够自定义事件处理机制重新激活出问题的服务或主机
- 自动日志循环
- 支持冗余监控
- 包括 Web 界面可以查看当前网络状态，通知，问题历史，日志文件等

**Nagios 插件概述**
默认搭建的 Nagios 服务器只能监控简单的几个项目，而其他服务之类的监控项目都是需要插件来实现，插件可用官方提供的，也可以自己编写。插件是 Nagios Core 的独立扩展，可以使用 Core 监控任何事情。
插件处理命令行参数，执行特定检查，然后将结果返回给 Nagios Core。它们可以是编译的二进制文件（用 C，C ++等编写）或可执行的脚本（shell，Perl，PHP 等）。

**NRPE 概述**
NRPE 总共由两部分组成:

- check_nrpe 插件，位于监控主机上
- NRPE daemon，运行在远程被监控的 Linux 主机上

当监控远程主机服务或资源时，工作流程如下：

1. nagios 会运行 check_nrpe 插件并指定检查项
2. check_nrpe 插件会通过 ssl 连接到远程的 NRPE daemon
3. NRPE daemon 会运行相应的 Nagios 插件来执行检查动作
4. NPRE daemon 将检查的结果返回给 check_nrpe 插件，插件将其递交给 Nagios 做处理

NRPE 的检测类型分为两种:

- 直接检测：检测的对象是运行 NRPE 的那台 Linux 主机的本地资源，直接使用 NRPE 插件监控远程 Linux 主机的本地或者私有资源
- 间接检测：当运行 Nagios 的监控主机无法访问到某台被监控主机，但是运行 NRPE 的机器可以访问得到的时候，运行 NRPE 的主机就充当一个中间代理，将监控请求发送到被监控对象上

就如下图中`check_disk`和`check_load`是直接检测，`check_http`和`check_ftp`是间接检测。
{% asset_img nrpe-jiegou.png %}

## Nagios 搭建

**服务器端需要安装的软件：**

1. LAMP：因为 Nagios 需要 web 端显示，所以需要 LAMP 的 web 环境，也可以是 LNMP。
2. Nagios-core：Nagios 的主程序
3. Nagios-plugins：Nagios 的插件
4. NRPE：Nagios 的一个功能扩展，可在远程主机上执行插件程序，是客户端程序。

**客户端需要安装的软件**

1. Nagios-plugins
2. NRPE

### 服务器端

- 首先搭建 LAMP 环境
  `yum install httpd php php-gd gd* gcc* glibc* openssl*`
  注：gd 是图像处理库
- 创建用户 nagios，创建用户组 nagcmd，将 apache 和 nagios 都添加到 nagcmd 副组中。
  **组 nagcmd 用于从 Web 接口执行外部命令**
- 创建安装目录`/usr/local/nagios`，编译安装

```
进入nagios-4.4.1解压目录
./configure \
  --prefix=/usr/local/nagios \
  --with-command-group=nagcmd

 General Options:
 -------------------------
        Nagios executable:  nagios
        Nagios user/group:  nagios,nagios
       Command user/group:  nagios,nagcmd
             Event Broker:  yes
        Install ${prefix}:  /usr/local/nagios
    Install ${includedir}:  /usr/local/nagios/include/nagios
                Lock file:  /run/nagios.lock
   Check result directory:  /usr/local/nagios/var/spool/checkresults
           Init directory:  /lib/systemd/system
  Apache conf.d directory:  /etc/httpd/conf.d
             Mail program:  /usr/bin/mail
                  Host OS:  linux-gnu
          IOBroker Method:  epoll

 Web Interface Options:
 ------------------------
                 HTML URL:  http://localhost/nagios/
                  CGI URL:  http://localhost/nagios/cgi-bin/
 Traceroute (used by WAP):  /usr/bin/traceroute

make all \
  && make install \               # 安装Nagios主程序的CGI和HTML
  && make install-init \          # 在/lib/systemd/system创建Nagios启动脚本，即可通过systemctl操作
  && make install-commandmode \   # 配置目录权限
  && make install-config \        # 安装示例配置文件，在/usr/local/nagios/etc目录
  && make install-webconf         # 生成配置文件/etc/httpd/conf.d/nagios.conf
```

至此，Nagios Core 安装完成。

- 下面安装 nagios plugins

```
进入nagios-plugins-2.2.1解压目录
./configure \
  --prefix=/usr/local/nagios

make && make install

查看/usr/local/nagios/libexec目录下是否有插件文件，若有则安装成功
```

- nagios plugins 安装后，继续安装 NRPE。

```
进入nrpe-3.2.1解压目录
./configure
make all \
&& make install \
&& make install-plugin \
&& make install-daemon \
&& make install-config

 General Options:
 -------------------------
 NRPE port:    5666
 NRPE user:    nagios
 NRPE group:   nagios
 Nagios user:  nagios
 Nagios group: nagios
```

- 因为可能开启邮件告警功能，所以要启动 sendmail 服务，不需要做任何配置。
  `yum install sendmail*`
  `systemctl enable sendmail`
  `systemctl start sendmail`

- 也可以使用 postfix 服务进行邮件告警，同样不需要任何配置
  `yum install postfix*`
  `systemctl enable postfix`
  `systemctl start postfix`
  **注：sendmail 和 postfix 同时只开启一个，一个开启则另一个会自动停止**

至此，服务器端核心组件安装完成。

- 如果要进行汉化，则可以安装中文插件`nagios-cn`。
  下载后直接解压进入目录，然后`./configure`，`make && make install`即可。

- 先检查下`/usr/local/nagios/bin`中是否有命令`nagios`和`nagiostats`，如果没有，就将 nagios-4.4.1 目录中`base`目录下的`nagios`命令和`nagiostats`命令复制到`/usr/local/nagios/bin/`中，因为通过`systemctl`启动 nagios 时，会调用该目录的`nagios`命令。若不存在会报错无法启动。

- 为配置文件还有 nagios 和 nagiostats 命令创软链接。
  `ln -s /usr/local/nagios/etc/nagios.cfg /etc/nagios.cfg`
  `ln -s /usr/local/nagios/etc/cgi.cfg /etc/cgi.cfg`
- 为 nagios 默认登录用户 nagiosadmin 创建 http 验证密码。
  `htpasswd -c /usr/local/nagios/etc/htpasswd.users nagiosadmin`
- 将`/usr/local/nagios`的所有者和所属组都改为`nagios`

- 使用`nagios -v /etc/nagios.cfg`检查配置文件是否正确。
- 确保 Selinux 关闭，确保防火墙放行 80 端口或关闭。
- 启动 httpd 和 nagios 以及 nrpe 服务，并设为开机自启。
  `systemctl start httpd nagios nrpe`
  `systemctl enable httpd nagios nrpe`
- 在浏览器上输入`IP地址/nagios`，会先要求输入 htpasswd 设置的用户名密码登录验证。登录成功后跳转到 Nagios 主页面。
  {% asset_img nagios-jiemian-main.png %}

**服务器端配置 NRPE**
`ln -s /usr/local/nagios/etc/nrpe.cfg /etc/nrpe.cfg`

- 修改`commands.cfg`文件，添加`check_nrpe`命令

```
define command {
    command_name check_nrpe
    command_line $USER1$/check_nrpe -H $HOSTADDRESS$ -c $ARG1$
}
```

- 修改`service.cfg`，添加服务

```
define service {
    use local-service
    host_name system3
    service_description users
    check_command check_nrpe!check_users    # 在check_nrpe!后直接使用nrpe.cfg定义的command变量
}
```

完成后重启 nrpe

### 客户端安装

- 安装 nagios plugins

```
进入nagios-plugins-2.2.1解压目录
./configure --prefix=/usr/local/nagios
make && make install
```

- 安装 NRPE

```
进入nrpe-3.2.1解压目录
./configure
make all \                 构建nrpe和check_nrpe
&& make install \          安装nrpe和check_nrpe
&& make install-plugin \   安装check_nrpe插件
&& make install-daemon \   安装nrpe daemon
&& make install-config     安装nrpe 配置文件
&& make install-init       安装systemd文件
```

- 查看配置文件`/usr/local/nagios/etc/nrpe.cfg`，若要添加监控命令，便找到以下配置，按照格式进行添加 command

```
command[check_users]=/usr/local/nagios/libexec/check_users -w 5 -c 10
command[check_load]=/usr/local/nagios/libexec/check_load -r -w .15,.10,.05 -c .30,.25,.20
command[check_hda1]=/usr/local/nagios/libexec/check_disk -w 20% -c 10% -p /dev/hda1
command[check_zombie_procs]=/usr/local/nagios/libexec/check_procs -w 5 -c 10 -s Z
command[check_total_procs]=/usr/local/nagios/libexec/check_procs -w 150 -c 200

# command后中括号里内容就是定义的变量，名称可任意指定
```

- （可选）修改`/etc/services`，添加`nrpe 5666/tcp # Nagios_client`。
- 启动 nrpe，`systemctl start nrpe`，并使用`ps -ef`查看 nrpe 是否启动。
- 使用插件`/usr/local/nagios/libexec/check_nrpe -H localhost`检验 nrpe 是否启动成功。若成功，会输出 NRPE 的版本号。

- **修改配置文件`/usr/local/nagios/nrpe.cfg`**

```
#server_address=127.0.0.1      # 客户端主机IP地址

# 添加监控服务器地址，声明合法的NRPE服务对象
allowed_hosts=127.0.0.1,监控服务器地址或域名
# 若没有在这指定监控服务器地址，则监控服务器无法获取本机的服务信息
```

- 给命令`nrpe`和配置文件`nrpe.cfg`创软链接，并以守护进程启动。
  `nrpe -c /etc/nrpe.cfg -d`
  也可通过`systemctl start nrpe`启动。

- 测试 nrpe 是否成功启动
  `/usr/local/nagios/libexec/check_nrpe -H 127.0.0.1`，输出 NRPE 版本号则启动成功。

- 测试 nrpe 是否能与客户端通信，同样使用`check_nrpe`指定对端 IP 地址或域名，输出 NRPE 版本号则通信正常。
  若报错

### 目录与配置文件概述

在 Nagios 服务器端安装完后，`/usr/local/nagios`中有以下目录：
`bin`，`etc`，`sbin`，`share`，`libexec`，`var`，`var/archives`，`var/rw`。
其中`libexec`是存放外部插件的。`share`是存放网页文件的。`var/archives`是存放归档日志的。`var/rw`是存放外部命令的。

| 配置文件或目录          | 说明                                             |
| ----------------------- | ------------------------------------------------ |
| cgi.cfg                 | 控制 cgi 访问的配置文件                          |
| nagios.cfg              | Nagios 主配置文件                                |
| resource.cfg            | 变量定义文件                                     |
| objects                 | 目录，存放配置文件模板，用于定义 Nagios 对象     |
| objects/commands.cfg    | 命令定义配置文件，定义的命令可悲其他配置文件使用 |
| objects/contacts.cfg    | 定义联系人和联系人组                             |
| objects/localhost.cfg   | 定义监控本地主机                                 |
| objects/printer.cfg     | 定义监控打印机，默认未开启                       |
| objects/switch.cfg      | 定义监控路由器，默认未开启                       |
| objects/templates.cfg   | 定义主机、服务，默认未开启                       |
| objects/timeperiods.cfg | 定义监控时间段                                   |
| objects/windows.cfg     | 定义 windows 主机，默认未开启                    |

Nagios 配置中涉及到的定义：（建议按以下顺序配置）

1. 主机、主机组、服务、服务组
2. 监控命令
3. 监控时间
4. 联系人、联系人组

Nagios 监控的主机资源和服务在配置文件中称为对象。
建议将 Nagios 各个定义对象创建独立的配置文件，如：

- 创建`hosts.cfg`定义主机和主机组
- 创建`services.cfg`定义服务和服务组

其余的对象都用默认文件即可。

#### templates.cfg

定义主机和服务的模板

```
define contact {             # 定义联系人
    name                            generic-contact         ; 联系人名
    service_notification_period     24x7                    ; 服务通知时间，默认24x7任何时间
    host_notification_period        24x7                    ; 主机通知时间，默认24x7任何时间
    service_notification_options    w,u,c,r,f,s             ; 服务发送通知的状态条件
    # w：警告warn u：未知unknown c：紧急criticle r：重新恢复recover
    host_notification_options       d,u,r,f,s               ; 主机发送通知的状态条件
    # d：宕机down u：未知/不可达unreachable r：重新恢复
    service_notification_commands   notify-service-by-email ; 服务发送通知的方式
    host_notification_commands      notify-host-by-email    ; 主机发送通知的方式
}

define host {                # 定义主机
    name                            generic-host            ; 主机名（对于配置文件，并非系统主机名）
    notifications_enabled           1                       ; 是否开启主机通知，1为开启，2为不开启
    event_handler_enabled           1                       ; 是否开启事件处理
    flap_detection_enabled          1                       ; 是否启用报警延时
    process_perf_data               1                       ; 是否启用数据输出
    retain_status_information       1                       ; 是否在程序重启期间保留状态信息
    retain_nonstatus_information    1                       ; 是否在程序重启期间保留非状态信息
    notification_period             24x7                    ; 主机通知时间，默认任何时间
}

define host {
    name                            linux-server            ; 主机名
    use                             generic-host            ; 引用指定的主机，此处引用了上面定义的主机的配置
    check_period                    24x7                    ; 检查主机的时间段，默认不间断
    check_interval                  5                       ; 检查主机的时间间隔，默认5分钟
    retry_interval                  1                       ; 重试检查时间间隔，默认1分钟
    max_check_attempts              10                      ; 对主机检查的最多次数。并不是检查一次就判断，而是多检查几次才判断是否故障。单位次
    check_command                   check-host-alive        ; 默认检查命令
    notification_period             workhours               ; 发送通知的时间段
    notification_interval           120                     ; 发送通知的间隔，单位分钟
    notification_options            d,u,r                   ; 发送通知的状态条件
    contact_groups                  admins                  ; 联系人组
}

后面还有对打印机、交换机的主机定义
然后就是对服务的定义
define service {              # 定义服务
    name                            generic-service         ; 服务名
    active_checks_enabled           1                       ; 是否开启动态检查
    passive_checks_enabled          1                       ; 是否开启主动检查
    parallelize_check               1                       ; 应该并行化活动服务检查（禁用此功能可能会导致严重的性能问题）
    obsess_over_service             1                       ; 默认为1
    check_freshness                 0                       ; 默认为0
    notifications_enabled           1                       ; 是否启用服务通知
    event_handler_enabled           1                       ; 是否启用事件处理
    flap_detection_enabled          1                       ; 是否启用报警延时
    process_perf_data               1                       ; 是否启用数据输出
    retain_status_information       1                       ; 是否在程序重启期间保留状态信息
    retain_nonstatus_information    1                       ; 是否在程序重启期间保留非状态信息
    is_volatile                     0                       ; 是否稳定，0为稳定，1为不稳定
    check_period                    24x7                    ; 检查服务的时间段，默认不间断
    max_check_attempts              3                       ; 对服务检查的最多次数
    check_interval                  10                      ; 检查时间间隔，默认10分钟
    retry_interval                  2                       ; 重试检查时间间隔，默认2分钟
    contact_groups                  admins                  ; 联系人组
    notification_options            w,u,c,r                 ; 发送通知的状态条件
    notification_interval           60                      ; 发送通知的间隔，单位分钟
    notification_period             24x7                    ; 发送通知的时间段
}
```

#### resource.cfg

定义变量的模板。变量需要先定义才能在别的配置文件中调用，否则 nagios 就会报错。

```
# 变量$USER1$指定了nagios插件的安装路径
$USER1$=/usr/local/nagios/libexec
# $USER2$定义了事件处理的安装路径
$USER2$=/usr/local/nagios/libexec/eventhandlers
```

#### Nagios 宏

Nagios 配置有两个特征：继承与引用，在命令行定义中使用宏，通过宏，Nagios 可灵活获取主机、服务等对象的信息。在命令执行前，Nagios 会对命令进行宏替换。
宏分为：默认宏、按需而成的宏、用户自定义宏

- 默认宏：主机 IP 地址宏

```
define host{
    host_name        linuxbox
    address	         192.168.1.2
    check_command    check_ping
...
}
define command{
    command_name     check_ping
    command_line     /usr/local/nagios/libexec/check_ping -H $HOSTADDRESS$ -w 100.0,90% -c 200.0,60%
}
在执行时，就会把宏替换为IP地址
```

- 命令参数宏
  向命令传递参数，参数指定在对象中定义，用一个`!`分隔。

```
define service{
    host_name             linuxbox
    service_description   PING
    check_command         check_ping!200.0,80%!400.0,40%
...
}
define command{
    command_name    check_ping
    command_line    /usr/local/nagios/libexec/check_ping -H $HOSTADDRESS$ -w $ARG1$ -c $ARG2$
}
在执行时，会将分隔的两个参数替换到命令中的ARG1和ARG2
```

**注：如果要在命令中使用`!`，`\`都要使用反斜杠转义**

Nagios 可用的所有宏：

- 主机宏
  `$HOSTNAME$`：主机名，取自主机定义中`host_name`
  `$HOSTADDRESS$`：主机 IP 地址，取自主机定义中`address`
- 服务宏
  `$SERVICESTATE$`：服务状态描述，三个可能：`w`，`u`，`c`
  `$SERVICEDESC$`：对当前服务的描述
- 联系人宏
  `$CONTACTNAME$`：联系人名，在联系人文件中定义
- 通知宏
  `$NOTIFICATIONTYPE$`：返回状态信息。
- 日期宏
  `$LONGDATETIME$`：当前日期，时间戳
- 文件宏
  `$LOGFILE$`：日志文件保存位置
  `$MAINCONFIGFILE`：主配置文件保存位置
- 其他宏
  `$ADMINMAIL$`：管理员 E-mail 地址
  `$ARGn$`：第 n 个命令参数，n 是数字。最多支持 32 个参数宏。

#### commands.cfg

定义命令。

```
define command {
    command_name    check-host-alive      # 命令名
    # 命令执行
    command_line    $USER1$/check_ping -H $HOSTADDRESS$ -w 3000.0,80% -c 5000.0,100% -p 5
    # 调用插件check_ping，-w为warning警告状态，-c为紧急，80%表示ping的临界值。-p 5表示每次发5个ping包
}
```

#### hosts.cfg

默认不存在，定义主机。

```
define host {
	use           linux-server    # 引用templates.cfg中linux-server的配置
	host_name     web             # 主机名
	alias         web-system5     # 别名
	address       192.168.163.137 # IP地址
}

define hostgroup {
	hostgroup_name    web-servers # 主机组名
	alias             web-servers # 别名
	members           web         # 组成员（填host_name，逗号分隔）
}
```

#### services.cfg

默认不存在，定义服务。

```
define service {
	use                    local-service  # 引用templates.cfg中local-service的配置
	host_name              web   # 主机名
	service_description    ping  # 服务描述
	check command          check_ping.....  #引用命令
}

define servicegroup {     # 服务组，配置类似主机组
	servicegroup_name
	alias
	members
}
```

#### contacts.cfg

定义联系人。

```
define contact {
	contact_name     # 联系人名
	use              # 使用templates.cfg中指定模板信息
	alias
	email            # 联系人邮箱
}
define contactgroup {
	contactgroup_name    # 联系人组名
	alias
	members
}
```

#### timeperiods.cfg

定义监控时段。

```
define timeperiod {

    name                    24x7     #定义时段名
	# 之前host和service中的24x7就是引用这里定义的时段名
    timeperiod_name         24x7
    alias                   24 Hours A Day, 7 Days A Week
    # 定义监控时间，若某天不监控则不要写那天
    sunday                  00:00-24:00
    monday                  00:00-24:00
    tuesday                 00:00-24:00
    wednesday               00:00-24:00
    thursday                00:00-24:00
    friday                  00:00-24:00
    saturday                00:00-24:00
}
```

#### cgi.cfg

控制 cgi 脚本。用于在 web 界面执行 cgi 脚本，如重启 nagios 进程、关闭通知、停止检测等。
以下为修改权限涉及的参数

```
default_user_name=guest
authorized_for_system_information=nagiosadmin          # 验证系统信息
authorized_for_configuration_information=nagiosadmin   # 验证配置信息
authorized_for_system_commands=nagiosadmin             # 验证系统命令
authorized_for_all_services=nagiosadmin                # 验证所有服务
authorized_for_all_hosts=nagiosadmin                   # 验证所有主机
authorized_for_all_service_commands=nagiosadmin        # 验证所有服务命令
authorized_for_all_host_commands=nagiosadmin           # 验证所有主机命令
```

#### nagios.cfg

Nagios 的核心配置文件，所有配置文件必须在此文件中引用才有作用。

```
log_file=/usr/local/nagios/var/nagios.log             # 日志文件路径

cfg_file=/usr/local/nagios/etc/objects/commands.cfg
cfg_file=/usr/local/nagios/etc/objects/contacts.cfg
cfg_file=/usr/local/nagios/etc/objects/timeperiods.cfg
cfg_file=/usr/local/nagios/etc/objects/templates.cfg
cfg_file=/usr/local/nagios/etc/objects/localhost.cfg
# 继续添加配置文件即可启用指定配置文件。
# 也可以直接将文件放入一个目录，然后通过cfg_dir=指定

object_cache_file=/usr/local/nagios/var/objects.cache  # 指定一个所有对象配置文件的副本文件，也称为对象缓冲文件。
# nagios会将所有对象文件的内容都写入该文件

resource_file=/usr/local/nagios/etc/resource.cfg  # 指定nagios资源文件的路径，可在nagios.cfg定义多个资源文件
status_file=/usr/local/nagios/var/status.dat  # 指定状态文件，用于保存nagios当前状态、注释、宕机信息等
status_update_interval=10  # 状态文件的更新周期，单位秒，最小1秒
nagios_user=nagios   # nagios进程所属用户
nagios_group=nagios  # nagios进程所属用户组
check_external_commands=1  # 是否允许nagios在web界面执行cgi命令
interval_length=60  # 指定nagios时间单位，默认60s，即nagios配置中所有 时间单位为分钟
```

### Nagios 监控界面解析

左侧菜单栏中`Current Status`目录如下

```
Tactical Overview    总览
Map                  拓扑图
Hosts                主机
Services             服务
Host Groups          主机组
- Summary            汇总
- Grid               表格
Service Groups       服务组，也分为汇总和表格
Problems             问题故障
- Service(Unhandled) 未解决的服务故障
- Hosts(Unhandled)   未解决的主机故障
- Network Outages    网络整体
```

`Reports`目录如下：

```
Availability         可用性
Trends               趋势
Alerts               报警
- History            历史
- Summary            汇总
- Histogram          历史图
Notification         通知
Event Log            事件日志
```

`System`目录如下：

```
Comments             注释
Downtime             停机计划
Process Info         进程信息
Performance Info     性能查询
Scheduling Queue     定时查询
Configuration        配置
```

#### 常用操作

Nagios 对主机和服务有几个描述的状态

- Hosts
  - Up 启动（绿）
  - Down 未启动（红）
  - Unreachable 不可达（黄）
  - Pending 等待（灰色）
- Services
  - Ok 正常（绿）
  - Warning 警告（黄）
  - Unknown 未知（橙）
  - Critical 紧急（红）
  - Pending 等待（灰）

### Nagios 性能分析图表

- 需要安装`pnp`软件包，基于 PHP 和 Perl，利用 rrdtool 工具将 nagios 收集的数据绘制成图表。[**pnp 官网**](https://docs.pnp4nagios.org/)
  首先，需要安装`gd`库、`zlib`库、`jpeg`库
  `yum install gd gd-devel zlib zlib-devel jpeg*`
  接着安装`rrdtool`工具
  `yum install rrdtool*`
  安装`perl`环境
  `yum install perl`
  最后去 pnp 官网下载源码包安装

```
./configure \
  --with-nagios-user=nagios \
  --with-nagios-group=nagios \
  --with-rrdtool=/usr/bin/rrdtool \
  --with-perfdata-dir=/usr/local/nagios/share/perfdata
make all \
  && make install \
  && make install-config \
  && make install-init \
  && make install-webconf
或者直接make fullinstall（包含以上所有make）

  General Options:
  -------------------------         -------------------
  Nagios user/group:                nagios nagios
  Install directory:                /usr/local/pnp4nagios
  HTML Dir:                         /usr/local/pnp4nagios/share
  Config Dir:                       /usr/local/pnp4nagios/etc
  Location of rrdtool binary:       /usr/bin/rrdtool Version 1.7.0
  RRDs Perl Modules:                FOUND (Version 1.6999)
  RRD Files stored in:              /usr/local/nagios/share/perfdata
  process_perfdata.pl Logfile:      /usr/local/pnp4nagios/var/perfdata.log
  Perfdata files (NPCD) stored in:  /usr/local/pnp4nagios/var/spool

  Web Interface Options:
  -------------------------         -------------------
  HTML URL:                         http://localhost/pnp4nagios
  Apache Config File:               /etc/httpd/conf.d/pnp4nagios.conf
```

安装完后，将`/usr/local/pnp4nagios`的所有者和所属组都改为 nagios

- 配置 pnp
  将`/usr/local/pnp4nagios/share`目录下所有文件复制到`/usr/local/nagios/share/pnp`中。
  将`/usr/local/pnp4nagios/etc`中`npcd.cfg`、`rra.cfg`、`process_perfdata.cfg`后面的`-sample`去除（如果有的话）。

首先修改`process_perfdata.cfg`。

```
# 指定日志路径
LOG_FILE = /usr/local/pnp4nagios/var/perfdata.log
# 日志输出级别，默认为0，最好改为2，即debug
LOG_LEVEL = 2
# 三个等级：0==slient 1==normal 2==debug
```

然后将 pnp 与 nagios 进行整合，对 templcates.cfg 配置，添加以下定义。

```
define host {
    name                  hosts-pnp
    register              0
    action_url            /nagios/pnp/index.php?host=$HOSTNAME$
    process_perf_data     1
}

define service {
    name                  services-pnp
    register              0
    action_url            /nagios/pnp/index.php?host=$HOSTNAME$&srv=$SERVICEDESC$
    process_perf_data     1
}
# 注：必须在不应处理其性能数据的每个主机或服务的定义中禁用数据处理（process_perf_data 设为0）。
```

然后在`hosts.cfg`和`services.cfg`和`localhost.cfg`中要进行数据分析的服务或主机的`name`参数后加上`hosts-pnp`或`service-pnp`，如下：

```
define service {
	use                    local-service,serviecs-pnp
	host_name              web
	service_description    ping
	check command          check_ping.....
}
```

修改 nagios.cfg

```
# 开启Nagios数据输出。会将收集到的数据写入文件
process_performance_data=1

# 取消注释，启用主机和服务的输出功能
host_perfdata_command=process-host-perfdata
service_perfdata_command=process-service-perfdata

host_perfdata_file=/usr/local/pnp4nagios/var/host-perfdata
service_perfdata_file=/usr/local/pnp4nagios/var/service-perfdata

host_perfdata_file_template=[HOSTPERFDATA]\t$TIMET$\t$HOSTNAME$\t$HOSTEXECUTIONTIME$\t$HOSTOUTPUT$\t$HOSTPERFDATA$
service_perfdata_file_template=[SERVICEPERFDATA]\t$TIMET$\t$HOSTNAME$\t$SERVICEDESC$\t$SERVICEEXECUTIONTIME$\t$SERVICELATENCY$\t$SERVICEOUTPUT$\t$SERVICEPERFDATA$

host_perfdata_file_mode=a
service_perfdata_file_mode=a

host_perfdata_file_processing_interval=0
service_perfdata_file_processing_interval=0

host_perfdata_file_processing_command=process-host-perfdata-file
service_perfdata_file_processing_command=process-service-perfdata-file

```

修改 commands.cfg

```
define command {
    command_name    process-host-perfdata-file
    # 将原来的command_line注释，改为如下参数
    command_line    /usr/local/pnp4nagios/libexec/process_perfdata.pl --bulk=/usr/local/pnp4nagios/var/host-perfdata
}

define command {
    command_name    process-service-perfdata-file
    # 将原来的command_line注释，改为如下参数
    command_line    /usr/local/pnp4nagios/libexec/process_perfdata.pl --bulk=/usr/local/pnp4nagios/var/service-perfdata
}
```

重启 nagios 和 httpd
进入 web 端，点击左侧菜单`services`。进入如下页面
{% asset_img services.png %}

点击红框框出的图标，即可进入 pnp 测试界面
{% asset_img pnp-success.png %}

若全部通过，便会提示删除或重命名`/usr/local/nagios/share/pnp/install.php`。于是将该 php 文件删除。`rm -f /usr/local/nagios/share/pnp/install.php`

如果在点击 pnp 图标时，出现以下报错：

{% asset_img 1.png %}

则需要检查`nagios.cfg`和`commands.cfg`配置文件，查看`commands.cfg`配置可知`command_name`为`process-host-perfdata`的默认存放路径`bulk`为`/usr/local/pnp4nagios/var/host-perfdata`，同理，`process-service-perfdata`的存放路径为`/usr/local/pnp4nagios/var/service-perfdata`。

而在`nagios.cfg`中`host_perfdata_file`默认路径为`/usr/local/nagios/var/host-perfdata`，`service_perfdata_file`默认路径为`/usr/local/nagios/var/service-perfdata`，两个文件不一致，导致 pnp4nagios 无法获取。

将`nagios.cfg`的两条配置，改为与`commands.cfg`的一致即可

```
host_perfdata_file=/usr/local/pnp4nagios/var/host-perfdata
service_perfdata_file=/usr/local/pnp4nagios/var/service-perfdata
```

### 邮件告警配置

先安装 sendmail 或 postfix，安装完后开启。本篇使用 sendmail 服务。
使用`mail`命令发送测试邮件。若没有 mail 命令，需要先下载`mailx`软件
`mail -s test XXXX@XX.com`输入内容完后`ctrl+d`结束。

关于邮件告警主要涉及以下几个文件：

- `templates.cfg`

```
其中有关于contact的定义
define contact {
    name                            generic-contact
    service_notification_period     24x7
    host_notification_period        24x7
    service_notification_options    w,u,c,r,f,s
    host_notification_options       d,u,r,f,s
    service_notification_commands   notify-service-by-email
    host_notification_commands      notify-host-by-email
    register                        0
}
# 发送服务通知使用的是notify-service-by-email命令
  发送主机同时使用的是notify-host-by-email命令
```

- 于是查找`commands.cfg`文件

```
如果不成功，一定要注意到此文件中发送通知的命令
默认使用sendmail命令，若主机没有就不可能发送成功。
需要替换为mail或mailx。还要注意这两个命令的目录，是/bin还是/sbin
define command {
    command_name    notify-host-by-email
    command_line    /usr/bin/printf "%b" "***** Nagios *****\n\nNotification Type: $NOTIFICATIONTYPE$\nHost: $HOSTNAME$\nState: $HOSTSTATE$\nAddress: $HOSTADDRESS$\nInfo: $HOSTOUTPUT$\n\nDate/Time: $LONGDATETIME$\n" | /usr/bin/mail -s "** $NOTIFICATIONTYPE$ Host Alert: $HOSTNAME$ is $HOSTSTATE$ **" $CONTACTEMAIL$
}
define command {
    command_name    notify-service-by-email
    command_line    /usr/bin/printf "%b" "***** Nagios *****\n\nNotification Type: $NOTIFICATIONTYPE$\n\nService: $SERVICEDESC$\nHost: $HOSTALIAS$\nAddress: $HOSTADDRESS$\nState: $SERVICESTATE$\n\nDate/Time: $LONGDATETIME$\n\nAdditional Info:\n\n$SERVICEOUTPUT$\n" | /usr/bin/mail -s "** $NOTIFICATIONTYPE$ Service Alert: $HOSTALIAS$/$SERVICEDESC$ is $SERVICESTATE$ **" $CONTACTEMAIL$
}
```

- 最后通过`contacts.cfg`设置联系人，在 email 中填写自己的邮箱

```
define contact {
    contact_name            nagiosadmin
    use                     generic-contact
    alias                   Nagios Admin
    email                   XXXX@XX.com
}
```

- 当服务出现重启或故障时，系统会自动发送邮件。
  {% asset_img youjian.png %}

## 参考资料

> [Nagios 配置安装详解](https://www.cnblogs.com/zhangsubai/p/5732081.html) > [使用 Nagios 搭建监控服务器](http://wiki.jikexueyuan.com/project/linux/nagios.html) > [Nagios 官方文档](https://library.nagios.com/library/products/nagios-core/documentation/) > [Pnp 官方配置文档](https://docs.pnp4nagios.org/pnp-0.6/config) > [Nagios 监控系统架设全攻略](https://www.ibm.com/developerworks/cn/linux/1309_luojun_nagios/) > [CentOS7 安装 nagios 并配置出图详解](https://blog.csdn.net/kepa520/article/details/48541771) > [2017 年 11 月最新 Nagios4.3.4 部署](https://www.cnblogs.com/lixj3/p/7876077.html)
> 高性能 Linux 服务器构建实战：运维监控、性能调优与集群应用

---
title: Supervisor学习笔记
tags: [Supervisor]
categories: []
date: 2019-12-15 14:34:32
---

Supervisor 是一个 python 编写的 C/S 系统，允许其用户监视和控制 UNIX/Linux 上的多个进程。它不会作为“进程 ID 1”替代 init 运行，相反，它旨在用于控制与某个项目或客户相关的进程，并且在启动时像任何其他程序一样启动。

<!--more-->

# 特点

- `rc.d`脚本是进程初始化、自动启动、管理的一个很好的形式，但是编写和维护很麻烦。 此外，`rc.d`脚本无法自动重启崩溃的进程，许多程序在崩溃时无法正确地自行重启。`Supervisord` 将进程作为其子进程启动，并且可以配置为在崩溃时自动重启，也可以将其自动配置为自行调用启动进程。
- 在 UNIX 上，通常很难获得准确的启动和关闭状态信息。 Pidfile 经常出错。 Supervisord 将流程作为子流程启动，因此它始终知道其子级的真实的启动和关闭状态，并且可以方便地查询该数据。
- 不需要或不需要完整的 Shell 访问运行这些进程的计算机。 监听小的 TCP 端口的进程通常需要以 root 用户身份启动和重新启动。 通常情况下，可以允许普通用户停止或重新启动这样的进程，但是为他们提供 shell 访问权限通常是不切实际的，并且为他们提供 root 访问权限或 sudo 访问权限通常是不可能的。`Supervisorctl` 允许以非常有限的方式访问计算机，实质上是允许用户通过简单的 Shell 或 Web UI 发出停止、启动、重新启动命令来查看进程状态并控制受监督的子进程。
- 进程通常需要成组地启动和停止，有时甚至需要按优先级顺序启动和停止。Supervisor 允许为进程分配优先级，允许用户通过 `superviseorctl` 发出命令，比如 `start all` 和 `restart all`，它们按照预先分配的优先级顺序启动进程。此外，可以将流程分组到流程组中，并且可以作为一个单元来停止和启动一组逻辑相关的进程。
- Supervisor 通过 fork/exec 启动它的子进程，且子进程不做守护进程。当进程终止时，操作系统会立即向 Supervisor 发出信号。
- 通过简单易懂的 INI 样式配置文件配置 Supervisor。 它提供了许多进程的选项，例如重新启动失败的进程和自动日志轮换。
- Supervisor 能启动、停止和监视进程，可以单独控制，也可以分组控制。可以配置 Supervisor 来提供本地或远程命令行和 web 接口。
- Supervisor 具有一个简单的事件通知协议，该协议可以使用任何语言编写的程序对其进行监视，并且具有用于控制的 XML-RPC 接口。它还使用扩展点构建，Python 开发人员可以利用这些扩展点。

# 组成

- supervisord：负责自行调用启动子程序，响应来自客户端的命令，重新启动崩溃或退出的子进程，记录其子进程 stdout 和 stderr 输出以及生成和处理与子进程生命周期中的点相对应的“事件”。配置文件`/etc/supervisord.conf`，是“ Windows-INI”样式的配置文件。因为可能包含未加密的用户名和密码，最好通过适当的文件系统权限来确保此文件的安全
- supervisorctl：提供了类似 shell 的界面，与 supervisord 结合使用。 通过超级用户，用户可以连接到不同的超级用户进程（一次一个），获取由超级用户控制的子进程的状态，停止和启动该超级用户的子进程，以及获取超级用户正在运行的进程的列表。命令行客户端通过 UNIX 域套接字或 Internet（TCP）套接字与服务器交互。 服务器可以声明客户端用户应在允许客户端执行命令之前出示身份验证凭据。客户端进程通常使用与服务器相同的配置文件，但是其中需包含`[supervisorctl]`
- 激活配置文件的`[inet_http_server]`部分后，可访问浏览器的 localhost:9001，通过 web 界面查看操作
- 开启 web ui 后，还会自动提供 XML-RPC 接口，该接口可用于询问和控制管理程序及其运行的程序。

# 安装使用

`pip install supervisor`，之后运行命令`echo_supervisord_conf`，该命令会打印出 supervisor 的配置案例。

```
echo_supervisord_conf > /etc/supervisord.conf
```

启动 supervisord，可使用`-c`指定配置文件

```
supervisord -c /etc/supervisord.conf
```

若要配置出`supervisord.service`，可创建

```
[Unit]
Description=Supervisor daemon

[Service]
Type=forking
ExecStart=/usr/bin/supervisord -c /etc/supervisord.conf
ExecStop=/usr/bin/supervisorctl shutdown
ExecReload=/usr/bin/supervisorctl reload
KillMode=process
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## 添加程序

在配置文件中添加

```
[program:program_name]
command=
```

官方案例

```
[program:foo]
command=/bin/cat
```

启动 supervisord，然后可通过`supervisorctl`查看操作进程

```
# supervisorctl status all
foo                              RUNNING   pid 27977, uptime 0:00:44
```

## web 管理

需要在配置中将`[inet_http_server]`的注释去除

```
[inet_http_server]
port=127.0.0.1:9001
username=test
password=test

# 若是需要其他主机能访问，需要将127.0.0.1改为*
```

重新启动 supervisord，查看 9001 端口是否开启
然后通过浏览器访问 9001 端口。

## supervisorctl 动作

- `help`：获取动作的列表
  `help <action>`能获取指定 action 的帮助
- `add <name>`：激活配置中进程/组的任何更新，可指定多个
- `remove <name>`：从当前配置中删除进程/组，可指定多个
- `update`或`update all`：重新加载配置并根据需要添加/删除，并将重新启动受影响的程序
  `update <gname>`：更新特定的组，并将重新启动受影响的程序，可指定多个
- `clear <name>`：清除进程日志文件，可指定多个。
  `clear all`可清除所有
- `fg <process>`：连接到前台模式下的进程
- `pid`：获取 supervisord 的 PID
  `pid <name>`：通过名称获取单个子进程的 PID。
  `pid all`
- `reload`：重启远端 supervisord
- `reread`：重新加载守护程序的配置文件，而无需重新启动
- `restart <name>`：重启一个进程，**restart 不重新读取配置文件。** 可指定多个。
  `restart <gname>:*`
  `restart all`
- `start <name>`：启动一个进程，可指定多个。
  `start <gname>:*`
  `start all`
- `status`：查看所有进程信息
  `status <name>`
- `stop <name>`：停止一个进程，可指定多个。
  `stop <gname>:*`
  `stop all`

## 配置文件详解

### [unix_http_server]

监听一个 unix 域 socket 的 http 服务器的配置

- file：socket 文件
- chmod：socket 文件权限，默认 0700
- chown：socket 文件的所属者
- username：需要验证的用户名
- password：需要验证的用户密码

示例：

```
[unix_http_server]
file = /tmp/supervisor.sock
chmod = 0777
chown= nobody:nogroup
username = user
password = 123
```

### [inet_http_server]

监听一个 TCP socket 的 http 服务器的配置

- port：supervisor 监听 http/xml-rpc 请求的端口。supervisorctl 会在这个端口使用 xml-rpc 与 supervisord 交互
- username
- password

示例：

```
[inet_http_server]
port = 127.0.0.1:9001
username = user
password = 123
```

### [supervisord]

supervisord 进程的全局配置

- logfile：supervisord 进程的日志
- logfile_maxbytes：活动日志文件在轮换之前可能消耗的最大字节数（需加单位）
- logfile_backups：活动日志文件轮换导致要保留的备份数。 如果设置为 0，将不保留任何备份。
- loglevel：日志等级。critical, error, warn, info, debug, trace, blather。默认 info
- pidfile：supervisord 进程的 pidfile
- umask：supervisord 进程的 umask
- nodaemon：如果是 true，则不会在后台运行
- minfds：在主目录成功启动之前必须可用的文件描述符的最小数量。默认 1024
- minprocs：在主进程成功启动之前必须可用的进程描述符的最小数量。默认 200
- nocleanup
- childlogdir
- user：当执行操作时，将身份切换到指定用户。如果超级用户无法切换到指定的用户，它将向 stderr 写入一条错误消息，然后立即退出。
- directory：当 supervisord 守护进程时，切换到该目录。
- strip_ansi：从子日志文件中删除所有 ANSI 转义序列。
- environment：键值对环境变量
- identifier：标记 supervisor 进程的字符串，供 RPC 使用

示例：

```
[supervisord]
logfile = /tmp/supervisord.log
logfile_maxbytes = 50MB
logfile_backups=10
loglevel = info
pidfile = /tmp/supervisord.pid
nodaemon = false
minfds = 1024
minprocs = 200
umask = 022
user = chrism
identifier = supervisor
directory = /tmp
nocleanup = true
childlogdir = /tmp
strip_ansi = false
environment = KEY1="value1",KEY2="value2"
```

### [supervisorctl]

客户端命令 supervisorctl 的配置

- serverurl：通过 UNIX socket 连接 supervisord，路径与 unix_http_server 部分的 file 一致
- username
- password
- prompt：提示字符串

示例：

```
[supervisorctl]
serverurl = unix:///tmp/supervisor.sock
username = chris
password = 123
prompt = mysupervisor
```

### [program:x]

子进程配置

- directory
- command
- autostart：supervisor 启动的时候是否随着同时启动，默认 True
- autorestart：当程序 exit 的时候，这个 program 是否会自动重启，默认 unexpected，设置子进程挂掉后自动重启的情况，有三个选项，false,unexpected 和 true。如果为 false 的时候，无论什么情况下，都不会被重新启动，如果为 unexpected，只有当进程的退出码不在下面的 exitcodes 里面定义的
- startsecs：子进程启动多少秒之后，此时状态如果是 running，则认为启动成功
- user
- stderr_logfile
- stdout_logfile
- redirect_stderr：把 stderr 重定向到 stdout，默认 false
- stdout_logfile_maxbytes：stdout 日志文件大小，默认 50MB
- stdout_logfile_backups：stdout 日志文件备份数

### [include]

添加其他配置文件

- files：文件路径，多个就以空格分隔

### [group:x]

进程组配置

- programs：该组的进程，以逗号分隔
- priority：优先级

示例：

```
[group:foo]
programs=bar,baz
priority=999
```

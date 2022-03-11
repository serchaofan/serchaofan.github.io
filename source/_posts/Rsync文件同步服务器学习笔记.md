---
title: Rsync文件同步服务器学习笔记
date: 2018-08-01 20:58:22
tags: [Rsync, server, 同步]
---

- [Rsync 介绍与搭建](#rsync-介绍与搭建)
  - [quick check 算法介绍](#quick-check-算法介绍)
  - [rsync 的工作方式](#rsync-的工作方式)
  - [rsync 命令使用](#rsync-命令使用)
  - [规则解析](#规则解析)
  - [Rsync 服务器搭建](#rsync-服务器搭建)
  - [Rsync 部分报错解决](#rsync-部分报错解决)
- [Rsync+Inotify 文件自动同步](#rsyncinotify-文件自动同步)
  - [Inotify 介绍](#inotify-介绍)
- [参考文章](#参考文章)

<!-- more -->

# Rsync 介绍与搭建

Rsync（Remote Synchronize）是一个远程数据同步工具，可使本地主机不同分区或目录之间及本地和远程两台主机之间的数据快速同步镜像，远程备份等功能。

Rsync 特点：

- 使用 TCP 873 端口
- 可根据数据变化进行差异备份或增量备份，减少数据流量
- 传输可以通过 ssh 协议加密数据
- 支持拷贝特殊文件如链接，设备等
- 可以镜像保存整个目录树和文件系统
- 可以保持原来文件或目录的所有属性均不改变
- 可使用 rsh、ssh，或直接通过 socket 连接
- 支持匿名的或认证的进程模式传输
- 使用 Rsync 自己的 **`quick check`** 算法
- rsync 传输大文件时速度大概是 scp 的 20 倍以上

rsync 同步过程由两部分模式组成：**决定哪些文件需要同步的检查模式**，**文件同步时的同步模式。**

- 检查模式是指按照指定规则来检查哪些文件需要被同步。

  > 默认情况下，rsync 使用`quick check`算法。可以通过`rsync`命令选项设置指定的检查模式。

- 同步模式是指在文件确定要被同步后，在同步过程发生之前要做哪些额外工作。

## quick check 算法介绍

比较源文件和目标文件的文件大小和修改时间 mtime（修改时间），只要存在不同，就发送端会传输该文件，如果目标路径下没有文件，则 rsync 会直接传输文件。若存在差异，并不会传送整个文件，而是只传源文件和目标文件所不同的部分，实现真正的增量同步。

rsync 的增量传输体现在两个方面：**文件级别**的增量传输和**数据块级别**的增量传输。

- **文件级别**的增量传输是指源主机上有，但目标主机上没有将直接传输该文件
- **数据块级别**的增量传输是指只传输两文件所不同的那一部分数据。

两台计算机`Host-A`与`Host-B`，其中`Host-A`是源主机，即数据的发送端`Sender`，`Host-B`是目标主机，即数据的接收端`Receiver`。`Host-A`上存在文件`file-A`，`Host-B`上存在`file-B`。注：**`file-A`与`file-B`是同名文件。** rsync 的实现有以下过程：

1. `Host-A`告诉`Host-B`有文件`file-A`要传输。
2. `Host-B`收到信息后，将文件`file-B`划分为一系列大小固定的数据块(大小在 500-1000 字节之间)，并以 chunk 号码对数据块进行编号，同时还会记录数据块的起始偏移地址以及数据块长度。
3. `Host-B`对每一个分割好的数据块执行两种校验：一种是 32 位的滚动弱校验（rolling checksum），另一种是 128 位的 MD5 强校验。将`file-B`计算出的所有滚动弱校验和强校验码跟随在对应数据块`chunk[N]`后形成校验码集合，然后发送给主机`Host-A`

   > 不同数据块的滚动弱校验值有可能相同，但几率非常小。

4. `Host-A`通过搜索`file-A` 的所有该固定大小的数据块（偏移量可以任选），并计算它的校验码和校验码集合中的校验码进行匹配。

   - 如果能匹配上校验码集合中的某个数据块条目，则表示该数据块和`file-B`中数据块相同，不需要传输。
   - 如果不能匹配校验码集合中的数据块条目，则表示该数据块是**非匹配数据块**，它需要传输给`Host-B`，于是`Host-A`将跳转到**下一个字节**，从此字节处继续取数据块进行匹配。
     > 数据匹配过程有三个层次：首先比较 hash 值，然后比较弱滚动校验，最后比较强校验。

5. 当`Host-A`发现是匹配数据块时，将只发送这个匹配块的附加信息给`Host-B`。同时，如果两个匹配数据块之间有非匹配数据，则还会发送这些非匹配数据。
6. 当`Host-B`陆陆续续收到这些数据后，会创建一个临时文件，并通过这些数据重组这个临时文件，使其内容和`file-A` 相同。临时文件重组完成后，修改该临时文件的属性信息(如权限、所有者、mtime 等)，然后重命名该临时文件替换掉`file-B`。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120048047.png)

## rsync 的工作方式

- 本地传输方式：首先 rsync 命令执行时，会有一个 rsync 进程，然后根据此进程 fork 另一个 rsync 进程作为连接的对端，连接建立之后，后续所有的通信将采用管道的方式。
- 远程 shell 连接方式：本地敲下 rsync 命令后，将请求和远程主机建立远程 shell 连接（如 ssh 连接），连接建立成功后，在远程主机上将 fork 远程 shell 进程调用远程 rsync 程序，并将 rsync 所需的选项通过远程 shell 命令（如 ssh）传递给远程 rsync。这样两端就都启动了 rsync，之后它们将通过管道的方式进行通信。
- 网络套接字连接远程主机上的 rsync daemon：当通过网络套接字和远程已运行好的 rsync 建立连接时，rsync daemon 进程会创建一个子进程来响应该连接并负责后续该连接的所有通信。这样两端也都启动了连接所需的 rsync，此后通信方式是通过网络套接字来完成的。
- 远程 shell 临时启动一个 rsync daemon：不要求远程主机上事先启动 rsync 服务，而是临时派生出 rsync daemon，它是单用途的一次性 daemon，仅用于临时读取 daemon 的配置文件，当此次 rsync 同步完成，远程 shell 启动的 rsync daemon 进程也会自动停止。

发起连接的一端称为 Client 端，就是执行 rsync 命令的一端，连接的另一端称为 Server 端。

> 注：当 Client 端和 Server 端都启动好 rsync 进程并建立好了 rsync 连接(管道、网络套接字)后，将使用 Sender 端和 Receiver 端来代替 Client 端和 Server 端的概念。

当两端的 rsync 连接建立后，Sender 端的 rsync 进程称为`Sender`进程，该进程负责 Sender 端所有的工作。Receiver 端的 rsync 进程称为`Receiver`进程，负责接收 sender 端发送的数据，以及完成文件重组的工作。Receiver 端还有一个核心进程 **`Generator`** 进程，该进程负责在 Receiver 端执行`--delete`动作、比较文件大小和 mtime 以决定文件是否跳过、对每个文件划分数据块、计算校验码以及生成校验码集合，然后将校验码集合发送给 Sender 端。

三个进程的作业流程：`Generator`进程的输出结果作为`Sender`端的输入，`Sender`端的输出结果作为`Recevier`端的输入。并且，**这三个进程是完全独立、并行工作的。**

**数据同步方式**

- **推 push**：一台主机负责把数据传送给其他主机，服务器开销很大，比较适合后端服务器少的情况
- **拉 pull**：所有主机定时去找一主机拉数据，可能就会导致数据缓慢

## rsync 命令使用

```
本地传输方式:  rsync [OPTION...] SRC... [DEST]

远程shell连接方式:
    Pull: rsync [OPTION...] [USER@]HOST:SRC... [DEST]
    Push: rsync [OPTION...] SRC... [USER@]HOST:DEST

连接远程主机上的rsync daemon:
    Pull: rsync [OPTION...] [USER@]HOST::SRC... [DEST]
          rsync [OPTION...] rsync://[USER@]HOST[:PORT]/SRC... [DEST]
    Push: rsync [OPTION...] SRC... [USER@]HOST::DEST
          rsync [OPTION...] SRC... rsync://[USER@]HOST[:PORT]/DEST
```

若主机与路径用`:`分隔，则为 shell 连接，若为`::`，则为 daemon 连接。

**注：**源路径如果是一个目录的话，带上尾随斜线和不带尾随斜线是不一样的，**不带尾随斜线表示的是整个目录包括目录本身**，**带上尾随斜线表示的是目录中的文件，不包括目录本身。**

若只有源路径或只有目的路径，则相当于`ls -l`查看指定文件或目录属性。

**常用选项：**

```
-a        归档模式，表示递归传输并保持文件属性。等同于"-rtopgDl"。
-P        显示文件传输的进度信息
-v        显示rsync过程中详细信息(最多支持-vvvv)
-r        递归
-t        保持mtime属性(最好加上，否则时间会设置为当前系统时间，在增量备份时会因为时间出错)
-o 　　　　保持owner属性
-g 　　　　保持group属性(属组)。
-p 　　　　保持perms属性(权限，不包括特殊权限)。
-D　　　　 拷贝设备文件和特殊文件。
-l　　　　 如果文件是软链接文件，则拷贝软链接本身而非软链接所指向的对象。
-z 　　　　传输时进行压缩提高效率。
-R        使用相对路径。意味着将命令行中指定的全路径而非路径最尾部的文件名发送给服务端，包括它们的属性
-u      　仅在源mtime比目标已存在文件的mtime新时才拷贝。接收端判断，不会影响删除行为。
--size-only　　只检查文件大小（默认算法是检查文件大小和mtime不同的文件）
--max-size　　 限制rsync传输的最大文件大小。可以使用单位后缀，还可以是一个小数值(例如："--max-size=1.5m")
--min-size 　　限制rsync传输的最小文件大小。这可以用于禁止传输小文件或那些垃圾文件。
--exclude   　指定排除规则来排除不需要传输的文件。一个exclude只能指定一条规则，若有多条规则，就要写多个exclude
--exclude-from  若规则有多条，可以写在文件中，并使用此选项加载规则文件
--include     指定传输规则，只传输符合该规则的文件，与exclude相反
--delete    　接收端的rsync会先删除目标目录下已经存在，但发送端目录不存在的文件，以SRC为主，对DEST进行同步。多则删之，少则补之。注意"--delete"是在接收端执行的，所以它是在exclude/include规则生效之后才执行的。
-b --backup   对目标上已存在的文件做一个备份，备份的文件名后默认使用"~"做后缀。
--backup-dir  指定备份文件的保存路径，若指定，保存路径必须存在。
              不指定时默认和待备份文件保存在同一目录下。
              默认没有后缀，可通过"--suffix="指定
-e          　指定所要使用的远程shell程序，默认为ssh。
--port      　连接daemon时使用的端口号，默认为873端口。
--password-file　　daemon模式时的密码文件，是rsync模块认证的密码。
-W --whole-file　　rsync将不再使用增量传输，而是全量传输。在网络带宽高于磁盘带宽时，该选项比增量传输更高效。
--existing  　　        要求只更新目标端已存在的文件，目标端还不存在的文件不传输。注意，使用相对路径时如果上层目录不存在也不会传输。
--ignore-existing      要求只更新目标端不存在的文件。和"--existing"结合使用有特殊功能。
--remove-source-files  要求删除源端已经成功传输的文件。
```

> **最常用组合`-avz`。**

**命令示例：**

```
rsync -r -R  /etc/dir-1  /tmp         将/etc/dir-1目录复制到/tmp目录下，tmp目录下将会有etc/dir-1子目录
rsync -r -R  /etc/./dir-1  /tmp 将/etc/dir-1目录复制到/tmp目录下，但在/etc/和dir-1目录间加上了“.”
                                       因此仅仅将dir-1目录复制过去作为子目录，tmp目录下将有dir-1子目录
rsync -r -b --backup-dir --suffix='.bak' /etc/dir-1 /tmp   备份文件，若不存在就直接复制，若已存在就添加后缀以区分

rsync -r --exclude="*.txt" /etc/dir-1 /tmp   将/etc/dir-1目录下的以".txt"结尾的文件排除
rsync -r -v --delete --exclude="*.txt" /etc/dir-1 /tmp   将/tmp/dir-1中存在而/etc/dir-1不存在的文件删除，并且不删除".txt"结尾的文件（即使源中不存在）
sending incremental file list
deleting dir-1/a3.log
deleting dir-1/a2.log
deleting dir-1/a1.log


```

## 规则解析

**规则作用时间：**当发送端敲出 rsync 命令后，rsync 将立即**扫描命令行中给定的文件和目录**(扫描过程中还会按照目录进行排序，将同一个目录的文件放在相邻的位置)，这称为**拷贝树**(copy tree)，扫描完成后将待传输的文件或目录**记录到文件列表中**，然后将文件列表传输给接收端。**筛选规则的作用时刻是在扫描拷贝树时，所以会根据规则来匹配并决定文件是否记录到文件列表中**(严格地说是会记录到文件列表中的，只不过**排除的文件会被标记为 hide 隐藏起来**)，只有记录到了文件列表中的文件或目录才是真正需要传输的内容。**筛选规则的生效时间在 rsync 整个同步过程中是非常靠前的，它会影响很多选项的操作对象，最典型的如`--delete`**，`--delete`是在 generator 进程处理每个文件列表时、生成校验码之前进行的，这样就无需为多余的文件生成校验码。

**rsync 规则**：通过选项`--filter`指定规则

- `exclude`规则：即排除规则，只作用于发送端，被排除的文件不会进入文件列表(实际上是加上隐藏规则进行隐藏)。
- `include`规则：即包含规则，也称为传输规则，只作用于发送端，被包含的文件将明确记录到文件列表中。
- `hide`规则：即隐藏规则，只作用于发送端，隐藏后的文件对于接收端来说是看不见的，也就是说接收端会认为它不存在于源端。
- `show`规则：即显示规则，只作用于发送端，是隐藏规则的反向规则。
- `protect`规则：即保护规则，该规则只作用于接收端，被保护的文件不会被删除掉。
- `risk`规则：即取消保护规则。是`protect`的反向规则。
- `clear`规则：删除`include`/`exclude`规则列表。

> 上述内容都引用自[骏马金龙－rsync 介绍与用法](http://www.cnblogs.com/f-ck-need-u/p/7220009.html)

## Rsync 服务器搭建

实验环境：

- Rsync 服务器：192.168.205.135
- Rsync 客户端：192.168.205.134

首先，两台主机都需要安装 rsync，`yum/dnf install rsync`，fedora 已默认安装。

由于 rsync 的配置文件默认不存在，所以需要手动创建。Rsync 有三个配置文件：

- rsyncd.conf：主配置文件
- rsyncd.secrets：密码文件
- rsyncd.motd：服务器信息文件

创建`/etc/rsyncd.conf`文件，具体参数可通过`man rsyncd.conf`查看

配置文件分为两部分：全局参数，模块参数
全局参数：对 rsync 服务器生效，如果模块参数和全局参数冲突，冲突的地方模块参数生效
模块参数：定义需要通过 rsync 输出的目录定义的参数

```
# 常见全局参数：
port = 873                     监听端口
address = 192.168.205.135      监听服务器地址
uid = nobody                   数据传输时使用的用户ID，默认nobody
gid = nobody                   数据传输时使用的组ID，默认nobody
read only = yes                是否只读
max connections = 10           并发连接数，0表示无限制。超出并发连接数时若再访问，会收到稍后重试的消息
use chroot = no                是否开启chroot，若设为yes，rsync会首先进行chroot设置，将根映射到模块中path指定目录
                               需要root权限，在同步符号连接资料时仅同步文件名，不同步文件内容
transfer logging = yes           开启Rsync数据传输日志功能
#log format =                    设置日志格式，默认log格式为："%o %h [%a] %m (%u) %f %l"
# 默认log格式表达的是："操作类型 远程主机名[远程IP地址] 模块名 (认证的用户名) 文件名 文件长度字符数"
#syslog facility =               指定rsync发送日志消息给syslog时的消息级别，默认值是daemon
lock file = /var/run/rsync.lock  设置锁文件
log file = /var/log/rsyncd.log   设置日志文件
pid file = /var/run/rsyncd.pid   设置进程号文件
motd file = /etc/rsyncd.motd     设置服务器信息提示文件
hosts allow = 192.168.205.134    设置允许访问服务器的主机

# 模块配置
[rsync_test]
comment = rsync test   添加注释
path = /root/rsync_test     同步文件或目录路径
ignore errors                忽略一些IO错误
# exclude =                    可以指定不同步的目录或文件，使用相对路径
auth users = tom,jack        允许连接的用户，可以是系统中不存在的
secrets file = /etc/rsyncd.secrets   设置密码验证文件，该文件的权限要求为只读（600），该文件仅在设置了auth users才有效
list = false      是否允许查看模块信息
timeout = 600     可以覆盖客户指定的 IP 超时时间。确保rsync服务器不会永远等待一个崩溃的客户端。
                  超时单位为秒钟，0表示没有超时定义，这也是默认值。
                  对于匿名rsync服务器来说，一个理想的数字是600
```

相关系统操作：

```
useradd tom && echo "redhat" | passwd tom --stdin
echo "tom:redhat" >> /etc/rsyncd.secrets
echo "jack:redhat" >> /etc/rsyncd.secrets      添加用户到密码文件
chmod 600 /etc/rsyncd.secrets                  修改密码文件权限
echo "Welcome to Rsync" >> /etc/rsyncd.motd
# firewall-cmd --permanent --add-port=873/tcp  若开启了防火墙，就放行端口
rsync --daemon --config=/etc/rsyncd.conf         启动rsyncd服务
```

客户端同步文件：`rsync -r tom@192.168.205.135::rsync_test /root/rsync_test`

自动备份脚本，可配合 crond 使用

```
#!/bin/bash
# 本脚本是将服务器端的文件定期同步到本端
# 设置服务器端模块和本端目录
SRC=rsync_test
DEST=/root/rsync_test
Server=192.168.205.135
# 设置验证用户名和密码
User=tom
Password=redhat
# 若本地同步目录不存在，就创建目录。同步时会删除目录中本端存在，但服务器端不存在的文件
[ ! -d $DEST ] && mkdir $DEST
rsync -az --delete ${User}@${Server}::$SRC $DEST/$(date +%Y%m%d)
```

若使用 Xinetd 服务管理 Rsync，需要先安装 xinetd。创建文件`/etc/xinetd.d/rsync`，添加以下内容。

```
service rsync {
    disable = no
    socket_type = stream
    wait = no
    user = root
    server = /usr/bin/rsync
    server_args = --daemon --config=/etc/rsyncd.conf
    log_on_failure += USERID
}
```

然后重启 xinetd 服务即可。

## Rsync 部分报错解决

```
rsync: failed to connect to 192.168.205.135 (192.168.205.135): No route to host (113)
rsync error: error in socket IO (code 10) at clientserver.c(125) [Receiver=3.1.2]
```

解决：防火墙问题，放行端口或直接关闭

```
@ERROR: auth failed on module rsync_test
rsync error: error starting client-server protocol (code 5) at main.c(1648) [Receiver=3.1.2]
```

解决：用户名与密码问题或模块问题，检查用户名与密码是否匹配，服务器端模块是否存在

```
rsync: read error: Connection reset by peer (104)
rsync error: error in rsync protocol data stream (code 12) at io.c(759) [Receiver=3.1.2]
```

解决：服务器端配置文件/etc/rsyncd.conf 问题，检查配置文件参数是否出错

# Rsync+Inotify 文件自动同步

## Inotify 介绍

**Inotify**是一个 Linux 特性，是`inode notify`的简写，能监控文件系统操作，反应灵敏，异步传输信息，比 cron 高效，通过 Inotify 能试试了解文件系统发生的所有变化。

注：Linux 内核需要大于 2.6 才集成了 Inotify，先要通过 uname -r 查看内核版本

Inotify 一些特点：

- 允许程序员使用标准 `select` 或者 `poll` 函数来监视事件
- 使用一个独立的文件描述符，可以通过系统调用获得

使用 rsync 工具与 inotify 机制相结合，可以实现触发式备份（实时同步）。

在系统`/proc/sys/fs/inotify/`目录中有三个文件：

- `max_queued_events`：inotify 实例事件队列可容纳的事件个数，默认 16384
- `max_user_instances`：每个用户可以运行的 inotifywait 或 inotifywatch 命令的进程数，默认 128
- `max_user_watches`：每个进程最多监控文件数，默认 8192

> 若要监控的文件量较大时，需要适当增大这三个值

可以在`/etc/sysctl.conf`中添加以下内容修改这三个值，或通过`sysctl -w`直接设置。

```
fs.inotify.max_queued_events =
fs.inotify.max_user_instances =
fs.inotify.max_user_watches =
```

Inotify 常用的文件系统事件：

| 事件名                    | 描述                 |
| ------------------------- | -------------------- |
| IN_ACCESS                 | 文件访问事件         |
| IN_MODIFY                 | 文件修改事件         |
| IN_ATTRIB                 | 文件属性修改事件     |
| IN_OPEN                   | 文件打开事件         |
| IN_CLOSE_WRITE            | 可写文件被关闭事件   |
| IN_CLOSE_NOWRITE          | 不可写文件被关闭事件 |
| IN_MOVED_FROM IN_MOVED_TO | 文件移动或重命名事件 |
| IN_DELETE                 | 文件或目录删除事件   |
| IN_CREATE                 | 文件或目录创建事件   |
| IN_DELETE_SELF            | 自删除事件           |

若系统为 fedora，可直接安装`dnf install inotify-tools`，若系统为 CentOS，则需要先安装`epel-release`再安装`yum install inotify-tools`

inotify-tools 提供两个应用程序：`inotifywait`和`inotifywatch`

`inotifywait`命令用法：

```
inotifywait [options] file...
    @<file>        排除监控指定文件
    --exclude <pattern>    使用正则表达式匹配例外文件，区分大小写
    --excludei <pattern>   使用正则表达式匹配例外文件，不区分大小写
	-m|--monitor  	一直监听，不退出。若不加此项，监听到一个事件后就退出
	-d|--daemon   	相当于-m，但是是在后台运行，需要-o或--outfile指定输出文件，或者通过再指定--syslog将错误信息输出至syslog系统日志
	-r|--recursive	递归监控目录
	--fromfile <file>   从文件中读取需要监控与例外的文件名，每行一个文件，若文件名以@开头，表示例外文件
	-o|--outfile <file> 将事件信息输出到文件，默认输出到标准输出
	-s|--syslog   	将错误事件日志发送到syslog，而不是stderr
	-q|--quiet    	静默模式，只输出事件
	-qq           	静默模式，什么都不输出（包括事件）
	--format <fmt>	指定输出信息格式
	--timefmt <fmt>	设置时间格式
	-c|--csv      	使用CSV格式输出
	-t|--timeout <seconds> 在指定时间内若监听到事件，就退出
	-e|--event <event1> [ -e|--event <event2> ... ] 只监控指定事件
```

实例：`inotifywait -m -d -r -o /var/log/html_monitor /var/www/html`

然后进入`/var/www/html`进行以下操作

```
touch a.html
vim a.html
cp a.html b.html
rm a.html
chmod -r b.html
mv b.html a.html
```

在`/var/log/html_monitor`中就有以下信息

```
/var/www/html/ CREATE a.html
/var/www/html/ OPEN a.html
/var/www/html/ ATTRIB a.html
/var/www/html/ CLOSE_WRITE,CLOSE a.html
/var/www/html/ OPEN,ISDIR
/var/www/html/ ACCESS,ISDIR
.....
/var/www/html/ MOVED_FROM b.html
/var/www/html/ MOVED_TO a.html
```

仅仅几步操作，就生成了 170 多行事件信息。

##　 Inotify 与 Rsync 实时同步数据

要求分析：数据发布服务器既是 Rsync 服务器同时也是 Inotify 监控服务器，该服务器是用于发布数据的，将数据同步到 Web 服务器，实现 Web 服务器与此数据发布服务器的同步。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120048508.png)

实验环境：

- 数据发布服务器：192.168.205.135
- Web 服务器：192.168.205.134

首先需要在 Web 服务器上编写`rsyncd.conf`，添加模块

```
[www]
comment = web file dictionary
path = /var/www/html
auth users = www
secrets file = /etc/rsyncd.secrets
hosts allow = 192.168.205.135
```

进行系统准备：

```
# 在Web服务器上创建用户www
useradd www && echo "redhat" | passwd www --stdin
echo "www:redhat" >> /etc/rsyncd.secrets
chmod 600 /etc/rsyncd.secrets
查看/var/www是否所属于www，若不是就chown -R www:www /var/www

# 在数据发布服务器上
ssh-keygen
ssh-copy-id -i ~/.ssh/id_rsa.pub www@192.168.205.134
# 在Web服务器上，同理，双向交换ssh公钥
ssh-copy-id -i ~/.ssh/id_rsa.pub root@192.168.205.135
```

数据发布服务器上触发同步脚本示例：

```
#!/bin/bash
SRC=/var/www/web_html/
DST=www@192.168.205.134::www
/usr/bin/inotifywait -d -r -o var/log/inotify_web -e modify,delete,create,attrib ${SRC} | while read line
do
    /usr/bin/rsync -az --delete ${SRC} ${DST} 2>&1
done &
```

加上执行权限`chmod a+x`并写入`/etc/rc.local`，`echo "脚本名" >> /etc/rc.local`

# 参考文章

- [rsync](https://www.cnblogs.com/george-guo/p/7718515.html)
- [Rsync 原理详解及部署](http://blog.51cto.com/atong/1344829)
- [Rsync 完全手册](http://www.cnblogs.com/f-ck-need-u/p/7220009.html)
- [inotify+rsync+mutt+msmtp 实现 linux 文件或者目录自动更新并且实现发邮件给管理员](http://blog.51cto.com/chenhao6/1298375)
- Linux 运维之道（第二版）
- [真正的 inotify+rsync 实时同步 彻底告别同步慢](http://www.ttlsa.com/web/let-infotify-rsync-fast/)

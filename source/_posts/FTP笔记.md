---
title: FTP笔记
date: 2018-06-06 00:07:17
tags: [ftp, server]
categories: [应用运维]
---

本篇笔记包含以下内容

- [FTP 原理](#ftp-%e5%8e%9f%e7%90%86)
- [VSFTP 搭建](#vsftp-%e6%90%ad%e5%bb%ba)
  - [服务器端](#%e6%9c%8d%e5%8a%a1%e5%99%a8%e7%ab%af)
    - [配置文件`/etc/vsftpd/vsftpd.conf`简单解析](#%e9%85%8d%e7%bd%ae%e6%96%87%e4%bb%b6etcvsftpdvsftpdconf%e7%ae%80%e5%8d%95%e8%a7%a3%e6%9e%90)
    - [认证访问控制](#%e8%ae%a4%e8%af%81%e8%ae%bf%e9%97%ae%e6%8e%a7%e5%88%b6)
    - [使用本地用户认证](#%e4%bd%bf%e7%94%a8%e6%9c%ac%e5%9c%b0%e7%94%a8%e6%88%b7%e8%ae%a4%e8%af%81)
    - [使用虚拟账户](#%e4%bd%bf%e7%94%a8%e8%99%9a%e6%8b%9f%e8%b4%a6%e6%88%b7)
  - [常用客户端软件](#%e5%b8%b8%e7%94%a8%e5%ae%a2%e6%88%b7%e7%ab%af%e8%bd%af%e4%bb%b6)
- [TFTP 原理](#tftp-%e5%8e%9f%e7%90%86)

<!-- more -->

## FTP 原理

File Transfer Protocol 文件传输协议，基于 TCP 协议，采用 C/S 模式，控制连接端口 21，数据连接端口 20。

- 控制连接：负责 FTP 客户端与服务器交互命令与信息的传输，在整个会话过程中始终打开。
- 数据连接：负责客户端与服务器数据的传输，传输完毕就会关闭

**文件类型：** 一共有４种，但目前主流仅支持以下两种。

1. ASCII：默认模式，发送方将文件转为 ASCII 码传输，适合文本文件传输
2. 二进制：也称图像文件传输模式，按比特流传输，适合程序文件传输

**格式控制**：有三种选项，但目前主流配置只允许**非打印**。非打印：表示文件中不含有垂直格式信息。

**数据结构**：有四种选项，但主流配置只允许**文件结构**。文件结构认为数据是一个连续的字节流。

**传输模式**：有四种选项，但主流仅允许**流方式**，文件以字节流形式传输。对于文件节后，发送方在文件结束处提示关闭数据连接。

**数据传输方式：**

- 主动 PORT

1. 首先客户端（随机端口）与服务器（21 端口）TCP 三次握手建立连接，建立控制连接通道
2. 客户端向服务器发送 PORT 命令，告知服务器使用主动模式。
   其中 PORT 命令携带参数（客户端 IP 地址, P1, P2），P1 与 P2 用于标识客户端数据连接的临时端口号，具体为 256\*P1+P2，IP 地址也是四段，每段用逗号分隔
3. 服务器收到 PORT 命令后按照参数用 20 端口与客户端指定端口三次握手建立数据传输通道。
4. 数据传输完毕，发送方发送 FIN 报文，关闭数据连接

> 注：若客户端在防火墙内部网络，主动方式会出现问题，因为客户端提供的端口是随机的，防火墙若未放行该端口，则无法建立 FTP 连接。此时需要使用**被动方式**建立连接

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120037732.png)

- 被动 PASV

1. 首先客户端（随机端口）与服务器（21 端口）TCP 三次握手建立连接，建立控制连接通道
2. 客户端向服务器发送 PASV 命令，参数与 PORT 一致。但 IP 是服务器的，标识的是服务器端的临时端口号。
3. 客户端用随机端口与服务器的指定临时端口 TCP 三次握手建立数据连接通道。
4. 数据传输完毕，发送方发送 FIN 报文，关闭数据连接

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120037599.png)

**FTP 应答格式：**
服务器端处理完命令后，会将状态信息，如命令是否执行成功、出错类型、是否就绪等，通过控制连接发送给客户端，即应答。应答的目的就是对数据传输过程进行同步，也为了让客户端了解服务器目前的状态。

FTP 应答由 3 个 ASCII 码数字组成，并跟随解释性文本符号。数字面向机器，文本面向用户。

- 第一位：
  - 1：确定预备应答：仅仅是在发送另一个命令前期待另一个应答时启动
  - 2：确定完成应答：要求的操作已完成，可接受新命令
  - 3：确定中间应答：该命令已被接受，另一个命令必须被发送
  - 4：暂时拒绝完成应答：请求的命令没有执行，但差错状态是暂时的，命令以后可以再发。
  - 5：永久拒绝完成应答：该命令不被接受，并要求不要再重试。
- 第二位：
  - 0：语法错误
  - 1：一般性的解释信息
  - 2：与控制和数据连接有关
  - 3：与认证和账户登录过程有关
  - 5：与文件系统有关
- 第三位：未明确规定，指示对第二位的进一步细化。

**常见 FTP 应答：**

- 110：重新启动标记应答
- 120：服务在多久时间内准备
- 125：数据连接打开，传输开始
- 150：文件状态正常，打开数据连接端口
- 200：命令执行成功
- 202：命令执行失败
- 211：系统状态或是系统求助响应
- 212：目录的状态
- 213：文件的状态
- 214：帮助信息
- 215：名称系统类型
- 220：新的联机服务准备
- 221：服务控制连接关闭，可注销
- 225：数据连接开启，但无传输动作
- 226：关闭数据连接端口，请求的文件操作成功
- 227：进入 passive modes
- 250：请求的文件操作完成
- 331：用户名已接受，需要输入密码
- 332：登录时需账号信息
- 350：请求的命令需要进一步的命令
- 421：无法提供服务，关闭控制连接
- 425：无法开启数据连接
- 426：关闭联机，终止传输
- 450：请求的操作未执行
- 451：命令终止，有本地错误
- 452：未执行命令，磁盘空间不足
- 500：格式错误，无法识别命令
- 501：参数语法错误
- 502：命令执行失败
- 503：命令顺序错误
- 504：命令所接的参数不正确
- 530：未登录
- 532：存储文件需要账户登录
- 550：未执行请求的操作
- 551：请求的命令终止，类型未知
- 552：请求的文件终止，储存位溢出
- 553：未执行请求的命令，名称不正确

## VSFTP 搭建

Very Secure FTP 安全文件传输软件。针对系统的程序权限设计，有以下特点：

- 将 PID 的权限降低
- 使用 chroot 机制
- 服务的启动者就是一个一般用户
- 任何需要执行具有较高执行权限的 VSFTP 指令都由特殊的上层程序控制

VSFTPD 有两种启动方式：

- stand alone：CentOS 默认使用该方式启动 VSFTPD，适合主要用于提供大量下载的任务，服务速度快。使用 systemd 管理就是 stand alone
- super daemon：适合内部人员小范围使用。使用 xinetd 管理就是 super daemon

### 服务器端

安装 vsftpd 服务
`yum install vsftpd`
`systemctl enable vsftpd`
`systemctl start vsftpd`

安装完在`/etc/vsftpd`中有四个默认文件：

- `ftpusers`：指定哪些用户不能访问 FTP 服务器，即黑名单
- `user_list`：实行访问控制的用户列表
- `vsftpd.conf`：VSFTP 主配置文件
- `vsftpd_conf_migrate.sh`：VSFTPD 操作的一些变量和设置的脚本

#### 配置文件`/etc/vsftpd/vsftpd.conf`简单解析

```
listen = YES            # IPv4监听，默认是以StandAlone方式启动
listen_ipv6 = NO        # IPv6监听
                        # ipv6监听若v4为yes则v6必须为no,同理v6为yes则v4为no
listen_address =        # 监听的IP地址
listen_port = 21        # 监听的端口
port_enable = YES       # 开启端口监听
ftp_data_port = 20      # 数据传输端口20
connect_from_port_20=YES  # 数据连接的端口号
pasv_enable = YES       # 是否启用被动连接
pasv_max_port =         # 被动连接的最大端口号
pasv_min_port =         # 被动连接的最小端口号

connect_timeout = 60    # 主动连接若60秒tcp无法建立就不建立了
accept_timeout = 60     # 被动连接若60秒tcp无法建立就不建立了
max_clients = 2000      # 最多允许2000用户同时登录（0为不限制）
max_login_fails = 3     # 最多允许3次登录失败
max_per_ip = 20         # 同一地址最多允许多少连接（0为不限制）
data_connection_timeout = 300   # 数据连接超时时间（数据无响应）就断开
idle_session_timeout = 300      # 用户登录上后无操作时间300s则断开

user_config_dir = /etc/vsftpd/conf  #
dirmessage_enable=YES   # 是否启用目录提示信息，默认YES。
                        # 当用户进入某个目录时，会先检查该目录是否存在message_file参数指定的文件
                        # 若有就显示文件中的内容，通常用于放置欢迎语或目录说明
message_file =          # 设置文件路径，该文件用于存放目录的说明或欢迎语（当dirmessage_enable为YES时生效）

xferlog_enable=YES      # 是否启用详细记录上传下载的日志功能，日志文件路径由xferlog_file指定
xferlog_file = /var/log/xferlog    # 设置文件路径，该文件用于存放目录的说明或欢迎语（当xferlog_enable为YES时生效）
pam_service_name=vsftpd   # PAM认证服务配置文件名，放在/etc/pam.d/目录中
tcp_wrappers=YES          # 开启TCP_wrappers防火墙，用于在一定程度上限制某种服务的访问权限
ftpd_banner =             # 登录FTP服务器时的欢迎语，默认为空

download_enable = YES     # 是否允许下载
userlist_enable = YES     # 是否启用用户名单（对名单中的用户进行访问控制）
chroot_list_enable = YES  # 是否启用锁定用户在自己的主目录中的功能。
                          # 被锁定的用户登录FTP服务器后只能进入自己的主目录，不能进入其他目录，默认为NO，应该禁用。
                          # 锁定的用户名单文件由chroot_list_file参数指定
chroot_local_user = YES   # 是否将用户限制在自己的根目录中
chroot_list_file = /etc/vsftpd/chroot_list  # 实行或不实行chroot的用户名单，默认就是该文件。文件中是一个用户一行记录
                          # 若chroot_list_enable为enable，则该文件中的用户会chroot
                          # 若chroot_local_user为enable（chroot_list_enable为enbale仍为前提），则该文件中的用户不会chroot
write_enable = YES        # 是否允许修改，默认NO
userlist_enable=YES       # 当用户登录FTP服务器时，在输入完账户名后，服务器会根据userlist_file中指定的用户列表进行控制
                          # 若在该文件中，则禁止该用户输入密码。默认NO
userlist_file = /etc/vsftpd/user_list    # 禁止访问的，默认该文件
uesrlist_deny = NO        # 是否不允许该文件中的用户登录ftp，需要userlist_enable=YES
                          # NO表示只允许该文件中的用户访问，YES表示禁止文件中的用户登录FTP
use_localtime = YES       # VSFTPD默认使用GMT（格林威治）时间，为防止文档时间错误，需要改为YES，即使用本地时间
banner_file = /etc/vsftpd/welcome.txt    # 当用户登录时会显示的文字，文件必须存在
```

#### 认证访问控制

VSFTPD 提供三种认证方式：

- 匿名访问 anoymous：无需认证即可登入
- 本地用户 local：使用 ftp 服务器中的用户登录
- 虚拟用户：创建独立 ftp 账户。是最安全的

**匿名访问**
无需提供真正用户名和密码就能登录 FTP 服务器。最好不要开启匿名登录，若要开启就进行限制行为。

- 只允许匿名用户使用少量基本的操作命令
- 限制文件下载数量，不要允许上传
- 限制匿名登录的最大同时联机数

配置文件相关参数：

```
anonymous_enable = YES    # 是否允许匿名用户登录，默认YES
                          # 因为是匿名模式，所以要开启。否则尽量不要匿名访问
anon_umask = 077          # 匿名用户创建文件的umask值，默认077，此时匿名传递的文档权限为600
anon_root = /var/ftp/anon # 匿名用户的ftp根目录
anon_upload_enable = NO   # 允许匿名用户上传文件（这项生效的条件为write_enable为YES且ftp匿名用户对该目录有写权限），默认NO
anon_mkdir_writable_enable = NO    # 是否允许匿名用户创建目录（需要该目录的父目录的写权限），默认为NO
anon_other_writable_enable = NO    # 是否开放匿名用户其他写入权限，最好关闭
anon_world_readable = YES          # 仅允许匿名用户下载可读文档
anon_max_rate = 0         # 匿名用户最大传输速率，0为不限制，单位字节/秒
# 传输速率的控制大概有20%的上下浮动，即范围为速度*80%到120%
no_anon_password = NO     # 匿名用户登录是否需要密码（NO为需要，YES为不需要，默认为NO）
                          # 若为需要，登录时输入任意字符串即可
```

在客户端上匿名登录 ftp 服务器：只要在输用户名时输入 anonymous，并任意输入字符串作为密码

**本地用户**
使用 ftp 服务器本地的用户进行登录，会更加安全，也是最常用的方式。

配置文件相关参数：

```
local_enable = YES        # 允许本地用户登录ftp，默认YES，在实际工作环境中，应该将这项设为NO
local_umask = 022         # 本地用户上传文件的umask，默认为077
local_root = /var/ftp     # 本地用户的根目录
local_max_rate = 0        # 本地用户最大传输速率，0为不限制，单位字节/秒
```

**虚拟用户**

本地用户登录时会自动转为虚拟用户，即使有大量用户登录，但最终也仅仅转为一个虚拟用户，避免了创建大量的系统用户。

```
guest_enable = YES        # 是否开启虚拟账户
guest_username = ftp      # 虚拟账户映射的用户名
```

#### 使用本地用户认证

创建 FTP 用户限制该用户仅能登录 FTP 服务器`useradd ftpuser -s /sbin/nologin`并设置密码。
为该用户创建一个主目录，即用户登录 FTP 后的根目录。
`mkdir -p /data/ftp/ftpuser/pub`。
其中`/data/ftp/ftpuser`为用户`ftpuser`的主目录，该目录不得上传文件，该目录下的`pub`目录供 ftpuser 用户上传文件。
`usermod -d /data/ftp/ftpuser ftpuser`
`chmod a-w /data/ftp/ftpuser`
`chmod a+w -R /data/ftp/ftpuser/pub`

配置文件中几条修改项：

```
local_enable = YES
local_root = /data/ftp
```

#### 使用虚拟账户

首先创建虚拟用户文件`/etc/vsftpd/visualusers`，文件中列出虚拟用户名和密码

```
ftp_visual_1
123456
ftp_visual_2
234567
```

生成虚拟用户数据库（可选）。需要工具`libdb4-utils`（Berkeley DB 工具，CentOS 中是该软件包）

`db_load -T -t hash -f /etc/vsftpd/visualusers /etc/vsftpd/visualusers.db` ，然后修改该备份文件的访问权限`chmod 600 /etc/vsftpd/{visualusers,visualusers.db}`

创建 PAM 文件，设置账户验证。

PAM 配置文件位于`/etc/pam.d/vsftpd`，该文件的名称取决于 vsftpd 主配置文件的`pam_service_name`字段。将默认配置注释，然后添加以下内容：

```
auth required /lib64/security/pam_userdb.so db=/etc/vsftpd/visualusers.db
account required /lib64/security/pam_userdb.so db=/etc/vsftpd/visualusers.db
```

所有的虚拟用户都需要映射到一个真实的系统用户，因此需要添加一个系统账户并设置家目录。

`useradd -s /sbin/nologin -d /home/virtual virtual`

查看修改主配置文件（有的不用改）：

```
local_enable = YES
chroot_local_user = YES
pam_service_name = vsftpd
user_config_dir = /etc/vsftpd/visual_config     # 设置虚拟用户配置文件主目录
```

创建虚拟用户配置文件的存放目录`/etc/vsftpd/visual_config`，这样可以为每个账户做单独的权限设置

创建用户`visual`的独立配置（举例）：

```
# vim /etc/vsftpd/visual_config/visual
guest_enable = YES
guest_username = ftp_visual_1
anon_max_rate = 100000
```

### 常用客户端软件

## TFTP 原理

Trivial File Transfer Protocol 简单文件传输协议，基于 UDP 协议，端口号 69
**特点：**

- 仅提供简单文件传输功能（上传，下载）
- 无存取授权与认证机制，无目录功能
- 由客户端发起

**下载过程：**

1. 客户端向服务器发送读请求
2. 服务器根据请求回应数据报文（块编号从 1 开始）
3. 客户端收到数据后回应确认报文。重复 2.3 步直至完成下载

**上传过程：**

1. 客户端向服务器发送写请求
2. 服务器回应确认报文（块编号为 0）
3. 客户端发送数据报文（块编号从 1 开始）
4. 服务器收到后回应确认报文。重复 3，4 步直至上传完成

> 文件传输时，将文件分成多个文件块，封装到数据报文中并打上文件块编号

**传输文件模式：**

- netASCII：对应 FTP 的 ASCII 模式
- octet：对应 FTP 二进制模式

**协议报文：**

- RRQ 读请求报文
- WRQ 写请求报文
- 数据报文
- 确认正确/错误报文

报文的头两个字节是操作码字段，1 为读请求，2 为写请求，3 为数据报文，4 为确认正确，5 为错误。
文件传输过程中读写出错就发送差错报文，数据传输就停止，差错报文不会被确认也不会重传。
TFTP 每次传输的数据报文中文件块大小固定为 512 字节，若文件大小刚好是 512 字节的整数倍，则传完文件后还要再发一个空文件块的数据报文表明文件传输完成。

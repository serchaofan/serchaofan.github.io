---
title: Samba基础学习笔记
date: 2018-05-02 17:18:06
tags: [server, Samba]
---

本篇笔记包含以下内容：

- [Samba 原理](#Samba原理)
- [Samba 基础配置](#Samba基础配置)
  - [服务器端](#服务器端)
  - [客户端](#客户端)

<!-- more -->

{% asset_img sambalogo.jpg %}

# Samba 原理

Samba 最初的目的是为了 Windows 和 Linux 之间的沟通，实现不同操作系统的资源共享，如今成为了十分安全，高效的文件服务。
Samba 有以下主要功能：

- 共享文件与打印机
- 提供身份认证，给不同身份的用户不同的访问权限和文件
- 可进行域名解析，将计算机的 NetBIOS 名解析为 IP 地址
- samba 能收集局域网上用户广播的主机信息，提供检索服务，也称为浏览服务，能显示共享目录，打印机等资源
- 支持 SSL

Samba 整合了 SMB 协议和 NetBIOS 协议，基于 TCP/IP。
**NetBIOS 协议**
NetBIOS（Network Basic Input/Output System），网络基本输入输出系统协议，属于会话层协议。能通过该协议获取计算机主机名，并解析为 IP 地址。
**SMB 协议**
SMB（Send Messsage Block），运行于 NBT 协议（NetBIOS over TCP/IP），属于表示层与应用层协议。端口号：139/TCP，137、138/UDP。

**SMB 协议工作流程**

1. 协议协商
   客户端向 Samba 服务器发送 Negport 请求报文，列出所有支持的 SMB 版本。服务器收到后回应 Negport 报文，列出希望客户端使用的 SMB 版本。
2. 建立连接
   确定了 SMB 版本，客户端会发送 Session Setup 请求报文，包含用户名与密码，建立连接。服务器收到后进行验证并回应报文，若验证通过，就返回为该用户分配的唯一 UID，若失败则返回失败信息。
3. 访问共享资源
   客户端向服务器发送 Tree Connect 请求报文，包含要访问的共享资源名。服务器收到后，根据配置文件确定是否该用户能访问，返回一个响应报文，若允许访问，就给该用户与共享资源连接分配一个 TID，用户即可访问该资源。
4. 断开连接
   客户端向服务器发送 Tree Disconnect 报文，请求服务器断开连接，服务器也回应一个响应，并断开连接。

**Samba 守护进程**

- 用户若要访问 Windows 上的公共资源，必须加入该 Windows 主机的群组 Workgroup，并该用户主机必须设置一个主机名（不是 hostname），该主机名是建立在 NetBIOS 协议上的，可称为 NetBIOS Name，在同一个群组中，该 NetBIOS Name 必须唯一。
- 用户是否能访问并对该文件进行操作不仅需要通过服务器身份认证，还需要对该文件具有权限。

Samba 服务有两个守护进程

- smbd：用于管理 samba 主机共享目录、文件、打印机等，利用 TCP 传输文件，开放端口为 139/TCP 和 445/TCP
- nmbd：用于管理群组、NetBIOS Name 的解析，基于 UDP，开启端口 137/UDP，138/UDP 进行解析

Samba 安装包：

- samba：包含 samba 的守护进程文件，samba 文档，logrotate 配置文件，开机默认选项配置文件
- samba-common：包含 samba 主要配置文件 smb.conf，配置文件检查程序 testparm 等
- samba-client：samba 客户端程序，提供客户端操作指令集

# Samba 基础配置

实验环境：

- 两台虚拟机：
  samba 服务器：192.168.163.103/24
  samba 客户端：192.168.163.104/24
- 系统：CentOS7
- Selinux：未开启
- firewalld：未开启

## 服务器端

**安装 samba 客户端**

```
yum install samba-common samba
systemctl enable smb nmb
systemctl start smb nmb
```

**创建共享目录，可随意创**
`mkdir /var/smbshare`
**修改配置文件`/etc/samba/smb.conf`**
配置文件中可在选项前加`;`使其不生效，相当于`#`注释
配置文件存在以下配置块：
`[global]` 全局选项，对所有资源生效
基础配置则不需要修改

```
[global]
    workgroup = SAMBA   #设置群组
    server string = Samba Server #设置服务器描述
    netbios name = MYSERVER #设置NetBIOS Name
    interfaces = lo eth0 192.168.163.0/24 # 设置监听接口、IP地址
    hosts allow = 192.168.163. #白名单，设置允许的主机网段
    hosts deny = #黑名单，黑白名单设置一个即可
    security = user     #samba的安全模式，有三种模式：user、share、server
    #user模式为每次访问服务器都会登录验证，share模式为不需登录。官方仅推荐user模式。
    passdb backend = tdbsam #存放用户信息，有两种选择tdbsam和lsapsam，tdbsam不需要额外配置
    log file = /var/log/samba/log.%m #设置日志文件路径，%m会替换为请求连接的NetBIOS名
	username map = /etc/samba/smbusers #设置用户映射，记录samba账号和虚拟账号的对应关系

    #---打印配置---
    printing = cups #打印配置，使用cups服务
    printcap name = cups #通常设置为printcap文件
    load printers = yes #自动加载打印机列表
    cups options = raw #设置cups的选项，raw为允许在windows客户端上加载驱动

```

`[homes]`为特殊共享目录，表示用户主目录
`[printers]`为特殊共享目录，表示打印机
配置共享资源：

```
[smbshare]
    comment = smbshare  #资源描述
    path = /var/smbshare #共享目录
    public = no #是否允许匿名访问
    guest ok = no #是否允许不输入密码访问
    printable = Yes #是否可读
    writable = yes #是否可写，只有该目录有写权限且此项为yes，才能写入
    browseable = yes #是否可见
    write list = mike #设定特定用户写权限
    #若writable为no，此项仍能生效
    create mask = 0600 #创建文件默认权限
    directory mask = 0775 #创建目录默认权限链路
    hosts allow =192.168.163. #白名单
```

可通过`testparm`检查配置文件是否正确
可通过`man smb.conf`查看详细配置文件选项
**创建用户并添加到 samba**
由于该用户是提供给客户端用于登录 samba 的，所以在服务器端应设置为不能登陆，并且为了安全性，不要设密码。
`useradd mike -s /sbin/nologin`
**注：**samba 并不是将系统中的用户变为 samba 用户的，samba 的用户是独立于 linux 系统的，但必须在 linux 系统中存在，才能映射，所以 linux 系统中需要创建同名用户。
将用户添加到 smb 服务器的用户列表中，并设置 smb 登录密码
`smbpasswd -a mike`，然后输入登录密码

```
smbpasswd [options] [username]
	-a  add添加
	-d  disable禁止用户访问
	-n  no password不设置密码，需要smb.conf中global设置nullpasswords=true开启
	-x  delete删除用户
```

或者使用另一条命令`pdbedit`，用于管理 SMB 服务的账号信息数据库
`pdbedit -a -u mike`

```
pdbedit [options] [username]
    -a 添加
    -x 删除
    -L 列出用户列表
    -v 详细信息
```

**注：**

- 若安装并开启了 firewalld，需要开启端口 TCP139 端口，UDP137、138 端口，并放行服务 samba。
- 若安装并开启了 Selinux，需要添加上下文

```
chcon -R -t samba_share_t /var/smbshare
或semanage fcontext -a -t samba_share_t /var/smbshare
然后
setsebool -P samba_export_all_rw on
setsebool -P samba_export_all_ro on
若分享的是/home
setsebool -P samba_enable_home_dirs on
配置完后restorecon -Rv /var/smbshare
```

## 客户端

**安装 samba 客户端**
`yum install samba-client cifs-utils`
`cifs-utils`是让 Windows 系统能使用公共文件系统的工具。
`CIFS`是微软开发的公共 Internet 文件系统协议，能够支持网上邻居。
**查看服务器给指定用户提供的共享目录的信息**

```
# smbclient -L //192.168.163.103/smbshare -U mike
Enter SAMBA\mike's password:

        Sharename       Type      Comment
        ---------       ----      -------
        print$          Disk      Printer Drivers
        share           Disk      SHARE
        smbshare        Disk      smbshare
        IPC$            IPC       IPC Service (Samba 4.7.1)
        mike            Disk      Home Directories
Reconnecting with SMB1 for workgroup listing.

        Server               Comment
        ---------            -------

        Workgroup            Master
        ---------            -------
        SAMBA                SYSTEM3
```

从返回信息可得知共享资源以及群组和服务器名
**登录 smb 服务器，进入指定资源**

```
# smbclient //192.168.163.103/smbshare -U mike
Enter SAMBA\mike's password:
Try "help" to get a list of possible commands.
smb: \>
```

已进入该共享目录，并进入 samba 客户端命令行模式，可通过`help`查看能进行的操作
常用命令如下：
`put [本机文件路径] [资源中相对路径]` 上传文件
`get [资源路径]` 下载文件

**客户端挂载**

- 创建认证文件

```
# vim /root/secure/auth.smb
username=mike
password=redhat
domain=SAMBA
```

设置该文件的权限，这个文件的机密性很重要
`chmod 700 /root/secure`
`chmod 600 /root/secure/auth.smb`

- 挂载共享目录
  `mount -t cifs -o rw,credentials=/root/secure/auth.smb //192.168.163.103/smbshare /shares/smbshare`

**Windows 端登录及挂载**
在 Windows 端，可在文件资源管理器的地址栏输入`\\192.168.163.103\smbshare`登录进入 smb 服务器的该资源。
若要挂载，在“此电脑”中右击，选择“添加一个网络位置”，按“下一步”，进入以下界面，填入要挂载的共享目录

{% asset_img guazai1.PNG %}

然后不断“下一步”，即可设置完成。在“此电脑”查看，已成功挂载。

{% asset_img guazai2.PNG %}

---
title: Postfix邮件服务器笔记
date: 2018-08-01 21:04:56
tags: [Postfix, 邮件服务, sendmail]
categories: [系统运维]
comments: false
---

- [邮件服务概述](#邮件服务概述)
  - [Mail 与 DNS 的相关性](#mail-与-dns-的相关性)
  - [邮件传送流程](#邮件传送流程)
- [常见邮件服务或协议](#常见邮件服务或协议)
  - [SMTP](#smtp)
    - [使用 SMTP 协议发送邮件](#使用-smtp-协议发送邮件)
  - [POP](#pop)
  - [IMAP](#imap)
- [邮件服务器搭建](#邮件服务器搭建)
- [参考文章](#参考文章)

<!--more-->

# 邮件服务概述

## Mail 与 DNS 的相关性

mail server 需要有一个合法的域名存在于 DNS 服务器上（不是一定要自己架设 DNS 服务器），可以找 ISP 或 DNS 服务商等注册。

只要有主机名称对应到 IP ，即是有 A ( Address )这个 DNS 的标志后，那么就可以架设 mail server 了。

MX（Mail Exchanger）这个 DNS 设定中的标志，主要就是要给 mail server 用的，可以让 Internet 上面的信件马上找寻到 Mail 主机的位置，并且 MX 后面可以接数字，一个 domain 或者是一个主机可以有多个 MX 标志。当主要的 mail server 挂点时，由于有 MX 标号，信件不会直接退回，而是跑到下一个 MX 设定的主机去，并且暂存在该处，等到主要的 mail server 起来之后，这个 MX 设定的主机就会将信件传送到目的地。当有了 MX 标志之后，要传送 mail 的时候，可以直接依据 DNS 的 MX 标志直接将信件传送到该设定的 MX 邮件主机，而不需要去寻问到底邮件要寄到哪里去，实现**邮件路由**。

## 邮件传送流程

- MUA（Mail User Agent）：邮件用户代理，即邮件客户端，用于收发邮件
- MTA（Mail Transfer Agent）：邮件传送代理，即邮件服务，具有收受邮件和转递邮件的功能
- MDA（Mail Delivery Agent）：邮件递送代理，是 MTA 下的一个程序。用于分析 MTA 收到的新建表头或内容等资料，决定这封邮件的去向，即 MTA 的转递功能是由 MDA 完成的。且 MDA 能过滤垃圾邮件、自动回复
- Mailbox：邮件信箱，即某个用户专用的邮件存放点，Linux 默认的信箱目录为`/var/spool/mail`
- MRA（Mail Receive Agent）：邮件接收代理。当用户端收受信件时，使用的是 MRA 的 POP3, IMAP 等通讯协定，并非 MTA 的 SMTP。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120102583.png)

步骤：

1. 获取本地 MTA 的使用权限，即向 MTA 注册邮箱账号密码
2. 编写邮件，传送到 MTA。邮件包含：标头（收寄件人邮箱，标题）、内容
3. 若该邮件的目的是本地端 MTA 账号，会通过 MDA 发往本地的 mailbox
   若该邮件的目的是远端 MTA，则开始转递，向下一跳 MTA 的 25 端口发送
4. 对方 MTA 接收邮件，等待远端用户读取

# 常见邮件服务或协议

## SMTP

SMTP（Send Mail Transfer Protocol）：是一种**发送邮件**的协议，使用 TCP 的 25 端口。在建立一个 TCP 连接后，在这个连接上进行控制、应答与数据发送。客户端以文本发送请求，服务器端回复 3 个数字的应答。

客户端常见指令

| 指令                          | 说明                       |
| ----------------------------- | -------------------------- |
| `HELO \<domain\>`             | 开始通信                   |
| `EHLO \<domain\>`             | 开始通信（扩展 HELO）      |
| `MAIL FROM: \<reverse-path\>` | 发送人                     |
| `RCPT TO: \<forward-path\>`   | 接收人                     |
| `DATA`                        | 发送电子邮件的正文         |
| `RSET`                        | 初始化                     |
| `VERY \<string\>`             | 确认用户名                 |
| `EXPN \<string\>`             | 将邮件组扩展为邮件地址列表 |
| `NOOP`                        | 请求应答                   |
| `QUIT`                        | 关闭                       |

> **每个指令和应答最后必须追加换行指令 CR、LF**

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120102646.png)

由于 SMTP 不具备验证发送者的功能，因此无法避免垃圾邮件，但也可通过 POP before SMTP 或 SMTP 认证对发送者认证。并且，**邮件收发双方必须同时在线，否则邮件会发送失败。**

### 使用 SMTP 协议发送邮件

首先检查本机的 25 号端口是否开启。在 root 用户上向本地用户 tom 发送邮件。

```
[root@s1 ~]# telnet 127.0.0.1 25        # 使用telnet连接本地25端口
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.
220 s1.localdomain ESMTP Postfix
helo s1            # 开始通信，跟上主机名
250 s1.localdomain
mail from:root     # 发送方
250 2.1.0 Ok
rcpt to:tom        # 接收方
250 2.1.5 Ok
data               # 开始正文
354 End data with <CR><LF>.<CR><LF>
hello
hello
hello
.             # 单独换一行，并打.  ，再换行结束正文
250 2.0.0 Ok: queued as E4B5D20E4560
quit          # 退出
221 2.0.0 Bye
Connection closed by foreign host.
```

切换到 tom 用户

```
[tom@s1 ~]$ mail
Heirloom Mail version 12.5 7/5/10.  Type ? for help.
"/var/spool/mail/tom": 1 message 1 new
>N  1 root@s1.localdomain   Thu Jan 24 05:18  15/432
& 1             # 查看第一封邮件
Message  1:
From root@s1.localdomain  Thu Jan 24 05:18:01 2019
Return-Path: <root@s1.localdomain>
X-Original-To: tom
Delivered-To: tom@s1.localdomain
Date: Thu, 24 Jan 2019 05:17:05 +0800 (CST)
From: root@s1.localdomain
Status: R

hello
hello
hello
```

## POP

为了解决 SMTP 的弊端，引入了 POP（Post Office Protocol）协议，这是一种用于**接收邮件**的协议，TCP 端口 110，发送端的邮件根据 SMTP 协议被转发到一直处于插电状态的 POP 服务器，客户端再根据 POP 协议从 POP 服务器接收对方发来的邮件，该过程中支持身份验证，邮件客户端会从邮件服务器上获取所有发给自己的新邮件，然后关闭连接，在关闭连接后，邮件服务器会删除所有被标记为已接收的邮件。当前 POP 的版本为 3，写作 POP3。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120102638.png)

客户端的应答只有两种：正常的"+OK"，错误的"-ERR"。

POP3 的收信方式：

1. MUA 透过 POP3 连接到 MRA 的 110 端口， 并且输入帐号与密码来取得正确的认证与授权
2. MRA 确认该使用者帐号/密码没有问题后，会前往该使用者的 Mailbox (`/var/spool/mail/使用者帐号`) 取得使用者的信件并传送给使用者的 MUA 上
3. 当所有的信件传送完毕后，使用者的 mailbox 内的资料将会被删除

POP3 与 SSL 结合称为 POP3S，实现邮件加密，

## IMAP

IMAP（Internet Message Access Protocol）因特网消息访问协议，与 POP 类似，是接收邮件的协议。在 POP 中，邮件有客户端进行管理，IMAP 中邮件由服务器进行管理。不必从邮件服务器上下载所有邮件也可以阅读，并且会对已读和未读进行分类管理。当前版本为 4，写作 IMAP4。

可以将 mailbox 的资料转存到主机上的家目录，不但可以建立邮件档案，也可以针对信件分类管理。

# 邮件服务器搭建

直接 yum 安装 postfix。若安装了 postfix，就要停止 sendmail 的所有相关服务。

postfix 的相关配置文件：

- `/etc/postfix/main.cf`：主配置文件
- `/etc/postfix/master.cf`：postfix 运行参数，一般不用修改
- `/etc/postfix/access`：访问控制
- `/etc/aliases`：邮件别名，或设置邮件群组

postfix 命令

```
postfix check          #检查配置文件或权限等
        start          #启动postfix
        stop           #关闭postfix
        flush          #强制将目前邮件队列中的邮件寄出
        reload         #重载配置文件
```

postfix 服务的配置文件`/etc/postfix/main.cf`

```
inet_interfaces = localhost    # 接收本地的请求。
# all为所有请求，localhost-only为仅接收本地请求
myhostname = host.domain.tld   # 系统主机名（FQDN）
mydomain = domain.tld          # 系统域名
myorigin = $myhostname         # 发信源
mydestination = $myhostname    # 指定发给本地邮件的域名
relayhost = $mydomain          # 中继服务器域名
mynetworks = 127.0.0.0/8       # 信任的客户端
```

可以直接使用命令`postconf -e`修改配置项。

```
postconf -e "inet_interfaces=all"
postconf -e "myhostname=s1.example.com"
postconf -e "mydomain=example.com"
postconf -e "myorigin=example.com"
postconf -e "inet_protocols=ipv4"
```

# 参考文章

- 鸟哥的 Linux 私房菜
- 图解 TCP/IP

---
title: SSH协议笔记
date: 2018-08-01 21:02:56
tags: [SSH, OpenSSH, Linux]
categories: [网络]
comments: false
---

- [SSH 协议](#SSH-协议)
  - [sshd 服务](#sshd-服务)
    - [sshd_config 配置](#sshd-config-配置)
    - [密钥分发命令](#密钥分发命令)
- [参考文章](#参考文章)

<!--more-->

# SSH 协议

Secure Shell 安全壳协议，是建立在 TCP 上的安全协议，端口号 22。可以防止中间人攻击、DNS 和 IP 欺骗，并可加快数据的传输速度，且通过 ssh 传输的数据都是经过压缩的。

目前 SSH 有两个版本 SSH1 和 SSH2，这两个版本互不兼容。SSH 有以下特点：

- 支持 DES、3DES 加密
- 支持公钥（密钥）验证方式、密码（口令）验证方式、不验证
- 支持 RSA 认证

SSH 连接建立过程：

1. 版本号协商：客户端与服务器协商出双方使用的 SSH 版本
2. 密钥与算法协商：客户端与服务器交换算法协商报文，协商出使用的算法，并且生成会话密钥和 ID
3. 认证：客户端向服务器发送认证请求，服务器端对客户端认证
4. 会话请求：客户端向服务器发送会话请求，服务器等待并处理客户端请求
5. 交互会话：数据加密传输

## sshd 服务

通过 openssh 软件实现 sshd 服务，sshd 正是使用 ssh 协议进行远程访问或传输文件的服务。

sshd 主要要有三个软件：

- openssh：包含 openssh 服务器与客户端需要的核心文件
- openssh-clients：openssh 客户端软件
- openssh-server：openssh 服务器软件

Openssh 的配置文件

- `/etc/ssh/ssh_config`：客户端配置文件
- `/etc/ssh/sshd_config`：服务器端配置文件

ssh 命令常见选项：

```
ssh [username@]host [options] [command]
  -p 指定连接的远程主机端口，默认22
  -v 显示详细信息，一般用于排错
  -C 压缩所有数据
  可直接通过ssh在远端执行命令
  -l 指定登录用户名
```

### sshd_config 配置

```
Port  22              #端口号
#为安全起见，在实际生产环境中，最好将端口改为非22，减小ssh暴露的危险
Protocol 2            #SSH版本，默认2，SSH1已淘汰
AddressFamily         #
ListenAddress 0.0.0.0 #设置sshd服务器监听的本地IP地址。0.0.0.0表示监听本地所有IP地址（如果有多个）
HostKey /etc/ssh/ssh_host_rsa_key  #服务器秘钥文件的路径（还有dsa等密钥）
Compression yes       #是否可使用压缩指令
KeyRegenerationInterval 1h  #服务器重新生成密钥的周期
ServerKeyBits 1024    #服务器密钥的长度
LogLevel INFO         #日志等级
LoginGraceTime 2m     #输入密码后，若2分钟内未连接成功，则断开
PermitRootLogin yes   #是否允许使用root登录远程主机，若为生产环境需要设为no
StrictModes yes       #ssh在接收登录请求之前是否检查用户根目录和rhosts文件的权限和所有权，默认开启
SyslogFacility AUTHPRIV  #日志类型
PubkeyAuthentication yes #是否开启公钥验证，如果使用公钥验证的方式登录时，则设置为yes
AuthorizedKeysFile  .ssh/authorized_keys #公钥验证文件的路径
PasswordAuthentication yes  #是否开启密码验证
PermitEmptyPasswords no  #是否允许空密码登录
PrintMotd yes         #登录后是否打印信息（上次登录时间和地点等），信息内容可在/etc/motd中编辑
PrintLastLog yes      #显示上次登录的信息，默认允许
UsePrivilegeSeparation sandbox  #是否允许权限较低的程序一共用户操作，会让sshd在远程用户登入后产生一个属于该用户的sshd程序，使系统较安全
UseDNS yes  #为了判断客户端是否合法，会使用DNS反查客户端主机名。
            #若是内网，则no可以让连接更快。
MaxAuthTries 6        #最多密码尝试次数
MaxSessions 10        #最多终端数
ClientAliveInterval 0 #向客户端发送keepalive报文的间隔
ClientAliveCountMax 3 #若三次收不到keepalive消息，则认为连接断开
TCPKeepAlive          #是否持续连接，设置yes可以防止死连接
#SSH Server会传送KeepAlive的讯息给Client端，以确保两者的联机正常
```

> 注：`Protocol`、`ServerKeyBits`、`UsePrivilegeSeparation` 等参数在新版 OpenSSH 中已废弃，实际配置时以 `man sshd_config` 为准。

最好将 ssh 的日志文件`/var/log/secure`的路径改掉，减小入侵后 ssh 日志文件被删除的风险。可修改`/etc/rsyslog.conf`的`authpriv`参数，包括特权信息如用户名在内的认证活动。

默认：`authpriv.* /var/log/secure` ，修改此项即可改变 ssh 日志路径

### 密钥分发命令

`ssh-keygen`用于生成密钥对。

# 参考文章

- [百度百科-ssh](https://baike.baidu.com/item/ssh/10407)
- [OpenSSH 手册](https://www.openssh.com/manual.html)
- [RFC 4251 - SSH 协议架构](https://datatracker.ietf.org/doc/html/rfc4251)
- [RFC 4253 - SSH 传输层协议](https://datatracker.ietf.org/doc/html/rfc4253)

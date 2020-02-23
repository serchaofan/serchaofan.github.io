---
title: SSH与SSL协议学习笔记
date: 2018-08-01 21:02:56
tags: [OpenSSL, SSL, server, SSH]
---

- [SSL/TLS 概念](#ssltls-%e6%a6%82%e5%bf%b5)
  - [SSL 协议架构](#ssl-%e5%8d%8f%e8%ae%ae%e6%9e%b6%e6%9e%84)
- [OpenSSL 概念](#openssl-%e6%a6%82%e5%bf%b5)
- [SSH 协议](#ssh-%e5%8d%8f%e8%ae%ae)
  - [sshd 服务](#sshd-%e6%9c%8d%e5%8a%a1)
    - [sshd_config 配置](#sshdconfig-%e9%85%8d%e7%bd%ae)
    - [密钥分发命令](#%e5%af%86%e9%92%a5%e5%88%86%e5%8f%91%e5%91%bd%e4%bb%a4)
- [参考文章](#%e5%8f%82%e8%80%83%e6%96%87%e7%ab%a0)

<!--more-->

# SSL/TLS 概念

SSL（Secure Socket Layer，安全套接字层）是一种标准安全协议，由美国网景（Netscape）开发，用于在在线通信中建立 Web 服务器和浏览器之间的加密链接。SSL 技术的使用确保了 Web 服务器和浏览器之间传输的所有数据都保持加密状态。TLS（transport Layer Security，安全传输层协议）是 SSL 标准化后的版本，与 SSL 基本没有区别。

SSL/TLS 的主要功能：

- 认证用户与服务器，确保数据发送到正确的客户端和服务器，即可靠性
- 加密数据，即机密性
- 维护数据的完整性

## SSL 协议架构

SSL 基于 TCP，且分为两个子层：**握手层**和**记录层**，其中**握手层负责建立 SSL 连接，记录层负责对报文的加解密**。

{% asset_img 1.png %}

- 握手层：

  - 协商加密能力
  - 协商密钥参数
  - 验证对方身份
  - 建立并维护 SSL 会话

  握手层协议报文格式：

  - 消息类型 Type
  - 消息长度 Length
  - 消息相关参数 Content

  SSL 提供三种握手过程，分别为：

  - 无客户端身份认证的全握手

    1. 客户端向服务器发送以下信息：支持的 SSL 最高版本、加密套件列表、压缩算法列表、客户端随机数（32 位）、会话 ID
    2. 服务器端回应客户端以下信息：服务器同意的 SSL 版本、加密套件、压缩算法、会话 ID、服务器端随机数。并且还会发送服务器的证书、服务器端密钥交换的信息，最后通知对端握手信息已发完
    3. 客户端再向服务器端发送密钥参数和握手过程的验证报文，并通知对端开始启用加密参数
    4. 服务器再向客户端发送自己的握手过程验证报文，并通知对端开始启用加密参数

    {% asset_img 2.png %}

  - 有客户端身份认证的全握手

    与上面类似，但在第 2 步后，服务器端还会向客户端请求客户端的证书，然后客户端回应自己的证书，并会附加上数字签名

  - 会话恢复

    当 SSL 连接因某些原因不正常断开后，可在超时时间内进行会话恢复。

    客户端向服务器发送的消息与第 1 条一致，其中会话 ID 为上一次 SSL 连接的会话 ID。其余过程也基本一致。

- 记录层：

  - 保护传输数据的**机密性**，对数据进行加密和解密
  - 验证传输数据的**完整性**，计算报文摘要
  - 对报文**压缩**
  - 保证数据传输的**可靠有序**

  **记录层对数据包的三个操作：分片、压缩、加密**

  记录层协议报文格式：

  - 报文类型：1 个字节，密钥改变协议（20）、告警协议（21）、握手协议（22）、应用层数据（23）
  - 版本：2 字节，TLS1.0（3,1）、SSL3.0（3,0）
  - 长度：2 字节记录层报文的长度，包括加密数据和 MAC 值
  - MAC：消息验证码

  {% asset_img 3.png %}

**SSL 会话与连接**

SSL 会话是指客户端与服务器间的关联关系，通过握手协议创建。而 SSL 连接是用于点对点数据的传输，连接的维持时间比较短暂，且一定与一个会话关联。

一次会话过程通常会发起多个 SSL 连接来完成任务，这些连接共享会话定义的安全参数，这样可以避免为每个 SSL 连接单独进行安全参数的协商，而只需在会话建立时进行一次协商，提高了效率。

HTTPS 与 HTTP 连接的建立耗时也因为 SSL 层而出现 3 倍的差距。可通过`curl -w "TCP handshake: %{time_connect}, SSL handshake: %{time_appconnect}" -so /dev/null 网址`测试。

# OpenSSL 概念

OpenSSL 是一个 SSL 的密码库，是对 SSL 协议的实现，包含了主要的密码算法，常用的密钥和证书封装管理功能。

OpenSSL 提供八种对称加密算法（DES、AES、Blowfish、CAST、IDEA、RC2、RC5），支持四种非对称加密算法（DH、RSA、DSA、椭圆曲线 EC），实现五种信息摘要算法（MD2、MD5、MDC2、SHA（SHA+SHA1）、RIPEMD）

**Heartblood 漏洞简介**

心脏出血漏洞，于 2014 年被公开。受害者的内存内容就会以每次 64KB 的速度进行泄露，通过读取网络服务器内存，攻击者可以访问敏感数据，从而危及服务器及用户的安全。

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
  -v 显示详细信息，一般用于拍错
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

最好将 ssh 的日志文件`/var/log/secure`的路径改掉，减小入侵后 ssh 日志文件被删除的风险。可修改`/etc/rsyslog.conf`的`authpriv`参数，包括特权信息如用户名在内的认证活动。

默认：`authpriv.* /var/log/secure` ，修改此项即可改变 ssh 日志路径

### 密钥分发命令

`ssh-keygen`用于生成密钥对。

# 参考文章

- [百度百科-ssl](https://baike.baidu.com/item/ssl)
- [百度百科-ssh](https://baike.baidu.com/item/ssh/10407)
-

---
title: PPP协议基础笔记
date: 2019-03-21 19:40:08
tags: [PPP, 网络, 华三]
---

PPP 协议基础，根据华三网络整理

- [PPP 协议概述](#ppp-协议概述)
  - [PPP MP](#ppp-mp)
  - [PPPOE](#pppoe)
- [华三 PPP 环境搭建](#华三-ppp-环境搭建)
  - [PAP 单向验证配置](#pap-单向验证配置)
  - [PAP 双向验证配置](#pap-双向验证配置)
  - [CHAP 验证配置](#chap-验证配置)
  - [IP 地址协商](#ip-地址协商)
    - [直接指定对端 IP 地址](#直接指定对端-ip-地址)
    - [配置地址池供对端选择](#配置地址池供对端选择)
    - [ISP 域关联 IP 地址池](#isp-域关联-ip-地址池)
    - [PPP 常见配置项](#ppp-常见配置项)
  - [MP 配置](#mp-配置)
    - [虚拟模板接口配置 MP](#虚拟模板接口配置-mp)
      - [将链路直接绑定到 VT 上](#将链路直接绑定到-vt-上)
      - [按用户名查找 VT](#按用户名查找-vt)
    - [MP-group 接口配置 MP](#mp-group-接口配置-mp)

<!--more-->

# PPP 协议概述

Point to Point Protocol 点对点协议

特点：

1. 支持动态分配 IP 地址，允许连接时协商 IP 地址。
2. 支持同步与异步线路。支持多种网络层协议（TCP/IP 等）
3. 支持错误检测及纠错，支持数据压缩
4. 支持身份验证。无重传机制，网络开销小

组成：

- 链路控制协议 LCP：用于建立、配置、测试管理数据链路连接
- 网络控制协议 NCP：协商链路上所传输的数据包格式等参数，建立配置不同网络层协议
- 认证协议：用于对用户进行认证，包括 PAP（Password Authentication Protocol 密码认证协议）、CHAP（Challenge Handshake Authentication Protocol 质询握手认证协议）、MS-CHAP（Microsoft CHAP 微软 CHAP 协议）

PPP 会话过程：PPP 的初始状态为不活动（dead）状态

1. 链路建立阶段：当物理层可用时，进入 Establish 阶段，发送 LCP 报文检测链路可用情况（LCP 协商），若可用（协商成功）就成功建立，LCP 进入 Opened 状态并上报 up 事件，否则失败，上报 fail 事件，进入 Dead 阶段。
2. 验证阶段（若配置了验证）：根据 PPP 帧中验证选项字段确定是否验证，若配置了验证，就进入 Authenticate 阶段，选择 PAP 或 CHAP 等验证。该阶段仅支持 LCP 和验证协议报文，其他报文都被丢弃。若验证失败进入 Terminate 状态，链路拆除，LCP 变为 Down。若成功就进入 Network 阶段
3. 网络层协商阶段（若配置了网络层协议）：PPP 双方发送 NCP 报文协商网络层协议（如 IPCP）及地址，NCP 状态从 Initial 变为 Request。协商成功后 NCP 状态变为 Opened，链路建立成功。
4. 此后，PPP 链路将一直保持通信，直至有明确的 LCP 或 NCP 消息关闭这条链路，或发生了某些外部事件（例如用户的干预）。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203251136229.jpg)

两种验证：

- PAP：两次握手。被验证方发起验证请求，向对端发送用户名和密码（明文），主验证方通过查询本地用户列表或 RADIUS 服务器，然后回应通过或拒绝。

  PAP 支持双向认证。

- CHAP：三次握手。主验证方发起验证请求 Challenge，发送本端主机名和随机报文。被验证方收到后查询本地密码，若本端配置了 CHAP 默认密码，就选用此密码。否则在用户表查找主验证方用户名对应的密码，并选用。被验证方通过 MD5 对报文 ID、被验证方密码、原随机数生成一个摘要，回复 Response。主验证方对本端密码、相同随机数、报文 ID 进行 MD5 摘要，并进行比对，若相同则验证成功，回复 Acknowledge，否则回复失败。

  CHAP 不直接传输用户密码，而是传输通过 MD5 将密码与随机报文 ID 一起计算的结果，安全性高。认证方最多允许被认证方重传 3 次。

PPP 帧格式：

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203251136794.png)

## PPP MP

MP 是 MultiLink PPP 的简写。将多条 PPP 链路捆绑后当作一条链路，实现**带宽增加，负载分担**，降低报文延时，备份。

MP 会将报文分片（小于最小分片包长时不分片）后，从 MP 链路下的多个 PPP 通道发送到对端，对端将这些分片组装起来传递给网络层处理。

通过配置虚拟模板（virtual-template）（华三设备）实现。可用用户名捆绑或通过一个 VT 口派生多个捆绑，也可通过 MP-Group 实现。MP-Group 是 MP 专用接口，一个 MP-Group 只能对应一个绑定

## PPPOE

PPPoE 描述了在以太网上建立 PPPoE 会话及封装 PPP 报文的方法。要求通信双方建立的是点到点关系，而不是在以太网中所出现的点到多点关系。

PPPoE 利用以太网将大量主机组成网络，然后**通过一个远端接入设备为以太网上的主机提供互联网接入服务，并对接入的每台主机实现控制、计费功能**。由于很好地结合了以太网的经济性及 PPP 良好的可扩展性与管理控制功能，PPPoE 被广泛应用于小区组网等环境中。

PPPoE 协议将 PPP 报文封装在以太网帧之内，在以太网上提供点对点的连接。

PPPoE 使用 Client/Server 模型。PPPoE Client 向 PPPoE Server 发起连接请求，两者之间会话协商通过后，就建立 PPPoE 会话，此后 PPPoE Server 向 PPPoE Client 提供接入控制、认证等功能。

根据 PPPoE 会话的起点所在位置的不同，有两种组网结构：

- 第一种方式是在**两台路由器之间建立 PPPoE 会话，所有主机通过同一个 PPPoE 会话传送数据，主机上不用安装 PPPoE 客户端拨号软件**，一般是一个企业共用一个账号接入网络（图中 PPPoE Client 位于企业/公司内部，PPPoE Server 是运营商的设备）。
- 第二种方式是**将 PPPoE 会话建立在 Host 和运营商的路由器之间，为每一个 Host 建立一个 PPPoE 会话，每个 Host 都是 PPPoE Client，每个 Host 使用一个帐号**，方便运营商对用户进行计费和控制。Host 上必须安装 PPPoE 客户端拨号软件。

# 华三 PPP 环境搭建

实验环境：两台路由器 RT1 和 RT2，RT1 为主验证方，RT2 为被验证方

```
RT1:
[RT1]interface Serial 1/0
[RT1-Serial1/0]ip address 192.168.1.1 24

RT2:
[RT2]interface Serial 1/0
[RT2-Serial1/0]ip address 192.168.1.2 24
```

## PAP 单向验证配置

```
RT1:
[RT1-Serial1/0]link-protocol ppp       # 在串口配置封装的链路层协议为PPP
# 缺省情况下，除以太网接口、VLAN接口、ATM接口外，其它接口封装的链路层协议均为PPP
# 所以在串口可以不配这条
[RT1-Serial1/0]ppp authentication-mode pap   # 设置验证方式为pap
[RT1]local-user zhangsan class network # 为RT2添加验证用户zhangsan
New local user added.
[RT1-luser-network-zhangsan]password simple 123
[RT1-luser-network-zhangsan]service-type ppp   # 设置服务类型为ppp

RT2:
[RT2-Serial1/0]link-protocol ppp
[RT2-Serial1/0]ppp pap local-user zhangsan password simple 123  # 在串口配置验证信息
```

查看串口的端口信息，检查是否配置成功

```
[RT1]display interface Serial
Serial1/0
Current state: UP            # 端口状态UP
Line protocol state: UP      # 链路协议UP
Description: Serial1/0 Interface
Bandwidth: 64kbps
Maximum Transmit Unit: 1500
Hold timer: 10 seconds, retry times: 5
Internet Address is 192.168.1.1/24 Primary
Link layer protocol: PPP
LCP: opened, IPCP: opened   # LCP和IPCP都开启了
Output queue - Urgent queuing: Size/Length/Discards 0/100/0
Output queue - Protocol queuing: Size/Length/Discards 0/500/0
Output queue - FIFO queuing: Size/Length/Discards 0/75/0
Last link flapping: 0 hours 45 minutes 27 seconds
Last clearing of counters: Never
```

此时互相 ping，能够 ping 通

## PAP 双向验证配置

互相配置验证用户

```
RT1:
[RT1]local-user zhangsan class network
[RT1-luser-network-zhangsan]password simple 123
[RT1-luser-network-zhangsan]service-type ppp

RT2:
[RT2]local-user lisi class network
New local user added.
[RT2-luser-network-lisi]password simple 321
[RT2-luser-network-lisi]service-type ppp
```

双方都要在串口配置 PPP 验证

```
RT1:
[RT1-Serial1/0]ppp authentication-mode pap
[RT1-Serial1/0]ppp pap local-user zhangsan password simple 123

RT2:
[RT2-Serial1/0]ppp authentication-mode pap
[RT2-Serial1/0]ppp pap local-user lisi password simple 321
```

同理检查串口状态，并互相 ping 检查。

## CHAP 验证配置

CHAP 认证分为两种：认证方配置了用户名和认证方没有配置用户名。

当认证方配置了用户名：

```
RT1（验证方）:
# 配置对端的验证用户zhangsan
[RT1]local-user zhangsan class network
New local user added.
[RT1-luser-network-zhangsan]password simple 123
[RT1-luser-network-zhangsan]service-type ppp

[RT1-Serial1/0]ppp authentication-mode chap
# 配置对端验证本端的用户，即RT1对应了用户lisi
[RT1-Serial1/0]ppp chap user lisi
[RT1-Serial1/0]ppp chap password simple 321  # 密码，可选

RT2:
# 配置对端验证用户lisi
[RT2]local-user lisi class network
New local user added.
[RT2-luser-network-lisi]password simple 321
[RT2-luser-network-lisi]service-type ppp

[RT2-Serial1/0]ppp authentication-mode chap
[RT2-Serial1/0]ppp chap user zhangsan
[RT2-Serial1/0]ppp chap password simple 123

即：RT1的本地用户zhangsan是给RT2来验证的，RT2的本地用户lisi是给RT1来验证的
```

当验证方没有配置用户名：

```
RT1:
[RT1]local-user zhangsan class network
New local user added.
[RT1-luser-network-zhangsan]password simple 123
[RT1-luser-network-zhangsan]service-type ppp

[RT1-Serial1/0]ppp authentication-mode chap

RT2:
[RT2-Serial1/0]ppp chap user zhangsan
[RT2-Serial1/0]ppp chap password simple 123
```

## IP 地址协商

### 直接指定对端 IP 地址

```
RT1:
[RT1-Serial1/0]remote address 192.168.1.2

RT2:
[RT2-Serial1/0]ip address ppp-negotiate
```

然后查看 RT2 的串口端口 IP

```
[RT2-Serial1/0]display interface Serial 1/0 brief
Brief information on interface(s) under route mode:
Link: ADM - administratively down; Stby - standby
Protocol: (s) - spoofing
Interface            Link Protocol Main IP         Description
Ser1/0               UP   UP       192.168.1.2
```

### 配置地址池供对端选择

```
RT1:
[RT1]ip pool pool-1 192.168.1.10 192.168.1.20
[RT1-Serial1/0]remote address pool pool-1

RT2:
[RT2-Serial1/0]ip address ppp-negotiate
```

可在 RT1 上查看地址池的分配情况

```
[RT1]display ip pool pool-1
Group name: default
  Pool name           Start IP address    End IP address      Free   In use
  pool-1              192.168.1.10        192.168.1.20        10     1
In use IP addresses:
  IP address          Interface
  192.168.1.10        Ser1/0
```

### ISP 域关联 IP 地址池

```
RT1:
[RT1]ip pool pool-1 192.168.1.10 192.168.1.20
[RT1]local-user zhangsan class network
New local user added.
[RT1-luser-network-zhangsan]password simple 123
[RT1-luser-network-zhangsan]service-type ppp

[RT1]domain domain-1
[RT1-isp-domain-1]authorization-attribute ip-pool pool-1
[RT1-Serial1/0]ip address 192.168.1.1 24
[RT1-Serial1/0]ppp authentication-mode pap domain domain-1

RT2:
[RT2-Serial1/0]ppp pap local-user zhangsan password simple 123
[RT2-Serial1/0]ip address ppp-negotiate
```

之后链路会断开，等待一段时间后会再次 up，RT2 的 IP 也会分配好。

### PPP 常见配置项

PPP 协议可以为每条 PPP 链路提供基于流量的计费统计功能，具体统计内容包括出入两个方向上流经本链路的报文数和字节数。AAA 可以获取这些流量统计信息用于计费控制。

缺省情况下，PPP 计费统计功能处于关闭状态。

```
ppp account-statistics enable
```

轮询时间间隔指的是接口发送 keepalive 报文的周期。当接口上封装的链路层协议为 PPP 时，链路层会周期性地向对端发送 keepalive 报文。如果接口在**10 个 keepalive 周期内无法收到对端发来的 keepalive 报文**，链路层会认为对端故障，上报链路层 Down。

用户可以通过**`timer-hold`**命令修改 keepalive 报文轮询的时间间隔。**如果将轮询时间间隔配置为 0 秒，则不发送 keepalive 报文。**

在速率非常低的链路上，轮询时间间隔不能配置过小。因为在低速链路上，大报文可能会需要很长的时间才能传送完毕，这样就会延迟 keepalive 报文的发送与接收。而接口如果在 10 个 keepalive 周期之后仍然无法收到对端的 keepalive 报文，它就会认为链路发生故障。如果 keepalive 报文被延迟的时间超过接口的这个限制，链路就会被认为发生故障而被关闭。

缺省情况下，轮询时间间隔为 10 秒。

```
timer-hold [period]
```

## MP 配置

MP 的配置主要有两种方式，一种是通过虚拟模板（Virtual Template，VT）接口，一种是通过 MP-group 接口。

- 通过虚拟模板接口配置 MP

  VT 是用于配置一个 VA（Virtual Access，虚拟访问）接口的模板。将多个 PPP 链路捆绑成 MP 链路之后，需要创建一个 VA 接口与对端交换数据。此时，系统将选择一个 VT，以便动态地创建一个 VA 接口。

  虚拟模板接口配置方式**可以与认证相结合，可以根据对端的用户名找到指定的虚拟模板接口，从而利用模板上的配置，创建相应的捆绑（Bundle），以对应一条 MP 链路。**

  由一个虚拟模板接口可以派生出若干个捆绑，每个捆绑对应一条 MP 链路。从网络层看来，这若干条 MP 链路会形成一个点对多点的网络拓扑。系统可以根据接口接收到的认证用户名或终端标识符来进行 MP 捆绑，并以此来区分虚模板接口下的多个捆绑（对应多条 MP 链路）。

  系统支持 3 种绑定方式：

  - **authentication**：根据 PPP 的认证用户名进行 MP 捆绑，每个认证用户名对应一个捆绑。认证用户名是指 PPP 链路进行 PAP、CHAP、MS-CHAP 或 MS-CHAP-V2 认证时所接收到的对端用户名。
  - **descriptor**：根据 PPP 的终端描述符进行 MP 捆绑，每个终端描述符对应一个捆绑。终端标识符是用来唯一标识一台设备的标志，是指进行 LCP 协商时所接收到的对端终端标识符。
  - **both**：同时根据 PPP 的认证用户名和终端描述符进行 MP 捆绑。

- 通过 MP-group 接口配置 MP

  MP-group 接口是 MP 的专用接口，不支持其它应用，也不能利用对端的用户名来指定捆绑，同时也不能派生多个捆绑。与虚拟模板接口配置方式相比，MP-group 接口配置方式更加快速高效、配置简单、容易理解。

### 虚拟模板接口配置 MP

通过虚拟模板接口配置 MP 时，又可以细分为两种配置方式：

- 将物理接口与虚拟模板接口直接关联：使用命令**`ppp mp virtual-template`**直接将链路绑定到指定的虚拟模板接口上，这时可以配置认证也可以不配置认证。如果不配置认证，系统将通过对端的终端描述符捆绑出 MP 链路；如果配置了认证，系统将通过用户名和/或对端的终端描述符捆绑出 MP 链路。

- 将用户名与虚拟模板接口关联：根据认证通过后的用户名查找相关联的虚拟模板接口，然后根据用户名和对端终端描述符捆绑出 MP 链路。这种方式需在要绑定的接口下配置**`ppp mp`**及双向认证（PAP、CHAP、MS-CHAP 或 MS-CHAP-V2），否则链路协商不通。

配置时需要注意：

- **`ppp mp`**和**`ppp mp virtual-template`**命令互斥，即**同一个接口只能采用一种配置方式。**

- 对于需要绑在一起的接口，必须采用同样的配置方式。

- 实际使用中也可以配置单向认证，即一端直接将物理接口绑定到虚拟模板接口，另一端则通过用户名查找虚拟模板接口。

- 不推荐使用同一个虚拟模板接口配置多种业务（如 MP、L2TP、PPPoE 等）。

实验环境：两台路由器，连着两根串口线

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203251137201.png)

#### 将链路直接绑定到 VT 上

```
RT1:
[RT1]interface Virtual-Template 1   # 进入虚模板，号码可选1-8
[RT1-Virtual-Template1]ip address 192.168.1.1 24

[RT1-Serial1/0]link-protocol ppp
[RT1-Serial1/0]ppp mp Virtual-Template 1

[RT1-Serial2/0]link-protocol ppp
[RT1-Serial2/0]ppp mp Virtual-Template 1

在端口配置完后就会自动重启端口
同理在RT2上:
[RT2]interface Virtual-Template 1
[RT2-Virtual-Template1]ip address 192.168.1.2 24

[RT2-Serial1/0]link-protocol ppp
[RT2-Serial1/0]ppp mp Virtual-Template 1

[RT2-Serial2/0]link-protocol ppp
[RT2-Serial2/0]ppp mp Virtual-Template 1
```

可以查看 ppp mp 的状态

```
[RT1]dis ppp mp
----------------------Slot0----------------------
Template: Virtual-Template1
max-bind: 16, fragment: enabled, min-fragment: 128
  Master link: Virtual-Access0, Active members: 2, Bundle RT2
  Peer's endPoint descriptor: RT2
  Sequence format: long (rcv)/long (sent)
  Bundle Up Time: 2019/03/24  04:55:11:467
  0 lost fragments, 0 reordered, 0 unassigned, 0 interleaved
  Sequence: 0 (rcv)/0 (sent)
  Active member channels: 2 members
        Serial1/0                 Up-Time:2019/03/24  04:55:11:467
        Serial2/0                 Up-Time:2019/03/24  04:55:21:892
```

查看 VA 状态

```
[RT1]dis interface Virtual-Access
Virtual-Access0
Current state: UP
Line protocol state: UP
Description: Virtual-Access0 Interface
Bandwidth: 128kbps
Maximum Transmit Unit: 1500
Hold timer: 10 seconds, retry times: 5
Internet Address is 192.168.1.1/24 Primary
Link layer protocol: PPP
LCP: opened, MP: opened, IPCP: opened
Physical: MP, baudrate: 128000 bps
Main interface: Virtual-Template1
......
```

#### 按用户名查找 VT

```
RT1:
# 创建用户供RT2认证，需要为每个线路创一个
[RT1]local-user rt2-user1 class network
New local user added.
[RT1-luser-network-rt2-user1]password simple rt2-user1
[RT1-luser-network-rt2-user1]service-type ppp
[RT1]local-user rt2-user2 class network
New local user added.
[RT1-luser-network-rt2-user2]password simple rt2-user2
[RT1-luser-network-rt2-user2]service-type ppp

# 用户绑定虚模板
[RT1]ppp mp user rt2-user1 bind Virtual-Template 1
[RT1]ppp mp user rt2-user2 bind Virtual-Template 1
# 虚模板配置
[RT1]interface Virtual-Template 1
[RT1-Virtual-Template1]ip address 192.168.1.1 24
[RT1-Virtual-Template1]ppp mp binding-mode authentication

# 串口配置，填写对端提供给本端的用户
# s1/0指定rt1-user1，s2/0指定rt1-user2
[RT1-Serial1/0]link-protocol ppp
[RT1-Serial1/0]ppp authentication-mode pap
[RT1-Serial1/0]ppp pap local-user rt1-user1 password simple rt1-user1
[RT1-Serial1/0]ppp mp

[RT1-Serial2/0]link-protocol ppp
[RT1-Serial2/0]ppp authentication-mode pap
[RT1-Serial2/0]ppp pap local-user rt1-user2 password simple rt1-user2
[RT1-Serial2/0]ppp mp

同理RT2配置:
[RT2]local-user rt1-user1 class network
New local user added.
[RT2-luser-network-rt1-user1]password simple rt1-user1
[RT2-luser-network-rt1-user1]service-type ppp
[RT2]local-user rt1-user2 class network
New local user added.
[RT2-luser-network-rt1-user2]password simple rt1-user2
[RT2-luser-network-rt1-user2]service-type ppp

[RT2]ppp mp user rt1-user1 bind Virtual-Template 1
[RT2]ppp mp user rt1-user2 bind Virtual-Template 1

[RT2]int Virtual-Template 1
[RT2-Virtual-Template1]ip address 192.168.1.2 24
[RT2-Virtual-Template1]ppp mp binding-mode authentication

[RT2-Serial1/0]ppp authentication-mode pap
[RT2-Serial1/0]ppp pap local-user rt2-user1 password simple rt2-user1
[RT2-Serial1/0]ppp mp
[RT2-Serial2/0]ppp authentication-mode pap
[RT2-Serial2/0]ppp pap local-user rt2-user2 password simple rt2-user2
[RT2-Serial2/0]ppp mp
```

查看 ppp mp 信息

```
[RT1]dis ppp mp
----------------------Slot0----------------------
Template: Virtual-Template1
max-bind: 16, fragment: enabled, min-fragment: 128
  Master link: Virtual-Access0, Active members: 1, Bundle rt2-user1  # VA0，用户绑定
  Peer's endPoint descriptor: RT2
  Sequence format: long (rcv)/long (sent)
  Bundle Up Time: 2019/03/24  05:27:20:244
  0 lost fragments, 0 reordered, 0 unassigned, 0 interleaved
  Sequence: 0 (rcv)/0 (sent)
  Active member channels: 1 members
        Serial1/0                 Up-Time:2019/03/24  05:27:20:244
  Master link: Virtual-Access1, Active members: 1, Bundle rt2-user2  # VA1
  Peer's endPoint descriptor: RT2
  Sequence format: long (rcv)/long (sent)
  Bundle Up Time: 2019/03/24  05:27:48:932
  0 lost fragments, 0 reordered, 0 unassigned, 0 interleaved
  Sequence: 0 (rcv)/0 (sent)
  Active member channels: 1 members
        Serial2/0                 Up-Time:2019/03/24  05:27:48:932
```

### MP-group 接口配置 MP

```
RT1:
[RT1]interface MP-group 1
[RT1-MP-group1]ip address 192.168.1.1 24

[RT1-Serial1/0]ppp mp MP-group 1
[RT1-Serial2/0]ppp mp MP-group 1

RT2:
[RT2]interface MP-group 1
[RT2-MP-group1]ip address 192.168.1.2 24

[RT2-Serial1/0]ppp mp MP-group 1
[RT2-Serial2/0]ppp mp MP-group 1
```

查看 PPP MP 信息

```
[RT1]dis ppp mp
----------------------Slot0----------------------
Template: MP-group1
max-bind: 16, fragment: enabled, min-fragment: 128
  Master link: MP-group1, Active members: 2, Bundle Multilink
  Peer's endPoint descriptor: MP-group1
  Sequence format: long (rcv)/long (sent)
  Bundle Up Time: 2019/03/24  05:41:40:229
  0 lost fragments, 0 reordered, 0 unassigned, 0 interleaved
  Sequence: 0 (rcv)/0 (sent)
  Active member channels: 2 members
        Serial1/0                 Up-Time:2019/03/24  05:41:40:229
        Serial2/0                 Up-Time:2019/03/24  05:41:49:213
```

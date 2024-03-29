---
title: 常见VPN技术笔记
date: 2018-06-18 09:00:37
tags: [vpn, 网络]
categories: [SRE]
comments: false
---

**华三网络学习笔记（理论）**

本篇包含以下知识点

- [VPN 概述](#vpn-概述)
- [GRE-VPN](#gre-vpn)
- [L2TP-VPN](#l2tp-vpn)
- [IPSEC-VPN](#ipsec-vpn)
  - [IPSec SA](#ipsec-sa)
  - [IKE](#ike)
  - [IPSec 包处理流程](#ipsec-包处理流程)
  - [安全协议](#安全协议)
  - [GRE-OVER-IPSEC](#gre-over-ipsec)
  - [IPSEC-OVER-GRE](#ipsec-over-gre)
- [MPLS](#mpls)
- [BGP-MPLS-VPN](#bgp-mpls-vpn)
  - [多 VPF 组网](#多-vpf-组网)
  - [MP-BGP](#mp-bgp)

  <!-- more -->

## VPN 概述

Virtual Private Network 虚拟私有网，利用共享公共网络仿真 WAN 设施，构建私有的专用网络。基于 IP 的 VPN 体系的核心是使用 Tunnel 隧道技术。

**VPN 的优势**

- 快速构建，降低部署周期
- 与私有网络一样的安全性、可靠性与可管理性
- 提高了基础资源的利用率
- 简化了用户端的配置和维护工作

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290253287.png)

**概念术语**

- 承载协议：在公网传输时使用的协议
- 封装协议：用于标识承载协议中封装的数据包，放置在承载协议头与载荷协议头间
- 载荷协议：最初封装数据包的协议
- 隧道协议：决定如何实现隧道的协议

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290253159.png)

**主要 VPN 技术**
L2 VPN 技术

- L2TP VPN：二层隧道协议，可实现拨号 VPN 与专线 VPN
- PPTP VPN：点到点隧道协议，支持 PPP 在 IP 网络上的隧道封装，使用增强 GRE 技术为传输的 PPP 报文提供流控与拥塞控制的封装
- MPLS L2 VPN：多协议标签交换
  L3 VPN 技术
- GRE VPN：通用路由封装，可在任意协议中封装任意协议的封装方法
- IPSEC VPN：IP 安全，并不是单个协议，而是一系列协议组成的数据安全体系，包括 AH、ESP、IKE 等，实现对数据私密性、完整性保护与源校验
- BGP/MPLS VPN：多协议 BGP，利用 MPLS 与 MP-BGP 技术
- SSL VPN：安全套接字层，使用 SSL 协议实现远程 VPN

## GRE-VPN

Generic Routing Encapsulation 通用路由封装，是一种能在任意协议中封装任意协议的封装方法，可以直接使用 GRE 封装建立 GRE 隧道，为 IP 协议，协议号 47。以下为
GRE 封装包的格式。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290253898.jpg)

GRE 头包含了 2 字节的`Protocol Type`，用于指示载荷协议类型，`IP`协议为`0x0800`。此外还有扩展 GRE 头，增加了`Key`和`Sequence Number`，具备标识数据流和分组次序的能力。
IP 协议使用协议号 47 标识 GRE 头，说明 IP 头后跟着 GRE 头。而 GRE 头中 protocol type 若为 0x0800，说明 GRE 头后跟着 IP 头。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290253349.png)

双方通过 Tunnel 接口（逻辑接口）建立隧道，再通过实际物理接口进行转发。tunnel 口为载荷协议服务，物理口为承载协议服务。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290253628.png)

GRE 隧道通信过程：

1. 隧道起点路由查找：隧道两端的路由器必须是私网边界路由器。收到数据包时查找 ip 路由表
2. 加封装：查找路由表确认下一跳为 tunnel 口，则进行 GRE 封装。
3. 承载协议路由转发：对封装后的包进行公网路由查询。
4. 中途转发：即公网转发
5. 解封装：到达对端私网边界路由器后，该路由器检查 IP 地址，若是自己则解开 IP 头，发现有 GRE 头，就交给目标 Tunnel 口，tunnel 口解开 GRE 头
6. 隧道终点路由转发：解开 GRE 头后，发现私网 IP 目的地址，然后查表转发。

每个运行 GRE 的路由器只有一个路由表，公网和私网之间只能通过不同的路由加以区分，因此公网私网 IP 地址能重复，且公网私网必须采用不同策略。

- 连接到私网的物理接口和 Tunnel 口属于私网路由 AS，采用一致的私网路由策略。
- 连接到公网的物理接口属于公网路由 AS，必须和公网采用一致的路由策略。

优点：

1. 支持多种协议
2. 支持 IP 路由协议和组播

缺点：

1. 点对点隧道
2. 静态配置隧道
3. 缺乏安全性
4. 不可分配地址空间
5. 部署复杂

静态路由配置：配置到达目的 IP 的私网网段路由，下一跳为对端 Tunnel 口的地址。
动态路由配置：将隧道和私网作为一个 AS 看待，动态路由需要将 Tunnel 口和私网都包括。

Tunnel 口虚假状态：GRE 本身不对隧道状态维护，系统默认根据接口状态设置 Tunnel 状态，即若物理链路中出现故障，物理口仍为 UP，则隧道口也为 UP，而此时隧道却不通。只存在于静态配置时。
解决：tunnel 口 keepalive 机制：允许路由器探测隧道口的实际状态。路由器会从 tunnel 口周期发 keepalive 消息，默认周期 10s，若连续 3 次未收到，则认为隧道不通，会自动删除该 tunnel 口为出接口的静态路由。

## L2TP-VPN

对 PPP 协议链路提供隧道，允许二层链路端点和 PPP 会话点驻留在不同设备上，并采用分组交换技术进行信息交互。使用 PSTN/ISDN 拨号、xDSL 直接连接到 ISP 位于本地的 POP（存在点），或直接连接到 Internet 获得 IP 通信服务，然后 ISP 设备或用户设备建立 L2TP 通道连接对端。

L2TP 特点：

- L2TP 支持对用户和隧道的验证，和对客户端的动态地址分配。可使用 PPP 验证，也可使用 LAC 提供的 AAA 验证
- 具备点到网络特性。适合单个或少量接入
- 不提供加密，但可结合 IPSec 等加密
- 面向连接，为信息提供一定的可靠性

L2TP 组件：

- LAC：L2TP 访问集中器，隧道就在 LAC 和 LNS 间建立
- LNS：L2TP 网络服务器
- NAS：网络访问服务器，抽象概念，是远程访问的接入点，可以是 LAC 或 LNS

两种拓扑方式：

1. 独立 LAC：ISP 提供 LAC，不依赖 IP 接入点。
   条件：ISP 支持 L2TP，验证系统支持 VPDN 属性
   特点：终端用户不需要配置 VPN 拨号软件，只需要执行普通拨号，登录一次就可以接入企业网。
2. 客户 LAC：远程系统安装 VPDN 客户端，直接对 LNS 发起连接请求。不依赖 LAC，验证只能由 LNS 执行
   条件：远程系统必须接入 Internet，远程系统需要安装专用客户端软件并配置
   特点：只需配置 VPN 软件即可与企业网建立 VPN 连接。对用户的验证只能由 LNS 端执行。

L2TP 封装：
L2TP 以 UDP/IP 为承载协议，UDP 端口号为 1701。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290254069.png)

L2TP 头中`Type`字段标识消息类型，若为 1 表示控制消息，若为 0 表示数据消息。
`Tunnel ID`字段标识 L2TP 控制连接，即隧道标识符，是在隧道建立时通过`Assigned Tunnel ID AVP`交换的。
`Session ID`字段用于标识一个隧道中的各个会话，是在隧道建立时通过`Assigned Session ID AVP`交换的。

> 控制连接：在 L2TP 隧道内部，建立维护和释放会话与隧道
> 控制消息：LAC 与 LNS 间交换的隧道内消息，用于对隧道操作。包含 AVP（属性值对，通过发送 AVP 对隧道建立维护或释放，即管理隧道和会话）

L2TP 协议操作：

1. 建立控制连接：由 PPP 触发
   （1）LAC 使用任意 UDP 端口向 LNS 的 UDP1701 端口发起连接（`SCCRQ`打开控制连接请求）
   （2）LNS 将连接重定向到一个随机 UDP 端口并回应（`SCCRP`打开控制连接应答）
   （3）LAC 收到后返回确认（`SCCCN`打开控制连接已确认）
   （4）LNS 收到后再确认，隧道建立（`ZLB`零长度体）
   若要执行隧道验证，可在`SCCRQ`或`SCCRP`中加上`Challenge AVP`（挑战 AVP）发起验证，接收方要在回应中加上`Challenge Response AVP`（挑战响应 AVP）。
2. 建立会话：前提为控制连接的建立。由 PPP 模块触发
   LAC 发起：
   （1）LAC 向 LNS 发送`ICRQ`（入呼叫请求）发起会话建立
   （2）LNS 收到请求后返回`ICRP`（入呼叫应答）
   （3）LAC 收到应答后返回`ICCN`（入连接已连接）
   （4）LNS 再回应`ZLB`，会话建立
   LNS 发起：
   （1）LNS 发送`OCRQ`（出呼叫请求）发起会话建立
   （2）LAC 收到后返回`OCRP`（出呼叫应答）
   （3）LAC 执行呼叫，返回`OCCN`（出呼叫已连接）
   （4）LNS 收到后回应`ZLB`，会话建立
   会使用`Tunnel ID`和`Session ID`区分不同隧道和会话
3. 隧道状态维护
   LAC 与 LNS 互发`Hello`消息维持会话，默认周期 60s，若三次未收到对方的 Hello 消息，则认为隧道断开。
4. 关闭会话与控制链接
   关闭会话：
   （1）LAC 发送`CDN`（呼叫断开通知），通知 LNS 关闭会话
   （2）LNS 收到后返回`ZLB`，并关闭会话
   关闭控制连接：
   （1）LAC 发送`StopCCN`（停止控制连接通知），通知 LNS 关闭控制连接
   （2）LNS 收到后回应`ZLB`，并关闭控制连接
5. L2TP 验证 1.对拨入的远程系统 PPP 验证
   2.LAC 与 LNS 间隧道验证
   3.LNS 对远程系统再次 PPP 验证。方式分为三种：
   1）代理验证：LAC 将从远程系统得到的验证信息和自身的验证信息都发给 LNS
   2）强制 CHAP 验证：LNS 直接对远程系统进行 CHAP 验证
   3）LCP 重协商：LNS 与远程系统重新进行 LCP 协商，采用相应虚拟模板接口上配置的验证方式进行验证

LAC 端对远程系统用户的 AAA 验证包括：

- 本地验证：需要 LAC 端配置本地用户名、密码、服务类型等信息，与用户输入的通过对比进行验证。
- 远程验证：需要与 RADIUS 或 TACACS 服务器协同验证，需要在 RADIUS 或 TACACS 服务器上配置用户验证信息，LAC 将用户输入的信息发送给验证服务器进行验证。

<center>下图为：独立LAC隧道会话建立</center>

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290254190.png)

<center>下图为：客户LAC隧道会话建立</center>

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290255494.png)

## IPSEC-VPN

一种网络层安全保障机制。可实现访问控制、机密性、完整性校验、数据源校验、拒绝重播报文等。IPSec 是可扩展的体系，不受限于任何一种特定算法，可引入多种验证算法、加密算法、密钥管理机制。
缺点：复杂，消耗大量资源、数据延迟、点对点、不支持组播

### IPSec SA

IPSec SA：IPSec 安全联盟，安全服务通过 SA 实现。
SA 是双方的安全协定，包括协议、算法、密钥。SA 是单向的，入站和出站数据流分别由入站 SA 和出站 SA 处理。

SA 的三元组：

1. SPI：安全参数索引，32 位数值
2. IP 目的地址：对方 IP 地址
3. 安全协议标识符：标识 AH 或 ESP

SA 建立方式：

1. 手工配置：两端手动设置参数
2. 自动协商：双方通过 IKE 生成维护

SA 具有生存时间，有两种方式：

1. 时间：每隔定时长更新 SA
2. 流量：每传输一定流量更新 SA

SA 协商信息存放在 SPD（安全策略数据库），SPD 的项指向 SAD（安全联盟数据库）相应项

### IKE

IKE：因特网密钥交换。基于 UDP 协议，端口号 500，为 IPSec 提供自动协商交换密钥、建立 SA 服务，实际提供安全服务的是 IPSec，采用 DH 算法交换密钥（精髓）。且可以定时更新密钥和 SA，提供了完善的前向安全性。可以为 IPSec 自动重新建立 SA，允许 IPSec 提供抗重播服务（通过 SPI 值）。

采用 ISAKMP 的密钥交换框架体系
**IKE 安全机制：**

1. 身份验证：预共享密钥（默认）、RSA 数字签名、DES 数字签名
2. DH 密钥交换
3. PFS 完善前向安全性：通过在第二阶段再进行一次 DH 交换，使 IKE SA 密钥与 IPSec SA 密钥无派生关系

**协商两个阶段：**

- 阶段 1：建立一个 IKE SA，为阶段 2 提供保护
  分为主模式 main 和野蛮模式 aggressive

主模式：强制实现的阶段 1 交换模式。共三步，六条消息

1. 策略协商：A 向 B 发送本地 IKE 策略，B 查找匹配的策略，并确认
   其中协商属性包括：加密算法，散列算法（MD5、SHA 等），验证方法（预共享密钥、DSS、RSA），DH 组信息（默认 MODP 768），DH 公共值，IKE 生存时间，身份信息
2. DH 交换：A 向 B 发起密钥生成信息，B 生成密钥并回应。
3. ID 交换验证：A 向 B 发送身份和验证数据，B 回应身份验证。
   ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290256309.png)

野蛮模式：远程拨号时，由于拨号用户 IP 无法确定，可以使用野蛮模式

1. A 向 B 发送本地 IKE 策略，开始 DH 交换
2. B 查找匹配策略，回应验证信息
3. A 接收确认信息并验证，生成密钥，向 B 发送验证载荷
4. B 验证
   ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290256525.png)

- 阶段 2：在 IKE SA 的保护下完成 IPSec SA 的协商。采用快速模式

> 野蛮模式安全性差于主模式，但过程简单快速。
> 在不知道对端 IP 且需要使用预共享密钥的情况下，必须用野蛮模式。

### IPSec 包处理流程

**出站包处理：**

1. 查找 SPD，三种结果：丢弃、旁路安全服务：直接转发、提供安全服务：查找 IPSec SA
2. 若第一步结果是提供安全服务，就在 SAD 中找 IPsec SA，若找到就根据参数提供安全服务，若找不到就查找 IKE SA
3. 若找到 IKE SA，就只要创建 IPSec SA，若找不到 IKE SA，就要先创建 IKE SA，再创建 IPSec SA。

**入站包处理：**

1. 检查目的地址是否本地，若是则检查数据包是否被 IPSec 保护
2. 若被 IPSec 保护，则查找 IPSec SA，若不被 IPSec 保护，则交给上层
3. 若找到 IPSec SA，则解封装，若未找到则丢弃

### 安全协议

- AH：验证头，提供完整性保护、数据源验证、抗重播服务。不支持机密性保护。IP 协议，协议号 51。
  AH 头格式：
  `Next Header`：8 位，指示 AH 头后的载荷协议类型
  `Payload Length`：8 位，指示 AH 的长度并减 2，单位为 32 位
  `SPI`：32 位任意数值，用于和目的 IP 地址和安全协议标识结合，唯一标示一个 SA
  `Sequence Number`：32 位无符号整数，SA 建立时为 0，随着数据包发送而增大，接收方通过该值确定数据包的序列
  `Authentication Data`：包含该数据包的完整性校验值`ICV`（使用 HMAC 算法对 IP 头+AH 头+载荷+共享密钥加密计算），变长且必须是 32 位的整数倍。AH 强制实现`HMAC-MD5-96`和`HMAC-SHA-1-96`两种验证算法
- ESP：封装安全载荷，有 AH 所有功能且支持加密。包含 ESP 头和 ESP 尾。IP 协议，协议号 50。
  ESP 头格式：
  `Next Header`：同上。强制包含。
  `SPI`：同上
  `Sequence Number`：同上
  `Payload Data`：`Next Header`描述的数据，即载荷数据，长度为字节的整数倍。若加密，ESP 强制实现了基础加密算法 DES-CBC。强制包含。
  `Padding`：填充，使载荷数据达到指定长度。
  `Pad Length`：填充长度，范围为 0 到 255。强制包含。
  `Authentication Data`：ICV，长度由验证算法决定。可选，验证服务开启时才包含。同样强制实现`HMAC-MD5-96`和`HMAC-SHA-1-96`
  ESP 尾格式：`Padding`、`Pad Length`、`Next Header`

IPSec 有两种工作模式：

- 传输模式：保护端到端安全，两个终端间直接运行 IPSec，所有加解密、协商都是**端系统**完成，网络设备完全不参与 IPSec，只进行正常路由转发。
- 隧道模式：保护站点到站点安全，两个**安全网关**间运行 IPSec，整个数据包都计算 AH 或 ESP 头，AH 或 ESP 头加上数据都被封装在一个新的 IP 包中。所有加解密、协商都是安全网关完成，终端主机不参与。

因此 AH 和 ESP 对两种工作模式分别有封装的方式：

- **AH**

  - **传输模式**
    原 IP 包、AH 头与密钥通过散列函数（如 RSA）生成校验值。
    将校验值封装在 AH 头中，再由 TCP 和原 IP 头封装。
    ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290255719.png)

  - **隧道模式**
    新 IP 头（根据隧道起点终点建立隧道 IP 头）、AH 头与原 IP 包生成校验值。
    将校验值封装在 AH 头中，封装原 IP 包，再用新 IP 头封装。
    ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290255526.png)

- **ESP**

  - **传输模式**
    原 IP 包（不包括原 IP 头）、ESP 尾与密钥加密（通过 DES 等算法）生成密文。
    将生成的密文与 ESP 头和验证密钥通过数字签名算法（通过 RSA）生成校验值。
    最后将用 ESP 头和原 IP 头封装密文和校验值。
    ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290255216.png)

  - **隧道模式**
    将整个原 IP 包、ESP 尾、加密密钥通过加密算法（如 DES）生成密文。
    将密文与 ESP 头和验证密钥通过散列函数（如 RSA）生成校验值。
    用 ESP 头和新 IP 头封装密文和校验值。
    ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290255597.png)

### GRE-OVER-IPSEC

使用`Gre Over IPsec`的原因：GRE 不保证数据机密性与完整性，不能数据源验证。

| 特性       | GRE    | IPSec  |
| ---------- | ------ | ------ |
| 多协议     | 支持   | 不支持 |
| 虚接口     | 支持   | 不支持 |
| 组播       | 支持   | 不支持 |
| 路由协议   | 支持   | 不支持 |
| IP 协议族  | 支持   | 支持   |
| 机密性     | 不支持 | 支持   |
| 完整性     | 不支持 | 支持   |
| 数据源验证 | 不支持 | 支持   |

封装：原始 IP 包被封装在 GRE 隧道包中。GRE 隧道包被封装在 IPSec 包中。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290256206.png)

### IPSEC-OVER-GRE

## MPLS

Multi Protocol Labal Switching：多协议标签交换
MPLS 使用定长标签封装网络层分组。标签位于数据链路层和网络层之间，称为 2.5 层。
多协议指：MPLS 被多种二层协议封装，也可封装多种三层协议

两种工作模式：

1. 帧模式：用于 PPP、以太网、帧中继
2. 信元模式：作用于 ATM

组成：

1. LSR：位于 MPLS 内部的核心交换机或路由器，提供标签交换和分发
2. LER：位于 MPLS 网络边缘，提供标签映射、移除和分发

FEC：转发等价类，转发过程中以等价方式处理的一组数据分组，可根据 IP 地址、隧道、COS 标识创建 FEC
LSP：标签交换通道，属于同一个 FEC 的数据流在每个节点赋予一个确定的标签，按照一个确定的标签转发表项进行转发，每个 FEC 流会有固定的转发路径，该路径就成为该 FEC 的 LSP

MPLS 标签：4 个字节。分为四个字段

1. Label：标签值，20 位，标签转发表的关键索引
2. EXP：标识 QoS 优先级，3 位
3. S：栈底标识，1 位，若为 1 说明是最后一个标签，若为 0 说明后面还有 MPLS 标签。可实现多层 MPLS 标签嵌套
4. TTL：存活时间，8 位，每经过一台 LSR，TTL 就减 1
   ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290256228.png)

链路层协议为 MPLS 分配的标识：

1. PPP：0x0281
2. 以太网或 HDLC：0x8847
3. 帧中继：0x0080

标签分配协议：用于在 LSR 间分配标签，建立 LSP。有以下四种：

1. LDP 标签分发协议：最通用
2. CR-LDP 基于路由受限的标签分发协议：可进行路由约束、QoS，用于流量工程
3. RSVP-TE 基于流量工程扩展的资源预留协议：用于流量工程中 MPLS 标签分配
4. MP-BGP 多协议扩展 BGP 协议：为 BGP 路由分配 MPLS 标签

LDP 消息类型：

1. 发现`Discover`消息：LDP 邻居的发现维护
2. 会话`Session`消息：LDP 邻居会话的建立维持与终止
3. 通告`Advertisement`消息：向 LDP 邻居宣告 Label、地址等信息
4. 通知`Notification`消息：向 LDP 邻居通知事件或错误

> 所有 LDP 消息都采用 TLV 结构，具有扩展性（TLV：Type-Length-Value 类型-长度-值）

LDP 会话建立维护：

1. 邻居发现：互发`Hello`消息，组播地址`224.0.0.2`，UDP 端口 646
2. TCP 连接：LSR-ID 大的，即 IP 地址大的一方主动发起，TCP 端口 646
3. 会话建立：Master 发出初始化 Initialization 消息，携带协商参数。协商成功 Session 建立
4. 会话维持：互发 Keepalive 消息维持会话。LSR 之间发送 Label mapping 消息，形成标签转发表。期间若收到任何差错消息都会关闭会话，断开 TCP 连接。

LDP 邻居状态机：
**两台 LDP 邻居间建立`LDP Session`后，状态会维持在`Operational`**
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290256981.png)

标签分配过程：
上下游根据数据转发方向而定。`LDP Session`建立后路由器根据路由表分配标签，生成 MPLS 标签转发表
标签转发表包含：入标签`IN`，出标签`OUT`，出接口`next-hop`
标签为随机生成，16 以下系统保留

标签分配模式：

1. DOD 下游按需标记分配：上游 LSR 向下游 LSR 发送标签请求信息。下游 LSR 为此 FEC 分配标签，通过标签映射消息反馈给上游 LSR。原则：下游设备需要收到上游的标签请求才能分配标签
2. DU 下游自主标记分配：下游 LSR 在 LDP 会话建立后主动向上游 LSR 发布标签映射消息，不需等待上游请求

标签控制模式：

1. 有序：只有最下游设备能分发标签，上游设备只有收到了下游的标签映射消息，才能再向上游发送标签映射信息。使得 MPLS 的转发是端到端的
2. 独立：不管是不是最下游，不管是否收到下游的标签映射信息，都向上游发送标签映射信息。任何的数据流经过 MPLS 网络都可进行 MPLS 转发

标签保持方式：收到下游的标签映射后，是否记录标签信息的原则

1. 保守：只保留下一跳邻居的标签，丢弃所有非下一跳邻居发来的标签
   优点：节约空间
   缺点：当网络故障时，LSP 收敛较慢
2. 自由：保留来自邻居的所有标签。
   优点：网络故障后，路由切换时收敛快
   缺点：消耗空间

> 常用组合：DU + 有序 + 自由

**MPLS 转发：**
第一阶段：标签 PUSH：报文进入 MPLS 网络，LER 设备发现报文目的 IP 地址有关联的标签，对报文进行压标签。该报文就变为了 MPLS 报文
第二阶段：标签 SWAP：报文在 MPLS 网络内进行标签交换。
第三阶段：标签 POP：报文转出 MPLS 网络时，在最后一跳弹出标签。倒数第二跳的设备上标签表的出标签为 3，说明此为倒数第二跳。一旦包查找到出标签为 3，就直接弹出标签。

## BGP-MPLS-VPN

解决了传统 VPN 的问题：1.实现隧道动态建立 2.解决本地地址冲突问题 3.VPN 私网路由易于控制

### 多 VPF 组网

多 VRF 技术用于解决同一台设备（PE）上地址冲突问题。
存在以下路由器角色：

- CE：直接与 ISP 相连的用户设备
- PE：公网边缘路由器，与 CE 相连，负责 VPN 接入
- P：公网核心路由器，负责路由与快速转发

实现：将一台路由器划分为多个 VRF，每个 VRF 相互独立，拥有各自的路由表、端口、协议，每个 VRF 类似一台虚拟路由器。未划分 VRF 的路由在公网路由表中。各个 VRF 与各自的网络运行一个实例，该实例学到的路由只能加入该 VPN 路由表。实例与所属 VPN 进行绑定。并且，端口与 VPN 绑定，与 VRF 绑定的接口只会出现在该 VRF 对应的路由表中，当报文从该接口进入路由器后只能查询该 VRF 对应的路由表。确保了不同 VRF 数据间不会冲突。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290257660.png)

多 VRF 与路由协议多实例：各 VRF 与各自用户网络之间运行一个路由实验，该路由实例学习到的路由只能加入该 VPN 的路由表。各个路由实例与所属 VPN 绑定，互相独立，只能学到各自的邻居信息。

### MP-BGP

MP-BGP（Multi 　 Protocol BGP，多协议 BGP）是对 BGP 根据特性（TCP 连接、TLV 扩展属性位）进行扩展的协议。
MP-BGP 相对于 BGP 的新增特性：

- 普通 BGP 只能传递 IPv4 信息，MP-BGP 能承载多个协议路由信息。
- 新增了`MP_REACH_NLRI`和`MP_UNREACH_NLRI`两个属性，并新增了扩展团体属性（Extended_Communities）。
- MP-BGP 可传递 BGP MPLS VPN、L2VPN、6PE 等路由信息。

> `MP_REACH_NLRI`和`MP_UNREACH_NLRI`两个属性都是路由更新消息属性。
> `MP_REACH_NLRI`代替了原 BGP 更新消息中的`NLRI`和`Next-hop`。增加了地址族的描述 Address-Family、私网 Label 和 RD，包含原有的 Next-hop。
> 若地址族描述为 VPNv4，则 NLRI 包含两个部分，一个是私网标签（一个 MPLS 标签），第二部分是 VPNv4 地址（RD+IPv4 地址）
> `MP_UNREACH_NLRI`代替了原 BGP 更新消息中的`Withdrawn Routes`。可撤销通过`MP_REACH_NLRI`发布的各种地址族的路由。包含`Address-Family`和`Withdrawn Routes`。

**VPNv4 地址族主要用于 PE 路由器间传递 VPN 路由，并只存在于 MP-BGP 路由信息和 PE 设备的私网路由表中，即只出现在路由的发布学习过程中，在穿越 ISP 公网时，数据包头是没有 VPNv4 地址的。**

<center>下图为MP_REACH_NLRI属性</center>

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290257506.png)

<center>下图为MP_UNREACH_NLRI属性</center>

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290257134.png)

BGP 的扩展团体属性：RT（Route Target）路由目标。本质是每个 VPN 实例表达自己的路由取舍方式。
RT 的格式有三种，都表示 RT。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290257445.png)

- `0x0002`：2 字节的 AS 号，加上 4 字节的用户自定义数字，如`100:1`、`200:1`
- `0x0102`：4 字节的 IP 地址，加上 2 字节的用户自定义数字，如`192.168.1.1:1`、`10.1.1.1:2`
- `0x0202`：4 字节的 AS 号，加上 2 字节的用户自定义数字

> 通常设置为冒号后的数字设置为 VPN 实例编号。

RT 由两个部分组成：`Export Target`和`Import Target`。MP-BGP 在 PE 间交互私网路由时，需要遵循以下规则：

- 在 PE 设备上，发送某一个 VPN 用户的私网路由给 BGP 邻居时，需要在扩展团体属性区域中增加该 VPN 的`Export Target`属性。
- 在 PE 设备上，需要将收到的 MP-BGP 路由的扩展团体属性中携带的 RT 值与本地每个 VPN 的`Import Target`对比，若存在交集，则可以将该路由添加进实例的路由表。

通过对 RT 的操作可实现两种模式：`Hub-Spoke`和`Extranet`。
`Hub-Spoke`模式：用户总部可与每个分布互通，但每个 VPN 分布之间禁止互通。
`Extranet`模式：使指定的节点可以与其他节点互通。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290258619.png)

RD（Route Distinguisher）路由区分。本质就是用于私网路由的撤销，因为在撤销路由时是不能携带属性值的（包括 RT），PE 在删除路由时无法判断撤销哪个 VPN 的路由。长度 6 字节。
RD 有两种格式：

- 2 字节的 AS 号，加上 4 字节用户自定义数，如`100:1`
- 4 字节的 IP 地址，加上 2 字节用户自定义数，如`192.168.1.1:1`

只要保证存在相同地址的两个 VPN 实例的 RD 不同即可，但最好为每个 VPN 实例配置一个 RD。若两个 VPN 实例中存在相同 IP 地址，则这两个实例一定不能互访，间接互访也不行。

私网标签 Label，用于帮助 PE 判断该报文前往的 VPN，是通过 MPLS 的多标签嵌套实现的。

BGP MPLS VPN 实现分为以下步骤：

- 公网隧道建立：公网 IGP 协议开启，PE 间互通。
- 本地 VPN 建立：PE 上设置本地 VPN 并设置 RD、RT 属性，然后将 VPN 与接口绑定，即配置 VRF。
- 私网路由的学习：PE 与 CE 间运行路由协议多实例，各 VPN 实例进行路由学习。PE 间建立 MP-BGP 邻居，下游 LSR 分配标签，建立标签转发表。并会生成一条 MP-BGP 更新消息，包含 VPNv4 路由前缀（即 IP 地址）、下一跳地址、RT 属性、私网标签。PE 设备会对比 RT 值，若通过就会记录该路由信息并发布给本地 VPN。
- 私网数据转发：数据会根据标签转发表进行转发。

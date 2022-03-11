---
title: IS-IS学习笔记
date: 2018-08-05 15:18:10
tags: [IS-IS, 网络]
categories: [网络]
---

**基于华三网络学习笔记**

本篇主要包含以下内容：

- [OSI 地址](#osi-地址)
- [IS-IS 概述](#is-is-概述)
  - [IS-IS 常见术语：](#is-is-常见术语)
  - [IS-IS 协议报文](#is-is-协议报文)
  - [IS-IS 网络类型](#is-is-网络类型)
- [IS-IS 实现](#is-is-实现)
  - [邻接关系](#邻接关系)
  - [LSDB 同步](#lsdb-同步)
- [参考资料](#参考资料)

<!--more-->

## OSI 地址

在 OSI 协议体系中，OSI 地址标识了一台支持 OSI 协议的设备。IS-IS 的报文封装在数据链路层，采用 OSI 报文格式，包含 OSI 地址。IS-IS 协议将 ISO 网络层地址称 NSAP。IS-IS 用 OSI 地址标识不同 IS，并构建网络拓扑数据库，计算到达各节点的最短路径树。

OSI 地址使用的是 NASP（Network Service Access Point 网络服务接入点）地址格式，是 IP 地址和上层协议号的组合，用于标识设备和设备启用的服务。

NASP 由 IDP（Initial Domian Part 初始域部分）和 DSP（Domain Specific Part 域指定部分），IDP 表示 IP 地址的主网络号，DSP 表示 IP 地址的子网号和主机地址。IDP 和 DSP 长度是可变的，但 NASP 的总长最多为 20 字节，最少 8 字节。

在 IS-IS 中，NASP 地址被分为 3 部分：可变长区域地址，System ID，NSEL。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120055808.png)

System ID 用于在区域中唯一表示主机或服务器，一般会由 Router ID 转换得出。

> 转换方法：Router ID 的每部分都扩展为 3 位数字，不足则在前补零，将扩展后的地址重新划分为 3 部分，每部分 4 个数字，得到 System ID

NSEL 类似于协议标识符，当协议为 IP 时，NSEL 均为 00。

路由器只需配置一个区域地址，但最多可以配置 3 个，同一区域中所有节点的区域地址都相同。

NET（Network Entity Title 网络实体名称）指示的是 IS 本身的网络层信息，不包括传输层信息，可看做 NSEL 为 0 的特殊的 NASP。一台路由器只需配置一个 NET，最多 3 个，若配置多个 NET，则必须保证 System ID 相同。NET 除了可以通过 Router ID 转换变得，也可通过 MAC 地址转换变得，但 MAC 地址由于具有全局性，一个区域内的路由器的 MAC 没有规律，管理不方便，所以一般还是用 Router ID 映射。

## IS-IS 概述

IS-IS（Intermediate System-to-Intermediate System，中间系统到中间系统）是 ISO 为 CLNP（Connection Less Network Protocol，无连接网络协议）设计的一种动态路由协议。IS-IS 能够同时应用在 TCP/IP 和 OSI 环境中，形成了集成化 IS-IS。采用 TLV 架构，易于扩展。

IS-IS 属于内部网关路由协议，用于自治系统内部。IS-IS 是一种链路状态协议，与 TCP/IP 网络中的 OSPF 协议非常相似，使用最短路径优先算法 SPF 进行路由计算。

### IS-IS 常见术语：

区域（Area）：路由域的细分单元，IS-IS 允许将整个路由域分为多个区域

路由域（Routing Domain）：较大的区域，可包含多个区域

中间系统 Intermediate System（IS）：即路由器

终端系统 End System（ES）：即主机

ES-IS：主机和路由器之间运行的协议

IS-IS：路由器与路由器之间运行的协议，就是用来提供路由域内或一个区域内的路由

IS-IS 路由器有三种角色：

1. Level-1：负责区域内的路由，只与属于**同一区域的 Level-1 和 Level-1-2 路由器形成邻居关系**，维护一个 Level-1 的链路状态数据库，该链路状态数据库包含**本区域的路由信息**，到区域外的报文转发给最近的 Level-1-2 路由器。
2. Level-2：负责区域间的路由，可以与**同一区域或者其它区域的 Level-2 和 Level-1-2 路由器形成邻居关系**，维护一个 Level-2 的链路状态数据库，该链路状态数据库包含**区域间的路由信息**。所有**Level-2**路由器和**Level-1-2**路由器组成路由域的**骨干网**，负责在不同区域间通信，路由域中的 Level-2 路由器必须是物理连续的，以保证骨干网的连续性。
3. Level-1-2：同时属于 Level-1 和 Level-2 的路由器，可以与**同一区域的 Level-1 和 Level-1-2 路由器形成 Level-1 邻居关系**，也可以与**同一区域或者其他区域的 Level-2 和 Level-1-2 路由器形成 Level-2 的邻居关系**。Level-1 路由器必须通过 Level-1-2 路由器才能连接至其他区域。Level-1-2 路由器维护两个链路状态数据库，Level-1 的链路状态数据库用于区域内路由，Level-2 的链路状态数据库用于区域间路由。

每台路由器只能属于一个区域，区域边界在链路上。

### IS-IS 协议报文

IS-IS 使用协议数据单元 PDU 进行通讯。PDU 有以下类型：

- IS-IS Hello PDU：简称 IIH，负责路由间的邻居关系建立和维护
- 链路状态 PDU：简称 LSP，描述路由器中的所有链路状态信息
- 时序报文 SNP：用于确认邻居间最新接收的 LSP，类似于确认报文。包括两种报文：CSNP 和 PSNP
- 全时序报文 CSNP：包含网络中每个 LSP 的摘要信息。当路由器收到一个 CSNP 时，它会将该 CSNP 与其链路状态数据库 LSDB 进行比较，如果该路由器丢失了一个在 CSNP 中存在的 LSP 时， 它会发送一个组播 PSNP，向网络中其它路由器索要其需要的 LSP。
- 部分时序报文 PSNP：在点对点链路中用于确认接收的 LSP 和请求最新或者丢失的 LSP；在广播链路中仅用于请求最新或者丢失的 LSP。

IS-IS 报文直接封装在链路层数据中。报头包含通用报头 Common Header 和专用报头 Specific Header。

### IS-IS 网络类型

点对点：主要用于 PPP、HDLC

广播：主要用于以太网

## IS-IS 实现

### 邻接关系

1. 邻居关系建立

   若在点对点网络，只要 IS 能接收到对端的 P2P IIH 报文，则邻居能建立，状态变为 UP

   若在广播网络，邻居建立需要三次握手。

2. 邻接关系建立

   若在点对点网络：

   若在同一区域 Area，L1 间只建立 L1 邻接关系，L1 和 L1/2 只建立 L1 邻接关系，L1/2 间建立 L1 和 L2 邻接关系。

   若在不同区域，L1 间不建立邻接关系（邻居关系都不是），L2 间建立 L2 邻接关系，L1/2 间建立 L2 邻接关系。

   若在广播网络：会选举 DIS（Desginated IS，指定 IS），类似 DR，相同角色的 IS 间会选举一个，例如 L1 的路由器间选出一个，与 L2 间选出的并不冲突。

**DIS 的作用：**

**一旦一个设备选举为 DIS 以后，DIS 发送 HELLO 数据包的时间间隔是普通路由器的 1/3，这样可以保证 DIS 失效的时候可以被快速检测到**。

**DIS 的选举是抢占的, 不能不参加选举，IS-IS 中不存在备份 DIS,当一个 DIS 不能工作的时候，直接选举另外一个**。

- 在广播子网中创建并向所有的路由器通告伪节点 LSP(Link State Protocol Data unit 链路状态数据单元).
- 在 LAN 中通过每 10s 周期性发送 CSNP（完全数据库描述）来泛洪 LSP(Link State Protocol Data unit 链路状态数据单元).

**DIS 的选举过程：**

1. 比较接口优先级，高的优
2. 具有最大的(SNPA 子网接入点)的路由器将当选 DIS。广播网络中 SNPA 是指 MAC 地址

|                | 点到点  | 广播              |
| -------------- | ------- | ----------------- |
| Hello 报文     | P2P IIH | Level-1/2 LAN IIH |
| Hello 报文形式 | 单播    | 组播              |
| Hello 定时器   | 10s     | 10s，DIS 为 3.3s  |
| 邻接关系数量   | 1       | 多个              |

### LSDB 同步

同步相关报文：

1. LSP 报文：用于描述链路状态信息

   Level-1 LSP 仅在区域内传播，Level-2 LSP 在骨干网传播

2. SNP 报文：用于描述 LSDB 中 LSP 摘要，并对邻居之间最新接收的 LSP 进行确认

3. CSNP 报文：包含所有 LSP 的摘要信息，在广播网络中周期发送，在点对点网络中只在第一次发送

4. PSNP 报文：列举最近收到的一个或多个 LSP 序号，用于 LSP 确认

**在广播网络中：**

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120055109.png)

1. 所有同类路由器向 DIS 发送自己的所有 LSP
2. DIS 周期发送 LSP 摘要信息
3. IS 向 DIS 发送 PSNP 响应
4. DIS 回复 LSP_K

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120057010.png)
## 参考资料

> [百度百科 IS-IS](https://baike.baidu.com/item/is-is/930474)

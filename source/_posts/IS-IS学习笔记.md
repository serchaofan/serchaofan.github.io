---
title: IS-IS学习笔记
date: 2018-08-05 15:18:10
tags: [IS-IS,网络]
---

**基于华三网络学习笔记**

本篇主要包含以下内容：

* [OSI地址](OSI地址)
* [IS-IS概述](IS-IS概述)
* [IS-IS实现](#IS-IS实现)

<!-- more -->

## OSI地址

在OSI协议体系中，OSI地址标识了一台支持OSI协议的设备。IS-IS的报文封装在数据链路层，采用OSI报文格式，包含OSI地址。IS-IS协议将ISO网络层地址称NSAP。IS-IS用OSI地址标识不同IS，并构建网络拓扑数据库，计算到达各节点的最短路径树。

OSI地址使用的是NASP（Network Service Access Point网络服务接入点）地址格式，是IP地址和上层协议号的组合，用于标识设备和设备启用的服务。

NASP由IDP（Initial Domian Part初始域部分）和DSP（Domain Specific Part域指定部分），IDP表示IP地址的主网络号，DSP表示IP地址的子网号和主机地址。IDP和DSP长度是可变的，但NASP的总长最多为20字节，最少8字节。

在IS-IS中，NASP地址被分为3部分：可变长区域地址，System ID，NSEL。

{% asset_img 1.png %}

System ID用于在区域中唯一表示主机或服务器，一般会由Router ID转换得出。

>  转换方法：Router ID的每部分都扩展为3位数字，不足则在前补零，将扩展后的地址重新划分为3部分，每部分4个数字，得到System ID

NSEL类似于协议标识符，当协议为IP时，NSEL均为00。

路由器只需配置一个区域地址，但最多可以配置3个，同一区域中所有节点的区域地址都相同。

NET（Network Entity Title网络实体名称）指示的是IS本身的网络层信息，不包括传输层信息，可看做NSEL为0的特殊的NASP。一台路由器只需配置一个NET，最多3个，若配置多个NET，则必须保证System ID相同。NET除了可以通过Router ID转换变得，也可通过MAC地址转换变得，但MAC地址由于具有全局性，一个区域内的路由器的MAC没有规律，管理不方便，所以一般还是用Router ID映射。



## IS-IS概述

IS-IS（Intermediate System-to-Intermediate System，中间系统到中间系统）是ISO为CLNP（Connection Less Network Protocol，无连接网络协议）设计的一种动态路由协议。IS-IS能够同时应用在TCP/IP和OSI环境中，形成了集成化IS-IS。采用TLV架构，易于扩展。

IS-IS属于内部网关路由协议，用于自治系统内部。IS-IS是一种链路状态协议，与TCP/IP网络中的OSPF协议非常相似，使用最短路径优先算法SPF进行路由计算。

### IS-IS常见术语：

区域（Area）：路由域的细分单元，IS-IS允许将整个路由域分为多个区域

路由域（Routing  Domain）：较大的区域，可包含多个区域

中间系统Intermediate System（IS）：即路由器

终端系统End  System（ES）：即主机

ES-IS：主机和路由器之间运行的协议

IS-IS：路由器与路由器之间运行的协议，就是用来提供路由域内或一个区域内的路由



IS-IS路由器有三种角色：

1. Level-1：负责区域内的路由，只与属于**同一区域的Level-1和Level-1-2路由器形成邻居关系**，维护一个Level-1的链路状态数据库，该链路状态数据库包含**本区域的路由信息**，到区域外的报文转发给最近的Level-1-2路由器。
2. Level-2：负责区域间的路由，可以与**同一区域或者其它区域的Level-2和Level-1-2路由器形成邻居关系**，维护一个Level-2的链路状态数据库，该链路状态数据库包含**区域间的路由信息**。所有**Level-2**路由器和**Level-1-2**路由器组成路由域的**骨干网**，负责在不同区域间通信，路由域中的Level-2路由器必须是物理连续的，以保证骨干网的连续性。
3. Level-1-2：同时属于Level-1和Level-2的路由器，可以与**同一区域的Level-1和Level-1-2路由器形成Level-1邻居关系**，也可以与**同一区域或者其他区域的Level-2和Level-1-2路由器形成Level-2的邻居关系**。Level-1路由器必须通过Level-1-2路由器才能连接至其他区域。Level-1-2路由器维护两个链路状态数据库，Level-1的链路状态数据库用于区域内路由，Level-2的链路状态数据库用于区域间路由。

每台路由器只能属于一个区域，区域边界在链路上。

### IS-IS协议报文

IS-IS使用协议数据单元PDU进行通讯。PDU有以下类型：

* IS-IS Hello PDU：简称IIH，负责路由间的邻居关系建立和维护
* 链路状态PDU：简称LSP，描述路由器中的所有链路状态信息
* 时序报文SNP：用于确认邻居间最新接收的LSP，类似于确认报文。包括两种报文：CSNP和PSNP
* 全时序报文CSNP：包含网络中每个LSP的摘要信息。当路由器收到一个CSNP时，它会将该CSNP与其链路状态数据库LSDB进行比较，如果该路由器丢失了一个在CSNP中存在的LSP时， 它会发送一个组播PSNP，向网络中其它路由器索要其需要的LSP。
* 部分时序报文PSNP：在点对点链路中用于确认接收的LSP和请求最新或者丢失的LSP；在广播链路中仅用于请求最新或者丢失的LSP。

IS-IS报文直接封装在链路层数据中。报头包含通用报头Common Header和专用报头Specific Header。

### IS-IS网络类型

点对点：主要用于PPP、HDLC

广播：主要用于以太网



## IS-IS实现

### 邻接关系

1. 邻居关系建立

   若在点对点网络，只要IS能接收到对端的P2P IIH报文，则邻居能建立，状态变为UP

   若在广播网络，邻居建立需要三次握手。

2. 邻接关系建立

   若在点对点网络：

   若在同一区域Area，L1间只建立L1邻接关系，L1和L1/2只建立L1邻接关系，L1/2间建立L1和L2邻接关系。

   若在不同区域，L1间不建立邻接关系（邻居关系都不是），L2间建立L2邻接关系，L1/2间建立L2邻接关系。

   若在广播网络：会选举DIS（Desginated IS，指定IS），类似DR，相同角色的IS间会选举一个，例如L1的路由器间选出一个，与L2间选出的并不冲突。



**DIS的作用：**

**一旦一个设备选举为DIS以后，DIS发送HELLO数据包的时间间隔是普通路由器的1/3，这样可以保证DIS失效的时候可以被快速检测到**。

**DIS的选举是抢占的, 不能不参加选举，IS-IS中不存在备份DIS,当一个DIS不能工作的时候，直接选举另外一个**。

* 在广播子网中创建并向所有的路由器通告伪节点LSP(Link State Protocol Data unit 链路状态数据单元).
* 在LAN中通过每10s周期性发送CSNP（完全数据库描述）来泛洪LSP(Link State Protocol Data unit 链路状态数据单元).

**DIS的选举过程：**

1. 比较接口优先级，高的优
2. 具有最大的(SNPA子网接入点)的路由器将当选DIS。广播网络中SNPA是指MAC地址



|               | 点到点  | 广播              |
| ------------- | ------- | ----------------- |
| Hello报文     | P2P IIH | Level-1/2 LAN IIH |
| Hello报文形式 | 单播    | 组播              |
| Hello定时器   | 10s     | 10s，DIS为3.3s    |
| 邻接关系数量  | 1       | 多个              |

### LSDB同步

同步相关报文：

1. LSP报文：用于描述链路状态信息

   Level-1 LSP仅在区域内传播，Level-2 LSP在骨干网传播

2. SNP报文：用于描述LSDB中LSP摘要，并对邻居之间最新接收的LSP进行确认

3. CSNP报文：包含所有LSP的摘要信息，在广播网络中周期发送，在点对点网络中只在第一次发送

4. PSNP报文：列举最近收到的一个或多个LSP序号，用于LSP确认



**在广播网络中：**

{% asset_img 2.png %}

1. 所有同类路由器向DIS发送自己的所有LSP
2. DIS周期发送LSP摘要信息
3. IS向DIS发送PSNP响应
4. DIS回复LSP_K



## 参考资料

> [百度百科IS-IS](https://baike.baidu.com/item/is-is/930474)
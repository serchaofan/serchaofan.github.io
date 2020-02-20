---
title: STP学习笔记
date: 2018-07-31 22:19:08
tags:
---

基于华三网络

<!--more-->

# STP

生成树协议（Spinning Tree Protocol，IEEE 802.1D）是二层网络中用于消除环路的协议。

简单实现原理：

- 通过阻断冗余链路来消除桥接网络中可能存在的路径回环
- 当前活动路径发生故障时，激活冗余备份链路，恢复网络连通性

桥之间交换BPDU（Bridge Protocol Data Unit，桥协议数据单元），来保证设备完成生成树的计算。

BPDU分为两类：

- 配置BPDU（Configuration BPDU）：进行生成树计算和维护生成树拓扑的报文
- TCN BPDU（Topology BPDU）：当拓扑结构改变时，用来通知相关设备的报文

STP消除环路的思想：

- 选择树根节点
- 确定最短路径
- 阻塞冗余链路

桥的角色：

- 根桥：通过选举成为生成树树根的桥
- 指定桥：除根桥外的桥

端口角色：

- 根端口
- 指定端口
- Alternate端口

路径开销：用于衡量桥之间路径的优劣，每条链路都有开销值，路径开销等于路径上全部链路的开销之和。

根路径开销：网桥到根桥的最短的路径开销

**配置BPDU：**
{% asset_img 1.png %}

- 网桥通过交换配置BPDU来获取STP计算所需的参数
- 配置BPDU基于二层组播方式发送，目的地址`01-80-C2-00-00-00`
- 配置BPDU由根桥周期（Hello Time，默认2s）发送
- 配置BPDU老化时间Max Age（默认20s），当超时后，网桥又会发送以自身为根的配置BPDU
- 配置BPDU包含以下信息：
  - 根桥ID（Root ID）
  - 根路径开销（Root Path Cost）
  - 指定桥ID（Designated Bridge ID）
  - 指定端口ID（Designated Port ID）
- 配置BPDU的比较原则：小的优先
  - 首先比较根桥ID
  - 再比较根路径开销
  - 再比较指定桥ID
  - 再比较指定端口ID
  - 最后比较桥的端口ID

**根桥选举：**

1. 每台设备的各个端口在初始化时生成以自己为根桥的配置信息，向外发送自己的配置信息
2. 各网桥将各个端口收到的配置BPDU和自己的配置BPDU做比较，得出优先级最高的配置BPDU，从而知道哪台设备为根桥。
3. 网桥保存该最优的配置BPDU，并从指定端口发送该配置BPDU，告诉其他设备根桥的信息
4. 网络收敛后，根桥向外发送配置BPDU，其他设备也对该配置BPDU进行转发

**确认端口角色：**

1. 根桥上的所有端口为指定端口
2. 非根桥上到根的路径开销最小的端口为根端口
3. 每个物理段的根路径开销最小的桥为指定桥，指定桥上连着该物理段的端口为指定端口
4. 既不是指定端口，又不是根端口的端口为Alternate端口，进行阻塞，不转发普通的以太网数据帧

收到低优先级的配置BPDU时的处理：通常非根桥不会主动发送配置BPDU，只有当网桥的指定端口收到一个低优先级的配置BPDU时，网桥会立即回应一个配置BPDU，确保新加入的网桥尽快确认根桥和端口角色。

**端口状态：**

- Disabled：未启用STP的端口，不收发BPDU，但能接收转发数据
- Blocking：Alternate端口，接收但不发送BPDU，不能接收转发数据
- Listening：接收并发送BPDU，不接收或转发数据，不进行地址学习
- Learning：接收并发送BPDU，不接收或转发数据，开始进行地址学习
- Forwarding：接收并发送BPDU，接收或转发数据，同时进行地址学习
  
端口被选为指定端口或根端口后，需要从Blocking经过Listening和Learning才能到达Forwarding。期间有两次Forward Delay，每次为15秒。设置Forward Delay的作用为：使BPDU消息有一个充分时间再网络中传播。

{% asset_img 2.png %}

**拓扑改变后处理：**

{% asset_img 3.png %}

如图：SWD的0/1端口故障导致hostA中断，经过MaxAge，SWE的0/1口配置BPDU老化，变为Listening，经过两个ForwardDelay，0/1口变为Forwarding状态。

但此时HostA仍不能连通HostB，因为SWA/B/C上Mac表未老化，HostB给HostA发的包仍会被发到SWD，被SWD丢弃。需要等Mac地址表老化（5min），才能重新学习。

**为减少拓扑收敛时间，STP使用TCN BPDU将最长的收敛时间缩减到50秒（MaxAge+2xForwardDelay）**

**使用TCN BPDU后的处理：**

1. 网桥感知拓扑变化，产生TCN BPDU从根端口发给根桥。（TCN BPDU的发送周期为Hello Time，若上游超时无回复就会一直发）
2. 若上游不是根桥，则上游会将要发送的配置BPDU的TCA置位，作为收到TCN的确认，并发给下游。然后再发TCN BPDU给根桥，依次如此传递直到根桥收到。
3. 根桥收到后，将要发送的配置BPDU的TCA置位，作为收到TCN的确认，并将TC置位，用于通知全网拓扑变化。
4. 下面的网桥收到消息后，将自身的MAC地址老化时间从5min变为ForwardDelay。

**网桥发送TCN BPDU的条件（满足一个）：**

- 有端口转变为Forwarding，且该网桥至少包含一个指定端口
- 有端口从Forwarding或Learning转变为Blocking

STP的缺陷：

- 收敛时间过长，两倍的Forwarding Delay导致连通性至少要几十秒才能恢复
- 若网络拓扑频繁变化，网络会频繁失去连通性（例如：主机频繁上下线，会产生大量TCN）

# RSTP
RSTP（Rapid Spanning Tree Protocol，快速生成树协议，IEEE 802.1W）是STP的优化版。
RSTP相较STP的改进：
- RSTP减少了端口的状态
- RSTP增加了端口的角色
- RSTP的配置BPDU的格式和发送方式有变化
- 拓扑改变时的处理不同，实现更快的收敛

RSTP的端口状态：
- Discarding：对应Disabled+Blocking+Listening，不能收发数据，不能地址学习
- Learning：不能收发数据，开始学习MAC地址，能收发BPDU
- Forwarding

RSTP端口角色变化：将STP的Alternate分为Alternate和Backup
- 当阻塞端口收到更优的配置BPDU来自其他网桥时，该端口为Alternate
- 当阻塞端口收到更优的配置BPDU来自本网桥时，该端口为Backup

{% asset_img 4.png %}

RSTP使用RST BPDU。与BPDU的区别：
- 协议版本号为`0x02`，标识RSTP
- 类型变为`0x02`，标识RST BPDU
- 使用了Flags的全8位
- 增加了Version 1 Length字段

网桥自行从指定端口发送RST BPDU，不需要等待来自根桥的RST BPDU。RST BPDU的老化时间为3xHello Time。

收到低优先级RST BPDU的处理：阻塞端口可立刻做出响应。

RSTP快速收敛机制：
- 边缘端口机制：边缘端口直接进入转发状态，无需延时，不会触发拓扑改变。当边缘端口收到BPDU后，会转变为非边缘端口
- 根端口快速切换机制：若旧的根端口已进入阻塞状态，且新的根端口连接的对端网桥的指定端口为Forwarding，则新拓扑的根端口可直接进入Forwarding
- 指定端口快速切换机制：指定端口通过与相连的网桥进行一次握手（P/A握手机制），直接进入Forwarding
  - 握手请求报文：Proposal
  - 握手回应报文：Agreement
  - 条件：必须在点对点链路
  {% asset_img 5.png %}

拓扑改变触发条件：只有非边缘端口转变为Forwarding，产生拓扑改变

拓扑改变处理：
- 在两倍Hello Time时间内向所有的其他指定端口和根端口发送TC置位的BPDU报文
- 清除除了接收到TC报文的端口外的所有其他指定端口和根端口的学习的MAC地址表

当RSTP与STP混用时：
- 若RSTP端口连续三次接收到STP的BPDU，则该端口切换回STP
- 切换到STP的RSTP端口就失去快速收敛特性
- 当STP与RSTP混用时，最好将STP设备放在网络边缘
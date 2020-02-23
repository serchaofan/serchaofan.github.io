---
title: STP学习笔记
date: 2018-07-31 22:19:08
tags:
---

基于华三网络

- [STP](#stp)
- [RSTP](#rstp)

<!--more-->

# STP

生成树协议（Spinning Tree Protocol，IEEE 802.1D）是二层网络中用于消除环路的协议。

简单实现原理：

- 通过阻断冗余链路来消除桥接网络中可能存在的路径回环
- 当前活动路径发生故障时，激活冗余备份链路，恢复网络连通性

桥之间交换 BPDU（Bridge Protocol Data Unit，桥协议数据单元），来保证设备完成生成树的计算。

BPDU 分为两类：

- 配置 BPDU（Configuration BPDU）：进行生成树计算和维护生成树拓扑的报文
- TCN BPDU（Topology BPDU）：当拓扑结构改变时，用来通知相关设备的报文

STP 消除环路的思想：

- 选择树根节点
- 确定最短路径
- 阻塞冗余链路

桥的角色：

- 根桥：通过选举成为生成树树根的桥
- 指定桥：除根桥外的桥

端口角色：

- 根端口
- 指定端口
- Alternate 端口

路径开销：用于衡量桥之间路径的优劣，每条链路都有开销值，路径开销等于路径上全部链路的开销之和。

根路径开销：网桥到根桥的最短的路径开销

**配置 BPDU：**
{% asset_img 1.png %}

- 网桥通过交换配置 BPDU 来获取 STP 计算所需的参数
- 配置 BPDU 基于二层组播方式发送，目的地址`01-80-C2-00-00-00`
- 配置 BPDU 由根桥周期（Hello Time，默认 2s）发送
- 配置 BPDU 老化时间 Max Age（默认 20s），当超时后，网桥又会发送以自身为根的配置 BPDU
- 配置 BPDU 包含以下信息：
  - 根桥 ID（Root ID）
  - 根路径开销（Root Path Cost）
  - 指定桥 ID（Designated Bridge ID）
  - 指定端口 ID（Designated Port ID）
- 配置 BPDU 的比较原则：小的优先
  - 首先比较根桥 ID
  - 再比较根路径开销
  - 再比较指定桥 ID
  - 再比较指定端口 ID
  - 最后比较桥的端口 ID

**根桥选举：**

1. 每台设备的各个端口在初始化时生成以自己为根桥的配置信息，向外发送自己的配置信息
2. 各网桥将各个端口收到的配置 BPDU 和自己的配置 BPDU 做比较，得出优先级最高的配置 BPDU，从而知道哪台设备为根桥。
3. 网桥保存该最优的配置 BPDU，并从指定端口发送该配置 BPDU，告诉其他设备根桥的信息
4. 网络收敛后，根桥向外发送配置 BPDU，其他设备也对该配置 BPDU 进行转发

**确认端口角色：**

1. 根桥上的所有端口为指定端口
2. 非根桥上到根的路径开销最小的端口为根端口
3. 每个物理段的根路径开销最小的桥为指定桥，指定桥上连着该物理段的端口为指定端口
4. 既不是指定端口，又不是根端口的端口为 Alternate 端口，进行阻塞，不转发普通的以太网数据帧

收到低优先级的配置 BPDU 时的处理：通常非根桥不会主动发送配置 BPDU，只有当网桥的指定端口收到一个低优先级的配置 BPDU 时，网桥会立即回应一个配置 BPDU，确保新加入的网桥尽快确认根桥和端口角色。

**端口状态：**

- Disabled：未启用 STP 的端口，不收发 BPDU，但能接收转发数据
- Blocking：Alternate 端口，接收但不发送 BPDU，不能接收转发数据
- Listening：接收并发送 BPDU，不接收或转发数据，不进行地址学习
- Learning：接收并发送 BPDU，不接收或转发数据，开始进行地址学习
- Forwarding：接收并发送 BPDU，接收或转发数据，同时进行地址学习

端口被选为指定端口或根端口后，需要从 Blocking 经过 Listening 和 Learning 才能到达 Forwarding。期间有两次 Forward Delay，每次为 15 秒。设置 Forward Delay 的作用为：使 BPDU 消息有一个充分时间再网络中传播。

{% asset_img 2.png %}

**拓扑改变后处理：**

{% asset_img 3.png %}

如图：SWD 的 0/1 端口故障导致 hostA 中断，经过 MaxAge，SWE 的 0/1 口配置 BPDU 老化，变为 Listening，经过两个 ForwardDelay，0/1 口变为 Forwarding 状态。

但此时 HostA 仍不能连通 HostB，因为 SWA/B/C 上 Mac 表未老化，HostB 给 HostA 发的包仍会被发到 SWD，被 SWD 丢弃。需要等 Mac 地址表老化（5min），才能重新学习。

**为减少拓扑收敛时间，STP 使用 TCN BPDU 将最长的收敛时间缩减到 50 秒（MaxAge+2xForwardDelay）**

**使用 TCN BPDU 后的处理：**

1. 网桥感知拓扑变化，产生 TCN BPDU 从根端口发给根桥。（TCN BPDU 的发送周期为 Hello Time，若上游超时无回复就会一直发）
2. 若上游不是根桥，则上游会将要发送的配置 BPDU 的 TCA 置位，作为收到 TCN 的确认，并发给下游。然后再发 TCN BPDU 给根桥，依次如此传递直到根桥收到。
3. 根桥收到后，将要发送的配置 BPDU 的 TCA 置位，作为收到 TCN 的确认，并将 TC 置位，用于通知全网拓扑变化。
4. 下面的网桥收到消息后，将自身的 MAC 地址老化时间从 5min 变为 ForwardDelay。

**网桥发送 TCN BPDU 的条件（满足一个）：**

- 有端口转变为 Forwarding，且该网桥至少包含一个指定端口
- 有端口从 Forwarding 或 Learning 转变为 Blocking

STP 的缺陷：

- 收敛时间过长，两倍的 Forwarding Delay 导致连通性至少要几十秒才能恢复
- 若网络拓扑频繁变化，网络会频繁失去连通性（例如：主机频繁上下线，会产生大量 TCN）

# RSTP

RSTP（Rapid Spanning Tree Protocol，快速生成树协议，IEEE 802.1W）是 STP 的优化版。
RSTP 相较 STP 的改进：

- RSTP 减少了端口的状态
- RSTP 增加了端口的角色
- RSTP 的配置 BPDU 的格式和发送方式有变化
- 拓扑改变时的处理不同，实现更快的收敛

RSTP 的端口状态：

- Discarding：对应 Disabled+Blocking+Listening，不能收发数据，不能地址学习
- Learning：不能收发数据，开始学习 MAC 地址，能收发 BPDU
- Forwarding

RSTP 端口角色变化：将 STP 的 Alternate 分为 Alternate 和 Backup

- 当阻塞端口收到更优的配置 BPDU 来自其他网桥时，该端口为 Alternate
- 当阻塞端口收到更优的配置 BPDU 来自本网桥时，该端口为 Backup

{% asset_img 4.png %}

RSTP 使用 RST BPDU。与 BPDU 的区别：

- 协议版本号为`0x02`，标识 RSTP
- 类型变为`0x02`，标识 RST BPDU
- 使用了 Flags 的全 8 位
- 增加了 Version 1 Length 字段

网桥自行从指定端口发送 RST BPDU，不需要等待来自根桥的 RST BPDU。RST BPDU 的老化时间为 3xHello Time。

收到低优先级 RST BPDU 的处理：阻塞端口可立刻做出响应。

RSTP 快速收敛机制：

- 边缘端口机制：边缘端口直接进入转发状态，无需延时，不会触发拓扑改变。当边缘端口收到 BPDU 后，会转变为非边缘端口
- 根端口快速切换机制：若旧的根端口已进入阻塞状态，且新的根端口连接的对端网桥的指定端口为 Forwarding，则新拓扑的根端口可直接进入 Forwarding
- 指定端口快速切换机制：指定端口通过与相连的网桥进行一次握手（P/A 握手机制），直接进入 Forwarding
  - 握手请求报文：Proposal
  - 握手回应报文：Agreement
  - 条件：必须在点对点链路
    {% asset_img 5.png %}

拓扑改变触发条件：只有非边缘端口转变为 Forwarding，产生拓扑改变

拓扑改变处理：

- 在两倍 Hello Time 时间内向所有的其他指定端口和根端口发送 TC 置位的 BPDU 报文
- 清除除了接收到 TC 报文的端口外的所有其他指定端口和根端口的学习的 MAC 地址表

当 RSTP 与 STP 混用时：

- 若 RSTP 端口连续三次接收到 STP 的 BPDU，则该端口切换回 STP
- 切换到 STP 的 RSTP 端口就失去快速收敛特性
- 当 STP 与 RSTP 混用时，最好将 STP 设备放在网络边缘

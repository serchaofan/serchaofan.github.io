---
title: OSPF学习笔记
date: 2018-07-31 12:36:00
tags: [OSPF, 网络]
categories: [网络]
comments: false
---

**基于华三网络学习笔记（理论）**

本篇包含以下内容

- [OSPF 特性与基本术语](#ospf-特性与基本术语)
- [OSPF 报文](#ospf-报文)
- [OSPF 邻居建立维护与状态机](#ospf-邻居建立维护与状态机)
  - [链路状态广播 LSA](#链路状态广播-lsa)
- [OSPF 特殊区域](#ospf-特殊区域)

  <!-- more -->

## OSPF 特性与基本术语

Open Shortest Path First 开放最短路径优先

- 属于 IGP，优先级 AS 内部 10，外部 150
- 采用链路状态算法 SPF 防环
- 封装在 IP 报文中，协议号 89
- 度量值为开销 cost=带宽参考值/接口带宽，参考值通常为 100M，若求得的数小于 1，则 cost 就取 1
- 报文更新方式为触发更新+周期更新（30min。LSA 老化时间 60min）
- 增量更新（通过 LSA），组播更新报文
- 组播地址 224.0.0.5（主要，所有 OSPF 路由器都能收到）或 224.0.0.6（DR、BDR 可收到）
- 没有跳数限制，可用于大规模组网

路由生成过程：

1. 生成 LSA 描述自身接口状态（链路开销、IP 地址等）
2. 同步 OSPF 区域内每台路由器的 LSDB（通过交换 LSA）
3. SPF 算法计算路由：每个路由器以自身为根计算最短路径树（即根到各节点的开销都是最小的），加入路由表，若两条路径开销相同，则都加入表中形成等价路由。

开启 OSPF 的路由器上与路由转发相关的三张表：

- 邻居表：记录建立了邻居关系的路由器
- LSDB 表：记录所有链路状态信息，需要实时同步
- 路由表：记录经 SPF 算法计算的路由

OSPF 选路原则：

1. 按路由类型优先级：区域内路由>区域间路由>第一类外部路由>第二类外部路由
2. 类型相同，选路由开销小的
3. 以上都相同，形成等价路由

两类外部路由：
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120049845.png)

- 第一类外部路由：偏向于 AS 内部的选路，并不关心 AS 外的开销。用于控制入 AS 的路由选路。
  如图中 RTA，若选择第一类外部路由，则关心 AS 内部的开销，会选择开销较小的 RTB 路线。
- 第二类外部路由：偏向与 AS 外部的选路，并不关心 AS 内的开销。用于控制出 AS 的路由选路。
  如图中 RTA，若选择第二类外部路由，则关心 AS 外部的开销，会选择开销较小的 RTC 路线。

若同一网段的路由信息同时通过第一类外部路由和第二类外部路由学习到，在其他条件相同的情况下，会优选第一类外部路由。

骨干区域：area 0，负责转发非骨干区域之间的路由。
区域间路由规则：

1. 非骨干区域必须与骨干区域相连
2. 非骨干区域之间不能传递路由，必须通过骨干区域
3. 骨干区域传出的路由不能传回非骨干区域

OSPF 防环：从一个区域学习到的路由不会再向该区域注入。非骨干区域间不能直接通信

当骨干区域被分割或非骨干区域不与骨干区域相连时，可通过虚连接解决。
两台 ABR（区域边界路由器）通过一个非骨干区域建立一条逻辑通道，对于通道上的路由器是透明的。

划分区域的好处：

- 减少了区域内 LSDB 中链路状态信息的数量
- 便于管理
- 减少路由震荡的影响范围

OSPF 路由器类型：

1. 区域内路由器 Internal：所有接口都属于同一个区域
2. 区域边界路由器 Area Border：连接骨干与非骨干区域（物理上或逻辑上）
3. 骨干路由器 Backbone：至少有一个接口属于骨干区域，即所有区域内和区域边界路由器都是骨干路由器
4. 自治系统边界路由器 Autonomous System Border：与其他 AS 路由器交换路由信息，不一定在 AS 的边界，只要该路由器引入外部路由，就是 ASBR。
   ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120049826.png)

Router ID 用来在 AS 中唯一标识一个路由器，RouterID 的选取优先级如下：
局部 > 全局 > 自动选举
局部：创建 OSPF 进程时同时指定 router-id
全局：系统视图下指定 router id
自动选举：环回口中最大的，若无环回口，则选取接口中 IP 地址最大的

网络类型：

1. Broadcast 广播：当链路层为以太网协议时，默认为 Broadcast，以组播地址发报文(.5|.6)，需要 DR，Hello 定时器 10s，邻居失效时间 40s。
2. NBMA 非广播多点可达网络：当链路层为帧中继或 ATM 时，默认为 NBMA，以单播发报文，需要 DR，Hello 定时器 10s，邻居失效时间 40s。
3. P2P 点到点：当链路层为 PPP、HDLC 时，默认 P2P，以组播发报文(.5)，不需要 DR，Hello 定时器 30s，邻居失效时间 120s。
4. P2MP 点到多点：需要手动修改，以组播发报文(.5)，不需要 DR，Hello 定时器 30s，邻居失效时间 120s。

## OSPF 报文

OSPF 五种报文：

1. `Hello`报文：发现维护邻居关系，包含定时器、DR、BDR 和已知邻居
2. `DD`报文：数据库描述报文，**描述本地 LSDB 中 LSA 摘要，进行主从关系协商**，用于路由器间 LSDB 同步
3. `LSR(Request)`报文：链路请求报文，向对方请求所需 LSA（通过比对 DD 报文知道自己缺哪些 LSA）
4. `LSU(Update)`报文：链路状态更新报文，向对方发送所要求的 LSA
5. `LSAck`报文：链路状态确认报文，对收到的 LSA 进行确认

## OSPF 邻居建立维护与状态机

邻居建立与维护：

1. 组播发送 Hello 报文（.5），双方协商参数，若验证、区域等都相同，则表示邻居发现
2. 邻居周期交换 Hello 报文，若邻居失效时间超时未收到 Hello 则认为邻居失效，将该邻居从邻居表中删除

DR/BDR 选举：
目的：减少邻接关系的数量，所有路由信息都发给 DR（指定路由器），再由 DR 发 LSA
若不设置 DR/BDR，则邻接关系数量`R=n(n-1)/2`个
若设置 DR/BDR，则邻接关系数量`R=2(n-2)+1`个

BDR 是 DR 的备份。若 DR 失效，BDR 立刻成为 DR。
DR/BDR 选举原则：

1. 首先比较 Hello 报文中的优先级，最高的为 DR，次高的为 BDR，若为 0 不参加选举。
2. 优先级相同则比较 RouterID，大的优
3. 选举完毕后，即使有更优的路由器加入区域，也不会更换 DR/BDR（可以在用户视图重置 ospf 进程，使 ospf 重新选举）
4. 只有广播和 NBMA 网络选举 DR/BDR
5. 剩余路由器成为 DRother，只与 DR、BDR 建立邻接关系

邻接关系建立：

1. 初始状态，A 的邻居为`Down`，由于邻居表为空，所以 DR 字段置为`0.0.0.0`，发送 Hello 报文，B 收到 Hello 报文后，将 A 添加进邻居表中，邻居状态变为`Init`，两个路由器比较 RouterID，大的（假设 A）会在后面的 Hello 报文中将 DR 字段设为自己的 RouterID。
2. B 收到 Hello 报文，发现邻居表中有自己的 RouterID，于是将邻居表中 A 状态变为`2-way`。B 也收到后，同理。若当前两台路由器都是 DRother，则邻接状态就会维持在`2-way`。只有其中一个是 DR 或 BDR，才会继续建立关系
3. 若进一步建立邻接关系，A 会将 B 状态设为`ExStart`，并发送一个不包含 LSA 的 DD 报文，开始主从协商。
   其中 DD 报文包含 MS 位，最开始该 MS 位置 1，表示路由器以自己为 Master。Master 路由器的作用就是在交换 DD 报文时，主动发送 DD 报文，并控制报文的序列号。Slave 路由器仅能接受 Master 指定的序列号并被动发送 DD。
4. B 收到 DD 后，将发送方的状态设为`ExStart`。对比 RouterID，若大（假设 A）就在 DD 报文中将 MS 位也置为 1，表明自己是 Master，并回复。B 收到 DD 报文后，同意 A 为 Master，将 MS 位置 0，表明自身 Slave，采用 A 规定的序列号向 A 发 DD 报文，此时 DD 报文中包含 LSA 摘要，A 收到后将 B 状态改为`Exchange`。B 收到 A 的 DD 报文后也将 A 状态改为`Exchange`。
5. A 与 B 都对 DD 报文的 LSA 与 LSDB 进行比对，若 LSA 信息在 LSDB 中都存在，就直接进入`Full`状态。若一方 LSDB 不完全包含 LSA，则向另一方请求，并将对方状态置为`Loading`，发送 LSR。另一方收到后根据 LSR 返回 LSU。再次比对后相同就进入`Full`。

OSPF 状态机
其中有三个稳定状态：`Down`、`2-way`、`Full`

- `down`：未启动 ospf
- `init`：收到对方 hello 包，但 hello 包中的邻居表没有自己
- `2-way`：收到对方 hello 包，且在 hello 包中看到自己
- `exstart`：互相发送空的 DD 协商主从报文，以决定谁发 DD 报文
- `exchange`：交换真正的 DD 报文
- `loading`：交互路由信息
- `full`：路由学习完毕，邻接关系建立

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120049922.png)

影响 OSPF 建立邻接关系的因素：

1. area 是否一致
2. 接口是否开启 OSPF
3. 接口是否开启验证
4. 是否启用了静默接口，或开启过滤
5. 是否处于特殊区域
6. Hello/Dead 定时器是否一致
7. Router-id 是否不同
8. 链路两端接口掩码是否不同（广播类型链路 hello 会携带掩码信息）
9. 两端 MTU 是否不同（若不同会一直在 Exstart 状态）

### 链路状态广播 LSA

LSA 老化时间 3600s（1 小时），每 1800s（半小时）ospf 就会泛洪一次全部路由信息

报文字段：

1. `LS age`：LSA 产生后经过的时间（单位秒）
2. `LS type`：LSA 类型（1-11）
3. `Link State ID`：LSA 链路 ID，根据 LSA 类型而定
4. `Advertising Router`：始发 LSA 的路由器 ID，也称 LSA 通告路由器
   **`LS type`、`Link State ID`、`Advertising Router`三个参数唯一标识一个 LSA**
5. `LSA sequence number`：LSA 序列号，用于判断是否是最新的 LSA
6. `LS checksum`：LSA 信息的校验和
7. `length`：LSA 总长度

LSDB 更新过程：收到一条 LSA 更新报文，在 LSDB 中查找该 LSA，若未找到就将这条 LSA 加入 LSDB，若找到，就对比 LSA 的序列号，若该条的大，就更新，否则不更新。

LSA 类型：

- 一类：`Router LSA`，描述区域内部与路由器直连的链路信息，所有 OSPF 路由器始发，仅在区域内传播。不携带掩码信息
- 二类：`Network LSA`，记录广播或 NBMA 上所有路由器 RouterID，DR 始发，仅在区域内传播。携带网段掩码信息，和一类 LSA 共同计算网段
  **一类和二类 LSA 解决了区域内部的通信**
- 三类：`Network Summary LSA`，包含区域网段与开销，传播给相邻区域，ABR 始发，区域间传播。实际就是收集一类和二类的 LSA。每个三类 LSA 包含一个网段
  **一、二、三类 LSA 解决了区域内和区域间通信**
- 四类：`ASBR Summary LSA`，描述 ASBR 的 RouterID 和开销，传播给非 ASBR 区域，ABR 始发。辅助五类 LSA，实现到达 ASBR。告诉 OSPF 内部路由器如何到达 ASBR
- 五类：`AS External LSA`，描述到 AS 外部的路由，包含外部网段、开销等，传播给整个 OSPF 系统，ASBR 始发。每个五类 LSA 包含一个网段。
- 七类：`NSSA Exteranl LSA`，只在 NSSA 中传播，描述到 AS 外部的路由，ASBR 始发

路由聚合：ABR 和 ASBR 可将具有相同前缀的路由聚合发布。

安全：

- 协议报文验证：通过验证的 OSPF 报文才能被接收（路由器+接口都要配置验证：Simple 或 MD5）
- 禁止端口发送 OSPF 报文：该端口成为被动端口（静默），不再发送 Hello 报文
- 过滤计算出的路由：通过过滤规则的路由才加入路由表
- 过滤三类 LSA：设置规则过滤外部路由（本地有效）

## OSPF 特殊区域

OSPF 特殊区域：

1. `Stub`：不允许注入四、五类 LSA。不能存在 ASBR。虚连接不可穿过。若有多个 ABR 可能产生次优路由
2. `Totally Stub`：不允许注入三、四、五类 LSA。虚连接不可穿过。ABR 会产生一条 0.0.0.0/0 的三类 LSA
3. `NSSA`：不允许四、五类 LSA，允许七类 LSA。虚连接不可穿过。该区域存在一个 ASBR，该区域不希望接收其他 ASBR 的外部路由。七类默认路由 LSA 由 ASBR 产生，在 NSSA 中传播，当到达 ABR 时，会转换为五类 LSA 传到别的区域。
   **Totally STub 和 NSSA 都是 Stub 的变形或改进**
4. `Totally NSSA`：不允许注入三、四、五类 LSA，而是用七类默认路由取代。虚连接不可穿过。

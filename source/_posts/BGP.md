---
title: BGP
date: 2018-07-31 09:19:44
tags: [BGP, 网络]
categories: [网络]
comments: false
---

**基于华三网络学习笔记（理论）**

本篇包含以下内容

- [BGP 特性与基本术语](#bgp-特性与基本术语)
- [BGP 消息与状态机](#bgp-消息与状态机)
- [BGP 路由属性](#bgp-路由属性)
- [BGP 选路规则](#bgp-选路规则)
  - [控制 BGP 路由](#控制-bgp-路由)
- [BGP 补充知识点](#bgp-补充知识点)

<!-- more -->

## BGP 特性与基本术语

Border Gateway Protocol 边界网关协议。用于自治系统间，进行不同 AS 间路由传递。

- 路径矢量路由协议
- 基于 TCP，端口号 179
- EGP 协议，优先级 255
- 支持路由聚合与 CIDR
- 只发送增量路由
- 路由信息中携带经过的所有 AS 路径表
- 支持 CIDR 和路由聚合
- 丰富的路由属性、强大的路由过滤和路由策略
- 可传输大量路由（基于 TCP 的可靠传输和滑动窗口）
- 只能点对点连接（TCP 的点对点）

**基本术语**

- BGP 发言者：发送 BGP 消息的路由器
- Router ID：32 位，在 AS 中唯一标识一台主机，必须配置
- BGP 对等体 Peer：相互交换消息的 BGP 发言者互为对等体，也可称 BGP 邻居。
  - IBGP 对等体：处于同一 AS 的对等体，不需要直连
    **从 IBGP 获得的路由不会向其他 IBGP 邻居发布（为了防环）
    从 IBGP 获得的路由是否发个 EBGP 邻居与是否同步有关（为了防止路由黑洞）**
    全连接：为解决部分连接导致的无法学习路由，每两个路由器都建立 IBGP 邻居则可以保持 AS 内的所有 BGP 路由器路由信息相同
  - EBGP 对等体：处于不同 AS 的对等体，且通常要求直连
    从 EBGP 获得的路由会发布给所有 IBGP 邻居
    EBGP 的 TTL=1，所以只能是直连对端接口，不可跨设备（可修改 TTL 实现跨设备）
    而 IBGP 的 TTL=255 可与 AS 内任意 BGP 路由器建邻居

BGP 防环：

1. 对于 EBGP：使用 AS-PATH
2. 对于 IBGP：禁止将从 IBGP 邻居学到的路由发布出去。缺点：有路由器学不到路由。解决：全连接

BGP 同步：IBGP 与 IGP 之间同步，避免转发黑洞。收到 IBGP 邻居发布的路由后，会查看该路由是否在 IGP 表中，只有 IGP 表中存在，才会置为有效并发布，否则无效不发布。路由器默认关闭同步。

## BGP 消息与状态机

BGP 所有消息都是消息头+消息体，消息头长度 19 字节，包含以下字段：

- Marker：16 字节，用于 BGP 验证的计算，不使用验证时所有位都置为 1
- Length：2 字节，BGP 消息总长度（包括报文头）
- Type：1 字节，BGP 消息的类型，取值为 1 到 5，分别表示 Open、Update、Notification、Keepalive、Route-Refresh

BGP 消息种类：

1. Open：用于建立 BGP 邻居。TCP 连接后的第一个消息，进行参数协商。包含以下字段：

- BGP 版本
- AS 号
- routerID
- Hold Time：保存时间，若超时仍未收到对端的 Keepalive 或 Update 消息，则认为 BGP 连接中断。建立对等体时要协商该参数并保持一致
- 认证信息或多协议扩展等功能

2. Update：在邻居间交换路由信息（发布或撤销）。可通告一类相同属性的可达路由和不可达路由。包含以下字段：

- 不可达路由字段长度。单位字节，若为 0 表示没有`Withdrawn Routes`
- Withdrawn Routes 不可达路由列表，即存放被撤销的路由
- 路径属性字段长度。单位字节，若为 0 表示没有`Path Attibutes`
- Path Attibutes，存放与 NLRI 相关的所有路径属性列表，每个路径属性由一个 TLV 三元组构成。
- NLRI 可达路由的前缀和前缀长度二元组，存放一类相同属性的可达路由

3. Notification：错误通知（消息错误或断开 BGP 连接）。包含以下字段：

- 差错码，指定错误类型
- 差错字码，提示错误类型的详细信息
- 数据，出错部分的数据。用于辅助发现错误的原因，依赖于差错码和差错子码

4. Keepalive：维护邻居关系或对 Open 消息回应。只有消息头。周期发送，默认周期 30s。
5. Route-refresh：要求对等体重新发送指定地址族的路由

BGP 状态机：

1. Idle：空闲。初始状态，等待 Start 事件。一旦有 Start，就向邻居发起 TCP 建立请求
2. Connect：连接。等待 TCP 建立完成。若 TCP 完成，状态改为 Open-sent。若失败，状态改为 Active。
3. Active：活跃。TCP 未成功建立。若超时，会返回 Connect。若成功，进入 Open-sent 状态。
4. Open-sent：Open 消息已发送。已发出 Open 消息，等待邻居的 Open 消息。若收到邻居的 Open 消息且无错误，进入 OpenConfirm 状态，并发送 Keepalive。否则，进入 Notification。
5. OpenConfirm：Open 消息已确认。Keepalive 已发送，等待邻居的 Keepalive。若收到邻居的 Keepalive，则进入 Established 状态。若收到 Notification，则断开连接
6. Established：BGP 连接建立。可发送 Update 交换路由，发送 Keepalive 维护连接，若收到 Notification 则断开连接

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120053966.png)

## BGP 路由属性

1. 公认必遵属性：BGP 路由器必须识别，必须存在于 Update

- ORIGIN：定义路由信息来源
  类型：IGP--路由产生于 AS 内 EGP--路由通过 EGP 学到 Incomplete--路由来源不确定
  **优先级：IGP>EGP>Incomplete**
- AS_PATH：路由更新经过的 AS 路径列表，保证 AS 间无环。可用于路由选择和过滤
  当 BGP 将一条路由通告到其他 AS 时，会把本地 AS 号添加到 AS-PATH 最前
  优先选择 AS-PATH 最短的路由。
  若向 EBGP 邻居发送路由更新修改，IBGP 间不修改
- NEXT_HOP：路由下一跳
  向邻居发布路由时，会将下一跳设为自己与对端连接的端口
  从 EBGP 邻居得到的路由发给 IBGP 邻居时，不会修改下一跳

2. 公认可选属性：BGP 路由器必须识别，不必须存在于 Update

- LOCAL_PREF：用于 IBGP 选择**离开 AS 时**的路由，表明 BGP 路由器的优先级
  仅在 IBGP 对等体间交换。默认值 100

3. 可选传递属性：在 AS 间可传递，路由器可不支持，仍可接收并通告

- COMMUNITY
- AGGREGATOR

4. 可选非传递属性：若 BGP 路由器不支持，属性会被忽略，且不通告

- MED：度量值。告诉 EBGP 邻居**进入 AS**的路由。
  仅在相邻 AS 间交换，收到 MED 的 AS 不会再通告给其他 AS
  通常只比较来自同一 AS 的 MED

5. 私有 BGP 属性：

- Preferred-value：对从邻居学习到的路由分配优先级
  本地有效，不通告。初始为 0

对于 BGP 路由处理：

1. 接收 BGP 路由
2. 路由过滤、属性设置
3. 路由优选
4. 发布策略
5. 发布路由过滤、属性设置、路由聚合

## BGP 选路规则

路由选路优先级（高到低）：

1. 丢弃下一跳不可达的路由
2. Preferred-value 选大
3. LOCAL_PREF 选大
4. 聚合路由，本地路由
5. AS_PATH 选小
6. ORIGIN 按优先级选
7. MED 选小
8. 依次选从 EBGP、联盟、IBGP 学到的路由
9. 下一跳度量值最低
10. CLUSTER_LIST 选短
11. ORIGINATOR_ID 最小
12. RouterID 最小路由器发布的路由
13. 地址最小的邻居发布的路由

BGP 一定能选出唯一的最优路由，且可以负载分担
路由下一跳不一定是直连邻居，原因：IBGP 发布路由不改变下一跳。路由器会查找直连可达地址，到达要发布路由的下一跳（去往该下一跳的路由为依赖路由，过程为路由迭代）。路由器支持基于迭代的负载分担。

BGP 路由发布策略：

- 只发布最优路由
- 只发布自己使用的路由
- 发布所有从 EBGP 邻居学到的路由给所有 BGP 邻居（IBGP 和 EBGP）
- 不把从 IBGP 邻居学到的路由发布给 IBGP 邻居
- IBGP 路由发到 EBGP：BGP 同步关--直接发布。BGP 同步开--IGP 也发布时才发布
- **BGP 连接建立后，发布所有 BGP 路由**

BGP 下一跳原则：
若从 EBGP 邻居学到的路由传给 IBGP 邻居时下一跳不变，可能会导致 BGP 设备因为下一跳不可达而不加入路由表。解决：应在 EBGP 路由传给 IBGP 邻居时将下一跳改为自身

BGP 路由不优的原因：1.同步打开，但网络不满足同步要求 2.下一跳不可达

BGP 源 IP 地址原则：BGP 设备收到一个 BGP 报文，会检查报文源 IP 地址，若与 peer 所指 IP 地址一致，则设备接收该报文，若不一致，则丢弃报文，在建环回口建立 BGP 关系时，要修改 BGP 报文源

默认情况，BGP 使用到达对等体的最佳路由作为出接口作为与对等体建 TCP 连接的源接口
将建立 TCP 的源接口配置为环回口，在网络中存在冗余链路时不会因为某个接口或链路故障而使 BGP，提高了可靠性和稳定性

### 控制 BGP 路由

常用属性：`preferred-value`、`Local-preference`、`MED`、`next-hop-local`
路由首选值`Preferred-value`：优选大的。默认从对等体学来的路由首选值为 0
本地优先级`Local-preference`：判断离开 AS 的最佳路由
AS 路径过滤表`AS_PATH list`：一个基于 AS 表的 ACL，使用正则表达式对路由携带的 AS 路径属性域进行匹配

正则表达式：

- `^` 匹配字符串的开始
- `$` 匹配字符串的结束
- `*` 匹配`*`前的字符（串）0 或多次
- `+` 匹配+前的字符（串）1 或多次
- `.` 通配符，匹配任何一个字符
- `_` 下划线，匹配一个符号
- `-` 连接符，连接两个字母或数值
- `( )` 字符组，一般与`-`连用
- `[ ]` 匹配`[ ]`中任意一个字符

常用正则组合：

- `^$`只匹配本地路由
- `.*`匹配所有路由
- `^100`匹配 AS100、1001 等邻居的路由
- `^100_`只匹配 AS100 邻居发的路由
- `_100$`匹配 AS100 始发的路由
- `_100_`匹配经过 AS100 的路由

## BGP 补充知识点

BGP 对等体组 peer group：具有某些相同属性的对等体集合，可分为 IBGP 或 EBGP 对等体组

BGP 团体属性：一组具有相同特征目的地址的集合，与所在 AS 无关，一条路由可以有多个团体属性。

公认团体属性
INTERNET：有这一属性的路由可以被通告给所有对等体。路由缺省属于该团体
NO_EXPORT：该团体路由不能被发布到本地 AS 外，若使用联盟，不能发布到联盟外
NO_ADVERTISE：不能被通告任何 BGP 对等体
NO_EXPORT_SUBCONFED：不能被发布到任何其他 AS

BGP 聚合
两种聚合：手动、自动
自动：聚合为自然路由。只能引入 IGP 子网路由聚合，不能对 BGP 邻居学来的或 network 发布的路由进行聚合。
手动：手动配置灵活的聚合，可以对从 BGP 邻居学习的、引入 IGP 的、network 生成的路由聚合

BGP 反射
作用：可代替 IBGP 对等体全连接
原理：允许设备从 IBGP 对等体接收到的路由信息发布给特定 IBGP 对等体，这些网络设备称为路由反射器。

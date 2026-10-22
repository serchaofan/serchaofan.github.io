---
title: Zookeeper
tags: [zookeeper, 分布式, 协调服务]
date: 2020-02-29 18:51:48
categories: [大数据]
comments: false
---

ZooKeeper 是一个高可用、强一致的分布式协调服务，用类似文件系统的 znode 树存储少量协调数据，并提供 Watch、会话、ACL、顺序节点等原语。Hadoop、HBase、Kafka（旧版本）、Dubbo 等系统都用它做选主、配置、注册和分布式锁。

本文基于 Apache ZooKeeper 3.9.6（current，2026-10）官方文档重写，按「数据模型 → 会话/Watch → 一致性 → Zab/选举 → 持久化 → 运维 → 客户端/Recipes → 故障」展开 deep dive。

> ZooKeeper 适合存**控制面元数据**，不适合大 Value、日志、图片或高吞吐业务数据。默认单 znode 数据上限约 1 MiB（`jute.maxbuffer`），生产建议控制在 KiB 级。

<!-- more -->

- [ZooKeeper 是什么](#zookeeper-%E6%98%AF%E4%BB%80%E4%B9%88)
- [数据模型](#%E6%95%B0%E6%8D%AE%E6%A8%A1%E5%9E%8B)
- [节点类型](#%E8%8A%82%E7%82%B9%E7%B1%BB%E5%9E%8B)
- [会话](#%E4%BC%9A%E8%AF%9D)
- [Watch](#watch)
- [一致性与 zxid](#%E4%B8%80%E8%87%B4%E6%80%A7%E4%B8%8E-zxid)
- [架构与请求链路](#%E6%9E%B6%E6%9E%84%E4%B8%8E%E8%AF%B7%E6%B1%82%E9%93%BE%E8%B7%AF)
- [Zab 与 Leader 选举](#zab-%E4%B8%8E-leader-%E9%80%89%E4%B8%BE)
- [Quorum 与 Observer](#quorum-%E4%B8%8E-observer)
- [持久化与恢复](#%E6%8C%81%E4%B9%85%E5%8C%96%E4%B8%8E%E6%81%A2%E5%A4%8D)
- [集群部署](#%E9%9B%86%E7%BE%A4%E9%83%A8%E7%BD%B2)
- [动态重配置](#%E5%8A%A8%E6%80%81%E9%87%8D%E9%85%8D%E7%BD%AE)
- [ACL 与认证](#acl-%E4%B8%8E%E8%AE%A4%E8%AF%81)
- [TLS 与安全](#tls-%E4%B8%8E%E5%AE%89%E5%85%A8)
- [配额 TTL 与 Container](#%E9%85%8D%E9%A2%9D-ttl-%E4%B8%8E-container)
- [zkCli 与运维命令](#zkcli-%E4%B8%8E%E8%BF%90%E7%BB%B4%E5%91%BD%E4%BB%A4)
- [Java 客户端与 Curator](#java-%E5%AE%A2%E6%88%B7%E7%AB%AF%E4%B8%8E-curator)
- [典型 Recipes](#%E5%85%B8%E5%9E%8B-recipes)
- [监控与性能](#%E7%9B%91%E6%8E%A7%E4%B8%8E%E6%80%A7%E8%83%BD)
- [故障案例](#%E6%95%85%E9%9A%9C%E6%A1%88%E4%BE%8B)
- [Kubernetes 部署](#kubernetes-%E9%83%A8%E7%BD%B2)
- [与 etcd 对比](#%E4%B8%8E-etcd-%E5%AF%B9%E6%AF%94)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# ZooKeeper 是什么

## 定位

ZooKeeper 是分布式系统的协调服务，提供：

- **命名与配置**：树形 znode 存储配置、元数据。
- **服务注册与发现**：临时节点 + Watch。
- **分布式锁**：顺序临时节点 + Watch 前驱。
- **Leader 选举**：顺序节点 + 最小 zxid/序号。
- **组成员管理**：临时节点 + 子节点 Watch。
- **屏障、队列**：顺序节点和 Watch 组合。

ZooKeeper 的目标不是通用数据库，而是**协调原语**。它把复杂的一致性、选举、复制、故障恢复封装起来，应用只看到一棵 znode 树。

## 核心特性

| 特性 | 说明 |
| ---- | ---- |
| 顺序一致性 | 客户端更新按发送顺序应用 |
| 原子性 | 更新要么成功，要么失败 |
| 单一系统映像 | 客户端无论连哪台服务器，看到一致的逻辑视图 |
| 可靠性 | 更新一旦成功，在覆盖前持续存在 |
| 及时性 | 客户端视图在一定时间范围内收敛 |
| 读多写快 | 数据在内存，读性能远高于写 |
| 高可用 | 多数派存活即可服务 |

## 与 etcd 的区别

- ZooKeeper：znode 树、临时/顺序节点、Watch、ACL、成熟 Recipes；Java 生态深。
- etcd：扁平 KV、MVCC、Lease、gRPC、Kubernetes 原生；更轻量。
- 新系统如果只需要 KV/Lease/Watch，etcd 更简单；已有 Hadoop/HBase/ZK 生态或需要 znode 语义，ZooKeeper 更合适。

# 数据模型

## znode 树

ZooKeeper 的命名空间是树形结构：

```text
/
├── app
│   ├── config
│   └── services
│       ├── svc-a
│       └── svc-b
├── locks
└── zookeeper
    ├── config
    └── quota
```

- 路径由 `/` 分隔。
- 每个节点是 znode。
- znode 可以同时有数据和子节点，类似“文件也是目录”。
- 数据原子读写：一次读拿到全部数据，一次写替换全部数据。
- 没有 rename、没有递归删除（CLI 有 `deleteall`）、没有部分更新。

## Stat 结构

每个 znode 维护：

| 字段 | 含义 |
| ---- | ---- |
| `czxid` | 创建该 znode 的 zxid |
| `mzxid` | 最后一次修改数据的 zxid |
| `pzxid` | 最后一次修改子节点的 zxid |
| `ctime` | 创建时间（毫秒） |
| `mtime` | 最后修改时间（毫秒） |
| `version` | 数据版本，每次 setData 递增 |
| `cversion` | 子节点版本，子节点变更递增 |
| `aversion` | ACL 版本 |
| `ephemeralOwner` | 临时节点所属 session ID；非临时为 0 |
| `dataLength` | 数据长度 |
| `numChildren` | 子节点数 |

版本用于 CAS：

```java
zk.setData(path, newData, stat.getVersion());
```

版本不匹配会抛 `BadVersionException`。

## 数据大小与性能

- 默认 `jute.maxbuffer` 约 1 MiB（1048575 字节）。
- 生产建议 znode 数据在 KiB 级，不要存大对象。
- 大 znode 会增加网络、内存、快照和日志成本，并放大延迟。
- `jute.maxbuffer` 必须服务端和客户端一致，否则会出现 `Len error` / `Unreasonable length`。

# 节点类型

| 类型 | 创建方式 | 生命周期 |
| ---- | -------- | -------- |
| PERSISTENT | 默认 | 持久，直到显式删除 |
| EPHEMERAL | `create -e` | 会话结束自动删除 |
| PERSISTENT_SEQUENTIAL | `create -s` | 持久，名称追加 10 位序号 |
| EPHEMERAL_SEQUENTIAL | `create -e -s` | 临时 + 顺序 |
| CONTAINER | `create -c` | 最后一个子节点删除后，服务器择机删除 |
| PERSISTENT_WITH_TTL | `create -t <ttl>` | TTL 内无修改且无子节点，服务器择机删除 |
| PERSISTENT_SEQUENTIAL_WITH_TTL | `create -s -t <ttl>` | 顺序 + TTL |

## 临时节点

- 生命周期绑定 session。
- 会话过期或关闭时，服务器删除该 session 的所有临时节点。
- 临时节点**不能有子节点**。
- 适合服务注册、锁、Leader 选举、组成员。
- 客户端断开不一定过期；在 session timeout 内重连成功，临时节点仍存在。
- 会话过期后临时节点删除，并触发 Watch。

## 顺序节点

- 父节点维护一个 signed int 计数器。
- 名称追加 `%010d`，如 `0000000001`。
- 计数器属于父节点，父节点删除/重建会重置。
- 超过 `2147483647` 会溢出为负数。
- 适合队列、锁排队、Leader 选举。

## Container 节点

- 3.5.3 引入。
- 用于 Leader/Lock 等 recipe 的容器。
- 最后一个子节点删除后，容器成为删除候选，服务器异步删除。
- 在 container 下创建子节点可能遇到 `NoNodeException`，需要重试并重建容器。

## TTL 节点

- 3.5.3 引入。
- 创建 PERSISTENT/PERSISTENT_SEQUENTIAL 时可以指定 TTL（毫秒）。
- TTL 内没有修改且没有子节点，服务器会择机删除。
- 默认关闭，需要设置系统属性 `zookeeper.extendedTypesEnabled=true`。
- 未开启时创建 TTL 节点会抛 `KeeperException.UnimplementedException`。

# 会话

## 会话建立

客户端连接串：

```text
host1:2181,host2:2181,host3:2181
```

客户端会随机选择服务器建立 TCP 连接，进入 `CONNECTING`，成功后进入 `CONNECTED`。

会话由 64 位 session ID 标识，服务端还会返回 password。客户端重连时可以携带 session ID/password，尝试恢复会话。

## 会话超时

- 客户端请求一个 timeout。
- 服务端用 `minSessionTimeout` / `maxSessionTimeout` 约束。
- 服务端在 timeout 内没有收到心跳，就判定会话过期。
- 过期后删除临时节点、移除 Watch，并通知相关 watcher。
- 客户端在断连期间可能不知道会话已过期；重连后收到 `Expired` 事件。

```properties
tickTime=2000
minSessionTimeout=4000
maxSessionTimeout=40000
```

## 会话状态

| 状态 | 说明 |
| ---- | ---- |
| CONNECTING | 正在连接 |
| CONNECTED | 已连接 |
| CLOSED | 主动关闭 |
| EXPIRED | 会话过期 |
| AUTH_FAILED | 认证失败 |

客户端 Watcher 会收到 `SyncConnected`、`Disconnected`、`Expired`、`AuthFailed` 等事件。

## Local Session

ZooKeeper 3.7+ 引入 local session 优化：

- local session 只存在于当前连接的服务器，不写入全局 session 跟踪。
- 不能创建临时节点；创建临时节点时会升级为 global session。
- 降低大规模只读客户端对 Leader 的压力。
- 开启后要理解其生命周期与故障语义，不要假设所有 session 都能跨服务器恢复。

常用配置：`localSessionsEnabled`、`localSessionsUpgradingEnabled`，具体默认值以版本配置文档为准。

# Watch

## 一次性 Watch

`getData`、`getChildren`、`exists` 都可以注册 Watch：

```java
zk.getData("/app/config", true, stat);
zk.getChildren("/app/services", true);
zk.exists("/app/config", true);
```

特点：

- **一次性**：触发后移除，需要重新注册。
- **异步发送**：事件在变更返回前可能已发出，但客户端保证先看到 Watch 事件，再看到变更后的数据。
- **有序**：同一客户端看到的 Watch 事件和更新顺序一致。
- **会话绑定**：会话过期后 Watch 丢失。

## Watch 事件类型

| 事件 | 触发 |
| ---- | ---- |
| `NodeCreated` | 节点创建 |
| `NodeDeleted` | 节点删除 |
| `NodeDataChanged` | 节点数据变化 |
| `NodeChildrenChanged` | 子节点列表变化 |
| `None` | 连接状态变化 |

## Persistent / Recursive Watch

3.6.0 引入：

```java
zk.addWatch("/app", watcher, AddWatchMode.PERSISTENT_RECURSIVE);
```

- 不会因触发而移除。
- 触发 `NodeCreated`、`NodeDeleted`、`NodeDataChanged`。
- 递归模式覆盖子树。
- 递归 Watch 不触发 `NodeChildrenChanged`（冗余）。
- 用 `removeWatches` 移除。

## Watch 的坑

- 一次触发后必须重新注册，否则后续变更收不到。
- Watch 只通知“发生了变化”，不包含完整数据；收到后要重新 `getData`/`getChildren`。
- 大量客户端 watch 同一节点会造成 **herd effect**；锁/队列应 watch 前驱节点，而不是 watch 整个列表。
- 会话过期后 Watch 全部丢失，需要重建。
- 网络分区/重连期间可能错过事件，关键状态要支持全量重建。
- `sync` 不能替代 Watch；它只保证后续读看到最新已提交状态。

# 一致性与 zxid

## 保证

ZooKeeper 官方保证：

- **顺序一致性**：同一客户端更新按发送顺序应用。
- **原子性**：更新要么成功，要么失败。
- **单一系统映像**：客户端无论连哪台服务器，看到一致的逻辑视图。
- **可靠性**：更新成功后持续存在，直到被覆盖。
- **及时性**：客户端视图在一定时间范围内收敛。

## 写线性一致，读可能 stale

- **写操作是线性一致的**：所有写可以按实时顺序全序排列。
- **读默认由本地服务器提供**，可能读到落后于最新提交的状态。
- 需要“读到最新写”时，先 `sync`：

```java
zk.sync("/app/config", null, null);
byte[] data = zk.getData("/app/config", false, stat);
```

`sync` 会把当前服务器与 Leader 同步，保证之后的读能看到此前已提交的写。

## zxid

zxid 是 64 位：

```text
高 32 位：epoch（Leader 任期）
低 32 位：counter（事务计数器）
```

- 每个提案有唯一 zxid。
- 新 Leader 使用新 epoch。
- 同一 epoch 内 counter 递增。
- zxid 决定事务全序，也用于恢复、快照和日志定位。

## 请求顺序

- 同一客户端通过 FIFO 连接发送请求，服务端按顺序处理。
- 写请求转发给 Leader，Leader 按接收顺序提案。
- 读请求在本地处理，可能与写并发。
- Watch 事件按 zxid 顺序发送。

# 架构与请求链路

```text
Client
  │ TCP 2181
  ▼
┌─────────────────────────────────────┐
│ Server                              │
│  RequestProcessor pipeline          │
│  SessionTracker / WatchManager      │
│  DataTree / ZKDatabase              │
│  Transaction Log + Snapshot         │
└──────────┬──────────────────────────┘
           │ quorum 2888 / election 3888
           ▼
Leader / Follower / Observer
```

## 角色

| 角色 | 说明 |
| ---- | ---- |
| Leader | 处理写请求、发起提案、协调 quorum |
| Follower | 参与投票、接收提案、服务读请求 |
| Observer | 不参与投票、同步 Leader 状态、服务读请求 |
| Client | 连接任意服务器，提交读写和 Watch |

## 请求处理流程

写请求：

```text
Client -> Follower/Leader
  -> 预处理（权限、会话、版本、路径校验）
  -> 转发给 Leader
  -> Leader 生成 proposal（zxid）
  -> 持久化到事务日志
  -> 发送给 Followers
  -> 多数派 ACK
  -> Leader commit
  -> apply 到 DataTree
  -> 返回客户端
  -> 触发 Watch
```

读请求：

```text
Client -> 本地 Server
  -> 权限校验
  -> 从 DataTree 读取
  -> 返回
```

关键点：

- 写路径经过 Leader + quorum + 磁盘 fsync。
- 读路径本地内存，速度快，但可能 stale。
- Watch 在数据变更 apply 后触发。
- 事务日志先于内存 apply 持久化。

## RequestProcessor

ZooKeeper 用处理器链处理请求，典型阶段：

1. **Prep**：校验、生成事务、处理版本/ACL/会话。
2. **Proposal**：Leader 发起提案，分配 zxid。
3. **Sync**：写事务日志，必要时触发快照。
4. **Commit**：多数派 ACK 后提交。
5. **Final**：应用到 DataTree，返回响应，触发 Watch。

Follower/Observer 的链路会转发写请求给 Leader，读请求本地处理。

# Zab 与 Leader 选举

## Zab 是什么

Zab（ZooKeeper Atomic Broadcast）是 ZooKeeper 的原子广播协议，保证：

- 所有服务器看到相同的事务顺序。
- 已提交事务不会丢失。
- 新 Leader 拥有所有已提交事务。

Zab 分两个阶段：

1. **Leader activation**：选举 Leader，同步状态，恢复正确视图。
2. **Active messaging**：Leader 广播提案，quorum ACK 后提交。

## Leader 激活

Leader 激活要求：

- Leader 见过所有 Follower 中最高的 zxid。
- 多数派同意跟随该 Leader。

流程：

1. Fast Leader Election 选出 Leader。
2. Leader 等待 Follower 连接。
3. Leader 与 Follower 同步：发送缺失提案，落后太多则发送完整快照。
4. Leader 提交上一个 epoch 中已看到但未提交的提案。
5. Leader 激活，开始接收新提案。

## Active Messaging

类似两阶段提交：

1. Leader 给所有 Follower 发送 proposal（按 zxid 顺序）。
2. Follower 持久化后 ACK。
3. Leader 收到多数派 ACK 后发送 COMMIT。
4. Follower 按顺序 apply。
5. Leader 返回客户端。

FIFO 通道保证：

- 提案按顺序到达。
- ACK 按顺序返回。
- COMMIT 按顺序处理。
- 如果消息 m 已落盘，m 之前的消息也都已落盘。

## Fast Leader Election

服务器状态：

| 状态 | 说明 |
| ---- | ---- |
| LOOKING | 正在选举 |
| FOLLOWING | 跟随 Leader |
| LEADING | 当前是 Leader |
| OBSERVING | Observer，不投票 |

选举原则：

- 优先选择 zxid 最大的服务器（数据最新）。
- zxid 相同则选择 server id 最大的。
- 获得多数派投票者成为 Leader。
- 选举期间不处理客户端写请求。

端口：

| 端口 | 用途 |
| ---- | ---- |
| 2181 | 客户端 |
| 2888 | quorum 通信 |
| 3888 | Leader 选举 |
| 8080 | AdminServer（默认） |

## 为什么不会脑裂

- 同一 epoch 只有一个 Leader。
- 新 Leader 必须拥有最高 zxid，并得到多数派支持。
- 旧 Leader 失去 quorum 后无法提交新提案。
- 多数派交集保证新 Leader 能看到所有已提交事务。

# Quorum 与 Observer

## Quorum

- 默认多数派 quorum：`n/2 + 1`。
- 3 节点容忍 1 个故障；5 节点容忍 2 个。
- 4 节点也只能容忍 1 个故障，不推荐偶数。
- 成员越多，写延迟和复制成本越高。
- Observer 不参与投票，不增加写 quorum。

## Observer

配置：

```properties
peerType=observer
server.1=zk1:2888:3888
server.2=zk2:2888:3888
server.3=zk3:2888:3888:observer
```

- 不投票，但同步 Leader 状态。
- 可以服务读请求，扩展读吞吐。
- 适合跨机房、读多写少、隔离不同业务。
- Observer 故障不影响 quorum。
- Observer 可能落后，关键读前用 `sync`。
- `observerMasterPort` 可以让 Observer 从 Observer Master 同步，减少 Leader 负担。

## 分层 Quorum

ZooKeeper 支持 weighted/hierarchical quorum，用于跨地域部署：

- 给不同组/服务器分配权重。
- 需要多数派组 + 组内多数派。
- 降低跨地域写延迟，但配置和故障语义更复杂。
- 大多数场景用标准 majority quorum 即可。

# 持久化与恢复

## 事务日志与快照

ZooKeeper 持久化两部分：

- **事务日志（transaction log）**：每次写事务先落盘，再 apply。
- **快照（snapshot）**：某个 zxid 的 DataTree 状态，fuzzy snapshot。

目录：

```properties
dataDir=/var/lib/zookeeper
dataLogDir=/var/lib/zookeeper/log
```

- `dataDir` 存快照和 `myid`。
- `dataLogDir` 可单独放事务日志，建议独立磁盘。
- 日志文件后缀是第一条事务的 zxid。
- 快照和日志格式在 standalone/ensemble 间通用。

## 恢复流程

启动时：

1. 读取 `myid`。
2. 加载最新完整快照。
3. 重放快照之后的事务日志。
4. 校验并截断不一致的日志尾部。
5. 恢复 DataTree、session、Watch 等状态。

关键点：

- 日志损坏可能导致启动失败或数据回退。
- 备份需要“最新快照 + 后续日志 + 前一个日志”。
- 不要手工编辑日志/快照。
- 版本升级时注意日志格式兼容。

## 快照频率

```properties
snapCount=100000
snapSizeLimitInKb=0
```

- `snapCount`：事务数达到阈值触发快照。
- `snapSizeLimitInKb`：按日志大小触发（新版本支持）。
- 快照太频繁会增加 IO；太少会延长恢复时间。
- 快照是 fuzzy 的，和日志滚动独立，所以需要保留前一个日志。

## 清理

ZooKeeper 默认**不会自动删除**旧快照/日志：

```properties
autopurge.snapRetainCount=3
autopurge.purgeInterval=24
```

- `snapRetainCount`：保留最近 N 个快照及对应日志。
- `purgeInterval`：清理间隔（小时）。
- 也可以使用 `PurgeTxnLog` 工具：

```bash
java -cp zookeeper.jar:lib/* org.apache.zookeeper.server.PurgeTxnLog \
  /var/lib/zookeeper /var/lib/zookeeper/log -n 3
```

- 清理前确认备份策略。
- 不要删除最新快照及其后续日志。

## 备份与恢复

备份：

```bash
# 停止写入或选择低峰
tar czf zk-backup.tar.gz /var/lib/zookeeper /var/lib/zookeeper/log
```

更稳妥：

- 备份最新快照 + 所有后续日志 + 前一个日志。
- 备份 `myid`、`zoo.cfg`、TLS 证书、JAAS 配置。
- 在测试环境验证恢复。

恢复：

1. 停止 ZooKeeper。
2. 清空/替换 `dataDir`、`dataLogDir`。
3. 恢复快照和日志。
4. 确认 `myid`、`zoo.cfg`、权限正确。
5. 启动，检查 `mntr`、`stat`、znode 数据。
6. 集群恢复时，先恢复一个节点，再让其他节点同步/重新加入。

注意：

- 快照和日志必须配套，不能只恢复快照。
- 版本不兼容时，先用对应版本恢复，再升级。
- 恢复后 revision/zxid 可能落后，客户端需要重新同步。

# 集群部署

## 最小配置

```properties
tickTime=2000
initLimit=10
syncLimit=5

dataDir=/var/lib/zookeeper
dataLogDir=/var/lib/zookeeper/log
clientPort=2181

server.1=zk1:2888:3888
server.2=zk2:2888:3888
server.3=zk3:2888:3888
```

每台机器：

```bash
echo 1 > /var/lib/zookeeper/myid  # 对应 server.1
```

启动：

```bash
bin/zkServer.sh start
bin/zkServer.sh status
```

## 参数含义

| 参数 | 说明 |
| ---- | ---- |
| `tickTime` | 基本时间单位（毫秒） |
| `initLimit` | Follower 初始同步 Leader 的超时（tick 数） |
| `syncLimit` | Follower 与 Leader 心跳超时（tick 数） |
| `clientPort` | 客户端端口 |
| `maxClientCnxns` | 单客户端 IP 最大连接数 |
| `minSessionTimeout` | 最小会话超时 |
| `maxSessionTimeout` | 最大会话超时 |
| `autopurge.*` | 自动清理 |
| `4lw.commands.whitelist` | 四字命令白名单 |
| `admin.serverPort` | AdminServer 端口 |

## 部署原则

- 3 或 5 个 voting members，奇数。
- 跨机架/可用区分布，避免同时故障。
- 专用磁盘，低 fsync 延迟。
- 关闭 swap 或限制，避免 GC/换页导致心跳超时。
- 监控磁盘、GC、网络、Leader 切换。
- 不要和重 IO 业务混部。
- 配置 NTP，避免时间漂移影响日志和排障。
- 生产启用 ACL、TLS、防火墙。

# 动态重配置

## 配置

```properties
reconfigEnabled=true
dynamicConfigFile=/var/lib/zookeeper/zoo.cfg.dynamic
```

- `reconfigEnabled` 默认 false（安全考虑）。
- 开启后可以通过 API/CLI 修改 ensemble 成员。
- 需要 ACL 保护 `/zookeeper/config`，防止恶意添加节点。
- 动态配置写入 `dynamicConfigFile`，`zoo.cfg` 只保留静态部分。

## 命令

```bash
# 查看当前配置
zkCli.sh -server zk1:2181
getconfig

# 添加节点
reconfig -add server.4=zk4:2888:3888

# 移除节点
reconfig -remove 4

# 使用文件替换
reconfig -file new-config.txt

# 条件重配置（基于版本）
reconfig -add server.4=zk4:2888:3888 -v 100
```

注意：

- 一次只变一个成员，避免 quorum 丢失。
- 新节点先同步，再参与投票。
- 观察 `mntr` 中 `zk_pending_syncs`、`zk_synced_followers`。
- 出错时检查 `getconfig` 和日志。
- 生产变更前备份配置和快照。

# ACL 与认证

## ACL 模型

ACL 是 `scheme:expression:permissions` 列表：

```text
world:anyone:cdrwa
auth::cdrwa
digest:user:base64sha1:cdrwa
ip:192.168.1.0/24:r
x509:CN=client:cdrwa
```

权限：

| 权限 | 含义 |
| ---- | ---- |
| CREATE | 创建子节点 |
| READ | 读数据、列子节点 |
| WRITE | 写数据 |
| DELETE | 删除子节点 |
| ADMIN | 设置 ACL |

要点：

- ACL **不继承**：父节点 ACL 不影响子节点。
- 没有 owner 概念；ADMIN 类似“所有者”。
- 所有人都有隐式 LOOKUP（可以 stat）。
- 默认 ACL 常见是 `world:anyone:cdrwa`，生产应收紧。
- `auth` scheme 使用当前认证身份。
- `digest` 使用 `username:password`，ACL 中存 SHA1+Base64。
- `ip` 按 CIDR 匹配。
- `x509` 使用客户端证书 X500 Principal。

## 认证

常见方式：

- **digest**：`addauth digest user:pass`。
- **SASL/Kerberos**：强认证，适合企业。
- **x509**：TLS 客户端证书。
- **IP**：弱认证，只适合内网。

```bash
zkCli.sh -server zk1:2181
addauth digest app:secret
create /app data auth::cdrwa
getAcl /app
setAcl /app digest:app:base64hash:cdrwa
```

## Super User

ZooKeeper 支持超级用户绕过 ACL：

```properties
zookeeper.DigestAuthenticationProvider.superDigest=super:base64hash
```

- 仅用于运维救援。
- 必须严格保护凭据。
- 不要在日常应用中使用。

## 安全建议

- 生产不要使用 `world:anyone:cdrwa`。
- `/zookeeper/config`、`/zookeeper/quota` 限制 ADMIN。
- 应用按最小权限授予 READ/WRITE/CREATE/DELETE。
- 使用 TLS + SASL/x509，不要只依赖 IP。
- 审计 ACL 变更。
- 定期轮换凭据和证书。

# TLS 与安全

## TLS 配置

ZooKeeper 支持客户端和 quorum TLS：

```properties
# 客户端 TLS
secureClientPort=2281
serverCnxnFactory=org.apache.zookeeper.server.NettyServerCnxnFactory
ssl.keyStore.location=/etc/zk/server.jks
ssl.keyStore.password=changeit
ssl.trustStore.location=/etc/zk/trust.jks
ssl.trustStore.password=changeit
ssl.clientAuth=need

# Quorum TLS
sslQuorum=true
ssl.quorum.keyStore.location=/etc/zk/quorum.jks
ssl.quorum.keyStore.password=changeit
ssl.quorum.trustStore.location=/etc/zk/quorum-trust.jks
ssl.quorum.trustStore.password=changeit
```

客户端：

```properties
zookeeper.client.secure=true
zookeeper.clientCnxnSocket=org.apache.zookeeper.ClientCnxnSocketNetty
```

JVM：

```bash
-Dzookeeper.client.secure=true
-Dzookeeper.clientCnxnSocket=org.apache.zookeeper.ClientCnxnSocketNetty
-Djavax.net.ssl.trustStore=/etc/zk/client-trust.jks
```

## 平滑启用 TLS

ZooKeeper 支持 `portUnification=true` 做滚动升级：

1. 配置 keystore/truststore。
2. 开启 `portUnification=true`，`sslQuorum=false`。
3. 逐个重启节点，验证 quorum。
4. 开启 `sslQuorum=true`。
5. 验证后关闭 `portUnification`。

## 安全模型

- TLS 保护传输，不加密磁盘。
- 磁盘上的快照/日志不加密；需要磁盘加密（LUKS/dm-crypt）或应用层加密。
- SASL/Kerberos 提供强身份认证。
- ACL 控制 znode 权限，不控制网络。
- AdminServer/4lw 泄露配置和运行时信息，必须限制访问。
- 不要暴露 2181/8080/2888/3888 到公网。
- 证书过期会导致集群失联，监控到期时间。

# 配额 TTL 与 Container

## 配额

ZooKeeper 支持 namespace 和 bytes 配额：

```bash
setquota -n 100000 /apps/app1
setquota -b 1073741824 /apps/app1
listquota /apps/app1
delquota /apps/app1
```

- 配额存储在 `/zookeeper/quota`。
- 作用范围包括路径本身及所有子节点。
- 同一路径层级只能设置一个配额；父子路径不能同时设置。
- 支持 soft/hard：
  - soft：超过阈值记录警告，不阻止写入。
  - hard：超过阈值拒绝写入（具体行为以版本文档为准）。
- 配合 chroot 做多租户隔离。
- 保护 `/zookeeper/quota` 的 ACL。

## Container

```bash
create -c /locks
```

- 最后一个子节点删除后，container 会被服务器择机删除。
- 适合锁、Leader 选举等临时容器。
- 创建子节点时可能遇到 `NoNodeException`，需要重试并重建容器。

## TTL

```bash
# 需要 zookeeper.extendedTypesEnabled=true
create -t 60000 /temp/data value
create -s -t 60000 /temp/data value
```

- TTL 单位毫秒。
- TTL 内无修改且无子节点，服务器择机删除。
- 不是精确定时删除，是“候选删除”。
- TTL 节点默认关闭，开启需要系统属性。
- 适合临时注册、短期元数据。

# zkCli 与运维命令

## 连接

```bash
bin/zkCli.sh -server zk1:2181
bin/zkCli.sh -server zk1:2181,zk2:2181,zk3:2181
```

## 常用命令

```text
ls /app
ls -R /app
stat /app
get /app
get -s /app
get -w /app
ls -w /app
stat -w /app
set /app new-data
set -v 2 /app new-data
create /app/config '{"timeout":10}'
create -e /services/svc-a 10.0.0.1:8080
create -s /queue/item data
create -e -s /locks/lock data
create -c /locks
delete /app/config
deleteall /app
sync /app
getAcl /app
setAcl /app auth::cdrwa
addauth digest app:secret
getconfig
reconfig -add server.4=zk4:2888:3888
setquota -n 100000 /apps/app1
listquota /apps/app1
close
quit
```

## 四字命令

```bash
echo ruok | nc zk1 2181
echo stat | nc zk1 2181
echo srvr | nc zk1 2181
echo mntr | nc zk1 2181
echo cons | nc zk1 2181
echo conf | nc zk1 2181
echo isro | nc zk1 2181
echo wchs | nc zk1 2181
echo dump | nc zk1 2181
```

3.5.3+ 需要白名单：

```properties
4lw.commands.whitelist=ruok,stat,srvr,mntr,cons,conf,isro
```

生产建议使用 AdminServer，逐步替代四字命令。

## AdminServer

默认 `http://host:8080`：

| 路径 | 用途 |
| ---- | ---- |
| `/commands` | 命令列表 |
| `/commands/stat` | 状态 |
| `/commands/mntr` | 指标 |
| `/commands/cons` | 连接 |
| `/commands/conf` | 配置 |
| `/commands/isro` | 是否只读 |
| `/metrics` | Prometheus 指标（配置 provider 后） |
| `/healthcheck` | 健康检查 |
| `/ready` | 就绪检查 |
| `/leader` | Leader 信息 |
| `/servers` | 服务器列表 |
| `/observers` | Observer 列表 |

## 日志与工具

- `zkServer.sh start|stop|status|restart`
- `zkCli.sh`
- `zkTxnLogToolkit`：查看事务日志
- `zkSnapShotToolkit`：查看快照
- `PurgeTxnLog`：清理旧快照/日志
- `zkServer.sh print-cmd`：查看启动命令

# Java 客户端与 Curator

## 原生 ZooKeeper 客户端

```java
import org.apache.zookeeper.*;
import org.apache.zookeeper.data.Stat;

Watcher watcher = event -> {
    if (event.getType() == Watcher.Event.EventType.None) {
        switch (event.getState()) {
            case SyncConnected -> System.out.println("connected");
            case Disconnected -> System.out.println("disconnected");
            case Expired -> System.out.println("session expired");
            case AuthFailed -> System.out.println("auth failed");
            default -> { }
        }
    } else {
        System.out.println("event: " + event.getType() + " " + event.getPath());
    }
};

ZooKeeper zk = new ZooKeeper("zk1:2181,zk2:2181,zk3:2181", 30000, watcher);

zk.create("/app/config", "{\"timeout\":10}".getBytes(),
        ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);

Stat stat = new Stat();
byte[] data = zk.getData("/app/config", true, stat);

zk.setData("/app/config", "{\"timeout\":20}".getBytes(), stat.getVersion());

zk.delete("/app/config", stat.getVersion());

zk.close();
```

## 异步 API

```java
zk.getData("/app/config", true, (rc, path, ctx, data, stat) -> {
    if (KeeperException.Code.OK.intValue() == rc) {
        // 处理
    }
}, null);
```

异步回调要注意：

- 回调线程不要做阻塞操作。
- 检查 `rc`。
- 处理 `NoNode`、`BadVersion`、`ConnectionLoss`。
- 连接丢失不代表请求失败，可能已成功；需要幂等/重试设计。

## Curator

生产推荐 Apache Curator，封装了重连、重试、Watch 恢复和 Recipes：

```java
CuratorFramework client = CuratorFrameworkFactory.newClient(
        "zk1:2181,zk2:2181,zk3:2181",
        new ExponentialBackoffRetry(1000, 3));

client.start();
client.blockUntilConnected();

client.create()
        .creatingParentsIfNeeded()
        .withMode(CreateMode.EPHEMERAL)
        .forPath("/services/svc-a", "10.0.0.1:8080".getBytes());
```

分布式锁：

```java
InterProcessMutex lock = new InterProcessMutex(client, "/locks/order");
if (lock.acquire(10, TimeUnit.SECONDS)) {
    try {
        // 临界区
    } finally {
        lock.release();
    }
}
```

Leader 选举：

```java
LeaderLatch latch = new LeaderLatch(client, "/election");
latch.start();
latch.await();
// 成为 leader
```

缓存：

```java
TreeCache cache = TreeCache.newBuilder(client, "/app").build();
cache.start();
```

Curator 的价值：

- 自动处理 session expired、connection loss。
- 自动恢复 Watch。
- 提供锁、选主、队列、屏障、缓存等 Recipes。
- 重试策略可配置。

## 客户端最佳实践

- 复用客户端，不要每次请求新建。
- 设置合理的 session timeout（如 10-30s）。
- 连接串配置多个服务器。
- 对 `ConnectionLoss` 做幂等重试；不要假设失败。
- Watch 只注册需要的节点；避免 herd effect。
- 会话过期后重建临时节点、Watch、缓存。
- 不要在 Watch 回调里做重操作。
- 大对象不要放 znode。
- 使用 Curator 而不是重复造轮子。

# 典型 Recipes

## Leader 选举

```text
/election
  /n_0000000001  (ephemeral sequential)
  /n_0000000002
  /n_0000000003
```

- 每个候选创建临时顺序节点。
- 序号最小者成为 Leader。
- 其他节点 watch 前一个节点，而不是 watch 整个列表，避免 herd effect。
- 前驱消失后重新判断。

## 分布式锁

- 创建 `/lock/lock-0000000001` 临时顺序节点。
- 如果是最小节点，获得锁。
- 否则 watch 前一个节点。
- 释放锁删除节点。
- 会话崩溃后临时节点自动删除，避免死锁。

## 队列

- 生产者创建顺序持久节点。
- 消费者读取最小节点，处理完删除。
- 用 Watch 监听子节点变化。
- 适合控制面任务，不适合高吞吐消息队列。

## 屏障

- 所有参与者创建节点。
- 等待子节点数量达到阈值。
- 双重屏障：先等待所有人到达，再等待所有人离开。

## 配置管理

- 配置写 `/config/<app>`。
- 客户端 watch 配置节点。
- 更新配置后触发 Watch，客户端重新读取。
- 配置版本用 `version` 做 CAS。

## 服务注册

- 服务启动创建临时节点 `/services/<name>/<instance>`。
- 绑定 session；进程崩溃/会话过期自动删除。
- 客户端 watch `/services/<name>` 子节点。
- 配合健康检查避免“僵尸实例”。

# 监控与性能

## mntr 关键指标

| 指标 | 说明 |
| ---- | ---- |
| `zk_server_state` | leading/following/observing |
| `zk_avg_latency` | 平均延迟 |
| `zk_max_latency` | 最大延迟 |
| `zk_min_latency` | 最小延迟 |
| `zk_packets_received` | 收包数 |
| `zk_packets_sent` | 发包数 |
| `zk_num_alive_connections` | 活跃连接 |
| `zk_outstanding_requests` | 未完成请求 |
| `zk_znode_count` | znode 数 |
| `zk_watch_count` | Watch 数 |
| `zk_ephemerals_count` | 临时节点数 |
| `zk_approximate_data_size` | 数据大小 |
| `zk_open_file_descriptor_count` | 打开 fd |
| `zk_max_file_descriptor_count` | fd 上限 |
| `zk_followers` | Follower 数 |
| `zk_synced_followers` | 已同步 Follower |
| `zk_pending_syncs` | 待同步 |
| `zk_last_proposal_size` | 提案大小 |
| `zk_proposal_count` | 提案数 |
| `zk_commit_count` | 提交数 |
| `zk_snap_count` | 快照数 |

## Prometheus

```properties
metricsProvider.className=org.apache.zookeeper.metrics.prometheus.PrometheusMetricsProvider
metricsProvider.httpPort=7000
metricsProvider.exportJvmInfo=true
```

访问：

```bash
curl http://zk1:7000/metrics | grep zk_
```

## JMX

- `-Dcom.sun.management.jmxremote`
- `-Dcom.sun.management.jmxremote.port=9999`
- 用 JConsole/VisualVM 查看 `ZooKeeperServer`、`DataTree`、`Connection` 等 MBean。

## 告警建议

- 无 Leader 持续 > 1 分钟。
- Leader 切换频繁。
- `zk_outstanding_requests` 持续增长。
- 平均/最大延迟持续升高。
- `zk_pending_syncs` 长期 > 0。
- `zk_open_file_descriptor_count` 接近上限。
- 磁盘使用率/IO 延迟。
- 快照/日志目录增长异常。
- JVM Full GC 频繁。
- 连接数突增、连接被拒。

## 性能瓶颈

| 资源 | 影响 |
| ---- | ---- |
| 磁盘 fsync | 写延迟和吞吐 |
| 快照 | 内存/磁盘/恢复时间 |
| 大 znode | 网络、序列化、内存 |
| Watch 数量 | 内存、事件分发 |
| 连接数 | 文件描述符、线程 |
| GC | 延迟抖动、会话超时 |
| 网络 RTT | quorum 复制、选举 |

优化：

- 读多写少是 ZooKeeper 强项；写吞吐受 Leader/磁盘限制。
- 用 Observer 扩展读。
- 避免大 znode、大 Watch 数量。
- 独立磁盘、低延迟 SSD。
- 合理 `snapCount`，避免频繁快照。
- 开启 `autopurge`，防止磁盘打满。
- 控制连接数，使用连接池/复用。
- 不要让业务数据走 ZooKeeper。

# 故障案例

## Leader 频繁切换

现象：

- `zk_server_state` 变化。
- 客户端 `Disconnected`/`ConnectionLoss`。
- 写超时。

排查：

- 磁盘 fsync 延迟、IO 饱和。
- GC 停顿。
- 网络丢包/RTT。
- 节点 CPU/内存不足。
- 会话/连接数过多。

处理：

- 独立 SSD。
- 调整 JVM 堆和 GC。
- 修复网络。
- 降低负载/拆分集群。

## Quorum 丢失

现象：

- 无 Leader，写请求失败。
- 少数派节点无法形成多数派。

处理：

- 恢复多数派节点。
- 检查网络/磁盘/进程。
- 无法恢复时从备份恢复（快照 + 日志）。
- 不要强行让少数派继续写入。

## 磁盘满

现象：

- 写失败，日志报 `No space left on device`。
- 快照/日志无法写入。

处理：

- 清理旧快照/日志（保留最新快照和后续日志）。
- 扩容磁盘。
- 配置 `autopurge`。
- 检查是否有大 znode/大量临时节点。

## 会话过期风暴

现象：

- 大量 `Expired`。
- 临时节点消失，服务注册抖动。
- 客户端重连。

排查：

- GC 停顿超过 session timeout。
- 网络分区。
- 服务端过载。
- 客户端心跳线程被阻塞。

处理：

- 增大 session timeout。
- 优化 GC/堆。
- 修复网络。
- 客户端 Watch/重连逻辑要能重建状态。

## Watch 丢失/herd effect

现象：

- 客户端收不到变更。
- 大量客户端同时 watch 同一节点，触发时服务端压力暴涨。

处理：

- 一次触发后重新注册。
- 锁/队列 watch 前驱节点，不要 watch 整个列表。
- 用 Curator 的缓存/recipe。
- 监控 `zk_watch_count`。

## 日志/快照损坏

现象：

- 启动失败，日志校验错误。
- 数据不一致。

处理：

- 不要手工修改文件。
- 用备份恢复。
- 用 `zkTxnLogToolkit`/`zkSnapShotToolkit` 检查。
- 确认版本兼容。
- 从健康节点重新同步。

# Kubernetes 部署

ZooKeeper 在 Kubernetes 中通常用 StatefulSet：

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: zookeeper
spec:
  serviceName: zookeeper-headless
  replicas: 3
  selector:
    matchLabels:
      app: zookeeper
  template:
    metadata:
      labels:
        app: zookeeper
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchLabels:
                  app: zookeeper
              topologyKey: kubernetes.io/hostname
      containers:
        - name: zookeeper
          image: zookeeper:3.9.6
          ports:
            - containerPort: 2181
            - containerPort: 2888
            - containerPort: 3888
          env:
            # 示例值；实际部署时每个副本必须使用不同的 1..N，通常从 StatefulSet ordinal 注入
            - name: ZOO_MY_ID
              value: "1"
            - name: ZOO_SERVERS
              value: "server.1=zookeeper-0.zookeeper-headless:2888:3888;2181 server.2=zookeeper-1.zookeeper-headless:2888:3888;2181 server.3=zookeeper-2.zookeeper-headless:2888:3888;2181"
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 20Gi
```

要点：

- `ZOO_MY_ID` 必须是 1..N 的数字，不能直接用 Pod 名；可用 initContainer 从 hostname 截取 ordinal 写入 `myid`，或为每个副本分别配置。
- 使用 headless Service 提供稳定 DNS。
- 每个 Pod 用稳定 `myid`。
- PVC 持久化 `dataDir`/`dataLogDir`。
- 反亲和分散到不同节点。
- 配置 readiness/liveness（`ruok`/`srvr`/AdminServer `/ready`）。
- 用 PodDisruptionBudget 防止同时驱逐过多节点。
- 不要在 Kubernetes 中用 ephemeral storage 存 ZooKeeper 数据。
- TLS 证书通过 Secret 挂载。
- 生产可考虑 ZooKeeper Operator，但理解底层 StatefulSet 仍然重要。

# 与 etcd 对比

| 维度 | ZooKeeper | etcd |
| ---- | --------- | ---- |
| 一致性协议 | Zab | Raft |
| 数据模型 | znode 树 | 扁平 KV + MVCC |
| 临时节点 | 原生 ephemeral | Lease |
| 顺序节点 | 原生 sequential | 自行实现 |
| Watch | 一次性 + persistent | 原生 watch |
| API | Java/C 客户端 | gRPC/HTTP |
| 典型场景 | Hadoop/HBase/Kafka/Dubbo | Kubernetes/云原生 |
| 运维 | JVM/磁盘/会话 | 单二进制/磁盘 |
| 读扩展 | Observer | 副本/序列化读 |
| 生态 | Java 大数据 | 云原生 |

选型：

- 已有 Hadoop/HBase/ZK 生态、需要 znode/顺序节点：ZooKeeper。
- Kubernetes、Go 技术栈、轻量 KV/Lease/Watch：etcd。
- 不要把 ZooKeeper 当高吞吐数据库；也不要把 etcd 当 znode 树。

# 参考资料

- [ZooKeeper 官方文档](https://zookeeper.apache.org/doc/current/)
- [ZooKeeper Overview](https://zookeeper.apache.org/doc/current/zookeeperOver.html)
- [Programmer's Guide](https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html)
- [Administrator's Guide](https://zookeeper.apache.org/doc/current/zookeeperAdmin.html)
- [Internals](https://zookeeper.apache.org/doc/current/zookeeperInternals.html)
- [Dynamic Reconfiguration](https://zookeeper.apache.org/doc/current/zookeeperReconfig.html)
- [Observers](https://zookeeper.apache.org/doc/current/zookeeperObservers.html)
- [Quotas](https://zookeeper.apache.org/doc/current/zookeeperQuotas.html)
- [Snapshots and Restore](https://zookeeper.apache.org/doc/current/zookeeperSnapshotAndRestore.html)
- [Monitoring](https://zookeeper.apache.org/doc/current/zookeeperMonitor.html)
- [JMX](https://zookeeper.apache.org/doc/current/zookeeperJMX.html)
- [Recipes](https://zookeeper.apache.org/doc/current/recipes.html)
- [Java Example](https://zookeeper.apache.org/doc/current/javaExample.html)
- [Releases](https://zookeeper.apache.org/releases.html)

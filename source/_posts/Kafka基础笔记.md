---
title: Kafka基础笔记
tags: [Kafka, 消息队列, KRaft, 运维]
categories: [消息中间件]
date: 2020-01-07 22:45:38
comments: false
---

本文按 Apache Kafka 4.3.1 官方文档重写，面向生产运维，讲清 KRaft、分区副本、ISR、生产消费、分层存储、监控、容量、升级和故障排查。Kafka 4.x 已移除 ZooKeeper，旧笔记里的 ZK 搭建方式不再适用。

最后更新：2026-10-22

<!--more-->

- [版本与定位](#版本与定位)
- [架构与 KRaft](#架构与-kraft)
- [日志存储](#日志存储)
- [复制与一致性](#复制与一致性)
- [生产者](#生产者)
- [消费者与消费者组](#消费者与消费者组)
- [分区与负载均衡](#分区与负载均衡)
- [分层存储](#分层存储)
- [安全](#安全)
- [运维操作](#运维操作)
- [监控](#监控)
- [性能与容量](#性能与容量)
- [故障排查](#故障排查)
- [企业实践](#企业实践)
- [附录](#附录)

# 版本与定位

## 版本

- 当前版本：**Kafka 4.3.1**（2026-06）
- 4.x 只支持 **KRaft**，ZooKeeper 已移除
- Broker 需要 Java 17+
- 4.x 继续演进分层存储、新消费者协议、Share Groups 等能力

## 定位

Kafka 是分布式事件流平台：

- **消息系统**：解耦、削峰、异步、重放
- **存储系统**：持久化日志、多副本、保留策略
- **流处理平台**：Kafka Streams、Connect、生态集成

核心保证：

- 分区内有序
- 副本冗余
- 可水平扩展
- 可重放
- 可配置持久性（acks/ISR）

Kafka 不保证：

- 全局有序（除非单分区）
- 跨分区事务的读隔离对普通消费者透明
- 低延迟一定优于其他 MQ（取决于配置）

# 架构与 KRaft

## 角色

- **Broker**：存储和读写消息
- **Controller**：管理集群元数据、Leader 选举、Topic/Partition 变更
- **KRaft Quorum**：控制器组成元数据共识组
- **Producer/Consumer**：客户端

KRaft 架构：

```
+-------------------+       +-------------------+
| Controller 1      |<----->| Controller 2      |
| metadata log      |       | metadata log      |
+---------+---------+       +---------+---------+
          ^                           ^
          |     metadata quorum       |
          +-------------+-------------+
                        |
          +-------------+-------------+
          |                           |
   +------+------+             +------+------+
   | Broker 1    |             | Broker 2    |
   | partitions  |             | partitions  |
   +-------------+             +-------------+
```

## KRaft 配置

控制器：

```properties
process.roles=controller
node.id=1
listeners=CONTROLLER://controller1:9093
controller.listener.names=CONTROLLER
controller.quorum.bootstrap.servers=controller1:9093,controller2:9093,controller3:9093
```

Broker：

```properties
process.roles=broker
node.id=101
listeners=PLAINTEXT://broker1:9092
advertised.listeners=PLAINTEXT://broker1:9092
controller.listener.names=CONTROLLER
controller.quorum.bootstrap.servers=controller1:9093,controller2:9093,controller3:9093
```

说明：

- `controller.quorum.bootstrap.servers` 是 4.x 动态 quorum 的推荐写法
- `controller.quorum.voters` 是旧静态 quorum 写法，KRaft version 1 起已废弃
- 所有 broker/controller 都要能解析控制器地址
- `controller.listener.names` 要和 `listeners` 中的 listener 名称一致

## 控制器数量

- 生产用 3 或 5 个控制器
- 3 个容忍 1 个故障；5 个容忍 2 个
- 要容忍 N 个故障，需要 `2N+1` 个控制器
- 控制器保存元数据在内存和磁盘，典型 5GB 内存/磁盘足够，按集群规模评估
- 不要把 controller 和 broker 混部在关键生产环境（combined mode 仅适合开发/小规模）

## 格式化与启动

```bash
CLUSTER_ID=$(bin/kafka-storage.sh random-uuid)
bin/kafka-storage.sh format --cluster-id "$CLUSTER_ID" --config config/controller.properties
bin/kafka-storage.sh format --cluster-id "$CLUSTER_ID" --config config/server.properties

bin/kafka-server-start.sh -daemon config/controller.properties
bin/kafka-server-start.sh -daemon config/server.properties
```

多控制器 bootstrap 可用 `--initial-controllers`，保证所有控制器使用同一集群 ID 和初始 voters。

## 元数据

- KRaft 用 `__cluster_metadata` 日志保存元数据
- 控制器定期生成 snapshot
- 查看 quorum：

```bash
bin/kafka-metadata-quorum.sh --bootstrap-controller controller1:9093 describe --status
bin/kafka-metadata-quorum.sh --bootstrap-controller controller1:9093 describe --replication
```

- 查看 metadata shell：

```bash
bin/kafka-metadata-shell.sh --snapshot metadata_dir/__cluster_metadata-0/00000000000000000000-0000000000.checkpoint
```

- 解码 metadata 日志：

```bash
bin/kafka-dump-log.sh --cluster-metadata-decoder --files metadata_dir/__cluster_metadata-0/00000000000000000000.log
```

## 从 ZooKeeper 迁移

- 3.x ZooKeeper 集群需要先迁移到 KRaft
- 4.x 不再支持 ZooKeeper 模式
- 迁移前备份、演练、确认客户端兼容
- 迁移后 `controller.quorum.voters`/ZK 配置全部移除

# 日志存储

## 分区日志

每个 Partition 是一个追加日志：

```
segment-0.log
segment-0.index
segment-0.timeindex
segment-1.log
segment-1.index
...
```

- `.log`：消息数据
- `.index`：offset 索引
- `.timeindex`：时间索引
- `.txnindex`：事务索引
- `.snapshot`：幂等/事务 producer 快照

## Segment

- `segment.bytes`：单 segment 大小，默认 1GB
- `segment.ms`：滚动时间
- `log.roll.hours` 等
- 小 segment 增加文件数和索引开销
- 大 segment 增加删除/压缩粒度

## 保留

- `retention.ms` / `retention.bytes`：按时间/大小删除
- `cleanup.policy=delete|compact|compact,delete`
- `delete.retention.ms`：tombstone 保留时间
- `min.cleanable.dirty.ratio`：compaction 触发比例
- `max.compaction.lag.ms`：最大延迟
- compaction 适合 changelog/状态类 topic，不适合普通事件流

## Page Cache

Kafka 依赖 OS page cache：

- 写入先到 page cache，再刷盘
- 读取命中 page cache 时非常快
- 不要用 `O_DIRECT`（Kafka 不使用）
- 预留足够内存给 page cache
- 监控 `dirty`、`writeback`、磁盘 await

## 磁盘

- JBOD：多个 `log.dirs`，Kafka 自己管理
- RAID：硬件 RAID 也可，但 JBOD + 副本更常见
- SSD 提升随机 IO 和恢复速度
- 磁盘满会导致 broker 不可写，必须提前告警
- 单盘故障时 JBOD 只影响该盘上的分区

# 复制与一致性

## Leader / Follower

- 每个分区一个 leader，多个 follower
- 生产和消费默认走 leader
- follower 从 leader fetch
- ISR：与 leader 保持同步的副本集合

## LEO / HW

- **LEO**（Log End Offset）：日志末尾 offset
- **HW**（High Watermark）：已提交、对消费者可见的 offset
- 消费者只能读到 HW 之前的消息
- follower 追平后 leader 推进 HW

## ISR 与 min.insync.replicas

```properties
default.replication.factor=3
min.insync.replicas=2
```

- `acks=all` + `min.insync.replicas=2` + RF=3：允许 1 个副本故障仍可写
- ISR 小于 min.insync 时，`acks=all` 写入会失败（`NotEnoughReplicas`）
- 这是“宁可不可写，也不丢数据”的取舍
- 可用性优先的场景可降低 min.insync，但要接受数据风险

## acks

| acks | 行为 | 风险 |
| --- | --- | --- |
| 0 | 不等确认 | 可能丢 |
| 1 | leader 写入即确认 | leader 故障可能丢 |
| all | ISR 满足 min.insync 才确认 | 最安全，延迟更高 |

Kafka 3.0+ 默认 `acks=all`、`enable.idempotence=true`。

##  unclean 选举

```properties
unclean.leader.election.enable=false
```

- `false`：只在 ISR 中选 leader，优先一致性
- `true`：允许非 ISR 副本当 leader，优先可用性，可能丢数据
- 生产默认关闭

## Leader 选举

- broker 停止/故障，controller 选新 leader
- preferred leader：副本列表第一个
- `auto.leader.rebalance.enable=true` 会逐步恢复 preferred leader
- 手动：

```bash
bin/kafka-leader-election.sh --bootstrap-server broker:9092 \
  --election-type preferred --all-topic-partitions
```

## 副本同步

- follower 定期 fetch
- `replica.fetch.max.bytes`、`replica.fetch.wait.max.ms`
- `num.replica.fetchers` 提升并行
- 网络/磁盘慢会导致 ISR 收缩
- 监控 `UnderReplicatedPartitions`、`IsrShrinksPerSec`、`MaxLag`

# 生产者

## 核心配置

```properties
acks=all
enable.idempotence=true
compression.type=zstd
linger.ms=5
batch.size=32768
max.in.flight.requests.per.connection=5
delivery.timeout.ms=120000
```

- `batch.size` 和 `linger.ms` 提升吞吐，但增加延迟
- `compression.type` 降低网络和磁盘，增加 CPU
- `max.in.flight` 与幂等/顺序有关
- `delivery.timeout.ms` 包含重试和等待
- `retries` 默认很大，靠 timeout 控制

## 幂等与事务

幂等：

- `enable.idempotence=true`（默认）
- 避免重试导致重复
- 需要 `acks=all`、`max.in.flight<=5` 等约束

事务：

```java
producer.initTransactions();
producer.beginTransaction();
producer.send(...);
producer.sendOffsetsToTransaction(...);
producer.commitTransaction();
```

- `transactional.id` 唯一
- 用于 consume-transform-produce 的 exactly-once
- 事务超时、`transaction.timeout.ms`、`transaction.state.log.*` 要规划
- 事务 topic 的 RF/minISR 不能太低

## 分区器

- 有 key：按 key hash 到分区，保证同 key 有序
- 无 key：sticky partitioner 批量写一个分区，提升吞吐
- 自定义 partitioner 要避免热点
- key 设计决定分区分布

## 顺序

- 分区内有序
- 需要全局有序：单分区或应用层排序
- 重试 + `max.in.flight>1` 可能乱序，幂等会处理
- 事务可保证跨分区原子写，但不保证读顺序

# 消费者与消费者组

## 拉模型

- consumer 主动 fetch
- `fetch.min.bytes`、`fetch.max.wait.ms`、`max.partition.fetch.bytes`
- `max.poll.records` 控制单次处理量
- `max.poll.interval.ms` 控制处理超时

## 消费者组

- 同一 group 内一个分区只分配给一个 consumer
- 分区数决定最大并行度
- offset 存在 `__consumer_offsets`
- `group.id` 相同即同一组

## Rebalance

触发：

- consumer 加入/离开
- 订阅变化
- 分区数变化
- coordinator 变化
- 心跳超时

关键配置：

```properties
session.timeout.ms=45000
heartbeat.interval.ms=3000
max.poll.interval.ms=300000
group.instance.id=consumer-1
partition.assignment.strategy=org.apache.kafka.clients.consumer.CooperativeStickyAssignor
```

- 静态成员 `group.instance.id` 减少滚动重启 rebalance
- cooperative sticky 减少全量 rebalance
- `max.poll.interval.ms` 太小会导致频繁 rebalance
- rebalance storm 会导致消费暂停和 lag 飙升

## 新消费者协议

Kafka 4.x 提供新一代消费者 rebalance 协议（KIP-848），减少 rebalance 停顿。使用前确认 broker、客户端和框架支持，生产先灰度。

## Offset 提交

- 自动提交：简单，可能重复/丢
- 手动提交：至少一次，处理成功后提交
- 幂等消费：业务去重
- exactly-once：事务 + 幂等 + 下游支持

## Lag

```bash
bin/kafka-consumer-groups.sh --bootstrap-server broker:9092 \
  --describe --group my-group
```

关注：

- `CURRENT-OFFSET`
- `LOG-END-OFFSET`
- `LAG`
- consumer 成员和分配

Lag 持续增长说明消费能力不足、下游慢、分区倾斜或 rebalance。

# 分区与负载均衡

## 分区数

- 分区是并行度上限
- 分区过多增加 controller/metadata/文件句柄/选举开销
- 分区过少限制吞吐
- 按峰值吞吐、单分区能力、消费者并行度规划
- 避免频繁改分区数（key 分布会变）

## Key 设计

- key 决定分区
- 热点 key 会导致单分区打满
- 需要均匀分布时加盐/复合 key
- 业务顺序要求和并行度要平衡

## 副本分布

```properties
broker.rack=rack-a
```

- 机架感知，副本跨机架
- `replica.selector.class` 可自定义
- 避免所有副本在同一机架/可用区

## 重分配

```bash
# 生成
bin/kafka-reassign-partitions.sh --bootstrap-server broker:9092 \
  --topics-to-move-json-file topics.json --broker-list "1,2,3" --generate

# 执行（限速）
bin/kafka-reassign-partitions.sh --bootstrap-server broker:9092 \
  --reassignment-json-file plan.json --execute \
  --throttle 50000000 --replica-alter-log-dirs-throttle 100000000

# 验证
bin/kafka-reassign-partitions.sh --bootstrap-server broker:9092 \
  --reassignment-json-file plan.json --verify
```

- 限速避免打满网络/磁盘
- 重分配期间注意 ISR 和延迟
- 完成后清理 throttle
- 大量分区用 Cruise Control 做均衡

## Broker 退役

1. `cordon` broker：

```bash
bin/kafka-configs.sh --bootstrap-server broker:9092 \
  --alter --add-config cordoned.log.dirs="*" \
  --entity-type brokers --entity-name 1
```

2. 生成并执行重分配
3. 确认无分区
4. 停止 broker
5. 注销：

```bash
bin/kafka-cluster.sh unregister --bootstrap-server broker:9092 --id 1
```

# 分层存储

Kafka 4.x 支持 Tiered Storage，把旧 segment 放到远程存储，降低本地磁盘。

Broker 配置：

```properties
remote.log.storage.system.enable=true
remote.log.storage.manager.class.name=com.example.RemoteStorageManager
remote.log.storage.manager.class.path=/opt/kafka/plugins/*
remote.log.metadata.manager.listener.name=INTERNAL
```

Topic 配置：

```bash
bin/kafka-configs.sh --bootstrap-server broker:9092 \
  --alter --entity-type topics --entity-name tieredTopic \
  --add-config 'remote.storage.enable=true,local.retention.ms=3600000,local.retention.bytes=1073741824'
```

注意：

- Kafka 不提供开箱的 `RemoteStorageManager`，需要自行实现或使用厂商插件
- 默认 `RemoteLogMetadataManager` 使用内部 topic，`remote.log.metadata.manager.listener.name` 必填
- 不支持 compacted topic
- broker 级关闭前要先在所有 topic 上关闭
- 客户端管理操作需要 3.0+
- 旧 topic 缺少 producer snapshot 可能不兼容
- 分层存储降低本地磁盘，但不降低跨区域网络和远程存储成本

# 安全

## Listener

```properties
listeners=INTERNAL://0.0.0.0:9092,EXTERNAL://0.0.0.0:9094,CONTROLLER://0.0.0.0:9093
advertised.listeners=INTERNAL://broker1:9092,EXTERNAL://kafka.example.com:9094
listener.security.protocol.map=INTERNAL:PLAINTEXT,EXTERNAL:SASL_SSL,CONTROLLER:PLAINTEXT
inter.broker.listener.name=INTERNAL
```

- `advertised.listeners` 必须客户端可达
- controller listener 不要暴露公网
- 内外网 listener 分离

## TLS / SASL

- TLS：`ssl.keystore.location`、`ssl.truststore.location`
- SASL/SCRAM：`SASL_SSL` + SCRAM-SHA-256/512
- SASL/GSSAPI（Kerberos）
- 复制、controller 通信也要安全配置

## ACL

```bash
bin/kafka-acls.sh --bootstrap-server broker:9092 \
  --add --allow-principal User:alice \
  --operation Read --topic orders
```

- KRaft 使用 `StandardAuthorizer`
- `super.users` 只放管理员
- 按 topic/group/cluster 授权
- 最小权限，定期审计
- 生产禁用匿名访问

## Quotas

```bash
bin/kafka-configs.sh --bootstrap-server broker:9092 \
  --alter --add-config 'producer_byte_rate=10485760,consumer_byte_rate=20971520' \
  --entity-type clients --entity-name alice
```

- 防止单客户端打满
- 限流会导致客户端 throttle
- 监控 throttle 时间和请求延迟

## 静态加密

Kafka 本身不加密磁盘数据，依赖：

- 云盘加密
- LUKS/dm-crypt
- 存储阵列加密
- 应用层加密

# 运维操作

## Topic

```bash
bin/kafka-topics.sh --bootstrap-server broker:9092 --list
bin/kafka-topics.sh --bootstrap-server broker:9092 --describe --topic orders
bin/kafka-topics.sh --bootstrap-server broker:9092 --create \
  --topic orders --partitions 12 --replication-factor 3 \
  --config min.insync.replicas=2
bin/kafka-topics.sh --bootstrap-server broker:9092 --alter --topic orders --partitions 24
bin/kafka-topics.sh --bootstrap-server broker:9092 --delete --topic orders
```

## 配置

```bash
bin/kafka-configs.sh --bootstrap-server broker:9092 \
  --describe --entity-type topics --entity-name orders
bin/kafka-configs.sh --bootstrap-server broker:9092 \
  --alter --entity-type topics --entity-name orders \
  --add-config retention.ms=604800000
```

## 滚动重启

1. 确认 RF/minISR 健康
2. 一次重启一个 broker
3. 等待 ISR 恢复
4. 观察 under-replicated、延迟、controller
5. 使用 controlled shutdown
6. 避免同时重启多个副本所在 broker

## 升级

- 4.x 只支持 KRaft，先完成 ZK→KRaft 迁移
- 升级前确认 `inter.broker.protocol.version`/`log.message.format.version`（如适用）
- 先升级 broker，再升级客户端
- 用 `kafka-features.sh upgrade` 管理 metadata version
- 升级 controller quorum 要谨慎，保持多数派
- 备份元数据、配置、ACL、topic 配置
- 保留回滚方案

## 备份与容灾

- Kafka 数据靠副本，不是备份
- 跨集群复制用 MirrorMaker 2
- 关键 topic 做异地复制
- 元数据/ACL/topic 配置纳入配置管理
- 定期演练切换和恢复

# 监控

## 关键指标

| 指标 | MBean/含义 | 告警 |
| --- | --- | --- |
| UnderReplicatedPartitions | `kafka.server:type=ReplicaManager,name=UnderReplicatedPartitions` | >0 持续 |
| UnderMinIsrPartitionCount | 同上 | >0 |
| OfflinePartitionsCount | `kafka.controller:type=KafkaController,name=OfflinePartitionsCount` | >0 |
| ActiveControllerCount | 每集群应为 1 | 0 或 >1 |
| IsrShrinksPerSec | ISR 收缩 | 异常升高 |
| IsrExpandsPerSec | ISR 恢复 | 异常 |
| MaxLag | follower 落后 | 持续增长 |
| RequestQueueSize | 请求队列 | 持续高 |
| RequestLatency | 请求延迟 | P99 超阈值 |
| DiskUsage | 磁盘使用率 | >75% |
| LogDirOffline | 日志目录离线 | >0 |
| ControllerEventQueueTime | controller 队列 | 高 |

## 工具

- JMX + Prometheus JMX Exporter
- Kafka Exporter（consumer lag）
- Cruise Control（均衡/容量）
- Grafana Dashboard
- Kafka Manager/CMAK（社区）
- `kafka-log-dirs.sh` 看磁盘
- `kafka-consumer-groups.sh` 看 lag

## 告警

- UnderReplicated/Offline 持续
- ISR 频繁收缩
- Controller 选举频繁
- 磁盘 >75%/80%
- 请求延迟 P99
- 消费者 lag 持续增长
- 网络/磁盘错误
- 证书/ACL 异常

# 性能与容量

## 硬件

- 网络优先：万兆起步
- 磁盘：JBOD + SSD/NVMe，或 RAID10
- 内存：page cache 越大越好
- CPU：压缩/加密/TLS 需要余量
- 独立磁盘给 Kafka，避免和日志/其他服务抢 IO

## Broker 配置

```properties
num.network.threads=8
num.io.threads=16
num.replica.fetchers=4
socket.send.buffer.bytes=1048576
socket.receive.buffer.bytes=1048576
replica.fetch.max.bytes=1048576
message.max.bytes=1048576
```

按硬件和压测调整，不要盲目复制。

## OS

- `vm.swappiness` 低（避免换出 page cache）
- `vm.dirty_background_ratio`/`vm.dirty_ratio` 调整
- `vm.max_map_count` 足够（索引 mmap）
- 文件句柄 `ulimit -n` 足够
- 关闭 THP 或评估（延迟敏感场景）
- 时间同步
- XFS/ext4，mount `noatime`

## 容量

- 磁盘 = 吞吐 × 保留时间 × 副本因子 / 压缩比
- 预留 30% 余量
- 网络 = 生产 + 复制 + 消费 + 重分配
- 分区数按单分区吞吐和消费者并行度
- 控制器/元数据规模
- 分层存储降低本地磁盘，但增加远程成本

## 压测

- 生产相似消息大小、压缩、acks、RF
- 测生产吞吐、消费吞吐、延迟、ISR
- 观察 broker CPU、网络、磁盘 await
- 记录基线，升级/扩容后复跑

# 故障排查

## UnderReplicated

- broker 宕机/慢
- 磁盘满/IO 慢
- 网络分区
- follower fetch 失败
- ISR 频繁收缩

```bash
bin/kafka-topics.sh --bootstrap-server broker:9092 --describe --under-replicated-partitions
bin/kafka-log-dirs.sh --bootstrap-server broker:9092 --describe
```

## Offline Partitions

- 所有副本不可用
- controller 无法选 leader
- 检查 broker、磁盘、元数据
- 不要强行 unclean 选举，除非接受丢数据

## Controller 问题

- ActiveControllerCount 不是 1
- controller quorum 失去多数派
- metadata log 损坏
- 查看 `kafka-metadata-quorum.sh describe --status`
- 恢复多数派后再操作

## 磁盘满

- 清理过期 segment/调整 retention
- 扩容/迁移分区
- 检查 log dirs 分布
- 不要让磁盘到 100%，会触发 broker 故障

## 请求队列满

- `RequestQueueSize` 高
- IO 线程不足/磁盘慢
- 网络瓶颈
- 增加 `num.io.threads`、扩容、限流

## 消费者 Lag

- 消费能力不足
- 下游慢
- rebalance
- 分区倾斜
- 检查 consumer group、线程数、`max.poll.records`

## Rebalance Storm

- `max.poll.interval.ms` 太小
- 消费者频繁重启
- 网络/心跳
- 使用静态成员/cooperative sticky
- 减少滚动重启频率

## 事务错误

- `transaction.timeout.ms`
- 事务 topic RF/minISR
- producer 重启/幂等状态
- 检查 `__transaction_state`

## 数据丢失风险

- `acks=1/0`
- `min.insync.replicas=1`
- `unclean.leader.election.enable=true`
- 副本不足
- 磁盘故障 + 无备份
- 误删 topic

# 企业实践

## 多集群与容灾

- 同城/异地双集群
- MirrorMaker 2 做跨集群复制
- 明确 RPO/RTO
- 主题命名、ACL、schema 统一
- 定期切换演练

## 多租户

- 按业务/团队分 topic 命名空间
- 配额限制生产/消费速率
- ACL 最小权限
- 监控租户 lag/流量
- 避免单租户打满 broker

## SLO

- 生产成功率
- 端到端延迟 P99
- 消费 lag
- ISR 健康
- 可用性/错误率
- 恢复时间

## 变更

- topic 配置/分区变更走审批
- 重分配限速
- 升级/重启一次一个 broker
- 变更窗口避开高峰
- 保留回滚

## 成本

- 分层存储降低本地磁盘
- 压缩减少网络/磁盘
- 合理保留时间
- 避免过度副本/分区
- 按租户做成本分摊

## 反模式

- 用 ZooKeeper 搭 4.x（不支持）
- `acks=1` 还宣称不丢
- `min.insync.replicas=1`
- 单分区追求全局有序
- 分区数过多/过少
- 不监控 ISR/lag
- 不做跨集群复制
- 直接删 topic 不确认
- 用 Kafka 当数据库做随机查询

# 附录

## 常用端口

| 端口 | 用途 |
| --- | --- |
| 9092 | Broker 内部/客户端 |
| 9093 | KRaft Controller |
| 9094 | 外部客户端（示例） |

## 常用命令

```bash
# Topic
kafka-topics.sh --bootstrap-server broker:9092 --list
kafka-topics.sh --bootstrap-server broker:9092 --describe --topic orders

# 消费组
kafka-consumer-groups.sh --bootstrap-server broker:9092 --list
kafka-consumer-groups.sh --bootstrap-server broker:9092 --describe --group my-group

# 配置
kafka-configs.sh --bootstrap-server broker:9092 --describe --entity-type topics --entity-name orders

# 重分配
kafka-reassign-partitions.sh --bootstrap-server broker:9092 \
  --reassignment-json-file plan.json --verify

# KRaft
kafka-metadata-quorum.sh --bootstrap-controller controller1:9093 describe --status
kafka-features.sh --bootstrap-controller controller1:9093 describe

# 日志目录
kafka-log-dirs.sh --bootstrap-server broker:9092 --describe
```

## 官方参考

- [Kafka 4.3 Documentation](https://kafka.apache.org/43/getting-started/introduction/)
- [KRaft](https://kafka.apache.org/43/operations/kraft/)
- [Basic Kafka Operations](https://kafka.apache.org/43/operations/basic-kafka-operations/)
- [Monitoring](https://kafka.apache.org/43/operations/monitoring/)
- [Tiered Storage](https://kafka.apache.org/43/operations/tiered-storage/)
- [Upgrading](https://kafka.apache.org/43/getting-started/upgrade/)
- [Configuration](https://kafka.apache.org/43/configuration/)
- [Security](https://kafka.apache.org/43/security/)

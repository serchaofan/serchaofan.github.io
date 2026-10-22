---
title: MySQL高可用笔记
date: 2018-10-01 10:45:25
tags: [MySQL, 高可用, InnoDB Cluster, Group Replication]
categories: [数据库]
comments: false
---

本文按 MySQL 8.4 LTS 官方文档重写，覆盖复制、GTID、半同步、Group Replication、InnoDB Cluster、MySQL Router、InnoDB ClusterSet、Clone、故障切换、监控、升级和运维。生产基线优先 8.4 LTS；MySQL 9.x/26.x 属于创新版本，按官方支持策略评估，不作为默认生产选择。

最后更新：2026-10-22

<!--more-->

- [版本与高可用选型](#%E7%89%88%E6%9C%AC%E4%B8%8E%E9%AB%98%E5%8F%AF%E7%94%A8%E9%80%89%E5%9E%8B)
- [复制基础](#%E5%A4%8D%E5%88%B6%E5%9F%BA%E7%A1%80)
- [GTID](#gtid)
- [半同步复制](#%E5%8D%8A%E5%90%8C%E6%AD%A5%E5%A4%8D%E5%88%B6)
- [Group Replication](#group-replication)
- [InnoDB Cluster](#innodb-cluster)
- [MySQL Router](#mysql-router)
- [InnoDB ClusterSet](#innodb-clusterset)
- [异步复制拓扑与第三方方案](#%E5%BC%82%E6%AD%A5%E5%A4%8D%E5%88%B6%E6%8B%93%E6%89%91%E4%B8%8E%E7%AC%AC%E4%B8%89%E6%96%B9%E6%96%B9%E6%A1%88)
- [Clone 与备份恢复](#clone-%E4%B8%8E%E5%A4%87%E4%BB%BD%E6%81%A2%E5%A4%8D)
- [故障切换与演练](#%E6%95%85%E9%9A%9C%E5%88%87%E6%8D%A2%E4%B8%8E%E6%BC%94%E7%BB%83)
- [监控](#%E7%9B%91%E6%8E%A7-1)
- [升级](#%E5%8D%87%E7%BA%A7)
- [性能与容量](#%E6%80%A7%E8%83%BD%E4%B8%8E%E5%AE%B9%E9%87%8F)
- [安全](#%E5%AE%89%E5%85%A8)
- [排障](#%E6%8E%92%E9%9A%9C)
- [企业实践](#%E4%BC%81%E4%B8%9A%E5%AE%9E%E8%B7%B5)
- [附录](#%E9%99%84%E5%BD%95)

# 版本与高可用选型

## 版本

- **MySQL 8.4 LTS**：当前生产推荐线，持续接收补丁
- **MySQL 8.0**：已进入生命周期末期，尽快升级到 8.4 LTS
- **MySQL 9.x / 26.x**：创新版本（具体支持周期以官方为准），包含新特性，适合评估和特定场景，不作为默认 LTS
- **MySQL Shell 26.7**：官方推荐与 8.0+ 配合使用，AdminAPI 管理 InnoDB Cluster/ClusterSet

8.4 的重要变化：

- `mysql_native_password` 默认禁用，应用要支持 `caching_sha2_password`
- 复制术语从 master/slave 改为 source/replica
- 升级前必须做应用兼容性验证

## 高可用方案对比

| 方案 | 一致性 | 自动切换 | 复杂度 | 适用 |
| --- | --- | --- | --- | --- |
| 异步复制 | 最终一致 | 需外部工具 | 低 | 读写分离、异地只读 |
| 半同步复制 | 更强 | 需外部工具 | 中 | 不想丢事务的异步复制 |
| Group Replication | 强一致（多数派） | 内建 | 中高 | 单主/多主 HA |
| InnoDB Cluster | 强一致 | 内建 + Router | 中高 | 推荐的自建 HA |
| InnoDB ClusterSet | 集群内强一致，集群间异步 | 受控切换/应急切换 | 高 | 跨机房容灾 |
| NDB Cluster | 同步多主 | 内建 | 高 | 特定高写入场景 |
| Orchestrator/ProxySQL | 异步 | 外部 | 中高 | 已有异步复制体系 |
| 云托管 | 取决于产品 | 托管 | 低 | 不想自建 |

选择原则：

- 单机房高可用：InnoDB Cluster（3 节点起）
- 同城双活/异地容灾：InnoDB ClusterSet
- 历史异步复制体系：Orchestrator/ProxySQL + 半同步，逐步迁移
- 超低延迟、多主写入：评估 NDB 或分片，不要硬套 InnoDB Cluster

# 复制基础

## 复制链路

```
应用写入 source
  → source 写 binlog
  → replica IO 线程拉取 binlog
  → 写入 relay log
  → replica SQL/applier 线程重放
  → replica 数据更新
```

关键点：

- `binlog_format=ROW` 是生产推荐，减少不确定性和主从不一致
- 复制元数据存储在表中，不再依赖旧的 `master.info` 文件
- `relay_log` 和复制状态要 crash-safe
- 并行复制按逻辑时钟/事务组提升回放能力
- 复制过滤器要谨慎，容易导致数据不一致

## 常用命令

```sql
-- source
SHOW BINARY LOGS;
SHOW BINARY LOG STATUS;  -- 8.4
SHOW PROCESSLIST;

-- replica
SHOW REPLICA STATUS\G
SHOW REPLICA STATUS FOR CHANNEL 'ch1'\G
START REPLICA;
STOP REPLICA;
START REPLICA SQL_THREAD;
START REPLICA IO_THREAD;
```

8.4 使用 `SOURCE`/`REPLICA` 术语；旧 `SLAVE` 语法仅用于兼容。

## 复制模式

- 异步：source 提交后立即返回，replica 可能落后
- 半同步：至少一个 replica 确认收到 binlog 后才返回
- 组复制：多数派认证后提交，强一致
- 多源复制：一个 replica 从多个 source 复制，适合汇总/迁移
- 延迟复制：`SOURCE_DELAY`，用于误操作保护和演练
- 级联复制：减轻 source 压力，但增加延迟和故障面

## 复制延迟

常见原因：

- 大事务
- 从库单线程回放/并行度不足
- 从库磁盘/CPU 瓶颈
- 锁冲突
- 网络延迟
- DDL

排查：

```sql
SHOW REPLICA STATUS\G
-- Seconds_Behind_Source, Relay_Log_Space, Exec_Source_Log_Pos
SELECT * FROM performance_schema.replication_applier_status_by_worker;
```

`Seconds_Behind_Source` 不是绝对准确，要结合 GTID 差距、心跳和业务延迟判断。

# GTID

GTID 是全局事务标识，格式：

```
source_uuid:transaction_id
```

优点：

- 自动定位，不用手工指定 binlog 文件和位置
- 切换后容易重新指向新 source
- 便于一致性校验和故障恢复

配置：

```ini
gtid_mode=ON
enforce_gtid_consistency=ON
```

建立复制：

```sql
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='source1',
  SOURCE_PORT=3306,
  SOURCE_USER='repl',
  SOURCE_PASSWORD='***',
  SOURCE_AUTO_POSITION=1,
  SOURCE_SSL=1;

START REPLICA;
```

注意：

- GTID 模式不支持某些非事务语句，开启前要检查
- 切换后不要手工 `RESET MASTER`，会破坏 GTID 历史
- 复制账号使用最小权限，开启 TLS
- 用 `gtid_executed`/`gtid_purged` 判断差距
- 误操作恢复可用延迟复制或备份 + binlog PITR

# 半同步复制

半同步在异步复制上增加确认：

- source 提交后等待至少 N 个 replica 确认收到 binlog
- 超时后回退异步（可配置）
- 降低“source 宕机丢事务”的风险，但不保证零丢失

插件：

```sql
INSTALL PLUGIN rpl_semi_sync_source SONAME 'semisync_source.so';
INSTALL PLUGIN rpl_semi_sync_replica SONAME 'semisync_replica.so';
```

配置：

```ini
rpl_semi_sync_source_enabled=ON
rpl_semi_sync_replica_enabled=ON
rpl_semi_sync_source_timeout=1000
rpl_semi_sync_source_wait_for_replica_count=1
rpl_semi_sync_source_wait_point=AFTER_SYNC
```

两种等待点：

- `AFTER_SYNC`：ack 后再提交存储引擎，事务更安全，默认推荐
- `AFTER_COMMIT`：提交后再等 ack，延迟更低但故障窗口更大

注意：

- 半同步不是强一致，超时/降级时仍可能丢事务
- 网络抖动会增加写延迟
- 切换时要选最先进的 replica
- 监控 `Rpl_semi_sync_source_status`、超时次数、ack 延迟

# Group Replication

## 核心机制

Group Replication 是基于分布式状态机的复制：

- 组成员通过 Group Communication System 通信
- 事务通过原子广播和认证后提交
- 多数派存活才能继续写入
- 单主模式自动选举 primary
- 多主模式所有成员可写，但冲突认证复杂
- 新成员通过分布式恢复追平
- 网络分区/少数派会自动退出或只读，避免脑裂

关键概念：

- **Group**：一组 MySQL 实例，有唯一 group name
- **Primary**：单主模式下唯一可写成员
- **Secondary**：只读成员
- **Certification**：检查事务冲突
- **Atomic broadcast**：保证成员收到相同顺序
- **View**：组成员视图
- **Quorum**：多数派

## 单主与多主

单主（推荐）：

- 只有 primary 可写
- primary 故障自动选举
- 适合大多数 OLTP
- 冲突少，运维简单

多主：

- 所有成员可写
- 需要处理冲突、死锁、自增、应用路由
- 适合特定场景，不建议默认使用
- 需要 `group_replication_enforce_update_everywhere_checks=ON`

## 要求

- InnoDB 引擎
- 每张表有主键（InnoDB Cluster 会要求）
- GTID：`gtid_mode=ON`、`enforce_gtid_consistency=ON`
- 唯一 `server_id`
- 启用 Performance Schema
- 成员间低延迟、稳定网络
- 主机名可解析
- 复制账号和权限
- `group_replication_group_name` 唯一 UUID
- `group_replication_local_address`、`group_replication_group_seeds`

## 限制

- 设计为局域网，跨 WAN 写性能明显下降
- 最多 9 个成员
- 不管理手工配置的异步复制通道
- 不适合 NDB Cluster
- AdminAPI 只支持 TCP/IP + classic protocol
- 大事务、DDL、外键/级联等要评估
- 多主冲突需要应用配合

## 端口

| 端口 | 用途 |
| --- | --- |
| 3306 | MySQL classic |
| 33060 | X Protocol |
| 33061 | Group Replication 通信 |

## 网络分区与 quorum

- 多数派分区继续服务
- 少数派分区失去 quorum，按 `group_replication_exit_state_action` 进入只读或退出
- `group_replication_unreachable_majority_timeout` 控制等待时间
- 恢复后需要 rejoin，不能强行让少数派写入
- 不要用 `forceQuorum` 随意恢复，可能造成数据分叉

## 监控

```sql
SELECT * FROM performance_schema.replication_group_members;
SELECT * FROM performance_schema.replication_group_member_stats;
SELECT * FROM performance_schema.replication_connection_status;
SELECT * FROM performance_schema.replication_applier_status;
```

关注：

- 成员状态 `ONLINE`/`RECOVERING`/`ERROR`
- `COUNT_TRANSACTIONS_IN_QUEUE`
- `COUNT_TRANSACTIONS_CHECKED`
- `CONFLICTS_DETECTED`
- `TRANSACTIONS_WAITING_CERTIFICATION`
- 流控 `group_replication_flow_control_*`

# InnoDB Cluster

## 组成

- **MySQL Server + Group Replication**：数据复制和故障转移
- **MySQL Shell AdminAPI**：部署、配置、切换、恢复
- **MySQL Router**：客户端路由

## 部署流程

1. 准备 3 个 MySQL 实例，配置主机名、时间同步、TLS
2. 用 `dba.configureInstance()` 检查并配置实例
3. 创建集群
4. 添加实例
5. 部署 Router
6. 验证状态和故障切换

```bash
mysqlsh --uri root@ic-1:3306
```

```javascript
dba.configureInstance('root@ic-1:3306')
dba.configureInstance('root@ic-2:3306')
dba.configureInstance('root@ic-3:3306')

var cluster = dba.createCluster('prodCluster')
cluster.addInstance('root@ic-2:3306')
cluster.addInstance('root@ic-3:3306')
cluster.status()
```

生产建议：

- 3 或 5 个成员，奇数
- 跨机架/可用区
- 独立磁盘、低延迟网络
- 不要和业务高峰变更冲突
- Router 至少 2 个实例

## 常用 AdminAPI

```javascript
cluster.status()
cluster.describe()
cluster.setPrimaryInstance('ic-2:3306')
cluster.forceQuorumUsingPartitionOf('ic-1:3306')
cluster.rejoinInstance('ic-3:3306')
cluster.rescan()
cluster.switchToMultiPrimaryMode()
cluster.switchToSinglePrimaryMode()
cluster.setOption('consistency', 'BEFORE_ON_PRIMARY_FAILOVER')
dba.upgradeMetadata()
```

注意：

- `setPrimaryInstance` 是受控切换，适合维护
- `forceQuorumUsingPartitionOf` 只在确认其他成员不可恢复时使用，可能丢数据
- 多主切换要评估应用写入和冲突
- `dba.upgradeMetadata()` 在升级 Shell/Cluster 后执行

## 故障切换

单主模式：

1. primary 失联
2. 组内多数派检测到故障
3. 选举新 primary
4. Router 感知拓扑变化，把写流量切到新 primary
5. 旧 primary 恢复后 rejoin

客户端要：

- 使用 Router 或支持拓扑感知的连接器
- 配置重试和超时
- 避免直连单个实例
- 处理切换瞬间的只读错误

# MySQL Router

Router 根据 InnoDB Cluster 元数据自动路由：

- 读写流量到 primary
- 只读流量到 secondary
- 检测拓扑变化并更新路由

引导：

```bash
mysqlrouter --bootstrap root@ic-1:3306 --user=mysqlrouter
```

默认端口：

| 端口 | 用途 |
| --- | --- |
| 6446 | 读写 |
| 6447 | 只读 |
| 6448 | X Protocol 读写 |
| 6449 | X Protocol 只读 |

生产建议：

- Router 至少 2 个实例，前置 LB/VIP
- Router 与集群分开部署
- 监控 Router 到集群的连通性和路由状态
- Router 升级要和 Shell/Cluster 元数据兼容
- 不要把 Router 当成唯一高可用点

# InnoDB ClusterSet

ClusterSet 用于跨机房/区域容灾：

- 一个 primary cluster（可读写）
- 一个或多个 replica cluster（只读，异步复制）
- 每个 cluster 内部仍是 Group Replication
- 支持受控 switchover 和应急 failover
- Router 会把流量路由到当前 primary cluster

拓扑：

```
Primary Cluster (DC-A)
  ⇢ async replication ⇢ Replica Cluster (DC-B)
  ⇢ async replication ⇢ Replica Cluster (DC-C)
```

特点：

- 集群内强一致，集群间异步
- 优先可用性，应急 failover 可能丢未复制事务
- 需要 fencing、repair、rejoin 流程
- 比单集群复杂，必须有演练

常用命令：

```javascript
var cs = dba.getClusterSet()
cs.status()
cs.createReplicaCluster('ic-dc-b:3306', 'dcB')
cs.setPrimaryCluster('dcB')
cs.switchover('dcB')
cs.failover('dcB')
```

注意：

- 应急 failover 前尽量修复/恢复原 primary
- 切换后要检查 GTID 差异和数据一致性
- 旧 primary 不能直接写，要 fence 后 rejoin
- 应用要能接受跨机房延迟和切换窗口

# 异步复制拓扑与第三方方案

## 常见拓扑

- 一主一从：简单，读扩展有限
- 一主多从：读扩展，source binlog 压力增加
- 级联：减轻 source 压力，延迟增加
- 双主：冲突和脑裂风险，不建议无保护使用
- 多源：汇总、迁移、聚合
- 延迟从库：误删恢复、演练

## 第三方工具

- **Orchestrator**：拓扑管理、自动/手动 failover、Web/API
- **ProxySQL**：读写分离、连接池、查询规则、故障检测
- **HAProxy/Keepalived**：VIP 和健康检查
- **MHA**：已过时，不建议新项目
- **Percona XtraDB Cluster/Galera**：同步多主，独立技术栈
- **云托管**：RDS/Aurora 等，切换由云平台负责

异步复制 failover 要点：

- 使用 GTID
- 选最先进 replica
- 确认 `super_read_only`、复制通道、Router/VIP
- 防止旧 source 恢复后双写
- 用 fencing 或隔离策略

# Clone 与备份恢复

## Clone 插件

Clone 用于快速复制一个实例的数据：

```sql
-- recipient
CLONE INSTANCE FROM 'donor_user'@'donor_host':3306
  IDENTIFIED BY '***';
```

用途：

- 新成员加入 InnoDB Cluster 时自动/手动 provision
- 快速搭建 replica
- 恢复损坏实例

注意：

- donor/recipient 版本要兼容
- 需要 Clone 插件和权限
- 克隆会覆盖 recipient 数据
- 大库克隆需要网络和磁盘带宽
- 加密表空间、插件、配置要验证

## 备份

- **MySQL Enterprise Backup**：物理热备，适合大库
- **mysqldump/mysqlpump**：逻辑备份，适合小库/迁移
- **Clone**：实例级复制
- **binlog**：PITR
- **云快照**：结合一致性快照

策略：

- 全量 + 增量 + binlog
- 从 replica 备份，减少 source 压力
- 备份加密、异地保存
- 定期恢复演练
- 记录 RTO/RPO
- 备份账号最小权限

# 故障切换与演练

## 自动切换

InnoDB Cluster 单主模式：

- primary 故障，组内多数派选举新 primary
- Router 自动路由
- 应用重试后恢复

前提：

- 多数派存活
- 网络稳定
- Router/连接器正确配置
- 没有人为强制 quorum 导致分叉

## 受控切换

维护/升级时：

```javascript
cluster.setPrimaryInstance('ic-2:3306')
```

检查：

- 新 primary 可写
- Router 路由正确
- 旧 primary 只读
- 复制/组状态正常

## 应急切换

ClusterSet：

```javascript
cs.failover('dcB')
```

风险：

- 未复制事务可能丢失
- 旧 primary 恢复后要 fence
- 需要人工校验数据
- 应用要切换连接

## 演练清单

- 杀 primary
- 杀 secondary
- 网络分区/少数派
- Router 故障
- 磁盘满/慢盘
- 大事务/DDL
- 备份恢复
- ClusterSet 切换
- 应用重连和重试

演练前定义成功标准：

- 切换时间
- 数据丢失范围
- 应用错误率
- Router 恢复时间
- 人工步骤是否可执行

# 监控

## 复制

```sql
SHOW REPLICA STATUS\G
SELECT * FROM performance_schema.replication_applier_status_by_worker;
SELECT * FROM performance_schema.replication_connection_status;
```

关注：

- `Replica_IO_Running`/`Replica_SQL_Running`
- `Seconds_Behind_Source`
- `Last_Error`/`Last_SQL_Error`
- GTID 差距
- relay log 空间
- 并行 worker 状态

## Group Replication

```sql
SELECT * FROM performance_schema.replication_group_members;
SELECT * FROM performance_schema.replication_group_member_stats;
```

关注：

- 成员状态
- 认证队列
- 冲突数
- 流控
- 网络延迟
- 成员版本

## InnoDB Cluster/Router

```javascript
cluster.status()
cs.status()
```

Router：

- 到 primary/secondary 的连通性
- 路由元数据版本
- 连接数、错误数
- 启动/重启事件

## 主机与数据库

- CPU、内存、磁盘 IO、inode
- `innodb_buffer_pool` 命中率
- 锁等待、死锁
- 慢查询
- binlog 增长
- 连接数
- 复制线程
- 备份任务

# 升级

## 版本路径

- 8.0 → 8.4 LTS：生产推荐
- 8.4 LTS → 9.x/26.x：创新版本，评估后再决定
- 不支持跨多个 LTS 大版本直接跳升
- 升级前做兼容性检查和应用回归

## InnoDB Cluster 滚动升级

1. 备份和验证
2. 升级 MySQL Shell 到兼容版本
3. 逐个升级 secondary
4. 受控切换 primary
5. 升级旧 primary
6. `dba.upgradeMetadata()`
7. 验证集群和 Router

注意：

- 一次一个成员，确认 `ONLINE` 再继续
- 不要同时升级多数派
- 关注组复制版本兼容
- 升级 Router 和连接器
- 8.4 的认证插件变化会影响旧应用

## 异步复制升级

- 先升级 replica，再升级 source，或按官方版本兼容矩阵
- 升级前确认 GTID、复制账号、TLS
- 升级后验证 `SHOW REPLICA STATUS`
- 保留回滚和备份

# 性能与容量

## 写入

- Group Replication 写入受多数派确认和网络延迟影响
- 大事务会增加认证和流控压力
- `sync_binlog`、`innodb_flush_log_at_trx_commit` 在性能和持久性之间权衡
- 半同步会增加写延迟
- 多主冲突会降低吞吐

## 读取

- Router 只读端口分流
- 只读副本增加读容量，但注意复制延迟
- 读写分离要考虑“读己之写”
- 缓存和连接池减少数据库压力

## 容量

- 磁盘：数据 + binlog + relay log + 备份 + 临时空间
- 网络：组复制/半同步/Clone 带宽
- 内存：buffer pool、连接、复制缓存
- CPU：并发、加密、压缩
- 预留 30% 余量

# 安全

- 复制使用 TLS，`SOURCE_SSL=1`
- 复制账号最小权限
- 应用账号按库/表授权
- 使用 `caching_sha2_password`，旧客户端要升级
- 开启审计、慢查询、错误日志
- 备份加密
- 密钥和密码用 Vault/KMS 管理
- Router/Shell 账号最小权限
- 限制 3306/33061 暴露面
- 定期轮换证书和密码

# 排障

## 复制中断

- `Last_IO_Error`：网络、认证、TLS、source 不可达
- `Last_SQL_Error`：1062 主键冲突、1032 行不存在、DDL、权限
- GTID 空洞/事务丢失
- relay log 损坏
- 磁盘满

处理原则：

- 先停止复制，保留现场
- 确认能否跳过/重建/从备份恢复
- 不要盲目 `SET GLOBAL SQL_SLAVE_SKIP_COUNTER`
- 记录 GTID 和数据差异

## 组复制异常

- 成员 `RECOVERING` 卡住：网络、Clone、磁盘
- 少数派只读/退出：quorum 丢失
- 认证冲突：多主写冲突
- 流控：慢成员拖慢组
- 版本不一致
- 强制 quorum 后数据分叉

## InnoDB Cluster

- `cluster.status()` 看成员和 Router
- `dba.upgradeMetadata()` 解决元数据版本
- `cluster.rejoinInstance()` 恢复成员
- `cluster.rescan()` 重新发现 Router
- 不要直接改 Group Replication 变量绕过 AdminAPI

## Router

- 无法连接：bootstrap 配置、账号、TLS、网络
- 路由到旧 primary：元数据未更新、Router 未重启
- 只读端口没有 secondary：集群降级
- 连接风暴：连接池、超时、重试

# 企业实践

## 拓扑与 RTO/RPO

| 级别 | 拓扑 | RPO | RTO |
| --- | --- | --- | --- |
| 核心交易 | 同城 InnoDB Cluster + 异地 ClusterSet | 秒级 | 分钟级 |
| 重要业务 | 单机房 InnoDB Cluster | 0（多数派） | 分钟级 |
| 一般业务 | 异步复制 + 半同步 | 秒–分钟 | 十分钟级 |
| 分析/报表 | 只读副本 | 分钟–小时 | 小时级 |

## 变更与演练

- 所有变更走 GitOps/变更单
- 升级、切换、扩容先在测试集群演练
- 每季度做 primary 故障、网络分区、Router 故障、备份恢复演练
- 记录实际 RTO/RPO
- 复盘 action 要跟踪

## 监控与 SLO

- 可用性：写入成功率、Router 可用性
- 延迟：提交延迟、复制延迟
- 一致性：GTID 差距、冲突、复制错误
- 容量：磁盘、binlog、连接数
- 备份：成功率、恢复演练
- 告警要可行动，避免只看 `Seconds_Behind_Source`

## 组织

- DBA 负责数据库平台、备份、升级、故障
- 应用团队负责连接配置、重试、读写分离语义
- SRE 负责 SLO、监控、演练和事故流程
- 明确谁可以执行 failover/forceQuorum
- 高风险操作双人复核

## 反模式

- 直连单个 MySQL 实例
- 用 MHA 新搭集群
- 多主无冲突处理
- 半同步当强一致
- 只备份不恢复演练
- 用 `forceQuorum` 解决所有问题
- 复制过滤器导致数据不一致
- 跨 WAN 部署单个 InnoDB Cluster
- 升级不验证 8.4 认证插件

# 附录

## 常用端口

| 端口 | 用途 |
| --- | --- |
| 3306 | MySQL classic |
| 33060 | X Protocol |
| 33061 | Group Replication |
| 6446 | Router 读写 |
| 6447 | Router 只读 |
| 6448 | Router X 读写 |
| 6449 | Router X 只读 |

## 常用命令

```bash
# Shell
mysqlsh --uri root@host:3306
mysqlsh --uri root@host:3306 -- cluster status

# Router
mysqlrouter --bootstrap root@ic-1:3306 --user=mysqlrouter

# 复制
mysql -e "SHOW REPLICA STATUS\G"
mysql -e "SELECT * FROM performance_schema.replication_group_members"
```

## 官方参考

- [MySQL 8.4 Reference Manual](https://dev.mysql.com/doc/refman/8.4/en/)
- [Replication](https://dev.mysql.com/doc/refman/8.4/en/replication.html)
- [Group Replication](https://dev.mysql.com/doc/refman/8.4/en/group-replication.html)
- [GTID](https://dev.mysql.com/doc/refman/8.4/en/replication-gtids.html)
- [Semisynchronous Replication](https://dev.mysql.com/doc/refman/8.4/en/replication-semisync.html)
- [Clone Plugin](https://dev.mysql.com/doc/refman/8.4/en/clone-plugin.html)
- [InnoDB Cluster](https://dev.mysql.com/doc/mysql-shell/8.4/en/mysql-innodb-cluster.html)
- [InnoDB ClusterSet](https://dev.mysql.com/doc/mysql-shell/8.4/en/innodb-clusterset.html)
- [MySQL Router](https://dev.mysql.com/doc/mysql-router/8.4/en/)
- [Upgrading MySQL](https://dev.mysql.com/doc/refman/8.4/en/upgrading.html)

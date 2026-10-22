---
title: Etcd基础笔记
tags: [Etcd, 分布式, Kubernetes, Raft]
date: 2020-04-10 12:28:43
categories: [数据库]
comments: false
---

etcd 是一个强一致、高可用的分布式键值存储，使用 Raft 协议复制日志，常用于配置管理、服务发现、分布式锁、Leader 选举和 Kubernetes 集群状态存储。

本文基于 etcd 3.7.2（2026-09）和官方 latest 文档重写，覆盖架构、数据模型、etcdctl、集群、TLS/RBAC、compaction/defrag、备份恢复、监控调优、Kubernetes 实践，以及 Raft/MVCC/Watch/Lease 的深入机制。

> 名字来源：etc 代表 `/etc` 配置目录，d 代表 distributed。etcd 适合存储**控制面元数据**，不适合当对象存储、日志库或大 Value 数据库。

<!-- more -->

- [etcd 是什么](#etcd-%E6%98%AF%E4%BB%80%E4%B9%88)
- [核心架构](#%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84)
- [数据模型](#%E6%95%B0%E6%8D%AE%E6%A8%A1%E5%9E%8B)
- [一致性语义](#%E4%B8%80%E8%87%B4%E6%80%A7%E8%AF%AD%E4%B9%89)
- [安装与启动](#%E5%AE%89%E8%A3%85%E4%B8%8E%E5%90%AF%E5%8A%A8)
- [etcdctl 常用命令](#etcdctl-%E5%B8%B8%E7%94%A8%E5%91%BD%E4%BB%A4)
- [集群部署](#%E9%9B%86%E7%BE%A4%E9%83%A8%E7%BD%B2)
- [安全](#%E5%AE%89%E5%85%A8)
- [运维与备份](#%E8%BF%90%E7%BB%B4%E4%B8%8E%E5%A4%87%E4%BB%BD)
- [监控与调优](#%E7%9B%91%E6%8E%A7%E4%B8%8E%E8%B0%83%E4%BC%98)
- [Kubernetes 中的 etcd](#kubernetes-%E4%B8%AD%E7%9A%84-etcd)
- [典型应用场景](#%E5%85%B8%E5%9E%8B%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)
- [etcd 与 ZooKeeper Consul](#etcd-%E4%B8%8E-zookeeper-consul)
- [深入 Raft 与一致性](#%E6%B7%B1%E5%85%A5-raft-%E4%B8%8E%E4%B8%80%E8%87%B4%E6%80%A7)
- [深入 MVCC 与存储](#%E6%B7%B1%E5%85%A5-mvcc-%E4%B8%8E%E5%AD%98%E5%82%A8)
- [深入 Watch 与 Lease](#%E6%B7%B1%E5%85%A5-watch-%E4%B8%8E-lease)
- [深入集群变更与故障](#%E6%B7%B1%E5%85%A5%E9%9B%86%E7%BE%A4%E5%8F%98%E6%9B%B4%E4%B8%8E%E6%95%85%E9%9A%9C)
- [深入性能与容量](#%E6%B7%B1%E5%85%A5%E6%80%A7%E8%83%BD%E4%B8%8E%E5%AE%B9%E9%87%8F)
- [深入安全模型](#%E6%B7%B1%E5%85%A5%E5%AE%89%E5%85%A8%E6%A8%A1%E5%9E%8B)
- [客户端开发实践](#%E5%AE%A2%E6%88%B7%E7%AB%AF%E5%BC%80%E5%8F%91%E5%AE%9E%E8%B7%B5)
- [运维深水区](#%E8%BF%90%E7%BB%B4%E6%B7%B1%E6%B0%B4%E5%8C%BA)
- [Kubernetes etcd 深水区](#kubernetes-etcd-%E6%B7%B1%E6%B0%B4%E5%8C%BA)
- [故障案例](#%E6%95%85%E9%9A%9C%E6%A1%88%E4%BE%8B)
- [常见问题](#%E5%B8%B8%E8%A7%81%E9%97%AE%E9%A2%98)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# etcd 是什么

## 定位

etcd 是一个分布式、强一致的 key-value 存储：

- **强一致**：写入通过 Raft 复制，线性一致读默认从 Leader 获取最新数据。
- **高可用**：多节点组成集群，少数节点故障不影响 quorum。
- **Watch**：客户端可以监听 key/prefix 的变化，支持历史 revision。
- **Lease**：TTL 租约，适合服务注册、心跳、分布式锁。
- **事务**：Compare-And-Swap、If/Then/Else 原子操作。
- **MVCC**：多版本并发控制，支持按 revision 读取历史数据（在 compaction 之前）。
- **gRPC/HTTP API**：官方客户端和 grpc-gateway 提供 HTTP/JSON 接口。

## 适合与不适合

适合：

- Kubernetes 集群状态、配置、元数据。
- 服务注册与发现、健康心跳。
- 分布式锁、Leader 选举、选主。
- 配置中心、动态配置下发。
- 小规模、强一致的协调数据。

不适合：

- 大 Value、图片、日志、文件存储。
- 高吞吐写入、海量 key。
- 需要复杂查询、二级索引、SQL 的业务数据。
- 作为消息队列或分析数据库。

etcd 官方建议：**存储的数据应较小，写入频繁但数据量可控**。默认单次请求上限约 1.5 MiB，生产不建议存大对象。

## 版本

- 当前官方 latest 文档为 **etcd 3.7**。
- v3 API 是主流；v2 API 已弃用，不要在新系统使用。
- Kubernetes 对 etcd 版本有兼容矩阵，升级前查看对应 Kubernetes 版本文档。

# 核心架构

```text
Client (etcdctl / clientv3 / HTTP)
        │ gRPC / HTTP
        ▼
┌─────────────────────────────────────┐
│ etcd server                         │
│  gRPC API / grpc-gateway            │
│  Raft（Leader 选举、日志复制）       │
│  WAL（预写日志）                     │
│  MVCC / treeIndex                   │
│  bbolt backend（key-value 存储）     │
│  Lease / Watch / Auth               │
└─────────────────────────────────────┘
        │ peer 2380
        ▼
其他 etcd member
```

| 组件 | 作用 |
| ---- | ---- |
| Raft | 一致性算法，负责 Leader 选举、日志复制、quorum |
| WAL | 预写日志，持久化 Raft entry，崩溃恢复 |
| Snapshot | Raft 快照，避免 WAL 无限增长 |
| MVCC | 多版本 key-value，revision、历史读 |
| treeIndex | 内存中的 key 索引，映射到 revision |
| bbolt | 嵌入式 KV 后端，存储 key-value 和元数据 |
| Lease | TTL 租约，key 到期自动删除 |
| Watch | 监听 key/prefix 变化 |
| Auth | RBAC 用户/角色/权限 |
| grpc-gateway | 把 gRPC 暴露为 HTTP/JSON |

## 写路径

1. 客户端向 Leader 发起 Put/Txn/Delete。
2. Leader 把请求转成 Raft log entry，写入本地 WAL。
3. Leader 复制 entry 到 Follower。
4. 多数节点持久化后，entry 被 commit。
5. 各节点 apply 到 MVCC/backend。
6. 返回客户端。

## 读路径

- **线性一致读**（默认）：通过 ReadIndex/Leader 确认，保证读到已提交的最新数据。
- **串行化读**（`serializable=true`）：从本地节点读，可能读到旧数据，但延迟更低、可用性更好。
- Watch 事件按 revision 有序，客户端可以从指定 revision 开始 watch。

# 数据模型

## KeyValue

etcd v3 的 key 是字节数组，逻辑上是扁平的 key 空间：

```protobuf
message KeyValue {
  bytes key = 1;
  int64 create_revision = 2;
  int64 mod_revision = 3;
  int64 version = 4;
  bytes value = 5;
  int64 lease = 6;
}
```

| 字段 | 说明 |
| ---- | ---- |
| `key` | key，不能为空 |
| `value` | value，字节数组 |
| `create_revision` | 该 key 最后一次创建时的全局 revision |
| `mod_revision` | 最后一次修改的 revision |
| `version` | key 的修改次数；删除后归零 |
| `lease` | 绑定的 lease ID，0 表示无租约 |

## Revision

- 每次写事务都会推进全局 revision。
- 一个事务内的多个修改共享同一个 revision。
- `get --rev=N` 可以读取历史版本（compaction 之前）。
- compaction 会删除旧 revision，之后读取会返回 `ErrCompacted`。

## Range

`Range` 用于读取 key 或 key 范围：

- `key` + `range_end`：范围查询。
- `limit`：限制返回数量，0 表示不限制。
- `revision`：按历史 revision 读。
- `sort_order` / `sort_target`：排序。
- `serializable`：本地读，可能 stale。
- `keys_only` / `count_only`：只返回 key / 只返回数量。
- `min_mod_revision` / `max_mod_revision` 等：按 revision 过滤。

```bash
etcdctl get /app/config --prefix
etcdctl get /app/config --prefix --limit=10
etcdctl get /app/config --rev=100
etcdctl get /app/config --prefix --keys-only
etcdctl get /app/config --prefix --count-only
```

## Put / Delete

- `Put`：写入 key；支持 `prev_kv`、`ignore_value`、`ignore_lease`、lease。
- `Delete`：删除 key 或范围；支持 `prev_kv`。
- 删除会生成 tombstone 事件，watcher 能收到 DELETE 事件。

```bash
etcdctl put /app/config '{"timeout":10}'
etcdctl put /app/config '{"timeout":20}' --prev-kv
etcdctl del /app/config
etcdctl del /app/config --prefix
```

## Transaction

事务是原子的 If/Then/Else：

```text
if (compare) {
  success operations
} else {
  failure operations
}
```

- 所有 compare 必须同时为真才执行 success。
- 一个事务内不能对同一个 key 多次修改。
- 事务内的修改只推进一次 revision。
- 适合 CAS、分布式锁、配置版本控制。

```bash
etcdctl txn --interactive
```

## Watch

Watch 是长连接 gRPC stream：

- 监听单个 key 或范围。
- `start_revision`：从指定 revision 开始。
- `progress_notify`：无事件时周期性发送进度。
- `filters`：`NOPUT`、`NODELETE`。
- `prev_kv`：返回修改前的值。
- 如果请求的 revision 已被 compaction，watch 会被取消并返回 compact revision。

```bash
etcdctl watch /app/config
etcdctl watch --prefix /app/
etcdctl watch --rev=100 /app/config
etcdctl watch --prev-kv /app/config
```

## Lease

Lease 是 TTL 租约：

- `LeaseGrant` 创建租约。
- 客户端定期 `LeaseKeepAlive` 续约。
- 租约过期或被 revoke 时，所有绑定 key 自动删除。
- 每个 key 最多绑定一个 lease。

```bash
etcdctl lease grant 60
etcdctl put /service/a '10.0.0.1:8080' --lease=<lease-id>
etcdctl lease keep-alive <lease-id>
etcdctl lease timetolive <lease-id>
etcdctl lease revoke <lease-id>
etcdctl lease list
```

# 一致性语义

## Raft 与 quorum

- 集群通常 3、5、7 个成员。
- 3 节点容忍 1 个故障；5 节点容忍 2 个故障。
- 写必须获得多数派确认。
- 偶数节点不会提高容错能力，反而增加成本和延迟，通常不推荐。
- Leader 负责处理写请求；Follower 可以转发或提供串行化读。

## 线性一致读 vs 串行化读

| 读模式 | 语义 | 特点 |
| ------ | ---- | ---- |
| 线性一致读（默认） | 读到最新已提交数据 | 需要 Leader/quorum 确认，延迟略高 |
| 串行化读 | 本地读，可能 stale | 性能好，适合可容忍旧数据的场景 |

```bash
etcdctl get /app/config --consistency=s
```

`--consistency=s` 表示 serializable；默认是 linearizable。

## Watch 保证

- 事件按 revision 顺序发送。
- 同一个 key 的修改不会乱序。
- 断线重连后可以从上次 revision 继续 watch。
- 如果 revision 已被 compaction，需要全量重新同步。

## 事务隔离

- etcd 事务是串行化的，所有 compare 原子执行。
- 事务内的修改共享一个 revision。
- 不支持跨事务的交互式长事务。

# 安装与启动

## 下载

从官方 release 下载对应平台的 `etcd`、`etcdctl`、`etcdutl`：

```bash
ETCD_VER=v3.7.2
curl -L -o etcd.tar.gz \
  https://github.com/etcd-io/etcd/releases/download/${ETCD_VER}/etcd-${ETCD_VER}-linux-amd64.tar.gz
tar xzf etcd.tar.gz
sudo install -m 0755 etcd-${ETCD_VER}-linux-amd64/etcd /usr/local/bin/
sudo install -m 0755 etcd-${ETCD_VER}-linux-amd64/etcdctl /usr/local/bin/
sudo install -m 0755 etcd-${ETCD_VER}-linux-amd64/etcdutl /usr/local/bin/
```

> 版本号以官方最新 release 为准；生产固定版本并校验 checksum。

## 单机启动

```bash
etcd \
  --name etcd-1 \
  --data-dir /var/lib/etcd \
  --listen-client-urls http://127.0.0.1:2379,http://10.0.0.10:2379 \
  --advertise-client-urls http://10.0.0.10:2379 \
  --listen-peer-urls http://10.0.0.10:2380 \
  --initial-advertise-peer-urls http://10.0.0.10:2380 \
  --initial-cluster etcd-1=http://10.0.0.10:2380 \
  --initial-cluster-token etcd-cluster-1 \
  --initial-cluster-state new
```

常用端口：

| 端口 | 用途 |
| ---- | ---- |
| 2379 | 客户端 gRPC/HTTP |
| 2380 | 成员之间 peer 通信 |

## 健康检查

```bash
etcdctl endpoint health
etcdctl endpoint status --write-out=table
etcdctl member list --write-out=table
```

## systemd 示例

```ini
[Unit]
Description=etcd
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/local/bin/etcd \
  --name etcd-1 \
  --data-dir /var/lib/etcd \
  --listen-client-urls http://10.0.0.10:2379,http://127.0.0.1:2379 \
  --advertise-client-urls http://10.0.0.10:2379 \
  --listen-peer-urls http://10.0.0.10:2380 \
  --initial-advertise-peer-urls http://10.0.0.10:2380 \
  --initial-cluster etcd-1=http://10.0.0.10:2380 \
  --initial-cluster-token etcd-cluster-1 \
  --initial-cluster-state new
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

生产建议：

- `data-dir` 使用独立 SSD，避免和业务日志/数据库抢 IO。
- `--wal-dir` 可以单独放 WAL（需要独立磁盘时）。
- 设置 `LimitNOFILE`，避免文件描述符耗尽。
- 开启 TLS 和认证，不要暴露公网。
- 不要随意删除 `data-dir` 或 `member/snap`。

# etcdctl 常用命令

etcdctl 默认使用 v3 API。旧版本需要 `ETCDCTL_API=3`，v3.4+ 默认即 v3，通常不再需要。

## 连接参数

```bash
export ENDPOINTS=https://10.0.0.10:2379,https://10.0.0.11:2379,https://10.0.0.12:2379
export ETCDCTL_API=3
export ETCDCTL_CACERT=/etc/etcd/ca.crt
export ETCDCTL_CERT=/etc/etcd/client.crt
export ETCDCTL_KEY=/etc/etcd/client.key
```

或每次指定：

```bash
etcdctl --endpoints="$ENDPOINTS" \
  --cacert=ca.crt --cert=client.crt --key=client.key \
  endpoint health
```

## KV

```bash
etcdctl put /app/config '{"timeout":10}'
etcdctl get /app/config
etcdctl get /app/config --print-value-only
etcdctl get /app/ --prefix
etcdctl get /app/ --prefix --limit=20
etcdctl get /app/config --rev=100
etcdctl del /app/config
etcdctl del /app/ --prefix
```

## Watch

```bash
etcdctl watch /app/config
etcdctl watch --prefix /app/
etcdctl watch --rev=100 /app/config
etcdctl watch --prev-kv /app/config
etcdctl watch -i
```

## Lease

```bash
etcdctl lease grant 60
etcdctl lease keep-alive <lease-id>
etcdctl lease timetolive <lease-id>
etcdctl lease list
etcdctl lease revoke <lease-id>
```

## 事务

```bash
etcdctl txn --interactive
```

交互式输入 compare、success、failure 操作；脚本中建议使用客户端库构造 Txn。

## 集群与状态

```bash
etcdctl member list --write-out=table
etcdctl endpoint health --cluster
etcdctl endpoint status --cluster --write-out=table
etcdctl endpoint hashkv --cluster
etcdctl move-leader <member-id>
```

## 维护

```bash
etcdctl compact <revision>
etcdctl defrag
etcdctl defrag --cluster
etcdctl alarm list
etcdctl alarm disarm
etcdctl check datascale
etcdctl check perf
```

## 备份

```bash
etcdctl snapshot save backup.db
etcdutl snapshot status backup.db --write-out=table
```

`etcdctl snapshot save` 用于在线备份；`etcdutl` 用于离线查看/恢复/defrag。

## 认证

```bash
etcdctl user add root
etcdctl user grant-role root root
etcdctl auth enable

etcdctl role add app-reader
etcdctl role grant-permission app-reader read /app/ --prefix
etcdctl user add app
etcdctl user grant-role app app-reader
```

认证开启后，所有请求都要带 `--user/--password` 或客户端证书。

# 集群部署

## 静态集群

三节点静态配置，每个节点使用相同的 `initial-cluster`：

```bash
etcd \
  --name infra0 \
  --data-dir /var/lib/etcd \
  --listen-client-urls http://10.0.1.10:2379,http://127.0.0.1:2379 \
  --advertise-client-urls http://10.0.1.10:2379 \
  --listen-peer-urls http://10.0.1.10:2380 \
  --initial-advertise-peer-urls http://10.0.1.10:2380 \
  --initial-cluster infra0=http://10.0.1.10:2380,infra1=http://10.0.1.11:2380,infra2=http://10.0.1.12:2380 \
  --initial-cluster-token etcd-cluster-1 \
  --initial-cluster-state new
```

另外两个节点替换 `--name`、IP、`data-dir` 即可。

关键参数：

| 参数 | 说明 |
| ---- | ---- |
| `--initial-cluster` | 初始集群所有成员的 peer URL |
| `--initial-cluster-token` | 集群唯一标识，避免误加入其他集群 |
| `--initial-cluster-state` | `new` 新建，`existing` 加入已有集群 |
| `--initial-advertise-peer-urls` | 其他成员访问本节点的 peer URL |
| `--advertise-client-urls` | 客户端访问本节点的 URL |

## 动态发现

云环境/DHCP 场景可用：

- etcd discovery service。
- DNS SRV 记录。
- Kubernetes 等编排系统生成配置。

DNS SRV 示例：

```text
_etcd-server._tcp.example.com. 300 IN SRV 0 0 2380 infra0.example.com.
_etcd-server._tcp.example.com. 300 IN SRV 0 0 2380 infra1.example.com.
_etcd-server._tcp.example.com. 300 IN SRV 0 0 2380 infra2.example.com.
```

## 运行时增删成员

```bash
# 添加成员
etcdctl member add infra3 --peer-urls=http://10.0.1.13:2380

# 在新节点启动 etcd，使用 --initial-cluster-state existing
etcd --name infra3 \
  --initial-cluster-state existing \
  --initial-cluster 'infra0=http://10.0.1.10:2380,infra1=http://10.0.1.11:2380,infra2=http://10.0.1.12:2380,infra3=http://10.0.1.13:2380' \
  ...

# 删除成员
etcdctl member remove <member-id>
```

注意：

- 一次只变更一个成员，避免 quorum 丢失。
- 删除成员前确认新集群仍有 quorum。
- 成员 ID 用 `member list` 查看。
- 不要同时添加多个成员。

## Learner

Learner 是非投票成员，先同步数据，再提升为正式成员：

```bash
etcdctl member add infra3 --peer-urls=http://10.0.1.13:2380 --learner
etcdctl member promote <member-id>
```

适合大集群扩容，减少新节点加入对 quorum 的影响。

## 迁移 leader

```bash
etcdctl move-leader <member-id>
```

用于维护、升级或平衡负载。

# 安全

## TLS

etcd 支持客户端到服务端、成员到成员的 TLS：

```bash
etcd \
  --cert-file=/etc/etcd/server.crt \
  --key-file=/etc/etcd/server.key \
  --trusted-ca-file=/etc/etcd/ca.crt \
  --client-cert-auth \
  --peer-cert-file=/etc/etcd/peer.crt \
  --peer-key-file=/etc/etcd/peer.key \
  --peer-trusted-ca-file=/etc/etcd/ca.crt \
  --peer-client-cert-auth \
  ...
```

| 参数 | 作用 |
| ---- | ---- |
| `--cert-file` / `--key-file` | 服务端证书/私钥 |
| `--trusted-ca-file` | 客户端证书 CA |
| `--client-cert-auth` | 强制客户端证书 |
| `--peer-cert-file` / `--peer-key-file` | 成员间 TLS |
| `--peer-trusted-ca-file` | peer CA |
| `--peer-client-cert-auth` | 强制成员间双向 TLS |

证书要求：

- 服务端证书：`serverAuth`。
- 客户端证书：`clientAuth`。
- peer 证书：同时包含 `serverAuth` 和 `clientAuth`。
- SAN 必须包含实际访问的 IP/DNS。

```bash
etcdctl --endpoints=https://10.0.0.10:2379 \
  --cacert=ca.crt --cert=client.crt --key=client.key \
  endpoint health
```

## RBAC

etcd v3 认证基于用户、角色、权限：

- 先创建 root 用户，授予 root 角色。
- 开启 auth 后，所有请求需要认证。
- 角色权限按 key/prefix 的 read/write/readwrite 授予。
- 支持按 revision 控制权限（高级用法）。

```bash
etcdctl user add root
etcdctl user grant-role root root
etcdctl auth enable

etcdctl role add app-reader
etcdctl role grant-permission app-reader read /app/ --prefix
etcdctl user add app
etcdctl user grant-role app app-reader
```

注意：

- 开启 auth 前务必确认 root 用户可用，否则可能锁死集群。
- 生产建议同时启用 TLS + client cert auth + RBAC。
- etcd 不加密磁盘上的 key/value；需要磁盘加密时使用 dm-crypt 或应用层加密。
- 不要把 etcd 暴露到公网，使用内网、防火墙、安全组。

# 运维与备份

## Compaction

etcd 保留历史 revision，长期不清理会导致存储膨胀：

```bash
etcdctl compact <revision>
```

自动压缩：

```bash
etcd --auto-compaction-mode=periodic --auto-compaction-retention=10h
etcd --auto-compaction-mode=revision --auto-compaction-retention=1000
```

建议：

- 频繁更新同一批 key：`1h`/`30m`。
- 更新不频繁：`24h`/`48h`/`72h`。
- 通用默认：`10h`。
- revision 模式适合明确知道 revision 增长速率的场景。

## Defrag

Compaction 只是逻辑删除，磁盘空间不会立即释放；需要 defrag：

```bash
etcdctl defrag
etcdctl defrag --cluster
```

注意：

- defrag 会阻塞该成员的读写，逐个成员执行，避免集群抖动。
- defrag 不会复制到其他成员，只作用于本地。
- 离线 defrag：`etcdutl defrag --data-dir <path>`（etcd 停止时）。

## 空间配额与 NOSPACE

`--quota-backend-bytes` 控制 backend 配额。超过配额会触发集群级 NOSPACE alarm，集群进入只读/只删模式。

处理步骤：

```bash
# 1. 删除不必要的数据
etcdctl del /old/prefix --prefix

# 2. compact 到最新 revision
rev=$(etcdctl get "" --prefix --keys-only -w=json | jq -r '.header.revision')
etcdctl compact "$rev"

# 3. 对每个成员 defrag
etcdctl defrag --cluster

# 4. 解除 alarm
etcdctl alarm list
etcdctl alarm disarm
```

生产建议：

- 显式设置配额，不要无限增长。
- 监控 `etcd_mvcc_db_total_size_in_bytes`、`etcd_mvcc_db_total_size_in_use_in_bytes`。
- 配额通常控制在 8 GiB 以内，结合 compaction/defrag。
- 不要用 etcd 存大对象。

## 快照备份

```bash
etcdctl snapshot save /backup/etcd-$(date +%F-%H%M).db
etcdutl snapshot status /backup/etcd-2026-10-23.db --write-out=table
```

建议：

- 每个 etcd 成员都可以备份，选择 Leader 或任一健康成员。
- 备份文件包含 key-value、revision 和集群元数据。
- 同时备份证书、配置、启动参数。
- 定期做恢复演练。
- 备份文件要加密、异地保存、设置保留策略。

## 恢复

把快照恢复到一个新的 data-dir，再启动新集群：

```bash
etcdutl snapshot restore /backup/etcd.db \
  --name infra0 \
  --data-dir /var/lib/etcd-restore \
  --initial-cluster infra0=http://10.0.1.10:2380 \
  --initial-cluster-token etcd-cluster-restore \
  --initial-advertise-peer-urls http://10.0.1.10:2380
```

然后：

1. 启动恢复后的节点。
2. 用 `member add` 加入其他节点，或按官方灾难恢复流程重建集群。
3. 验证 key、revision、endpoint health。
4. 更新客户端 endpoint/证书。

注意：

- 不要把快照恢复到正在运行的 data-dir。
- 恢复后是一个新集群，不要直接混入旧集群。
- 恢复前确认 etcd 版本兼容。
- 生产恢复要按官方 disaster recovery 文档执行。

## 升级

- 3.6 → 3.7 按官方 upgrade 文档滚动升级。
- 升级前备份快照。
- 一次升级一个成员，确认健康后再升级下一个。
- 检查 API/客户端兼容性、弃用参数、监控指标。
- 需要回滚时使用 `etcdctl downgrade enable <version>`，并按官方流程操作。

# 监控与调优

## 关键指标

| 指标 | 说明 |
| ---- | ---- |
| `etcd_server_has_leader` | 是否有 Leader |
| `etcd_server_leader_changes_seen_total` | Leader 切换次数 |
| `etcd_disk_wal_fsync_duration_seconds` | WAL fsync 延迟 |
| `etcd_disk_backend_commit_duration_seconds` | backend commit 延迟 |
| `etcd_mvcc_db_total_size_in_bytes` | DB 总大小（含碎片） |
| `etcd_mvcc_db_total_size_in_use_in_bytes` | 实际使用大小 |
| `etcd_server_slow_apply_total` | 慢 apply 次数 |
| `etcd_server_slow_read_indexes_total` | 慢 ReadIndex 次数 |
| `etcd_server_proposals_failed_total` | 提案失败 |
| `etcd_network_peer_round_trip_time_seconds` | peer RTT |
| `etcd_server_quota_backend_bytes` | 配额 |
| `etcd_alarm` | alarm 状态 |

告警重点：

- 无 Leader 持续 > 1 分钟。
- Leader 频繁切换。
- WAL fsync/backend commit 延迟超过阈值（如 p99 > 100ms）。
- DB 大小接近配额。
- NOSPACE/CORRUPT alarm。
- peer RTT 抖动、提案失败。

## 硬件建议

- SSD/NVMe，低 fsync 延迟。
- 专用磁盘，避免和日志/业务抢 IO。
- 2-4 核 CPU，8 GiB 内存起步；大规模按压测调整。
- 低延迟网络，成员尽量同机房/同区域。
- 不要用 NFS 作为 data-dir。
- 关注磁盘 IOPS、fsync 延迟、网络 RTT。

## 调优参数

| 参数 | 说明 |
| ---- | ---- |
| `--heartbeat-interval` | Leader 心跳间隔，默认 100ms |
| `--election-timeout` | 选举超时，默认 1000ms |
| `--snapshot-count` | 触发快照的已提交事务数 |
| `--max-request-bytes` | 单请求最大字节，默认约 1.5 MiB |
| `--max-txn-ops` | 单事务最大操作数 |
| `--quota-backend-bytes` | backend 配额 |
| `--auto-compaction-*` | 自动 compaction |
| `--grpc-keepalive-*` | gRPC keepalive |

调优原则：

- 高延迟网络可适当增大 heartbeat/election timeout，但会增加故障检测时间。
- 不要盲目调大 `max-request-bytes`，大 Value 会放大复制和内存压力。
- 写吞吐受 fsync 限制，优先提升磁盘性能。
- 读多写少可以增加 serializable read，但要注意 stale 风险。

# Kubernetes 中的 etcd

Kubernetes 使用 etcd 存储集群状态：

- `kube-apiserver` 是 etcd 的主要客户端。
- etcd 通常以 static pod 或外部集群方式部署。
- 控制面节点需要低延迟、可靠磁盘。
- etcd 故障会导致 API Server 无法读写集群状态。

实践：

- 使用独立磁盘，避免和容器日志/镜像存储争 IO。
- 3 或 5 个控制面节点，etcd 成员与控制面同机部署时注意资源隔离。
- 开启 TLS 和 client cert auth。
- 定期快照备份，并验证恢复。
- 监控 WAL fsync、backend commit、DB size、Leader 变化。
- 升级 Kubernetes 前确认 etcd 版本兼容矩阵。
- 不要把业务数据写入 etcd。

备份示例（kubeadm 环境通常有证书路径）：

```bash
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /backup/etcd-snapshot.db
```

# 典型应用场景

## 服务注册与发现

- 服务启动时写入 `/services/<name>/<instance>`，并绑定 lease。
- 定期 keepalive 续约。
- 客户端 watch 前缀，实时感知实例上下线。
- 实例故障后 lease 过期，key 自动删除。

## 配置中心

- 配置写入 `/config/<app>/<env>`。
- 客户端 watch 配置变化。
- 利用 revision 做配置版本和回滚。
- 大配置不要放 etcd，放大对象存储并只存引用。

## 分布式锁

- 利用 lease + txn 实现互斥锁。
- 利用 create_revision 实现公平锁/队列。
- 官方 clientv3 提供 `concurrency` 包。

## Leader 选举

- 候选人创建带 lease 的 key，比较 create_revision，最小者成为 Leader。
- Leader 定期续约；失败后 lease 过期，重新选举。
- Kubernetes controller、Operator 常用类似模式。

## 分布式队列

- 用有序 key + watch 实现 FIFO 队列。
- 注意 etcd 不是高吞吐消息队列，适合控制面任务，不适合业务消息流。

# etcd 与 ZooKeeper Consul

| 维度 | etcd | ZooKeeper | Consul |
| ---- | ---- | --------- | ------ |
| 一致性 | Raft | ZAB | Raft |
| API | gRPC/HTTP/JSON | 自定义协议 | HTTP/DNS |
| 数据模型 | 扁平 KV + revision | ZNode 树 | KV + 服务目录 |
| Watch | 原生 watch | Watch | blocking query |
| 租约 | Lease | Ephemeral node | Session/health check |
| 服务发现 | 需自行实现 | 需自行实现 | 内置 |
| 典型场景 | Kubernetes、配置、选主 | Hadoop/HBase、ZK 生态 | 多数据中心服务发现 |
| 运维复杂度 | 较低 | 中等 | 中等 |

选型建议：

- Kubernetes 生态、Go 技术栈、需要简单强一致 KV：etcd。
- 已有 ZooKeeper 生态、需要 ZNode 语义：ZooKeeper。
- 需要内置服务发现、健康检查、多数据中心：Consul。

# 深入 Raft 与一致性

## Raft 状态机

每个 etcd member 内部都有一个 Raft 状态机：

| 状态 | 说明 |
| ---- | ---- |
| Follower | 被动接收 Leader 日志和心跳 |
| PreCandidate | Pre-Vote 阶段，先试探能否获得多数派支持 |
| Candidate | 发起正式选举 |
| Leader | 处理写请求、复制日志、发送心跳 |

关键变量：

- **term**：任期，单调递增；每个 term 最多一个 Leader。
- **index**：日志条目编号，单调递增。
- **commitIndex**：已知被多数派持久化的最大 index。
- **appliedIndex**：已经 apply 到状态机的最大 index。
- **lastLogIndex / lastLogTerm**：用于选举和日志一致性检查。

Raft 的安全性不依赖时钟同步。时钟只影响选举超时、心跳和 lease 过期，因此 NTP 仍然重要，但时钟跳变不会让 Raft 选出两个 Leader。

## Leader 选举

1. Follower 在 election timeout 内没收到 Leader 心跳，转为 Candidate。
2. term + 1，投票给自己，向其他成员发送 RequestVote。
3. 获得多数派投票的 Candidate 成为 Leader。
4. Leader 定期发送心跳（AppendEntries）维持权威。
5. 其他成员收到合法 Leader 心跳后重置 election timeout。

etcd 默认开启 **Pre-Vote**：分区恢复的节点先进行预投票，避免带着更高 term 强行打断健康集群。Leader 还会通过 check-quorum 检查是否还能联系多数派，失去多数派时主动 step down，减少脑裂窗口。

时间参数：

- `--heartbeat-interval`：Leader 心跳间隔，默认 100ms。
- `--election-timeout`：选举超时，默认 1000ms。
- 选举超时会加入随机抖动，降低同时竞选的概率。
- 高延迟网络可以适当调大，但会增加故障检测和切换时间。

## 日志复制

写请求的复制过程：

```text
Client -> Leader
Leader 追加 log entry 到本地 WAL
Leader 并行发送 AppendEntries 给 Followers
Follower 检查 prevLogIndex/prevLogTerm，追加并持久化
多数派持久化后，Leader 推进 commitIndex
Leader apply 到 MVCC，返回客户端
Follower 在后续心跳中获知 commitIndex，apply
```

关键点：

- Leader 必须先持久化自己的日志，再向 Follower 复制。
- Follower 日志冲突时，会截断冲突后缀，以 Leader 为准。
- commit 需要多数派持久化，不是多数派“收到”。
- apply 是确定性的状态机操作；etcd 的 apply 主要是写 backend、更新 treeIndex、通知 watcher。
- 慢 Follower 可能落后很多；Leader 会发送 snapshot 让它追上。
- `--snapshot-count` 控制触发快照的已提交 entry 数；太小会频繁快照，太大则 WAL/内存增长。
- `--max-wals`、`--max-snapshots` 控制 WAL/快照保留数量。

## ReadIndex 与线性一致读

etcd 默认的线性一致读不是简单“读 Leader 内存”，而是：

1. 客户端请求到达 Leader（或 Follower 转发）。
2. Leader 通过心跳/ReadIndex 确认自己仍是多数派认可的 Leader。
3. 等待 appliedIndex 追上 read index。
4. 从 MVCC 读取该 revision 的数据。

这样可以避免读到尚未 apply 的旧状态。代价是需要 quorum 确认，延迟高于本地读。

`serializable=true` 则直接从本地 member 读取，不经过 quorum：

- 延迟低、可用性好。
- 可能读到旧数据。
- 适合配置展示、监控、可容忍 stale 的读。

## 成员变更与 quorum

etcd 的成员变更一次只允许一个：

- 先 `member add`，新成员以 Learner 或普通成员加入。
- 新成员追日志/快照。
- 确认健康后，再移除旧成员。
- 同时变更多个成员可能破坏 quorum。

Learner：

- 不参与投票，不增加 quorum。
- 先同步数据，避免新成员加入时拖慢集群。
- 追上后 `member promote` 转为正式成员。

## 失败语义

| 场景 | 行为 |
| ---- | ---- |
| Leader 故障 | 剩余多数派在 election timeout 后选出新 Leader；客户端短暂失败后重试 |
| 少数派分区 | 少数派无法 commit 写；多数派继续服务 |
| 多数派丢失 | 集群不可写；线性一致读也失败；需要恢复 quorum 或从快照恢复 |
| 慢 Follower | Leader 保留日志/发送 snapshot；可能增加网络和磁盘压力 |
| 旧 Leader 恢复 | check-quorum/Pre-Vote 使其 step down，避免双 Leader |
| 时钟跳变 | 不影响 Raft 安全性，但可能影响 lease/keepalive 过期判断 |

# 深入 MVCC 与存储

## bbolt 与 treeIndex

etcd 的持久化后端是 bbolt（B+ 树、单写者、mmap）：

- `key` bucket：保存 key 的历史 revision 和 value。
- `meta` bucket：保存 term、revision、cluster 元数据等。
- `lease` bucket：lease 元数据。
- `auth` bucket：用户、角色、权限。
- `alarm` bucket：alarm 状态。
- `members`/`cluster` 等：集群成员信息。

内存中的 **treeIndex** 把用户 key 映射到 revision 列表：

```text
/app/config -> keyIndex
  generations:
    - created: 10, revisions: [10, 12, 15]
    - created: 20, revisions: [20]   # 删除后重新创建
```

- `create_revision`、`mod_revision`、`version` 都来自这里。
- Range 查询先在 treeIndex 找到目标 revision，再读 backend。
- 重启时 treeIndex 会从 backend 重建。

## 写路径

```text
gRPC Put
  -> 认证/权限
  -> quota 检查
  -> Raft 提案
  -> WAL fsync
  -> 多数派复制
  -> apply
  -> backend batch 写入
  -> treeIndex 更新
  -> watcher 通知
  -> 返回 response
```

注意：

- WAL fsync 是写延迟的主要来源。
- backend 写入是批量的，但仍然是单写者。
- apply 是串行的；慢 apply 会拖慢整个节点。
- 大 value 会放大 WAL、网络、backend 和 snapshot 成本。

## 读路径

```text
gRPC Range
  -> 认证/权限
  -> 线性一致读：ReadIndex/quorum 确认
  -> treeIndex 查找 revision
  -> backend 读取 KeyValue
  -> 返回
```

- 历史读 `--rev=N` 走 treeIndex + backend。
- 如果 revision 已被 compaction，返回 `ErrCompacted`。
- `serializable` 跳过 quorum 确认，直接本地读。
- `keys_only`/`count_only` 减少数据传输。

## Compaction

MVCC 保留历史 revision，写入越多，历史越多：

- `compact(rev)` 删除 <= rev 的历史版本。
- compaction 后，旧 revision 不可读，旧 watcher 会被取消。
- 只做 compaction 不会立即释放磁盘空间，只会释放 backend 内部空间。
- 自动 compaction：
  - periodic：按时间保留，如 `--auto-compaction-retention=10h`。
  - revision：按 revision 数保留，如 `--auto-compaction-retention=1000`。

compaction 的影响：

- watcher 的 `start_revision` 小于 compact revision 时会收到 `CompactRevision`，需要全量重新同步。
- 备份/恢复后 revision 仍然保留，便于客户端继续 watch（在保留窗口内）。

## Defrag

bbolt 删除数据后会产生空闲页，但文件不会自动缩小：

- `etcdctl defrag` 重建 backend，释放磁盘空间。
- defrag 会阻塞该成员的读写，必须逐个成员执行。
- defrag 不会复制到其他成员，只作用于本地。
- etcd 停止时可以用 `etcdutl defrag --data-dir <path>`。
- 建议先 compaction，再 defrag。

选择 defrag 时机：

- 低峰期。
- 一次一个成员，优先 Follower，最后 Leader。
- 确认其他成员健康、quorum 稳定。
- 预留足够磁盘空间（重建期间可能临时占用更多空间）。

## Quota 与 NOSPACE

`--quota-backend-bytes` 限制 backend 大小。超过配额：

- 触发集群级 NOSPACE alarm。
- 集群进入维护模式，只接受读和删除。
- 写入返回 `etcdserver: mvcc: database space exceeded`。

处理顺序必须是：

```text
删除数据 -> compaction -> defrag -> alarm disarm
```

只删除数据不 compact/defrag，空间不会真正释放。

关键指标：

- `etcd_mvcc_db_total_size_in_bytes`：backend 总大小（含空闲页）。
- `etcd_mvcc_db_total_size_in_use_in_bytes`：实际使用大小。
- 两者差距大，说明需要 defrag。
- 接近 quota 时提前告警。

## Snapshot 与 WAL

- WAL 保存未快照的 Raft entry；重启时 replay。
- Snapshot 保存某一 index 的完整状态，减少 WAL replay 时间。
- 默认保留多个 WAL/snapshot，供慢 Follower 追赶。
- `etcdctl snapshot save` 通过 backend 一致性读生成快照。
- `etcdutl snapshot status` 查看 revision、key 数、大小、hash。
- Snapshot 是恢复的基线，不是实时备份的替代；需要定期执行。

## 数据损坏

可能出现：

- `CORRUPT` alarm。
- backend 文件损坏。
- WAL 损坏。
- 磁盘满导致写入失败。

处理：

1. 停止写入，保留现场。
2. 检查 `alarm list`、日志、磁盘。
3. 从最近的 snapshot 恢复到一个新集群。
4. 如果只是单个 Follower 损坏，可以删除该成员数据目录并重新加入（先确认 quorum 安全）。
5. 不要手工修改 bbolt/WAL 文件。

# 深入 Watch 与 Lease

## Watch 的内部模型

etcd 的 watchable store 维护：

- **synced watcher**：已经追到当前 revision，事件从内存事件队列发送。
- **unsynced watcher**：落后于当前 revision，需要从 backend 读取历史事件追赶。
- **minRev**：watch 需要的最小 revision。
- 慢 watcher 可能被取消，避免拖垮服务端。

Watch 事件包含：

- `type`：PUT/DELETE。
- `kv`：KeyValue。
- `prev_kv`：如果请求了 `prev_kv`。

`progress_notify` 用于长时间没有事件时发送进度，帮助客户端确认 watch 仍然健康。

## Watch 断线重连

客户端必须处理：

- 连接断开。
- `wresp.Canceled`。
- `wresp.CompactRevision` 非 0。
- revision 落后于 compaction。

推荐逻辑：

```text
lastRev = 上次处理完的 revision
循环:
  watch(start_revision = lastRev + 1)
  收到事件:
    处理事件
    lastRev = event.mod_revision
  如果 canceled:
    如果 compact_revision > 0:
      全量 Get --prefix 当前状态
      lastRev = header.revision
    否则:
      退避后重连
```

不要只依赖 watch 的实时性；关键状态要支持全量重建。

## Lease 的内部模型

Lease 由 lessor 管理：

- Leader 负责 lease grant/keepalive/revoke。
- lease 有 TTL 和到期队列。
- 客户端定期 keepalive，重置 TTL。
- lease 过期或 revoke 时，所有绑定 key 被删除，并产生 DELETE 事件。
- lease 的 checkpoint 会持久化，避免 Leader 切换后丢失全部 lease。

实践：

- keepalive 间隔应小于 TTL，通常 TTL/3。
- keepalive channel 关闭时，重新 grant + 重新绑定 key。
- 不要为每个请求创建 lease。
- 服务注册使用 lease + prefix watch。
- 分布式锁使用 lease + txn，防止锁持有者崩溃后死锁。

```bash
etcdctl lease grant 30
etcdctl put /service/a 10.0.0.1:8080 --lease=<lease-id>
etcdctl lease keep-alive <lease-id>
etcdctl lease timetolive <lease-id> --keys
```

# 深入集群变更与故障

## 成员变更原则

- 一次只加/删一个成员。
- 变更前确认集群健康、quorum 稳定。
- 新成员优先用 Learner 追数据，再 promote。
- 删除成员前确认剩余成员仍满足 quorum。
- 变更期间监控 Leader、WAL、RTT、apply 延迟。
- 不要手工修改成员列表或 `initial-cluster`。

## 成员替换

```bash
# 1. 添加新成员/learner
etcdctl member add infra4 --peer-urls=http://10.0.1.14:2380 --learner

# 2. 在新节点启动 etcd
etcd --name infra4 --initial-cluster-state existing ...

# 3. 等待追上后提升
etcdctl member promote <member-id>

# 4. 移除旧成员
etcdctl member remove <old-member-id>
```

## 网络分区

- 多数派一侧继续选举和写入。
- 少数派一侧无法 commit；线性一致读失败，serializable 读可能返回旧数据。
- 分区恢复后，旧 Leader/Follower 通过 term/日志一致性回到集群。
- 不要因为少数派“还能读”就认为集群健康。

## Quorum 丢失

现象：

- 写入超时/失败。
- 线性一致读失败。
- `endpoint health` 可能显示不健康。
- Leader 频繁变化或没有 Leader。

处理：

1. 确认是网络、磁盘还是进程故障。
2. 尽量恢复多数派成员。
3. 如果无法恢复，使用最新 snapshot 恢复新集群。
4. 不要强行让少数派继续写入，否则可能造成数据分叉。

## 灾难恢复

流程：

1. 找到最新、可用的 snapshot。
2. `etcdutl snapshot status` 校验 revision/key 数。
3. 恢复到新的 data-dir。
4. 用新的 `initial-cluster-token` 启动新集群。
5. 逐个加入其他成员。
6. 验证 key、revision、健康状态。
7. 切换客户端/DNS。
8. 隔离旧集群，避免双写。

注意：

- 恢复出来的集群 revision 可能落后，客户端需要重新同步。
- `--skip-hash-check` 只在明确知道快照完整、但 hash 校验失败时使用。
- 恢复前备份当前现场，保留日志。

## 升级与降级

升级：

- 备份 snapshot。
- 阅读 3.6 → 3.7 升级文档。
- 一次升级一个成员，先 Follower 后 Leader。
- 检查 API、客户端、监控、弃用参数。
- 观察 Leader 稳定、WAL/apply 延迟、错误率。

降级：

```bash
etcdctl downgrade enable 3.6
# 滚动降级
etcdctl downgrade cancel
```

降级窗口和限制以官方文档为准，不要长期停留在降级状态。

# 深入性能与容量

## 瓶颈在哪里

| 资源 | 影响 |
| ---- | ---- |
| 磁盘 fsync | WAL 写入延迟，直接影响写吞吐和 Leader 稳定性 |
| 磁盘 IOPS | backend commit、compaction、defrag |
| 网络 RTT | Raft 复制、ReadIndex、Leader 选举 |
| CPU | TLS、序列化、watch、压缩 |
| 内存 | treeIndex、bbolt cache、watch 队列、lease |
| 磁盘容量 | WAL、snapshot、backend、quota |

etcd 对磁盘延迟非常敏感。WAL fsync 从 1ms 上升到 100ms，写性能和 Leader 稳定性都会明显下降。

## 容量估算

粗略考虑：

```text
backend 大小 ≈ key/value 总量 + 历史 revision + 索引 + 空闲页
内存 ≈ treeIndex + bbolt cache + watch/lease 状态 + Go runtime
WAL ≈ 未快照的 Raft entry
```

影响因素：

- key 数量。
- value 大小。
- 写入频率和 revision 增长速度。
- compaction 保留窗口。
- watcher 数量。
- lease 数量。
- 集群成员数和复制流量。

实践：

- 单 value 控制在 KiB 级，不要存 MB 级对象。
- 单集群 backend 建议控制在 8 GiB 以内。
- 高频更新 key 要缩短 compaction 窗口。
- 大量 watch 会增加内存和 CPU。
- 用 `etcdctl check datascale` 估算。
- 用 `etcdctl check perf` 做基础性能检查。

## 调优

```bash
etcd \
  --heartbeat-interval=100 \
  --election-timeout=1000 \
  --snapshot-count=100000 \
  --max-request-bytes=1572864 \
  --max-txn-ops=128 \
  --quota-backend-bytes=8589934592 \
  --auto-compaction-mode=periodic \
  --auto-compaction-retention=10h
```

原则：

- 先解决磁盘，再调参数。
- 不要把 `max-request-bytes` 调得过大。
- 不要盲目增加成员数；成员越多，写放大和 RTT 影响越大。
- 读多写少可以用 serializable 读，但要接受 stale。
- 监控 p99 而非平均值。

# 深入安全模型

## TLS 分层

etcd 有两种 TLS：

- **client-to-server**：客户端到 etcd 2379。
- **peer-to-peer**：成员之间 2380。

推荐全部启用，并开启双向认证：

```bash
--cert-file=server.crt --key-file=server.key \
--trusted-ca-file=ca.crt --client-cert-auth \
--peer-cert-file=peer.crt --peer-key-file=peer.key \
--peer-trusted-ca-file=ca.crt --peer-client-cert-auth
```

证书要求：

| 角色 | keyUsage | extendedKeyUsage |
| ---- | -------- | ---------------- |
| 服务端 | digitalSignature, keyEncipherment | serverAuth |
| 客户端 | digitalSignature, keyEncipherment | clientAuth |
| peer | digitalSignature, keyEncipherment | serverAuth + clientAuth |

- SAN 必须包含实际访问的 IP/DNS。
- 客户端证书用于认证，不是可选的“加密开关”。
- 证书轮换要提前规划，避免过期导致集群失联。

## RBAC 内部模型

- 认证信息存储在 auth store，带有 auth revision。
- 用户、角色、权限变更会推进 auth revision。
- root 用户拥有全部权限。
- 角色权限可以按 key/range 授予 read/write/readwrite。
- 权限检查在请求进入 Raft 之前完成。

开启顺序：

```bash
etcdctl user add root
etcdctl user grant-role root root
etcdctl auth enable
```

常见错误：

- 没有先创建 root 用户就 enable auth，导致无法管理。
- 只给应用 read 权限，却让它 watch 并写入状态 key。
- 证书 CN/SAN 不匹配，客户端报 `x509: certificate is valid for ...`。
- peer 证书缺少 clientAuth，开启 peer-client-cert-auth 后成员无法通信。

## 威胁模型

- 能访问 etcd 的客户端可以读取其权限范围内的所有 key。
- etcd 不加密磁盘数据；磁盘泄露等于数据泄露。
- etcd 没有内置细粒度审计/限流；需要网关、网络策略、日志。
- Docker/Kubernetes 中挂载 etcd 证书的 Pod 需要严格 RBAC。
- 不要把 etcd 暴露到公网，不要用自签名证书跳过校验。

# 客户端开发实践

## 初始化 clientv3

```go
import (
    "context"
    "crypto/tls"
    "log"
    "time"

    clientv3 "go.etcd.io/etcd/client/v3"
)

cli, err := clientv3.New(clientv3.Config{
    Endpoints:   []string{"https://10.0.0.10:2379"},
    DialTimeout: 5 * time.Second,
    TLS:         tlsConfig, // 根 CA、客户端证书
})
if err != nil {
    log.Fatal(err)
}
defer cli.Close()
```

原则：

- 客户端复用，不要每个请求新建。
- Endpoints 配置多个成员，clientv3 会自动负载均衡/重连。
- 设置 DialTimeout 和请求 Context 超时。
- 生产必须配置 TLS；不要让 `InsecureSkipVerify` 进入生产。

## KV 与 Watch

```go
ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
defer cancel()

_, err = cli.Put(ctx, "/app/config", `{"timeout":10}`)
resp, err := cli.Get(ctx, "/app/", clientv3.WithPrefix(), clientv3.WithLimit(100))

watchCtx, cancelWatch := context.WithCancel(context.Background())
defer cancelWatch()

wch := cli.Watch(watchCtx, "/app/",
    clientv3.WithPrefix(),
    clientv3.WithRev(resp.Header.Revision+1),
    clientv3.WithProgressNotify(),
)

for wresp := range wch {
    if wresp.Canceled {
        // CompactRevision > 0 表示历史被压缩，需要全量重建
        break
    }
    for _, ev := range wresp.Events {
        log.Printf("%s %s %s", ev.Type, ev.Kv.Key, ev.Kv.Value)
    }
}
```

## Lease

```go
lease, err := cli.Grant(ctx, 30)
_, err = cli.Put(ctx, "/service/a", "10.0.0.1:8080", clientv3.WithLease(lease.ID))

keepAlive, err := cli.KeepAlive(context.Background(), lease.ID)
for resp := range keepAlive {
    if resp == nil {
        // keepalive 通道关闭，需要重新 grant 并绑定 key
        break
    }
}
```

## 事务与分布式锁

CAS：

```go
txn, err := cli.Txn(ctx).
    If(clientv3.Compare(clientv3.Version("/lock"), "=", 0)).
    Then(clientv3.OpPut("/lock", "owner-a", clientv3.WithLease(lease.ID))).
    Commit()

if !txn.Succeeded {
    // 锁已被占用
}
```

使用官方 concurrency 包：

```go
session, _ := concurrency.NewSession(cli, concurrency.WithTTL(10))
defer session.Close()

mutex := concurrency.NewMutex(session, "/lock")
if err := mutex.Lock(ctx); err != nil {
    return err
}
defer mutex.Unlock(ctx)
```

Leader 选举：

```go
election := concurrency.NewElection(session, "/election")
if err := election.Campaign(ctx, "node-1"); err != nil {
    return err
}
defer election.Resign(ctx)
```

## 错误与重试

常见错误：

| 错误 | 含义 | 处理 |
| ---- | ---- | ---- |
| `ErrCompacted` | revision 已被压缩 | 全量重新同步，不要盲目重试 |
| `ErrFutureRev` | 请求 revision 大于当前 | 等待/重试 |
| `ErrNoLeader` | 没有 Leader | 退避重试 |
| `ErrTimeout` | 请求超时 | 退避重试 |
| `ErrLeaderChanged` | Leader 变化 | 重试 |
| `ErrPermissionDenied` | RBAC 拒绝 | 修正权限 |
| `ErrRequestTooLarge` | 请求过大 | 减小 value/拆分 |
| `ErrTooManyOps` | 事务操作过多 | 拆分事务 |

```go
if errors.Is(err, rpctypes.ErrCompacted) {
    // 重新 Get 最新状态，再基于新 revision watch
}
```

## 读一致性选择

```go
// 默认线性一致读
resp, err := cli.Get(ctx, key)

// 串行化本地读，可能 stale
resp, err := cli.Get(ctx, key, clientv3.WithSerializable())

// 需要 Leader 时明确失败，而不是读到旧数据
ctx = clientv3.WithRequireLeader(ctx)
```

# 运维深水区

## Compaction 与 Defrag 的标准流程

```bash
# 1. 查当前 revision
rev=$(etcdctl get "" --prefix --keys-only -w=json | jq -r '.header.revision')

# 2. 压缩
etcdctl compact "$rev"

# 3. 查看空间
etcdctl endpoint status --cluster --write-out=table

# 4. 逐个成员 defrag
etcdctl defrag --endpoints=https://10.0.0.10:2379
etcdctl defrag --endpoints=https://10.0.0.11:2379
etcdctl defrag --endpoints=https://10.0.0.12:2379
```

注意：

- defrag 会阻塞当前成员读写。
- 不要同时 defrag 所有成员。
- 先 Follower，最后 Leader。
- 预留磁盘空间。

## NOSPACE 处理

```bash
etcdctl alarm list
etcdctl del /old/prefix --prefix
etcdctl compact <rev>
etcdctl defrag --cluster
etcdctl alarm disarm
```

如果 `alarm disarm` 后仍然报错，检查是否所有成员都完成了 compaction/defrag。

## Snapshot 与 HashKV

```bash
etcdctl snapshot save /backup/etcd.db
etcdutl snapshot status /backup/etcd.db --write-out=table
etcdctl endpoint hashkv --cluster
```

`hashkv` 比较各成员的 KV 历史 hash，用于发现数据不一致。hash 不一致时：

- 检查是否有成员落后。
- 检查是否刚刚 compaction/defrag。
- 必要时从健康成员重建问题成员。

## 成员替换与磁盘故障

单成员数据损坏：

1. 确认其他成员仍有 quorum。
2. 停止问题成员。
3. 清理其 data-dir（确认不再需要）。
4. 用 `member add` 重新加入，或用已有成员 snapshot 恢复。
5. 等待追上，检查 health/hashkv。

多数派损坏：按灾难恢复流程从 snapshot 重建新集群。

## 监控告警

建议告警：

- `etcd_server_has_leader == 0` 持续 1 分钟。
- Leader 切换次数异常增长。
- WAL fsync p99 超过 100ms。
- backend commit p99 超过 100ms。
- DB 大小超过 quota 的 80%。
- NOSPACE/CORRUPT alarm。
- peer RTT 异常。
- 提案失败/慢 apply 持续增长。

# Kubernetes etcd 深水区

## 静态 Pod 结构

kubeadm 集群中，etcd 通常是 static pod：

```text
/etc/kubernetes/manifests/etcd.yaml
/etc/kubernetes/pki/etcd/ca.crt
/etc/kubernetes/pki/etcd/server.crt
/etc/kubernetes/pki/etcd/server.key
/var/lib/etcd
```

kube-apiserver 通过 `--etcd-servers=https://127.0.0.1:2379` 访问本地 etcd，并使用证书认证。

## 备份

```bash
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /backup/etcd-$(date +%F-%H%M).db
```

同时备份：

- etcd 证书。
- kube-apiserver 配置。
- kubeadm-config。
- 集群版本信息。

## 恢复注意

- 恢复 etcd 会影响整个集群，必须按 Kubernetes 官方灾难恢复流程。
- 恢复后 API Server 需要重新连接。
- 不要在生产直接覆盖正在运行的 etcd data-dir。
- 恢复前隔离旧集群，避免双写。
- 恢复后检查 Node、Pod、CRD、RBAC 是否完整。

## 性能与磁盘

- etcd 的 WAL fsync 延迟会直接放大到 kube-apiserver 请求延迟。
- 控制面节点使用低延迟 SSD，避免和容器日志/镜像存储共享磁盘。
- 监控 `etcd_disk_wal_fsync_duration_seconds`、`etcd_disk_backend_commit_duration_seconds`。
- 控制面节点数量 3 或 5，etcd 成员数与控制面节点数一致时要注意资源隔离。
- 大规模集群关注 apiserver QPS、watch 数量、etcd DB 大小。
- 升级 Kubernetes 前检查 etcd 版本兼容矩阵。

# 故障案例

## 案例一：Leader 频繁切换

现象：

- `etcd_server_leader_changes_seen_total` 持续增长。
- 客户端间歇性 `leader changed`。
- apiserver 偶发 5xx。

排查：

- WAL fsync 是否抖动。
- 网络 RTT 是否抖动/丢包。
- CPU 是否被其他进程抢占。
- 是否有成员频繁重启。
- 是否跨机房部署导致 RTT 过高。

处理：

- 换本地 SSD。
- 调整 heartbeat/election timeout。
- 修复网络。
- 隔离高负载进程。

## 案例二：NOSPACE

现象：

- 写入报 `database space exceeded`。
- `etcdctl alarm list` 显示 NOSPACE。

处理：

```bash
etcdctl del /old/prefix --prefix
etcdctl compact <rev>
etcdctl defrag --cluster
etcdctl alarm disarm
```

复盘：

- 是否缺少自动 compaction。
- 是否存了大 value/高频 revision。
- 是否没有 quota/空间告警。

## 案例三：慢磁盘导致 apply 落后

现象：

- `etcd_server_slow_apply_total` 增长。
- 写入延迟高。
- Follower 落后，Leader 频繁发 snapshot。

处理：

- 检查磁盘 IOPS/fsync 延迟。
- 迁移到独立 SSD。
- 降低写入频率/大 value。
- 调整 snapshot/WAL 保留参数。

## 案例四：Quorum 丢失

现象：

- 无 Leader。
- 写入和线性一致读失败。
- 少数派节点仍能启动，但无法形成多数派。

处理：

- 恢复多数派节点。
- 无法恢复时，用最新 snapshot 重建新集群。
- 不要强行让少数派继续写入。

## 案例五：Kubernetes API 超时

现象：

- `kubectl` 超时、apiserver 5xx。
- etcd 健康检查失败或延迟高。
- 控制面日志出现 etcd timeout。

排查：

- etcd WAL fsync/backend commit。
- 控制面磁盘是否被打满。
- etcd DB 是否接近 quota。
- 是否有大量 watch/大对象。
- 网络/证书是否正常。

处理：

- 恢复磁盘性能。
- compaction/defrag。
- 扩容控制面/etcd。
- 修复异常客户端。

# 常见问题

**Q：etcd 集群为什么推荐奇数节点？**

A：quorum 需要多数派。3 节点容忍 1 个故障，4 节点也只能容忍 1 个；偶数节点增加成本但不增加容错，还增加复制延迟。

**Q：etcd 能存多大的数据？**

A：不适合大 Value。默认单请求约 1.5 MiB，生产建议控制 key/value 大小，总数据量控制在几 GiB 以内，并配合 compaction/defrag。大对象放对象存储。

**Q：compaction 和 defrag 有什么区别？**

A：compaction 删除历史 revision，逻辑释放；defrag 重写 backend，物理回收磁盘空间。先 compaction，再 defrag。

**Q：为什么删除 key 后磁盘没变小？**

A：删除只是写 tombstone，compaction 后才释放逻辑历史，defrag 才回收物理空间。

**Q：NOSPACE alarm 怎么处理？**

A：删除数据 → compaction → defrag → `alarm disarm`。不要只删数据不 compact/defrag。

**Q：etcd 会加密磁盘数据吗？**

A：不会。TLS 只保护传输；磁盘加密需要 dm-crypt、云盘加密或应用层加密。

**Q：可以只备份一个节点吗？**

A：可以，etcd 快照包含完整 keyspace。选择健康成员备份，并定期验证恢复。生产建议多副本备份、异地保存。

**Q：恢复快照后能直接加入旧集群吗？**

A：不能。恢复出来的是一个新集群，必须按灾难恢复流程重建，避免 revision/成员信息冲突。

**Q：Kubernetes 的 etcd 怎么备份？**

A：使用控制面证书调用 `etcdctl snapshot save`，备份文件 + 证书 + 配置，定期做恢复演练。

**Q：v2 API 还能用吗？**

A：v2 已弃用，新系统使用 v3 API。`etcdctl` 默认 v3；不要在新项目依赖 v2。

# 参考资料

- [etcd 官方文档](https://etcd.io/docs/)
- [etcd API](https://etcd.io/docs/latest/learning/api/)
- [Interacting with etcd](https://etcd.io/docs/latest/dev-guide/interacting_v3/)
- [Configuration](https://etcd.io/docs/latest/op-guide/configuration/)
- [Clustering Guide](https://etcd.io/docs/latest/op-guide/clustering/)
- [Maintenance](https://etcd.io/docs/latest/op-guide/maintenance/)
- [Disaster Recovery](https://etcd.io/docs/latest/op-guide/recovery/)
- [Transport Security](https://etcd.io/docs/latest/op-guide/security/)
- [Monitoring](https://etcd.io/docs/latest/op-guide/monitoring/)
- [Hardware Recommendations](https://etcd.io/docs/latest/op-guide/hardware/)
- [Upgrading](https://etcd.io/docs/latest/upgrades/)
- [etcd vs other KV stores](https://etcd.io/docs/latest/learning/why/)

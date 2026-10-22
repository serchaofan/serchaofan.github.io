---
title: Istio
tags: [Istio, Service Mesh, Kubernetes, 云原生]
categories: [服务网格]
date: 2020-04-05 19:09:24
comments: false
---

本文基于 **Istio 1.31.3**（2026-10）官方文档重写，重点讲清原理，再落到安装、流量、安全、可观测性和企业实践。旧笔记写于 Istio 1.9，只覆盖了 Service Mesh 概念和少量组件；1.31 的变化较大：Mixer 早已移除，控制面统一为 istiod，配置 API 以 `v1` 为主，数据面除了 Envoy Sidecar 还有 Ambient 模式（ztunnel + waypoint），入口治理推荐 Gateway API。

1.31.0 于 2026-08-31 发布，官方支持 Kubernetes 1.32–1.36。1.31 值得注意的变化包括：Ambient 的 Address 变更只推送给受影响的 waypoint（`AMBIENT_SCOPED_ADDRESS_PUSHES`）、waypoint 加权金丝雀、`ServiceEntry` 可见性控制、AuthorizationPolicy 支持按信任域匹配、FIPS 140-3 合规策略，以及默认发送不健康 Endpoint 的行为变化。

最后更新：2026-10-23

<!--more-->

- [版本与范围](#版本与范围)
- [Service Mesh 与 Istio](#Service-Mesh-与-Istio)
- [核心架构](#核心架构)
- [安装与接入](#安装与接入)
- [流量管理](#流量管理)
- [多集群与多网络](#多集群与多网络)
- [安全](#安全)
- [可观测性](#可观测性)
- [企业实践](#企业实践)
- [升级与故障学](#升级与故障学)
- [排障](#排障)
- [最佳实践清单](#最佳实践清单)
- [附录](#附录)

# 版本与范围

- 版本基线：Istio 1.31.3；Kubernetes 1.32–1.36
- 配置 API：`networking.istio.io/v1`、`security.istio.io/v1`、`telemetry.istio.io/v1`
- 数据面：Sidecar 与 Ambient 两种模式，可在同一网格中共存
- 本文重点：架构原理、流量与安全的实现机制、可观测性，以及企业落地时的升级、隔离、容量和排障

阅读前需要了解 Kubernetes 的 Pod、Service、Deployment、Ingress、CRD 和 NetworkPolicy。

# Service Mesh 与 Istio

服务网格是处理服务间通信的基础设施层，把服务发现、负载均衡、重试、熔断、mTLS、遥测和访问控制从应用代码里下沉到代理层。

它解决的核心问题是：微服务之间的通信逻辑散落在各个语言、各个框架里，协议不一致、可观测性不统一、安全策略难以统一落地。把这些能力抽到代理层之后，应用只负责业务，通信治理由基础设施统一完成。

Istio 提供的能力：

- 流量管理：路由、灰度、重试、超时、熔断、故障注入、流量镜像
- 安全：工作负载身份、自动 mTLS、JWT 认证、细粒度授权
- 可观测性：统一指标、访问日志、分布式追踪
- 策略与扩展：限流、Wasm 插件、外部授权

Istio 不负责的事情：

- 不能替代应用自身的幂等、事务和业务降级
- 不是万能的网络安全边界，绕过 Sidecar 的流量仍可能存在
- `meshConfig.outboundTrafficPolicy.mode: REGISTRY_ONLY` 只能减少意外外联，不能当作强安全策略

# 核心架构

Istio 逻辑上分为控制面和数据面：控制面负责“告诉代理怎么转发”，数据面负责“真正转发流量”。

![Istio 总体架构](https://istio.io/latest/docs/ops/deployment/architecture/arch.svg)

*图 1：Istio 官方架构图（Sidecar 模式）：控制面 istiod + 数据面 Envoy*

## 控制面 istiod

istiod 由早期的 Pilot、Citadel、Galley 合并而来，负责：

- 服务发现：把 Kubernetes Service、Endpoint、ServiceEntry 等转换为标准模型
- 配置分发：把 VirtualService、DestinationRule、Gateway 等转换为 Envoy 配置，通过 xDS 下发
- 证书管理：作为 CA 为工作负载签发 X.509 证书，支持证书轮换
- 配置校验与状态汇总

istiod 常用端口：

| 端口 | 用途 |
| --- | --- |
| 15010 | xDS/CA，明文，仅限可信网络 |
| 15012 | xDS/CA，TLS/mTLS，生产推荐 |
| 15014 | 控制面监控指标，HTTP |
| 15017 | Webhook 容器端口，由 Service 443 转发，承载注入与校验 |

生产环境至少运行 2 个 istiod 副本。注入 Webhook 的 `failurePolicy: Fail` 时，单个 istiod 副本会成为集群创建 Pod 的单点：副本不可用时，所有新建 Pod 都会被拒绝。

### 控制面内部：从对象到 xDS 的编译流水线

istiod 不是一个“转发配置的 Kafka”，而是一个持续运行的编译器：

```text
Kubernetes API / ServiceEntry / CRD
        │ watch + 校验
        ▼
Config Store（内存中的服务、端点、路由、策略）
        │ 合并、去重、作用域裁剪
        ▼
Push Context（一次推送的全局快照）
        │ 按代理生成 xDS
        ▼
gRPC ADS 流（每个代理一条）
        │ version / nonce / ACK / NACK
        ▼
Envoy / ztunnel / waypoint
```

几个关键点：

- **Push Context 是快照**：一次推送基于当时的服务和配置状态生成，避免边生成边读到不一致的数据。
- **Debounce 合并变更**：短时间大量 Endpoint/Pod 变化会被合并，避免每个事件都触发全量重算。
- **按代理裁剪**：每个代理只应看到自己需要的 Listener/Route/Cluster/Endpoint；`Sidecar`、`exportTo`、`discoverySelectors` 都在这个阶段生效。
- **ACK/NACK**：代理应用成功后回 ACK；配置非法时回 NACK，并继续使用上一份可用配置。控制面会记录 NACK 并重试，但不会“强制”代理接受坏配置。
- **多副本不是分片**：每个 istiod 副本都能服务任意代理；副本之间通过 leader election 协调部分控制器，代理连接由 Service 负载均衡。扩容副本主要提升推送并发和可用性，不自动分摊单个超大网格的配置生成成本。

### xDS 协议细节：version、nonce 与一致性

ADS 把 CDS/EDS/LDS/RDS/SDS 聚合到一条 gRPC 流上，避免多条流之间的顺序错乱。一次响应的关键字段：

| 字段 | 作用 |
| --- | --- |
| `version_info` | 资源版本；代理 ACK 时带回，控制面据此判断是否同步 |
| `nonce` | 本次响应的唯一标识；ACK/NACK 必须带回对应 nonce |
| `resource_names` | 代理订阅的资源名（如 cluster 名称） |
| `error_detail` | NACK 时由代理返回，说明拒绝原因 |

`istioctl proxy-status` 的 `SYNCED` / `STALE` / `NOT SENT` 就是这条状态机的可视化：

- `SYNCED`：代理已 ACK 最新版本。
- `STALE`：控制面已发送更新，但代理尚未 ACK（可能正在应用、网络慢、或 NACK）。
- `NOT SENT`：控制面还没有向该代理发送配置（常见于刚启动或订阅范围为空）。

配置“看起来 apply 了但没生效”，通常不是 istiod 没收到，而是：代理 NACK、配置作用域没覆盖到、Endpoint 尚未就绪、或应用复用了旧连接。

### 控制面排障入口

- `istioctl proxy-status`：看每个代理的同步状态和最近一次 NACK。
- `istioctl proxy-config cluster/route/listener/endpoint/secret <pod>`：看代理实际持有的配置，而不是看 CRD 推测。
- `istioctl analyze -A`：静态检查配置引用、Gateway 绑定、mTLS 冲突等。
- istiod `15014/debug/syncz`、`/debug/config_dump`、`/debug/registryz`：控制面视角的同步与注册表状态；默认启用调试端点认证（`ENABLE_DEBUG_ENDPOINT_AUTH`），不要裸露到不可信网络。
- `15010` 是明文 xDS/CA，`15012` 是 TLS/mTLS；生产应优先使用 `15012`，并限制 `15010` 的访问。

## 配置如何生效：xDS 原理

Envoy 的配置可以抽象成一条链：

```
Listener → Filter Chain → Route → Cluster → Endpoint
```

对应到 xDS：

- **LDS**（Listener Discovery Service）：监听器，决定在哪个端口、用什么协议接收流量
- **RDS**（Route Discovery Service）：路由，决定请求匹配到哪个 cluster
- **CDS**（Cluster Discovery Service）：集群，表示一组上游服务
- **EDS**（Endpoint Discovery Service）：端点，表示上游的具体 Pod IP 和端口
- **SDS**（Secret Discovery Service）：证书和密钥。Envoy 通过 SDS 向同 Pod 的 istio-agent 请求证书，istio-agent 再带 ServiceAccount 凭证向 istiod 发 CSR；istiod 不直接向 Envoy 推送 SDS

以 `echo.default.svc.cluster.local:80` 为例，istiod 生成的资源大致是：

```text
LDS: 0.0.0.0:15001（出站）/ 0.0.0.0:15006（入站）
RDS: echo.default.svc.cluster.local:80
CDS: outbound|80||echo.default.svc.cluster.local
EDS: outbound|80||echo.default.svc.cluster.local → Pod IP:Port 列表
SDS: default 命名空间的 default ServiceAccount 证书
```

这也是为什么排障要看代理视角，而不是只看 CRD：

```bash
istioctl proxy-config listener <pod> -n <ns>
istioctl proxy-config route <pod> -n <ns>
istioctl proxy-config cluster <pod> -n <ns>
istioctl proxy-config endpoint <pod> -n <ns>
istioctl proxy-config secret <pod> -n <ns>
```

一次配置变更的过程：

1. `kubectl apply` 修改 CRD
2. istiod watch 到变更，做基本校验和去重
3. istiod 根据服务发现和 CRD 生成 Envoy 配置
4. 通过 xDS 增量或全量推送给相关代理
5. Envoy 应用配置并返回 ACK；配置非法时返回 NACK

`istioctl proxy-status` 的状态：

- `SYNCED`：Envoy 已 ACK 最新配置
- `STALE`：istiod 已发送更新，但尚未收到 ACK
- `NOT SENT`：istiod 还没有给该代理发送配置

`NACK` 是 Envoy 拒绝 xDS 配置的响应，不是 `proxy-status` 的状态值；出现时通常表现为 `STALE`，需要看 istiod 日志、`istioctl analyze` 和 Envoy config dump。

因为配置是推送模型，变更通常几秒内生效；但大规模集群里，xDS 推送和 Envoy 应用都需要时间，不能假设“apply 完立即全量生效”。

### 推送风暴、作用域与 1.31 的优化

xDS 的成本不在“配置有多大”，而在“有多少代理 × 变更多频繁 × 每个代理要重算多少”：

- **变更频率**：HPA 抖动、批量 Job、滚动发布都会持续改变 Endpoint。
- **扇出**：一次 Service/Endpoint 变更可能影响大量代理。
- **配置规模**：每个代理持有的 Listener/Cluster/Route 数量决定内存和生成时间。

控制手段：

| 手段 | 作用 | 注意 |
| --- | --- | --- |
| `Sidecar` 资源 | 限制命名空间/工作负载订阅的 host | 只裁剪配置，不阻断流量 |
| `exportTo` | 控制 Service/Route 对哪些命名空间可见 | 跨命名空间调用可能变成无配置 |
| `discoverySelectors` | istiod 只发现匹配的命名空间 | 影响服务发现，不是网络隔离 |
| `serviceEntryVisibility`（1.31） | 控制 `ServiceEntry` 的可见性 | Ambient 默认强制执行；Sidecar 需 `applyToSidecars` |
| `AMBIENT_SCOPED_ADDRESS_PUSHES`（1.31） | Address 变更只推给受影响的 waypoint | 默认开启，可关闭用于回退 |
| 配置拆分 | 避免超大 VirtualService/AuthorizationPolicy | 降低单次生成和评审成本 |

1.31 还调整了 Ambient 的 WDS 重连行为：ztunnel 重连时会上报它持有的所有 workload 名称和版本，约 4 万个 workload 就可能超过 istiod 默认 4MiB 的 gRPC 接收上限，表现为 `ResourceExhausted` 重连循环。接近这个规模时，需要调大 `ISTIO_GPRC_MAXRECVMSGSIZE`（按官方升级说明，约每 1 万 workload/service 预留 1MiB）。

## Sidecar 数据面原理

Sidecar 模式在每个业务 Pod 中注入一个 Envoy 容器。关键点是：**业务容器和 Envoy 共享同一个网络命名空间**，因此它们共享 `localhost`、网卡和端口空间。

流量拦截流程：

1. Pod 创建时，注入 Webhook 在 Pod 中加入 Envoy 容器
2. `istio-init` 初始化容器（或 istio-cni 节点代理）写入 iptables 规则
3. 出站流量被重定向到 Envoy 的 15001 端口
4. 入站流量被重定向到 Envoy 的 15006 端口
5. Envoy 通过 `SO_ORIGINAL_DST` 还原原始目标地址，再按 xDS 配置转发

几个容易忽略的细节：

- 代理自身的流量通过 UID 1337 排除，避免无限回环
- 15020、15021、15090 等代理端口有单独的放行规则
- 应用仍然监听自己的端口，感知不到 Envoy 的存在
- 不能用 `localhost` 访问“另一个容器”的端口，除非它们共享网络命名空间
- Sidecar 启动晚于应用时，应用启动期请求可能失败，可以开启 `holdApplicationUntilProxyStarts`

数据面端口：

| 端口 | 用途 |
| --- | --- |
| 15000 | Envoy admin，Pod 内可访问 |
| 15001 | 出站流量 |
| 15006 | 入站流量 |
| 15008 | HBONE mTLS 隧道（与 Ambient/HBONE 目的地通信） |
| 15020 | 合并指标 |
| 15021 | 健康检查 |
| 15053 | DNS 捕获 |
| 15090 | Envoy Prometheus 遥测 |

Sidecar 的优点是功能完整、成熟；缺点是每个 Pod 都有代理，资源开销和升级成本随 Pod 数量线性增长。

### 注入、CNI 与启动竞态

自动注入发生在 **Pod 创建时**，不是 Deployment 创建时。admission webhook 修改 Pod spec，加入 `istio-proxy` 容器和初始化逻辑；已经运行的 Pod 不会因为给命名空间打标签而自动获得 Sidecar，必须重建。

两种流量重定向方式：

- **istio-init**：初始化容器在 Pod 网络命名空间写 iptables 规则，需要 `NET_ADMIN`，通常配合限制性 SCC/PSP。
- **istio-cni**：节点级 CNI 插件，在 Pod 沙箱创建后配置重定向，不需要应用 Pod 持有 `NET_ADMIN`，生产更常用。

CNI 模式有一个经典竞态：节点刚变为可调度、CNI DaemonSet 还没就绪时，新 Pod 可能启动并绕过重定向。Istio 通过注入 `istio-validation` init container 检测重定向是否生效，并阻塞问题 Pod；CNI 的 repair 控制器会处理这些卡住的 Pod。该机制默认开启（`values.cni.repair.enabled`），不要为了“让 Pod 先起来”随意关闭。

CNI 与控制的版本兼容性：CNI `1.x` 可与控制面 `1.x-1`、`1.x`、`1.x+1` 配合，升级顺序相对宽松，但仍应以官方兼容矩阵为准。

其他容易踩的点：

- `hostNetwork: true` 的 Pod 不走常规 Sidecar 拦截，需要单独评估。
- 应用启动早于 Envoy 就绪时，启动期请求可能失败；可以开启 `holdApplicationUntilProxyStarts`，用启动延迟换取确定性。
- 明确排除不需要代理的端口（如某些监控/探针端口），但不要把业务端口排除，否则等于绕过 mTLS 和策略。
- 排障时先确认“流量有没有进代理”，再查路由和策略；`proxy-config listener` 能看到实际监听与 filter chain。

## Ambient 数据面原理

![ztunnel L4 数据路径](https://istio.io/latest/docs/ambient/architecture/data-plane/ztunnel-datapath-1.png)

*图 2：Ambient 官方 L4 路径：源 ztunnel 通过 HBONE 到目标 ztunnel*

![waypoint L7 数据路径](https://istio.io/latest/docs/ambient/architecture/data-plane/ztunnel-waypoint-datapath.png)

*图 3：Ambient 官方 L7 路径：源 ztunnel 把流量送到 waypoint，再转发到目标*

Ambient 模式把数据面拆成两层：

- **ztunnel**：每个节点一个，Rust 编写，处理 L3/L4 的 mTLS、认证、L4 授权和遥测。ztunnel 不解析 HTTP，使用 HBONE（HTTP CONNECT 隧道）在节点间传输流量
- **waypoint**：按命名空间、Service 或 Pod 部署的 Envoy，提供 L7 路由、L7 授权、遥测和 VirtualService 等能力

流量路径：

- 只需要 L4 零信任时：源 Pod → 源节点 ztunnel → HBONE → 目标节点 ztunnel → 目标 Pod
- 需要 L7 时：源 ztunnel 把流量送到目标侧的 waypoint，waypoint 执行 L7 策略后再转发给目标
- waypoint 是否在路径上取决于流量原始目标是 Service 还是 Pod IP，以及 `istio.io/waypoint-for`。如果流量原始目标是 Service，而该 Service 没有 waypoint，即使后端 Pod 有 waypoint，流量也不会经过它；只有直接访问 Pod IP 且 `waypoint-for` 允许 workload 流量时，才会走 Pod 关联的 waypoint

### HBONE 与节点内重定向

HBONE（HTTP-Based Overlay Network Environment）不是新造的车轮，而是三个标准的组合：

- **HTTP/2**：多路复用，把多条应用 TCP 流复用到一个加密连接上。
- **HTTP CONNECT**：建立隧道。
- **mTLS**：加密并验证双方工作负载身份。

默认监听 TCP `15008`。它的关键属性是**不修改应用流量本身**：连接元数据放在 CONNECT 头里，不需要往业务请求中注入 Istio 私有 header。因此应用看到的仍是原始协议，代理可以在不改代码的情况下完成 mTLS 和身份传递。

Ambient 的重定向由 `istio-cni` 与 ztunnel 协作完成：

1. `istio-cni` 作为 chained CNI 插件，在主 CNI 之后执行，监听 Pod 创建/删除。
2. ztunnel 在**应用 Pod 的网络命名空间内**建立捕获规则，因此不需要替换集群 CNI。
3. 入站流量 TPROXY 到 `15006`，出站流量 REDIRECT 到 `15001`，HBONE 走 `15008`。
4. 同节点 Pod 到 Pod 的流量也会经过本节点 ztunnel，保证 L4 授权和遥测对本地/跨节点流量一致。

ztunnel 通过 xDS 从 istiod 获取配置，并获取**本节点上所有 Pod 的 ServiceAccount 证书**。这解释了 Ambient 的资源模型：证书和配置集中在节点级代理，省掉了每 Pod 一份代理，但也把信任和故障集中到了节点。

Ambient 相关标签：

| 标签 | 作用 | 资源 |
| --- | --- | --- |
| `istio.io/dataplane-mode=ambient` | 加入 Ambient 网格 | Namespace / Pod |
| `istio.io/dataplane-mode=none` | Pod 级别退出 | Pod |
| `istio.io/use-waypoint=<name>` | 流量经过指定 waypoint | Namespace / Service / Pod |
| `istio.io/ingress-use-waypoint=true` | 入口流量也经过目标 waypoint，需要 istiod 开启 `ENABLE_INGRESS_WAYPOINT_ROUTING`（1.25+） | Namespace / Service / ServiceEntry |
| `istio.io/waypoint-for`（Alpha） | waypoint 处理 `service`、`workload`、`none` 或 `all` 流量 | Gateway |

### waypoint 的作用域、策略与金丝雀

waypoint 是 Envoy Deployment，但它的行为更像“资源网关”：

- **只接收 HBONE**：waypoint 不接受普通明文流量；源 ztunnel 负责把流量升级为 HBONE 后再送入。
- **策略在目的地执行**：这是 Ambient 与 Sidecar 最大的语义差异。Sidecar 在源端和目标端都可能有策略执行点；Ambient 的 L7 策略由目标 waypoint 执行。对 Service，waypoint 还会执行路由和负载均衡；对 Pod，执行策略后直接转发。
- **作用域**：`istio.io/use-waypoint` 可以打在 Namespace、Service 或 Pod 上。大多数场景按命名空间共享，减少 waypoint 数量。
- **流量类型**：`istio.io/waypoint-for` 决定处理 `service`、`workload`、`all` 还是 `none`，默认 `service`。选择依据是流量**最初寻址的目标类型**；如果访问的是没有 waypoint 的 Service，即使后端 Pod 有 waypoint，也不会经过它。
- **入口流量**：`istio.io/use-waypoint` 默认只管东西向；Ingress Gateway 到 Service 的流量默认不经过 waypoint。要经过，需在 Service/Namespace 上设置 `istio.io/ingress-use-waypoint=true`，并让 istiod 开启 `ENABLE_INGRESS_WAYPOINT_ROUTING`（默认 `false`）。这会产生“入口网关 + waypoint”的两级 L7 处理，延迟、指标和授权都要按两跳设计。
- **金丝雀**：1.31 支持把 Service 的流量按权重分给主 waypoint 和 canary waypoint，使用 `istio.io/use-waypoint-canary`、`istio.io/use-waypoint-canary-namespace` 和 `istio.io/use-waypoint-canary-weight`。waypoint 升级可以先切 5%，验证后再全量。
- **容量与爆炸半径**：waypoint 是共享组件，一个副本挂掉会影响其作用域内所有服务。按安全边界拆分，配置 HPA、PDB、反亲和和资源 requests/limits；不要为了省资源把不相关部门塞进同一个 waypoint。

还有一个必须验证的边界：当前官方文档明确说明，**来自 Sidecar 和 Gateway 的流量不会经过 waypoint**（未来版本会补齐）；网格外流量也不知道 waypoint 的存在，会直接访问目的地。混合数据面迁移时，这会造成“策略看起来配置了，但某类流量没经过执行点”的假象。

### Ambient 的限制

- 只用 ztunnel 时只有 L4 能力；VirtualService、L7 授权、JWT、Wasm、L7 遥测都需要 waypoint。
- ztunnel 是节点级单点，节点故障会影响该节点全部 Ambient Pod 的连通性。
- 节点级多租户共享 ztunnel，隔离强度低于每 Pod Sidecar；高合规场景要单独评估。
- `dataplane-mode`、`use-waypoint`、`ingress-use-waypoint` 目前是 Beta，`waypoint-for` 是 Alpha；生产使用前确认版本和升级说明。
- Ambient 的多集群能力与 Sidecar 不完全等价，落地前按当前版本的官方支持矩阵验证。

Sidecar 与 Ambient 可以共存，但同一个命名空间不建议混用；如果同时命中，Sidecar 优先级更高。

## Sidecar 与 Ambient 对比

| 维度 | Sidecar | Ambient |
| --- | --- | --- |
| 代理位置 | 每个 Pod 一个 Envoy | 每节点 ztunnel，按需 waypoint |
| L4 能力 | 完整 | ztunnel 提供 |
| L7 能力 | 完整 | 需要 waypoint |
| 应用侵入 | 注入 Sidecar，需要重启 | 加标签，通常无需重启 |
| 资源开销 | 随 Pod 数增长 | ztunnel 随节点数增长 |
| 成熟度 | 最成熟 | 已可用；`dataplane-mode`、`use-waypoint`、`ingress-use-waypoint` 为 Beta，`waypoint-for` 为 Alpha |
| 适用场景 | 功能要求完整、存量系统 | 大规模、渐进接入、L4 为主 |

## 网关

- **Ingress Gateway**：集群入口，替代或补充 Kubernetes Ingress
- **East-West Gateway**：多集群之间的东西向流量
- **Egress Gateway**：统一出口，配合 NetworkPolicy 才能真正限制外联

网关本身也是 Envoy Deployment，可以独立扩缩容、独立升级。生产环境建议把入口和出口网关分开部署，不要复用同一个网关。

# 安装与接入

## 前置检查

- Kubernetes 版本在 Istio 支持范围内
- 集群有足够的 CPU/内存给 istiod 和网关
- 确认 CNI 方案，避免与 istio-cni 冲突
- 使用 Gateway API 时先安装对应 CRD，Gateway API CRD 默认不会随集群安装
- 规划命名空间、revision 和网关暴露方式

## 使用 istioctl 安装

```bash
curl -sL https://istio.io/downloadIstioctl | sh -
export PATH=$HOME/.istioctl/bin:$PATH

istioctl version
istioctl install --set profile=demo -y
kubectl get pods -n istio-system
```

生产环境不要直接用 `demo` profile。常用 profile：

| profile | 用途 |
| --- | --- |
| `default` | 生产基础组件 |
| `demo` | 学习与演示，包含较多组件 |
| `minimal` | 只安装控制面 |
| `ambient` | 安装 Ambient 所需组件 |
| `remote` | 远程集群数据面 |
| `empty` | 完全自定义 |

安装完成后给命名空间打注入标签：

```bash
kubectl label namespace default istio-injection=enabled
kubectl rollout restart deployment -n default
```

## 使用 Helm 安装

```bash
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update

helm install istio-base istio/base -n istio-system --create-namespace
helm install istiod istio/istiod -n istio-system --wait
helm install istio-ingressgateway istio/gateway -n istio-system
```

Ambient 模式需要给 istiod 和 cni 指定 ambient profile：

```bash
helm install istio-base istio/base -n istio-system --create-namespace
helm install istiod istio/istiod -n istio-system --set profile=ambient --wait
helm install istio-cni istio/cni -n istio-system --set profile=ambient --wait
helm install ztunnel istio/ztunnel -n istio-system --wait
```

具体 values 以对应版本的官方 Helm 文档为准。

## Sidecar 注入

自动注入依赖命名空间标签或 Pod 注解：

```bash
# 使用默认 revision
kubectl label namespace prod istio-injection=enabled

# 使用指定 revision
kubectl label namespace prod istio.io/rev=1-31-3 --overwrite
```

注意：`istio-injection` 和 `istio.io/rev` **不要同时使用**。两者同时存在时，`istio-injection` 优先，`istio.io/rev` 会被忽略。

单个 Pod 可以覆盖：

```yaml
metadata:
  annotations:
    sidecar.istio.io/inject: "false"
```

手动注入用于调试或特殊场景。使用 revision 安装时必须指定 revision，否则可能注入到默认控制面或直接失败：

```bash
istioctl kube-inject -f deployment.yaml --revision=1-31-3 | kubectl apply -f -
```

验证注入结果：

```bash
kubectl get pod -n prod -o jsonpath='{.items[*].spec.containers[*].name}'
istioctl proxy-status
```

## Ambient 接入

```bash
istioctl install --set profile=ambient -y

kubectl label namespace default istio.io/dataplane-mode=ambient

# 部署命名空间级 waypoint，并自动给命名空间打 use-waypoint 标签
istioctl waypoint apply -n default --enroll-namespace
```

只需要 L4 能力时可以不部署 waypoint。需要 L7 路由、JWT 或 L7 授权时，再为命名空间、Service 或 Pod 部署 waypoint。

## 升级与 revision

推荐使用 revision 做金丝雀升级，而不是直接原地覆盖：

```bash
# 安装新 revision，旧控制面继续服务
istioctl install --set revision=1-31-3

# 切换命名空间：必须先移除 istio-injection
kubectl label namespace prod istio-injection- istio.io/rev=1-31-3 --overwrite

# 重启工作负载，让新 Sidecar 生效
kubectl rollout restart deployment -n prod
```

升级顺序：

1. 备份 Istio 与业务相关 CRD 配置
2. 运行 `istioctl x precheck` 检查环境兼容性
3. 升级控制面
4. 用 `istioctl analyze -A` 检查配置
5. 按命名空间切换数据面
6. 用 `istioctl proxy-status` 确认全部 `SYNCED`
7. 观察错误率、延迟和 mTLS 指标后再删除旧 revision

回滚时把命名空间的 `istio.io/rev` 切回旧 revision，并重启工作负载即可。

注意：`istioctl upgrade` 只用于原地升级，**不兼容使用 `--revision` 安装的集群**。revision 安装请继续使用 `istioctl install --set revision=...`。

## 卸载

```bash
istioctl uninstall -y
kubectl delete namespace istio-system
```

不加 `--purge` 时 CRD 会保留。`--purge` 会删除所有 Istio 资源，包括可能与其他控制面共享的集群级资源，执行前务必确认。`istio-system` 命名空间不会自动删除，需要单独执行。

# 流量管理

## 核心对象

| 对象 | 作用 |
| --- | --- |
| `Gateway` | 入口/出口监听与 TLS 配置 |
| `VirtualService` | 路由规则：匹配、重写、重试、超时、故障注入、镜像 |
| `DestinationRule` | 目标服务策略：subset、负载均衡、连接池、熔断、TLS |
| `ServiceEntry` | 把外部服务注册进网格 |
| `Sidecar` | 限制 Sidecar 订阅的配置范围，降低 xDS 压力 |
| `WorkloadEntry` | 把 VM 等工作负载注册进网格 |
| `WorkloadGroup` | 批量管理 WorkloadEntry |

## 路由匹配、作用域与合并

流量管理的难点不在字段，而在“哪条规则最终生效”。一条请求至少经过四层决策：

```text
谁发的（Sidecar / Gateway / waypoint）
  → host 选中哪个服务
  → 哪条 match 命中
  → route 选哪个 subset / 权重
  → DestinationRule 给这个 subset 什么策略
```

几个容易出错的语义：

- **host 解析**：`reviews`、`reviews.default`、`reviews.default.svc.cluster.local` 可能指向不同范围；跨命名空间时写全限定名，避免歧义。
- **作用域优先级**：Sidecar/工作负载级 > 命名空间级 > mesh 级；入口网关规则只作用于绑定的 Gateway。
- **`exportTo`**：控制资源对哪些命名空间可见；被排除的命名空间看不到该路由/服务，表现为“配置没生效”或 503，而不是自动拒绝。
- **`Sidecar`**：限制代理订阅范围，减少 xDS；它不是访问控制，未列出的目标仍可能按默认行为访问。
- **合并**：同一 host 的多个 DestinationRule 会合并，但重复 subset 只保留第一个；建议一个 host 一个 DestinationRule，subset 名称唯一。
- **默认路由**：Istio 默认会把流量发给服务的所有版本。上线新版本前先写默认路由，否则新 Pod 可能立即接流量。
- **make-before-break**：先加 subset，再切流量，最后删旧 subset；反过来会出现指向不存在上游的 503。

调试时不要只看 CRD，要看代理视角：

```bash
istioctl proxy-config route <pod> -n <ns> --name 80
istioctl proxy-config cluster <pod> -n <ns>
istioctl proxy-config endpoint <pod> -n <ns>
```

## Gateway API 与 Istio Gateway

Istio 同时支持：

- **Istio Gateway + VirtualService**：存量配置多，功能完整
- **Kubernetes Gateway API**：`GatewayClass`、`Gateway`、`HTTPRoute`、`GRPCRoute`，更符合 Kubernetes 生态

新项目优先使用 Gateway API；已有 Istio Gateway 不需要立刻迁移。

Gateway API 示例：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: bookinfo
spec:
  gatewayClassName: istio
  listeners:
  - name: http
    port: 80
    protocol: HTTP
    hostname: bookinfo.example.com
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: bookinfo
spec:
  parentRefs:
  - name: bookinfo
  hostnames:
  - bookinfo.example.com
  rules:
  - backendRefs:
    - name: productpage
      port: 9080
```

### Gateway API 的关键语义

Gateway API 有两套使用方式，不要混为一谈：

- **入口**：`GatewayClass` + `Gateway` + `HTTPRoute`。`Gateway` 代表一个负载均衡器/监听器，`HTTPRoute` 通过 `parentRefs` 绑定到它。
- **网格**：GAMMA 模型。`HTTPRoute` 直接把 `parentRefs` 指向 **Service**，不使用 `Gateway`/`GatewayClass`。这是 Mesh 场景的 GA 能力。

关键字段：

| 字段 | 作用 |
| --- | --- |
| `parentRefs[].name/namespace` | 绑定到 Gateway 或 Service；跨命名空间需要 `ReferenceGrant` |
| `parentRefs[].sectionName` | 只绑定某个 listener |
| `hostnames` | 匹配的域名 |
| `rules[].matches` | path/header/query/method 匹配 |
| `rules[].backendRefs` | 后端 Service/端口/权重 |
| `allowedRoutes` | Gateway 允许哪些命名空间的 Route 绑定 |
| `status.parents[].conditions` | 是否被接受、为什么被拒绝 |

实践建议：

- 新项目优先 Gateway API，存量 Istio Gateway 不必立刻迁移。
- `Gateway` 的 `hosts`/`hostname` 要收紧，不要用 `*`。
- 跨命名空间引用用 `ReferenceGrant` 显式授权，不要靠“同集群默认可达”。
- Gateway API CRD 版本必须满足 Istio 要求；1.31 的 `istioctl analyze` 会用 `IST0176` 提示 CRD 版本过低，低于要求的资源会被 istiod 静默过滤。
- 入口用 `gatewayClassName: istio`；Ambient waypoint 用 `istio-waypoint`，两者不要混用。

## VirtualService 原理

VirtualService 负责“请求怎么走”。匹配顺序是：

1. 按 `hosts` 选中服务
2. 按 `http.match` 从上到下匹配，第一条命中即生效
3. 命中后按 `route` 选择目标 subset 和权重
4. 没有命中任何 `match` 时走默认路由

常用字段：

- `hosts`：作用于哪些服务
- `gateways`：绑定入口网关；不写表示网格内部
- `http.match`：按 URI、header、method、query 匹配
- `http.route`：目标 subset 和权重
- `rewrite`、`retries`、`timeout`、`fault`、`mirror`

灰度示例：

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
  - reviews
  http:
  - match:
    - headers:
        x-canary:
          exact: "true"
    route:
    - destination:
        host: reviews
        subset: v2
  - route:
    - destination:
        host: reviews
        subset: v1
      weight: 90
    - destination:
        host: reviews
        subset: v2
      weight: 10
```

注意：`DestinationRule` 中的 subset 策略只有在 VirtualService 明确路由到该 subset 时才生效。只定义 DestinationRule、不定义路由时，subset 的流量策略不会自动应用。

## DestinationRule 原理

DestinationRule 负责“到目标怎么连”。

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  trafficPolicy:
    loadBalancer:
      simple: LEAST_REQUEST
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
```

- `loadBalancer`：ROUND_ROBIN、LEAST_REQUEST、LEAST_CONN、RANDOM、PASSTHROUGH
- `connectionPool`：限制连接数、等待请求数，配合熔断
- `outlierDetection`：连续错误达到阈值后把实例摘除一段时间
- `trafficPolicy.tls`：配置到上游的 TLS

同一 host 的多个 DestinationRule 会被合并，但同名 subset 以第一个定义为准，后续重复会被丢弃；top-level `trafficPolicy` 也只保留第一个被处理的，后续丢弃。跨资源顺序未定义主要针对绑定 Gateway 的 VirtualService 分片，不适用于 DestinationRule。建议一个 host 只用一个 DestinationRule，并保证 subset 名称唯一。

### 负载均衡、locality 与后端健康

负载均衡算法只是“选谁”，真正决定可用性的是“谁还在池子里”：

| 算法 | 适用 | 注意 |
| --- | --- | --- |
| `ROUND_ROBIN` | 同构后端、请求成本均匀 | 长连接下容易不均 |
| `LEAST_REQUEST` | 请求成本差异大 | 需要代理维护活跃请求数 |
| `LEAST_CONN` | TCP 为主 | 对 HTTP/2 多路复用不敏感 |
| `RANDOM` | 大规模、实现简单 | 方差较大 |
| `PASSTHROUGH` | 直接透传 | 不做负载均衡，慎用 |
| 一致性哈希 | 会话保持、缓存亲和 | 后端增减会重排，需评估缓存命中 |

再叠加两层策略：

- **Locality LB**：优先同区域/同 AZ，失败再跨区；`failoverPriority` 控制跨区顺序。跨区调用会增加延迟和出口成本，不能只看“能不能通”。
- **Panic threshold**：健康后端比例低于阈值时，Envoy 可能进入 panic 模式，把流量打向所有后端（包括不健康的），这是 fail-open 设计，不是 bug。要理解它和 `outlierDetection` 的交互。

后端健康由三部分共同决定：

1. Kubernetes readiness / EndpointSlice 状态。
2. `outlierDetection` 的被动驱逐（连续 5xx、网关错误等）。
3. `minHealthPercent` 等健康阈值。

1.31 的一个行为变化：**默认会发送不健康的 Endpoint，除非配置了 `OutlierDetection.minHealthPercent`**。这会影响“后端不健康时是否继续接流量”的预期，升级前要确认；可以用 `PILOT_AUTO_SEND_UNHEALTHY_ENDPOINTS=false` 或兼容 profile 回退。

1.31 还增加了 zone-aware 负载均衡能力，依赖 `failoverPriority` 分层，并且需要 `ISTIO_META_ENABLE_SELF_DISCOVERY: "true"` 注入本地 cluster 信息；该能力目前仅支持 Sidecar 模式，Ambient 不支持。

## 灰度与发布

常见方式：

- 按权重：90/10、50/50，逐步放量
- 按请求头：内部用户或测试账号优先命中新版本
- 按 URI：新接口先走新版本
- 流量镜像：把生产流量复制到新版本，不影响主链路

发布顺序建议“make-before-break”：

1. 先更新 DestinationRule，增加新 subset
2. 再更新 VirtualService，把少量流量切到新 subset
3. 观察指标和日志
4. 逐步放量
5. 稳定后再删除旧 subset

如果先改 VirtualService 再改 DestinationRule，Envoy 可能引用不存在的上游，期间返回 503。

## 超时、重试与熔断

```yaml
http:
- route:
  - destination:
      host: reviews
      subset: v1
  timeout: 2s
  retries:
    attempts: 3
    perTryTimeout: 500ms
    retryOn: 5xx,reset,connect-failure
```

### 重试放大与超时预算

重试不是“更可靠”，而是“用更多流量换一次机会”。假设单次失败率 10%，最多重试 3 次（共 4 次尝试）：

- 最终失败率：`1 - 0.9^4 = 34.4%`。
- 期望尝试次数：`1 + 0.1 + 0.01 + 0.001 = 1.111`，即额外 11.1% 负载。

如果失败原因是过载，重试会进一步压垮下游，形成重试风暴。**只对幂等、瞬时、可重放的失败重试**；写操作必须有幂等键。

超时是端到端预算，不是每跳拍脑袋：

```text
调用方剩余 deadline
  ≥ 本次请求 timeout
  ≥ perTryTimeout × (attempts + 1) + 排队/建连时间
```

Istio 的 `timeout` 是这条路由的总超时，重试通常也消耗这个预算；`perTryTimeout` 是单次尝试的上限。两者必须满足 `perTryTimeout × (attempts + 1) ≤ timeout`，否则后面的重试没有意义。同时，超时不能小于被调服务的正常处理时间，否则会稳定 504。

`retryOn` 要按错误类型选择，不要无脑 `5xx`：

- `connect-failure`、`reset`、`refused-stream`：连接层瞬时故障，通常可重试。
- `5xx`、`gateway-error`：可能是业务错误，也可能是过载；配合幂等和错误预算。
- `retriable-4xx`：只对特定 4xx 有意义，慎用。
- `retryRemoteLocalities`：跨区重试会增加延迟和出口成本。

### 熔断：连接池 + 异常点驱逐

熔断不是单一开关，而是两层：

1. **连接池限制**：`maxConnections`、`http1MaxPendingRequests`、`http2MaxRequests`、`maxRetries`。过载时快速失败，避免请求无限排队。
2. **异常点驱逐**：`outlierDetection` 根据连续错误把后端摘除一段时间。

```yaml
trafficPolicy:
  connectionPool:
    tcp:
      maxConnections: 100
    http:
      http1MaxPendingRequests: 100
      http2MaxRequests: 1000
  outlierDetection:
    consecutive5xxErrors: 5
    interval: 30s
    baseEjectionTime: 30s
    maxEjectionPercent: 50
    minHealthPercent: 30
```

要点：

- `maxEjectionPercent` 太低，坏后端仍会接流量；太高，可能把池子踢空。
- `minHealthPercent` 决定健康后端不足时的行为，和 1.31 的默认发送不健康 Endpoint 变化直接相关。
- 驱逐是被动的，恢复依赖时间窗口；快速抖动场景要配合主动健康检查和合理的超时。
- 重试、熔断、限流要一起设计；只加重试等于给故障加杠杆。

## 故障注入与镜像

```yaml
http:
- fault:
    delay:
      percentage:
        value: 10
      fixedDelay: 5s
    abort:
      percentage:
        value: 5
      httpStatus: 500
  route:
  - destination:
      host: reviews
      subset: v1
```

流量镜像：

```yaml
http:
- route:
  - destination:
      host: reviews
      subset: v1
  mirror:
    host: reviews
    subset: v2
  mirrorPercentage:
    value: 10
```

故障注入适合做混沌演练，但不要在入口网关对全量流量开启，容易造成真实故障。

## ServiceEntry 与出口流量

把外部服务注册进网格：

```yaml
apiVersion: networking.istio.io/v1
kind: ServiceEntry
metadata:
  name: external-api
spec:
  hosts:
  - api.example.com
  ports:
  - number: 443
    name: https
    protocol: TLS
  resolution: DNS
  location: MESH_EXTERNAL
```

出口治理建议：

- `meshConfig.outboundTrafficPolicy.mode: REGISTRY_ONLY` 可以阻止未声明的外联，但不是强安全边界
- 真正要限制外联时，使用 Egress Gateway + NetworkPolicy，确保流量不能绕过代理
- 对敏感出口统一做 TLS 源、审计和访问控制

### ServiceEntry 的解析模式

`resolution` 决定代理如何得到后端地址：

| 模式 | 行为 | 适用 |
| --- | --- | --- |
| `NONE` | 直接把原始目标 IP 交给应用/代理，不做端点列表 | 外部 API、需要保持原目标 |
| `STATIC` | 使用 `spec.endpoints` 中的静态地址 | 固定 IP 的外部服务、VM |
| `DNS` | 代理周期性解析域名，再负载均衡 | 动态 DNS、外部服务 |

`resolution: DNS` 的细节很重要：Istio 代理不会在请求时同步解析 DNS，而是**每 30 秒周期性解析**（当前固定值），即使没有请求也会解析。代理数量多、TTL 低时，会给 DNS 服务器造成明显压力。优化手段：

- 能用 `NONE` 就用 `NONE`，避免代理侧 DNS 轮询。
- 自己控制的域名提高 TTL。
- 用 `exportTo` 或 `Sidecar` 把 `ServiceEntry` 限制到真正需要它的工作负载。

DNS 代理（`ISTIO_META_DNS_CAPTURE`）只捕获**应用发出的 DNS 请求**，让 `ServiceEntry` 的域名可以被解析；它不影响 `resolution: DNS` 时代理自己的解析路径。需要自动分配地址时使用 `ISTIO_META_DNS_AUTO_ALLOCATE`。

### 出口网关与强制路径

`REGISTRY_ONLY` 只能减少“意外外联”，不是强安全边界：绕过 Sidecar 的流量仍可能出网。真正要强制出口路径，需要：

1. `ServiceEntry` 登记外部依赖。
2. Egress Gateway 承载出口流量。
3. NetworkPolicy 只允许工作负载访问 Egress Gateway，禁止直连外部。
4. 在网关上做 TLS 源、审计、限流和授权。

TLS 源（origination）场景要确认 SNI、证书校验和 DNS 解析都正确；只配 `tls.mode: SIMPLE` 而不校验上游证书，等于把 mTLS 的收益丢掉一半。

1.31 新增的 `serviceEntryVisibility` 可以控制 `ServiceEntry` 对哪些命名空间/工作负载可见；Ambient 默认强制执行，Sidecar 需要 `applyToSidecars`。这适合平台团队把外部依赖收口，但也会让“看不到”表现为解析失败或 503，变更前要评估。

## Sidecar 配置范围

大型集群里，每个 Sidecar 默认可能看到大量服务，导致 xDS 配置膨胀。可以用 `Sidecar` 限制订阅范围：

```yaml
apiVersion: networking.istio.io/v1
kind: Sidecar
metadata:
  name: default
  namespace: prod
spec:
  egress:
  - hosts:
    - "./*"
    - "istio-system/*"
```

这表示 `prod` 的 Sidecar 只订阅本命名空间和 `istio-system` 的配置。未包含的目标会按 unmatched traffic 处理，**通常仍然可以访问**，`Sidecar` 本身不能强制阻断出站。要阻断出站请用 Egress Gateway、NetworkPolicy 或 AuthorizationPolicy。跨命名空间调用若希望保留 L7 配置（超时、重试、subset），需要显式加入对应 host。

## 网关 TLS

- TLS 终止：客户端到网关用 HTTPS，网关到后端可用 HTTP 或 mTLS
- TLS 透传：网关不终止 TLS，适合需要端到端加密的场景
- 证书建议由 cert-manager 或企业 CA 统一签发和轮换
- `Gateway.servers[].hosts` 不要使用 `*`，按域名或命名空间收紧
- 入口网关和出口网关分开部署，分别扩缩容

# 多集群与多网络

单集群 Mesh 是常态，多集群才是架构分水岭。多集群不是为了“看起来高可用”，而是为了故障隔离、地域合规、就近访问、迁移过渡和爆炸半径控制。

## 网络模型

| 模型 | 连通性 | 服务发现 | 适用 |
| --- | --- | --- | --- |
| 单网络 | 所有 Pod 可直接互通 | 扁平发现，所有 Endpoint 可见 | 同 VPC、多集群但网络已打通 |
| 多网络 | 跨网络只能经 Gateway | 分区发现，按消费者网络返回不同 Endpoint | 跨云、跨地域、网络隔离 |

单网络的前提是 **Pod/Service IP 不重叠**。多网络下，Istio 只支持“跨网络访问有 Istio 代理的工作负载”，因为网关用 TLS 透传把 mTLS 直接延伸到工作负载；没有代理的工作负载无法参与双向认证。

## 控制面模型

- **Primary-Remote**：一个主集群运行 istiod，远程集群只跑数据面。运维简单，但控制面跨网络依赖强，主集群故障影响面大。
- **Multi-Primary**：每个集群都有自己的 istiod，互相发现。故障隔离更好，但要处理配置一致性、信任域和版本偏差。
- **External Control Plane**：控制面独立于数据面集群，适合托管/多租户平台。

不管哪种模型，都要明确：

- 哪个集群是配置源？GitOps 如何避免两个控制面互相覆盖？
- 控制面版本是否一致？数据面允许的版本偏差是多少？
- 跨集群的 `ServiceEntry`、`AuthorizationPolicy`、`Sidecar` 如何分发？

## 命名空间同名合并

多集群中，**同名命名空间默认被视为同一个命名空间**。例如 `West/Team-1` 和 `East/Team-1` 中的同名 Service 会合并 Endpoint，参与同一套负载均衡。这既是便利，也是风险：

- 两个团队碰巧用了同一个命名空间名，可能意外互通。
- 迁移期同名服务可能把流量吸到错误集群。
- 需要隔离时，使用不同命名空间名、`exportTo`、`discoverySelectors` 和 AuthorizationPolicy。

## 信任域与证书

跨集群 mTLS 的核心是信任：

- 同一个 CA、同一个 trust domain：最简单，证书天然互信。
- 不同 CA/trust domain：需要交换 trust bundle，可以用 SPIFFE Trust Domain Federation，或手工分发根证书。
- 不同信任域之间，授权策略要显式处理 principal；1.31 的 `AuthorizationPolicy.source.trustDomains` / `notTrustDomains` 可以按信任域匹配或排除。

不要让“能通”掩盖“身份不对”：跨集群 200 响应不代表授权模型正确，必须验证 principal 和 trust domain。

## East-West Gateway

多网络场景下，跨集群流量通常经 East-West Gateway：

```text
Cluster A Pod → A 侧 Sidecar → East-West Gateway A
              → TLS 透传/mTLS → East-West Gateway B
              → B 侧 Sidecar → Cluster B Pod
```

要点：

- 网关要支持 TLS 透传，才能把 mTLS 延伸到工作负载，而不是在网关终止后重新发起。
- 网关容量按跨集群峰值流量规划，独立于入口网关。
- 跨网络多一跳，超时、重试和熔断预算要重新计算。
- 网络分区时，要明确“本地优先、跨区 failover”还是“直接失败”，不要依赖默认行为。

## 多集群故障模式

| 故障 | 表现 | 排查 |
| --- | --- | --- |
| 跨集群 Endpoint 不出现 | 只看到本集群后端 | 检查远程 secret、`istioctl remote-clusters`、网络连通性 |
| 证书/信任域不匹配 | 跨集群 503 TLS error | 对比根证书、trust domain、`proxy-config secret` |
| 同名命名空间误合并 | 流量跑到错误集群 | 检查命名空间命名和 Endpoint |
| East-West Gateway 过载 | 跨区延迟/超时 | 网关副本、连接数、CPU、限流 |
| 控制面分区 | 两侧配置不一致 | 版本、GitOps 同步、`proxy-status` |
| DNS 解析不一致 | 同一域名不同结果 | 检查 DNS 代理、`ServiceEntry`、CoreDNS |

Ambient 的多集群支持仍在演进，落地前要以当前版本的官方支持矩阵为准；不要假设它与 Sidecar 多集群完全等价。

# 安全

![Istio 安全架构](https://istio.io/latest/docs/concepts/security/overview.svg)

*图 4：Istio 官方安全架构总览*

## 身份与证书原理

Istio 以 **ServiceAccount** 为粒度分配 SPIFFE 身份，同一 ServiceAccount 下的所有工作负载共享该身份：

```
spiffe://cluster.local/ns/<namespace>/sa/<service-account>
```

如果需要隔离身份，必须为不同工作负载使用不同的 ServiceAccount。

证书签发流程：

1. Istio agent 生成私钥和 CSR
2. agent 带着 ServiceAccount 凭证向 istiod 请求签名
3. istiod 校验凭证后签发证书
4. Envoy 通过 SDS 从 agent 获取证书和私钥
5. agent 监控证书有效期并自动轮换

![身份与证书签发流程](https://istio.io/latest/docs/concepts/security/id-prov.svg)

*图 5：Istio 官方身份与证书签发流程*

生产环境可以通过 istio-csr 接入 cert-manager 或 Vault，或挂载企业 CA 的 `cacerts` Secret。cert-manager 本身是证书管理控制器，不是 CA。

### 证书生命周期与 CA 选型

Istio 默认给工作负载签发短生命周期证书（常见默认 24 小时，可配置），istio-agent 在过期前自动轮换。这个模型的安全收益是“密钥暴露窗口小”，代价是**控制面和 CA 必须持续可用**。

CA 选型：

| 方式 | 特点 | 适用 |
| --- | --- | --- |
| 自签 CA（默认） | 开箱即用，istiod 持有根证书 | 测试、简单集群 |
| 挂载 `cacerts` | 使用企业 CA 的根/中间证书 | 已有 PKI、需要统一信任根 |
| istio-csr + cert-manager | 由 cert-manager 签发，支持 Vault/外部 issuer | 企业 PKI、自动化轮换 |
| 外部 SPIFFE/CA | 与组织身份体系集成 | 多网格、强合规 |

证书运维的硬要求：

- **根证书轮换**：必须先让新旧根证书同时被信任，再逐步换发工作负载证书，最后移除旧根；直接替换会导致全网格握手失败。
- **TTL 与提前量**：TTL 越短越安全，但对 CA 可用性要求越高；至少保留多个轮换周期的余量。
- **时钟**：节点时间漂移会让证书“尚未生效/已过期”，mTLS 直接 503；NTP 是 Mesh 的基础设施。
- **CA 故障演练**：istiod 全挂时，已有证书在 TTL 内仍可用；但 TTL 到期后会集中失败。要演练 CA 恢复和批量轮换。
- **监控**：证书到期时间、CSR 成功率、轮换失败、istiod CA 错误率都要告警。

1.31 新增 FIPS 140-3 合规策略（`COMPLIANCE_POLICY=fips-140-3`），会限制 TLS 版本、密码套件和曲线，并要求 Go 组件以相应方式构建。金融/政府场景不要只开开关，要验证 Envoy、istiod、证书链和上游服务全部满足要求。

## mTLS 原理

mTLS 是双向认证：客户端和服务端都要出示证书，并校验对方的证书链和 SPIFFE 身份。Istio 默认自动为网格内流量升级到 mTLS。

![认证架构](https://istio.io/latest/docs/concepts/security/authn.svg)

*图 6：Istio 官方认证架构：传输认证与来源认证*

`PeerAuthentication` 控制目标工作负载接受哪种流量：

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: prod
spec:
  mtls:
    mode: STRICT
```

模式：

- `PERMISSIVE`：同时接受 mTLS 和明文，适合迁移期
- `STRICT`：只接受 mTLS
- `DISABLE`：关闭 mTLS，不建议使用

迁移顺序：

1. 保持 `PERMISSIVE`
2. 把所有客户端接入网格
3. 查看 `istio_requests_total{connection_security_policy="mutual_tls"}` 与 `connection_security_policy="unknown"` 的比例，确认明文流量归零
4. 按命名空间或工作负载切到 `STRICT`
5. 观察错误率，确认后再扩大范围

可以按端口覆盖：

```yaml
portLevelMtls:
  8080:
    mode: STRICT
```

### mTLS 验证与失败模式

不要用“服务能通”证明 mTLS 生效。至少验证三件事：

1. **连接安全策略**：`istio_requests_total{connection_security_policy="mutual_tls"}` 的比例；`unknown` 代表明文或未识别。
2. **证书身份**：`istioctl proxy-config secret <pod>` 看证书链、SAN、有效期；`istioctl x describe pod` 看工作负载身份和 mTLS 状态。
3. **策略结果**：从不同命名空间/不同 ServiceAccount 发起请求，确认该拒绝的被拒绝。

常见 503/TLS 失败：

| 现象 | 根因 |
| --- | --- |
| 切 `STRICT` 后部分调用 503 | 仍有客户端没有 Sidecar，或走了明文 |
| 全网格突然 TLS 失败 | 根证书/中间证书过期，或轮换不完整 |
| 跨集群 TLS 失败 | trust domain/根证书不一致 |
| 单服务 TLS 失败 | PeerAuthentication 的端口/selector 覆盖错误 |
| 证书 SAN 不匹配 | 授权 principal 写错，或 ServiceAccount 不一致 |
| 时间相关失败 | 节点时钟漂移，证书未生效/已过期 |

再强调一次：mTLS 只提供传输层身份认证，不提供授权。开了 STRICT 但没有 AuthorizationPolicy，任何持有合法证书的工作负载仍然可以访问。

## JWT 认证

`RequestAuthentication` 校验终端用户 JWT：

```yaml
apiVersion: security.istio.io/v1
kind: RequestAuthentication
metadata:
  name: jwt
  namespace: prod
spec:
  selector:
    matchLabels:
      app: api
  jwtRules:
  - issuer: "https://example.com"
    audiences: ["api.example.com"]
    jwksUri: "https://example.com/.well-known/jwks.json"
    forwardOriginalToken: true
```

`RequestAuthentication` 会拒绝携带**无效凭证**的请求；完全不带凭证的请求默认放行，但没有认证身份。要强制要求 JWT，必须再配合 `AuthorizationPolicy` 的 `requestPrincipals`。

### JWT 的边界与细节

`RequestAuthentication` 只做“凭证校验”，不做“是否允许访问”。它的典型配置项：

- **issuer**：必须与 token 的 `iss` 完全匹配。
- **jwksUri**：公钥地址；istiod/代理会缓存并周期刷新，JWKS 不可达会导致新 token 无法验证。
- **audiences**：校验 `aud`，不要只验签名。
- **fromHeaders / fromParams / fromCookies**：token 从哪里取；默认 `Authorization: Bearer`。
- **forwardOriginalToken**：是否把原始 token 继续转给上游。
- **outputPayloadToHeader**：把解析后的 claims 放到指定 header，供上游使用；注意不要泄露敏感 claim。
- **timeout**：JWKS 获取/校验的超时。

校验通过后，`request.auth.claims[...]` 可用于 AuthorizationPolicy 的 `when` 条件；`requestPrincipals` 是 issuer/subject 组成的身份。JWT 的签名、过期、issuer、audience 任何一项不满足都应拒绝，不能只验“有没有 token”。

## 授权原理

`AuthorizationPolicy` 支持 `ALLOW`、`DENY`、`AUDIT`、`CUSTOM`。评估顺序是 `CUSTOM → DENY → ALLOW`：

- 命中 `DENY` 直接拒绝
- 如果有 `ALLOW` 策略，未命中任何 `ALLOW` 的请求被拒绝
- 如果没有 `ALLOW` 策略，默认允许，除非命中 `DENY`

![授权评估顺序](https://istio.io/latest/docs/concepts/security/authz-eval.svg)

*图 7：Istio 官方授权评估顺序*

默认拒绝示例：

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: deny-all
  namespace: prod
spec:
  {}
```

只允许带合法 JWT 的 GET 请求：

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: allow-api
  namespace: prod
spec:
  selector:
    matchLabels:
      app: api
  action: ALLOW
  rules:
  - from:
    - source:
        requestPrincipals: ["https://example.com/*"]
    to:
    - operation:
        methods: ["GET"]
        paths: ["/api/*"]
```

企业实践：

- 使用 `ALLOW` + 正向匹配，或 `DENY` + 负向匹配，避免策略绕过
- 不要用过于宽泛的 `paths: ["/*"]` 和 `methods: ["*"]`
- 健康检查、指标端口单独放行
- 策略变更先在测试命名空间验证，再通过 GitOps 推广

### 授权语义与边界

`AuthorizationPolicy` 的评估顺序是 **CUSTOM → DENY → ALLOW**：

- 命中 `DENY` 立即拒绝，优先级最高。
- 如果有 `ALLOW` 策略，未命中任何 `ALLOW` 的请求被拒绝。
- 如果没有任何 `ALLOW` 策略，默认允许（除非命中 `DENY`）。

所以“默认拒绝”必须显式创建一条空规则：

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: deny-all
  namespace: prod
spec: {}
```

常用匹配维度：

| 维度 | 字段 | 注意 |
| --- | --- | --- |
| 工作负载身份 | `principals` / `notPrincipals` | SPIFFE 格式，注意 trust domain |
| 信任域 | `trustDomains` / `notTrustDomains`（1.31） | 跨集群/多 CA 场景 |
| 命名空间 | `source.namespaces` | 比 IP 稳定 |
| IP | `remoteIpBlocks` / `ipBlocks` | 经过代理后是代理 IP，慎用 |
| 方法/路径 | `methods` / `paths` | 注意路径规范化、编码、尾斜杠 |
| JWT claims | `request.auth.claims[...]` | 需要 RequestAuthentication |
| 条件 | `when` | key 如 `request.headers[...]`、`source.ip` |

几个容易写错的地方：

- `paths: ["/api/*"]` 的匹配语义受实现和规范化影响，管理接口要单独列出并默认拒绝。
- 只写 `ALLOW` 不允许任何未匹配请求，但如果没有 `ALLOW`，默认是允许；不要以为“加了策略就默认拒绝”。
- `DENY` 适合做“黑名单/兜底”，`ALLOW` 适合做“白名单”；混用时先想清楚优先级。
- `CUSTOM` 走外部授权服务（ext_authz），要设计超时、失败开放/关闭和缓存，否则外部服务抖动会放大为全站故障。
- `AUDIT` 只记录不阻断，适合上线前观察策略命中情况。

Ambient 中，L4 策略由 ztunnel 执行，L7 策略由目标 waypoint 执行。从 1.25 起可以用 `targetRefs` 把策略绑定到 `istio-waypoint` GatewayClass，实现 waypoint 级默认拒绝；这类策略必须放在 root namespace（通常是 `istio-system`），且 `selector` 与 `targetRefs` 二选一。

## Ambient 下的安全

- ztunnel 负责 L4 mTLS、认证和 L4 授权
- L7 授权、JWT、VirtualService 需要 waypoint
- L4 策略由 ztunnel 执行，L7 策略由目标 waypoint 执行
- waypoint 是否在路径上取决于流量原始目标（Service 还是 Pod IP）以及 `istio.io/waypoint-for`
- 从 Istio 1.25 起，可以把 `AuthorizationPolicy` 通过 `spec.targetRefs` 绑定到 `istio-waypoint` `GatewayClass`，实现 waypoint 级别的默认拒绝。这类策略必须放在 root namespace（通常是 `istio-system`），且 `selector` 与 `targetRefs` 二选一

## 安全落地顺序

1. 全网格启用 mTLS，最终切到 `STRICT`
2. 默认拒绝，再按服务逐个放行
3. 对外接口接入 JWT 或外部授权
4. 收紧 Gateway `hosts`，禁止通配符
5. 出口统一走 Egress Gateway + NetworkPolicy
6. 接入外部 CA，统一证书生命周期
7. 限制 istiod 调试端口和集群内访问

## 威胁模型

| 威胁 | Istio 的控制 | 残余风险 |
| --- | --- | --- |
| Pod 被攻破后横向扫描 | mTLS + L4/L7 授权限制可达服务 | 被攻破工作负载可用自己的合法身份访问被允许的服务 |
| 中间人窃听 | 自动 mTLS | 绕过代理的流量、网格外流量、网关终止后的明文段 |
| 身份伪造 | SPIFFE + 证书校验 | CA/控制面被攻破、节点 root、证书私钥泄露 |
| 未授权 API 调用 | AuthorizationPolicy + JWT | 策略写错、路径绕过、业务逻辑漏洞 |
| 供应链恶意镜像 | 镜像签名/准入控制（Mesh 之外） | Istio 不负责镜像可信 |
| 数据外泄 | ServiceEntry + Egress Gateway + NetworkPolicy | 直连 IP、DNS 隧道、被允许的外部服务 |
| 拒绝服务 | 连接池、熔断、限流 | Istio 不是抗 DDoS 设备 |
| 控制面被攻破 | 最小权限、调试端口认证、网络策略 | 可签发证书/推送配置，影响面接近全网格 |

Mesh 的安全价值是“把身份和策略变成默认路径”，不是“让应用自动安全”。应用自身的输入校验、权限模型、密钥管理仍然是第一道防线。

# 可观测性

## 指标原理

Envoy 在数据面统计请求量、延迟、错误和 TCP 指标，再暴露给 Prometheus。常见指标：

- `istio_requests_total`
- `istio_request_duration_milliseconds`
- `istio_request_bytes`
- `istio_response_bytes`
- `istio_tcp_connections_opened_total`
- `istio_tcp_connections_closed_total`

这些指标带有 `source_workload`、`destination_workload`、`response_code`、`reporter` 等标签。`reporter` 区分 `source` 和 `destination`：同一笔请求会同时被源代理和目标代理统计，计算错误率时要明确用哪一侧，避免重复计算。

## 指标语义与排障

做 SLO 时先确定口径：

- **source**：调用方视角，适合衡量“用户/上游看到的成功率与延迟”。
- **destination**：服务端视角，适合衡量“服务实际处理了多少请求、失败在哪”。
- 两边都看，才能区分“请求没到”和“到了但失败”。

`response_flags` 比 HTTP 状态码更接近根因：

| flag | 含义 | 常见原因 |
| --- | --- | --- |
| `UF` | upstream connection failure | 连接失败、端口错、mTLS 握手失败 |
| `UC` | upstream connection termination | 上游主动断开、超时、协议不匹配 |
| `UO` | upstream overflow | 连接池/熔断/队列溢出 |
| `UH` | no healthy upstream | 没有健康 Endpoint、readiness 失败 |
| `NR` | no route | host/route 不匹配 |
| `URX` | retry limit exceeded | 重试次数耗尽 |
| `-` | 正常 | 无特殊事件 |

其他关键标签：

- `connection_security_policy="mutual_tls"`：确认 mTLS 是否真的生效。
- `destination_service` / `destination_service_name`：注意不同版本/指标的名称差异。
- `request_protocol`：HTTP/1.1、HTTP/2、gRPC、TCP。
- `response_code`：注意 `0` 表示无 HTTP 响应（如 TCP 或连接失败）。

延迟要看直方图/分位数，不要只看平均值。`istio_request_duration_milliseconds` 是直方图，配合 `histogram_quantile` 计算 P50/P90/P99；平均值会被长尾和采样掩盖。

## 控制面可观测性

数据面指标只能解释“请求发生了什么”，控制面指标解释“配置为什么没到”：

| 指标 | 用途 |
| --- | --- |
| `pilot_xds` | 当前连接的代理数 |
| `pilot_xds_pushes` | 按类型统计的推送次数 |
| `pilot_xds_push_time` | 推送耗时分布 |
| `pilot_xds_push_context_errors` | 推送上下文生成错误 |
| `pilot_xds_expired_nonce` | 过期 nonce，通常意味着代理处理慢或推送积压 |
| `citadel_server_csr_count` | 证书签发量 |
| `citadel_server_root_cert_expiry_timestamp` | 根证书到期时间 |

控制面看板至少包含：istiod 副本数/CPU/内存、xDS 连接数、推送耗时 P99、NACK/STALE 数量、证书签发失败率、根证书剩余天数、webhook 延迟。

## Telemetry API

`telemetry.istio.io/v1` 用于统一配置指标、日志和追踪，不再依赖旧版 `EnvoyFilter`。

减少指标标签示例：

```yaml
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: reduce-cardinality
  namespace: istio-system
spec:
  metrics:
  - providers:
    - name: prometheus
    overrides:
    - match:
        metric: REQUEST_COUNT
        mode: CLIENT
      tagOverrides:
        destination_service:
          operation: REMOVE
```

### 匹配与覆盖

`Telemetry` 资源可以按工作负载/命名空间选择器生效，也可以在 root namespace 配置全局默认。常见用法：

- `metrics[].overrides[]`：按 `metric` 和 `mode`（CLIENT/SERVER）覆盖标签。
- `tagOverrides`：删除高基数标签或重命名。
- `accessLogging[]`：启用/禁用访问日志，选择 provider。
- `tracing[]`：设置采样率和自定义 tag。

注意：

- `Telemetry` 的资源选择器和 `AuthorizationPolicy` 不同，它不影响安全，只影响遥测。
- 覆盖标签会改变指标语义，改完后要同步更新看板和告警。
- 访问日志和追踪都有成本，按服务和错误率采样，不要全量。

## SLO 与重试

重试会让“用户失败率”和“后端失败率”分叉：

- 后端 10% 失败，重试 3 次后用户失败率可能降到 34.4%，但后端承受了额外 11% 的尝试。
- SLO 应基于 source 侧的最终结果，同时单独监控 destination 侧的尝试级失败率。
- 错误预算要扣除重试放大带来的额外负载，否则会出现“SLO 达标但后端已过载”的假象。

建议同时建三块看板：

1. **入口/核心服务 SLO**：source 侧成功率、P99、流量。
2. **依赖健康**：destination 侧错误率、`response_flags`、连接池。
3. **控制面健康**：xDS 同步、证书、webhook、推送延迟。

## 访问日志

通过 Telemetry API 开启：

```yaml
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: access-log
  namespace: istio-system
spec:
  accessLogging:
  - providers:
    - name: envoy
```

访问日志字段包括源/目标工作负载、响应码、耗时、上游地址、请求 ID 等。高流量服务要注意日志量和采样，避免磁盘和日志后端被打满。

## 链路追踪

- Istio 支持 W3C Trace Context、B3 等传播格式
- 后端可接 Jaeger、Tempo、Zipkin 或企业 APM
- 采样率通过 Telemetry API 或 meshConfig 配置
- 生产环境不要 100% 采样，按流量和排障需求调整
- 确保应用把 trace header 继续向下游传递

## Kiali 与 Grafana

- Kiali：拓扑、配置校验、流量与错误可视化
- Grafana：Istio 标准仪表盘，观察延迟、错误率、mTLS 比例
- Prometheus：采集 Istio 标准指标和 Envoy 指标

## 指标基数治理

指标基数爆炸通常来自高基数标签，例如 URL、用户 ID、请求 ID。治理方式：

- 用 Telemetry API 删除不必要的标签
- 用 recording rules 做 workload 级别聚合
- 用 recording rules 预聚合后，再通过 federation 或 remote write 只保留聚合后的 series；federation 本身不做聚合
- 控制 `istio_requests_total` 的维度，不要把所有业务标签都加到指标上

# 企业实践

## 版本与升级原则

- 控制面与数据面分开升级，使用 revision 做金丝雀。
- 关注 Istio 支持的 Kubernetes 版本和官方版本偏差策略，不要让偏差长期存在。
- 保留旧 revision 一段时间，确认稳定后再删除。
- 详细步骤、1.31 注意事项和故障域见 [升级与故障学](#升级与故障学)。

## 多租户与命名空间

- 一个团队一个命名空间，Sidecar 注入、NetworkPolicy、配额都在命名空间维度管理
- 用 `Sidecar` 资源限制每个命名空间订阅的配置，降低 xDS 压力；它不是访问控制
- 用 `discoverySelectors` 控制 istiod 只发现指定命名空间。它只影响配置发现，不是网络隔离或授权；排除命名空间后，跨命名空间访问可能表现为无配置或 503
- 用 NetworkPolicy 限制跨命名空间访问，不要只依赖 AuthorizationPolicy
- 网关按业务域拆分，避免所有团队共用一个入口网关

## 配置管理

- 所有 Istio CRD 纳入 GitOps，禁止手工 `kubectl edit`
- 每个服务从第一天就配置默认路由，避免新版本上线后自动接流量
- 新增 subset 遵循 make-before-break
- 大型 VirtualService/DestinationRule 按团队或服务拆分，避免单文件冲突
- 同一 host 的多个 DestinationRule 会被合并，但同名 subset 以第一个为准，重复定义被丢弃；建议一个 host 只用一个 DestinationRule
- CI 中执行 `istioctl analyze`，把配置错误拦在合并前

## 网关实践

- 入口和出口分开部署，独立 HPA 和资源配额
- `Gateway.servers[].hosts` 只写明确域名，禁止 `*`
- TLS 证书由 cert-manager 或企业 CA 管理，设置到期告警
- 入口网关不要暴露 admin/debug 端口
- 多集群场景使用 East-West Gateway，东西向流量单独规划
- 网关的副本数、连接数和 CPU 要按峰值流量压测

## 性能与容量

### 延迟路径

| 模式 | 请求路径 | 额外跳数 |
| --- | --- | --- |
| 无 Mesh | 应用 → 应用 | 0 |
| Sidecar | 应用 → 客户端 Envoy → 服务端 Envoy → 应用 | 2 个代理 |
| Ambient（仅 L4） | 应用 → 源 ztunnel → 目的 ztunnel → 应用 | 2 个节点代理 |
| Ambient + waypoint | 应用 → ztunnel → waypoint → ztunnel → 应用 | 3 个代理 |

每跳代理都会带来解析、路由、TLS、队列和 CPU 调度成本。mTLS 握手可以靠连接复用摊薄，但 **p99 对 CPU throttling 极其敏感**：代理被限流时，排队延迟会直接反映到业务尾延迟。

### 官方性能基线

Istio 官方性能文档（1.24 基准，1 KB payload、mTLS、2 worker threads、1000 rps）给出：

| 组件 | CPU | 内存 |
| --- | --- | --- |
| Sidecar Envoy | ~0.20 vCPU | ~60 MB |
| Waypoint Envoy | ~0.25 vCPU | ~60 MB |
| ztunnel | ~0.06 vCPU | ~12 MB |

这些数字只适合做数量级估算：

- Sidecar 成本是**每 Pod**，Pod 多、流量低时固定成本高。
- ztunnel 成本是**每节点**，与 Pod 密度无关。
- waypoint 成本是**每副本**，共享范围越大，单位服务成本越低，但爆炸半径越大。
- 内存强依赖配置规模（Listener/Cluster/Route 数量），不能只看基准值。

### 成本模型

```text
Sidecar 成本 ≈ Σ(Pod 数 × 单代理 CPU/内存 × 单价) + 控制面 + 可观测性存储
Ambient 成本 ≈ Σ(节点数 × ztunnel 成本) + Σ(waypoint 副本 × 成本) + 控制面 + 存储
```

示例（仅示意）：

- 500 个 Pod，每 Pod 峰值 1000 rps：Sidecar 约 `500 × 0.20 = 100 vCPU`、`30 GB` 内存。
- 同样负载在 20 个节点：ztunnel 约 `20 × 0.06 = 1.2 vCPU`、`240 MB`。
- 2 个 waypoint 副本：约 `0.5 vCPU`、`120 MB`。

但真实 TCO 还包括：为代理预留的节点碎片、控制面副本、etcd 压力、指标/日志/追踪存储、平台团队人力、升级窗口和故障风险。

### 容量规划清单

- 服务数、Endpoint 数、配置对象数。
- 每 Pod/每节点 RPS、连接数、并发请求数。
- 协议分布（HTTP/1.1、HTTP/2、gRPC、TCP）。
- 变更频率（HPA、滚动发布、批处理）。
- 代理 CPU limit 与 throttling；`concurrency` 要与 CPU 匹配。
- 单 Envoy 配置内存、istiod 堆内存、xDS 推送耗时。
- 节点 ulimit、conntrack、文件描述符、内核参数。
- 可观测性采样率和保留周期。

### 工程优化

- 给 Sidecar 设置合理 requests/limits，避免被业务挤占；CPU limit 过低会导致尾延迟抖动。
- 高并发场景调整 `concurrency`，不要完全依赖默认值。
- 开启 `holdApplicationUntilProxyStarts`，避免应用先于代理启动导致启动期请求失败：

```yaml
metadata:
  annotations:
    proxy.istio.io/config: '{"holdApplicationUntilProxyStarts": true}'
```

- 对不需要经过网格的出站端口使用 `traffic.sidecar.istio.io/excludeOutboundPorts` 排除；不要把业务端口排除。
- 大规模集群用 `Sidecar` 和 `discoverySelectors` 控制配置规模。
- Ambient 下 ztunnel 随节点数增长，waypoint 随作用域和流量增长；waypoint 要按爆炸半径做 HPA/PDB。
- 接近 4 万 workload 时关注 1.31 的 WDS 重连消息大小问题，必要时调大 `ISTIO_GPRC_MAXRECVMSGSIZE`。
- 压测要测 p99、CPU throttling、连接复用和错误率，不要只测单跳 echo 的平均延迟。

## 可观测性落地

- 先统一指标、日志、追踪的采集标准，再谈告警
- 用 SLO 驱动告警，而不是对所有 5xx 都告警
- 区分 `source` 和 `destination` 的指标，避免错误率重复计算
- 为入口网关、核心服务、控制面分别建看板
- 控制面要监控 istiod 的 xDS 推送、证书签发和队列积压

## VM 与非 Kubernetes 工作负载

- VM 工作负载通过 `WorkloadEntry`/`WorkloadGroup` 接入，证书和健康检查由 istio-agent 负责。
- VM 需要能访问 istiod（15012）和集群网络；跨网络时走 East-West Gateway。
- VM 的启动顺序、时钟同步、证书挂载和自动注册是主要故障源。
- 多集群/多网络的完整模型见 [多集群与多网络](#多集群与多网络)。

## 常见反模式

- 用 `EnvoyFilter` 改核心配置：低层逃生舱，升级容易失效，优先用 Telemetry、WasmPlugin、Gateway API
- `Gateway` 使用 `hosts: ["*"]`：任何 VirtualService 都能绑定，容易暴露意外域名
- 没有默认路由：新版本一上线就自动接流量
- 同一命名空间混用 Sidecar 和 Ambient：行为难以预测
- 把 `REGISTRY_ONLY` 当安全边界：绕过 Sidecar 的流量仍可出网
- 把 `Sidecar` 当出站访问控制：它只限制配置范围，不阻断流量
- 指标标签不加控制：Prometheus 基数和成本失控
- 只配 mTLS 不配授权：有合法证书的客户端仍能访问所有服务

# 升级与故障学

## 1.31 升级注意事项

从 1.30 升到 1.31 时，至少检查以下变化：

| 变化 | 影响 | 动作 |
| --- | --- | --- |
| WDS 重连消息变大 | 约 4 万 workload 可能超过 4MiB gRPC 限制，ztunnel 重连循环 | 调大 `ISTIO_GPRC_MAXRECVMSGSIZE`，观察 `ResourceExhausted` |
| 默认发送不健康 Endpoint | 后端异常时仍可能接流量 | 配置 `OutlierDetection.minHealthPercent`，或评估 `PILOT_AUTO_SEND_UNHEALTHY_ENDPOINTS=false` |
| XDS `api` generator 要求控制面身份 | 非系统命名空间的自定义 MCP 消费者被拒绝 | 使用受支持的身份，或评估 `ENABLE_XDS_API_GENERATOR_AUTH=false` |
| Gateway API CRD 最低版本 | 低版本资源被静默过滤，TLS passthrough 可能失效 | 升级 CRD；`istioctl analyze` 会报 `IST0176` |
| `PILOT_SPAWN_UPSTREAM_SPAN_FOR_GATEWAY` 移除 | 无法再关闭网关上游独立 span | 调整追踪采样/后端容量 |
| 严格 Gateway 合并默认开启 | 跨命名空间 Istio Gateway 与托管 Gateway API 不再合并 | 检查多命名空间网关配置，必要时设置 `PILOT_ENABLE_STRICT_GATEWAY_MERGING=false` |

## 升级策略

- **控制面先行**：先安装新 revision 的 istiod，旧 revision 继续服务存量 Sidecar。
- **数据面分批**：按命名空间/工作负载切换 `istio.io/rev` 并重建 Pod；Sidecar 升级必然伴随 Pod 重建。
- **Ambient 分层**：先 istiod，再 ztunnel DaemonSet，最后 waypoint；应用 Pod 通常无需重建，但要验证 HBONE、L4/L7 策略和 waypoint 路由。
- **版本偏差**：遵循官方支持矩阵，通常控制面可以领先数据面一个小版本；不要让偏差长期存在。
- **回滚**：保留旧 revision 和旧镜像；回滚时切回 `istio.io/rev` 并重建 Pod。Ambient 要同时回滚 ztunnel/waypoint。
- **升级前**：`istioctl x precheck`、`istioctl analyze -A`、备份 CRD、确认 Gateway API CRD 版本、检查证书剩余寿命。
- **升级后**：`proxy-status` 全部 `SYNCED`，mTLS 比例不下降，错误率/P99 无回归，证书签发正常。

## 故障域

| 组件 | 故障影响 | 数据面是否继续 | 关键动作 |
| --- | --- | --- | --- |
| istiod | 新配置、注入、证书轮换停止 | 已下发配置继续转发 | 多副本、PDB、跨 AZ、证书 TTL 余量 |
| 注入 Webhook | 新 Pod 创建被拒绝（`failurePolicy: Fail`） | 存量 Pod 不受影响 | webhook 多副本、预检、变更窗口 |
| CA | 新证书签发失败 | 证书到期前继续 | 外部 CA HA、根证书备份、到期告警 |
| xDS | 配置 NACK/STALE | 旧配置继续 | `proxy-status`、`analyze`、配置回滚 |
| ztunnel | 节点上 Ambient Pod 连通性受损 | 该节点不继续 | DaemonSet 自愈、节点隔离、监控 |
| waypoint | 作用域内 L7 策略/路由失效 | 该作用域受影响 | HPA/PDB、按安全边界拆分、金丝雀 |
| CNI | 新 Pod 无重定向/启动失败 | 存量可能不受影响 | CNI 日志、repair、节点排空 |
| 网关 | 南北向/东西向入口中断 | 内部东西向可能不受影响 | 多副本、跨 AZ、容量与 PDB |
| DNS | 解析失败/延迟 | 依赖 DNS 的调用失败 | DNS 代理、CoreDNS、`ServiceEntry` 监控 |

## 故障排查顺序

1. **定范围**：单 Pod、单服务、单命名空间、单节点、单集群，还是全网格？
2. **定路径**：请求走 Sidecar、ztunnel 还是 waypoint？看 listener/route/cluster/endpoint。
3. **定身份**：mTLS 是否成功？证书是否有效？principal/trust domain 是什么？
4. **定策略**：PeerAuthentication、RequestAuthentication、AuthorizationPolicy 哪条命中？
5. **定控制面**：`proxy-status` 是否 STALE/NACK？istiod 是否在推送？证书是否在轮换？
6. **定数据面**：CPU throttling、连接池、Endpoint 健康、DNS。
7. **最后抓包**：`tcpdump`、ztunnel 日志、Hubble，验证“配置”和“实际流量”是否一致。

# 排障

## 常用命令

```bash
istioctl analyze -A
istioctl proxy-status
istioctl proxy-config cluster <pod> -n <ns>
istioctl proxy-config route <pod> -n <ns>
istioctl proxy-config listener <pod> -n <ns>
istioctl proxy-config endpoint <pod> -n <ns>
istioctl proxy-config secret <pod> -n <ns>
istioctl x describe pod <pod> -n <ns>
istioctl dashboard kiali
istioctl bug-report
```

Ambient 模式下 ztunnel 的配置、证书和连接状态用 `istioctl ztunnel-config` 系列命令查看（子命令以 `istioctl ztunnel-config --help` 为准）；`proxy-status` 主要看 waypoint/Envoy。

## 注入失败

检查：

- 命名空间是否有 `istio-injection=enabled` 或 `istio.io/rev`
- Pod 是否有 `sidecar.istio.io/inject: "false"`
- 是否同时设置了 `istio-injection` 和 `istio.io/rev`
- istiod 注入 Webhook 是否健康
- Pod 是否已经创建在注入标签生效之前

## 503 排查

先看响应码和 Envoy response flags：

- `UF`：上游连接失败；若启用 Istio 认证，先查 mTLS 冲突
- `UH`：没有健康上游，检查 Endpoint、就绪探针、subset 标签
- `UO`：上游连接池/熔断溢出（circuit breaking）
- `URX`：上游重试次数超限
- `NR`：没有匹配路由，检查 VirtualService host、Gateway 绑定和端口

排查顺序：

1. `istioctl proxy-config endpoint <pod>` 看上游是否存在
2. `istioctl proxy-config route <pod>` 看路由是否命中
3. 对比源 Sidecar 和目标 Sidecar 的配置
4. 检查 NetworkPolicy、mTLS 模式和证书
5. 必要时在 Pod 内抓包

## 证书与 mTLS 问题

- `PeerAuthentication` 切成 `STRICT` 后出现 503，通常是仍有明文客户端
- 检查客户端是否注入 Sidecar
- 检查证书是否过期、istiod CA 是否正常
- 多集群场景检查信任域和根证书是否一致
- 用 `istioctl proxy-config secret <pod>` 查看证书状态

## 配置不生效

- `istioctl analyze` 是否有警告
- `proxy-status` 是否 `SYNCED`
- VirtualService 的 `hosts` 是否与 Service 名称/命名空间匹配
- Gateway 的 `hosts` 是否允许该域名
- subset 是否在 DestinationRule 中定义
- 是否被更具体的路由或 AuthorizationPolicy 覆盖

## 性能问题

- 对比注入前后的延迟和 CPU
- 检查 Sidecar 的 `concurrency` 和资源限制
- 检查是否有大量 503/重试导致放大
- 检查 xDS 配置大小和推送频率
- 大规模集群评估改用 Ambient，减少每 Pod 代理开销

## Ambient 排障

Ambient 的排障入口与 Sidecar 不同：

```bash
# ztunnel 视角：工作负载、服务、连接、证书
istioctl ztunnel-config workload
istioctl ztunnel-config service
istioctl ztunnel-config connections
istioctl ztunnel-config certificates
istioctl ztunnel-config all

# waypoint 是 Envoy，仍然用 proxy-status / proxy-config
istioctl proxy-status
istioctl proxy-config route <waypoint-pod> -n <ns>

# 看 ztunnel 日志和 CNI 日志
kubectl logs -n istio-system -l app=ztunnel --tail=200
kubectl logs -n istio-system -l app=istio-cni --tail=200
```

常见问题：

- **L4 通、L7 策略不生效**：目标没有 waypoint，或 `use-waypoint` 没打对；确认 `waypoint-for` 与原始目标类型。
- **策略配置了但没执行**：流量来自 Sidecar/Gateway/网格外，当前不会经过 waypoint；检查实际路径。
- **Pod 没加入 Ambient**：命名空间/Pod 的 `dataplane-mode` 标签、CNI 就绪状态、Pod 是否在标签生效前创建。
- **节点上所有 Ambient Pod 异常**：先看该节点 ztunnel 是否健康，再排 CNI/内核。
- **mTLS 失败**：看 `ztunnel-config certificates` 的证书和身份，确认 trust domain 与策略 principal 一致。
- **ingress 不走 waypoint**：默认就不走；需要 `ingress-use-waypoint=true` 且 istiod 开启 `ENABLE_INGRESS_WAYPOINT_ROUTING`。

# 最佳实践清单

- [ ] 使用 revision 升级，istiod 至少 2 副本
- [ ] 切换 revision 时先移除 `istio-injection`
- [ ] 每个服务配置默认路由
- [ ] 新增 subset 使用 make-before-break
- [ ] Gateway `hosts` 收紧，不使用 `*`
- [ ] mTLS 从 `PERMISSIVE` 迁移到 `STRICT`
- [ ] 默认拒绝授权，按服务放行
- [ ] 对外接口启用 JWT 或外部授权
- [ ] 出口流量走 Egress Gateway + NetworkPolicy
- [ ] 用 `Sidecar` 限制配置可见范围，但不把它当访问控制
- [ ] 控制指标基数，配置日志轮转和采样
- [ ] 所有配置纳入 GitOps，CI 执行 `istioctl analyze`
- [ ] 避免 EnvoyFilter，优先使用官方扩展点
- [ ] 同一命名空间不要混用 Sidecar 和 Ambient
- [ ] 定期演练证书轮换、控制面故障和网关扩容
- [ ] 1.31 升级前检查 WDS 消息大小、不健康 Endpoint 默认行为、Gateway API CRD 版本
- [ ] Ambient waypoint 按安全边界拆分，配置 HPA/PDB，并验证 Sidecar/Gateway 流量路径
- [ ] 多集群校验 trust domain、根证书和同名命名空间合并
- [ ] 用 source/destination 两种口径和 response_flags 建 SLO 看板
- [ ] 性能基线同时测量 P99、CPU throttling 和连接复用
- [ ] 证书根轮换、CA 故障、istiod 全挂都有演练记录

# 附录

## 命令速查

```bash
# 安装与升级
istioctl install --set profile=default -y
istioctl x precheck
istioctl install --set revision=1-31-3
istioctl analyze -A

# 注入
istioctl kube-inject -f app.yaml --revision=1-31-3 | kubectl apply -f -

# Ambient
istioctl waypoint apply -n default --enroll-namespace
istioctl ztunnel-config --help

# 诊断
istioctl proxy-status
istioctl proxy-config cluster <pod> -n <ns>
istioctl proxy-config route <pod> -n <ns>
istioctl proxy-config endpoint <pod> -n <ns>
istioctl proxy-config secret <pod> -n <ns>
istioctl x describe pod <pod> -n <ns>
istioctl bug-report

# 查看
kubectl get virtualservice,destinationrule,gateways.networking.istio.io,serviceentry -A
kubectl get gateways.gateway.networking.k8s.io -A
kubectl get peerauthentication,requestauthentication,authorizationpolicy -A
kubectl get telemetry -A
```

## API 版本

| 资源 | API |
| --- | --- |
| VirtualService、DestinationRule、Gateway、ServiceEntry、Sidecar、WorkloadEntry | `networking.istio.io/v1` |
| WorkloadGroup | `networking.istio.io/v1` |
| PeerAuthentication、RequestAuthentication、AuthorizationPolicy | `security.istio.io/v1` |
| Telemetry | `telemetry.istio.io/v1` |
| WasmPlugin | `extensions.istio.io/v1alpha1` |
| EnvoyFilter | `networking.istio.io/v1alpha3` |
| Gateway、HTTPRoute、GRPCRoute | `gateway.networking.k8s.io/v1` |

安装后可用 `kubectl api-resources | grep istio` 核对当前集群实际支持的版本。

## 参考资料

- [Istio 官方文档](https://istio.io/latest/docs/)
- [Istio 架构](https://istio.io/latest/docs/ops/deployment/architecture/)
- [流量管理](https://istio.io/latest/docs/concepts/traffic-management/)
- [安全](https://istio.io/latest/docs/concepts/security/)
- [Ambient 模式](https://istio.io/latest/docs/ambient/overview/)
- [Ambient 数据面](https://istio.io/latest/docs/ambient/architecture/data-plane/)
- [Ambient 控制面](https://istio.io/latest/docs/ambient/architecture/control-plane/)
- [HBONE](https://istio.io/latest/docs/ambient/architecture/hbone/)
- [Ambient 流量重定向](https://istio.io/latest/docs/ambient/architecture/traffic-redirection/)
- [Waypoint](https://istio.io/latest/docs/ambient/usage/waypoint/)
- [安装指南](https://istio.io/latest/docs/setup/install/)
- [Sidecar 注入](https://istio.io/latest/docs/setup/additional-setup/sidecar-injection/)
- [Istio CNI](https://istio.io/latest/docs/setup/additional-setup/cni/)
- [部署模型](https://istio.io/latest/docs/ops/deployment/deployment-models/)
- [DNS](https://istio.io/latest/docs/ops/configuration/traffic-management/dns/)
- [出口网关](https://istio.io/latest/docs/tasks/traffic-management/egress/egress-gateway/)
- [诊断工具](https://istio.io/latest/docs/ops/diagnostic-tools/istioctl/)
- [调试 Envoy 与 Istiod](https://istio.io/latest/docs/ops/diagnostic-tools/proxy-cmd/)
- [部署最佳实践](https://istio.io/latest/docs/ops/best-practices/deployment/)
- [安全最佳实践](https://istio.io/latest/docs/ops/best-practices/security/)
- [流量管理最佳实践](https://istio.io/latest/docs/ops/best-practices/traffic-management/)
- [可观测性最佳实践](https://istio.io/latest/docs/ops/best-practices/observability/)
- [Istio 1.31 发布说明](https://istio.io/latest/news/releases/1.31.x/announcing-1.31/)
- [Istio 1.31 变更说明](https://istio.io/latest/news/releases/1.31.x/announcing-1.31/change-notes/)
- [Istio 1.31 升级说明](https://istio.io/latest/news/releases/1.31.x/announcing-1.31/upgrade-notes/)

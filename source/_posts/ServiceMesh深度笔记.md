---
title: Service Mesh 深度笔记
tags: [Service Mesh, Istio, Linkerd, Cilium, Gateway API, 云原生]
categories: [服务网格]
date: 2026-10-23 10:00:00
comments: false
---

本文基于 2026-10 抓取到的最新官方文档编写：**Istio 1.31.3**、**Linkerd 2.20**、**Cilium 1.20.3**，以及 **Gateway API**（GAMMA 自 v1.1 进入 Standard Channel）。重点不是 YAML 大全，而是从架构师视角讲清 Service Mesh 的第一性原理、数据面谱系、控制面协议、身份与策略、性能成本模型、故障学和选型演进。

与《Istio 笔记》的分工：那篇讲 Istio 的安装、配置和排障；这篇讲“为什么这样设计、什么时候该用、代价是什么、如何不把自己搞挂”。

最后更新：2026-10-23

<!--more-->

- [版本与事实基线](#%E7%89%88%E6%9C%AC%E4%B8%8E%E4%BA%8B%E5%AE%9E%E5%9F%BA%E7%BA%BF)
- [第一性原理：Mesh 到底在解决什么](#%E7%AC%AC%E4%B8%80%E6%80%A7%E5%8E%9F%E7%90%86mesh-%E5%88%B0%E5%BA%95%E5%9C%A8%E8%A7%A3%E5%86%B3%E4%BB%80%E4%B9%88)
- [数据面谱系：Sidecar、Ambient 与 eBPF](#%E6%95%B0%E6%8D%AE%E9%9D%A2%E8%B0%B1%E7%B3%BBsidecarambient-%E4%B8%8E-ebpf)
- [控制面深潜：从 Kubernetes 对象到 xDS](#%E6%8E%A7%E5%88%B6%E9%9D%A2%E6%B7%B1%E6%BD%9C%E4%BB%8E-kubernetes-%E5%AF%B9%E8%B1%A1%E5%88%B0-xds)
- [流量管理深潜：定义失败模型](#%E6%B5%81%E9%87%8F%E7%AE%A1%E7%90%86%E6%B7%B1%E6%BD%9C%E5%AE%9A%E4%B9%89%E5%A4%B1%E8%B4%A5%E6%A8%A1%E5%9E%8B)
- [安全深潜：零信任不是“开了 mTLS”](#%E5%AE%89%E5%85%A8%E6%B7%B1%E6%BD%9C%E9%9B%B6%E4%BF%A1%E4%BB%BB%E4%B8%8D%E6%98%AF%E5%BC%80%E4%BA%86-mtls)
- [可观测性深潜：指标、追踪与基数](#%E5%8F%AF%E8%A7%82%E6%B5%8B%E6%80%A7%E6%B7%B1%E6%BD%9C%E6%8C%87%E6%A0%87%E8%BF%BD%E8%B8%AA%E4%B8%8E%E5%9F%BA%E6%95%B0)
- [性能与容量：一张架构师账单](#%E6%80%A7%E8%83%BD%E4%B8%8E%E5%AE%B9%E9%87%8F%E4%B8%80%E5%BC%A0%E6%9E%B6%E6%9E%84%E5%B8%88%E8%B4%A6%E5%8D%95)
- [生产运维与故障学](#%E7%94%9F%E4%BA%A7%E8%BF%90%E7%BB%B4%E4%B8%8E%E6%95%85%E9%9A%9C%E5%AD%A6)
- [选型、迁移与 TCO](#%E9%80%89%E5%9E%8B%E8%BF%81%E7%A7%BB%E4%B8%8E-tco)
- [架构师检查清单](#%E6%9E%B6%E6%9E%84%E5%B8%88%E6%A3%80%E6%9F%A5%E6%B8%85%E5%8D%95)
- [附录](#%E9%99%84%E5%BD%95)

# 版本与事实基线

| 组件 | 本文基线 | 关键事实 |
| --- | --- | --- |
| Istio | 1.31.3（1.31.0 于 2026-08-31 发布） | 官方支持 Kubernetes 1.32–1.36；Sidecar 与 Ambient 两种数据面可在同一网格共存 |
| Linkerd | 2.20（2026-06-23 发布） | Rust 编写的 linkerd2-proxy；2.20 引入 rate-limit-aware 负载均衡、降低内存、改进指标 |
| Cilium | 1.20.3 | eBPF 数据面，L3/L4 在内核处理，L7 仍借助 Envoy 等代理 |
| Gateway API | GAMMA 自 v1.1 起为 Standard Channel / GA | Mesh 场景下 Route 直接挂到 Service，不使用 Gateway/GatewayClass 作为网格入口 |
| Kubernetes | 1.32+ | Sidecar 容器、EndpointSlice、CNI chaining 等能力是理解数据面的前提 |

> 版本会继续演进，但本文讨论的架构约束不会：代理放在哪、身份从哪里来、配置如何一致地下发、故障域如何切割。

# 第一性原理：Mesh 到底在解决什么

## 通信治理的七个横切关注点

微服务之间的每一次调用，都隐式包含七类问题：

1. **服务发现**：对方现在有哪些可用实例？
2. **负载均衡**：选哪一个实例？按连接、按请求、按延迟，还是一致性哈希？
3. **韧性**：超时多久、重试几次、失败如何隔离、过载如何限流？
4. **身份**：如何证明“我是谁”，又如何验证“你是谁”？
5. **授权**：这个身份能否访问这个方法/路径/租户？
6. **可观测性**：一次调用跨了哪些服务，延迟花在哪，错误码是什么？
7. **流量整形**：灰度、镜像、故障注入、地域/租户路由。

在没有 Mesh 的年代，这些逻辑被三种方式处理：写进 SDK、塞进 API 网关、或者干脆不做。SDK 的问题是语言碎片化和升级困难；网关的问题是只覆盖南北向，东西向仍然裸奔；不做的代价则在大规模故障时一次性偿还。

Service Mesh 的本质，是把这七类逻辑从“应用进程内”下沉到“基础设施进程内”，再用一个统一控制面下发策略。它不是某个代理软件，而是**一组数据面代理 + 一个配置/身份控制面 + 一套运维契约**。

## 从 SDK 到 Sidecar：控制权的转移

| 阶段 | 治理位置 | 优点 | 代价 |
| --- | --- | --- | --- |
| 应用内 SDK | 进程内 | 性能最好、语义最全 | 多语言重复实现、版本碎片、业务侵入 |
| API 网关 | 集群边缘 | 集中、易审计 | 只覆盖南北向，东西向缺失 |
| Sidecar | 每个 Pod | 语言无关、策略统一、故障隔离好 | 每 Pod 一份资源开销、注入与升级复杂 |
| 节点代理 / eBPF | 每节点 / 内核 | 资源摊薄、对应用透明 | 租户隔离、L7 能力、内核依赖、爆炸半径变大 |

这条演进线不是“越新越好”，而是**把复杂度从应用团队转移到平台团队**。架构师真正要回答的是：平台团队有没有能力承接这份复杂度？

## 控制面 / 数据面分离 = 一个分布式控制回路

把 Mesh 看成控制系统，结构非常清晰：

```text
期望状态（K8s CRD / Service / EndpointSlice / 证书策略）
        │  watch + 校验 + 合并
        ▼
控制面（istiod / destination / operator）
        │  xDS / gRPC / 文件 / DNS
        ▼
数据面（Envoy / ztunnel / eBPF / linkerd2-proxy）
        │  转发、加密、限流、上报
        ▼
观测状态（指标、日志、追踪、连接状态）
        │  反馈
        └──────────────► 期望状态修正
```

这个回路有三个天然难点：

- **最终一致性**：控制面下发不是事务。配置变更后，不同代理在不同时间看到不同版本，必须允许“短时间配置不一致”。
- **背压**：一次 CRD 变更可能触发上千个代理重算配置。控制面必须有 debounce、节流、增量推送和范围裁剪。
- **故障域**：控制面挂了，数据面通常还能按最后一份配置继续转发；但新 Pod 注入、证书轮换、配置变更会停。这个“降级但不清零”的特性是 Mesh 可用性的基础。

## Mesh 不解决什么

架构师最容易被“零信任”“全链路加密”这类词带偏。Mesh 的边界必须写清楚：

- **不替代应用鉴权**：mTLS 只证明“工作负载身份”，不证明“这个用户能查这个订单”。
- **不替代网络安全组/NetworkPolicy**：它管的是 L4–L7 的服务间策略，不是主机加固、漏洞扫描、边界防火墙。
- **不保证业务幂等**：重试会把非幂等写操作放大成重复扣款。
- **不修复糟糕的拓扑**：同步调用链过长、数据库共享、缺少隔离，Mesh 只能让问题更可见，不能让它消失。
- **不覆盖所有流量**：绕过代理的流量（hostNetwork、特权 Pod、未注入的 Job、外部直连）仍然是缺口。
- **不自动产生 SLO**：指标是原料，SLO 需要业务定义和错误预算。

## 什么时候不该上 Mesh

以下场景应谨慎，甚至明确不上：

- 服务数量少（例如个位数）、团队小、没有多语言治理诉求：API 网关 + 云 LB + 基础可观测性足够。
- 极致尾延迟场景：每跳代理都会引入排队和调度抖动，先证明收益大于 p99 成本。
- 非 Kubernetes 为主、无法统一身份平面：Mesh 的价值会大打折扣。
- 平台团队没有 day-2 运维能力：Mesh 的升级、证书、策略和故障排查是长期投入。
- 组织没有“平台即产品”的契约：Mesh 会退化成一堆没人敢动的 YAML。

> 架构师注：Mesh 的立项理由应该是“统一通信治理与身份边界”，而不是“别人都在用”。如果写不出三条可量化的成功指标（例如 mTLS 覆盖率、P99 延迟预算、变更失败率），先不要上。

# 数据面谱系：Sidecar、Ambient 与 eBPF

数据面是 Mesh 的“肌肉”。过去十年最大的变化，不是代理功能变多，而是**代理的位置和粒度**在变化。

## Sidecar 模型：每个 Pod 一个代理

### 注入与流量拦截

Sidecar 模式由注入开始。以 Istio 为例，Pod 创建时 admission webhook 会把 `istio-proxy` 容器（Envoy）和初始化逻辑加入 Pod：

- 传统方式由 `istio-init` 容器在 Pod 网络命名空间写 iptables 规则，把入站/出站流量重定向到 Envoy。
- 生产更常用 Istio CNI 插件，避免应用 Pod 需要 `NET_ADMIN`。
- 出站通常重定向到 `15001`，入站到 `15006`，Envoy 管理端口 `15000`，HBONE 监听 `15008`（Ambient 也会用到）。

拦截之后，应用仍然以为自己连的是目标 Service，实际流量被透明地送进代理。

### Envoy 内部：监听器、过滤器链、路由、集群

理解 Envoy 的配置模型，比背 CRD 字段更重要：

```text
Listener（地址/端口）
  └─ FilterChain（匹配条件 + TLS）
       └─ HTTP Connection Manager（L7 解析、超时、重试、熔断）
            └─ Route（host/path/header 匹配）
                 └─ Cluster（目标服务 + 负载均衡策略 + 连接池）
                      └─ Endpoint（具体 Pod IP:Port）
```

一次请求在 Sidecar 中的路径大致是：

```text
应用进程 → 出站 iptables → 客户端 Envoy
        → 连接池/负载均衡 → mTLS（SDS 取证书）
        → 服务端 Envoy → 入站过滤器链 → 授权 → 应用进程
```

Sidecar 同时承担出站和入站，因此一条请求通常经过**两个代理**。这也是 Sidecar 延迟和 CPU 成本的主要来源。

### Sidecar 的优势与代价

优势：

- **故障隔离最好**：一个 Pod 的代理挂了，只影响这个 Pod。
- **身份边界清晰**：每个 Pod 有自己的证书和 SDS 通道。
- **L7 能力完整**：HTTP/gRPC 路由、重试、熔断、Wasm、授权都在本地。
- **升级粒度细**：可以按命名空间、按 Deployment 滚动。

代价：

- **资源税**：每个 Pod 都要预留 CPU/内存，哪怕它一天只处理几个请求。
- **生命周期耦合**：注入、启动顺序、优雅退出、Job 完成都会变复杂。
- **升级需要重建 Pod**：Sidecar 版本跟应用 Pod 绑定，升级是一次“应用发布”。
- **配置规模**：每个代理都持有自己关心的那一份配置，配置越大内存越高。

## Ambient 模型：把 L4 和 L7 拆开

Istio Ambient 的核心思想不是“去掉代理”，而是**把代理按层拆开，按需付费**：

- **ztunnel**：每节点一个，Rust 编写，只做 L3/L4——mTLS、身份认证、L4 授权、L4 遥测、HBONE 隧道。
- **waypoint**：可选的 Envoy Deployment，做 L7——HTTP 路由、L7 授权、Wasm、L7 遥测。

### ztunnel：节点级多租户代理

ztunnel 的关键设计：

- 每个 Kubernetes 节点一个 DaemonSet Pod，负责该节点上所有 Ambient 工作负载的 L4 数据面。
- 通过 xDS 与 `istiod` 通信，获取配置和**该节点上所有 Pod 的 ServiceAccount 证书**。
- 不解析 HTTP，不终止应用 HTTP 流量；只处理连接、mTLS、隧道和 L4 策略。
- 由于是节点级多租户，证书和配置的集中度比 Sidecar 高，这是它节省资源的原因，也是爆炸半径变大的原因。

### HBONE：HTTP/2 + CONNECT + mTLS

HBONE（HTTP-Based Overlay Network Environment）是 Istio 的隧道协议，组合三个开放标准：

- **HTTP/2**：多路复用，把多条应用 TCP 流复用到一条加密连接上。
- **HTTP CONNECT**：建立隧道。
- **mTLS**：加密并验证双方身份。

默认监听 TCP `15008`。它的重要属性是：**不修改应用流量本身**，元数据通过 CONNECT 头传递，因此不需要往应用请求里塞 Istio 私有 header。

### 流量重定向：规则在 Pod 网络命名空间里

Ambient 的重定向由 `istio-cni` 节点代理和 ztunnel 协作完成：

- `istio-cni` 响应 Pod 创建/删除事件，并监听 Ambient 标签变化。
- 它安装一个 chained CNI 插件，在集群主 CNI 之后执行，只用于通知节点代理“新 Pod 出现了”。
- ztunnel 在**应用 Pod 的网络命名空间内**建立数据面捕获规则，因此可以与任意 CNI 共存，不需要替换集群网络。

官方文档给出的 iptables 规则可以看到典型的 Ambient 端口：

- 入站 TPROXY 到 `15006`
- 出站 REDIRECT 到 `15001`
- HBONE 到 `15008`

这也意味着：**本节点内的 Pod 到 Pod 流量同样经过 ztunnel**，所以 L4 授权和遥测对本地流量与跨节点流量是一致的。

### 数据路径

**入站**：Pod 收到请求 → 透明重定向到节点 ztunnel → 执行 L4 授权 → 转发给 Pod。ztunnel 默认同时接受 HBONE 和明文；如果要求“必须是网格内身份”，需要用 L4 AuthorizationPolicy 显式拒绝无身份流量。

**出站**：Pod 发出请求 → 重定向到节点 ztunnel → 判断目的地能力：

- 目的地也在 Mesh：升级为 HBONE 加密隧道。
- 目的地有 waypoint：先送到 waypoint 做 L7 策略，再由 waypoint 通过第二条 HBONE 隧道送到目的地节点 ztunnel。
- 目的地不在 Mesh：按普通流量转发。

**waypoint 路径**：

```text
源 Pod → 源节点 ztunnel → waypoint（HBONE）
       → 目的节点 ztunnel（HBONE）→ 目的 Pod
```

waypoint 只接收 HBONE 流量。它对 `Pod` 直接转发并执行策略；对 `Service` 还会执行路由和负载均衡。默认情况下 Service 路由到自己，可以用 Gateway API 的 `HTTPRoute` 覆盖。

### waypoint 的作用域与策略归属

waypoint 通过标签启用，粒度可以是命名空间、Service 或 Pod：

```bash
# 部署命名空间级 waypoint，并自动给命名空间打标签
istioctl waypoint apply -n default --enroll-namespace

# 也可以手动打标签
kubectl label ns default istio.io/use-waypoint=waypoint
```

Ambient 与 Sidecar 的一个关键差异是：**策略在目的地执行**。waypoint 相当于资源（命名空间/Service/Pod）的入口网关，Istio 保证进入该资源的流量经过 waypoint，由 waypoint 执行该资源的 L7 策略。

### Ambient 的边界与坑

- **L7 功能需要 waypoint**：只用 ztunnel 时只有 L4 能力；VirtualService、L7 授权、Wasm、L7 遥测都需要 waypoint。
- **当前版本中，来自 Sidecar 和 Gateway 的流量不会经过 waypoint**；网格外流量也不知道 waypoint 的存在，会直接打到目的地。这是做“渐进迁移”和“混合数据面”时必须验证的点。
- **waypoint 是共享组件**：一个 waypoint 挂掉会影响其作用域内的所有服务，必须按爆炸半径设计副本、PDB、资源和升级策略。
- **ztunnel 是节点级单点**：节点上的 ztunnel 异常会影响该节点所有 Ambient Pod 的连通性，监控和自愈要比 Sidecar 更敏感。
- **多租户隔离弱于 Sidecar**：同一节点上的多个租户共享 ztunnel 进程，安全边界更多依赖内核与 Istio 的实现，而不是进程隔离。

## eBPF 模型：把数据面推进内核

Cilium 的路线是：L3/L4 用 eBPF 在内核完成，L7 仍然用 Envoy 等用户态代理。

典型能力：

- **Socket-level load balancing**：在 connect 阶段完成 Service 到后端的选择，减少 iptables/conntrack 路径。
- **kube-proxy replacement**：用 eBPF 替代 kube-proxy 的 iptables/IPVS 规则。
- **身份与策略**：基于 CiliumIdentity 的 L3/L4 策略，配合 L7 策略。
- **Hubble**：基于 eBPF 的流级可观测性。
- **L7 解析**：HTTP/gRPC/DNS 等由 Envoy 参与，仍然有用户态代理成本。

eBPF 的优势是路径短、资源摊薄、对应用透明；代价是：

- 对内核版本和发行版有要求，升级路径受节点 OS 约束。
- 排障需要理解 eBPF、TC、XDP、socket LB，人才门槛更高。
- L7 能力仍依赖代理，所谓“sidecarless”不等于“proxyless”。
- 与云厂商托管 CNI、网络插件的兼容性需要逐项验证。

## 三种数据面放在一起比较

| 维度 | Sidecar（Envoy） | Ambient（ztunnel + waypoint） | eBPF（Cilium） |
| --- | --- | --- | --- |
| 代理粒度 | 每 Pod | 每节点 + 可选 waypoint | 内核 + 每节点 L7 代理 |
| L4 开销 | 高（每 Pod 一份） | 低（按节点摊薄） | 最低（内核路径） |
| L7 能力 | 完整 | 需要 waypoint，能力完整 | 依赖 Envoy，能力较完整 |
| 故障隔离 | 最好（Pod 级） | 中（节点/作用域级） | 中（节点/内核级） |
| 升级影响 | 需重建应用 Pod | ztunnel/waypoint 独立滚动 | 依赖 CNI/内核升级 |
| 多租户隔离 | 强（进程级） | 中（节点级共享） | 中（内核/节点级） |
| 运维复杂度 | 中 | 中高（多一层 waypoint） | 高（内核与 CNI） |
| 适用场景 | 功能优先、隔离优先 | 大规模、资源敏感、渐进落地 | 已用 Cilium、网络/安全一体化 |

> 架构师注：不要问“哪个最快”，先问“我的瓶颈是每 Pod 资源、尾延迟、隔离等级，还是运维人力”。答案不同，选型完全不同。

# 控制面深潜：从 Kubernetes 对象到 xDS

## istiod 的职责

Istio 的控制面统一为 `istiod`，历史上分散的组件被合并：

- **Pilot**：服务发现、配置转换、xDS 下发。
- **Citadel**：工作负载身份与证书签发。
- **Galley**：配置校验与 ingestion（职责已并入）。
- **注入与校验 webhook**：Sidecar 注入、配置校验。

它监听 Kubernetes API 中的 Service、EndpointSlice、Pod、Gateway、VirtualService、DestinationRule、AuthorizationPolicy 等对象，把这些“用户意图 + 系统状态”编译成 Envoy/ztunnel 能理解的 xDS 资源。

## xDS 资源图

Envoy 的动态配置协议统称 xDS，核心资源：

| 资源 | 作用 | 典型内容 |
| --- | --- | --- |
| CDS | Cluster Discovery Service | 上游集群、负载均衡策略、连接池、TLS 上下文 |
| EDS | Endpoint Discovery Service | 集群后端 IP:Port、健康状态、 locality |
| LDS | Listener Discovery Service | 监听地址、过滤器链、TLS |
| RDS | Route Discovery Service | 虚拟主机、路径/header 匹配、路由动作 |
| SDS | Secret Discovery Service | 证书、私钥、CA 证书 |

Istio 使用 **ADS（Aggregated Discovery Service）** 把上述资源聚合到一条 gRPC 流上，保证顺序和一致性。协议有两个变体：

- **SotW（State of the World）**：每次发送完整资源状态，实现简单，配置大时开销高。
- **Delta xDS**：只发送增量的新增/更新/删除，适合大规模和高变更率场景。

每个响应带 `version` 和 `nonce`。代理应用成功后回 ACK；失败回 NACK，并保留上一份可用配置。`istioctl proxy-status` 中的 `STALE`、`NOT SENT`、`NACK` 就是这条链路的状态。

### 一个 Service 如何变成 Envoy 配置

以 `echo.default.svc.cluster.local:80` 为例：

```text
Kubernetes Service echo
  + EndpointSlice（Pod IP:Port）
        │
        ▼
istiod 生成：
  EDS: outbound|80||echo.default.svc.cluster.local → 后端列表
  CDS: outbound|80||echo.default.svc.cluster.local → 负载均衡/连接池/TLS
  RDS: 虚拟主机 echo.default.svc.cluster.local:80 → 路由
  LDS: 0.0.0.0:15001（出站监听）→ 过滤器链
        │
        ▼
Sidecar Envoy 应用配置
```

调试时不要猜，直接看代理视角的配置：

```bash
istioctl proxy-config cluster  <pod> -n <ns>
istioctl proxy-config endpoint <pod> -n <ns>
istioctl proxy-config route    <pod> -n <ns>
istioctl proxy-config listener <pod> -n <ns>
istioctl proxy-config secret   <pod> -n <ns>
```

## 配置推送与一致性

一次配置变更的路径：

```text
API Server 事件
  → istiod 的 config controller 更新内存状态
  → 标记受影响的代理
  → push queue（debounce / 合并）
  → 为每个代理生成 xDS
  → gRPC 推送
  → ACK/NACK
```

工程上要关注四个参数/机制：

- **Debounce**：短时间内的多次变更合并，避免每个事件都全量重算。
- **Push throttle**：限制并发推送，保护控制面和网络。
- **增量与范围裁剪**：只推受影响的资源，避免“改一个路由，推全网格”。
- **配置作用域**：`Sidecar` 资源、`exportTo`、`discoverySelectors` 可以显著降低每个代理看到的配置量。

### 为什么“配置生效慢”

常见原因不是 istiod 慢，而是：

- 变更触发了大量代理重算，推送到尾部需要时间。
- 代理 NACK，控制面在重试；旧配置继续生效。
- 配置作用域导致某些代理根本看不到新资源。
- DNS/EndpointSlice 还没同步，EDS 仍是旧后端。
- 应用侧连接池复用了旧连接，新配置只影响新连接。

这解释了为什么 Mesh 的变更不能按“数据库事务”的心智模型来管理，必须按**最终一致的分布式系统**来设计发布流程。

## 控制面容量模型

官方文档明确指出，istiod 的 CPU 消耗与以下因素相关：

- Deployment/ Pod 变更速率。
- 配置对象变更速率。
- 连接上来的代理数量。

并且这部分可以水平扩展：增加 istiod 副本可以缩短配置到达所有代理的时间。大规模场景应使用配置作用域，否则每个代理都会持有远超其需要的配置。

容量规划时至少估算：

- 服务数、Endpoint 数、配置对象数（VirtualService/DestinationRule/AuthorizationPolicy）。
- 每分钟 Pod 变更数（HPA、批处理、滚动发布都会放大）。
- 代理数量（Sidecar 数量或节点数 + waypoint 副本数）。
- 单个 Envoy 的配置内存上限与 istiod 的堆内存。

## 身份与证书：控制面的另一半

Istio 的身份模型基于 **SPIFFE**：

```text
spiffe://<trust-domain>/ns/<namespace>/sa/<service-account>
```

默认 trust domain 是 `cluster.local`，例如：

```text
spiffe://cluster.local/ns/default/sa/reviews
```

证书签发流程：

1. `istiod` 提供 gRPC CSR 服务。
2. Istio agent 生成私钥和 CSR，用工作负载凭据向 `istiod` 申请。
3. `istiod` 内的 CA 校验凭据后签发证书。
4. Envoy 通过 **SDS** 从 agent 获取证书和私钥。
5. agent 监控证书有效期，在过期前自动轮换。

默认工作负载证书 TTL 通常为 24 小时，可配置。生产上要关注：

- **CA 根证书轮换**：根证书过期会导致全网格握手失败，必须有提前量和演练。
- **外部 CA**：可以用 cert-manager、Vault、外部 SPIFFE 等替换自签 CA，但要保证轮换链路可控。
- **时钟**：节点时间漂移会导致证书“未生效/已过期”，mTLS 直接失败。
- **Ambient 的集中度**：ztunnel 持有本节点所有 ServiceAccount 的证书，节点被攻破的影响面大于单 Pod Sidecar。

## 控制面故障域

| 故障 | 数据面影响 | 控制面影响 | 缓解 |
| --- | --- | --- | --- |
| istiod 全部不可用 | 已下发配置继续转发 | 新配置、注入、证书轮换停止 | 多副本、PDB、跨 AZ、证书提前量 |
| 注入 webhook 不可用 | 新 Pod 可能无法创建 | 发布中断 | webhook 多副本、failurePolicy 评估、预检 |
| CA 不可用 | 现有证书到期前可继续 | 新证书签发失败 | 外部 CA HA、根证书备份 |
| xDS 推送风暴 | 代理 CPU 升高、尾延迟变差 | istiod CPU/内存升高 | 配置作用域、debounce、变更窗口 |
| 单个代理 NACK | 该代理保留旧配置 | 推送重试 | `proxy-status` + `analyze` + 配置测试 |

# 流量管理深潜：定义失败模型

流量管理的本质不是“把请求送到某个版本”，而是**定义系统在成功、超时、过载、部分故障时的行为**。

## 对象模型：Istio API 与 Gateway API

Istio 传统 API：

- `VirtualService`：路由规则（host、match、route、retry、timeout、mirror、fault）。
- `DestinationRule`：目标策略（subset、负载均衡、连接池、outlier detection、TLS）。
- `Gateway`：入口/出口网关。
- `ServiceEntry`：把外部服务纳入网格。

Gateway API / GAMMA：

- Mesh 场景下，`HTTPRoute` 等 Route 直接以 **Service 为 parent**，不使用 `Gateway`/`GatewayClass`。
- GAMMA 定义了 Service 的 **frontend**（名字 + ClusterIP）和 **backend**（Pod/Endpoint）两个面，避免 Service 语义含糊。
- GAMMA 自 Gateway API v1.1 起进入 Standard Channel，属于 GA 能力。

一个 Mesh 内的 HTTPRoute：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: echo
spec:
  parentRefs:
    - group: ""
      kind: Service
      name: echo
  rules:
    - backendRefs:
        - name: echo-v1
          port: 80
```

这表示“所有发往 `echo` Service 的 HTTP 流量，转给 `echo-v1`”。在 Ambient 中，这类 Route 由 waypoint 执行；在 Sidecar 模式中由 Sidecar 执行。

## 路由匹配与生效顺序

以 Istio `VirtualService` 为例，常见匹配顺序：

- host 先匹配（精确 > 通配）。
- HTTP match 内部：精确路径 > 前缀 > 正则（以官方文档为准）。
- 多条规则按声明顺序，先匹配先生效。
- 作用域优先级：Sidecar/ workload 级 > namespace 级 > mesh 级；Gateway 规则只作用于该 Gateway。

工程建议：

- 不要把“默认路由”和“异常路由”混在一个 VirtualService 里，按团队/服务拆分，降低评审难度。
- 用 `istioctl analyze` 和 CI 做 schema/冲突检查。
- 路由变更必须能回答：影响哪些 host、哪些来源、回滚是什么。

## 负载均衡：算法只是表象

常见算法：

| 算法 | 适用 | 注意 |
| --- | --- | --- |
| ROUND_ROBIN | 同构后端、请求成本均匀 | 长连接下容易不均 |
| LEAST_REQUEST | 请求成本差异大 | 需要代理维护活跃请求数 |
| RANDOM | 大规模、简单 | 方差较大 |
| RING_HASH / MAGLEV | 会话保持、缓存亲和 | 后端增减会重排，需评估缓存命中 |
| PASSTHROUGH | 直接透传 | 不做 LB，慎用 |

还要叠加：

- **Locality LB**：优先同区域/同 AZ，失败再跨区；`failoverPriority` 控制顺序。
- **Panic threshold**：健康后端比例低于阈值时，Envoy 可能“恐慌”并把流量打向所有后端，避免全挂。要理解这个 fail-open 行为。
- **Endpoint 健康**：K8s readiness、outlier detection、主动健康检查共同决定后端是否可用。
- **连接池**：HTTP/1.1 的连接复用、HTTP/2 的多路复用、最大连接数/待处理请求数，都会影响过载行为。

## 韧性：重试、超时、熔断的数学

### 重试会放大故障

假设单次失败率 10%，最多重试 3 次（总共 4 次尝试）：

- 请求最终失败率：`1 - 0.9^4 = 34.4%`。
- 期望尝试次数：`1 + 0.1 + 0.01 + 0.001 = 1.111`，即额外 11.1% 的负载。

如果失败是**过载**而不是瞬时抖动，重试会进一步压垮后端，形成重试风暴。重试只对“瞬时、独立、可重放”的失败有效。

实践原则：

- 只对幂等请求重试；写操作必须有幂等键。
- 限制重试次数和总时间预算，避免超过调用方 deadline。
- 对重试比例做预算/熔断，防止放大。
- 区分连接失败、5xx、超时；不要无差别 `retryOn: 5xx`。

### 超时是端到端预算

Mesh 的 `timeout` 是单跳超时，不是业务端到端 deadline。一个三层调用链：

```text
A → B → C
```

如果 A 的超时是 1s，B 的超时是 1s，C 又重试 3 次，那么 A 很可能在 B 还在重试时就放弃，产生“幽灵请求”。正确做法是：

- 调用方设置**剩余预算**，每跳递减。
- gRPC 使用 deadline 传播；HTTP 用 header 传递预算（需要应用配合）。
- `perTryTimeout × (attempts + 1) < 上游 timeout`。

### 熔断与 outlier detection

Istio 的熔断有两层：

- **连接池限制**：最大连接数、最大待处理请求、最大重试并发，过载时快速失败。
- **异常点驱逐**：连续 5xx、网关错误等达到阈值后，把后端从负载均衡池中剔除一段时间。

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  trafficPolicy:
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

注意：

- `maxEjectionPercent` 太低会导致故障后端仍在接流量；太高会让整个池被踢空。
- 驱逐是“被动”的，恢复依赖时间窗口，不适合快速抖动的故障。
- 熔断不是限流；真正的过载保护需要入口限流、并发限制和队列管理。

## 灰度、镜像与故障注入

- **权重灰度**：按比例分流，简单但反馈慢；适合大版本。
- **Header/Cookie 灰度**：按用户/租户/请求特征分流，适合精确验证。
- **流量镜像**：把生产流量复制到新版本，不返回响应；适合读请求和性能验证，写请求必须确认幂等和副作用。
- **故障注入**：延迟/中止，用于验证超时、重试、熔断和告警；只在受控环境或小比例生产使用。

灰度不是“配个 10% 就完了”，要同时定义：

- 成功指标（错误率、P99、业务转化）。
- 观测窗口和样本量。
- 自动回滚条件。
- 数据兼容性（双写、schema 变更）。

## 出口流量与 ServiceEntry

默认情况下，Mesh 对未知外部服务的处理取决于 `outboundTrafficPolicy`：

- `ALLOW_ANY`：未知流量直接放行，迁移期常用，但等于没有出口治理。
- `REGISTRY_ONLY`：只允许注册过的外部服务，需要 `ServiceEntry`。

生产建议：

- 用 `ServiceEntry` 显式登记外部依赖，配合出口网关做审计和固定源 IP。
- 注意 DNS 解析和 TLS  origination：Mesh 可以发起 TLS，但证书校验和 SNI 要配置正确。
- 不要把 `REGISTRY_ONLY` 当成强安全边界，它只减少意外外联。

## 多集群

Istio 的典型拓扑：

- **Primary-Remote**：一个主集群运行控制面，远程集群只跑数据面。
- **Multi-Primary**：每个集群都有控制面，互相发现。
- **East-West Gateway**：跨网络时，通过专用网关承载跨集群服务流量。

关键设计点：

- **网络标识**：`topology.istio.io/network` 决定跨网络路径。
- **信任域**：跨集群 mTLS 要求 trust domain 和根证书策略一致；不同信任域需要显式配置。
- **服务发现**：跨集群 Endpoint 的可见性、DNS 解析、locality 感知。
- **故障域**：跨集群调用增加一跳网络，超时和重试预算要重新计算。
- **Ambient 多集群**：能力随版本演进，落地前必须以当前版本的官方支持矩阵为准，不要假设与 Sidecar 完全等价。

# 安全深潜：零信任不是“开了 mTLS”

## 零信任的三个不变量

1. **身份优先**：策略基于工作负载身份（SPIFFE），而不是 IP/端口。
2. **默认不信任**：没有明确允许的通信应被拒绝。
3. **持续验证**：证书轮换、短生命周期、每次连接都验证，而不是“进内网就信任”。

Mesh 能提供前两个的技术底座，第三个取决于证书生命周期和策略执行点。

## mTLS 握手与身份验证

一次 mTLS 连接包含：

1. 客户端验证服务端证书链和 SAN（通常是 SPIFFE ID）。
2. 服务端验证客户端证书链和 SAN。
3. 双方协商会话密钥。
4. 后续应用数据加密传输。

关键点：

- **mTLS 证明的是工作负载身份**，不是终端用户身份。
- **证书 SAN 必须与策略中的 principal 匹配**，否则授权会失效。
- **PERMISSIVE 模式**同时接受明文和 mTLS，迁移期有用，但也是降级风险；迁移完成后应切到 STRICT。
- **证书轮换**是持续过程，控制面/CA 故障会在 TTL 到期后集中爆发。

## 策略分层

Istio 的安全策略分三层：

| 资源 | 回答的问题 | 典型配置 |
| --- | --- | --- |
| `PeerAuthentication` | 这个工作负载接受什么传输层身份？ | `STRICT` / `PERMISSIVE` / `DISABLE` |
| `RequestAuthentication` | 终端用户 JWT 是否有效？ | issuer、jwks、 audiences |
| `AuthorizationPolicy` | 这个请求是否允许？ | ALLOW / DENY / CUSTOM，基于 principal、namespace、method、path、JWT claims |

全命名空间强制 mTLS：

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: foo
spec:
  mtls:
    mode: STRICT
```

默认拒绝 + 显式允许：

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: deny-all
  namespace: foo
spec: {}
---
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: allow-reviews
  namespace: foo
spec:
  selector:
    matchLabels:
      app: reviews
  action: ALLOW
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/foo/sa/web"
      to:
        - operation:
            methods: ["GET"]
            paths: ["/api/v1/reviews/*"]
```

语义要点：

- **DENY 优先于 ALLOW**；只要有一条 DENY 匹配，请求就被拒绝。
- 如果没有任何 ALLOW 策略，默认允许；因此“默认拒绝”必须显式加一条空规则或 deny-all。
- `principals` 的格式通常是 `<trust-domain>/ns/<ns>/sa/<sa>`。
- L7 策略（method/path/claims）需要 L7 解析；在 Ambient 中由 waypoint 执行，仅有 ztunnel 时只能做 L4。

## Ambient 下的策略执行点

- **ztunnel**：L4 AuthorizationPolicy、mTLS 身份、L4 遥测。
- **waypoint**：L7 AuthorizationPolicy、RequestAuthentication、Wasm、L7 遥测、路由。
- **目的地执行**：Ambient 的策略在目的地 waypoint 执行，而不是源端 Sidecar。这改变了“策略在哪生效”的排障心智。

一个容易忽略的点：ztunnel 默认接受明文入站。如果你的策略只写了 ALLOW，没有拒绝无身份流量，那么网格外明文请求可能仍然通过。要显式要求身份：

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: require-identity
  namespace: foo
spec:
  selector:
    matchLabels:
      app: reviews
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/foo/sa/web"]
```

并配合默认拒绝，确保没有 principal 的流量被挡住。

## 威胁模型

| 威胁 | Mesh 能做什么 | 残余风险 |
| --- | --- | --- |
|  Pod 被攻破，横向扫描 | mTLS + L4/L7 授权限制可达服务 | 被攻破的工作负载可用自己的合法身份访问被允许的服务 |
| 中间人窃听 | mTLS 加密 | 网格外流量、绕过代理的流量 |
| 身份伪造 | SPIFFE + 证书校验 | 控制面/CA 被攻破、节点 root |
| 未授权 API 调用 | AuthorizationPolicy + JWT | 策略写错、路径匹配漏洞、业务逻辑漏洞 |
| 供应链恶意镜像 | 镜像签名/准入控制（Mesh 之外） | Mesh 不负责镜像可信 |
| 出口数据泄露 | ServiceEntry + 出口网关 + 审计 | 直连 IP、DNS 隧道、允许的外部服务 |
| 拒绝服务 | 限流、连接池、熔断 | Mesh 不是抗 DDoS 设备 |

> 架构师注：Mesh 的安全价值在于“把身份和策略变成默认路径”，而不是“让应用变得安全”。应用自身的输入校验、权限模型、密钥管理仍然是第一道防线。

## 常见安全错误

- 只开 mTLS，不做授权：加密了，但谁都能调。
- 长期使用 PERMISSIVE：迁移完成后忘记切 STRICT。
- 用 IP/端口写策略：Pod 重建后策略失效或过宽。
- 路径匹配写成 `/*`：把管理接口也暴露了。
- JWT 只校验签名，不校验 issuer/audience/expiry。
- 把 `REGISTRY_ONLY` 当出口安全边界。
- 根证书没有轮换演练，过期当天全网格 503。
- 共享 waypoint 没有按安全边界拆分，一个命名空间的策略污染另一个。

# 可观测性深潜：指标、追踪与基数

## 指标：先理解 reporter

Istio 的核心指标（如 `istio_requests_total`、`istio_request_duration_milliseconds`）带 `reporter` 标签：

- `reporter=source`：源端代理观测到的请求。
- `reporter=destination`：目的端代理观测到的请求。

同一条请求会在两边各产生一份指标。做 SLO 时要明确用哪一侧：

- 看“调用方体验”：source。
- 看“服务端实际处理”：destination。
- 两边都看，才能定位“请求没到”还是“到了但失败”。

常见 `response_flags`：

| flag | 含义 |
| --- | --- |
| `UF` | upstream connection failure |
| `UC` | upstream connection termination |
| `UO` | upstream overflow（熔断/连接池） |
| `NR` | no route |
| `URX` | retry limit exceeded |
| `-` | 正常 |

这些 flag 比 HTTP 状态码更接近根因。

## 基数治理

Mesh 指标天然高基数：

- `source_workload`、`destination_workload`、`destination_service`、`response_code`、`reporter` 组合爆炸。
- 每个服务版本、每个端点、每个错误码都会产生时间序列。

治理手段：

- 用 Telemetry API 关闭不需要的标签。
- 在 Prometheus 侧做 metric relabeling / cardinality limit。
- 不要把用户 ID、请求 ID、URL 全路径放进标签。
- 区分“平台指标”和“业务指标”，不要把 Mesh 当业务分析数据库。

## 追踪

Mesh 能在代理层生成 span，但**跨服务上下文传播仍然依赖应用**：

- 应用必须透传 W3C `traceparent` 或 B3 header。
- 代理默认可能只采样一部分；需要配置采样率。
- 全量采样成本高，生产常用尾部采样（tail sampling）。
- Ambient 下，ztunnel 只做 L4，L7 span 主要在 waypoint 产生；追踪链路要确认 waypoint 是否在路径上。

## 日志与拓扑

- Envoy 访问日志：按需开启，注意量和脱敏。
- ztunnel 日志：Ambient 排障的关键，尤其是连接建立、HBONE、授权失败。
- Hubble：Cilium 的流级可观测性，适合 L3/L4 视角。
- Kiali：服务拓扑、配置校验、流量动画；适合作为平台自服务界面。

## 带重试的 SLO

重试会让“用户看到的失败率”和“后端看到的失败率”不一致：

- 后端 10% 失败，重试 3 次后用户失败率可能降到 34.4%，但后端压力增加。
- SLO 应基于**用户请求**（source 侧最终结果），同时单独监控**尝试级**失败率。
- 错误预算要扣除重试放大带来的额外负载。

# 性能与容量：一张架构师账单

## 延迟路径

| 模式 | 请求路径 | 额外跳数 |
| --- | --- | --- |
| 无 Mesh | 应用 → 应用 | 0 |
| Sidecar | 应用 → 客户端 Envoy → 服务端 Envoy → 应用 | 2 个代理 |
| Ambient（仅 L4） | 应用 → 源 ztunnel → 目的 ztunnel → 应用 | 2 个节点代理 |
| Ambient + waypoint | 应用 → ztunnel → waypoint → ztunnel → 应用 | 3 个代理 |

每个代理都会引入：

- 连接建立/TLS 握手（可被连接复用摊薄）。
- 请求解析、路由匹配、过滤器链。
- 队列等待和 CPU 调度（尾延迟的主要来源）。
- 遥测采集（通常不直接计入请求时间，但会占用 worker）。

## 官方基准数据

Istio 官方性能文档（1.24 基准，1 KB payload、mTLS、2 worker threads、1000 rps）给出：

| 组件 | CPU | 内存 |
| --- | --- | --- |
| Sidecar Envoy | ~0.20 vCPU | ~60 MB |
| Waypoint Envoy | ~0.25 vCPU | ~60 MB |
| ztunnel | ~0.06 vCPU | ~12 MB |

这些数字的含义：

- **Sidecar 的成本是“每 Pod”**；Pod 越多，固定成本越高，即使流量很低。
- **ztunnel 的成本是“每节点”**；节点越多，成本线性增长，但与 Pod 密度无关。
- **waypoint 的成本是“每副本”**；共享程度越高，单位服务成本越低，但爆炸半径越大。
- 内存强烈依赖配置规模（listener/cluster/route 数量），不能只看基准值。

> 不要直接把厂商基准当容量规划。必须用你自己的协议、payload、连接模式、mTLS、CPU limit 和内核参数复测。

## 成本模型

一个粗略但实用的公式：

```text
Sidecar 年化成本 ≈ Σ(Pod 数 × 单代理 CPU/内存 × 单价) + 控制面 + 可观测性存储
Ambient 年化成本 ≈ Σ(节点数 × ztunnel 成本) + Σ(waypoint 副本 × 成本) + 控制面 + 存储
```

示例（仅示意，不是报价）：

- 500 个 Pod，每个 Pod 峰值 1000 rps：Sidecar 约 `500 × 0.20 = 100 vCPU`、`500 × 60MB = 30GB`。
- 同样负载跑在 20 个节点：ztunnel 约 `20 × 0.06 = 1.2 vCPU`、`20 × 12MB = 240MB`。
- 再加 2 个 waypoint 副本：约 `0.5 vCPU`、`120MB`。

但这只是“代理本身”的成本。还要加上：

- 为代理预留的节点容量和碎片。
- 控制面副本、etcd 压力、镜像仓库。
- 指标/日志/追踪的存储与查询成本。
- 平台团队的运维人力（通常被低估）。
- 升级窗口和变更风险。

## 容量规划清单

- 服务数、Endpoint 数、配置对象数。
- 每 Pod/每节点 RPS、连接数、并发请求数。
- 协议分布（HTTP/1.1、HTTP/2、gRPC、TCP）。
- 变更频率（HPA、滚动发布、批处理）。
- 代理 CPU limit 与 throttling（尾延迟杀手）。
- 单 Envoy 配置内存上限、istiod 堆内存。
- 节点 ulimit、conntrack、文件描述符、内核参数。
- 监控/日志采样率与存储保留。

## 基准测试方法

要得到可信结论，至少控制：

- 相同节点规格、相同 CNI、相同内核参数。
- 相同 payload、协议、并发连接、mTLS 开关。
- 测量 p50/p90/p99，而不是只看平均值。
- 记录 CPU throttling、GC、连接复用、错误率。
- 分别测“无 Mesh / Sidecar / Ambient / Ambient+waypoint”。
- 用真实业务调用链，而不是单跳 echo。

# 生产运维与故障学

## 安装与升级

### Sidecar：revision 金丝雀

```bash
# 安装新 revision 的控制面
istioctl install --set revision=1-31-3

# 新命名空间使用新 revision
kubectl label ns app istio.io/rev=1-31-3 --overwrite

# 重建 Pod 让新 Sidecar 生效
kubectl rollout restart deploy -n app
```

要点：

- 控制面可以先升级，数据面按命名空间/工作负载逐步切换。
- 切换时移除旧的 `istio-injection=enabled`，避免双注入。
- 必须确认控制面与数据面的版本偏差在官方支持范围内。
- Sidecar 升级意味着应用 Pod 重建，要纳入发布窗口和容量预算。

### Ambient：分层升级

- 先升级 `istiod`，再滚动 ztunnel DaemonSet，最后滚动 waypoint Deployment。
- 应用 Pod 通常不需要重建（以官方升级说明为准），但标签和 CNI 规则要验证。
- 升级后重点验证：mTLS、HBONE、waypoint 路由、L4/L7 策略。

## 故障模式表

| 现象 | 常见根因 | 排查入口 |
| --- | --- | --- |
| 503 `UF` | 上游连接失败、端口错、Pod 未就绪 | `proxy-config endpoint`、readiness、NetworkPolicy |
| 503 `UC` | 上游主动断开、超时、协议不匹配 | 上游日志、超时配置、HTTP/2 设置 |
| 503 `UO` | 连接池/熔断溢出 | `DestinationRule` 连接池、并发、限流 |
| 503 `NR` | 没有匹配路由 | `proxy-config route`、host、Gateway |
| 503 TLS error | mTLS 模式不一致、证书过期/ SAN 不匹配 | `PeerAuthentication`、`proxy-config secret`、时钟 |
| 401/403 | JWT 无效、授权策略拒绝 | `RequestAuthentication`、`AuthorizationPolicy`、principal |
| 配置不生效 | NACK、作用域、debounce、连接复用 | `proxy-status`、`analyze`、`proxy-config` |
| 新 Pod 起不来 | 注入 webhook/CNI 失败 | webhook 日志、`istio-cni` 日志、Events |
| 节点流量全断 | ztunnel 异常 | ztunnel DaemonSet、节点日志、CNI |
| 某命名空间 L7 失效 | waypoint 副本不足/崩溃 | waypoint Deployment、HPA、PDB |
| 延迟突然升高 | 代理 CPU throttling、推送风暴、DNS | `kubectl top`、throttling 指标、istiod 指标 |

## 排障顺序

1. **确认范围**：单 Pod、单服务、单节点、单命名空间，还是全网格？
2. **确认路径**：请求有没有经过代理？`proxy-config` 看 listener/route/cluster/endpoint。
3. **确认身份**：mTLS 是否成功？证书是否有效？principal 是什么？
4. **确认策略**：PeerAuthentication / RequestAuthentication / AuthorizationPolicy 是否命中？
5. **确认控制面**：`proxy-status` 是否 STALE/NACK？istiod 是否在推送？
6. **确认数据面**：CPU throttling、连接池、Endpoint 健康、DNS。
7. **最后抓包**：`tcpdump`、ztunnel 日志、Hubble，验证“看到的配置”和“实际流量”是否一致。

常用命令：

```bash
istioctl analyze -A
istioctl proxy-status
istioctl proxy-config cluster <pod> -n <ns>
istioctl proxy-config endpoint <pod> -n <ns>
istioctl proxy-config route <pod> -n <ns>
istioctl proxy-config secret <pod> -n <ns>
kubectl logs -n istio-system -l app=istiod --tail=200
kubectl logs -n istio-system -l app=ztunnel --tail=200
kubectl get pods -n istio-system -o wide
```

## GitOps 与策略即代码

- 所有 Mesh 配置进 Git，禁止控制台手改。
- CI 中跑 `istioctl analyze`、schema 校验、策略单测（conftest/OPA）。
- 关键策略（默认拒绝、mTLS STRICT、出口白名单）要有“策略测试”环境。
- 变更分级：路由/权重可自动；安全策略/控制面升级需人工审批。
- 记录“配置版本 ↔ 镜像版本 ↔ 数据面版本”的对应关系，便于回滚。

## 多租户平台

- 命名空间是基本隔离单元；用 `Sidecar`、`exportTo` 限制配置可见性。
- 共享控制面 vs 每租户控制面：前者成本低，后者隔离强；按合规要求选择。
- waypoint 按安全边界共享，不要跨租户复用。
- 为租户提供“黄金路径”模板，而不是让每个团队自由写 YAML。

# 选型、迁移与 TCO

## 选型矩阵

| 维度 | Istio | Linkerd | Cilium | 托管 Mesh |
| --- | --- | --- | --- | --- |
| 功能完整度 | 最高（L4/L7、多集群、Wasm、授权） | 中等（核心治理、mTLS、重试/超时） | 高（网络+安全+可观测） | 取决于厂商 |
| 数据面 | Envoy Sidecar / Ambient | Rust 微代理 Sidecar | eBPF + Envoy | 通常 Sidecar/托管 |
| 资源开销 | 中高（Sidecar）/ 低（Ambient） | 低 | 低（L4） | 中 |
| 运维复杂度 | 高 | 低 | 高 | 低 |
| 多集群 | 成熟 | 支持 | 支持 | 取决于产品 |
| 适用 | 大型平台、复杂治理、多集群 | K8s 为主、追求简单 | 已用 Cilium、网络一体化 | 小团队、合规托管 |

选择原则：

- **需要完整 L7 + 多集群 + 生态**：Istio；资源敏感则优先评估 Ambient。
- **需要简单、轻量、快速落地**：Linkerd。
- **已经把 Cilium 作为 CNI，且希望网络/安全/可观测一体化**：Cilium Service Mesh。
- **没有平台团队、但必须满足合规**：托管服务，接受功能延迟和成本溢价。
- **SMI**：历史项目，已不建议作为新选型基础。

## 迁移路线

不要“一步到位”。推荐分阶段：

1. **盘点**：服务清单、协议、调用链、关键 SLO、现有网关/服务发现。
2. **L4 基线**：先上 mTLS + L4 遥测 + 基础策略，验证身份和证书链路。
3. **选择性 L7**：只对需要灰度/重试/授权的服务启用 L7，避免全量代理税。
4. **策略硬化**：默认拒绝、JWT、出口白名单、审计。
5. **多集群/多环境**：统一信任域、跨集群发现、故障演练。
6. **数据面演进**：Sidecar → Ambient 按命名空间逐步迁移，保留回滚路径。

Sidecar → Ambient 的注意事项：

- 两种模式可在同一网格共存，但策略执行点不同（源端 vs 目的端）。
- 来自 Sidecar/Gateway 的流量当前不会经过 waypoint，混合期要验证策略覆盖。
- waypoint 的容量、HA、PDB 要按作用域设计。
- 迁移顺序：先 L4（ztunnel），再按需加 waypoint；不要一次性把所有 L7 策略搬过去。

## TCO 的真实构成

| 成本项 | 内容 | 常见低估点 |
| --- | --- | --- |
| 基础设施 | 代理 CPU/内存、节点、控制面 | 为代理预留的碎片容量 |
| 可观测性 | 指标/日志/追踪存储 | 高基数带来的查询成本 |
| 人力 | 平台团队、on-call、升级 | day-2 排障和证书轮换 |
| 变更风险 | 发布失败、策略误杀 | 回滚演练不足 |
| 机会成本 | 团队本可以做业务的时间 | 过度自建 |

## 反模式

- 把 Mesh 当“安全银弹”，只开 mTLS 不做授权。
- 全网格无差别重试，制造重试风暴。
- 100% 追踪采样，压垮存储。
- 每个服务一个 waypoint，资源比 Sidecar 还高。
- 没有 SLO 就做灰度，回滚全靠感觉。
- 控制面单副本、无 PDB、无跨 AZ。
- 安全策略没有测试环境，直接上生产。
- 把 Mesh 配置当 CMDB，所有东西都塞进一个 VirtualService。
- 没有退出策略：一旦 Mesh 故障，应用无法直连降级。

# 架构师检查清单

上线前用这 20 个问题做一次评审：

1. 我们要解决的三个可量化问题是什么？
2. 服务数量、协议、调用链深度、峰值 RPS 是多少？
3. P99 延迟预算里，允许代理占多少？
4. 选择 Sidecar、Ambient 还是 eBPF，依据是什么？
5. 每 Pod/每节点的资源税算清楚了吗？
6. 控制面几个副本、跨 AZ 吗？PDB 呢？
7. 证书 TTL、根证书轮换、CA 故障预案是什么？
8. mTLS 是 STRICT 吗？迁移期如何避免长期 PERMISSIVE？
9. 默认拒绝策略落地了吗？谁负责评审？
10. JWT 的 issuer/audience/expiry 校验了吗？
11. 重试只用于幂等请求吗？有总预算吗？
12. 超时是端到端预算还是单跳拍脑袋？
13. 熔断/连接池参数经过压测吗？
14. 灰度有成功指标和自动回滚吗？
15. 可观测性基数可控吗？采样率是多少？
16. 升级路径经过演练吗？数据面版本偏差支持吗？
17. 出问题能否在 10 分钟内定位到控制面/数据面/策略？
18. 多租户隔离边界在哪里？waypoint 是否跨租户共享？
19. 如果 Mesh 整体故障，应用的降级路径是什么？
20. 平台团队的 on-call、文档、黄金路径准备好了吗？

# 附录

## 术语表

| 术语 | 含义 |
| --- | --- |
| xDS | Envoy 动态配置协议集合（CDS/EDS/LDS/RDS/SDS） |
| ADS | 聚合发现服务，把 xDS 资源聚合到一条流 |
| SotW | State of the World，全量推送 |
| NACK | 代理拒绝配置，保留旧配置 |
| SPIFFE | 安全工作负载身份标准 |
| SDS | Secret Discovery Service，证书下发 |
| HBONE | HTTP/2 + CONNECT + mTLS 的隧道协议 |
| ztunnel | Ambient 的节点级 L4 代理 |
| waypoint | Ambient 的可选 L7 代理 |
| GAMMA | Gateway API for Mesh |
| RED | Rate、Errors、Duration 三个服务指标 |

## 官方文档

- Istio 架构：https://istio.io/latest/docs/ops/deployment/architecture/
- Istio Ambient 概览：https://istio.io/latest/docs/ambient/overview/
- Ambient 数据面：https://istio.io/latest/docs/ambient/architecture/data-plane/
- Ambient 控制面：https://istio.io/latest/docs/ambient/architecture/control-plane/
- HBONE：https://istio.io/latest/docs/ambient/architecture/hbone/
- Ambient 流量重定向：https://istio.io/latest/docs/ambient/architecture/traffic-redirection/
- Waypoint：https://istio.io/latest/docs/ambient/usage/waypoint/
- Istio 安全：https://istio.io/latest/docs/concepts/security/
- Istio 性能：https://istio.io/latest/docs/ops/deployment/performance-and-scalability/
- Istio 1.31 发布说明：https://istio.io/latest/news/releases/1.31.x/announcing-1.31/
- Linkerd 架构：https://linkerd.io/2/reference/architecture/
- Linkerd 2.20：https://linkerd.io/2026/06/23/announcing-linkerd-2.20/
- Cilium Service Mesh：https://docs.cilium.io/en/stable/network/servicemesh/
- Gateway API GAMMA：https://gateway-api.sigs.k8s.io/concepts/gamma/

## 命令速查

```bash
# 安装/升级
istioctl install --set profile=ambient --set revision=1-31-3
istioctl waypoint apply -n default --enroll-namespace

# 接入 Ambient
kubectl label ns default istio.io/dataplane-mode=ambient
kubectl label ns default istio.io/use-waypoint=waypoint

# 诊断
istioctl analyze -A
istioctl proxy-status
istioctl proxy-config cluster  <pod> -n <ns>
istioctl proxy-config endpoint <pod> -n <ns>
istioctl proxy-config route    <pod> -n <ns>
istioctl proxy-config secret   <pod> -n <ns>

# 观察
kubectl get pods -n istio-system -o wide
kubectl logs -n istio-system -l app=ztunnel --tail=200
kubectl logs -n istio-system -l app=istiod --tail=200
```

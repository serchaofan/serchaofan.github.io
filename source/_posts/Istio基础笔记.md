---
title: Istio
tags: [Istio, Service Mesh, Kubernetes, 云原生]
categories: [服务网格]
date: 2020-04-05 19:09:24
comments: false
---

本文基于 **Istio 1.31.3**（2026-10）官方文档重写，重点讲清原理，再落到安装、流量、安全、可观测性和企业实践。旧笔记写于 Istio 1.9，只覆盖了 Service Mesh 概念和少量组件；1.31 的变化较大：Mixer 早已移除，控制面统一为 istiod，配置 API 以 `v1` 为主，数据面除了 Envoy Sidecar 还有 Ambient 模式（ztunnel + waypoint），入口治理推荐 Gateway API。

最后更新：2026-10-22

<!--more-->

- [版本与范围](#版本与范围)
- [Service Mesh 与 Istio](#service-mesh-与-istio)
- [核心架构](#核心架构)
- [安装与接入](#安装与接入)
- [流量管理](#流量管理)
- [安全](#安全)
- [可观测性](#可观测性)
- [企业实践](#企业实践)
- [排障](#排障)
- [最佳实践清单](#最佳实践清单)
- [附录](#附录)

# 版本与范围

- 版本基线：Istio 1.31.3，Kubernetes 建议使用仍在维护的版本
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

Ambient 相关标签：

| 标签 | 作用 | 资源 |
| --- | --- | --- |
| `istio.io/dataplane-mode=ambient` | 加入 Ambient 网格 | Namespace / Pod |
| `istio.io/dataplane-mode=none` | Pod 级别退出 | Pod |
| `istio.io/use-waypoint=<name>` | 流量经过指定 waypoint | Namespace / Service / Pod |
| `istio.io/ingress-use-waypoint=true` | 入口流量也经过目标 waypoint，需要 istiod 开启 `ENABLE_INGRESS_WAYPOINT_ROUTING`（1.25+） | Namespace / Service / ServiceEntry |
| `istio.io/waypoint-for`（Alpha） | waypoint 处理 `service`、`workload`、`none` 或 `all` 流量 | Gateway |

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

注意事项：

- 重试会放大流量，故障时可能把下游压垮；只对幂等请求开启
- 每一跳超时应小于调用方剩余预算；外层超时要覆盖整条链路的最坏耗时（含重试），并大于任一内层单跳超时，但不要把各跳超时简单相加；同时不能小于被调用服务的正常处理时间，否则会提前 504
- 熔断要配合 `outlierDetection` 和连接池，单靠重试不能解决问题
- 默认重试次数不要设置过大

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
    jwksUri: "https://example.com/.well-known/jwks.json"
```

`RequestAuthentication` 会拒绝携带**无效凭证**的请求；完全不带凭证的请求默认放行，但没有认证身份。要强制要求 JWT，必须再配合 `AuthorizationPolicy` 的 `requestPrincipals`。

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

## 版本与升级

- 使用 revision 做金丝雀升级，控制面和数据面分开升级
- istiod 至少 2 副本，配置 PDB 和反亲和
- 升级前运行 `istioctl x precheck` 检查环境，再运行 `istioctl analyze -A` 检查配置
- 关注 Istio 支持的 Kubernetes 版本和 N-1/N-2 兼容策略
- 保留旧 revision 一段时间，确认稳定后再删除
- 使用 revision 安装时不要执行 `istioctl upgrade`

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

- Sidecar 会增加延迟和资源开销，按 Pod 数量估算 CPU/内存
- 给 Sidecar 设置合理的 requests/limits，避免被业务挤占
- 高并发场景调整 `concurrency`，不要完全依赖默认值
- 开启 `holdApplicationUntilProxyStarts`，避免应用先于代理启动导致启动期请求失败：

```yaml
metadata:
  annotations:
    proxy.istio.io/config: '{"holdApplicationUntilProxyStarts": true}'
```

- 对不需要经过网格的出站端口使用 `traffic.sidecar.istio.io/excludeOutboundPorts` 排除
- 大规模集群用 `Sidecar` 和 `discoverySelectors` 控制配置规模
- Ambient 下 ztunnel 的资源开销随节点数增长；waypoint 的资源开销随部署范围（命名空间/Service/Pod）和流量增长

## 可观测性落地

- 先统一指标、日志、追踪的采集标准，再谈告警
- 用 SLO 驱动告警，而不是对所有 5xx 都告警
- 区分 `source` 和 `destination` 的指标，避免错误率重复计算
- 为入口网关、核心服务、控制面分别建看板
- 控制面要监控 istiod 的 xDS 推送、证书签发和队列积压

## 多集群与 VM

- 多集群常见模式：primary-remote、multi-primary
- 集群间需要 East-West Gateway 和互通的网络/证书
- VM 工作负载通过 WorkloadEntry/WorkloadGroup 接入
- 多集群的 DNS、证书、网络策略和故障域要单独设计，不能只靠 Istio 配置

## 常见反模式

- 用 `EnvoyFilter` 改核心配置：低层逃生舱，升级容易失效，优先用 Telemetry、WasmPlugin、Gateway API
- `Gateway` 使用 `hosts: ["*"]`：任何 VirtualService 都能绑定，容易暴露意外域名
- 没有默认路由：新版本一上线就自动接流量
- 同一命名空间混用 Sidecar 和 Ambient：行为难以预测
- 把 `REGISTRY_ONLY` 当安全边界：绕过 Sidecar 的流量仍可出网
- 把 `Sidecar` 当出站访问控制：它只限制配置范围，不阻断流量
- 指标标签不加控制：Prometheus 基数和成本失控
- 只配 mTLS 不配授权：有合法证书的客户端仍能访问所有服务

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
- [安装指南](https://istio.io/latest/docs/setup/install/)
- [诊断工具](https://istio.io/latest/docs/ops/diagnostic-tools/istioctl/)
- [部署最佳实践](https://istio.io/latest/docs/ops/best-practices/deployment/)
- [安全最佳实践](https://istio.io/latest/docs/ops/best-practices/security/)
- [流量管理最佳实践](https://istio.io/latest/docs/ops/best-practices/traffic-management/)
- [可观测性最佳实践](https://istio.io/latest/docs/ops/best-practices/observability/)

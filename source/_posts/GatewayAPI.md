---
title: Gateway API
tags: [Kubernetes, Gateway API, Ingress, 流量入口]
categories: [Kubernetes]
date: 2022-07-05 23:12:07
comments: false
---

本文基于 **Gateway API v1.6.3**（2026-10）和 Kubernetes v1.37 官方文档重写，替代原来的 NginxIngress 笔记。重点讲清 Gateway API 的角色模型、对象关系、路由、TLS、跨命名空间和从 Ingress-NGINX 迁移。

Ingress-NGINX 已于 2025-11 宣布退役，best-effort 维护持续到 2026-03，之后不再发布、不再修复安全漏洞。存量集群应尽快迁移到 Gateway API 或其他受维护的入口方案。

<!--more-->

- [为什么用 Gateway API](#为什么用-gateway-api)
- [角色模型](#角色模型)
- [核心对象](#核心对象)
- [安装](#安装)
- [第一个 Gateway 和 HTTPRoute](#第一个-gateway-和-httproute)
- [路由匹配](#路由匹配)
- [流量拆分](#流量拆分)
- [TLS](#tls)
- [跨命名空间](#跨命名空间)
- [重定向、重写与头操作](#重定向重写与头操作)
- [gRPC、TCP、UDP、TLS 路由](#grpctcpudptls-路由)
- [策略与扩展](#策略与扩展)
- [从 Ingress-NGINX 迁移](#从-ingress-nginx-迁移)
- [排障](#排障)
- [企业实践](#企业实践)

# 为什么用 Gateway API

Ingress 只解决了最基础的 host/path 路由，复杂能力都靠控制器注解，导致：

- 注解不可移植，换控制器就要重写
- 职责边界不清，基础设施团队和应用团队都改同一个 Ingress
- 灰度、TLS、跨命名空间、gRPC、TCP 等能力表达弱
- Ingress-NGINX 退役后，注解生态没有长期维护保障

Gateway API 是 Kubernetes SIG Network 的官方项目，目标是：

- **角色分离**：基础设施团队管 GatewayClass/Gateway，应用团队管 Route
- **表达能力强**：权重、header 匹配、重定向、重写、镜像、跨命名空间
- **可移植**：标准 API，不依赖某个控制器的私有注解
- **面向多协议**：HTTP、HTTPS、gRPC、TCP、UDP、TLS

# 角色模型

![Gateway API 角色](https://gateway-api.sigs.k8s.io/images/gateway-roles.png)

*图 1：Gateway API 的基础设施提供者、集群运维、应用开发者角色*

| 角色 | 负责 |
| --- | --- |
| 基础设施提供者 | 提供 GatewayClass 和控制器实现 |
| 集群运维 | 创建 Gateway、监听器、TLS、跨命名空间策略 |
| 应用开发者 | 创建 HTTPRoute/GRPCRoute，把自己的服务挂到 Gateway |

这种分层让入口资源可以按团队授权，而不是把所有规则塞进一个 Ingress。

# 核心对象

![Gateway API 对象关系](https://gateway-api.sigs.k8s.io/images/schema-uml.svg)

*图 2：GatewayClass、Gateway、Route 的关系*

- **GatewayClass**：由控制器提供，描述“用哪个实现”
- **Gateway**：监听器、端口、协议、TLS、允许哪些命名空间挂载 Route
- **HTTPRoute / GRPCRoute / TCPRoute / UDPRoute / TLSRoute**：路由规则
- **ReferenceGrant**：允许跨命名空间引用 Service/Secret
- **BackendTLSPolicy**：网关到后端的 TLS
- **ListenerSet**：把监听器从 Gateway 拆出来，便于多团队管理（v1.6.3 标准通道，`v1`）

Route 通过 `parentRefs` 绑定到 Gateway，可以指定 `sectionName` 选择某个 listener。

![Route 绑定](https://gateway-api.sigs.k8s.io/images/gateway-route-binding.png)

*图 3：Route 通过 parentRefs 绑定到 Gateway 的 listener*

# 安装

Gateway API 是 CRD，不是 Kubernetes 内置 API，需要先安装 CRD，再安装控制器实现。

安装标准通道 CRD：

```bash
kubectl apply --server-side -f \
  https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.6.3/standard-install.yaml
```

标准通道（`standard-install.yaml`）在 v1.6.3 已包含 GatewayClass、Gateway、HTTPRoute、GRPCRoute、ReferenceGrant、BackendTLSPolicy、ListenerSet、TCPRoute、UDPRoute、TLSRoute（均为 `v1`）；experimental 通道额外提供这些资源的 Alpha/Beta 版本以及 XBackend、XBackendTrafficPolicy、XMesh。

![发布通道](https://gateway-api.sigs.k8s.io/images/release-channel-overlap.svg)

*图 4：标准通道与实验通道的重叠关系*

选择控制器实现：

- Envoy Gateway
- Istio
- NGINX Gateway Fabric
- Traefik
- Cilium
- Kong
- 云厂商托管 Gateway

安装控制器后确认 GatewayClass：

```bash
kubectl get gatewayclass
```

# 第一个 Gateway 和 HTTPRoute

Gateway 通常由基础设施团队创建：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: prod-gateway
  namespace: infra
spec:
  gatewayClassName: eg
  listeners:
  - name: http
    port: 80
    protocol: HTTP
    hostname: "*.example.com"
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels:
            gateway-access: "true"
```

应用团队创建 HTTPRoute：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web
  namespace: prod
spec:
  parentRefs:
  - name: prod-gateway
    namespace: infra
    sectionName: http
  hostnames:
  - web.example.com
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: web
      port: 80
```

要点：

- `parentRefs` 指向 Gateway，跨命名空间时要写 `namespace`
- `sectionName` 选择 listener
- `hostnames` 必须和 Gateway listener 的 hostname 有交集
- `backendRefs` 指向同命名空间的 Service；跨命名空间需要 ReferenceGrant
- Route 是否生效看 `status.conditions` 的 `Accepted` 和 `ResolvedRefs`

# 路由匹配

HTTPRoute 的匹配顺序：

1. hostname 交集
2. path 匹配（Exact、PathPrefix、RegularExpression）
3. header/query/method 匹配
4. 多条规则按优先级和创建时间处理

```yaml
rules:
- matches:
  - path:
      type: PathPrefix
      value: /api
    headers:
    - name: x-env
      value: canary
  backendRefs:
  - name: api-canary
    port: 8080
- matches:
  - path:
      type: PathPrefix
      value: /api
  backendRefs:
  - name: api
    port: 8080
```

路由匹配是“最具体优先”，不要让多个 Route 定义冲突的 host/path。

# 流量拆分

![流量拆分](https://gateway-api.sigs.k8s.io/images/traffic-splitting-1.png)

*图 5：按权重把流量分到不同后端*

```yaml
rules:
- backendRefs:
  - name: web-v1
    port: 80
    weight: 90
  - name: web-v2
    port: 80
    weight: 10
```

按 header 灰度：

```yaml
rules:
- matches:
  - headers:
    - name: x-canary
      value: "true"
  backendRefs:
  - name: web-v2
    port: 80
- backendRefs:
  - name: web-v1
    port: 80
```

权重和 header 可以组合，先灰度内部用户，再逐步放量。

# TLS

![TLS 终止](https://gateway-api.sigs.k8s.io/images/tls-overview.svg)

*图 6：Gateway 的 TLS 终止与后端连接*

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: prod-gateway
  namespace: infra
spec:
  gatewayClassName: eg
  listeners:
  - name: https
    port: 443
    protocol: HTTPS
    hostname: web.example.com
    tls:
      mode: Terminate
      certificateRefs:
      - name: web-tls
    allowedRoutes:
      namespaces:
        from: Same
```

TLS 模式：

- `Terminate`：网关终止 TLS，后端可用 HTTP 或重新加密
- `Passthrough`：网关不终止，转给后端处理

证书 Secret 必须和 Gateway 同命名空间；跨命名空间要用 ReferenceGrant。

# 跨命名空间

Gateway 在 `infra`，Route 在 `prod`，需要：

1. Gateway listener 的 `allowedRoutes.namespaces` 允许 `prod`
2. Route 的 `parentRefs` 写 `namespace: infra`
3. 如果 Route 要引用 `infra` 的 Service/Secret，需要 ReferenceGrant

ReferenceGrant 示例：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: ReferenceGrant
metadata:
  name: allow-prod-routes
  namespace: infra
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    namespace: prod
  to:
  - group: ""
    kind: Service
    name: web
```

ReferenceGrant 是“资源所有者授权别人引用”，不是 Route 自己能声明的权限。

# 重定向、重写与头操作

HTTP → HTTPS：

```yaml
rules:
- filters:
  - type: RequestRedirect
    requestRedirect:
      scheme: https
      statusCode: 301
```

路径重写：

```yaml
rules:
- matches:
  - path:
      type: PathPrefix
      value: /old
  filters:
  - type: URLRewrite
    urlRewrite:
      path:
        type: ReplacePrefixMatch
        replacePrefixMatch: /new
  backendRefs:
  - name: web
    port: 80
```

请求头修改：

```yaml
filters:
- type: RequestHeaderModifier
  requestHeaderModifier:
    set:
    - name: X-Env
      value: prod
    remove:
    - X-Internal
```

流量镜像：

```yaml
filters:
- type: RequestMirror
  requestMirror:
    backendRef:
      name: web-v2
      port: 80
```

不同控制器对 filter 的支持程度不同，要以实现的 conformance 和文档为准。

# gRPC、TCP、UDP、TLS 路由

- **GRPCRoute**：标准通道 `v1`，按 service/method/header 匹配 gRPC
- **TCPRoute**：标准通道 `v1`（v1.6 GA），四层 TCP 转发
- **UDPRoute**：标准通道 `v1`（v1.6 GA），UDP 转发
- **TLSRoute**：标准通道 `v1`，按 SNI 做 TLS 透传

使用实验通道的资源前要确认控制器支持，并安装 experimental CRD。实验 API 可能变化，不建议无评估地用于核心生产链路。

# 策略与扩展

Gateway API 核心保持精简，高级能力通过策略实现：

- **BackendTLSPolicy**：网关到后端的 TLS
- **ClientTrafficPolicy**：客户端连接、超时、TLS 参数（实现特定）
- **RateLimitPolicy**：限流（实现特定）
- **SecurityPolicy**：JWT、CORS、IP 白名单（实现特定）
- **EnvoyExtensionPolicy / WasmPlugin**：扩展（实现特定）

策略通常通过 `targetRefs` 绑定到 Gateway 或 Route。跨实现不可移植，迁移时要重新评估。

# 从 Ingress-NGINX 迁移

映射关系：

| Ingress | Gateway API |
| --- | --- |
| `IngressClass` | `GatewayClass` |
| `Ingress` | `HTTPRoute` |
| `host` + `path` | `hostnames` + `matches` |
| `backend.service` | `backendRefs` |
| `tls.secretName` | Gateway listener `tls.certificateRefs` |
| NGINX 注解 | filters 或实现特定 Policy |
| canary 注解 | `weight` + header match |
| rewrite 注解 | `URLRewrite` filter |
| whitelist 注解 | NetworkPolicy 或实现特定 Policy |

迁移步骤：

1. 盘点现有 Ingress、host/path、TLS、注解、灰度、限流、认证
2. 选择 Gateway 实现，确认 conformance 和功能覆盖
3. 部署 GatewayClass/Gateway，先不切流量
4. 把 Ingress 转成 HTTPRoute，逐条验证
5. 用 DNS 权重或灰度把流量切到新入口
6. 对比错误率、延迟、日志和证书
7. 下线 Ingress-NGINX
8. 保留回滚窗口

不要直接删除 Ingress-NGINX；先并行运行，确认 Gateway 路径稳定后再下线。

# 排障

```bash
kubectl get gatewayclass
kubectl get gateway,httproute -A
kubectl describe gateway <name> -n <ns>
kubectl describe httproute <name> -n <ns>
kubectl get events -A --sort-by=.lastTimestamp
```

重点看 status conditions：

- `Accepted`：Route 是否被 Gateway 接受
- `ResolvedRefs`：backendRefs、certificateRefs 是否解析成功
- `Programmed`：Gateway 是否已下发数据面配置

常见问题：

- `no matches for kind`：CRD 没装或版本不匹配
- `Accepted=False`：hostname 不匹配、listener 不允许该命名空间、parentRef 错
- `ResolvedRefs=False`：Service/Secret 不存在、跨命名空间缺 ReferenceGrant
- 503：后端没有 Ready Endpoint、端口错、NetworkPolicy 拦截
- TLS 错误：证书 Secret 不在同命名空间、域名不匹配、证书过期

# 企业实践

## 角色与边界

- 基础设施团队负责 GatewayClass、Gateway、监听器、TLS 和入口网络
- 应用团队只负责自己命名空间的 HTTPRoute/GRPCRoute
- 用 RBAC 限制应用团队不能修改 Gateway 和 GatewayClass
- 用 Namespace 标签和 `allowedRoutes` 控制哪些团队能挂载
- Route 变更走 GitOps 和代码评审，入口变更走平台团队审批
- 明确故障责任：入口控制器故障归平台，路由规则故障归应用

## Gateway 拓扑

常见模式：

- **共享 Gateway**：一个环境一个 Gateway，多团队通过 listener 和 allowedRoutes 隔离，成本低，但爆炸半径大
- **按团队/业务域拆分**：每个团队一个 Gateway，隔离好，资源和 IP 成本高
- **按环境拆分**：生产、预发、测试各自独立，避免测试流量影响生产
- **多集群**：每个集群一个 Gateway，前面用全局负载均衡或 DNS 做流量调度

选型考虑：

- 入口 QPS、连接数、TLS 握手和证书数量
- 故障域和升级影响范围
- IP 地址、负载均衡器和证书成本
- 团队边界和权限
- 是否需要独立 WAF/限流策略

## 域名与监听器

- Gateway listener 的 `hostname` 要和应用 Route 的 `hostnames` 有交集
- 避免使用过宽的 `*`，按域名和命名空间收紧
- 一个 listener 一种协议和端口，HTTP/HTTPS/gRPC 分开
- 用 `sectionName` 让 Route 精确绑定 listener
- TLS 多证书用 SNI，确认控制器支持
- 统一域名规范和证书命名，避免团队各自申请

## TLS 与证书

- 证书由 cert-manager 或企业 CA 统一签发和续期
- Ingress 的证书 Secret 必须和 Ingress 同命名空间；Gateway 的证书 Secret 必须和 Gateway 同命名空间
- 跨命名空间引用证书需要 ReferenceGrant
- 开启 HSTS、TLS 1.2+、禁用弱加密套件
- 证书到期、签发失败和续期失败要告警
- 网关到后端需要加密时用 BackendTLSPolicy
- 不要把私钥放进 Git 或 ConfigMap

## 策略与治理

- 限流、WAF、JWT、CORS、IP 白名单等能力通常由实现特定 Policy 提供
- 策略通过 `targetRefs` 绑定到 Gateway 或 Route，跨实现不可移植
- 入口层做统一认证和限流，应用层做业务授权
- 不要把复杂业务逻辑写进入口注解/Policy
- 策略变更先在测试环境验证，再按命名空间推广
- 对高风险路径（管理后台、支付、登录）单独加策略

## 从 Ingress 迁移

- 先盘点 Ingress、host/path、TLS、注解、灰度、限流和认证
- 选择实现后，并行部署 Gateway，不立即切流量
- 把 Ingress 逐条转成 HTTPRoute，验证 host/path/backend/TLS
- 用 DNS 权重或灰度把流量切到新入口
- 对比错误率、延迟、日志、证书和后端健康
- 保留回滚窗口，确认稳定后再下线 Ingress-NGINX
- Ingress-NGINX 已停止维护，不能依赖后续补丁，应尽快迁移

## 可观测性

- 入口访问日志：状态码、延迟、上游、客户端 IP、请求 ID
- 指标：QPS、错误率、P95/P99、连接数、TLS 握手、上游健康
- 链路追踪：在入口注入 trace header，后端继续传播
- 监控 Gateway/Route 的 `Accepted`、`Programmed`、`ResolvedRefs`
- 告警：5xx、上游超时、证书到期、控制器副本不足、配置拒绝
- 日志和指标接入统一平台，避免每个团队各自维护

## 版本与兼容

- 生产优先使用标准通道 API，实验特性要评估风险
- 关注 Gateway API 版本和实现的 conformance
- 升级 CRD 和控制器要按官方顺序，先备份 CRD 和资源
- 控制器升级可能改变默认行为，先在测试环境验证
- 多集群保持 API 和控制器版本一致，避免配置不可移植
- 不要依赖未支持的实验字段，迁移时容易失效

## 容量与可靠性

- 入口控制器至少 2 副本，跨可用区部署，配置 PDB 和反亲和
- 按 QPS、连接数、TLS 握手和证书数量做容量测试
- 配置连接 draining 和优雅退出，避免升级丢请求
- 大流量场景评估独立节点池、专用负载均衡和 DDoS 防护
- 对入口做故障演练：副本故障、证书过期、后端全挂、DNS 切换
- 入口是全局单点，必须有监控、告警和应急预案

## 官方参考

- [Gateway API](https://gateway-api.sigs.k8s.io/)
- [API 概览](https://gateway-api.sigs.k8s.io/docs/concepts/api-overview/)
- [角色与人物](https://gateway-api.sigs.k8s.io/docs/concepts/roles-and-personas/)
- [迁移自 Ingress](https://gateway-api.sigs.k8s.io/guides/getting-started/migrating-from-ingress/)
- [Ingress-NGINX 迁移指南](https://gateway-api.sigs.k8s.io/guides/getting-started/migrating-from-ingress-nginx/)
- [Kubernetes Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/)

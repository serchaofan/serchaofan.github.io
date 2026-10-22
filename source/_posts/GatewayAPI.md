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

- [为什么用 Gateway API](#%E4%B8%BA%E4%BB%80%E4%B9%88%E7%94%A8-gateway-api)
- [角色模型](#%E8%A7%92%E8%89%B2%E6%A8%A1%E5%9E%8B)
- [核心对象](#%E6%A0%B8%E5%BF%83%E5%AF%B9%E8%B1%A1)
- [安装](#%E5%AE%89%E8%A3%85)
- [第一个 Gateway 和 HTTPRoute](#%E7%AC%AC%E4%B8%80%E4%B8%AA-gateway-%E5%92%8C-httproute)
- [路由匹配](#%E8%B7%AF%E7%94%B1%E5%8C%B9%E9%85%8D)
- [流量拆分](#%E6%B5%81%E9%87%8F%E6%8B%86%E5%88%86)
- [TLS](#tls)
- [跨命名空间](#%E8%B7%A8%E5%91%BD%E5%90%8D%E7%A9%BA%E9%97%B4)
- [重定向、重写与头操作](#%E9%87%8D%E5%AE%9A%E5%90%91%E9%87%8D%E5%86%99%E4%B8%8E%E5%A4%B4%E6%93%8D%E4%BD%9C)
- [gRPC、TCP、UDP、TLS 路由](#grpctcpudptls-%E8%B7%AF%E7%94%B1)
- [策略与扩展](#%E7%AD%96%E7%95%A5%E4%B8%8E%E6%89%A9%E5%B1%95)
- [从 Ingress-NGINX 迁移](#%E4%BB%8E-ingress-nginx-%E8%BF%81%E7%A7%BB)
- [排障](#%E6%8E%92%E9%9A%9C)
- [企业实践](#%E4%BC%81%E4%B8%9A%E5%AE%9E%E8%B7%B5)
- [API 版本与发布通道](#api-%E7%89%88%E6%9C%AC%E4%B8%8E%E5%8F%91%E5%B8%83%E9%80%9A%E9%81%93)
- [角色与安全边界](#%E8%A7%92%E8%89%B2%E4%B8%8E%E5%AE%89%E5%85%A8%E8%BE%B9%E7%95%8C)
- [监听器与路由绑定](#%E7%9B%91%E5%90%AC%E5%99%A8%E4%B8%8E%E8%B7%AF%E7%94%B1%E7%BB%91%E5%AE%9A)
- [HTTPRoute 匹配与优先级](#httproute-%E5%8C%B9%E9%85%8D%E4%B8%8E%E4%BC%98%E5%85%88%E7%BA%A7)
- [过滤器与流量治理](#%E8%BF%87%E6%BB%A4%E5%99%A8%E4%B8%8E%E6%B5%81%E9%87%8F%E6%B2%BB%E7%90%86)
- [TLS 与证书深水区](#tls-%E4%B8%8E%E8%AF%81%E4%B9%A6%E6%B7%B1%E6%B0%B4%E5%8C%BA)
- [跨命名空间与 ReferenceGrant](#%E8%B7%A8%E5%91%BD%E5%90%8D%E7%A9%BA%E9%97%B4%E4%B8%8E-referencegrant)
- [策略附件模型](#%E7%AD%96%E7%95%A5%E9%99%84%E4%BB%B6%E6%A8%A1%E5%9E%8B)
- [Conformance 与实现选型](#conformance-%E4%B8%8E%E5%AE%9E%E7%8E%B0%E9%80%89%E5%9E%8B)
- [控制器实现原理](#%E6%8E%A7%E5%88%B6%E5%99%A8%E5%AE%9E%E7%8E%B0%E5%8E%9F%E7%90%86)
- [GAMMA 服务网格](#gamma-%E6%9C%8D%E5%8A%A1%E7%BD%91%E6%A0%BC)
- [迁移与灰度切流](#%E8%BF%81%E7%A7%BB%E4%B8%8E%E7%81%B0%E5%BA%A6%E5%88%87%E6%B5%81)
- [状态条件与排障](#%E7%8A%B6%E6%80%81%E6%9D%A1%E4%BB%B6%E4%B8%8E%E6%8E%92%E9%9A%9C)
- [企业拓扑与容量](#%E4%BC%81%E4%B8%9A%E6%8B%93%E6%89%91%E4%B8%8E%E5%AE%B9%E9%87%8F)
- [参考架构](#%E5%8F%82%E8%80%83%E6%9E%B6%E6%9E%84)
- [官方参考](#%E5%AE%98%E6%96%B9%E5%8F%82%E8%80%83)

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

# API 版本与发布通道

## 版本与通道

当前文章基于 Gateway API **v1.6.3**（2026-10）。Gateway API 用两个发布通道管理稳定性：

| 通道 | 内容 | 适用 |
| ---- | ---- | ---- |
| Standard | 已毕业的 Beta/GA 资源与字段 | 生产优先 |
| Experimental | Standard 全部内容 + Alpha 资源/新字段 | 评估、开发、非核心 |

v1.6.3 的 `standard-install.yaml` 包含：

- GatewayClass
- Gateway
- HTTPRoute
- GRPCRoute
- ReferenceGrant
- BackendTLSPolicy
- ListenerSet
- TCPRoute
- UDPRoute
- TLSRoute

这些资源在标准通道中提供 `v1` 版本（部分仍保留 `v1beta1`/`v1alpha` 兼容版本）。Experimental 额外包含：

- XBackend
- XBackendTrafficPolicy
- XMesh

## API 版本演进

- 新资源/字段先进入 Experimental。
- 满足 conformance、多个实现、6 个月 soak、稳定 1 个 minor + 3 个月等条件后，才可能进入 Standard。
- Beta 正在被淡化：未来资源毕业直接给 `v1`，不再新增 `v1beta1`。
- Experimental 允许 breaking change；不要把它当稳定 API。
- 升级 CRD 时注意 conversion webhook、存储版本和旧对象兼容。

## 实现能力查询

不同实现支持的功能不同，先看：

```bash
kubectl get gatewayclass <name> -o yaml
```

关注 `status.supportedFeatures`（如果实现提供），以及官方 conformance report、实现文档。不要假设“标准 API = 所有实现都支持所有字段”。

# 角色与安全边界

## 三类角色

| 角色 | 典型资源 | 权限 |
| ---- | -------- | ---- |
| 基础设施提供者 | GatewayClass、控制器 | 集群级 |
| 集群运维 | Gateway、Listener、TLS、allowedRoutes、策略 | 入口命名空间 |
| 应用开发者 | HTTPRoute/GRPCRoute | 自己命名空间 |

角色分离不是“文档建议”，而是通过 Kubernetes RBAC 落地：

- 应用团队不应有 `gateways` 写权限。
- 应用团队不应能改 GatewayClass/TLS Secret。
- 平台团队不应替应用写业务路由，除非作为 break-glass。
- Route 的 `parentRefs` 不是权限；能否挂载由 Gateway 的 `allowedRoutes` 决定。

## 关键安全边界

- **GatewayClass** 是集群级资源，定义控制器和基础设施参数。
- **Gateway** 是命名空间资源，拥有监听器、TLS、地址和挂载策略。
- **allowedRoutes.namespaces** 默认 `Same`：只允许同命名空间 Route。
- **ReferenceGrant** 控制跨命名空间引用，防止“偷偷引用别人的 Service/Secret”。
- **RBAC** 控制谁能创建/修改 Route、Gateway、ReferenceGrant。
- **Admission policy** 可以进一步限制 hostname、TLS、后端、注解/策略。

## 多租户模式

| 模式 | 隔离 | 成本 | 适用 |
| ---- | ---- | ---- | ---- |
| 共享 Gateway + allowedRoutes | 中 | 低 | 多团队共享入口 |
| 每团队/业务域一个 Gateway | 高 | 中 | 强隔离、独立 IP/证书 |
| 每环境一个 Gateway | 中高 | 中 | 生产/预发/测试隔离 |
| 每集群一个 Gateway | 高 | 高 | 多集群/多地域 |

共享 Gateway 的爆炸半径大：一个错误的 listener/策略可能影响所有团队。关键业务建议独立 Gateway 或至少独立 listener + 独立证书 + 独立策略。

# 监听器与路由绑定

## GatewayClass

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: eg
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
  parametersRef:
    group: gateway.envoyproxy.io
    kind: EnvoyProxy
    name: default
```

- `controllerName` 必须与控制器实现匹配。
- `parametersRef` 是实现特定的基础设施参数（IP 池、负载均衡器、TLS 默认值等）。
- GatewayClass 由平台团队管理，应用不应创建。

## Gateway Listener

```yaml
listeners:
- name: https
  hostname: "*.example.com"
  port: 443
  protocol: HTTPS
  tls:
    mode: Terminate
    certificateRefs:
    - name: wildcard-example-com
  allowedRoutes:
    namespaces:
      from: Selector
      selector:
        matchLabels:
          gateway-access: "true"
    kinds:
    - kind: HTTPRoute
```

关键字段：

| 字段 | 作用 |
| ---- | ---- |
| `name` | listener 名，Route 用 `sectionName` 选择 |
| `hostname` | 该 listener 接受的域名，Route hostname 必须与其有交集 |
| `port` | 监听端口 |
| `protocol` | HTTP/HTTPS/TLS/TCP/UDP |
| `tls` | Terminate/Passthrough、证书引用 |
| `allowedRoutes` | 允许哪些命名空间/类型的 Route 挂载 |
| `allowedRoutes.namespaces.from` | `Same`（默认）/`All`/`Selector` |
| `allowedRoutes.kinds` | 限制 Route 类型 |

## Listener 的 distinctiveness

同一个 Gateway 上多个 listener 必须“可区分”，否则 Gateway 可能无法 `Accepted`：

- TCP/UDP：`protocol + port` 不能重复。
- TLS：`protocol + port + hostname` 不能重复。
- HTTPS 通常还需要考虑 hostname/证书/SNI。
- 冲突的 listener 会导致整个 Gateway 配置无效或部分 listener 不生效。
- 不要用“同端口、同 hostname、不同后端”这种方式做路由；路由应交给 Route。

## Route 绑定

```yaml
parentRefs:
- name: prod-gateway
  namespace: infra
  sectionName: https
  # port: 443   # Extended feature，部分实现支持
```

绑定条件：

1. Gateway 的 `allowedRoutes.namespaces` 允许 Route 所在命名空间。
2. `allowedRoutes.kinds` 允许该 Route 类型。
3. `sectionName`/`port` 选中的 listener 与 Route 协议兼容。
4. listener 和 Route 的 hostname 至少有一个交集。
5. 跨命名空间引用 backend/cert 需要 ReferenceGrant。

Route 的 status 会按每个 parent 分别记录 `Accepted`、`ResolvedRefs` 等条件。一个 Route 可以同时挂到多个 Gateway，但每个 parent 的状态独立。

## ListenerSet

ListenerSet 把 listener 从 Gateway 拆出来，适合多团队管理同一入口：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: ListenerSet
metadata:
  name: team-a-listeners
spec:
  parentRef:
    name: shared-gateway
    kind: Gateway
    group: gateway.networking.k8s.io
  listeners:
  - name: team-a
    hostname: team-a.example.com
    port: 443
    protocol: HTTPS
    tls:
      mode: Terminate
      certificateRefs:
      - name: team-a-cert
```

Route 可以直接把 ListenerSet 作为 parentRef。注意 listener 冲突、证书命名空间、allowedRoutes 和 RBAC。

# HTTPRoute 匹配与优先级

## 匹配字段

```yaml
rules:
- matches:
  - path:
      type: PathPrefix
      value: /api
    method: GET
    headers:
    - name: x-env
      type: Exact
      value: canary
    queryParams:
    - name: debug
      type: Exact
      value: "true"
  backendRefs:
  - name: api-canary
    port: 8080
```

支持：

- `path`：`Exact`、`PathPrefix`、`RegularExpression`（正则支持因实现而异）。
- `method`：HTTP 方法。
- `headers`：`Exact`/`RegularExpression`。
- `queryParams`：`Exact`/`RegularExpression`。
- 多个 match 之间是 OR；单个 match 内字段是 AND。

## 优先级

当多个 Route/规则都能匹配时，规范要求按“更具体优先”：

1. hostname 更具体（精确 > 通配）。
2. path 更长/更精确。
3. method 匹配。
4. header 匹配数量更多。
5. query param 匹配数量更多。
6. 仍相同则按 Route 创建时间等稳定规则做 tie-breaker。

实现必须遵循规范的优先级，但不同实现的细节可能不同。实践建议：

- 不要让多条 Route 定义相同 host/path。
- 用不同 hostname 或不同 prefix 划清边界。
- 灰度用 header/weight，不要复制完全相同的规则。
- 用 `status` 检查是否被接受，而不是靠猜。

## Hostname 交集

- listener `hostname` 为 `*.example.com`，Route `hostnames` 为 `web.example.com`：匹配。
- listener `hostname` 为 `web.example.com`，Route 为 `*.example.com`：有交集，匹配该 listener，但实际只服务 `web.example.com`。
- 两边都没有 hostname：匹配所有（但要考虑 listener 的 hostname）。
- IP 不允许作为 hostname。

## 默认规则

- Route 未指定 `hostnames`：匹配 listener 的所有 hostname。
- 规则未指定 `matches`：匹配所有请求。
- 规则未指定 `backendRefs` 且没有能直接返回响应的 filter：返回 500。
- 空规则/错误引用会让 `ResolvedRefs=False`。

# 过滤器与流量治理

## Core Filters

| Filter | 作用 |
| ------ | ---- |
| RequestHeaderModifier | 添加/设置/删除请求头 |
| ResponseHeaderModifier | 添加/设置/删除响应头 |
| RequestRedirect | 重定向（scheme/host/path/port/status） |
| URLRewrite | 重写 hostname/path |
| RequestMirror | 镜像流量到另一个 backend |
| ExtensionRef | 引用实现特定扩展 |

CORS、认证、限流、WAF、重试、熔断等通常是 Extended 或实现特定 Policy，不属于 Core。

## 重定向

```yaml
filters:
- type: RequestRedirect
  requestRedirect:
    scheme: https
    statusCode: 301
```

- 只改 scheme 时，host/path 默认保留。
- `statusCode` 常用 301/302；实现可能限制。
- HTTP→HTTPS 重定向通常放在独立 HTTP listener/Route。

## 重写

```yaml
filters:
- type: URLRewrite
  urlRewrite:
    hostname: new.example.com
    path:
      type: ReplacePrefixMatch
      replacePrefixMatch: /v2
```

- `ReplaceFullPath`：替换整个 path。
- `ReplacePrefixMatch`：替换匹配到的前缀。
- hostname 重写会影响 Host header 和后端路由，谨慎使用。

## Header 操作

```yaml
filters:
- type: RequestHeaderModifier
  requestHeaderModifier:
    set:
    - name: X-Env
      value: prod
    add:
    - name: X-Trace
      value: gateway
    remove:
    - X-Internal
```

- `set` 覆盖，`add` 追加，`remove` 删除。
- 不要覆盖安全关键头（如 `Authorization`、`X-Forwarded-*`），除非明确知道后端行为。
- 响应头修改同理。

## 流量镜像

```yaml
filters:
- type: RequestMirror
  requestMirror:
    backendRef:
      name: web-v2
      port: 80
```

镜像请求会真实发送到镜像后端：

- 镜像后端必须能处理重复/副作用请求。
- 不要镜像支付、写操作等有副作用的关键链路，除非后端幂等。
- 镜像流量不计入主响应，但会消耗后端资源。

## 权重与超时

```yaml
backendRefs:
- name: web-v1
  port: 80
  weight: 90
- name: web-v2
  port: 80
  weight: 10
```

- 权重是相对值，不是绝对百分比；总和不必是 100。
- 权重 0 表示不接收流量（但仍可作为引用）。
- `timeouts.request` 覆盖整个请求，`timeouts.backendRequest` 覆盖单次后端请求；`0s` 表示禁用。
- 重试、连接池、熔断、限流、认证等由实现特定 Policy 提供，不要假设可移植。

## 发布模式

| 模式 | 实现 |
| ---- | ---- |
| Canary | header/query 匹配 + weight |
| A/B | header/cookie/hostname 匹配 |
| Blue-Green | 两个 backend + weight 0/100 切换 |
| Shadow | RequestMirror |
| 按租户 | header/query 匹配 + backend |

# TLS 与证书深水区

## Listener TLS

```yaml
tls:
  mode: Terminate
  certificateRefs:
  - name: web-cert
    # namespace: certs   # 跨命名空间需要 ReferenceGrant
```

- `Terminate`：Gateway 终止 TLS，后端可 HTTP 或重新加密。
- `Passthrough`：Gateway 只看 ClientHello/SNI，TLS 由后端终止；只适用于 TLSRoute。
- 单证书是 Core；多证书/SNI 选择是实现特定能力。
- 证书 Secret 与 Gateway 同命名空间；跨命名空间需要目标命名空间的 ReferenceGrant。
- 证书不合法/不存在/未授权时，listener `ResolvedRefs=False`。

## TLSRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: TLSRoute
metadata:
  name: tls-app
spec:
  parentRefs:
  - name: tls-gateway
    sectionName: tls
  hostnames:
  - "app.example.com"
  rules:
  - backendRefs:
    - name: tls-backend
      port: 8443
```

- 按 SNI 路由，不解密 HTTP。
- 适合数据库、非 HTTP TLS、端到端加密。
- 后端证书由后端自己管理；Gateway 不终止。
- 需要和 listener 的 `protocol: TLS` + `tls.mode: Passthrough` 配合。

## BackendTLSPolicy

网关到后端的 TLS：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: BackendTLSPolicy
metadata:
  name: backend-tls
  namespace: prod
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: api
  validation:
    hostname: api.internal
    caCertificateRefs:
    - name: internal-ca
```

- 用于 Gateway 到 Service 的 TLS 校验。
- `caCertificateRefs` 或 `wellKnownCACertificates` 二选一。
- `targetRefs` 是本命名空间的 Service；证书引用也是本地对象。
- 支持级别为 Extended，不是所有实现都支持。
- 后端证书 SAN 必须匹配 `hostname`。

## 证书生命周期

- cert-manager 签发/续期 Certificate → Secret。
- Gateway 监听 Secret 变化并热加载；实现差异要验证。
- 证书过期、续期失败、SAN 不匹配要有告警。
- 多证书/SNI 场景要确认控制器是否支持。
- 不要把私钥放 Git；用 Secret Manager/External Secrets。
- mTLS（客户端证书校验）通常由实现特定 Policy 提供，不是核心 API。

# 跨命名空间与 ReferenceGrant

## Route 挂到 Gateway

- Gateway 在 `infra`，Route 在 `prod`：
  - Route `parentRefs.namespace: infra`。
  - Gateway listener `allowedRoutes.namespaces` 允许 `prod`（Selector/All）。
  - 否则 `Accepted=False`，原因可能是 `NotAllowedByListeners`。

## Route 引用后端 Service

HTTPRoute 在 `prod`，Service 在 `backend`：

```yaml
# backend 命名空间
apiVersion: gateway.networking.k8s.io/v1
kind: ReferenceGrant
metadata:
  name: allow-prod-route
  namespace: backend
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    namespace: prod
  to:
  - group: ""
    kind: Service
    name: api
```

- ReferenceGrant 必须建在**被引用对象所在命名空间**。
- `from` 是引用方（Route），`to` 是被引用方（Service）。
- 不写 `name` 表示允许该类型所有对象，风险更大；尽量写具体 name。
- 不支持通配命名空间；每个来源命名空间都要显式列出。
- 缺 ReferenceGrant → `ResolvedRefs=False`，reason `RefNotPermitted`。

## Gateway 引用跨命名空间证书

Gateway 在 `infra`，Secret 在 `certs`：

```yaml
# certs 命名空间
kind: ReferenceGrant
metadata:
  name: allow-gateway-cert
  namespace: certs
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: Gateway
    namespace: infra
  to:
  - group: ""
    kind: Secret
    name: web-tls
```

这比“所有 Gateway 都能读所有 Secret”安全得多。

## 安全建议

- ReferenceGrant 是资源所有者的授权，不是平台单方面开放。
- 最小化 `from` 的 namespace/kind/name。
- 定期审计 ReferenceGrant，删除过期授权。
- 不要让应用团队能创建任意 ReferenceGrant 到敏感命名空间。
- 跨命名空间引用和 RBAC 是两套控制，不能互相替代。

# 策略附件模型

Gateway API 核心保持精简，高级能力通过 Policy 扩展：

- **Direct policy**：直接 target 某个 Gateway/Route/Service。
- **Inherited policy**：target 父资源，影响其下所有子资源。
- 直接策略通常优先于继承策略；冲突时以实现文档为准。
- `targetRefs` 可以带 `sectionName` 精确到 listener/route rule/service port。
- Policy 的 status 也要检查 `Accepted`/`ResolvedRefs`。

典型实现策略：

| 实现 | 策略 |
| ---- | ---- |
| Envoy Gateway | ClientTrafficPolicy、BackendTrafficPolicy、SecurityPolicy、EnvoyExtensionPolicy |
| Istio | AuthorizationPolicy、RequestAuthentication、Telemetry、DestinationRule |
| Cilium | CiliumNetworkPolicy、CiliumGatewayClassConfig |
| Kong | KongPlugin、KongIngress |
| NGINX Gateway Fabric | 部分通过注解/实现配置 |

注意：

- 这些不是 Gateway API 标准，跨实现不可移植。
- 迁移实现时要重新评估限流、认证、WAF、重试、超时、CORS。
- 不要把关键安全策略只写在某个控制器的私有注解里，至少要有文档和测试。

# Conformance 与实现选型

## 支持级别

| 级别 | 含义 |
| ---- | ---- |
| Core | 所有合规实现都应支持，可移植 |
| Extended | 可移植但非所有实现支持，行为一致 |
| Implementation-specific | 厂商私有，无跨实现保证 |

## 选型维度

- 是否通过对应 Route/Profile 的 conformance。
- 支持的 Route 类型：HTTP、GRPC、TLS、TCP、UDP。
- TLS：Terminate/Passthrough、多证书/SNI、BackendTLSPolicy、mTLS。
- 流量治理：限流、重试、超时、熔断、镜像、CORS、JWT、WAF。
- 多租户：Gateway/ListenerSet、allowedRoutes、ReferenceGrant、RBAC。
- 可观测性：访问日志、指标、追踪、status。
- 运维：升级、PDB、多副本、配置分发、控制面性能。
- 生态：与 service mesh、GitOps、cert-manager、云 LB 的集成。
- 商业支持与社区活跃度。

常见实现：

- Envoy Gateway
- Istio
- Cilium
- Kong
- Traefik
- NGINX Gateway Fabric
- HAProxy
- 云厂商托管 Gateway

不要只看“支持 Gateway API”，要看它支持哪些 Route、哪些 filter、哪些 Extended 特性。

# 控制器实现原理

Gateway API 只是 API，真正工作的是控制器 + 数据面：

```text
Watch CRD/Service/Secret
  → Reconcile
  → Validate（hostname、refs、TLS、conflict）
  → Translate（Envoy xDS / Istio / eBPF / 云 LB）
  → Program data plane
  → Update status
  → Emit metrics/logs/events
```

关键点：

- 每个 GatewayClass 由一个 controller 负责；`controllerName` 必须匹配。
- Controller 监听 Gateway、Route、Service、Secret、ReferenceGrant、Namespace 等。
- 路由变更最终一致：API 接受不等于数据面已生效，所以有 `Accepted` 和 `Programmed` 两个阶段。
- Secret 轮换要触发证书重载；实现可能缓存，需验证。
- 控制器要处理冲突、无效引用、部分失败、重试和限速。
- 大规模场景要关注 reconcile 次数、status 写入量、数据面配置大小和控制面内存。
- 多副本控制器需要 leader election；数据面通常独立扩展。

# GAMMA 服务网格

Gateway API 也用于东西向流量（GAMMA，Standard since v1.1）：

- 不使用 Gateway/GatewayClass。
- HTTPRoute/GRPCRoute 直接以 Service 为 parentRef。
- 路由配置应用到“流向该 Service 的流量”。
- 同一套 Route API 可以同时用于南北向和东西向。
- Mesh conformance 独立于 Gateway conformance。

典型用法：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: reviews
spec:
  parentRefs:
  - group: ""
    kind: Service
    name: reviews
  rules:
  - backendRefs:
    - name: reviews-v1
      port: 8080
    - name: reviews-v2
      port: 8080
      weight: 10
```

注意：

- Mesh 实现的支持范围差异很大。
- mTLS、授权、重试、超时通常由实现特定策略提供。
- Service 的“facet”语义（producer/consumer 路由）要看 GAMMA 文档。
- 不要把 ingress 的 Policy 直接假设能用于 mesh。

# 迁移与灰度切流

## Ingress 映射

| Ingress | Gateway API |
| ------- | ----------- |
| IngressClass | GatewayClass |
| Ingress | HTTPRoute |
| host/path | hostnames + matches |
| backend.service | backendRefs |
| tls.secretName | Gateway listener certificateRefs |
| NGINX 注解 | filters/Policy |
| canary 注解 | weight/header match |
| rewrite 注解 | URLRewrite |
| whitelist 注解 | NetworkPolicy/Policy |
| auth/rate limit | 实现特定 Policy |

## 工具

- `ingress2gateway` 可以把 Ingress 转成 Gateway API 资源。
- 转换后必须人工 review：注解、TLS、rewrite、auth、限流、灰度通常不能 1:1 映射。
- 不要直接在生产用工具生成的结果替换，先在测试环境验证。

## 切流

1. 并行部署 Gateway 和 HTTPRoute，不切 DNS。
2. 用 Host 文件/测试域名验证。
3. 用 DNS 权重、全局负载均衡权重或灰度比例切流。
4. 对比错误率、延迟、5xx、证书、后端健康。
5. 观察窗口内保留回滚路径。
6. 逐步扩大，最后下线 Ingress-NGINX。
7. 保留旧配置和回滚窗口，不要立即删除。

## 迁移检查

- host/path 是否一一对应。
- TLS 证书/SAN/协议是否一致。
- 灰度/重写/重定向/头操作是否等价。
- 限流、认证、WAF、IP 白名单是否覆盖。
- 访问日志/指标/追踪是否连续。
- 回滚是否能在分钟级完成。
- Ingress-NGINX 退役时间，不要依赖未维护组件。

# 状态条件与排障

## Gateway 条件

| 条件 | 含义 |
| ---- | ---- |
| Accepted | Gateway 配置被控制器接受 |
| Programmed | 数据面已下发 |
| Addresses | 实际分配的 IP/主机名 |
| Listeners[].conditions | 每个 listener 的 Accepted/Programmed/ResolvedRefs/Conflicted |

## Route 条件

| 条件 | 含义 |
| ---- | ---- |
| Accepted | Route 被该 parent 接受 |
| ResolvedRefs | backendRefs/certificateRefs 解析成功 |
| PartiallyInvalid | 部分规则无效 |
| Conflicted | 与其他 Route 冲突 |

常见 reason：

- `NoMatchingParent`
- `NotAllowedByListeners`
- `NoMatchingListenerHostname`
- `UnsupportedProtocol`
- `RefNotPermitted`
- `InvalidKind`
- `BackendNotFound`
- `UnsupportedValue`
- `AddressNotAssigned`
- `ListenersNotValid`

## 排障命令

```bash
kubectl get gatewayclass
kubectl get gateway,httproute,grpcroute,tlsroute -A
kubectl describe gateway <name> -n <ns>
kubectl describe httproute <name> -n <ns>
kubectl get events -A --sort-by=.lastTimestamp

# 实现特定
istioctl analyze
egctl config
kubectl logs deploy/<gateway-controller> -n <ns>
```

排查顺序：

1. CRD 版本和控制器是否匹配。
2. GatewayClass `Accepted`。
3. Gateway listener `Programmed`/`Addresses`。
4. Route `Accepted`/`ResolvedRefs`。
5. Service/Endpoint/NetworkPolicy。
6. TLS Secret/SAN/证书链。
7. 数据面日志/指标。
8. DNS 是否指向 Gateway 地址。

# 企业拓扑与容量

## 拓扑

- **共享 Gateway**：一个环境一个入口，平台统一 TLS/WAF/限流，应用只写 Route。
- **按业务域/团队拆分**：独立 Gateway、独立 IP/证书，隔离好，成本高。
- **按环境拆分**：prod/staging/dev 独立，避免测试流量和配置污染。
- **多集群**：每集群一个 Gateway，前面用全局 LB/DNS 调度；跨集群故障切换要演练。
- **ListenerSet**：共享 Gateway 下按团队拆 listener，兼顾共享和自治。

## 容量

关注：

- QPS、并发连接、TLS 握手率。
- 证书数量、SNI 匹配、证书轮换。
- Route/listener 数量、控制器 reconcile 压力。
- 数据面副本、CPU/内存、连接 draining。
- 访问日志量和成本。
- 限流/WAF/Auth 的额外延迟。

建议：

- 控制器至少 2 副本、反亲和、PDB。
- 数据面独立扩展，避免和控制面争资源。
- 大流量入口独立节点池/负载均衡。
- 升级先 canary 控制面，再滚动数据面。
- 监控 `Accepted`/`Programmed` 异常、5xx、P99、证书到期。
- 做副本故障、证书过期、后端全挂、DNS 切换演练。

# 参考架构

```text
DNS / Global LB
      │
      ▼
┌─────────────────────────────┐
│ Shared Gateway / ListenerSet│
│ HTTP:80 → redirect          │
│ HTTPS:443 → TLS terminate   │
│ TLS: passthrough (optional) │
└──────────────┬──────────────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
 HTTPRoute  HTTPRoute  GRPCRoute
 team-a     team-b     team-c
     │         │         │
     ▼         ▼         ▼
  Service   Service   Service
     │         │         │
     ▼         ▼         ▼
  Pods      Pods      Pods
```

配套：

- cert-manager 管理证书。
- External Secrets/Secret Manager 管理私钥。
- 策略：限流、JWT、CORS、WAF、mTLS（实现特定）。
- 可观测性：访问日志、指标、追踪、Gateway/Route status。
- GitOps：Gateway/Route/Policy 全部版本化。
- RBAC：平台管 Gateway，应用管 Route，ReferenceGrant 由资源所有者审批。

黄金路径：

1. 平台创建 GatewayClass/Gateway/listener/证书。
2. 应用在自身命名空间创建 HTTPRoute。
3. Gateway `allowedRoutes` 允许该命名空间。
4. Route 引用同命名空间 Service；跨命名空间则创建 ReferenceGrant。
5. 平台策略自动注入限流/认证/日志。
6. CI 校验 YAML、conformance、策略。
7. GitOps 同步，status 检查 `Accepted`/`Programmed`。
8. 灰度/回滚由 weight/header/flag 控制。

# 官方参考

- [Gateway API](https://gateway-api.sigs.k8s.io/)
- [API 概览](https://gateway-api.sigs.k8s.io/docs/concepts/api-overview/)
- [角色与人物](https://gateway-api.sigs.k8s.io/docs/concepts/roles-and-personas/)
- [迁移自 Ingress](https://gateway-api.sigs.k8s.io/guides/getting-started/migrating-from-ingress/)
- [Ingress-NGINX 迁移指南](https://gateway-api.sigs.k8s.io/guides/getting-started/migrating-from-ingress-nginx/)
- [Kubernetes Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/)

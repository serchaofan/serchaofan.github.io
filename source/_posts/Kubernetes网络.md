---
title: Kubernetes网络
tags: [Kubernetes, 网络]
date: 2020-01-07 22:48:17
categories: [Kubernetes]
comments: false
---

本文基于 Kubernetes v1.37 官方文档重写，讲清 Pod 网络、Service 网络、Ingress/Gateway、DNS、NetworkPolicy 和排障。旧笔记只有 80 多行且停留在 Docker/Flannel 时代，不再作为操作依据。

<!--more-->

- [网络模型](#%E7%BD%91%E7%BB%9C%E6%A8%A1%E5%9E%8B)
- [Pod 网络与 CNI](#pod-%E7%BD%91%E7%BB%9C%E4%B8%8E-cni)
- [Service 网络](#service-%E7%BD%91%E7%BB%9C)
- [Ingress 与 Gateway API](#ingress-%E4%B8%8E-gateway-api)
- [DNS](#dns)
- [NetworkPolicy](#networkpolicy)
- [跨节点网络与 CNI 选型](#%E8%B7%A8%E8%8A%82%E7%82%B9%E7%BD%91%E7%BB%9C%E4%B8%8E-cni-%E9%80%89%E5%9E%8B)
- [排障](#%E6%8E%92%E9%9A%9C)
- [企业实践](#%E4%BC%81%E4%B8%9A%E5%AE%9E%E8%B7%B5)

# 网络模型

Kubernetes 的网络模型有三条基本要求：

1. 每个 Pod 有自己的 IP
2. Pod 之间可以直接通信，不需要 NAT
3. 节点上的 agent（kubelet、kube-proxy）能和该节点上的所有 Pod 通信

Pod 到 Pod 通常是扁平网络；Pod 访问 Service 时，由节点上的转发规则把虚拟 IP 转成某个 Pod IP；出集群流量是否 NAT 取决于 CNI 的 masquerade 配置。

两个关键网段：

- **Pod CIDR**：Pod IP 的地址范围，通常每个节点分配一个子网
- **Service CIDR**：Service 虚拟 IP 的地址范围，不与 Pod CIDR 重叠

kubeadm 创建集群时用 `--pod-network-cidr` 指定 Pod 网段；kube-apiserver 用 `--service-cluster-ip-range` 指定 Service 网段。

# Pod 网络与 CNI

CNI（Container Network Interface）是容器运行时和网络插件之间的标准接口。kubelet 创建 Pod 沙箱后，调用 CNI 插件完成：

- 创建 veth pair
- 给 Pod 分配 IP
- 配置路由
- 把 Pod 接入节点网桥或 overlay
- 安装 NetworkPolicy 规则（如果 CNI 支持）

CNI 规范的基本操作是 `ADD`、`DEL`、`CHECK`、`VERSION`，部分插件还支持 `GC`、`STATUS`。

常见实现：

- **Flannel**：简单，常用 VXLAN 或 host-gw，本身不执行 NetworkPolicy
- **Calico**：BGP 三层路由为主，也支持 IPIP/VXLAN overlay；用 iptables 或 eBPF 执行 NetworkPolicy
- **Cilium**：eBPF 数据面，支持 kube-proxy replacement、NetworkPolicy、Hubble 可观测性和 Gateway API
- **Antrea**：基于 Open vSwitch，支持 NetworkPolicy 和流量可视化
- **Canal**：Flannel + Calico 策略

节点内通信通常通过 veth pair + 网桥/路由；跨节点通信由 CNI 决定走 underlay 路由还是 overlay 隧道。

# Service 网络

## 为什么需要 Service

Pod IP 会随重建变化，Service 提供稳定的虚拟 IP 和 DNS 名称，并通过 selector 选择后端 Pod。

![Service 概览](https://kubernetes.io/images/docs/services-overview.svg)

*图 1：Service 通过 selector 选择一组 Pod*

![Service 细节](https://kubernetes.io/images/docs/services-detail.svg)

*图 2：Service 的虚拟 IP、端点与转发*

## 类型

- `ClusterIP`：集群内虚拟 IP，默认类型
- `NodePort`：在每个节点监听端口，默认 30000-32767
- `LoadBalancer`：云厂商负载均衡或 MetalLB
- `ExternalName`：DNS CNAME，不做转发
- `Headless`（`clusterIP: None`）：不分配 VIP，返回 Pod IP，StatefulSet 常用

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  type: ClusterIP
  selector:
    app: web
  ports:
  - name: http
    port: 80
    targetPort: 8080
```

`port` 是 Service 端口，`targetPort` 是容器端口。多个端口时 `name` 必须唯一。

## EndpointSlice

Service 的后端由 EndpointSlice 表示：

```bash
kubectl get endpointslices -l kubernetes.io/service-name=web
```

新实现使用 `discovery.k8s.io/v1` EndpointSlice。旧的 Endpoints API 已废弃，不支持双栈，规模大时会被截断。

## kube-proxy

![iptables 模式](https://kubernetes.io/images/docs/services-iptables-overview.svg)

*图 3：iptables 模式下 Service 到 Pod 的 DNAT*

kube-proxy watch Service 和 EndpointSlice，把规则同步到节点：

- `iptables`：常见默认，规则多时同步和匹配成本上升
- `nftables`：规则管理更高效，新版本可用
- `ipvs`：已进入废弃流程，新集群不建议作为主模式

iptables/nftables 模式下，NodePort 不是 kube-proxy 进程监听端口，而是转发规则；`ss -lntp` 看不到。

主要 iptables 链：

- `KUBE-SERVICES`：入口，匹配 ClusterIP
- `KUBE-SVC-*`：Service 到后端的分发
- `KUBE-SEP-*`：具体 Endpoint
- `KUBE-MARK-MASQ`：源地址伪装

## externalTrafficPolicy

![externalTrafficPolicy](https://kubernetes.io/images/docs/sourceip-externaltrafficpolicy.svg)

*图 4：externalTrafficPolicy 对源 IP 和转发路径的影响*

- `Cluster`：可以转发到其他节点的 Pod，源 IP 可能被 SNAT
- `Local`：只转发到本节点 Pod，保留客户端源 IP；节点没有 Pod 时流量失败

`Local` 常配合节点本地负载均衡或 DaemonSet 网关使用。

## 双栈

集群可以同时分配 IPv4 和 IPv6：

```yaml
ipFamilyPolicy: PreferDualStack
ipFamilies: ["IPv4", "IPv6"]
```

需要 CNI、kube-proxy、节点和底层网络都支持。双栈排障时先确认 Service 的 `ipFamilyPolicy`/`ipFamilies`、EndpointSlice 的 `addressType`（IPv4/IPv6/FQDN）和 Pod 的 `status.podIPs`。

# Ingress 与 Gateway API

## Ingress

Ingress 使用 `networking.k8s.io/v1`，通过 `ingressClassName` 绑定 Ingress Controller：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web
spec:
  ingressClassName: nginx
  tls:
  - hosts: ["web.example.com"]
    secretName: web-tls
  rules:
  - host: web.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web
            port:
              number: 80
```

Ingress 只描述 L7 路由，实际转发由 Ingress Controller（NGINX、Traefik、HAProxy、云厂商 LB）完成。

Ingress-NGINX 已于 2026-03 后停止维护，新项目应评估 Gateway API 或其他维护中的控制器。

## Gateway API

Gateway API 通过 CRD 提供更强的表达能力：

- `GatewayClass`：控制器类型
- `Gateway`：监听器、端口、TLS
- `HTTPRoute` / `GRPCRoute`：路由规则
- `ReferenceGrant`：跨命名空间引用授权

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: web
spec:
  gatewayClassName: istio
  listeners:
  - name: http
    port: 80
    protocol: HTTP
    hostname: web.example.com
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web
spec:
  parentRefs:
  - name: web
  hostnames: ["web.example.com"]
  rules:
  - backendRefs:
    - name: web
      port: 80
```

Gateway API CRD 通常需要单独安装，具体版本以官方文档为准。

# DNS

集群 DNS 由 CoreDNS 提供。Service 域名：

```
<service>.<namespace>.svc.cluster.local
```

Pod 域名（Headless Service）：

```
<pod>.<service>.<namespace>.svc.cluster.local
```

常见问题：

- `ndots:5` 会让短域名先尝试多个 search 域，产生额外查询
- 跨命名空间访问建议用 FQDN 或 `dnsConfig`
- Headless Service 返回多个 A/AAAA 记录，客户端要处理轮询和失败重试
- NetworkPolicy 要放行 UDP/TCP 53

![NodeLocal DNSCache](https://kubernetes.io/images/docs/nodelocaldns.svg)

*图 5：NodeLocal DNSCache 减少 DNS 跨节点查询*

# NetworkPolicy

NetworkPolicy 是命名空间级的 L3/L4 访问控制，必须由 CNI 实现。Flannel 本身不执行 NetworkPolicy，需要 Calico/Canal/Antrea/Cilium。

默认拒绝入站：

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: prod
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

允许同命名空间访问：

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-namespace
  namespace: prod
spec:
  podSelector: {}
  ingress:
  - from:
    - podSelector: {}
```

允许特定命名空间：

```yaml
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: monitoring
```

注意：

- `podSelector: {}` 表示本命名空间所有 Pod
- `namespaceSelector` 和 `podSelector` 写在同一个 `from` 元素里表示 AND，分开写表示 OR
- NetworkPolicy 不处理 DNS 名称，只处理 IP/端口/标签
- 不是身份认证，不能替代 mTLS

# 跨节点网络与 CNI 选型

## Underlay 与 Overlay

- **Underlay**：Pod 直接使用底层网络可路由的 IP，性能好，但要求网络团队配合
- **Overlay**：用 VXLAN/IPIP 等隧道封装，跨子网方便，但有封装开销和 MTU 问题

Calico 常用 BGP underlay，也可选 IPIP/VXLAN；Flannel 常用 VXLAN 或 host-gw；Cilium 可用 native routing 或 tunnel。

## MTU

Overlay 会增加封装头，Pod MTU 要相应调小，否则大包会丢。例如 VXLAN 通常把 1500 调成 1450。MTU 不一致会导致“小请求正常、大请求超时”的典型故障。

## 选型考虑

- 是否需要 NetworkPolicy
- 是否需要 eBPF、可观测性、kube-proxy replacement
- 是否有多集群、双栈、Windows 节点
- 网络团队是否支持 BGP/underlay
- 是否需要加密（WireGuard/IPsec）
- 运维复杂度和故障排查成本

# 排障

## 常用命令

```bash
kubectl get pods -A -o wide
kubectl get svc,endpointslices -A
kubectl get networkpolicy -A
kubectl exec -it <pod> -- ip addr
kubectl exec -it <pod> -- ip route
kubectl exec -it <pod> -- cat /etc/resolv.conf
kubectl exec -it <pod> -- getent hosts <service>
```

节点侧：

```bash
crictl ps
crictl inspect <container>
nsenter -t <pid> -n ip addr
nsenter -t <pid> -n tcpdump -i eth0 -nn
conntrack -L
iptables -t nat -L KUBE-SERVICES -n -v
```

## 典型故障

**Pod 之间不通**

- Pod 是否在同一 CNI 网络
- NetworkPolicy 是否拦截
- 节点路由/BGP/隧道是否正常
- MTU 是否一致

**Pod 访问 Service 不通**

- EndpointSlice 是否有后端
- Service selector 和 targetPort 是否正确
- kube-proxy 是否正常
- conntrack 是否有旧连接
- NetworkPolicy 是否放行

**外部访问 NodePort/LoadBalancer 不通**

- externalTrafficPolicy 是否 Local 且节点无 Pod
- 云安全组/防火墙
- LoadBalancer 是否有 external IP
- kube-proxy 规则是否存在

**DNS 解析失败**

- CoreDNS 是否 Running
- NetworkPolicy 是否放行 53
- `ndots` 和 search 域
- NodeLocal DNSCache 是否正常

# 企业实践

## 网段规划

- Pod CIDR、Service CIDR 不与 IDC、VPC、VPN、其他集群重叠
- 每个集群预留足够地址，考虑节点数、Pod 密度和未来扩容
- 多集群统一规划，避免跨集群访问时路由冲突
- 双栈集群同时规划 IPv4/IPv6，并确认 CNI、kube-proxy、节点和底层网络都支持
- 网段记录到 IPAM/CMDB，变更走审批，不要临时改 Service CIDR

## CNI 选型

选型不只看“能不能通”，还要看长期运维：

- 是否需要 NetworkPolicy，是否需要 L7 策略
- 是否需要 eBPF、kube-proxy replacement、Hubble 等可观测性
- 是否有多集群、双栈、Windows 节点
- 网络团队是否支持 BGP/underlay
- 是否需要 WireGuard/IPsec 加密
- 社区活跃度、商业支持、升级路径和故障排查资料
- 更换 CNI 通常需要重建集群或复杂迁移，不要频繁更换

常见组合：

- 简单场景：Flannel + 独立 NetworkPolicy 方案（Canal）
- 通用生产：Calico（BGP/overlay + NetworkPolicy）
- eBPF/高性能/可观测性：Cilium
- 云厂商：托管 CNI，结合云网络和安全组

## NetworkPolicy 设计

- 默认拒绝入站，按需拒绝出站
- 按应用依赖放行，不要按 Namespace 全开
- DNS、监控、apiserver、Ingress/Gateway 单独放行
- 策略纳入 GitOps，先在测试集群验证
- 注意不同 CNI 对 policy 的支持差异（例如 Flannel 不执行 policy）
- 定期审计“全开”策略和长期未使用的放行规则
- NetworkPolicy 不是身份认证，敏感服务仍需要 mTLS 和授权

## Service 与入口

- 内部服务优先 ClusterIP + DNS，不要滥用 NodePort
- 需要保留客户端源 IP 时用 `externalTrafficPolicy: Local`，同时接受节点本地无 Pod 时流量失败的风险
- 裸金属 LoadBalancer 用 MetalLB 或 BGP 实现，不要假设云厂商自动创建
- 入口统一到 Ingress/Gateway，不要每个团队自己暴露 NodePort
- 统一规划 TLS 终止位置、证书管理和重定向策略
- 入口层做限流、WAF、访问日志、trace 和灰度
- Ingress-NGINX 退役后，新项目优先 Gateway API

## DNS

- CoreDNS 多副本、PDB、反亲和
- 大规模集群用 NodeLocal DNSCache 降低延迟和跨节点查询
- 控制 `ndots` 和 search 域，避免大量无效查询
- NetworkPolicy 放行 UDP/TCP 53
- 监控 DNS 延迟、NXDOMAIN、CoreDNS 错误和上游超时
- 跨命名空间访问使用 FQDN，减少 search 域依赖

## MTU 与性能

- overlay 场景统一 MTU，VXLAN 常见 1450，具体按封装头计算
- 验证大包、跨节点、跨可用区，避免“小请求正常、大请求超时”
- eBPF 模式关注内核版本、特性开关和 CNI 版本
- 高吞吐场景评估 underlay/native routing
- 用 iperf/netperf 做基准测试，记录基线

## 多集群

- Pod/Service CIDR 不重叠
- 跨集群 DNS、网关、证书和策略统一规划
- 东西向网关和 NetworkPolicy 要单独设计
- 不要只靠多集群做多租户隔离，成本和运维复杂度会上升
- 明确故障域和流量切换方案

## 排障体系

- 分层排查：Pod 网络 → Service → Ingress/Gateway → 外部网络
- 标准化命令：`get endpointslices`、`getent hosts`、`tcpdump`、`conntrack`
- 保留网络拓扑、CIDR、路由和流量路径文档
- 重大变更前做连通性、MTU 和 DNS 验证
- 把常见故障和排查步骤写成 runbook

## 官方参考

- [集群网络](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [DNS](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [Gateway API](https://gateway-api.sigs.k8s.io/)

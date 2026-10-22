---
title: Kubernetes源码简析
tags: [Kubernetes, 源码, 架构]
categories: [Kubernetes]
date: 2022-09-27 16:21:21
comments: false
---

这篇不是逐行源码分析，而是一份阅读导览：按 Kubernetes v1.37 的架构，说明核心组件从入口到落地的大致路径，方便结合官方文档和源码定位问题。

<!--more-->

- [代码仓库与目录](#%E4%BB%A3%E7%A0%81%E4%BB%93%E5%BA%93%E4%B8%8E%E7%9B%AE%E5%BD%95)
- [apiserver 请求链路](#apiserver-%E8%AF%B7%E6%B1%82%E9%93%BE%E8%B7%AF)
- [控制器与 informer](#%E6%8E%A7%E5%88%B6%E5%99%A8%E4%B8%8E-informer)
- [调度器](#%E8%B0%83%E5%BA%A6%E5%99%A8)
- [kubelet 与 CRI](#kubelet-%E4%B8%8E-cri)
- [网络与存储扩展点](#%E7%BD%91%E7%BB%9C%E4%B8%8E%E5%AD%98%E5%82%A8%E6%89%A9%E5%B1%95%E7%82%B9)
- [推荐阅读顺序](#%E6%8E%A8%E8%8D%90%E9%98%85%E8%AF%BB%E9%A1%BA%E5%BA%8F)

# 代码仓库与目录

Kubernetes 主仓库：`https://github.com/kubernetes/kubernetes`

常用目录：

| 目录 | 内容 |
| --- | --- |
| `cmd/` | 各组件入口：kube-apiserver、kube-scheduler、kubelet、kube-proxy 等 |
| `pkg/` | 核心实现：api、controller、scheduler、kubelet、proxy |
| `staging/src/k8s.io/` | 对外发布的库：client-go、apimachinery、api、cri-api、csi-translation-lib |
| `plugin/` | 准入插件、认证插件（`plugin/pkg/admission`、`plugin/pkg/auth`） |
| `pkg/scheduler/framework/plugins/` | 调度插件 |
| `test/` | 集成测试、e2e 测试 |

阅读源码前先看官方 [Components](https://kubernetes.io/docs/concepts/overview/components/) 和 [API 概念](https://kubernetes.io/docs/concepts/overview/kubernetes-api/)，否则容易陷进细节。

# apiserver 请求链路

大致路径：

```
HTTP/gRPC 请求
  → 认证（x509 / token / OIDC / webhook）
  → 鉴权（RBAC / Node / Webhook）
  → 解码与默认值
  → Mutating 准入
  → Validating 准入（含 PSA / VAP）
  → 对象校验
  → 写入 etcd
  → watch 事件通知
```

对应入口在 `cmd/kube-apiserver`，请求处理在 `staging/src/k8s.io/apiserver`。重点看：

- 认证链和鉴权链如何组合
- admission chain 的顺序
- registry 如何把 API 对象映射到 etcd 存储
- watch cache 如何加速 list/watch

排障价值：401 看认证；403 看鉴权或 Admission Forbidden；400 常见于 webhook 拒绝或请求格式错误；422 常见于 schema validation；409 看冲突。

# 控制器与 informer

控制器模式：

```
watch → 事件入队 → 取出对象 → 比较期望/实际 → 执行动作 → 更新 status
```

client-go 提供 Informer/Workqueue；controller-runtime 在其上提供 Reconcile、Manager、Builder：

- **Informer**：本地缓存 + watch，减少对 apiserver 的请求
- **Workqueue**：去重、限速、重试
- **Reconcile**：controller-runtime 的概念，把实际状态推向期望状态

阅读 `client-go/tools/cache` 和 `client-go/util/workqueue`，再看一个具体控制器，例如 Deployment 控制器，理解 level-triggered 而不是 edge-triggered 的设计。

# 调度器

调度器入口在 `cmd/kube-scheduler`，核心在 `pkg/scheduler`：

```
队列侧：QueueSort / PreEnqueue
调度周期：PreFilter → Filter → PostFilter → PreScore → Score → Reserve → Permit → PreBind
绑定周期：Bind → PostBind
```

`PostFilter` 只在没有可行节点时调用（例如抢占）。

重点：

- Scheduler Framework 的扩展点
- 插件如何注册和排序
- 缓存（snapshot）如何避免每次全量查询
- 抢占和 Pending Pod 的处理

对应官方文档：[Scheduling Framework](https://kubernetes.io/docs/concepts/scheduling-eviction/scheduling-framework/)。

# kubelet 与 CRI

kubelet 入口在 `cmd/kubelet`：

```
watch Pod → 同步 Pod → 创建 sandbox → 拉镜像 → 启动容器 → 探针 → 状态上报
```

重点：

- PodConfig 如何合并静态 Pod、API Pod、file source
- CRI 接口如何调用 containerd/CRI-O
- 探针和重启策略
- 卷挂载与 CSI
- 节点状态和驱逐

对应官方文档：[kubelet](https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/)、[CRI](https://kubernetes.io/docs/concepts/architecture/cri/)。

# 网络与存储扩展点

- **CNI**：容器运行时在创建/删除 Pod sandbox 时调用 CNI 插件，kubelet 通过 CRI 间接触发
- **CSI**：kubelet 调用 CSI 驱动挂载卷；controller 侧由 external-provisioner/attacher/resizer 等负责
- **CRI**：容器运行时接口
- **Device Plugin**：GPU/FPGA 等设备扩展

这些扩展点让 Kubernetes 核心保持稳定，把厂商实现放到外部进程。

# 推荐阅读顺序

1. 官方架构和 API 概念
2. `client-go` 的 informer/workqueue
3. 一个简单控制器（如 Deployment）
4. apiserver 的认证/鉴权/准入链
5. scheduler framework
6. kubelet 的 Pod 同步和 CRI
7. 按需看 CNI/CSI/Device Plugin

不要一开始就通读 `pkg/`，先带着问题定位：某个状态为什么出现、某个配置为什么没生效、某个事件是谁写的。

## 官方参考

- [Kubernetes 架构](https://kubernetes.io/docs/concepts/architecture/)
- [Kubernetes API](https://kubernetes.io/docs/concepts/overview/kubernetes-api/)
- [Scheduling Framework](https://kubernetes.io/docs/concepts/scheduling-eviction/scheduling-framework/)
- [CRI](https://kubernetes.io/docs/concepts/architecture/cri/)
- [client-go](https://github.com/kubernetes/client-go)

---
title: Kubernetes Operator 开发
tags: [Kubernetes, Operator, Kubebuilder, controller-runtime]
categories: [Kubernetes]
date: 2026-10-22 15:30:00
comments: false
---

本文基于 **Kubernetes v1.37**、**Kubebuilder v4.16.0**、**controller-runtime v0.25.2** 官方文档编写，讲清 Operator 的原理、CRD 设计、Reconciler、Webhook、测试、部署、升级和运维，并用三个由浅入深的开源项目做案例：Kubebuilder CronJob 教程、RabbitMQ Cluster Operator、KEDA。

<!--more-->

- [版本与范围](#%E7%89%88%E6%9C%AC%E4%B8%8E%E8%8C%83%E5%9B%B4)
- [Operator 模式](#operator-%E6%A8%A1%E5%BC%8F)
- [开发环境与脚手架](#%E5%BC%80%E5%8F%91%E7%8E%AF%E5%A2%83%E4%B8%8E%E8%84%9A%E6%89%8B%E6%9E%B6)
- [CRD 与 API 设计](#crd-%E4%B8%8E-api-%E8%AE%BE%E8%AE%A1)
- [控制器原理](#%E6%8E%A7%E5%88%B6%E5%99%A8%E5%8E%9F%E7%90%86)
- [Reconciler 实战](#reconciler-%E5%AE%9E%E6%88%98)
- [Webhook](#webhook)
- [测试](#%E6%B5%8B%E8%AF%95)
- [部署与打包](#%E9%83%A8%E7%BD%B2%E4%B8%8E%E6%89%93%E5%8C%85)
- [可观测性](#%E5%8F%AF%E8%A7%82%E6%B5%8B%E6%80%A7)
- [升级与兼容](#%E5%8D%87%E7%BA%A7%E4%B8%8E%E5%85%BC%E5%AE%B9)
- [性能与规模](#%E6%80%A7%E8%83%BD%E4%B8%8E%E8%A7%84%E6%A8%A1)
- [安全](#%E5%AE%89%E5%85%A8)
- [排障](#%E6%8E%92%E9%9A%9C)
- [案例：Kubebuilder CronJob](#%E6%A1%88%E4%BE%8Bkubebuilder-cronjob)
- [案例：RabbitMQ Cluster Operator](#%E6%A1%88%E4%BE%8Brabbitmq-cluster-operator)
- [案例：KEDA](#%E6%A1%88%E4%BE%8Bkeda)
- [企业实践](#%E4%BC%81%E4%B8%9A%E5%AE%9E%E8%B7%B5)
- [附录](#%E9%99%84%E5%BD%95)

# 版本与范围

- Kubernetes：v1.37（当前 v1.37.1，维护 1.37/1.36/1.35）
- Kubebuilder：v4.16.0（2026-09）
- controller-runtime：v0.25.2（2026-10）
- 语言：Go，脚手架生成的 `go.mod` 为准
- 范围：CRD、Controller、Webhook、测试、部署、升级、可观测性、性能、安全

Operator 不是“更高级的 Helm”。Helm 负责渲染和安装资源，Operator 负责在运行期持续观察、比较、修复和升级。判断是否需要 Operator：

- 需要持续自愈、扩缩容、备份恢复、滚动升级、故障切换
- 需要把领域知识编码成自动化运维逻辑
- 需要根据外部状态动态调整 Kubernetes 资源
- 只是安装一组静态 YAML：Helm/Kustomize 就够了

# Operator 模式

![Kubernetes 组件架构](https://kubernetes.io/images/docs/components-of-kubernetes.svg)

*图 1：Operator 本质上是运行在集群里的自定义控制器，和内置控制器并列*

Operator 通常由三部分组成（Webhook 可选）：

- **CRD**：定义领域对象，例如 `RabbitmqCluster`、`ScaledObject`
- **Controller/Reconciler**：观察 CR，创建/更新/删除从属资源
- **Webhook**：默认值、校验、版本转换

核心是控制循环：

```
observe → diff → act → update status → requeue
```

Reconcile 必须是**幂等**和**level-triggered**：不管被调用多少次，最终都把实际状态推向 spec 描述的目标状态。

## 控制循环的理论模型

把集群看成一个状态机：

- **期望状态**：`spec` 描述的目标
- **实际状态**：集群里真实存在的对象和外部系统
- **观察**：controller 通过 cache/watch 读取对象
- **决策**：比较期望和实际，决定创建/更新/删除
- **执行**：调用 apiserver 或外部 API
- **记录**：更新 `status`、Conditions、Events
- **再入队**：没有收敛就重试

控制循环不保证一次成功，只保证“持续趋近”。这就是 Kubernetes 的 eventual consistency（最终一致性）。

## level-triggered 与 edge-triggered

- **edge-triggered**：只对“事件”做一次反应，丢事件就丢状态
- **level-triggered**：每次 Reconcile 都重新读取当前完整状态，基于“现在是什么”决策

Kubernetes controller 是 level-triggered。即使 watch 丢事件、controller 重启、缓存重建，下一次 Reconcile 仍能从当前状态恢复。

实践含义：

- 不要依赖事件顺序
- 不要假设 Reconcile 只调用一次
- 不要在内存里保存唯一真相
- 每次 Reconcile 都从 apiserver/cache 重新读
- 事件只是“提醒你去对账”，不是“状态本身”

## Operator 与内置控制器

Deployment controller、ReplicaSet controller、Job controller 和 Operator 用的是同一套模式：

- watch 对象
- 比较期望/实际
- 调用 apiserver 写对象

区别：

- 内置控制器编译在 kube-controller-manager 里，随控制面升级
- Operator 是用户部署的普通 Pod，有自己的 RBAC、镜像和升级节奏
- Operator 不能绕过 apiserver，也不能直接改 etcd

所以 Operator 不是“特权组件”，它只是“带领域知识的自定义控制器”。

## 事件如何到达 Reconciler

```
apiserver watch
  → Informer 更新本地缓存
  → EventHandler 把 key 放入 Workqueue
  → Controller 取 key
  → Reconciler.Reconcile(ctx, key)
```

关键点：

- 队列里是 `namespace/name`，不是对象本身
- 同一个 key 会去重
- Reconcile 里按 key 重新 Get 最新对象
- 对象可能已经被删除，要处理 NotFound
- 缓存可能短暂落后，强一致场景要直读 apiserver

## 幂等、收敛与重试

**幂等**：

- 创建前先 Get，存在就更新
- 删除前先判断是否存在
- 不要每次 Reconcile 都生成随机名字/随机配置
- 外部 API 调用要带幂等键或先查询

**收敛**：

- 每次 Reconcile 都向目标状态推进一步
- 无法推进时更新 Condition 并 `RequeueAfter`
- 不要把“暂时不满足”当 error 刷日志

**重试**：

- 返回 error 触发限速重试
- 用指数退避，避免打爆 apiserver/外部系统
- 区分永久错误和临时错误：永久错误更新 Condition，不要无限重试
- 重试要有上限和告警，否则故障会被隐藏

## Operator 的运行形态

- 通常是一个 Deployment，多副本 + Leader Election
- 只有 Leader 执行 Reconcile，其他副本待命
- RBAC 只授予需要的资源
- 镜像、CRD、Webhook 证书要一起升级
- Operator 自身也要有 PDB、资源限制、监控和告警
- 跨命名空间/集群级 Operator 要单独评估权限和爆炸半径

## 能力分级

1. Basic Install：安装
2. Seamless Upgrades：升级
3. Full Lifecycle：备份、恢复、扩缩容
4. Deep Insights：指标、日志、告警
5. Auto Pilot：自动调优、自动故障处理

大多数团队做到 2–3 级就有价值，不要一开始追求全自动。

## 设计边界

- 一个 CR 管一组强相关资源，不要做成“万能平台 CR”
- 跨命名空间、跨集群能力要单独设计权限和失败模型
- 能复用 Kubernetes 原生对象就不要自造
- 状态写入 `status`，不要写回 `spec`
- CRD 是 API，要按长期兼容设计，不要随意改字段

# 开发环境与脚手架

## 前置

- Go
- Docker/Podman
- kind/minikube
- kubectl
- kubebuilder
- envtest 依赖（kube-apiserver、etcd）

## 初始化

```bash
mkdir app-operator && cd app-operator
kubebuilder init --domain example.com --repo github.com/example/app-operator

kubebuilder create api \
  --group app \
  --version v1 \
  --kind AppService \
  --resource --controller

kubebuilder create webhook \
  --group app \
  --version v1 \
  --kind AppService \
  --defaulting --programmatic-validation
```

生成的结构：

```
.
├── api/v1/                 # CRD 类型
├── cmd/main.go             # Manager 入口
├── config/                 # CRD、RBAC、Manager、Webhook 清单
├── internal/controller/    # Reconciler
├── test/                   # e2e
├── PROJECT
├── Makefile
└── go.mod
```

常用 Make 目标：

```bash
make manifests   # 生成 CRD/RBAC/Webhook
make generate    # 生成 DeepCopy 等
make install     # 安装 CRD
make run         # 本地运行 controller
make test        # 单测 + envtest
make docker-build docker-push
make deploy
```

## 本地集群

```bash
kind create cluster --name operator-dev
make install
make run
```

`make run` 使用本机 kubeconfig 运行 Manager，适合快速调试；`make deploy` 把 Manager 部署进集群，适合验证 RBAC、Webhook 和 Leader Election。

# CRD 与 API 设计

## CRD 是什么

CRD（CustomResourceDefinition）不是 controller，也不是数据库。它是向 kube-apiserver 注册一种新的 API 资源。

注册后：

- apiserver 动态提供 `/apis/<group>/<version>/<plural>` 端点
- CR 和其他内置对象一样支持 CRUD、watch、RBAC、admission、etcd 持久化
- 但没有内置 controller 处理它，需要你自己写 Operator

CRD 只解决“对象怎么存、怎么校验、怎么暴露 API”，不解决“对象应该产生什么行为”。行为由 Controller 负责。

## CRD 在 apiserver 中如何工作

```
kubectl apply CRD
  → apiextensions-apiserver 校验 CRD
  → 注册 API 资源、OpenAPI schema、转换策略
  → 写入 etcd（CRD 本身）

kubectl apply CR
  → apiserver 路由到 CRD handler
  → 认证/鉴权
  → mutating admission
  → schema/CEL 校验
  → validating admission
  → 写入 etcd
  → watch 通知 controller
```

关键点：

- CRD 由 apiserver 内置的 apiextensions-apiserver 提供，不需要额外进程
- CR 存在 etcd，和内置对象使用同一套存储机制
- apiserver 只负责存取和校验，不负责“实现业务”
- Controller watch 到 CR 后，才去创建 Deployment/Service 等从属资源

## 结构 schema 与剪枝

v1 CRD 要求 structural schema：

- 有明确的 `type`
- 字段有 schema
- 不允许未知字段被静默保留

`preserveUnknownFields: false` 是默认行为，未知字段会被剪枝（pruning）。这意味着：

- CRD schema 没声明的字段会被丢掉
- 加 `default` 后，旧对象在读取时会按 storage version 补出默认值，但不会写回 etcd；只有下一次 update 才持久化。修改默认值会影响新建、更新和读取侧表现，升级前要评估存量对象
- 不要依赖未声明字段存数据
- 修改 schema 可能影响存量对象，先在测试集群验证

## 校验与默认值的层次

1. **OpenAPI schema**：类型、必填、范围、格式、枚举
2. **CEL `XValidation`**：跨字段、复杂规则
3. **Mutating Webhook**：动态默认值、依赖外部状态
4. **Validating Webhook**：外部依赖、复杂业务校验

顺序大致是 mutating admission → schema/CEL → validating admission；具体以 apiserver 实际链路为准。

原则：

- 能用 schema/CEL 就不要用 Webhook，减少故障点
- Webhook 失败会影响创建/更新，必须有高可用和证书管理
- 默认值要考虑存量对象和升级兼容

## 存储、generation 与 status

- CR 存在 etcd，受对象大小限制（约 1.5MiB，具体以集群配置为准）
- `metadata.generation` 在 spec 变化时递增，status 更新不递增
- `status.observedGeneration` 表示 controller 已处理到哪一代
- status subresource 让 status 更新不会覆盖 spec
- status 不是数据库，不要存大日志、大文件、历史记录
- 大对象会拖慢 list/watch 和 etcd，复杂数据放外部存储

## 子资源

- `status`：controller 写状态，用户只读
- `scale`：让 HPA 通过标准接口读写副本数
  - `specReplicasPath`
  - `statusReplicasPath`
  - `labelSelectorPath`
- 自定义子资源 CRD 不支持，需要 aggregated API

## CRD vs Aggregated API

| 维度 | CRD | Aggregated API |
| --- | --- | --- |
| 实现 | apiserver 内置 | 独立 apiserver |
| 存储 | etcd | 自定义 |
| 开发成本 | 低 | 高 |
| 适用 | 大多数 Operator | 自定义存储/协议/子资源 |

大多数 Operator 用 CRD 就够了；需要自定义存储、特殊子资源或非 Kubernetes 风格 API 时再考虑 aggregated API。

## CRD 的规模与限制

- 单对象大小受 etcd/apiserver 限制
- list/watch 会返回全量对象，集群级 CRD 要控制数量
- 默认支持 `metadata.name`/`metadata.namespace`；v1.32+ 可在 `spec.versions[].selectableFields` 声明 `.spec.foo` 等字段后使用 field selector。未声明字段仍不支持；controller-runtime 的 `IndexField` 是本地缓存索引，不是 apiserver 查询
- 不适合当高频写数据库
- 大量 CR 要评估 cache 内存和 watch 带宽
- 删除 CRD 会删除所有 CR，务必谨慎
- CRD 升级不会自动迁移数据，版本转换要自己设计

## controller-runtime 如何看 CRD

- **Scheme** 注册 GVK 和 Go 类型
- **RESTMapper** 把 GVK 映射到 REST 资源
- **Cache** 按 GVK watch 并维护本地缓存
- **Client** 读写 CR，优先走缓存，写入走 apiserver
- **DeepCopy** 必须生成，否则缓存和并发读写会出问题

## 类型定义

```go
// api/v1/appservice_types.go
type AppServiceSpec struct {
    Image    string `json:"image"`
    Replicas int32  `json:"replicas,omitempty"`
    Port     int32  `json:"port,omitempty"`
}

type AppServiceStatus struct {
    ObservedGeneration int64              `json:"observedGeneration,omitempty"`
    ReadyReplicas      int32              `json:"readyReplicas,omitempty"`
    Conditions         []metav1.Condition `json:"conditions,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Ready",type=string,JSONPath=`.status.conditions[?(@.type=="Ready")].status`
// +kubebuilder:printcolumn:name="Age",type=date,JSONPath=`.metadata.creationTimestamp`
type AppService struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`
    Spec              AppServiceSpec   `json:"spec,omitempty"`
    Status            AppServiceStatus `json:"status,omitempty"`
}
```

## 校验与默认值

```go
// +kubebuilder:validation:Minimum=1
// +kubebuilder:validation:Maximum=100
// +kubebuilder:default=1
// +kubebuilder:validation:XValidation:rule="self <= 10",message="replicas 不能超过 10"
Replicas int32 `json:"replicas,omitempty"`

// +kubebuilder:validation:Pattern=`^[a-z0-9.-]+$`
Image string `json:"image"`
```

字段级 `XValidation` 的 `self` 是字段本身；如果要跨字段校验，把规则放到 struct 上，写成 `self.replicas <= 10`。

- kubebuilder marker 生成 OpenAPI schema，apiserver 在写入时校验
- `default` 在请求、读取和 admission 阶段都可能生效；读取时补的默认值不写回 etcd，下一次 update 才持久化
- `XValidation` 用 CEL 写跨字段规则
- 复杂校验、外部依赖校验放 Webhook

## Spec 与 Status

- `spec`：用户期望，控制器只读
- `status`：控制器写入，用户只读
- `status.observedGeneration`：记录控制器已处理的 spec 代数，用于判断是否落后
- `status.conditions`：标准结构，包含 `type`、`status`、`reason`、`message`、`lastTransitionTime`
- 用 `meta.SetStatusCondition` 更新，避免手写时间戳

常用 Condition：

- `Ready`
- `Progressing`
- `Degraded`
- `Available`

## API 约定

- Group 用反向域名，例如 `app.example.com`
- Kind 用单数大驼峰，复数小写
- 字段用 camelCase
- 可选布尔字段用 `*bool` + `omitempty`，区分“未设置”和显式 `false`；必填布尔字段可以用 `bool`
- 可选字段用 `omitempty`
- 不要频繁改字段语义；新增字段要向后兼容
- 列表字段考虑 `listType`/`listMapKey`，支持 server-side apply

### 字段兼容与 schema 语义

这些选择决定升级会不会丢字段、SSA 会不会打架、HPA 能不能用：

- **指针/nullable**：`false`、`0`、`""` 是合法值时，用指针区分“未设置”；不是所有字段都要指针
- **required/optional**：必填字段加 `+required`，可选字段加 `+optional`
- **不要改类型/删字段/改语义**：新增字段要能处理旧对象；删除字段至少保留一个版本
- **listType**：
  - `atomic`：整体替换
  - `set`：无序集合
  - `map`：按 key 合并，必须配 `listMapKey`
- **mapType**：`x-kubernetes-map-type: granular` 支持 SSA 按 key 管理
- **不可变字段**：用 CEL `oldSelf` 拒绝修改
- **scale subresource**：需要 HPA 时声明 `specReplicasPath`/`statusReplicasPath`
- **conversion round-trip**：`v1 → v1alpha1 → v1` 不丢字段、不改变语义
- **默认值**：修改默认值会影响新建、更新和读取侧表现，升级前评估存量对象

```go
// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="image 不可修改"
Image string `json:"image"`

// +kubebuilder:subresource:scale:specpath=.spec.replicas,statuspath=.status.replicas
```

```go
type AppServiceSpec struct {
    // +kubebuilder:validation:Optional
    // +listType=map
    // +listMapKey=name
    Env []EnvVar `json:"env,omitempty"`
}
```

## CRD 版本演进

版本阶段：

- `v1alpha1`：实验，可能不兼容
- `v1beta1`：接近稳定，仍可能调整
- `v1`：稳定，必须兼容

多版本模型：

- 每个版本有 `served` 和 `storage` 两个属性
- 有且只有一个 `storage: true`
- 旧版本可以继续 `served: true`，但写入时会被转换成 storage 版本
- 读取旧版本时，从 storage 版本转换回去
- 转换由 conversion webhook 或 None 策略完成

```yaml
spec:
  versions:
  - name: v1alpha1
    served: true
    storage: false
  - name: v1
    served: true
    storage: true
  conversion:
    strategy: Webhook
    webhook:
      conversionReviewVersions: ["v1"]
      clientConfig:
        caBundle: <base64-encoded-CA>
        service:
          namespace: app-system
          name: app-webhook
          path: /convert
```

`caBundle` 用于 apiserver 验证 conversion webhook 的证书；可以由 cert-manager 的 `cert-manager.io/inject-ca-from` 自动注入，也可以手工配置。

Hub-and-spoke：

- 选一个版本作为 hub（通常是 storage 版本）
- 其他版本作为 spoke，只实现 `ConvertTo`/`ConvertFrom` hub
- 避免 N×N 转换矩阵
- 转换必须保留语义；无法表达的字段用 annotation 保存，保证 round-trip

升级顺序：

1. 先部署 conversion webhook、Service、证书和 `caBundle`，确认可达
2. 再加新版本（`served: true`、`storage: false`）并启用 conversion
3. 验证新旧版本 round-trip
4. 切换 storage 版本
5. 用 `StorageVersionMigration` 或逐对象重写完成迁移
6. 确认 `status.storedVersions` 不再包含旧版本后，再删除旧版本

注意：

- 切换 storage 版本不会自动重写所有存量对象，通常在新写入时使用新版本
- `status.storedVersions` 记录历史上所有 storage 版本；旧版本未迁移完不能从 `spec.versions` 删除
- 可以用 `StorageVersionMigration`（`storagemigration.k8s.io`，具体版本以集群为准）强制迁移存量对象
- 弃用版本时设置 `deprecated: true` 和 `deprecationWarning`，给客户端 warning
- v1.33+ 支持 `CRDValidationRatcheting`：新增校验时，未修改的旧字段可以不被新规则拒绝
- 对 list/map/string 规则设置 `maxItems`/`maxProperties`/`maxLength`，避免 CEL 成本超预算被 apiserver 拒绝
- `x-kubernetes-preserve-unknown-fields` 是剪枝的例外，不是所有未知字段都必然被剪掉
- `conversion.strategy: None` 只适合 schema 兼容的场景，否则会丢字段或语义
- 回滚前确认旧版本还能读新数据
- conversion webhook 故障会导致跨版本读写失败，必须高可用
- 删除仍在使用的版本会破坏客户端和存量对象

# 控制器原理

## Manager 和依赖

`cmd/main.go` 创建 Manager，注册 Reconciler 和 Webhook：

```go
mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
    Scheme: scheme,
    Metrics: metricsserver.Options{
        BindAddress:   ":8443",
        SecureServing: true,
        FilterProvider: filters.WithAuthenticationAndAuthorization,
    },
    HealthProbeBindAddress: ":8081",
    LeaderElection:         true,
    LeaderElectionID:       "app-operator.example.com",
})
```

生产环境不要用明文、无鉴权的 metrics 端口；至少绑定 localhost 或用 NetworkPolicy 限制。

Manager 负责：

- 创建 Cache/Informer
- 启动 Controller
- 启动 Webhook Server
- Leader Election
- 健康检查
- Metrics

## controller-runtime 的内部结构

controller-runtime 把控制器拆成一组可组合的组件：

- **Scheme**：GVK ↔ Go 类型的映射，决定 Client 怎么编解码
- **RESTMapper**：GVK ↔ REST 资源（group/version/resource）的映射
- **Cache**：按 GVK watch，维护本地缓存，读操作优先走缓存
- **Client**：统一读写接口，读走 Cache，写走 apiserver
- **EventSource**：把 watch 事件转成 Reconcile 请求
- **Predicate**：过滤事件，决定是否入队
- **Workqueue**：去重、限速、重试
- **Reconciler**：业务逻辑
- **Manager**：把以上组件装配起来，管理生命周期、Leader Election、Webhook、健康检查

一次 Reconcile 的完整生命周期：

1. watch 到对象变化
2. Predicate 判断是否处理
3. EventHandler 生成 `namespace/name` 入队
4. Controller 从队列取 key
5. 从 Cache 读取最新对象
6. 执行业务逻辑，读写从属资源
7. 更新 status/conditions/events
8. 返回结果，决定是否重排

理解这条链路，排障时就能判断是“事件没进来”“缓存没同步”“Reconcile 报错”还是“写回失败”。

## Informer 与 Workqueue

- Informer 从 apiserver watch 对象，维护本地缓存
- Controller 从队列取 key（namespace/name），调用 Reconcile
- 队列会去重、限速、重试
- Reconcile 里用 Client 读缓存，不要每次都打 apiserver
- 写入后缓存可能短暂滞后；需要强一致读取时用 `mgr.GetAPIReader().Get(...)` 绕过缓存，普通 `client.Get` 仍然走 cache

几个默认行为：

- `MaxConcurrentReconciles` 默认是 1；同一个 key 不会并发 Reconcile，不同 key 会
- Manager 启动时先等 cache sync，`CacheSyncTimeout` 默认 2 分钟
- 默认 rate limiter 是“整体令牌桶 + per-item 指数退避”
- 返回错误会持续重试，除非用 `reconcile.TerminalError` 或自定义 limiter
- `RequeueAfter` 不走 rate limiter；`Requeue` 已弃用
- `CacheOptions.DisableFor` 可以让指定类型绕过缓存
- `CacheOptions.EnableReadYourWritesConsistency` 是 v0.25 实验特性，默认 `false`，不要假设写后读一定一致

## Reconcile 的返回值

```go
return ctrl.Result{}, nil                             // 成功，不再排队
return ctrl.Result{RequeueAfter: 30*time.Second}, nil // 等待外部条件
return ctrl.Result{}, err                             // 失败，按限速器重试
return ctrl.Result{}, reconcile.TerminalError(err)    // 永久错误，不再重试
```

- `Result.Requeue` 已弃用，而且它走限速器，不是“立即重排”
- 返回 error 时 `Result` 会被忽略；错误优先级高于 Result
- `RequeueAfter` 不走限速器，适合等待外部条件
- 默认错误会持续重试，永久错误用 `reconcile.TerminalError` 或自定义 rate limiter
- 不要用忙等打爆 apiserver

## Predicate

Predicate 过滤事件，减少无效 Reconcile：

- `GenerationChangedPredicate`：spec 变化才触发
- `LabelChangedPredicate`
- `ResourceVersionChangedPredicate`
- 自定义 predicate 过滤 status-only 更新

status 更新也会产生事件，如果不加 predicate，可能触发自己，形成热循环。

生产细节：

- predicate 要分别加在 `For`、`Owns`、`Watches` 上，不能只加在 `For`
- 删除事件必须放行，否则 finalizer/清理逻辑收不到
- `Owns` 默认只匹配 controller owner；需要匹配其他 owner 时用 `handler.EnqueueRequestForOwner` 并设置 `OnlyControllerOwner`
- 依赖 label 变化时用 `LabelChangedPredicate` + index，不要全量 List
- `GenerationChangedPredicate` 只适合 spec 变化，status/annotation 变化会被过滤
- 过滤太狠会漏事件，过滤太松会热循环；predicate 要配合测试和指标验证

## OwnerReference 与级联删除

```go
if err := ctrl.SetControllerReference(appService, deployment, r.Scheme); err != nil {
    return ctrl.Result{}, err
}
```

- 从属资源加 ownerReference，删除 CR 时自动级联删除
- 跨命名空间不能设置 ownerReference
- 集群级资源不能被命名空间级 CR 直接拥有
- 需要在删除 CR 前清理外部资源时用 finalizer；要保留从属资源时使用 orphan 级联策略或不设置 ownerReference，不要依赖 finalizer

## Finalizer

```go
const finalizer = "app.example.com/finalizer"

if appService.DeletionTimestamp.IsZero() {
    if !controllerutil.ContainsFinalizer(appService, finalizer) {
        controllerutil.AddFinalizer(appService, finalizer)
        if err := r.Update(ctx, appService); err != nil {
            return ctrl.Result{}, err
        }
    }
} else {
    if controllerutil.ContainsFinalizer(appService, finalizer) {
        // 清理外部资源
        controllerutil.RemoveFinalizer(appService, finalizer)
        if err := r.Update(ctx, appService); err != nil {
            return ctrl.Result{}, err
        }
    }
    return ctrl.Result{}, nil
}
```

Finalizer 里不要做无限重试的阻塞操作；失败要返回 error，让队列重试。

生产细节：

- 用 `client.MergeFrom` + Patch 加/删 finalizer，减少冲突
- 对象已进入 `deletionTimestamp` 后不要再加 finalizer
- 清理函数要幂等、可超时、可重入
- 跨命名空间/外部资源不能靠 ownerRef，必须 finalizer
- CRD 删除会先删除所有 CR，finalizer 可能让删除卡住
- 恢复时手工移除 finalizer 前先确认外部资源已清理

```go
patch := client.MergeFrom(appService.DeepCopy())
controllerutil.AddFinalizer(appService, finalizer)
if err := r.Patch(ctx, appService, patch); err != nil {
    return ctrl.Result{}, err
}
```

## 并发

- `MaxConcurrentReconciles` 控制并发
- 同一个 key 不会并发 Reconcile，但不同 key 会
- 共享状态要加锁或用原子操作
- 并发高时注意 apiserver QPS 和缓存内存

# Reconciler 实战

## 读取 CR

```go
func (r *AppServiceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var app appv1.AppService
    if err := r.Get(ctx, req.NamespacedName, &app); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }
    // ...
}
```

## CreateOrUpdate

```go
deploy := &appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{
    Name:      app.Name,
    Namespace: app.Namespace,
}}

op, err := controllerutil.CreateOrUpdate(ctx, r.Client, deploy, func() error {
    deploy.Spec.Replicas = &app.Spec.Replicas
    deploy.Spec.Selector = &metav1.LabelSelector{
        MatchLabels: map[string]string{"app": app.Name},
    }
    deploy.Spec.Template.ObjectMeta.Labels = map[string]string{"app": app.Name}
    deploy.Spec.Template.Spec.Containers = []corev1.Container{{
        Name:  "app",
        Image: app.Spec.Image,
        Ports: []corev1.ContainerPort{{ContainerPort: app.Spec.Port}},
    }}
    return ctrl.SetControllerReference(&app, deploy, r.Scheme)
})
```

`CreateOrUpdate` 会读-改-写，适合简单场景；复杂字段和多人协作建议 Server-Side Apply：

```go
deploy.SetGroupVersionKind(appsv1.SchemeGroupVersion.WithKind("Deployment"))
if err := r.Patch(ctx, deploy, client.Apply, client.FieldOwner("app-operator"), client.ForceOwnership); err != nil {
    return ctrl.Result{}, err
}
```

SSA 生产要点：

- `managedFields` 记录字段所有权，冲突时返回 409
- `FieldOwner` 要稳定且按控制器区分，不要每次随机
- `ForceOwnership` 会抢字段，慎用，尤其不要抢 HPA/Ingress 管理的字段
- `listType=map/set/atomic` 决定列表合并行为，设计 CRD 时就要考虑
- HPA 管理的 replicas 不要硬抢，否则扩缩容会来回打架
- Update 和 Apply 混用时注意迁移，避免字段所有权突然变化
- status 用 `Status().Apply` 或 `Status().Patch`，避免覆盖其他控制器写的 status

## 写冲突与重试

`CreateOrUpdate`、`Update`、`Status().Update` 都是读-改-写，可能返回 409 Conflict。处理原则：

- 409 后必须重新 Get，在旧对象上重试会一直冲突
- 用 `retry.RetryOnConflict` 包住读-改-写
- status 用 `Status().Patch` + `client.MergeFrom`，减少覆盖
- 区分可重试错误和永久错误，永久错误用 `reconcile.TerminalError`
- 不要在 Reconcile 里对旧对象循环重试

```go
err := retry.RetryOnConflict(retry.DefaultRetry, func() error {
    var latest appv1.AppService
    if err := r.Get(ctx, req.NamespacedName, &latest); err != nil {
        return err
    }
    latest.Spec.Replicas = desired
    return r.Update(ctx, &latest)
})
```

```go
patch := client.MergeFrom(app.DeepCopy())
app.Status.Conditions = newConditions
if err := r.Status().Patch(ctx, &app, patch); err != nil {
    return ctrl.Result{}, err
}
```

`retry` 来自 `k8s.io/client-go/util/retry`。

## 漂移检测

Reconcile 不只处理创建，还要处理：

- 用户手工改了从属资源
- HPA 改了 replicas
- 其他控制器改了 labels/annotations
- 集群升级导致默认值变化

对关键字段做比较，发现漂移就修；对 HPA 管理的 replicas 不要硬抢。

## 状态更新

```go
meta.SetStatusCondition(&app.Status.Conditions, metav1.Condition{
    Type:               "Ready",
    Status:             metav1.ConditionTrue,
    Reason:             "DeploymentReady",
    Message:            "deployment is ready",
    ObservedGeneration: app.Generation,
})
app.Status.ReadyReplicas = deploy.Status.ReadyReplicas
app.Status.ObservedGeneration = app.Generation
if err := r.Status().Update(ctx, &app); err != nil {
    return ctrl.Result{}, err
}
```

Status 更新失败通常返回 error 重试；不要吞掉。

## 监听从属资源

```go
func (r *AppServiceReconciler) SetupWithManager(mgr ctrl.Manager) error {
    return ctrl.NewControllerManagedBy(mgr).
        For(&appv1.AppService{}).
        Owns(&appsv1.Deployment{}).
        Owns(&corev1.Service{}).
        Complete(r)
}
```

`Owns` 让从属资源变化触发 owner 的 Reconcile。非 owner 资源用 `Watches` + `handler.EnqueueRequestsFromMapFunc`。

## 多资源编排

![Pod 结构](https://kubernetes.io/images/docs/pod-overview.svg)

*图 2：Operator 最终管理的仍是 Pod、Service 等原生对象*

一个 CR 管理：

- Deployment/StatefulSet
- Service/Headless Service
- ConfigMap/Secret
- ServiceAccount/Role/RoleBinding
- PDB/HPA
- Ingress/Gateway

顺序建议：

1. 先确保基础资源（SA、ConfigMap、Service）
2. 再创建 workload
3. 最后创建依赖 workload 的资源（HPA、PDB、Ingress）
4. 每步失败都更新 Condition 并返回 error

## 跨命名空间

- 默认让 CR 和从属资源同命名空间
- 跨命名空间需要显式授权和 RBAC
- 不能设置 ownerReference，需要 finalizer 手工清理
- 明确资源归属和删除顺序，避免孤儿资源
- 集群级 Operator 要特别小心权限和爆炸半径

# Webhook

## 类型

- **DefaultingWebhook**：填充默认值
- **ValidatingWebhook**：校验，拒绝非法对象
- **MutatingWebhook**：修改对象
- **ConversionWebhook**：CRD 多版本转换

![API 访问控制](https://kubernetes.io/images/docs/admin/access-control-overview.svg)

*图 3：Webhook 位于认证、鉴权之后的准入阶段*

## 校验示例

```go
func (r *AppService) ValidateCreate(ctx context.Context, obj *AppService) (admission.Warnings, error) {
    if obj.Spec.Replicas > 10 {
        return nil, fmt.Errorf("replicas 不能超过 10")
    }
    return nil, nil
}
```

controller-runtime v0.25 使用类型化接口 `admission.Validator[*AppService]`：

```go
var _ admission.Validator[*AppService] = &AppService{}
```

还要实现 `ValidateUpdate`、`ValidateDelete`；使用 `WithDefaulter` 时实现 `Default(ctx, *AppService) error`。

旧版 `webhook.Validator`/`CustomValidator` 接收 `runtime.Object`，已弃用，不要和新接口混用。

## 注册

```go
if err := builder.WebhookManagedBy(mgr, &appv1.AppService{}).
    WithValidator(&appv1.AppService{}).
    WithDefaulter(&appv1.AppService{}).
    Complete(); err != nil {
    return err
}
```

`builder` 来自 `sigs.k8s.io/controller-runtime/pkg/builder`；对象作为 `WebhookManagedBy` 的第二个参数传入，不再使用旧的 `.For()`。

## 证书

Webhook 必须 HTTPS。生产常用：

- cert-manager 自动签发和注入
- 集群 CA 或自签证书 + 轮换
- 证书 SAN 必须匹配 Service DNS
- 证书过期会导致所有创建/更新失败

生产细节：

- cert-manager 用 `cert-manager.io/inject-ca-from` 把 CA 注入 `caBundle`，要确认注入目标正确
- `caBundle` 更新有延迟，证书轮换时要考虑双 CA 过渡
- 证书 `duration`/`renewBefore` 要留足余量，到期前告警
- Webhook server 要能热加载证书，或滚动重启
- admission webhook 和 conversion webhook 可能各有一份 `caBundle`，要同步
- Service DNS SAN、namespace、name 任一变更都可能导致 TLS 校验失败
- 不要在 Webhook 内回调 apiserver，避免递归和自锁

## failurePolicy

- `Fail`：Webhook 不可用时拒绝请求，安全但可能阻断集群
- `Ignore`：Webhook 不可用时放行，可用性高但可能绕过校验

关键校验用 `Fail`，但要保证 Webhook 多副本、PDB、监控和超时。

故障面控制：

- 用 `namespaceSelector` 排除 webhook 自身命名空间，避免自锁
- Webhook 不要回调 apiserver，不要在自身准入链上生效
- 设置 `sideEffects: None`、`admissionReviewVersions: ["v1"]`、合理 `timeoutSeconds`
- 限制请求体大小和 CEL/Webhook 计算量，防止 DoS
- Webhook 启动依赖要少，证书/Secret 要提前就绪
- 多副本 + PDB + 反亲和，避免单点
- conversion webhook 没有 `failurePolicy` 可配，故障会直接失败，必须高可用

生产化字段：

```yaml
webhooks:
- name: vappservice.example.com
  admissionReviewVersions: ["v1"]
  sideEffects: None
  failurePolicy: Fail
  timeoutSeconds: 10
  matchPolicy: Equivalent
  namespaceSelector: {}
  objectSelector: {}
  clientConfig:
    caBundle: <base64-encoded-CA>
    service:
      namespace: app-system
      name: app-webhook
      path: /validate-app-example-com-v1-appservice
```

- `sideEffects: None`：否则 apiserver 可能拒绝或降级
- `admissionReviewVersions: ["v1"]`
- `timeoutSeconds` 默认 10s，不要设太大
- `matchPolicy`、`objectSelector`、`namespaceSelector` 缩小影响范围
- Webhook server 默认端口 9443，Service、PDB、NetworkPolicy 要一起规划
- conversion webhook 没有 `failurePolicy` 可配，故障会直接失败，必须高可用

## CEL 与 Webhook 怎么选

- 简单字段校验、跨字段规则：CEL `XValidation`
- 需要外部依赖、复杂逻辑、默认值：Webhook
- 能用 CRD schema/CEL 解决的，不要引入 Webhook，减少故障点

# 测试

## 单元测试

用 fake client 测 Reconcile：

```go
scheme := runtime.NewScheme()
_ = appv1.AddToScheme(scheme)
_ = appsv1.AddToScheme(scheme)

c := fake.NewClientBuilder().
    WithScheme(scheme).
    WithObjects(app, deploy).
    WithStatusSubresource(app).
    Build()
```

注意 fake client 与真实 apiserver 的差异：默认值、校验、status 子资源、ResourceVersion 行为可能不同。

## envtest

envtest 启动真实 kube-apiserver 和 etcd，不启动 kubelet/controller-manager：

```bash
make test
```

运行前提：

- 安装 `setup-envtest`，并设置 `KUBEBUILDER_ASSETS` 指向对应版本的 kube-apiserver/etcd
- `CRDDirectoryPaths` 指向 `config/crd/bases`
- Webhook 测试要额外配置证书和 webhook server，不是启动 envtest 就自动有
- CI 中固定 envtest 的 Kubernetes 版本，避免本地和流水线不一致

适合测：

- CRD schema 校验
- Reconciler 与 apiserver 交互
- Webhook
- 多版本 conversion

不适合测：

- kubelet、CNI、CSI、真实调度
- 云厂商资源

## e2e

用 kind 部署 Manager 和 CR，验证端到端：

- CR 创建后资源是否出现
- 升级/删除/finalizer
- Webhook 是否生效
- 权限是否足够

## 测试矩阵

| 类型 | 工具 | 覆盖 |
| --- | --- | --- |
| 单元 | fake client | 分支逻辑、错误处理 |
| 集成 | envtest | CRD、Reconcile、Webhook |
| e2e | kind | 部署、RBAC、升级 |
| 契约 | conformance | API 兼容 |

## 测试盲区

这些是最容易“测试全绿、上线出事”的地方：

- **fake client 不等于 apiserver**：SSA、默认值、schema 校验、status 子资源、ResourceVersion 行为都可能不同
- **envtest 没有 GC/scheduler/kubelet**：ownerReference 级联删除、Pod 调度、探针、卷挂载都不真实
- **Webhook 证书**：envtest 不会自动装证书，Webhook 测试要单独配置
- **故障注入**：apiserver 不可用、Webhook 超时、缓存同步失败、leader 切换
- **并发**：用 `go test -race`，验证多 key 并发和共享状态
- **重启恢复**：Manager 重启后能否从当前状态继续收敛
- **升级/回滚**：CRD 版本切换、StorageVersionMigration、旧版本读取
- **e2e**：至少覆盖创建、更新、删除、finalizer、Webhook、RBAC、升级

单元测试补分支，envtest 补 API 交互，e2e 补真实控制器行为；三层都要有。

# 部署与打包

## Kustomize

Kubebuilder 默认生成 `config/`：

- `config/crd`
- `config/rbac`
- `config/manager`
- `config/webhook`
- `config/default`

```bash
make manifests
make deploy IMG=registry.example.com/app-operator:v0.1.0
```

## Helm

用 Helm 管理 CRD 和 Manager 时注意：

- CRD 放在 `crds/`，Helm 不会自动升级 CRD
- Manager Deployment 用非 root、只读 rootfs、资源限制
- RBAC 最小权限
- Webhook 证书和 Service 要一起安装
- 证书/Webhook → CRD → RBAC → Manager；至少要在 CRD 变更前确保 conversion/validating webhook 可达
- `crds/` 不会被 Helm 自动升级，需单独的 Job/Hook 或 GitOps 流程处理

## Manager 部署

```yaml
spec:
  replicas: 2
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: manager
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: ["ALL"]
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            memory: 512Mi
```

- 多副本 + Leader Election
- PDB、反亲和、拓扑分布
- 只有 Leader 执行 Reconcile；webhook server 不受 leader election 限制，所有副本都会提供服务，保证 Webhook 高可用
- 监控 Leader 切换和队列积压

Leader Election 细节：

- `LeaseDuration`、`RenewDeadline`、`RetryPeriod` 要匹配集群网络和 apiserver 延迟
- 开启 `LeaderElectionReleaseOnCancel`，退出时主动释放 Lease，加快切换
- 用 `mgr.Elected()` 判断是否成为 Leader，非 Leader 的健康检查要区分 liveness/readiness
- 非 Leader 不要返回“未就绪”导致 Service 把 Webhook 流量摘掉；Webhook 需要所有副本
- 启动时先等 cache sync，再开始 Reconcile

## OLM

OLM 适合需要 Catalog、Subscription、自动升级和依赖管理的平台：

- **CSV**：ClusterServiceVersion，描述 Operator 元数据、RBAC、部署
- **Bundle**：CSV + CRD + 权限
- **Catalog**：Bundle 索引
- **Subscription**：订阅某个 Channel
- **OperatorGroup**：命名空间/多命名空间安装范围
- **InstallPlan**：实际安装计划
- **OperatorCondition**：Operator 健康/升级条件

CSV 关键字段：

- `installModes`：`OwnNamespace`、`SingleNamespace`、`MultiNamespace`、`AllNamespaces`
- `replaces` / `skips` / `olm.skipRange`：升级图
- `minKubeVersion`
- `ownedCRDs` / `requiredCRDs`：依赖和所有权
- `webhookdefinitions`：Webhook 定义
- `relatedImages`：离线/镜像清单

如果平台使用 OLM v1，关注 `ClusterExtension`；当前 OLM 主站仍以 v0 的 CSV/Subscription 模型为主，写文档时要注明版本。

Operator SDK、Kubebuilder、OLM 的分工：

- **Kubebuilder**：项目脚手架、CRD/Controller/Webhook 生成
- **Operator SDK**：基于 Kubebuilder 布局，增加 `make bundle`、scorecard、OLM 集成
- **OLM**：负责 Bundle/CSV/CRD 的安装、升级、依赖和 Catalog，不负责模板渲染
- **Helm**：负责渲染和安装资源，不负责 Catalog/自动升级编排
- 三者可以组合，但不是互相替代关系

如果只是内部部署，Helm/Kustomize 通常更简单；需要企业级分发再考虑 OLM。

# 可观测性

## Metrics

controller-runtime 自带：

- `controller_runtime_reconcile_total`
- `controller_runtime_reconcile_errors_total`
- `controller_runtime_reconcile_time_seconds`
- `workqueue_*`
- `rest_client_*`

业务指标：

- CR 总数、Ready/Degraded 数量
- 创建/更新/删除资源次数
- 外部 API 调用延迟和错误
- 队列积压和重试次数

## 日志

- 结构化日志，带 CR namespace/name、request ID
- 区分 info/error，避免 Reconcile 正常重试刷 error
- 关键操作记录事件（Event），用户可通过 `kubectl describe` 看到
- 不要在日志里打印 Secret

## Event

```go
r.Recorder.Event(&app, corev1.EventTypeNormal, "Synced", "deployment is ready")
r.Recorder.Event(&app, corev1.EventTypeWarning, "Failed", err.Error())
```

Recorder 在 `SetupWithManager` 中通过 `mgr.GetEventRecorder("appservice-controller")` 注入（`GetEventRecorderFor` 已弃用）。

Event 有数量限制和 TTL，不适合当长期审计；长期记录用日志/审计。

## 健康检查

- `/healthz`：进程健康
- `/readyz`：缓存同步、Webhook 就绪
- 探针失败时不要重启整个 Manager，先看 Leader 和缓存

## 告警

- Reconcile 错误率
- 队列积压
- Leader 切换频繁
- Webhook 拒绝率/延迟
- CR Ready=False 持续
- 外部依赖错误
- 证书到期
- apiserver 限流

# 升级与兼容

## Operator 升级

- Manager 镜像升级
- RBAC/CRD 兼容
- Webhook 证书
- Leader Election 切换
- 旧 CR 仍能被新版本处理

升级顺序：

1. 证书/Webhook 就绪
2. CRD（conversion 先于新版本）
3. RBAC
4. Manager
5. 验证 Reconcile、Webhook、CR 读写

兼容原则：

- 新版本 Manager 至少能处理上一个版本的 CR
- 新 CRD 不要让旧 Manager 完全无法启动
- 升级前备份 CR、etcd 和关键数据
- 先测试集群，再灰度生产
- 回滚方案要覆盖镜像、CRD 和数据迁移

## CRD 升级

- 新增字段：向后兼容
- 删除/重命名字段：需要 conversion 或迁移
- 修改默认值：会影响新建和更新
- 修改校验：可能拒绝存量对象
- 修改 status：注意用户脚本和监控

## 多版本

```
v1alpha1 (storage) → v1beta1 → v1 (storage)
```

- 旧版本保留 `served: true`
- conversion webhook 做双向转换
- 迁移完成后切 storage，再删除旧版本
- 回滚时确认旧版本还能读新数据

## 回滚

- Operator 镜像回滚
- CRD 回滚通常不可逆，先备份
- 数据迁移要有反向迁移或恢复方案
- 先在测试集群演练

# 性能与规模

- Cache 内存随 watch 对象数量增长
- 命名空间级 Operator 比集群级省内存
- 用 `Cache` 的 `ByObject`、`DefaultNamespaces`、label selector 限制 watch 范围
- 设置 `rest.Config.QPS/Burst`，避免打爆 apiserver
- workqueue 的 rate limiter 要和业务重试策略匹配
- 设置 `MaxConcurrentReconciles`，不要盲目调大
- 避免在 Reconcile 里做全量 List；用 Index 做字段查询
- List 要分页，避免一次性拉取大量对象
- 避免频繁 Status 更新，合并更新，减少写放大
- 大对象/大 Status 会拖慢 apiserver 和 etcd
- 上千 CR 时考虑按 namespace/hash 分片，或拆多个 Operator
- 控制 metrics 标签基数，避免 CR 名、请求 ID 进标签
- 用 pprof、benchmark 和压测找热点
- 监控 watch 带宽、apiserver 限流、队列积压和内存

# 安全

- RBAC 最小权限，按资源/动词限制
- Manager 使用独立 ServiceAccount
- 非 root、只读 rootfs、capabilities drop
- 启用 PSA，至少 baseline
- 用 NetworkPolicy 默认拒绝，放行 apiserver、DNS、Webhook 和必要依赖
- `automountServiceAccountToken: false`，需要时再挂载 projected token
- 限制 `escalate`、`bind`、`impersonate` 等高危权限
- 镜像固定 digest、签名、SBOM
- 不在日志/Event/Status 中泄露 Secret
- Secret 启用静态加密，限制读取权限
- Webhook 证书和私钥安全存储
- 限制跨命名空间/集群级权限
- 准入策略校验 CR 和从属资源
- 限制 CEL/Webhook 的计算量和请求体大小，防止 DoS
- 启用审计日志，关注 Secret、RBAC、exec 和节点操作
- 供应链：构建隔离、依赖扫描、签名验证
- 多租户场景配合 Namespace、Quota、PSA、NetworkPolicy 和独立 Operator 实例

# 排障

## Reconcile 没触发

- Controller 是否启动
- RBAC 是否允许 watch/get
- CRD 是否安装
- Predicate 是否过滤掉了事件
- OwnerReference/Owns 是否正确
- 缓存是否同步

## Cache 未同步

- 看 Manager 日志和 `/readyz`
- 检查 apiserver 连通性
- 检查 watch 是否被限流
- 重启 Manager 观察是否恢复

## RBAC Forbidden

```bash
kubectl auth can-i get deployments --as=system:serviceaccount:app-system:app-controller -n default
```

检查 Role/ClusterRole、ServiceAccount、namespace。

## Webhook 失败

- 证书 SAN、过期时间
- Service/Endpoint 是否可达
- `failurePolicy`
- 超时时间
- 是否被 NetworkPolicy 拦截

## Leader Election

- 多副本是否正常
- Lease 是否被抢
- 网络分区
- 时钟偏差

## 常用命令

```bash
kubectl get appservices -A
kubectl describe appservice <name> -n <ns>
kubectl get events -n <ns> --sort-by=.lastTimestamp
kubectl logs -n app-system deploy/app-controller-manager -f
kubectl get lease -A
```

# 案例：Kubebuilder CronJob

官方教程，最适合入门：

- CRD：`CronJob`，字段 `schedule`、`image`、`suspend`
- Controller：按 schedule 创建 Job
- 监听 `Owns(&batchv1.Job{})`
- 状态：记录上次调度时间
- 测试：envtest

学习点：

- 最小 CRD/Controller/Manager 结构
- Reconcile 的幂等和重试
- OwnerReference 和 Job 清理
- 官方脚手架和 Makefile

适合先照着做一遍，再迁移到自己的领域。

# 案例：RabbitMQ Cluster Operator

仓库：`rabbitmq/cluster-operator`，最新 v2.23.1，成熟度较高、规模适中。

## CRD

`RabbitmqCluster`（`rabbitmq.com/v1beta1`）描述：

- replicas
- image
- resources
- persistence
- service
- tls
- rabbitmq 配置
- 亲和性和 tolerations

## 管理的资源

- StatefulSet
- Headless Service
- Client Service
- ConfigMap（rabbitmq.conf、advanced.config）
- Secret（默认用户、Erlang cookie）
- ServiceAccount（`<instance>-server`）
- 可选：PDB 由用户按需创建
- PSP 场景：Role/RoleBinding 由用户创建并绑定到 `<instance>-server`

## 设计要点

- 一个 CR 管一组强相关资源，边界清晰
- 用 ownerReference/GC 清理同命名空间的子资源；如果 Operator 需要清理集群外资源，再使用 finalizer
- 用 `AllReplicasReady`、`ClusterAvailable`、`NoWarnings`、`ReconcileSuccess` 暴露状态；`ReconcileSuccess=False` 表示最近一次 reconcile 出错，配置可能已过期
- `status.defaultUser.secretReference` 指向默认用户 Secret，`status.admin.serviceReference` 指向管理服务
- 可以用 `rabbitmq.com/pauseReconciliation=true` 暂停 reconcile，便于人工排障
- 升级通过 StatefulSet 滚动更新和配置迁移
- 支持 OLM Bundle，适合企业分发

## 可借鉴

- CRD 字段按领域组织，不暴露所有底层细节
- 默认值合理，用户只写关键字段
- 资源命名稳定，便于运维和排障
- 状态和事件面向用户，不要只写日志
- 测试覆盖 envtest 和 e2e

# 案例：KEDA

仓库：`kedacore/keda`，最新 v2.21.0，规模较大，但设计清晰。

## CRD

- `ScaledObject`：把 Deployment/StatefulSet 和触发器关联起来
- `ScaledJob`：按事件触发 Job
- `TriggerAuthentication` / `ClusterTriggerAuthentication`：认证信息

## 架构

- KEDA Operator 管理 `ScaledObject`/`ScaledJob` 等 CR，并为 `ScaledObject` 创建/维护 HPA
- `ScaledObject.scaleTargetRef` 指向 Deployment/StatefulSet/CR
- CPU/内存 scaler 走 `metrics.k8s.io`；其他 scaler 走 KEDA Metrics Server 的 `external.metrics.k8s.io`
- HPA 负责实际扩缩容；KEDA 负责激活、缩到 0 和指标适配
- Admission Webhook 校验 ScaledObject

补充：

- HPA 名称和 ownership 由 KEDA 控制，不要手工改 KEDA 创建的 HPA
- `advanced.horizontalPodAutoscalerConfig` 可调 HPA 行为
- `ScaledJob` 用 `jobTargetRef` 和 `scalingStrategy` 管理 Job
- scale-to-zero 是 KEDA 的 activation 逻辑，不是 HPA 原生能力

## 设计要点

- 不自造扩缩容，复用 HPA
- CRD 只描述“怎么取指标、扩到多少”
- 认证和触发器分离
- 多租户：命名空间级 TriggerAuthentication + 集群级版本
- Webhook 做校验，避免非法配置

## 可借鉴

- 复用 Kubernetes 原生能力（HPA）
- 把外部系统适配成标准指标
- CRD 设计面向用户，不暴露实现细节
- 监控指标适配器和 Operator 自身

# 企业实践

## API 设计评审

- CRD 是长期 API，发布前做评审
- 字段命名、默认值、校验、状态语义要统一
- 预留扩展字段，但不要过度设计
- 版本演进和弃用策略提前定

## 控制器边界

- 一个 Operator 管一类领域对象
- 不要把所有运维逻辑塞进一个 CR
- 跨命名空间/集群能力单独设计
- 明确和 HPA、Istio、GitOps 的职责边界

## 发布与升级

- Operator 镜像和 CRD 分开升级
- CRD 变更先在测试集群验证
- 升级前备份 CR 和关键数据
- 保留回滚方案
- 用 GitOps 管理 Operator 和 CR

## 多租户

- 命名空间级 Operator 优先
- 集群级 Operator 要限制 RBAC 和 watch 范围
- 用 NetworkPolicy、PSA、ResourceQuota 隔离
- 避免一个租户的 CR 影响其他租户

## 可观测性

- 每个 CR 有明确的 Condition（如 `Ready`、`AllReplicasReady`）
- 关键操作发 Event
- 指标覆盖 Reconcile、队列、外部依赖
- 告警接入统一平台
- 提供 runbook

## 测试与发布门禁

- 单测 + envtest + e2e
- CRD schema 兼容性检查
- 镜像扫描、签名、SBOM
- 灰度发布和回滚演练

# 附录

## kubebuilder 命令

```bash
kubebuilder init --domain example.com --repo github.com/example/app-operator
kubebuilder create api --group app --version v1 --kind AppService --resource --controller
kubebuilder create webhook --group app --version v1 --kind AppService --defaulting --programmatic-validation

make manifests
make generate
make install
make run
make test
make deploy IMG=registry.example.com/app-operator:v0.1.0
```

## 常用 markers

```go
// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Ready",type=string,JSONPath=`.status.conditions[?(@.type=="Ready")].status`
// +kubebuilder:validation:Minimum=1
// +kubebuilder:validation:Maximum=100
// +kubebuilder:default=1
// +kubebuilder:validation:XValidation:rule="self <= 10",message="replicas 不能超过 10"
// +kubebuilder:resource:scope=Namespaced,shortName=app
```

## RBAC 示例

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-operator
  namespace: app-system
rules:
- apiGroups: ["app.example.com"]
  resources: ["appservices"]
  verbs: ["get", "list", "watch", "update", "patch"]
- apiGroups: ["app.example.com"]
  resources: ["appservices/status"]
  verbs: ["get", "update", "patch"]
- apiGroups: ["app.example.com"]
  resources: ["appservices/finalizers"]
  verbs: ["update"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["services", "configmaps"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["events"]
  verbs: ["create", "patch"]
- apiGroups: ["events.k8s.io"]
  resources: ["events"]
  verbs: ["create", "patch"]
- apiGroups: ["coordination.k8s.io"]
  resources: ["leases"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

`events` 和 `events.k8s.io` 按你实际使用的事件 API 二选一，不要同时给多余权限。这是命名空间级 `Role`，只覆盖 `app-system`。如果 Operator 要 watch 所有命名空间，应改用 `ClusterRole` + `ClusterRoleBinding`，或用 `Cache.DefaultNamespaces` 限制范围并为每个命名空间建 Role。Leader Election 的 Lease 权限 Kubebuilder 通常会单独生成，按实际清单补全。

## 官方参考

- [Kubernetes Operator 模式](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)
- [Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
- [Kubebuilder Book](https://book.kubebuilder.io/)
- [Kubebuilder CronJob 教程](https://book.kubebuilder.io/cronjob-tutorial/cronjob-tutorial.html)
- [controller-runtime](https://github.com/kubernetes-sigs/controller-runtime)
- [Operator SDK](https://sdk.operatorframework.io/)
- [OLM](https://olm.operatorframework.io/)
- [RabbitMQ Cluster Operator](https://github.com/rabbitmq/cluster-operator)
- [KEDA](https://github.com/kedacore/keda)

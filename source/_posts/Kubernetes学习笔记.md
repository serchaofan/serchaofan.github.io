---
title: Kubernetes学习笔记
date: 2018-07-13 20:33:37
tags: [云计算, Kubernetes]
categories: [云计算]
---

- [Kubernetes 概述](#kubernetes-%e6%a6%82%e8%bf%b0)
  - [k8s 结构与组件](#k8s-%e7%bb%93%e6%9e%84%e4%b8%8e%e7%bb%84%e4%bb%b6)
  - [k8s 基础对象](#k8s-%e5%9f%ba%e7%a1%80%e5%af%b9%e8%b1%a1)
    - [Pod](#pod)
    - [Label](#label)
    - [Replication Controller](#replication-controller)
    - [Deployment](#deployment)
    - [HPA](#hpa)
    - [StatefulSet](#statefulset)
    - [Service](#service)
    - [Job](#job)
    - [Volume](#volume)
    - [Persistent Volume](#persistent-volume)
    - [Namespace](#namespace)
    - [Autonation](#autonation)
    - [ConfigMap](#configmap)
  - [k8s 如何进行版本升级](#k8s-%e5%a6%82%e4%bd%95%e8%bf%9b%e8%a1%8c%e7%89%88%e6%9c%ac%e5%8d%87%e7%ba%a7)
- [Kubernetes 安装配置](#kubernetes-%e5%ae%89%e8%a3%85%e9%85%8d%e7%bd%ae)
  - [k8s 部署要点](#k8s-%e9%83%a8%e7%bd%b2%e8%a6%81%e7%82%b9)
  - [开始安装部署](#%e5%bc%80%e5%a7%8b%e5%ae%89%e8%a3%85%e9%83%a8%e7%bd%b2)
  - [Kube 初始化过程](#kube-%e5%88%9d%e5%a7%8b%e5%8c%96%e8%bf%87%e7%a8%8b)

<!--more-->

# Kubernetes 概述

Kubernetes 协调一个高可用的计算机集群，这些计算机连接起来作为一个单元工作，以更有效的方式自动化跨集群分发和调度应用程序容器。kubernetes 具有完备的集群管理能力，包括多层次的安全防护和准入机制、多租户应用之称能力、透明的服务注册和服务发现机制、内建智能负载均衡器、强大的故障发现和自我修复能力、服务滚动升级和在线扩容能力、可扩展的资源自动调度机制，以及多粒度的资源配额管理能力。因此，K8s 是一个全新的基于容器技术的分布式架构解决方案以及一个一站式完备的分布式系统开发和支撑平台。

在 K8s 中，服务（Service）是分布式集群架构的核心。一个 Service 对象的关键特征：

- 一个唯一指定的名字
- 一个虚拟 IP（Cluster IP、Service IP、VIP）和端口号
- 提供某种远程服务能力
- 被映射到提供这种服务能力的一组容器应用上

Service 服务进程都基于 Socket 通信对外服务，一个 Service 通常由多个相关服务进程提供服务，每个服务进程都有独立 Endpoint 访问点，但是 k8s 能让我们通过 service 连接到指定的服务。service 一旦创建就不再变化，意味着不需要关心服务 IP 的变化了。

k8s 通过 pod 对象，将每个服务进程包装到相应 pod 中，使其成为 pod 中的一个容器。为了简历 service 和 pod 的映射关系，k8s 首先给每个 pod 打上标签 label，然后给相应的 service 定义标签选择器（label selector）。这样，service 便能选择所有符合标签选择器的 pod。

pod 运行在节点中，一个节点可运行几百个 pod。每个 pod 中有两种容器，一种是 Pause 容器，只有一个，一种是业务容器，业务容器共享 Pause 容器和 Volume 挂载卷，使得数据交换更加高效，因此可以在设计时将多个密切相关的服务进程放入同一个 pod。并不是每个 pod 和里面运行的容器都能映射到一个 service，只有提供服务的一组 pod 才会被映射成一个服务。

K8s 集群节点的两种角色：Master 管理节点和 Nodes 工作节点。

**每个节点都有一个 Kubelet，它是管理节点并与 Master 通信的代理。** 该节点还应具有用于处理容器操作的工具，例如 Docker 或 rkt。 **处理生产流量的 Kubernetes 集群应至少有三个节点。**

节点使用主服务器公开的 Kubernetes API 与 Master 进行通信。用户还可以直接使用 Kubernetes API 与群集进行交互。

K8s 对外提供容器服务偏向于 Mesos 方式，即用户提交容器集群运行所需要的资源的申请（通常是一个配置文件），然后有 k8s 负责完成这些容器的调度，自动为容器选择运行的宿主机。

**K8S 的功能：**

- 自动化容器的部署和复制 ，控制器维护 pod 副本数量，保证一个 pod 或一组同类 pod 数量始终可用
- 随时扩展或收缩容器规模，弹性伸缩，自动缩放 pod 副本数
- 将容器组织成组（pod），并且提供容器间的负载均衡，集群服务入口为 ClusterIP
- 服务发现与注册，可使用环境变量或 DNS 插件保证容器中程序发现 pod 入口
- 使用数据卷，实现 pod 间共享数据
- 应用程序健康检查，保证健壮性
- 很容易地升级应用程序容器的新版本，滚动更新，服务不中断，一次更新一个 pod
- 服务编排，通过文件描述部署服务
- 资源监控，node 节点集成 cAdvisor 资源收集，通过 Heapster 汇总整个集群节点资源数据，存储到 InfluxDB
- 提供认证和授权，支持属性访问控制（ABAC）、角色访问控制（RBAC）

## k8s 结构与组件

**Master**节点组件：Master 也可以叫做控制平面（Control Plane）

- **kube-apiserver**：K8s API，集群的统一入口，以 HTTP API 提供接口服务，所有对象资源的增删改查和监听工作都交给 API Server 处理，再交给 etcd 存储（可选），是集群控制的入口进程。是无状态应用，可运行多个以用于平衡实例请求的流量。
- **kube-controller-manager**：控制器管理，k8s 资源对象的自动化控制中心，可理解为资源对象的大总管。处理集群中常规后台任务，一个资源对应一个控制器。
- **kube-scheduler**：用于 watch 监听 apiserver 的资源变动，并根据调度算法调度到合适的后端节点，从而创建 pod。

Master 流程概述：用户通过 API、web、CLI 向 apiserver 发送请求，kube-scheduler 监听 apiserver 的资源变动，同时通过调度算法从 node 中选出最适合的节点开始调度，并将调度的结果存在 etcd 中。

**Node**节点组件：Node 也可以叫做数据平面（Data Plane）

- **kubelet**：Master 在 Node 上的 Agent，**管理本机运行的容器的生命周期**，如创建容器、挂载数据卷，获取节点状态等工作，将每个 pod 转换为一组容器。
- **kube-proxy**：在 Node 节点上实现 pod 网络代理，**维护网络规划和四层负载均衡**工作，实现**k8s service 的通信和负载均衡**。
- **Container-Runtime**：底层容器引擎，如 docker、rkt 等。

Node 流程概述：kubelet 监听 apiserver 的资源变动，在符合的 node 上通过 kubelet 调用相关 docker 进行后续打包构建。Node 节点能在运行期间动态添加到 k8s 集群中，在默认情况下 kubelet 会向 Master 注册自己，这也是 Kubernetes 推荐的 Node 管理方式。
一旦 Node 被纳入集群管理范围， kubelet 进程就会定时向 Master 节点汇报自身的情报，例如操作系统、 Docker 版本、机器的 CPU 和内存情况，以及当前有哪些 Pod 在运行等 ， 这样 Master 可以获知每个 Node 的资源使用情况，并实现高效均衡的资源调度策略。而某个 Node 超过指定时间不上报信息时，会被 Master 判定为“**失联**”， Node 的状态被标记为**不可用**（ Not Ready ），随后 Master 会触发“工作负载大转移”的自动流程 。

第三方服务：

- **etcd**：分布式键值存储系统，用于保持集群状态，如 pod、service 对象信息。

{% asset_img 1.png %}

- **cloud-controller-manager**：K8s 与云厂商提供的服务能力对接的关键组件，也称 k8s cloudprovider。

## k8s 基础对象

k8s 提供如 Pod、Service、Namespace、Volume 的基础对象

- pod：最小的部署单元，包含一组容器和卷。同一个 Pod 里的容器共享同一个网络命名空间，可以使用 localhost 互相通信。Pod 是短暂的，不是持续性实体。
- service：是一个应用服务抽象，定义了**pod 逻辑集合**和**访问这个 pod 集合的策略**，对外提供一个访问入口，会有一个集群的 IP 地址，会将目的是该 IP 的请求负载均衡到 pod 的容器。
- volume：存储卷，支持很多类型的存储系统，如分布式存储、临时存储、网络存储等
- namespace：名称空间，即资源的作用域
- label：标签，用于区分对象（pod，service），每个对象可以有多个标签，可通过标签关联对象。

基于基本对象的更高层次抽象，称为 Controller 控制器，提供额外的功能。

- ReplicaSet：下一代的 Replication Controller。确保任何给定时间指定的 pod 副本数量，并提供声明式更新等功能。

  > Replication Controller：确保任意时间都有指定数量的 Pod 副本在运行。能根据指定的副本数量动态增加或删除副本。
  > ReplicaSet 和 Replication Controller 的区别：前者支持新的基于集合的标签，后者仅支持基于等式的标签

- Deployment：管理 ReplicaSets 和 pod，提供声明式更新等功能。官方建议用 Deployment 管理 ReplicaSets，而不是直接使用 ReplicaSets。
- StatefulSet：适合持久化的应用，具有唯一的网络标识符（IP 地址）、持久存储、有序部署、扩展、删除和滚动更新。
- DaemonSet：确保所有或一些节点运行同一个 pod，当节点加入 k8s 集群中，pod 会被调度到该节点上运行，当节点从集群中删除时，pod 也会被删除。
- Job：一次性任务，运行完成后 pod 销毁。

### Pod

每个 Pod 都有一个特殊的被称为“根容器”的 **Pause 容器** 。 Pause 容器对应的镜像属于 Kubenetes 平台的一部分，除了 Pause 容器，每个 Pod 还包含一个或多个紧密相关的用户业务容器。

设置该 Pause 容器的目的：

- 引入与业务无关且不宜死亡的 Pause 容器作为 pod 的根容器，以它的状态代表整个容器组的状态。
- pod 的多个业务容器共享 Pause 容器的 IP，共享 Pause 容器挂接的 Volume，既简化了密切关联的业务容器之间的通信问题，也解决了它们之间的文件共享问题。

{% asset_img 2.png %}

k8s 为每个 pod 分配一个 **pod IP**，pod 的**容器组共享 pod IP**，k8s 要求底层网络支持集群内任意两个 pod 之间的 TCP/IP 直接通信，通常通过虚拟二层网络实现（如 Flannel、Open vSwitch）。**在 k8s 中，一个 pod 里的容器能直接与另一主机上的 pod 的容器通信。**

pod 类型：

- 普通 pod：一旦被创建，就会放入 etcd 存储，随后被 k8s master 调度到某个具体 node 上并进行绑定，该 pod 被对应 Node 上的 kubelet 进程实例化成一组相关 docker 容器并启动。若 pod 中某个容器停止，则 k8s 会直接重启这个 pod，若 node 宕机，则 k8s 会将 node 上所有 pod 重新调度到其他 node。
- 静态 pod：没有被存放在 etcd 中，而是存放在某个具体的 node 上一个文件中，只能在此 node 上运行启动。

Pod Volume：被定义在 pod 上，然后被各自的容器挂载到自己的文件系统中，能实现一些扩展。

每个 pod 都可以对其能使用的计算资源设置限额，包括 CPU 和内存，cpu 的资源单位为 cpu 数量，**在 k8s 中以千分之一的 cpu 配额为最小单位（m 表示）**，**cpu 配额是绝对值**。通常一个容器的 cpu 配额被定义为 **100-300m，即占用 0.1-0.3 个 cpu**。内存配额也是绝对值，单位是内存字节数。

在 k8s 中，进行配额需设置两个参数：

- Requests：该资源的最小申请量，系统必须满足要求
- Limits：该资源的最大允许使用量，不能突破，当容器试图超过这个量时，k8s 会杀掉该容器并重启

通常会把 Requests 设置为一个较小的数值，符合容器平时负载的要求，把 Limits 设为峰值负载下最大资源占用量。

```yaml
例：
spec:
  containers:
  - name: db
    image: mysql
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"
```

在 Kubernetes 中运行的 Pod 正在一个私密的隔离网络上运行。默认情况下，它们可以从同一个 kubernetes 集群中的其他 pod 和服务中看到，但不能在该网络之外。当我们使用 kubectl 时，我们通过 API 端点进行交互以与我们的应用程序进行通信。

kubectl 命令可以创建一个代理，将代理转发到群集范围的专用网络。

### Label

label 标签时一个 key-val 键值对，可被附加到各种资源对象上，一个资源对象可定义任意数量 label，同个 label 可被添加到任意数量资源对象上。label 通常在资源对象定义时确定，也可在对象创建后动态添加或删除。

常见 label 示例：

- 版本标签：`release: stable`、`release: canary`
- 环境标签：`environment: dev`、`environment: qa`、`environment: production`
- 架构标签：`tier: frontend`、`tier: backend`、`tier: middleware`
- 分区标签：`partition: customerA`、`partition: customerB`
- 质量管控标签：`track: daily`、`track: weekly`

通过 Label Selector（标签选择器）查询与筛选指定 label 的资源对象，实现了类似 sql 的简单查询机制。
有两种 label selector 表达式：

- 基于等式：例：`name=xxx`（具有标签）和`env!=xxx`（不具有标签）
- 基于集合：例：`name in (xxx,xxxx)`（具有标签）和`name not in (xxx,xxxx)`（不具有标签）

多个表达式之间用`,`分隔。

**管理对象 RC 和 Service 通过 selector 字段设置关联 pod 的 label**

```yaml
例：
# pod
apiVersion: v1
kind: Pod
metadata:
  name: web-1
  labels:
    app: web-1

# 管理对象
apiVersion: v1
kind: ReplicationController # 或 Service
metadata:
  name: web-2
spec:
  replicas: 1
  selector:
    app: web-1
  .....
```

**其他管理对象如 Deployment、ReplicaSet、DaemonSet、Job 可通过 Selector 使用集合筛选条件**
`matchLabels`定义一组 label，和直接写在`selector`中一样。`matchExpressions`定义一组基于集合的筛选条件，可用的条件运算符包含`In`、`NotIn`、`Exists`、`DoesNotExists`。若同时设置了`matchLables`和`matchExpressions`，则为 AND 关系。

```yaml
selector:
  matchLabels:
    app: myweb
  matchExpressions:
    - { key: tier, operator: In, values: [frontend] }
    - { key: environment, operator: NotIn, values: [dev] }
```

label selector 的常见使用场景：

- kube-controller 在 RC 上定义的 label selector 来筛选要监控的 pod 副本数量，使 pod 副本数量始终符合预期
- kube-proxy 通过 Service 的 label selector 选择对应 pod，自动建立每个 Service 到对应 pod 的请求转发路由表，实现 Service 的智能负载均衡
- 对某些 node 定义特殊 label，并在 pod 定义文件中使用 NodeSelector 标签调度策略，kube-scheduler 可实现 pod 定向调度的特性。

### Replication Controller

用于声明某种 pod 的副本个数在任何时刻都符合某个预期值。RC 包含以下部分：

- Pod 的期望数量
- 筛选 Pod 的 Label Selector
- 当 Pod 副本数量小于预期时，用于创建新 Pod 的 Pod 模板

```yaml
例：
......
spec:
  replicas: 2
  selector:
    version: v2
  ......
```

当定义一个 RC 并提交到 K8s 集群后，Master 上的 Controller Manager 就会得到通知，定期巡检系统中存活的目标 Pod，确保目标 Pod 实例数量刚好等于 RC 的期望值，若超出则停掉些 Pod，若不足则新建些 Pod。可通过修改 RC 的期望值，实现 Pod 的动态缩放（Scaling）。
删除 RC 不会影响该 RC 已创建的 Pod，若要删除所有指定 Pod，可以将`replicas`设为 0 并更新即可。

滚动升级（Rolling Update）：旧版本的 Pod 每停止一个，就同时创建一个新版本的 Pod，通过 RC 就很容易实现。

RC 的升级版 Replica Set，支持两种 Label Selector，但目前很少单独使用，主要是被 Deployment 调用，从而形成一套 Pod 创建、删除、更新的编排机制。RepliaSet 和 Deployment 逐渐替代了 RC。

### Deployment

Deployment 用于更好解决 Pod 的编排问题，为此，Deployment 在内部使用了 ReplicaSet 来实现。Deployment 能让我们随时知道 Pod 的部署进程。

Deployment 的典型应用场景：

- 创建一个 Deployment 对象来生成对应的 ReplicaSet 并完成 Pod 副本创建
- 检查 Deployment 状态来查看部署是否完成（Pod 是否达到指定数量）
- 更新 Deployment 创建新 Pod
- 若当前 Deployment 不稳定，则回滚到上一个 Deployment 版本
- 暂停 Deployment 以便一次性修改多个 PodTemplateSpec 配置项，之后再恢复 Deployment 进行新发布
- 扩展 Deployment 应对高负载
- 查看 Deployment 状态，了解发布是否成功
- 清除不再需要的旧版本 ReplicaSet

### HPA

Horizontal Pod Autoscaler（Pod 横向自动扩容），也是一种资源对象。通过追踪分析指定 RC 控制的所有目标 Pod 的负载情况，来确定是否需要针对性调整目标 Pod 的副本数量。
HPA 有两种方法作为 Pod 负载的度量指标：

- CPUUtilizationPercentage，是目标 Pod 所有副本自身 CPU 利用率的算数平均值（`Pod自身CPU利用率=Pod当前CPU使用量/Pod Request`）。
  - 若某一时刻该值超过 80%，则意味着当前 Pod 副本数量不足以支撑更多请求，需要动态扩容，而当请求高峰过去，CPU 利用率又降下来，则副本数也自动减少到一个合理值。
  - 通常是 1min 的平均值
  - K8s 通过基础性能数据手机监控框架 Kubernetes Monitoring Architecture 支持 HPA。该框架中 K8s 定义了标准化 API 接口 Resource Metrics API，方便客户端（如 HPA）获取性能数据
- 应用自定义的度量指标（如 TPS、QPS）

```yaml
例：
apiVersion: autoscaling/v1
kind: HorizontalPodAutoscaler
metadata:
  name: php-apache
  namespace: default
spec:
  maxReplicas: 10
  minReplicas: 1
  scaleTargetRef:   # HPA控制一个叫php-apache的Deployment中的Pod副本
    kind: Deployment
    name: php-apache
  targetCPUUtilizationPercentage: 90    # 该值超过90%则触发自动扩容
```

### StatefulSet

很多服务，尤其是中间件集群，如 Mysql、MongoDB、Akka、Zookeeper 等，都是有状态的。这些集群有以下共同点：

- 每个节点都有固定的身份 ID，通过 ID 集群中成员可互相发现并通信
- 集群规模是比较固定的，集群规模不能随意变动
- 集群中的每个节点都是有状态的，通常会持久化数据到永久存储中
- 若磁盘损坏，则集群中某个节点无法正常运行，集群功能受损

StatefulSet 可以看作 Deployment/RC 的一个特殊变种，有以下特性：

- StatefulSet 中每个 Pod 都有稳定、唯一的网络标识，可用于发现集群中其他成员
- StatefulSet 控制的 Pod 副本的启停顺序是受控的，操作第 n 个 pod 时，前 n-1 个 Pod 已经运行且准备好
- StatefulSet 中 pod 采用稳定的之旧话存储卷，通过 PV 或 PVC 实现，删除 Pod 默认不会删除与 StatefulSet 相关的存储卷

StatefulSet 除了与 PV 卷捆绑使用存储 pod 状态数据，还要与 Headless Service 配合使用，每个 StatefulSet 定义都要声明属于哪个 Headless Service。

> Headless Service 和普通 Service 的区别在于：Headless Service 没有 ClusterIP。若解析 Headless Service 的 DNS 域名，则返回的是该 Service 对应所有的 Pod 的 Endpoint 列表

StatefulSet 在 Headless Service 基础上又为 Headless Service 控制的每个 Pod 实例创建一个 DNS 域名，格式为：

```
$(podname).$(Headless Service name)
```

### Service

每个 Service 就算是一个微服务。Service 定义一个服务的访问入口，前端的应用 pod 通过该入口地址访问其背后的一组 pod 副本组成的集群，而 Service 通过 Label Selector 与后端 pod 对接。最终系统由多个提供不同业务能力又相互独立的微服务单元组成，服务间通过 TCP/IP 网络通信，形成强大的弹性网络。

{% asset_img 3.png %}

**客户端如何访问由多个 Pod 副本组成的集群？**通过 node 上的 **kube-proxy** 进程，kube-proxy 是一个智能的负载均衡器，负责把对 Service 的请求转发到后端的某个 Pod 实例上，并在内部实现服务的负载均衡和会话保持，且 Service 没有共用一个负载均衡器的 IP，**每个 Service 都被分配一个全局唯一虚拟 IP，称为 Cluster IP，导致每个服务变成具备唯一 IP 地址的节点，服务调用变成了 TCP 网络通信**。
Service 一旦创建，k8s 就自动为它分配一个可用 Cluster IP，且**在 Service 的整个生命周期中，Cluster IP 不会发生改变。所以服务发现只要用 Service 的 Name 和 Cluster IP 做 DNS 映射即可。**

```yaml
kind: Service
apiVersion: v1
metadata:
  name: Service Name
spec:
  selector:
    app: Selector Label
  type: LoadBalancer | ClusterIP | NodePort
  ports:
    - name: name-of-the-port
      port: 80
      targetPort: 8080 # 提供服务的容器内暴露的端口。若不指定targetPort，则默认targetPort和Port相同
```

k8s 服务支持多个 Endpoint，并要求每个 Endpoint 都定义一个名称来区分。

```yaml
ports:
  - name: name-of-the-port
    port: 80
    targetPort: 80
  - name: name-of-the-port
    port: 808
    targetPort: 8080
```

Cluster IP 是一种虚拟 IP，但更像一个伪造的 IP，原因如下：

- Cluster IP 仅作用于 Service 对象，并由 K8s 管理分配 IP 地址（来自 Cluster IP 地址池）
- Cluster IP 无法被 ping，因为没有一个实体网络对象来响应
- Cluster IP 只能结合 Service Port 组成一个具体的通信端口，单独的 Cluster IP 不具备 TCP/IP 通信基础，并且属于 k8s 集群这个封闭的空间，外部若要访问该端口，需要做额外工作
- k8s 集群内，Node IP 网、Pod IP 网与 Cluster IP 网之间通信采用 k8s 自己的特殊路由规则，不同于传统 IP 路由。

因为 Cluster IP 是集群内部的地址，外界无法直接访问该地址，所以若有要提供给外界的服务，需要用添加 NodePort 参数

```yaml
kind: Service
apiVersion: v1
metadata:
  name: tomcat-service
spec:
  selector:
    tier: frontend
  type: NodePort
  ports:
    - port: 8080
      nodePort: 8888 # 定义了NodePort，则外界可通过Node IP:nodePort 访问tomcat服务
```

NodePort 实现方式：在 K8s 集群的每个 Node 上都为需要外部访问的 Service 开启一个对应的 TCP 监听端口（kube-proxy 进程开的），外部系统只要用任意一个 Node IP+NodePort 即可访问该服务。

若集群中有多个 Node，则需要借助负载均衡器，外部请求访问负载均衡器 IP，由负载均衡器转发流量到某个 Node 的 Nodeport 上。对于每个 Service，通常要配置一个对应的 Load Balancer，k8s 提供了自动化创建方案，只要将 spec.type 的值设为 LoadBalancer，k8s 就会自动创建一个对应的负载均衡器，并返回它的 IP 地址供外部访问。

### Job

批处理任务通常并行启动多个计算进程处理一批工作项，处理完成后整个批处理任务结束。可通过 k8s Job 启动一个批处理任务。Job 也是一种特殊的 pod 副本自动控制器，但与 RC 的区别如下：

- job 控制的 pod 副本是短暂运行的，且不能自动重启（RestartPolicy 都被设为了 Never）。k8s 也提供 CronJob，能够反复定时执行某批处理任务。
- job 控制的 pod 副本的工作模式能够多实例并行计算

### Volume

volume 是 Pod 中能被多个容器访问的共享目录，被定义在 pod 上，被该 pod 的容器挂载到各自的具体目录，Volume 的生命周期也与 Pod 一致，与容器不相关，即 pod 中容器重启停止不影响 volume，K8s 也支持多种类型 Volume。

```yaml
  volumes:
    - name:  name of the volume
    mountPath:  Path to mount
  containers:
    - image:  image
    name:  my-name
    volumeMounts:
      - name:  Name of the Volume
      mountPath:  Path to mount
```

k8s 提供的 volume 类型：

- emptyDir：在 Pod 分配到 Node 时创建的，初始内容为空，无须指定宿主机上的目录文件。可用作临时空间、中间过程 CheckPoint 的临时保存目录、一个容器需从另一容器中获取数据的目录
- hostPath：在 Pod 上挂载宿主机上的文件或目录。可用于容器的应用日志文件永久保存、定义 hostPath 为宿主机的`/var/lib/docker`使容器内应用能访问 docker 文件系统。
  - 需要注意：不同 node 上相同配置的 Pod 可能因为宿主机目录和文件不同而对 volume 的目录文件访问结果不一致。若使用资源配额管理，则 k8s 无法将 hostPath 在宿主机上的资源纳入管理
  ```yaml
  volumes:
    - name: Volume Name
    hostPath:
      path: Path to mount
  ```
- gcePersistentDisk：使用谷歌公有云的永久磁盘(PersistentDisk，PD)，PD 上的内容会被永久保存。Pod 被删除也只是 PD 卸载，而不是删除。
- awsElasticBlockStore：使用亚马逊公有云的 EBS Volume
- NFS
  ```yaml
  例：
  volumes:
    - name: nfs
      nfs:
        server: nfs-server.localhost
        path: "/"
  ```
- iSCSI：iSCSI 的目录挂载到 Pod 中
- flocker：用 Flocker 管理存储卷
- GlusterFS：用 GlusterFS 的目录挂载到 Pod 中
- RBD：用 Ceph 块设备共享存储（Rados Block Device）挂载到 Pod 中
- gitRepo：挂载一个空目录，从 git 库中 clone 一个仓库供 pod 使用
- secret：一个 Secret Volume 为 Pod 提供加密信息

### Persistent Volume

Persistent Volume（简称 PV）可被理解为 k8s 集群中某个网络存储对应的一块存储

- PV 只能是网络存储，不属于任何 Node，但可在 Node 上访问
- PV 不是被定义在 Pod 上的，而是独立于 Pod 定义的
- PV 比 Volume 支持更多的存储类型

### Namespace

命名空间多用于实现多租户资源隔离，将集群内部的资源对象分配到不同的 Namespace 中，逻辑上形成分组的不同项目、小组、用户组等，不同组共享集群资源同时还能被分别管理。

集群启动后会自动创建一个叫 default 的 Namespace，若不指明 namespace，则创建的 Pod 等资源就使用该 namespace。

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: name
```

### Autonation

Autonation 注解，是用户任意定义的附加信息，以便外部工具查找。

通常 Annotation 记录：

- build 信息、release 信息、Docker 镜像信息等
- 日志库、监控库、分析库等资源库的地址信息
- 程序调试工具信息
- 团队联系信息

### ConfigMap

问题：如何在运行时修改配置文件中的内容？
常规想法：通过 Docker Volume 将主机上的配置文件映射到容器中
引出问题：这种方法必须在主机上先创建配置文件，才能映射到容器。若是在分布式环境下，配置文件的管理与一致性很难控制。
K8S 解决方案：所有配置项都当作 key-value 字符串，作为 Map 表中的一个项，整个 Map 的数据可被持久化存储在 k8s 的 Etcd 中，然后提供 API 方便 k8s 组件或应用操作这些数据，这个 Map 就是 ConfigMap 资源对象。接着，K8S 提供一种内建机制，将存储在 etcd 中的 ConfigMap 通过 Volume 映射变成 Pod 内的配置文件，不论 Pod 调度到哪个主机，都能自动完成映射。若 ConfigMap 中的键值对改变，则 Pod 上的配置文件也会更新。

## k8s 如何进行版本升级

k8s 在声明资源对象时，有个关键属性放在最开头，`apiVersion: v1`。
K8s 采用“核心+外围扩展”的设计思路，在保持平台核心稳定的同时，具备持续演进升级的优势。k8s 大部分常见的核心资源对象都归属于 v1 这个核心 API。随着 k8s 版本升级，一些资源对象会引入新的属性，在不影响当前功能的情况下，有两种做法：

1. 在设计数据库表时，会在每个表增加一个很长的备注字段，之后扩展的数据就以某种格式（xml、json 或简单字符串）放入备注字段，因此表结构没改变，程序风险也小，但不美观
2. 直接修改数据库，增加列，但程序改动大，风险大，虽然看上去美观

于是，k8s 采用先方法 1，再方法 2 的做法。先采用方法 1，等新特性稳定成熟后，采用方法 2 升级到正式版。为此，k8s 为每个资源对象增加了一个类似备注字段的属性`Annotations`，以实现方法 1 的升级。

```yaml
例：
先是方法1
apiVersion: v1
kind: pod
metadata:
  .....
  annotations:
    pod.beta.kubernetes.io/init-containers: '[
      {
        "name": "init-mydb",
        "image": "busybox",
        "command": [......]
      }
    ]'
.....

等成熟后采用方法2升级以后
apiVersion: v1
kind: pod
metadata:
  ......
spec:
  initContainers:
  - name: init-mydb
    image: busybox
    command:
    - xxx
    ...
```

# Kubernetes 安装配置

## k8s 部署要点

若是在**测试环境**：

- 可使用单 master，单 etcd
- node 节点按需分配
- 存储直接用 nfs 或 glusterfs

若是在**生产环境**：

- 高可用的 etcd 集群（需定期备份 etc 数据文件），建立 3 或 5 或 7 个节点，保证冗余能力
- master 一定要高可用
  - kube-apiserver 要多实例部署，借助 haproxy、nginx 或 keepalived 实现高可用
  - kube-scheduler 和 kube-controller-manager 只能有一个活动实例，但可以有多个备用（主备）
- node：数量越多，冗余和负载能力越强
- 集群存储建议：Ceph、GlusterFS、iSCSI 及云存储

## 开始安装部署

实验环境：

- 3 台虚拟机 CentOS7
- Kubernetes 版本 1.17
- Docker 版本 19.03
  > 如果版本过高需要重新下载安装`yum install docker-ce-<VERSION STRING>`，如`yum install docker-ce-18.06.0.ce`
- Node1：Master，192.168.60.130
- Node2：Node，192.168.60.131
- Node3：Node，192.168.60.132

每个节点上配置 k8s 的 repo，最好用 aliyun 的源

```
[kubernetes]
name=Kubernetes
baseurl=https://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-x86_64/
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://mirrors.aliyun.com/kubernetes/yum/doc/yum-key.gpg https://mirrors.aliyun.com/kubernetes/yum/doc/rpm-package-key.gpg
```

Master 节点上不需要安装 docker，但需要安装 etcd、kubectl、kubeadm
Node 节点上要安装 docker、kubelet、kubeadm

```
# Master
yum install -y kubectl kubelet kubeadm etcd

# Node
yum install -y kubelet docker-ce kubeadm
```

所有节点都要关闭 selinux，确保时间都同步了，并在`/etc/hosts`中设置主机名

```
192.168.60.131  kubenode1
192.168.60.132  kubenode2
192.168.60.133  kubenode3
```

Master 上使用`kubeadm`安装 K8s

由于`kubectl`和`kubeadm`暂时无法使用命令补全，所以需要启用自动补全。

```
echo "source <(kubectl completion bash)" >> ~/.bashrc
echo "source <(kubeadm completion bash)" >> ~/.bashrc
source ~/.bashrc
```

先生成默认配置文件

```
kubeadm config print init-defaults > init-default.yml
```

修改配置文件的 k8s 镜像源以及 Pod 的 IP 地址范围

```yaml
imageRepository: registry.aliyuncs.com/google_containers

networking:
  dnsDomain: cluster.local
  serviceSubnet: "192.168.1.0/24"
```

可以删掉大部分内容，只保留

```yaml
apiVersion: kubeadm.k8s.io/v1beta2
kind: ClusterConfiguration
imageRepository: registry.aliyuncs.com/google_containers
kubernetesVersion: v1.17.0
networking:
  serviceSubnet: "10.1.0.0/16"
```

之后查看所需的镜像列表

```
# kubeadm config images list --config init-default.yml
W0222 23:58:01.371880   92156 validation.go:28] Cannot validate kube-proxy config - no validator is available
W0222 23:58:01.371937   92156 validation.go:28] Cannot validate kubelet config - no validator is available
registry.aliyuncs.com/google_containers/kube-apiserver:v1.17.0
registry.aliyuncs.com/google_containers/kube-controller-manager:v1.17.0
registry.aliyuncs.com/google_containers/kube-scheduler:v1.17.0
registry.aliyuncs.com/google_containers/kube-proxy:v1.17.0
registry.aliyuncs.com/google_containers/pause:3.1
registry.aliyuncs.com/google_containers/etcd:3.4.3-0
registry.aliyuncs.com/google_containers/coredns:1.6.5
```

拉取镜像

```
# kubeadm config images pull --config init-default.yml
```

也可使用开源脚本[xuxinkun/littleTools](https://github.com/xuxinkun/littleTools)

```
git clone https://github.com/xuxinkun/littleTools
cd littleTools
chmod +x install.sh
./install.sh
source /etc/profile
```

然后直接使用命令`azk8spull`拉取镜像即可，该作者在 Azure 上搭建了镜像站，脚本就是从该镜像站上 pull 镜像并打 tag。

```
azk8spull k8s.gcr.io/kube-apiserver:v1.17.3
azk8spull k8s.gcr.io/kube-controller-manager:v1.17.3
azk8spull k8s.gcr.io/kube-scheduler:v1.17.3
azk8spull k8s.gcr.io/kube-proxy:v1.17.3
azk8spull k8s.gcr.io/pause:3.1
azk8spull k8s.gcr.io/etcd:3.4.3-0
azk8spull k8s.gcr.io/coredns:1.6.5
```

开始安装 Master
**注意：kubeadm 安装过程中不涉及网络插件（CNI）的初始化，因此 kubeadm 初步安装完成的集群是没有网络功能的，任何 Pod 包括自带的 CoreDNS 都无法正常工作**

确认关闭 swap，并将`/proc/sys/net/bridge/bridge-nf-call-iptables`设为 1。在 Node 上也要这样设置

```
swapoff -a
sysctl -w net.bridge.bridge-nf-call-iptables=1
```

初始化集群的控制面（Control Panel）

```
kubeadm init --config init-default.yml
```

会提示以下信息：

```
Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/

Then you can join any number of worker nodes by running the following on each as root:

kubeadm join 192.168.60.131:6443 --token zxzy3d.r12iq7oa9mn86tst \
    --discovery-token-ca-cert-hash sha256:9bdc86f162f15c3eab5fc647f68b2009a3985626d8272dac6587f648767ea592

```

若安装失败，可使用命令`kubeadm reset`使主机恢复原状

按照提示，最好使用普通用户执行操作 k8s

```
  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

此时可查看 ConfigMap

```
# kubectl get -n kube-system configmaps
NAME                                 DATA   AGE
coredns                              1      9m51s
extension-apiserver-authentication   6      9m54s
kube-proxy                           2      9m50s
kubeadm-config                       2      9m52s
kubelet-config-1.17                  1      9m52s
```

Node 上可以直接通过 Init 信息的最后一行的命令加入集群，也可通过创建配置文件`join-config.yml`加入

```yaml
apiVersion: kubeadm.k8s.io/v1beta2
kind: JoinConfiguration
discovery:
  bootstrapToken:
    apiServerEndpoint: 192.168.60.131:6443 # 对应命令join后的Master地址
    token: zxzy3d.r12iq7oa9mn86tst # 对应命令的token
    unsafeSkipCAVerification: ture
  tlsBootstrapToken: zxzy3d.r12iq7oa9mn86tst # 与token一致
```

然后执行

```
kubeadm join --config join-config.yml
```

两个 Node 都加入集群后，在 master 上先查看下 node 状态

```
# kubectl get nodes
NAME                STATUS     ROLES    AGE    VERSION
node1.example.com   NotReady   master   30m    v1.17.3
node2.example.com   NotReady   <none>   3m7s   v1.17.3
node3.example.com   NotReady   <none>   13s    v1.17.3
```

可以看出三个节点的状态都为`NotReady`，是因为没有安装 CNI 网络插件。网络插件安装一个即可。

- 安装 Weave
  可到 kubernetes.io 中找到 weave 的 addon 安装[weave 插件安装](https://www.weave.works/docs/net/latest/kubernetes/kube-addon/#install)

  ```
  kubectl apply -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d '\n')"
  ```

- 安装 Flannel
  可到 github 的 flannel 文档中找到配置，直接通过 kubectl 安装即可
  ```
  kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
  ```

再查看节点状态，已变为 Ready

```
# kubectl get nodes
NAME                STATUS   ROLES    AGE   VERSION
node1.example.com   Ready    master   49m   v1.17.3
node2.example.com   Ready    <none>   22m   v1.17.3
node3.example.com   Ready    <none>   19m   v1.17.3
```

查看所有集群相关 pod 是否正常创建并运行

```
# kubectl get pods --all-namespaces
NAMESPACE     NAME                                        READY   STATUS             RESTARTS   AGE
kube-system   coredns-9d85f5447-dp87m                     0/1     Pending            0          53m
kube-system   coredns-9d85f5447-kpjnz                     0/1     Pending            0          53m
kube-system   etcd-node1.example.com                      1/1     Running            0          53m
kube-system   kube-apiserver-node1.example.com            1/1     Running            0          53m
kube-system   kube-controller-manager-node1.example.com   0/1     CrashLoopBackOff   5          53m
kube-system   kube-proxy-5gbnp                            1/1     Running            0          53m
kube-system   kube-proxy-ckddl                            1/1     Running            0          23m
kube-system   kube-proxy-qmksv                            1/1     Running            0          26m
kube-system   kube-scheduler-node1.example.com            1/1     Running            4          53m
kube-system   weave-net-9547h                             2/2     Running            0          8m31s
kube-system   weave-net-tgc56                             2/2     Running            0          8m31s
kube-system   weave-net-tr5g2                             2/2     Running            0          8m31s
```

在 Master 上先开启 API Server 代理端口 8080 `kubectl proxy --port=8080 &`，并且关闭防火墙，关闭 selinux，否则可能会报错：

```
The connection to the server localhost:8080 was refused - did you specify the right host or port?
```

通过`curl localhost:8080/api`查看是否能访问

```
# curl localhost:8080/api
I1126 00:30:27.335378   37820 log.go:172] http: Accept error: accept tcp 127.0.0.1:8080: accept4: too many open files; retrying in 5ms
I1126 00:30:27.335676   37820 log.go:172] http: proxy error: dial tcp 127.0.0.1:8080: socket: too many open files
```

能够访问了，但可能会出现报错，`too many open files`，可以设置`ulimit -n`增大即可，然后需要重新开启 proxy。

## Kube 初始化过程

```
[init] using Kubernetes version: v1.12.2
# kubeadm执行初始化前的检查
[preflight] running pre-flight checks
[preflight/images] Pulling images required for setting up a Kubernetes cluster
[preflight/images] This might take a minute or two, depending on the speed of your internet connection
[preflight/images] You can also perform this action in beforehand using 'kubeadm config images pull'
# 生成token和证书
[kubelet] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"
[kubelet] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"
[preflight] Activating the kubelet service
[certificates] Generated etcd/ca certificate and key.
[certificates] Generated etcd/server certificate and key.
[certificates] etcd/server serving cert is signed for DNS names [kubenode1 localhost] and IPs [127.0.0.1 ::1]
[certificates] Generated apiserver-etcd-client certificate and key.
[certificates] Generated etcd/healthcheck-client certificate and key.
[certificates] Generated etcd/peer certificate and key.
[certificates] etcd/peer serving cert is signed for DNS names [kubenode1 localhost] and IPs [192.168.60.130 127.0.0.1 ::1]
[certificates] Generated ca certificate and key.
[certificates] Generated apiserver-kubelet-client certificate and key.
[certificates] Generated apiserver certificate and key.
[certificates] apiserver serving cert is signed for DNS names [kubenode1 kubernetes kubernetes.default kubernetes.default.svc kubernetes.default.svc.cluster.local] and IPs [10.96.0.1 192.168.60.130]
[certificates] Generated front-proxy-ca certificate and key.
[certificates] Generated front-proxy-client certificate and key.
[certificates] valid certificates and keys now exist in "/etc/kubernetes/pki"
[certificates] Generated sa key and public key.
# 生成kubeconfig文件，kubelet使用这个与Master通信
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/admin.conf"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/kubelet.conf"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/controller-manager.conf"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/scheduler.conf"
[controlplane] wrote Static Pod manifest for component kube-apiserver to "/etc/kubernetes/manifests/kube-apiserver.yaml"
[controlplane] wrote Static Pod manifest for component kube-controller-manager to "/etc/kubernetes/manifests/kube-controller-manager.yaml"
[controlplane] wrote Static Pod manifest for component kube-scheduler to "/etc/kubernetes/manifests/kube-scheduler.yaml"
[etcd] Wrote Static Pod manifest for a local etcd instance to "/etc/kubernetes/manifests/etcd.yaml"
[init] waiting for the kubelet to boot up the control plane as Static Pods from directory "/etc/kubernetes/manifests"
[init] this might take a minute or longer if the control plane images have to be pulled
[apiclient] All control plane components are healthy after 32.514538 seconds
[uploadconfig] storing the configuration used in ConfigMap "kubeadm-config" in the "kube-system" Namespace
[kubelet] Creating a ConfigMap "kubelet-config-1.12" in namespace kube-system with the configuration for the kubelets in the cluster
[markmaster] Marking the node kubenode1 as master by adding the label "node-role.kubernetes.io/master=''"
[markmaster] Marking the node kubenode1 as master by adding the taints [node-role.kubernetes.io/master:NoSchedule]
[patchnode] Uploading the CRI Socket information "/var/run/dockershim.sock" to the Node API object "kubenode1" as an annotation
[bootstraptoken] using token: h1flky.ajnxfe5s28hnhsm9
[bootstraptoken] configured RBAC rules to allow Node Bootstrap tokens to post CSRs in order for nodes to get long term certificate credentials
[bootstraptoken] configured RBAC rules to allow the csrapprover controller automatically approve CSRs from a Node Bootstrap Token
[bootstraptoken] configured RBAC rules to allow certificate rotation for all node client certificates in the cluster
[bootstraptoken] creating the "cluster-info" ConfigMap in the "kube-public" namespace
[addons] Applied essential addon: CoreDNS
[addons] Applied essential addon: kube-proxy

Your Kubernetes master has initialized successfully!
```

> 参考文章
>
> [十分钟带你理解 Kubernetes 核心概念](#http://www.dockone.io/article/932)
>
> [Kubernetes Handbook——Kubernetes 中文指南/云原生应用架构实践手册](https://jimmysong.io/kubernetes-handbook/)
>
> [Kubernetes 中文社区 | 中文文档](http://docs.kubernetes.org.cn/)
>
> [和我一步步部署 kubernetes 集群](https://k8s-install.opsnull.com/)
>
> docker 容器与容器云
>
> Docker 高级应用实战——李振良——视频课程
>
> [Kubernetes 1.12.2 版，使用 docker 镜像安装](http://blog.51cto.com/12331508/2315352?source=dra)
>
> [Kubernetes：如何解决从 k8s.gcr.io 拉取镜像失败问题](https://blog.csdn.net/jinguangliu/article/details/82792617)
>
> [Kubernetes: 21 天完美通关](https://blog.51cto.com/cloumn/detail/87)
>
> Kubernetes 权威指南（第四版）

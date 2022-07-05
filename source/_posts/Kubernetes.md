---
title: Kubernetes
date: 2018-07-13 20:33:37
tags: [Kubernetes]
categories: [Kubernetes]
comments: false
---

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

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206071602665.png)

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

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206071602081.png)

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

Deployment 用于更好解决 Pod 的编排问题，为此，Deployment 在内部使用了 **ReplicaSet** 来实现。Deployment 能让我们随时知道 Pod 的部署进程。

Deployment 的典型应用场景：

- 创建一个 Deployment 对象来生成对应的 ReplicaSet 并完成 Pod 副本创建
- 检查 Deployment 状态来查看部署是否完成（Pod 是否达到指定数量）
- 更新 Deployment 创建新 Pod
- 若当前 Deployment 不稳定，则回滚到上一个 Deployment 版本
- 暂停 Deployment 以便一次性修改多个 PodTemplateSpec 配置项，之后再恢复 Deployment 进行新发布
- 扩展 Deployment 应对高负载
- 查看 Deployment 状态，了解发布是否成功
- 清除不再需要的旧版本 ReplicaSet



### StatefulSet

很多服务，尤其是中间件集群，如 Mysql、MongoDB、Akka、Zookeeper 等，都是有状态的。这些集群有以下共同点：

- 每个节点都有固定的身份 ID，通过 ID 集群中成员可互相发现并通信
- 集群规模是比较固定的，集群规模不能随意变动
- 集群中的每个节点都是有状态的，通常会持久化数据到永久存储中
- 若磁盘损坏，则集群中某个节点无法正常运行，集群功能受损

StatefulSet 可以看作 Deployment/RC 的一个特殊变种，有以下特性：

- StatefulSet 中每个 Pod 都有稳定、唯一的网络标识，可用于发现集群中其他成员
- StatefulSet 控制的 Pod 副本的启停顺序是受控的，操作第 n 个 pod 时，前 n-1 个 Pod 已经运行且准备好
- StatefulSet 中 pod 采用稳定的持久化存储卷，通过 PV 或 PVC 实现，删除 Pod 默认不会删除与 StatefulSet 相关的存储卷

StatefulSet 除了与 PV 卷捆绑使用存储 pod 状态数据，还要与 Headless Service 配合使用，每个 StatefulSet 定义都要声明属于哪个 Headless Service。

> Headless Service 和普通 Service 的区别在于：Headless Service 没有 ClusterIP。若解析 Headless Service 的 DNS 域名，则返回的是该 Service 对应所有的 Pod 的 Endpoint 列表

StatefulSet 在 Headless Service 基础上又为 Headless Service 控制的每个 Pod 实例创建一个 DNS 域名，格式为：

```
$(podname).$(Headless Service name)
```

### Service

每个 Service 就算是一个微服务。Service 定义一个服务的访问入口，前端的应用 pod 通过该入口地址访问其背后的一组 pod 副本组成的集群，而 Service 通过 Label Selector 与后端 pod 对接。最终系统由多个提供不同业务能力又相互独立的微服务单元组成，服务间通过 TCP/IP 网络通信，形成强大的弹性网络。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/3.png)

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

- ClusterIP：Service 通过 Cluster 内部 IP 对外提供服务，只有 Cluster 内的节点和 Pod 可访问。默认为 ClusterIP
- NodePort：Service 通过 Cluster 节点的静态端口对外提供服务。CLuster 外部可直接通过<NodeIP>:<NodePort>访问服务。若不指定 nodePort 参数，则 k8s 会从 30000-32767 中选一个作为端口号。
- LoadBalancer：Service 利用 Cloud Provider 特有的 Load Balancer 对外提供服务，Cloud Provider 负责将 Load Balancer 的流量导向 Service

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

ConfigMap 典型用法：

- 生成为容器内的环境变量
- 设置容器启动命令的启动参数（需设为环境变量）
- 以 Volume 形式挂载为容器内部的文件或目录

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

## K8s 开放接口

K8s 开放以下接口，用于对接不同后端，实现不同业务逻辑。

- CRI：Container Runtime Interface 容器运行时接口，提供计算服务
- CNI：Container Network Interface 容器网络接口，提供网络服务
- CSI：Container Storage Interface 容器存储接口，提供存储服务

### CRI

CRI 中定义了**容器和镜像的服务**的接口，因为容器运行时与镜像的生命周期是彼此隔离的。CRI 包含了 Protocol Buffers、gRPC API、运行库支持以及开发标准规范和工具。CRI 在 kubelet 启动时默认启动。

无论 docker 还是 rkt 都用到了 kubelet 内部接口，导致定制开发难度增加，因此 CRI 接口规范用定义清晰的抽象层清除这一壁垒，当开发者能专注于容器运行时本身。

kubelet 使用 gRPC 框架通过 unix socket 与 CRI 代理（shim）进行通信，这个过程中 kubelet 是客户端，shim 是服务端。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206071603640.png)

Protocol Buffers 包含两个 gRPC 服务：ImageService、RuntimeService

- ImageService 提供仓库拉取镜像、查看、移除镜像功能
- RuntimeService 负责 Pod 和容器生命周期管理以及与容器交互

目前支持 CRI 的后端：

- cri-o：cri-o 是 Kubernetes 的 CRI 标准的实现，并且允许 Kubernetes 间接使用 OCI 兼容的容器运行时，可以把 cri-o 看成 Kubernetes 使用 OCI 兼容的容器运行时的中间层。
- cri-containerd：基于 Containerd 的 Kubernetes CRI 实现
- rkt：CoreOS 开发的容器运行时
- frakti：基于 hypervisor 的 CRI
- docker

### CNI

目前主流容器网络模型主要有 docker 公司提出的 Container Network Model（CNM）和 CoreOS 提出的 Container Network Interface（CNI）。而 k8s 采用的是 CNI 模型。

CNM：主要通过 network sandbox、endpoint、network 三个组件实现

- network sandbox：容器内部网络栈，包括网络接口、路由表、DNS 等配置管理。一个 sandbox 能包含多个 endpoint。
- endpoint：用于将容器内 sandbox 与外界相连的接口。一般用 veth 对、open vswitch 的内部 port 等技术实现。一个 endpoint 只能加入一个 network
- network：可直接互联的 endpoint 的集合，通过 linux 网桥、VLAN 等技术实现。一个 network 包含多个 endpoint

CNI 由一组用于配置 Linux 容器的网络接口的规范和库组成，同时还包含了一些插件。在 CNI 只涉及两个概念：容器和网络，CNI 仅关心容器创建时的网络分配，和当容器被删除时释放网络资源。
该接口只有四个方法，添加网络、删除网络、添加网络列表、删除网络列表。

CNI 插件包含 3 个基本接口定义：添加 ADD、删除 DELETE、检查 CHECK、版本检查 VERSION

CNI 的设计考量：

- 容器运行时必须在调用任何插件之前为容器创建一个新的网络命名空间。然后，运行时必须确定这个容器应属于哪个网络，并为每个网络确定哪些插件必须被执行。
- 网络配置采用 JSON 格式，可以很容易地存储在文件中。网络配置包括必填字段，如 name 和 type 以及插件（类型）。网络配置允许字段在调用之间改变值。为此，有一个可选的字段 args，必须包含不同的信息。
- 容器运行时必须按顺序为每个网络执行相应的插件，将容器添加到每个网络中。
- 在完成容器生命周期后，运行时必须以相反的顺序执行插件（相对于执行添加容器的顺序）以将容器与网络断开连接。
- 容器运行时不能为同一容器调用并行操作，但可以为不同的容器调用并行操作。
- 容器运行时必须为容器订阅 ADD 和 DEL 操作，这样 ADD 后面总是跟着相应的 DEL。 DEL 可能跟着额外的 DEL，但是，插件应该允许处理多个 DEL（即插件 DEL 应该是幂等的）。
- 容器必须由 ContainerID 唯一标识。存储状态的插件应该使用（网络名称，容器 ID）的主键来完成。
- 给定的容器 ID 必须只能添加到特定的网络一次。

CNI 插件必须支持的操作：

- 将容器添加到网络
- 从网络中删除容器

### CSI

CSI 用于在 k8s 和外部存储系统之间建立一套标准的存储管理接口，通过该接口为容器提供存储服务。

k8s 通过 PV、PVC、Storageclass 已经提供了基于插件的存储管理机制，但是这些存储服务都是基于 in-tree 方式提供。因此，k8s 推出与容器对接的存储接口标准 CSI，基于 CSI 的存储插件机制也称为 out-of-tree 方式。

> in-tree：存储插件的代码必须放在 k8s 主干代码库才能被 k8s 调用，属于紧耦合开发模式，若存储插件代码出错可能会影响 k8s 的核心组件，存在安全和可靠性问题
> out-of-tree：存储提供方只需要基于接口标准进行存储插件实现，就能使用 k8s 原生存储机制为容器提供存储服务，实现存储提供方代码与 k8s 彻底解耦

CSI 存储关键组件：

- CSI Controller：提供存储服务视角对存储资源和存储卷进行管理操作。k8s 推荐将其部署为单实例 Pod，可使用 StatefulSet 和 Deployment 控制器进行部署，设置副本数量为 1，保证为一种存储插件只运行一个控制器实例。
- CSI Node：对主机 Node 上的 Volume 进行管理和操作，k8s 建议部署为 DaemonSet，在每个 Node 上都运行一个 Pod

# k8s 部署要点

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

kubectl启用自动补全。

```
echo "source <(kubectl completion bash)" >> ~/.bashrc
source ~/.bashrc
```

确认关闭 swap，并将`/proc/sys/net/bridge/bridge-nf-call-iptables`设为 1。在 Node 上也要这样设置

```
swapoff -a
sysctl -w net.bridge.bridge-nf-call-iptables=1
```

若要设置详细的系统参数，可以添加内容到`/etc/sysctl.d/kubernetes.conf`中，并`sysctl -p /etc/sysctl.d/kubernetes.conf`

```ini
net.bridge.bridge-nf-call-iptables=1
net.bridge.bridge-nf-call-ip6tables=1
net.ipv4.ip_forward=1
net.ipv4.tcp_tw_recycle=0   # tcp_tw_recycle 和 Kubernetes 的 NAT 冲突，必须关闭 ，否则会导致服务不通
vm.swappiness=0
vm.overcommit_memory=1
vm.panic_on_oom=0
fs.inotify.max_user_watches=89100
fs.file-max=52706963
fs.nr_open=52706963
net.ipv6.conf.all.disable_ipv6=1   # 不使用的 IPV6 协议栈，防止触发 docker BUG
net.netfilter.nf_conntrack_max=2310720
```

## Kubectl 常用操作

- 创建资源对象
  ```
  kubectl create -f xxx.yml    # 可同时指定多个-f进行一次性创建
  kubectl create -f <目录>     # 创建目录下所有.yml、.json文件定义的对象
  ```
- 查看资源对象
  ```
  kubectl get pods    # 查看所有Pod列表
  kubectl get rc,service  # 查看RC和Service列表
  ```
- 描述资源对象
  ```
  kubectl describe nodes <node name>    # 显示node的详细信息
  kubectl describe pods/<pod name>      # 显示pod的详细信息
  kubectl describe pods <rc name>       # 显示由RC管理的pod的信息
  ```
- 删除资源对象
  ```
  kubectl delete -f pod.yml     # 删除指定pod文件定义的pod
  kubectl delete pods,services -l name=<label name>   # 删除指定label的Pod
  kubectl delete pods --all     # 删除所有pods
  ```
- 执行容器命令
  ```
  kubectl exec <pod name> <command>   # 在pod的容器中执行命令，默认为第一个容器
  kubectl exec <pod name> -c <container name> <command>   # 指定pod中的某个容器执行
  kubectl exec -ti <pod name> -c <container name> /bin/bash  # 登录某个容器
  ```
- 查看容器日志
  ```
  kubectl logs <pod name>    # 查看pod容器输出到stdout的日志
  kubectl logs -f <pod name> -c <container name>    # 跟踪查看pod容器的日志，相当于tail -f
  ```
- 创建或更新资源对象
  ```
  kubectl apply -f app.yml    # 类似create， 若对象不存在则创建，存在则更新
  ```
- 在线编辑运行中的资源对象
  ```
  kubectl edit deploy nginx    # 编辑运行中的资源对象
  ```
- 将 pod 开放端口映射到本地
  ```
  kubectl port-forward --address 0.0.0.0 pod/nginx 8888:80   # 将pod的80端口映射到本地的8888端口
  ```
- 在 pod 和本地之间复制文件
  ```
  kubectl cp pod名:<容器内路径> <宿主机本地路径>
  ```
- 资源对象的标签设置
  ```
  kubectl label namespaces default <labalname=xxx>   # 为default namespace设置标签
  ```
- 检查可用 API 资源类型列表
  ```
  kubectl api-resources   # 检查特定类型资源是否已经定义，列出所有资源对象类型
  ```
- 查看支持的 API 版本
  ```
  kubectl api-versions
  ```
- 使用命令行插件
  自定义插件，先编写一个可执行文件，文件名必须为`kubectl-<plugin name>`，复制到`$PATH`环境变量指定的目录中，就可通过`kubectl <plugin name>`执行该自定义插件了。

## K8s 集群安全

若是在一个安全的内网环境，则 k8s 各组件可通过 http 通信，若是要对外服务，则最好要使用 https。k8s 提供基于 CA 签名的双向数字证书认证方式以及简单的基于 HTTP Base 或 Token 的认证方式。

证书可分为三大类：

- root CA
  - apiserver：apiserver 自己的证书
  - apiserver-kubelet-client：kubelet 连接 apiserver 时的客户端证书
- etcd CA
  - etcd-server：etcd 服务器端证书
  - etcd-peer：etcd 对等证书，用于 etcd 集群中 https 通信
  - etcd-healthcheck-client：etcd 健康检查的客户端证书
  - apiserver-etcd-client：apiserver 连接 etcd 的客户端证书
- front-proxy CA
  - front-proxyserver-client：apiserver 中的聚合器 aggregator 在前端的客户端证书

证书默认存放在`/etc/kubernetes/pki`中

```
# tree /etc/kubernetes/pki
/etc/kubernetes/pki
├── apiserver.crt
├── apiserver-etcd-client.crt
├── apiserver-etcd-client.key
├── apiserver.key
├── apiserver-kubelet-client.crt
├── apiserver-kubelet-client.key
├── ca.crt
├── ca.key
├── etcd
│   ├── ca.crt
│   ├── ca.key
│   ├── healthcheck-client.crt
│   ├── healthcheck-client.key
│   ├── peer.crt
│   ├── peer.key
│   ├── server.crt
│   └── server.key
├── front-proxy-ca.crt
├── front-proxy-ca.key
├── front-proxy-client.crt
├── front-proxy-client.key
├── sa.key
└── sa.pub
```

查看证书过期时间

```
openssl x509 -in /etc/kubernetes/pki/front-proxy-client.crt -noout -text | grep Not
            Not Before: Mar 31 09:00:17 2020 GMT
            Not After : Mar 31 09:00:17 2021 GMT
```

基于 CA 签名的双向数字证书的生成过程：

1. 为 kube-apiserver 生成一个数字证书，并用 CA 证书签名
2. 为 kube-apiserver 进程配置证书相关的启动参数，包括 CA 证书（用于验证客户端证书签名真伪）、自己的经过 CA 签名的证书以及私钥
3. 为每个访问 kubernetes API Server 的客户端（controller manager、scheduler、kubelet、kube-proxy、kubectl）进程都生成自己的数字证书，并都用 CA 证书签名，在相关启动参数中添加 CA 证书参数

- 第一步：生成客户端密钥
  ```
  openssl genrsa -out ca.key 2048
  ```
- 第二步：用私钥为证书请求文件签名，生成证书文件
  ```
  openssl req -x509 -new -nodes -key ca.key -subj "/CN=kubenode1" -days 5000 -out ca.crt
  其中/CN的值为master的主机名
  ```
- 第三步：生成 apiserver 的私钥
  ```
  openssl genrsa -out server.key 2048
  ```
- 第四步：创建配置文件`master_ssl.cnf`，用于 x509 v3 版本的证书

  ```ini
  [req]
  req_extensions = v3_req
  distinguished_name = req_distinguished_name

  [req_distinguished_name]
  [v3_req]
  basicConstraints = CA:FALSE
  keyUsage = nonRepudiation, digitalSignature, keyEncipherment
  subjectAltName = @alt_name
  [alt_name]
  DNS.1 = kubernetes
  DNS.2 = kubernetes.default
  DNS.3 = kubernetes.default.svc
  DNS.4 = kubernetes.default.svc.cluster.local
  DNS.5 = kubenode1   # master hostname

  IP.1 = 192.168.60.3    # master IP
  IP.2 = 192.168.10.1   # kubernetes.default's ClusterIP
  ```

  其中，ClusterIP 可通过命令查看`kubectl get svc kubernetes -o yaml`

  ```yaml
  # kubectl get svc kubernetes -o yaml
  apiVersion: v1
  kind: Service
  metadata:
    creationTimestamp: "2020-03-31T09:00:34Z"
    labels:
      component: apiserver
      provider: kubernetes
    .......
  spec:
    clusterIP: 192.168.10.1   # 属于init-default.yml中serviceSubnet的网段
    ports:
    - name: https
      port: 443
      protocol: TCP
      targetPort: 6443
    sessionAffinity: None
    type: ClusterIP
  status:
    loadBalancer: {}
  ```

- 第五步：创建证书签名请求文件 server.csr 和证书文件 server.crt
  ```
  openssl req -new -key server.key -subj "/CN=kubenode1" -config master_ssl.cnf -out server.csr
  openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 5000 -extensions v3_req -extfile master_ssl.cnf -out server.crt
  ```
  此时目录下有以下相关文件
  ```
  ├── ca.crt        # CA证书
  ├── ca.key        # CA私钥
  ├── ca.srl        # CA签发证书的序列号记录文件
  ├── server.crt    # 服务端证书
  ├── server.csr    # 证书签名请求，核心内容是一个公钥
  └── server.key    # 服务端私钥
  ```
  把这些文件都移动到`/var/run/kubernetes`中
- 第六步：设置 kube-apiserver 的启动参数`KUBE_API_ARGS`
  ```
  KUBE_API_ARGS="--client-ca-file=/var/run/kubernetes/ca.crt --tls-private-key-file=/var/run/kubernetes/server.key --tls-cert-file=/var/run/kubernetes/server.crt --secure-port=6443 --insecure-port=0"
  ```
  重启 kube-apiserver 服务
- 第七步：设置 kube-controller-manager 的客户端证书、私钥和启动参数
  ```
  openssl genrsa -out cs_client.key 2048
  openssl req -new -key cs_client.key -subj "/CN=kubenode1" -out cs_client.csr
  openssl x509 -req -in cs_client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out cs_client.crt -days 5000
  ```
- 第八步：创建`/etc/kubernetes/kubeconfig`文件，配置客户端证书相关参数
  ```yaml
  apiVersion: v1
  kind: Config
  users:
    - name: controllermanager
      user:
        client-certificate: /var/run/kubernetes/cs_client.crt
        client-key: /var/run/kubernetes/cs_client.key
  clusters:
    - name: local
      cluster:
        certificate-authority: /var/run/kubernetes/ca.crt
        server: https://192.168.60.3:6443
  contexts:
    - context:
        cluster: local
        user: controllermanager
      name: my-context
  current-context: my-context
  ```
  设置 controller manager 的启动参数，然后重启 kube-controller-manager：
  ```
  --service-account-key-file=/var/run/kubernetes/server.key
  --root-ca-file=/var/run/kubernetes/ca.crt
  --kubeconfig=/etc/kubernetes/kubeconfig
  ```
- 第九步：设置 kube-scheduler 启动参数，然后重启 kube-scheduler
  ```
  --kubeconfig=/etc/kubernetes/kubeconfig
  ```
- 第十步：设置每个 Node 上 kubelet 的客户端证书、私钥和启动参数
  先复制 apiserver 上的 ca.crt 和 ca.key 到 Node 上，生成客户端 crt 文件。其中`/CN`的值为本 Node 的 IP 地址
  ```
  openssl genrsa -out kubelet_client.key 2048
  openssl req -new -key kubelet_client.key -subj "/CN=192.168.60.4" -out kubelet_client.csr
  openssl x509 -req -in kubelet_client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 5000 -out kubelet_client.crt
  ```
  将这些文件都复制到`/var/run/kubernetes`中
- 第十一步：创建 Node 上的 kubeconfig 文件，配置客户端证书等参数
  ```yaml
  apiVersion: v1
  kind: Config
  users:
    - name: kubelet
      user:
        client-certificate: /var/run/kubernetes/kubelet_client.crt
        client-key: /var/run/kubernetes/kubelet_client.key
  clusters:
    - name: local
      cluster:
        certificate-authority: /var/run/kubernetes/ca.crt
        server: https://192.168.60.3:6443
  contexts:
    - context:
        cluster: local
        user: controllermanager
      name: my-context
  current-context: my-context
  ```
  kubelet 的启动参数，并重启 kubelet
  ```
  --kubeconfig=/etc/kubernetes/kubeconfig
  ```
- 第十二步：设置 kube-proxy，同上设置启动参数，并重启 kube-proxy

# 深入理解 Pod

K8s 对系统中长时间运行的容器的要求为：**主程序需要一直在前台执行**。
若创建一个 Pod 中的 docker 容器执行的命令是在后台运行，则 kubelet 在创建 pod 后运行后台命令，然后认为 pod 执行结束，销毁该 pod。若 pod 定义了 RelicationController，则 pod 销毁后又自动创建，导致不断循环。**因此，K8s 需要自己创建 docker 镜像并以一个前台命令作为启动命令。**

> 若无法改造为前台命令，则可以使用 Supervisor 辅助进行前台运行功能

Pod 特征：

- 通过容器各自的 IPC，使得同个 pod 的容器可在 pod 中通信
- 同一个 pod 的容器之间可通过 localhost 相互访问，使这一组容器被绑定在了一个环境中
- 每个容器集成 Pod 的名称
- 每个 Pod 有一个平滑共享网络名称空间的 IP 地址
- Pod 内部共享存储卷

## 静态 Pod

**由 kubelet 管理的仅存在于特定 Node 上的 Pod，不能通过 ApiServer 管理，无法与 ReplicationController、Deployment 及 DaemonSet 关联，kubelet 也无法对它们进行安全检查，仅由 kubelet 创建，并在 kubelet 所在主机上运行。**

两种创建静态 Pod 的方式：配置文件、HTTP

- 配置文件方式：设置 kubelet 启动参数`--pod-manifest-path`或者在 kubelet 配置文件中设置`staticPodPath`（推荐），kubelet 会自动定期扫描该目录，根据里面的 json 和 yaml 文件进行操作。因为无法通过 APIserver 管理，所以删除 pod 命令并不会删除该 pod，只是将状态变为 Pending。若要删除 pod 一定要到该 Node，把该 pod 配置文件删掉。
- HTTP：设置 kubelet 启动参数`--manifest-url`，会定期从该 URL 下载 Pod 配置文件并创建。

## Pod 配置管理

创建 ConfigMap 资源对象

- yaml 文件方式创建

  ```yaml
  apiVersion: v1
  kind: ConfigMap
  metadata:
    name: cm-appvars
  data:
    apploglevel: info
    appdatadir: /var/data
  ```

  `kubectl create -f cm-appvars.yml`
  查看详情：

  ```
  # kubectl describe configmaps cm-appvars
  Name:         cm-appvars
  Namespace:    default
  Labels:       <none>
  Annotations:  <none>

  Data
  ====
  apploglevel:
  ----
  info
  appdatadir:
  ----
  /var/data
  Events:  <none>
  ```

  或者直接放配置，要注意缩进

  ```yaml
  apiVersion: v1
  kind: ConfigMap
  metadata:
    name: cm-appconfig
  data:
    tomcat-server-xml: |
      <?xml version="1.0" encoding="utf-8"?>
      <Server port="8005" shutdown="SHUTDOWN">
          <Listener className="org.apache.catalina.startup.VersionLoggerListener"/>
          <Listener className="org.apache.catalina.core.AprLifecycleListener" SSLEngine="on"/>
          <Listener className="org.apache.catalina.core.JreMemoryLeakPreventionListener"/>
          <Listener className="org.apache.catalina.mbeans.GlobalResourcesLifecycleListener"/>
          <Listener className="org.apache.catalina.core.ThreadLocalLeakPreventionListener"/>
          <Service name="Catalina">
              <Connector port="8080" relaxedPathChars="[]|" relaxedQueryChars="[]|{}^&#x5c;&#x60;&quot;&lt;&gt;"
                        maxThreads="150" minSpareThreads="25" connectionTimeout="20000" enableLookups="false"
                        maxHttpHeaderSize="8192" protocol="HTTP/1.1" useBodyEncodingForURI="true" redirectPort="8443"
                        acceptCount="100" disableUploadTimeout="true" bindOnInit="false"/>
            ......
          </Service>
      </Server>
    tomcat-loggingproperties:
      "1catalina.org.apache.juli.AsyncFileHandler.level = FINE
      1catalina.org.apache.juli.AsyncFileHandler.directory = ${catalina.base}/logs
      1catalina.org.apache.juli.AsyncFileHandler.prefix = catalina.
      1catalina.org.apache.juli.AsyncFileHandler.encoding = UTF-8
      ......
      java.util.logging.ConsoleHandler.level = FINE
      java.util.logging.ConsoleHandler.formatter = org.apache.juli.OneLineFormatter
      java.util.logging.ConsoleHandler.encoding = UTF-8"
  ```

- kubectl 直接创建，通过`--from-file`或`--from-literal`指定内容，`from-file`是直接将文件内容作为值，`from-literal`后面跟着键值对。
  `--from-file`
  ```
  kubectl create configmap jira-server-xml --from-file=/opt/atlassian/jira/conf/server.xml
  ```
  `--from-literal`
  ```
  kubectl create configmap cm-appenv --from-literal=loglevel=info --from-literal=appdir=/var/data
  ```

容器对 ConfigMap 的使用有以下两种方法

- 通过环境变量获取 ConfigMap 内容
  ```yaml
  apiVersion: v1
  kind: Pod
  metadata:
    name: cm-test-pod
    labels:
      name: cm-test-pod
  spec:
    containers:
      - name: cm-test
        image: busybox
        resources:
          limits:
            memory: "128Mi"
            cpu: "500m"
        command: ["/bin/sh", "-c", "env|grep APP"]
        env:
          - name: APPLOGLEVEL
            valueFrom:
              configMapKeyRef:
                name: cm-appenv
                key: loglevel
          - name: APPDATADIR
            valueFrom:
              configMapKeyRef:
                name: cm-appenv
                key: appdir
    restartPolicy: Never
    # 需要注意：环境变量的名称受POSIX规范约束，不能以数字开头，且不能包含特殊字符
  ```
  创建完成后，查看 pod
  ```
  # kubectl get pods
  NAME          READY   STATUS      RESTARTS   AGE
  cm-test-pod   0/1     Completed   0          22s
  ```
  查看 pod 的输出日志，说明 pod 内已经读取到了
  ```
  # kubectl logs cm-test-pod
  APPDATADIR=/var/data
  APPLOGLEVEL=info
  ```
- 通过 Volume 挂载的方式将 ConfigMap 的内容挂载为容器内部的文件或目录
  ```yaml
  apiVersion: v1
  kind: Pod
  metadata:
    name: cm-test-pod-2
    labels:
      name: cm-test-pod-2
  spec:
    containers:
      - name: cm-test
        image: kubeguide/tomcat-app:v1
        resources:
          limits:
            memory: "128Mi"
            cpu: "500m"
        ports:
          - containerPort: 8080
        volumeMounts:
          - mountPath: /configfiles
            name: serverxml
    volumes:
      - name: serverxml
        configMap:
          name: cm-appconfig
          items:
            - key: tomcat-server-xml
              path: server.xml
            - key: tomcat-loggingproperties
              path: logging.properties
  ```
  创建该 pod，然后进入该 Pod 查看，配置文件已添加成功
  ```
  # kubectl exec -it cm-test-pod-2 -- bash
  # ls /configfiles/
  logging.properties  server.xml
  ```
  若引用 ConfigMap 时不指定 items，则该方法在容器内的目录下会为每个 item 生成一个文件名为`key-<key键值>`的文件

ConfigMap 的限制条件：

- ConfigMap 必须在 Pod 之前创建
- ConfigMap 受 NameSpace 限制，只有在相同 Namespace 的 Pod 才能引用
- ConfigMap 的配额管理还未能实现
- kubelet 只支持可被 apiserver 管理的 pod 使用 ConfigMap。静态 Pod 无法引用 ConfigMap
- ConfigMap 在 Pod 内只能挂载为目录，且若已存在该目录，则直接覆盖。所以最好将文件挂载在一个临时目录，并通过 cp 或 link 命令将配置移动到实际目录下

## 在容器内获取 Pod 信息

在容器中可通过 Downward API 获取所在 Pod 的信息，仍然是**通过环境变量或 Volume 挂载的方式将 Pod 信息注入容器内部**
可以通过Downward API获取以下信息：
- 能通过 `fieldRef` 获得：
  - `metadata.name`
  - `metadata.namespace`
  - `metadata.uid`
  - `metadata.labels['<KEY>']` - Pod 标签 `<KEY>` 的值 (例如, `metadata.labels['mylabel']`）
  - `metadata.annotations['<KEY>']` - Pod 的注解 `<KEY>` 的值（例如, `metadata.annotations['myannotation']`）
- 能通过 `resourceFieldRef` 获得：
  - 容器的 CPU limit
  - 容器的 CPU request
  - 容器的内存 limit
  - 容器的内存 request
  - 容器的临时存储 limit
  - 容器的临时存储 request

- 环境变量

  - 将 Pod 信息注入为环境变量

    ```yaml
    apiVersion: v1
    kind: Pod
    metadata:
      name: dapi-test-pod
      labels:
        name: dapi-test-pod
    spec:
      containers:
        - name: test-container
          image: busybox
          resources:
            limits:
              memory: "128Mi"
              cpu: "500m"
          command: ["/bin/sh", "-c", "env"]
          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: POD_IP
              valueFrom:
                fieldRef:
                  fieldPath: status.podIP
      restartPolicy: Never
    ```

    Downward API 提供变量：

    - metadata.name：pod 名
    - status.podIP：pod IP。（IP 为 status 而非 metadata，是因为 IP 不是元数据，而是状态数据）
    - metadata.namespace：pod Namespace

    创建完成后，查看日志

    ```
    # kubectl logs dapi-test-pod
    POD_IP=10.38.0.1
    KUBERNETES_SERVICE_PORT=443
    KUBERNETES_PORT=tcp://192.168.10.1:443
    HOSTNAME=dapi-test-pod
    SHLVL=1
    HOME=/root
    POD_NAME=dapi-test-pod
    KUBERNETES_PORT_443_TCP_ADDR=192.168.10.1
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    KUBERNETES_PORT_443_TCP_PORT=443
    KUBERNETES_PORT_443_TCP_PROTO=tcp
    KUBERNETES_SERVICE_PORT_HTTPS=443
    KUBERNETES_PORT_443_TCP=tcp://192.168.10.1:443
    POD_NAMESPACE=default
    KUBERNETES_SERVICE_HOST=192.168.10.1
    PWD=/
    ```

  - 将容器资源信息注入为环境变量
    ```yaml
    apiVersion: v1
    kind: Pod
    metadata:
      name: dapi-test-pod-container-vars
      labels:
        name: dapi-test-pod-container-vars
    spec:
      containers:
        - name: test-container
          image: busybox
          command: ["sh", "-c"]
          args:
            - printenv CPU_REQUEST CPU_LIMIT;
              printenv MEM_REQUEST MEM_LIMIT;
          resources:
            limits:
              memory: "128Mi"
              cpu: "500m"
          env:
            - name: CPU_REQUEST
              valueFrom:
                resourceFieldRef:
                  containerName: test-container
                  resource: requests.cpu
            - name: CPU_LIMIT
              valueFrom:
                resourceFieldRef:
                  containerName: test-container
                  resource: limits.cpu
            - name: MEM_REQUEST
              valueFrom:
                resourceFieldRef:
                  containerName: test-container
                  resource: requests.memory
            - name: MEM_LIMIT
              valueFrom:
                resourceFieldRef:
                  containerName: test-container
                  resource: limits.memory
      restartPolicy: Never
    ```
    创建完成后，查看日志
    ```
    # kubectl logs dapi-test-pod-container-vars
    1
    1
    134217728
    134217728
    ```

- Volume 挂载

  ```yaml
  apiVersion: v1
  kind: Pod
  metadata:
    name: kubernetes-downwardapi-volume-example-2
  spec:
    containers:
      - name: client-container
        image: k8s.gcr.io/busybox:1.24
        command: ["sh", "-c"]
        args:
        - while true; do
            echo -en '\n';
            if [[ -e /etc/podinfo/cpu_limit ]]; then
              echo -en '\n'; cat /etc/podinfo/cpu_limit; fi;
            if [[ -e /etc/podinfo/cpu_request ]]; then
              echo -en '\n'; cat /etc/podinfo/cpu_request; fi;
            if [[ -e /etc/podinfo/mem_limit ]]; then
              echo -en '\n'; cat /etc/podinfo/mem_limit; fi;
            if [[ -e /etc/podinfo/mem_request ]]; then
              echo -en '\n'; cat /etc/podinfo/mem_request; fi;
            sleep 5;
          done;
        resources:
          requests:
            memory: "32Mi"
            cpu: "125m"
          limits:
            memory: "64Mi"
            cpu: "250m"
        volumeMounts:
          - name: podinfo
            mountPath: /etc/podinfo
    volumes:
      - name: podinfo
        downwardAPI:
          items:
            - path: "cpu_limit"
              resourceFieldRef:
                containerName: client-container
                resource: limits.cpu
                divisor: 1m
            - path: "cpu_request"
              resourceFieldRef:
                containerName: client-container
                resource: requests.cpu
                divisor: 1m
            - path: "mem_limit"
              resourceFieldRef:
                containerName: client-container
                resource: limits.memory
                divisor: 1Mi
            - path: "mem_request"
              resourceFieldRef:
                containerName: client-container
                resource: requests.memory
                divisor: 1Mi
  ```
  进入容器查看：
  ```
  / # ls /etc/podinfo/
  cpu_limit    cpu_request  mem_limit    mem_request
  / # cat /etc/podinfo/cpu_limit
  250
  ```

## Pod 生命周期与重启策略

Pod 状态如下：

- Pending：apiserver 已创建该 pod，但 pod 中还有容器镜像没有创建（可能在下载）
- Running：pod 内容器都已创建，且至少有一个容器在运行、正在启动或重启状态
- Succeeded：pod 内容器都成功执行后退出，且不会再重启
- Failed：pod 内容器都已退出，但至少有一个容器退出为失败状态
- Unknown：无法获取该 pod 状态

当某个容器异常退出或健康检查失败时，kubelet 会根据 RestartPolicy 的设置进行相应操作
pod 重启策略如下：

- Always：当容器失效，由 kubelet 自动重启该容器
- OnFailure：当容器终止运行且退出码不为 0 时，由 kubelet 自动重启该容器
- Never：不论容器什么状态，kubelet 都不会重启该容器

每种控制器对 Pod 的重启策略要求如下：

- RC、DaemonSet：必须设为 Always，保证容器持续运行
- Job：OnFailure 或 Never，确保容器执行完成后不再重启
- kubelet：在 Pod 失效时自动重启，不论将 RestartPolicy 设为什么值，都不会对 Pod 进行健康检查

kubelet 重启失效容器的时间间隔以`sync-frequency X 偶数倍`计算，最长延时 5min，且在成功重启后的 10min 后重置该时间。

## Pod 健康检查和服务可用性检查

k8s 通过两类探针检查 pod 健康状态：LivenessProbe、ReadinessProbe。kubelet 定期执行这两类探针诊断容器健康。

- LivenessProbe：用于判断容器是否存活（Running），若判定为不健康，则 kubelet 杀死该容器并根据重启策略处理。若容器不包含该探针，则 kubelet 认为该容器的探针返回值永远为 Success
- ReadinessProbe：用于判断容器服务是否可用（Ready），只有达到 Ready 状态，Pod 才能接受请求。
  - 对于被 Service 管理的 Pod，Service 与 Pod Endpoint 的关联关系也基于 Pod 是否 Ready 进行设置。
    - 若运行过程中 Ready 变为 False，则系统自动将其从 Service 的后端 Endpoint 列表中隔离出去。
    - 若恢复到 Ready，则再将 Pod 加回 Endpoint 列表。
    - 这样就保证客户端在访问 Service 时不会被转发到服务不可用的 Pod 实例上。

LivenessProbe 告诉 K8s 容器是否需要通过重启实现自愈。ReadinessProbe 告诉 K8s 容器是否已准备好加入到 Service 负载均衡池中对外提供服务。
LivenessProbe 探测是重启容器，ReadinessProbe 探测是将容器设为不可用，从而不接收 Service 转发的请求。
若不特意配置，则 K8s 对两种检查采取相同默认行为，**通过判断容器启动进程的返回值是否为 0 判断探测是否成功。**

两种探针都有三种实现方式：

- ExecAction：在容器内部执行一个命令，若该命令的返回码为 0，则表明容器健康
  ```yaml
  apiVersion: v1
  kind: Pod
  metadata:
    name: liveness-exec
    labels:
      name: liveness-exec
  spec:
    containers:
      - name: liveness-exec
        image: busybox
        resources:
          limits:
            memory: "128Mi"
            cpu: "500m"
        args:
          - /bin/sh
          - -c
          - echo ok > /tmp/health; sleep 10; rm -rf /tmp/health; sleep 600
        livenessProbe:
          exec:
            command: # 查看/tmp/health文件是否存在作为是否存活条件
              - cat
              - /tmp/health
          initialDelaySeconds: 15
          timeoutSeconds: 1
  ```
  结果应为 failed，通过 describe 查看信息，可看到
  ```
  Warning  Unhealthy  18s (x6 over 107s)   kubelet, kubenode2  Liveness probe failed: cat: can't open '/tmp/health': No such file or directory
  Normal   Killing    18s (x2 over 88s)    kubelet, kubenode2  Container liveness-exec failed liveness probe, will be restarted
  ```
  导致 kubelet 不断杀死并重启
- TCPSocketAction：通过容器 IP 和端口号进行 TCP 检查，若能建立 TCP 连接，则说明健康
  ```yaml
  apiVersion: v1
  kind: Pod
  metadata:
    name: liveness-tcp
    labels:
      name: liveness-tcp
  spec:
    containers:
      - name: liveness-tcp
        image: nginx
        resources:
          limits:
            memory: "128Mi"
            cpu: "500m"
        ports:
          - containerPort: 80
        livenessProbe:
          tcpSocket:
            port: 80
          initialDelaySeconds: 30
          timeoutSeconds: 1
  ```
- HTTPGetAction：通过容器的 IP、端口号和 HTTP get，若响应状态码大于等于 200 小于 400，则认为容器健康
  ```yaml
  apiVersion: v1
  kind: Pod
  metadata:
    name: liveness-httpget
    labels:
      name: liveness-httpget
  spec:
    containers:
      - name: liveness-httpget
        image: nginx
        resources:
          limits:
            memory: "128Mi"
            cpu: "500m"
        ports:
          - containerPort: 80
        livenessProbe:
          httpGet:
            path: /_status/healthz
            port: 80
          initialDelaySeconds: 30
          timeoutSeconds: 1
  ```

每种探测方式都需要设置：initialDelaySeconds 和 timeoutSeconds 参数。

- initialDelaySeconds：启动容器后进行首次健康检查的等待时间
- timeoutSeconds：健康检查发送请求后等待响应的超时时间。若超时则 kubelet 认为该容器无法提供服务，并重启该容器

## Pod 调度

### Deployment 与 RC

Deployment 和 RC 的主要功能就是自动部署一个容器应用的多个副本并持续监控副本数量，在集群中始终维持指定的副本数量

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
spec:
  selector:
    matchLabels:
      app: nginx
  replicas: 3
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx
          ports:
            - containerPort: 80
```

创建 nginx 的 deployment，副本数为 3。创建完成后查看 deployment 状态，以及 ReplicaSet 信息

```
# kubectl get deployments nginx-deploy
NAME           READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deploy   3/3     3            3           49s

# kubectl get rs
NAME                     DESIRED   CURRENT   READY   AGE
nginx-deploy-d46f5678b   3         3         3       115s
```

Deployment 配置文件 spec 重点参数：

- replicas：副本数量
- tempalte：Pod 模板
  - template.metadata：Pod 元数据，至少要一个 Label
  - tamplate.spec：Pod 规格，定义 Pod 中每个容器的属性

### NodeSelector

若在实际情况中需要将 Pod 调度到指定的 Node 上，则可以通过 Node 的标签 Label 和 Pod 的 nodeSelector 相匹配来实现。

首先给 node 打标签

```
kubectl label nodes <node-name> <label-key>=<label-value>
```

例如：给 kubenode2 打上`app=redis-master`标签

```
kubectl label nodes kubenode2 app=redis
```

创建一个 redis 的 deployment，部署到 kubenode2 上

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-master
spec:
  selector:
    matchLabels:
      app: redis-master
  template:
    metadata:
      labels:
        app: redis-master
    spec:
      containers:
        - name: redis
          image: redis
          ports:
            - containerPort: 6379
      nodeSelector:
        app: redis
```

创建后查看 pod，确认部署到了 kubenode2

```
# kubectl get pod -o wide
NAME                            READY   STATUS             RESTARTS   AGE   IP          NODE        NOMINATED NODE   READINESS GATES
redis-master-7f84cc5d4d-8mrfr   1/1     Running            0          70s   10.38.0.6   kubenode2   <none>           <none>
```

若多个 Node 都打了相同标签，则 scheduler 在分配时会根据算法选择一个可用的 Node 进行调度。
**若指定了标签，但是集群中不存在打了该标签的 node，则 Pod 无法成功调度**

k8s 目前偏向于发展亲和性调度，随着节点亲和性越来越能表达 NodeSelector 的功能，最终会淘汰掉 NodeSelector。
Node 亲和性调度极大扩展了 Pod 的调度能力，调度功能包含：节点亲和性（NodeAffinity）和 Pod 亲和性（PodAffinity）。增强了一些功能：

- 可使用软限制、优先采用等限制方式，**调度器在无法满足优先需求时，会退而求其次继续运行该 pod**
- 可**根据节点上正在运行的其他 pod 的标签来进行限制**，即可定义一种规则**描述 Pod 之间的亲和或互斥关系**

### NodeAffinity

有两种节点亲和性表达：

- RequiredDuringSchedulingIgnoredDuringExecution：必须满足指定规则才能调度 Pod，类似 NodeSelector，相当于硬限制。
- PreferredDuringSchedulingIgnoredDuringExecution：强调优先满足指定规则，但不强求，相当于软限制。还可设置权重，定义先后顺序。

其中 IgnoredDuringExecution 的意思为：若 pod 所在节点在 pod 运行期间标签发生了更改，不再符合亲和性要求，则系统会忽略变化，pod 仍在该节点上运行。

例：创建 pod，只运行在 amd64 的节点，且尽量运行在磁盘为 ssd 的节点

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: node-affinity-test
  labels:
    name: node-affinity-test
spec:
  containers:
    - name: node-affinity-test
      image: google/pause
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: beta.kubernetes.io/arch
                operator: In
                values:
                  - amd64
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 1
          preference:
            matchExpressions:
              - key: disk-type
                operator: In
                values:
                  - ssd
```

NodeAffinity 语法支持的操作符包括：

- In
- NotIn
- Exists
- DoesNotExist
- Gt
- Lt

NodeAffinity 规则注意事项：

- 若同时定义了 nodeSelector 和 nodeAffinity，则必须两个条件都得到满足时 pod 才能最终运行在指定 node 上
- 若 nodeAffinity 指定了多个 nodeSelectorTerms，则其中一个能匹配成功即可
- 若在 nodeSelectorTerms 中有多个 matchExpressions，则一个节点必须满足所有 matchExpressions 才能运行该 Pod

### PodAffinity

根据**在节点上正在运行的 Pod 标签而不是节点的标签**进行判断和调度，要求对**节点和 Pod 两个条件**进行匹配。
若在具有标签 X 的 node 上运行了一个或多个符合条件 Y 的 Pod，则 Pod 应该运行在该 node 上。X 指一个集群中的节点、区域等概念，通过 k8s 内置节点标签的 key 进行声明，该 key 名字为 topologyKey，意为节点所属 topology 范围。

因为 pod 是属于某个命名空间的，所以 Y 表示的是一个或全部命名空间的一个 Label Selector。
pod 亲和性表达和节点亲和性表达是相同的。

先创建一个参考 pod，有两个自定义标签 security 和 app。其中 security 是用于亲和性调度，app 是用于互斥性调度

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-flag
  labels:
    name: pod-flag
    security: s1
    app: nginx
spec:
  containers:
    - name: pod-flag
      image: nginx
```

该 pod 在 kubenode2

进行亲和性调度测试

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-affinity
  labels:
    name: pod-affinity
spec:
  containers:
    - name: pod-affinity
      image: google/pause
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchExpressions:
              - key: security
                operator: In
                values:
                  - s1
          topologyKey: kubernetes.io/hostname
```

匹配包含 security=s1 的 pod 的 node。查看创建情况

```
# kubectl get pods -o wide
NAME                            READY   STATUS    RESTARTS   AGE     IP          NODE        NOMINATED NODE   READINESS GATES
pod-affinity                    1/1     Running   0          10s     10.38.0.2   kubenode2   <none>           <none>
pod-flag                        1/1     Running   0          5m26s   10.38.0.1   kubenode2   <none>           <none>
```

进行互斥性调度测试

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-anti-affinity
  labels:
    name: pod-anti-affinity
spec:
  containers:
    - name: pod-anti-affinity
      image: google/pause
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchExpressions:
              - key: security
                operator: In
                values:
                  - s1
          topologyKey: kubernetes.io/hostname
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchExpressions:
              - key: app
                operator: In
                values:
                  - nginx
          topologyKey: kubernetes.io/hostname
```

### Taints 与 Tolerations

与亲和性相反，Taint（污点）让 Node 拒绝 Pod 的运行。

Taint 需要配合 Toleration（容忍）使用，让 Pod 避开那些不适合的 Node，在 node 设置了 taint 后，除非 node 声明能容忍这些污点，否则无法在这些 node 上运行。Toleration 是 Pod 属性，让 Pod 能运行在标注了 Taint 的 Node 上。

例：给 node 添加污点，键为 key，值为 value，效果为 NoSchedule，除非 Pod 容忍，否则不调度到该 Node

```
# kubectl taint node kubenode2 key=value:NoSchedule
node/kubenode2 tainted
```

此时创建 deployment 等资源对象时，不会部署到污点 node 上。

```
# kubectl get pods -o wide
NAME                                           READY   STATUS    RESTARTS   AGE   IP          NODE        NOMINATED NODE   READINESS GATES
nginx-toleration-deployment-5f6d8b47d6-8kk8q   1/1     Running   0          45s   10.32.0.2   kubenode3   <none>           <none>
nginx-toleration-deployment-5f6d8b47d6-fbqkm   1/1     Running   0          45s   10.32.0.3   kubenode3   <none>           <none>
nginx-toleration-deployment-5f6d8b47d6-vm7vx   1/1     Running   0          45s   10.32.0.4   kubenode3   <none>           <none>
```

然后在 Deployment 中声明 Toleration，表示允许调度到该污点 Node

```yaml
......
    spec:
      containers:
      - name: nginx-toleration-deployment
        image: nginx
        resources:
          limits:
            memory: "128Mi"
            cpu: "500m"
        ports:
        - containerPort: 80
      tolerations:
      - key: "key"
        operator: "Equal"
        value: "value"
        effect: "NoSchedule"
或者
      tolerations:
      - key: "key"
        operator: "Exists"
        effect: "NoSchedule"
```

其中键值和 effect 需要和污点设置一致，并满足：

- operator 值为 Exists，这样无需指定 value
- operator 值为 Equal，需要指定 value 并一致
- 若不指定 operator，则默认值为 Equal
- 空的 key 配合 Exists 能匹配所有键值
- 空的 effect 能匹配所有的 effect

除了 NoSchedule，还有另外两个 effect

- PreferNoSchedule：NoSchedule 的软限制版本，只是尽量不调度到污点 node，不强制
- NoExecute：在该 node 上正在运行的所有无对应 Toleration 配置的 Pod 立刻被驱逐，且具有相应 Toleration 的 Pod 永远不被驱逐

同个 Node 可配置多个污点，pod 也可设置多个容忍，处理多个污点和容忍的顺序为：

1. 先列出节点的所有污点
2. 忽略 Pod 的容忍能匹配的部分
3. 剩下的没有忽略的污点就是对 Pod 不会调度到的节点

特殊情况：

1. 若剩余污点中存在 NoSchedule，则调度器不会把该 Pod 调度到这个节点
2. 若剩余污点中没有 NoSchedule，但有 PreferNoSchedule，则调度器尽量不把 Pod 调度到这个节点
3. 若剩余污点中有 NoExecute，且 Pod 已经在该节点上运行，则会被驱逐，若还没有在该节点上运行，则不再会被调度到该节点

对于 NoExecute，若需要让已经在运行的 Pod 被逐出前还能运行一段时间，而不是立刻被逐出，则可以添加参数

```yaml
tolerationSeconds: 3600
```

若要将一些节点专门给特定应用使用，则可以通过添加污点

```
kubectl taint nodes <node_name> dedicated=<group_name>:NoSchedule
```

然后给这些应用 Pod 加入相应 Toleration，带有合适 Toleration 的 Pod 就能使用这样的 Node。

若集群中有特殊硬件设备如 GPU，希望只有相关特定 Pod 使用这些设备，可设置污点

```
kubectl taint nodes <node_name> special=true:NoSchedule或PreferNoSchedule
```

出于安全考虑，默认 k8s 不会将 Pod 调度到 Master，若希望 master 也当做 Node 使用，则可以使用污点

```
kubectl taint node <master_name> node-role.kubernetes.io/master-
```

若要恢复 Master Only 状态，则使用

```
kubectl taint mode <master_name> mode-role.kubernetes.io/master="":NoSchedule
```

### Pod Priority Preemption

### DaemonSet

DaemonSet 用于**管理在集群中每个 Node 上仅运行一份 Pod 的副本实例**。DaemonSet 的 Pod 调度策略和 RC 类似，除了使用系统内置算法在每个 Node 上进行调度，也可以在 Pod 的定义中使用 NodeSelector 或 NodeAffinity 进行调度。

例：集群的每个 Node 都创建一个 fluentd-elasticsearch，并挂载两个主机目录。DaemonSet 的配置与 Deployment 几乎一致

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluented-logging
  labels:
    app: fluented-logging
spec:
  selector:
    matchLabels:
      app: fluented-logging
  template:
    metadata:
      labels:
        app: fluented-logging
    spec:
      containers:
        - name: fluented-logging
          image: ist0ne/fluentd-elasticsearch
          resources:
            limits:
              memory: "128Mi"
              cpu: "500m"
          env:
            - name: FLUENTD_ARGS
              value: -q
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: false
            - name: containers
              mountPath: /var/lib/docker/containers
              readOnly: false
      volumes:
        - name: containers
          hostPath:
            path: /var/lib/docker/containers
        - name: varlog
          hostPath:
            path: /var/log
```

启动后查看

```
# kubectl get daemonsets
NAME               DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR   AGE
fluented-logging   2         2         2       2            2           <none>          4m39s

# kubectl get pods -o wide
NAME                            READY   STATUS    RESTARTS   AGE    IP          NODE        NOMINATED NODE   READINESS GATES
fluented-logging-h8dwx          1/1     Running   0          104s   10.32.0.2   kubenode3   <none>           <none>
fluented-logging-l68n2          1/1     Running   0          104s   10.38.0.5   kubenode2   <none>           <none>
```

两台 node 节点都自动部署好了。

DaemonSet 自动滚动升级，在更新 DaemonSet 模板时，旧 pod 副本会自动删除，同时新 pod 副本自动创建。只需添加策略，与 containers 同级：

```yaml
updateStrategy:
  type: RollingUpdate
```

DaemonSet 的常见应用场景：

- 节点上运行存储，如 Glusterd 或 Ceph
- 节点上运行日志收集，如 Flunentd 或 Logstash
- 节点上运行监控，如 Prometheus Exporter 或 Collectd

K8s 也在运行自己的 DaemonSet 组件

```
# kubectl get daemonsets.apps --namespace=kube-system
NAME         DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR            AGE
kube-proxy   3         3         3       3            3           kubernetes.io/os=linux   8d
weave-net    3         3         3       3            3           <none>                   8d
```

### Job

Job 用于定义并启动一个批处理任务，能并行或串行处理一批工作项（work item）。批处理包含以下模式：

- Job Template Expansion：一个 Job 对应一个 Work Item，适合工作项少、每个工作项要处理数据量大的场景
- Queue With Pod Per Work Item：一个任务队列存放工作项，一个 job 作为消费者去完成这些工作项。job 会启动 N 个 Pod，每个 Pod 对应一个工作项
- Queue With Variable Pod Count：同上，但是 job 启动的 pod 数量是可变的
- Single Job With Static Work Assignment：一个 job 产生多个 Pod，采用程序静态方式分配任务项，而不是采用队列动态分配

Job 类型：

- Non-parallel jobs：一个 Job 只启动一个 Pod，除非 Pod 异常，才会重启该 Pod，一旦 Pod 正常结束，job 就结束
- Parallel jobs with a fixed completion count：并行 Job 会启动多个 Pod，此时需要设定 Job 的 `spec.completions` 参数，当正常结束的 Pod 数量到达该数值后，Job 结束。`spec.parallelism` 参数控制并行数（同时启动多少个 Job 处理）
- Parallel Jobs with a work queue：并行 Job 有一个独立 Queue，工作项在 Queue 中存放，不能设置 `spec.completions`参数。有以下特性：
  - 每个 Pod 都能独立判断决定是否有任务项需要处理
  - 若某个 Pod 正常结束，则 Job 不会再启动新 Pod
  - 若一个 Pod 成功结束，则此时应该不存在其他 Pod 还在工作的情况，而是都处于结束和退出的状态
  - 若所有 pod 都结束了，且至少一个 Pod 成功结束，则 job 成功结束

job 的重启策略只能为 Never 或 OnFailure，且必须设置。

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: myjob
spec:
  parallelism: 3
  completions: 9
  template:
    metadata:
      name: myjob
    spec:
      containers:
        - name: job
          image: hello-world
          imagePullPolicy: IfNotPresent
      restartPolicy: OnFailure
```

查看 job 信息情况

```
# kubectl get jobs.batch
NAME    COMPLETIONS   DURATION   AGE
myjob   9/9           10s        66s
```

### Cronjob

类似 Linux Cron，定时启动 Job

```yaml
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: hello
spec:
  schedule: "*/1 * * * *" # 每分钟执行一次
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: hello
              image: busybox
              args:
                - /bin/sh -c
                - date
          restartPolicy: OnFailure
```

## 初始化容器 Init Container

## Pod 升级与回滚

只要对 Deployment 的 Pod 定义进行修改并应用到 Deployment 对象上，即可完成 Deployment 的自动更新操作。若更新中发生错误，则可以通过回滚恢复 Pod 版本。

### Deployment 升级

例：创建 nginx 的 Deployment，版本为 1.7.9

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
spec:
  selector:
    matchLabels:
      app: nginx
  replicas: 3
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.7.9
          ports:
            - containerPort: 80
```

然后需要升级到 1.17.9 版本，先通过`set`命令设置参数

```
# kubectl set image deployment/nginx-deploy nginx=nginx:1.17.9
deployment.apps/nginx-deploy image updated
```

此时已经开始滚动升级了，立刻查看更新过程

```
# kubectl rollout status deployment nginx-deploy
Waiting for deployment "nginx-deploy" rollout to finish: 1 out of 3 new replicas have been updated...
Waiting for deployment "nginx-deploy" rollout to finish: 1 out of 3 new replicas have been updated...
Waiting for deployment "nginx-deploy" rollout to finish: 1 out of 3 new replicas have been updated...
Waiting for deployment "nginx-deploy" rollout to finish: 2 out of 3 new replicas have been updated...
Waiting for deployment "nginx-deploy" rollout to finish: 2 out of 3 new replicas have been updated...
Waiting for deployment "nginx-deploy" rollout to finish: 2 out of 3 new replicas have been updated...
Waiting for deployment "nginx-deploy" rollout to finish: 1 old replicas are pending termination...
Waiting for deployment "nginx-deploy" rollout to finish: 1 old replicas are pending termination...
deployment "nginx-deploy" successfully rolled out
```

再次查看 Pod 列表，能看到 pod 名称都已经更新了，可通过`describe`查看具体 Pod 情况，能看到 Pod 镜像已经更新。

滚动升级的流程
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206071604530.png)

```
Events:
  Type    Reason             Age                From                   Message
  ----    ------             ----               ----                   -------
  Normal  ScalingReplicaSet  14s (x2 over 87m)  deployment-controller  Scaled up replica set nginx-deploy-5bf87f5f59 to 1
  Normal  ScalingReplicaSet  11s (x2 over 87m)  deployment-controller  Scaled down replica set nginx-deploy-5df494d57d to 2
  Normal  ScalingReplicaSet  11s                deployment-controller  Scaled up replica set nginx-deploy-5bf87f5f59 to 2
  Normal  ScalingReplicaSet  8s (x2 over 93m)   deployment-controller  Scaled up replica set nginx-deploy-5bf87f5f59 to 3
  Normal  ScalingReplicaSet  8s                 deployment-controller  Scaled down replica set nginx-deploy-5df494d57d to 1
  Normal  ScalingReplicaSet  6s                 deployment-controller  Scaled down replica set nginx-deploy-5df494d57d to 0

查看RS情况
# kubectl get rs
NAME                      DESIRED   CURRENT   READY   AGE
nginx-deploy-5bf87f5f59   3         3         3       94m
nginx-deploy-5df494d57d   0         0         0       90m
```

在整个升级过程中，系统会保证至少有两个 Pod 有用，并最多同时运行 4 个 Pod。默认情况下，Deployment 确保 Pod 总数至少为所需副本数量（DESIRED）-1，即最多一个不可用，Pod 总数最多比所需 Pod 数多一个，即最多一个浪涌值（maxSurge=1）。这样，升级过程中 Deployment 就能保证服务不中断，且副本数量始终维持为用户指定数量。

#### 更新策略

在 Deployment 定义中，可通过`spec.strategy`指定 Pod 更新的策略，目前支持两种策略：

- Recreate 重建：设置`spec.strategy.type=Recreate`Deployment 在更新 Pod 时，会先杀掉所有正在运行的 Pod，然后重新创建 Pod
- RollingUpdate 滚动更新：默认，设置`spec.strategy.type=RollingUpdate`，Deployment 会以滚动更新方式逐个更新 Pod，并可通过参数`maxUnavailable`和`maxSurge`控制滚动更新的过程
  - `maxUnavailable`：指定 Deployment 在更新过程中不可用 Pod 的数量上限，可以是数字，或 Pod 期望副本数的百分比（会向下取整），默认为 25%
  - `maxSurge`：指定在 Deployment 更新过程中 Pod 总数超过 Pod 期望副本数部分的最大值，值类型同上，默认为 25%
  - `maxSurge`越大，初始创建的新副本数量越多。`maxUnavailable`越大，初始销毁的旧副本数量越多。

多重更新（Rollover）：若在更新时再次发起更新，则会立刻将之前正在更新的 RS 停止扩容，且将其加入到旧版本 RS 列表中，并开始缩容至 0。对于 Pod，Deployment 会立刻杀死创建的中间版本的 Pod，并开始创建最后指定版本的 Pod。

### Deployment 回滚

默认情况所有 Deployment 的发布历史记录都被保留在系统中，以便随时进行回滚。

可通过以下命令查看 Deployment 更新状态

```
# kubectl rollout status deployment nginx-deploy
deployment "nginx-deploy" successfully rolled out

若更新出现问题，则会卡住
# kubectl rollout status deployment nginx-deploy
Waiting for deployment "nginx-deploy" rollout to finish: 1 out of 3 new replicas have been updated...

# kubectl get rs
NAME                      DESIRED   CURRENT   READY   AGE
nginx-deploy-57574fd9dd   1         1         0       3m48s
nginx-deploy-5bf87f5f59   0         0         0       6m44s
nginx-deploy-5d85b5fb59   3         3         3       4m9s

# kubectl get pods
NAME                            READY   STATUS             RESTARTS   AGE
nginx-deploy-57574fd9dd-k9hk2   0/1     ImagePullBackOff   0          73s  # 镜像拉取出错
nginx-deploy-5d85b5fb59-gl2ch   1/1     Running            0          88s
nginx-deploy-5d85b5fb59-lg79f   1/1     Running            0          91s
nginx-deploy-5d85b5fb59-vtlt2   1/1     Running            0          86s
```

此时需要先查询之前的稳定版本的 Deployment，注意 REVISION 版本

```
# kubectl rollout history deployment nginx-deploy
deployment.apps/nginx-deploy
REVISION  CHANGE-CAUSE
1         kubectl create --filename=nginx-deploy.yml --record=true
2         kubectl create --filename=nginx-deploy.yml --record=true
9         kubectl create --filename=nginx-deploy.yml --record=true
10        kubectl create --filename=nginx-deploy.yml --record=true
```

可通过`--revision`查看指定版本的详细信息

```
# kubectl rollout history deployment nginx-deploy --revision 2
deployment.apps/nginx-deploy with revision #2
Pod Template:
  Labels:       app=nginx
        pod-template-hash=7b45d69949
  Annotations:  kubernetes.io/change-cause: kubectl create --filename=nginx-deploy.yml --record=true
  Containers:
   nginx:
    Image:      nginx:1.16.1
    Port:       80/TCP
    Host Port:  0/TCP
    Environment:        <none>
    Mounts:     <none>
  Volumes:      <none>
```

此时要退回到 revision 2，则可以指定版本回滚

```
# kubectl rollout undo deployment nginx-deploy --to-revision=2
deployment.apps/nginx-deploy rolled back
```

对于复杂的 Deployment 配置修改，为避免频繁触发 Deployment 的更新操作，可先暂停 Deployment 的更新操作，然后进行配置修改，再恢复 Deployment，一次性触发完整的更新操作。

暂停 Deployment 的更新

```
# kubectl rollout pause deployment nginx-deploy
deployment.apps/nginx-deploy paused
```

修改完成后恢复 Deployment 的部署

```
# kubectl rollout resume deployment nginx-deploy
deployment.apps/nginx-deploy resumed
```

**注：暂停 Deployment 期间是不能进行回滚的**

#### RC 滚动升级

K8s 通过配置文件进行

例：RC redis-master 的 v1 版本升级到 v2 版本

```yaml
# RC的v1版本的配置
apiVersion: v1
kind: ReplicationController
metadata:
  name: redis-master
  labels:
    name: redis-master
    version: v1
......
    spec:
      containers:
        - name: redis-master
          image: kubeguide/redis-master:1.0
          ports:
            - containerPort: 6379

# kubectl get rc -o wide
NAME              DESIRED   CURRENT   READY   AGE     CONTAINERS        IMAGES                       SELECTOR
redis-master-v1   3         3         0       3m18s   redis-master-v1   kubeguide/redis-master:1.0   name=redis-master,version=v1

# RC的v2版本的配置，是修改的v1的配置文件
apiVersion: v1
kind: ReplicationController
metadata:
  name: redis-master-v2
  labels:
    name: redis-master
    version: v2
......
    spec:
      containers:
      - name: redis-master-v2
        image: kubeguide/redis-master:2.0
        ports:
        - containerPort: 6379
      minReadySeconds: 5
      strategy:
        type: RollingUpdate
        rollingUpdate:
          maxSurge: 1
          maxUnavailable: 1
```

## Pod 扩缩容

### 手动扩缩容

```
kubectl scale deployment <deployment-name> --replicas=<replicas-number>
```

若设置为比当前副本数量更小的数字，则会杀死一些正在运行的 pod

```
# kubectl get deployments
NAME           READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deploy   3/3     3            3           5h42m

[root@kubenode1 ~]# kubectl scale deployment nginx-deploy --replicas=5
deployment.apps/nginx-deploy scaled

# kubectl get deployments
NAME           READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deploy   5/5     5            5           5h43m
```

## K8s弹性伸缩

三种弹性伸缩：
- CA（Cluster Autoscaler）：Node级别自动扩缩容，通过cluster-autoscaler组件（主要是在云服务商上进行创建新节点，Cluster AutoScaler会监听Node资源使用情况。还有一种就是通过ansible等方式进行扩容）
- HPA（Horizontal Pod Autoscaler）：Pod个数自动扩缩容
- VPA（Vertical Pod Autoscaler）：Pod配置（如CPU、内存）自动扩缩容，通过addmin-resizer组件（主要对象是有些有状态的服务，不能横向扩容）

### HPA

Horizontal Pod Autoscaler（Pod 横向自动扩容），也是一种资源对象。通过追踪分析指定 RC 控制的所有目标 Pod 的负载情况，来确定是否需要针对性调整目标 Pod 的副本数量。由于需要监控Node的性能信息，所以依赖Metrics Server组件。
HPA 有两种方法作为 Pod 负载的度量指标：

- CPUUtilizationPercentage，是目标 Pod 所有副本自身 CPU 利用率的算数平均值（`Pod自身CPU利用率=Pod当前CPU使用量/Pod Request`）。
  - 若某一时刻该值超过 80%，则意味着当前 Pod 副本数量不足以支撑更多请求，需要动态扩容，而当请求高峰过去，CPU 利用率又降下来，则副本数也自动减少到一个合理值。
  - 通常是 1min 的平均值
  - K8s 通过基础性能数据监控框架（Kubernetes Monitoring Architecture）支持 HPA。该框架中 K8s 定义了标准化 API 接口 Resource Metrics API，方便客户端（如 HPA）获取性能数据
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

为防止副本数量因扩容大幅波动，K8s在Controller manager中设置了冷却时间，即在每次扩缩容后的冷却时间。
- horizontal-pod-autoscaler-downscale-dalay: 缩容冷却，默认5min
- horizontal-pod-autoscaler-upscale-dalay: 扩容冷却，默认3min

目前除了`autoscaling/v1`（仅支持基于CPU使用率）外，还有`autoscaling/v2beta2`，支持了多指标以及自定义指标。

从 v1.18 开始，`v2beta2` API 允许通过 HPA 的 `behavior` 字段配置扩缩行为。 在 behavior 字段中的 scaleUp 和 scaleDown 分别指定扩容和缩容行为。 可以两个方向指定一个稳定窗口，以防止扩缩目标中副本数量的波动。 类似地，指定扩缩策略可以控制扩缩时副本数的变化率。
在 `spec` 字段的 `behavior` 部分可以指定一个或多个扩缩策略。 当指定多个策略时，默认选择允许更改最多的策略，就是说每个操作周期都会计算当前该策略能操作的pod数，然后挑能操作pod数最多的策略执行。
```yaml
behavior:
  scaleDown:
    policies:
    - type: Pods
      value: 4
      periodSeconds: 60
    - type: Percent
      value: 10
      periodSeconds: 60
```

当用于扩缩的指标持续抖动时，可以使用稳定窗口来限制副本数上下振动。
```yaml
scaleDown:
  stabilizationWindowSeconds: 300
```

默认扩缩容行为，即未设置的默认配置
```yaml
behavior:
  scaleDown:   # 缩容配置
    stabilizationWindowSeconds: 300    # 稳定窗口为300s
    policies:
    - type: Percent      # 按照百分率
      value: 100         # 可以直接降低到最小允许的副本数，即minReplicas配置。
      periodSeconds: 15  # 每15s为一个操作周期
  scaleUp:     # 扩容配置
    stabilizationWindowSeconds: 0
    policies:
    - type: Percent
      value: 100         # 可以直接扩容到最大允许的副本数，即maxReplicas配置。
      periodSeconds: 15
    - type: Pods
      value: 4
      periodSeconds: 15
    selectPolicy: Max
```

# 深入理解 Service

通过创建 Service 可为一组具有相同功能的容器应用提供一个统一的入口地址，并且将请求负载分发到后端的各个容器应用上。

两种方法创建 Service：

- 先创建 RC 或 Deployment，然后执行
  ```
  kubectl expose rc|deployment <rc-name|deployment-name>
  ```
  然后查看服务
  ```
  # kubectl get svc
  NAME                       TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
  kubernetes                 ClusterIP   192.168.10.1     <none>        443/TCP    4d1h
  webapp-tomcat              ClusterIP   192.168.10.144   <none>        8080/TCP   5m47s
  webapp-tomcat-deployment   ClusterIP   192.168.10.67    <none>        8080/TCP   5m40s
  ```
  就可通过 ClusterIP 加上端口访问该服务了
- 直接 YAML 创建 Service
  ```yaml
  apiVersion: v1
  kind: Service
  metadata:
    name: webapp-tomcat-service
  spec:
    selector:
      app: webapp-tomcat-service
    ports:
      - port: 808
        targetPort: 8080
  ```
  Service 的关键字段为 ports 和 selector。posts 为提供给外部访问的端口，selector 为后端 pod 的 label。

Service 的 Pod 被 k8s 进行负载负载均衡，具体有两种分发策略：

- RoundRobin：轮询（默认）
- SessionAffinity：基于客户端 IP 进行会话保持。相同客户端 IP 的请求分到同一个 Pod 上。若要修改为此模式，则需要在配置中 spec 下添加
  ```yaml
  sessionAffinity: ClientIP
  ```

**若服务开放多个端口，则需要在每个端口定义内加上`name`定义。且端口定义中可指定传输层协议，通过添加`protocol`定义。**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: app-dns
spec:
  selector:
    app: app-dns
  clusterIP: 192.168.10.200
  ports:
    - port: 53
      protocol: TCP
      name: dns-tcp
    - port: 53
      protocol: UDP
      name: dns-udp
```

## 外部服务 Service

若应用需要连接一个外部数据库，或将另一个集群或 Namespace 中服务作为服务的后端，这时需要创建一个无 Label Selector 的 Service。

例：一个无标签 http 服务，开放端口 80，但指向另一个 http 服务，目的 IP 为 10.1.1.2

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nolabel-http-service
spec:
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP

apiVersion: v1
kind: Endpoints
metadata:
  name: nolabel-http-service
subsets:
- addresses:
  - ip: 10.1.1.2
  ports:
  - port: 80
```

分别创建一个无标签 Service 和一个 Endpoint，因为**系统不会自动创建 Endpoint，且该 Endpoint 需要和 Service 同名**，指向实际后端访问 IP。

## Headless Service

若需要自己控制负载均衡策略，而不使用 Service 默认负载策略，则可使用 Headless Service，**不为 Service 设置 ClusterIP，仅通过 Label Selector 将后端 Pod 列表返回给调用的客户端。**不指定特定的 ClusterIP，访问该 service 将会返回所有标签为 app=nginx 的 Pod 列表，然后客户端自定义策略如何处理该列表。StatefulSet 就是使用 Headless Service 为客户端返回多个服务地址的。Headless Service 主要应用在**去中心化的应用集群**。

例：创建 Headless nginx 服务

```yaml
apiVersion: v1
kind: Service
metadata:
  name: headless-nginx
spec:
  selector:
    app: nginx
  ports:
    - port: 80
  clusterIP: None
```

查看该服务

```
# kubectl get service headless-nginx
NAME             TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
headless-nginx   ClusterIP   None         <none>        80/TCP    49m
```

### Apache Cassandra 简介

Apache Cassandra 是一套开源分布式 NoSQL 数据库，并不是单个数据库，而是由一组数据库节点共同构成的一个分布式的集群数据库。由于 Cassandra 使用的是去中心化模式，所以在集群中的一个节点启动后，需要获知集群中新节点的加入，对此 Cassandra 使用 Seed 完成节点之间发现和通信。

Cassandra 使用了 Google 设计的 BigTable 的数据模型，与关系型数据库或 key-value 数据库不同，Cassandra 使用的是*宽列存储模型(Wide Column Stores)*，每行数据由*row key*唯一标识之后，可以有最多 20 亿个列，每个列有一个*column key*标识，每个*column key*下对应若干*value*。这种模型可以理解为是一个二维的 key-value 存储，即整个数据模型被定义成一个类似`map<key1, map<key2,value>>`的类型。
Cassandra 的数据并不存储在分布式文件系统如 GFS 或 HDFS 中，而是直接存于本地。与 BigTable 一样，Cassandra 也是日志型数据库，即把新写入的数据存储在内存的 Memtable 中并通过磁盘中的 CommitLog 来做持久化，这种系统的特点是写入比读取更快，因为写入一条数据是顺序计入 commit log 中，不需要随机读取磁盘以及搜索。

Cassandra 结合 Headless Service 可实现 Cassandra 节点之间互相查找和集群的自动搭建。

### 通过 Service 动态查找 Pod

由于 pod 的创建和销毁都会实时更新 Service 的 Endpoint 数据，所以可动态对 Service 的后端 Pod 进行查询，因此一个 Cassandra 节点只需要查询到其他节点就能自动组成一个集群。

Cassandra 节点加入集群的过程
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206071603288.png)

1. 新节点出现会更新 Service 的 Endpoint
2. Master 获取 Service 的后端 Endpoint，将新 Pod 加入集群

创建服务 cassandra，并打上标签 app=cassandra，且 selector 也选择 app=cassandra。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: cassandra
  labels:
    app: cassandra
spec:
  selector:
    app: cassandra
  ports:
    - port: 9042
```

创建 RC

```yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: cassandra
spec:
  replicas: 2
  selector:
    app: cassandra
  template:
    metadata:
      name: cassandra
      labels:
        app: cassandra
    spec:
      containers:
      - name: cassandra
        image: cassandra
        ports:
        - containerPort: 9042
          name: cql
        - containerPort: 9160
          name: thrift
        volumeMounts:
        - mountPath: /cassandra_data
          name: data
        command:
        - /run.sh
        res
      volumes:
      - name: data
        emptyDir: {}
```

## 从集群外部访问 Pod 和 Service

# 核心组件运行机制

## API-Server

APIserver 的功能：

- 提供 K8s 各资源对象的增删改查及 Watch 等 REST 接口，是整个系统的数据总线和数据中心
- 是集群管理的 API 入口
- 是资源配额控制的入口
- 提供完备的集群安全机制

默认 kube-apiserver 在 master 上 8080 端口提供服务，也可启动 HTTPS 安全端口启动安全机制。

常见 REST API：

- apiserver 支持的资源对象列表：`localhost:8080/api/v1`
- pod 列表：`localhost:8080/api/pods`
- service 列表：`localhost:8080/api/services`
- RC 列表：`localhost:8080/api/replicationcontrollers`
- 等

若只要对外暴露部分 REST，则需要在 Master 或其他节点运行 proxy，在 8001 端口启动代理拒绝客户端访问 RC 的 API

```
kubectl proxy --reject-paths="^/api/v1/replicationcontrollers" --port=8001 --v=2
```

然后访问该 REST 查看

```
# curl localhost:8001/api/v1/replicationcontrollers
Forbidden
```

K8s apiserver 本身就是一个 Service，名叫 kubernetes，且 ClusterIP 就是地址池的第一个地址，端口是 HTTPS/443

```
# kubectl get service
NAME         TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
kubernetes   ClusterIP   192.168.10.1   <none>        443/TCP   6d2h
```

K8s 设计通过以下方式最大程度保证 API server 的性能：

- API server 的底层代码性能高，使用了协程和队列的并发代码
- 普通 List 接口结合异步 Watch 接口，解决了资源对象高性能同步问题并提高了响应事件的灵敏度
- 采用 etcd 解决了数据可靠性问题，提升了 APIserver 数据访问层的性能

API Server 架构：

- API 层：以 REST 提供各种 API
- 访问控制层：当客户端访问 API 时负责对用户身份的鉴权，进行访问控制（许可逻辑 Admission Controll）
- 注册表层：K8s 将所有资源对象都保存在注册表（Registry）中，包含了资源对象类型、如何创建资源对象、如何转换资源版本、如何将资源编码和解码为 Json 或 ProtoBuf 格式
- etcd 数据库

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206071604800.png)

完整 Pod 的调度机制 List-Watch

1. API server 通过 etcd 提供的 Watch API 监听 etcd 上发生的数据操作，如 Pod 创建更新等，etcd 会及时通知 APIserver。当一个 ReplicaSet 对象被创建并保存到 etcd 后，etcd 立刻发送一个 Create 事件给 API Server。
2. API Server 通过自身的 Watch 接口获取它们感兴趣的任务资源对象的相关事件。
3. K8s List-Watch 实现数据同步，客户端先调用 API server 的 List 接口获取相关资源对象的全量数据并缓存到内存中，然后启动对应资源对象的 Watch 协程，接收到 Watch 事件后根据事件类型对内存的全量资源对象列表同步修改，能达到近乎实时的数据同步

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206071604806.png)

所有 K8s 内建的资源对象实现都包含以下功能：

- 元数据（Schema）定义：定义了资源对象的数据结构
- 校验逻辑：确保用户提交的资源对象属性的合法性
- CRUD 代码
- 自动控制器：确保对应资源对象的数量、状态、行为始终符合用户期望

## Controller Manager

在 K8s 中，每个 Controller 都是一个功能系统，通过 APIServer 提供的 List-Watch 接口实时监控集群中特定资源的状态变化，当发生各种故障导致资源对象状态变化时，Controller 会尝试将其状态调整为期望的状态。Controller Manager 是 K8s 各种 Controller 的管理者，是集群内的管理控制中心和自动化的核心。

### Replication Controller

与资源对象 ReplicationController（RC）不同，在 Controller Manager 中的 Replication Controller 为**副本控制器**，核心作用为确保任何时候集群中某个 RC 关联的 Pod 副本数量保持预定值。
注：只有 Pod 的重启策略为 Always 时（`RestartPolicy=Always`），Replication Controller 才会管理该 Pod 的操作。
通常情况下 Pod 对象被成功创建后就不会消失，除非 Pod 处于 succeed 或 failed 状态的时间过长，该 Pod 就会被系统自动回收，然后副本控制器在其他节点上重新创建该 Pod 副本。

Pod 可通过修改标签来脱离 RC 的管控，一般用在将 Pod 从集群中迁移、数据修复等调试，对于被迁移的 Pod 副本，RC 会自动新建一个副本替换被迁移的副本。
若要删除一个 RC 控制的所有 Pod，只需将 RC 定义的副本数设为 0 并应用即可。

### Node Controller

Node Controller 通过 API Server 实时获取 Node 的相关信息，实现管理和监控集群中的各 Node 的相关控制功能。

工作流程：

1. Controller Manager 若在启动时设置了`cluster-cidr`参数，则会为每个没有设置`Spec.PodCIDR`的 Node 都生成一个 CIDR 地址，然后再用该 CIDR 地址设置`Spec.PodCIDR`，从而防止 CIDR 地址冲突
2. 逐个读取 Node 信息，尝试修改 nodeStatusMap 的节点状态信息，将该信息与 Node Controller 的 nodeStatusMap 的节点信息比较。
   - 若没收到 kubelet 发的节点信息、或者是第一次收到节点信息、或者处理过程中节点状态变为非健康状态，则在 nodeStatusMap 中保存该节点状态信息，且修改探测时间与节点状态变化时间为 Master 节点的系统时间
   - 若指定时间内收到新的节点信息，且节点状态未发生变化，则在 nodeStatusMap 中保存该节点状态，且修改探测时间为 Master 节点的系统时间、节点状态变化时间为上次节点变化时间
   - 若指定时间内收到新的节点信息，且节点状态发生变化，则在 nodeStatusMap 中保存该节点状态，且修改探测时间和节点状态变化时间为 Master 节点的系统时间
   - 若指定时间内未收到节点信息，则设置节点状态为未知，并通过 API server 保存节点状态
3. 逐个读取节点信息，根据节点状态删除或同步节点信息

### ResourceQuota Controller

ResourceQuota Controller（资源配额管理）确保了指定资源对象在任何时刻都不会超量占用系统物理资源。目前支持三个层次的配额管理：

- 容器级别：对 CPU 和内存
- Pod 级别：对 Pod 内所有容器的资源
- Namespace 级别：多租户级别的资源限制，包括：Pod 数量、ReplicationController 数量、Service 数量、ResourceQuota 数量、Secret 数量、PV 数量

配额管理通过 Admission Control（准入控制）来控制，提供两种方式：

- LimitRanger：作用于 Pod 和 Container
- ResourceQuota：作用于 Namespace

若在 Pod 中声明了 LimitRanger，则通过 APIserver 请求创建或修改资源时，Admission Control 会计算当前配额的使用情况，若不符合配额约束，则创建失败。
若在 Namespace 中声明了 ResourceQuota，则 ResourceQuota Controller 负责定期统计和生成该 Namespace 下各个资源对象的资源使用总量并写入 etcd 的 resourceQuotaStatusStorage 目录（resourceQuotas/status），然后这些统计被 Admission Control 使用，确保相关 Namespace 下资源配额总量不超过 ResourceQuota 的限定值。

### Namespace Controller

用户通过 APIServer 创建新的 Namespace 并保存在 etcd 中，Namespace Controller 定时通过 API Server 读取这些 Namespace 信息。

若 Namespace 被 API 标识为优雅删除（`DeletionTimestamp`属性，删除期限），则将该 Namespace 状态设为 Terminating 并保存在 etcd 中，同时 Namespace Controller 删除该 Namespace 下的 ServiceAccount、RC、Pod、Secret、PersistentVolume、ListRange、ResourceQuota 和 Event 等资源对象。

### Service Controller 和 Endpoints Controller

Endpoints 表示了一个 Service 对应的所有 Pod 副本的访问地址，Endpoints Controller 就是负责生成和维护所有 Endpoints 对象的控制器。
Endpoints Controller 监听 Service 和对应 Pod 副本的变化

- 若检测到 Service 被删除，则删除和该 Service 同名的 Endpoints 对象
- 若检测到 Service 被创建或修改，则根据该 Service 信息获取相应 Pod 列表，然后创建更新对应 Endpoints 对象
- 若检测到 Pod 事件，则更新对应 Service 的 Endpoints 对象

Service Controller 监听 Service 变化，若该 Service 是 LoadBalancer 类型，则 Service Controller 确保在外部云平台上该 Service 对应的 LoadBalancer 实例被相应地创建、删除或更新。

## Scheduler

## kubelet

## kubeproxy

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
> Kubernetes 权威指南（第四版）
>
> 每天 5 分钟玩转 Kubernetes
>
> [Kubernetes 1.12.2 版，使用 docker 镜像安装](http://blog.51cto.com/12331508/2315352?source=dra)
>
> [Kubernetes：如何解决从 k8s.gcr.io 拉取镜像失败问题](https://blog.csdn.net/jinguangliu/article/details/82792617)
>
> [Kubernetes: 21 天完美通关](https://blog.51cto.com/cloumn/detail/87)

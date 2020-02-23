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
  - [k8s 如何进行版本升级](#k8s-%e5%a6%82%e4%bd%95%e8%bf%9b%e8%a1%8c%e7%89%88%e6%9c%ac%e5%8d%87%e7%ba%a7)
- [Kubernetes 简单部署](#kubernetes-%e7%ae%80%e5%8d%95%e9%83%a8%e7%bd%b2)
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

# Kubernetes 简单部署

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
- Kubernetes 版本 1.12
- Docker 版本 18.06（k8s1.12 最高支持 docker18.06）
  > 如果版本过高需要重新下载安装`yum install docker-ce-<VERSION STRING>`，如`yum install docker-ce-18.06.0.ce`
- Node1：Master，192.168.60.130
- Node2：Node，192.168.60.131
- Node3：Node，192.168.60.132

Master 节点上不需要安装 docker，但需要安装 etcd、kubectl、kubeadm

Node 节点上要安装 docker、kubelet

所有节点都要关闭 selinux，确保时间都同步了，并在`/etc/hosts`中设置主机名

```
192.168.60.130  kubenode1
192.168.60.131  kubenode2
192.168.60.132  kubenode3
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

然后初始化 Master，仍可能出现报错
还需要做以下操作：

```
sysctl -w net.bridge.bridge-nf-call-iptables=1
swapoff -a    # 关闭swap
```

然后初始化:

```
# kubeadm init --apiserver-advertise-address 192.168.60.130 --pod-network-cidr=10.1.1.0/24
```

期间会拉取`k8s.gcr.io`的镜像，但是国内无法拉取。有以下三种方法：

**方法一：**
可以先在 docker 上拉取镜像后再启动。**注：一定要加上版本号（Master 初始化失败会提示镜像的版本）**

```
docker pull mirrorgooglecontainers/kube-apiserver-amd64:v1.12.2
docker pull mirrorgooglecontainers/kube-controller-manager-amd64:v1.12.2
docker pull mirrorgooglecontainers/kube-scheduler-amd64:v1.12.2
docker pull mirrorgooglecontainers/kube-proxy-amd64:v1.12.2
docker pull mirrorgooglecontainers/pause-amd64:3.1
docker pull mirrorgooglecontainers/etcd-amd64:3.2.24
docker pull coredns/coredns:1.2.2
```

然后一定要打上标签，因为初始化命令始终是查找`k8s.gcr.io`的镜像的。

```
docker tag coredns/coredns k8s.gcr.io/coredns:1.2.2
docker tag mirrorgooglecontainers/kube-proxy-amd64:v1.12.2 k8s.gcr.io/kube-proxy:v1.12.2
docker tag mirrorgooglecontainers/kube-apiserver-amd64:v1.12.2 k8s.gcr.io/kube-apiserver:v1.12.2
docker tag mirrorgooglecontainers/kube-controller-manager-amd64:v1.12.2 k8s.gcr.io/kube-controller-manager:v1.12.2
docker tag mirrorgooglecontainers/kube-scheduler-amd64:v1.12.2 k8s.gcr.io/kube-scheduler:v1.12.2
docker tag mirrorgooglecontainers/etcd-amd64:3.2.24 k8s.gcr.io/etcd:3.2.24
docker tag mirrorgooglecontainers/pause-amd64:3.1 k8s.gcr.io/pause:3.1
```

**方法二：**
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

**方法三：**
修改配置文件。首先通过 kubeadm 导出默认配置文件

```
kubeadm config print init-defaults --kubeconfig ClusterConfiguration > kubeadm.yml
```

修改配置文件的 k8s 镜像源

```
imageRepository: registry.aliyuncs.com/google_containers
```

之后查看所需的镜像列表

```
# kubeadm config images list --config kubeadm.yml
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
# kubeadm config images pull --config kubeadm.yml
```

进行试运行，通过参数`--dry-run`

```
# kubeadm init --kubernetes-version=v1.17.0 --pod-network-cidr="10.1.0.0/8" --dry-run
```

会提示以下信息：

```
Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/tmp/kubeadm-init-dryrun843006477/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/

Then you can join any number of worker nodes by running the following on each as root:

kubeadm join 192.168.0.110:6443 --token ndqvtf.wvr5sxx39cot7qx0 \
    --discovery-token-ca-cert-hash sha256:d485e071c7521df2e957a87239855212d2399c737a3f718f378d30a09b0b631e
```

按照提示，最好使用普通用户执行操作 k8s

```
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/tmp/kubeadm-init-dryrun843006477/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

在两个 node 上也进行设置：

```
systemctl enable kubelet
systemctl stop firewalld && systemctl disable firewalld
swapoff -a
sysctl -w net.bridge.bridge-nf-call-iptables=1
```

将 Master 提供的加入指令在 node 上执行，便可加入集群。

由于`kubectl`暂时无法使用命令补全，所以需要启用自动补全。

```
echo "source <(kubectl completion bash)" >> ~/.bashrc
```

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

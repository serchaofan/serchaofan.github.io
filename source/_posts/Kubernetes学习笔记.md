---
title: Kubernetes学习笔记-1
date: 2018-07-13 20:33:37
tags: [云计算, Kubernetes]
categories: [云计算]
---

- [Kubernetes 概述](#Kubernetes概述)
- [Kubernetes 简单部署](#Kubernetes简单部署)

<!--more-->

# Kubernetes 概述

Kubernetes 协调一个高可用的计算机集群，这些计算机连接起来作为一个单元工作，以更有效的方式自动化跨集群分发和调度应用程序容器。

K8s 集群节点的两种角色：Master 管理节点和 Nodes 工作节点。

**每个节点都有一个 Kubelet，它是管理节点并与 Master 通信的代理。**该节点还应具有用于处理容器操作的工具，例如 Docker 或 rkt。**处理生产流量的 Kubernetes 集群应至少有三个节点。**

节点使用主服务器公开的 Kubernetes API 与 Master 进行通信。用户还可以直接使用 Kubernetes API 与群集进行交互。

K8s 对外提供容器服务偏向于 Mesos 方式，即用户提交容器集群运行所需要的资源的申请（通常是一个配置文件），然后有 k8s 负责完成这些容器的调度，自动为容器选择运行的宿主机。

**K8S 的功能：**

- 自动化容器的部署和复制 ，控制器维护 pod 副本数量，保证一个 pod 或一组同类 pod 数量始终可用

* 随时扩展或收缩容器规模，弹性伸缩，自动缩放 pod 副本数
* 将容器组织成组（pod），并且提供容器间的负载均衡，集群服务入口为 ClusterIP
* 服务发现，可使用环境变量或 DNS 插件保证容器中程序发现 pod 入口
* 使用数据卷，实现 pod 间共享数据
* 应用程序健康检查，保证健壮性
* 很容易地升级应用程序容器的新版本，滚动更新，服务不中断，一次更新一个 pod
* 服务编排，通过文件描述部署服务
* 资源监控，node 节点集成 cAdvisor 资源收集，通过 Heapster 汇总整个集群节点资源数据，存储到 InfluxDB
* 提供认证和授权，支持属性访问控制（ABAC）、角色访问控制（RBAC）

**常见术语**

- pod：最小的部署单元，包含一组容器和卷。同一个 Pod 里的容器共享同一个网络命名空间，可以使用 localhost 互相通信。Pod 是短暂的，不是持续性实体。
- service：是一个应用服务抽象，定义了**pod 逻辑集合**和**访问这个 pod 集合的策略**，对外提供一个访问入口，会有一个集群的 IP 地址，会将目的是该 IP 的请求负载均衡到 pod 的容器。
- label：标签，用于区分对象（pod，service），每个对象可以有多个标签，可通过标签关联对象。

基于基本对象的更高层次抽象

- ReplicaSet：下一代的 Replication Controller。确保任何给定时间指定的 pod 副本数量，并提供声明式更新等功能。

  > Replication Controller：确保任意时间都有指定数量的 Pod 副本在运行。能根据指定的副本数量动态增加或删除副本。
  >
  > ReplicaSet 和 Replication Controller 的区别：前者支持新的基于集合的标签，后者仅支持基于等式的标签

- Deployment：管理 ReplicaSets 和 pod，提供声明式更新等功能。官方建议用 Deployment 管理 ReplicaSets，而不是直接使用 ReplicaSets。

- StatefulSet：适合持久化的应用，具有唯一的网络标识符（IP 地址）、持久存储、有序部署、扩展、删除和滚动更新。

- DaemonSet：确保所有或一些节点运行同一个 pod，当节点加入 k8s 集群中，pod 会被调度到该节点上运行，当节点从集群中删除时，pod 也会被删除。

- Job：一次性任务，运行完成后 pod 销毁。

## k8s 结构与组件

**Master**节点组件：

- **kube-apiserver**：K8s API，集群的统一入口，以 HTTP API 提供接口服务，所有对象资源的增删改查和监听工作都交给 API Server 处理，再交给 etcd 存储（可选），是集群控制的入口进程
- **kube-controller-manager**：控制器管理，处理集群中常规后台任务，一个资源对应一个控制器。
- **kube-scheduler**：根据调度算法为创建的 pod 选择节点。

**Node**节点组件：

- **kubelet**：Master 在 Node 上的 Agent，**管理本机运行的容器的生命周期**，如创建容器、挂载数据卷，获取节点状态等工作，将每个 pod 转换为一组容器。
- **kube-proxy**：在 Node 节点上实现 pod 网络代理，**维护网络规划和四层负载均衡**工作，实现**k8s service 的通信和负载均衡**。
- **docker 或 rkt**：底层容器引擎。

> Node 节点能在运行期间动态添加到 k8s 集群中，在默认情况下 kubelet 会向 Master 注册自己，这也是 Kubernetes 推荐的 Node 管理方式。
>
> 一旦 Node 被纳入集群管理范围， kubelet 进程就会定时向 Master 节点汇报自身的情报，例如操作系统、 Docker 版本、机器的 CPU 和内存情况，以及当前有哪些 Pod 在运行等 ， 这样 Master 可以获知每个 Node 的资源使用情况，并实现高效均衡的资源调度策略。
>
> 而某个 Node 超过指定时间不上报信息时，会被 Master 判定为“**失联**”， Node 的状态被标记为**不可用**（ Not Ready ），随后 Master 会触发“工作负载大转移”的自动流程 。

第三方服务：

- **etcd**：分布式键值存储系统，用于保持集群状态，如 pod、service 对象信息。

{% asset_img 1.png %}

每个 Pod 都有一个特殊的被称为“根容器”的 Pause 容器 。 Pause 容器对应的镜像属于 Kubemete 平台的一部分，除了 Pause 容器，每个 Pod 还包含一个或多个紧密相关的用户业务容器。

{% asset_img 2.png %}

在 Kubernetes 中运行的 Pod 正在一个私密的隔离网络上运行。默认情况下，它们可以从同一个 kubernetes 集群中的其他 pod 和服务中看到，但不能在该网络之外。当我们使用 kubectl 时，我们通过 API 端点进行交互以与我们的应用程序进行通信。

kubectl 命令可以创建一个代理，将代理转发到群集范围的专用网络。

# Kubernetes 简单部署

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

```
# kubeadm init --apiserver-advertise-address 192.168.60.130 --pod-network-cidr=10.1.1.0/24
```

还需要做以下操作：

```
sysctl -w net.bridge.bridge-nf-call-iptables=1
swapoff -a    # 关闭swap
```

再次执行初始化。期间会拉取`k8s.gcr.io`的镜像，若无法上外网则会失败。可以先在 docker 上拉取镜像后再启动。**注：一定要加上版本号（Master 初始化失败会提示镜像的版本）**

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

再次执行命令初始化，等一段时间，会提示初始化成功，并提供了集群加入的指令。

```
Your Kubernetes master has initialized successfully!
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

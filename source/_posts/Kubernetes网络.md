---
title: Kubernetes网络
tags: [Kubernetes, 网络]
date: 2020-01-07 22:48:17
categories: [Kubernetes]
comments: false
---

- [K8s网络模型概述](#k8s网络模型概述)
  - [ip地址分配](#ip地址分配)
  - [k8s主机内组网](#k8s主机内组网)
  - [k8s跨节点组网](#k8s跨节点组网)
- [K8s网络策略](#k8s网络策略)
- [K8s网络故障定位](#k8s网络故障定位)
- [K8s 网络实现机制](#k8s-网络实现机制)
- [K8s DNS](#k8s-dns)
- [K8S网络插件](#k8s网络插件)
  - [Flannel](#flannel)
  - [Calico](#纯co)
  - [Weave](#weave)
  - [Cilium](#cilium)

<!--more-->

# K8s网络模型概述
在k8s网络模型中，每台服务器上的容器有自己独立的ip段，各个服务器之间的容器可以根据目标容器的ip地址进行访问。为实现这个目标，k8s网络重点要解决以下两点：
1. 各台服务器上的容器ip段不能重叠，所以需要某种ip段分配机制，为各台服务器分配独立的ip段
2. 从某个pod发出的流量到达其所在服务器时，服务器网络层应当具备根据目标ip地址将流量转发到该ip所属ip段对应服务器的能力。

单pod单ip模型：每个pod都有一个独立ip地址，pod内所有容器共享network namespace。容器之间直接通信，不需要额外NAT，因此不存在源地址被伪装的情况，node与容器网络直连，同样不需要额外NAT。扁平化的网络优点在于：没有NAT带来的性能损耗，且可追溯源地址，为后面网络策略铺垫，降低网络拍错难度。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202208041802718.png)

## ip地址分配
k8s会为节点、pod、服务分配ip地址。
1. 系统从集群VPC网络为每个节点分配一个ip，该节点ip用于提供从控制组件（kubelet和kube-proxy）到k8s master的连接。
2. 系统会为每个pod分配一个地址块内的ip地址，用户可选择在创建集群时通过`--pod-cidr`指定ip段范围
3. 系统会从集群VPC网络为每项服务分配一个ip地址，称为ClusterIP，大部分情况下，该VPC与节点ip地址不在同一个网段。

## k8s主机内组网



## k8s跨节点组网


# K8s网络策略

# K8s网络故障定位

# K8s 网络实现机制

# K8s DNS

# K8S网络插件
## Flannel
Flannel 可为容器提供跨节点网络服务，其模型为集群内所有容器使用一个网络，然后在每个主机上从该网络中划分一个子网。flannel为主机上的容器创建网络时，从子网中划分一个IP给容器。

容器跨节点访问的技术挑战以及flannel的解决方案：
1. 容器IP有重复问题：由于docker只是利用linux内核network namespace实现网络隔离，各个节点上的容器IP地址是在所属节点上自动分配的，从全局看，这种局部地址一旦拿到大的范围来看就可能有重复的。
   解决：flannel设计了一种全局的网络地址分配机制，即使用etcd存储网段和节点之间的关系，然后flannel配置各个节点上Docker，只在分配到当前节点的网段中选择容器IP地址，确保了IP地址分配的全局唯一。
2. 容器IP地址路由问题：通常虚拟网络的IP和MAC地址在物理网络上是不认识的，所以数据包即使被发送到网络中，也会因无法进行路由而被丢掉。虽然地址唯一了，但是依然无法实现真正的网络通信。
   解决：

## Calico
Calico 是一个用于容器、虚拟机和本地基于主机的工作负载的开源网络和网络安全解决方案。Calico 支持广泛的平台，包括 Kubernetes、 OpenShift、 Mirantis Kubernetes Engine (MKE)、 OpenStack 和裸金属服务。Calico 提供了多种数据平面的支持，包括Linux eBPF数据平面，标准linux网络数据平面，以及Windows HNS数据平面。

Calico提供了纯3层的网络模型，每个容器都通过IP直接通信，没有采用overlay进行转发，而是基于路由转发，容器所在节点便扮演了类似路由器的功能，或者叫做虚拟路由器（vRouter），而且这些虚拟路由器需要知道整个集群的网络路由信息。Calico是一个基于BGP的数据中心网络方案，也支持overlay网络，与kubernetes、openstack、AWS、GCE都有良好的集成。因此，通过三层BGP协议，这些节点上的虚拟路由器便将整个网络的路由信息进行传播与维护，实现了三层网络上的跨节点网络。

Calico不仅提供容器网络方案，也可以用在虚拟机网络上。同时网络策略功能也是Calico的特点，通过Calico的网络策略语言，可以对容器、虚拟机负载和裸机之间网络通信进行细粒度和动态的安全规则控制。Calico基于iptables实现了k8s网络策略，通过在各节点上应用ACL策略进行工作负载的多租户隔离、安全组以及其他可达性限制等。Calico还可以与Istio集成，以便在服务网格层和网络基础架构层中实施网络策略。




## Weave

## Cilium



> 参考文章
> 《Kubernetes网络权威指南：基础、原理与实践》
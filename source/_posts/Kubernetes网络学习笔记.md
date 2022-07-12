---
title: Kubernetes网络学习笔记
tags: [Kubernetes, 网络]
date: 2020-01-07 22:48:17
categories: [Kubernetes]
comments: false
---

- [K8s网络基础架构](#k8s网络基础架构)
- [K8s网络策略](#k8s网络策略)
- [K8s网络故障定位](#k8s网络故障定位)
- [K8s 网络实现机制](#k8s-网络实现机制)
- [K8s DNS](#k8s-dns)
- [K8S网络插件](#k8s网络插件)
  - [Flannel](#flannel)
  - [Calico](#calico)
  - [Weave](#weave)
  - [Cilium](#cilium)

<!--more-->

# K8s网络基础架构


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

## Weave

## Cilium



> 参考文章
> 《Kubernetes网络权威指南：基础、原理与实践》
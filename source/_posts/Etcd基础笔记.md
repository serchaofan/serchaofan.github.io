---
title: Etcd基础笔记
tags: []
categories: []
date: 2020-04-10 12:28:43
---

- [etcd数据模型](#etcd%e6%95%b0%e6%8d%ae%e6%a8%a1%e5%9e%8b)
- [etcd架构](#etcd%e6%9e%b6%e6%9e%84)
- [应用场景](#%e5%ba%94%e7%94%a8%e5%9c%ba%e6%99%af)
  - [服务注册和发现](#%e6%9c%8d%e5%8a%a1%e6%b3%a8%e5%86%8c%e5%92%8c%e5%8f%91%e7%8e%b0)
  - [消息发布与订阅](#%e6%b6%88%e6%81%af%e5%8f%91%e5%b8%83%e4%b8%8e%e8%ae%a2%e9%98%85)
  - [负载均衡](#%e8%b4%9f%e8%bd%bd%e5%9d%87%e8%a1%a1)
  - [分布式通知与协调](#%e5%88%86%e5%b8%83%e5%bc%8f%e9%80%9a%e7%9f%a5%e4%b8%8e%e5%8d%8f%e8%b0%83)
  - [分布式锁](#%e5%88%86%e5%b8%83%e5%bc%8f%e9%94%81)
  - [分布式队列](#%e5%88%86%e5%b8%83%e5%bc%8f%e9%98%9f%e5%88%97)
  - [集群监控与 Leader 竞选](#%e9%9b%86%e7%be%a4%e7%9b%91%e6%8e%a7%e4%b8%8e-leader-%e7%ab%9e%e9%80%89)
  - [etcd与zookeeper的区别](#etcd%e4%b8%8ezookeeper%e7%9a%84%e5%8c%ba%e5%88%ab)

<!--more-->

etcd 以一致和容错的方式存储元数据。分布式系统使用 etcd 作为一致性键值存储，用于**配置管理，服务发现和协调分布式工作**。etcd 内部采用raft协议作为一致性算法，etcd 基于 Go 语言实现。
> 名字来源：etc即linux的/etc目录，意为存放配置文件，d为distributed即分布式

etcd 的特点
- 安装配置简单，且提供了HTTP API进行交互
- 支持SSL证书验证
- 单实例支持每秒2k+读操作
- 采用raft算法，实现分布式系统数据的可用性和一致性

分布式系统中的数据分为控制数据和应用数据，**使用 etcd 的场景默认处理的数据都是控制数据**，对于**应用数据，只推荐数据量很小，但是更新访问频繁的情况**。

常见术语：
- **Node**：**Raft状态机实例**。
- **Member**：**etcd实例**。它管理着一个Node，并且可以为客户端请求提供服务。
- **Cluster**：由多个Member构成可以协同工作的**etcd集群**。
- **Peer**：对**同一个etcd集群中另外一个Member**的称呼。
- **Client**：向etcd集群发送HTTP请求的客户端。
- **Proxy**：etcd的一种模式，**为etcd集群提供反向代理服务**。
- **Leader**：Raft算法中**通过竞选而产生的处理所有数据提交的节点**。
- **Follower**：竞选失败的节点作为**Raft中的从属节点**，为算法提供强一致性保证。
- **Candidate**：当**Follower超过一定时间接收不到Leader的心跳时转变为Candidate开始竞选**。
- **Term**：**某个节点成为Leader到下一次竞选时间**，称为一个Term。
- **Index**：数据项编号。Raft中**通过Term和Index来定位数据**。

为了保证数据的强一致性，etcd 集群中所有的数据流向都是一个方向，从 Leader（主节点）流向 Follower，也就是所有 Follower 的数据必须与 Leader 保持一致，如果不一致会被覆盖。
- 读：由于集群所有节点数据是强一致性的，可以从集群中随便哪个节点进行读取数据
- 写：etcd 集群有 leader，可以直接往 leader 写入，然后Leader节点会把写入分发给所有 Follower，如果往 follower 写入，则Leader节点会把写入分发给所有 Follower

# etcd数据模型

# etcd架构

{% asset_img etcd1.png %}

- HTTP Server：用于处理用户发送的 API 请求以及其它 etcd 节点的同步与心跳信息请求。
- Store：用于处理 etcd 支持的各类功能的事务，包括数据索引、节点状态变更、监控与反馈、事件处理与执行等等，是 etcd 对用户提供的大多数 API 功能的具体实现。
- Raft：Raft 强一致性算法的具体实现，是 etcd 的核心。
- **WAL**：**预写式日志**，etcd用于持久化存储的日志格式。除了在内存中存有所有数据的状态以及节点的索引以外，etcd 就通过 WAL 进行持久化存储。WAL 中，所有的数据提交前都会事先记录日志。
  - **Snapshot**：etcd**防止WAL文件过多而设置的快照**，存储etcd数据状态。
  - **Entry**：存储的具体日志内容。

# 应用场景
## 服务注册和发现

提供**服务发现**功能的关键设计：
- 强一致性、高可用的服务存储目录
- 注册服务和监控服务健康状态的机制
- 查找和连接服务的机制

常见服务发现形式：
- 前后端业务注册发现：中间件和后端服务在etcd中注册后，前端和中间件可以从etcd中找到相应服务器并根据调用关系进行绑定
  {% asset_img etcd2.png %}
- 多组后端服务器注册发现：后端多个状态相同APP可同时注册到etcd中，前端可通过HAProxy从etcd获取到后端IP和端口然后请求转发，能够通过动态的配置域名解析实现实例故障重启透明化
  {% asset_img etcd3.png %}

## 消息发布与订阅
在分布式系统中，最适用的一种组件间通信方式就是消息发布与订阅，即构建一个配置共享中心，数据提供者在这个配置中心发布消息，而消息使用者则订阅他们关心的主题，一旦主题有消息发布，就会实时通知订阅者。通过这种方式可以做到分布式系统配置的集中式管理与动态更新。


## 负载均衡


## 分布式通知与协调

## 分布式锁


## 分布式队列

## 集群监控与 Leader 竞选

## etcd与zookeeper的区别


> 参考文章：
>
> [Etcd 集群搭建](https://mritd.me/2016/09/01/Etcd-%E9%9B%86%E7%BE%A4%E6%90%AD%E5%BB%BA/)
> 
> [Etcd 使用入门](https://www.hi-linux.com/posts/40915.html)
> 
> [万字长文：etcd 从入门到放弃](https://mp.weixin.qq.com/s/4X7-tkrJ-rFYI7BqquK9Og)
> 
> [etcd官方文档中文版](https://doczhcn.gitbook.io/etcd/)
> 
> [etcd：从应用场景到实现原理的全方位解读](https://www.infoq.cn/article/etcd-interpretation-application-scenario-implement-principle)
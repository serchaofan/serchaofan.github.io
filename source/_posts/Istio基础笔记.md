---
title: Istio
tags: []
date: 2020-04-05 19:09:24
categories: [服务网格]
comments: false
---

本文内容包括Istio的基础概念以及常见用例，大量概念摘抄自《深入浅出Istio：Service Mesh快速入门与实践》一书，仅用作学习参考。
Istio 版本：1.9.0

<!--more-->

- [Service Mesh](#service-mesh)
- [Istio](#istio)
- [Istio组件](#istio组件)
- [Istio核心配置对象](#istio核心配置对象)

# Service Mesh
Buoyant 公司的CEO William , 曾经给出对服务网格的定义：服务网格是一个独立的基础设施层，用来处理服务之间的通信。
Istio官方的定义：服务网格常常用来描述构建这些应用以及应用间交互的微服务网络。随着服务网格的大小和复杂性的增长，它变得越来越难以理解和管理。 服务网格的要求可以包括服务发现，负载均衡，故障恢复，指标和监视。服务网格通常还具有更复杂的操作要求，例如A/B测试，金丝雀发布，速率限制，访问控制和端到端身份验证。

也可做出以下总结，ServiceMesh的描述就是：
- 治理能力独立（sidecar）
- 应用程序无感知
- 服务通信的基础设施层

# Istio
Istio提供了对整个服务网格的行为分析和操作控制，提供了一个完整的解决方案来满足微服务应用程序的各种需求。Istio有助于降低这些部署的复杂性，并减轻开发团队的负担。它是一个完全开源的服务网格，可以透明地分层到现有的分布式应用程序上。它也是一个平台，包括了API，可将其集成到任何日志平台、遥测或策略系统中。

通过在整个环境中部署一个特殊的sidecar代理来拦截微服务之间的所有网络通信，您可以向服务添加Istio支持，然后使用Istio的控制平面功能来配置和管理Istio，其中包括：
- 对于HTTP、gRPC、TCP流量的自动负载均衡
- 可通过路由规则、重试次数、故障转移、错误注入进行网络流量行为的细粒度控制
- 可插拔的策略层和配置API，支持访问控制，速率限制和配额
- 对集群内的所有流量(包括集群入口和出口)进行自动度量、日志采集和跟踪
- 通过强身份验证和授权，在集群中进行安全的服务间通信

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120055675.png)

# Istio组件
istio在1.5之后回归单体应用，舍弃了mixer，将pilot、citadel、galley封装为一个istiod应用。
Istio只包含两个组件：
- Envoy：Envoy是使用C++开发的高性能代理，可为服务网格中的所有服务调解所有入站和出站流量。Envoy代理是与数据平面流量交互的唯一Istio组件。
  Envoy代理被部署为服务的Sidecar，包含以下功能：
    动态服务发现
    负载均衡
    TLS终止
    HTTP/2和gRPC代理
    断路器
    健康检查
    分阶段推出，并按百分比分配流量（灰度）
    故障注入
    丰富的指标
- Istiod：


# Istio核心配置对象
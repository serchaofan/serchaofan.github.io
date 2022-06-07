---
title: OpenStack基础概念整理
tags: []
categories: []
date: 2020-03-23 16:29:58
---

- [OpenStack 概述](#openstack-概述)

<!--more-->

# OpenStack 概述

OpenStack 项目是一个开源云计算平台，支持所有类型的云环境。 该项目旨在实现简单的实现，大规模的可伸缩性和丰富的功能。OpenStack 通过各种补充服务提供 IaaS 的解决方案。每个服务都提供各自的 API。

OpenStack 是有多个服务组件组成的一种技术集合，包含以下主要组件：

- **Horizon**：提供 **Dashboard**，一个基于 web 的自服务门户，与 OpenStack 底层服务交互，诸如启动一个实例，分配 IP 地址以及配置访问控制。（可选组件）
- **Nova**：提供**计算服务，即虚拟机管理**，在 OpenStack 环境中计算实例的生命周期管理。按需响应包括**生成、调度、回收虚拟机等操作**。（核心组件）
- **Neutron**：提供**网络服务**，确保为其它 OpenStack 服务**提供网络连接**，比如 OpenStack 计算。为用户提供 API 定义网络和使用。基于插件的架构其支持众多的网络提供商和技术。（核心组件）
- **Swift**：提供**存储服务（备份）**，通过一个 RESTful，基于 HTTP 的应用程序接口存储和任意检索的**非结构化数据对象**。它拥有高容错机制，基于数据复制和可扩展架构。它的实现并像是一个文件服务器需要挂载目录。在此种方式下，它写入对象和文件到多个硬盘中，以确保数据是在集群内跨服务器的多份复制。（核心组件）
- **Cinder**：为运行实例而提供的**持久性块存储**。它的可插拔驱动架构的功能有助于**创建和管理块存储设备**。（核心组件）
- **Keystone**：为其他 OpenStack 服务提供**认证和授权服务**，**为所有的 OpenStack 服务提供一个端点目录**。（核心组件）
- **Glance**：**存储和检索虚拟机磁盘镜像**，OpenStack 计算会在实例部署时使用此服务。（核心组件）
- **Ceilometer**：为 OpenStack 云的计费、基准、扩展性以及统计等目的提供**监测和计量**。（可选组件）
- **Heat**：提供**部署编排云应用**，Orchestration 服务支持多样化的综合的云应用，通过调用 OpenStack-native REST API 和 CloudFormation-compatible Query API，支持 Heat Orchestration Template (HOT)格式模板或者 AWS CloudFormation 格式模板。（可选组件）

{% asset_img 0.png %}

> 参考文档
>
> [OpenStack 官方文档](https://docs.openstack.org/mitaka/zh_CN/install-guide-rdo/overview.html)

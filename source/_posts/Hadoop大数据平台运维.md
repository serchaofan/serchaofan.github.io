---
title: Hadoop大数据平台运维
tags: [Hadoop, CDH, 大数据]
categories: [大数据]
date: 2020-02-21 15:19:44
comments: false
---

<!--more-->

# Hadoop生态
Hadoop生态系统是一个平台或套件，可提供各种服务来解决大数据问题。它包括Apache项目以及各种商业工具和解决方案。Hadoop有四个主要要素，即HDFS，MapReduce，Yarn和Hadoop Common。大多数工具或解决方案用于补充或支持这些主要要素，所有这些工具共同协调提供了合并、分析、存储和维护数据等的服务。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202207051740631.png)

- **HDFS：Hadoop Distributed File System，Hadoop 分布式文件系统**
- **YARN：Yet Another Resource Negotiator，作业调度和资源管理框架**
- **MapReduce：数据并行处理程序**
- **Hadoop Common：Hadoop基础功能库**
- Spark：内存中的数据处理
- PIG, HIVE: 基于查询(类SQL)的数据服务处理
- HBase: NoSQL kv数据库
- Mahout, Spark MLLib: 机器学习算法库
- Solar, Lucene: 检索与索引
- Zookeeper: 分布式集群调度管理
- Oozie: 任务调度
- Flume, Sqoop：数据收集服务


# CDH概述
Cloudera提供了Hadoop的商业发行版 CDH，能够十分方便地对Hadoop集群进行安装、部署与管理。CDH是Cloudera发布的封装了Hadoop商业版软件的发行包，不仅包含了Cloudera的商业版Hadoop，同时也包含了各类常用的开源数据处理与存储框架，如Spark、Hive、HBase等。

## CDH与开源版Apache Hadoop对比
考虑到Hadoop集群部署的高效性、集群稳定性以及后期集中的配置管理，业界大多使用 Cloudera 公司的发行版CDH。

Apache Hadoop虽然完全开源 但是存在诸多问题。
1. 版本管理比较混乱
2. 集群部署配置较复杂，通常按照集群需要编写大量配置文件，分发到每台节点上，容易出错且效率低下
3. 对集群监控、运维需要安装第三方软件，运维难度较大。
4. 使用Hadoop生态圈中的组件需要大量考虑兼容性，经常会浪费大量的时间去编译组件，解决版本冲突问题。

CDH Hadoop的优势在于
1. 版本管理清晰
2. 在兼容性、 安全性、稳定性上比Apache Hadoop有大幅度增强。
3. 运维简单方便，对于 Hadoop 集群提供管理、诊断、监控、配置更改等功能，使得运维工作高效，而且集群节点越多优势越明显。
4. CDH提供成体系的文档、很多大公司的应用案例以及商业支持等。

# CDH部署
## Cloudera Manager大数据管理平台
Cloudera Manager（简称 CM）是为了便于在集群中进行 Hadoop 服务安装与监控管理的组件，对集群中主机、Hadoop、Hive、Spark等服务的安装配置管理做了极大简化。Hadoop集群的软件分发及管理监控平台 过它 快速 部署好 Hadoop 集群，井对集群的节点及 行实时监控。

# HDFS


# MapReduce


# YARN


# Hive


# Sqoop


# HBase


# Flume



> 参考文章
> 
> https://www.geeksforgeeks.org/hadoop-ecosystem/
> 
> https://data-flair.training/blogs/hadoop-ecosystem-components/
> 
> https://www.edureka.co/blog/hadoop-ecosystem
> 
> 《Cloudera Hadoop大数据平台实战指南》
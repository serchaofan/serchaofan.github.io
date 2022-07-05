---
title: 5G NSA与SA概念笔记
tags: [网络, 5G]
categories: [网络]
date: 2019-12-13 11:46:36
comments: false
---

- [5G 组网方案](#5g-组网方案)
  - [SA 组网](#sa-组网)
  - [NSA 组网](#nsa-组网)
    - [3 系组网](#3-系组网)
    - [7 系组网](#7-系组网)
    - [4 系组网](#4-系组网)

第五代移动通信技术（5th generation mobile networks 或 5th generation wireless systems，简称 5G）是最新一代蜂窝移动通信技术，5G 的性能目标是高数据速率、减少延迟、节省能源、降低成本、提高系统容量和大规模设备连接。ITU IMT-2020 规范要求速度高达 20 Gbit/s，可以实现宽信道带宽和大容量 MIMO。第三代合作伙伴计划（3GPP）将提交 5G NR（新无线电）作为其 5G 通信标准提案。5G NR 可包括低频（FR1），低于 6 GHz 和更高频率（FR2），高于 2.4 GHz 和毫米波范围。

<!--more-->

> 多输入多输出系统（Multi-input Multi-output ; MIMO）是一种用来描述多天线无线通信系统的抽象数学模型，核心概念为利用多根发射天线与多根接收天线所提供之空间自由度来有效提升无线通信系统之频谱效率，以提升传输速率并改善通信质量。
> 第三代合作伙伴计划（3rd Generation Partnership Project，即 3GPP）是一个成立于 1998 年 12 月的标准化机构。当前其成员包括欧洲的 ETSI、日本的 ARIB 和 TTC、中国的 CCSA、韩国的 TTA、北美洲的 ATIS 和印度的电信标准开发协会。


下一代移动网络联盟（Next Generation Mobile Networks Alliance）定义了 5G 网络的以下要求：

- 以 10Gbps 的数据传输速率支持数万用户；
- 以 1Gbps 的数据传输速率同时提供给在同一楼办公的许多人员；
- 支持数十万的并发连接以用于支持大规模传感器网络的部署；
- 频谱效率应当相比 4G 被显著增强；
- 覆盖率比 4G 有所提高；
- 信令效率应得到加强；
- 延迟应显著低于 LTE。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120050438.png)

# 5G 组网方案

从 2017 年开始，已经开始 5G 的部署，但是部署方式为 NSA（Non-Standalone，非独立组网），而从 2019 年开始，开始 SA（Standalone，独立组网）的部署。
NSA 与 SA 的最大区别：是否就一种核心网，还有一种基站。只要 4G 基站和 5G 基站共存，就是 NSA

其中 NSA 有约 8 种组网方案，分为

- 3 系
  - 选项 3
  - 选项 3a
  - 选项 3x
- 4 系
  - 选项 4
  - 选项 4a
- 7 系
  - 选项 7
  - 选项 7a
  - 选项 7x

SA 有两种组网方案

- 选项 2
- 选项 5

## SA 组网

SA 就两种方式：

- 选项 2：5G 核心网下直接建设 5G 基站，有钱的运营商会直接用这个方案

  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120051150.png)

  选项 2 的缺点：5G 频点相对 LTE 较高，初期部署难以实现连续覆盖，会存在大量的 5G 与 4G 系统间的切换，用户体验不好
- 选项 5：5G 核心网下改进 4G 基站（LTE eNB），改为增强型 4G 基站（eLTE eNB），一般有大量 4G 基站的运营商会这样，利用旧基站省钱，但是这样本质上仍为 4G，所以这方案不会用的多

  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120051195.png)

## NSA 组网

**NSA 组网围绕的就是三个问题：**

- 基站走 4G 核心网还是 5G 核心网？
- 控制指令是走 4G 基站还是 5G 基站？
- 数据分流是在 4G 基站还是 5G 基站还是核心网？

### 3 系组网

在 3 系组网方式中，参考的是 **LTE 双连接架构**。

> 双连接架构：在 LTE 双连接构架中，UE（用户终端）在连接态下可同时使用至少两个不同基站的无线资源(分为主站和从站)。

- 选项 3：5G 基站是无法直接连在 4G 核心网上面的，所以，它会通过 4G 基站接到 4G 核心网，而传统 4G 基站由于处理能力有限，所以只能改进 4G 基站，变为增强型，再连 5G 基站。
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120050038.png)
- 选项 3a：若无法改进 4G 基站（可能是资金原因或技术原因），只能继续使用老的 4G 基站。5G 基站直通 4G 核心网，所以整体仍为 4G
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120050893.png)
- 选项 3x：同样不改进 4G 基站，让 5G 网既通 4G 核心网，又接收处理 4G 基站超负载的流量
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120050597.png)

### 7 系组网

运营商若要真正 5G 流量，需要将核心网变为 5G 核心网。而 7 系就是 3 系的升级版本，所有 4G 基站升级为增强型

- 选项 7：与 3 系的 3 类似
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120052805.png)
- 选项 7a：与 3 系的 3a 类似
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120052544.png)
- 选项 7x：与 3 系的 3x 类似
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120052714.png)

### 4 系组网

4G 基站和 5G 基站共用 5G 核心网，5G 基站为主站，4G 基站为从站。

- 选项 4：4G 的用户流量从 5G 基站过
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120052315.png)
- 选项 4a：4G 和 5G 用户流量通过各自基站直通核心网
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120052255.png)

所以整个 NSA5G 网络的部署过程应为：

1. 3 系：5G 部署初期，能快速实现 5G 商用，推荐选项 3x
2. 7 系：5G 部署初期及中期场景，由升级后的增强型 4G 基站提供连续覆盖、5G 仍然作为热点覆盖提高容量，推荐选项 7x
3. 4 系：5G 商用中后期部署场景，推荐选项 4
4. 最后淘汰 4G 基站，真正变为 SA 选项 2

**中国的三大运营商直接上了 SA 选项 2**

> 参考：
> [5G 维基百科](https://zh.wikipedia.org/zh-cn/5G#%E5%9F%BA%E7%AB%99%E5%8F%8A%E8%A6%86%E8%93%8B%E7%AF%84%E5%9C%8D) > [说清楚，5G SA 和 NSA 到底有啥区别？](https://36kr.com/p/5218889) > [三分钟看懂 5G NSA 和 SA](https://zhuanlan.zhihu.com/p/52450911)

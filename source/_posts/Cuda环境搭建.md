---
title: Cuda环境搭建
date: 2018-08-16 12:45:45
tags: [CUDA,Nvidia,人工智能,深度学习]
---

CUDA为



## CUDA搭建

CUDA环境搭建大致需要以下步骤：

* Nvidia显卡驱动安装
* CUDA安装
* cuDNN安装

<!--more-->

### Nvidia驱动安装

首先卸载现有的驱动（如果不是最新的话）

`sudo apt-get remove nvidia*`

自动安装Nvidia最新驱动

`sudo apt-get install bumblebee-nvidia nvidia-driver nvidia-settings `

其中：`nvidia-driver`对应了最新的Nvidia驱动，`bumblebee-nvidia`为Nvidia的大黄蜂模式驱动，用于双显卡智能切换。

安装Nvidia的系统管理界面`Nvidia-smi`

`sudo apt-get install nvidia-smi`

使用`nvidia-smi`查看显卡详细信息

```

```


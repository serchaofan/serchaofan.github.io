---
title: Cuda环境搭建
date: 2018-08-16 12:45:45
tags: [CUDA]
categories: []
---

<!--more-->

# CUDA 搭建

CUDA 环境搭建大致需要以下步骤：

- Nvidia 显卡驱动安装
- CUDA 安装
- cuDNN 安装

## Nvidia 驱动安装

首先卸载现有的驱动（如果不是最新的话）

`sudo apt-get remove nvidia*`

自动安装 Nvidia 最新驱动

`sudo apt-get install bumblebee-nvidia nvidia-driver nvidia-settings`

其中：`nvidia-driver`对应了最新的 Nvidia 驱动，`bumblebee-nvidia`为 Nvidia 的大黄蜂模式驱动，用于双显卡智能切换。

安装 Nvidia 的系统管理界面`Nvidia-smi`

`sudo apt-get install nvidia-smi`

使用`nvidia-smi`查看显卡详细信息

---
title: Kubernetes共享存储笔记
tags: []
categories: []
date: 2020-04-05 19:06:54
---

- [PV](#pv)
- [PVC](#pvc)
- [生命周期](#%e7%94%9f%e5%91%bd%e5%91%a8%e6%9c%9f)
- [StorageClass](#storageclass)

<!--more-->

# PV

PersistentVolume 是对底层网络共享存储的抽象，将共享存储定义为一种资源，由管理员创建配置，与共享存储的具体实现直接相关，通过插件式的机制完成与共享存储的对接。

PV 主要包含以下参数的设置：

- 存储能力 capacity：描述存储设备具备的能力（空间大小）
- 访问模式 accessMode：描述用户的应用对存储资源的访问权限。访问模式有：
  - ReadWriteOnce：RWO，读写权限，只能被单个 Node 挂载
  - ReadOnlyMany：ROX，只读权限，允许被多个 Node 挂载
  - ReadWriteMany：读写权限，允许被多个 Node 挂载
- 存储卷模式 VolumeMode：可选 Filesystem 和 Block，默认为 Filesystem
- 存储类别 storageClassName：指定一个 StorageClass 资源对象名称，具有特定类别的 PV 只能和请求了该类别的 PVC 进行绑定，未设定类别的 PV 只能与不请求任何类别的 PVC 绑定。
- 回收策略 persistentVolumeReclaimPolicy：可选项为：
- 挂载参数 mountOptions
- 节点亲和性 nodeAffinity

# PVC

# 生命周期

# StorageClass

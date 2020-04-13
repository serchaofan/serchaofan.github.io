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
PersistentVolume是对底层网络共享存储的抽象，将共享存储定义为一种资源，由管理员创建配置，与共享存储的具体实现直接相关，通过插件式的机制完成与共享存储的对接。

PV主要包含以下参数的设置：
- 存储能力capacity：描述存储设备具备的能力（空间大小）
- 访问模式accessMode：描述用户的应用对存储资源的访问权限。访问模式有：
  - ReadWriteOnce：RWO，读写权限，只能被单个Node挂载
  - ReadOnlyMany：ROX，只读权限，允许被多个Node挂载
  - ReadWriteMany：读写权限，允许被多个Node挂载
- 存储卷模式VolumeMode：可选Filesystem和Block，默认为Filesystem
- 存储类别storageClassName：指定一个StorageClass资源对象名称，具有特定类别的PV只能和请求了该类别的PVC进行绑定，未设定类别的PV只能与不请求任何类别的PVC绑定。
- 回收策略persistentVolumeReclaimPolicy：可选项为：
- 挂载参数mountOptions
- 节点亲和性nodeAffinity

# PVC

# 生命周期

# StorageClass
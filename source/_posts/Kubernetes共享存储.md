---
title: Kubernetes共享存储
tags: [Kubernetes, 存储, PV, PVC, CSI]
date: 2020-04-05 19:06:54
categories: [Kubernetes]
comments: false
---

本文基于 Kubernetes v1.37 官方文档重写，从运维视角讲清 Volume、PV/PVC 绑定、StorageClass、CSI、快照、克隆、扩容、拓扑、性能和故障排查。旧笔记中的 in-tree provisioner、`kubernetes.io/*`、`--admission-control` 等内容已过时，不再作为操作依据。

最后更新：2026-10-22

<!--more-->

- [存储架构](#%E5%AD%98%E5%82%A8%E6%9E%B6%E6%9E%84)
- [Volume 类型](#volume-%E7%B1%BB%E5%9E%8B)
- [PV 与 PVC](#pv-%E4%B8%8E-pvc)
- [StorageClass](#storageclass)
- [CSI 深挖](#csi-%E6%B7%B1%E6%8C%96)
- [访问模式与挂载语义](#%E8%AE%BF%E9%97%AE%E6%A8%A1%E5%BC%8F%E4%B8%8E%E6%8C%82%E8%BD%BD%E8%AF%AD%E4%B9%89)
- [快照、克隆与备份](#%E5%BF%AB%E7%85%A7%E5%85%8B%E9%9A%86%E4%B8%8E%E5%A4%87%E4%BB%BD)
- [扩容](#%E6%89%A9%E5%AE%B9)
- [StatefulSet 存储](#statefulset-%E5%AD%98%E5%82%A8)
- [调度与拓扑](#%E8%B0%83%E5%BA%A6%E4%B8%8E%E6%8B%93%E6%89%91)
- [性能](#%E6%80%A7%E8%83%BD)
- [安全](#%E5%AE%89%E5%85%A8)
- [排障](#%E6%8E%92%E9%9A%9C)
- [企业实践](#%E4%BC%81%E4%B8%9A%E5%AE%9E%E8%B7%B5)
- [附录](#%E9%99%84%E5%BD%95)

# 存储架构

Kubernetes 存储分三层：

1. **Volume**：Pod 级别的挂载点，定义在 Pod spec 中
2. **PV/PVC**：集群级存储资源与命名空间级请求
3. **StorageClass + CSI**：动态创建 PV 的模板和驱动

一次 PVC 从创建到被 Pod 使用，大致经过：

```
PVC 创建
  → 绑定 PV（静态或动态供给）
  → Pod 调度（可能等待拓扑）
  → Attach（ControllerPublish，挂到节点）
  → Mount（NodeStage/NodePublish，挂到 Pod）
  → 容器使用
  → Pod 删除 → Unmount → Detach
  → PVC 删除 → PV 回收
```

关键组件：

- **kube-controller-manager**：PV controller、attach/detach controller
- **CSI controller**：external-provisioner、external-attacher、external-resizer、external-snapshotter
- **kubelet**：调用 CSI node 插件做 NodeStage/NodePublish
- **CSI node 插件**：通常以 DaemonSet 运行，负责设备挂载和文件系统
- **scheduler**：结合 volume topology 做调度

容器可写层不适合放持久化数据；数据库、日志、文件上传等应使用 Volume 或 PVC。

# Volume 类型

| 类型 | 生命周期 | 典型场景 |
| --- | --- | --- |
| `emptyDir` | 随 Pod | 临时缓存、容器间共享文件 |
| `hostPath` | 随节点 | 节点代理、日志采集，生产慎用 |
| `local` PV | 随节点 | 本地 SSD、高性能数据库 |
| `configMap` | 随对象 | 配置文件 |
| `secret` | 随对象 | 证书、密码 |
| `projected` | 随 Pod | 合并 Secret/ConfigMap/Downward API/SA token |
| `persistentVolumeClaim` | 独立于 Pod | 数据库、持久化数据 |
| `csi`（inline） | 由驱动决定 | 临时/特殊 CSI 卷 |
| `ephemeral` | 随 Pod | 自动创建 PVC 的临时卷 |

```yaml
volumes:
- name: cache
  emptyDir:
    medium: Memory
    sizeLimit: 512Mi
- name: config
  configMap:
    name: app-config
- name: data
  persistentVolumeClaim:
    claimName: app-data
```

说明：

- `emptyDir` 在容器重启时保留，Pod 删除时清理；`medium: Memory` 用内存，受 `sizeLimit` 限制
- `hostPath` 与节点强绑定，Pod 漂移后数据不跟随，且有安全风险
- `local` PV 通过 nodeAffinity 绑定节点，适合本地 SSD
- `projected` 可把多个来源合并到一个目录
- generic ephemeral volume 用 `ephemeral.volumeClaimTemplate` 自动创建 PVC，Pod 删除时清理

# PV 与 PVC

- **PV**：集群级资源，描述一块实际存储（容量、访问模式、回收策略、后端类型）
- **PVC**：命名空间级请求，描述需要多大、什么访问模式
- **绑定**：PVC 与 PV 一对一绑定；绑定后 PV 被该 PVC 独占

![PV/PVC/StorageClass](https://kubernetes.io/images/blog/2018-07-12-resizing-persistent-volumes-using-kubernetes/pvc-storageclass.png)

*图 1：PVC、PV 与 StorageClass 的关系（Kubernetes 官方博客）*

## 绑定方式

- **动态供给**：PVC 指定 StorageClass，provisioner 创建 PV
- **静态绑定**：管理员先创建 PV，PVC 通过容量/访问模式/selector 匹配
- **指定 PV**：PVC 用 `volumeName` 直接绑定某个 PV
- **预留 PV**：PV 用 `claimRef` 预留某个 PVC，避免被其他 PVC 抢走

静态 PV 示例：

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: data-pv
spec:
  capacity:
    storage: 100Gi
  accessModes: ["ReadWriteOnce"]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  nfs:
    server: 10.0.0.10
    path: /data/nfs
```

PVC 指定：

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: manual
  volumeName: data-pv
  resources:
    requests:
      storage: 100Gi
```

## 生命周期

PVC 状态：

- `Pending`：还没有绑定 PV
- `Bound`：已绑定
- `Lost`：绑定的 PV 不存在

PV 状态：

- `Available`：可用
- `Bound`：已绑定
- `Released`：PVC 已删除，但 PV 还未回收
- `Failed`：回收失败

回收策略：

- `Delete`：删除 PV 和后端存储（动态 PV 常见默认）
- `Retain`：保留 PV 和后端数据，需要手工清理
- `Recycle`：已废弃，不要使用

## 保护机制

- PVC 有 `kubernetes.io/pvc-protection` finalizer，正在被 Pod 使用时不会被删除
- PV 有 `kubernetes.io/pv-protection` finalizer，绑定期间不会被删除
- 删除 PVC 后，PV 进入 `Released`，是否删除取决于 `reclaimPolicy`
- 删除 Namespace 会删除 PVC；PV 是否删除取决于 reclaimPolicy

## 绑定细节

- PVC 一旦绑定，通常不能改 `storageClassName`/`volumeName`
- 静态 PV 的容量、访问模式、selector 必须匹配
- `claimRef` 可以预留 PV，防止被其他 PVC 绑定
- 动态供给下，PVC 的 `storageClassName` 为空字符串表示禁用动态供给
- 没有默认 StorageClass 时，PVC 可能一直 Pending

# StorageClass

StorageClass 描述“用什么驱动、什么参数”创建 PV：

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
mountOptions:
- noatime
```

关键字段：

- `provisioner`：CSI 驱动名称，例如 `ebs.csi.aws.com`、`pd.csi.storage.gke.io`、`nfs.csi.k8s.io`；旧的 `kubernetes.io/*` 仅用于历史兼容
- `parameters`：驱动特定参数（类型、IOPS、吞吐、加密、文件系统）
- `reclaimPolicy`：`Delete` 或 `Retain`
- `volumeBindingMode`：`Immediate` 或 `WaitForFirstConsumer`
- `allowVolumeExpansion`：允许扩容 PVC
- `mountOptions`：文件系统挂载参数
- `allowedTopologies`：限制可用区/区域

默认 StorageClass：

- 用注解 `storageclass.kubernetes.io/is-default-class: "true"`
- 多个默认类时以最近创建的为准，生产只保留一个
- 删除默认类前先确认没有 PVC 依赖

`volumeBindingMode`：

- `Immediate`：PVC 创建后立即创建 PV，可能造成拓扑不匹配
- `WaitForFirstConsumer`：等 Pod 调度后再创建 PV，推荐用于云盘/本地盘

# CSI 深挖

CSI（Container Storage Interface）是 Kubernetes 与存储系统的标准接口。生产存储统一使用 CSI。

## 控制器与节点插件

CSI 驱动通常分两部分：

- **Controller 插件**：Deployment/StatefulSet，负责创建/删除卷、Attach/Detach、扩容、快照
- **Node 插件**：DaemonSet，负责 NodeStage/NodePublish、格式化、挂载

sidecar：

- **external-provisioner**：创建/删除 PV
- **external-attacher**：ControllerPublish/ControllerUnpublish
- **external-resizer**：扩容
- **external-snapshotter**：快照
- **node-driver-registrar**：在节点注册驱动
- **livenessprobe**：健康检查
- **external-health-monitor**：卷健康监控（可选）

## 核心对象

- **CSIDriver**：描述驱动能力
  - `attachRequired`
  - `podInfoOnMount`
  - `volumeLifecycleModes`（Persistent/Ephemeral）
  - `storageCapacity`
  - `fsGroupPolicy`（None/File/ReadWriteOnceWithFSType）
  - `requiresRepublish`
- **CSINode**：节点上的驱动和拓扑
- **VolumeAttachment**：卷挂载到哪个节点，包含 attached/attachError/detachError
- **CSIStorageCapacity**：容量感知调度

## Attach / Mount 流程

1. PVC 触发动态供给，external-provisioner 创建 PV；PV controller 完成绑定
2. attach/detach controller 创建 VolumeAttachment
3. external-attacher 调用 CSI `ControllerPublishVolume`
4. kubelet 在节点上调用 CSI `NodeStageVolume`（格式化/挂载到全局目录）
5. kubelet 调用 `NodePublishVolume`（bind mount 到 Pod 目录）
6. Pod 删除时反向执行

排查时按这个链路逐段看：

```bash
kubectl get pv,pvc,volumeattachment
kubectl describe volumeattachment <name>
kubectl get csinode <node> -o yaml
kubectl get csidriver
kubectl logs -n <csi-ns> deploy/<controller>
kubectl logs -n <csi-ns> ds/<node-plugin>
```

## in-tree 与 CSI Migration

- 旧 in-tree 存储插件已逐步迁移到 CSI
- 新集群不要再用 in-tree provisioner
- 迁移后的 StorageClass 使用 CSI 驱动名
- 升级时要确认 CSI 驱动版本和 Kubernetes 版本兼容

## 容量感知调度

`CSIStorageCapacity` 让调度器知道某个拓扑域还有多少容量，避免把 Pod 调度到没容量的存储池。需要驱动支持并开启 `storageCapacity`。

# 访问模式与挂载语义

## 访问模式

| 模式 | 缩写 | 含义 |
| --- | --- | --- |
| ReadWriteOnce | RWO | 单节点读写 |
| ReadOnlyMany | ROX | 多节点只读 |
| ReadWriteMany | RWX | 多节点读写 |
| ReadWriteOncePod | RWOP | 单 Pod 读写，仅 CSI 支持 |

注意：

- RWO 是“单节点”，不是“单 Pod”；同一节点多个 Pod 仍可能同时挂载
- 需要严格单 Pod 独占时用 RWOP
- 访问模式是能力声明，最终由 CSI/存储后端执行
- 不是所有驱动都支持 RWX

## 块设备 vs 文件系统

- `volumeMode: Filesystem`：默认，Kubernetes 负责格式化/挂载
- `volumeMode: Block`：把裸块设备给容器，应用自己管理文件系统

```yaml
spec:
  volumeMode: Block
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 100Gi
```

块设备适合数据库、分布式存储；普通应用优先文件系统模式。

## fsGroup

```yaml
securityContext:
  fsGroup: 10001
  fsGroupChangePolicy: OnRootMismatch
```

- `fsGroup` 让卷的属组匹配 Pod
- `fsGroupChangePolicy`：`Always` 或 `OnRootMismatch`
- 不是所有 CSI 驱动都支持；看 `CSIDriver.fsGroupPolicy`
- NFS 等共享存储可能由后端 squash 决定，不只靠 fsGroup

## SELinux / mount options

- SELinux 环境需要正确标签，否则挂载失败
- `mountOptions` 由 StorageClass 或 PV 指定
- 常用：`noatime`、`discard`、`nodiratime`
- 不要用 `nobarrier` 关闭一致性保护

# 快照、克隆与备份

## 快照

快照依赖 VolumeSnapshot CRD，通常需要单独安装：

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: data-snapshot
spec:
  volumeSnapshotClassName: csi-snapclass
  source:
    persistentVolumeClaimName: data
```

相关对象：

- `VolumeSnapshot`：命名空间级快照请求
- `VolumeSnapshotContent`：集群级快照内容
- `VolumeSnapshotClass`：驱动和删除策略

`deletionPolicy`：

- `Delete`：删除 VolumeSnapshot 时删除后端快照
- `Retain`：保留后端快照

## 恢复

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-restored
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: standard
  dataSource:
    kind: VolumeSnapshot
    name: data-snapshot
    apiGroup: snapshot.storage.k8s.io
  resources:
    requests:
      storage: 20Gi
```

注意：

- 恢复的 PVC 容量不能小于快照的 `restoreSize`
- 快照和 PVC 通常要在同一命名空间
- 跨命名空间恢复需要预置 VolumeSnapshotContent 或复制流程
- 应用一致性：数据库先做一致性快照或逻辑备份

## 克隆

PVC 克隆：

```yaml
spec:
  dataSource:
    kind: PersistentVolumeClaim
    name: data
  resources:
    requests:
      storage: 20Gi
```

- 需要 CSI 驱动支持
- 源 PVC 和目标 PVC 通常同命名空间
- 克隆是存储层操作，不保证应用一致性

## 备份

- 快照不是备份：同存储系统，误删/区域故障可能一起丢
- 备份要跨区域、加密、可恢复
- 数据库用逻辑备份 + 物理备份 + binlog/PITR
- 用 Velero 等工具编排 PVC 备份和恢复
- 定期恢复演练，验证 RTO/RPO

# 扩容

## 扩容 PVC

```bash
kubectl patch pvc data -p '{"spec":{"resources":{"requests":{"storage":"30Gi"}}}}'
```

前提：

- StorageClass `allowVolumeExpansion: true`
- CSI 驱动支持扩容
- 文件系统支持在线扩容

状态：

- `Resizing`：正在扩容
- `FileSystemResizePending`：等待节点扩容文件系统
- `NodeResizeError`：节点扩容失败

## 在线 vs 离线

- 块存储扩容通常需要先扩后端卷，再扩文件系统
- ext4/XFS 支持在线扩容（XFS 只能扩）
- 某些驱动需要重启 Pod 完成文件系统扩容
- 缩容通常不支持；不要原地缩容

## 失败处理

- 看 PVC events 和 CSI controller 日志
- 确认后端卷已扩容
- 确认节点上的文件系统已扩容
- 必要时手工触发 kubelet 重试或重启 Pod

# StatefulSet 存储

```yaml
volumeClaimTemplates:
- metadata:
    name: data
  spec:
    accessModes: ["ReadWriteOnce"]
    storageClassName: standard
    resources:
      requests:
        storage: 20Gi
```

特点：

- 每个 Pod 一个 PVC，命名 `<template>-<statefulset>-<ordinal>`
- Pod 重建后复用原 PVC
- 缩容时 PVC 默认保留
- 删除 StatefulSet 时 PVC 默认保留

`persistentVolumeClaimRetentionPolicy`：

```yaml
persistentVolumeClaimRetentionPolicy:
  whenDeleted: Retain
  whenScaled: Retain
```

- `Retain`：保留 PVC
- `Delete`：自动删除 PVC
- 生产默认保留，避免误删数据
- 恢复时要确认 PVC 和 PV 的绑定关系

# 调度与拓扑

云盘/本地盘通常绑定可用区或节点：

```yaml
volumeBindingMode: WaitForFirstConsumer
allowedTopologies:
- matchLabelExpressions:
  - key: topology.kubernetes.io/zone
    values: ["us-east-1a", "us-east-1b"]
```

- `WaitForFirstConsumer`：Pod 调度后再创建/绑定 PV
- `Immediate`：先创建 PV，可能和 Pod 调度冲突
- local PV 用 nodeAffinity 绑定节点
- 多可用区集群要确保 StorageClass 和节点池匹配
- 拓扑不匹配的典型错误：Pod Pending、attach 失败、mount 失败

# 性能

- 块存储适合数据库和低延迟；文件存储适合共享读、内容目录
- 关注 IOPS、吞吐、队列深度和尾延迟，不只看平均值
- 数据库避免多个 Pod 同时写同一个 RWO/RWX 卷
- 文件系统、块大小、mount options 会影响性能
- 本地 SSD 性能好但生命周期跟节点绑定
- 用 fio 等工具做基准测试，记录基线
- 注意 CSI 驱动的缓存/直写策略
- 大量小文件关注 inode 和元数据性能
- RWX 文件存储注意锁、一致性和网络延迟

# 安全

- CSI node 插件通常需要较高权限，限制 namespace/RBAC
- 不要把 `hostPath` 当持久化方案
- Secret/ConfigMap 挂载注意权限和只读
- 启用 etcd 静态加密，保护 Secret
- 快照可能包含敏感数据，限制访问和跨区域复制
- 多租户限制可用 StorageClass 和容量
- 审计 PVC/PV/VolumeSnapshot 的创建和删除
- 使用加密 StorageClass（云盘/KMS）
- 备份加密，密钥独立管理

# 排障

## PVC 一直 Pending

- 是否有默认 StorageClass
- provisioner 是否正常
- 容量/访问模式是否满足
- `WaitForFirstConsumer` 时是否还没有 Pod 使用
- 拓扑/可用区是否匹配
- ResourceQuota 是否限制

```bash
kubectl describe pvc <pvc>
kubectl get storageclass
kubectl get pods -n <csi-namespace>
kubectl get events -n <ns> --sort-by=.lastTimestamp
```

## Attach/Detach 失败

```bash
kubectl get volumeattachment
kubectl describe volumeattachment <name>
kubectl logs -n <csi-ns> deploy/<controller>
```

常见原因：

- 卷已挂到其他节点（Multi-Attach）
- 旧节点未卸载
- 云盘/存储后端状态异常
- CSI controller 不可用
- 节点 NotReady

## Mount 失败

- 文件系统损坏
- 设备路径不存在
- 权限/SELinux
- 网络存储不可达
- kubelet/CSI node 插件异常

```bash
kubectl describe pod <pod>
kubectl logs -n kube-system <kubelet-pod>  # 如果以 Pod 运行
journalctl -u kubelet -f
```

## 扩容卡住

- StorageClass 未允许扩容
- CSI resizer 未运行
- 后端卷已扩，文件系统未扩
- `FileSystemResizePending` 需要节点操作
- 事件和 CSI 日志

## 快照/恢复失败

- VolumeSnapshotClass 不存在
- CSI snapshotter 未运行
- 快照未 `readyToUse`
- 恢复容量小于 `restoreSize`
- 跨命名空间/跨区域限制

## 数据丢失风险

- `reclaimPolicy: Delete` 时删除 PVC 会删后端存储
- StatefulSet 的 PVC 默认不随 Pod 删除
- 删除 Namespace 会删除 PVC；PV 是否删除取决于 reclaimPolicy
- 快照未做恢复演练
- 误删 PV/PVC 后不要急着手工删后端卷

# 企业实践

## StorageClass 设计

按性能和成本分层：

- `standard`：普通云盘/HDD，成本低
- `ssd`：通用 SSD
- `high-iops`：数据库、消息队列等低延迟场景
- `archive`：冷数据、备份

设计要点：

- 默认类只保留一个
- 关键数据 `reclaimPolicy: Retain`
- 默认 `WaitForFirstConsumer`
- 需要扩容时 `allowVolumeExpansion: true`
- 统一 `mountOptions`
- 用 ResourceQuota 限制容量和 PVC 数量
- 多租户限制可用 StorageClass

## CSI 选型

- 块存储还是文件存储，是否需要 RWX
- IOPS、吞吐、延迟和稳定性
- 是否支持快照、克隆、扩容、加密
- 是否支持拓扑感知和多可用区
- 是否支持在线扩容和文件系统扩容
- 多租户隔离和配额能力
- 商业支持、升级路径和故障处理资料
- 与 Kubernetes 版本的兼容性

## 数据保护

- 3-2-1：至少 3 份、2 种介质、1 份异地
- 快照不是备份
- 数据库用应用一致性备份
- 关键 PVC 跨区域复制
- 备份加密，密钥独立管理
- 定期恢复演练，验证 RTO/RPO
- 明确保留策略

## 容量与配额

- 用 `requests.storage` 限制 Namespace 总量
- 用 `count/persistentvolumeclaims` 限制 PVC 数量
- 监控 PVC 使用率、inode、IOPS、吞吐、延迟
- 扩容前确认 StorageClass/CSI/文件系统支持
- 定期清理未使用 PVC、Released PV、孤儿快照
- 容量告警留出扩容时间

## 运维

- 监控 CSI controller/node、VolumeAttachment、快照任务
- 关注多挂载、挂载超时、文件系统损坏、卸载失败
- CSI 升级前确认兼容性和回滚
- 节点维护前确认卷能安全迁移
- 定期检查卷健康和后端容量
- 把备份、恢复、扩容、故障处理写成 runbook

## 常见坑

- 删除 PVC 时 `reclaimPolicy: Delete` 会删后端数据
- 删除 Namespace 会删 PVC，动态 PV 可能随后被删除
- RWO 不是“单 Pod”
- RWX 多写需要应用处理锁和一致性
- 多默认 StorageClass 行为不可控
- 快照没做恢复演练
- 忽略 inode 和文件系统限制
- 使用未固定版本的第三方 provisioner 镜像

# 附录

## 常用命令

```bash
# 查看
kubectl get pv,pvc,storageclass,volumeattachment -A
kubectl get volumesnapshot,volumesnapshotcontent -A
kubectl get csidriver,csistoragecapacity -A
kubectl describe pvc <pvc> -n <ns>
kubectl describe pv <pv>
kubectl describe volumeattachment <name>

# 扩容
kubectl patch pvc <pvc> -n <ns> -p '{"spec":{"resources":{"requests":{"storage":"30Gi"}}}}'

# 快照
kubectl get volumesnapshot -n <ns>
kubectl describe volumesnapshot <name> -n <ns>

# CSI
kubectl get pods -n <csi-ns>
kubectl logs -n <csi-ns> deploy/<controller>
kubectl logs -n <csi-ns> ds/<node-plugin>
```

## 官方参考

- [Volumes](https://kubernetes.io/docs/concepts/storage/volumes/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [Dynamic Provisioning](https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/)
- [CSI](https://kubernetes.io/docs/concepts/storage/volumes/#csi)
- [Volume Snapshots](https://kubernetes.io/docs/concepts/storage/volume-snapshots/)
- [Volume Expansion](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#expanding-persistent-volumes-claims)
- [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Storage Capacity](https://kubernetes.io/docs/concepts/storage/storage-capacity/)

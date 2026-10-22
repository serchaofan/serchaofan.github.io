---
title: Kubernetes共享存储
tags: [Kubernetes, 存储, PV, CSI]
date: 2020-04-05 19:06:54
categories: [Kubernetes]
comments: false
---

本文基于 Kubernetes v1.37 官方文档重写，讲清 Volume、PV/PVC、StorageClass、CSI、快照、扩容和常见故障。旧笔记中的 in-tree provisioner、`kubernetes.io/*`、`--admission-control` 等内容已过时，不再作为操作依据。

<!--more-->

- [存储模型](#%E5%AD%98%E5%82%A8%E6%A8%A1%E5%9E%8B)
- [Volume](#volume)
- [PV 与 PVC](#pv-%E4%B8%8E-pvc)
- [StorageClass 与动态供给](#storageclass-%E4%B8%8E%E5%8A%A8%E6%80%81%E4%BE%9B%E7%BB%99)
- [CSI](#csi)
- [快照与恢复](#%E5%BF%AB%E7%85%A7%E4%B8%8E%E6%81%A2%E5%A4%8D)
- [扩容与拓扑](#%E6%89%A9%E5%AE%B9%E4%B8%8E%E6%8B%93%E6%89%91)
- [NFS 示例](#nfs-%E7%A4%BA%E4%BE%8B)
- [排障](#%E6%8E%92%E9%9A%9C)
- [企业实践](#%E4%BC%81%E4%B8%9A%E5%AE%9E%E8%B7%B5)

# 存储模型

Kubernetes 存储分三层：

1. **Volume**：Pod 级别的挂载点，定义在 Pod spec 中
2. **PV/PVC**：集群级存储资源与命名空间级请求
3. **StorageClass + CSI**：动态创建 PV 的模板和驱动

容器可写层不适合放持久化数据；数据库、日志、文件上传等应使用 Volume 或 PVC。

# Volume

常见 Volume 类型：

| 类型 | 生命周期 | 典型场景 |
| --- | --- | --- |
| `emptyDir` | 随 Pod | 临时缓存、容器间共享文件 |
| `hostPath` | 随节点 | 节点代理、日志采集，生产慎用 |
| `configMap` | 随对象 | 配置文件 |
| `secret` | 随对象 | 证书、密码 |
| `projected` | 随 Pod | 合并 Secret/ConfigMap/Downward API/SA token |
| `persistentVolumeClaim` | 独立于 Pod | 数据库、持久化数据 |
| `nfs` | 独立于 Pod | 共享文件 |
| `csi` | 由驱动决定 | 云盘、文件存储、对象存储 |

```yaml
volumes:
- name: cache
  emptyDir: {}
- name: config
  configMap:
    name: app-config
- name: data
  persistentVolumeClaim:
    claimName: app-data
```

`emptyDir` 在容器重启时保留，Pod 删除时清理；`hostPath` 与节点强绑定，Pod 漂移后数据不跟随。

# PV 与 PVC

- **PV**：集群级资源，描述一块实际存储（容量、访问模式、回收策略、后端类型）
- **PVC**：命名空间级请求，描述需要多大、什么访问模式
- **绑定**：PVC 与 PV 一对一绑定；绑定后 PV 被该 PVC 独占

![PV/PVC/StorageClass](https://kubernetes.io/images/blog/2018-07-12-resizing-persistent-volumes-using-kubernetes/pvc-storageclass.png)

*图 1：PVC、PV 与 StorageClass 的关系（Kubernetes 官方博客）*

## 访问模式

| 模式 | 缩写 | 含义 |
| --- | --- | --- |
| ReadWriteOnce | RWO | 单节点读写 |
| ReadOnlyMany | ROX | 多节点只读 |
| ReadWriteMany | RWX | 多节点读写 |
| ReadWriteOncePod | RWOP | 单 Pod 读写，仅 CSI 支持 |

注意：RWO 是“单节点”，不是“单 Pod”。同一节点上的多个 Pod 仍可能同时挂载同一个 RWO 卷。需要严格单 Pod 独占时用 RWOP。

访问模式是能力声明，最终由 CSI/存储后端执行；不是所有驱动都支持 RWX。

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

# StorageClass 与动态供给

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
```

- `provisioner` 填 CSI 驱动名称，例如 `ebs.csi.aws.com`、`pd.csi.storage.gke.io`、`nfs.csi.k8s.io`；旧的 `kubernetes.io/*` 仅用于历史兼容
- `volumeBindingMode: WaitForFirstConsumer`：等 Pod 调度后再创建 PV，避免可用区不匹配
- `allowVolumeExpansion: true`：允许扩容 PVC
- 默认 StorageClass 用注解标记；多个默认类时以最近创建的为准，生产应只保留一个

PVC 指定 StorageClass：

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: standard
  resources:
    requests:
      storage: 20Gi
```

不写 `storageClassName` 时使用默认类；写 `storageClassName: ""` 表示不使用动态供给，走静态绑定。

# CSI

生产存储统一使用 CSI（Container Storage Interface）。CSI 驱动通常由以下 sidecar 组成：

- **external-provisioner**：创建/删除 PV
- **external-attacher**：ControllerPublish/ControllerUnpublish
- **external-resizer**：扩容
- **external-snapshotter**：快照
- **node-driver-registrar**：在节点注册驱动
- **livenessprobe**：健康检查

相关对象：

- `CSIDriver`：描述驱动能力，例如 `attachRequired`、`podInfoOnMount`、`volumeLifecycleModes`、`storageCapacity`、`fsGroupPolicy`；快照能力由 CSI 驱动和 `VolumeSnapshotClass` 决定，不在 `CSIDriver` 中声明
- `CSINode`：描述节点上的驱动和拓扑
- `VolumeAttachment`：描述卷挂载到哪个节点

in-tree 存储插件已逐步迁移到 CSI，新集群不要再用 in-tree provisioner。

# 快照与恢复

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

恢复：

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

快照不是备份的完整替代：还需要考虑跨区域复制、应用一致性（数据库应先做一致性快照或逻辑备份）和恢复演练。

# 扩容与拓扑

## 扩容 PVC

```bash
kubectl patch pvc data -p '{"spec":{"resources":{"requests":{"storage":"30Gi"}}}}'
```

前提：

- StorageClass `allowVolumeExpansion: true`
- CSI 驱动支持扩容
- 文件系统扩容有时需要重启 Pod 或等待 kubelet 完成

## 拓扑感知

云盘通常绑定可用区。使用 `WaitForFirstConsumer` 可以让 PV 在 Pod 调度后创建，避免“Pod 调度到 A 区，PV 在 B 区”导致挂载失败。

```yaml
volumeBindingMode: WaitForFirstConsumer
allowedTopologies:
- matchLabelExpressions:
  - key: topology.kubernetes.io/zone
    values: ["us-east-1a", "us-east-1b"]
```

# NFS 示例

推荐使用 CSI NFS driver；旧版 `nfs-subdir-external-provisioner` 仍可用，但新集群优先 CSI。

StorageClass：

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs
provisioner: nfs.csi.k8s.io
parameters:
  server: 10.0.0.10
  share: /data/nfs
reclaimPolicy: Retain
volumeBindingMode: Immediate
```

静态 NFS PV：

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-pv
spec:
  capacity:
    storage: 100Gi
  accessModes: ["ReadWriteMany"]
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 10.0.0.10
    path: /data/nfs
```

NFS 注意事项：

- RWX 下多客户端并发写需要应用自己处理锁和一致性
- `hard` mount 可能导致客户端永久阻塞，`soft` mount 可能丢数据，按业务权衡
- NFS 版本、MTU、防火墙和 DNS 都要确认
- 生产建议使用支持快照和扩容的 CSI NFS 驱动

# 排障

## PVC 一直 Pending

- 是否有默认 StorageClass
- provisioner 是否正常
- 容量/访问模式是否满足
- `volumeBindingMode: WaitForFirstConsumer` 时是否还没有 Pod 使用
- 拓扑/可用区是否匹配

```bash
kubectl describe pvc <pvc>
kubectl get storageclass
kubectl get pods -n <csi-namespace>
kubectl get events -n <ns> --sort-by=.lastTimestamp
```

## 多节点挂载失败

- RWO 卷被其他节点挂载
- 文件系统损坏或未卸载干净
- 云盘仍挂载在旧节点

查看 VolumeAttachment：

```bash
kubectl get volumeattachment
kubectl describe volumeattachment <name>
```

## 权限问题

- 容器 UID/GID 与存储目录属主不一致
- NFS squash 配置
- `fsGroup` 对某些 CSI 卷不生效
- `readOnlyRootFilesystem` 下应用仍试图写根目录

## 数据丢失风险

- `reclaimPolicy: Delete` 时删除 PVC 会删后端存储
- StatefulSet 的 PVC 默认不随 Pod 删除
- 删除 Namespace 会删除其中的 PVC；PV 是否删除取决于 `reclaimPolicy`：`Delete`（动态供给默认）会同时删除 PV 和后端存储，`Retain` 则保留 PV 并进入 `Released`
- 快照未做恢复演练

# 企业实践

## StorageClass 设计

按性能和成本分层，而不是所有业务共用一个类：

- `standard`：普通云盘/HDD，成本低
- `ssd`：通用 SSD
- `high-iops`：数据库、消息队列等低延迟场景
- `archive`：冷数据、备份

设计要点：

- 默认类只保留一个，多个默认类行为以最近创建者为准，容易失控
- 关键数据 `reclaimPolicy: Retain`，临时数据可以用 `Delete`
- 默认使用 `volumeBindingMode: WaitForFirstConsumer`，避免拓扑不匹配
- 需要扩容时设置 `allowVolumeExpansion: true`
- 用 `mountOptions` 统一文件系统参数
- 用 ResourceQuota 限制每个 Namespace 可用的存储总量和 PVC 数量
- 多租户场景限制可用的 StorageClass，避免越权使用高成本存储

## CSI 选型

选型要看业务，不只看“能挂载”：

- 块存储还是文件存储，是否需要 RWX
- IOPS、吞吐、延迟和稳定性
- 是否支持快照、克隆、扩容、加密
- 是否支持拓扑感知和多可用区
- 是否支持在线扩容和文件系统扩容
- 多租户隔离和配额能力
- 商业支持、升级路径和故障处理资料
- 与 Kubernetes 版本的兼容性

数据库优先块存储；共享文件、CI 缓存、内容目录可以用文件存储；对象存储不要把 PVC 当对象存储用。

## 数据保护

- 遵循 3-2-1：至少 3 份、2 种介质、1 份异地
- 快照不是备份：快照通常在同一存储系统，误删、勒索、区域故障可能一起丢失
- 数据库使用应用一致性备份（逻辑备份或一致性快照），不要只依赖卷快照
- 关键 PVC 配置跨区域复制或定期导出
- 备份加密，密钥独立管理
- 定期做恢复演练，验证 RTO/RPO
- 明确保留策略：小时/日/周/月，避免快照无限增长

## 容量与配额

- 用 `requests.storage` 限制 Namespace 总量
- 用 `count/persistentvolumeclaims` 限制 PVC 数量
- 监控 PVC 使用率、inode、IOPS、吞吐和延迟
- 扩容要确认 StorageClass 和 CSI 支持，文件系统扩容有时需要重启 Pod
- 定期清理未使用 PVC、Released PV 和孤儿快照
- 容量告警要留出扩容和迁移时间

## 性能

- 块存储适合数据库和低延迟；文件存储适合共享读、内容目录
- 关注 IOPS、吞吐、队列深度和尾延迟，不只看平均值
- 数据库避免多个 Pod 同时写同一个 RWO/RWX 卷
- 文件系统、块大小、mount options 会影响性能
- 本地 SSD 性能好但生命周期跟节点绑定，不适合持久化关键数据
- 用 fio 等工具做基准测试，记录基线

## 多租户

- 限制可用 StorageClass
- 用 ResourceQuota 限制容量和 PVC 数量
- 敏感数据启用加密和独立密钥
- 网络和访问权限隔离，避免跨 Namespace 挂载
- 明确数据归属和删除责任
- 强隔离场景考虑独立存储后端或独立集群

## 运维

- 监控 CSI controller/node 组件、VolumeAttachment 和快照任务
- 关注多挂载、挂载超时、文件系统损坏和卸载失败
- CSI 升级前确认兼容性和回滚方案
- 节点维护前确认卷是否能安全迁移
- 定期检查卷的健康状态和后端容量
- 把备份、恢复、扩容和故障处理写成 runbook

## 常见坑

- 删除 PVC 时 `reclaimPolicy: Delete` 会删后端数据
- 删除 Namespace 会删 PVC，动态 PV 可能随后被删除
- RWO 不是“单 Pod”，同一节点多个 Pod 仍可能同时挂载
- RWX 多写需要应用处理锁和一致性
- 多默认 StorageClass 行为不可控
- 快照没做恢复演练，关键时刻不可用
- 忽略 inode 和文件系统限制
- 使用未固定版本的第三方 provisioner 镜像

## 官方参考

- [Volumes](https://kubernetes.io/docs/concepts/storage/volumes/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [CSI](https://kubernetes.io/docs/concepts/storage/volumes/#csi)
- [Volume Snapshots](https://kubernetes.io/docs/concepts/storage/volume-snapshots/)
- [动态供给](https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/)

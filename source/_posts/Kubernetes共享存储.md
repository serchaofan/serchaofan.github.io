---
title: Kubernetes共享存储
tags: [Kubernetes, 存储, PV]
date: 2020-04-05 19:06:54
categories: [Kubernetes]
comments: false
---

<!--more-->

# PV

PersistentVolume 是对底层网络共享存储的抽象，将共享存储定义为一种资源，由管理员创建配置，与共享存储的具体实现直接相关，通过插件式的机制完成与共享存储的对接。

PV 主要包含以下参数的设置：

- 存储能力 `capacity`：描述存储设备具备的能力（空间大小）
- 访问模式 `accessModes`：描述用户的应用对存储资源的访问权限。访问模式有：
  - ReadWriteOnce：RWO，读写权限，只能被单个 Node 挂载
  - ReadOnlyMany：ROX，只读权限，允许被多个 Node 挂载
  - ReadWriteMany：RWX，读写权限，允许被多个 Node 挂载
- 存储卷模式 `VolumeMode`：可选 Filesystem 和 Block，默认为 Filesystem
- 存储类别 `storageClassName`：指定一个 StorageClass 资源对象名称，具有特定类别的 PV 只能和请求了该类别的 PVC 进行绑定，未设定类别的 PV 只能与不请求任何类别的 PVC 绑定。
- 回收策略 `persistentVolumeReclaimPolicy`：当从持久卷声明释放持久卷时会发生什么。可选项为：
  - Retain：保留数据，需要手动清理
  - Delete：与PV相连的后端存储完成volume的删除
- 挂载参数 `mountOptions`：需要根据后端存储的特点，进行额外的挂载参数设置。每个PV类型都有不同的挂载参数设置。
- 节点亲和性 `nodeAffinity`：设置亲和性来限制只能通过某些Node访问Volume，使用这些Volume的pod会被调度到满足条件的Node。

PV生命周期的各个阶段：
1. Availabile：可用，还未与PVC绑定
2. Bound：已与某PVC绑定
3. Released：绑定的PVC已经删除，资源已释放，但没有被集群回收
4. Failed：自动资源回收失败

# PVC
PVC作为用户对存储资源的需求申请，主要包括存储空间要求、访问模式、PV选择条件和存储类别等信息的设置。

PVC 主要包含以下参数的设置：
- 资源请求 `resources`：描述对存储的要求，目前支持存储空间大小
- 访问模式 `accessModes`：描述用户应用对存储资源的访问权限，参数与PV一致
- 存储卷模式 `volumeModes`：参数与PV一致
- PV选择条件 `selector`：通过对Label Selector设置，可使PVC对系统中已存在的PV进行筛选，系统会根据条件选出合适的PV进行绑定
- 存储类别 `storageClassName`：设定需要的后端存储类型，只有设置了该类的PV会被匹配给PVC绑定。
  PVC可以不设置存储类的要求，若设置`storageClassName=""`，则该PVC不要求特定class，系统只会选择未设置class的PV与之配对。也可以直接不设置`storageClassName`，则会根据系统是否启用名为DefaultStorageClass的admission controller进行对应操作。
  - 若未启用DefaultStorageClass，则等效于PVC设置`storageClassName=""`
  - 若启用了DefaultStorageClass，则需要有已定义的默认的storageClass，若不存在默认的storageClass，则等效于未启用DefaultStorageClass的情况；若存在默认的storageClass，则系统将自动为PVC创建一个PV，并绑定。
  > 集群管理员如何设置DefaultStorageClass：在StorageClass定义中加上一个annotation 
  > ```
  > storageclass.kubernetes.io/is-default-class=true
  > ```
  > 若管理员将多个storageClass都定义为default，则由于不唯一，系统无法为PVC创建对应PV。

PVC受限于命名空间，只有相同命名空间的PVC才能挂载到pod内。

当selector和class都进行了设置时，系统将选择两个条件同时满足的PV进行配对。

若资源供应使用的动态模式（见生命周期中描述），即管理员没有预先定义PV，仅通过storageClass交给系统自动完成PV的动态创建，则PVC再设定selector时，系统将无法为期供应任何存储资源。在启用了动态供应模式下，一旦用户删除PVC，与之绑定的PV也将根据默认回收策略Delete被删除。若需要保留PV，则在动态绑定成功后，用户需要将系统自动生产PV的回收策略从Delete变为Retain。

# 生命周期
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202207082350793.png)

资源供应：k8s支持两种资源供应模式：静态模式static、动态模式dynamic。
- 静态：集群管理员手动创建PV,在定义PV时需要将后端存储的特性进行设置。
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202207090044511.png)
- 动态：集群管理员无需手动创建PV，而是通过storageClass设置对后端存储进行描述，标记为某种类型，此时要求PVC对存储的类型进行声明，系统将自动完成PV的创建和PVC的绑定。若PVC的`Class=""`，则说明该PVC禁止使用动态模式。
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202207090052785.png)

资源绑定：在用户定义好PVC后，系统根据PVC对存储资源的请求在已存在的PV中选择一个满足PVC要求的PV，一旦找到，就将该PV与用户定义的PVC进行绑定，用户的应用就可使用这个PVC了，若系统中没有满足PVC要求的PV，则PVC会处于Pending状态直到手动创建了一个符合要求的PV。PV一旦与PVC绑定，则就被这个PVC独占，不能再与其他PVC进行绑定。在这种情况下，当PVC申请的存储空间比PV少时，整个PV的空间就都能为PVC所用，可能造成浪费。若资源供应使用动态模式，则系统在为PVC找到合适StorageClass后，将自动创建一个PV并完成与PVC的绑定。

资源使用：pod使用volume的定义，将PVC挂载到容器内的某个路径进行使用，若容器挂载一个PVC，则能被持续独占使用；若多个pod挂载同一个PVC，则需要考虑多个实例共同访问同一个存储空间的问题。

资源释放：当用户对存储资源使用完毕后，用户可以删除PVC，与该PVC绑定的PV将会被标记为已释放（Released），但此时还不能立即被其他PVC绑定，之前的PVC写的数据可能还在存储设备上，只有在清除了该PV后才能再次使用。

资源回收：只有PV存储空间完成回收，才能供信的PVC绑定和使用，

# StorageClass
StorageClass作为对存储资源的抽象，对用户设置的PVC申请屏蔽后端存储的细节，由系统自动完成PV的创建和绑定，实现动态的资源供应。

定义包含以下参数：
- provisioner；后端存储提供者。目前k8s支持的提供者都以`kubernetes.io/`开头
- parameters：后端存储提供者的参数设置，不同提供者有对应不同的参数。

设置默认的StorageClass，需要先启动DefaultStorageClass的admission controller，需要在kube-apiserver的命令行参数中`--admission-control`添加`DefaultStorageClass`。即：
```
--admission-control=...,DefaultStorageClass
```
然后在StorageClass定义中设置一个annotation
```yaml
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
```

# NFS 动态存储
> Github：https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner

nfs-client-provisioner 是一个Kubernetes的简易NFS的外部provisioner，本身不提供NFS，需要现有的NFS服务器提供存储

PV以 `${namespace}-${pvcName}-${pvName}`的命名格式提供（在NFS服务器上）
PV回收的时候以 `archieved-${namespace}-${pvcName}-${pvName}` 的命名格式（在NFS服务器上）

首先创建RBAC权限以及SA
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nfs-client-provisioner
  namespace: kube-system
---
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: nfs-client-provisioner-runner
rules:
  - apiGroups: [""]
    resources: ["persistentvolumes"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "update"]
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create", "update", "patch"]
---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: run-nfs-client-provisioner
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    namespace: kube-system
roleRef:
  kind: ClusterRole
  name: nfs-client-provisioner-runner
  apiGroup: rbac.authorization.k8s.io
---
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: leader-locking-nfs-client-provisioner
  namespace: kube-system
rules:
  - apiGroups: [""]
    resources: ["endpoints"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
---
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: leader-locking-nfs-client-provisioner
  namespace: kube-system
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    namespace: kube-system
roleRef:
  kind: Role
  name: leader-locking-nfs-client-provisioner
  apiGroup: rbac.authorization.k8s.io
```

创建StorageClass
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-storage
  annotations:
    storageclass.kubernetes.io/is-default-class: "false"  ## 是否设置为默认的storageclass
provisioner: nfs-client                                   ## 动态卷分配者名称
parameters:
  archiveOnDelete: "true"                                 ## 设置为"false"时删除PVC不会保留数据,"true"则保留数据
#mountOptions: 
#  - hard                                                  ## 指定为硬挂载方式
#  - nfsvers=4                                             ## 指定NFS版本,这个需要根据NFS Server版本号设置
```

创建nfs-client-provisioner
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nfs-client-provisioner
  namespace: kube-system
  labels:
    app: nfs-client-provisioner
spec:
  replicas: 1
  strategy: 
    type: Recreate # 设置升级策略为删除再创建(默认为滚动更新)
  selector:
    matchLabels:
      app: nfs-client-provisioner
  template:
    metadata:
      labels:
        app: nfs-client-provisioner
    spec:
      serviceAccountName: nfs-client-provisioner
      containers:
      - name: nfs-client-provisioner
        #image: gcr.io/k8s-staging-sig-storage/nfs-subdir-external-provisioner:v4.0.0
        image: registry.cn-beijing.aliyuncs.com/mydlq/nfs-subdir-external-provisioner:v4.0.0
        volumeMounts:
        - name: nfs-client-root
          mountPath: /persistentvolumes
        env:
        - name: PROVISIONER_NAME     # Provisioner的名称,对应storageclass中配置的Provisioner的名称
          value: nfs-client 
        - name: NFS_SERVER           # NFS服务器地址,需和volumes参数中配置的保持一致
          value: xx.xx.xx.xx
        - name: NFS_PATH             # NFS服务器数据存储目录,需和valumes参数中配置的保持一致
          value: /data/nfs/xxxx
      volumes:
      - name: nfs-client-root
        nfs:
          server: xx.xx.xx.xx     # NFS服务器地址
          path: /data/nfs/xxxx    # NFS服务器数据存储目录
```

> **注：在创建nfs-client-provisioner之前，必须先确认nfs服务器上指定目录是否已经导出，**
> 否则describe pod就会看到报错
> ```
> Unable to attach or mount volumes: unmounted volumes=[nfs-client-root]
> MountVolume.SetUp failed for volume "nfs-client-root"
> ```

使用volumeClaimTemplates可以不用创建pvc和pv，会自动创建
```yaml
spec:
  volumeClaimTemplates:
  - metadata:
      name: data    # 这里设置的就是pvc的名字
      annotations:
        volume.beta.kubernetes.io/storage-class: "nfs-storage"   # 指定storage-class
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 3Gi
```

因此在sts的配置中直接指定volumeMounts即可
```yaml
        volumeMounts:
        - name: data   # 直接对应volumeClaimTemplates的pvc的名字即可
          mountPath: /data
```


> 参考文章
> 
> https://jimmysong.io/kubernetes-handbook/practice/using-nfs-for-persistent-storage.html
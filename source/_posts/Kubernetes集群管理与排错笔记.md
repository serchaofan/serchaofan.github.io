---
title: Kubernetes集群管理与排错笔记
tags: [kubernetes]
date: 2020-04-05 19:06:01
categories: [Kubernetes]
comments: false
---
<!--more-->
# Node 管理
## Node 隔离与恢复
将 Node 纳入或脱离调度范围

创建 node 类型的 yaml，并设置`unschedulable: true`

```yaml
apiVersion: v1
kind: Node
metadata:
  name: kubenode2
  labels:
    kubernetes.io/hostname: kubenode2
spec:
  unschedulable: true
```

然后`kubectl replace -f`应用该配置，查看 nodes

```
# kubectl get nodes
NAME        STATUS                     ROLES    AGE   VERSION
kubenode1   Ready                      master   18d   v1.18.0
kubenode2   Ready,SchedulingDisabled   <none>   18d   v1.18.0
kubenode3   Ready                      <none>   18d   v1.18.0
```

对于后续创建的 Pod 就不会再调度到该 Node 了。
若要重新将该节点纳入调度范围，只要将该参数改为 false 并应用即可。

也可以直接通过命令`cordon`和`uncordon`进行设置

```
# kubectl cordon kubenode3
node/kubenode3 cordoned

# kubectl get nodes kubenode3
NAME        STATUS                     ROLES    AGE   VERSION
kubenode3   Ready,SchedulingDisabled   <none>   18d   v1.18.0

# kubectl uncordon kubenode3
node/kubenode3 uncordoned
```

## Node 扩容

只需在新的 Node 上安装 docker、kubelet 和 kube-proxy，并配置启动参数，将 Master URL 指定为当前 k8s 集群 master 的地址。通过 kubelet 默认注册机制，新的 node 就会自动加入到 k8s 集群中。

# 更新 Label

创建一个 deployment，标签为`app=nginx`

```
# kubectl get pods --show-labels
NAME                            READY   STATUS    RESTARTS   AGE     LABELS
nginx-deploy-5bf87f5f59-6r67l   1/1     Running   0          2m24s   app=nginx,pod-template-hash=5bf87f5f59
nginx-deploy-5bf87f5f59-lt6v2   1/1     Running   0          2m24s   app=nginx,pod-template-hash=5bf87f5f59
nginx-deploy-5bf87f5f59-sqrs6   1/1     Running   0          2m24s   app=nginx,pod-template-hash=5bf87f5f59
```

可通过`-L<label_name>`查看指定标签的值

```
# kubectl get pods -Lapp
NAME                            READY   STATUS    RESTARTS   AGE     APP
nginx-deploy-5bf87f5f59-6r67l   1/1     Running   0          3m26s   nginx
nginx-deploy-5bf87f5f59-lt6v2   1/1     Running   0          3m26s   nginx
nginx-deploy-5bf87f5f59-sqrs6   1/1     Running   0          3m26s   nginx
```

若要更新标签，则通过`kubectl label`进行修改

```
# kubectl get deployments.apps --show-labels
NAME           READY   UP-TO-DATE   AVAILABLE   AGE     LABELS
nginx-deploy   3/3     3            3           8m10s   app=nginx_1.17
```

若要删除该标签，则通过`<label_name>-`即可

```
# kubectl label deployments.apps nginx-deploy app-
deployment.apps/nginx-deploy labeled

# kubectl get deployments.apps --show-labels
NAME           READY   UP-TO-DATE   AVAILABLE   AGE     LABELS
nginx-deploy   3/3     3            3           9m22s   <none>
```

# Namespace

K8s 通过命名空间和 Context 设置对不同工作组进行区分，使得它们互不干扰。

namespace 的创建

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dev
```

context 运行环境的创建

```yaml
# 创建集群
# kubectl config set-cluster nginx-cluster-1 --server=http://192.168.60.3:8080
Cluster "nginx-cluster-1" set.

# 配置运行环境
# kubectl config set-context dev --namespace=dev --cluster=nginx-cluster-1 --user=dev
Context "dev" created.

# 查看已定义的context
# kubectl config view
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: DATA+OMITTED
    server: https://192.168.60.3:6443
  name: kubernetes
- cluster:
    server: http://192.168.60.3:8080
  name: nginx-cluster-1
contexts:
- context:
    cluster: nginx-cluster-1
    namespace: dev
    user: dev
  name: dev
- context:
    cluster: kubernetes
    user: kubernetes-admin
  name: kubernetes-admin@kubernetes
current-context: kubernetes-admin@kubernetes
kind: Config
preferences: {}
users:
- name: kubernetes-admin
  user:
    client-certificate-data: REDACTED
    client-key-data: REDACTED
```

`kubectl config`会在`${HOME}/.kube/`下生成一个名为 config 的文件，内容就是以上`kubectl config view`的内容。

若要将工作组设置在指定 context 环境下工作，则通过`kubectl config use-context`指定

```
# kubectl config use-context dev
Switched to context "dev".
```

此后创建的资源都使用的是该环境。

# 资源管理

若对于 Pod 不定义 CPU Request 和 Memory Request，则 K8s 会认为该 Pod 所需资源很少，可调度到任意可用 Node 上，当集群的计算资源不充足时，就会使某个 Node 资源严重不足。为了避免系统挂掉，Node 会自动清理 pod 释放资源，但有的 Pod 十分重要，无论资源是否充足，也要保障 这些 Pod 的存活。对此 K8s 有以下保障机制：

- 通过资源配额确保不同 Pod 只占用指定资源
- 允许集群的资源被超额分配，提高资源利用率
- 为 Pod 分级，确保不同等级 Pod 有不同的 QoS。资源不足时低等级的 Pod 被清理以确保高等级 Pod 正常运行。

```yaml
spec:
  containers:
    - name: myapp
      image: <Image>
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
        requests:
          cpu: "20m"
          memory: "55M"
```

CPU的资源值是绝对值，不是相对值，比如0.1CPU在单核或多核机器上都是一样的，都严格等于0.1CPU core。

内存的资源值计量单位为字节数，值的表示方式为`整数+国际单位制`

国际单位制包含两类：
- 十进制：E、P、T、G、M、K、m
- 二进制：Ei、Pi、Ti、Gi、Mi、Ki

CPU只能使用十进制的m单位或者不加单位，m表示千分之一单位，即`200m`表示0.2 cpu core。

对于内存，十进制和二进制区别如下：
- 1 KB (KiloByte) = 1000 Bytes = 8000 Bits
- 1 KiB (KibiByte) = 1024 Bytes = 8192 Bits

Pod的requests和limits是这个pod中所有容器的requests和limits的总和，例如：
```yaml
spec:
  containers:
    - name: myapp1
      image: <Image>
      resources:
        limits:
          memory: "200Mi"
          cpu: "200m"
        requests:
          cpu: "100m"
          memory: "100Mi"
    - name: myapp2
      image: <Image>
      resources:
        limits:
          memory: "200Mi"
          cpu: "200m"
        requests:
          cpu: "100m"
          memory: "100Mi"
```
则这个Pod的CPU总体requests为200m，limits为400Mi，内存同理。

## Pod的QoS服务质量
根据指定资源requests与limits的不同，创建的Pod会有三个不同的QoS（服务质量）属性。K8S提供三种QoS类，并使用QoS类决定Pod的调度与驱逐策略。
- Guaranteed 有保证
- Burstable 不稳定
- BestEffort 尽最大努力


对于 QoS 类为 Guaranteed 的 Pod：
**Pod 中的每个容器都必须指定CPU与内存的`limits`和`requests`，且`limits=requests`。**
```yaml
spec:
  containers:
    - name: myapp
      image: <Image>
      resources:
        limits:
          cpu: "1"
          memory: "1Gi"
        requests:
          cpu: "1"
          memory: "1Gi"
```
查看pod的status
```
#kubectl get po -oyaml xxxx
......
status:
  qosClass: Guaranteed
```

对于 QoS 类为 Burstable 的 Pod：
**Pod 不符合Guaranteed标准，且Pod 中至少一个容器具有内存或CPU的请求或限制。**
```yaml
spec:
  containers:
    - name: myapp
      image: <Image>
      resources:
        limits:
          cpu: "2"
          memory: "2Gi"
        requests:
          cpu: "1"
          memory: "1Gi"
或
      resources:
        limits:
          memory: "2Gi"
        requests:
          memory: "1Gi"
```
查看pod的status
```
#kubectl get po -oyaml xxxx
......
status:
  qosClass: Burstable
```

对于 QoS 类为 BestEffort 的 Pod：
**Pod 中的容器必须没有设置内存和 CPU 限制或请求。**
```yaml
spec:
  containers:
    - name: myapp
      image: <Image>
```
查看pod的status
```
#kubectl get po -oyaml xxxx
......
status:
  qosClass: BestEffort
```

K8S根据QoS进行的回收策略：
- 当Pod出现资源不足情况时，先会杀死优先级低的pod，而优先级是通过OOM分数值来实现，范围为0-1000。OOM分数值根据`OOM_ADJ`参数计算得出。
- Guaranteed的Pod，`OOM_ADJ`值为`-998`
- BestEffort的pod，`OOM_ADJ`值为`1000`
- Burstable的pod，`OOM_ADJ`值范围为`2~999`
- `OOM_ADJ`值越大，Pod优先级越低，出现资源不足时会被优先kill掉。
- 对于docker、kubelet等k8s的保留资源，`OOM_ADJ`值设置成了`-999`，即不会被OOM kill干掉。
- 也就是说，当资源不足时，最先被kill掉的是BestEffort的pod，最晚被安排Kill掉的是Guaranteed的pod
- 若资源充足，且想要提高资源利用率，资源限制按照Guaranteed配置。

## LimitRange
LimitRange用于设置容器的默认资源限制，就是说当pod未设置limits或requests时，则会采用limitrange定义的限制值。

LimitRang支持两种type，一种为container，一种为pod。其中，pod与container都可以设置`min`、`max`、`maxLimitRequestRatio`参数，container可以设置`default`和`defaultRequest`参数，而Pod不可以。

对以上几个参数的解释：
- `min`指的是`requests`的下限，`max`指的是`limits`的上限。若是在container中指定的，则是每个容器的，若是pod中指定的，则是pod中所有容器的总和。`min`和`max`指的就不是默认值了，而是真正的限制，若容器或pod的资源设置超过min和max的范围，则pod根本不会启动，就是`kubectl get pod`找不到这个pod。
- 对于同一资源类型，必须满足：`min <= default <= defaultRequest <= max`
- container的`maxLimitRequestRatio`限制的是pod中所有容器的limits值与requests值的比例上限，若是pod则是pod中所有容器的limits值与requests**值的总和**的比例上限。

例如先创建一个LimitRange类型的资源，设置默认资源限制，内存的`requests=256Mi`，`limits=512Mi`

，以下展示两种类型。
```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: mem-limit-range-container
spec:
  limits:
  - default:
      memory: 512Mi
    defaultRequest:
      memory: 256Mi
    type: Container

# kubectl describe limitranges
Name:       mem-limit-range-container
Namespace:  default
Type        Resource  Min  Max  Default Request  Default Limit  Max Limit/Request Ratio
----        --------  ---  ---  ---------------  -------------  -----------------------
Container   memory    -    -    256Mi            512Mi          -
```
其中，`default`指定的是`limits`值，`defaultRequest`指定的是`requests`值。
```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: mem-limit-range-pod
spec:
  limits:
  - max:
      memory: 512Mi
    min:
      memory: 256Mi
    type: Pod

# kubectl describe limitranges
Name:       mem-limit-range-pod
Namespace:  default
Type        Resource  Min    Max    Default Request  Default Limit  Max Limit/Request Ratio
----        --------  ---    ---    ---------------  -------------  -----------------------
Pod         memory    256Mi  512Mi  -                -              -
```
其中，`max`指定的是`limits`值，`min`指定的是`requests`值。


再创建一个deployment或者Pod，没有定义resources限制
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app1
  namespace: default
spec:
  selector:
    matchLabels:
      app: app1
  template:
    metadata:
      labels:
        app: app1
    spec:
      containers:
      - image: nginx
        imagePullPolicy: Always
        name: app1
```
此时再查看pod的信息
```yaml
# kubectl describe pod app1-668c794b77-wv8sp
Name:         app1-668c794b77-wv8sp
Namespace:    default
......
Containers:
  app1:
  ......
    Limits:
      memory:  512Mi
    Requests:
      memory:     256Mi
```




# Pod 驱逐机制

# Pod Disruption Budget

# 集群高可用

# 集群监控

# 集群日志管理

# 审计机制

# Helm

# 常见问题

> 参考文档
> Kubernetes 权威指南

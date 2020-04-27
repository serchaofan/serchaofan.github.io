---
title: Kubernetes集群管理与排错笔记
tags: []
categories: []
date: 2020-04-05 19:06:01
---

- [Node 管理](#node-%e7%ae%a1%e7%90%86)
  - [Node 隔离与恢复](#node-%e9%9a%94%e7%a6%bb%e4%b8%8e%e6%81%a2%e5%a4%8d)
  - [Node 扩容](#node-%e6%89%a9%e5%ae%b9)
- [更新 Label](#%e6%9b%b4%e6%96%b0-label)
- [Namespace](#namespace)
- [资源管理](#%e8%b5%84%e6%ba%90%e7%ae%a1%e7%90%86)
- [Pod 驱逐机制](#pod-%e9%a9%b1%e9%80%90%e6%9c%ba%e5%88%b6)
- [Pod Disruption Budget](#pod-disruption-budget)
- [集群高可用](#%e9%9b%86%e7%be%a4%e9%ab%98%e5%8f%af%e7%94%a8)
- [集群监控](#%e9%9b%86%e7%be%a4%e7%9b%91%e6%8e%a7)
- [集群日志管理](#%e9%9b%86%e7%be%a4%e6%97%a5%e5%bf%97%e7%ae%a1%e7%90%86)
- [审计机制](#%e5%ae%a1%e8%ae%a1%e6%9c%ba%e5%88%b6)
- [Dashboard](#dashboard)
- [Helm](#helm)
- [查看系统 Event](#%e6%9f%a5%e7%9c%8b%e7%b3%bb%e7%bb%9f-event)
- [查看容器日志](#%e6%9f%a5%e7%9c%8b%e5%ae%b9%e5%99%a8%e6%97%a5%e5%bf%97)
- [查看服务日志](#%e6%9f%a5%e7%9c%8b%e6%9c%8d%e5%8a%a1%e6%97%a5%e5%bf%97)
- [常见问题](#%e5%b8%b8%e8%a7%81%e9%97%ae%e9%a2%98)

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

spec:
  containers:
    - image: <Image>
      name: my-name
      resources:
        requests:
          cpu: "20m"
          memory: "55M"
```

# Pod 驱逐机制

# Pod Disruption Budget

# 集群高可用

# 集群监控

# 集群日志管理

# 审计机制

# Dashboard

# Helm

# 查看系统 Event

# 查看容器日志

# 查看服务日志

# 常见问题

> 参考文档
> Kubernetes 权威指南

```

```

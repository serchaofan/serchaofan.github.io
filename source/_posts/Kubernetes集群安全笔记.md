---
title: Kubernetes集群安全笔记
tags: []
categories: []
date: 2020-04-05 19:05:37
---

- [API Server 认证管理](#api-server-认证管理)
- [API Server 授权管理](#api-server-授权管理)
  - [ABAC](#abac)
  - [Webhook](#webhook)
  - [RBAC](#rbac)
- [Admission Control](#admission-control)
- [Service Account](#service-account)
- [Secret](#secret)
- [Pod 安全策略配置](#pod-安全策略配置)

<!--more-->

集群安全性需要考虑几个目标：

- 保证容器与其所在宿主机的隔离
- 限制容器给基础设施或其他容器的干扰
- 最小权限原则：限制单个组件的能力来限制它的权限范围
- 明确组件间边界划分
- 划分普通用户与管理员角色
- 在必要时允许将管理员权限赋给普通用户
- 允许拥有 Secret 数据的应用在集群中运行

# API Server 认证管理

由于都是通过 API server 的 REST API 对资源访问的，所以集群安全关键在于如何识别认证客户端身份和权限的授权。

K8s 提供三种级别的客户端身份认证方式：

- HTTPS：双向数字证书认证
- HTTP Token：Token 放在 Header 里
- HTTP Base：`"用户名:密码"`进行 BASE64 编码后的字符串放在 Header 的 Authorization 中

# API Server 授权管理

客户端发起 API server 调用时，API server 要先内部进行用户认证，然后执行用户授权，通过授权策略决定一个 API 调用是否合法。
API server 支持的几种授权策略：

- AlwaysDeny：拒绝所有请求
- AlwaysAllow：允许所有请求
- ABAC：基于属性的访问控制，通过用户配置进行匹配控制
- Webhook：通过调用外部 REST 对用户进行授权
- RBAC：基于角色的访问控制
- Node：对 kubelet 发出的请求进行访问控制

API server 收到请求后，会读取请求中的数据，生成一个访问策略对象，然后将这个对象与策略文件中所有访问策略对象逐条匹配，只要至少一个策略通过，则请求被鉴权通过。

## ABAC

若要启用 ABAC，则需要指定策略文件路径`--authorization-policy-file`，策略文件中每一行为一个 JSON 对象，称为访问策略对象。
一个对象需要包含三块：

- apiVersion：设为`abac.authorization.kubernetes.io/v1beta1`
- kind：设为`Policy`
- spec：详细的策略配置，包含：主体属性、资源属性、非资源属性
  - 主体属性：
    - user：来源于 Token 文件或 base 认证的用户名
    - group：若为`system:authenticated`则匹配所有已认证的请求，若为`system:unauthenticated`则匹配所有未认证的请求
  - 资源属性：
    - apiGroup：匹配哪些 API group
    - namespace：该策略允许访问某个 namespace 的资源
    - resource：API 资源对象
  - 非资源属性：
    - nonResourcePath：非资源对象类的 URL 路径
    - readonly：若为 true，则只允许 GET 请求

ABAC 授权算法：API server 收到请求后，先识别请求携带的策略对象的属性，然后根据策略对属性逐条匹配。常见策略配置：

- 允许所有认证用户做某事：将 group 属性设为`system:authenticated`
- 允许所有未认证用户做某事：将 group 属性设为`system:unauthenticated`
- 允许一个用户做任何事：将 apiGroup、namespace、resource、nonResourcePath 都设为'\*'

使用 kubelet 的授权机制：kubelet 通过 apiserver 的`/api` 和`/apis` 获取版本信息，要验证`kubectl create或update`的对象，需要向 OpenAPI 进行查询（`/openapi/v2`）
使用 ABAC 模式时，必须对 nonResourcePath 进行设置：

- /api、/apis、/api/\*、/apis/\*
- /version
- /swaggerapi/\*

```json
# 允许jack对所有资源操作
{
  "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
  "kind": "Policy",
  "spec": {
    "user": "jack",
    "namespace": "*",
    "resource": "*",
    "apiGroup": "*"
  }
}

# kubelet可读任意pod
{
  "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
  "kind": "Policy",
  "spec": {
    "user": "*",
    "namespace": "*",
    "resource": "pods",
    "readonly": true
  }
}

# kubelet可读写event对象
{
  "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
  "kind": "Policy",
  "spec": {
    "user": "kubelet",
    "namespace": "*",
    "resource": "events"
  }
}

# bob只能读namespace为dev中的pod
{
  "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
  "kind": "Policy",
  "spec": {
    "user": "bob",
    "namespace": "dev",
    "resource": "pods",
    "readonly": true
  }
}

# 任何用户能对nonResourcePath进行只读请求
{
  "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
  "kind": "Policy",
  "spec": {
    "group": {
      "system": "authenticated"
    },
    "readonly": true,
    "nonResourcePath": "*"
  }
}
```

## Webhook

webhook 定义了一个 HTTP 回调接口，会在指定事件发生时向一个 URL 发送 POST 消息

## RBAC

RBAC 的优势：

- 对集群的资源和非资源权限都有完整的覆盖
- 整个 RBAC 完全由几个 API 对象完成，可用 kubectl 或 API 操作
- 可在运行时调整，无需重启 API server

RBAC 有 4 个顶级资源对象：

- Role：一个角色是一组权限的集合，都是许可形式。若是集群级别，则需要使用 ClusterRole。
  ```yaml
  apiVersion: rbac.authorization.k8s.io/v1
  kind: Role
  metadata:
    namespace: default
    name: pod-reader
  rules:
    - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "watch", "list"]
  ```
  rules 中参数：
  - apiGroups：支持的 API 组列表
  - resources：支持的资源对象列表
  - verbs：对资源对象的操作方法列表
- ClusterRole：除了 Role 的功能外，还可用于特殊元素的授权：
  - 集群范围的资源，如 Node
  - 非资源型的路径
  - 全部命名空间的资源
  ```yaml
    apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRole
    metadata:
    rules:
    - apiGroups: [""]
        resources: ["secrets"]
        verbs: ["get", "watch", "list"]
  ```
  ClusterRole 不受限于命名空间，所以无须设置 metadata 的 namespace
- RoleBinding 和 ClusterRoleBinding：用于将一个角色绑定到一个目标上，目标可以是 user 或 group 或 Service Account

# Admission Control

# Service Account

# Secret

# Pod 安全策略配置

---
title: Kubernetes集群安全笔记
tags: []
date: 2020-04-05 19:05:37
categories: [Kubernetes]
comments: false
---

- [Admission Control](#admission-control)
- [Service Account](#service-account)
- [Secret](#secret)
- [Pod 安全策略配置](#pod-安全策略配置)

<!--more-->

## 云原生安全概述

云原生安全的 4 个 C 分别是云（Cloud）、集群（Cluster）、容器（Container）和代码（Code）。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203251527867.png)

1. 云（例如数据中心）是k8s集群的可信计算基（trusted computing base），如果云层容易受到攻击，就不能保证在此基础之上构建的组件是安全的。云基础设施的保护有几个关注的点：
   - 对k8s控制平面的访问不允许在公网上开放，由网络访问控制列表控制（包含管理集群所用的IP地址集合）。
   - 节点仅能从控制平面指定端口来连接，节点不应暴露在公网上。
   - 对于云提供商，最好能给最小特权限制。
   - 仅有控制平面能访问etcd，且使用tls访问
   - etcd节点的磁盘最好能静态加密数据。
2. 关于集群的保护分两点：一个是集群本身，一个是集群中的应用。保护集群有以下几个关注的点：
   - 所有API交互都用tls加密
   - 所有API客户端必须经过身份验证（如通过ServiceAccount或x509证书）
   - 每个API多用都通过鉴权检查（如RBAC）
   - 控制kubelet访问，默认是允许对API进行未经身份验证的访问。生产环境应启用kubelet身份认证授权。
   - 限制集群资源使用（如ResourceQuota或LimitRange）
   - 控制容器运行的特权，通过设置Pod安全策略，限制哪些用户或服务帐户可以提供危险的安全上下文设置。运行容器最好能用非root用户运行。
   - 限制网络访问，通过编写网络策略（NetworkPolicy）实现。
   - 限制云元数据API访问，在云平台上运行k8s时，需要限制对实例凭据的权限，使用网络策略限制Pod对元数据API的访问，并避免使用配置数据来传递机密信息。
   - 控制Pod可以访问的节点（如NodeSelector或基于污点的Pod放置和放逐）
   - 限制访问etcd，建议将etcd服务器隔离到只有API服务器可以访问的防火墙后面。
   - 启用审计日志，能记录每个用户、使用API的应用以及控制面自身引发的活动。
   - 限制使用 alpha 和 beta 特性
   - 经常轮换基础设施证书，在证书上设置较短的生命期并实现自动轮换。
   - 许多集成到k8s的第三方软件或服务都可能改变集群的安全配置。组件若能够在`kube-system`这类名字空间中创建 Pod， 则这类组件也可能获得意外的权限，因为这些Pod可以访问服务账户的Secret。
3. 对于容器的安全性，主要关注以下几点：
   - 容器漏洞扫描
   - 镜像签名
   - 禁止特权用户
   - 使用带有较强隔离能力的容器运行时（RuntimeClass）
4. 对于代码的安全性，主要关注以下几点：
   - 加密传输所有内容
   - 限制通信端口范围，只开放必要端口
   - 定期扫描应用程序的第三方库以了解已知的安全漏洞
   - 静态代码分析与动态探测攻击

集群安全性需要考虑几个目标：

- 保证容器与其所在宿主机的隔离
- 限制容器给基础设施或其他容器的干扰
- 最小权限原则：限制单个组件的能力来限制它的权限范围
- 明确组件间边界划分
- 划分普通用户与管理员角色
- 在必要时允许将管理员权限赋给普通用户
- 允许拥有 Secret 数据的应用在集群中运行

## K8S API 访问控制
用户使用kubectl、客户端库或构造REST请求来访问K8S API，当请求到达API Server时，会经历以下阶段：
1. 认证（Authentication）
2. 鉴权（Authorization）
3. 准入控制（Admission Control）

### 认证
在API Server与建立TLS连接后，HTTP请求进入认证步骤。API Server上运行着一个或多个身份认证组件，服务器依次尝试每个验证模块，直到其中一个成功。

认证步骤的输入是整个HTTP请求，但通常情况组件只检查头部和客户端证书。

认证模块包含：
1. 客户端证书（HTTPS）
2. 密码（HTTP Base），`"用户名:密码"`进行 BASE64 编码后的字符串放在 Header 的 Authorization 中
3. 普通令牌（HTTP Token），Token 放在 Header 里
4. 引导令牌
5. JWT令牌

如果请求认证不通过，服务器将以HTTP状态码`401`拒绝该请求。反之，该用户被认证为特定的`username`，并且该用户名可用于后续步骤。

### 鉴权
将请求验证为来自特定的用户后，请求必须被鉴权。

请求必须包含**请求者的用户名、请求的行为以及受该操作影响的对象**。如果现有策略声明用户有权完成请求的操作，那么该请求被鉴权通过。

Kubernetes 支持多种鉴权模块，例如**ABAC模式**、**RBAC 模式**和 **Webhook 模式**等。 管理员创建集群时会配置应在 API Server中使用的鉴权模块。 如果配置了多个鉴权模块，则 Kubernetes 会检查每个模块，**任意一个鉴权模块允许该请求，请求即可继续**，如果所有模块拒绝了该请求，请求将会被拒绝，返回HTTP状态码403。

鉴权模块:
- Node：节点鉴权是一种特殊用途的鉴权模式，**专门对 kubelet 发出的 API 请求进行鉴权**。
- ABAC：**基于属性的访问控制**，通过使用将属性组合在一起的策略，将访问权限授予用户。策略可以使用任何类型的属性（用户属性、资源属性、 对象，环境属性等）
- RBAC：**基于角色的访问控制**，权限是单个用户执行特定任务的能力，例如查看、创建或修改文件。
- Webhook：是一个 HTTP 回调：发生某些事情时调用的 HTTP POST，从而通过 HTTP POST 进行简单的事件通知
- AlwaysDeny：阻止所有请求。仅用于测试。
- AlwaysAllow：允许所有请求。仅在不需要 API 请求的鉴权时才使用。

在API server启动参数中添加一条`--authorization-mode=`指定鉴权模块，这条也必须配置至少一种，若配置多种则以`,`分隔，例如`--authorization-mode=Node,RBAC`，模块按顺序检查，较靠前的模块具有更高的优先级来允许或拒绝请求。

可使用`kubectl auth can-i <verb> <resource>` 了解当前用户是否有权限做指定操作，可以则为`yes`，反之为`no`。

```
# kubectl auth can-i create deployment -n dev
yes
# kubectl auth can-i delete deployment -n kube-system
yes
```

### 准入控制
准入控制模块是可以修改或拒绝请求的软件模块。除鉴权模块可用的属性外，准入控制模块还可以访问正在创建或修改的对象的内容。

准入控制器对创建、修改、删除或（通过代理）连接对象的请求进行操作。准入控制器不会对仅读取对象的请求起作用。有多个准入控制器被配置时，服务器将依次调用它们。

**与身份认证和鉴权模块不同，如果任何准入控制器模块拒绝某请求，则该请求将立即被拒绝。**

## 鉴权概述
Kubernetes 仅审查以下 API 请求属性：
1. 用户：身份验证期间提供的`user`。
2. 组：经过身份验证的用户所属的组名列表。
3. 额外信息：由身份验证层提供的任意字符串键到字符串值的映射。
4. API：指示请求是否针对 API 资源。
5. 请求路径：各种非资源端点的路径，如 `/api` 或 `/healthz`。
6. API 请求动词：API 动词 `get`、`list`、`create`、`update`、`patch`、`watch`、`proxy`、`redirect`、`delete` 和 `deletecollection` 用于资源请求。
7. HTTP 请求动词：HTTP 动词 `get`、`post`、`put` 和 `delete` 用于非资源请求。
8. Resource：正在访问的资源的 ID 或名称（仅限资源请求），对于使用 `get`、`update`、`patch` 和 `delete` 动词的资源请求必须提供资源名称。
9. 子资源：正在访问的子资源（仅限资源请求）。
10. 名字空间：正在访问的对象的名称空间（仅适用于名字空间资源请求）。
11. API组：正在访问的API组 （仅限资源请求）。空字符串表示核心API组（apiVersion: v1）。

### 请求动词
#### 非资源请求
除`/api/v1/...`或`/apis/<group>/<version>/...`之外的请求被视为非资源请求（Non-Resource Requests），并使用该HTTP请求的小写形式作为其请求动词（如`get`）

#### 资源请求
| HTTP动词 | 请求动词 |
|-|-|
|POST|create|
|GET, HEAD|get （针对单个资源）、list（针对集合）|
|PUT|update|
|PATCH | patch|
|DELETE|	delete（针对单个资源）、deletecollection（针对集合）|

有时使用专门的动词以对额外的权限进行鉴权。例如：
- PodSecurityPolicy：`policy` API 组中 `podsecuritypolicies` 资源使用 `use` 动词
- RBAC：对 `rbac.authorization.k8s.io` API 组中 `roles` 和 `clusterroles` 资源的 `bind` 和 `escalate` 动词
- 身份认证：对核心 API 组中 `users`、`groups` 和 `serviceaccounts` 以及 `authentication.k8s.io` API 组中的 `userextras` 所使用的 `impersonate` 动词。



## API Server 授权管理

客户端发起 API server 调用时，API server 要先内部进行用户认证，然后执行用户授权，通过授权策略决定一个 API 调用是否合法。
API server 支持的几种授权策略：


API server 收到请求后，会读取请求中的数据，生成一个访问策略对象，然后将这个对象与策略文件中所有访问策略对象逐条匹配，只要至少一个策略通过，则请求被鉴权通过。

### ABAC

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

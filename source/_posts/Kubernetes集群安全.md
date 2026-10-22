---
title: Kubernetes集群安全
tags: [Kubernetes, 安全, RBAC, PSA]
date: 2020-04-05 19:05:37
categories: [Kubernetes]
comments: false
---

本文基于 Kubernetes v1.37 官方文档重写。旧笔记中的 PodSecurityPolicy、Basic Auth、ABAC 示例和准入插件列表已经过时；本文按当前认证、鉴权、准入、运行时安全和供应链安全重新整理。

<!--more-->

- [安全模型](#%E5%AE%89%E5%85%A8%E6%A8%A1%E5%9E%8B)
- [认证](#%E8%AE%A4%E8%AF%81)
- [鉴权](#%E9%89%B4%E6%9D%83)
- [准入控制](#%E5%87%86%E5%85%A5%E6%8E%A7%E5%88%B6)
- [Pod 安全](#pod-%E5%AE%89%E5%85%A8)
- [Secret 与加密](#secret-%E4%B8%8E%E5%8A%A0%E5%AF%86)
- [网络与运行时安全](#%E7%BD%91%E7%BB%9C%E4%B8%8E%E8%BF%90%E8%A1%8C%E6%97%B6%E5%AE%89%E5%85%A8)
- [供应链安全](#%E4%BE%9B%E5%BA%94%E9%93%BE%E5%AE%89%E5%85%A8)
- [审计与监控](#%E5%AE%A1%E8%AE%A1%E4%B8%8E%E7%9B%91%E6%8E%A7)
- [企业实践](#%E4%BC%81%E4%B8%9A%E5%AE%9E%E8%B7%B5)

# 安全模型

Kubernetes 的安全通常按 4C 分层：

- **Cloud**：云账号、VPC、安全组、IAM
- **Cluster**：apiserver、etcd、节点、证书、RBAC
- **Container**：镜像、运行时、Pod 安全上下文
- **Code**：应用依赖、配置、密钥、供应链

API 请求的安全链路：

![API 访问控制](https://kubernetes.io/images/docs/admin/access-control-overview.svg)

*图 1：Kubernetes API 请求的认证、鉴权、准入流程（官方文档）*

```
请求 → 认证（你是谁）→ 鉴权（你能做什么）→ 准入（对象是否合规）→ 写入 etcd
```

任何一层缺失都会留下风险。

# 认证

kube-apiserver 支持多种认证方式：

- **X.509 客户端证书**：集群组件、kubelet、管理员常用
- **ServiceAccount token**：Pod 内工作负载身份，推荐使用 projected token
- **OIDC**：对接企业身份提供商
- **Webhook token authentication**：对接外部认证服务
- **Bootstrap token**：节点加入集群

Basic Auth 已移除；静态 token 文件（`--token-auth-file`）仍支持，但令牌永不过期、修改需重启 apiserver，不适合生产。

## ServiceAccount

ServiceAccount 是 Pod 的身份。从 v1.24 起，默认不再自动创建长期 Secret token，而是使用 projected token：

```yaml
volumes:
- name: token
  projected:
    sources:
    - serviceAccountToken:
        path: token
        expirationSeconds: 3600
```

最佳实践：

- 每个应用使用独立 ServiceAccount
- 不需要访问 API 时设置 `automountServiceAccountToken: false`
- 用 RBAC 只授予必要权限
- 不要把 token 写进镜像或 ConfigMap

## 证书

kubeadm 集群的证书：

```bash
kubeadm certs check-expiration
kubeadm certs renew all
```

renew 后需要在每个控制面节点重启 apiserver、controller-manager、scheduler 等静态 Pod（移走 manifest 或重启 kubelet），旧进程不会自动重新加载证书。

要点：

- CA 有效期长，叶子证书通常 1 年
- 升级时注意轮换
- kubelet 客户端证书可以开启自动轮换
- `--insecure-port` 已在 v1.24 移除，不要跳过 TLS 校验

# 鉴权

鉴权模块按 `--authorization-mode` 顺序检查：

- 第一个明确 allow 或 deny 的模块决定结果
- 如果所有模块都返回 no opinion，请求被拒绝
- RBAC 没有 deny 规则，最小权限靠“只授予需要的 verb/resource”

## RBAC

四个对象：

- `Role`：命名空间级权限
- `ClusterRole`：集群级权限，或跨命名空间复用
- `RoleBinding`：把 Role/ClusterRole 绑定到主体
- `ClusterRoleBinding`：集群级绑定

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: prod
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  namespace: prod
  name: read-pods
subjects:
- kind: ServiceAccount
  name: app
  namespace: prod
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

常见高危权限：

- `secrets` 的 `get/list/watch`
- `pods/exec`、`pods/attach`
- `pods/portforward`
- `serviceaccounts/token` 的 `create`
- `clusterrolebindings` 的 `create`
- `escalate`、`bind`、`impersonate`

## 鉴权排障

```bash
kubectl auth can-i get pods -n prod
kubectl auth can-i --list -n prod
kubectl auth whoami
kubectl get rolebinding,clusterrolebinding -A
```

`kubectl auth can-i --list` 能看到当前身份的权限集合，是排查 403 的第一步。

# 准入控制

认证和鉴权通过后，请求还要经过准入控制：

- **MutatingAdmissionWebhook**：修改对象，例如注入 Sidecar
- **ValidatingAdmissionWebhook**：校验对象
- **Pod Security Admission**：按命名空间执行 Pod 安全标准
- **ValidatingAdmissionPolicy**：用 CEL 写校验规则，无需 Webhook

![准入控制阶段](https://kubernetes.io/images/blog/2019-03-21-a-guide-to-kubernetes-admission-controllers/admission-controller-phases.png)

*图 2：准入控制阶段（Kubernetes 官方博客）*

Webhook 要注意：

- `failurePolicy: Fail` 会在 Webhook 不可用时阻断请求，可能造成集群级故障
- 用 `namespaceSelector`、`objectSelector`、`matchConditions` 缩小范围
- 设置 `timeoutSeconds`，避免请求长时间挂起
- Webhook 自身要有多副本、PDB 和监控

PodSecurityPolicy 已在 v1.25 移除，不要再使用。

# Pod 安全

## Pod Security Admission

PSA 是内置的准入控制器，按命名空间标签执行三档标准：

- `privileged`：几乎不限制
- `baseline`：阻止已知提权
- `restricted`：最严格，要求非 root、禁止提权、限制能力、seccomp 等

```yaml
metadata:
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

建议先在 `audit`/`warn` 模式观察，再切 `enforce`。PSA 覆盖不到细粒度策略时，用 Kyverno、Gatekeeper 或 ValidatingAdmissionPolicy 补足。

## SecurityContext

Pod 级：

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  runAsGroup: 10001
  fsGroup: 10001
  seccompProfile:
    type: RuntimeDefault
```

容器级：

```yaml
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
```

`fsGroup` 只能放在 Pod 级；`allowPrivilegeEscalation`、`readOnlyRootFilesystem`、`capabilities` 只能放在容器级。混用会被 API 校验拒绝。

容器级别还可以设置：

```yaml
securityContext:
  privileged: false
  capabilities:
    add: ["NET_BIND_SERVICE"]
```

原则：

- 默认非 root
- 禁止 privilege escalation
- 裁剪 capabilities
- 启用 seccomp/AppArmor
- 只读 rootfs，需要写入的目录挂 volume
- 不要挂载 `/var/run/docker.sock`
- 不要使用 `hostNetwork`、`hostPID`、`hostIPC`，除非确有必要

# Secret 与加密

Secret 默认只是 base64 编码，不是加密。任何能读 Secret 的人都能解码。

生产建议：

- 启用 etcd 静态加密（EncryptionConfiguration，推荐 KMS v2）
- RBAC 限制 Secret 读取
- 优先 volume 挂载，少用环境变量
- 使用 External Secrets Operator、Vault、云 KMS 等外部密钥管理
- 普通 Secret 不会自动轮换，需要用 External Secrets、Vault 或应用双密钥方案实现；ServiceAccount token 由 kubelet 自动轮换
- 不要把 Secret 提交到 Git

etcd 加密配置示例：

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - kms:
      apiVersion: v2
      name: my-kms
      endpoint: unix:///var/run/kms-plugin.sock
      timeout: 3s
  - identity: {}
```

`identity` 作为最后的回退，表示未加密读取；生产要确认加密 provider 生效。

# 网络与运行时安全

## NetworkPolicy

默认拒绝入站：

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: prod
spec:
  podSelector: {}
  policyTypes: ["Ingress"]
```

NetworkPolicy 需要 CNI 支持。它不是身份认证，不能替代 mTLS 和授权。

## 运行时安全

- 使用 containerd/CRI-O，不用 dockershim
- 启用 seccomp `RuntimeDefault`
- 启用 AppArmor 或 SELinux
- 限制节点上的特权容器
- 定期扫描镜像漏洞
- 使用只读根文件系统
- 监控异常进程、异常网络连接和容器逃逸

# 供应链安全

- 镜像固定 digest，不用浮动 tag
- 只从可信仓库拉取镜像
- 使用 cosign/Notation 做镜像签名
- 生成并校验 SBOM
- 在准入层校验签名和漏洞等级（Kyverno、Gatekeeper、Sigstore Policy Controller）
- 扫描依赖和基础镜像
- 限制构建凭据，不在 Dockerfile 中写密钥
- 使用 SLSA provenance 或类似构建证明

# 审计与监控

启用 apiserver 审计日志：

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]
- level: RequestResponse
  resources:
  - group: ""
    resources: ["configmaps"]
  verbs: ["create", "update", "patch", "delete"]
```

关注：

- 谁读取了 Secret
- 谁创建了 ClusterRoleBinding
- 谁执行了 `pods/exec`
- 谁修改了 PSA 标签
- 异常 ServiceAccount token 使用
- 异常外部访问和 NodePort 暴露

# 企业实践

## 最小权限

- 每个应用使用独立 ServiceAccount
- 默认 `automountServiceAccountToken: false`
- Role 只授予需要的 verb/resource，不用 `*`
- 禁止给应用 `cluster-admin` 或 `system:masters`
- 高危权限单独审批：`secrets`、`pods/exec`、`pods/portforward`、`serviceaccounts/token`、`escalate`、`bind`、`impersonate`
- 建立权限申请、审批、到期回收流程
- 定期审计 RBAC，清理闲置账号、过期 token 和不再使用的绑定
- 用 `kubectl auth can-i --list` 和工具做权限可视化

## 多租户

隔离层次：

- 软多租户：Namespace + RBAC + Quota + NetworkPolicy + PSA
- 强隔离：vCluster、独立集群、独立 etcd/网络/存储

落地要点：

- Namespace 按团队/环境/业务域划分
- ResourceQuota 限制总量，LimitRange 设置默认值
- NetworkPolicy 默认拒绝，按依赖放行
- PSA baseline/restricted
- 限制可用 StorageClass、镜像仓库、NodePort 和 LoadBalancer
- 敏感数据独立加密密钥
- 明确平台团队和租户的责任边界

## 集群基线

- 控制面只暴露必要端口，apiserver 不暴露公网
- etcd 只监听内网，启用 TLS 和客户端证书
- 启用审计日志和 etcd 静态加密
- 启用 PSA，至少 baseline
- 限制 NodePort 和 LoadBalancer，入口统一
- 节点最小化，及时打补丁，禁用不必要服务
- 启用 seccomp/AppArmor，限制特权容器
- 定期做 CIS Benchmark、kube-bench 和渗透测试
- 控制面、节点、etcd 的证书和 kubeconfig 纳入安全管理

## 供应链安全

- 镜像只从可信仓库拉取，固定 digest
- 构建环境隔离，构建凭据最小权限
- 生成 SBOM，记录依赖和构建来源
- 用 cosign/Notation 做镜像签名
- 准入层校验签名、漏洞等级和来源
- 定期扫描基础镜像、依赖和运行时漏洞
- 禁止在 Dockerfile、ConfigMap、Git 中写密钥
- 保留构建证明和审计记录

## 审计与监控

审计策略建议：

- 元数据级别记录大多数请求
- 对 Secret、RBAC、exec、节点操作提高级别
- 避免对所有资源开 `RequestResponse`，日志量和敏感数据风险大
- 审计日志接入 SIEM，设置保留周期

重点告警：

- 读取 Secret 的异常身份
- 创建 ClusterRoleBinding 或提权
- `pods/exec` 进入生产容器
- 修改 PSA 标签或准入策略
- ServiceAccount token 异常使用
- 异常外部访问、NodePort 暴露和镜像拉取失败

## 应急

**Secret 泄露**

1. 立即轮换 Secret 或撤销 token
2. 检查审计日志，确认读取范围
3. 排查使用该 Secret 的工作负载和外部系统
4. 评估是否需要隔离节点或回滚

**容器逃逸**

1. 隔离节点，停止调度
2. 保留现场：容器、镜像、进程、网络连接
3. 排查特权容器、hostPath、hostNetwork、危险 capability
4. 检查是否有横向移动和凭据泄露
5. 修复后重新镜像和重建节点

**镜像投毒**

1. 阻断仓库或镜像
2. 回滚到已知安全版本
3. 重新扫描全部镜像和运行中容器
4. 校验签名和 SBOM
5. 审计构建链和凭据

**RBAC 提权**

1. 撤销可疑绑定和 token
2. 审计 ServiceAccount、Webhook 和控制器
3. 检查是否有后门资源或恶意 Job
4. 收紧准入和 RBAC 策略

## 官方参考

- [访问控制](https://kubernetes.io/docs/concepts/security/controlling-access/)
- [RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/)
- [Secret 最佳实践](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)
- [加密数据](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/)
- [审计](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/)
- [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)

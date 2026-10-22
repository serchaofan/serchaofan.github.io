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
- [威胁模型与攻击路径](#%E5%A8%81%E8%83%81%E6%A8%A1%E5%9E%8B%E4%B8%8E%E6%94%BB%E5%87%BB%E8%B7%AF%E5%BE%84)
- [认证与身份深水区](#%E8%AE%A4%E8%AF%81%E4%B8%8E%E8%BA%AB%E4%BB%BD%E6%B7%B1%E6%B0%B4%E5%8C%BA)
- [RBAC 提权与治理](#rbac-%E6%8F%90%E6%9D%83%E4%B8%8E%E6%B2%BB%E7%90%86)
- [准入控制深水区](#%E5%87%86%E5%85%A5%E6%8E%A7%E5%88%B6%E6%B7%B1%E6%B0%B4%E5%8C%BA)
- [Pod 安全深水区](#pod-%E5%AE%89%E5%85%A8%E6%B7%B1%E6%B0%B4%E5%8C%BA)
- [Secret 加密与工作负载身份](#secret-%E5%8A%A0%E5%AF%86%E4%B8%8E%E5%B7%A5%E4%BD%9C%E8%B4%9F%E8%BD%BD%E8%BA%AB%E4%BB%BD)
- [网络与运行时深水区](#%E7%BD%91%E7%BB%9C%E4%B8%8E%E8%BF%90%E8%A1%8C%E6%97%B6%E6%B7%B1%E6%B0%B4%E5%8C%BA)
- [供应链与准入校验](#%E4%BE%9B%E5%BA%94%E9%93%BE%E4%B8%8E%E5%87%86%E5%85%A5%E6%A0%A1%E9%AA%8C)
- [审计与检测](#%E5%AE%A1%E8%AE%A1%E4%B8%8E%E6%A3%80%E6%B5%8B)
- [多租户隔离深水区](#%E5%A4%9A%E7%A7%9F%E6%88%B7%E9%9A%94%E7%A6%BB%E6%B7%B1%E6%B0%B4%E5%8C%BA)
- [事件响应与演练](#%E4%BA%8B%E4%BB%B6%E5%93%8D%E5%BA%94%E4%B8%8E%E6%BC%94%E7%BB%83)
- [集群加固清单](#%E9%9B%86%E7%BE%A4%E5%8A%A0%E5%9B%BA%E6%B8%85%E5%8D%95)
- [官方参考](#%E5%AE%98%E6%96%B9%E5%8F%82%E8%80%83)

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

# 威胁模型与攻击路径

## 4C 与信任边界

```text
Cloud（账号/VPC/IAM）
  └── Cluster（apiserver/etcd/节点/证书）
        └── Container（镜像/运行时/Pod）
              └── Code（依赖/配置/密钥）
```

每一层都是信任边界。上层被攻破，下层很难独善其身：

- 云账号被攻破 → 可改 VPC、IAM、节点、快照。
- 节点被攻破 → 可读 kubelet 凭据、容器文件系统、ServiceAccount token、其他 Pod。
- 容器逃逸 → 可访问节点和同节点工作负载。
- 供应链被投毒 → 恶意代码以合法身份运行。

## 常见攻击路径

| 入口 | 路径 | 关键防线 |
| ---- | ---- | -------- |
| 公网入口 | Ingress/Gateway → 应用漏洞 → Pod | WAF、最小权限、PSA |
| 弱认证 | 匿名/静态 token/长期 SA token → API | 关闭匿名、OIDC、短期 token |
| RBAC 过宽 | 读 Secret → 横向移动 → 提权 | 最小权限、审计 |
| Pod 特权 | privileged/hostPath/hostNetwork → 节点 | PSA、SecurityContext、准入 |
| 镜像投毒 | 恶意镜像 → 凭据/后门 | 签名、SBOM、准入校验 |
| 节点漏洞 | 未打补丁/SSH 暴露 → 节点 root | 节点加固、补丁、网络隔离 |
| etcd 暴露 | 直接读 etcd → 全量 Secret | TLS、网络隔离、加密 |
| 云元数据 | Pod 访问 169.254.169.254 → 云凭据 | IMDSv2、网络策略、工作负载身份 |
| 供应链 | 依赖/构建系统被攻破 | SLSA、签名、隔离构建 |

## 攻击者视角的问题

- 我能拿到什么身份？
- 这个身份能读哪些 Secret/Token？
- 能否创建 Pod/Job/DaemonSet 挂载敏感卷？
- 能否 exec 进其他容器？
- 能否修改 Webhook/CRD/PSA 标签？
- 能否访问节点/kubelet/etcd/云元数据？
- 爆炸半径是命名空间、节点、集群还是云账号？

# 认证与身份深水区

## API 请求链路

```text
请求 → 认证（Authenticator）→ 鉴权（Authorizer）→ 准入（Admission）→ etcd
```

认证只回答“你是谁”，不回答“你能做什么”。多个认证器按顺序尝试，第一个成功即确定身份。

## X.509 客户端证书

- `CN` 映射为用户名，`O` 映射为组。
- `system:masters` 组天然拥有 cluster-admin 权限，证书泄露等于集群沦陷。
- Kubernetes 1.37 **不支持证书吊销**；证书签发后在过期前一直有效。
- 控制面/节点证书要监控到期、轮换、私钥保护。
- kubelet 客户端证书可自动轮换：`--rotate-certificates`；服务端证书用 `--rotate-server-certificates`（需要 CSR 批准）。
- 不要把管理员 kubeconfig 分发给应用团队。

```bash
kubeadm certs check-expiration
kubeadm certs renew all
```

## ServiceAccount

ServiceAccount 是 Pod 的身份。现代推荐：

- 使用 projected bound token，而不是长期 Secret token。
- 设置 `audience`、`expirationSeconds`，让 token 短期、绑定对象、可轮换。
- 不需要访问 API 时显式 `automountServiceAccountToken: false`。
- 每个工作负载独立 SA，RBAC 只授予必要权限。
- 不要把 token 写进镜像、ConfigMap、日志。

```yaml
volumes:
- name: token
  projected:
    sources:
    - serviceAccountToken:
        path: token
        audience: https://kubernetes.default.svc
        expirationSeconds: 3600
```

关键 apiserver 参数：

- `--service-account-issuer`
- `--service-account-key-file`
- `--service-account-signing-key-file`
- `--api-audiences`
- `--service-account-max-token-expiration`

## OIDC

对接企业 IdP：

- `--oidc-issuer-url`
- `--oidc-client-id`
- `--oidc-username-claim`（默认 `sub`）
- `--oidc-groups-claim`
- `--oidc-username-prefix` / `--oidc-groups-prefix`

要点：

- 校验 issuer、audience、签名、过期时间。
- 用户/组名前缀避免与 `system:` 冲突。
- 组映射到 RBAC，离开 IdP 组应及时失去权限。
- OIDC 只做认证；授权仍由 RBAC/策略完成。
- 不要把 IdP 的宽泛组直接绑到 cluster-admin。

## Webhook Token Authentication

- apiserver 调用外部 `TokenReview` 服务。
- 适合接入自建身份系统、短期 token。
- Webhook 不可用会影响认证；要有高可用、超时、缓存。
- 返回的 user/groups/audience 要严格校验。

## Bootstrap Token

- 用于节点加入集群。
- 形式 `[a-z0-9]{6}.[a-z0-9]{16}`，存储在 `kube-system` Secret。
- 身份是 `system:bootstrap:<id>`，组是 `system:bootstrappers`。
- 短期有效，用后清理；不要当长期管理员 token。

## 匿名访问

- 未认证请求可能是 `system:anonymous` / `system:unauthenticated`。
- apiserver 建议 `--anonymous-auth=false`，或只允许 health 端点匿名。
- kubelet 默认可能允许匿名；生产设置 `--anonymous-auth=false`。
- 匿名访问 + 过宽 RBAC = 公网可直接读集群信息。

## Impersonation

- `kubectl --as=... --as-group=...` 需要 `impersonate` 权限。
- 用于排障，但也是高危权限；必须审计。
- 不要给应用/普通用户 impersonate 权限。

## 认证常见坑

- 静态 token 永不过期。
- 长期 SA Secret token 泄露。
- 管理员证书/ kubeconfig 到处复制。
- OIDC 组映射过宽。
- 关闭 TLS 校验。
- 把 `system:masters` 当普通管理员组使用。

# RBAC 提权与治理

## RBAC 模型

- `Role` / `ClusterRole`：权限集合。
- `RoleBinding` / `ClusterRoleBinding`：把权限授予 user/group/SA。
- `rules` 由 `apiGroups`、`resources`、`verbs`、`resourceNames`、`nonResourceURLs` 组成。
- RBAC 是**只增**的：没有 deny 规则，权限是并集。
- 绑定是命名空间或集群范围；RoleBinding 可以引用 ClusterRole 但只在该命名空间生效。

## 默认角色

| 角色 | 说明 |
| ---- | ---- |
| `cluster-admin` | 超级权限；绑定到 `system:masters` |
| `admin` | 命名空间管理员，通常不包含 ResourceQuota 等部分权限 |
| `edit` | 读写大多数资源，不能改 RBAC |
| `view` | 只读大多数资源，不含 Secret |
| `system:basic-user` | 基础发现权限 |
| `system:discovery` | API 发现 |
| `system:public-info-viewer` | 公开信息 |

不要给应用 `cluster-admin`、`admin`、`system:masters`。

## 高危权限

| 权限 | 风险 |
| ---- | ---- |
| `secrets` get/list/watch | 读取所有凭据 |
| `pods/exec` | 进入容器，窃取 token/数据 |
| `pods/attach` | 附加进程/终端 |
| `pods/portforward` | 绕过网络策略访问 Pod |
| `serviceaccounts/token` create | 伪造 SA token |
| `nodes/proxy` | 通过 kubelet 访问节点/Pod |
| `certificatesigningrequests` | 签发客户端证书 |
| `clusterrolebindings` create | 直接提权 |
| `roles`/`rolebindings` + `bind` | 绑定高权限角色 |
| `escalate` | 修改角色时绕过权限检查 |
| `impersonate` | 冒充其他用户/组 |
| `validatingwebhookconfigurations`/`mutatingwebhookconfigurations` | 注入/绕过准入 |
| `customresourcedefinitions` | 创建恶意 CRD/控制器 |
| `storageclasses`/`persistentvolumes` | 挂载敏感存储 |
| `namespaces` delete | 删除整个命名空间 |
| `daemonsets`/`jobs`/`cronjobs` | 在节点上运行任意负载 |

## 提权机制

- **bind**：创建 RoleBinding 时，如果自己没有目标角色的全部权限，需要 `bind` 权限；否则可越权绑定。
- **escalate**：修改 Role/ClusterRole 时，如果没有 `escalate`，不能授予自己没有的权限。
- **impersonate**：直接冒充高权限主体。
- **serviceaccounts/token**：为任意 SA 创建 token。
- **secrets**：读 kubeconfig/token/证书。
- **pods/exec**：进入高权限 Pod。
- **webhook/CRD**：控制准入或 API 行为。

## RBAC 治理

- 每个应用独立 SA，不要共用 default。
- 优先 RoleBinding + 命名空间 Role，少用 ClusterRoleBinding。
- 禁止 `*` verbs/resources/apiGroups，除非平台级只读发现。
- `resourceNames` 限制到具体对象（注意 create/list/watch 的限制）。
- 用聚合 ClusterRole 扩展 `admin/edit/view`，不要让每个团队复制规则。
- 定期审计：`kubectl auth can-i --list`、`kubectl-who-can`、`audit2rbac`。
- 删除离职人员、过期 SA、未使用绑定。
- RBAC 变更走 GitOps/审批/审计。
- 不能只靠 RBAC 做“拒绝”；需要准入策略/NetworkPolicy 补足。

## 排障

```bash
kubectl auth whoami
kubectl auth can-i get secrets -n prod
kubectl auth can-i --list -n prod
kubectl get rolebinding,clusterrolebinding -A
```

403 先看：

1. 身份/组是否正确。
2. RoleBinding 是否在正确命名空间。
3. Role 的 apiGroups/resources/verbs 是否匹配。
4. 是否被 admission/webhook 拒绝。
5. 是否用了 impersonation。

# 准入控制深水区

## 准入链

```text
认证 → 鉴权 → Mutating Admission → Object Schema 校验
     → Validating Admission → 内置准入控制器 → 写入 etcd
```

- Mutating webhook 可以修改对象。
- Validating webhook 只能拒绝/放行。
- 内置控制器：PodSecurity、NodeRestriction、ResourceQuota、LimitRanger、ServiceAccount 等。
- ValidatingAdmissionPolicy（VAP）用 CEL 在 apiserver 内校验，不需要外部 webhook。

## Webhook 配置

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: policy
webhooks:
- name: policy.example.com
  admissionReviewVersions: ["v1"]
  sideEffects: None
  failurePolicy: Fail
  matchPolicy: Equivalent
  timeoutSeconds: 5
  clientConfig:
    service:
      name: policy-webhook
      namespace: policy
      path: /validate
    caBundle: ...
  rules:
  - apiGroups: [""]
    apiVersions: ["v1"]
    operations: ["CREATE", "UPDATE"]
    resources: ["pods"]
  namespaceSelector:
    matchLabels:
      policy: enabled
  objectSelector:
    matchLabels:
      policy: enabled
  matchConditions:
  - name: skip-system
    expression: request.namespace != "kube-system"
```

关键：

- `failurePolicy: Fail` 会在 webhook 不可用时阻断请求；核心 webhook 必须高可用、PDB、监控。
- `failurePolicy: Ignore` 可能被绕过，不适合强安全策略。
- `namespaceSelector`/`objectSelector`/`matchConditions` 缩小范围，降低故障影响。
- `sideEffects: None` 才能在 dry-run 中调用。
- `timeoutSeconds` 要短，避免请求堆积。
- Webhook 自身要 TLS、证书轮换、最小权限、审计。
- 保护 `ValidatingWebhookConfiguration` / `MutatingWebhookConfiguration` 的 RBAC。

## ValidatingAdmissionPolicy

VAP 用 CEL 写策略：

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: require-run-as-nonroot
spec:
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: ["v1"]
      operations: ["CREATE", "UPDATE"]
      resources: ["pods"]
  validations:
  - expression: "object.spec.securityContext.runAsNonRoot == true"
    message: "runAsNonRoot must be true"
```

优点：

- 不依赖外部 webhook，避免 webhook 故障。
- 策略即代码、易审计。
- 可以配合 `paramKind`/`paramRef` 做参数化。
- 适合替代部分简单 webhook。

限制：

- CEL 能力有限，复杂逻辑仍需 webhook。
- 需要理解 CEL 成本和准入范围。
- 策略变更要测试，避免误杀工作负载。

## 内置准入控制器

- `PodSecurity`：执行 PSS。
- `NodeRestriction`：限制 kubelet 只能改自己的 Node/Pod。
- `ResourceQuota` / `LimitRanger`：资源配额/默认值。
- `ServiceAccount`：自动挂载 SA。
- `DefaultStorageClass`：默认 StorageClass。
- `Priority`：PriorityClass。
- `NamespaceLifecycle`：保护 terminating namespace。

生产建议：

- 开启 `NodeRestriction`。
- 开启 `PodSecurity`。
- 按需启用 `ResourceQuota`、`LimitRanger`。
- 不要随意启用会阻断所有请求的实验性 webhook。

# Pod 安全深水区

## Pod Security Standards

三档：

| 级别 | 目标 |
| ---- | ---- |
| privileged | 几乎不限制，仅用于系统组件 |
| baseline | 阻止已知提权向量 |
| restricted | 最严格，适合大多数应用 |

baseline 主要限制：

- privileged 容器。
- hostNetwork/hostPID/hostIPC。
- hostPath。
- 危险 capabilities。
- hostPorts 等已知提权向量。
- 不安全的 sysctls。
- 部分 AppArmor/SELinux/seccomp 配置。

restricted 追加：

- `allowPrivilegeEscalation: false`。
- `runAsNonRoot: true`。
- `seccompProfile: RuntimeDefault` 或 `Localhost`。
- `capabilities.drop: ["ALL"]`。
- 限制 volume 类型（禁止 hostPath 等）。
- 禁止 privileged。
- 禁止 host namespaces。
- 限制 hostPorts。

注意：

- restricted 不强制 `readOnlyRootFilesystem`，但强烈建议。
- PSS 是基线，不覆盖镜像漏洞、网络策略、RBAC、供应链。
- 版本标签 `pod-security.kubernetes.io/enforce-version` 可以固定到某个 K8s 版本。

## PSA 配置

```yaml
metadata:
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: v1.37
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

- 先在 `audit`/`warn` 观察，再 `enforce`。
- `enforce` 拒绝违规 Pod；`audit` 写审计注解；`warn` 给用户警告。
- Exemption 只应按 namespace/runtimeClass/username 精确配置，不要豁免控制器 SA。
- 监控 `pod_security_evaluations_total`、`pod_security_exemptions_total`。

## SecurityContext 字段

Pod 级：

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  runAsGroup: 10001
  fsGroup: 10001
  fsGroupChangePolicy: OnRootMismatch
  supplementalGroups: [10001]
  seccompProfile:
    type: RuntimeDefault
  appArmorProfile:
    type: RuntimeDefault
```

容器级：

```yaml
securityContext:
  allowPrivilegeEscalation: false
  privileged: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
    add: ["NET_BIND_SERVICE"]
  seLinuxOptions:
    level: "s0:c123,c456"
  procMount: Default
```

注意字段作用域：

- `fsGroup`、`supplementalGroups`、`runAsNonRoot`、`seccompProfile`、`appArmorProfile` 通常在 Pod 级。
- `allowPrivilegeEscalation`、`readOnlyRootFilesystem`、`capabilities`、`privileged` 在容器级。
- `allowPrivilegeEscalation: false` 不能与 privileged 或 `CAP_SYS_ADMIN` 同时使用。
- `readOnlyRootFilesystem` 需要应用把可写目录挂 emptyDir/volume。

## 运行时隔离

- **seccomp**：过滤系统调用；`RuntimeDefault` 是低成本高收益。
- **AppArmor**：限制程序能力；`RuntimeDefault`/`Localhost`。
- **SELinux**：强制访问控制；`seLinuxOptions`。
- **User namespaces**：`hostUsers: false` 让容器内 UID 映射到宿主机非 root；降低逃逸影响，但需要版本/运行时/CNI 支持。
- **gVisor/Kata**：更强隔离，代价是性能/兼容性。
- **readOnlyRootFilesystem**：减少落盘 webshell/篡改。
- **drop ALL capabilities**：只加必要 capability。

## 高危配置

- `privileged: true`
- `hostNetwork/hostPID/hostIPC: true`
- `hostPath` 挂载 `/var/run/docker.sock`、`/proc`、`/etc`、节点根目录
- `CAP_SYS_ADMIN`、`CAP_NET_ADMIN`、`CAP_SYS_PTRACE`
- `procMount: Unmasked`
- `allowPrivilegeEscalation: true`
- 运行 root + 可写 rootfs + 无 seccomp

## 自定义策略

PSA 不够时：

- Kyverno：YAML 策略、validate/mutate/generate/verifyImages。
- Gatekeeper：OPA/Rego，适合复杂策略。
- ValidatingAdmissionPolicy：CEL，轻量、无 webhook。
- 策略要覆盖：镜像仓库、签名、资源限制、hostPath、特权、标签、NetworkPolicy 存在性。

# Secret 加密与工作负载身份

## Secret 的本质

- Secret 默认只是 base64 编码，不是加密。
- 能读 Secret 的人/组件可以解码。
- Secret 存在 etcd；etcd 被攻破 = 所有 Secret 泄露。
- Secret 不是密钥管理系统的替代品。

## etcd 静态加密

`EncryptionConfiguration`：

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  - configmaps
  providers:
  - kms:
      apiVersion: v2
      name: my-kms
      endpoint: unix:///var/run/kms-plugin.sock
      timeout: 3s
  - identity: {}
```

- `identity` 是明文回退，放最后；确认新写入走 KMS。
- `aescbc` 不推荐（padding oracle）。
- `aesgcm` 需要自动轮换（约 20 万次写入）。
- `kms v1` 已弃用，优先 KMS v2。
- KMS v2 使用 envelope encryption：DEK 加密资源，KEK 在外部 KMS。
- `--encryption-provider-config-automatic-reload=true` 可轮换密钥而不重启 apiserver。
- 加密只保护 etcd 静态数据，不保护 API 读取、内存、日志。

## Secret 使用

- 优先 volume 挂载，少用环境变量（环境变量易被日志/子进程泄露）。
- 设置文件权限/只读。
- 使用 `immutable: true` 防止误改。
- RBAC 严格限制 `get/list/watch secrets`。
- 不要把 Secret 提交 Git；用 External Secrets/Vault/云 Secret Manager。
- 轮换要支持双密钥/滚动，避免一次性失效。
- 审计 Secret 读取。

## 工作负载身份

- 使用 projected SA token + audience 对接云 IAM（EKS IRSA、GKE Workload Identity、Azure AD Workload Identity）。
- 避免节点实例角色拥有过宽权限。
- 限制 Pod 访问云元数据（169.254.169.254），优先 IMDSv2、网络策略、代理。
- 每个工作负载独立身份，最小权限。
- 短期凭据优先于长期 AccessKey。

# 网络与运行时深水区

## NetworkPolicy 语义

- 策略是**允许列表**，不是拒绝列表。
- 没有策略选中 Pod 时，默认允许。
- 一旦有策略选中 Pod 且包含 `Ingress`/`Egress`，未明确允许的流量被拒绝。
- `podSelector: {}` 选中命名空间所有 Pod。
- `namespaceSelector` 按命名空间标签选择。
- `ipBlock` 用于外部 CIDR，`except` 排除子网。
- `ports` 可指定协议/端口/`endPort`（需 CNI 支持）。
- `policyTypes` 决定 Ingress/Egress；不写时默认 Ingress，有 egress 规则则加 Egress。
- `hostNetwork` Pod 的行为未定义，通常按节点 IP 处理。
- NetworkPolicy 是 L3/L4，不解析 HTTP；L7 需要 Cilium/Calico 扩展或服务网格。

## 默认拒绝

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: prod
spec:
  podSelector: {}
  policyTypes: ["Ingress", "Egress"]
```

然后按依赖逐条放行：

- DNS（kube-dns/CoreDNS）egress。
- 数据库/缓存/消息队列。
- 入口 Controller/Gateway。
- 监控/日志采集。
- 外部 API。

注意：

- 默认拒绝 Egress 容易漏 DNS，导致解析失败。
- 策略变更要测试，避免把监控/健康检查切断。
- NetworkPolicy 不替代 mTLS/授权。

## 服务网格

- mTLS 提供服务间身份认证和加密。
- AuthorizationPolicy 做 L7 授权。
- 服务网格不替代 RBAC、NetworkPolicy、Pod 安全。
- 控制面本身是高价值目标，要加固。

## Kubelet 加固

关键参数：

```text
--anonymous-auth=false
--authorization-mode=Webhook
--client-ca-file=...
--read-only-port=0
--protect-kernel-defaults=true
--rotate-certificates=true
--rotate-server-certificates=true
--tls-cert-file=...
--tls-private-key-file=...
```

- 默认 `AlwaysAllow` 很危险，必须改 Webhook。
- 关闭只读端口，避免未认证信息泄露。
- 启用证书轮换。
- apiserver 开启 `Node` authorizer + `NodeRestriction` admission。
- kubelet 只能改自己的 Node/Pod，不能读其他节点 Pod。

## 节点安全

- 最小化 OS，禁用不必要服务。
- 及时打补丁；使用不可变节点/托管节点池。
- CIS Benchmark、kube-bench 定期扫描。
- 限制 SSH，使用 SSM/Session Manager/跳板机。
- 节点防火墙只放行必要端口。
- 保护 kubelet 凭据、bootstrap token、节点证书。
- 限制云元数据访问。
- 节点隔离/污点用于敏感工作负载。
- 监控异常进程、文件完整性、网络连接（Falco/Tetragon）。

## 控制面

- apiserver 不暴露公网，使用私网端点/授权网络。
- 关闭匿名认证，开启审计。
- 启用 `Node,RBAC` authorizer。
- 启用 `NodeRestriction`、`PodSecurity`。
- etcd 只监听内网，TLS + client cert auth。
- 控制面节点专用、最小化、打补丁。
- 限制 `--profiling`、`--insecure-port`（已移除）等调试面。
- 保护 kubeconfig、CA、sa key。

# 供应链与准入校验

## 镜像

- 固定 digest，不用浮动 tag/latest。
- 只从可信 registry 拉取；配置 `imagePullSecrets`。
- 私有 registry 做漏洞扫描、签名、保留策略。
- 构建环境隔离，短期凭据，不在镜像层写 secret。
- 基础镜像最小化、定期重建。
- 使用 distroless/非 root 镜像。

## 签名与证明

- cosign/Notation 签名镜像。
- SBOM（SPDX/CycloneDX）记录依赖。
- SLSA provenance 记录构建来源。
- 在准入层校验签名、SBOM、provenance、漏洞等级。
- Kyverno `verifyImages`、Sigstore Policy Controller、Gatekeeper。
- 保留 break-glass 流程，但必须审计。

## 准入策略

- 只允许可信 registry。
- 禁止 latest/无 digest。
- 要求签名/attestation。
- 阻断高危漏洞（按严重级别/可利用性）。
- 校验 Pod 安全上下文。
- 校验资源 limits/requests。
- 校验 NetworkPolicy 存在（部分策略引擎支持）。
- 策略变更走 GitOps + 测试。

## 供应链攻击响应

1. 阻断受影响镜像/仓库。
2. 回滚到已知安全 digest。
3. 重新扫描全部运行镜像。
4. 校验签名/SBOM/provenance。
5. 审计构建链、CI 凭据、registry 权限。
6. 轮换可能泄露的凭据。

# 审计与检测

## 审计策略

级别：

| 级别 | 内容 |
| ---- | ---- |
| None | 不记录 |
| Metadata | 用户、时间、资源、verb、状态码 |
| Request | 加请求体（不含响应） |
| RequestResponse | 请求 + 响应体 |

阶段：

- RequestReceived
- ResponseStarted
- ResponseComplete
- Panic

策略示例：

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
  - group: "rbac.authorization.k8s.io"
    resources: ["rolebindings", "clusterrolebindings"]
  verbs: ["create", "update", "patch", "delete"]
- level: Metadata
  omitStages: ["RequestReceived"]
```

注意：

- 不要对 Secret 开 `RequestResponse`，会把明文写进审计日志。
- 审计日志要接入 SIEM，设置保留/轮转。
- 审计后端可用 log/webhook；webhook 要有缓冲和限流。
- 关注匿名请求、impersonation、exec、Secret 读取、RBAC 变更、Webhook/CRD 变更。

## 检测

- 审计日志异常：非工作时间、异常身份、批量读取 Secret、创建 ClusterRoleBinding、exec 进生产容器。
- 运行时检测：Falco/Tetragon 检测 shell、异常进程、敏感文件访问、逃逸行为。
- 配置检测：kube-bench、Polaris、Trivy config。
- 镜像检测：漏洞、恶意软件、签名。
- 网络检测：异常外联、DNS、端口扫描。

## 指标

- `apiserver_audit_requests_rejected_total`
- `apiserver_audit_error_total`
- `pod_security_evaluations_total`
- `pod_security_exemptions_total`
- `apiserver_admission_webhook_*`
- kubelet/etcd/controller 指标

# 多租户隔离深水区

## 软多租户

Namespace + RBAC + Quota + NetworkPolicy + PSA + 准入。

限制：

- 共享控制面、节点、CNI、DNS、Ingress、存储。
- Namespace 不是强安全边界；节点逃逸/内核漏洞可跨租户。
- 共享 ServiceAccount/Secret/镜像仓库配置可能串租户。
- 资源竞争/噪声邻居。

适用：

- 同一组织内团队隔离。
- 信任度较高、合规要求不极端。

## 强多租户

- 独立集群：最强隔离，成本最高。
- vCluster：虚拟控制面，共享节点，隔离 API；不是强内核隔离。
- Kata Containers/gVisor：更强运行时隔离。
- 独立节点池 + taint/toleration + 网络/存储隔离。
- 独立 etcd/控制面/网络。

## 隔离维度

| 维度 | 措施 |
| ---- | ---- |
| API | RBAC、准入、namespace 隔离 |
| 网络 | NetworkPolicy、mTLS、egress |
| 存储 | StorageClass、PV 隔离、加密 |
| 运行时 | PSA、seccomp、gVisor/Kata、节点隔离 |
| 身份 | 独立 SA、OIDC 组、工作负载身份 |
| 密钥 | 独立 KMS key、External Secrets |
| 观测 | 日志/指标/追踪按租户隔离 |
| 成本 | Quota、计费、限流 |

## 租户边界检查

- 租户能否创建特权 Pod/hostPath？
- 能否访问其他租户 Service/DNS？
- 能否读其他租户 Secret？
- 能否用 NodePort/LoadBalancer 暴露服务？
- 能否用集群级 CRD/Webhook 影响他人？
- 能否耗尽节点资源？
- 能否访问云元数据/共享存储？

# 事件响应与演练

## 场景

| 场景 | 首要动作 |
| ---- | -------- |
| Secret 泄露 | 轮换、撤销、审计读取、排查使用方 |
| SA token 被盗 | 删除 token/SA、收紧 RBAC、查 API 审计 |
| 容器逃逸 | 隔离节点、保留现场、重建节点 |
| 特权 Pod | 删除/隔离、审计创建者、查准入绕过 |
| 镜像投毒 | 阻断镜像、回滚、重扫、查构建链 |
| RBAC 提权 | 撤销绑定、审计 SA/Webhook/CRD |
| 节点沦陷 | cordon/drain、隔离网络、重建节点 |
| etcd 泄露 | 轮换所有 Secret/证书、隔离 etcd、审计 |
| apiserver 暴露 | 关闭公网、轮换凭据、审计访问 |

## 流程

1. **检测**：审计、运行时、告警、用户报告。
2. **遏制**：隔离节点/Pod、撤销凭据、阻断网络。
3. **取证**：保留日志、镜像、进程、网络连接、审计。
4. **根除**：修复漏洞、删除后门、重建节点。
5. **恢复**：轮换密钥、重新部署、验证。
6. **复盘**：时间线、根因、行动项、演练。

## 演练

- 桌面演练：Secret 泄露、RBAC 提权、节点沦陷。
- 技术演练：删 Pod、断网、证书过期、镜像签名失败。
- 红队/渗透：关注容器逃逸、SSRF→元数据、RBAC 链。
- 恢复演练：etcd 备份恢复、集群重建、密钥轮换。

# 集群加固清单

## 控制面

- [ ] apiserver 不暴露公网，使用私网/授权网络
- [ ] `--anonymous-auth=false` 或仅 health 端点匿名
- [ ] `--authorization-mode=Node,RBAC`
- [ ] 启用 `NodeRestriction`、`PodSecurity`
- [ ] 启用审计，接入 SIEM
- [ ] etcd TLS + client cert auth + 静态加密
- [ ] 控制面节点专用、最小化、打补丁
- [ ] 证书到期监控与轮换

## 认证与 RBAC

- [ ] 应用独立 ServiceAccount
- [ ] 不需要 API 的 Pod 关闭 automount
- [ ] 使用短期 projected token/OIDC
- [ ] 禁止应用使用 cluster-admin/system:masters
- [ ] 禁止 RBAC 通配符
- [ ] 高危权限审批/审计
- [ ] 定期清理绑定/账号/token
- [ ] `kubectl auth can-i --list` 巡检

## Pod 与运行时

- [ ] 所有命名空间启用 PSA baseline/restricted
- [ ] 非 root、drop ALL capabilities
- [ ] `allowPrivilegeEscalation: false`
- [ ] seccomp RuntimeDefault
- [ ] AppArmor/SELinux
- [ ] readOnlyRootFilesystem
- [ ] 禁止 privileged/hostNetwork/hostPID/hostIPC
- [ ] 禁止 hostPath 敏感路径
- [ ] 禁止挂载 docker.sock
- [ ] 评估 user namespaces
- [ ] 限制 hostPorts

## 网络

- [ ] 默认拒绝 Ingress/Egress
- [ ] 按依赖放行，包含 DNS
- [ ] CNI 支持 NetworkPolicy
- [ ] 不依赖 NetworkPolicy 做认证
- [ ] mTLS/服务网格按需
- [ ] 限制 NodePort/LoadBalancer
- [ ] 入口统一 Gateway/Ingress + WAF
- [ ] 限制 Pod 访问云元数据

## Secret 与身份

- [ ] etcd 静态加密 KMS v2
- [ ] 密钥轮换/自动 reload
- [ ] Secret 最小读取权限
- [ ] 优先 volume，少用 env
- [ ] External Secrets/Vault/KMS
- [ ] 工作负载身份替代节点 IAM
- [ ] 审计 Secret 读取
- [ ] 不把 Secret 写 Git/镜像/日志

## 供应链

- [ ] 镜像固定 digest
- [ ] 可信 registry/镜像扫描
- [ ] 签名 + SBOM + provenance
- [ ] 准入校验签名/漏洞
- [ ] 构建隔离/短期凭据
- [ ] 禁止 latest/未签名镜像
- [ ] 应急回滚/重扫流程

## 节点与 kubelet

- [ ] kubelet `--anonymous-auth=false`
- [ ] kubelet `--authorization-mode=Webhook`
- [ ] `--read-only-port=0`
- [ ] `--protect-kernel-defaults=true`
- [ ] 证书自动轮换
- [ ] 节点最小化/补丁/ CIS
- [ ] 限制 SSH/元数据
- [ ] 节点隔离/污点用于敏感负载
- [ ] 运行时检测 Falco/Tetragon

## 多租户与运维

- [ ] 明确软/硬多租户边界
- [ ] Quota/LimitRange
- [ ] Namespace 标签/PSA
- [ ] 租户网络/存储/密钥隔离
- [ ] 备份/恢复/演练
- [ ] 事件响应 runbook
- [ ] 定期渗透/红队
- [ ] 安全基线持续扫描

# 官方参考

- [访问控制](https://kubernetes.io/docs/concepts/security/controlling-access/)
- [RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/)
- [Secret 最佳实践](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)
- [加密数据](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/)
- [审计](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/)
- [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)

---
title: Kubernetes集群管理
tags: [Kubernetes, 运维, kubeadm]
date: 2020-04-05 19:06:01
categories: [Kubernetes]
comments: false
---

本文基于 Kubernetes v1.37 官方文档重写，覆盖节点管理、kubeadm 集群生命周期、升级、证书、etcd 备份、自动扩缩容、资源治理和可观测性。

<!--more-->

- [节点管理](#%E8%8A%82%E7%82%B9%E7%AE%A1%E7%90%86)
- [集群安装与高可用](#%E9%9B%86%E7%BE%A4%E5%AE%89%E8%A3%85%E4%B8%8E%E9%AB%98%E5%8F%AF%E7%94%A8)
- [版本升级](#%E7%89%88%E6%9C%AC%E5%8D%87%E7%BA%A7)
- [证书管理](#%E8%AF%81%E4%B9%A6%E7%AE%A1%E7%90%86)
- [etcd 备份与恢复](#etcd-%E5%A4%87%E4%BB%BD%E4%B8%8E%E6%81%A2%E5%A4%8D)
- [自动扩缩容](#%E8%87%AA%E5%8A%A8%E6%89%A9%E7%BC%A9%E5%AE%B9)
- [资源治理](#%E8%B5%84%E6%BA%90%E6%B2%BB%E7%90%86)
- [可观测性](#%E5%8F%AF%E8%A7%82%E6%B5%8B%E6%80%A7)
- [灾备与演练](#%E7%81%BE%E5%A4%87%E4%B8%8E%E6%BC%94%E7%BB%83)
- [排障](#%E6%8E%92%E9%9A%9C)
- [企业实践](#%E4%BC%81%E4%B8%9A%E5%AE%9E%E8%B7%B5)

# 节点管理

## Node 状态

```bash
kubectl get nodes -o wide
kubectl describe node <node>
```

常见 Conditions：

- `Ready`：kubelet 健康、网络可用
- `MemoryPressure`：内存压力
- `DiskPressure`：磁盘压力
- `PIDPressure`：进程数压力
- `NetworkUnavailable`：网络未就绪

节点 NotReady 时，Pod 不会立即被驱逐：默认约 40s 标记 NotReady，随后 NoExecute 污点的 `tolerationSeconds=300` 到期才开始驱逐；分别由 `node-monitor-grace-period` 和污点容忍控制。

## 隔离与恢复

```bash
kubectl cordon <node>      # 标记不可调度
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
kubectl uncordon <node>    # 恢复调度
```

`drain` 会：

- 驱逐节点上的 Pod
- 遵守 PDB
- 跳过 DaemonSet（需要 `--ignore-daemonsets`）
- 删除 emptyDir 数据（需要 `--delete-emptydir-data`）

节点维护前要确认关键服务有多副本和 PDB。

## 污点与容忍

```bash
kubectl taint node <node> dedicated=gpu:NoSchedule
kubectl taint node <node> dedicated=gpu:NoSchedule-
```

Pod 需要对应 toleration：

```yaml
tolerations:
- key: dedicated
  operator: Equal
  value: gpu
  effect: NoSchedule
```

控制平面污点通常是 `node-role.kubernetes.io/control-plane:NoSchedule`；旧 `master` 污点在新集群中不再默认存在。

## 节点扩容

- 云环境：Cluster Autoscaler、Karpenter、节点池
- 裸金属：手动加入节点或使用 Cluster API
- 新节点加入后确认 CNI、kube-proxy、kubelet、容器运行时和证书正常

![节点容量](https://kubernetes.io/images/docs/node-capacity.svg)

*图 1：节点 Capacity、Allocatable 与资源保留*

节点可分配资源 = Capacity - 系统保留 - kubelet 保留 - 驱逐阈值。调度只看 requests。

# 集群安装与高可用

## kubeadm 高可用

![kubeadm 外部 etcd 拓扑](https://kubernetes.io/images/kubeadm/kubeadm-ha-topology-external-etcd.svg)

*图 2：kubeadm 高可用集群（外部 etcd）*

生产建议：

- 控制面至少 3 个节点
- etcd 3 或 5 副本，独立磁盘
- apiserver 前放负载均衡器
- kubelet/kubectl 通过 VIP 访问
- 控制面和 etcd 做反亲和

## 初始化

```bash
kubeadm init --control-plane-endpoint=<VIP>:6443 \
  --pod-network-cidr=10.244.0.0/16 \
  --service-cidr=10.96.0.0/12 \
  --upload-certs
```

加入 worker：

```bash
kubeadm join <VIP>:6443 --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>
```

加入其他控制面：

```bash
kubeadm join <VIP>:6443 --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash> \
  --control-plane --certificate-key <key>
```

安装 CNI 后再确认 CoreDNS 和节点 Ready。

## kubeadm 配置

kubeadm 配置 API 会随版本演进，使用当前版本生成模板：

```bash
kubeadm config print init-defaults
kubeadm config print join-defaults
```

当前 kubeadm 配置 API 是 `kubeadm.k8s.io/v1beta4`。使用当前版本生成模板，不要照抄旧版本的 `v1beta2`/`v1beta3` 配置。

# 版本升级

原则：

- 一次只升一个 minor
- 先控制面，再 kubelet/kube-proxy，最后工作负载
- 升级前扫描已移除 API
- 升级前备份 etcd
- 升级后验证 CNI、CoreDNS、Ingress、存储和关键业务

版本偏差：

- kubelet、kube-proxy 最多可落后 apiserver 3 个 minor
- kube-controller-manager、kube-scheduler、cloud-controller-manager 最多落后 apiserver 1 个 minor，且不得新于 apiserver
- kubectl 支持 ±1 个 minor
- HA 中 apiserver 实例之间最多差 1 个 minor

具体以官方 Version Skew Policy 为准。

升级前检查 cgroup 版本：v1.37 的 kubelet 默认 `FailCgroupV1: true`，只支持 cgroup v2。cgroup v1 节点必须先迁移到 v2，否则升级后 kubelet 启动失败。

## 控制面升级

```bash
kubeadm upgrade plan
kubeadm upgrade apply v1.37.1
```

第一个控制面节点用 `apply`；其余控制面节点先升级 kubeadm 包，再执行 `kubeadm upgrade node`。

## 节点升级

```bash
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
# 先升级 kubeadm 包
kubeadm upgrade node
# 再升级 kubelet/kubectl
systemctl daemon-reload
systemctl restart kubelet
kubectl uncordon <node>
```

逐个节点升级，确认业务可用后再继续。

## 升级前检查

```bash
kubectl api-resources
kubectl get --raw /metrics | head
kubectl get events -A --sort-by=.lastTimestamp
```

可用 pluto、kubent 等工具扫描已移除 API。

# 证书管理

```bash
kubeadm certs check-expiration
kubeadm certs renew all
```

要点：

- CA 有效期长，叶子证书通常 1 年
- 升级时注意轮换
- kubelet 客户端证书可以开启自动轮换
- 不要把私钥提交到 Git
- 所有控制面共享同一 CA；在每个控制面节点分别执行 `kubeadm certs renew all` 并重启静态 Pod，不要复制叶子证书

# etcd 备份与恢复

## 备份

```bash
etcdctl snapshot save snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

## 恢复

```bash
etcdutl --data-dir=/var/lib/etcd-restore snapshot restore snapshot.db
```

恢复前要停止所有 apiserver 和 etcd 进程；在所有 etcd 成员上恢复同一快照并配置 `initial-cluster`，再重启 etcd 和 apiserver。`etcdctl snapshot restore` 已标记为 Deprecated，优先使用 `etcdutl`。

注意：

- 不要直接复制 etcd 数据目录
- 定期做恢复演练
- 关注 quorum、defrag、compaction
- 备份文件要异地保存并加密

# 自动扩缩容

## HPA

![HPA 架构](https://kubernetes.io/images/docs/horizontal-pod-autoscaler.svg)

*图 3：HPA 根据指标调整副本数*

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

依赖 metrics-server 或自定义指标适配器；没有 requests 时 CPU 利用率无法计算。

## VPA

![VPA 架构](https://kubernetes.io/images/docs/concepts/vpa-architecture.svg)

*图 4：VPA 架构*

VPA 默认只调整 requests（`controlledValues: RequestsOnly`），不会改 limits；需要同时调整时显式设置 `controlledValues: RequestsAndLimits`。需要单独部署 CRD 和组件。与 HPA 同时使用时注意指标冲突，常见做法是 HPA 用 CPU/自定义指标，VPA 只做推荐模式。

## Cluster Autoscaler

按 Pending Pod 扩容节点，缩容时尊重 PDB、DaemonSet 和本地存储。云上也可用 Karpenter 做更灵活的节点供给。

# 资源治理

## Requests/Limits

- 所有 Pod 设置 requests/limits
- CPU limit 过紧会导致节流
- 内存 limit 过紧会 OOMKilled
- requests 决定调度和容量规划

## LimitRange

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default
  namespace: prod
spec:
  limits:
  - type: Container
    defaultRequest:
      cpu: 100m
      memory: 128Mi
    default:
      cpu: 500m
      memory: 256Mi
```

## ResourceQuota

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: prod-quota
  namespace: prod
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    count/pods: "100"
    count/persistentvolumeclaims: "20"
    requests.storage: 500Gi
```

PV 是集群级资源，不在 Namespace 配额内；配额统计的是 PVC 数量和存储请求。

# 可观测性

- metrics-server：Resource Metrics API
- Prometheus + Grafana：集群、节点、Pod、控制器指标
- 日志：Fluent Bit/Vector → Loki/Elasticsearch
- 事件：`kubectl get events --sort-by=.lastTimestamp`
- 审计日志：apiserver audit policy
- 控制面指标：apiserver、etcd、scheduler、controller-manager

关键告警：

- 节点 NotReady
- etcd leader 变化、fsync 延迟、quorum 风险
- apiserver 5xx、限流
- Pending Pod 持续增长
- PVC 使用率、inode
- HPA 达到 maxReplicas
- 证书到期

# 灾备与演练

- 定期备份 etcd、PVC 快照、GitOps 仓库和密钥
- 定期做节点故障、控制面故障、可用区故障演练
- 验证恢复时间目标（RTO）和恢复点目标（RPO）
- 多集群场景设计好 DNS、证书、网络和流量切换
- 不要只备份不演练

# 排障

## 节点 NotReady

```bash
systemctl status kubelet
journalctl -u kubelet -f
crictl ps
crictl info
```

检查：

- kubelet 证书
- 容器运行时
- CNI
- 磁盘/inode
- 内存/PID 压力
- apiserver 连通性

## Pending

- 资源不足
- 污点/亲和性
- PVC 未绑定
- 节点 NotReady
- 配额不足会在创建阶段直接拒绝（Forbidden），不是 Pending；PDB 只影响驱逐，不影响调度

```bash
kubectl describe pod <pod> -n <ns>
kubectl get events -n <ns> --sort-by=.lastTimestamp
```

## 频繁驱逐

- 节点 MemoryPressure/DiskPressure/PIDPressure 和 kubelet 驱逐阈值
- requests 过大导致 Pending；超过 CPU limit 导致节流，超过 memory limit 导致 OOMKilled
- 检查 QoS 和 PriorityClass

## 升级失败

- 版本跨度过大
- 已移除 API
- 证书过期
- CNI/CRI 不兼容
- etcd 不健康
- Kubernetes 不支持 minor 就地降级；失败时重跑 `kubeadm upgrade`（幂等）或 `kubeadm upgrade apply --force`，必要时从 etcd 快照恢复并用相同版本重建控制面

# 企业实践

## 集群拓扑

- 控制面至少 3 节点，etcd 3 或 5 副本，跨可用区部署
- 控制面、etcd、工作负载按故障域反亲和
- 不要盲目增加小集群；优先“少量大集群 + Namespace 多租户”
- 需要强隔离、合规或不同网络域时再拆集群
- 区分管理集群和业务集群，避免平台组件和业务互相影响
- 负载均衡器放在 apiserver 前，kubelet/kubectl 通过 VIP 访问

## 节点池

按业务拆分节点池：

- 系统池：CoreDNS、CNI、Ingress、监控、日志
- 普通业务池：无状态服务
- GPU/高性能池：AI、渲染、视频
- 内存型池：缓存、大数据
- Spot/抢占池：可中断的批处理和无状态服务

配套：

- 用 taint/toleration 和 nodeAffinity 隔离
- 节点镜像标准化，预装运行时、CNI、监控 agent
- 节点自动修复和替换，避免手工修节点
- 控制节点最大 Pod 数、IP 耗尽和磁盘水位
- 节点维护走 cordon/drain/uncordon，遵守 PDB

## 升级

- 一次只升一个 minor，先测试集群再生产
- 控制面 → kubelet/kube-proxy → 工作负载
- 第一个控制面用 `kubeadm upgrade apply`，其余用 `kubeadm upgrade node`
- 升级前扫描已移除 API，备份 etcd，确认 cgroup v2
- 升级后验证 CNI、CoreDNS、Ingress、存储和关键业务
- Kubernetes 不支持 minor 降级，回滚以应用层和配置层为主
- 设置变更窗口和冻结期，避免和大促/发布冲突

## 证书与 etcd

- 所有控制面共享同一 CA，每个节点分别 renew，不复制叶子证书
- `kubeadm certs check-expiration` 纳入监控
- kubelet 客户端证书开启自动轮换
- etcd 使用 `etcdutl snapshot save` 备份，异地加密保存
- 恢复前停止 apiserver/etcd，在所有成员上恢复同一快照
- 定期做恢复演练，验证 RTO/RPO
- 关注 etcd quorum、fsync 延迟、defrag 和 compaction

## 自动扩缩容

- HPA：按 CPU/内存/自定义指标扩 Pod，设置 maxReplicas 和 behavior
- VPA：默认只调 requests，适合 rightsizing；和 HPA 同时用要避免冲突
- Cluster Autoscaler/Karpenter：按 Pending Pod 扩节点
- 设置节点上限和预算告警，防止成本失控
- 考虑冷启动、镜像拉取、CNI IP 和调度拓扑
- 缩容尊重 PDB、DaemonSet、本地存储和长连接

## 可观测性

- 指标：集群、节点、Pod、控制器、etcd、apiserver、scheduler
- 日志：系统组件、审计、业务日志统一采集
- 事件：`kubectl get events` 纳入告警
- 审计：apiserver audit 接入 SIEM
- SLO：可用性、延迟、错误率、饱和度
- 告警分级：P0/P1 电话，P2 工单，避免告警疲劳

## 灾备

- 明确 RTO/RPO，按业务分级
- 备份 etcd、PVC 快照、GitOps 仓库、密钥和镜像
- 多集群/多区域设计 DNS、证书、网络和流量切换
- 恢复顺序：基础设施 → 控制面 → 网络/存储 → 工作负载
- 定期演练节点故障、控制面故障、可用区故障和误删恢复
- 不要只备份不演练

## 变更管理

- 集群组件和应用配置都走 GitOps
- 变更前 diff、dry-run、测试集群验证
- 高风险变更双人复核，保留回滚方案
- 记录变更窗口、影响范围和验证步骤
- 变更后观察 SLO 和关键业务指标
- 定期清理技术债和手工配置漂移

## 官方参考

- [kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/)
- [升级集群](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/)
- [证书](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)
- [etcd 备份](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/)
- [版本偏差](https://kubernetes.io/releases/version-skew-policy/)
- [节点管理](https://kubernetes.io/docs/concepts/architecture/nodes/)

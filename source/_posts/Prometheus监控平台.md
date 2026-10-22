---
title: Prometheus监控平台
tags: [Prometheus, 监控, SRE, Kubernetes, PromQL]
categories: [监控]
date: 2019-12-13 11:41:10
comments: false
---

Prometheus 是 CNCF 毕业项目，最初由 SoundCloud 开发，现已成为云原生指标监控的事实标准。它负责采集、存储、查询指标并触发告警，通常与 Grafana、Alertmanager、Exporter 和 Kubernetes 生态一起使用。

本文基于 Prometheus 3.x 重写，覆盖核心架构、数据模型、配置、PromQL、告警、Kubernetes 落地、生产容量、高可用、安全、自监控和 3.x 升级。最后复核时间：2026-10。

> Prometheus 专注**指标（metrics）**，不替代日志（Loki/ELK）和链路追踪（Tempo/Jaeger）。它也不是计费级精确系统，采集丢失、重启和网络分区都可能造成数据缺口。

<!-- more -->

- [Prometheus 简介](#prometheus-%E7%AE%80%E4%BB%8B)
- [核心架构](#%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84)
- [数据模型](#%E6%95%B0%E6%8D%AE%E6%A8%A1%E5%9E%8B)
- [安装与启动](#%E5%AE%89%E8%A3%85%E4%B8%8E%E5%90%AF%E5%8A%A8)
- [配置体系](#%E9%85%8D%E7%BD%AE%E4%BD%93%E7%B3%BB)
- [服务发现与 Relabel](#%E6%9C%8D%E5%8A%A1%E5%8F%91%E7%8E%B0%E4%B8%8E-relabel)
- [PromQL](#promql)
- [告警与 Alertmanager](#%E5%91%8A%E8%AD%A6%E4%B8%8E-alertmanager)
- [Kubernetes 监控](#kubernetes-%E7%9B%91%E6%8E%A7)
- [生产实践](#%E7%94%9F%E4%BA%A7%E5%AE%9E%E8%B7%B5)
- [高可用与长期存储](#%E9%AB%98%E5%8F%AF%E7%94%A8%E4%B8%8E%E9%95%BF%E6%9C%9F%E5%AD%98%E5%82%A8)
- [安全](#%E5%AE%89%E5%85%A8)
- [自监控与排错](#%E8%87%AA%E7%9B%91%E6%8E%A7%E4%B8%8E%E6%8E%92%E9%94%99)
- [升级到 Prometheus 3.x](#%E5%8D%87%E7%BA%A7%E5%88%B0-prometheus-3x)
- [最佳实践清单](#%E6%9C%80%E4%BD%B3%E5%AE%9E%E8%B7%B5%E6%B8%85%E5%8D%95)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# Prometheus 简介

## 它解决什么问题

- **指标采集**：从应用、主机、中间件、Kubernetes 组件拉取时间序列数据。
- **多维数据模型**：用 metric name + labels 描述数据，支持灵活聚合和切片。
- **PromQL**：强大的查询语言，可直接计算速率、分位数、错误预算等。
- **告警**：基于 PromQL 规则触发告警，交给 Alertmanager 分组、抑制、路由。
- **服务发现**：与 Kubernetes、Consul、DNS、文件等集成，目标自动上下线。

## 优势

- 单二进制、部署简单，不依赖外部数据库即可运行。
- Pull 模型便于服务发现、目标健康检查和统一治理。
- 标签模型非常适合云原生和动态环境。
- 生态成熟：Exporter、Operator、Grafana、Alertmanager、Thanos/Mimir/VictoriaMetrics。
- PromQL 表达能力强，适合做 SLO、容量分析和故障定位。

## 局限

- 本地 TSDB 不是分布式系统，单节点有容量上限。
- 默认不带认证授权，不能直接暴露公网。
- 不擅长高基数（high cardinality）数据，标签爆炸会导致 OOM 和查询变慢。
- 不适合做计费、审计、精确一次的数据统计。
- 日志和追踪需要其他系统配合。
- 长期存储、全局查询、跨集群聚合需要额外组件。

## 生态组件

| 组件 | 作用 |
| ---- | ---- |
| Prometheus Server | 采集、存储、查询、规则评估 |
| Exporter | 把第三方系统指标转成 Prometheus 格式 |
| Pushgateway | 短生命周期任务的推送中转 |
| Alertmanager | 告警分组、抑制、静默、路由、通知 |
| Grafana | 可视化与 Dashboard |
| Prometheus Operator | Kubernetes 上的 CRD 化部署与管理 |
| Thanos / Mimir / VictoriaMetrics | 长期存储、全局查询、高可用 |
| Prometheus Agent | 只采集和 remote write，不做本地查询 |

# 核心架构

```text
┌──────────────┐     ┌──────────────────┐
│ Targets      │     │ Service Discovery │
│ exporters    │────▶│ K8s / DNS / file  │
│ apps / kubelet│     └────────┬─────────┘
└──────┬───────┘              │
       │ scrape（pull）        │
       ▼                      ▼
┌─────────────────────────────────────┐
│          Prometheus Server          │
│  Retrieval → TSDB → Rule Evaluation │
│  HTTP API / Query / UI              │
└───────┬──────────────────┬──────────┘
        │                  │
        │ alerts           │ remote write
        ▼                  ▼
┌──────────────┐    ┌──────────────────┐
│ Alertmanager │    │ Long-term Store  │
│ route/group  │    │ Thanos/Mimir/VM  │
└──────┬───────┘    └──────────────────┘
       │
       ▼
 Email / Slack / PagerDuty / Webhook
```

## 核心模块

| 模块 | 说明 |
| ---- | ---- |
| Retrieval | 按 `scrape_configs` 拉取目标指标 |
| TSDB | 本地时序数据库，2 小时一个 block，WAL 保证崩溃恢复 |
| Rule Evaluation | 周期性执行 recording rules 和 alerting rules |
| HTTP API | 查询、目标、规则、告警、状态等接口 |
| Service Discovery | 自动发现抓取目标 |
| Remote Write/Read | 与外部长期存储集成 |

## Pull 与 Push

Prometheus 默认是 **Pull**：

- Prometheus 主动按周期抓取目标，天然知道目标是否存活（`up` 指标）。
- 目标不需要知道 Prometheus 地址，便于解耦和动态发现。
- 采集节奏、超时、并发由 Prometheus 统一控制。

Pushgateway 只用于**短生命周期任务**：

- cron、批处理、Serverless、CI Job 等可能在 Prometheus 抓取前就结束的任务。
- Pushgateway 不会自动过期旧指标，任务结束后要主动删除对应 group。
- 不要用 Pushgateway 做长期服务的通用上报，也不要用它做高可用存储。
- 对实时性要求高的场景，优先缩短 `scrape_interval` 或使用 Agent/OTLP/remote write。

## 部署形态

| 形态 | 适用 |
| ---- | ---- |
| 单机 Prometheus | 小规模、测试、边缘 |
| Prometheus + remote write | 本地短保留 + 长期存储 |
| 双副本 Prometheus | 高可用采集，查询层去重 |
| Prometheus Agent | 多集群/边缘只采集转发 |
| Prometheus Operator | Kubernetes 生产环境 |
| Thanos/Mimir/VictoriaMetrics | 全局查询、长期存储、大规模 |

# 数据模型

## 时间序列

Prometheus 中的数据是时间序列：

```text
<metric_name>{<label_name>="<label_value>", ...} <value> <timestamp>
```

例如：

```text
http_requests_total{job="api", instance="10.0.0.1:8080", method="GET", code="200"} 1024
```

- **metric name**：指标名称，例如 `http_requests_total`。
- **labels**：维度键值对，例如 `job`、`instance`、`method`、`code`。
- **sample**：一个时间戳 + 一个 float64 值；直方图样本还包含 count/sum/buckets。
- 每个唯一的 label 组合都是一条独立时间序列。

## 命名规则

Prometheus 3.x 支持 UTF-8 metric/label 名称，但为了兼容性和可读性，建议遵循传统规则：

| 对象 | 推荐规则 | 示例 |
| ---- | -------- | ---- |
| metric name | `[a-zA-Z_:][a-zA-Z0-9_:]*` | `http_requests_total` |
| label name | `[a-zA-Z_][a-zA-Z0-9_]*` | `method`、`status_code` |
| label value | UTF-8 字符串 | `GET`、`prod` |
| counter 后缀 | `_total` | `process_cpu_seconds_total` |
| 时间单位 | 秒，后缀 `_seconds` | `request_duration_seconds` |
| 字节单位 | bytes，后缀 `_bytes` | `node_memory_MemTotal_bytes` |
| 比例 | 0-1，后缀 `_ratio` | `disk_usage_ratio` |
| 信息类指标 | `_info` | `build_info` |

不要把这些维度放进 metric name：`http_get_users_total`、`http_post_users_total`，应该用 `http_requests_total{method="GET"}`。

## 四种指标类型

| 类型 | 特点 | 典型用途 | 查询方式 |
| ---- | ---- | -------- | -------- |
| Counter | 只增不减，进程重启会归零 | 请求数、错误数、字节数 | `rate()`、`increase()` |
| Gauge | 可增可减 | 温度、内存、队列长度 | 直接查询、`delta()`、`predict_linear()` |
| Histogram | 客户端分桶，服务端计算分位数 | 请求延迟、响应大小 | `histogram_quantile()` |
| Summary | 客户端计算分位数 | 单实例延迟观察 | 直接查询 `quantile` |

### Histogram 与 Summary

- Histogram 暴露 `_bucket{le="..."}`、`_count`、`_sum`，可以跨实例、跨时间聚合，适合 SLO。
- Summary 暴露 `_count`、`_sum` 和客户端计算好的分位数，不能跨实例聚合。
- 做服务端延迟 SLO 时优先 Histogram；Summary 适合单实例、客户端分位数已足够的场景。
- Prometheus 3.x 支持 **native histograms**，一个样本包含完整直方图，桶更细、存储更省；3.9 起原生直方图已稳定，抓取需在 scrape 配置中开启 `scrape_native_histograms`。
- 经典 Histogram 的 `le` 标签在 v3 中会被规范化（例如 `1` 变成 `1.0`），升级时要检查直接引用整数值的查询和告警。

## 基数

**基数 = 唯一时间序列数量**。它由 metric 数量和 label 组合决定。

高基数标签的典型来源：

- `user_id`、`request_id`、`session_id`、`email`
- 完整 URL、原始 IP、动态容器名
- 无界的错误信息、SQL 语句
- 每个请求都不同的标签值

高基数会导致：

- 内存和磁盘暴涨。
- 查询变慢，甚至 OOM。
- `scrape` 变慢、规则评估超时。
- 远端存储成本上升。

治理手段：

- 从源头减少标签，不要把高基数字段做成 label。
- 用 `metric_relabel_configs` 丢弃或重写不需要的指标。
- 设置 `sample_limit`、`label_limit`、`target_limit`。
- 监控 `prometheus_tsdb_head_series` 和 `scrape_samples_scraped`。
- 对日志类、事件类数据使用日志系统，不要塞进 Prometheus。

# 安装与启动

## 二进制安装

从官方下载对应平台压缩包，解压后得到 `prometheus`、`promtool`：

```bash
tar xzf prometheus-*.tar.gz
sudo install -m 0755 prometheus-*/prometheus /usr/local/bin/
sudo install -m 0755 prometheus-*/promtool /usr/local/bin/
```

创建配置目录和数据目录：

```bash
sudo mkdir -p /etc/prometheus /var/lib/prometheus
sudo chown -R prometheus:prometheus /var/lib/prometheus
```

## 最小配置

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

rule_files: []

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]
```

启动：

```bash
prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus \
  --storage.tsdb.retention.time=15d \
  --web.listen-address=:9090
```

生产建议：

- 固定版本，不要使用 `latest`。
- 配置和数据目录分离，数据目录使用独立磁盘。
- 需要热加载时再加 `--web.enable-lifecycle`，并限制访问来源。
- 启动前执行 `promtool check config /etc/prometheus/prometheus.yml`。

## systemd

```ini
[Unit]
Description=Prometheus
After=network-online.target
Wants=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/usr/local/bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus \
  --storage.tsdb.retention.time=15d \
  --web.listen-address=:9090
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 健康检查

| 接口 | 用途 |
| ---- | ---- |
| `GET /-/healthy` | 进程健康 |
| `GET /-/ready` | 可以接收查询 |
| `GET /metrics` | Prometheus 自身指标 |
| `GET /api/v1/targets` | 抓取目标状态 |
| `GET /api/v1/rules` | 规则状态 |
| `GET /api/v1/alerts` | 当前告警 |

# 配置体系

## 配置结构

```yaml
global:
  scrape_interval: 15s
  scrape_timeout: 10s
  evaluation_interval: 15s
  external_labels:
    cluster: prod
    replica: "0"

rule_files:
  - /etc/prometheus/rules/*.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

scrape_configs:
  - job_name: node
    static_configs:
      - targets:
          - node-1:9100
          - node-2:9100

remote_write:
  - url: https://mimir.example.com/api/v1/push
    queue_config:
      max_samples_per_send: 10000
```

## scrape_config 关键项

| 配置 | 说明 |
| ---- | ---- |
| `job_name` | 抓取任务名，默认写入 `job` 标签 |
| `scrape_interval` | 抓取周期，默认继承 global |
| `scrape_timeout` | 单次抓取超时，不能大于 interval |
| `metrics_path` | 指标路径，默认 `/metrics` |
| `scheme` | `http` 或 `https` |
| `honor_labels` | 是否保留目标上报的 `job`/`instance` 标签 |
| `honor_timestamps` | 是否使用目标上报的时间戳 |
| `sample_limit` | 单次抓取最大样本数，超出则失败 |
| `label_limit` | 单个样本最大标签数 |
| `target_limit` | 最大目标数 |
| `body_size_limit` | 响应体大小限制 |
| `metric_relabel_configs` | 入库前对样本做 relabel |
| `relabel_configs` | 抓取前对目标做 relabel |
| `fallback_scrape_protocol` | Content-Type 无效时的回退协议（v3 更严格） |

### relabel_configs 与 metric_relabel_configs

| 配置 | 作用阶段 | 典型用途 |
| ---- | -------- | -------- |
| `relabel_configs` | 发现目标后、抓取前 | 过滤目标、改写地址、添加标签 |
| `metric_relabel_configs` | 抓取后、入库前 | 丢弃高基数指标、重命名标签、过滤样本 |

常用 action：

| action | 作用 |
| ------ | ---- |
| `replace` | 正则匹配后替换 `target_label` |
| `keep` | 只保留匹配的目标/样本 |
| `drop` | 丢弃匹配的目标/样本 |
| `labelmap` | 把匹配的标签名映射为新标签名 |
| `labeldrop` | 删除匹配的标签 |
| `labelkeep` | 只保留匹配的标签 |
| `hashmod` | 按哈希取模，用于分片 |
| `lowercase` / `uppercase` | 标签值大小写转换 |

示例：只抓取带注解的 Kubernetes Service，并丢弃高基数指标：

```yaml
scrape_configs:
  - job_name: kubernetes-services
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
        action: keep
        regex: "true"
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_service_name]
        target_label: service
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: "go_.*"
        action: drop
```

## 配置校验与热加载

```bash
promtool check config /etc/prometheus/prometheus.yml
promtool check rules /etc/prometheus/rules/*.yml
curl -X POST http://localhost:9090/-/reload
```

注意：

- `/-/reload` 需要 `--web.enable-lifecycle`。
- 配置错误时 reload 会失败，旧配置继续生效。
- 生产环境应把配置纳入 Git，CI 中执行 `promtool check`，避免手改。

## 存储参数

| 参数 | 说明 |
| ---- | ---- |
| `--storage.tsdb.path` | 数据目录 |
| `--storage.tsdb.retention.time` | 保留时间，默认 15d |
| `--storage.tsdb.retention.size` | 保留大小，默认不限制 |
| `--storage.tsdb.wal-compression` | WAL 压缩，新版本默认开启 |
| `--storage.tsdb.retention.size` | 建议不超过磁盘的 80%-85%，给 compaction 留空间 |

旧版的 `--storage.tsdb.retention` 已不再推荐，统一使用 `.time` 和 `.size`。

# 服务发现与 Relabel

## 常见服务发现

| 类型 | 适用 |
| ---- | ---- |
| `static_configs` | 固定目标，测试或小规模 |
| `file_sd_configs` | 文件动态更新，适合外部系统生成 |
| `dns_sd_configs` | 基于 DNS SRV/A 记录 |
| `kubernetes_sd_configs` | Kubernetes 原生发现 |
| `consul_sd_configs` | Consul 服务目录 |
| `http_sd_configs` | 通过 HTTP 接口返回目标列表 |

## Kubernetes SD role

| role | 发现对象 | 典型用途 |
| ---- | -------- | -------- |
| `node` | 节点 | node-exporter、kubelet |
| `service` | Service | blackbox 探针、Service 级监控 |
| `pod` | Pod | 直接抓取 Pod |
| `endpoints` | Endpoints | 抓取 Service 后端 |
| `endpointslice` | EndpointSlice | 大规模集群，替代 endpoints |
| `ingress` | Ingress | Ingress 探针 |

常用 meta label：

- `__meta_kubernetes_namespace`
- `__meta_kubernetes_pod_name`
- `__meta_kubernetes_pod_label_<label>`
- `__meta_kubernetes_service_name`
- `__meta_kubernetes_service_annotation_<annotation>`
- `__meta_kubernetes_node_name`
- `__meta_kubernetes_endpoint_address_target_kind`

这些 `__meta_*` 标签默认不会入库，需要在 `relabel_configs` 中转成正式标签。

## Kubernetes 自动发现示例

```yaml
scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: "true"
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
      - source_labels: [__meta_kubernetes_pod_label_app]
        target_label: app
```

注解约定建议统一，例如：

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
```

## Relabel 注意事项

- `regex` 默认是**全匹配**，不是包含匹配；需要包含时写成 `.*foo.*`。
- `replace` 不匹配时不会写入。
- `labelmap` 常用于把 `__meta_kubernetes_pod_label_*` 转成业务标签。
- `metric_relabel_configs` 不作用于 `up` 等自动生成的时间序列。
- 不要保留 `__meta_*` 标签，否则会造成高基数和存储浪费。
- `honor_labels: true` 适合 federation/Pushgateway，普通抓取一般保持 false。

# PromQL

## 基础选择器

```promql
# 瞬时向量
http_requests_total{job="api", code="500"}

# 正则匹配
http_requests_total{code=~"5.."}

# 排除
http_requests_total{code!~"2..|3.."}

# 区间向量
http_requests_total{job="api"}[5m]

# 位移
http_requests_total{job="api"} offset 1h

# @ 修饰符
http_requests_total{job="api"} @ 1609746000
```

## 常用函数

| 函数 | 用途 | 注意 |
| ---- | ---- | ---- |
| `rate(v[5m])` | 每秒平均增长率 | 窗口至少为 scrape interval 的 4 倍 |
| `irate(v[5m])` | 最后两个样本的瞬时增长率 | 噪声大，不建议用于告警 |
| `increase(v[5m])` | 区间增长量 | 会做外推，短窗口可能不准 |
| `delta(v[5m])` | Gauge 区间差值 | 不适合 Counter |
| `histogram_quantile(0.99, v)` | 经典直方图分位数 | 先 `sum by (le)` 聚合 |
| `absent(v)` | 指标缺失时返回 1 | 用于检测采集缺失 |
| `predict_linear(v[1h], 3600)` | 线性预测未来值 | 适合磁盘/容量告警 |
| `label_replace()` | 生成/改写标签 | 常用于补全 `instance` |
| `label_join()` | 拼接标签 | 生成复合维度 |
| `topk(5, v)` | 取前 5 | 适合看热点 |
| `quantile(0.9, v)` | 聚合分位数 | 不是时间序列分位数 |

## 常见查询

### 实例存活

```promql
up == 0
```

### CPU 使用率

```promql
100 - (
  avg by (instance) (
    rate(node_cpu_seconds_total{mode="idle"}[5m])
  ) * 100
)
```

### 内存使用率

```promql
1 - (
  node_memory_MemAvailable_bytes
  /
  node_memory_MemTotal_bytes
)
```

### 文件系统使用率

```promql
1 - (
  node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"}
  /
  node_filesystem_size_bytes{fstype!~"tmpfs|overlay"}
)
```

### HTTP 5xx 比例

```promql
sum(rate(http_requests_total{job="api", code=~"5.."}[5m]))
/
sum(rate(http_requests_total{job="api"}[5m]))
```

### p99 延迟（经典 Histogram）

```promql
histogram_quantile(
  0.99,
  sum by (le) (
    rate(http_request_duration_seconds_bucket{job="api"}[5m])
  )
)
```

### SLO 错误预算燃尽率

```promql
(
  sum(rate(http_requests_total{job="api", code=~"5.."}[1h]))
  /
  sum(rate(http_requests_total{job="api"}[1h]))
) / 0.001
```

表示 99.9% SLO 的 1 小时燃尽率。燃尽率 1 表示按当前速度会在 30 天内用完预算。

## PromQL 常见坑

- **不要用平均值做延迟 SLO**，用比例或分位数。
- **不要对 Counter 直接求平均**，先 `rate`。
- **不要用 `irate` 做告警**，最后两个点波动大，容易误报。
- **`rate` 窗口太短**会没有足够样本，至少 2 个，建议 4 倍 scrape interval。
- **`histogram_quantile` 前忘记 `sum by (le)`**，会得到每个实例的分位数而不是全局分位数。
- **标签不匹配导致空结果**：用 `on()` / `ignoring()` / `group_left()` 明确匹配关系。
- **高基数正则**：避免在查询里对大量序列做复杂正则。
- **记录规则**：重查询、Dashboard 常用查询、SLO 计算应沉淀为 recording rules。

## Recording Rules

命名建议：`level:metric:operations`，例如：

```yaml
groups:
  - name: api-slo
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: sum by (job) (rate(http_requests_total[5m]))

      - record: job:http_errors:ratio5m
        expr: |
          sum by (job) (rate(http_requests_total{code=~"5.."}[5m]))
          /
          sum by (job) (rate(http_requests_total[5m]))
```

记录规则能降低查询成本，但会增加存储和规则评估开销，不要把所有查询都做成规则。

# 告警与 Alertmanager

## 告警规则

```yaml
groups:
  - name: basic-alerts
    rules:
      - alert: InstanceDown
        expr: up == 0
        for: 5m
        keep_firing_for: 5m
        labels:
          severity: critical
          team: sre
        annotations:
          summary: "实例 {{ $labels.instance }} 不可达"
          description: "{{ $labels.job }} / {{ $labels.instance }} 已持续 5 分钟无法抓取"
          runbook_url: "https://wiki.example.com/runbook/instance-down"

      - alert: HighHTTPErrorRate
        expr: |
          sum by (job) (rate(http_requests_total{code=~"5.."}[5m]))
          /
          sum by (job) (rate(http_requests_total[5m]))
          > 0.05
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.job }} 5xx 比例超过 5%"
```

要点：

- `for` 避免瞬时抖动触发。
- `keep_firing_for` 避免数据缺失导致告警误恢复。
- `severity`、`team`、`runbook_url` 是告警可运维性的基础。
- 告警应基于**用户症状**（错误率、延迟、不可用），而不是单纯 CPU 高。
- 每个 page 告警都应该是可行动的；不可行动的降级为 ticket 或 dashboard。

## Alertmanager 配置

```yaml
global:
  resolve_timeout: 5m

route:
  receiver: default
  group_by: [alertname, cluster, job]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - matchers:
        - severity="critical"
      receiver: pagerduty
      continue: true
    - matchers:
        - team="database"
      receiver: db-team

receivers:
  - name: default
    webhook_configs:
      - url: https://hooks.example.com/alert
  - name: pagerduty
    pagerduty_configs:
      - service_key_file: /etc/alertmanager/pagerduty-key
  - name: db-team
    email_configs:
      - to: db-team@example.com
        from: alertmanager@example.com
        smarthost: smtp.example.com:587
```

关键概念：

| 概念 | 作用 |
| ---- | ---- |
| route | 告警路由树 |
| receiver | 通知渠道 |
| group_by | 分组维度 |
| group_wait | 首次分组等待 |
| group_interval | 同组更新间隔 |
| repeat_interval | 重复通知间隔 |
| inhibit_rules | 高优先级告警抑制低优先级 |
| silence | 临时静默 |

抑制示例：主机宕机时，抑制该主机上的所有实例告警。

```yaml
inhibit_rules:
  - source_matchers: [alertname="NodeDown"]
    target_matchers: [alertname="InstanceDown"]
    equal: [instance]
```

## Alertmanager 高可用

- 多个 Alertmanager 组成 gossip 集群，配置相同。
- Prometheus 双副本分别发送告警，Alertmanager 负责去重。
- 使用共享存储或配置管理保证配置一致。
- 监控通知失败率、队列积压、集群成员状态。

```bash
amtool check-config /etc/alertmanager/alertmanager.yml
amtool alert query
amtool silence add alertname="InstanceDown" --duration=2h
```

# Kubernetes 监控

## 推荐方式：Prometheus Operator

生产环境不建议手写 Deployment + ConfigMap。推荐使用 `kube-prometheus-stack` 或 Prometheus Operator，把监控组件 CRD 化：

| CRD | 作用 |
| ---- | ---- |
| `Prometheus` | Prometheus 实例、副本、存储、保留 |
| `Alertmanager` | Alertmanager 集群 |
| `ServiceMonitor` | 声明式抓取 Service |
| `PodMonitor` | 声明式抓取 Pod |
| `Probe` | blackbox 探针 |
| `PrometheusRule` | 告警/记录规则 |
| `AlertmanagerConfig` | 告警路由与接收器 |

## 核心组件

| 组件 | 作用 |
| ---- | ---- |
| node-exporter | 节点 CPU、内存、磁盘、网络 |
| kube-state-metrics | Kubernetes 对象状态（Deployment、Pod、PVC 等） |
| kubelet / cAdvisor | 容器资源指标 |
| blackbox-exporter | HTTP/TCP/ICMP/DNS 探针 |
| kube-apiserver / etcd / scheduler | 控制面指标 |

## ServiceMonitor 示例

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  namespaceSelector:
    matchNames: [prod]
  selector:
    matchLabels:
      app: api
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
      scheme: http
      relabelings:
        - sourceLabels: [__meta_kubernetes_service_name]
          targetLabel: service
```

## PrometheusRule 示例

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: api-rules
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: api
      rules:
        - alert: APIHighErrorRate
          expr: |
            sum by (service) (rate(http_requests_total{code=~"5.."}[5m]))
            /
            sum by (service) (rate(http_requests_total[5m]))
            > 0.05
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "{{ $labels.service }} 5xx 比例过高"
```

## 标签规范

建议统一以下标签，便于跨集群聚合：

- `cluster`：集群名
- `environment`：prod/staging/dev
- `region`：区域
- `namespace`：Kubernetes 命名空间
- `pod`：Pod 名
- `container`：容器名
- `service`：服务名
- `version`：版本（谨慎使用，避免高基数）

不要使用 `pod` 作为长期聚合维度，Pod 名会频繁变化导致高基数；聚合时优先用 `service`、`namespace`、`cluster`。

## RBAC 与安全

- Prometheus 需要访问 Kubernetes API 做服务发现，使用最小权限的 ServiceAccount。
- `nodes/proxy` 权限较强，只在需要抓取 kubelet/cAdvisor 时授予。
- 使用 NetworkPolicy 限制 Prometheus 的出入流量。
- 不要在公网暴露 Prometheus UI/API。
- ServiceMonitor/PodMonitor 的 `namespaceSelector` 要限制范围，避免误抓全集群。

# 生产实践

## 容量规划

Prometheus 的资源消耗主要取决于：

- **活跃时间序列数（active series）**：决定内存。
- **每秒采样数（samples/sec）**：决定 CPU 和磁盘写入。
- **保留时间**：决定磁盘。
- **查询复杂度**：决定查询内存和 CPU。

粗略磁盘公式：

```text
磁盘 ≈ 保留秒数 × 每秒采样数 × 每样本字节数
```

官方给出的平均样本大小约为 1-2 bytes，但实际要以压测和 `promtool tsdb analyze` 为准。

建议：

- 单 Prometheus 的 active series 控制在百万级以内，超过后考虑分片。
- 内存按 active series 估算，并留 30%-50% 余量。
- 不要给 Prometheus 设置过低的 memory limit，否则容易 OOMKill。
- 使用 `--storage.tsdb.retention.size` 限制磁盘，建议不超过磁盘的 80%-85%，给 compaction 留空间。
- 数据盘使用本地 SSD，避免网络存储导致 WAL/compaction 抖动。

## 基数治理

优先从应用埋点解决：

- 不给每个用户、请求、URL 打标签。
- 错误信息、SQL、堆栈不要做 label。
- 用固定枚举描述状态，不要用自由文本。
- 高基数字段放到日志或追踪系统。

采集侧治理：

```yaml
scrape_configs:
  - job_name: app
    sample_limit: 50000
    label_limit: 30
    target_limit: 5000
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: "http_request_duration_seconds_bucket"
        action: keep
      - source_labels: [user_id]
        action: labeldrop
```

监控指标：

- `prometheus_tsdb_head_series`
- `scrape_samples_scraped`
- `scrape_series_added`
- `prometheus_tsdb_head_samples_appended_total`

## 抓取与查询调优

- `scrape_interval` 常用 15s-30s；不要盲目设成 1s。
- `scrape_timeout` 必须小于 `scrape_interval`，通常为 interval 的 50%-80%。
- `rate()` 窗口至少为 scrape interval 的 4 倍，避免样本不足。
- 告警用 `rate`，不要用 `irate`。
- 重查询沉淀为 recording rules。
- 限制 Dashboard 时间范围和查询并发。
- 设置 `--query.timeout`、`--query.max-samples`，防止单条查询拖垮实例。
- 使用 `promtool query instant` / `promtool query range` 做离线排查。

## TSDB 与备份

TSDB 结构：

- 每 2 小时生成一个 block。
- 当前 block 在内存中，通过 WAL 保证崩溃恢复。
- 后台 compaction 合并小 block，最大跨度约为保留时间的 10% 或 31 天。
- compaction 期间新旧 block 同时存在，磁盘需要额外空间。

备份建议：

```bash
# 需要 --web.enable-admin-api
curl -X POST http://localhost:9090/api/v1/admin/tsdb/snapshot
```

- 使用 snapshot 备份，不要直接复制正在写入的 TSDB 目录。
- 同时备份配置、规则、Alertmanager 配置和 Dashboard。
- 定期做恢复演练。
- 升级前先备份。

## SLO 告警

Prometheus 非常适合做 SLO：

- 用 recording rules 计算 SLI。
- 用多窗口燃尽率告警减少噪音。
- 将错误预算和告警路由到对应团队。
- 与 SRE 的 SLO/错误预算流程结合，而不是只配静态阈值。

示例 recording rules：

```yaml
groups:
  - name: slo-api
    interval: 30s
    rules:
      - record: job:slo_errors:ratio5m
        expr: |
          sum by (job) (rate(http_requests_total{code=~"5.."}[5m]))
          /
          sum by (job) (rate(http_requests_total[5m]))

      - record: job:slo_burn_rate1h
        expr: job:slo_errors:ratio5m / 0.001
```

# 高可用与长期存储

## 本地 TSDB 不是高可用

Prometheus 本地存储是单节点数据库，不做复制。磁盘损坏或节点故障会丢失数据。

常见高可用方案：

1. **双副本 Prometheus**：两个实例抓相同目标，配置 `external_labels.replica` 区分。
2. **remote write 到长期存储**：Thanos、Mimir、VictoriaMetrics 等。
3. **查询层去重**：Thanos Querier/Mimir 根据 `replica` 标签去重。
4. **Alertmanager 集群**：多个 Alertmanager 组成 gossip 集群。

注意：

- 双副本会带来双倍采集和存储成本。
- 两个副本的 `external_labels` 必须包含唯一 `replica`。
- 不要让两个 Prometheus 写同一个本地 TSDB 目录。
- 告警规则在两个副本都会评估，依靠 Alertmanager 去重。

## 长期存储选型

| 方案 | 特点 | 适用 |
| ---- | ---- | ---- |
| Thanos | Sidecar/Receiver + 对象存储，生态成熟 | 已有 Prometheus，想要全局查询 |
| Grafana Mimir | 水平扩展、多租户、兼容 Prometheus | 大规模、多团队 |
| VictoriaMetrics | 高性能、压缩好、部署相对简单 | 高基数、成本敏感 |
| Cortex | 早期方案，现多转向 Mimir | 历史项目 |

## Federation

Federation 适合**聚合指标**，不适合做高可用或全量长期存储：

- 上级 Prometheus 抓取下级 Prometheus 的 `/federate`。
- 只应抓取少量聚合指标，避免把高基数数据全量上卷。
- 跨集群全量查询优先 Thanos/Mimir/VictoriaMetrics。

## Agent 模式

Prometheus Agent：

- 只负责采集和 remote write，不做本地查询。
- 适合边缘集群、多集群采集、降低中心 Prometheus 压力。
- 使用 `--agent` 启动（v3 中不再使用 feature flag）。

# 安全

Prometheus 默认**没有认证和授权**，必须假设 UI/API 一旦暴露就等于指标数据泄露。

## 保护 Web UI/API

- 使用 `--web.config.file` 配置 TLS 和 basic auth。
- 或放在反向代理后面，使用 OIDC/OAuth2/SSO。
- 只监听内网地址，配 NetworkPolicy/防火墙。
- 不要用 NodePort/LoadBalancer 直接把 9090 暴露到公网。

`web-config.yml` 示例：

```yaml
tls_server_config:
  cert_file: /etc/prometheus/server.crt
  key_file: /etc/prometheus/server.key

basic_auth_users:
  admin: "$2y$10$..."   # bcrypt hash
```

启动：

```bash
prometheus --web.config.file=/etc/prometheus/web-config.yml
```

## 敏感管理接口

| 参数 | 风险 |
| ---- | ---- |
| `--web.enable-lifecycle` | 允许 reload/quit，需限制访问 |
| `--web.enable-admin-api` | 允许删除数据、创建 snapshot，风险高 |
| `--web.enable-remote-write-receiver` | 允许外部写入，需认证和限流 |

生产环境按需开启，不要默认全开。

## 抓取安全

- 使用 HTTPS 抓取敏感目标。
- 使用 `bearer_token_file`、`tls_config`、`basic_auth`，不要把密钥写进 YAML 明文。
- 为 Prometheus 配置最小权限的 ServiceAccount。
- 对 Exporter 做网络隔离，避免暴露到公网。
- 监控 `up` 和证书到期时间。

## Alertmanager 安全

- Alertmanager 同样默认无认证，使用反向代理或 `--web.config.file`。
- Webhook 使用 HTTPS，并校验接收端证书。
- PagerDuty/Slack token 放在 secret 文件或 Secret Manager。
- 限制 silence 创建权限，避免误静默。

# 自监控与排错

## 关键自监控指标

| 指标 | 说明 |
| ---- | ---- |
| `up` | 目标是否可达 |
| `scrape_duration_seconds` | 抓取耗时 |
| `scrape_samples_scraped` | 单次抓取样本数 |
| `scrape_series_added` | 新增序列数 |
| `prometheus_tsdb_head_series` | 活跃序列数 |
| `prometheus_tsdb_head_samples_appended_total` | 写入样本速率 |
| `prometheus_tsdb_storage_blocks_bytes` | block 占用 |
| `prometheus_tsdb_compactions_failed_total` | compaction 失败 |
| `prometheus_rule_evaluation_duration_seconds` | 规则评估耗时 |
| `prometheus_rule_evaluation_failures_total` | 规则评估失败 |
| `prometheus_notifications_errors_total` | 告警发送失败 |
| `alertmanager_notifications_failed_total` | Alertmanager 通知失败 |
| `process_resident_memory_bytes` | 进程内存 |
| `go_goroutines` | goroutine 数 |

建议告警：

- `up == 0` 持续 5 分钟。
- `scrape_duration_seconds` 接近 `scrape_timeout`。
- `prometheus_tsdb_head_series` 突增。
- 磁盘剩余空间不足。
- 规则评估失败或耗时过长。
- Alertmanager 通知失败。

## 排错表

| 现象 | 常见原因 | 排查 |
| ---- | -------- | ---- |
| Target 显示 DOWN | 网络、端口、路径、TLS、认证 | 手动 `curl`、看 `scrape_duration_seconds` |
| `context deadline exceeded` | 目标响应慢或超时太短 | 检查目标性能，调整 `scrape_timeout` |
| 401/403 | token/证书/权限 | 检查 `bearer_token_file`、RBAC |
| 查询无数据 | 标签不匹配、时间范围、指标未采集 | 用 `/api/v1/targets`、`up`、原始指标排查 |
| 内存暴涨/OOM | 高基数、查询过大、规则过重 | 看 `head_series`、`scrape_samples_scraped` |
| 查询很慢 | 大范围、高基数、正则、缺 recording rule | 缩小范围、加规则、优化 PromQL |
| 告警不触发 | expr 错、`for` 未满足、规则未加载 | `/api/v1/rules`、`promtool check rules` |
| 告警不发送 | Alertmanager 路由/凭据/网络 | `amtool`、Alertmanager 日志、通知指标 |
| TSDB 异常 | 磁盘满、损坏、版本不兼容 | 备份、`promtool tsdb analyze`、日志 |
| 数据重复 | 多副本未去重、重复抓取 | 检查 `replica` 标签和抓取配置 |

## 常用命令与接口

```bash
# 配置/规则校验
promtool check config prometheus.yml
promtool check rules rules/*.yml

# 查询
promtool query instant http://localhost:9090 'up == 0'
promtool query range http://localhost:9090 'rate(http_requests_total[5m])' \
  --start=2026-10-23T00:00:00Z --end=2026-10-23T01:00:00Z --step=1m

# TSDB 分析
promtool tsdb analyze /var/lib/prometheus

# 健康检查
curl http://localhost:9090/-/healthy
curl http://localhost:9090/-/ready

# 目标与规则
curl http://localhost:9090/api/v1/targets
curl http://localhost:9090/api/v1/rules
curl http://localhost:9090/api/v1/alerts
curl http://localhost:9090/api/v1/status/tsdb
```

# 升级到 Prometheus 3.x

Prometheus 3.0 包含一些不兼容变更，升级前务必阅读官方 migration guide。

## 主要变化

| 变化 | 影响 | 处理 |
| ---- | ---- | ---- |
| 移除部分 feature flags | `promql-at-modifier`、`promql-negative-offset`、`agent`、`remote-write-receiver` 等 | 改用默认行为或新参数 |
| Agent 模式 | `--enable-feature=agent` 改为 `--agent` | 修改启动参数 |
| Remote write receiver | 改为 `--web.enable-remote-write-receiver` | 修改启动参数 |
| `auto-gomemlimit` | v3 自动根据容器内存设置 GOMEMLIMIT | 可用 `--no-auto-gomemlimit` 关闭 |
| UTF-8 名称 | metric/label 名称支持 UTF-8 | 需要兼容旧校验时设 `metric_name_validation_scheme: legacy` |
| `le`/`quantile` 规范化 | 整数值会变成浮点表示，如 `le="1"` → `le="1.0"` | 修改直接引用整数值的查询/告警 |
| Content-Type 更严格 | 无效 Content-Type 会导致抓取失败 | 配置 `fallback_scrape_protocol` |
| `holt_winters` 重命名 | 改为 `double_exponential_smoothing`，需 feature flag | 修改 PromQL |
| remote write HTTP/2 默认关闭 | 需要时显式开启 | 设置 `enable_http2: true` |
| 原生直方图稳定 | 3.9 起 `native-histograms` flag 不再需要 | 通过 `scrape_native_histograms` 控制抓取 |

## 升级步骤

1. 备份 TSDB、配置、规则、Alertmanager 配置和 Dashboard。
2. 阅读当前版本到目标版本的 migration guide 和 changelog。
3. 在 staging 环境升级 Prometheus、Alertmanager、Exporter、Operator。
4. 执行 `promtool check config` 和 `promtool check rules`。
5. 检查启动参数中是否还有已移除的 flag。
6. 检查 Dashboard、告警和 recording rules 是否依赖旧的 `le`/`quantile` 值。
7. 验证抓取目标的 Content-Type，必要时配置 `fallback_scrape_protocol`。
8. 观察 `up`、抓取耗时、规则评估、查询延迟和内存。
9. 准备回滚方案。

# 最佳实践清单

- [ ] 固定 Prometheus 版本，配置纳入 Git，CI 执行 `promtool check`
- [ ] 生产环境使用 Prometheus Operator/kube-prometheus-stack，而不是手写 Deployment
- [ ] 每个 Prometheus 有明确的 `cluster`、`environment`、`replica` 外部标签
- [ ] 设置 `scrape_timeout < scrape_interval`，`rate` 窗口至少 4 倍抓取周期
- [ ] 配置 `sample_limit`、`label_limit`、`target_limit`，防止基数爆炸
- [ ] 用 `metric_relabel_configs` 丢弃高基数、无用指标
- [ ] 监控 `prometheus_tsdb_head_series`、`scrape_samples_scraped` 和磁盘
- [ ] 设置合理的 retention time/size，磁盘保留 15%-20% buffer
- [ ] 使用 snapshot 备份，定期做恢复演练
- [ ] 告警基于用户症状，配置 `for`、`keep_firing_for`、`severity`、`runbook_url`
- [ ] 每个 page 告警都可行动，避免告警疲劳
- [ ] Alertmanager 做集群和高可用，配置抑制、静默和路由
- [ ] Prometheus UI/API 不暴露公网，启用 TLS/认证/网络策略
- [ ] 敏感管理接口按需开启，限制访问来源
- [ ] 双副本 + remote write 长期存储，查询层按 `replica` 去重
- [ ] 定期升级并关注 Prometheus 3.x 的 breaking changes

# 参考资料

- [Prometheus 官方文档](https://prometheus.io/docs/)
- [Prometheus 配置](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)
- [PromQL 基础](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [PromQL 函数](https://prometheus.io/docs/prometheus/latest/querying/functions/)
- [PromQL 操作符](https://prometheus.io/docs/prometheus/latest/querying/operators/)
- [告警规则](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
- [Recording Rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/)
- [存储](https://prometheus.io/docs/prometheus/latest/storage/)
- [3.0 迁移指南](https://prometheus.io/docs/prometheus/latest/migration/)
- [Feature Flags](https://prometheus.io/docs/prometheus/latest/feature_flags/)
- [安全模型](https://prometheus.io/docs/operating/security/)
- [指标命名规范](https://prometheus.io/docs/practices/naming/)
- [Histogram 与 Summary](https://prometheus.io/docs/practices/histograms/)
- [Recording Rules 实践](https://prometheus.io/docs/practices/rules/)
- [Alerting 实践](https://prometheus.io/docs/practices/alerting/)
- [管理 API](https://prometheus.io/docs/prometheus/latest/management_api/)
- [Basic Auth](https://prometheus.io/docs/guides/basic-auth/)
- [TLS 加密](https://prometheus.io/docs/guides/tls-encryption/)
- [Prometheus Operator](https://prometheus-operator.dev/)
- [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)

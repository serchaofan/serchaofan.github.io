---
title: Prometheus-HTTP-API调用
tags: [Prometheus, API, 监控, SRE]
categories: [监控]
date: 2020-01-07 22:49:26
comments: false
---

Prometheus 提供了一套稳定的 HTTP API，默认挂载在 `/api/v1` 下，用于查询指标、发现序列、查看目标与规则、读取状态以及执行 TSDB 管理操作。

本文基于 Prometheus 3.x 重写，覆盖通用响应格式、查询/元数据/状态/管理 API、客户端调用、错误处理、安全与版本差异。最后复核时间：2026-10。

> API 默认**没有认证**。生产环境必须通过反向代理、`--web.config.file`、网络策略等方式保护，尤其不要暴露 `/-/reload`、`/-/quit` 和 TSDB 管理接口。

<!-- more -->

- [API 概览](#api-%E6%A6%82%E8%A7%88)
- [通用约定](#%E9%80%9A%E7%94%A8%E7%BA%A6%E5%AE%9A)
- [快速开始](#%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B)
- [查询 API](#%E6%9F%A5%E8%AF%A2-api)
- [元数据 API](#%E5%85%83%E6%95%B0%E6%8D%AE-api)
- [目标、规则与告警 API](#%E7%9B%AE%E6%A0%87%E8%A7%84%E5%88%99%E4%B8%8E%E5%91%8A%E8%AD%A6-api)
- [状态 API](#%E7%8A%B6%E6%80%81-api)
- [管理 API](#%E7%AE%A1%E7%90%86-api)
- [写入 API](#%E5%86%99%E5%85%A5-api)
- [客户端示例](#%E5%AE%A2%E6%88%B7%E7%AB%AF%E7%A4%BA%E4%BE%8B)
- [错误处理与重试](#%E9%94%99%E8%AF%AF%E5%A4%84%E7%90%86%E4%B8%8E%E9%87%8D%E8%AF%95)
- [安全](#%E5%AE%89%E5%85%A8)
- [版本差异](#%E7%89%88%E6%9C%AC%E5%B7%AE%E5%BC%82)
- [端点速查](#%E7%AB%AF%E7%82%B9%E9%80%9F%E6%9F%A5)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# API 概览

## 基础信息

| 项目 | 说明 |
| ---- | ---- |
| Base URL | `http://<prometheus>:9090/api/v1` |
| 数据格式 | JSON（搜索 API 为 NDJSON） |
| 方法 | 查询类支持 GET/POST；管理类通常为 POST/PUT |
| 成功状态 | `2xx` |
| 认证 | 默认无；需自行加 TLS/认证 |
| OpenAPI | `/api/v1/openapi.yaml`，默认 OpenAPI 3.1，可用 `?openapi_version=3.2` |

## 能力范围

- **表达式查询**：瞬时查询、区间查询、查询统计。
- **元数据**：序列、标签名、标签值、指标元数据、exemplars。
- **运行状态**：targets、rules、alerts、Alertmanager 发现。
- **服务状态**：构建信息、运行时信息、配置、flags、TSDB 统计、WAL 重放。
- **管理操作**：TSDB snapshot、删除序列、清理 tombstones。
- **写入入口**：Remote Write receiver、OTLP receiver。
- **辅助接口**：PromQL 格式化、AST 解析、实时通知流。

## 稳定性说明

- `/api/v1` 是稳定 API，非破坏性新增会继续放在该前缀下。
- `/api/v1/rules`、`/api/v1/alerts`、`/api/v1/metadata`、`/api/v1/query_exemplars`、`/api/v1/status/tsdb/blocks` 等标注为实验性或稳定性较弱，字段可能变化。
- 生产客户端应忽略未知字段，避免因新增字段解析失败。

## 管理接口

| 接口 | 用途 | 默认 |
| ---- | ---- | ---- |
| `GET /-/healthy` | 健康检查 | 开启 |
| `GET /-/ready` | 就绪检查 | 开启 |
| `POST /-/reload` | 热加载配置 | 需 `--web.enable-lifecycle` |
| `POST /-/quit` | 优雅退出 | 需 `--web.enable-lifecycle` |
| `POST /api/v1/admin/tsdb/*` | TSDB 管理 | 需 `--web.enable-admin-api` |

# 通用约定

## JSON 响应封套

成功和失败都使用统一封套：

```json
{
  "status": "success",
  "data": {},
  "warnings": ["optional warning"],
  "infos": ["optional info"]
}
```

失败时：

```json
{
  "status": "error",
  "errorType": "bad_data",
  "error": "invalid parameter 'query': parse error",
  "data": null
}
```

字段说明：

| 字段 | 说明 |
| ---- | ---- |
| `status` | `success` 或 `error` |
| `data` | 业务数据；失败时可能仍包含部分数据 |
| `errorType` | 错误类型，如 `bad_data`、`timeout`、`execution`、`internal` |
| `error` | 错误描述 |
| `warnings` | 非致命告警，数据仍会返回 |
| `infos` | 非致命提示，可能是误报 |

客户端必须：

- 同时检查 HTTP 状态码和 `status` 字段。
- 不要因为 `status=success` 就忽略 `warnings`。
- 对 `errorType` 做分类处理，而不是只打印字符串。

## HTTP 状态码

| 状态码 | 含义 |
| ------ | ---- |
| `200 OK` | 成功 |
| `204 No Content` | 成功但无响应体，如删除、清理、部分通知流 |
| `400 Bad Request` | 参数缺失或格式错误 |
| `401 Unauthorized` | 需要认证（由反向代理/Web 配置返回） |
| `403 Forbidden` | 无权限 |
| `405 Method Not Allowed` | 方法不支持 |
| `422 Unprocessable Entity` | PromQL 表达式无法执行 |
| `503 Service Unavailable` | 查询超时、被取消或服务不可用 |

`4xx/5xx` 也可能在请求到达 API handler 之前由代理、网关或 TLS 层返回，此时响应不一定是 Prometheus JSON 封套。

## 时间格式

时间参数支持：

- RFC3339：`2026-10-23T12:00:00Z`
- Unix 时间戳（秒，可带小数）：`1761211200`、`1761211200.123`

返回的时间戳通常是 Unix 秒（浮点数），精度到毫秒。

## GET 与 POST

查询类接口通常同时支持 GET 和 POST：

```bash
# GET
curl -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=up'

# POST（适合长查询）
curl -X POST 'http://localhost:9090/api/v1/query' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'query=sum by (job) (rate(http_requests_total[5m]))'
```

POST 使用 `application/x-www-form-urlencoded`，参数需要 URL 编码。长 PromQL 或大量 `match[]` 时优先用 POST，避免 URL 长度限制。

## 认证与 TLS

Prometheus 本身不内置用户体系。常见组合：

- `--web.config.file` 开启 TLS 和 basic auth。
- 反向代理做 OIDC/OAuth2/SSO。
- mTLS 或内网 + NetworkPolicy。
- 用 `curl --cacert`、`--cert`、`--key` 或 `-u user:pass` 调用。

```bash
curl --cacert ca.pem \
  --cert client.pem --key client-key.pem \
  -u admin:password \
  'https://prometheus.example.com/api/v1/query?query=up'
```

## OpenAPI

```bash
# 获取 OpenAPI 3.1
curl -o prometheus-openapi.yaml http://localhost:9090/api/v1/openapi.yaml

# 获取 OpenAPI 3.2（包含 notifications/live 等新端点）
curl -o prometheus-openapi-3.2.yaml \
  'http://localhost:9090/api/v1/openapi.yaml?openapi_version=3.2'
```

可以用 OpenAPI 生成客户端、做契约测试或导入 Postman/Apifox。

# 快速开始

## 查询当前 up 状态

```bash
curl -sG 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=up' | jq .
```

响应示例：

```json
{
  "status": "success",
  "data": {
    "resultType": "vector",
    "result": [
      {
        "metric": {
          "__name__": "up",
          "job": "prometheus",
          "instance": "localhost:9090"
        },
        "value": [1761211200.123, "1"]
      }
    ]
  }
}
```

## 查询最近 5 分钟 CPU 使用率

```bash
curl -sG 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=100 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100' \
  | jq -r '.data.result[] | [.metric.instance, .value[1]] | @tsv'
```

## 区间查询

```bash
curl -sG 'http://localhost:9090/api/v1/query_range' \
  --data-urlencode 'query=rate(http_requests_total[5m])' \
  --data-urlencode 'start=2026-10-23T00:00:00Z' \
  --data-urlencode 'end=2026-10-23T01:00:00Z' \
  --data-urlencode 'step=1m' | jq .
```

## 检查服务健康

```bash
curl -sf http://localhost:9090/-/healthy
curl -sf http://localhost:9090/-/ready
```

# 查询 API

## 瞬时查询

```text
GET  /api/v1/query
POST /api/v1/query
```

参数：

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `query` | 是 | PromQL 表达式 |
| `time` | 否 | 评估时间，默认当前时间 |
| `timeout` | 否 | 超时时间，默认受 `--query.timeout` 限制 |
| `limit` | 否 | 返回的最大序列数，0 表示不限制 |
| `lookback_delta` | 否 | 覆盖本次查询的 lookback 窗口 |
| `stats` | 否 | `true` 或 `all`，返回查询统计 |

示例：

```bash
curl -sG 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=up{job="prometheus"}' \
  --data-urlencode 'time=2026-10-23T12:00:00Z' \
  --data-urlencode 'timeout=10s' \
  --data-urlencode 'limit=100' \
  --data-urlencode 'stats=all' | jq .
```

`resultType` 可能是：

| 类型 | 说明 |
| ---- | ---- |
| `vector` | 瞬时向量，`value` 为 `[timestamp, "value"]` |
| `matrix` | 区间向量，`values` 为 `[[timestamp, "value"], ...]` |
| `scalar` | 标量，`value` 为 `[timestamp, "value"]` |
| `string` | 字符串，`value` 为 `[timestamp, "string"]` |

## 区间查询

```text
GET  /api/v1/query_range
POST /api/v1/query_range
```

参数：

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `query` | 是 | PromQL 表达式 |
| `start` | 是 | 起始时间，包含 |
| `end` | 是 | 结束时间，包含 |
| `step` | 是 | 步长，duration 或浮点秒数 |
| `timeout` | 否 | 超时时间 |
| `limit` | 否 | 返回的最大序列数 |
| `lookback_delta` | 否 | 覆盖 lookback 窗口 |
| `stats` | 否 | 查询统计 |

示例：

```bash
curl -sG 'http://localhost:9090/api/v1/query_range' \
  --data-urlencode 'query=sum by (job) (rate(http_requests_total[5m]))' \
  --data-urlencode 'start=1761210000' \
  --data-urlencode 'end=1761213600' \
  --data-urlencode 'step=30s' \
  --data-urlencode 'limit=50' | jq .
```

响应：

```json
{
  "status": "success",
  "data": {
    "resultType": "matrix",
    "result": [
      {
        "metric": {"job": "api"},
        "values": [
          [1761210000, "12.5"],
          [1761210030, "13.1"]
        ]
      }
    ]
  }
}
```

注意：

- `step` 太小时，查询点数会暴涨，可能超时或被限制。
- `start`/`end` 范围很大时，优先缩小时间范围或使用 recording rules。
- `limit` 只限制序列数，不限制点数；点数由 `step` 和时间范围决定。

## 查询统计

`stats=true` 会返回基础统计；`stats=all` 还会返回每一步的详细统计（可能受 feature flag 影响）。

```json
{
  "status": "success",
  "data": {
    "resultType": "matrix",
    "result": [],
    "stats": {
      "timings": {
        "evalTotalTime": 0.012,
        "execQueueTime": 0.001
      },
      "samples": {
        "totalQueryableSamples": 12000,
        "peakSamples": 800
      }
    }
  }
}
```

用途：

- 定位慢查询。
- 评估 Dashboard 查询成本。
- 观察 `samplesRead`、`peakSamples` 是否异常。

对应 Prometheus 自身指标：

- `prometheus_engine_query_samples_total`
- `prometheus_engine_query_samples_read_total`

## 查询注意事项

- 默认返回的 `value` 是字符串，避免浮点精度问题；客户端按需转数字。
- 结果顺序不保证稳定，需要排序时在客户端处理。
- `warnings` 可能包含 PromQL 弃用提示、部分失败等，建议记录。
- 对超大结果使用 `limit`，并在客户端做分页或缩小查询范围。
- 查询失败时不要盲目重试 `422`，应先修正 PromQL。

# 元数据 API

## 查询序列

```text
GET  /api/v1/series
POST /api/v1/series
```

参数：

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `match[]` | 是 | 序列选择器，可重复 |
| `start` | 否 | 起始时间 |
| `end` | 否 | 结束时间 |
| `limit` | 否 | 最大返回序列数 |

示例：

```bash
curl -sG 'http://localhost:9090/api/v1/series' \
  --data-urlencode 'match[]=up' \
  --data-urlencode 'match[]=process_start_time_seconds{job="prometheus"}' \
  --data-urlencode 'limit=100' | jq .
```

响应：

```json
{
  "status": "success",
  "data": [
    {
      "__name__": "up",
      "job": "prometheus",
      "instance": "localhost:9090"
    }
  ]
}
```

注意：

- `start`/`end` 是近似过滤，可能返回时间窗口外仍有数据的序列。
- 多个 `match[]` 是并集语义，返回匹配任一选择器的序列。
- 该接口可能返回大量标签组合，生产调用要加 `limit`。

## 标签名

```text
GET  /api/v1/labels
POST /api/v1/labels
```

参数：`match[]`、`start`、`end`、`limit`。

```bash
curl -sG 'http://localhost:9090/api/v1/labels' \
  --data-urlencode 'match[]=up' | jq .
```

响应：

```json
{
  "status": "success",
  "data": ["__name__", "instance", "job"]
}
```

## 标签值

```text
GET /api/v1/label/<label_name>/values
```

```bash
curl -s 'http://localhost:9090/api/v1/label/job/values' | jq .
```

响应：

```json
{
  "status": "success",
  "data": ["api", "node", "prometheus"]
}
```

## 指标元数据

```text
GET /api/v1/metadata
```

参数：

| 参数 | 说明 |
| ---- | ---- |
| `limit` | 最大指标数 |
| `limit_per_metric` | 每个指标最大元数据条数 |
| `metric` | 按指标名过滤 |

```bash
curl -sG 'http://localhost:9090/api/v1/metadata' \
  --data-urlencode 'metric=http_requests_total' | jq .
```

响应：

```json
{
  "status": "success",
  "data": {
    "http_requests_total": [
      {
        "type": "counter",
        "help": "Total HTTP requests",
        "unit": ""
      }
    ]
  }
}
```

该接口为实验性，且只包含直接抓取到的元数据；通过 Remote Write/OTLP 写入的元数据可能不在此返回。

## Target 元数据

```text
GET /api/v1/targets/metadata
```

参数：`match_target`、`metric`、`limit`。

```bash
curl -sG 'http://localhost:9090/api/v1/targets/metadata' \
  --data-urlencode 'metric=go_goroutines' \
  --data-urlencode 'match_target={job="prometheus"}' \
  --data-urlencode 'limit=2' | jq .
```

响应：

```json
{
  "status": "success",
  "data": [
    {
      "target": {"instance": "localhost:9090", "job": "prometheus"},
      "metric": "go_goroutines",
      "type": "gauge",
      "help": "Number of goroutines that currently exist.",
      "unit": ""
    }
  ]
}
```

## Exemplars

```text
GET  /api/v1/query_exemplars
POST /api/v1/query_exemplars
```

参数：`query`、`start`、`end`。

```bash
curl -sG 'http://localhost:9090/api/v1/query_exemplars' \
  --data-urlencode 'query=test_exemplar_metric_total' \
  --data-urlencode 'start=2026-10-23T00:00:00Z' \
  --data-urlencode 'end=2026-10-23T01:00:00Z' | jq .
```

Exemplars 通常包含 `trace_id` 等标签，用于把指标关联到链路追踪。该接口为实验性，且需要服务端开启 exemplar 存储。

## 搜索 API（实验性）

Prometheus 3.x 提供流式搜索 API，需开启 `--enable-feature=search-api`：

```text
GET/POST /api/v1/search/metric_names
GET/POST /api/v1/search/label_names
GET/POST /api/v1/search/label_values
```

响应格式为 NDJSON（`application/x-ndjson`）：

```json
{"results":[{"name":"http_requests_total","type":"counter","help":"Total HTTP requests."}]}
{"status":"success","has_more":false}
```

参数：

- `match[]`：限定搜索范围。
- `search[]`：搜索字符串，多个值 OR。
- `limit`：最大结果数。
- `batch_size`：每批返回数量。

注意：

- 这是实验性接口，格式可能变化。
- 客户端必须处理流结束、错误行和 `has_more`。
- 不适合替代常规 `/series`、`/labels` 查询。

# 目标、规则与告警 API

## Targets

```text
GET /api/v1/targets
```

返回 active 和 dropped targets：

```json
{
  "status": "success",
  "data": {
    "activeTargets": [
      {
        "discoveredLabels": {
          "__address__": "127.0.0.1:9090",
          "__metrics_path__": "/metrics",
          "__scheme__": "http",
          "job": "prometheus"
        },
        "labels": {
          "instance": "127.0.0.1:9090",
          "job": "prometheus"
        },
        "scrapePool": "prometheus",
        "scrapeUrl": "http://127.0.0.1:9090/metrics",
        "globalUrl": "http://prometheus.example.com/metrics",
        "lastError": "",
        "lastScrape": "2026-10-23T12:00:00.123Z",
        "lastScrapeDuration": 0.050688943,
        "health": "up",
        "scrapeInterval": "15s",
        "scrapeTimeout": "10s"
      }
    ],
    "droppedTargets": []
  }
}
```

字段：

| 字段 | 说明 |
| ---- | ---- |
| `discoveredLabels` | relabel 前的原始标签 |
| `labels` | relabel 后的最终标签 |
| `scrapePool` | 抓取池，通常等于 job |
| `scrapeUrl` | 实际抓取地址 |
| `health` | `up` / `down` / `unknown` |
| `lastError` | 最近一次抓取错误 |
| `lastScrapeDuration` | 最近一次抓取耗时（秒） |

`droppedTargets` 受 `keep_dropped_targets` 限制。

## Rules

```text
GET /api/v1/rules
```

参数：

| 参数 | 说明 |
| ---- | ---- |
| `type` | `alert` 或 `record` |
| `rule_name[]` | 按规则名过滤，可重复 |
| `rule_group[]` | 按规则组过滤，可重复 |
| `file[]` | 按规则文件过滤，可重复 |
| `exclude_alerts` | 不返回活动告警 |
| `match[]` | 按规则标签过滤 |
| `group_limit` | 限制返回的规则组数量；超出时返回 `groupNextToken` |

示例：

```bash
curl -sG 'http://localhost:9090/api/v1/rules' \
  --data-urlencode 'type=alert' \
  --data-urlencode 'exclude_alerts=true' | jq .
```

响应结构：

```json
{
  "status": "success",
  "data": {
    "groups": [
      {
        "name": "basic-alerts",
        "file": "/etc/prometheus/rules/basic.yml",
        "interval": 30,
        "limit": 0,
        "rules": [
          {
            "name": "InstanceDown",
            "query": "up == 0",
            "duration": 300,
            "health": "ok",
            "type": "alerting",
            "labels": {"severity": "critical"},
            "annotations": {"summary": "Instance down"},
            "alerts": []
          }
        ]
      }
    ]
  }
}
```

规则字段可能随版本变化，客户端应忽略未知字段。

## Alerts

```text
GET /api/v1/alerts
```

返回当前活动告警：

```json
{
  "status": "success",
  "data": {
    "alerts": [
      {
        "labels": {"alertname": "InstanceDown", "severity": "critical"},
        "annotations": {"summary": "Instance down"},
        "state": "firing",
        "activeAt": "2026-10-23T12:00:00Z",
        "value": "1e+00"
      }
    ]
  }
}
```

`state` 可能是 `pending`、`firing`。该接口稳定性弱于 `/api/v1/query`。

## Alertmanagers

```text
GET /api/v1/alertmanagers
```

返回 Prometheus 发现到的 Alertmanager：

```json
{
  "status": "success",
  "data": {
    "activeAlertmanagers": [
      {"url": "http://alertmanager-0:9093/api/v1/alerts"}
    ],
    "droppedAlertmanagers": [
      {"url": "http://alertmanager-old:9093/api/v1/alerts"}
    ]
  }
}
```

该接口只反映 Prometheus 的发现状态，不保证 Alertmanager 本身健康。

# 状态 API

## 构建信息

```text
GET /api/v1/status/buildinfo
```

```json
{
  "status": "success",
  "data": {
    "version": "3.x.x",
    "revision": "abc123",
    "branch": "HEAD",
    "buildUser": "builder",
    "buildDate": "20261001-00:00:00",
    "goVersion": "go1.xx"
  }
}
```

## 运行时信息

```text
GET /api/v1/status/runtimeinfo
```

返回启动时间、配置重载状态、goroutine 数、GOMAXPROCS、存储保留时间等：

```json
{
  "status": "success",
  "data": {
    "startTime": "2026-10-01T00:00:00Z",
    "CWD": "/",
    "hostname": "prometheus-0",
    "serverTime": "2026-10-23T12:00:00Z",
    "reloadConfigSuccess": true,
    "lastConfigTime": "2026-10-23T11:00:00Z",
    "timeSeriesCount": 873,
    "corruptionCount": 0,
    "goroutineCount": 48,
    "GOMAXPROCS": 4,
    "storageRetention": "15d"
  }
}
```

字段可能随版本变化，不建议作为稳定契约。

## Flags

```text
GET /api/v1/status/flags
```

```json
{
  "status": "success",
  "data": {
    "query.timeout": "2m",
    "query.max-concurrency": "20",
    "storage.tsdb.retention.time": "15d"
  }
}
```

可用于审计运行参数，但不要暴露给不可信用户。

## 配置

```text
GET /api/v1/status/config
```

返回当前加载配置的 YAML 字符串（注释会丢失）：

```json
{
  "status": "success",
  "data": {
    "yaml": "global:\n  scrape_interval: 15s\n"
  }
}
```

配置可能包含敏感信息（如地址、token 文件路径），访问需受限。

## TSDB 统计

```text
GET /api/v1/status/tsdb?limit=10
```

返回基数统计，用于定位高基数指标：

```json
{
  "status": "success",
  "data": {
    "headStats": {
      "numSeries": 508,
      "chunkCount": 937,
      "minTime": 1761200000000,
      "maxTime": 1761213600000
    },
    "seriesCountByMetricName": [
      {"name": "http_requests_total", "value": 200}
    ],
    "labelValueCountByLabelName": [
      {"name": "instance", "value": 100}
    ],
    "memoryInBytesByLabelName": [
      {"name": "instance", "value": 102400}
    ],
    "seriesCountByLabelPair": [
      {"name": "job=api", "value": 50}
    ]
  }
}
```

`limit` 默认 10，最大 10000。

## TSDB Blocks（实验性）

```text
GET /api/v1/status/tsdb/blocks
```

返回当前加载的 block 元数据（ULID、时间范围、样本数、series 数、compaction 信息）。该接口为实验性，字段可能变化。

## WAL 重放

```text
GET /api/v1/status/walreplay
```

```json
{
  "status": "success",
  "data": {
    "min": 2,
    "max": 5,
    "current": 40,
    "state": "in progress"
  }
}
```

`state`：`waiting`、`in progress`、`done`。该接口在 ready 之前也可用，适合启动排障。

## Features

```text
GET /api/v1/features
```

Prometheus 3.8+ 提供，返回当前启用的功能：

```json
{
  "status": "success",
  "data": {
    "api": {"admin": false, "exclude_alerts": true},
    "prometheus": {"agent_mode": false, "auto_reload_config": false},
    "tsdb": {"delayed_compaction": false, "exemplar_storage": false}
  }
}
```

`false` 可能被省略，客户端应把缺失视为 `false`，并忽略未知字段。

## 实时通知（SSE）

```text
GET /api/v1/notifications/live
```

Prometheus 3.0+ 提供 Server-Sent Events 通知流，用于 UI 实时展示运行通知。最大订阅者由 `--web.max-notifications-subscribers` 控制（默认 16），超过返回 `204 No Content`。

该接口主要用于 UI，不建议作为业务集成接口。

# 管理 API

管理 API 默认关闭，需要 `--web.enable-admin-api`。这些操作会修改/删除数据，必须严格限制访问。

## Snapshot

```text
POST /api/v1/admin/tsdb/snapshot
PUT  /api/v1/admin/tsdb/snapshot
```

参数：

- `skip_head=true`：跳过尚未落盘的 head 数据。

```bash
curl -X POST 'http://localhost:9090/api/v1/admin/tsdb/snapshot?skip_head=true'
```

响应：

```json
{
  "status": "success",
  "data": {
    "name": "20261023T120000Z-2be650b6d019eb54"
  }
}
```

快照位于 `<data-dir>/snapshots/<name>`。备份应使用 snapshot，不要直接复制正在写入的 TSDB 目录。

## 删除序列

```text
POST /api/v1/admin/tsdb/delete_series
PUT  /api/v1/admin/tsdb/delete_series
```

参数：

- `match[]`：必填，可重复。
- `start`：可选，默认最早。
- `end`：可选，默认最晚。

```bash
curl -X POST -G 'http://localhost:9090/api/v1/admin/tsdb/delete_series' \
  --data-urlencode 'match[]=up{job="old-job"}' \
  --data-urlencode 'start=2026-10-01T00:00:00Z' \
  --data-urlencode 'end=2026-10-02T00:00:00Z'
```

成功返回 `204 No Content`。删除只是写入 tombstone，磁盘空间要等 compaction 或 clean tombstones 后释放。

## 清理 Tombstones

```text
POST /api/v1/admin/tsdb/clean_tombstones
PUT  /api/v1/admin/tsdb/clean_tombstones
```

```bash
curl -X POST 'http://localhost:9090/api/v1/admin/tsdb/clean_tombstones'
```

成功返回 `204 No Content`。该操作可能耗时并增加磁盘 I/O，避免高峰期执行。

## 管理 API 风险

- 删除不可逆，必须双人确认和备份。
- 不要在公网暴露管理 API。
- 通过反向代理限制来源 IP、方法和路径。
- 审计所有管理调用（访问日志、操作记录）。

# 写入 API

## Remote Write Receiver

```text
POST /api/v1/write
```

启用：

```bash
prometheus --web.enable-remote-write-receiver
```

请求体是 **protobuf + snappy**，不是 JSON。适合接收其他 Prometheus/Agent 的 remote write，不适合手工 curl 调试。

## OTLP Receiver

```text
POST /api/v1/otlp/v1/metrics
```

启用：

```bash
prometheus --web.enable-otlp-receiver
```

接收 OTLP HTTP metrics（protobuf）。官方明确说明这不是高效的批量摄入方式，适合低流量场景，不能替代 scrape。

## 写入安全

- 写入接口默认无认证，必须放在内网或加认证。
- 限制请求体大小、并发和速率。
- 监控写入失败、队列积压和样本丢弃。
- 不要让不可信客户端直接写生产 Prometheus。

# 客户端示例

## curl + jq

```bash
# 查询并提取 instance/value
curl -sG 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=up == 0' \
  | jq -r '.data.result[] | [.metric.instance, .value[1]] | @tsv'

# 查询规则健康状态
curl -s 'http://localhost:9090/api/v1/rules' \
  | jq -r '.data.groups[].rules[] | [.name, .health, .type] | @tsv'

# 查询 targets 异常
curl -s 'http://localhost:9090/api/v1/targets' \
  | jq -r '.data.activeTargets[] | select(.health != "up") | [.scrapePool, .scrapeUrl, .lastError] | @tsv'
```

## Python

```python
import requests

BASE = "http://localhost:9090/api/v1"

def query(promql: str, timeout: int = 10) -> list[dict]:
    resp = requests.get(
        f"{BASE}/query",
        params={"query": promql},
        timeout=timeout,
    )
    resp.raise_for_status()
    payload = resp.json()
    if payload.get("status") != "success":
        raise RuntimeError(
            f"{payload.get('errorType')}: {payload.get('error')}"
        )
    for warning in payload.get("warnings", []):
        print(f"warning: {warning}")
    return payload["data"]["result"]

rows = query('up == 0')
for row in rows:
    print(row["metric"].get("instance"), row["value"][1])
```

带认证和 TLS：

```python
resp = requests.get(
    f"{BASE}/query",
    params={"query": "up"},
    auth=("admin", "password"),
    verify="/etc/ssl/certs/internal-ca.pem",
    timeout=10,
)
```

## Go

```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
)

type apiResponse struct {
    Status string `json:"status"`
    Data   struct {
        ResultType string `json:"resultType"`
        Result     []struct {
            Metric map[string]string `json:"metric"`
            Value  []any             `json:"value"`
        } `json:"result"`
    } `json:"data"`
    ErrorType string `json:"errorType"`
    Error     string `json:"error"`
}

func main() {
    base := "http://localhost:9090/api/v1/query"
    u, _ := url.Parse(base)
    q := u.Query()
    q.Set("query", "up == 0")
    u.RawQuery = q.Encode()

    resp, err := http.Get(u.String())
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    var out apiResponse
    if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
        panic(err)
    }
    if out.Status != "success" {
        panic(fmt.Sprintf("%s: %s", out.ErrorType, out.Error))
    }
    fmt.Printf("%+v\n", out.Data.Result)
}
```

# 错误处理与重试

## 错误分类

| `errorType` / 状态 | 建议 |
| ------------------ | ---- |
| `bad_data` / 400 | 参数或 PromQL 错误，修正后重试 |
| `422` | 表达式无法执行，不要盲目重试 |
| `timeout` / 503 | 可退避重试，或缩小查询范围 |
| `canceled` | 客户端取消或服务端中止，按需重试 |
| `execution` | 执行错误，检查查询和数据 |
| `internal` | 服务端错误，记录并告警 |
| 401/403 | 认证/授权问题，不要重试 |
| 429 | 限流，按 `Retry-After` 退避 |

## 重试策略

- 只对幂等查询和临时错误重试。
- 使用指数退避 + 抖动。
- 设置最大重试次数和总超时。
- 不要重试 `400`、`401`、`403`、`422`。
- 对 `503` 区分查询超时和服务不可用。

```python
import random
import time

def backoff(attempt: int) -> float:
    return min(30, (2 ** attempt) + random.random())
```

## 超时

- 客户端超时应大于服务端 `timeout`，但不要无限等待。
- 大范围 `query_range` 要单独设置更长超时。
- 对 Dashboard/自动化任务，限制并发数，避免打爆 Prometheus。

# 安全

## 默认无认证

Prometheus API 默认没有认证和授权。任何能访问 9090 的人都可以：

- 查询所有指标。
- 读取配置、flags、targets。
- 触发 reload/quit（若开启 lifecycle）。
- 删除数据/创建 snapshot（若开启 admin API）。

## 推荐防护

| 措施 | 说明 |
| ---- | ---- |
| 反向代理 | OIDC/OAuth2、basic auth、IP 白名单 |
| `--web.config.file` | 内置 TLS 和 basic auth |
| NetworkPolicy | 只允许监控网络访问 |
| mTLS | 服务间调用强认证 |
| 最小暴露 | 不暴露 9090、不开 NodePort/LoadBalancer |
| 管理接口隔离 | admin API 只对运维网络开放 |
| 审计 | 记录访问日志、管理操作 |
| 限流 | 防止大查询和恶意请求 |

`web-config.yml` 示例：

```yaml
tls_server_config:
  cert_file: /etc/prometheus/server.crt
  key_file: /etc/prometheus/server.key

basic_auth_users:
  admin: "$2y$10$..."   # bcrypt hash
```

## 敏感端点

- `POST /-/reload`：配置热加载，需 `--web.enable-lifecycle`。
- `POST /-/quit`：优雅退出，需 `--web.enable-lifecycle`。
- `POST /api/v1/admin/tsdb/*`：需 `--web.enable-admin-api`。
- `POST /api/v1/write`：需 `--web.enable-remote-write-receiver`。
- `POST /api/v1/otlp/v1/metrics`：需 `--web.enable-otlp-receiver`。

这些端点应只允许可信来源访问。

# 版本差异

## Prometheus 3.x 相关变化

| 变化 | 对 API 的影响 |
| ---- | ------------- |
| UTF-8 metric/label 名称 | 查询和返回的标签名可能包含 UTF-8，PromQL 需按新语法引用 |
| 原生直方图稳定 | 查询可能需要使用 native histogram 语法 |
| `le`/`quantile` 规范化 | 返回的标签值可能是 `1.0` 而不是 `1` |
| `warnings` / `infos` | 成功响应也可能带警告/提示，客户端要处理 |
| `stats` 参数 | 可返回查询统计，便于性能分析 |
| `features` 端点 | 3.8+ 可查询服务端启用特性 |
| `notifications/live` | 3.0+ SSE 通知流 |
| OpenAPI 3.1/3.2 | `/api/v1/openapi.yaml` 可生成客户端 |
| 搜索 API | 3.x 实验性 NDJSON 搜索接口 |

## 兼容性建议

- 客户端解析 JSON 时忽略未知字段。
- 不要硬编码规则/告警字段，版本升级可能新增字段。
- 对实验性接口做降级方案。
- 升级前用 OpenAPI 或 contract test 验证。
- 对 `warnings` 记录日志，避免忽略弃用提示。

# 端点速查

## 查询

| 方法 | 路径 | 用途 |
| ---- | ---- | ---- |
| GET/POST | `/api/v1/query` | 瞬时查询 |
| GET/POST | `/api/v1/query_range` | 区间查询 |
| GET/POST | `/api/v1/format_query` | 格式化 PromQL |
| GET/POST | `/api/v1/parse_query` | 解析 PromQL AST（实验性） |

## 元数据

| 方法 | 路径 | 用途 |
| ---- | ---- | ---- |
| GET/POST | `/api/v1/series` | 查询序列 |
| GET/POST | `/api/v1/labels` | 标签名 |
| GET | `/api/v1/label/<name>/values` | 标签值 |
| GET | `/api/v1/metadata` | 指标元数据 |
| GET | `/api/v1/targets/metadata` | Target 元数据 |
| GET/POST | `/api/v1/query_exemplars` | Exemplars |
| GET/POST | `/api/v1/search/*` | 实验性流式搜索 |

## 运行状态

| 方法 | 路径 | 用途 |
| ---- | ---- | ---- |
| GET | `/api/v1/targets` | Targets |
| GET | `/api/v1/rules` | 规则 |
| GET | `/api/v1/alerts` | 活动告警 |
| GET | `/api/v1/alertmanagers` | Alertmanager 发现 |
| GET | `/api/v1/status/buildinfo` | 构建信息 |
| GET | `/api/v1/status/runtimeinfo` | 运行时信息 |
| GET | `/api/v1/status/flags` | 启动参数 |
| GET | `/api/v1/status/config` | 当前配置 |
| GET | `/api/v1/status/tsdb` | 基数统计 |
| GET | `/api/v1/status/tsdb/blocks` | Block 元数据（实验性） |
| GET | `/api/v1/status/walreplay` | WAL 重放状态 |
| GET | `/api/v1/features` | 启用特性（3.8+） |
| GET | `/api/v1/notifications/live` | SSE 通知（3.0+） |

## 管理与写入

| 方法 | 路径 | 用途 |
| ---- | ---- | ---- |
| POST/PUT | `/api/v1/admin/tsdb/snapshot` | 创建快照 |
| POST/PUT | `/api/v1/admin/tsdb/delete_series` | 删除序列 |
| POST/PUT | `/api/v1/admin/tsdb/clean_tombstones` | 清理 tombstones |
| POST | `/api/v1/write` | Remote Write receiver |
| POST | `/api/v1/otlp/v1/metrics` | OTLP receiver |

## 健康检查

| 方法 | 路径 | 用途 |
| ---- | ---- | ---- |
| GET | `/-/healthy` | 健康 |
| GET | `/-/ready` | 就绪 |
| GET | `/metrics` | Prometheus 自身指标 |
| POST | `/-/reload` | 热加载（需 lifecycle） |
| POST | `/-/quit` | 退出（需 lifecycle） |

# 参考资料

- [Prometheus HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/)
- [Prometheus 管理 API](https://prometheus.io/docs/prometheus/latest/management_api/)
- [Prometheus 配置](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)
- [Prometheus 安全模型](https://prometheus.io/docs/operating/security/)
- [Prometheus Basic Auth](https://prometheus.io/docs/guides/basic-auth/)
- [Prometheus TLS](https://prometheus.io/docs/guides/tls-encryption/)
- [Prometheus 3.0 迁移指南](https://prometheus.io/docs/prometheus/latest/migration/)
- [OpenAPI 规范](https://prometheus.io/docs/prometheus/latest/querying/api/#openapi-specification)

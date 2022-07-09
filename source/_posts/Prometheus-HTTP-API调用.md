---
title: Prometheus-HTTP-API调用
tags: [Prometheus, api]
categories: [监控]
date: 2020-01-07 22:49:26
comments: false
---

<!--more-->

Prometheus API 使用了 JSON 格式的响应内容。 当 API 调用成功后将会返回 2xx 的 HTTP 状态码。当 API 调用失败时可能返回以下几种不同的 HTTP 状态码：

- `404 Bad Request`：参数错误或者缺失
- `422 Unprocessable Entity`：表达式无法执行
- `503 Service Unavailiable`：请求超时或者被中断

## 表达式请求

瞬时数据请求：`/api/v1/query`，有 GET 和 POST 两种方法。有以下参数，参数间用`&`连接：

- `query=`：PromQL 表达式
- `time=<rfc3339 | unix_timestamp>`：用于指定用于计算 PromQL 的时间戳。可选参数，默认情况下使用当前系统时间。
- `timeout=`：超时设置。可选参数，默认情况下使用`-query.timeout` 的全局设置。

请求结果的`data`段的结构如下：

```
{
  "resultType": "matrix" | "vector" | "scalar" | "string",
  "result": <value>
}
```

示例：

```
curl 'http://localhost:9090/api/v1/query?query=up&time=2015-07-01T20:10:51.781Z'
{
   "status" : "success",
   "data" : {
      "resultType" : "vector",
      "result" : [
         {
            "metric" : {
               "__name__" : "up",
               "job" : "prometheus",
               "instance" : "localhost:9090"
            },
            "value": [ 1435781451.781, "1" ]
         },
         ...
      ]
    }
}
```

区间数据请求：`/api/v1/query_range`，支持 GET 和 POST。有以下参数：

- `query=`: PromQL 表达式。
- `start=`: 起始时间。
- `end=`: 结束时间。
- `step=`: 查询步长。
- `timeout=`: 超时设置。可选参数，默认情况下使用`-query.timeout`的全局设置。

请求结果的`data`段结构：

```
{
  "resultType": "matrix",
  "result": <value>
}
```

示例：

```
curl 'http://localhost:9090/api/v1/query_range?query=up&start=2015-07-01T20:10:30.781Z&end=2015-07-01T20:11:00.781Z&step=15s'
{
   "status" : "success",
   "data" : {
      "resultType" : "matrix",
      "result" : [
         {
            "metric" : {
               "__name__" : "up",
               "job" : "prometheus",
               "instance" : "localhost:9090"
            },
            "values" : [
               [ 1435781430.781, "1" ],
               [ 1435781445.781, "1" ],
               [ 1435781460.781, "1" ]
            ]
         },
         ...
      ]
   }
}
```

## 请求元数据

请求序列信息：`/api/v1/series`，有 GET 和 POST 方法。有以下参数：

- `match[] = <series_selector>`：重复的序列选择器参数，用于选择要返回的序列。必须至少提供一个`match[]`参数。
- `start = <rfc3339 | unix_timestamp>`：开始时间戳。
- `end = <rfc3339 | unix_timestamp>`：结束时间戳。

查询结果的`data`部分由一个对象列表组成，这些对象包含标识每个系列的标签名/值对。

```
curl -g 'http://localhost:9090/api/v1/series?' --data-urlencode='match[]=up' --data-urlencode='match[]=process_start_time_seconds{job="prometheus"}'

{
   "status" : "success",
   "data" : [
      {
         "__name__" : "up",
         "job" : "prometheus",
         "instance" : "localhost:9090"
      },
      ...
   ]
}
```

获取标签（label）名：`/api/v1/labels`，支持 GET 和 POST。

```
curl 'localhost:9090/api/v1/labels'
{
    "status": "success",
    "data": [
        "__name__",
        "call",
        "code",
        "config",
        "dialer_name",
        "endpoint",
        ...
    ]
}
```

获取标签值：`/api/v1/label/<label_name>/values`，仅支持 GET

```
curl http://localhost:9090/api/v1/label/job/values
{
   "status" : "success",
   "data" : [
      "node",
      "prometheus"
   ]
}
```

## targets

获取 targets：`/api/v1/targets`，支持 GET。
活动（active）目标和已删除（dropped）目标都是响应的一部分。 `labels`表示在重新标记后的标签集。`discoverLabel`表示在重新标记之前在服务发现期间检索到的未修改的标签。

```
curl http://localhost:9090/api/v1/targets
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
        "scrapeUrl": "http://127.0.0.1:9090/metrics",
        "lastError": "",
        "lastScrape": "2017-01-17T15:07:44.723715405+01:00",
        "health": "up"
      }
    ],
    "droppedTargets": [
      {
        "discoveredLabels": {
          "__address__": "127.0.0.1:9100",
          "__metrics_path__": "/metrics",
          "__scheme__": "http",
          "job": "node"
        },
      }
    ]
  }
}
```

## rules

获取 rules：`/api/v1/rules`，支持 GET。返回当前加载的报警和记录规则的列表，还返回由每个报警规则的 Prometheus 实例触发的当前活动报警。

```
curl http://localhost:9090/api/v1/rules

{
    "data": {
        "groups": [
            {
                "rules": [
                    {
                        "alerts": [
                            {
                                "activeAt": "2018-07-04T20:27:12.60602144+02:00",
                                "annotations": {
                                    "summary": "High request latency"
                                },
                                "labels": {
                                    "alertname": "HighRequestLatency",
                                    "severity": "page"
                                },
                                "state": "firing",
                                "value": "1e+00"
                            }
                        ],
                        "annotations": {
                            "summary": "High request latency"
                        },
                        "duration": 600,
                        "health": "ok",
                        "labels": {
                            "severity": "page"
                        },
                        "name": "HighRequestLatency",
                        "query": "job:request_latency_seconds:mean5m{job=\"myjob\"} > 0.5",
                        "type": "alerting"
                    },
                    {
                        "health": "ok",
                        "name": "job:http_inprogress_requests:sum",
                        "query": "sum(http_inprogress_requests) by (job)",
                        "type": "recording"
                    }
                ],
                "file": "/rules.yaml",
                "interval": 60,
                "name": "example"
            }
        ]
    },
    "status": "success"
}
```

## alerts

获取 alerts：`/api/v1/alerts`，支持 GET。返回所有启用的报警的列表。

```
curl http://localhost:9090/api/v1/alerts

{
    "data": {
        "alerts": [
            {
                "activeAt": "2018-07-04T20:27:12.60602144+02:00",
                "annotations": {},
                "labels": {
                    "alertname": "my-alert"
                },
                "state": "firing",
                "value": "1e+00"
            }
        ]
    },
    "status": "success"
}
```

## alertmanager

获取 alertmanager 信息：`/api/v1/alertmanagers`。支持 GET。返回 Prometheus alertmanager 发现的当前状态的概述。

```
curl http://localhost:9090/api/v1/alertmanagers
{
  "status": "success",
  "data": {
    "activeAlertmanagers": [
      {
        "url": "http://127.0.0.1:9090/api/v1/alerts"
      }
    ],
    "droppedAlertmanagers": [
      {
        "url": "http://127.0.0.1:9093/api/v1/alerts"
      }
    ]
  }
}
```

## status

获取该结点的当前的 Prometheus 配置：`/api/v1/status/config`，支持 GET。
配置作为转储的 YAML 文件返回。 由于 YAML 库的限制，不包括 YAML 注释。

```
curl http://localhost:9090/api/v1/status/config
{
  "status": "success",
  "data": {
    "yaml": "<content of the loaded config file in YAML>",
  }
}
```

获取配置 Prometheus 的标志值：`/api/v1/status/flags`，支持 GET。

```
curl http://localhost:9090/api/v1/status/flags
{
  "status": "success",
  "data": {
    "alertmanager.notification-queue-capacity": "10000",
    "alertmanager.timeout": "10s",
    "log.level": "info",
    "query.lookback-delta": "5m",
    "query.max-concurrency": "20",
    ...
  }
}
```

获取关于 Prometheus 服务器的各种运行时信息属性：`/api/v1/status/runtimeinfo`，支持 GET。
根据运行时属性的性质，返回的值具有不同的类型。

```
curl http://localhost:9090/api/v1/status/runtimeinfo
{
  "status": "success",
  "data": {
    "startTime": "2019-11-02T17:23:59.301361365+01:00",
    "CWD": "/",
    "reloadConfigSuccess": true,
    "lastConfigTime": "2019-11-02T17:23:59+01:00",
    "chunkCount": 873,
    "timeSeriesCount": 873,
    "corruptionCount": 0,
    "goroutineCount": 48,
    "GOMAXPROCS": 4,
    "GOGC": "",
    "GODEBUG": "",
    "storageRetention": "15d"
  }
}
```

获取关于 Prometheus 服务器的各种构建信息属性：`/api/v1/status/buildinfo`，支持 GET。

```
curl http://localhost:9090/api/v1/status/buildinfo
{
  "status": "success",
  "data": {
    "version": "2.13.1",
    "revision": "cb7cbad5f9a2823a622aaa668833ca04f50a0ea7",
    "branch": "master",
    "buildUser": "julius@desktop",
    "buildDate": "20191102-16:19:59",
    "goVersion": "go1.13.1"
  }
}
```


---
title: AlertManager
tags: [AlertManager, Prometheus]
categories: [监控]
date: 2022-07-09 23:25:58
comments: false
---

<!--more-->

# 架构

![](https://raw.githubusercontent.com/prometheus/alertmanager/f9c1c9072d30ce3b4051af451c3e615cef36ad99/doc/arch.svg)

- Alert Provider：处理通过 API 传入的告警
- Silence Provider：处理静默规则
- Notify Provider：实例间发送告警信息

Prometheus 的告警分为两个部分。 Prometheus 服务器中的告警规则将告警发送到 Alertmanager。 然后，告警管理器将重复数据删除，分组，再通过电子邮件，语音系统和聊天平台等方法管理这些告警，包括静默，禁止，聚合和发出通知。

分组（Grouping）将性质相似的告警归类为单个通知。当许多系统同时发生故障，并且可能同时发出数百到数千个告警时，这种方法尤其有用。告警分组、分组通知的定时以及这些通知的接收者由配置文件中的路由树配置。

抑制（Inhibition）是当某些其他告警已经触发时，抑制某些告警的通知。发出告警，通知整个集群不可访问。可以将 Alertmanager 配置为使与该集群有关的所有其他告警静默，这样可以防止与实际问题无关的数百或数千个触发告警的通知。

静默（Sliences）是一种简单地在给定时间内静音告警的简单方法。静默是基于匹配器（matchers）配置的，就像路由树一样。将检查传入告警是否与活动静默的所有equal或正则表达式匹配，若匹配，则将不会发送该告警的通知。静默是在 Alertmanager 的 web 界面配置的。

Alertmanager 支持配置以创建高可用性集群。这可以使用`——cluster-*`标志进行配置。重点是**不要在 Prometheus 和它的 Alertmanagers 之间进行负载平衡**，而是将 Prometheus 指向一个所有 Alertmanager 的列表。
> 具体原因详见：https://mp.weixin.qq.com/s/HPduEeULUkmnjuoXMVcPRA

# 部署
> 下载：https://prometheus.io/download/#alertmanager

解压后执行 alertmanager 命令，需要当前目录有配置文件，默认配置文件为：

```
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://127.0.0.1:5001/'
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
```

启动 alertmanager，通过 web 的 9093 端口访问

配置 systemd 服务`/usr/lib/systemd/system/alertmanager.service`：

```
[Unit]
Description=Alertmanager
After=network.target

[Service]
Type=simple
Restart=on-failure
ExecStart=/usr/local/bin/alertmanager --config.file=/etc/prometheus/alertmanager.yml --storage.path=/var/lib/alertmanager

[Install]
WantedBy=multi-user.target
```

若用supervisor管理，以下为配置
```ini
[program:alertmanager]
command=/usr/local/bin/alertmanager --config.file=/etc/prometheus/alertmanager.yml --storage.path=/var/lib/alertmanager
redirect_stderr=true
stdout_logfile=/data/logs/alertmanager.log
autostart=true
autorestart=true
startsecs=10
```

## alertmanager配置详解
```yaml
global:
  resolve_timeout: 1m

# 根路由，不能存在 match和match_re，任何告警数据没有匹配到路由时，将会由此根路由进行处理。
route:
  # 根据什么进行分组，此处配置的是根据告警的名字分组,没有指定 group_by是根据规则文件的 groups[n].name 来分组的。
  group_by: ['alertname']

  # 当产生一个新分组时，告警信息需要等到 group_wait 才可以发送出去
  group_wait: 10s

  # 如果上次告警信息发送成功，此时又来了一个新的告警数据，则需要等待 group_interval 才可以发送出去
  group_interval: 10s

  # 如果上次告警信息发送成功，且问题没有解决，则等待 repeat_interval 再次发送告警数据
  repeat_interval: 15m

   # 告警的接收者，需要和 receivers[n].name 的值一致
  receiver: 'default-receiver'

  routes:
  - receiver: 'default-receiver'
    group_interval: 1m
    repeat_interval: 8h
    continue: true

receivers:
- name: 'default-receiver'
  webhook_configs:
  #- url: 'http://127.0.0.1:5000/'   # 告警会被post到指定的接受者
    send_resolved: true

# 抑制规则，减少告警数据
inhibit_rules:
  - source_match:  # 匹配当前告警规则后，抑制住target_match的告警规则
      severity: 'critical' # 自定义的告警级别是 warning
    target_match: # 被抑制的告警规则
      severity: 'warning' # 抑制住的告警级别，简单说，就是如果同一告警条目的critical和warning都被触发，则只发critical的告警
    equal: ['alertname', 'env', 'instance', 'endpoint']   # 这些全部匹配则是上面说的同一告警条目
```

以下为prometheus上对接alertmanager的配置
```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - xx.xx.xx.xx:9093
      timeout: 10s      # 告警超时
      api_version: v1   # alertmanager api版本，默认v2，可以不配置，v1和v2兼容

rule_files:
  - /data/prometheus/alert_conf/*.yml   # 告警规则路径
```

## rules配置详解
以下为官方案例：
```yaml
groups:
- name: example
  rules:
  - alert: HighRequestLatency
    expr: job:request_latency_seconds:mean5m{job="myjob"} > 0.5
    for: 10m
    labels:
      severity: page
    annotations:
      summary: High request latency
```
- alert：告警名称
- for：满足触发状态持续时间，以上面案例，若满足这个状态一直持续了10分钟，则触发告警
- expr：表达式
- labels：给告警添加额外的标签，一般添加一个`severity`
- annotations：给告警添加说明，一般添加`description`和`summary`

> 详细配置可见：[AlertManager常用告警规则汇总](/2022/AlertManager常用告警规则汇总/)

> 参考文章
> https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/
> https://prometheus.io/docs/prometheus/latest/configuration/configuration/
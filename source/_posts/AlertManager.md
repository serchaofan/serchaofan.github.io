---
title: AlertManager
tags: [AlertManager, Prometheus]
categories: [监控]
date: 2022-07-09 23:25:58
---

<!--more-->

Prometheus 的报警分为两个部分。 Prometheus 服务器中的报警规则将报警发送到 Alertmanager。 然后，报警管理器将重复数据删除，分组，再通过电子邮件，通话通知系统和聊天平台等方法管理这些报警，包括静默，禁止，聚合和发出通知。

分组（Grouping）将性质相似的警报归类为单个通知。当许多系统同时发生故障，并且可能同时发出数百到数千个警报时，这种方法尤其有用。警报分组、分组通知的定时以及这些通知的接收者由配置文件中的路由树配置。

抑制（Inhibition）是当某些其他警报已经触发时，抑制某些警报的通知。发出警报，通知整个群集不可访问。 可以将 Alertmanager 配置为使与该群集有关的所有其他警报静音，这样可以防止与实际问题无关的数百或数千个触发警报的通知。通过 Alertmanager 的配置文件配置抑制。

静默（Sliences）是一种简单地在给定时间内静音警报的简单方法。静默是基于匹配器（matchers）配置的，就像路由树一样。将检查传入警报是否与活动静默的所有相等或正则表达式匹配。如果这样做了，将不会发送该警报的通知。静默是在 Alertmanager 的 web 界面配置的。

Alertmanager 支持配置以创建高可用性集群。这可以使用`——cluster-*`标志进行配置。重点是不要在 Prometheus 和它的 Alertmanagers 之间进行负载平衡，而是将 Prometheus 指向一个所有 Alertmanagers 的列表。

下载：https://prometheus.io/download/#alertmanager
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


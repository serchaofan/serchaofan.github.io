---
title: PrometheusExporter维护
tags: [Prometheus, exporter]
categories: [监控]
date: 2022-07-05 22:10:57
comments: false
---

<!--more-->

- node_expoter
- mysqld_exporter
- redis_exporter
- blackbox_exporter
- elasticsearch_exporter

# Node exporter

主要用于暴露 metrics 给 Prometheus，其中 metrics 包括：cpu 的负载，内存的使用情况，网络等。
下载安装：https://prometheus.io/download/#node_exporter
解压后将 node_exporter 放到`/usr/local/bin`中，然后执行。可通过浏览器访问 9100 端口`/metrics`查看

可创建 systemd 服务：

```
[Unit]
Description=node_exporter
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/node_exporter
Restart=on-failure
[Install]
WantedBy=multi-user.target
```

docker 启动：

```
docker run -d -p 9100:9100 -v /proc:/host/proc -v /sys:/host/sys -v /:/rootfs prom/node-exporter
```
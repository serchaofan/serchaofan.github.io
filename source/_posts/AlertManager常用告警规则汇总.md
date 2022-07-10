---
title: AlertManager常用告警规则汇总
tags: [AlertManager, Prometheus, Kubernetes]
categories: [监控]
date: 2022-07-10 15:44:12
---
<!--more-->

# 主机
```yaml
groups:
- name: 主机监控告警 # host_alert
  rules:
  - alert: "CPU负载"
    expr: node_load15 > on(instance, env, dept,group, job, project) (count by(instance, env, group, job, project) (node_cpu_seconds_total{mode="idle"}) * 5)
    for: 5m
    labels:
      severity: critical
    annotations:
      description: '实例: {{$labels.instance}} CPU 5分钟负载值为:{{$value}}'
      summary: CPU负载过高

  - alert: "CPU使用率大于90%"
    expr: 100- (avg by(instance, env, dept,group, job, project) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
    for: 5m
    labels:
      severity: critical
    annotations:
      description: '实例: {{$labels.instance}} CPU使用率为{{ $value| printf `%.2f`}}%持续时间5分钟'

  - alert: "磁盘使用率"
    # 磁盘使用率
    # expr: (100 - ((node_filesystem_avail_bytes{mountpoint="/"} * 100) / node_filesystem_size_bytes{mountpoint="/"})) > 80
    # 剩余多少G
    expr: (node_filesystem_avail_bytes{device!="rootfs",mountpoint!~"/boot|/selinux|/cgroup/.*|/mnt/.*|/run.*"} / 1024 ^ 3 < 10) and ((1 - node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 > 90)
    for: 5m
    labels:
      severity: warning
    annotations:
      description: '实例: {{$labels.instance}} 剩余空间为{{ $value|printf `%.2f`}}G'
      summary: 剩余空间不足

  - alert: "主机离线"
    expr: up{job!~"prometheus|port"} == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      description: '实例: {{$labels.instance}} down'
      summary: "实例 Down"

  - alert: "剩余磁盘inode"
    expr: node_filesystem_files_free{device!="rootfs",mountpoint!~"/boot/efi|/boot|/selinux|/cgroup/.*|/run.*|/var/lib/nfs/rpc_pipefs|.*docker.*|/mnt/.*|/home.*|/hdfs.*"}   < 50000
    for: 1m
    labels:
      severity: warning
    annotations:
      description: '实例: {{$labels.instance}} inode Usage {{ $labels.mountpoint }} : {{$value}}'
      summary: 剩余磁盘inode不足

  - alert: 文件打开数 #GlobalFileDescriptorsUsage
    expr: node_filefd_allocated / node_filefd_maximum > 0.9
    for: 1m
    labels:
      severity: warning
    annotations:
      description: '{{if (gt $value 0.95)}} 【严重】[Uh-Oh] {{else if (gt $value 0.9)}} 【预警】[Hot] {{else}} 【提醒】[Staple] {{end}}实例: {{$labels.instance}}文件打开数达到最大限制的{{ $value }}'
      summary: 文件打开数达到90%

  - alert: 内存使用率大于92%
    expr: 100 - ((node_memory_MemAvailable_bytes * 100) / node_memory_MemTotal_bytes) > 95
    for: 10m
    labels:
      severity: critical
    annotations:
      description: '实例:{{$labels.instance}} 内存使用率为{{ $value| printf `%.2f`}}%持续时间:10分钟'

  - alert: 内存使用率>98%
    expr: 100 - ((node_memory_MemAvailable_bytes * 100) / node_memory_MemTotal_bytes) > 98
    for: 5m
    labels:
      severity: critical
    annotations:
      description: '实例:{{$labels.instance}} 内存使用率为{{ $value| printf `%.2f`}}%持续时间为5分钟'

  - alert: 主机swap内存使用率
    expr: (1 - (node_memory_SwapFree_bytes / node_memory_SwapTotal_bytes)) * 100 > 80
    for: 3m
    labels:
      severity: warning
    annotations:
      description: '实例: {{$labels.instance}} swap内存使用率为{{ $value| printf `%.2f`}}%'
      summary: swap内存使用率超过90%

  - alert: 主机事件OOM kill # HostOomKillDetected
    expr: increase(node_vmstat_oom_kill[2m]) > 0
    #for: 2m
    labels:
      severity: critical
    annotations:
      description: '实例: {{$labels.instance}} 发生 {{ $value| printf `%.f`}} 次 OOM kill '
      summary: "主机2分钟内发生过 OOM kill"

  - alert: 流出网络带宽TX过高  # OuNetworkUsage
    expr: ((sum by(instance,addr,env) (rate(node_network_transmit_bytes_total{device!~"tap.*|veth.*|br.*|docker.*|virbr*|lo*"}[5m])))) / 1024 / 1024 > 500
    for: 10m
    labels:
      severity: warning
    annotations:
      description: '实例: {{$labels.instance}} TX带宽为{{$value| printf `%.2f`}}Mbps'
      summary: 流出网络带宽过高

  - alert: 流入网络带宽RX过高  # IntNetworkUsage
    expr: ((sum by(instance,addr,env) (rate(node_network_receive_bytes_total{device!~"tap.*|veth.*|br.*|docker.*|virbr*|lo*"}[5m])))) / 1024 /1024 > 500
    for: 10m
    labels:
      severity: warning
    annotations:
      description: '实例: {{$labels.instance}} RX带宽为{{$value| printf `%.2f`}}Mbps'
      summary: 流入网络带宽过高

  - alert: TCP连接数 # TcpUsage
    expr: node_netstat_Tcp_CurrEstab > 20000
    for: 1m
    labels:
      severity: warning
    annotations:
      description: '实例: {{$labels.instance}} TCP_ESTABLISHED value:{{$value}}'
      summary: TCP连接数过高

  - alert: TCP TIME_WAIT # Tcp_twUsage
    expr: node_sockstat_TCP_tw > 12000
    for: 1m
    labels:
      severity: warning
    annotations:
      description: '实例: {{$labels.instance}} time_wait value:{{$value}}'
      summary: TCP time_wait 过高

  - alert: 磁盘每秒读数据 # HostUnusualDiskReadRate
    expr: sum by (instance,project,addr,env) (rate(node_disk_read_bytes_total[2m])) / 1024 / 1024 > 1024
    for: 10m
    labels:
      severity: warning
    annotations:
      description: '实例: {{$labels.instance}} 磁盘每秒读数据:{{$value| printf `%.2f`}}MB'
      # description: Disk is probably reading too much data (> 50 MB/s)\n  VALUE = {{ $value }}\n  LABELS: {{ $labels }}
      summary: "磁盘每秒读取数据过高"

  - alert: 磁盘每秒写数据 # HostUnusualDiskWriteRate
    expr: sum by (instance,project,addr,env) (rate(node_disk_written_bytes_total[2m])) / 1024 / 1024 > 1024
    for: 10m
    labels:
      severity: warning
    annotations:
      description: '实例: {{$labels.instance}} 磁盘每秒写数据:{{$value| printf `%.2f`}}MB'
      summary: "磁盘每秒写入数据过高"
```

# HTTP
```yaml
groups:
- name: HTTP告警 # http_alert
  rules:
  - alert: "域名证书过期告警"
    expr: (probe_ssl_earliest_cert_expiry{} - time() ) /60/60/24 < 30
    labels:
      severity: "warning"
    annotations:
      description: "域名: {{$labels.instance}} 证书剩余过期时间为: {{ $value| printf `%.f` }}天"

  - alert: "HTTP双向认证状态码"
    expr: probe_http_status_code{job=~"http_get|ingresses_http_get", env="prod",auth="ssl"} != 400 and probe_http_status_code{job=~"http_get|ingresses_http_get", env="prod",auth="ssl"} != 404
    for: 3m
    labels:
      severity: "critical"
    annotations:
      description: "接口: {{$labels.instance}} code is {{ $value }}"
      summary: "接口HTTP CODE非 400"

  - alert: "HTTP状态码告警" # http_code_alert
    expr: probe_http_status_code{auth!="ssl",job=~"http_get|ingresses_http_get"} != 200
    for: 3m
    labels:
      severity: "critical"
    annotations:
      description: "接口: {{$labels.instance}} code is {{ $value }}"
      summary: "接口HTTP CODE非200"

  - alert: "接口resolve超时" # http_connect_time_alert
    expr: probe_http_duration_seconds{phase="connect",env!="uat"} * 1000 > 3000
    for: 5m
    labels:
      severity: "warning"
    annotations:
      summary: "接口connect超时"
      description: "接口: {{$labels.instance}} connect超时 {{ $value| printf `%.2f` }}ms"

  - alert: "接口processing超时" # http_processing_time_alert
    expr: probe_http_duration_seconds{phase="processing",env!="uat"} * 1000 > 3000
    for: 5m
    labels:
      severity: "warning"
    annotations:
      summary: "接口processing超时"
      description: "接口: {{$labels.instance}} processing超时 {{ $value| printf `%.2f` }}ms"

  - alert: http_resolve_time_alert
    expr: probe_http_duration_seconds{phase="resolve",env!="uat"} * 1000 > 3000
    for: 5m
    labels:
      severity: "warning"
    annotations:
      summary: "接口resolve超时"
      description: "接口: {{$labels.instance}} resolve超时 {{ $value| printf `%.2f` }}ms"

  - alert: http_tls_time_alert
    expr: probe_http_duration_seconds{phase="tls",env!="uat"} * 1000 > 3000
    for: 5m
    labels:
      severity: "warning"
    annotations:
      summary: "接口tls超时"
      description: "接口: {{$labels.instance}} tls超时 {{ $value| printf `%.2f` }}ms"

  - alert: http_transfer_time_alert
    expr: probe_http_duration_seconds{phase="transfer",env!="uat"} * 1000 > 3000
    for: 5m
    labels:
      severity: "warning"
    annotations:
      summary: "接口transfer超时"
      description: "接口: {{$labels.instance}} transfer超时 {{ $value| printf `%.2f` }}ms"
```

# ICMP
```yaml
groups:
- name: icmp_ping_alert
  rules:
  - alert: icmp_ping_alert
    expr: avg_over_time(probe_duration_seconds{job="icmp"}[10m]) > 0.3
    for: 15m
    labels:
      severity: "warning"
    annotations:
      description: "{{$labels.instance}}ping 10分钟平均为:{{ $value| printf `%.5f`}}秒"

  - alert: "IP离线"
    expr: probe_success{job="icmp"} == 0
    for: 2m
    labels:
      severity: "critical"
    annotations:
      summary: "虚拟VIP离线"
      description: "实例: {{$labels.app}} 虚拟VIP {{ $labels.addr }} 网路不可达"
```

# 端口
```yaml
groups:
- name: "端口异常告警"  # port_alert
  rules:
  - alert: "端口离线"
    expr: probe_success{job="port"} == 0
    for: 5m
    labels:
      severity: "critical"
    annotations:
      summary: "端口离线"
      description: "实例: {{$labels.app}} 端口 {{ $labels.port }} is down"
```

# ES
```yaml
groups:
- name: "elasticsearch"
  rules:
  - alert: "ES进程使用的 CPU 百分比"
    expr: elasticsearch_process_cpu_percent > 80
    for: 3m
    labels:
      severity: warning
    annotations:
      description: "ES集群:{{$labels.app}} 进程使用率为:{{ $value| printf `%.2f`}}%"
      summary: "ES进程CPU使用百分比大于80%"

  - alert: "ES_os_load5"
    expr: irate(elasticsearch_os_load5[5m])  > 10
    labels:
      severity: warning
    annotations:
      description: "ES集群:{{$labels.app}} 负载最近监控值为:{{ $value| printf `%.2f`}}"
      summary: "ES_os_load5 大于 10"

  - alert: "ES线程池操作排队ics"
    expr: elasticsearch_thread_pool_queue_count > 200
    for: 10m
    labels:
      severity: warning
    annotations:
      description: "ES集群:{{$labels.app}} 线程池操作排队数为:{{ $value| printf `%.2f`}}"
      summary: "ES线程池操作排队大于200"

  - alert: "ES线程池操作排队"
    expr: elasticsearch_thread_pool_queue_count > 100
    for: 10m
    labels:
      severity: warning
    annotations:
      description: "ES集群:{{$labels.app}} 线程池操作排队数为:{{ $value| printf `%.2f`}}"
      summary: "ES线程池操作排队 is not 0"

  - alert: "ES线程池线程活动"
    expr: elasticsearch_thread_pool_active_count{type="management"} < 1
    for: 5m
    labels:
      severity: warning
    annotations:
      description: "ES集群:{{$labels.app}} 线程池线程活动数为:{{ $value| printf `%.2f`}}"
      summary: "ES线程池线程活动数异常"

  - alert: "打开文件描述符超过系统最大值的90%"
    expr: (elasticsearch_process_open_files_count/max_file_descriptor_count) * 100 > 90
    for: 5m
    labels:
      severity: warning
    annotations:
      description: "ES集群:{{$labels.app}} 打开文件描述符使用率为:{{ $value| printf `%.2f`}}"

  - alert: "JVM GC次数"
    expr: irate(elasticsearch_jvm_gc_collection_seconds_count[1m]) > 8
    labels:
      severity: warning
    annotations:
      description: "ES集群:{{$labels.app}} 主机:{{$labels.host}} gc:{{$labels.gc}} 1分钟GC次数为:{{ $value| printf `%.2f`}}"
      summary: "每分钟GC数量大于3"

  - alert: ES tripped for breaker(断路器跳闸)
    expr: elasticsearch_breakers_tripped > 0
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: " ES node {{ $labels.app }} breakers tripped 最近监控值为:{{ $value| printf `%.2f`}}"
      description: "ES tripped for breaker 大于 0"


  - alert: "JVM内存使用率"
    expr: (elasticsearch_jvm_memory_used_bytes{area="heap"}/elasticsearch_jvm_memory_committed_bytes{area="heap"}) * 100 > 90
    for: 5m
    labels:
      severity: warning
    annotations:
      description: "ES节点:{{$labels.node}}JVM内存15分钟平均使用率为:{{ $value| printf `%.2f`}}%"
      summary: "JVM内存使用率大于90%"

  - alert: "ES 磁盘使用率告警"
    expr: 100 * (elasticsearch_filesystem_data_size_bytes - elasticsearch_filesystem_data_free_bytes)/elasticsearch_filesystem_data_size_bytes > 90
    for: 5m
    labels:
      severity: warning
    annotations:
      description: "ES节点:{{$labels.host}} 磁盘使用率为:{{ $value| printf `%.2f`}}%"
```

# MySQL
```yaml
groups:
- name: mysql_alert
  rules:
  - alert: 主从同步进程异常告警 # MySQLReplicationNotRunning
    expr: mysql_slave_status_slave_io_running == 0 or mysql_slave_status_slave_sql_running == 0
    for: 3m
    labels:
      severity: "warning"
    annotations:
      summary: "主从同步进程DOWN"
      description: "mysql实例 {{ $labels.instance }} 主从同步运行异常"

  - alert: 连接数告警 # MySQLConnections
    expr: (mysql_global_status_threads_connected / mysql_global_variables_max_connections) * 100 > 90
    for: 5m
    labels:
      severity: "critical"
    annotations:
      summary: "连接数超过90%"
      description: "mysql实例: {{$labels.instance}} 连接数超过90%"

  - alert: 主从同步延迟告警 # MySQLReplicationLag
    expr: (mysql_slave_status_seconds_behind_master > 300) and on(instance) (predict_linear(mysql_slave_status_seconds_behind_master[5m], 60 * 2) > 0)
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "主从同步延迟"
      description: "mysql实例: {{ $labels.instance }} MySQL slave replication is lagging: {{ $value }}"

  - alert: 数据库锁告警 #MySQLWaitLock
    expr: increase(mysql_global_status_table_locks_waited[10m]) > 10
    for: 3m
    labels:
      severity: "warning"
    annotations:
      summary: "数据库锁"
      description: "{{$labels.instance}} waiting for lock value is :{{ $value| printf `%.f`}}"

  - alert: "文件打开数告警"
    expr: mysql_global_status_innodb_num_open_files > (mysql_global_variables_open_files_limit) * 0.8
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "文件打开数达到80%"
      description: "mysql实例:{{ $labels.instance }} 文件打开数值为: {{ $value }}"

  - alert: 从同步延迟告警 # slave delay
    expr: mysql_slave_status_seconds_behind_master > 120
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "主从同步延迟"
      description: "从库{{ $labels.instance }}与主库{{ $labels.master_host }}延迟:{{ $value }} 秒"

  - alert: "慢SQL告警"
    expr: rate(mysql_global_status_slow_queries[5m]) > 300
    for: 5m
    labels:
      alertname: "mysql慢SQL告警"
      severity: "warning"
    annotations:
      summary: "mysql出现慢SQL告"
      description: "mysql实例:{{ $labels.instance }}出现慢SQL{{ $value| printf `%.f`}}次"
```

# Redis
```yaml
groups:
- name: redis_alert
  rules:
  - alert: "内存使用率超过" # RedisMemoryUsage
    expr: redis_memory_used_bytes/redis_config_maxmemory * 100  != +Inf > 80
    for: 1m
    labels:
      severity: "critical"
    annotations:
      summary: "内存使用率超过80%"
      description: '实例: {{$labels.instance}} 内存使用率为{{ $value| printf `%.2f`}}%'

  - alert: "连接数使用率告警" # RedisConnectedUsage
    expr: (redis_connected_clients/redis_config_maxclients * 100) > 80
    for: 1m
    labels:
      severity: "critical"
    annotations:
      summary: "连接数使用率超过80%"
      description: "实例: {{$labels.instance}}连接数超过80%"

  - alert: "redis命中率过低告警" # RedisHitUsage
    expr: ( irate (redis_keyspace_hits_total[5m]) /  (irate(redis_keyspace_hits_total[5m]) + irate(redis_keyspace_misses_total[5m])) ) * 100 < 5 and irate(redis_keyspace_hits_total[5m]) > 0
    for: 1m
    labels:
      severity: "warning"
    annotations:
      summary: "redis命中率低于5%"
      description: '实例: {{$labels.instance}}redis命中率为:{{ $value| printf `%.2f`}}'
```

# Nginx
```yaml
groups:
- name: "nginx告警"
  rules:
  - alert: "nginx_reading异常告警"
    expr: increase(nginx_vts_main_connections{ status=~"reading"}[3m]) > 2
    for: 3m
    labels:
      severity: "warning"
    annotations:
      description: "实例: {{$labels.project}} {{$labels.status}}最近监控值为:{{$value| printf `%.f`}}"
      summary: "nginx_reading异常"

  - alert: "nginx_5xx异常告警"
    expr: increase(nginx_vts_server_requests_total{code="5xx"}[5m]) > 20
    labels:
      severity: "critical"
    annotations:
      description: "实例: {{$labels.project}}:{{$labels.host}} 5xx 最近监控值为:{{$value| printf `%.f`}}"
      summary: "nginx_5xx异常告警"

  - alert: "nginx_后端响应超时告警"
    expr: sum(nginx_vts_upstream_response_seconds) by (backend,app,dept,env,project,upstream) > 5
    for: 3m
    labels:
      severity: "critical"
    annotations:
      description: "实例: {{$labels.project}} nginx 访问后端 {{$labels.backend}} 耗时为:{{$value| printf `%.2f`}}秒"
      summary: "nginx_后端响应超时异常"
```

# K8S
```yaml
groups:
- name: "kubernetes"
  rules:
  - alert: "kube_node状态异常告警" # 监控集群节点状态是否准备好，
    expr: kube_node_status_condition{condition="Ready",status="true"} == 0
    for: 1m
    labels:
      severity: "critical"
    annotations:
      description: "node节点:{{$labels.node}}状态异常"
      summary: "kube_node 状态异常!"

  - alert: "pod不可调度告警"
    expr: kube_node_spec_taint{key="node.kubernetes.io/unreachable",effect="NoSchedule"} == 1
    for: 5m
    labels:
      severity: "critical"
    annotations:
      description: "node节点:{{$labels.node}}不可调度"
      summary: "pod不可调度"

  - alert: "node可运行pod数量不足告警"
    expr: count by(node,project,env,dept) ((kube_pod_status_phase{name=~".+",phase="Running"} == 1) * on(instance,pod,namespace,name,dept) group_left(node) topk by(instance,pod,namespace,name) (1, kube_pod_info{name=~".+",}))/max by(node,project,env) (kube_node_status_capacity{name=~".+",resource="pods"} != 1) *100 >= 80
    for: 5m
    labels:
      severity: "critical"
    annotations:
      description: "{{$labels.node}}上运行pod数量超过pod数量上限的90%,监控值为:{{ $value| printf `%.f` }}"
      summary: "node运行pod数量超过pod数量上限"

  - alert: "node 状态抖动告警"
    expr: sum(changes(kube_node_status_condition{status="true",condition="Ready"}[15m])) by (project,node,name,env) > 2
    for: 5m
    labels:
      alertname: "kube_node状态抖动告警"
      severity: "warning"
    annotations:
      description: "{{$labels.project}}-{{$labels.node}}15分钟内存在抖动"
      summary: "kube_node 状态抖动"

  - alert: "pod运行状态异常告警"
    expr: sum by (name,namespace,pod,project,env,dept) (kube_pod_status_phase{ phase=~"Failed|Unknown"}) > 0
    for: 5m
    labels:
      alertname: "pod运行状态异常告警"
      severity: "critical"
    annotations:
      description: "pod:{{$labels.name}}-{{$labels.namespace}}-{{$labels.pod}}运行状态为Unknown|Failed"
      summary: "pod运行状态为Unknown|Failed"

  - alert: "pod等待状态告警"
    expr: kube_pod_container_status_waiting == 1
    for: 5m
    labels:
      alertname: "pod等待状态告警"
      severity: "critical"
    annotations:
      description: "pod:{{$labels.name}}-{{$labels.namespace}}-{{$labels.pod}} 运行处于等待状态!"
      summary: "pod运行处于等待状态!"

  - alert: "pod终止状态告警"
    expr: kube_pod_container_status_terminated{namespace!~"kube-system|ingress-nginx|default|crontab"} == 1
    for: 5m
    labels:
      alertname: "pod终止状态告警"
      severity: "critical"
    annotations:
      description: "pod:{{$labels.name}}-{{$labels.namespace}}-{{$labels.pod}}运行处于终止状态"
      summary: "pod运行处于终止状态"

  - alert: "pod5分钟内发生过OOM告警"
    expr: increase(kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}[5m]) > 0
    labels:
      alertname: "pod发生OOM告警"
      severity: "critical"
    annotations:
      description: "pod:{{$labels.name}}-{{$labels.namespace}}-{{$labels.pod}} 发生OOM!"

  - alert: "pod发生重启告警"
    expr: increase(kube_pod_container_status_restarts_total{namespace!="kube-system"}[5m]) > 1
    for: 5m
    labels:
      alertname: "pod发生重启告警"
      severity: "critical"
    annotations:
      description: "{{$labels.pod}}发生{{ $value| printf `%.f` }}次重启!"

  - alert: "Deployment副本数异常告警"
    expr: kube_deployment_spec_replicas != kube_deployment_status_replicas_available
    for: 5m
    labels:
      severity: "critical"
    annotations:
      description: "deployment:{{ $labels.deployment }}副本数小于预期"

  - alert: "node资源异常告警"
    expr: kube_node_status_condition{condition=~"DiskPressure|FrequentContainerdRestart|FrequentDockerRestart|FrequentKubeletRestart|KUBELETProblem|KUBEPROXYProblem|MemoryPressure|PIDPressure|NTPProblem",status="true"} == 1
    for: 5m
    labels:
      alertname: "node资源异常告警"
      severity: "critical"
    annotations:
      description: "Deployment:{{$labels.name}}-{{$labels.node}}发生{{$labels.condition}}"


  - alert: "pod占用磁盘空间过高"
    expr: sum by(pod_name, namespace,pod,node_ip,project,app,env,dept) (container_fs_usage_bytes{image!=""}) / 1024 / 1024 / 1024 > 200
    labels:
      severity: "warning"
    annotations:
      description: "{{$labels.pod}}占用磁盘空间量为:{{ $value| printf `%.f` }} G"

  - alert: "pod内存使用率告警"
    expr: sum by(pod_name, namespace,project,pod,env,dept) (container_memory_rss{image!=""}) / sum by(pod_name, namespace,project,pod,env,dept) (container_spec_memory_limit_bytes{image!=""}) * 100 != +Inf > 96
    for: 5m
    labels:
      alertname: "pod 内存使用率告警"
      severity: "warning"
    annotations:
      description: "{{$labels.pod}} 内存使用率为:{{ $value| printf `%.2f` }} %"
      summary: "内存使用率告警超过 96 %"

  - alert: "pod CPU使用率告警"
    expr: sum by(pod_name, namespace,project,env,pod,dept) (rate(container_cpu_usage_seconds_total{image!=""}[5m])) / (sum by(pod_name, namespace,project,env,pod,dept) (container_spec_cpu_quota{image!=""} / 100000)) * 100 > 90
    for: 5m
    labels:
      severity: "critical"
    annotations:
      summary: "{{$labels.pod}} CPU使用率为:{{ $value| printf `%.2f` }} %"
      description: "CPU使用率超过80%"

  - alert: "pod 出网带宽大于100MB"
    expr: round(sum by (namespace,job,name,project,env,dept) (irate(container_network_transmit_bytes_total{image!=""}[5m]))  / 1024 /1024*1000)/1000 > 100
    for: 5m
    labels:
      severity: "warning"
    annotations:
      summary: "{{$labels.pod}}出网带宽为:{{ $value| printf `%.2f` }} MB"

  - alert: "pod 入网带宽大于10MB"
    expr: round(sum by (namespace,job,name,project,env,dept) (irate(container_network_receive_bytes_total{image!=""}[5m]))  / 1024 /1024*1000)/1000 > 100
    for: 3m
    labels:
      severity: "warning"
    annotations:
      summary: "{{$labels.pod}}入网带宽为: {{ $value| printf `%.2f` }} MB"

  - alert: "node节点分配的pod过多告警"
    expr: kubelet_running_pod_count > 30
    for: 10m
    labels:
      severity: critical
    annotations:
      description: "node节点:{{$labels.instance}}运行pod数量为:{{$value}}"
      summary: "node节点分配的pod过多"
      unit: number
      values: '{{ $value }}'
```

# Ingress
```yaml
groups:
- name: ingress告警 # host_alert
  rules:
  - alert: "ingress状态码499告警"
    expr: increase(nginx_ingress_controller_requests{status="499"}[5m]) > 100
    labels:
      severity: warning
    annotations:
      description: "命名空间:{{$labels.namespace}},{{$labels.service}}平均1分钟内出现499数量:{{ $value| printf `%.2f`}}"
      summary: "K8S service 499告警"
```

# Kafka
```yaml
groups:
- name: "kafka监控告警"
  rules:
  - alert: "kafka消费异常告警"
    expr: sum by(consumergroup, topic, env, project, app, instance) (kafka_consumergroup_lag) > 500000
    for: 5m
    labels:
      severity: "critical"
    annotations:
      description: "kafka:{{$labels.app}}消息未消费的数量为:{{ $value| printf `%.f` }}"
      summary: "kafka_consumergroup未消费消息>100000"
```

# JVM
```yaml
groups:
- name: "JVM异常告警"
  rules:

  - alert: "JVM GC数异常告警"
    expr: increase(jvm_gc_collection_seconds_count{gc="PS MarkSweep"}[5m]) > 25
    for: 5m
    labels:
      severity: warning
    annotations:
      description: "{{$labels.application_name}}-{{$labels.gc}}:5分钟GC数量为:{{ $value| printf `%.2f`}}"
      summary: "GC数异常告警"

  - alert: "JVM heap使用率告警"
    expr: (sum by(project,application_name,instance_name,env,job)(jvm_memory_bytes_used{area="heap"})*100) / sum by(project,application_name,instance_name,env,job)(jvm_memory_bytes_max{area="heap"}) > 95
    for: 5m
    labels:
      severity: warning
    annotations:
      description: "{{$labels.application_name}}-{{$labels.area}}使用率为:{{ $value| printf `%.2f`}}%"
      summary: "heap使用率大于95%"

  - alert: "JVM pool使用率告警(不包含Compressed Class Space和Metaspace)"
    expr: (sum by(project,application_name,instance_name,env,job)(jvm_memory_bytes_used{pool!~"Compressed Class Space｜Metaspace")*100) / sum by(project,application_name,instance_name,env,job)(jvm_memory_bytes_max{pool!~"Compressed Class Space｜Metaspace"}) > 125
    for: 5m
    labels:
      severity: warning
    annotations:
      description: "{{$labels.application_name}}-{{$labels.area}}使用率为:{{ $value| printf `%.2f`}}%"
      summary: "pool—5分钟平均使用率大于95%"

  - alert: "JVM当前线程数"
    expr: jvm_threads_current > 250
    for: 5m
    labels:
      severity: warning
    annotations:
      description: "{{$labels.application_name}}-{{$labels.instance_name}}线程数为:{{ $value| printf `%.2f`}}"
      summary: "JVM当前线程数过高"

  - alert: "jvm_threads_deadlocked异常"
    expr: jvm_threads_deadlocked != 0
    labels:
      severity: warning
    annotations:
      description: "{{$labels.application_name}}-{{$labels.instance_name}}最近监控值为:{{ $value| printf `%.2f`}}"
      summary: "jvm_threads_deadlocked值不为0"
```

---
title: 常用Metrics汇总
tags: [Prometheus, 监控]
categories: [监控]
date: 2022-07-09 23:23:45
comments: false
---

# Node Exporter
* 主机名: `node_uname_info{instance=~'$node'}`
* 物理CPU核数（CPU Cores）: `count(node_cpu_seconds_total{instance=~'$node', mode='system'}) by (instance)`
* 内存大小（RAM）: `node_memory_MemTotal_bytes{instance=~'$node'}`
* SWAP大小: `node_memory_SwapTotal_bytes{instance=~'$node'}`
* 文件系统大小: `node_filesystem_size_bytes{instance=~'$node', device="", fstype=~"ext.*|xfs",mountpoint!~".*pod.*"}`
* 系统负载: `node_load1{instance=~'$node'}`, `node_load5{instance=~'$node'}`, `node_load15{instance=~'$node'}`
* 系统启动时间(timestamp): `node_boot_time_seconds{instance=~'$node'}`
* 系统运行秒数(即uptime): `time() - node_boot_time_seconds{instance=~'$node'}`
* CPU使用率: `(1 - avg(rate(node_cpu_seconds_total{mode="idle"}[$interval])) by (instance)) * 100`
* CPU system使用率: `avg(rate(node_cpu_seconds_total{instance=~"$node",mode="system"}[$interval])) by (instance) *100`
* CPU user: `avg(rate(node_cpu_seconds_total{instance=~"$node",mode="user"}[$interval])) by (instance) *100`
* CPU iowait使用率: `avg(rate(node_cpu_seconds_total{instance=~"$node",mode="iowait"}[$interval])) by (instance) *100`
* 内存使用率: `(1 - (node_memory_MemAvailable_bytes / (node_memory_MemTotal_bytes)))* 100`
* 总分区使用率: `max((node_filesystem_size_bytes{fstype=~"ext.?|xfs"}-node_filesystem_free_bytes{fstype=~"ext.?|xfs"}) *100/(node_filesystem_avail_bytes {fstype=~"ext.?|xfs"}+(node_filesystem_size_bytes{fstype=~"ext.?|xfs"}-node_filesystem_free_bytes{fstype=~"ext.?|xfs"})))by(instance)`
* 各分区使用率`(node_filesystem_size_bytes{instance=~'$node',fstype=~"ext.*|xfs",mountpoint !~".*pod.*"}-node_filesystem_free_bytes{instance=~'$node',fstype=~"ext.*|xfs",mountpoint !~".*pod.*"}) *100/(node_filesystem_avail_bytes {instance=~'$node',fstype=~"ext.*|xfs",mountpoint !~".*pod.*"}+(node_filesystem_size_bytes{instance=~'$node',fstype=~"ext.*|xfs",mountpoint !~".*pod.*"}-node_filesystem_free_bytes{instance=~'$node',fstype=~"ext.*|xfs",mountpoint !~".*pod.*"}))`
* 分区可用大小: `node_filesystem_avail_bytes{instance=~'$node',fstype=~"ext.*|xfs",mountpoint !~".*pod.*"}-0`
* 磁盘最大读取速率: `max(rate(node_disk_read_bytes_total{instance=~"$node"}[$interval])) by (instance)`
* 磁盘最大写入速率: `max(rate(node_disk_written_bytes_total{instance=~"$node"}[$interval])) by (instance)`
* 磁盘读取速率: `rate(node_disk_read_bytes_total{instance=~"$node"}[$interval])`
* 磁盘读取速率: `rate(node_disk_written_bytes_total{instance=~"$node"}[$interval])`
* INode使用率: `node_filesystem_files_free{instance=~'$node',fstype=~"ext.?|xfs"} / node_filesystem_files{instance=~'$node',fstype=~"ext.?|xfs"}`
* 磁盘读取速率: `rate(node_disk_read_time_seconds_total{instance=~"$node"}[$interval]) / rate(node_disk_reads_completed_total{instance=~"$node"}[$interval])`
* 磁盘写入速率: `rate(node_disk_write_time_seconds_total{instance=~"$node"}[$interval]) / rate(node_disk_writes_completed_total{instance=~"$node"}[$interval])`
* 磁盘IO速率: `rate(node_disk_io_time_seconds_total{instance=~"$node"}[$interval])`
* 打开文件描述符数: `node_filefd_allocated{instance=~"$node"}`
* CPU 的 context switch 平均次数: `rate(node_context_switches_total{instance=~"$node"}[$interval])`
* 打开文件描述符使用率: `(node_filefd_allocated{instance=~"$node"}/node_filefd_maximum{instance=~"$node"}) *100`
* 网络TCP连接数: `node_netstat_Tcp_CurrEstab{instance=~'$node'}`
* 网络TCP time wait: `node_sockstat_TCP_tw{instance=~'$node'}`
* 已使用的所有协议套接字总量: `node_sockstat_sockets_used{instance=~'$node'}`
* 正在使用的 UDP 套接字数量: `node_sockstat_UDP_inuse{instance=~'$node'}`
* 已分配的TCP套接字数量: `node_sockstat_TCP_alloc{instance=~'$node'}`
* 已从 LISTEN 状态直接转换到 SYN-RCVD 状态的 TCP 平均连接数: `rate(node_netstat_Tcp_PassiveOpens{instance=~'$node'}[$interval])`
* 网络下载带宽: `max(rate(node_network_receive_bytes_total[$interval])*8) by (instance)`
* 网络上传带宽: `max(rate(node_network_transmit_bytes_total[$interval])*8) by (instance)`
* 网络设备receive速率: `rate(node_network_receive_bytes_total{instance=~'$node',device=~"$device"}[$interval])*8`
* 网络设备transmit速率: `rate(node_network_transmit_bytes_total{instance=~'$node',device=~"$device"}[$interval])*8`
* 网络设备每小时receive量: `increase(node_network_receive_bytes_total{instance=~"$node",device=~"$device"}[60m])`
* 网络设备每小时transmit量: `increase(node_network_transmit_bytes_total{instance=~"$node",device=~"$device"}[60m])`

# Kube State Metrics
* configmap
    * kube_configmap_annotations
    * kube_configmap_created: configmap创建时间戳
    * kube_configmap_info
    * kube_configmap_labels
    * kube_configmap_metadata_resource_version
* daemonset
    * kube_daemonset_annotations
    * kube_daemonset_created
    * kube_daemonset_labels
    * kube_daemonset_metadata_generation
    * kube_daemonset_status_current_number_scheduled: 当前运行daemonset的节点数
    * kube_daemonset_status_desired_number_scheduled: 应该运行daemonset的节点数
    * kube_daemonset_status_number_available: 可运行daemonset的节点数
    * kube_daemonset_status_number_misscheduled: 不应该运行daemonset（实际上有运行）的节点数
    * kube_daemonset_status_number_ready: 应该运行daemonset并已运行一个或多个daemonset并准备就绪的节点数
    * kube_daemonset_status_number_unavailable: 应该运行daemonset且没有任何daemonset正在运行并且可用的节点数
    * kube_daemonset_status_observed_generation
    * kube_daemonset_status_updated_number_scheduled: daemonset正在进行更新操作的节点数
* deployment
    * kube_deployment_annotations
    * kube_deployment_created
    * kube_deployment_labels
    * kube_deployment_metadata_generation
    * kube_deployment_spec_paused: deployment是否为Paused状态
    * kube_deployment_spec_replicas: deployment的副本数
    * kube_deployment_spec_strategy_rollingupdate_max_surge: 滚动更新deployment期间可调度的超过所需副本数量的最大副本数
    * kube_deployment_spec_strategy_rollingupdate_max_unavailable: 滚动更新deployment期间的最大不可用副本数
    * kube_deployment_status_condition: deployment的当前状态(Available, Progressing)
    * kube_deployment_status_observed_generation
    * kube_deployment_status_replicas: deployment的副本数
    * kube_deployment_status_replicas_available: deployment的可用副本数
    * kube_deployment_status_replicas_ready: deployment的就绪副本数
    * kube_deployment_status_replicas_unavailable: deployment的不可用副本数
    * kube_deployment_status_replicas_updated: deployment的已更新的副本数
* endpoint
    * kube_endpoint_address: endpoint address列表
    * kube_endpoint_address_available: endpoint中可用的address
    * kube_endpoint_address_not_ready: endpoint中不可用的address
    * kube_endpoint_annotations
    * kube_endpoint_created
    * kube_endpoint_info
    * kube_endpoint_labels
    * kube_endpoint_ports: endpoint port列表(port_number)
* namespace
    * kube_namespace_annotations
    * kube_namespace_created
    * kube_namespace_labels
    * kube_namespace_status_phase
* node
    * kube_node_annotations
    * kube_node_created
    * kube_node_info
    * kube_node_labels
    * kube_node_role
    * kube_node_spec_unschedulable: 节点是否不可调度
    * kube_node_status_allocatable: 节点(可调度的)的可分配资源
    * kube_node_status_capacity: 节点资源容量
    * kube_node_status_condition
* pv and pvc
    * kube_persistentvolume_annotations
    * kube_persistentvolume_capacity_bytes
    * kube_persistentvolume_claim_ref
    * kube_persistentvolume_created
    * kube_persistentvolume_info
    * kube_persistentvolume_labels
    * kube_persistentvolume_status_phase
    * kube_persistentvolumeclaim_access_mode
    * kube_persistentvolumeclaim_annotations
    * kube_persistentvolumeclaim_created
    * kube_persistentvolumeclaim_info
    * kube_persistentvolumeclaim_labels
    * kube_persistentvolumeclaim_resource_requests_storage_bytes
    * kube_persistentvolumeclaim_status_phase
* pod
    * kube_pod_annotations
    * kube_pod_created
    * kube_pod_info
    * kube_pod_ips
    * kube_pod_labels
    * kube_pod_owner
    * kube_pod_restart_policy
    * kube_pod_spec_volumes_persistentvolumeclaims_info
    * kube_pod_spec_volumes_persistentvolumeclaims_readonly
    * kube_pod_start_time
    * kube_pod_status_container_ready_time
    * kube_pod_status_phase
    * kube_pod_status_qos_class
    * kube_pod_status_ready
    * kube_pod_status_ready_time
    * kube_pod_status_reason
    * kube_pod_status_scheduled
    * kube_pod_status_scheduled_time
    * kube_pod_tolerations
* pod container
    * kube_pod_container_info
    * kube_pod_container_resource_limits: pod容器的资源limits
    * kube_pod_container_resource_requests: pod容器的资源requests
    * kube_pod_container_state_started
    * kube_pod_container_status_last_terminated_exitcode
    * kube_pod_container_status_last_terminated_reason
    * kube_pod_container_status_ready
    * kube_pod_container_status_restarts_total
    * kube_pod_container_status_running
    * kube_pod_container_status_terminated
    * kube_pod_container_status_waiting
* service
    * kube_service_annotations
    * kube_service_created
    * kube_service_info
    * kube_service_labels
    * kube_service_spec_type
* storageclass
    * kube_storageclass_annotations
    * kube_storageclass_created
    * kube_storageclass_info
    * kube_storageclass_labels


# Kubernetes Apiserver

# Kubernetes Kubelet

# Metrics Server

# CAdvisor

# CoreDNS

# ETCD

# Blackbox Exporter


# 参考文章
* [prometheus node-exporter 全部指标](http://codefun007.xyz/a/article_detail/985.htm)
* [Prometheus kube-state-metrics 监控指标介绍](https://www.fdevops.com/2022/02/14/prometheus-kube-state-metrics)
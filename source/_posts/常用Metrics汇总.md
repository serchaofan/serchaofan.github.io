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
* 准入控制器时延[admit]: `histogram_quantile($quantile, sum by(operation, name, le, type, rejected) (irate(apiserver_admission_controller_admission_duration_seconds_bucket{type="admit"}[$interval])))`
* 准入控制器时延[validate]: `histogram_quantile($quantile, sum by(operation, name, le, type, rejected) (irate(apiserver_admission_controller_admission_duration_seconds_bucket{type="validate"}[$interval])) )`
* 准入Webhook时延[admit]: `histogram_quantile($quantile, sum by(operation, name, le, type, rejected) (irate(apiserver_admission_webhook_admission_duration_seconds_bucket{type="admit"}[$interval])) )`
* 准入Webhook时延[validating]: `histogram_quantile($quantile, sum by(operation, name, le, type, rejected) (irate(apiserver_admission_webhook_admission_duration_seconds_bucket{type="validating"}[$interval])) )`
* 准入Webhook请求QPS: `sum(irate(apiserver_admission_webhook_admission_duration_seconds_count[$interval]))by(name,operation,type,rejected)`
* apiserver_admission_controller_admission_duration_seconds_count{}
* apiserver_admission_controller_admission_duration_seconds_sum{}
* apiserver_admission_step_admission_duration_seconds_bucket{}
* apiserver_admission_step_admission_duration_seconds_count{}
* apiserver_admission_step_admission_duration_seconds_sum{}
* apiserver_admission_step_admission_duration_seconds_summary{}
* apiserver_admission_step_admission_duration_seconds_summary_count{}
* apiserver_admission_step_admission_duration_seconds_summary_sum{}
* apiserver_audit_event_total{}
* apiserver_audit_requests_rejected_total{}
* apiserver_cache_list_fetched_objects_total{}
* apiserver_cache_list_returned_objects_total{}
* apiserver_cache_list_total{}
* apiserver_cel_compilation_duration_seconds_bucket{}
* apiserver_cel_compilation_duration_seconds_count{}
* apiserver_cel_compilation_duration_seconds_sum{}
* apiserver_cel_evaluation_duration_seconds_bucket{}
* apiserver_cel_evaluation_duration_seconds_count{}
* apiserver_cel_evaluation_duration_seconds_sum{}
* apiserver_client_certificate_expiration_seconds_bucket{}
* apiserver_client_certificate_expiration_seconds_count{}
* apiserver_client_certificate_expiration_seconds_sum{}
* APIServer当前在处理读请求数量: `sum(apiserver_current_inflight_requests{requestKind="readOnly"})`
* APIServer当前在处理写请求数量: `sum(apiserver_current_inflight_requests{requestKind="mutating"})`
* apiserver_current_inqueue_requests{}
* apiserver_delegated_authz_request_duration_seconds_bucket{}
* apiserver_delegated_authz_request_duration_seconds_count{}
* apiserver_delegated_authz_request_duration_seconds_sum{}
* apiserver_delegated_authz_request_total{}
* apiserver_envelope_encryption_dek_cache_fill_percent{}
* apiserver_flowcontrol_current_executing_requests{}
* apiserver_flowcontrol_current_inqueue_requests{}
* apiserver_flowcontrol_current_r{}
* apiserver_flowcontrol_dispatch_r{}
* apiserver_flowcontrol_dispatched_requests_total{}
* apiserver_flowcontrol_latest_s{}
* apiserver_flowcontrol_next_discounted_s_bounds{}
* apiserver_flowcontrol_next_s_bounds{}
* apiserver_flowcontrol_priority_level_request_utilization_bucket{}
* apiserver_flowcontrol_priority_level_request_utilization_count{}
* apiserver_flowcontrol_priority_level_request_utilization_sum{}
* apiserver_flowcontrol_priority_level_seat_utilization_bucket{}
* apiserver_flowcontrol_priority_level_seat_utilization_count{}
* apiserver_flowcontrol_priority_level_seat_utilization_sum{}
* apiserver_flowcontrol_read_vs_write_current_requests_bucket{}
* apiserver_flowcontrol_read_vs_write_current_requests_count{}
* apiserver_flowcontrol_read_vs_write_current_requests_sum{}
* apiserver_flowcontrol_request_concurrency_in_use{}
* apiserver_flowcontrol_request_concurrency_limit{}
* apiserver_flowcontrol_request_execution_seconds_bucket{}
* apiserver_flowcontrol_request_execution_seconds_count{}
* apiserver_flowcontrol_request_execution_seconds_sum{}
* apiserver_flowcontrol_request_queue_length_after_enqueue_bucket{}
* apiserver_flowcontrol_request_queue_length_after_enqueue_count{}
* apiserver_flowcontrol_request_queue_length_after_enqueue_sum{}
* apiserver_flowcontrol_request_wait_duration_seconds_bucket{}
* apiserver_flowcontrol_request_wait_duration_seconds_count{}
* apiserver_flowcontrol_request_wait_duration_seconds_sum{}
* apiserver_flowcontrol_watch_count_samples_bucket{}
* apiserver_flowcontrol_watch_count_samples_count{}
* apiserver_flowcontrol_watch_count_samples_sum{}
* apiserver_flowcontrol_work_estimated_seats_bucket{}
* apiserver_flowcontrol_work_estimated_seats_count{}
* apiserver_flowcontrol_work_estimated_seats_sum{}
* apiserver_init_events_total{}
* apiserver_kube_aggregator_x509_insecure_sha1_total{}
* apiserver_kube_aggregator_x509_missing_san_total{}
* apiserver_longrunning_requests{}
* apiserver_request_aborts_total{}
* GET读请求时延: `histogram_quantile($quantile, sum(irate(apiserver_request_duration_seconds_bucket{verb="GET",resource!="",subresource!~"log|proxy"}[$interval])) by (pod, verb, resource, subresource, scope, le))`
* LIST读请求时延: `histogram_quantile($quantile, sum(irate(apiserver_request_duration_seconds_bucket{verb="LIST"}[$interval])) by (pod_name, verb, resource, scope, le))`
* 写请求时延: `histogram_quantile($quantile, sum(irate(apiserver_request_duration_seconds_bucket{verb!~"GET|WATCH|LIST|CONNECT"}[$interval])) by (cluster, pod_name, verb, resource, scope, le))`
* 95%的操作时延(除CONNECT和WATCH)区间: `histogram_quantile(0.95, sum(rate(apiserver_request_duration_seconds_bucket{verb!~"CONNECT|WATCH"}[5m])) by (le))`
    * 90%的操作时延(除CONNECT和WATCH)区间: `histogram_quantile(0.90, sum(rate(apiserver_request_duration_seconds_bucket{verb!~"CONNECT|WATCH"}[5m])) by (le))`
* apiserver_request_duration_seconds_count{}
* apiserver_request_duration_seconds_sum{}
* apiserver_request_filter_duration_seconds_bucket{}
* apiserver_request_filter_duration_seconds_count{}
* apiserver_request_filter_duration_seconds_sum{}
* apiserver_request_post_timeout_total{}
* apiserver_request_slo_duration_seconds_bucket{}
* apiserver_request_slo_duration_seconds_count{}
* apiserver_request_slo_duration_seconds_sum{}
* apiserver_request_terminations_total{}
* apiserver_request_timestamp_comparison_time_bucket{}
* apiserver_request_timestamp_comparison_time_count{}
* apiserver_request_timestamp_comparison_time_sum{}
* APIServer总QPS: `sum(irate(apiserver_request_total[$interval]))`
* 按Client维度分析QPS。用于分析对APIServer访问的客户端以及QPS: `sum(irate(apiserver_request_total{client!=""}[$interval])) by (client)`
* APIServer读请求成功率: `sum(irate(apiserver_request_total{code=~"20.*",verb=~"GET|LIST"}[$interval]))/sum(irate(apiserver_request_total{verb=~"GET|LIST"}[$interval]))`
* APIServer写请求成功率: `sum(irate(apiserver_request_total{code=~"20.*",verb!~"GET|LIST|WATCH|CONNECT"}[$interval]))/sum(irate(apiserver_request_total{verb!~"GET|LIST|WATCH|CONNECT"}[$interval]))`
* 按Verb维度，统计单位时间（1s）内的请求QPS: `sum(irate(apiserver_request_total{verb=~"$verb"}[$interval]))by(verb)`
* 按Verb+Resource维度，统计单位时间（1s）内的请求QPS: `sum(irate(apiserver_request_total{verb=~"$verb",resource=~"$resource"}[$interval]))by(verb,resource)`
* 按Verb+Resource+Client维度分析QPS: `sum(irate(apiserver_request_total{client!="",verb=~"$verb", resource=~"$resource"}[$interval]))by(verb,resource,client)`
* 按Verb+Resource+Client维度分析LIST请求QPS（无resourceVersion字段）: `sum(irate(apiserver_request_no_resourceversion_list_total[$interval]))by(resource,client)`
* 按Verb维度，分析请求时延: `histogram_quantile($quantile, sum(irate(apiserver_request_duration_seconds_bucket{verb=~"$verb", verb!~"WATCH|CONNECT",resource!=""}[$interval])) by (le,verb))`
* 按Verb+Resource维度，分析请求时延: `histogram_quantile($quantile, sum(irate(apiserver_request_duration_seconds_bucket{verb=~"$verb", verb!~"WATCH|CONNECT", resource=~"$resource",resource!=""}[$interval])) by (le,verb,resource))`
* 统计非2xx返回值的读请求QPS: `sum(irate(apiserver_request_total{verb=~"GET|LIST",resource=~"$resource",code!~"2.*"}[$interval])) by (verb,resource,code)`
* 统计非2xx返回值的写请求QPS: `sum(irate(apiserver_request_total{verb!~"GET|LIST|WATCH",verb=~"$verb",resource=~"$resource",code!~"2.*"}[$interval])) by (verb,resource,code)`
* apiserver_requested_deprecated_apis{}
* apiserver_response_sizes_bucket{}
* apiserver_response_sizes_count{}
* apiserver_response_sizes_sum{}
* apiserver_selfrequest_total{}
* apiserver_storage_data_key_generation_duration_seconds_bucket{}
* apiserver_storage_data_key_generation_duration_seconds_count{}
* apiserver_storage_data_key_generation_duration_seconds_sum{}
* apiserver_storage_data_key_generation_failures_total{}
* apiserver_storage_envelope_transformation_cache_misses_total{}
* apiserver_storage_list_evaluated_objects_total{}
* apiserver_storage_list_fetched_objects_total{}
* apiserver_storage_list_returned_objects_total{}
* apiserver_storage_list_total{}
* apiserver_storage_objects{}
* apiserver_tls_handshake_errors_total{}
* apiserver_watch_cache_events_dispatched_total{}
* apiserver_watch_cache_initializations_total{}
* apiserver_watch_events_sizes_bucket{}
* apiserver_watch_events_sizes_count{}
* apiserver_watch_events_sizes_sum{}
* apiserver_watch_events_total{}
* apiserver_webhooks_x509_insecure_sha1_total{}
* apiserver_webhooks_x509_missing_san_total{}
* 客户端访问 APIServer 出错率: `(sum(rate(rest_client_requests_total{code=~"5.."}[5m])) by (cluster,instance, job)  /sum(rate(rest_client_requests_total[5m])) by (cluster,instance, job))`
* 95%的workqueue排队时间的区间: `histogram_quantile(0.95, sum(rate(workqueue_queue_duration_seconds_bucket[5m])) by (le))`
    * 90%的workqueue排队时间的区间: `histogram_quantile(0.90, sum(rate(workqueue_queue_duration_seconds_bucket[5m])) by (le))`
* 95%的workqueue操作时间的区间: `histogram_quantile(0.95, sum(rate(workqueue_work_duration_seconds_bucket[5m])) by (le))`
    * 90%的workqueue操作时间的区间: `histogram_quantile(0.90, sum(rate(workqueue_work_duration_seconds_bucket[5m])) by (le))`
# Kubernetes Kubelet
* kubelet_certificate_manager_client_expiration_renew_errors
* kubelet_certificate_manager_client_ttl_seconds
* kubelet_cgroup_manager_duration_seconds_bucket
* kubelet_cgroup_manager_duration_seconds_count
* kubelet_cgroup_manager_duration_seconds_sum
* kubelet_container_log_filesystem_used_bytes
* kubelet_containers_per_pod_count_bucket
* kubelet_containers_per_pod_count_count
* kubelet_containers_per_pod_count_sum
* kubelet_graceful_shutdown_end_time_seconds
* kubelet_graceful_shutdown_start_time_seconds
* kubelet_http_inflight_requests
* kubelet_http_requests_duration_seconds_bucket
* kubelet_http_requests_duration_seconds_count
* kubelet_http_requests_duration_seconds_sum
* kubelet_http_requests_total
* kubelet_managed_ephemeral_containers
* kubelet_node_name
* kubelet_pleg_discard_events
* kubelet_pleg_last_seen_seconds
* kubelet_pleg_relist_duration_seconds_bucket
* kubelet_pleg_relist_duration_seconds_count
* kubelet_pleg_relist_duration_seconds_sum
* kubelet_pleg_relist_interval_seconds_bucket
* kubelet_pleg_relist_interval_seconds_count
* kubelet_pleg_relist_interval_seconds_sum
* kubelet_pod_start_duration_seconds_bucket
* pod启动速率: `sum(rate(kubelet_pod_start_duration_seconds_count{job="kubelet",instance=~"$instance"}[5m])) by (instance)`
* 99%的pod启动时延区间: `histogram_quantile(0.99, sum(rate(kubelet_pod_start_duration_seconds_count{job="kubelet",instance=~"$instance"}[5m])) by (instance, le))`
* kubelet_pod_start_duration_seconds_sum
* kubelet_pod_worker_duration_seconds_bucket
* pod工作速率: `sum(rate(kubelet_pod_worker_duration_seconds_count{job="kubelet",instance=~"$instance"}[5m])) by (instance)`
* 99%的pod工作时延区间: `histogram_quantile(0.99, sum(rate(kubelet_pod_worker_duration_seconds_bucket{job="kubelet",instance=~"$instance"}[5m])) by (instance, le))`
* kubelet_pod_worker_duration_seconds_sum
* kubelet_pod_worker_start_duration_seconds_bucket
* kubelet_pod_worker_start_duration_seconds_count
* kubelet_pod_worker_start_duration_seconds_sum
* kubelet_run_podsandbox_duration_seconds_bucket
* kubelet_run_podsandbox_duration_seconds_count
* kubelet_run_podsandbox_duration_seconds_sum
* 节点上运行容器数量: `sum(kubelet_running_containers{job="kubelet", instance=~"$instance"})`
* 节点上运行pod数量: `sum(kubelet_running_pods{job="kubelet", instance=~"$instance"})`
* 99%的运行时操作时延区间: `histogram_quantile(0.99, sum(rate(kubelet_runtime_operations_duration_seconds_bucket{job="kubelet",instance=~"$instance"}[5m])) by (instance, operation_type, le))`
* kubelet_runtime_operations_duration_seconds_count
* kubelet_runtime_operations_duration_seconds_sum
* 运行时操作错误率`sum(rate(kubelet_runtime_operations_errors_total{job="kubelet",instance=~"$instance"}[5m])) by (instance, operation_type)`
* 运行时操作速率: `sum(rate(kubelet_runtime_operations_total{job="kubelet",instance=~"$instance"}[5m])) by (operation_type, instance)`
* kubelet_started_containers_total
* kubelet_started_pods_errors_total
* kubelet_started_pods_total
* kubelet_volume_metric_collection_duration_seconds_bucket
* kubelet_volume_metric_collection_duration_seconds_count
* kubelet_volume_metric_collection_duration_seconds_sum


# CAdvisor
* 容器CPU使用率: `sum(irate(container_cpu_usage_seconds_total{pod=~"$Pod",namespace=~"$NameSpace"}[2m])) by (pod,namespace) / (sum(container_spec_cpu_quota{pod=~"$Pod",namespace=~"$NameSpace"}/100000) by (pod,namespace)) * 100`
* 容器CPU使用核数: `sum(irate(container_cpu_usage_seconds_total{pod=~"$Pod",namespace=~"$NameSpace"}[2m])) by (pod,namespace)`
* 容器当前工作内存使用率WSS%: `sum (container_memory_working_set_bytes{pod=~"$Pod",container =~"$Container",container !="",container!="POD",namespace=~"$NameSpace"}) by (container, pod, namespace)/ sum(container_spec_memory_limit_bytes{pod=~"$Pod",container =~"$Container",container !="",container!="POD",namespace=~"$NameSpace"}) by (container, pod, namespace) * 100`
* 容器当前工作内存使用大小WSS: `sum (container_memory_working_set_bytes{pod=~"$Pod",container =~"$Container",container !="",container!="POD",namespace=~"$NameSpace"}) by (container, pod, namespace)`
* 容器RSS%: `sum (container_memory_rss{pod=~"$Pod",container =~"$Container",container !="",container!="POD",namespace=~"$NameSpace"}) by (container, pod,namespace)/ sum(container_spec_memory_limit_bytes{pod=~"$Pod",container =~"$Container",container !="",container!="POD",namespace=~"$NameSpace"}) by (container, pod,namespace) * 100`
* 容器RSS: `sum (container_memory_rss{pod=~"$Pod",container =~"$Container",container !="",container!="POD",namespace=~"$NameSpace"}) by (container, pod,namespace)`
* 容器内文件系统已用大小(bytes): `sum(container_fs_usage_bytes{pod=~"$Pod",container =~"$Container",container !="",container!="POD",namespace=~"$NameSpace"}) by (container,pod,namespace)`
* pod网络流入速率: `sum(sum(irate(container_network_receive_bytes_total{pod=~"$Pod",image!="",name=~"^k8s_.*",namespace=~"$NameSpace",pod=~".*$Container.*"}[2m])) by (pod)* on(pod) group_right kube_pod_container_info) by(pod) *8`
* pod网络流出速率`sum(sum(irate(container_network_transmit_bytes_total{pod=~"$Pod",image!="",name=~"^k8s_.*",namespace=~"$NameSpace",pod=~".*$Container.*"}[2m])) by (pod)* on(pod) group_right kube_pod_container_info) by(pod) *8`

# CoreDNS

# ETCD
* 95%的etcd请求时延区间: `histogram_quantile(0.95, sum(rate(etcd_request_duration_seconds_bucket[5m])) by (le))`

# Blackbox Exporter


# 参考文章
* [prometheus node-exporter 全部指标](http://codefun007.xyz/a/article_detail/985.htm)
* [Prometheus kube-state-metrics 监控指标介绍](https://www.fdevops.com/2022/02/14/prometheus-kube-state-metrics)
* [控制平面组件监控](https://help.aliyun.com/document_detail/441320.html)
---
title: Linux性能监控与优化
date: 2018-08-01 20:57:03
tags: [Linux, 运维, 性能, SRE]
categories: [系统运维]
comments: false
---

Linux 性能问题很少是“某个工具不会用”，而是**不知道看什么、看了不会解释、解释了不敢改**。真正的工作方法是：先定义业务目标和基线，再按 CPU、内存、存储、网络、内核、容器逐层定位，最后用可回滚的变更验证收益。

本文以资深 Linux 运维 + SRE 视角重写，覆盖 USE/RED、`/proc`、PSI、cgroups v2、perf/eBPF、CPU/内存/IO/网络、容器与 Kubernetes、SRE 实践、调优参数、故障决策树和基准测试。

> 性能优化的第一原则：**先测量，再假设，最后验证**。没有基线的调优，往往只是把问题挪到别处。

<!-- more -->

- [性能工程方法论](#%E6%80%A7%E8%83%BD%E5%B7%A5%E7%A8%8B%E6%96%B9%E6%B3%95%E8%AE%BA)
- [Linux 性能观测基础](#linux-%E6%80%A7%E8%83%BD%E8%A7%82%E6%B5%8B%E5%9F%BA%E7%A1%80)
- [CPU](#cpu)
- [内存](#%E5%86%85%E5%AD%98)
- [存储与文件系统](#%E5%AD%98%E5%82%A8%E4%B8%8E%E6%96%87%E4%BB%B6%E7%B3%BB%E7%BB%9F)
- [网络](#%E7%BD%91%E7%BB%9C)
- [中断软中断与内核](#%E4%B8%AD%E6%96%AD%E8%BD%AF%E4%B8%AD%E6%96%AD%E4%B8%8E%E5%86%85%E6%A0%B8)
- [容器与 Kubernetes](#%E5%AE%B9%E5%99%A8%E4%B8%8E-kubernetes)
- [SRE 性能实践](#sre-%E6%80%A7%E8%83%BD%E5%AE%9E%E8%B7%B5)
- [工具速查](#%E5%B7%A5%E5%85%B7%E9%80%9F%E6%9F%A5)
- [调优参数](#%E8%B0%83%E4%BC%98%E5%8F%82%E6%95%B0)
- [故障排查决策树](#%E6%95%85%E9%9A%9C%E6%8E%92%E6%9F%A5%E5%86%B3%E7%AD%96%E6%A0%91)
- [基准测试](#%E5%9F%BA%E5%87%86%E6%B5%8B%E8%AF%95)
- [优化原则与反模式](#%E4%BC%98%E5%8C%96%E5%8E%9F%E5%88%99%E4%B8%8E%E5%8F%8D%E6%A8%A1%E5%BC%8F)
- [生产检查清单](#%E7%94%9F%E4%BA%A7%E6%A3%80%E6%9F%A5%E6%B8%85%E5%8D%95)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# 性能工程方法论

## USE 与 RED

**USE（资源视角）**：

- **Utilization**：资源使用率。
- **Saturation**：资源饱和/排队程度。
- **Errors**：错误。

对每个资源（CPU、内存、磁盘、网络、文件描述符、连接数）都问这三个问题。

**RED（服务视角）**：

- **Rate**：请求速率。
- **Errors**：错误率。
- **Duration**：延迟分布。

USE 找瓶颈，RED 看用户体验。两者结合，避免“CPU 很闲但用户很慢”。

## 症状 vs 原因

- 用户报“慢”是症状；CPU 高、IO 等待、锁竞争是可能原因。
- 不要看到 CPU 高就扩容；先确认 CPU 是否真的是瓶颈。
- 不要看到 `%wa` 高就换盘；先看是否有大量同步写、NFS、fsync、内存回收。
- 不要看到 load 高就加 CPU；load 包含 D 状态（不可中断睡眠），可能是 IO/NFS/内核锁。

## 基线、负载特征与容量

- 建立正常时段的基线：CPU、内存、IOPS、延迟、网络、连接数、错误率。
- 区分工作负载：CPU 密集、IO 密集、内存密集、网络密集、混合。
- 识别峰值/周期性/突发；容量按峰值 + 故障切换 + headroom。
- 用 SLO 定义“够快”：P50/P95/P99、成功率、饱和度。

## 性能分析层次

```text
业务/SLO
  → 应用（代码、锁、GC、连接池）
  → 运行时/容器（cgroup、JVM、Go）
  → 系统调用/内核（syscall、调度、IO、网络）
  → 硬件/虚拟化（CPU、内存、磁盘、网卡、NUMA、steal）
```

从外到内定位，避免一上来就 perf 全局采样。

## 优化闭环

1. 定义问题与目标（SLO/延迟/吞吐/成本）。
2. 建立基线，复现问题。
3. 分层观测，找瓶颈与证据。
4. 提出假设，做单变量变更。
5. 压测/灰度验证收益。
6. 观察副作用（其他资源、稳定性、成本）。
7. 固化配置/代码，补监控与回归测试。

# Linux 性能观测基础

## /proc 与 /sys

- `/proc/stat`：CPU、上下文切换、中断、软中断。
- `/proc/meminfo`：内存、page cache、slab、可用内存。
- `/proc/vmstat`：页面回收、swap、THP、OOM、写回。
- `/proc/diskstats`：块设备 IO。
- `/proc/net/*`：TCP/UDP、snmp、netstat、conntrack。
- `/proc/interrupts`、`/proc/softirqs`：中断/软中断。
- `/proc/pressure/*`：PSI。
- `/sys/fs/cgroup/*`：cgroup v2 资源与统计。
- `/sys/block/*/queue/*`：IO 调度、队列、rotational、nr_requests。
- `/sys/class/net/*/statistics/*`：网卡计数。

## PSI（Pressure Stall Information）

PSI 衡量**资源不足导致任务停顿的时间比例**，比利用率更接近“饱和”：

```bash
cat /proc/pressure/cpu
cat /proc/pressure/memory
cat /proc/pressure/io
```

输出：

```text
some avg10=0.00 avg60=0.00 avg300=0.00 total=0
full avg10=0.00 avg60=0.00 avg300=0.00 total=0
```

- `some`：至少有一个任务因资源停顿。
- `full`：所有可运行任务都停顿（CPU 没有 full）。
- `avg10/60/300`：10s/60s/300s 滑动平均。
- `total`：累计微秒。

PSI 是容器/Kubernetes 场景下非常有用的饱和信号：

- `cpu.pressure` 高：CPU 争抢。
- `memory.pressure` 高：内存回收/直接 reclaim 造成停顿。
- `io.pressure` 高：IO 排队。

cgroup v2 中也有 `cpu.pressure`、`memory.pressure`、`io.pressure`。

## cgroups v2

关键控制器：

| 控制器 | 关键文件 |
| ------ | -------- |
| cpu | `cpu.max`、`cpu.weight`、`cpu.stat` |
| cpuset | `cpuset.cpus`、`cpuset.mems` |
| memory | `memory.max`、`memory.high`、`memory.current`、`memory.stat`、`memory.events` |
| io | `io.max`、`io.weight`、`io.stat` |
| pids | `pids.max`、`pids.current` |

重点指标：

- `cpu.stat`：`nr_periods`、`nr_throttled`、`throttled_usec`。
- `memory.events`：`high`、`max`、`oom`、`oom_kill`。
- `memory.stat`：`anon`、`file`、`slab`、`kernel_stack`、`pagetables`、`sock`。
- `io.stat`：每个设备的 rbytes/wbytes/rios/wios/dbytes/dios。
- `*.pressure`：PSI。

## perf 与 eBPF

- `perf stat`：CPU 周期、指令、cache miss、上下文切换、page fault。
- `perf top`：实时热点。
- `perf record -g` + flamegraph：CPU 火焰图。
- `perf sched`：调度延迟、迁移。
- `perf trace`：系统调用。
- `perf c2c`：cache line 争用。
- `bpftrace`/BCC：内核态追踪，低开销。
- `ftrace`：内核函数/事件追踪。
- `strace`：用户态系统调用；开销大，短时使用。

原则：

- 先看指标，再用 tracing 定位。
- 生产采样要控制时长、频率、开销。
- 火焰图看“宽”的栈，不要只看单个热点。

# CPU

## 关键概念

- **逻辑 CPU**：`lscpu`、`nproc`、`/proc/cpuinfo`。
- **超线程**：同一物理核的两个逻辑 CPU 共享执行单元；CPU 密集任务可能互相拖累。
- **NUMA**：CPU 访问本地内存快，跨 NUMA 慢；关注 `numastat`、`numactl`。
- **CFS/EEVDF**：现代 Linux 调度器；关注 runqueue、调度延迟、CPU throttling。
- **nice/priority**：普通进程 nice 影响权重；RT 进程优先级更高，慎用。
- **CPU governor**：`performance`/`schedutil`/`powersave`；云主机可能不可控。
- **steal**：虚拟化环境被宿主机抢走的时间。

## 关键指标

| 指标 | 说明 |
| ---- | ---- |
| `us` | 用户态 CPU |
| `sy` | 内核态 CPU |
| `ni` | nice 调整过的进程 |
| `id` | 空闲 |
| `wa` | IO 等待（CPU 空闲但有未完成 IO） |
| `hi` | 硬中断 |
| `si` | 软中断 |
| `st` | 被虚拟化偷走 |
| load average | 可运行 + 不可中断任务；不是 CPU 使用率 |
| runqueue | 可运行任务排队 |
| context switches | 上下文切换 |
| CPU throttling | cgroup quota 用尽 |

## 工具

```bash
top -H -p <pid>
htop
mpstat -P ALL 1
pidstat -u -w -t 1
vmstat 1
sar -u 1
perf stat -p <pid> sleep 5
perf top
perf record -F 99 -g -p <pid> -- sleep 30
turbostat
cpupower frequency-info
lscpu
numactl --hardware
```

## 解释

- **load 高但 CPU 低**：可能是 D 状态（IO/NFS/内核锁）、大量线程、内存回收。
- **us 高**：应用计算/锁/GC/循环。
- **sy 高**：系统调用、网络协议栈、文件系统、驱动、容器运行时。
- **si 高**：网络/块设备软中断；看 `/proc/softirqs`、网卡队列、RPS/XPS。
- **wa 高**：同步 IO、fsync、NFS、内存回收；NVMe/异步 IO 下 wa 可能不高。
- **st 高**：宿主机超卖/邻居争抢；云厂商侧问题。
- **CPU throttling**：cgroup `cpu.max` 限制；`cpu.stat` 的 `nr_throttled`/`throttled_usec`。

## 优化

- 减少锁竞争、无谓循环、序列化/反序列化。
- 调整线程/进程模型，避免过多上下文切换。
- 用 CPU affinity/cpuset 绑定关键服务，减少迁移。
- NUMA 绑定：`numactl --cpunodebind --membind`，避免跨 NUMA。
- 合理设置 cgroup `cpu.weight`/`cpu.max`；不要给延迟敏感服务过低 quota。
- 避免过度超线程争抢；CPU 密集服务可关闭 HT 或绑定物理核。
- 升级内核/编译器/运行时；用 perf 找热点。
- 扩容前确认不是 IO/锁/GC 导致的“假 CPU 高”。

# 内存

## 关键概念

- **RSS**：进程实际驻留物理内存。
- **PSS**：按共享页比例分摊，容器/多进程更准确。
- **Anon**：匿名页（堆/栈），不可直接回收。
- **File/page cache**：文件缓存，可回收；`Cached`、`Buffers`。
- **Slab**：内核对象缓存；`SReclaimable` 可回收。
- **Swap**：换出匿名页；延迟高，数据库通常不建议依赖。
- **THP**：透明大页；减少 TLB miss，但可能造成延迟抖动/内存放大。
- **NUMA**：跨节点访问延迟；`numastat`。
- **PSI memory**：内存回收造成的停顿。

## 关键指标

```bash
free -h
cat /proc/meminfo
vmstat 1
sar -r 1
smem -tk
slabtop
numastat
cat /proc/pressure/memory
```

重点：

- `MemAvailable`：更接近“还能给应用多少内存”。
- `Dirty`/`Writeback`：待写回/正在写回。
- `Slab`/`SReclaimable`：内核缓存。
- `AnonPages`：匿名页。
- `SwapCached`、`pgscan`、`pgsteal`、`pgmajfault`。
- `oom_kill`、`memory.events`。

## OOM

- 内核 OOM killer 根据 `oom_score` 选择牺牲进程；`oom_score_adj` 可调。
- cgroup v2 `memory.max` 触发 cgroup OOM；`memory.events` 记录 `oom`/`oom_kill`。
- `dmesg -T | grep -i oom`、`journalctl -k`。
- OOM 不一定是“内存泄漏”：可能是 limit 太小、page cache 太多、突发流量、内存碎片。

## 优化

- 找出真正的内存使用者：`smem -tk`、`ps_mem`、cgroup `memory.stat`。
- 区分 page cache 与 anon；不要看到 `free` 低就加内存。
- 调整 `vm.swappiness`（降低不等于禁用）、`vm.min_free_kbytes`、`vm.dirty_*`。
- 评估 THP：数据库/延迟敏感服务常用 `madvise` 或关闭。
- 限制容器 `memory.max`，设置合理 requests/limits；避免 limit=request 过紧。
- 检查内存泄漏：RSS 持续增长、heap profile、`memleak` eBPF。
- NUMA 绑定，避免跨节点分配。
- 大页（HugePages）用于特定数据库/DPDK；不是通用优化。

# 存储与文件系统

## IO 路径

```text
应用 read/write
  → 页缓存（page cache）
  → 文件系统（ext4/xfs/overlay/NFS）
  → 块层（blk-mq、IO 调度）
  → 设备（NVMe/SSD/HDD/云盘）
```

- 读命中 page cache 不落盘。
- 写先写 page cache，后台 writeback；`fsync` 强制落盘。
- 直接 IO（O_DIRECT）绕过 page cache，数据库常用。
- 异步 IO（io_uring/AIO）提升并发。
- 云盘/网络存储的延迟和抖动与本地 NVMe 差异很大。

## 关键指标

```bash
iostat -x 1
iotop -o
pidstat -d 1
vmstat 1
cat /proc/pressure/io
```

`iostat -x` 重点：

| 字段 | 含义 |
| ---- | ---- |
| `r/s` / `w/s` | IOPS |
| `rkB/s` / `wkB/s` | 吞吐 |
| `r_await` / `w_await` | 平均等待（队列 + 服务） |
| `aqu-sz` | 平均队列深度 |
| `%util` | 设备忙比例；NVMe/并行设备可能失真 |
| `rareq-sz` / `wareq-sz` | 平均请求大小 |

注意：

- `%util` 接近 100% 不一定是瓶颈；看 await、队列、应用延迟。
- `await` 高可能是队列深、设备慢、文件系统/云盘抖动。
- 写放大、fsync、元数据操作（stat/create/rename）会显著影响延迟。
- NFS 的 `await` 包含网络/服务端延迟。

## 工具

```bash
fio --name=randread --ioengine=libaio --rw=randread --bs=4k --numjobs=4 \
  --size=1G --runtime=60 --time_based --group_reporting --lat_percentiles=1
blktrace -d /dev/nvme0n1 -o trace
bpftrace -e 'tracepoint:block:block_rq_issue { @[comm] = count(); }'
biolatency-bpfcc
biosnoop-bpfcc
cachestat-bpfcc
```

## 优化

- 用 `noatime` 减少元数据写。
- 数据库用 O_DIRECT/合适 IO 调度；NVMe 常用 `none`/`mq-deadline`，HDD 可 `bfq`。
- 调整 `vm.dirty_ratio`/`dirty_background_ratio`，避免突发 writeback 抖动。
- 文件系统：XFS 适合大文件/高并发，ext4 通用；按业务测试。
- 定期 `fstrim`（SSD/云盘），确认是否支持 discard。
- 避免小文件随机写、频繁 fsync；批量/合并写。
- 监控 inode、磁盘空间、队列深度、云盘 IOPS/吞吐上限。
- NFS：调 `rsize/wsize`、`hard/soft`、`nconnect`，监控网络/服务端。
- 容器 overlay 写放大：热数据写 volume，不要写容器层。

# 网络

## 路径

```text
应用 socket
  → 内核 TCP/IP
  → qdisc/网卡队列
  → 驱动/网卡
  → 交换机/云网络
```

## 关键指标

```bash
ss -s
ss -lntp
ss -ti
nstat -az
ip -s link
tc -s qdisc
ethtool -S eth0
ethtool -g eth0
conntrack -S
cat /proc/net/softnet_stat
```

重点：

- `ss -s`：连接数、TIME_WAIT、orphan。
- `ss -ti`：拥塞窗口、RTT、重传、发送/接收队列。
- `nstat`：TCP 重传、丢包、连接失败、listen overflow。
- `tc -s qdisc`：队列 backlog、丢包。
- `ethtool -S`：网卡丢包、错误、队列。
- `conntrack -S`：连接跟踪插入失败/丢包。
- `/proc/net/softnet_stat`：每 CPU backlog/dropped。

## 常见问题

- **TIME_WAIT 多**：短连接多；`tcp_tw_reuse` 可缓解客户端，但不要盲目开。
- **conntrack 满**：`nf_conntrack: table full, dropping packet`；调大 `nf_conntrack_max` 或减少连接。
- **SYN backlog 溢出**：`somaxconn`、`tcp_max_syn_backlog`、应用 backlog。
- **网卡队列丢包**：RPS/XPS、IRQ affinity、多队列、`netdev_max_backlog`。
- **重传/乱序**：网络质量、MTU、拥塞控制、云网络。
- **DNS 慢**：`resolv.conf`、CoreDNS、`ndots`、缓存。
- **MTU 问题**：VXLAN/overlay/跨云路径，`ping -M do -s` 验证。

## 优化

- 使用连接池、长连接、`SO_REUSEPORT`、epoll/io_uring。
- 调整 `somaxconn`、`tcp_max_syn_backlog`、`netdev_max_backlog`、`rmem/wmem`。
- 评估拥塞控制：BBR vs cubic，按网络测试。
- 多队列网卡：IRQ affinity、RPS/XPS，避免单 CPU 软中断打满。
- 减少跨可用区/跨地域调用；用 CDN/边缘/就近接入。
- 监控 P99 延迟、重传、丢包、连接失败，不只看带宽。

# 中断软中断与内核

## 观测

```bash
cat /proc/interrupts
cat /proc/softirqs
mpstat -I ALL 1
cat /proc/net/softnet_stat
```

- 硬中断集中在某 CPU：IRQ affinity/irqbalance。
- 软中断（NET_RX/NET_TX）高：网络流量大、单队列、RPS 未配置。
- `ksoftirqd` CPU 高：软中断处理不过来。
- `%si` 高但应用 CPU 不高：网络/块设备中断/软中断瓶颈。

## 优化

- 开启多队列、RSS、RPS/XPS。
- 调整 IRQ affinity，让网卡中断分散到多 CPU。
- 避免单线程处理所有网络流量。
- 评估 `napi`/`gro`/`tso` 等 offload；不是所有场景都开。
- 容器网络（veth/overlay/eBPF）会增加软中断/转发开销，必要时用 eBPF/DPDK/智能网卡。

# 容器与 Kubernetes

## cgroups v2

- `cpu.max`：quota/period；quota 过低会 throttling。
- `cpu.weight`：相对权重，不是硬上限。
- `memory.max`/`memory.high`：硬限制/软限制。
- `io.max`：IOPS/带宽限制。
- `pids.max`：进程/线程上限。
- `*.pressure`：PSI。

关键指标：

- `container_cpu_cfs_throttled_seconds_total`
- `container_cpu_usage_seconds_total`
- `container_memory_working_set_bytes`
- `container_memory_rss`
- `container_oom_events_total`
- `container_fs_reads/writes_bytes_total`
- `kubelet_evictions`
- `node_pressure_*`

## Kubernetes 节点

- `requests` 决定调度；`limits` 决定运行时上限。
- CPU limit 导致 CFS throttling；延迟敏感服务慎用低 limit。
- Memory limit 导致 OOMKilled；`memory.high` 可做软限制。
- `SystemReserved`/`KubeReserved`/`evictionHard` 保护系统。
- `cpuManager` static policy + `cpuset` 用于绑核；`topologyManager` 用于 NUMA 对齐。
- 节点压力（MemoryPressure/DiskPressure/PIDPressure）触发驱逐。
- 监控 cgroup PSI、throttling、OOM、eviction。

## 容器性能反模式

- 所有容器不设 requests/limits，导致调度/隔离失效。
- CPU limit 过低，导致频繁 throttling。
- Memory limit 等于 request，突发即 OOM。
- 把热数据写容器层/overlay，导致写放大。
- 不限制日志，磁盘被日志打满。
- 节点超卖严重，PSI/steal 高。
- 用 `latest`/大镜像，冷启动慢。

# SRE 性能实践

## SLI/SLO

- 延迟：P50/P95/P99，按接口/租户。
- 吞吐：QPS、成功率。
- 饱和度：CPU throttling、PSI、队列深度。
- 错误预算驱动容量/优化优先级。

## 观测

- Metrics：RED/USE、PSI、cgroup、节点、应用。
- Logs：结构化、采样、关联 trace。
- Traces：跨服务延迟分解。
- Profiles：perf/eBPF/pprof 持续剖析。
- Events/audit：变更、驱逐、OOM、重启。

## 告警

- 告警基于症状：延迟、错误率、SLO 燃尽。
- 资源告警作为辅助：饱和度、PSI、磁盘/inode、证书。
- 避免“CPU > 80%”这类无行动告警。
- 告警要有 runbook、owner、升级路径。

## 容量与压测

- 用真实流量模型压测，不用单一 `ab` 数字。
- 关注 P99、协调遗漏（coordinated omission）、冷启动。
- 预留故障切换容量和 headroom。
- 压测环境与生产硬件/网络/内核/配置一致。
- 变更前做性能回归；变更后看 SLO。

## 事故与复盘

- 性能事故也要时间线、影响、根因、行动项。
- 区分“容量不足”“代码回归”“配置错误”“依赖故障”。
- 复盘后补监控、压测、容量模型、runbook。

# 工具速查

## CPU/进程

```bash
top -H -p <pid>
htop
mpstat -P ALL 1
pidstat -u -w -t 1
ps -eo pid,ppid,stat,pcpu,pmem,comm --sort=-pcpu | head
perf stat -p <pid> sleep 5
perf top
perf record -F 99 -g -p <pid> -- sleep 30
```

## 内存

```bash
free -h
vmstat 1
sar -r 1
smem -tk
slabtop
numastat
cat /proc/meminfo
cat /proc/pressure/memory
```

## 磁盘/IO

```bash
iostat -x 1
iotop -o
pidstat -d 1
df -hT
df -i
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,ROTA,SCHED
cat /proc/pressure/io
fio ...
```

## 网络

```bash
ss -s
ss -lntp
ss -ti
nstat -az
ip -s link
tc -s qdisc
ethtool -S eth0
conntrack -S
mtr -rw host
tcpdump -i any -nn port 443
```

## 追踪

```bash
strace -f -T -e trace=network,file -p <pid>
perf trace -p <pid>
bpftrace -e 'tracepoint:syscalls:sys_enter_openat { @[comm] = count(); }'
biolatency-bpfcc
tcpconnect-bpfcc
runqlat-bpfcc
offcputime-bpfcc
```

## 容器/系统

```bash
systemd-cgtop
systemctl status <service>
journalctl -u <service> -f
journalctl -k -f
cat /proc/pressure/*
```

# 调优参数

## sysctl 常用

```conf
# 文件描述符
fs.file-max = 2097152
fs.nr_open = 2097152

# 内存/写回
vm.swappiness = 10
vm.dirty_background_ratio = 5
vm.dirty_ratio = 15
vm.min_free_kbytes = 65536
vm.max_map_count = 262144

# 网络
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 8192
net.core.netdev_max_backlog = 16384
net.ipv4.ip_local_port_range = 10000 65000
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_congestion_control = bbr
net.core.default_qdisc = fq

# conntrack
net.netfilter.nf_conntrack_max = 1048576
```

注意：

- 不要复制网络上的“万能 sysctl”；按业务/内核/云环境测试。
- `tcp_tw_reuse` 只对客户端有效，服务端短连接另有方案。
- `swappiness=0` 不是“禁用 swap”，仍可能回收。
- 改之前记录基线，改之后验证延迟/吞吐/稳定性。

## systemd

```ini
[Service]
LimitNOFILE=65535
LimitNPROC=65535
TasksMax=4096
MemoryMax=2G
CPUQuota=200%
IOWeight=100
```

## CPU

```bash
cpupower frequency-info
cpupower frequency-set -g performance
tuned-adm list
tuned-adm profile throughput-performance
```

- 云主机/容器可能无法直接调 governor。
- `performance` 省延迟但耗电/发热；`schedutil` 更平衡。
- 不要盲目关超线程；按负载测试。

## 磁盘

- NVMe：`none`/`mq-deadline`；HDD：`bfq`/`mq-deadline`。
- `noatime`、`nodiratime`（谨慎）。
- `fstrim` 定期执行。
- 数据库按厂商建议设置 `O_DIRECT`、`fsync`、WAL。

## 网络

- 多队列/RPS/XPS/IRQ affinity。
- `SO_REUSEPORT`、连接池、keepalive。
- 拥塞控制按网络测试；BBR 不一定适合所有场景。
- 云网络注意带宽/包速率/连接数上限。

# 故障排查决策树

## load 高但 CPU 不高

```bash
uptime
vmstat 1
ps -eo state,pid,ppid,comm | awk '$1 ~ /D/'
cat /proc/<pid>/stack
iostat -x 1
```

可能：

- D 状态 IO/NFS/内核锁。
- 内存回收/直接 reclaim。
- 大量线程/上下文切换。
- 虚拟化 steal。

## CPU 高

```bash
top -H
mpstat -P ALL 1
pidstat -u -t 1
perf top
```

区分：

- us 高：应用计算/锁/GC。
- sy 高：syscall/网络/文件系统/驱动。
- si 高：软中断/网络。
- st 高：宿主机争抢。

## 内存高/OOM

```bash
free -h
smem -tk
slabtop
cat /proc/meminfo
cat /proc/pressure/memory
dmesg -T | grep -i oom
cat /sys/fs/cgroup/.../memory.events
```

区分：

- page cache 可回收。
- anon 泄漏/堆增长。
- slab 内核缓存。
- cgroup limit/OOM。
- THP/碎片。

## IO 慢

```bash
iostat -x 1
pidstat -d 1
cat /proc/pressure/io
biolatency-bpfcc
```

区分：

- 设备饱和/队列深。
- fsync/小文件/元数据。
- 写回/dirty 比例。
- 云盘 IOPS/吞吐上限。
- NFS/网络存储。

## 网络慢/丢包

```bash
ss -s
ss -ti
nstat -az
tc -s qdisc
ethtool -S eth0
conntrack -S
mtr -rw host
```

区分：

- 应用连接池/端口耗尽。
- TIME_WAIT/conntrack。
- 网卡队列/软中断。
- 网络丢包/重传/MTU。
- DNS。

## 容器异常

```bash
systemd-cgtop
cat /sys/fs/cgroup/.../cpu.stat
cat /sys/fs/cgroup/.../memory.events
kubectl describe pod
kubectl top pod
```

区分：

- CPU throttling。
- memory limit/OOM。
- IO 限制。
- pids 限制。
- 节点压力/驱逐。

# 基准测试

## 原则

- 明确目标：延迟、吞吐、并发、容量。
- 环境一致：CPU/内存/磁盘/网络/内核/配置。
- 预热、稳态、多轮；报告 P50/P95/P99，不只看平均。
- 避免协调遗漏：闭环压测要按预期延迟发压。
- 监控被测系统和压测端，避免压测端先瓶颈。
- 一次只改一个变量。

## 工具

```bash
# CPU
sysbench cpu --threads=4 run

# 内存
sysbench memory --threads=4 run

# 磁盘
fio --name=randwrite --ioengine=libaio --rw=randwrite --bs=4k \
  --numjobs=4 --size=1G --runtime=60 --time_based --group_reporting

# 网络
iperf3 -s
iperf3 -c <server> -P 8 -t 30

# HTTP
wrk -t4 -c100 -d30s --latency http://host/
```

## 指标

- 延迟：P50/P95/P99/P999。
- 吞吐：QPS、MB/s、IOPS。
- 错误率、超时。
- 资源：CPU/内存/IO/网络/PSI。
- 稳定性：长时间运行、GC、内存增长。

# 优化原则与反模式

## 原则

- 先测量，后优化。
- 先找瓶颈，再谈参数。
- 一次只改一个变量。
- 保留基线、回滚方案。
- 优化要验证业务 SLO，不只跑分。
- 关注副作用：其他资源、稳定性、成本。
- 配置即代码，变更可审计。
- 容量和性能是持续过程，不是一次性调参。

## 反模式

- 盲目抄 sysctl。
- 看到 CPU 高就加机器。
- 看到 free 低就加内存。
- 看到 `%util` 100% 就换盘。
- 只优化平均延迟，不看 P99。
- 压测环境与生产不一致。
- 压测端先成为瓶颈。
- 只压不监控，或只监控不压。
- 调优后不做回归/灰度。
- 把性能问题归因于“代码慢”，没有证据。
- 忽略容器 cgroup/节点压力。
- 忽略虚拟化 steal/邻居噪声。

# 生产检查清单

## 观测

- [ ] CPU：使用率、load、runqueue、steal、throttling
- [ ] 内存：MemAvailable、anon/file、slab、swap、OOM、PSI
- [ ] 磁盘：IOPS、吞吐、await、队列、inode、空间、writeback
- [ ] 网络：连接数、重传、丢包、TIME_WAIT、conntrack、队列
- [ ] 中断/软中断、IRQ affinity、RPS/XPS
- [ ] cgroup/容器：CPU throttling、memory.events、io.stat、pids
- [ ] 应用：RED、P99、错误率、GC、连接池、线程池
- [ ] 事件/日志/审计/变更关联

## 容量

- [ ] 峰值 + 故障切换 + headroom
- [ ] CPU/内存/磁盘/网络/IP/连接数上限
- [ ] 单机/单副本故障容量
- [ ] 压测模型与生产一致
- [ ] 成本与容量告警

## 调优

- [ ] 有基线、目标、回滚方案
- [ ] 单变量变更、灰度验证
- [ ] 参数按业务/内核/云环境测试
- [ ] cgroup/limits 合理
- [ ] 文件系统/IO 调度/挂载选项
- [ ] 网络队列/拥塞控制/连接池
- [ ] 内核/运行时/驱动版本

## SRE

- [ ] SLO/错误预算
- [ ] 告警基于症状，有 runbook
- [ ] 性能回归测试
- [ ] 容量评审
- [ ] 事故复盘/行动项
- [ ] 持续 profiling/火焰图
- [ ] 变更管理/GitOps

# 参考资料

- [Linux kernel documentation](https://docs.kernel.org/)
- [Linux PSI](https://docs.kernel.org/accounting/psi.html)
- [cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)
- [perf wiki](https://perf.wiki.kernel.org/)
- [BPF/eBPF](https://ebpf.io/)
- [Brendan Gregg - Systems Performance](https://www.brendangregg.com/systems-performance-2nd-edition-book.html)
- [Brendan Gregg - USE Method](https://www.brendangregg.com/usemethod.html)
- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [Google SRE Workbook](https://sre.google/workbook/table-of-contents/)
- [man7.org](https://man7.org/linux/man-pages/)
- [Kubernetes Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)

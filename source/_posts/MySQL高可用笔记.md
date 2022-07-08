---
title: MySQL高可用笔记
date: 2018-10-01 10:45:25
tags: [MySQL, 高可用]
categories: [数据库]
comments: false
---


<!--more-->

# MySQL 主从复制

MySQL 提供了灵活的主从复制机制，可实现一主一从、一主多从、多主一从、主主复制、联级复制。

MySQL 复制原理：MySQL 使用二进制日志（默认未启用），二进制日志会记录所有修改数据库的 SQL 语句。

1. 主服务器上执行了 SQL 操作后，会记录到二进制日志 binlog
2. 从服务器生成两个线程，一个是 I/O 线程，一个是 SQL 线程，I/O 线程请求主数据库的 binlog，将得到的 binlog 写入中继日志 relay log。同时，从库的I/O线程会将主库的信息（即从库上配置的MASTER_HOST、MASTER_LOG_FILE、MASTER_LOG_POS等信息）存储在`master.info`文件，并实时更新
3. 从数据库的 SQL 进程读取 relay log，并开启事务执行最新的一条 SQL 指令，实现主从一致

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120033040.png)

# Orchestrator
> Github：https://github.com/openark/orchestrator

MHA已过时，推荐使用Orchestrator。Orchestrator是一个MySQL高可用性和复制管理工具，以服务运行，并提供命令行访问、HTTP API和Web页面。

- Orchestrator能读取MySQL集群的各节点信息，并在web页面生成拓扑图。
- Orchestrator理解复制规则、binlog文件的信息
- Orchestrator可配置，可以选择执行自动故障恢复，也支持手动恢复


# MySQL 常用调优策略

## 硬件层优化

修改服务器 BIOS 设置

- 选择 DAPC 模式，发挥 CPU 的最大性能
- Memory Frequency（内存频率）选择 Maximum Performance
- 内存设置中启用 Node Interleaving，避免 NUMA 问题

## 磁盘 I/O 优化

- 使用 SSD
- 使用磁盘阵列，并使用阵列卡，同时配备 CACHE 及 BBU 模块
- RAID 尽量选择 RAID10，而不是 RAID5

## 文件系统层优化

- 使用 deadline 或 noop 这两种 I/O 调度器，不要用 cfq
- 使用 xfs 文件系统，不要用 ext3，尽量不用 ext4
- 文件系统挂载 mount 参数中添加`noatime`，`nobarrier`选项

## 内核参数优化

- 修改`vm.swappiness`参数，降低 swap 使用率，尽量设为 5 到 10，最好不要设为 0，防止 OOM 故障
- 调整`vm.dirty_background_ratio`和`vm.dirty_ratio`参数，确保能持续将脏数据刷新到磁盘，避免瞬时 I/O 写
- 调整`net.ipv4.tcp_tw_recycle`和`net.ipv4.tcp_tw_reuse`都为 1，减少 TIME_WAIT，调高 TCP 效率

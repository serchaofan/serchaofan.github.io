---
title: MySQL高可用笔记
date: 2018-10-01 10:45:25
tags: [MySQL, 高可用]
---

* [MySQL高可用概述](#MySQL高可用概述)
* [MySQL主从复制](#MySQL主从复制)
* [MySQL读写分离](#MySQL读写分离)
* [MySQL常用调优策略](#MySQL常用调优策略)



<!--more-->

# MySQL高可用概述







# MySQL主从复制

MySQL提供了灵活的主从复制机制，可实现一主一从、一主多从、多主一从、主主复制、联级复制。



MySQL复制原理：MySQL使用二进制日志（默认未启用），二进制日志会记录所有修改数据库的SQL语句。

1. 主服务器上执行了SQL操作后，会记录到二进制日志binlog
2. 从服务器生成两个线程，一个是I/O线程，一个是SQL线程，I/O线程请求主数据库的binlog，将得到的binlog写入中继日志relay log
3. 从数据库的SQL进程读取relay log，并开启事务执行最新的一条SQL指令，实现主从一致

{% asset_img 3.png %}















# MySQL常用调优策略

## 硬件层优化

修改服务器BIOS设置

* 选择DAPC模式，发挥CPU的最大性能
* Memory Frequency（内存频率）选择Maximum Performance
* 内存设置中启用Node Interleaving，避免NUMA问题



## 磁盘I/O优化

* 使用SSD
* 使用磁盘阵列，并使用阵列卡，同时配备CACHE及BBU模块
* RAID尽量选择RAID10，而不是RAID5



## 文件系统层优化

* 使用deadline或noop这两种I/O调度器，不要用cfq
* 使用xfs文件系统，不要用ext3，尽量不用ext4
* 文件系统挂载mount参数中添加`noatime`，`nobarrier`选项



## 内核参数优化

* 修改`vm.swappiness`参数，降低swap使用率，尽量设为5到10，最好不要设为0，防止OOM故障
* 调整`vm.dirty_background_ratio`和`vm.dirty_ratio`参数，确保能持续将脏数据刷新到磁盘，避免瞬时I/O写
* 调整`net.ipv4.tcp_tw_recycle`和`net.ipv4.tcp_tw_reuse`都为1，减少TIME_WAIT，调高TCP效率




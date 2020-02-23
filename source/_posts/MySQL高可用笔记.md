---
title: MySQL高可用笔记
date: 2018-10-01 10:45:25
tags: [MySQL, 高可用]
categories: [应用运维]
---

- [MySQL 高可用概述](#mysql-%e9%ab%98%e5%8f%af%e7%94%a8%e6%a6%82%e8%bf%b0)
- [MySQL 多实例](#mysql-%e5%a4%9a%e5%ae%9e%e4%be%8b)
- [MySQL 主从复制](#mysql-%e4%b8%bb%e4%bb%8e%e5%a4%8d%e5%88%b6)
- [MySQL 常用调优策略](#mysql-%e5%b8%b8%e7%94%a8%e8%b0%83%e4%bc%98%e7%ad%96%e7%95%a5)
  - [硬件层优化](#%e7%a1%ac%e4%bb%b6%e5%b1%82%e4%bc%98%e5%8c%96)
  - [磁盘 I/O 优化](#%e7%a3%81%e7%9b%98-io-%e4%bc%98%e5%8c%96)
  - [文件系统层优化](#%e6%96%87%e4%bb%b6%e7%b3%bb%e7%bb%9f%e5%b1%82%e4%bc%98%e5%8c%96)
  - [内核参数优化](#%e5%86%85%e6%a0%b8%e5%8f%82%e6%95%b0%e4%bc%98%e5%8c%96)

<!--more-->

# MySQL 高可用概述

# MySQL 多实例

在一台服务器上，配置多个 MySQL 使用不同端口同时运行。为了便于管理 mysql 多实例，最好将配置文件、数据文件等单独存放在一个目录进行统一管理。

```
mkdir -p /mysql/{3306,3307}/{data,conf,log}
```

可以下载 mysql 的二进制包，解压后放在`/usr/local/mysql`中

```
/usr/local/mysql/
├── LICENSE
├── README
├── bin
├── docs
├── include
├── lib
├── man
├── share
└── support-files
```

创建用户 mysql，并赋权`chown -R mysql:mysql /usr/local/mysql`

创建配置文件`my.cnf`，以下为配置模板

```
[client]
port            = 3306
socket          = /mysql/3306/mysql.sock

[mysql]
no-auto-rehash

[mysqld]
user    = mysql
port    = 3306
socket  = /mysql/3306/mysql.sock
basedir = /usr/local/mysql
datadir = /mysql/3306/data
pid-file = /mysql/3306/mysql.pid
server-id = 1	# 不同实例的id,不同的实例配置中务必要用不同的id
log-bin = /mysql/3306/mysql-bin
log-error = /mysql/3306/log/error.log
log-slow-queries = /mysql/3306/log/slow.log

open_files_limit = 1024
back_log = 600
max_connections = 800
max_connect_errors = 3000
table_cache = 614
external-locking = FALSE
max_allowed_packet =8M
sort_buffer_size = 1M
join_buffer_size = 1M
thread_cache_size = 100
thread_concurrency = 2
query_cache_size = 2M
query_cache_limit = 1M
query_cache_min_res_unit = 2k
#default_table_type = InnoDB
thread_stack = 192K
#transaction_isolation = READ-COMMITTED
tmp_table_size = 2M
max_heap_table_size = 2M
long_query_time = 1
#log_long_format

relay-log = /mysql/3306/log/relay-bin
relay-log-info-file = /mysql/3306/log/relay-log.info
binlog_cache_size = 1M
max_binlog_cache_size = 1M
max_binlog_size = 2M
expire_logs_days = 7
key_buffer_size = 16M
read_buffer_size = 1M
read_rnd_buffer_size = 1M
bulk_insert_buffer_size = 1M
#myisam_sort_buffer_size = 1M
#myisam_max_sort_file_size = 10G
#myisam_max_extra_sort_file_size = 10G
#myisam_repair_threads = 1
#myisam_recover
lower_case_table_names = 1
skip-name-resolve
slave-skip-errors = 1032,1062
replicate-ignore-db=mysql
innodb_additional_mem_pool_size = 4M
innodb_buffer_pool_size = 32M
innodb_data_file_path = ibdata1:128M:autoextend
innodb_file_io_threads = 4
innodb_thread_concurrency = 8
innodb_flush_log_at_trx_commit = 2
innodb_log_buffer_size = 2M
innodb_log_file_size = 4M
innodb_log_files_in_group = 3
innodb_max_dirty_pages_pct = 90
innodb_lock_wait_timeout = 120
innodb_file_per_table = 0

[mysqldump]
quick
max_allowed_packet = 2M

[mysqld_safe] # 服务启动配置
log-error = /mysql/3306/log/mysql_3306.err
pid-file = /mysql/3306/mysqld.pid
```

创建 mysql 启动脚本

```shell
#!/bin/sh
port=3306
mysql_user="mysql"
mysql_pwd="123456"
CmdPath="/usr/local/mysql/bin/"
mysql_sock="/mysql/${port}/mysql.sock"
#start Mysql Services
function_start_mysql()
{
    if [ ! -e "$mysql_sock" ];then
      printf "Starting MySQL...\n"
      /bin/sh ${CmdPath}/mysqld_safe --defaults-file=/mysql/${port}/conf/my.cnf 2>&1 > /dev/null &
    else
      printf "MySQL is running...\n"
      exit
    fi
}
#stop Mysql Services
function_stop_mysql()
{
    if [ ! -e "$mysql_sock" ];then
       printf "MySQL is stopped...\n"
       exit
    else
       printf "Stoping MySQL...\n"
       ${CmdPath}/mysqladmin -u ${mysql_user} -p${mysql_pwd} -S /mysql/${port}/mysql.sock shutdown
   fi
}
#restart Mysql Services
function_restart_mysql()
{
    printf "Restarting MySQL...\n"
    function_stop_mysql
    sleep 2
    function_start_mysql
}
case $1 in
start)
    function_start_mysql
;;
stop)
    function_stop_mysql
;;
restart)
    function_restart_mysql
;;
*)
    printf "Usage: /mysql/${port}/mysql {start|stop|restart}\n"
esac
```

# MySQL 主从复制

MySQL 提供了灵活的主从复制机制，可实现一主一从、一主多从、多主一从、主主复制、联级复制。

MySQL 复制原理：MySQL 使用二进制日志（默认未启用），二进制日志会记录所有修改数据库的 SQL 语句。

1. 主服务器上执行了 SQL 操作后，会记录到二进制日志 binlog
2. 从服务器生成两个线程，一个是 I/O 线程，一个是 SQL 线程，I/O 线程请求主数据库的 binlog，将得到的 binlog 写入中继日志 relay log
3. 从数据库的 SQL 进程读取 relay log，并开启事务执行最新的一条 SQL 指令，实现主从一致

{% asset_img 3.png %}

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

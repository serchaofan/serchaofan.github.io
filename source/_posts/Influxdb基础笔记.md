---
title: Influxdb基础笔记
tags: [influxdb, 数据库]
categories: [数据库]
date: 2019-12-15 14:37:59
---

InfluxDB 是一个开源时间序列平台，包括用于存储和查询数据，在后台处理数据以实现 ETL 或监视和警报目的的 API，用户仪表板以及可视化和探索数据的 API 等。
本笔记根据 influxdb v1.7 文档作翻译整理，跳过一些难点，仅作基础的一些应用

<!--more-->

## 安装与启动

首先，安装 influxdb 需要 root 权限，TCP 8086 和 8088 端口需要开启且空闲。

- TCP 端口 8086 可用于使用 InfluxDB API 的客户端-服务器通信。
- TCP 端口 8088 可用于 RPC 服务执行备份和还原操作。

除了上面的端口外，InfluxDB 还提供了多个插件，这些插件可能需要自定义端口。 可以通过配置文件修改所有端口映射，对于默认安装，该文件位于`/etc/influxdb/influxdb.conf`中。

需要安装 NTP 或 chrony 服务同步计算机时间，InfluxDB 使用主机 UTC 本地时间为数据分配时间戳。使用 NTP 在主机之间同步时间，如果主机的时钟未与 NTP 同步，则写入 InfluxDB 的数据上的时间戳可能不准确。

ubuntu 安装

```
wget -qO- https://repos.influxdata.com/influxdb.key | sudo apt-key add -
source /etc/lsb-release
echo "deb https://repos.influxdata.com/${DISTRIB_ID,,} ${DISTRIB_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/influxdb.list
```

debian 安装

```
wget -qO- https://repos.influxdata.com/influxdb.key | sudo apt-key add -
source /etc/os-release
echo "deb https://repos.influxdata.com/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/influxdb.list
```

然后：`sudo apt-get update && sudo apt-get install influxdb`

centos 安装

```
cat <<EOF | sudo tee /etc/yum.repos.d/influxdb.repo
[influxdb]
name = InfluxDB Repository - RHEL \$releasever
baseurl = https://repos.influxdata.com/rhel/\$releasever/\$basearch/stable
enabled = 1
gpgcheck = 1
gpgkey = https://repos.influxdata.com/influxdb.key
EOF
```

然后`yum install influxdb`

系统对每个配置文件设置都有内部默认值。 使用`influxd config`命令查看默认配置设置。
启动 influxdb 也可使用指定配置文件`influxd -config <configfile>`
也可配置环境变量`INFLUXDB_CONFIG_PATH`进行设置

确保存储数据和预写日志（WAL）的目录对于运行 Influxd 服务的用户是可写的。如果 data 和 WAL 目录不可写，那么 influxd 服务将不会启动。

## 概念

在 influxdb 中所有数据都会有一列 time，用于存储时间戳，时间戳以`RFC3339 UTC`的形式显示。

字段（field）由字段键和字段值组成。字段键是字符串。字段值是数据，它们可以是字符串，浮点数，整数或布尔值，并且**字段值始终与时间戳关联**。字段键和字段值对的集合构成了一个字段集（field set）。

字段是 InfluxDB 数据结构必不可少的部分，如果没有字段，则 InfluxDB 中就不会有数据。同时要注意，**字段未编入索引**。使用字段值作为过滤器的查询一定会扫描与查询中其他条件匹配的所有值，对比标签查询来说性能不高。所以，通常字段不应包含常用查询的元数据。

标签（tag）由标签键和标签值组成。标记键和标记值都存储为字符串并记录元数据。标签集（tag set）是所有标签键值对的不同组合。标签是可选的，无需在数据结构中包含标签，但通常最好使用它们，因为与字段不同，标签是被索引的，这意味着对标签的查询速度更快，并且标签非常适合存储常见查询的元数据。为了优化查询，建议重新安排架构，使字段成为标签，而标签成为字段，这样当 InfluxDB 执行查询时，不必扫描字段的每个值，查询会更快。

度量（measurement）充当标签、字段和时间列的容器，度量名称是对关联字段中存储的数据的描述。度量名称是字符串，度量在概念上类似于 SQL 的表。单个度量可以属于不同的保留策略（retention policies）。保留策略描述 InfluxDB 保留数据多长时间（DURATION），以及该数据在集群中存储多少副本（REPLICATION）。

> 复制因子（replication factors）不适用于单节点实例。

InfluxDB 自动创建保留策略，它具有无限的持续时间，并且复制因子设置为 1。

序列（series）是共享保留策略、度量和标记集的数据集合。序列包含四列：`Arbitrary series number`、`Retention policy`、`Measurement`、`Tag set`，在设计架构以及在 InfluxDB 中处理数据时，了解序列的概念至关重要。

点（point）代表具有四个组成部分的单个数据记录：测量，标签集，字段集和时间戳。点由其序列和时间戳唯一标识。

## 特性

数据库可以具有多个用户，连续查询，保留策略和度量。InfluxDB 是无模式（schemaless）的数据库，这意味着可以随时轻松添加新的度量，标签和字段。

在 InfluxDB 中，时间戳标识任何给定数据序列中的单个点。这就像一个 SQL 数据库表，其中主键由系统预先设置，并且始终为时间。

InfluxDB 还认识到架构首选项可能会随着时间而改变，因此在 InfluxDB 中无需预先定义架构。数据点可以具有度量中的一个字段、所有字段或介于两者之间的任何数字，只需为新字段编写一个点即可将其添加到度量中。

Influxdb 与 SQL 比对

- InfluxDB 度量类似于 SQL 数据库表。
- InfluxDB 标签类似于 SQL 数据库中的索引列。
- InfluxDB 字段类似于 SQL 数据库中的未索引列。
- InfluxDB 点类似于 SQL 行。
- InfluxDB 连续查询和保留策略类似于 SQL 数据库中的存储过程。

SQL JOIN 不适用于 InfluxDB 度量，架构设计应反映出这种差异。而且，度量就像一个 SQL 表，其中主索引始终被预设为时间，InfluxDB 时间戳必须采用 UNIX 纪元（GMT）或格式化为在 RFC3339 下有效的日期时间字符串。

InfluxQL 是一种类似于 SQL 的查询语言，用于与 InfluxDB 进行交互。
InfluxQL 允许在 WHERE 子句中指定查询的时间范围。可以使用用单引号引起来的日期时间字符串，其格式为`YYYY-MM-DD HH：MM：SS.mmm`（mmm 是毫秒，是可选的，还可以指定微秒或纳秒）。还可以使用`now()`获取计算机当前时间戳。

| 时间单位 | 单位 | 时间单位 | 单位 |
| :------: | :--: | :------: | :--: |
|    ns    | 纳秒 |    m     |  分  |
|  u or µ  | 微秒 |    h     |  时  |
|    ms    | 毫秒 |    d     |  天  |
|    s     |  秒  |    w     |  周  |

InfluxQL 还支持正则表达式，表达式中的算术，`SHOW`语句和`GROUP BY`语句。

时间序列数据通常只写入一次，很少更新。因此，InfluxDB 不是完整的 CRUD 数据库，而是更像 CR-ud，将创建和读取数据的性能置于更新和销毁之上，并阻止某些更新和销毁行为来使创建和读取性能更高。

- 若要更新一个点，需插入一个具有相同测量值，标签集和时间戳的点
- 可以删除或删除序列，但不能删除或删除基于字段值的单个点。解决方法是：可以搜索字段值，检索时间，然后根据时间字段删除
- 还不能更新或重命名标签，要修改一点序列的标签，先找到带有问题的标签值的点，将值更改为所需的点，将点写回，然后删除具有旧标签值的序列
- 无法通过标签键（而不是值）删除标签

## 设计见解与权衡

InfluxDB 是一个时间序列数据库。为此用例进行优化需要权衡取舍，主要是以功能为代价来提高性能。

1. 假设多次发送相同的数据，则它仅是客户端刚刚发送几次的完全相同的数据。
   优点：简化的冲突解决方案可提高写入性能。
   缺点：无法存储重复数据，在极少数情况下可能会覆盖数据。

2. 删除很少见。当删除确实发生时，几乎总是会遇到大量旧数据，这些旧数据对于写入而言是无用的。
   优点：限制对删除的访问可以提高查询和写入性能。
   缺点：删除功能受到严重限制。

3. 对现有数据的更新很少发生，而有争议的更新则永远不会发生。时间序列数据主要是永远不会更新的新数据。
   优点：限制对更新的访问可以提高查询和写入性能。
   缺点：更新功能受到严重限制。

4. 绝大多数写操作是针对具有最近时间戳记的数据，并且数据按时间升序添加。
   优点：**按时间升序添加数据的性能明显更高。**
   缺点：用随机时间或不按升序排列的时间写点的性能明显降低。

5. 规模（scale，或者说性能）至关重要。数据库必须能够处理大量的读写操作。
   优点：数据库可以处理大量的读写操作。
   缺点：InfluxDB 开发团队被迫进行权衡以提高性能。

6. 能够写入和查询数据比拥有高度一致的视图更为重要。
   优点：编写和查询数据库可以由多个客户端以高负载完成。
   缺点：如果数据库负载沉重，查询返回可能不包含最新点。

7. 许多时间序列都是短暂的。通常，时间序列只会出现几个小时，然后消失，例如：一个新的主机，该主机开始启动并报告一段时间，然后关闭。
   优点：InfluxDB 擅长管理不连续的数据。
   缺点：无模式设计意味着某些数据库功能不受支持，例如：没有交叉表联接。

8. 点（point）是不太重要的。
   优点：InfluxDB 具有非常强大的工具来处理聚合数据和大型数据集。
   缺点：点没有传统意义上的 ID，它们通过时间戳和序列来区分。

## influx 命令行

`influx`是 influxDB 的 shell API，在启动了`influxd`后，通过`influx`进入 influx shell。

```
influx [选项]
  -host <hostname>       # 指定主机，默认localhost
  -username <username>   # 指定数据库用户
  -password <password>   # 指定该用户密码
  -version   # 查看版本
  -type      # 指定交互的shell，默认为influxql，也可以设为flux
  -pretty    # 将json格式的输出进行格式化，需要-format设为json
  -format 'json|csv|column' # 指定输出格式，默认为column
  -execute <command>   # 直接执行influxql命令
  -port <port>  # 指定连接端口，默认为8086
  -database <database>  # 指定数据库
  -precision 'rfc3339|h|m|s|ms|u|ns'   # 指定时间的输出格式，rfc3339会比较好看
  -import  # 从文件中导入一个库
  -path <path>   # 导入的文件路径，与-import一起用
  -compressed  # 若import的文件是压缩的就加上这个，与-import一起用
  -pps     # 每秒导入的点的个数，默认为0，不限流，与-import一起用
  -consistency 'any|one|quorum|all'  # 设置写的一致性等级
  -ssl  # 使用https请求
  -unsafeSsl  # 禁用ssl的证书验证，使用自验证
```

导入文件分为两部分：

- DDL（数据定义语言）：包含 InfluxQL 命令，用于创建相关数据库和管理保留策略。如果数据库和保留策略已经存在，则文件可以跳过此部分。
- DML（数据操作语言）：列出相关的数据库和（如果需要）保留策略，并包含在线协议中的数据。

> 对于大型数据集，influx 每 10 万个点写出一条状态消息。
> 如果在导入期间保持活动状态的 InfluxDB Enterprise 群集上使用此命令，则建议将每秒的点数（`-pps`）限制为 5000 至 10000。
> 导入可处理`.gz`文件，只需在命令中包含`-compressed`。
> 在数据文件中包括时间戳。InfluxDB 将为没有时间戳的点分配相同的时间戳。这可能会导致意外的覆盖行为。
> 如果数据文件具有 5000 个以上的点，则可能有必要将该文件拆分为几个文件，以便将数据批量写入 InfluxDB。建议分 5000 至 10000 分写作分数。较小的批次和更多的 HTTP 请求将导致次优性能。默认情况下，HTTP 请求在 5 秒钟后超时。超时后，InfluxDB 仍将尝试写入这些点，但是不会确认它们已成功写入。
> 可以在导入命令后加上`2> failure.log` 生成错误日志，方便排错

进入 influxdb shell 后的命令，很多都是可以直接通过上面的选项直接设置的

```
auth   # 提示输入用户名和密码。Influx在查询数据库时使用这些凭据。
       # 或使用INFLUX_USERNAME和INFLUX_PASSWORD环境变量设置CLI的用户名和密码。
connect <host:port>  # 连接指定的数据库
use [<database_name> | <database_name>.<retention policy_name>]
       # 设置当前数据库and/or保留策略。
       # 一旦Influx设置了当前数据库和/或保留策略，就无需在查询中指定该数据库和/或保留策略
       # 若未指定保留策略，那么Influx会自动查询使用的数据库的DEFAULT保留策略
insert   # 插入数据，类似SQL
consistency <level>  # 一致性等级，参考上面
format <format>     # 输出格式，同上
precision <format>  # 时间格式，同上
pretty     # 格式化json
settings   # 输出设置信息
history    # 显示指令历史
chunked    # 开启块响应，默认已开启
chunk <size>  # 设置块响应的大小。 默认大小为10000，设置为0会将块大小重置为其默认值。
clear [database| db| retention policy| rp]   # 清除数据库或保留策略的当前上下文。
```

## 配置管理

### 全局配置

- `reporting-disabled = false` 把数据报告给 influxData，默认关
- `bind-address = "127.0.0.1:8088"` 用于备份和恢复的端口，也可通过环境变量`INFLUXDB_BIND_ADDRESS`设置

### 元存储

`[meta]`本部分控制 InfluxDB 元存储的参数，该元存储存储有关用户，数据库，保留策略，分片和连续查询的信息。

- `dir = "/var/lib/influxdb/meta"`
  元数据数据库的存储目录。 元目录中的文件包括`meta.db`（InfluxDB 元存储文件）。环境变量`INFLUXDB_META_DIR`
- `reserved-autocreate = true`  
  创建数据库时启用默认保留策略自动生成的自动创建。保留策略自动生成具有无限的持续时间，并且还被设置为数据库的 DEFAULT 保留策略，当写入或查询未指定保留策略时使用。禁用此设置以防止在创建数据库时创建此保留策略。环境变量`INFLUXDB_META_RETENTION_AUTOCREATE`
- `logging-enabled = true`
  启用元服务消息的日志记录。环境变量`INFLUXDB_META_LOGGING_ENABLED`

### 数据

`[data]`设置控制 InfluxDB 的实际分片数据在何处以及如何从预写日志（WAL）中清除。 `dir`可能需要更改为适合系统的位置，但是 WAL 设置是高级配置。默认值适用于大多数系统。

- `dir = "/var/lib/influxdb/data"`
  TSM 引擎存储 TSM 文件的 InfluxDB 目录。 此目录可能会更改。环境变量`INFLUXDB_DATA_DIR`
- `wal-dir = "/var/lib/influxdb/wal"`
  预写日志（WAL）文件的目录位置。环境变量`INFLUXDB_DATA_WAL_DIR`
- `query-log-enabled = true`
  在执行之前启用已解析查询的日志记录。查询日志对于故障排除很有用，但会记录查询中包含的所有敏感数据。环境变量`INFLUXDB_DATA_QUERY_LOG_ENABLED`

### 请求管理

### 保留策略

### 碎片预创建

### 监控

### HTTP 锚点

### 日志

## InfluxQL 要点整理

## 数据库监控

InfluxDB 可以显示有关每个节点的统计和诊断信息。

- 要查看节点统计信息，可执行命令`SHOW STATS`，返回的统计信息仅存储在内存中。

  ```
  > show stats
  name: runtime
  -------------
  Alloc   Frees   HeapAlloc       HeapIdle        HeapInUse       HeapObjects     HeapReleased    HeapSys         Lookups Mallocs NumGC   NumGoroutine    PauseTotalNs    Sys             TotalAlloc
  4136056 6684537 4136056         34586624        5816320         49412           0               40402944        110     6733949 83      44              36083006        46692600        439945704

  name: graphite
  tags: proto=tcp
  batches_tx bytes_rx connections_active connections_handled points_rx points_tx

    ---

    159 3999750 0 1 158110 158110
  ```

- 要查看节点诊断信息，可执行命令`SHOW DIAGNOSTICS`，返回诸如构建信息，正常运行时间，主机名，服务器配置，内存使用情况和 Go 运行时诊断之类的信息。

  ```
  name: build
  Branch Build Time Commit Version

  ---

  1.7 23bc63d43a8dc05f53afa46e3526ebb5578f3d88 1.7.9

  name: config
  bind-address reporting-disabled

  ---

  127.0.0.1:8088 false
  ......
  ```

- InfluxDB 还将统计和诊断信息写入名为`_internal`的数据库，该数据库记录有关内部运行时和服务性能的指标。可以像其他任何 InfluxDB 数据库一样查询和操作`_internal`数据库。
  其中有以下度量：

  ```
  cq
  database
  httpd
  queryExecutor
  runtime
  shard
  subscriber
  tsm1_cache
  tsm1_engine
  tsm1_filestore
  tsm1_wal
  write
  ```

- 可通过 HTTP API 访问 8086 端口`/metrics`，获取当前信息

## HTTP_API 查询

## 认证授权

## 日志追踪

## 备份与恢复

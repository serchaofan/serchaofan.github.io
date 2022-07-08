---
title: Redis基础学习笔记
date: 2018-05-17 19:01:43
tags: [数据库, Redis]
categories: [数据库]
comments: false
---

本篇笔记主要包含以下内容


  <!-- more -->

- [Redis 介绍](#redis-介绍)
- [Redis 安装](#redis-安装)
- [Redis 数据类型](#redis-数据类型)
- [排序](#排序)
- [发布与订阅](#发布与订阅)
- [事务](#事务)
- [过期时间](#过期时间)
- [持久化](#持久化)
- [Redis 优化技术](#redis-优化技术)
  - [管道](#管道)
  - [内部编码优化](#内部编码优化)
- [集群](#集群)
  - [复制（主从）](#复制主从)
  - [无硬盘复制](#无硬盘复制)
  - [增量复制](#增量复制)
  - [哨兵](#哨兵)
  - [集群](#集群-1)
- [管理](#管理)
  - [安全](#安全)
  - [通信协议](#通信协议)
  - [一些管理命令](#一些管理命令)
- [Redis 配置文件常用参数](#redis-配置文件常用参数)
  - [服务本身相关](#服务本身相关)
  - [连接相关](#连接相关)
  - [内存相关](#内存相关)
  - [持久化相关](#持久化相关)
  - [主从复制相关](#主从复制相关)
  - [定时任务相关](#定时任务相关)
- [K8S集群内部署Redis](#k8s集群内部署redis)
- [FAQ](#faq)
  - [Redis 报错问题](#redis-报错问题)
- [参考资料](#参考资料)

# Redis 介绍

Redis（Remote Dictionary Server）是由 C 语言写成的高性能 key-value 非关系型数据库。
为了保证效率，Redis 的数据都缓存在内存中，并周期性地将更新的数据写入磁盘，或将修改写入记录文件，在此基础上实现了主从同步。

# Redis 安装

- 因为 Redis 是由 C 语言写的，所以要装 gcc。
  `yum install gcc`
- 安装 jemalloc，用于动态内存分配，是 malloc 的一个优化版本
  `yum install jemalloc`
- 安装工具命令语言 TCL
  `yum install tcl`
- 解压 redis 包到`/usr/local`，进入后`make && make install`即可编译安装，可先`make test`检查是否出错
- 建立软连接，redis 的命令都存放在`/usr/local/redis/src/`目录下

```
ln -s /usr/local/redis/src/redis-server /bin/redis-server
ln -s /usr/local/redis/src/redis-cli /bin/redis-cli
ln -s /usr/local/redis/src/redis-benchmark /bin/redis-benchmark
ln -s /usr/local/redis/redis.conf /etc/redis.conf
```

如果可用内存十分小，最好要设置内核参数`vm.overcommit_memory`为 1。

`overcommit_memory`指定了内核针对内存分配的策略：

- `0`：内核将检查是否有足够可用内存供应用进程使用。若不足，会报错
- `1`：内核允许分配所有物理内存，不管当前内存状态。
- `2`：内核允许分配**超过**所有物理内存和 swap 之和的内存大小。

`echo "vm.overcommit_memory=1" >> /etc/sysctl.conf`并且`sysctl -p`

**redis 命令**

- `redis-server`用于开启 redis 服务器端

```
	[redis.conf文件路径] 设置配置文件路径，即可按照指定配置启动redis-server
	--[配置参数]  设置指定参数
	例：--port=6378
	-v 查看redis版本
```

- `redis-cli`开启客户端命令行

```
	-h [hostname]  指定要连接的redis服务器主机名，默认127.0.0.1
	-p [port] 指定服务器端口，默认6379
	-s [socket] 指定服务器socket，会覆盖主机名和端口
	-a [password] 设置连接redis服务器时要用的密码
	-u [uri] 设置服务器的URI
	shutdown 关闭redis
```

**注：** 若要让 redis 默认在后台启动，可修改配置文件中`daemonize 参数`，若为 no，则是前台启动，若为 yes，则是后台启动

- `redis-check-aof`与`redis-check-rdb`：用于检测持久化状态或进行修复

**redis-cli 基本操作**
`exists [key]` 查看键是否存在，存在返回 1，否则返回 0
`del [key]` 删除键
`type [key]` 返回键的数据类型
`keys [pattern]` 返回符合指定匹配规则的键，支持 glob 风格通配符格式。
`rename [old-key] [new-key]` 重命名键
`dbsize` 返回当前数据库的键数量
`expire [key] [time]` 指定键的生存时间（单位秒），返回 1 说明设置成功。未设置默认键的生存时间是无穷，会一直占用空间。
`ttl [key]` 返回键的剩余生存时间，-1 表示永久，-2 表示不存在（已删除）
`select [db-num]` 选择数据库编号

> 0 为默认，从 1 开始会在端口后显示，最大为 15，即最多有 16 个数据库。若超出范围，虽会显示该编号，但是仅会对 15 号数据库操作。

`move [key] [db-num]` 将指定键移动到指定数据库（不是复制）
`flushdb` 删除当前数据库中所有键
`flushall` 删除所有数据库的所有键

**glob 风格通配符**

| 符号 | 含义                 |
| ---- | -------------------- |
| ?    | 匹配一个字符         |
| \*   | 匹配任意个字符       |
| []   | 匹配括号建的任一字符 |

# Redis 数据类型

- **字符串 String**：可包含任意数据，包括图片和序列化对象，单个值上限 512MB

- **列表 List**：**双向链表**，通过 push 和 pop 从链表头部或尾部添加删除元素，因此即可用作栈也可用作队列，且都是双向的

- **哈希 Hash**：也称散列，字符串类型的键值对的映射表，**适合存储对象**，每个 Hash 可存储 2^32-1 个键值对。

  新建的 hash 对象以 zipmap 来存储，zipmap 本身不是 hash table，但相比正常的 hash，可以节省 hash 自身需要的元数据存储开销。

  zipmap 的增删改的复杂度都是 O(n)，但是一般对象的 field 都不多，所以速度也较快。若 field 或 value 的大小超出一定限制，则 redis 会自动将 zipmap 替换为正常的 hash 实现。

  可通过配置文件的`hash-max-ziplist-entries`和`hash-max-ziplist-value`设置限制大小，单位字节。默认 entries 设为 512，value 设为 64

- **集合 Set**：字符串类型的无序集合，通过 Hash 表实现，所有操作的复杂度都为 O(1)，最多可包含 2^32-1 个键值对

- **有序集合 Sorted Set**：也称 ZSet，每个元素都会关联一个 double 类型的分数，称为权。redis 正是通过权来为集合中的成员进行从小到大的排序。有序集合的成员是唯一的,但权却可以重复。

**redis-cli 操作**

- **字符串**
  `set [key] [value]` 设置键值

  `setnx [key] [value]`：设置键值，若 key 已存在，则不会修改该值，并返回 0

  `setex [key] [expire time][value]`：设置键值以及有效时间

  `mset [key1] [value1] [key2] [value2] ...` 同时设置多个键值

  `msetnx`：设置多个键值，但若 key 存在，则不会修改值

  `get [key]` 获取键值
  `mget [key1] [key2] ...`同时获取多个键的值
  `getrange [key] [start] [end]` 返回键中字符串值的子字符串
  `setrange [key] [start] [end]` 设置字符串值的子串值
  `getset [key] [value]` 设置键的值并返回旧值
  `strlen [key]` 返回该键的字符串值的长度
  `incr [key]` 设置键值自增，返回新值
  `decr [key]` 设置键值自减，返回新值
  `incrby [key] [value]` 设置键值自增指定 value，返回新值
  `descby [key] [value]` 设置键值自减指定 value，返回新值
  `append [key] [value]` 指定键追加值 value，返回新值长度
  `substr [key] [start] [end]` 取字符串（字符编号从 0 开始）

- **列表**
  `lpush [list] [member1] [member2]...` 在 list 头部添加元素
  `rpush [list] [member1] [member2]...` 在 list 尾部添加元素
  `lpop [list]` 在 list 头部删除元素，返回删除元素
  `rpop [list]` 在 list 尾部删除元素，返回删除元素

  `linsert [list] before|after [指定值][value]`：在指定 list 的特定位置前或后添加字符串 value

  `lset [list][index][value]`：设置指定下标的值

  `lrem [list][num][value]`：删除 list 中 num 个和 value 值一致的值。若 num>0，则从头开始删，若 num<0，则从尾开始删，若 num 为 0，删除全部

  `llen [list]` 返回 list 的长度
  `lindex [list] [index]` 获取列表中对应索引的元素
  `lrange [list] [start] [end]` 返回 list 指定区间的元素（编号从 0 开始）
  `ltrim [list] [start] [end]` 截取 list，只保留截取区间的元素

- **集合**
  `sadd [set] [member1] [member2]...` 添加集合元素
  `srem [set] [member1] [member2]...` 删除集合元素

  `spop [set] [value]`：删除指定 value

  `scard [set]` 返回集合元素个数
  `smove [set1] [set2] [value]` 将指定元素从 set1 移到 set2
  `sismember [set] [value]` 判断该元素是否属于指定集合
  `smembers [set]` 返回集合中所有元素

  `srandmember [set]`：随机返回 set 中的一个值

  `sinter [set1] [set2]` 返回集合的交集
  `sinterstore [set3] [set1] [set2]` 将集合的交集存储到 set3 集合中
  `sunion [set1] [set2]` 返回集合的并集
  `sunionstore [set3] [set1] [set2]` 将集合的并集存储到 key3 集合中
  `sdiff [set1] [set2]` 返回集合的差集
  `sdiffstore [key3] [key1] [key2]` 将集合的差集存储到 key3 集合中

- **有序集合**
  `zadd [key] [score1] [member1]...` 向有序集合添加成员并设置权值
  `zrem [key] [member]` 删除集合元素
  `zincrby [key] [incr] [member]` 设置元素的增加值
  `zrank [key] [member]` 返回指定元素的下标（从小到大）
  `zrevrank [key] [member]` 返回指定元素的下标（从大到小）
  `zrange [key] [start] [end]` 返回集合的指定区间元素
  `zrevrange [key] [start] [end]` 返回集合的指定区间元素（逆序）

  `zrangebyscore [key][start][end]`：返回 score 在指定范围间的元素。可在最后添加参数`withscores`返回该元素的 score

  `zcount [key][start][end]`：返回 score 在指定范围内的元素个数

  `zcard [key]` 返回集合元素个数
  `zscore [key] [member]` 返回元素的权值
  `zremrangebyrank [key] [start] [end]` 删除集合中给定排名区间的元素

  `zremrangebyscore [key][start][end]`：删除集合中 score 在指定范围内的元素

- **哈希**
  `hset [table] [column] [value]` 设置字段 column 的值

  `hsetnx [table][column][value]`：设置字段值，若字段存在则不会修改值，并返回 0

  `hget [table] [column]` 获取字段的值
  `hmset [table] [column1] [value1]...` 设置多个字段的值
  `hmget [table] [column1] [column2]...` 获取多个字段的值
  `hincrby [table] [column] [incr]` 字段增加指定值
  `hexists [table] [column]` 字段是否存在

  `hlen [table]`：返回指定 hash 的字段数

  `hdel [table] [column]...` 删除表中字段
  `hdel [table]` 删除表
  `hkeys [table]` 返回表的所有字段
  `hvals [table]` 返回表的所有值
  `hgetall [table]` 返回表的所有字段与值

# 排序

Redis 支持对 list、set、sorted set 的排序。
`sort [key] [BY partten][LIMIT offset count][GET pattern][ASC|DESC][ALPHA][STORE dstkey]`

- sort 默认排序为从小到大，若要按照字母顺序排可选择`ALPHA`选项，`ALPHA`可以和`ASC` `DESC`一起用。
  在对有序集合类型排序时会忽略元素的分数，只针对元素自身的值进行排序。

```
> lpush list1 1 2 3 4
> sort list1
1) "1"
2) "2"
3) "3"
4) "4"

> lpush list2 a b c A B C
> sort list2 alpha
1) "a"
2) "A"
3) "b"
4) "B"
5) "c"
6) "C"

```

- `BY partten` 设置条件进行排序

```
> sort list1 by a*


```

- `LIMIT offset count` 表示跳过前 offset 个元素，并获取之后的 countge 元素

```
> sort list2 alpha limit 2 3
1) "b"
2) "B"
3) "c"
```

- `GET pattern`

# 发布与订阅

发布/订阅是一种消息通信模式，主要目的是解除消息发布者与消息订阅者的耦合。

订阅者可以通过`subscribe`和`psubscribe`命令向 redis server 订阅自己感兴趣的消息类型，redis 将消息类型称为频道(channel)。
当发布者通过`publish`命令向 redis server 发送特定类型的消息时，该频道的全部订阅者都会收到此消息。这里消息的传递是多对多的。一个订阅者可以订阅多个频道,也可以向多个频道发送消息。
`publish [channel] [message]`向指定频道发布信息
`subscribe [channel]` 订阅频道
实验：开启两个终端

```
# 终端2
> SUBSCRIBE chan1
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "chan1"
3) (integer) 1
```

此时该终端处于订阅状态，该状态下客户端不可使用除`subscribe`、`unsubscribe`、`psubscribe`、`punsubscribe`以外的命令。
在订阅频道后客户端会收到三种类型的回复，每种回复都包含三个值。
第一个值为消息类型。有以下三种消息类型

- **subscribe**：表示订阅成功的反馈信息。此时第二个值为订阅的频道名，第三个值为当前客户端订阅的频道数

```
# 终端2
1) "subscribe"
2) "chan1"
3) (integer) 1
```

- **message**：表示接收到的消息。此时第二个值为产生消息的频道，第三个值为消息的内容
  另一个终端在该频道发布消息

```
# 终端1
> PUBLISH chan1 hello
# 终端2
1) "message"
2) "chan1"
3) "hello"
```

- **unsubscribe**：表示成功取消订阅某个频道。此时第二个值为对应频道名，第三个值为当前频道数量。

```
# 频道2
> UNSUBSCRIBE chan1
1) "unsubscribe"
2) "chan1"
3) (integer) 0
```

`unsubscribe`命令可退订频道，若不指定频道则退订所有频道

**按照规则订阅**
使用`psubscribe`订阅符合指定规则的频道。规则支持 glob 风格的通配符。

```
# 频道2
> PSUBSCRIBE chan*
Reading messages... (press Ctrl-C to quit)
1) "psubscribe"
2) "chan*"
3) (integer) 1
# 频道1
> PUBLISH chan2 hello
> PUBLISH chan100 hello
# 频道2
1) "pmessage"
2) "chan*"
3) "chan2"
4) "hello"
1) "pmessage"
2) "chan*"
3) "chan100"
4) "hello"
```

频道 2 收到了任意以`chan`开头的频道的信息
第一个值：表示该信息的通过`psubscribe`命令订阅得到的
第二个值：订阅使用的通配符
第三个值：收到消息的具体频道名
第四个值：收到的消息内容

`punsubscribe`命令可退订规则，若不指定频道则退订所有规则，且只会退订由规则加入的频道，并不会退订`subscribe`加入的频道。退订的规则必须严格匹配，与订阅时的一致。

发布订阅存在的问题：

- 如果订阅者读取消息的速度很慢，会使得消息不断积压在发布者的输出缓存区中，造成内存占用过多；
- 如果订阅者在执行订阅的过程中网络出现问题，那么就会丢失断线期间发送的所有消息。

# 事务

事务的原理是先将属于一个事务的命令发送给 Redis，使 Redis 依次执行这些命令。

使用`multi`开启事务，之后的所有操作都属于该事务，直到提交`exec`，在事务中若有失误，可通过`discard`回滚，取消事务中所有操作。使用事务可保证一个事务内不会有其他的客户端的命令的插入。

```
> set num1 11
OK
> set num2 abc
OK
> set num3 111
OK
> MULTI
OK
> incr num1
QUEUED
> incr num2
QUEUED
> incr num3
QUEUED
> exec
1) (integer) 12
2) (error) ERR value is not an integer or out of range
3) (integer) 112
```

可见，事务中若有错误命令，仅会影响该命令，不会影响接下来的命令的执行。

事务的所有操作都是在事务提交时操作并一起返回值的，而有时需要先获得一条命令的返回值，再根据这个值执行下一条命令，即前一条命令的返回值需要作为后一条命令的参数。于是需要另一条命令`watch`，用于监视一个或多个键，一旦其中一个键被修改了，之后的事务都不会执行，监控一直持续到事务提交

```
> set key 1
OK
> watch key
OK
> set key 2     # 由于这里key被修改，于是之后的事务不会执行
OK
> multi
OK
> incr key
QUEUED
> exec
(nil)
> get key
"2"

# 若在开启监视后，事务开启前，该键未被修改，则事务中对该键的操作仍有效
> set key 1
OK
> watch key
OK
> multi
OK
> incr key
QUEUED
> exec
1) (integer) 2
```

在执行`exec`后会取消对所有键的监视，若不想在执行事务中的命令也可使用`unwatch`命令取消监控。

# 过期时间

在实际开发中会遇到有时效的数据，过了一定时间就应该清除，在 Redis 中可使用`expire`设置一个键的过期时间，到达该时间后 Redis 会自动删除该键。
`expire <key> <time> （时间单位：秒，且必须是整数）`
返回值为 1 表示设置成功，0 表示未成功或键不存在。

若要设置更加精确的时间，可用命令`pexpire`，单位：毫秒。
可使用`ttl`命令查看指定键的剩余时间。若该键被删除了，则返回值为-2，若未设置该键的过期时间，，则返回-1。
可使用`persist <key>`命令取消设置指定键的过期时间，成功则返回 1，否则（键不存在，或键原来就没有过期时间设置）返回 0。

**注：**`set`或`getset`命令对键重新赋值也会清除过期时间。

若`watch`监视一个没有过期时间的键，该键到期自动删除后并不会被`watch`认为该键被修改。

命令`expireat <key> <time>` 用 Unix 时间作为过期时间（1970 年 1 月 1 日到现在的秒数）
命令`pexpireat <key> <time>`同上，但单位为毫秒

当 Redis 用作缓存系统时，可以限制 Redis 能够使用的最大内存，并让 Redis 按照一定规则淘汰不需要的缓存键。
修改配置文件`maxmemory`参数，限制最大可用内存大小（单位：字节）。当超出限制后，Redis 会根据`maxmemory-policy`参数指定的策略删除键直到 Redis 占用的内存小于指定内存。

以下为 Redis 提供的策略规则：

| 规则名          | 作用                                                    |
| --------------- | ------------------------------------------------------- |
| volatile-lru    | 使用 LRU 算法删除一个键（只对设置了过期时间的键起作用） |
| allkeys-lru     | 使用 LRU 算法删除一个键（会不断删除）                   |
| volatile-random | 随机删除一个键（只对设置了过期时间的键起作用）          |
| allkeys-random  | 随机删除一个键                                          |
| volatile-ttl    | 删除过期时间最近的一个键                                |
| noeviction      | 不开启策略                                              |

> LRU 算法：Least Recently Used 最近最少使用。该算法认为最近最少使用的键在未来一段时间内也不会被用到，即当需要空间时这些键是可以被删除的。

**注：**实际上，Redis 不会准确将整个数据库中最久未使用的键删除，而是每次从数据库中随机取 5 个键（可修改）并删除其中最久未被使用的键。随机取的键个数可通过配置文件的`maxmemory-samples`参数设置。默认为 5 个能产生最优的结果。10 个最接近 LRU 算法的要求，但会消耗更多的 CPU 资源。3 个会更快，但并不准确。

# 持久化

redis 为了内部数据安全考虑，会把数据以文件形式保存一份在硬盘中，服务器重启后会自动将数据还原到内存中，将数据保存到硬盘称为持久化。
持久化分为以下两种：

- 快照持久化（snap shotting），也称 RDB
- AOF 持久化（append only file）

**RDB**
默认开启，一次性将所有数据保存在硬盘中，整个数据库只保存为一个文件，便于数据迁移，也便于数据库毁坏后的恢复。
在开始初始化时，唯一要做到的只是 fork 出子进程，再由子进程完成持久化工作，极大避免了服务进程执行 IO 操作，而父进程仍然处理客户端的请求，实现性能最大化。相较于 AOF，若数据集很大，RDB 的启动效率会很高。

**若要保证数据的高可用性，最大限度避免数据丢失，则不宜选择 RDB。因为依靠子进程完成持久化，所以当数据集较大时，可能会导致整个服务器延时增大。**

写时复制策略保证了在 fork 的时刻虽然生成了两份内存副本，但内存的占用量并不会增加一倍，因此需要确保 linux 系统允许应用申请超过可用内存的空间。可通过`/etc/sysctl.conf`中修改`vm.overcommit_memory`参数为 1。

当快照时，若写入操作交到，造成 fork 前后差异较大，是会使内存使用量显著超过实际数据大小的，因为内存不仅保存了当前数据库数据，还保存了快照时的内存数据。

**快照方式**

- **根据配置规则自动进行快照**
  redis 目录中的 dump.rdb 就是快照持久化的数据备份文件。
  配置文件`/etc/redis.conf`的 RDB 参数

```
# 设置备份频率
save 900 1     # 900秒中有一个键发生变化就触发RDB备份
save 300 10    # 300秒中有10个键发生变化就触发RDB备份
save 60 10000  # 60秒中有10000个键发生变化就触发RDB备份

dbfilename dump.rdb  # 备份数据库文件名
dir ./               # 备份数据库文件存放位置
```

在 RDB 中可实现精细持续化，将每个修改的键保存，频率可达到秒级。

只有当快照结束时，新的 rdb 文件才会覆盖旧的文件，而在备份过程中，redis 是不会修改原 rdb 文件的，即任何时刻 rdb 文件都是完整的。于是可通过定时备份 rdb 文件实现 redis 数据库备份。
rdb 文件是经过压缩的二进制格式，
可通过配置文件的`rdbcompression yes`参数禁用来压缩节省 CPU 占用。

Redis 启动后会读取 RDB 文件，将数据从硬盘载入内存。通常一个记录 1000 万个字符串类型键、大小为 1GB 的快照文件载入到内存中需要花费 20-30 秒。

- **使用`save`或`bgsave`命令快照**
  `save`命令：Redis 会同步进行快照，快照时会自动阻塞所有来自客户端的请求。若数据量大会导致 Redis 长时间无法访问，在生产环境中尽量不要用。
  `bgsave`命令：推荐使用，可在后台异步快照，快照时 Redis 仍能响应客户端请求。可通过`lastsave`命令查看快照是否完成，返回 unix 时间戳。

- **执行`flushall`命令**
  Redis 会清空数据库中所有数据。无论清空数据库过程中是否触发了自动快照条件，只要自动快照条件不为空，redis 就会执行一次快照。若未指定自动快照条件，则`flushall`并不会执行快照。

- **执行复制（replication）时**
  当设置了主从模式时，Redis 会在复制初始化时自动执行快照，并生成 RDB 文件，并不需要定义快照条件或手动执行。

**AOF**
将用户执行的写指令都备份到日志文件中，还原数据就是执行写指令。AOF 可带来更高的数据安全性，即持久性。
**注：开启 AOF 持久化会清空 redis 数据库所有数据，所以若要选择 AOF 持久化，应该在安装完 redis 服务器后就要立刻开启。**

Redis 有三种同步策略：每秒同步，每修改同步，不同步。

- 每秒同步为异步持久化，效率高。若服务器突然宕机，则在这一秒中的数据会丢失。
- 每修改同步为同步持久化，每次数据发生变化就会立刻记录到磁盘中，效率低。

该机制对日志文件的写入操作采用 append 模式，即使在写入过程中出现宕机，也不会破坏日志中已写入的数据，在 Redis 重启后可通过命令`redis-check-aof`解决数据一致性问题。
当日志过大时，Redis 会自动启用重写 rewrite 机制，以 append 模式不断将修改数据写入老磁盘文件，并会创建一个新文件用于记录期间哪些修改命令被执行，保证了数据持久性。

对于相同数量的数据集，AOF 文件通常比 RDB 文件大。AOF 的运行效率通常慢于 RDB，但其中每秒同步的效率较高。

配置文件`/etc/redis.conf`的 AOF 参数

```
# 若要开启AOF，将此项改为yes
appendonly no

# 还可设置AOF的备份文件位置
appendfilename appendonly.aof

# 设置同步机制，三种机制always，everysec，no。
# always：每修改同步
# everysec：每秒同步，默认
# no：同步禁用
appendfsync everysec
```

AOF 是将 Redis 客户端向 Redis 发送的所有命令全部记录下来，这就造成了有很多冗余无用的命令，如`SELECT`等也会记录，随着执行命令的增多，AOF 文件的大小也会逐渐增大。
因此，Redis 提供了优化策略，可在配置文件中修改以下两个参数：
`auto-aof-rewrite-percentage 100`：设置当目前 AOF 文件的大小超过上一次 AOF 文件大小的指定百分比时就会再次进行重写，若之前未重写过，则会根据启动时的 AOF 文件大小作依据。
`auto-aof-rewrite-min-size 64mb`：限制允许重写的最小 AOF 文件大小。

若不满足重写条件，可通过命令`bgrewriteaof`手动重写。

# Redis 优化技术

## 管道

客户端使用 TCP 与服务器建立连接，若执行较多的命令，每个命令的往返时延累加起来对性能有一定的影响。在执行多个命令时每条命令都需要等待上一条命令执行完（即收到 Redis 的返回结果）才能执行。
Redis 支持管道（pipelining），可一次性发送多条命令并在执行后一次性返回结果。通过减少客户端与服务器的通信次数来实现降低往返时累计值。
**注：**每一组中的命令都不能依赖之前命令的执行结果。

## 内部编码优化

Redis 为每种数据类型都提供了两种内部编码的方式，并且会自动根据实际情况进行编码的转变，对于开发者而言是透明的。其中一种为复杂度是 O(1)的编码，而当键的元素个数大时，变会采用复杂度为 O(n)的编码。
可通过`object encoding <key>`查看指定键的编码方式。

Redis 的每个键值都是使用一个 redisObject 的结构体保存的。

```c
typedef struct redisObject {
    unsigned type:4;
    unsigned notused:2;  # not used
    unsigned encoding:4;
    unsigned lru:22;     # lru时间
    int refcount;        # 存储某个键值被引用的数量
    void *ptr;
}robj;
```

每个数据类型的编码

| 数据类型 | 内部编码方式              | object encoding 命令结果 |
| -------- | ------------------------- | ------------------------ |
| 字符串   | REDIS_ENCODING_RAW        | "raw"                    |
|          | REDIS_ENCODING_INT        | "int"                    |
|          | REDIS_ENCODING_EMBSTR     | "embstr"                 |
| 散列     | REDIS_ENCODING_HT         | "hashtable"              |
|          | REDIS_ENCODING_ZIPLIST    | "ziplist"                |
| 列表     | REDIS_ENCODING_LINKEDLIST | "linkedlist"             |
|          | REDIS_ENCODING_ZIPLIST    | "ziplist"                |
| 集合     | REDIS_ENCODING_HT         | "hashtable"              |
|          | REDIS_ENCODING_INTSET     | "intset"                 |
| 有序集合 | REDIS_ENCODING_SKIPLIST   | "skiplist"               |
|          | REDIS_ENCODING_ZIPLIST    | "ziplist"                |

> EMBSTR 字符串编码方式与 RAW 类似，都是基于 sdshdr 实现。

- 字符串类型
  Redis 使用`sdshdr`类型变量存储
  一个键值能被多个键引用，Redis 会预先建立 10000 个分别存储从 0 到 9999 的 redisObject 型的变量对象，若设置的键值在 10000 以内，则该键就会直接引用这个共享对象，并不会再建立一个 redisObject 对象了。

> 当配置文件设定了`macmemory`Redis 可用最大空间后，就不会使用共享对象，因为对于每个键值都需要使用一个 redisObject 记录 LRU 信息

# 集群

Redis 集群主要用于防止单点故障，以及解决存储、性能瓶颈问题。

## 复制（主从）

Redis 提供的复制功能，可实现当一台数据库中的数据更新后，自动将更新的数据同步到其他数据库上。因此，将数据库分为主数据库（master）与从数据库（slave）。
主数据库可进行读写操作，当数据更新时将更新的数据同步到从数据库。而从数据库一般为只读操作，接收主数据库的同步数据。一个从数据库只能有一个主数据库。从数据库默认只读，若创建键会报错。

在一台主机上模拟主从数据库
首先启动主数据库`redis-server /etc/redis.conf`
然后可直接通过命令`redis-server --port 6666 --slaveof 127.0.0.1 6379`再打开一个数据库，并作为从数据库
连接到从数据库`redis-cli -p 6666`并执行`INFO replication`，查看从数据库的信息

```
> INFO replication
# Replication
role:slave
master_host:127.0.0.1
master_port:6379
master_link_status:up
......
```

在主数据库上创建键，在从数据库上就能得到该键了。

```
127.0.0.1:6379> set key1 123
127.0.0.1:6666> get key1
"123"
```

也可通过修改数据库的配置文件将该数据库设为从数据库
在 redis**从服务器**上修改配置文件参数
`bind <主服务器IP>`
`slaveof <主服务器IP> <主服务器端口>`
主数据库上不需要任何配置。

还可在一个已开启的数据库中输入命令`slaveof <ip-addr> <port>`将本数据库设为指定主数据库的从数据库。若该数据库已是其他数据库的从数据库了，则这条命令会取消与原主数据库的同步，而与新指定的主数据库同步。还可通过命令`slaveof no one`使当前数据库停止接收主数据库同步，并转变为主数据库。

主从同步流程：

1. 当一个从数据库启动后，会向主数据库发送 SYNC 命令。
2. 主数据库收到 SYNC 后，会在后台保存 RDB 快照，并将快照与缓存的命令都发送给从数据库。
3. 从数据库收到后载入快照，并将执行缓存命令。
   **1 到 3 步称为复制初始化**
4. 复制初始化完成后，主数据库每当收到写命令后就会将命令同步到从数据库。

当主从数据库断开连接并重连后，Redis 提供有条件的增量数据传输，主数据库只需将断线期间执行的命令传送给从数据库即可。

试验同步：
先使用 telnet 伪装成一个从数据库与主数据库通信

```
# telnet 127.0.0.1 6379
Trying 127.0.0.1...
Connected to 127.0.0.1.
```

然后在从数据库中使用`ping`确认与主数据库的连接，若正常则主数据库会返回`PONG`。
再输入`REPLCONF listening-port 6666`说明自己端口号。
开始同步`SYNC`，此时 telnet 的界面会出现以下信息

```
* Slave 127.0.0.1:6666 asks for synchronization
* Starting BGSAVE for SYNC with target: disk
* Background saving started by pid 4079
* DB saved on disk
* RDB: 6 MB of memory used by copy-on-write
* Background saving terminated with success
* Synchronization with slave 127.0.0.1:6666 succeeded
```

默认从数据库会使用同步前的数据响应客户端请求，可以在从数据库上修改配置文件参数`slave-serve-stale-data`为 no，使从数据库再同步完成前对所有命令都返回错误（除`INFO`和`SLAVEOF`）。
复制同步阶段会贯穿整个主从同步始终，直到主从关系终止。

**乐观复制：**允许一定时间内主从数据库的内容不一致，但最终是会同步的。主从数据库的数据同步是异步的，会产生主从数据库数据不一致的时间窗口（即网络传输的时间加上命令执行的时间），因此，主数据库是不知道命令最终同步给多少个数据库的。Redis 提供配置文件参数限制至少同步给的从数据库的数量时，主数据库才是可写的。
`min-slaves-to-write 3` 表示有 3 个以上的从数据库连接到主数据库时，主数据库才是可写的。
`min-slaves-max-lag 10` 表示允许从数据库失去与主数据库连接的最长时间。若从数据库最后一次与主数据库的联系（即发送`replconf ack`命令）的时间小于该值，则认为从数据库仍与主数据库连接，否则就断开主从连接。这一特性默认关闭。

**图结构：从数据库不仅能从主数据库接收同步数据，还能再以自身作为主数据库，将数据再同步给下属的从数据库。**

通过复制可实现读写分离，提高负载能力。往往读的频率大于写的频率，当单机的 Redis 无法应对大量读请求时，可通过复制建立多个从数据库节点，主数据库只进行写操作，从数据库负责读操作。

**从数据库的持久化**
可通过复制建立一个或多个从数据库，并在从数据库启动持久化，在主数据库禁用持久化。
当**从数据库**崩溃重启后主数据库会自动同步数据。
当**主数据库**崩溃后则需要按照以下步骤进行恢复。

```
1. 在从数据库中使用命令slaveof no one将从数据库提升为主数据库继续对外提供服务
2. 启动崩溃的主数据库，再使用slaveof将其设置为新的主数据库的从数据库，再将数据进行同步。
```

> 当开启复制且主数据库关闭持久化功能时，不要使用 supervisor 等进程管理工具使主数据库崩溃后自动重启。同样当主数据库所在服务器因故关闭时，也要避免直接重启。
> 因为主数据库重启后没有开启持久化功能，所以主数据库中所有数据都会被清空，而从数据库又会与从主数据库中同步数据，导致从数据库所有数据也被清空。

## 无硬盘复制

Redis 的复制是基于 RDB 方式持久化实现的，即主数据库端在后台保存 RDB 快照，从数据库接收并载入快照文件。
缺点：

1. 当主数据库禁用 RDB 快照后，如果执行复制初始化，Redis 依然会生成 RDB 快照，所以下次启动后主数据库会以该快照恢复数据。**因为复制发生的时间不能确定，这使得恢复的数据可能是任何时间点的。**
2. 因为复制初始化时需要在硬盘中创建 RDB 快照文件，所以如果硬盘性能很慢（如网络硬盘）时这一过程会对性能产生影响。
   举例来说，当使用 Redis 做缓存系统时，因为不需要持久化，所以服务器的硬盘读写速度可能较差。但是当该缓存系统使用一主多从的集群架构时，每次和从数据库同步，Redis 都会执行一次快照，同时对硬盘进行读写，导致性能降低。

因此 Redis 引入了无硬盘复制选项，开启该选项时，Redis 在**与从数据库进行复制初始化时将不会将快照内容存储到硬盘上，而是直接通过网络发送给从数据库**，避免了硬盘的性能瓶颈。

可修改配置文件中`repl-diskless-sync`参数为 yes 开启。

## 增量复制

场景：当主从数据库连接断开后，从数据库会发送 SYNC 命令来重新进行一次完整复制操作。虽然断开期间数据库的变化很小，但也需要将数据库中的所有数据重新快照并传送一次。因此 Redis 实现了主从断线重连的情况下的增量复制。

增量复制是基于如下 3 点实现的。

1. 从数据库会存储**主数据库的运行 ID（run id）**。每个 Redis 运行实例均会拥有一个唯一的运行 ID，每当实例重启后，就会自动生成一个新的运行 ID。
2. 在复制同步阶段，**主数据库每将一个命令传送给从数据库时，都会同时把该命令存放到一个积压队列（backlog）中**，并记录下当前积压队列中存放的命令的偏移量范围。
3. 同时，从数据库接收到主数据库传来的命令时，会记录下该命令的偏移量。

当主从连接准备就绪后，从数据库会发送一条 PSYNC 命令来告诉主数据库可以开始把所有数据同步过夹了，格式为`PSYNC 主数据库的运行ID断开前最新的命令偏移量`。主数据库收到 PSYNC 命令后，会执行以下判断来决定此次重连是否可以执行增量复制。

1. 首先主数据库会判断从数据库传送来的运行 ID 是否和自己的运行 ID 相同，确保从数据库之前确实是和自己同步的。
2. 然后判断从数据库最后同步成功的备今信移景是否在积压队列中，如果在则可以执行增量复制，并将积压队列中相应的命令发送给从数据库。
   如果此次重连不满足增量复制的条件，主数据库会进行一次全部同步。

增量复制的过程对开发者来说是完全透明的，唯一需要开发者设置的就是积压队列的大小了。主数据库可以正常地和旧版本的从数据库同步（通过接收 SYNC 命令），从数据库也可以与旧版本的主数据库同步（通过发送 SYNC 命令）。
积压队列在本质上是一个固定长度的循环队列，默认情况下积压队列的大小为 1MB，可以通过配置文件的`rep1-backlog-size`选项来调整。积压队列越大，其允许的主从数据库断线的时间就越长。
根据主从数据库之间的网络状态，设置一个合理的积压队列很重要。因为积压队列存储的内容是命令本身，所以估算积压队列的大小只需估计主数据库可能执行的命令的大小即可。另一个配置参数是`rep1-backlog-ttl`，当所有从数据库与主数据库断开连接后，经过多久时间可以释放积压队列的内存空间，默认为 1 小时。

## 哨兵

Redis 提供哨兵实现自动化的系统监控和故障恢复功能，哨兵是一个独立的进程。
哨兵有以下功能：

1. 监控主数据库和从数据库是否正常运行。
2. 主数据库出现故障时自动将从数据库转换为主数据库。

在一个主从 Redis 系统中，可使用多个哨兵进行监控任务以保证系统足够稳健。哨兵不仅能监控主从数据库，还能与其他哨兵互相监控。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120048364.png)

哨兵实验

```
实验环境：system2 192.168.163.102
主服务器：127.0.0.1 6379
redis-server /etc/redis.conf

从服务器：127.0.0.1 6380 6381
redis-server --port 6380 --slaveof 127.0.0.1 6379
redis-server --port 6381 --slaveof 127.0.0.1 6379

127.0.0.1:6379> info replication
# Replication
role:master
connected_slaves:2
slave0:ip=127.0.0.1,port=6380,state=online,offset=266,lag=0
slave1:ip=127.0.0.1,port=6381,state=online,offset=266,lag=0

设置哨兵
创建配置文件/etc/sentinel.conf，并添加以下内容：
sentinel monitor MyMaster_1 127.0.0.1 6379 1
sentinel monitor master-name ip port quoram
# MyMaster_1为要监视的主数据库的名字，可自定义
# 后面跟上主数据库的IP地址和端口号
# 最后一个数字quoram表示最低通过票数

# 配置哨兵时，只需要配置监视的主数据库即可，哨兵会自动发现主数据库下的所有从数据库。

然后启动Sentinel进程
redis-sentinel /etc/sentinel.conf
启动哨兵后会报如下信息
Sentinel ID is 33766bbd6ec93b3574240b6a4ac5c8ea498207d4
+monitor master MyMaster_1 127.0.0.1 6379 quorum 1
* +slave slave 127.0.0.1:6380 127.0.0.1 6380 @ MyMaster_1 127.0.0.1 6379
* +slave slave 127.0.0.1:6381 127.0.0.1 6381 @ MyMaster_1 127.0.0.1 6379

# +slave表示发现了从数据库
然后在另一个终端中关闭主数据库
在原终端中会出现一连串的以下信息
* Connecting to MASTER 127.0.0.1:6379
* MASTER <-> SLAVE sync started
Error condition on socket for SYNC: Connection refused

在过了一段时间（默认30s，可配置修改）后，会出现以下信息
+sdown master MyMaster_1 127.0.0.1 6379
+odown master MyMaster_1 127.0.0.1 6379 #quorum 1/1

# +sdown 表示哨兵主观认为主数据库停止服务了
# +odown 表示哨兵客观认为主数据库停止服务了
# 此时哨兵执行故障恢复，挑选一个从数据库提升为主数据库
然后会报出许多信息，下面列举出几条重要的信息
+try-failover master MyMaster_1 127.0.0.1 6379
+vote-for-leader 33766bbd6ec93b3574240b6a4ac5c8ea498207d4 1
......
+failover-end master MyMaster_1 127.0.0.1 6379
+switch-master MyMaster_1 127.0.0.1 6379 127.0.0.1 6380
+slave slave 127.0.0.1:6381 127.0.0.1 6381 @ MyMaster_1 127.0.0.1 6380
+slave slave 127.0.0.1:6379 127.0.0.1 6379 @ MyMaster_1 127.0.0.1 6380

# +try-failover 表示哨兵开始故障恢复
# +failover-end 表示哨兵完成故障恢复，故障恢复步骤包括领头哨兵选举、备份从数据库的选择等
# +switch-master 表示主数据库从6379端口迁移到6380，即6380端口的从数据库提升为主数据库
# 两个+slave，原主数据库变为了现主数据库的从数据库，但此时6379的数据库并未启动，说明哨兵并不会清除已停止服务的实例的信息

再次登录上127.0.0.1:6380
127.0.0.1:6380> info replication
# Replication
role:master
connected_slaves:1
slave0:ip=127.0.0.1,port=6381,state=online,offset=99027,lag=1
# 因为6379端口数据库未启动，所以此时只有一个从数据库
然后重启6379端口数据库
-sdown slave 127.0.0.1:6379 127.0.0.1 6379 @ MyMaster_1 127.0.0.1 6380
+convert-to-slave slave 127.0.0.1:6379 127.0.0.1 6379 @ MyMaster_1 127.0.0.1 6380

# -sdown 表示实例6379已恢复服务（与+sdown相反）
# +convert-to-slave 表示将6379端口实例设置为6380端口实例的从数据库。
在6379端会报以下信息：
SLAVE OF 127.0.0.1:6380 enabled
再在6380端查看
127.0.0.1:6380> info replication
# Replication
role:master
connected_slaves:2
slave0:ip=127.0.0.1,port=6381,state=online,offset=541686,lag=0
slave1:ip=127.0.0.1,port=6379,state=online,offset=541686,lag=0
```

一个哨兵节点可同时监控多个 Redis 主从系统，只要提供多个 sentinel monitor 配置即可。多个哨兵节点也可监控一个主从系统。

sentinel.conf 配置文件的其他配置

```
# sentinel down-after-milliseconds 主数据库名 值
# 这条参数用于设置哨兵发送ping命令检测数据库节点状态的周期时间，单位为毫秒
```

当超过该参数时间而未收到回复后，则哨兵认为该节点主观下线。若该节点为主数据库，则哨兵会进一步判断是否需要故障恢复。哨兵会向其他节点发送`sentinel is-master-down-by-addr`命令询问其他节点是否他们也认为主数据库主观下线，当赞同的节点达到指定数目后，哨兵会认为主数据库客观下线，并进行故障恢复。这个指定数目就是`sentinel.conf`中`sentinel monitor`最后一项数值 quoram。

哨兵启动后，会与要监控的主数据库建立两条连接。一条连接用来订阅该主数据的`_sentinel_:he11o`频道以获取其他同样监控该数据库的哨兵节点的信息，另外哨兵也需要定期向主数据库发送 INFO 等命令来获取主数据库本身的信息。

哨兵创建后与立刻做的事情：
发送 INFO 命令获得**当前数据库**的相关信息（包括运行 ID、复制信息等）从而实现新节点的自动发现。哨兵向主数据库发送 INFO 命令，通过解析返回结果来得知从数据库列表，而后对每个从数据库同样建立两个连接。至此，与主数据库的连接建立成功。

和主数据库的连接建立完成后，哨兵会定时执行下面 3 个操作。

1. 每 10 秒哨兵会向主数据库和从数据库发送 INFO 命令。
2. 每 2 秒哨兵会向主数据库和从数据库的`_sentinel_:hel1o`频道发送自己的信息。
   发送的消息内容为：`<哨兵IP>，<哨兵port>，<哨兵运行ID>，<哨兵配置版本>，<主数据库名>，<主数据库IP>，<主数据库port>，<主数据库配置版本>`
3. 每 1 秒哨兵会向主数据库、从数据库和其他哨兵节点发送 PING 命令。

选举领头哨兵的过程使用了 Raft 算法，过程如下：

1. 发现主数据库客观下线的哨兵节点向每个哨兵节点发送命令，要求对方选自己为领头哨兵。
2. 如果目标哨兵节点没有选过其他人，则会同意将该节点设为领头哨兵。
3. 如果该节点发现有超过半数且超过该数值的哨兵节点同意选自己为领头哨兵，则此节点会成功成为领头哨兵。
4. 当有多个哨兵节点同时参选领头哨兵，会出现没有一个节点当选的情况。此时参选节点会等待一个随机时间重新发起参选请求，进行下一轮直到选举成功。

故障恢复过程：

1. 领头哨兵会从从数据库中挑选一个作为新的主数据库。
   挑选的依据分为三点：
   - 所有在线的从数据库中选择优先级最高的，优先级可通过配置文件`slave-priority`参数设置
   - 若有多个最高优先级的从数据库，则复制的命令偏移量大的优先
   - 若上述都相同，则运行 ID 小的优先
2. 选出符合的从数据库后，会向该数据库发送`slaveof no one`使其提升为主数据库，然后再向其他数据库发送`slaveof`使其成为新的主数据库的从数据库。最后再更新数据记录，原的主数据库变为从数据库。

哨兵的部署方案：

- 每个节点部署一个哨兵
- 每个哨兵与其对应节点网络环境相同或相近

这样可以保证哨兵的视角具有代表性和可靠性。最好将 quoram 的值设为 N/2+1（N 为哨兵节点个数）。若每个节点都部署一个哨兵的话，可能会因为 Redis 不支持连接复用而造成产生大量冗余连接。

## 集群

集群往往用于水平扩容。
若要开启集群，只要将配置文件的`cluster-enabled`参数设为 yes 即可，默认开启。每个集群至少需要三个主数据库。

集群实验

```
实验环境
6个数据库，3个主数据库，3个从数据库
三个主数据库端口分别为6000，6001，6002
三个从数据库端口分别为6003，6004，6005
```

集群会将当前节点记录的集群状态持久化到指定文件，默认为当前目录下的`nodes.conf`，这里还是存放在/etc/nodes.conf，每个节点对应的文件必须不同，否则会启动失败，因此启动节点时要注意最后为每个节点使用不同的工作目录，或通过配置文件`cluster-config-file 节点文件路径`修改。
最好给每个节点都创建一个目录，然后每个节点都复制一份配置文件，并修改`port`参数，`cluster-config-file`参数。然后通过`redis-server 配置文件`启动。使用`ps`查看，每个节点都是显示类似`redis-server *:6000 [cluster]`。
然后进入节点

```
127.0.0.1:6000> info cluster
# Cluster
cluster_enabled:1    # 1说明集群启动正常
```

目前仅仅节点运行正常，但并未加入集群。需要使用 redis 的 ruby 插件。
首先需要安装 ruby，最好不要 yum 安装，应该下最新版本的源码包编译安装。安装完后可以在`/usr/local/redis/src/`目录下找到`redis-trib.rb`命令，创软链接。
然后使用该命令初始化集群

```
redis-trib.rb create --replicas 1 \
    127.0.0.1:6000 \
    127.0.0.1:6001 \
    127.0.0.1:6002 \
    127.0.0.1:6003 \
    127.0.0.1:6004 \
    127.0.0.1:6005
# --replicas 1 表示每个主数据库拥有的从数据库个数为1

会出现以下信息：
>>> Creating cluster
>>> Performing hash slots allocation on 6 nodes...
Using 3 masters:
127.0.0.1:6000
127.0.0.1:6001
127.0.0.1:6002
Adding replica 127.0.0.1:6004 to 127.0.0.1:6000
Adding replica 127.0.0.1:6005 to 127.0.0.1:6001
Adding replica 127.0.0.1:6003 to 127.0.0.1:6002
......
Can I set the above configuration? (type 'yes' to accept):
确认输入yes创建集群
```

通过`redis-trib.rb`创建集群的过程：

1. 首先该命令会以客户端形式尝试连接所有节点，并发送 ping 确定节点正常，同时发送`info`获取节点运行 ID、验证是否开启了集群
2. 集群会向每个节点发送`cluster meet IP地址 端口`告诉当前节点指定的节点也是集群成员。
3. `redis-trib.rb`会分配主从数据库节点，分配原则为尽量保证每个主数据库运行在不同 IP 地址上，同时每个从数据库和主数据库都不运行在同一 IP 地址。
4. 分配完成后，会为主数据库分配插槽，即分配哪些键归哪些节点复制。对每个要成为子数据库的节点发送`cluster replicate 主数据库运行ID`将当前节点转换为从数据库并复制指定主数据库。

```
127.0.0.1:6000> CLUSTER nodes
5c15caa067f96e557d73704e961ee08504fe3ac1 127.0.0.1:6004@16004 slave b098c2ddc169cc6e5411e8c42fb5afa96fa91764 0 1531150828178 5 connected
6808731e0d12e8ec740509ef060c81306d5cd9bd 127.0.0.1:6000@16000 myself,master - 0 1531150825000 1 connected 0-5460
8e885e28b530491468b76bb8084cf7c22a8166f4 127.0.0.1:6005@16005 slave 9de0340daaf29f81b32c96d8010e9e443d66be0b 0 1531150827000 6 connected
b098c2ddc169cc6e5411e8c42fb5afa96fa91764 127.0.0.1:6001@16001 master - 0 1531150825153 2 connected 5461-10922
e219bc21f1ab59f4cf00ca1b35da84e955424556 127.0.0.1:6003@16003 slave 6808731e0d12e8ec740509ef060c81306d5cd9bd 0 1531150827000 4 connected
9de0340daaf29f81b32c96d8010e9e443d66be0b 127.0.0.1:6002@16002 master - 0 1531150827169 3 connected 10923-16383
```

可通过`cluster meet IP地址 端口`向新节点发送使新节点加入集群
当新节点收到该命令后，会根据命令中的 IP 地址和端口与目标建立握手连接，然后目标会认为此节点为集群中的一员，并使用 Gossip 协议（一种分布式系统通信协议）向集群中所有节点发送此节点的信息。

新节点加入集群后可进行以下操作：

- 使用`cluster replicate`复制每个主数据库，以从数据库运行
- 向集群申请分配插槽（slot）以主数据库运行

在一个集群中，所有键会被分配给 16384 个插槽，每个主数据库会负责处理其中一部分插槽。

```
确认创建集群后的报出的信息
>>> Performing Cluster Check (using node 127.0.0.1:6000)
M: 6808731e...... 127.0.0.1:6000
   slots:0-5460 (5461 slots) master
   1 additional replica(s)
S: 5c15caa0...... 127.0.0.1:6004
   slots: (0 slots) slave
   replicates b098c2d......
S: 8e885e28...... 127.0.0.1:6005
   slots: (0 slots) slave
   replicates 9de0340......
M: b098c2dd...... 127.0.0.1:6001
   slots:5461-10922 (5462 slots) master
   1 additional replica(s)
......
由此也可看出，只有主数据库才会分配插槽，从数据库无插槽。
```

初始化集群时分配给每个节点的插槽是连续的，但实际上 Redis 没有限制，可将任意几个插槽分配给任意节点。

键与插槽的关系
键名的有效部分通过算法计算出散列值并取 16384 的余数。使得每个键都可以分配到 16384 个插槽中，进而分配的指定的一个节点中处理。

> 有效部分：若键名包含大括号，则有效部分为大括号内的内容，若不包含大括号，则整个键名都是有效部分

```
可使用命令cluster slots查看插槽分配情况
127.0.0.1:6000> CLUSTER SLOTS
1) 1) (integer) 0
   2) (integer) 5460
   3) 1) "127.0.0.1"
      2) (integer) 6000
      3) "6808731e0d12e8ec740509ef060c81306d5cd9bd"
   4) 1) "127.0.0.1"
      2) (integer) 6003
      3) "e219bc21f1ab59f4cf00ca1b35da84e955424556"
2) 1) (integer) 5461
   2) (integer) 10922
   3) 1) "127.0.0.1"
      2) (integer) 6001
      3) "b098c2ddc169cc6e5411e8c42fb5afa96fa91764"
   4) 1) "127.0.0.1"
      2) (integer) 6004
      3) "5c15caa067f96e557d73704e961ee08504fe3ac1"
3) 1) (integer) 10923
   2) (integer) 16383
   3) 1) "127.0.0.1"
      2) (integer) 6002
      3) "9de0340daaf29f81b32c96d8010e9e443d66be0b"
   4) 1) "127.0.0.1"
      2) (integer) 6005
      3) "8e885e28b530491468b76bb8084cf7c22a8166f4"

因为有3个master，所以有三条记录，每条记录中包含四个值：
1) 插槽的开始号
2) 插槽的结束号
3) 所有负责该插槽的节点（第一个是主数据库，后面都是从数据库）。包含以下内容：
   1) 节点的IP地址
   2) 节点端口号
   3) 节点运行ID
```

插槽的分配的情况

1. 插槽之前没被分配过，现在想分配给指定节点
2. 插槽之前被分配过，现在想移动到指定节点

将插槽分配给节点的过程

1. 若是上述的第一种情况，即插槽未被分配过。使用`cluster addslots [插槽号]....`可分配多个插槽。
   若被分配过则会报错`(error) ERR Slot 100 is already busy`
2. 若是第二种情况，即插槽被分配过。redis-trib.rb 提供简便迁移方法
   `redis-trib.rb reshard 目标IP地址:端口`
   其中`reshard`表示需要重新分片。

```
目标：将6000端口的插槽分1000个到6001端口
redis-trib.rb reshard 127.0.0.1:6000

# 然后会询问要迁移的插槽个数
How many slots do you want to move (from 1 to 16384)? 1000

# 询问要迁移到的节点ID（redis-trib.rb会给出，也可以进入数据库cluster nodes查看）
What is the receiving node ID? b098c2ddc169cc6e5411e8c42fb5afa96fa91764

# 询问从哪个节点开始移出插槽，输入6000端口节点的ID
# 在结束输入后回车，并输入done
Please enter all the source node IDs.
  Type 'all' to use all the nodes as source nodes for the hash slots.
  Type 'done' once you entered all the source nodes IDs.
Source node #1:6808731e0d12e8ec740509ef060c81306d5cd9bd
Source node #2:done
# 然后会要求再次确认，输入yes
Do you want to proceed with the proposed reshard plan (yes/no)? yes
# 再进redis查看cluster slots
127.0.0.1:6000> CLUSTER SLOTS
1) 1) (integer) 1000
   2) (integer) 5460
   3) 1) "127.0.0.1"
      2) (integer) 6000
      3) "6808731e0d12e8ec740509ef060c81306d5cd9bd"
   4) 1) "127.0.0.1"
      2) (integer) 6003
      3) "e219bc21f1ab59f4cf00ca1b35da84e955424556"
2) 1) (integer) 0
   2) (integer) 999
   3) 1) "127.0.0.1"
      2) (integer) 6001
      3) "b098c2ddc169cc6e5411e8c42fb5afa96fa91764"
   4) 1) "127.0.0.1"
      2) (integer) 6004
      3) "5c15caa067f96e557d73704e961ee08504fe3ac1"
3) 1) (integer) 5461
   2) (integer) 10922
   3) 1) "127.0.0.1"
      2) (integer) 6001
      3) "b098c2ddc169cc6e5411e8c42fb5afa96fa91764"
   4) 1) "127.0.0.1"
      2) (integer) 6004
      3) "5c15caa067f96e557d73704e961ee08504fe3ac1"
```

若不使用`redis-trib.rb`命令。也可通过`cluster setslot`命令分片。

```
cluster setslot 插槽号 node 新节点运行ID
例：若要将上面分好的1000个插槽迁移回到6000管理

前提：插槽中没有任何键。因为这样迁移时并不会连同相应键一起迁移，会造成键的丢失。
```

可通过`cluster getkeysinslot 插槽号 要返回的键的数量`获取指定插槽中的键，以查看要迁移的插槽中是否存在键。
然后把每个键迁移迁移到目标节点：

```
migrate 目标节点地址 目标节点端口 键名 数据库号 超时时间 [copy] [replace]`
其中copy和replace可选，copy表示不会将键从当前数据库删除，只是复制。replace表示目标节点若存在同名键则覆盖。
因为集群模式数据库只能使用0号数据库，所以数据库号始终是0
```

Redis 还提供以下命令实现集群不下线的数据迁移：

```
clsuter setslot 插槽号 migrating 新节点运行ID
cluster setslot 插槽号 importing 原节点运行ID

迁移时若要把N号插槽从A迁移到B，需要如下操作
在B执行cluster setslot N importing A
在A执行clsuter setslot N migrating B
在A执行cluster getkeysinslot N 获取N号插槽的键列表
对列表的每个键都执行migrate命令
执行cluster setslot 0 B 完成迁移
```

当客户端向集群中任一节点发送命令后，该节点都会判断相应键是否在当前节点，若在则立刻处理，若不在则返回一个 MOVE 重定向请求，告诉客户端目前负责该键的节点。返回的错误信息格式为：
`(error) MOVED 键所在的插槽号 IP地址:端口`
`redis-cli`也提供集群模式支持自动重定向，通过`-c`参数启动客户端。

集群中每个节点都会每隔 1 秒随机选 5 个节点，并选择其中最久无响应的节点发送一个 ping，若超时无回复，则变为主观下线，进行判断，与哨兵类似。选择主数据库的过程也与哨兵一致，都使用 Raft 算法。
若一个至少负责一个插槽的主数据库下线且无相应从数据库可进行故障恢复，则**整个集群**默认会进入下线状态无法工作。也可修改配置文件的`cluster-require-full-coverage`设为 no，使集群在这种情况下继续工作。

# 管理

## 安全

可通过配置文件的`requirepass`参数设置密码，于是客户端每次连接数据库时必须发送密码验证，否则 Redis 会拒绝执行客户端发来的命令，会报错：`(error)NOAUTH Authentication required`。
使用`auth 密码`验证。
也可在 redis 中通过命令`config set requirepass 密码`设置密码。
也可通过命令`config get requirepass`获取密码（已验证后才能看）

攻击者会通过穷举法破解 Redis 密码（1 秒内可尝试十几万个密码）。

> 配置 Redis 复制时，若主数据库设置了密码，需要在从数据库的配置文件中通过`masterauth`参数设置验证密码，在从数据库连接主数据库时会自动`auth`验证。

Redis 支持对命令的重命名，可在配置文件中的`rename-command`进行设置。格式为`rename-command 命令 重命名后的命令`。
若要禁用某命令可直接将该命令重命名为空字符串即可。

## 通信协议

Redis 支持两种通信协议：

- 统一请求协议：二进制安全
- 简单协议：便于在 telnet 中输入（已废弃）

简单协议中提供五种 telnet 返回值表示形式已被封装到 redis-cli 中，而就成为了 redis 的返回形式。

- 错误回复 error reply
  以`-`开头，并跟上错误信息，以`\r\n`结尾
- 状态回复 status reply
  以`+`开头，跟上状态信息，以`\r\n`结尾
- 整数回复 integer reply
  以`:`开头，跟上数值，以`\r\n`结尾
- 字符串回复 bulk reply
  以`$`开头，跟上字符串长度，`\r\n`分隔，再跟上字符串内容，再以`\r\n`结尾。若返回值为空，会返回`$-1`
- 多行字符串回复 multi-bulk reply
  以`*`开头，跟上字符串个数，`\r\n`分隔，再跟上字符串内容，再以`\r\n`结尾。

**统一请求协议**
命令格式类似于多行字符串回复的格式，每个命令都可以包含二进制字符。
Redis 的 AOF 文件和主从复制时发送的内容都使用了统一请求协议。
若发送命令`set foo bar`，则在传输中的写法为`*3\r\n$3\r\nSET\r\n*3\r\n$3\r\nFOO\r\n*3\r\n$3\r\nBAR\r\n`。

## 一些管理命令

- 耗时命令日志
  当一条命令执行时间超时后，Redis 会将该命令的执行时间等信息加入耗时命令日志（slow log）。可通过配置文件的`slowlog-log-slower-than`参数设置该限制时间，单位为微秒（1s=10^6μs），默认为 10000μs。耗时命令日志会存储在内存中，也可通过配置文件`slowlog-max-len`设置记录的最多条数，默认 128。

可在 rediscli 中使用`slowlog get`获取当前耗时命令日志。
每条日志由四个部分组成：

1. 该日志的唯一 ID
2. 该命令执行的 Unix 时间
3. 该命令的耗时时间，单位微秒
4. 命令和参数

- 命令监控
  Redis 提供`monitor`命令监控 Redis 执行的所有命令。
  在一个终端中输入`monitor`，便开始监视任何执行操作（该终端被挂起，不能执行命令）。

```
在第一个终端中输入
127.0.0.1:6379> MONITOR
OK
在另一个终端中执行一条命令
set foo bar

于是在第一个终端中就会打印出以下内容
1531104811.876088 [0 127.0.0.1:41664] "COMMAND"
1531104820.923283 [0 127.0.0.1:41664] "set" "foo" "bar"
```

`monitor`命令十分影响 redis 的性能，会降低近一半的负载能力，因此只适合进行排错和调试。


# Redis 配置文件常用参数
`config get <指定配置>`：获取服务器配置信息（就是配置文件中的参数）。
可以用`config get *`获取当前所有配置参数信息
## 服务本身相关
- `bind <IPaddr>`： 指定 Redis 只接收该地址的请求。默认接收所有 IP 地址的请求，这样会造成安全隐患，最好填写需要调用 redis 的服务器的 IP 地址，或者直接写`127.0.0.1`仅允许本地用户调用。
- `daemonize yes|no`：是否在后台运行。默认在前台运行
- `pidfile`：PID 文件路径。若运行多个 Redis，则需要在各自的配置文件中指定不同的 PID 文件路径和端口
- `port`：Redis 监听的端口，默认为 6379
- `logfile`：日志文件路径
- `loglevel`：日志等级，分为四个：debug、verbose、notice、warning，默认为 notice
- `databases`：数据库个数，默认设为 16 个
- `protected-mode`：默认为yes开启，若开启需要配置`bind`或设置密码`requirepass`，若关闭则外部网络可直接访问
- `supervised`：默认为`no`，若为no，则不支持使用upstart或systemd管理redis。可以设为`systemd`或`upstart`。如果是ubuntu系统，则要设为`systemd`
- 

## 连接相关
- `timeout`：客户端连接超时时间，单位秒。若客户端在超时前没发出任何指令，则会关闭连接。
- `maxclients`：限制同时连接的客户数。当连接数超过该值，则不再接收，并返回 error。
- `requirepass`：设置客户端连接后进行任何其他操作前需要的密码。
  > 因为 Redis 速度快，所以外部用户可以每秒进行 150000 次密码尝试，若密码简单，很容易被破解。
- `tcp-keepalive`：客户端发送的最后一个数据包与redis发送的第一个保活探测报文之间的时间间隔（单位秒），默认为300
- `tcp-backlog`：TCP连接中已完成队列(完成三次握手之后)的长度。必须不大于Linux系统定义的`/proc/sys/net/core/somaxconn`值。默认是511。当系统并发量大并且客户端速度缓慢的时候需要参考设置这两个值

## 内存相关
- `maxmemory <bytes>`：设置 Redis 最大能使用的内存，单位字节。当分配的内存完全被占用后，若再接收到 set 命令，则 Redis 会先删除设置了 expire 的键，无论是否到期。若所有 expire 的键都被删除了，则 redis 不再进行 set 操作，只允许 get 操作。此参数适合把 redis 当做类似 Memcached 缓存来使用
- `vm-enabled`：是否开启虚拟内存支持。当内存不够时，会把 value 存放到交换区（swap）中。性能基本不受影响。同时要将`vm-max-memory`设置足够大以存放所有 key
- `vm-max-memory`：开启虚拟内存后 redis 可用的最大内存大小，默认为 0。在生产环境中，最好不要设为 0，根据实际情况调整。


## 持久化相关
- `save <seconds> <changes>`：redis 进行备份的频率。在多少秒内进行几次更新操作，就会触发备份，将数据同步到 RDB 文件。详见持久化
- `appendonly yes|no` ：默认情况下，redis 会在后台异步把数据库镜像备份到此磁盘，但这样备份非常耗时，且不能很频繁，若断电会造成大量数据丢失。若开启 appendonly，则 redis 会将接收到的每一次写操作追加到`appendonly.aof`中，当 redis 重启时，会从该文件恢复到之前的状态。但这样容易造成该文件过大。可通过指令`BGREWRITEAOF`对该文件整理。
- `appendfsync always|everysec|no`：详见持久化
- `dbfilename`：rdb 备份的文件名，默认为`dump.rdb`
- `dir`：rdb 备份文件存放路径。路径和文件名要分开配置，因为 Redis 备份时会先将当前数据库的状态写入一个临时文件，等备份完成后再把该文件替换为指定文件。
- `rdbcompression yes|no`：是否开启 rdb 备份时压缩，默认开启


## 主从复制相关
- `slaveof <masterip> <masteport>`：在从数据库上设置，指定主数据库
- `masterauth <master-password>` ：当主数据库连接需要密码验证时，在此指定密码
- `repl-ping-slave-period`：SLAVE周期性的ping MASTER间隔。默认10
- `repl-ping-replica-period`：同上，一个东西
- `repl-timeout`：多长时间内均PING不通时，判定心跳超时。一定不能小于`repl-ping-replica-period`，可以考虑为`repl-ping-replica-period`的3倍或更大。默认60


## 定时任务相关
- `hz`：指定Redis定期任务的执行频率，这些任务包括关闭超时的客户端连接、主动清除过期key等
- `dynamic-hz`：同上，是动态的，默认为`yes`开启，若还配置了`hz`，则以`hz`为基线进行动态调整。（5.0版本新增）


# K8S集群内部署Redis



# FAQ

1. **Redis 内存用完怎么办？**

   redis 的性能会下降，并可能出错。可通过 info 查看 redis 内存使用情况，并写脚本进行监控。可通过配置文件`maxmemory`调整 redis 可用内存大小。若 redis 的内存使用达到上限，即给出错误写入的命令，仅能接受只读命令。

2. **使 redis 内存使用率降低的方法？**

   最好使用 redis 的哈希、列表、排序集、整数集

3. **如果没有数据集较大的内存，怎么进行高层次的操作？**

   使用客户端哈希，并部署 redis 集群，自动分发，以及 redis 子集的热备

4. **单线程 Redis 如何利用多个 CPU？**

   只需在同一台机器上启动多个 redis 实例，当做不同服务器即可。

## Redis 报错问题

- Redis 被配置为保存数据库快照，但它目前不能持久化到硬盘。用来修改集合数据的命令不能用

```
报错：(error) MISCONF Redis is configured to save RDB snapshots, but it is currently not able to persist on disk. Commands that may modify the data set are disabled, because this instance is configured to report errors during writes if RDB snapshotting fails (stop-writes-on-bgsave-error option). Please check the Redis logs for details about the RDB error.
```

原因：强制关闭 Redis 快照导致不能持久化
解决：将配置文件`stop-writes-on-bgsave-error`设置为 no

# 参考资料

> Redis 入门指南（第二版）
> [Linux\_基于 Docker 搭建 Redis 集群](https://segmentfault.com/a/1190000010131816) > [Docker Redis 的官方镜像简单使用](https://segmentfault.com/a/1190000014618411) > [【Redis】基于 Redis3.2.4 集群搭建说明](https://segmentfault.com/a/1190000009857207)
>
> 高性能网站构建实战

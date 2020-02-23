---
title: Memcached笔记
date: 2018-11-05 16:21:08
tags: [Memcached, 缓存]
categories: [应用运维]
---

- [Memcached 概述](#memcached-%e6%a6%82%e8%bf%b0)
- [Memcached 简单部署](#memcached-%e7%ae%80%e5%8d%95%e9%83%a8%e7%bd%b2)
  - [安装与简单操作](#%e5%ae%89%e8%a3%85%e4%b8%8e%e7%ae%80%e5%8d%95%e6%93%8d%e4%bd%9c)
  - [部署在 LNMP 环境中](#%e9%83%a8%e7%bd%b2%e5%9c%a8-lnmp-%e7%8e%af%e5%a2%83%e4%b8%ad)
- [Memcached 架构优化](#memcached-%e6%9e%b6%e6%9e%84%e4%bc%98%e5%8c%96)
- [参考书目](#%e5%8f%82%e8%80%83%e4%b9%a6%e7%9b%ae)

<!--more-->

# Memcached 概述

Memcached 是一个高性能、支持高并发的分布式内存缓存系统，由 C 语言编写，是基于存储键值对的 hashmap，用于动态 web 应用，减轻后端服务器和数据库的负载。采用 C/S 架构，服务器端的程序叫 Memcached，客户端程序叫 Memcache。

Memcached 通过事先规划好的系统内存空间中临时缓存数据库中的各类数据，达到减少前端业务服务对数据库的直接高并发访问。原理与缓存服务器一致。

**Memcached 特点：**

- 协议简单：采用基于文本行的协议，可通过 telnet 等命令直接操作数据
- 支持 epoll/kqueue 异步 I/O 模型，使用 libevent 作为事件处理通知机制
- 采用 key/value 键值对存储
- 全内存缓存，效率高。无持久化存储设计。当重启系统或 Memcached 服务时，数据会全部丢失。若要持久化保存，需要使用 Redis。
- 支持分布式集群，但不同服务器之间互不通信，每个节点独立存取数据。
- 多线程处理时采用 pthread 线程模式。若要激活多线程，需在编译时指定`./configure --enable-threads`。

**应用场景：**

- 作为数据库的查询数据缓存
  - 完全数据缓存：例如商品分类等一般不会改变的数据。若将这类缓存做成静态文件，然后在 web 前端缓存或用 CDN 加速效果更好。
  - 热点数据缓存：例如用户的商品等一直会变化的数据。用于缓存经常被访问的数据。可通过数据库插件或相关软件实现缓存与数据库同步。
- 作为集群节点的 session 会话共享存储
  将用户请求产生的 session 信息统一存到缓存，提高速度。

**网站更新 Memcached 数据时的工作流程**

1. 程序更新或删除数据时，首先处理后端数据库
2. 处理数据库的同时，会通知 Memcached，告知对应的数据失效，保证缓存数据与数据库一致。
3. 若是在高并发读写场合，除了以上操作，还需通过相关机制，例如在数据库上部署相关程序（如数据库中设置触发器使用 UDFs），实现当数据库有更新时就把数据更新到缓存中，实现数据预热，减少第一次查询对数据库的压力。甚至可以把缓存作为数据库的从库，实现主从复制。
   {% asset_img 1.png %}

Memcached 在企业常见架构中的位置：
{% asset_img 2.png %}

**Memcached 内存管理机制：**

- 采用 slab 内存分配机制：
  全称 Slab Allocation。会提前将大内存分为若干 1M 的 slab，每个小对象称为 chunk，把相同尺寸的内存块分为组 chunks slab class，可重复利用。当新增数据对象时，会根据空闲 chunk 的表进行分配，避免了大量重复的初始化和清理，减轻内存管理器负担。存储在 chunk 中的数据项称为 item。
  {% asset_img 3.png %}
  slab 分配器是基于对象（内核中的数据结构）进行管理的，每当要申请这样一个对象时，slab 分配器就从一个 slab 列表中分配一个 chunk 出去，而且是选择最适合数据大小的 slab 分配一个能存下这个数据的最小 chunk，而当要释放时，将其重新保存在该列表中，从而避免内部碎片。
  {% asset_img 4.png %}
  slab 分配器并不丢弃已经分配的对象，而是释放并把它们保存在内存中。
  slab 分配对象时，会使用最近释放的对象的内存块，因此其驻留在 cpu 高速缓存中的概率会大大提高。
  > 早期使用的是 malloc，但会产生内存碎片，导致性能下降。
- 采用 LRU 对象清除机制：Least Recent Used，淘汰最不常使用的，即缓存中最长时间没有被访问的会被淘汰。
- 采用 hash 机制快速检索 item：对 item 做 hash，建立 hash 表

**Slab 机制的缺点：** 在 chunk 分配时也会产生浪费，因为分配的是能存下这个数据的最小 chunk，所以几乎一定会有空间浪费。
避免浪费内存的方法：

1. 预先计算应用存入的数据大小，或把同一业务类型的数据存入一个 Memcached，确保存入数据大小相对均匀，以减少内存浪费。
2. 在启动缓存时指定 Growth Factor 因子，通过`-f`选项，可以在某种程度上控制每组 slab 之间的差异，默认为 1.25。

**Memcached 预热：** 当需要大规模重启 Memcached 时，要先在前端控制网站入口的访问流量，然后重启 Memcached 集群进行数据预热，再逐步放开前端的流量控制。在启动服务器集群前，一定要从网站的后端依次往前端启动，Memcached 要提前预热。

**Memcached 检测过期与删除机制：**Memcached **不会主动检测 item 对象是否过期，而是在进行 get 操作时检查时间戳** ，这种策略称为**懒惰检测对象过期策略**，这种策略不会在过期数据上浪费 CPU 资源。**在删除 item 时，不会自动释放内存空间，而是做删除标记** ，将指针放入 slot 回收槽，下次分配时直接使用。在分配内存时，会**优先使用已过期的键值对空间，并采用 LRU 算法进行淘汰**。若不希望系统使用 LRU 清除数据，可使用`-M`启动 Memcached。

# Memcached 简单部署

## 安装与简单操作

安装 Memcached 前确保`libevent`和`libevent-devel`已安装。然后可通过 yum 或源码包安装。推荐使用 yum 安装，虽然版本会老一点。
`yum install -y memcached`或`apt install -y memcached`

源码包安装，进入解压目录。

```
./configure --prefix=/usr/local/memcached \
            --bindir=/usr/bin \
            --sbindir=/usr/sbin \
            --sysconfdir=/etc
```

然后`make && make install`

服务器端`memcached`命令参数：

```
memcached
  -p    # TCP端口，默认为11211
  -U    # UDP端口，默认0（未开启）
  -d    # 后台运行
  -u    # 指定验证用户
  -m    # 内存限制，默认64MB
  -c    # 连接限制，默认1024
  -v    # 显示详细信息
  -t    # 使用的线程数，默认4
  -R    # 每个event最大请求数，默认20
  -C    # 禁用CAS
  -M    # 不使用LRU清除数据
  -L    # 启用大内存页，可降低内存浪费
```

启动 Memcached 实例

```
memcached -m 128m -d -u root -c 8192
# 如果要使用root用户启动，必须要加-u
```

可使用 telnet 进入 Memcached 进行操作。`telnet 127.0.0.1 11211`

memcached 命令格式

```
<command> <key> <flags> <exptime> <bytes>  # 命令
<datablock> # 填数据
<status>   # 返回的状态
```

| 命令      | 说明                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| command   | set\get\add\replace\append\prepend\cas                                           |
| key       | 键名                                                                             |
| flags     | 客户端用来标识数据格式的数值，如 json、xml 等                                    |
| exptime   | 存活时间，0 为永远，单位秒（小于 30 天），unix 时间戳（大于 30 天）              |
| bytes     | 字符个数，不包含\r\n                                                             |
| datablock | 文本行，以\r\n 结尾                                                              |
| status    | 命令返回状态，STORED\NOT_STORED\NOT_FOUND\EXISTS\ERROR\CLIENT_ERROR\SERVER_ERROR |

常用操作

- 插入数据

  ```
  set key1 0 0 5
  abcde
  STORED  // 表示成功添加
  ```

  **设置的多少字节，就必须是多少字节，不能多也不能少** ，否则就会报错

  ```
  CLIENT_ERROR bad data chunk
  ERROR
  ```

- 查询数据

  ```
  get key1
  VALUE key1 0 5
  abcde
  END
  ```

- 删除数据
  ```
  delete key1
  DELETED
  ```

关闭 Memcached：若启动了多个实例，使用`killall`或`pkill`会同时关闭这些实例，所以最好在启动时添加`-P`指定 pid 文件，便于管理不同实例。

```
memcached -d -u root -p 11211 -P /var/run/memcached-11211.pid
memcached -d -u root -p 11212 -P /var/run/memcached-11212.pid
```

然后通过 pid 停止指定 memcached

```
kill `cat /var/run/memcached-11211.pid`
```

也可以通过`nc`命令连接 memcached

```
# printf "stats\r\n" | nc 127.0.0.1 11211
STAT pid 5235
STAT uptime 1283
STAT time 1578635117
STAT version 1.5.6 Ubuntu
......
```

## 部署在 LNMP 环境中

需要获取 php 的 memcached 插件 memcache，在[php memcache 插件下载](http://pecl.php.net/package/memcache)
解压后进入目录。先确保`php-devel`（centos）或`php-dev`（ubuntu）已安装。在该目录下运行`phpize`，生成`configure`文件。
然后执行`./configure --enable-memcache --with-php-config=/usr/bin/php-config`。若是 ubuntu，则`php-config`变为`php-config7.2`。
然后`make && make install`。会提示安装到的路径，如`Installing shared extensions: /usr/lib/php/20170718/`，在该路径下可找到`memcache.so`，说明插件安装完成。

# Memcached 架构优化

# 参考书目

- 跟老男孩学 Linux 运维 WEB 集群实战

---
title: Memcached笔记
date: 2018-11-05 16:21:08
tags: [Memcached, 缓存]
categories: [应用运维]
---

- [Memcached 概述](#Memcached概述)
- [Memcached 简单部署](#Memcached简单部署)
- []()

<!--more-->

# Memcached 概述

Memcached 是一个高性能、支持高并发的分布式内存缓存系统，由 C 语言编写，是基于存储键值对的 hashmap，用于动态 web 应用，减轻后端服务器和数据库的负载。采用 C/S 架构，服务器端的程序叫 Memcached，客户端程序叫 Memcache。

Memcached 通过事先规划好的系统内存空间中临时缓存数据库中的各类数据，达到减少前端业务服务对数据库的直接高并发访问。原理与缓存服务器一致。

**Memcached 特点：**

- 协议简单：采用基于文本行的协议，可通过 telnet 等命令直接操作数据
- 支持 epoll/kqueue 异步 I/O 模型，使用 libevent 作为事件处理通知机制
- 全内存缓存，效率高。无持久化存储设计
- 支持分布式集群
- 多线程处理时采用 pthread 线程模式

**应用场景：**

- 作为数据库的查询数据缓存
- 作为集群节点的 session 会话共享存储

**Memcached 内存管理机制：**

- 采用 slab 内存分配机制：slab 分配器是基于对象（内核中的数据结构）进行管理的，每当要申请这样一个对象时，slab 分配器就从一个 slab 列表中分配一个这样大小的单元出去，而当要释放时，将其重新保存在该列表中，从而避免内部碎片。slab 分配器并不丢弃已经分配的对象，而是释放并把它们保存在内存中。slab 分配对象时，会使用最近释放的对象的内存块，因此其驻留在 cpu 高速缓存中的概率会大大提高。
- 采用 LRU 对象清除机制：Least Recent Used，淘汰最不常使用的，即缓存中最长时间没有被访问的会被淘汰。
- 采用 hash 机制快速检索 item：对 item 做 hash，建立 hash 表

**Slab 内存管理机制：**全称 Slab Allocation。会提前将大内存分为若干 1M 的 slab，每个小对象称为 chunk，把相同尺寸的内存块分为组 chunks slab class，可重复利用。当新增数据对象时，会根据空闲 chunk 的表进行分配。存储在 chunk 中的数据项称为 item。

**Memcached 预热：**当需要大规模重启 Memcached 时，要先在前端控制网站入口的访问流量，然后重启 Memcached 集群进行数据预热，再逐步放开前端的流量控制。

**Memcached 检测过期与删除机制：**Memcached 不会主动检测 item 对象是否过期，而是在进行 get 操作时检查时间戳，这种策略称为**懒惰检测对象过期策略**，这种策略不会在过期数据上浪费 CPU 资源。在删除 item 时，不会自动释放内存空间，而是做删除标记，将指针放入 slot 回收槽，下次分配时直接使用。在分配内存时，会优先使用已过期的键值对空间，并采用 LRU 算法进行淘汰。

# Memcached 简单部署

安装 Memcached 前确保`libevent`和`libevent-devel`已安装。然后可通过 yum 或源码包安装。推荐使用 yum 安装，虽然版本会老一点。

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
  STORED
  ```

- 查询数据

  ```
  get key1
  VALUE key1 0 5
  abcde
  END
  ```

---
title: Kafka基础笔记
tags: []
categories: []
date: 2020-01-07 22:45:38
---

- [消息队列](#%E6%B6%88%E6%81%AF%E9%98%9F%E5%88%97)
- [Kafka 介绍](#Kafka-%E4%BB%8B%E7%BB%8D)
  - [架构](#%E6%9E%B6%E6%9E%84)
- [搭建](#%E6%90%AD%E5%BB%BA)

<!--more-->

# 消息队列

消息队列（Message Queue）是一种进程间通信或同一进程的不同线程间的通信方式，软件的队列用来处理一系列的输入，通常是来自用户。
消息队列提供了异步的通信协议，每一个队列中的纪录包含详细说明的数据，包含发生的时间，输入设备的种类，以及特定的输入参数，也就是说：消息的发送者和接收者不需要同时与消息队列交互。消息会保存在队列中，直到接收者取回它。

消息队列各个角色：

- Producer：消息生产者。负责产生和发送消息到 Broker
- Broker：消息处理中心。负责消息存储、确认、重试等，一般其中会包含多个 queue
- Consumer：消息消费者。负责从 Broker 中获取消息，并进行相应处理

消息队列种类：

- Peer—To-Peer：消息生产者生产消息发送到 queue 中，然后消息消费者从 queue 中取出并且消费消息。消息被消费以后，queue 中不再有存储，所以消息消费者不可能消费到已经被消费的消息。queue 支持存在多个消费者，但是对一个消息而言，只会有一个消费者可以消费。

  - 一般基于 Pull 或 Polling 接收消息
  - 支持异步”即发即弃“的消息传送方式，支持同步请求/应答传送方式
  - 支持一对一、一对多、多对多、多对一等多种配置方式，支持树状、网状等多种拓扑结构。
    {% asset_img 1.png %}

- 发布/订阅：消息生产者将消息发布到 topic 中，同时有多个消息消费者消费该消息。和点对点方式不同，发布到 topic 的消息会被所有订阅者消费。

  - 发布到一个主题的信息，可被多个订阅者所接收
  - 发布/订阅可基于 Push 消费数据，也可基于 Polling 消费数据
  - 解耦能力比 P2P 模型更强
    {% asset_img 2.png %}

- 多点广播：能够将消息发送到多个目标站点 (Destination List)。可以使用一条 MQ 指令将单一消息发送到多个目标站点，并确保为每一站点可靠地提供信息。
  - MQ 不仅提供了多点广播的功能，而且还拥有智能消息分发功能，在将一条消息发送到同一系统上的多个用户时，MQ 将消息的一个复制版本和该系统上接收者的名单发送到目标 MQ 系统。目标 MQ 系统在本地复制这些消息，并将它们发送到名单上的队列，从而尽可能减少网络的传输量。
- 群集 (Cluster)：为了简化点对点通讯模式中的系统配置，MQ 提供 Cluster(群集) 的解决方案。群集类似于一个域 (Domain)，群集内部的队列管理器之间通讯时，不需要两两之间建立消息通道，而是采用群集 (Cluster) 通道与其它成员通讯，从而大大简化了系统配置。
  - 此外，群集中的队列管理器之间能够自动进行负载均衡，当某一队列管理器出现故障时，其它队列管理器可以接管它的工作，从而大大提高系统的高可靠性。

消息队列特性：

- 异步性：将耗时的同步操作，通过以发送消息的方式，进行了**异步化处理。减少了同步等待的时间**。
- 松耦合：**消息队列减少了服务之间的耦合性**，不同的服务可以通过消息队列进行通信，而不用关心彼此的实现细节，只要定义好消息的格式就行。
- 分布式：通过**对消费者的横向扩展**，降低了消息队列阻塞的风险，以及单个消费者产生单点故障的可能性（当然消息队列本身也可以做成分布式集群）。
- 可靠性：消息队列一般会**把接收到的消息存储到本地硬盘上**（当消息被处理完之后，存储信息根据不同的消息队列实现，有可能将其删除），这样即使应用挂掉或者消息队列本身挂掉，消息也能够重新加载。
- 可恢复性：系统的一部分组件失效时，不会影响到整个系统。消息队列降低了进程间的耦合度，所以**即使一个处理消息的进程挂掉，加入队列中的消息仍然可以在系统恢复后被处理。**
- 顺序保证：在大多使用场景下，数据处理的顺序都很重要。**大部分消息队列本来就是排序的，并且能保证数据会按照特定的顺序来处理。**
- 缓冲：在任何重要的系统中，都会有需要不同的处理时间的元素。例如，加载一张图片比应用过滤器花费更少的时间。消息队列通过一个缓冲层来帮助任务最高效率的执行———写入队列的处理会尽可能的快速。该缓冲有助于控制和优化数据流经过系统的速度。

# Kafka 介绍

Kafka 最初是由 LinkedIn 采用 scala 编写的多分区、多副本且基于 Zookeeper 协调的分布式消息系统，目前为 Apache 的项目。
目前，kafka 定位为一个分布式流式处理平台，可提供消息持久化，即使 TB 级别的消息存储也能保持长时间的稳定性能，以高吞吐、可持久化、可水平扩展、支持流数据处理等特性被广泛使用。

Kafka 扮演了三大角色：

- 消息系统：Kafka 和传统的消息系统（消息中间件）都具备系统解耦、冗余存储、流量削峰、缓存、异步通信、扩展性、可恢复性等功能。同时，kafka 还提供大多数消息系统难以实现的消息顺序性保障及回溯消费功能
- 存储系统：Kafka 把消息持久化到磁盘，相比于其他基于内存存储的系统而言，有效降低了数据丢失的风险，得益于 Kafka 的消息持久化和多副本，可以把 Kafka 作为长期的数据存储系统来使用，只需要把对应的数据保留策略设置为永久或启动主题的日志压缩功能即可。
- 流式处理平台：Kafka 不仅为每个流行的流式处理框架提供了可靠的数据来源，还提供了一个完整的流式处理类库，如窗口、连接、变换和聚合等操作。

Kafka 设计目标：

- 高吞吐率：在廉价的商用机器上单机可支持每秒 100 万条消息的读写
- 消息持久化：所有消息均被持久化到磁盘，无消息丢失，支持消息重放
- 完全分布式：Producer，Broker，Consumer 均支持水平扩展
- 同时适应在线流处理和离线批处理

## 架构

{% asset_img 4.png %}

常见术语：

- Topic：主题，特指 Kafka 处理的消息源（feeds of messages）的不同分类，Kafka 中消息以主题为单位进行归类，生产者负责将消息发送到特定的主题，然后消费者负责订阅主题并消费。物理上不同 topic 的消息分开存储，逻辑上一个 topic 的消息虽然保存于一个或多个 broker 上但用户只需指定消息的 topic 即可生产或消费数据而不必关心数据存于何处。
- Partition：分区，Topic 物理上的分组，一个 topic 可以分为多个 partition，每个 partition 是一个有序的队列。
  - 分区在存储层面可以看作一个可追加的日志文件，消息被追加到分区日志文件时都会分配一个特定的偏移量（offset），offset 是消息在分区中的唯一标识，Kafka 通过它保证消息在分区内的有序性，且 offset 不跨分区，就是说 Kafka 保证分区有序而不是主题有序。
  - 创建 topic 时可指定 parition 数量。每个 partition 对应于一个文件夹，该文件夹下存储该 partition 的数据和索引文件。
  - Kafka 的分区可分布在不同的服务器（Broker）上，也就是说，一个主题可横跨多个 Broker，一次提供比单个 Broker 更强大的性能。
- Message：消息，是通信的基本单位，每个 producer 可以向一个 topic（主题）发布一些消息。
- Producers：一个动词，向 Kafka 的一个 topic 发布消息的过程叫做 producers。
- Consumers：一个动词，订阅 topics 并处理其发布的消息的过程叫做 consumers。
- Consumer Group：消费者组，可以并行消费 Topic 中 partition 的消息

每条消息被发送到 Broker 前，会根据分区规划选择存储到哪个具体分区。若分区规则设置地合理，则所有消息都可均匀地分配到不同分区中。若一个主题只对应一个文件，那么这个文件所在的机器 I/O 将会成为这个主题的性能瓶颈，而分区解决了这个问题。

# 搭建

需要先安装 JAVA 环境

从官网下载最新的 Kafka 的 tar 包，解压放到`/usr/local/`下。

先配置启动 Zookeeper，Kafka 包简易集成了 Zookeeper。首先修改`config/`中的`"zookeeper.properties"`配置文件

```
dataDir=/data/zookeeper    # zookeeper的数据存放，最好专门放一个目录
clientPort=2181       # 启动端口，默认2181
```

kafka 包的`bin/`中有一个脚本启动 zookeeper，为`zookeeper-server-start.sh`。
在 kafka 包中，执行以下命令即可启动单机 zookeeper

```
bin/zookeeper-server-start.sh config/zookeeper.properties
```

查看 zookeeper 是否启动

```
# lsof -i:2181
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
java    21999 root  116u  IPv6 771206      0t0  TCP *:eforward (LISTEN)
```

然后启动 kafka，先配置文件`config/server.properties`

```
broker.id=0    # Broker的id
listeners=PLAINTEXT://localhost:9092   # 监听端口，默认9092
log.dirs=/data/kafka-logs   # 将数据持久化到哪个目录
num.partitions=3    # 默认的partition数量
```

然后通过脚本`kafka-server-start.sh`启动 Kafka，并指定`-daemon`后台启动

```
 bin/kafka-server-start.sh -daemon config/server.properties
```

再查看一下 Kafka 是否启动

```
# lsof -i:9092
COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
java    5199 root  121u  IPv6  81847      0t0  TCP localhost:XmlIpcRegSvc (LISTEN)
java    5199 root  137u  IPv6  82158      0t0  TCP localhost:54104->localhost:XmlIpcRegSvc (ESTABLISHED)
java    5199 root  138u  IPv6  82159      0t0  TCP localhost:XmlIpcRegSvc->localhost:54104 (ESTABLISHED)


# lsof -i:2181
COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
java    3080 root  116u  IPv6  72020      0t0  TCP *:eforward (LISTEN)
java    3080 root  122u  IPv6  82155      0t0  TCP localhost:eforward->localhost:55208 (ESTABLISHED)
java    5199 root  116u  IPv6  82154      0t0  TCP localhost:55208->localhost:eforward (ESTABLISHED)

# Zookeeper和Kafka也建立了连接
```

创建一个 Topic

```
# bin/kafka-topics.sh --create --bootstrap-server localhost:9092 --replication-factor 1 --partitions 1 --topic test

--bootstrap-server 指定Kafka位置（也可以 --zookeeper 指定zookeeper的位置，两者只能选一个）
--create   创建topic
--topic 指定topic的名字
--partitions  指定分区数量
--replication-factor  指定复制因子

查看该topic
# bin/kafka-topics.sh --describe --bootstrap-server localhost:9092
Topic: test     PartitionCount: 1       ReplicationFactor: 1    Configs: segment.bytes=1073741824
        Topic: test     Partition: 0    Leader: 0       Replicas: 0     Isr: 0


必须指定zookeeper和topic名
--describe 查看具体topic的情况
```

启动一个 Console Consumer，是一个挂起状态的监听 Consumer

```
# bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic test --from-beginning
```

然后在另一个终端启动一个 Console Producer，是一个消息的发送端

```
# bin/kafka-console-producer.sh --broker-list localhost:9092 --topic test
>hello  # 发送一个hello消息

于是，consumer也能接受到这个消息
```

> 参考资料
> [Kafka 设计解析（一）：Kafka 背景及架构介绍](https://www.infoq.cn/article/kafka-analysis-part-1)
>
> [Kafka 深度解析](http://www.jasongj.com/2015/01/02/Kafka%E6%B7%B1%E5%BA%A6%E8%A7%A3%E6%9E%90/)
>
> [Apache kafka 工作原理介绍](https://www.ibm.com/developerworks/cn/opensource/os-cn-kafka/index.html)

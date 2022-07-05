---
title: Zookeeper
tags: [zookeeper]
categories: []
date: 2020-02-29 18:51:48
comments: false
---

<!-- more -->

# 概述
ZooKeeper是分布式应用的调度服务，通过一组简单的原语，分布式应用程序可以在这些原语的基础上实现更高级别的同步、配置维护、分组以及命名。ZooKeeper被设计为易于编程，并使用一种数据模型，该模型使用文件系统目录树结构。ZooKeeper在Java环境中运行。

## zookeeper的设计目的
- ZooKeeper允许分布式进程通过**共享的分层命名空间**（hierarchical namespace）相互协同调度，该命名空间的组织方式**类似于标准文件系统**。命名空间由数据寄存器组成，称为 **znodes**，类似于文件和目录。与为存储而设计的典型文件系统不同，ZooKeeper的**数据保存在内存中**，这意味着 ZooKeeper 可以实现高吞吐量和低延迟。ZooKeeper的实现非常重视高性能、高可用性、严格有序的访问。ZooKeeper的高性能意味着它**可以用于大型分布式系统**，高可靠性使其**不会出现单点故障**，严格的排序意味着**可以在客户端实现复杂的同步原语**。
- 与它协调的分布式进程一样，ZooKeeper本身旨在通过一组主机进行横向扩展。组成 ZooKeeper集群的服务器必须相互通信，**这些服务器在内存中维护集群状态，以及持久存储中的事务日志和快照。只要大多数服务器可用，ZooKeeper 服务就可用**。 客户端只需连接到单个 ZooKeeper 服务器，并且客户端会维护一个 TCP 连接，通过它发送请求、获取响应、获取监视事件并发送心跳，如果与服务器的 TCP 连接中断，客户端将连接到不同的服务器。
  ![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206301215404.png)
- ZooKeeper **使用数字标记每个更新，通过数字反映所有 ZooKeeper 事务的顺序**。后续操作可以使用该顺序来实现更高级别的抽象，例如同步原语。
- ZooKeeper 在**以读取为主（read-dominant）的工作负载中特别快**。ZooKeeper 应用程序能在数千台机器上运行，并且它在读比写多的情况下表现最佳，读的速度是写的10倍。

## 数据类型与分层命名空间
命名空间的组织方式类似于标准文件系统。**名称是由斜杠 (/) 分隔的一系列路径，命名空间中的每个节点都由路径标识**。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206301236488.png)

## 节点与临时节点
与标准文件系统不同，ZooKeeper 命名空间中的每个节点都可以拥有与其关联的数据以及子节点，就像一个允许文件也成为目录的文件系统，原因是ZooKeeper 被设计用于存储协调数据，如状态信息、配置、位置信息等，因此每个节点存储的数据通常很小，在字节到千字节的范围内。ZooKeeper 数据节点称为znode。

Znode 维护一个统计结构，其中包括了**数据更改、ACL变更和时间戳**的版本号，以允许缓存验证和协调更新。每次 znode 的数据更改时，版本号都会增加。例如，每当客户端检索数据时，它也会收到数据的版本。

存储在命名空间中每个 znode 的数据是**原子读取和写入**的。读取会获取与 znode 关联的所有数据字节，写入会替换所有数据。

每个节点都有一个访问控制列表 (ACL)，它限制谁可以做什么。

ZooKeeper 也有临时节点（ephemeral nodes）的概念，只要创建 znode 的会话处于活动状态，这些 znode 就存在。当会话结束时，znode 被删除。

## 有条件的update和watch
ZooKeeper支持 watch，客户端可以在 znode 上设置监视。当 znode 发生变化时，watch 将被触发并移除。当 watch 被触发时，客户端会收到一个数据包告知 znode 已更改。如果客户端和其中一个 ZooKeeper 服务器之间的连接断开，客户端将收到本地通知（local notification）。

## 保证Guarantees
由于ZooKeeper的目标是成为构建更复杂服务（例如同步）的基础，因此它提供了一组保证，如下：
- 顺序一致性（Sequential Consistency）：来自客户端的更新将按照它们发送的顺序进行应用。
- 原子性（Atomicity）：更新要么成功，要么失败，没有中间状态的结果。
- 单一系统映像（Single System Image）：客户端都将看到相同的服务视图，不管它连接到的服务器是什么，也就是说，即使客户端故障转移到具有相同会话的不同服务器，客户端也永远不会看到系统的旧视图。
- 可靠性（Reliability）：当更新被应用后，它将从那时起持续存在，直到客户端覆盖更新。
- 及时性（Timeliness）：系统的客户端视图能保证在一定的时间范围内是最新的。

## 提供接口
ZooKeeper 提供非常简单的编程接口，仅支持以下操作：
- create：在树中的某个位置创建一个节点
- delete：删除一个节点
- exists：测试节点是否存在于某个位置
- get data：从节点读取数据
- set data：将数据写入节点
- get children：检索节点的子节点列表
- sync：等待数据传播

## 实现
如下图，运行 ZooKeeper 的每个服务器都会复制自己的每个组件的副本（除了请求处理器（Request Processor））。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206301350235.png)

复制数据库（Replicated Database）是包含整个数据树的内存数据库。更新的数据会被记录到磁盘以便恢复，写入的数据在被应用到内存数据库之前会被先序列化到磁盘。

每个 ZooKeeper 服务器都服务于客户端，客户端仅连接到一台服务器以提交请求。每个服务器数据库的本地副本会为读取请求提供服务，而改变服务状态的请求以及写请求是由一个统一的协议处理。

作为这个协议的一部分，来自客户端的所有写入请求都会被转发到一台服务器，称为领导者（Leader）。其余 ZooKeeper 服务器，称为追随者（followers），会接收来自领导者的消息申请并同意消息传递。消息传递层（messaging layer）负责在失败时替换领导者并将追随者与领导者同步。

ZooKeeper 使用自定义的原子消息传递协议（即Atomic Broadcast）。由于消息传递层具有原子性，因此 ZooKeeper 可以保证本地副本永远不会存在分歧。当领导者收到一个写请求时，它会计算系统在执行写请求时的状态，并将其转换为捕获这个新状态的事务。

## Zookeeper内部
ZooKeeper 的核心是一个原子消息系统，它使所有服务器保持同步。

Zookeeper 会在消息系统中使用以下特定保证（Guarantees）：
- 可靠传递（Reliable delivery）：如果某条消息被一个服务器接收了，最终这条消息会被所有服务器都接收一遍。
- 全序（Total order）：如果一条消息A在另一条消息B之前被一台服务器接收，则这条消息A会在B之前被所有服务器接收，如果A和B都是被接收的消息，则要么A在B前被接收，要么B在A前被接收。
- 因果序（Causal order）：如果消息B的发送方发送了消息A后又发送了B消息，则A必须被排在B之前。如果发送方在发送消息B之后发送了消息C，则C必须排在B之后。

原子消息系统的协议依赖于TCP的以下属性：
- 有序传递（Ordered delivery）：数据的下发顺序与消息的下发顺序相同，消息M只有在消息M之前发送的所有消息都被下发后才会下发。(由此得出的推论是，如果消息M丢失，那么M之后的所有消息都将丢失。)
- 关闭后不再有消息（No message after close）：一旦FIFO（First-In First-Out 先进先出）通道关闭，就不会收到来自它的消息。

FLP（不可能原理）证明，在可能发生故障的异步分布式系统中，共识是无法实现的。因此Zookeeper通过超时时间，来确保在出现故障时达成共识。然而，Zookeeper依靠的是时间来保障集群存活性，而不是正确性。因此，如果超时时间这个组件停止工作(例如时钟故障)，消息传递系统可能会挂起，但不会违反其保证（上面说的三条特定保证）。

> FLP：不可能原理。FLP是一篇论文的三个作者名字的首字母合起来组成的。该原理是分布式系统中重要的原理之一。
> FLP核心观点：在网络可靠，但允许节点失效（即便只有一个）的最小化异步模型系统中，不存在一个可以解决一致性问题的确定性共识算法。

Zookeeper 消息协议中的三个概念：
- 报文（Packet）：通过FIFO通道发送的字节序列分组
- 提议（Proposal）：一个协议单元。通过与参与决议的ZooKeeper服务器的交换报文（quorum）来达成提议，大多数提议包含消息，但是NEW_LEADER提议是不带消息的。
- 消息（Message）：一个将被原子广播到所有ZooKeeper服务器的字节序列，提议与同意提议在传递时都会附带消息。

如上所述，Zookeeper 保证了消息的全序（Total order），并保证了提议的全序。Zookeeper 通过一个事务id（zxid）来保证提议的排序。所有提议会被打上一个zxid，当这个提议被提出，zxid就能反映这个提议的顺序。提议会被发送到所有的Zookeeper服务器，并且当达到指定投票参与数的服务器承认这个提议时，这个提议会被提交。承认意味着这个提议会被记录到持久化存储中。对投票者有以下要求，任何一个quorum必须至少有一个服务器，若要通过，需要所有投票者拥有 n/2+1的规模（n为Zookeeper集群的服务器个数，也就是至少一半以上的服务器），来满足上述对投票者的要求。

zxid包含两部分：epoch和计数器。zxid为一个64bit的数字，高32位表示epoch，低32位表示计数器。当数字改变即可代表leader的改变，每当产生一个新leader，就有一个数字特定表示这个新leader。

Zookeeper 消息由两阶段构成：
- 领导者激活（Leader activation）：在这个阶段，会先选出一个leader，并由这个leader建立系统正确的状态，并准备好开始接收提议。
- Active messaging：在这个阶段，一个领导者会接收消息提议并协调消息传递。

ZooKeeper是一个整体协议，并不关注单个提议，而是将提议作为一个整体来看待。通过严格的排序，使Zookeeper能够高效地做到这一点，并极大地简化了Zookeeper的协议，领导者激活体现了这一整体概念。只有当达到一定数量的追随者和领导者同步时，该领导者才会被激活(领导者也算作追随者，可以给自己投票)，他们拥有相同的状态，这个状态包括领导者认为已经提交的所有提议，以及跟随领导者的提议，即NEW_LEADER 提议。



# Zookeeper集群安装
**确保集群的服务器数量为奇数个**。 确保java环境已安装完成。

到官网的[下载页面](https://zookeeper.apache.org/releases.html)下载软件包，解压到集群中每台服务器的指定目录，例如`/data/zookeeper`。

查看配置文件`conf/zoo.cfg`，如果没有可以复制同目录下的`zoo.cfg.example`文件。
```yaml
tickTime=2000   # Client与Server间或者Server间的通信心跳时间间隔，单位为毫秒。

initLimit=10    # Leader与Follower初始通信时限，即初始连接时能容忍的最多心跳数

syncLimit=5     # Leader与Follower同步通信时限，即请求与应答间能容忍的最多心跳数

dataDir=/var/data/zookeeper  # 数据目录

clientPort=2181  # 客户端连接端口

server.1=192.168.15.xxx:2888:3888
server.2=192.168.15.xxx:2888:3888
server.3=192.168.15.xxx:2888:3888
```
当配置完成后，还需要在每个节点的数据目录中创建一个文件，叫`myid`，里面写入序号，且这个需要要和该集群上配置的`server.N`的N一致。例如，在`server.1`这台机器上，需要在myid文件中写入`1`。

之后启动集群即可，在zookeeper的目录下执行命令`bin/zkServer.sh start`，如果要前台启动，则执行`bin/zkServer.sh start-foreground`

如果想使用supervisor托管服务，则可以添加配置`/etc/supervisord.d/zookeeper.ini`，写入以下内容：
```yaml
[program:zookeeper]
command=/data/zookeeper/bin/zkServer.sh start-foreground
user=root
autostart=true
autorestart=true
startsecs=10
stdout_logfile=/data/logs/zookeeper.log
redirect_stderr=true
environment=JAVA_HOME=/usr/local/jdk1.8.0_241
```

> 注：如果使用supervisor托管，必须前台启动，即start-foreground，否则会无法正常启动。


> 参考文章
> https://zookeeper.apache.org/doc/r3.4.13/zookeeperOver.html
> https://zookeeper.apache.org/doc/r3.4.13/zookeeperInternals.html
> https://www.cnblogs.com/skyl/p/4854553.html
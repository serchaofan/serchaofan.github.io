---
title: The Linux-HA User's Guide翻译
date: 2018-11-27 09:01:09
tags: [高可用, 翻译, 集群]
---

翻译自[The Linux-HA User’s Guide](http://www.linux-ha.org/doc/users-guide/users-guide.html)

只翻译了有用部分，未翻译获取帮助部分。不确定的地方会保留原文，且并非完全参照原文，会有改动。

<!--more-->

- [前言](#%e5%89%8d%e8%a8%80)
- [Heartbeat 介绍](#heartbeat-%e4%bb%8b%e7%bb%8d)
  - [Heartbeat 作为集群信息层](#heartbeat-%e4%bd%9c%e4%b8%ba%e9%9b%86%e7%be%a4%e4%bf%a1%e6%81%af%e5%b1%82)
  - [组件](#%e7%bb%84%e4%bb%b6)
    - [通信模块](#%e9%80%9a%e4%bf%a1%e6%a8%a1%e5%9d%97)
    - [集群共识成员资格](#%e9%9b%86%e7%be%a4%e5%85%b1%e8%af%86%e6%88%90%e5%91%98%e8%b5%84%e6%a0%bc)
    - [集群管道库](#%e9%9b%86%e7%be%a4%e7%ae%a1%e9%81%93%e5%ba%93)
    - [IPC 库](#ipc-%e5%ba%93)
    - [非阻塞日志守护进程](#%e9%9d%9e%e9%98%bb%e5%a1%9e%e6%97%a5%e5%bf%97%e5%ae%88%e6%8a%a4%e8%bf%9b%e7%a8%8b)
- [安装 Heartbeat](#%e5%ae%89%e8%a3%85-heartbeat)
  - [源码构建安装](#%e6%ba%90%e7%a0%81%e6%9e%84%e5%bb%ba%e5%ae%89%e8%a3%85)
    - [源码构建安装 Cluster Glue](#%e6%ba%90%e7%a0%81%e6%9e%84%e5%bb%ba%e5%ae%89%e8%a3%85-cluster-glue)
      - [Cluster Glue 构建的先决条件](#cluster-glue-%e6%9e%84%e5%bb%ba%e7%9a%84%e5%85%88%e5%86%b3%e6%9d%a1%e4%bb%b6)
      - [下载 Cluster Glue 源码](#%e4%b8%8b%e8%bd%bd-cluster-glue-%e6%ba%90%e7%a0%81)
      - [构建 Cluster Glue](#%e6%9e%84%e5%bb%ba-cluster-glue)
      - [构建包](#%e6%9e%84%e5%bb%ba%e5%8c%85)
    - [源码构建安装 Heartbeat](#%e6%ba%90%e7%a0%81%e6%9e%84%e5%bb%ba%e5%ae%89%e8%a3%85-heartbeat)
      - [Heartbeat 构建的先决条件](#heartbeat-%e6%9e%84%e5%bb%ba%e7%9a%84%e5%85%88%e5%86%b3%e6%9d%a1%e4%bb%b6)
      - [下载 Heartbeat 源码](#%e4%b8%8b%e8%bd%bd-heartbeat-%e6%ba%90%e7%a0%81)
      - [构建 Heartbeat](#%e6%9e%84%e5%bb%ba-heartbeat)
      - [构建包](#%e6%9e%84%e5%bb%ba%e5%8c%85-1)
  - [安装预建包](#%e5%ae%89%e8%a3%85%e9%a2%84%e5%bb%ba%e5%8c%85)
    - [Debian 与 Ubuntu](#debian-%e4%b8%8e-ubuntu)
    - [Fedora，RHEL 与 CentOS](#fedorarhel-%e4%b8%8e-centos)
    - [OpenSUSE 与 SLES](#opensuse-%e4%b8%8e-sles)
- [管理任务](#%e7%ae%a1%e7%90%86%e4%bb%bb%e5%8a%a1)
  - [创建初始 Heartbeat 配置](#%e5%88%9b%e5%bb%ba%e5%88%9d%e5%a7%8b-heartbeat-%e9%85%8d%e7%bd%ae)
    - [ha.cf 文件](#hacf-%e6%96%87%e4%bb%b6)
    - [authkeys 文件](#authkeys-%e6%96%87%e4%bb%b6)
    - [将群集配置传播到群集节点](#%e5%b0%86%e7%be%a4%e9%9b%86%e9%85%8d%e7%bd%ae%e4%bc%a0%e6%92%ad%e5%88%b0%e7%be%a4%e9%9b%86%e8%8a%82%e7%82%b9)
    - [启动 Heartbeat 服务](#%e5%90%af%e5%8a%a8-heartbeat-%e6%9c%8d%e5%8a%a1)
    - [Heartbeat 的更多搭配](#heartbeat-%e7%9a%84%e6%9b%b4%e5%a4%9a%e6%90%ad%e9%85%8d)
  - [升级 Heartbeat 版本](#%e5%8d%87%e7%ba%a7-heartbeat-%e7%89%88%e6%9c%ac)
    - [不使用 CRM 从 Heartbeat2.1 版本升级](#%e4%b8%8d%e4%bd%bf%e7%94%a8-crm-%e4%bb%8e-heartbeat21-%e7%89%88%e6%9c%ac%e5%8d%87%e7%ba%a7)
      - [停止 Heartbeat 服务](#%e5%81%9c%e6%ad%a2-heartbeat-%e6%9c%8d%e5%8a%a1)
      - [升级软件](#%e5%8d%87%e7%ba%a7%e8%bd%af%e4%bb%b6)
      - [使能 Heartbeat 集群使用 Pacemaker](#%e4%bd%bf%e8%83%bd-heartbeat-%e9%9b%86%e7%be%a4%e4%bd%bf%e7%94%a8-pacemaker)
      - [重启 Heartbeat](#%e9%87%8d%e5%90%af-heartbeat)
    - [从开启了 CRM 的 Heartbeat2.1 集群升级](#%e4%bb%8e%e5%bc%80%e5%90%af%e4%ba%86-crm-%e7%9a%84-heartbeat21-%e9%9b%86%e7%be%a4%e5%8d%87%e7%ba%a7)
      - [将集群放置在非托管模式](#%e5%b0%86%e9%9b%86%e7%be%a4%e6%94%be%e7%bd%ae%e5%9c%a8%e9%9d%9e%e6%89%98%e7%ae%a1%e6%a8%a1%e5%bc%8f)
      - [备份 CIB](#%e5%a4%87%e4%bb%bd-cib)
      - [停止 Heartbeat 服务](#%e5%81%9c%e6%ad%a2-heartbeat-%e6%9c%8d%e5%8a%a1-1)
      - [删除 CRM 的相关文件](#%e5%88%a0%e9%99%a4-crm-%e7%9a%84%e7%9b%b8%e5%85%b3%e6%96%87%e4%bb%b6)
      - [重置 CIB](#%e9%87%8d%e7%bd%ae-cib)
      - [升级软件](#%e5%8d%87%e7%ba%a7%e8%bd%af%e4%bb%b6-1)
      - [重启 Heartbeat 服务](#%e9%87%8d%e5%90%af-heartbeat-%e6%9c%8d%e5%8a%a1)
      - [将集群再置为托管模式](#%e5%b0%86%e9%9b%86%e7%be%a4%e5%86%8d%e7%bd%ae%e4%b8%ba%e6%89%98%e7%ae%a1%e6%a8%a1%e5%bc%8f)
      - [升级 CIB 架构](#%e5%8d%87%e7%ba%a7-cib-%e6%9e%b6%e6%9e%84)

# 前言

本指南旨在成为 Heartbeat 集群消息传递层（messaging layer）、Linux-HA 集群资源代理（resource agents）以及 Linux-HA 项目维护的其他集群构建块的用户的权威参考指南。

# Heartbeat 介绍

## Heartbeat 作为集群信息层

Heartbeat 是一个守护程序，为其客户端提供集群基础结构（通信和成员资格）服务。这允许客户端了解其他计算机上对等（peer）进程的存在（或消失），并轻松地与它们交换消息。

为了对用户有用，Heartbeat 守护程序**需要与集群资源管理器（CRM）结合使用**，该集群资源管理器的任务是**启动和停止集群中将要配置高可用的服务（IP 地址，Web 服务器等）**。**通常与 Heartbeat 关联的规范集群资源管理器是 Pacemaker**，这是一种高度可扩展且功能丰富的实现，支持 Heartbeat 和 Corosync 集群消息传递层。

> 直到 Heartbeat 发布 2.1.3 版本，Pacemaker 与 Heartbeat 共同开发，作为 Linux-HA 总体项目的一部分。在此版本发布之后，Pacemaker 项目作为一个单独的项目分离出来并继续开发，同时保持对 Heartbeat 集群消息传递的完全支持。

## 组件

### 通信模块

Heartbeat 通信模块能基本上在任何媒介（无论是否基于 IP）上提供强认证的、本地有序的多播消息传递功能。 Heartbeat 支持通过以下网络类型进行群集通信：

- 单播 UDP over IPv4
- 广播 UDP over IPv4
- 多播 UDP over IPv4
- 串行链路通信

> 请考虑一些关于串行链路连接的重要注意事项（参见`ha.cf`手册页，`man ha.cf`）。作为一般规则：如有疑问，应避免串行链接。

Heartbeat 可以在不到半秒的时间内可靠地检测到节点故障。如果配置为执行此操作，它将向系统监视程序计时器（watchdog timer）注册。

心跳层（heartbeat layer）有一个 API，提供以下服务类：

- 集群内通信 - 向集群节点发送和接收数据包

- 配置查询
- 连接信息（当前节点可以监听数据包的人） - 用于查询和状态更改通知
- 基本的团体成员（group membership）服务

### 集群共识成员资格

CCM（Cluster Consensus Membership 集群共识成员资格）提供强大连接的集群共识成员资格服务。它确保计算成员资格中的每个节点都可以与具有相同成员资格的其他任意节点进行通信。 CCM 实现 OCF（Open Connectivity Foundation 开放连接基金会）的 draft membership API 和 SAF AIS membership API。通常，它会在亚秒级时间内计算成员资格。

### 集群管道库

集群管道库（Cluster Plumbing Library）是一组非常有用的函数，它们提供了许多主要组件使用的各种服务。该库提供的一些主要对象包括：

- 压缩 API（带有底层压缩插件）
- 非阻塞日志记录 API
- 面向持续运行服务的内存管理
- 分层名称 - 值对消息传递工具，提升可移植性和版本升级兼容性（还提供可选的消息压缩功能）
- 信号统一（Signal Unification） - 允许信号显示为主循环事件（mainloop events）
- 核心备份（core dump）管理实体 - 在所有情况下以统一的方式促进核心备份的完成
- 定时器（类似 glib mainloop 定时器 - 但它们即使在时钟跳转时也可以工作）
- 子进程管理 - 子进程的死亡导致进程对象的调用，具有可配置的死亡子进程（death-of-child）消息
- 触发器（由软件触发的任意事件）
- 实时管理 - 设置和取消设置高优先级，并锁定到进程的内存属性
- 64 位 HZ 粒度（64-bit HZ-granularity）时间操作（longclock_t）
- 出于安全目的的用户标识管理，用于一些需要 root 权限的进程
- IPC、普通文件描述符、信号等的 mainloop 集成。这意味着所有这些不同的事件源都被一致地管理和分配

### IPC 库

所有进程间通信都使用非常通用的 IPC 库执行，该库使用灵活的队列策略提供对 IPC 的非阻塞访问，并包括集成流控制。此 IPC API 不需要套接字，但当前可用的实现使用了 UNIX（本地）域套接字。

此 API 还包括内置的对等进程身份验证和授权，并且可以移植到大多数类似 POSIX 的操作系统。虽然不需要在这些 API 中使用 Glib 主循环（mainloop），但 Heartbeat 提供了与 mainloop 的简单方便的集成。

### 非阻塞日志守护进程

logd 是 Heartbeat 的日志记录守护程序，能够记录到 syslog 守护程序、文件或两者。 logd 永远不会阻塞，相反，它会删除时间过久的消息。

一旦它能够再次输出消息，logd 就会打印删除的消息计数。队列大小可以在整体上进行控制，也可以在每个应用程序上进行控制。

# 安装 Heartbeat

## 源码构建安装

构建和安装 Heartbeat 集群消息传递层以需要构建以下包：

- heartbeat
- 包含 Heartbeat 本地资源管理器（LRM）和 STONITH 插件的 cluster-glue 包

由于 Heartbeat 对 cluster-glue 具有构建依赖性，因此在构建和安装 heartbeat 之前，必须先构建和安装 cluster-glue。

### 源码构建安装 Cluster Glue

#### Cluster Glue 构建的先决条件

构建 Cluster Glue 需要在构建系统上存在以下工具和库：

- C 编译器（通常是 gcc）和相关的 C 开发库
- flex 扫描器生成器和 bison 解析编译器
- net-snmp 开发库，用于启用 SNMP 相关功能
- OpenIPMI 开发库，用于启用 IPMI 相关功能
- Python

> 此列表适用于默认软件配置。如果使用非标准选项配置源，则可能适用其他依赖项。

#### 下载 Cluster Glue 源码

有几个选项可用于检索 Cluster Glue 源代码，以便在目标系统上本地构建。

**下载发布的 tar 包**

下载已发布的 Heartbeat 版本的压缩 tar 包就相当于从 Mercurial 源代码存储库中获取标记的快照。发布标签遵循 glue-x.y.z 格式，其中 x.y.z 是您要下载的 Cluster Glue 的发布版本。

例如，如果想要下载 1.0.1 版本，那么正确的命令是：

```
# wget http://hg.linux-ha.org/glue/archive/glue-1.0.1.tar.bz2
# tar -vxjf glue-1.0.1.tar.bz2
```

**下载最新的 Mercurial 快照**

最新的开发代码始终在 Mercurial 存储库中作为最新修订版提供。

要下载自动生成的 tarball，请使用以下命令：

```
# wget http://hg.linux-ha.org/glue/archive/tip.tar.bz2
# tar -vxjf tip.tar.bz2
```

**检查 Mercurial 源**

如果您在本地安装了 Mercurial 实体程序，则可以使用以下方法。通过克隆检查源码：

```
$ hg clone http://hg.linux-ha.org/glue cluster-glue
requesting all changes
adding changesets
adding manifests
adding file changes
added 12491 changesets with 34830 changes to 2632 files
updating working directory
356 files updated, 0 files merged, 0 files removed, 0 files unresolved
```

#### 构建 Cluster Glue

构建 Cluster Glue 是一个广泛使用 GNU Autotools 的自动化过程。在同一台机器上构建和安装时，通常只需要以下命令：

```
$ ./autogen.sh
$ ./configure
$ make
$ sudo make install
```

> `autogen.sh`脚本是`automake`，`autoheader`，`autoconf`和`libtool`的安装脚本

支持许多配置选项，您可以调整其中一些以优化系统的 Heartbeat。要检索配置选项列表，可以使用`--help`选项调用`configure`。因此，定制构建可以包括以下步骤：

```
$ ./autogen.sh
$ ./configure --help
$ ./configure configuration-options
$ make
$ sudo make install
```

您可能希望设置的一些典型配置选项是`--prefix`， `- -sysconfdir`和`--localstatedir`，如下例所示：

```
$ ./autogen.sh
$ ./configure --help
$ ./configure --prefix=/usr --sysconfdir=/etc --localstatedir=/var
$ make
$ sudo make install
```

#### 构建包

**RPM 包**

SuSE 和红帽发行版都在 CLuster Glue 的源码包中提供了 RPM 规范文件：

- `cluster-glue-suse.spec`应该用于 OpenSUSE 和 SLES 安装
- `cluster-glue-fedora.spec`适用于 Fedora，RHEL 和 CentOS

**Debian 包**

Cluster Glue 的 Debian 包保存在`alioth.debian.org`上的 Mercurial 存储库中。因此，不是从上游 Mercurial 存储库克隆或下载，而是使用在 alioth 上托管的存储库。

从 alioth 存储库中解压缩源码包后，只需从源码目录（source tree）的顶部（根目录）调用`dpkg-buildpackage` - 就像使用任何其他 Debian 软件包一样。

### 源码构建安装 Heartbeat

#### Heartbeat 构建的先决条件

构建 Heartbeat 需要存在以下的工具和库：

- C 编译器（通常是 gcc）和相关的 C 开发库
- flex 扫描器生成器和 bison 解析编译器
- net-snmp 开发库，用于启用 SNMP 相关功能
- OpenIPMI 开发库，用于启用 IPMI 相关功能
- Python
- cluster-glue 开发头

#### 下载 Heartbeat 源码

**下载发行 tar 包**

下载一个 Heartbeat 的发行版本的压缩 tar 包就相当于从 Mercurial 源代码存储库中获取标记的快照。发布标签遵循 STABLE-x.y.z 格式，其中 x.y.z 是您要下载的 Heartbeat 的发布版本。

例如，如果项下载 3.0.4 的发布版本，可以执行以下语句：

```
# wget http://hg.linux-ha.org/dev/archive/STABLE-3.0.4.tar.bz2
# tar -vxjf STABLE-3.0.4.tar.bz2
```

**下载最新 Mercurial 快照**

最新开发代码能在 Mercurial 库中获取。

从 tip 自动获取 tar 包，可执行：

```
# wget http://hg.linux-ha.org/dev/archive/tip.tar.bz2
# tar -vxjf tip.tar.bz2
```

**检查 Mercurial 源**

如果您在本地安装了 Mercurial 实体程序，则可以使用以下方法。通过克隆检查源码：

```
$ hg clone http://hg.linux-ha.org/dev heartbeat-dev
requesting all changes
adding changesets
adding manifests
adding file changes
added 12491 changesets with 34830 changes to 2632 files
updating working directory
356 files updated, 0 files merged, 0 files removed, 0 files unresolved
```

#### 构建 Heartbeat

构建 Heartbeat 是一个广泛使用 GNU Autotools 的自动化过程。在同一台机器上构建和安装时，通常只需要以下命令：

```
$ ./bootstrap
$ ./configure
$ make
$ sudo make install
```

支持大量的配置选项,你可能调整其中的一些优化系统的 Heartbeat。检索配置选项的列表,您可以调用配置`--help`选项。因此,一个定制的构建可能包含以下步骤:

```
$ ./bootstrap
$ ./configure --help
$ ./configure <configuration-options>
$ make
$ sudo make install
```

一些典型的配置选项,您可能希望设置`--prefix`,`--sysconfdir`和`--localstatedir`,如本例所示:

```
$ ./bootstrap
$ ./configure --help
$ ./configure --prefix=/usr --sysconfdir=/etc --localstatedir=/var
$ make
$ sudo make install
```

#### 构建包

**RPM 包**

SuSE 和红帽发行版都在 CLuster Glue 的源码包中提供了 RPM 规范文件：

- `heartbeat-suse.spec`应该用于 OpenSUSE 和 SLES 安装
- `heartbeat-fedora.spec`适用于 Fedora，RHEL 和 CentOS

**Debian 包**

Heartbeat 的 Debian 包保存在`alioth.debian.org`上的 Mercurial 存储库中。因此，不是从上游 Mercurial 存储库克隆或下载，而是使用在 alioth 上托管的存储库。

从 alioth 存储库中解压缩源码包后，只需从源码目录（source tree）的顶部（根目录）调用`dpkg-buildpackage` - 就像使用任何其他 Debian 软件包一样。

## 安装预建包

Cluster Glue 和 Heartbeat 可在许多平台上作为预构建的二进制包提供，包括：

- Debian（完全包含在 squeeze 和向上，后端包可用于 lenny）
- Ubuntu（自 lucid）
- Fedora（自版本 12）
- OpenSUSE（自版本 11）

本节介绍在这些平台上安装二进制包所需的步骤。

### Debian 与 Ubuntu

在 Debian 和 Ubuntu 上安装 cluster-glue 和 heartbeat 包是一个简单的过程。 假设您为 APT 配置了正确的软件包源，请使用以下命令安装这两个软件包：

```
aptitude install heartbeat cluster-glue
```

由于您很可能还希望安装 Pacemaker（超出本手册的范围），因此也可以通过发出以下命令来执行此操作：

```
aptitude install cluster-agents pacemaker
```

### Fedora，RHEL 与 CentOS

在 Red Hat 平台上，您可以使用 YUM 包管理器安装 cluster-glue 和 heartbeat 包。 假设您在`/etc/yum.repos.d/`中配置了正确的软件包源，请使用以下命令安装这两个软件包：

```
yum install heartbeat cluster-glue
```

由于您很可能还希望安装 Pacemaker（超出本手册的范围），因此也可以通过发出以下命令来执行此操作：

```
yum install resource-agents pacemaker
```

### OpenSUSE 与 SLES

在 SUSE 平台上，使用 Zypper 软件包管理器安装 cluster-glue 和 heartbeat 软件包。 假设您已配置正确的软件包存储库，请使用以下命令安装这两个软件包：

```
zypper install heartbeat cluster-glue
```

由于您很可能还希望安装 Pacemaker（超出本手册的范围），因此也可以通过发出以下命令来执行此操作：

```
zypper install resource-agents pacemaker
```

# 管理任务

## 创建初始 Heartbeat 配置

对于任何 Heartbeat 群集，必须提供以下配置文件：

- `/etc/ha.d/ha.cf`：全局群集配置文件
- `/etc/ha.d/authkeys` ：包含用于相互节点身份验证的密钥的文件

### ha.cf 文件

以下示例是一个小而简单的`ha.cf`文件：

```
autojoin none
mcast bond0 239.0.0.43 694 1 0
bcast eth2
warntime 5
deadtime 15
initdead 60
keepalive 2
node alice
node bob
pacemaker respawn
```

将`autojoin`设置为`none`将禁用集群节点自动发现，并要求使用节点选项显式列出群集节点。 这加速了具有固定少量节点的集群的启动。

此示例假定`bond0`是集群与共享网络的接口，并且`eth2`是专用于两个节点之间的 DRBD 复制的接口。 因此，`bond0`可以用于多播心跳，而在`eth2`广播上是可行的，因为`eth2`不是共享网络。

下一个选项配置节点故障检测。它们设置的时间是 Heartbeat 发出警告表示不再可用的对等节点可能已死（warntime），Heartbeat 认为节点已确认死亡（deadtime）的时间，以及等待其他节点在集群启动时加入的最长时间（initdead）。`keepalive`设置发送 Heartbeat keep-alive 数据包的时间间隔。所有这些选项单位都是秒。

节点选项标识集群成员。此处列出的选项值必须与`uname -n`给出的集群节点的确切主机名匹配。

`pacemaker respawn`启用 Pacemaker 集群管理器，并确保在发生故障时自动重启 Pacemaker。

> 在 Heartbeat 3.0.4 版之前，pacemaker 关键字被命名为 crm。 较新版本仍将旧名称保留为兼容性别名，但 pacemaker 是首选写法。

### authkeys 文件

`/etc/ha.d/authkeys`包含用于相互集群节点身份验证的预共享机密。 它应该只能由 root 读取并遵循以下格式：

```
auth <num>
<num> <algorithm> <secret>
```

`num`是一个简单的键索引，从 1 开始。通常，您的 authkeys 文件中只有一个键。

`algorithm`是使用的签名算法。 你可以使用 md5 或 sha1; 不推荐使用 crc（简单的循环冗余校验，不安全）。

`secret`是实际的身份验证密钥。

您可以通过以下 shell，使用生成的密钥创建一个 authkeys 文件：

```
( echo -ne "auth 1\n1 sha1 "; \
  dd if=/dev/urandom bs=512 count=1 | openssl md5 ) \
  > /etc/ha.d/authkeys
chmod 0600 /etc/ha.d/authkeys
```

### 将群集配置传播到群集节点

为了传播`ha.cf`和`authkeys`配置文件的内容，您可以使用`ha_propagate`命令，您可以使用该命令调用

```
/usr/lib/heartbeat/ha_propagate
```

或

```
/usr/lib64/heartbeat/ha_propagate
```

此程序将使用`scp`将配置文件复制到`/etc/ha.d/ha.cf`中列出的任何节点。 之后它还将使用`ssh`连接到节点并发出`chkconfig heartbeat on`，以便在系统启动时启用 Heartbeat 服务。

### 启动 Heartbeat 服务

Heartbeat 服务的启动方式与计算机上的任何其他系统服务一样。 您可能正在使用以下命令之一，具体取决于您的系统平台：

```
/etc/init.d/heartbeat start

service heartbeat start

rcheartbeat start
```

通过 ha.cf 中的 pacemaker 输入，Heartbeat 现在将启动 Pacemaker 守护程序（由于历史原因而命名为 crmd）以及其余服务。 几秒钟后，您应该能够检测进程表中的 Heartbeat 进程：

```
# ps -AHfww | grep heartbeat
root      2772  1639  0 14:27 pts/0    00:00:00         grep heartbeat
root      4175     1  0 Nov08 ?        00:37:57   heartbeat: master control process
root      4224  4175  0 Nov08 ?        00:01:13     heartbeat: FIFO reader
root      4227  4175  0 Nov08 ?        00:01:28     heartbeat: write: bcast eth2
root      4228  4175  0 Nov08 ?        00:01:29     heartbeat: read: bcast eth2
root      4229  4175  0 Nov08 ?        00:01:35     heartbeat: write: mcast bond0
root      4230  4175  0 Nov08 ?        00:01:32     heartbeat: read: mcast bond0
102       4233  4175  0 Nov08 ?        00:03:37     /usr/lib/heartbeat/ccm
102       4234  4175  0 Nov08 ?        00:15:02     /usr/lib/heartbeat/cib
root      4235  4175  0 Nov08 ?        00:17:14     /usr/lib/heartbeat/lrmd -r
root      4236  4175  0 Nov08 ?        00:02:48     /usr/lib/heartbeat/stonithd
102       4237  4175  0 Nov08 ?        00:00:54     /usr/lib/heartbeat/attrd
102       4238  4175  0 Nov08 ?        00:08:32     /usr/lib/heartbeat/crmd
102       5724  4238  0 Nov08 ?        00:04:47       /usr/lib/heartbeat/pengine
```

最后，您还应该能够通过 Pacemaker 的`crm_mon`命令确认群集正在运行：

```
# crm_mon -1
============
Last updated: Mon Dec 13 14:29:36 2010
Stack: Heartbeat
Current DC: alice (083146b9-6e26-4ac8-a705-317095d0ba57) - partition with quorum
Version: 1.0.9-74392a28b7f31d7ddc86689598bd23114f58978b
2 Nodes configured, unknown expected votes
24 Resources configured.
============

Online: [ alice bob ]
```

### Heartbeat 的更多搭配

现在您已经有了可用的 Heartbeat 配置，您将需要继续配置 Pacemaker 并添加群集资源。

以下文件供您阅读：

- [Clusters From Scratch](http://clusterlabs.org/pacemaker/doc/en-US/Pacemaker/1.1/html/Clusters_from_Scratch/)是配置 Pacemaker 集群的绝佳指南。 该文档主要涵盖了 Corosync 上的 Pacemaker，但从其“使用 Pacemaker 工具”一章开始，同样适用于 Heartbeat 集群。

- [DRBD 用户指南](http://www.drbd.org/users-guide/)有一章专门介绍 DRBD 与 Pacemaker 集群的集成。

- LINBIT 网站提供了几个涵盖各种应用的 Heartbeat / Pacemaker 集群的技术指南。

## 升级 Heartbeat 版本

### 不使用 CRM 从 Heartbeat2.1 版本升级

对于不使用 CRM 的 Heartbeat 2.1 集群（即，使用 haresources 文件配置的集群），升级到 3.0 涉及将当前配置转换为适合 Pacemaker 的配置。

> 注：此升级过程确实会导致应用程序停机。 但是，在正确规划，测试和执行升级时，此停机时间为几分钟，甚至几秒（取决于配置）。

#### 停止 Heartbeat 服务

您应该在当前备用节点上开始升级过程，即当前未运行任何资源的群集节点。 如果您的群集正在使用主动-主动（active-active）配置（两个节点都在运行资源），请选择其中一个主机，并发出以下命令将所有资源传输到对等节点：

```
# hb_standby
```

然后，仅在该节点上，停止 Heartbeat 服务：

```
# /etc/init.d/heartbeat stop
```

#### 升级软件

在升级时，重要的是要记住单个的 Heartbeat 2.1 树已经分成模块化部分。 因此，您将用三个独立的软件替换 Heartbeat：Cluster Glue，Pacemaker 和 Heartbeat 3，它只包含群集消息传递层。

- 从源代码升级：在您安装 Heartbeat 2.1 的解压缩归档文件中，运行`make uninstall`。 然后，安装 Cluster Glue 和 Heartbeat。
- 使用本地构建的软件包升级：手动安装软件包时，首先卸载 heartbeat 软件包。 然后安装 cluster-glue，heartbeat3，resource-agents 和 pacemaker。
- 使用软件包存储库升级：使用 APT，YUM 或 Zypper 存储库进行升级时，您应该只能运行 heartbeat 版本 3 和 pacemaker 的`install`命令，并且将自动解析依赖项。

此时不要重新启动 Heartbeat 服务。

#### 使能 Heartbeat 集群使用 Pacemaker

现在必须指示群集消息传递层在群集启动时启动 Pacemaker。 为此，请添加：

`crm respawn`到您的`ha.cf`配置文件。

完成 ha.cf 修改后，将文件复制到对等节点。

#### 重启 Heartbeat

您的群集现在可以在启用 Pacemaker 的模式下重新启动。 为此：

1. 运行`/etc/init.d/heartbeat`停止在仍处于活动状态的节点上。 这将关闭您的群集资源。
2. 在备用节点（创建 CIB 的节点）上运行`/etc/init.d/heartbeat`。 这将启动本地 Heartbeat 实例和 Pacemaker，并等待其他群集节点加入。
3. 在另一个节点上运行`/etc/init.d/heartbeat start`。 这将启动本地 Heartbeat 实例和 Pacemaker，自动获取 CIB 并启动应用程序。

### 从开启了 CRM 的 Heartbeat2.1 集群升级

本节概述了将启用了内置 CRM 的 Heartbeat 2.1 群集升级到带有 Pacemaker 的 Heartbeat 3.0 所需的步骤。

> 注：如果计划和执行得当，升级过程可以在几分钟内完成，无需停机。 强烈建议在尝试生产集群升级之前阅读并理解本节中概述的步骤。
> 必须以 root 身份运行本节中说明的所有命令。 不要在所有群集节点上并行执行各个步骤。 而是在继续下一个节点之前完成每个节点上的过程。

#### 将集群放置在非托管模式

通过此步骤，群集暂时放弃对其资源的控制。 这意味着群集在升级期间不再监视其节点或资源，并且在此期间不会纠正应用程序或节点故障。 但是，当前正在运行的资源将继续运行。

```
# crm_attribute -t crm_config -n is_managed_default -v false
```

在大多数配置中，单个资源不单独设置`is_managed`属性，因此群集范围的属性`is_managed_default`适用于所有这些属性。

如果在您的特定配置中您确实拥有设置了此属性的资源，则应将其删除以确保默认值适用：

```
# crm_resource -t primitive -r <resource-id> -p is_managed -D
```

#### 备份 CIB

此时，保存群集信息库（CIB）的副本非常重要。 要保存的 CIB 存储在名为`cib.xml`的文件中，该文件通常位于`/var/lib/heartbeat/crm`中。

```
# cp /var/lib/heartbeat/crm/cib.xml ~
```

您只需在当前连接到群集的一个节点上执行此步骤。 不要删除此文件，以后会恢复。

#### 停止 Heartbeat 服务

您现在可以使用`/etc/init.d/heartbeat stop`或首选命令停止 Heartbeat 以停止分发上的系统服务（`service heartbeat stop`，`rcheartbeat stop`等）。

如果您运行受关闭错误影响的旧版 Heartbeat，则优雅关闭 crmd 将无法在非托管模式下正常运行。

在这种情况下，使用上述命令启动正常服务关闭后，请手动终止 crmd 进程：

- 使用`ps -AHfww`检索 crmd 的进程 ID;
- 用 TERM 信号杀死 crmd。

#### 删除 CRM 的相关文件

> 注：在继续本节之前，请验证是否已在其中一个群集节点上创建了 CIB 的备份副本

您现在应该从节点擦除本地 CRM 相关文件。 为此，请从 CRM 存储 CIB 信息的目录中删除所有文件，通常为`/var/lib/heartbeat/crm`。

```
# rm /var/lib/heartbeat/crm/*
```

#### 重置 CIB

> 注：如果 Heartbeat 仍在所有群集节点上停止，并且所有群集节点都已擦除其 CIB 内容，则只应执行此步骤。 如果仍有剩余节点具有剩余 CIB 配置，按“删除 CRM 的相关文件”中所述进行操作。

恢复 CIB 意味着将“备份 CIB”中描述的 CIB 备份复制到`/var/lib/heartbeat/crm`目录。

```
# cp ~/cib.xml /var/lib/heartbeat/crm/cib.xml
# chown hacluster:haclient /var/lib/heartbeat/crm/cib.xml
# chmod 0600 /var/lib/heartbeat/crm/cib.xml
```

您必须仅在一个节点上执行此步骤，即您要在其上升级群集软件的第一个节点。 在所有其他节点上，`/var/lib/heartbeat/crm`目录必须保持为空——Pacemaker 会自动分发 CIB。

#### 升级软件

在升级时，重要的是要记住单个的 Heartbeat 2.1 树已经分成模块化部分。 因此，您将用三个独立的软件替换 Heartbeat：Cluster Glue，Pacemaker 和 Heartbeat 3，它只包含群集消息传递层。

- 从源代码升级：在您安装 Heartbeat 2.1 的解压缩归档文件中，运行`make uninstall`。 然后，安装 Cluster Glue 和 Heartbeat。
- 使用本地构建的软件包升级：手动安装软件包时，首先卸载 heartbeat 软件包。 然后安装 cluster-glue，heartbeat3 的包，resource-agents 和 pacemaker。
- 使用软件包存储库升级：使用 APT，YUM 或 Zypper 存储库进行升级时，您应该只能运行 heartbeat3 和 pacemaker 的`install`命令，并且将自动解析依赖项。

如果这是集群中要升级的最后一个节点，并且软件包升级后软件包管理系统未重新启动 Heartbeat 服务，则现在应继续“重新启动 Heartbeat 服务”。 否则，您应移至下一个节点，然后按“停止 Heartbeat 服务”和“升级软件”中所述进行操作。

#### 重启 Heartbeat 服务

> 注：如果您的软件包管理系统在安装后自动重新启动 Heartbeat 服务，则可以省略此步骤。

首先，使用`/etc/init.d/heartbeat start`在恢复 CIB 的节点上重新启动 Heartbeat（请参见“重置 CIB”）。 然后，在剩余的群集节点上重复此命令。 此时，

- 群集仍处于非托管模式（意味着它不会启动，停止或监视任何资源）
- 集群在其节点之间重新分配旧 CIB

- 群集仍在使用升级前的 CIB 架构

#### 将集群再置为托管模式

升级群集软件后，建议将群集恢复为托管模式：

```
# crm_attribute -t crm_config -n is_managed_default -v true
```

#### 升级 CIB 架构

虽然升级后的集群理论上可以无限期地在升级前的 CIB 模式上运行，但强烈建议将 CIB 升级到当前模式。 为此，请在重新建立所有节点之间的集群通信后运行以下命令：

```
# cibadmin --upgrade --force
```

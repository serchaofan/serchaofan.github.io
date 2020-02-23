---
title: Docker-Swarm学习笔记
date: 2018-11-06 12:34:01
tags: [docker, docker swarm, 云计算, 集群, 容器编排]
categories: [云计算]
---

- [Docker Swarm 概述](#docker-swarm-%e6%a6%82%e8%bf%b0)
  - [负载均衡](#%e8%b4%9f%e8%bd%bd%e5%9d%87%e8%a1%a1)
- [swarm 操作](#swarm-%e6%93%8d%e4%bd%9c)
  - [创建与查看服务](#%e5%88%9b%e5%bb%ba%e4%b8%8e%e6%9f%a5%e7%9c%8b%e6%9c%8d%e5%8a%a1)
  - [扩缩容](#%e6%89%a9%e7%bc%a9%e5%ae%b9)
  - [更新与回滚](#%e6%9b%b4%e6%96%b0%e4%b8%8e%e5%9b%9e%e6%bb%9a)
  - [DRAIN 可用性](#drain-%e5%8f%af%e7%94%a8%e6%80%a7)
  - [数据持久化](#%e6%95%b0%e6%8d%ae%e6%8c%81%e4%b9%85%e5%8c%96)
  - [路由网格（routing mesh）](#%e8%b7%af%e7%94%b1%e7%bd%91%e6%a0%bcrouting-mesh)
  - [服务发现与负载均衡](#%e6%9c%8d%e5%8a%a1%e5%8f%91%e7%8e%b0%e4%b8%8e%e8%b4%9f%e8%bd%bd%e5%9d%87%e8%a1%a1)
    - [高可用](#%e9%ab%98%e5%8f%af%e7%94%a8)
  - [配置文件存储](#%e9%85%8d%e7%bd%ae%e6%96%87%e4%bb%b6%e5%ad%98%e5%82%a8)
- [实战一-LNMP 搭建](#%e5%ae%9e%e6%88%98%e4%b8%80-lnmp-%e6%90%ad%e5%bb%ba)

<!--more-->

# Docker Swarm 概述

Docker Swarm 用于跨主机部署管理 docker 集群。从 1.12 版本开始就集成在 docker engine 中，并称为 swarm mode。swarm 已内置 kv 存储功能，不再需要外置的 etcd，内置 Overlay 网络，服务发现，负载均衡。

当 Docker Engine 初始化了一个 swarm 或者加入到一个存在的 swarm 时，它就启动了 swarm mode。没启动 swarm mode 时，Docker 执行的是容器命令；运行 swarm mode 后，Docker 增加了编排 service 的能力。Docker 允许在同一个 Docker 主机上既运行 swarm service，又运行单独的容器。

Swarm 特点

- Docker Engine 集成了 swarm
- 去中心化设计：Swarm 角色分为 Manager 和 Worker，Manager 的故障不会影响应用使用
- 扩容缩容：可声明每个服务运行的容器数量，会自动添加或删除容器数，以调整到期望的状态
- 期望状态协调：Manager 节点监控集群状态，自动调整当前状态与期望状态之间的差异。
- 多主机网络：可为服务指定 Overlay 网络，党初始化或更新应用程序时，Manager 会自动为 Overlay 网络上的容器分配 IP 地址
- 服务发现：Manager 为集群的每个服务分配唯一的 DNS 记录和负载均衡 VIP，可通过 Swarm 内置的 DNS 服务器查询集群中每个运行的容器
- 安全传输：Swarm 中每个节点使用 TLS 互相验证和加密，确保节点间安全通信
- 滚动更新：升级时，逐步将应用服务更新到节点，若出现问题，可以将任务回滚到先前版本

Swarm 术语

- **node**：swarm 中每个 docker engine 都是一个 node，有两种类型：**manager**和**worker**

- **manager node**负责执行编排和集群管理工作，保持并维护 swarm 处于期望的状态。manager node 会将部署任务拆解并分配给一个或多个 worker node 完成部署。Manager 节点默认也作为 worker 节点，不过可以将其配置成 manager-only node，让其专职负责编排和集群管理工作。

  swarm 中如果有多个 manager node，它们会自动协商并选举出一个 leader 执行编排任务。

- **worker node** 接收并执行管理节点分配的任务，并会定期向 manager node 报告自己的状态和它正在执行的任务的状态

- **service**与**task**：定义了 worker node 上要执行的任务。swarm 的主要编排任务就是保证 service 处于期望的状态下。

  任务 Task 是 swarm 中的最小原子调度单位。Services 是一组 task 的集合，service 定义了这些 task 的属性。

swarm 的工作流程：

1. Client 发送请求给 Swarm
2. Swarm 处理并发送给相应 docker node
3. docker node 执行操作并返回结果

services 有两种模式：

- replicated services：按照一定规则在各个 worker node 上运行指定个数的 tasks，和 k8s 的 replicate、marathon 中的 instance 概念一样。

- global services：每个 woker node 上运行一个此 task

{% asset_img 0.png %}

Swarm 调度模块

- **`filter`**：使用过滤器挑出符合条件的节点，并从中选出最优节点。有以下过滤器：

  - Constraints：
  - Affinity：
  - Dependency：
  - Health filter：
  - Ports filter：

- **`strategy`**：使用策略挑出最优节点。有以下策略：
  - Binpack：
  - Spread：
  - Random：

服务发现：分为三种场景

- Ingress：
- Ingress+Link：
- 自定义网络：

## 负载均衡

swarm manager 使用**入口负载均衡（Ingress load balance）**来发布向集群外部提供的服务。swarm manager 可以**自动为已发布的端口（published port）分配服务**，也可以为服务配置发布端口（Published Port）。可以指定任何未使用的端口，如果未指定端口，则 swarm manager 会为服务分配 30000-32767 范围内的端口。

外部组件（例如云负载平衡器）可以访问集群中任何节点的发布端口上的服务，无论该节点当前是否正在运行该服务的任务。集群中的所有节点都将入口连接到正在运行的任务实例。

Swarm 模式有一个内部 DNS 组件，可以自动为 swarm 中的每个服务分配一个 DNS 条目。swarm manager 使用内部负载均衡（Internal load balance）来根据服务的 DNS 名称在集群内的服务之间分发请求。

# swarm 操作

实验环境：

- Manager：本机 192.168.43.106
- Worker：atom-1 172.16.246.138
- Worker：atom-2 172.16.246.139

## 创建与查看服务

初始化一个 swarm，`docker swarm init --advertise-addr IP地址`，指定发布的地址。

```
> docker swarm init --advertise-addr 192.168.43.106
Swarm initialized: current node (w4wogxb10dhxtcvh3ljx5ltqh) is now a manager.
To add a worker to this swarm, run the following command:
    docker swarm join --token XXXXXX 192.168.43.106:2377
```

在 atom-1、atom-2 上执行提示的`docker swarm join`命令。然后在 Manager 上执行`docker node ls`查看节点，集群已创建成功。

> 如果`docker swarm join`的命令忘记了，则可以在 Manager 上执行`docker swarm join-token worker`查看

```
> docker node ls
ID                            HOSTNAME            STATUS              AVAILABILITY        MANAGER STATUS      ENGINE VERSION
7r0pg83uetbwp1jc2ysgkitj5     atom-1              Ready               Active                                  1.13.1
e3fnuzkgzjhxqg748us07pb48     atom-2              Ready               Active                                  1.13.1
w4wogxb10dhxtcvh3ljx5ltqh *   gutianyi-PC         Ready               Active              Leader              18.06.1-ce
```

`docker node`命令。专门对 swarm 节点操作

```
docker node COMMAND
  demote      降级一个或多个节点（从Manager降为Worker）
  inspect     显示一个或多个节点的详细信息。输出为Json格式，或者添加--pretty会重新排版，便于查看
  ls          显示所有节点
  promote     提升一个或多个节点（从Worker升为Manager）
  ps          列出在一个或多个节点上运行的任务（tasks），默认为当前节点
  rm          从集群中删除指定节点（通过ID）
  update      更新一个节点
```

`docker service`命令。管理 docker 服务。

```
docker service COMMAND
  create      创建一个服务
  inspect     显示一个或多个服务的详细信息
  logs        获取一个服务或任务的日志
  ls          显示所有服务
  ps          显示指定服务的任务
  rm          删除一个或多个服务
  rollback    回滚一个服务的配置
  scale       扩展一个或多个复制的服务
  update      更新一个服务
```

在 Manager 上创建服务`docker service create --replicas 2 --name busybox busybox /bin/ping "baidu.com"`。其中`--replicas`表示期望状态的实例个数，由于 busybox 一定要参数任务，否则服务无法正常启动，所以在后面加上了 ping 的任务。

```
> docker service ls
ID                  NAME                MODE                REPLICAS            IMAGE               PORTS
p519w5pjai5y        busybox             replicated          2/2                 busybox:latest
# MODE为replicated说明会根据调度算法动态调度节点
```

若暂时未添加参数，未能成功启动：`docker service create --replicas 2 --name busybox_1 busybox`，也可以通过`docker service update`对服务添加参数

```
> docker service update busybox_1 --args "/bin/ping baidu.com"
busybox_1
overall progress: 2 out of 2 tasks
1/2: running
2/2: running
verify: Service converged
```

可以通过`docker service ps SERVICE`查看服务的任务，可以查看到该服务在哪个节点 NODE 上运行。

```
> docker service ps busybox
ID                  NAME                IMAGE               NODE                DESIRED STATE       CURRENT STATE                ERROR                              PORTS
r9eogiyc0xkl        busybox.1           busybox:latest      gutianyi-PC         Running             Running 20 minutes ago
5z2rfa8xiuvq         \_ busybox.1       busybox:latest      gutianyi-PC         Shutdown            Failed 20 minutes ago        "task: non-zero exit (1)"
txz74rterci8         \_ busybox.1       busybox:latest      gutianyi-PC         Shutdown            Failed 21 minutes ago        "task: non-zero exit (1)"
```

还可以通过`-f`指定满足条件的条目

```
> docker service ps busybox -f "desired-state=running"  #只查看正在运行的任务
ID                  NAME                IMAGE               NODE                DESIRED STATE       CURRENT STATE               ERROR               PORTS
r9eogiyc0xkl        busybox.1           busybox:latest      gutianyi-PC         Running             Running 22 minutes ago
axvqvs5wuvw4        busybox.2           busybox:latest      gutianyi-PC         Running             Running about an hour ago
```

## 扩缩容

可通过`docker service scale SERVICE=REPLICAS`进行扩容或缩容

```
> docker service scale busybox=3        # 将busybox的replicas扩容到3台
busybox scaled to 3
overall progress: 3 out of 3 tasks
1/3: running   [==================================================>]
2/3: running   [==================================================>]
3/3: running   [==================================================>]
verify: Service converged

> docker service ls
ID                  NAME                MODE                REPLICAS            IMAGE               PORTS
p519w5pjai5y        busybox             replicated          3/3                 busybox:latest
```

## 更新与回滚

创建 web 服务，设置定时更新策略

```
docker service create \
  --name web \
  --replicas 3 \
  --update-delay 2s \         # 任务升级间的间隔
  --update-parallelism 2 \    # 同时更新的最大任务数
  nginx:1.12                  # 使用nginx:1.12镜像

docker service ps web
ID                  NAME                IMAGE               NODE                DESIRED STATE       CURRENT STATE            ERROR                              PORTS
p1w8ee6fhrt8        web.1               nginx:1.12          gutianyi-PC         Running             Running 13 minutes ago
gv5jm09qsvq7        web.2               nginx:1.12          atom-2              Running             Running 13 hours ago
600wh1qru5f5        web.3               nginx:1.12          atom-1              Running             Running 13 hours ago
```

然后执行`docker service update`命令升级镜像

```
docker service update --image nginx:1.13 web

# 查看任务，确认镜像已全部升级到nginx:1.13
docker service ps web -f "desired-state=running"
ID                  NAME                IMAGE               NODE                DESIRED STATE       CURRENT STATE                ERROR               PORTS
e8t755h66a32        web.1               nginx:1.13          atom-3              Running             Running 13 hours ago
lkf51u3brkun        web.2               nginx:1.13          gutianyi-PC         Running             Running about a minute ago
u240xfs3q023        web.3               nginx:1.13          atom-1              Running             Running 13 hours ago
```

手动回滚镜像版本到 nginx:1.12

```
docker service update --rollback web

# 已回滚完成，版本又变为nginx:1.12
docker service ps web -f "desired-state=running"
ID                  NAME                IMAGE               NODE                DESIRED STATE       CURRENT STATE          ERROR               PORTS
yuj9ry8uipy4        web.1               nginx:1.12          atom-2              Running             Running 13 hours ago
szfnmk3o7wgv        web.2               nginx:1.12          atom-3              Running             Running 13 hours ago
jjsutat7tc65        web.3               nginx:1.12          atom-1              Running             Running 13 hours ago
```

`docker service update`与**更新回滚**相关的参数

```
--rollback                   # 回滚到上一个版本
--rollback-delay duration    # 回滚时间间隔，单位(ns|us|ms|s|m|h)
--rollback-failure-action string     # 回滚失败执行的动作("pause"|"continue")
--rollback-max-failure-ratio float   # 能够容忍的回滚错误率
--rollback-monitor duration     # 每次任务回滚后等待的时间，以监视是否回滚失败 (ns|us|ms|s|m|h)
--rollback-order string         # 回滚指令("start-first"|"stop-first")
--rollback-parallelism uint     # 同时回滚的最大任务数，若为0则同时回滚所有任务

--update-delay duration         #更新时间间隔(ns|us|ms|s|m|h)
--update-failure-action string  #更新失败执行的动作("pause"|"continue"|"rollback")
--update-max-failure-ratio float  # 能够容忍的更新失败率
--update-monitor duration         # 每次更新后等待的时间，以监视是否更新失败(ns|us|ms|s|m|h)
--update-order string             # 更新指令("start-first"|"stop-first")
--update-parallelism uint         # 同时更新的最大任务数，若为0则同时更新所有任务
```

## DRAIN 可用性

有时，例如计划的维护时间，需要将节点设置为`DRAIN`可用性。`DRAIN`可用性会**阻止节点从 swarm manager 接收新任务**。这也就意味着 manager 会停止在该节点上运行的任务，并在具有`ACTIVE`可用性的节点上启动副本任务。

> 将节点设置为`DRAIN`不会从该节点中删除独立容器，例如使用 docker run，docker-compose up 或 Docker Engine API 创建的容器。节点的状态（包括`DRAIN`）仅影响节点调度 swarm 服务工作负载的能力。

```
# 最初每个worker上都有一个任务
> docker service ps web -f "desired-state=running"
ID                  NAME                IMAGE               NODE                DESIRED STATE       CURRENT STATE                ERROR               PORTS
tffbqbf4v2ah        web.1               nginx:1.12          atom-1              Running             Running 17 hours ago
n0bk8a7nva7m        web.2               nginx:1.12          atom-2              Running             Running 17 hours ago
ugw21hq29jt3        web.3               nginx:1.12          atom-3              Running             Running 17 hours ago
exvdophp0rc6        web.4               nginx:1.12          gutianyi-PC         Running             Running about a minute ago

# 将atom-1的可用性设为drain
> docker node update --availability drain atom-1

# 查看atom-1，可看到可用性已变为drain
> docker node inspect atom-1 --pretty
ID:			845ol5bc51p68esmt14w1r7k8
Hostname:              	atom-1
Joined at:             	2018-11-06 12:33:43.750433367 +0000 utc
Status:
 State:			Ready
 Availability:         	Drain
 Address:		192.168.43.106
......

# 查看服务，atom-1已不再接受任务，并且任务由另一个节点接替（此处为manager节点）
> docker service ps web -f "desired-state=running"
ID                  NAME                IMAGE               NODE                DESIRED STATE       CURRENT STATE                ERROR               PORTS
kid3lp31jvz0        web.1               nginx:1.12          gutianyi-PC         Running             Running about a minute ago
n0bk8a7nva7m        web.2               nginx:1.12          atom-2              Running             Running 17 hours ago
ugw21hq29jt3        web.3               nginx:1.12          atom-3              Running             Running 17 hours ago
exvdophp0rc6        web.4               nginx:1.12          gutianyi-PC         Running             Running 5 minutes ago

# 可再通过将可用性设回active使该节点重新开始接受任务
```

## 数据持久化

- volume
- bind

创建服务使用 volume 数据卷

```
> docker service create --name web-1 --mount src=test,dst=/data nginx:1.12
> docker inspect web-1 -f "{{json .Spec.TaskTemplate.ContainerSpec.Mounts}}"
[{"Type":"volume","Source":"test","Target":"/data"}]
# src必须是volume的名字，不能是绝对路径
# 还可指定type，默认不指定就是volume

通过docker volume ls也可查看到test的volume
> docker exec -it web-1.1.uowomv72xjti9l5373erxskra /bin/bash
# 在容器内部的data目录中创建一个文件
# touch 1.txt
在volume的目录中就能看到该文件
> ls /var/lib/docker/volumes/test/_data
1.txt
```

创建服务使用 bind 挂载

```
> docker service create --mount type=bind,src=/home/gutianyi/test,dst=/data --name web1 nginx:1.12
# 使用bind的话，src必须是绝对路径

> docker inspect web1 -f "{{json .Spec.TaskTemplate.ContainerSpec.Mounts}}"
[{"Type":"bind","Source":"/home/gutianyi/test","Target":"/data"}]

# 若要挂载只读权限，可以在--mount中添加readonly
> docker service create --mount type=bind,src=/home/gutianyi/test,dst=/data,readonly --name web1 nginx:1.12
```

## 路由网格（routing mesh）

Docker Engine 的 swarm 模式可以轻松发布服务端口，使其可用于群组外的资源。所有节点都参与入口路由网格（ingress routing mesh）。路由网格允许群集中的每个节点接受已发布端口上的连接，以便在群集中运行的任何服务，即使节点上没有任何任务正在运行。路由网格将所有请求路由到可用节点上的已发布端口的活动容器。

要在群集中使用入口网络，需要在启用 swarm 模式之前在集群节点之间打开以下端口：

- 端口**`7946 TCP / UDP`用于容器网络发现**。
- 端口**`4789 UDP`用于容器入口网络**。

并且还必须打开集群节点与需要访问端口的任何外部资源（如外部负载平衡器）之间的已发布端口。

使用`--publish`在创建服务时发布端口。 `target`用于指定容器内的端口，`published`用于指定要在路由网格上绑定的端口。如果不使用已发布的端口，则会为每个服务任务绑定一个随机端口（30000-32767）。默认发布的是 TCP 端口，若要设置协议可在`--publish`中添加`protocol=tcp|udp`指定

```
> docker service create --name web \
  --replicas 5 \
  --update-delay 5s \
  --update-parallelism 2 \
  --publish published=8080,target=80 \
  nginx:1.12

> docker service inspect web -f "{{json .Endpoint.Ports}}"
[{"Protocol":"tcp","TargetPort":80,"PublishedPort":8080,"PublishMode":"ingress"}]
```

该服务的每个容器都能作为一个负载均衡器，如下图（docker 文档的图）

{% asset_img 1.png %}

`docker service update --published-add published=XX,target=XX SERVICE`能够添加发布的端口（不是替换）

```
> docker service create --name web-1 --publish published=8081,target=80 nginx:1.12

> docker service update --publish-add published=8082,target=80 web-1

> docker service inspect web-1 -f "{{json .Endpoint.Ports}}"
[{"Protocol":"tcp","TargetPort":80,"PublishedPort":8081,"PublishMode":"ingress"},{"Protocol":"tcp","TargetPort":80,"PublishedPort":8082,"PublishMode":"ingress"}]
```

可以绕过路由网格，在访问给定节点上的绑定端口时，始终访问在该节点上运行的服务实例，这称为**主机模式（host）**。在`--publish`后加上`mode=host`

## 服务发现与负载均衡

swarm 模式内置 DNS 组件，可自动为集群中每个服务分配 DNS 记录，swarm manager 使用内部负载均衡，根据服务的 DNS 名在集群内的服务间分发请求。swarm manager 使用 ingress load balancing 暴露服务。ingress network 是特殊的 overlay 网络，便于服务的节点直接负载均衡，当任何 swarm 节点在已发布的端口上接受请求时，会将请求转发到 IPVS 模块，IPVS 追踪该服务的所有容器 IP 地址，选择其中一个并将请求路由给它。

<div align=center>官网的图，只看原理</div>

{% asset_img 2.png %}

需要创建 overlay 网络`docker network create -d overlay --subnet 192.1.1.0/24 --myoverlay`

**注：**若没有指定`--subnet`，一定要注意查看创建的网络的子网，有可能会创建子网为`10.0.0.0/16`的网络，这会与 docker 的默认子网冲突，导致后续的 DNS 解析出错，因此最好指定子网。

创建一个 Nginx web 集群

```
> docker service create --replicas 3 --network myoverlay --name web nginx:1.12

> docker inspect web -f "{{json .Endpoint.VirtualIPs}}"
[{"NetworkID":"ne9ejireolrulkw9072gstiaq","Addr":"192.1.1.22/24"}]
```

创建一个 busybox 服务，使用与 web 集群相同的网络

```
> docker service create --network myoverlay --name busy busybox
> docker inspect busy -f "{{json .Endpoint.VirtualIPs}}"
[{"NetworkID":"ne9ejireolrulkw9072gstiaq","Addr":"192.1.1.26/24"}]

# 进入busy服务的容器
> docker exec -it busy.1.a8mzyt0vlb7ic68aehmlzrmik sh
# 使用nslookup解析服务
# nslookup web
Server:		127.0.0.11
Address:	127.0.0.11:53

Non-authoritative answer:
Name:	web
Address: 192.1.1.22
# 得到负载均衡器的IP
```

### 高可用

为了使 swarm 具有容错功能（高可用），一般使集群中的节点个数为奇数个数。当 leader 故障时自动选举新的 leader。

**注：若添加多个 Manager，则需要保持一半以上的 Manager 正常工作。**

可在 manager 上提升一个节点，使其成为备用 manager 节点。

`docker node promote`指定要提升的节点。

```
> docker node promote ubuntu-s1
Node ubuntu-s1 promoted to a manager in the swarm.
> docker node ls
ID                            HOSTNAME            STATUS              AVAILABILITY        MANAGER STATUS      ENGINE VERSION
lgq8c78rd2ajx9mf05x8qgrdp *   gutianyi-PC         Ready               Active              Leader              18.06.1-ce
jd81rx6tdzf9uak63b4iefqi2     ubuntu-s1           Ready               Active              Reachable           18.06.1-ce
```

节点的 manager 状态变为**`Reachable`**。

或者也可以使节点在加入 swarm 时就成为 Manager 节点，在当前的 Manager 上执行`docker swarm join-token manager`，再复制到节点上执行。

## 配置文件存储

使用命令`docker config`管理配置文件。**需要该节点是集群的 Manager。**

```
docker config COMMAND
  create      创建配置文件
  inspect     查看配置文件信息
  ls          列出所有配置文件
  rm          删除配置文件
```

在 Manager 上创建一个配置文件`web1.conf`

```
server {
    listen       80;
    server_name  localhost;

    #charset koi8-r;
    #access_log  /var/log/nginx/host.access.log  main;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
    }
}
```

创建 docker 配置`docker config create web1.conf web1.conf`

创建服务，应用该配置

```
docker service create --name web \
  --replicas 3 \
  --config source=web1.conf,target=/etc/nginx/conf.d/web1.conf \
  -p 8080:80 \
  nginx
```

# 实战一-LNMP 搭建

1. 创建 overlay 网络`lnmp`

   ```
   docker network create -d overlay --subnet 192.168.1.0/24 lnmp
   ```

2. 下载 discuz 包，解压后进入。创建 Dockerfile。

   ```
   .
   ├── Dockerfile
   ├── readme
   ├── README.md
   ├── upload
   └── utility
   ```

   ```
   FROM php
   COPY upload /usr/src/discuz
   WORKDIR /usr/src/discuz
   CMD ['php', './index.php']
   ```

   构建镜像`docker build -t discuz-php .`

3. 创建一个 php 服务

   ```
   docker service create \
     --name discuz-php \
     --replicas 3 \
     --network lnmp \
     --mount type=volume,source=www,destination=/usr/local/nginx/html \
     discuz-php
   ```

4. 创建 mysql 服务

   ```
   docker service create \
     --name discuz-mysql \
     --network lnmp \
     --mount type=volume,source=dbdata,destination=/var/lib/mysql \
     -e MYSQL_ROOT_PASSWORD=123456 \
     -e MYSQL_USER=discuz \
     -e MYSQL_PASSWORD=123456 \
     -e MYSQL_DATABASE=discuz \
     mysql
   ```

5. 创建 nginx 服务

   ```
   docker service create --name nginx \
       --replicas 3 \
       --network lnmp \
       -p 8080:80 \
       --mount type=volume,source=www,destination=/usr/local/nginx/html \
       nginx
   ```

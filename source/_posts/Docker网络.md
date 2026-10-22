---
title: Docker网络
date: 2018-04-27 13:04:48
tags: [Docker, 网络]
categories: [Docker]
comments: false
---

**主要是对 docker 文档(v18.03)的翻译以及自己的学习笔记**（网络部分已按 Docker 29 官方文档校对）

<!-- more -->

# Docker 网络模式

Docker 的“网络模式”和“网络驱动”是两个概念：模式决定容器怎么接入网络，驱动决定网络怎么实现。常用的网络模式有：

- 桥接模式（bridge，默认）
- 主机模式（host）
- 容器模式（container，共享另一个容器的网络命名空间）
- 无网络模式（none）
- 自定义网络（user-defined，可选用 bridge/overlay/macvlan/ipvlan 等驱动）

Linux 上的内置网络驱动：

| 驱动 | 用途 |
| --- | --- |
| bridge | 默认驱动，单机内容器通信 |
| host | 容器与宿主机共享网络命名空间 |
| none | 完全隔离，仅保留 lo |
| overlay | 多台 Docker 主机之间的分布式网络（Swarm） |
| ipvlan | 容器直接接入外部 VLAN，共享父接口 MAC |
| macvlan | 容器在物理网络上表现为独立设备，有独立 MAC |

当安装完 docker 后，会默认创建三个网络，可通过`docker network ls`查看

```
# docker network ls
NETWORK ID          NAME                DRIVER              SCOPE
01ec14a3a84c        bridge              bridge              local
56d5a7a9b06c        host                host                local
9cbd2d449df7        none                null                local
```

用户可在运行容器时通过`--network=`指定网络。

## 桥接模式 bridge

bridge 是 docker 默认选择的网络，而网桥就是 docker0 通过`ifconfig`即可看到。

```
# ifconfig
docker0: flags=4099<UP,BROADCAST,MULTICAST>  mtu 1500
        inet 172.17.0.1  netmask 255.255.0.0  broadcast 0.0.0.0
		......
```

创建容器时若未指定 network 或网桥，就会默认挂到 docker0 网桥上。
docker0 的网段为 172.17.0.0/16，网关地址为 172.17.0.1，可通过`docker inspect bridge`查看。

```
# docker inspect bridge
[
    {
        "Name": "bridge",
        ......
            "Config": [
                {
                    "Subnet": "172.17.0.0/16",
                    "Gateway": "172.17.0.1"
                }
            ]
        },
    ......
```

docker daemon 会创建一对对等接口：虚拟网桥上的 vethxxx 和容器的 eth0。veth 放置在宿主机的命名空间中，将宿主机上的所有网络为 bridge 的容器都连接到这个内部网络中，同时 daemon 会从网桥的私有地址空间中分配一个 IP 地址和子网给该容器。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120057950.png)

```
# ifconfig
......
veth7576df5: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet6 fe80::9023:faff:fe28:14b3  prefixlen 64  scopeid 0x20<link>
        ether 92:23:fa:28:14:b3  txqueuelen 0  (Ethernet)
		......

vethab244c0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet6 fe80::d047:b2ff:fee4:89c8  prefixlen 64  scopeid 0x20<link>
        ether d2:47:b2:e4:89:c8  txqueuelen 0  (Ethernet)
		......
......
```

连接同一个 bridge 网络的容器间能够通过 IP 地址互相通信。
由于运行容器默认使用 bridge 网络，所以若要运行对外提供访问的服务，如 web 服务，就必须暴露端口，通过`-p`（指定容器暴露端口）或`-P`（发布容器所有端口）发布容器暴露的端口。

> 默认情况下，创建容器时不会将任何端口发布到外部。若通过`-p`或`--publish`发布端口，会创建一个防火墙规则，将容器端口映射到宿主机上的端口。

Docker 在默认 bridge 网络上不支持服务自动发现。如果需要通过容器名实现容器间的互相通信，就要设置连接属性`--link=容器名:别名`（官方并不推荐，已快被淘汰，官方推荐用`user-defined`网络实现互通）。
容器内所有的环境变量都可供连接到它的容器使用，可能会造成安全隐患。

### 默认 bridge 与自定义 bridge

未指定 `--network` 的容器都会挂到默认的 `docker0` 上，这带来几个限制：

- 默认 bridge 上的容器只能用 IP 互相访问，不能按容器名解析；自定义 bridge 由 Docker 内置 DNS（`127.0.0.11`）提供名称解析
- 默认 bridge 上的容器默认可以互相通信，隔离性差；自定义 bridge 可以按业务划分网络
- 默认 bridge 的配置要改 `/etc/docker/daemon.json` 并重启 Docker；自定义 bridge 可在 `docker network create` 时按网络指定子网、网关、MTU 等
- 运行中的容器可以 `docker network connect` / `disconnect` 自定义网络，默认 bridge 不支持热插拔

此外，单个 bridge 网络连接约 1000 个以上容器时，受内核限制可能出现通信不稳定，规模大时建议拆分网络或改用其他驱动。

## 主机模式 host

在此模式下，容器网络与宿主机网络间的隔离将被禁止，容器共享宿主机的网络命名空间，直接使用宿主机的 IP 和端口。也正因为共享网络栈，`-p/--publish` 在 host 模式下不生效（会提示警告），端口冲突需要自行避免。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120057367.png)

```
# docker run -it --network=host alpine
/ # ifconfig
br-7673688a6ae1 Link encap:Ethernet  HWaddr 02:42:DC:D4:64:FA
          inet addr:172.22.0.1  Bcast:172.22.255.255  Mask:255.255.0.0
		  ......

docker0   Link encap:Ethernet  HWaddr 02:42:81:58:18:0C
          inet addr:172.17.0.1  Bcast:172.17.255.255  Mask:255.255.0.0
		  ......

ens33     Link encap:Ethernet  HWaddr 00:0C:29:58:0C:12
          inet addr:192.168.163.101  Bcast:192.168.163.255  Mask:255.255.255.0
		  ......
......
```

由此可知，当使用 host 模式网络时，容器实际上继承了宿主机的 IP 地址，并且在容器中可以看到宿主机的所有网卡。

因为没有路由开销，因此主机模式会比 bridge 模式更快。但是由于容器直接被暴露在公共网络中，会有安全隐患。

## 容器网络 container

在该模式，新创建的容器和已经存在的一个容器共享一个网络命名空间。两个容器除了网络的命名空间，其他的如文件系统、进程列表等仍然是隔离的。两个容器可以通过环回口进行设备通信。Kubernetes 的 Pod 也通过 pause 容器共享网络命名空间，思路类似，但由 CNI 插件实现，并不是直接使用 Docker 的 container 模式。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202207232051825.png)

该模式通过`--network=container:另一个已存在的容器`实现。

```
# docker run -it --name container_A alpine
/ # ifconfig
eth0      Link encap:Ethernet  HWaddr 02:42:AC:11:00:05
          inet addr:172.17.0.5  Bcast:172.17.255.255  Mask:255.255.0.0
		  ......

# docker run -it --name container_B --network=container:container_A alpine
/ # ifconfig
eth0      Link encap:Ethernet  HWaddr 02:42:AC:11:00:05
          inet addr:172.17.0.5  Bcast:172.17.255.255  Mask:255.255.0.0
		  ......
```

如果创建一个容器的网络类型为none
```
# docker run -it --name alpine1 --network=none alpine sh
/ # ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
```
则再建一个容器共享网络模式，也会是none类型的
```
# docker run -it --name alpine2 --network=container:alpine1 alpine sh
/ # ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
```

## 无网络模式 none

该模式关闭了容器的网络功能，容器处于自己独立的网络命名空间中，且不进行任何配置。

使用场景：1.容器并不需要网络（例如只需要写磁盘卷的批处理任务，或生成随机密钥）2.自定义网络

```
# docker run -it --network=none alpine sh
/ # ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
```

## 用户自定义模式 user-defined

本模式使用户可自定义网络中的参数，以满足特定需求，例如 DNS 服务器。同一个自定义网络中，可以使用对方容器的容器名、服务名、网络别名来找到对方。这个时候帮助进行服务发现的是 Docker 内置的 DNS。所以，无论容器是否重启、更换 IP，内置的 DNS 都能正确指定到对方的位置。

> docker 内嵌 DNS Server，但只有在用户自定义模式才能使用。

docker 提供的网络驱动：**bridge**、**host**、**none**、**overlay**、**ipvlan**、**macvlan**，以及第三方网络插件。

可通过 `docker network create --driver=[driver] --subnet=[subnet] --gateway=[gateway] [network-name]` 指定驱动、网段和网关（选项要放在网络名之前）。

**bridge**用于同一主机内的容器通信。
**overlay**用于多台 Docker 主机之间的通信（Swarm 模式）。
**macvlan**、**ipvlan**用于让容器直接接入物理网络，可单机也可多机。

**macvlan**：当从 VM 设置迁移或需要**容器看起来像网络上的物理主机**时使用，可以使**每个容器都具有唯一的 MAC 地址**。

**ipvlan**：与 macvlan 类似，但容器共享父接口的 MAC 地址，更节省交换机 CAM 表；支持 L2/L3 模式。

**overlay**：当需要在**不同 Docker 主机上运行的容器**进行通信，或者当**多个应用程序使用 swarm 服务一起工作**时使用。

**host**驱动让容器共享宿主机网络栈，单机容器和 Swarm 服务都可使用（Swarm 服务使用 host 网络需 17.06+）。
**network plugins**是第三方为 docker 制作的网络插件。

- bridge 驱动: 用于创建类似 bridge 网络模式的网络，加入该网络的容器必须在同一台宿主机，仅适合一台主机上的小型网络。

```
# docker network create --driver=bridge mybridge --subnet=10.1.1.0/24 --gateway=10.1.1.1
# docker inspect mybridge
[
    {
        "Name": "mybridge",
        ......
        "Driver": "bridge",
        "EnableIPv6": false,
        "IPAM": {
            "Driver": "default",
            "Options": {},
            "Config": [
                {
                    "Subnet": "10.1.1.0/24",
                    "Gateway": "10.1.1.1"
                }
            ]
......
# docker run -it --network=mybridge alpine
/ # ifconfig
eth0      Link encap:Ethernet  HWaddr 02:42:0A:01:01:02
          inet addr:10.1.1.2  Bcast:10.1.1.255  Mask:255.255.255.0
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
		  ......
```

同主机容器间通信，分为：IP 通信，DNS Server，Joined 容器。

**IP 通信：** 容器处于两个不同网络中，通过`docker network connect [对端容器所处网络名][本端容器]`连接容器。

- `--alias` 设置对端网络别名
- `--ip` 指定对端网络上该IP地址的容器
- `--ip6` 同上，为IPv6地址
- `--link` 指定连接的容器名，后面可以加上 `:连接的容器别名`，这样可以直接在容器中通过别名访问（即使容器ip改变也能自动解析）
- `--link-local-ip` 为容器添加一个连接本地的地址


```
# docker run -it --name container_A alpine
# docker network connect mybridge container_A
# docker run -it --network=mybridge --name=container_B alpine
# docker inspect container_B -f '{{.NetworkSettings.Networks.mybridge.IPAddress}}'
10.1.1.4

# docker inspect container_A -f '{{.NetworkSettings.IPAddress}}'
172.17.0.3

# docker attach container_A
/ # ping 10.1.1.4
PING 10.1.1.4 (10.1.1.4): 56 data bytes
64 bytes from 10.1.1.4: seq=0 ttl=64 time=0.294 ms
/ # ifconfig
eth0      Link encap:Ethernet  HWaddr 02:42:AC:11:00:03
          inet addr:172.17.0.3  Bcast:172.17.255.255  Mask:255.255.0.0
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          ......
eth1      Link encap:Ethernet  HWaddr 02:42:0A:01:01:03
          inet addr:10.1.1.3  Bcast:10.1.1.255  Mask:255.255.255.0
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          ......
```

原理如图（图为 docker 文档的，ip 地址有偏差），docker 会在本容器上创建一个新的网卡，由指定的网络分配 IP 地址，实现与指定的网桥中容器的连接（如上面 ifconfig 中 eth1）。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120058452.png)

**DNS：** 使用对方容器的容器名、服务名、网络别名来找到对方，无论容器是否重启、更换 IP，内置的 DNS 都能正确指定到对方的位置。

**Joined 容器：** 即 container 网络模式，使两个及以上的容器共享一个网络栈，共享网卡和配置。

**容器访问外网**
容器默认就能访问外网，这里外网指容器外的网络，不只是互联网。

处理流程：1.容器发数据包，docker0 收到数据包后查看 IP 头，发现是发往外网的，交给 NAT 处理。2.NAT 将源地址转为宿主机 IP 地址，并从主机网卡发出。

**外网访问容器**
外网通过端口映射访问容器。默认情况下 Docker 会为每个发布端口启动 `docker-proxy` 进程（可用 `ps -ef | grep docker-proxy` 查看），但外部流量主要由 iptables/nftables 的 DNAT 规则直接转发，docker-proxy 更多用于本机回环、hairpin 等场景；设置 `"userland-proxy": false` 可关闭它。
下图为内外网的完整访问流程图

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120058221.png)

## 端口发布

bridge 网络里的容器端口默认只对宿主机和同一网络的容器可见，要对外提供访问必须发布端口：

```bash
docker run -d -p 8080:80 nginx            # 宿主机所有地址的 8080 -> 容器 80
docker run -d -p 127.0.0.1:8080:80 nginx  # 只监听回环地址
docker run -d -P nginx                    # 发布 Dockerfile 中 EXPOSE 的所有端口
```

- 不写宿主 IP 时默认绑定 `0.0.0.0` 和 `::`，即所有网卡；只想本机访问要显式写 `127.0.0.1`
- `-p` 的转发由 iptables/nftables 的 DNAT 规则完成；`docker-proxy` 进程主要用于本机回环、hairpin 等场景，不是所有外部流量的必经路径
- host 网络模式不支持端口映射，`-p` 会被忽略
- 同一宿主机端口只能被一个容器占用

## 内置 DNS

- 默认 bridge 网络不使用 Docker 内置 DNS，容器间只能靠 IP 或已废弃的 `--link`
- 自定义网络（user-defined bridge、overlay 等）使用 `127.0.0.11` 做名称解析，容器名、网络别名、Swarm 服务名都可解析
- 内置 DNS 会把外部域名转发给宿主机 `/etc/resolv.conf` 中的 DNS；可用 `--dns`、`--dns-search`、`--dns-option` 覆盖
- 容器使用 `container:` 模式共享网络栈时，`--dns`、`--hostname`、`--publish` 等参数不可用

# 跨主机网络

跨主机通信时，Docker 原生提供 overlay（Swarm）和 macvlan/ipvlan（直接接入物理网络）两类方案；也可使用 flannel、weave、calico 等第三方网络插件。

众多的 docker 网络方案通过 libnetwork 与容器网络模型（Container Network Model）集成在一起，其中 libnetwork 为 docker 容器网络库，而其核心即为容器网络模型，对容器网络进行了抽象，由以下三个组件组成：

- Sandbox：容器的网络栈，包含容器接口、路由表和 DNS 设置。Sandbox 的实现标准为 Linux Network Namespace，可以包含来自不同 Network 的 Endpoint。
- Endpoint：将 Sandbox 接入 Network，典型实现为 Veth Pair。一个 Endpoint 只属于一个网络，也只属于一个 Sandbox。
- Network：包含一组 Endpoint，同一 Network 的 Endpoint 可以直接通信。

## Overlay

Overlay 网络驱动创建了多 docker 主机间的分布式网络，允许与其连接的容器互相安全地通信，服务和容器能同时连接多个网络，但也仅能在连接的网络间通信。虽然可以将集群服务和单独的容器都连入一个 overlay 网络，但 overlay 对于集群与单独容器的默认配置是不同的，对于不同对象有不同的选项。

在创建 overlay 网络之前，需要使用 docker swarm 初始化作为 swarm manager，或者使用`docker swarm join`将其加入到现有 swarm 中。这两者都创建缺省的 swarm 服务使用的默认 overlay 网络`ingress`。

**实验环境：**
swarm manager：192.168.163.102
swarm worker：192.168.163.103

在 manager 上初始化 docker swarm
`docker swarm init`
worker 上加入 docker swarm（将 manager 上生成的命令复制粘贴到 worker 上运行）

```
# docker swarm join --token SWMTKN-1-077i43tqnp5df8y29nrrh8apm9y2a4khzggg8nydd2yy8nzzjw-0i1qu8z1xl2s7ngy8y1gcnfnb 192.168.163.102:2377
This node joined a swarm as a worker.
```

创建 overlay 网络 my_overlay：

```
# docker network create -d overlay my_overlay
# docker network ls
NETWORK ID          NAME                DRIVER              SCOPE
8cc4b6f2ddfa        bridge              bridge              local
5db2b494b1af        docker_gwbridge     bridge              local
5a1cfdddfd60        host                host                local
y6l4bambmqoj        ingress             overlay             swarm
bdv2xdmkujbu        my_overlay          overlay             swarm
7ec96e1718f1        none                null                local
```

若要创建一个 overlay 网络供群集服务或独立容器与其他 Docker 守护程序上运行的其他独立容器进行通信，要添加`--attachable`参数。`ingress`网络创建时没有`--attachable`选项，说明只有 swarm 服务可以使用它，而不是独立的容器。通过在创建网络时添加`--attachable`选项使得运行在不同 Docker 守护进程上的独立容器能够进行通信，而无需在各个 Docker 守护进程主机上设置路由。

**容器发现**
对于大多数情况，应该连接到服务名，而不是单独容器，因为服务是负载均衡的且是由所有服务后的容器（即任务 task）处理的。要获取支持该服务的所有任务（task）的列表，可以执行 DNS 查找`tasks.<service-name>`

**overlay 网络加密**
默认 docker 对 swarm 服务在 GCM 模式下使用 AES 算法加密，集群中的 manager 节点每 12 小时就轮换用于加密 gossip（反熵算法）数据的密钥。

要加密应用程序数据，需要在创建 overlay 网络时添加`--opt encrypted`。这使得 vxlan 级别的 IPsec 加密成为可能。这种加密会带来不可忽视的性能损失，所以应该在生产中使用它之前对其进行测试。

当启用 overlay 加密时，Docker 会在所有节点之间创建 IPsec 隧道，在这些节点上调度连接到 overlay 网络服务的任务。这些通道在 GCM 模式下也使用 AES 算法，manager 节点每 12 小时自动轮换一次密钥。

> 不要将 Windows 节点添加到加密的 overlay 网络。
> Windows 上不支持 overlay 网络加密。如果 Windows 节点尝试连接到加密的 overlay 网络，虽不会报告错误，但节点无法通信。

**默认 ingress 网络**
默认 overlay 网络 ingress 的作用：当自动选择的子网与网络中已存在的子网冲突或需要自定义某项低层的网络配置（例如 MTU）时，默认的 ingress 网络会很有用。
通常在 Swarm 中创建服务前对 ingress 网络进行删除或重建操作。如果已有发布端口的服务，在删除 ingress 网络前必须先删除这些服务。
若没有 ingress 网络且不发布端口的服务在运行却没有进行负载均衡，那么那些发布端口的服务会受到影响。

可在创建网络时加上`--ingress`选项创建 ingress 网络并自定义网络参数。只能创建一个 ingress 网络。

**默认 docker_gwbridge 网络**
docker_gwbridge 是一个虚拟网桥，它将 overlay 网络（包括 ingress 网络）连接到单独的 Docker 守护进程的物理网络。初始化群集或将 Docker 主机加入群集时，Docker 会自动创建它，但它不是 Docker 设备。它存在于 Docker 主机的内核中。如果需要自定义其设置，则必须在将 Docker 主机加入集群之前或临时从集群中暂时删除主机之后执行该自定义操作。

若要删除 docker_gwbridge 网络，需要先停止 docker，再删除 docker_gwbridge 网络，由于停止了 docker，所以要通过`ip link`删除该网络。

```
# ip link set docker_gwbridge down
# ip link del docker_gwbridge
```

再启动 docker，但不要加入或初始化 swarm。重建一个 docker_gwbridge 网络，然后再加入或初始化 swarm。

**在 overlay 网络发布端口**
连接在同一个 overlay 网络的集群服务可以有效地互相发布所有端口。若要使一个端口能在服务外能访问，必须在`docker service create`或`docker service update`后加上`-p`选项发布指定端口。支持冒号分隔的旧语法`-p 8080:80/tcp`和逗号分隔的新语法`-p published=8080,target=80,protocol=tcp`。

**绕过集群服务的路由网格（routing mesh）**
默认情况下，发布端口的群集服务使用路由网格来完成。当连接到任何 swarm 节点上的已发布端口（无论是否运行给定服务）时，都会透明地重定向到正在运行该服务的 worker。实际上，Docker 充当群集服务的负载平衡器。使用路由网格的服务以虚拟 IP（VIP）模式运行。即使在每个节点上运行的服务（通过`--global`标志）也使用路由网格。使用路由网格时，不能保证哪个 Docker 节点服务客户端会请求。

要绕过路由网格，可以通过设置选项`--endpoint-mode dnsrr`来使用`DNS Round Robin（DNSRR）`模式启动服务且必须在服务前运行自定义的负载均衡器。对 Docker 主机上服务名的 DNS 查询会返回运行该服务的节点的 IP 地址列表，可以通过配置负载均衡器使用此列表并且平衡各节点间的流量。

**单独控制和数据**
默认情况下，尽管群集控制流量是加密的，但群集管理和应用程序之间的控制流量运行在同一个网络上，可以配置 Docker 使用单独的网络接口来处理两种不同类型的流量。初始化或加入群集时，分别指定`--advertise-addr`和`--datapath-addr`，加入集群的每个节点都要执行此操作。

**实验（根据官方文档的实验）**
Manager（system2）:192.168.163.102
Worker-1（system3）：192.192.168.163.103
Worker-2（system4）：192.192.168.163.104

在 manager 上初始化 swarm，worker 节点加入 swarm。在 manager 上查看节点。

```
# docker node ls
ID                            HOSTNAME              STATUS              AVAILABILITY        MANAGER STATUS      ENGINE VERSION
ohfkwg8uu4zkjtyk1l1nbze4p *   system2.example.com   Ready               Active              Leader              18.03.1-ce
6dbboj25t5tws0ohd1pdhsahl     system3.example.com   Ready               Active                                  18.03.1-ce
aug4gnqnm0na4pwu835dku51x     system4.example.com   Ready               Active                                  18.03.1-ce
```

可通过`--filter role=worker|manager`过滤节点信息

在 manager 上创建 overlay 网络。不需要在其他节点上创建 overlay 网络，当其中一个节点开始运行需要 overlay 网络的服务时，它将自动创建。
`docker network create -d overlay nginx-net`
在 manager 上创建一个 nginx 服务（只能在 manager 上创建服务）

```
# docker service create \
--name my-nginx \
-p 80:80 \
--replicas=5 \          #设置创建的任务个数
--network nginx-net \
nginx

# docker service ls
ID                  NAME                MODE                REPLICAS            IMAGE               PORTS
nvxzb5kzihl6        my-nginx            replicated          5/5                 nginx:latest        *:80->80/tcp
```

在 manager 和 worker 上查看 nginx-net 网络情况，以及容器情况`docker inspect nginx-net`

新建 overlay 网络，将服务更新到新的网络上
`docker network create -d overlay nginx-net-2`

```
# docker service update \
--network-add nginx-net-2 \  # 将my-nginx添加进nginx-net-2网络中
--network-rm nginx-net \  # 将my-nginx从nginx-net网络中删除
my-nginx
```

> 注：overlay 网络会因为需要自动创建，但不会自动删除（当服务不需要该网络后）。需要手动删除服务和网络。
> `docker service rm my-nginx` > `docker network rm nginx-net nginx-net-2`

## Macvlan

一些应用类似传统应用或监视网络流量的应用，希望直接连接到物理网络，可以使用 macvlan 网络驱动为每个容器的虚拟网络接口分配 MAC 地址，需要指定宿主机上的物理接口用于 Macvlan，以及 Macvlan 的子网和网关。可以使用不同的物理网络接口来隔离 Macvlan 网络。
网络设备需要能够处理“混杂模式”，其中一个物理接口可以分配多个 MAC 地址。网络模式最好是`bridge`或`overlay`。可以在 bridge 模式或 vlan 的 trunk 模式中创建 macvlan 网络。

**在 bridge 网络模式中创建 macvlan 网络**
在`docker network create`后添加`-d macvlan`，也可再指定流量通过的实际网卡`-o parent=ens33`。若要预留某些 IP 不分配给容器，可添加 `--aux-address="name=IP"`（可重复）。同一个 parent 接口可以创建多个 macvlan 网络（不同子网/VLAN），但要提前规划好 IP 与 MAC 地址。

**在 vlan trunk 模式中创建 macvlan 网络**
通过在网卡名后加`.[数字]`创建网卡子接口，例如`-o parent=ens33.10`。

## IPvlan

IPvlan 与 macvlan 类似，都是让容器直接接入物理网络，但 IPvlan 的多个容器共享父接口的 MAC 地址，更节省交换机 CAM 表。创建时用 `-d ipvlan`，默认 L2 模式：

```bash
docker network create -d ipvlan \
  --subnet=192.168.1.0/24 --gateway=192.168.1.1 \
  -o parent=eth0 -o ipvlan_mode=l2 db_net
```

- L2 模式：容器与父接口在同一广播域，需要使用相同子网；不同子网之间不能直接互通
- L3 模式（`-o ipvlan_mode=l3`）：父接口相当于路由器，容器网络与父接口子网不同；L3 会丢弃广播和组播，适合大规模、可预测的网络
- 内核要求 4.2+；L2/L3 下容器默认不能 ping 宿主机接口，这是内核的隔离行为
- 与 macvlan 一样，Docker Desktop（Mac/Windows）不支持

**macvlan 网络的注意条件**

- 大多数云提供商会阻塞访问 macvlan 网络，可能需要物理访问网络设备。
- macvlan 容器无法直接与宿主机通信，这是 Linux 内核的限制；需要时给容器再加一个 bridge 网络，或在宿主机上创建同 parent 的 macvlan 接口。
- macvlan 网络驱动程序仅适用于 Linux 主机，而 Mac 的 Docker 桌面，Windows 的 Docker 桌面或 Windows Server 的 Docker EE 不支持。
- 至少需要 3.9 版的 Linux 内核，建议使用 4.0 或更高版本。
- 大量容器会带来 MAC 地址膨胀和 IP 地址耗尽问题，交换机需要能处理混杂模式。

## 补充知识点

**支持 IPv6**
原生 IPv6 网络主要面向 Linux 守护进程。daemon.json 中除 `"ipv6": true` 外，默认 bridge 还需要配置 `"fixed-cidr-v6"`；自定义网络创建时加 `--ipv6` 和 `--subnet`，容器可用 `--ip6` 指定地址。修改后重启 Docker（或 `systemctl reload docker`）。

**配置 iptables**
Docker 通过 iptables/nftables 规则提供网络隔离，不应修改 Docker 自己维护的规则。主要规则位于 `DOCKER`、`DOCKER-ISOLATION-STAGE-1/2` 等链，用户自定义规则应放在 `DOCKER-USER` 链，它在 Docker 规则之前生效。

已发布的容器端口默认对所有来源开放。若要只允许特定网段访问，可在 `DOCKER-USER` 链中限制：

例：`iptables -I DOCKER-USER -i ens33 ! --source 192.168.163.0/24 -j DROP`

由于 Docker 的端口转发走 nat 表，会在 ufw/firewalld 的 INPUT/OUTPUT 规则之前生效，所以**发布端口会绕过 ufw/firewalld**。需要限制来源时，用 `DOCKER-USER` 链，或只绑定 `127.0.0.1`。

为防止 Docker 修改 iptables 策略，可在 `/etc/docker/daemon.json` 中设置 `{"iptables": false}`，但官方不推荐：容器将无法通过 MASQUERADE 访问外网，且已发布端口会对本地网络全开放，后续规则都要手动维护。

**DNS 选项**

```
    --dns 指定一个或多个DNS服务器
    --dns-search 设置dns搜索域
    --dns-opt 键值对，可参考/etc/resolv.conf
    --hostname 设置容器的主机名，默认是容器短 ID
```

**docker 代理**
在 Docker 客户端上编辑启动容器的用户主目录`~/.docker/config.json`文件。添加字段，可用`httpsProxy`或`ftpProxy`指定代理服务器的类型，并指定代理服务器的地址和端口，可以同时配置多个代理服务器。

通过将`noProxy`键设置为一个或多个逗号分隔的 IP 地址或主机，指定排除的代理服务器，支持`*`字符作为通配符。

```
{
 "proxies":
 {
   "default":
   {
     "httpProxy": "http://127.0.0.1:3001",
     "noProxy": "*.test.example.com,.example.com"
   }
 }
}
```

在创建容器时可通过`--env`设置环境变量，通过环境变量指定代理服务器。

```
  --env HTTP_PROXY=""
  --env HTTPS_PROXY=""
  --env FTP_PROXY=""
  --env NO_PROXY=""
```

## 网络排障

常用排查顺序：

```bash
# 1. 看网络定义：子网、网关、接了哪些容器
docker network inspect <network>

# 2. 看容器网络配置
docker exec -it <container> ip addr
docker exec -it <container> ip route
docker exec -it <container> cat /etc/resolv.conf

# 3. 进入容器网络命名空间抓包（容器内没有 tcpdump 时）
pid=$(docker inspect -f '{{.State.Pid}}' <container>)
nsenter -t "$pid" -n ip addr
nsenter -t "$pid" -n tcpdump -i eth0 -nn

# 4. 宿主机侧看监听、NAT 规则和网桥
ss -lntp
iptables -t nat -L DOCKER -n -v
bridge link
```

排查思路：

- 容器之间不通：先确认是否在同一网络、是否被 `--internal`/ICC 限制，再用 `getent hosts` 验证名称解析
- 容器访问外网失败：检查 `ip_forward`、MASQUERADE 规则和宿主机 DNS
- 外部访问容器失败：确认 `-p` 的绑定地址（`0.0.0.0` 还是 `127.0.0.1`）、宿主机防火墙和云安全组
- 跨主机 overlay 不通：检查 4789/UDP（VXLAN）、7946/TCP+UDP（gossip）、Swarm 节点状态和 MTU

## 参考文档

- Cloudman《每天五分钟玩转 docker 容器技术》
- [Docker 官方文档-网络](https://docs.docker.com/engine/network/)
- [Docker 官方文档-网络驱动](https://docs.docker.com/engine/network/drivers/)
- [Docker 网络模式](http://dockone.io/article/1261)

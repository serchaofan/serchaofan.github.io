---
title: Docker网络
date: 2018-04-27 13:04:48
tags: [Docker, 网络]
categories: [Docker]
comments: false
---

Docker 网络负责容器之间、容器与宿主机、容器与外部网络之间的通信。理解网络驱动、端口发布、DNS 和防火墙，是排查容器「连不上」问题的基础。

本文基于 Docker Engine 29.9.x（2026-10）官方文档重写，覆盖 bridge、host、none、overlay、macvlan、ipvlan、端口发布、IPv6、Compose 网络和防火墙。

<!-- more -->

- [Docker 网络基础](#docker-%E7%BD%91%E7%BB%9C%E5%9F%BA%E7%A1%80)
- [默认网络](#%E9%BB%98%E8%AE%A4%E7%BD%91%E7%BB%9C)
- [Bridge 网络](#bridge-%E7%BD%91%E7%BB%9C)
- [Host 网络](#host-%E7%BD%91%E7%BB%9C)
- [None 与 container 模式](#none-%E4%B8%8E-container-%E6%A8%A1%E5%BC%8F)
- [端口发布](#%E7%AB%AF%E5%8F%A3%E5%8F%91%E5%B8%83)
- [DNS 与主机名](#dns-%E4%B8%8E%E4%B8%BB%E6%9C%BA%E5%90%8D)
- [IPv6](#ipv6)
- [Overlay 网络](#overlay-%E7%BD%91%E7%BB%9C)
- [Macvlan](#macvlan)
- [Ipvlan](#ipvlan)
- [创建网络的高级选项](#%E5%88%9B%E5%BB%BA%E7%BD%91%E7%BB%9C%E7%9A%84%E9%AB%98%E7%BA%A7%E9%80%89%E9%A1%B9)
- [Compose 网络](#compose-%E7%BD%91%E7%BB%9C)
- [防火墙与包过滤](#%E9%98%B2%E7%81%AB%E5%A2%99%E4%B8%8E%E5%8C%85%E8%BF%87%E6%BB%A4)
- [故障排查](#%E6%95%85%E9%9A%9C%E6%8E%92%E6%9F%A5)
- [最佳实践](#%E6%9C%80%E4%BD%B3%E5%AE%9E%E8%B7%B5)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# Docker 网络基础

## 网络驱动

| 驱动 | 作用 | 范围 |
| ---- | ---- | ---- |
| `bridge` | 单机内容器通信，默认驱动 | 本地 |
| `host` | 容器共享宿主机网络命名空间 | 本地 |
| `none` | 仅保留 loopback，完全隔离 | 本地 |
| `overlay` | 多主机容器网络，基于 VXLAN | Swarm 集群 |
| `macvlan` | 容器在物理网络中有独立 MAC/IP | 本地/二层网络 |
| `ipvlan` | 容器共享父接口 MAC，按 IP 区分 | 本地/三层网络 |

「网络模式」和「网络驱动」不是一回事：

- 模式决定容器如何接入网络，如 `--network host`、`--network none`、`--network container:...`。
- 驱动决定网络如何实现，如 bridge、overlay、macvlan。
- 用户自定义网络通常使用 bridge/overlay/macvlan/ipvlan 驱动。

## 查看网络

```bash
docker network ls
docker network inspect bridge
docker network inspect mynet -f '{{json .IPAM.Config}}'
```

安装 Docker 后默认创建三个网络：

```text
bridge   bridge   local
host     host     local
none     null     local
```

# 默认网络

## bridge

默认 bridge 网络使用 `docker0` 网桥，默认网段通常是 `172.17.0.0/16`：

```bash
ip addr show docker0
docker inspect bridge
```

- 未指定 `--network` 的容器默认接入 `bridge`。
- 默认 bridge 上的容器可以通过 IP 互通。
- 默认 bridge **不提供自动容器名 DNS 解析**，除非使用已过时的 `--link`。
- 生产建议使用用户自定义 bridge，而不是默认 bridge。

## host

`host` 网络让容器共享宿主机网络命名空间：

```bash
docker run --rm --network host nginx:1.27
```

- 容器没有独立 IP。
- 容器监听端口直接占用宿主机端口。
- `-p`/`--publish` 在 host 模式下被忽略，并给出警告。
- 仅 Linux 原生支持；Docker Desktop 的行为取决于版本和配置。

## none

`none` 网络只保留 loopback：

```bash
docker run --rm --network none alpine ip addr
```

适合完全隔离、只需要本地计算的任务。

# Bridge 网络

## 默认 bridge 与自定义 bridge

| 特性 | 默认 bridge | 自定义 bridge |
| ---- | ----------- | ------------- |
| 自动 DNS | 否（仅 legacy `--link`） | 是，按容器名/别名解析 |
| 隔离性 | 所有容器共享 | 按网络隔离 |
| 动态连接/断开 | 不推荐 | `docker network connect/disconnect` |
| 推荐度 | 低 | 高 |

创建自定义 bridge：

```bash
docker network create mynet
docker run -d --name web --network mynet nginx:1.27
docker run -d --name api --network mynet myapi:1.0
```

在 `mynet` 中，`api` 可以直接访问 `web`：

```bash
docker exec -it api sh
getent hosts web
curl http://web:80
```

## 指定子网、网关和 IP 范围

```bash
docker network create \
  --driver bridge \
  --subnet 172.28.0.0/16 \
  --gateway 172.28.0.1 \
  --ip-range 172.28.5.0/24 \
  mynet
```

- `--subnet`：网段。
- `--gateway`：网关，必须在 subnet 内。
- `--ip-range`：Docker 自动分配容器 IP 的范围。
- `--aux-address`：保留地址，例如 `--aux-address="router=172.28.0.2"`。
- `--internal`：禁止外部访问，只允许容器间通信。
- `--ipv6`：启用 IPv6。

## Bridge 驱动选项

```bash
docker network create -d bridge \
  -o com.docker.network.bridge.name=br-app \
  -o com.docker.network.bridge.enable_icc=false \
  -o com.docker.network.driver.mtu=1450 \
  mynet
```

常用选项：

| 选项 | 说明 |
| ---- | ---- |
| `com.docker.network.bridge.name` | 自定义 Linux 网桥名 |
| `com.docker.network.bridge.enable_icc` | 是否允许容器间通信 |
| `com.docker.network.bridge.enable_ip_masquerade` | 是否启用 SNAT |
| `com.docker.network.bridge.host_binding_ipv4` | 端口发布默认绑定地址 |
| `com.docker.network.driver.mtu` | MTU |
| `com.docker.network.container_iface_prefix` | 容器网卡名前缀 |

## 连接与断开

```bash
docker network connect mynet container-a
docker network disconnect mynet container-a
```

一个容器可以同时接入多个网络，适合前后端分层、管理网/业务网分离。

# Host 网络

```bash
docker run -d --network host --name web nginx:1.27
```

特点：

- 无 NAT，性能好。
- 容器直接使用宿主机 IP 和端口。
- 端口冲突直接表现为宿主机端口冲突。
- 容器可以看到宿主机的网络接口，隔离性弱。
- 只适用于 Linux 原生 Docker；Docker Desktop 需要额外配置。

适合高性能代理、需要监听大量端口的场景；不适合多租户或需要强隔离的场景。

# None 与 container 模式

## none

```bash
docker run --rm --network none alpine ip addr
```

容器只有 `lo`，没有外部网络。适合离线计算、安全隔离任务。

## container 模式

```bash
docker run -d --name netns alpine sleep 3600
docker run -d --network container:netns --name app myapp:1.0
```

`app` 与 `netns` 共享网络命名空间：

- 共享 IP、端口、路由、DNS。
- 不能同时使用 `-p`、`--hostname`、`--dns` 等网络配置。
- 适合 sidecar 模式，例如服务网格代理、日志采集 sidecar。

# 端口发布

## 基本语法

```bash
# 宿主机所有地址的 8080 映射到容器 80
docker run -d -p 8080:80 nginx:1.27

# 只绑定 localhost
docker run -d -p 127.0.0.1:8080:80 nginx:1.27

# 随机宿主机端口
docker run -d -p 80 nginx:1.27

# UDP
docker run -d -p 53:53/udp coredns/coredns

# 发布 Dockerfile 中 EXPOSE 的所有端口到随机主机端口
docker run -d -P nginx:1.27
```

查看映射：

```bash
docker port web
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

## 关键规则

- `-p` 默认绑定 `0.0.0.0` 和 `::`，即所有地址；只允许本机访问时写 `127.0.0.1:8080:80`。
- `host` 网络模式下 `-p` 被忽略。
- `--expose` 只做文档说明，不发布端口。
- 发布端口会创建 NAT/防火墙规则，可能绕过 UFW 等主机防火墙。
- 容器之间通过自定义网络通信时，不需要发布端口；只有外部访问才需要。
- 端口冲突时检查 `ss -lntp` 和 `docker ps`。

## 发布端口与防火墙

Docker 使用 iptables/nftables 的 NAT 表做端口映射。发布端口后，流量在到达 `INPUT` 链之前就被 DNAT 转发，因此 UFW 的规则可能不生效。

需要限制来源时：

- 使用 `DOCKER-USER` 链添加规则。
- 在云安全组/网络 ACL 层限制。
- 只绑定 `127.0.0.1` 或内网地址。
- 不要把 Docker API/容器端口直接暴露到公网。

# DNS 与主机名

## 容器 DNS

- 默认 bridge 容器继承宿主机 `/etc/resolv.conf`。
- 自定义网络使用 Docker 嵌入式 DNS：`127.0.0.11`。
- 嵌入式 DNS 负责容器名/别名解析，并把外部域名转发给宿主机 DNS。
- `127.0.0.11` 没有 IPv6 等价地址，IPv6-only 容器也使用这个 IPv4 地址。

```bash
docker exec -it app cat /etc/resolv.conf
docker exec -it app getent hosts web
docker exec -it app nslookup web
```

## 自定义 DNS

```bash
docker run --dns 8.8.8.8 --dns 1.1.1.1 myapp:1.0
docker run --dns-search example.com myapp:1.0
docker run --dns-option ndots:2 myapp:1.0
```

## hostname 与 hosts

```bash
docker run --hostname app-1 myapp:1.0
docker run --add-host db.internal:192.168.1.10 myapp:1.0
```

Linux 上访问宿主机：

```bash
docker run --add-host host.docker.internal:host-gateway myapp:1.0
```

Docker Desktop 通常内置 `host.docker.internal`，Linux 原生 Docker 需要 `host-gateway`。

## 网络别名

```bash
docker network connect --alias api mynet container-a
```

同一网络内可以用别名访问容器，适合蓝绿发布、服务别名。

# IPv6

## 默认 bridge 启用 IPv6

`/etc/docker/daemon.json`：

```json
{
  "ipv6": true,
  "bip6": "2001:db8::1/64",
  "fixed-cidr-v6": "2001:db8:1::/64",
  "default-gateway-v6": "2001:db8:1::1"
}
```

- `ipv6` 必填。
- `bip6` 指定网桥地址/子网。
- `fixed-cidr-v6` 指定容器地址池。
- 实验环境建议使用 ULA（`fd00::/8`），不要用链路本地地址。

## 用户自定义网络

```bash
docker network create \
  --ipv6 \
  --subnet 2001:db8:2::/64 \
  --gateway 2001:db8:2::1 \
  mynet6

docker run -d --network mynet6 --ip6 2001:db8:2::10 myapp:1.0
```

注意：

- 宿主机、交换机、云网络都要支持 IPv6。
- 很多镜像/应用的 IPv6 支持不完整。
- Docker Desktop 的 IPv6 行为取决于版本和配置。

# Overlay 网络

Overlay 用于多台 Docker 主机之间的容器通信，基于 VXLAN，需要 Swarm 模式。

## 创建

```bash
docker swarm init
docker network create -d overlay --attachable myoverlay
```

- `--attachable`：允许独立容器（非 Swarm service）接入。
- 默认 overlay 网络只在 Swarm service 中可用。
- 多主机节点需要加入同一个 Swarm 集群。

## 加密

```bash
docker network create \
  --driver overlay \
  --opt encrypted \
  --attachable \
  secure-overlay
```

- 使用 IPsec 加密 VXLAN 数据。
- 有性能开销，生产前压测。
- Windows 容器不支持加密 overlay。

## 端口与协议

Swarm overlay 常用端口：

| 端口 | 协议 | 用途 |
| ---- | ---- | ---- |
| 2377 | TCP | Swarm 管理 |
| 7946 | TCP/UDP | 节点通信 |
| 4789 | UDP | VXLAN 数据面 |

云环境安全组/防火墙需要放行这些端口。

## docker_gwbridge

Swarm 会创建 `docker_gwbridge`，为 overlay 网络提供外部连通性。不要手工删除或修改，除非明确知道影响。

## MTU

Overlay 会增加 VXLAN 封装开销，底层网络 MTU 不足时会出现大包丢失、TLS 握手卡住等问题。可通过 `--opt com.docker.network.driver.mtu=1450` 调整。

# Macvlan

Macvlan 让容器在物理网络上表现为独立设备，拥有自己的 MAC 和 IP。

## 创建

```bash
docker network create -d macvlan \
  --subnet=192.168.1.0/24 \
  --gateway=192.168.1.1 \
  --ip-range=192.168.1.128/25 \
  --aux-address="router=192.168.1.2" \
  -o parent=eth0 \
  macnet
```

```bash
docker run -d --network macnet --ip 192.168.1.150 nginx:1.27
```

## VLAN

父接口带点号表示 VLAN 子接口：

```bash
docker network create -d macvlan \
  --subnet=192.168.50.0/24 \
  --gateway=192.168.50.1 \
  -o parent=eth0.50 \
  macvlan50
```

## 注意事项

- 物理交换机/网卡需要支持 promiscuous mode 和多 MAC。
- 容器不能直接与宿主机通信（Linux 内核限制）；需要宿主通信时，可同时接入 bridge 网络，或在宿主机创建同网段的 macvlan 接口。
- MAC 地址过多可能导致交换机 MAC 表压力。
- IP 地址耗尽/VLAN 扩散要提前规划。
- 适合需要二层可见、独立 IP 的传统应用、网络设备、IoT。

# Ipvlan

Ipvlan 让多个容器共享父接口 MAC，通过不同 IP 区分，适合大规模、减少 MAC 表压力。

## L2 模式

```bash
docker network create -d ipvlan \
  --subnet=192.168.1.0/24 \
  --gateway=192.168.1.1 \
  -o parent=eth0 \
  -o ipvlan_mode=l2 \
  ipvlan-l2
```

## L3 模式

```bash
docker network create -d ipvlan \
  --subnet=192.168.1.0/24 \
  -o parent=eth0 \
  -o ipvlan_mode=l3 \
  ipvlan-l3
```

特点：

- L2：二层通信，类似 macvlan，但共享 MAC。
- L3：Docker 主机像路由器，容器在不同子网；不转发广播/多播。
- L3 需要上游路由分发，否则外部网络不知道容器网段。
- 适合大规模、可预测网络、减少广播域的场景。

常用选项：

| 选项 | 说明 |
| ---- | ---- |
| `ipvlan_mode` | `l2`、`l3`、`l3s` |
| `ipvlan_flag` | `bridge`、`private`、`vepa` |
| `parent` | 父接口 |

# 创建网络的高级选项

```bash
docker network create \
  --driver bridge \
  --subnet 10.10.0.0/16 \
  --gateway 10.10.0.1 \
  --ip-range 10.10.1.0/24 \
  --aux-address "dns=10.10.0.2" \
  --internal \
  --attachable \
  --label env=prod \
  mynet
```

| 选项 | 作用 |
| ---- | ---- |
| `--driver` | 网络驱动 |
| `--subnet` | 子网，可重复 |
| `--gateway` | 网关 |
| `--ip-range` | 容器 IP 分配范围 |
| `--aux-address` | 保留地址 |
| `--internal` | 禁止外部访问 |
| `--attachable` | 允许独立容器接入 overlay |
| `--ipv6` | 启用 IPv6 |
| `--opt` | 驱动选项 |
| `--label` | 网络标签 |

管理：

```bash
docker network inspect mynet
docker network connect mynet container-a
docker network disconnect mynet container-a
docker network rm mynet
docker network prune
```

# Compose 网络

Compose 会自动创建 `<project>_default` 网络，服务名可以作为 DNS：

```yaml
services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
    networks:
      - frontend

  api:
    image: myapi:1.0
    networks:
      - frontend
      - backend

  db:
    image: postgres:16
    networks:
      - backend

networks:
  frontend:
  backend:
    internal: true
```

要点：

- 同一网络内服务可以用服务名互相访问。
- `internal: true` 禁止外部访问，适合数据库后端网络。
- `external: true` 使用已存在的网络。
- `ipam` 可以指定子网/网关。
- `aliases` 可以给服务增加 DNS 别名。
- `docker compose down` 默认删除项目网络，`external` 网络不会被删除。

# 防火墙与包过滤

## Docker 与 UFW

Docker 发布端口时在 NAT 表做 DNAT，流量在到达 UFW 的 `INPUT` 链之前就被转发，因此 UFW 可能无法限制已发布端口。

建议：

- 只发布必要端口，尽量绑定 `127.0.0.1` 或内网地址。
- 使用 `DOCKER-USER` 链做来源限制。
- 云环境用安全组/网络 ACL。
- 不要把 Docker API 暴露到公网。

## DOCKER-USER

```bash
iptables -I DOCKER-USER -i eth0 ! -s 10.0.0.0/8 -j DROP
iptables -I DOCKER-USER -p tcp --dport 8080 -s 10.0.0.0/8 -j ACCEPT
```

`DOCKER-USER` 在 Docker 自动规则之前执行，适合自定义放行/拒绝。

## nftables

Docker 29 支持实验性的 nftables 后端：

```json
{
  "firewall-backend": "nftables"
}
```

默认仍使用 iptables 兼容路径。切换前测试端口发布、Docker 网络、防火墙规则和 IP forwarding。nftables 模式下 Docker 不会自动开启 IP forwarding，需要显式配置。

## 关闭 iptables

`--iptables=false` 会让 Docker 不管理 iptables，需要你自己配置 NAT/转发。除非有专门的网络方案，否则不建议。

# 故障排查

## 基础检查

```bash
docker network ls
docker network inspect mynet
docker exec -it app ip addr
docker exec -it app ip route
docker exec -it app cat /etc/resolv.conf
docker exec -it app getent hosts web
docker exec -it app ping -c 2 web
docker exec -it app curl -v http://web:80
```

## 端口与监听

```bash
ss -lntp
docker port web
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

## 抓包与命名空间

```bash
# 宿主机抓包
sudo tcpdump -i any -nn port 8080

# 进入容器网络命名空间
pid=$(docker inspect -f '{{.State.Pid}}' app)
sudo nsenter -t "$pid" -n ip addr
sudo nsenter -t "$pid" -n iptables -t nat -L -n -v
```

## 常见问题

| 现象 | 排查方向 |
| ---- | -------- |
| 容器名解析失败 | 是否在自定义网络、是否使用默认 bridge |
| 端口无法访问 | 是否发布端口、绑定地址、防火墙、安全组 |
| 容器间不通 | 是否同一网络、ICC 是否关闭、网络策略 |
| 宿主机访问容器失败 | 端口绑定、macvlan 限制、host 网络 |
| 外网访问容器失败 | NAT、ip_forward、云安全组、路由 |
| overlay 不通 | Swarm 状态、2377/7946/4789 端口、MTU |
| macvlan 不通 | promiscuous、父接口、VLAN、IP 冲突 |
| DNS 超时 | 上游 DNS、`--dns`、防火墙、resolv.conf |
| 大包卡住 | MTU、VXLAN 封装、路径 MTU |
| 端口冲突 | `ss -lntp`、已有容器、host 网络 |

## 容器无法访问外网

检查：

```bash
sysctl net.ipv4.ip_forward
docker exec -it app ip route
docker exec -it app ping -c 2 8.8.8.8
docker exec -it app getent hosts example.com
```

- `net.ipv4.ip_forward=1`。
- 宿主机 NAT/防火墙规则。
- 容器 DNS 配置。
- 企业代理/出网策略。

# 最佳实践

- 每个应用使用独立的自定义 bridge 网络，不要全部挤在默认 bridge。
- 前后端/数据库分层网络，数据库网络设置 `internal`。
- 只发布必要端口，尽量绑定 `127.0.0.1` 或内网地址。
- 容器间用服务名/别名通信，不写死 IP。
- 规划子网，避免与宿主机、VPN、云内网冲突；用 `default-address-pools` 管理。
- 多主机用 overlay/Swarm 或 Kubernetes CNI，不要手工拼路由。
- macvlan/ipvlan 需要网络团队配合，提前规划 VLAN、MAC、IP。
- 生产启用防火墙/安全组，限制 `DOCKER-USER` 和 Docker API。
- 不要把 `/var/run/docker.sock` 挂进不受信任的容器。
- 监控网络：丢包、重传、MTU、DNS 延迟、端口连接数。
- 变更网络驱动/子网前先测试，避免大范围断网。

# 参考资料

- [Docker Networking overview](https://docs.docker.com/engine/network/)
- [Network drivers](https://docs.docker.com/engine/network/drivers/)
- [Bridge network driver](https://docs.docker.com/engine/network/drivers/bridge/)
- [Host network driver](https://docs.docker.com/engine/network/drivers/host/)
- [Overlay network driver](https://docs.docker.com/engine/network/drivers/overlay/)
- [Macvlan network driver](https://docs.docker.com/engine/network/drivers/macvlan/)
- [IPvlan network driver](https://docs.docker.com/engine/network/drivers/ipvlan/)
- [Port publishing](https://docs.docker.com/engine/network/port-publishing/)
- [Packet filtering and firewalls](https://docs.docker.com/engine/network/packet-filtering-firewalls/)
- [docker network create](https://docs.docker.com/reference/cli/docker/network/create/)
- [Docker Compose](https://docs.docker.com/compose/)

---
title: DHCP笔记
date: 2018-06-05 23:59:29
tags: [server, dhcp]
categories: [应用运维]
---

本篇包含以下内容

- [DHCP 原理](#dhcp-%e5%8e%9f%e7%90%86)
- [DHCP 服务器配置](#dhcp-%e6%9c%8d%e5%8a%a1%e5%99%a8%e9%85%8d%e7%bd%ae)
  - [服务器端](#%e6%9c%8d%e5%8a%a1%e5%99%a8%e7%ab%af)
  - [客户端](#%e5%ae%a2%e6%88%b7%e7%ab%af)
- [DHCP 中继](#dhcp-%e4%b8%ad%e7%bb%a7)

<!-- more -->

## DHCP 原理

DHCP（Dynamic Host Configuration Protocol）用于为客户端动态分配 IP 地址、子网掩码并设置网关等信息。
前身为 BOOTP 协议，工作在应用层，基于 UDP 协议，端口号 67（服务器端），68（客户端），还有一个 546 端口用于 DHCPv6 的客户端。

DHCP 与 BOOTP 最重要的区别：DHCP 支持租期，BOOTP 不支持，BOOTP 分配的 IP 地址是永久的。

**DHCP 提供三种分配方式：**

- 手动分配：静态绑定固定 IP，这些 IP 固定给特定设备使用（打印机，DNS，web 服务器等）
- 自动分配：服务器给客户端分配租期无限长的 IP 地址，只有客户释放，其他客户才能使用该地址
- 动态分配：服务器给客户端分配租期有限长的 IP 地址，一旦租期到期而未续约，地址就会释放。

DHCP 的基本原则：尽可能为客户端分配**原来使用**的地址。
DHCP 的分配顺序：1.静态分配的 2.客户端曾经会用过的 3.最先找到的可用 IP。

**DHCP 报文与请求过程**
{% asset_img dhcp-qingqiu.png %}

DHCP 工作过程

- 发现阶段：
- 提供阶段：
- 选择阶段：
- 确认阶段：
- 重新申请：
- 更新租约：

DHCP 报文

- Discover：客户端第一次向服务器发送的请求报文，广播发送
- Offer：服务器对客户端 Discover 的回应，包含分配的 IP、掩码、网关等信息，广播或单播发送
- Request：客户端发送给服务器的请求报文，包括服务器的选择与租期更新等，单播或广播发送（根据客户端状态）
- Release：客户端若想释放当前地址，则单播发送给服务器
- Ack/Nak：服务器对客户端的回应，请求报文正确时回复 Ack，否则回复 Nak
- Decline：客户端收到服务器的 Ack 后，对获取的 IP 进行确认，使用 ARP，若发现该 IP 已被使用，则广播向服务器发送 Decline 报文，拒绝使用该 IP。
- Inform：当客户端通过其他方式已获取了 IP，若还需要向服务器索取其他配置信息时，会向服务器发送 Inform，若服务器能根据要求分配则会回复 Ack，否则不操作。

**DHCP 续约**

1. 更新状态：使用时间达到租约的 50%，客户端进入更新状态，单播向服务器发送 Request，服务器若同意续约则回复 Ack，否则回复 Nak
2. 重新绑定状态：使用时间达到租约的 87.5%，客户端进入重新绑定状态。客户端广播 Request 请求，请求对有效租期进行更新。
   进入该状态的原因：客户端未收到服务器对续约 Request 的回应。
   若 Request 未收到回应，客户端会在一定时间内重发 Request 报文，若直到租期结束也未更新租期，则被迫释放 IP 地址。

**DHCP 中继**
DHCP 只适用于客户端与服务器在同网段（原因：广播请求），但可以通过中继使客户端可向其他网段的 DHCP 服务器请求。
实现：中继路由器收到请求广播报文，便向服务器单播发送，同理服务器也单播回应中继，中继再广播回应客户端。

## DHCP 服务器配置

实验环境：
全部为 CentOS-7

- 服务器端：system2 192.168.163.102
- 客户端：system3 192.168.163.103

### 服务器端

- 安装 DHCP 服务
  `yum install dhcp dhcp-devel`

  > `dhcp`为服务器端基础组件，`dhcp-devel`为服务器开发工具

      开机自启
      `systemctl enable dhcpd`
      `systemctl start dhcpd`

- 修改配置文件/etc/dhcp/dhcpd.conf
  注：该文件是空的，可以参考模板添加项，模板为`/usr/share/doc/dhcp-4.2.5/dhcpd.conf.example`，其中 dhcp 的版本号可能不一致，可用`find`命令查找

以下为配置文件常见参数的解析，可通过`man 5 dhcpd.conf`查看完整配置参数解析

```
# 服务器名
server-name “system2”;

# DNS域名
option domain-name "example.org";
# DNS服务器域名（最多指定三个）
option domain-name-servers ns1.example.org, ns2.example.org;

# 默认租期，单位秒。在默认租期内，可以进行续约操作
default-lease-time 600;
# 最大租期，单位秒。
max-lease-time 7200;
# 最大租期即客户端IP租约时间的最大值，当客户端超过默认租约时间，虽此时已无法续约，但DHCP会仍然允许用户在最大租约时间内使用该IP，之后就收回该IP

# dhcp与dns动态信息更新模式（必选）
# 三种选择：interim--dns互动更新  ad-hoc--特殊dns更新  none--不支持
# 全局设置中一定要有这个，否则不能成功启动
#ddns-update-style none;

# 如果该DHCP服务器是本地网络的授权服务器，则需要取消注解
#authoritative;

# 忽略客户端更新
ignore client-updates;

# 设置网关
option routers 192.168.163.254;

# 日志类型
log-facility local7;

# 设置ntp服务器
ntp-server [IP地址]

# 子网设置
subnet 10.5.5.0 netmask 255.255.255.224 {
  # 设置地址池
  range 10.5.5.26 10.5.5.30;
  option domain-name-servers ns1.internal.example.org;
  option domain-name "internal.example.org";
  option routers 10.5.5.1;
  # 广播地址
  option broadcast-address 10.5.5.31;
  default-lease-time 600;
  max-lease-time 7200;
}

# shared-network用于跨网段分配IP地址，多用于中继，形成超级作用域
shared-network 224-29 {
  # 配置子网1
  subnet 10.17.224.0 netmask 255.255.255.0 {
    option routers rtr-224.example.org;
  }
  # 配置子网2
  subnet 10.0.29.0 netmask 255.255.255.0 {
    option routers rtr-29.example.org;
  }
}

# host指定客户端客户端的IP地址绑定
# hostname仅仅是标识，无意义
host hostname {
  # 指定目标主机
  hardware ethernet [MAC地址];
  # 绑定IP地址
  fixed-address [ip地址];
}
```

**注：**划分子网时，如果选择直接配置多作用域实现动态 IP 分配的任务，则必须要为 DHCP 服务器添加多块网卡，并配置多个 IP 地址，否则 DHCP 服务器只能分配与其现有网卡 IP 地址对应网段的作用域。

DHCP 租约文件
`/var/lib/dhcpd/dhcpd.leases`
租约数据库文件用于保存一系列的租约声明，其中包含客户端的主机名、MAC 地址、分配到的 IP 地址，以及 IP 地址的有效期等相关信息。
这个数据库文件是可编辑的 ASCII 格式文本文件。每当发生租约变化的时候，都会在文件结尾添加新的租约记录。

### 客户端

需要安装先`dhclient`，然后修改`/etc/sysconfig-network-scripts/ifcfg-ens33`（根据实际网卡名称），修改`BOOTPROTO=dhcp`，重启网络。

## DHCP 中继

DHCP 中继代理（DHCP Relay Agent）用于转发其他网段的客户端 DHCP 请求。当客户端请求

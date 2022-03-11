---
title: Iptables、Selinux与防火墙笔记
date: 2018-06-06 00:04:20
tags: [iptables, 安全, Linux, Selinux, 防火墙, firewalld]
categories: [系统运维]
---

本片包含以下内容：

- [Iptables](#iptables)
  - [Netfilter/Iptables 框架](#netfilteriptables-框架)
  - [iptables 规则](#iptables-规则)
  - [iptables 应用](#iptables-应用)
- [Selinux](#selinux)
- [firewalld](#firewalld)
    - [参考文章](#参考文章)

<!--more-->

# Iptables

## Netfilter/Iptables 框架

Netfilter 是 Linux 2.4.x 引入的一个子系统，它作为一个通用的、抽象的框架，为每种网络协议都提供一整套的 hook 函数的管理机制，使得诸如数据包过滤、网络地址转换(NAT)和基于协议类型的连接跟踪成为了可能。Netfilter 的架构就是在整个网络流程的若干位置放置了一些检测点（HOOK），而在每个检测点上登记了一些处理函数进行处理。

Netfilter 采用的关键技术：

- 连线跟踪（Connection Tracking）：是**包过滤、地址转换的基础**，它作为一个独立的模块运行。在**协议栈低层截取数据包**，将当前数据包及其状态信息**与历史数据包及其状态信息进行比较**，从而得到当前数据包的**控制信息**，根据这些信息决定对网络数据包的操作，达到保护网络的目的。
- 包过滤（Packet Filtering）：检查通过的每个数据包的头部，然后根据规则处理
- 地址转换（NAT）：网络地址转换分为源 NAT（SNAT）、目的 NAT（DNAT）和端口转换（PNAT）。SNAT 修改数据包的源 IP，DNAT 修改数据包的目的 IP。SNAT 在数据包送出之前的最后一刻做好转换工作，DNAT 在数据包进入后立刻完成转换。
- 包处理（Packet Mangling）：可以设置或改变数据包的服务类型（TOS），改变包的生存期（TTL），在包中设置标志值，利用该标志值可以进行带宽限制和分类查询。

> 资料摘自[百度百科-netfilter](https://baike.baidu.com/item/netfilter/8916221?fr=aladdin#2_1)

Netfilter 为 IPv4 定义了 5 个 hook 函数，这些 hook 函数会在数据报流过协议栈的 5 个关键点被调用。

- `NF_IP_PRE_ROUTING`：刚刚进入网络层的数据包通过此点（已完成版本号，校验和等检测）， 目的地址转换在此点进行
- `NF_IP_LOCAL_IN`：经路由查找后，送往本机的数据包通过此检查点，INPUT 包过滤在此点进行
- `NF_IP_FORWARD`：要转发的包通过此检测点，FORWARD 包过滤在此点进行
- `NF_IP_POST_ROUTING`：所有马上要通过网络设备出去的包通过此检测点，内置的源地址转换 SNAT 功能（包括地址伪装）在此点进行
- `NF_IP_LOCAL_OUT`：本机进程发出的包通过此检测点，OUTPUT 包过滤在此点进行

Netfilter 所有的过滤规则都以模块存放在`/usr/lib/modules/$(uname -r)/kernel/net/netfilter/`目录中。在 Linux 内核版本 2.6 前，netfilter 分为`IPv4`版和`IPv6`版，分别存放在`/usr/lib/modules/$(uname -r)/kernel/net/ipv4`和`/usr/lib/modules/$(uname -r)/kernel/net/ipv6`中，Linux2.6 后进行了整合，使得 Netfilter 更加简单高效。

## iptables 规则

iptables 是一个工具，位于用户空间，用于插入，修改，删除数据包过滤表的规则。

iptables 分为三部分：

1. 表：分为四张表

   1. raw 表：是否对该数据包进行状态跟踪

   2. mangle 表：为数据包设置标记，修改数据包（TOS，TTL，MARK）

   3. nat 表：修改数据包中源、目的 IP 地址或端口

   4. filter 表：过滤数据包（对数据包）

      顺序：**raw -> mangle -> nat -> filter**

2. 链：分为五条链

   1. 在路由选择前处理数据包（PREROUTING）

   2. 处理流入的数据包（这条规则起到保证内网不被侵犯的关键作用）（INPUT）

   3. 处理流出的数据包（OUTPUT）

   4. 处理转发的数据包（FORWARD）

   5. 在路由选择后处理数据包（POSTROUTING）

      链顺序：

      - 入站：**prerouting -> input**
      - 出站：**output -> postrouting**
      - 转发：**prerouting -> forward -> postrouting**

3. 规则：规则被分组在链中，**规则被添加到相应的链中，链被添加在表中**。规则表默认是允许，则规则链就是被禁止的规则。若规则表是禁止的，则规则链就是被允许的规则

**完整包过滤流程：**

1. 包到达网络接口
2. 进入 raw 表的 prerouting 链（在连接跟踪前处理数据包）
3. 连接跟踪（若要做）
4. 进入 mangle 表的 prerouting 链，修改数据包
5. 进入 nat 表的 prerouting 链，做 DNAT（目标地址转换，改变数据包目的地址使包能到达内网某服务器），但不做过滤
6. 路由判断
   - 若是要**转发**：进入**mangle 表 forward 链**，然后进入**filter 表的 forward 链过滤**，进入**mangle 表的 postrouting 链**，进入**nat 表的 postrouting 链**，做**SNAT，但不过滤**，然后数据包离开本机。
   - 若是**发给本地**的：进入**mangle 表的 input 链**，进入**filter 表的 input 链**，对数据**包过滤**，然后交给本地程序，处理完后**先判断路由**，进入**raw 表的 output 链**，**连接跟踪**对包的处理，进入**mangle 表的 output 链**，可**修改数据包但不过滤**，进入**nat 表的 output 链，做 NAT**，然后路由，进入**filter 表的 output 链**，可**过滤包**，进入**mangle 表的 postrouiting 链**，进入**nat 表的 postrouting 链**，做**SNAT 但不过滤**，包离开本机。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120042587.png)

## iptables 应用

iptables 有八种匹配后的触发动作：

1. ACCEPT：允许通过
2. DROP：丢弃
3. REJECT：拒绝
4. LOG：记录日志（syslog）
5. DNAT：目的地址转换
6. SNAT：源地址转换
7. MASQUERADE：地址欺骗
8. REDIRECT：重定向

```
iptables [-t 表名] 选项 [链名] [条件] [-j 控制类型（上面八种）]
  -P INPUT (DROP|ACCEPT) 设置默认策略
  -L  查看规则链
  -F  清空规则链
  -A  在链末尾加新规则
  -I num  在链头部加新规则
  -D num  删除指定规则
  -R  替换指定链中的一条匹配规则
  -N  创建一个新链
  -X  删除指定用户的定义链，若未指定就删除所有用户链
  -C  检查数据包是否与指定链规则匹配
  -Z  将指定链中的所有规则byte计数器清零
  匹配参数：
  -s 匹配源IP/mask，加！表示除该IP
  -d  匹配目的地址
  -i [网卡] 匹配流入网卡的数据
  -o [网卡] 匹配流出网卡的数据
  -p [协议] 匹配协议
  -n   ip地址会以数字显示
  --dport num    匹配目标端口号
  --sport num    匹配源端口号
```

# Selinux

# firewalld

RHEL7 中 firewalld 取代了 iptables。firewalld 将所有网络流量都分类汇集到 zones，然后通过 zones 管理防火墙规则。

firewalld 匹配规则：

- 数据包进入系统，首先检查源 IP 地址和网卡接口，若与某个 zone 匹配，则按照该 zone 的规则过滤。每个 zone 都有开启或关闭的服务和端口列表，数据包根据列表决定是否放行。如果数据包不与任何定义的 zone 匹配，则进入默认 zone，默认 zone 的名称为`public`。firewalld 提供以下默认 zone：`home/drop/work/internal/block/public/trusted/dmz/external`，在 fedora 中，还会默认提供`FedoraWorkstation`和`FedoraServer`两个 zone。
-

firewall 命令：

```
firewall-cmd
Status Options
  --state              返回firewalld状态
  --reload             重新加载firewalld，会保留状态信息
  --complete-reload    重载firewalld，不会保留状态信息
  --runtime-to-permanent
                       Create permanent from runtime configuration
  --permanent          设置为永久配置

  --get-default-zone   显示默认zone
  --set-default-zone=<zone>
                       设置默认zone
  --get-active-zones   显示活跃的zone
  --get-zones          显示所有预设的zone
  --get-services       显示所有预设服务
  --list-all-zones     列出所有zone的信息
  --new-zone=<zone>    创建新的zone
  --delete-zone=<zone> 删除指定zone
  --load-zone-defaults=<zone> 加载zone的默认配置
  --zone=<zone>        指定zone进行设置
  --info-zone=<zone>   显示指定zone的信息
  --list-all           列出活跃的zone的信息

  --list-services      列出放行的服务
  --add-service=<service>      添加放行的服务
  --remove-service=<service>   取消放行服务
  --query-service=<service>    返回服务是否放行

  --list-ports         列出zone中放行的端口
  --add-port=<portid>[-<portid>]/<protocol>     放行端口
  --remove-port=<portid>[-<portid>]/<protocol>  取消放行端口
  --query-port=<portid>[-<portid>]/<protocol>  返回端口是否放行

  --list-protocols     列出指定区域添加的协议
  --add-protocol=<protocol> 为指定区域添加协议
  --remove-protocol=<protocol> 去除协议
  --query-protocol=<protocol> 查询是否协议被添加到区域

  --list-source-ports  查看区域中定义的源端口
  --add-source-port=<portid>[-<portid>]/<protocol> 添加设置源端口
  --remove-source-port=<portid>[-<portid>]/<protocol> 去除源端口
  --query-source-port=<portid>[-<portid>]/<protocol> 查询源端口是否属于该区域

  --list-rich-rules    列出所有rich rules
  --add-rich-rule=<rule> 添加rich rules
  --remove-rich-rule=<rule> 去除rich rules
  --query-rich-rule=<rule> 查询指定rich rules是否属于该域

  --list-interfaces    列出区域中的网卡
  --add-interface=<interface> 在区域中添加网卡
  --query-interface=<interface> 查询网卡是否属于一个区域
  --remove-interface=<interface> 从区域移除网卡

  --list-sources       查看区域中定义的源
  --add-source=<source>[/<mask>] 添加源
  --query-source=<source>[/<mask>] 查询区域中是否有指定源
  --remove-source=<source>[/<mask>]  去除区域中指定源
```

### 参考文章

- [firewall-cmd](https://wangchujiang.com/linux-command/c/firewall-cmd.html)

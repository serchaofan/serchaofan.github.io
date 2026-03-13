---
title: VLAN基础笔记
date: 2019-03-21 19:50:08
categories:
  - 网络技术
tags:
  - VLAN
  - 网络基础
  - 交换机
  - H3C
---

# VLAN 基础笔记

## 1. 什么是 VLAN？

**VLAN（Virtual Local Area Network，虚拟局域网）** 是一种逻辑上的分组技术，它可以将物理上位于不同位置的设备划分到同一个逻辑网络中，而无需考虑实际的物理连接。

### 1.1 VLAN 的基本原理

- **逻辑分组**：通过软件配置而非物理布线来实现网络分段
- **广播域隔离**：每个 VLAN 形成独立的广播域
- **提高安全性**：不同 VLAN 之间的通信需要路由器或三层交换机的介入
- **降低成本**：无需额外的物理设备和布线

### 1.2 VLAN 的工作原理

当交换机收到一个以太网帧时：

1. **接收帧**：交换机从端口接收数据帧
2. **检查 VLAN 标签**：
   - 如果帧带有 802.1Q 标签，根据标签中的 VLAN ID 进行处理
   - 如果帧没有标签，根据端口的 PVID（Port VLAN ID）进行标记
3. **在 VLAN 内转发**：仅将帧转发到属于同一 VLAN 的端口
4. **发送帧**：根据端口配置决定是否移除 VLAN 标签

```
┌─────────────────────────────────────────────────────────┐
│                      交换机                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐  │
│  │ Port 1  │   │ Port 2  │   │ Port 3  │   │ Port 4  │  │
│  │ VLAN 10 │   │ VLAN 10 │   │ VLAN 20 │   │ VLAN 20 │  │
│  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘  │
│       │             │             │             │       │
│   [PC A]       [PC B]         [PC C]       [PC D]    │
│  192.168.10.10  192.168.10.20  192.168.20.10  192.168.20.20  │
└─────────────────────────────────────────────────────────┘
        ▲                    ▲
        │                    │
    同一 VLAN            同一 VLAN
    可以通信            可以通信
        │                    │
        ▼                    ▼
    [PC A] ←→ [PC B]    [PC C] ←→ [PC D]
```

## 2. VLAN 的编号与标准

### 2.1 VLAN ID 范围

| 范围 | 用途 | 说明 |
|------|------|------|
| 0、4095 | 保留 | 不可使用 |
| 1 | 默认 VLAN | 系统默认，所有端口初始属于 VLAN 1 |
| 2-1001 | 正常范围 | 可自由使用的标准 VLAN |
| 1002-1005 | 保留 | 用于 FDDI 和 Token Ring |
| 1006-4094 | 扩展范围 | 部分设备支持（需设备具备能力） |

### 2.2 特殊 VLAN 说明

- **VLAN 1**：
  - 默认 VLAN，无法删除
  - 默认情况下所有端口都属于 VLAN 1
  - 控制平面协议（如 STP）通常使用 VLAN 1
  - 建议将管理地址配置在其他 VLAN

- **VLAN 1002-1005**：
  - 保留给 FDDI 和 Token Ring 网络
  - 现代网络基本不使用

- **VLAN 4095**：
  - 某些设备用作内部用途

### 2.3 本征 VLAN（Native VLAN）

- 用于处理未标记的流量（Untagged Traffic）
- 默认情况下是 VLAN 1
- 在 Trunk 链路上传输时不会添加 VLAN 标签
- 两端设备的 Native VLAN 必须一致，否则可能导致 VLAN 跳跃攻击

## 3. VLAN 的类型

### 3.1 基于端口的 VLAN（Port-based VLAN）

最常见的 VLAN 分配方式，将交换机的端口分配给特定的 VLAN。

**工作原理**：
```
                    交换机端口
                        │
            ┌───────────┼───────────┐
            │           │           │
        [Port 1]   [Port 2]    [Port 3]
        VLAN 10    VLAN 10     VLAN 20
            │           │           │
            ▼           ▼           ▼
         [PC A]     [PC B]      [PC C]
```

**优点**：
- 配置简单直观
- 易于理解和维护
- 安全性较高
- 性能开销小

**缺点**：
- 用户物理位置变化时需要重新配置端口
- 端口资源分配不够灵活

### 3.2 基于 MAC 地址的 VLAN（MAC-based VLAN）

根据网卡的 MAC 地址来分配 VLAN，实现用户与 VLAN 的绑定。

**工作原理**：
```
   MAC 地址表
┌──────────────────┐
│ 00:11:22:33:44:55 → VLAN 10 │
│ 00:11:22:33:44:66 → VLAN 20 │
│ 00:11:22:33:44:77 → VLAN 30 │
└──────────────────┘
        │
        ▼
   交换机根据 MAC 地址
   自动标记 VLAN 标签
```

**优点**：
- 用户移动时无需物理端口变更
- 支持用户自由移动（Hotspot 场景）
- 更高的灵活性

**缺点**：
- 配置复杂，需要维护大量 MAC-VLAN 映射
- 所有帧都需要检查 MAC 地址，增加 CPU 负担
- MAC 地址可伪造，安全性相对较低

### 3.3 基于协议的 VLAN（Protocol-based VLAN）

根据数据包的网络层协议（如 IP、IPX、AppleTalk）来划分 VLAN。

**支持的协议类型**：
- IP（IPv4）
- IPv6
- IPX
- AppleTalk
- 等等

**应用场景**：
- 同一物理网络中需要运行多种协议
- 需要根据协议类型进行网络隔离

### 3.4 基于 IP 子网的 VLAN（IP Subnet-based VLAN）

根据 IP 地址和子网掩码来划分 VLAN。

**配置逻辑**：
```
IP 地址范围              VLAN
─────────────────────────────
192.168.10.0/24    →    VLAN 10（研发部）
192.168.20.0/24    →    VLAN 20（市场部）
192.168.30.0/24    →    VLAN 30（财务部）
```

**优点**：
- 符合网络分层设计
- 便于路由汇总
- 用户迁移时自动跟随

**缺点**：
- 需要交换机支持三层功能
- 配置相对复杂

### 3.5 基于策略的 VLAN（Policy-based VLAN）

结合多种属性（MAC、IP、端口、协议等）进行 VLAN 划分。

**常见组合**：
- MAC + IP + 端口
- 用户组 + 位置
- 认证信息 + IP 子网

## 4. VLAN Trunk

### 4.1 什么是 Trunk？

Trunk（干线/中继）是一条连接两台交换机的链路，能够在单条物理链路上承载多个 VLAN 的流量。

**对比示意**：

```
未使用 Trunk（多条物理链路）：
Switch A                              Switch B
┌─────┐                               ┌─────┐
│VLAN10│───Link1───(VLAN10)───▶      │VLAN10│
│VLAN20│───Link2───(VLAN20)───▶      │VLAN20│
│VLAN30│───Link3───(VLAN30)───▶      │VLAN30│
└─────┘                               └─────┘
   3 条物理链路                         3 条物理链路

使用 Trunk（单条物理链路）：
Switch A                              Switch B
┌─────┐                               ┌─────┐
│VLAN10│┐                         ┌───▶│VLAN10│
│VLAN20│├────Link────(Trunk)────▶    │VLAN20│
│VLAN30│┘                         └──▶│VLAN30│
└─────┘                               └─────┘
   1 条物理链路                         1 条物理链路
```

### 4.2 Trunk 协议：IEEE 802.1Q

**802.1Q 是业界标准的 VLAN 标记协议**，在原始以太网帧中插入 4 字节的 VLAN 标签。

**802.1Q 帧格式**：

```
原始帧：
┌──────┬──────┬─────────────┬──────┐
│  DA  │  SA  │   Type      │ Data │
│  6B  │  6B  │   2B        │      │
└──────┴──────┴─────────────┴──────┘

802.1Q 标记后：
┌──────┬──────┬────────┬──────┬─────────────┬──────┐
│  DA  │  SA  │  Tag   │ Type │    Data     │ FCS  │
│  6B  │  6B  │  4B    │ 2B   │             │  4B  │
└──────┴──────┴────────┴──────┴─────────────┴──────┘
                 │
                 ▼
         ┌──────────────┐
         │     Tag      │
         ├──────────────┤
         │ TPID:0x8100  │  2B  (Tag Protocol Identifier)
         │    TCI       │  2B  (Tag Control Information)
         │  ├─ PCP 3位  │      Priority Code Point (0-7)
         │  ├─ DEI 1位  │      Drop Eligibility Indicator
         │  └─ VID 12位 │     VLAN ID (0-4095)
         └──────────────┘
```

**TPID（Tag Protocol Identifier）**：
- 标准值：0x8100
- 某些厂商使用自定义值（如 QinQ 外层标签）

**TCI（Tag Control Information）**：

| 字段 | 长度 | 说明 |
|------|------|------|
| PCP | 3 位 | Priority Code Point，IEEE 802.1p 优先级（0=最低，7=最高） |
| DEI | 1 位 | Drop Eligibility Indicator，表示帧的丢弃优先级 |
| VLAN ID | 12 位 | 标识 VLAN，总共支持 4094 个 VLAN（0 和 4095 保留） |

### 4.3 VLAN 标签处理流程

```
发送方向（Tagging）：
┌────────────┐    ┌────────────┐    ┌────────────┐
│  数据帧    │───▶│ 添加 VLAN   │───▶│  发送帧   │
│ (无标签)   │    │   标签     │    │ (有标签)  │
└────────────┘    └────────────┘    └────────────┘

接收方向（Untagging）：
┌────────────┐    ┌────────────┐    ┌────────────┐
│  接收帧    │───▶│ 移除 VLAN   │───▶│  数据帧   │
│ (有标签)   │    │   标签     │    │ (无标签)  │
└────────────┘    └────────────┘    └────────────┘
```

### 4.4 Trunk 端口类型

| 端口类型 | 收到 Untagged 帧 | 发送帧 |
|----------|------------------|--------|
| Access | 标记为 PVID | 移除 VLAN 标签 |
| Trunk | 标记为 Native VLAN | 保留 VLAN 标签（Native VLAN 除外） |
| Hybrid | 可配置 | 可配置是否带标签 |

### 4.5 Trunk 链路协商

**LACP（Link Aggregation Control Protocol）**：
- IEEE 802.3ad 标准
- 动态协商聚合链路
- 支持负载均衡

**PAgP（Port Aggregation Protocol）**：
- Cisco 私有协议
- 仅在 Cisco 设备间使用

**静态 Trunk**：
- 手动配置，不进行协商
- 最安全可靠的方式

### 4.6 Trunk 配置注意事项

1. **两端协议一致**：确保交换机两端使用相同的 Trunk 协议
2. **Native VLAN 一致**：确保两端的 Native VLAN 相同
3. **VLAN 列表一致**：确保允许的 VLAN 列表一致
4. **MTU 足够**：Trunk 会增加 4 字节，确保 MTU >= 1504

## 5. VLAN 间路由

### 5.1 为什么要进行 VLAN 间路由？

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  VLAN 10: 192.168.10.0/24     VLAN 20: 192.168.20.0/24  │
│  ┌─────────┐                     ┌─────────┐   │
│  │  PC A   │                     │  PC B   │   │
│  │   .10   │                     │   .20   │   │
│  └────┬────┘                     └────┬────┘   │
│       │                               │       │
│       │  ❌ 不能直接通信              │       │
│       │  (不同 VLAN/广播域)           │       │
│       ▼                               ▼       │
│  ┌─────────────────────────────────────────┐   │
│  │            三层设备（路由器/三层交换机） │   │
│  │            进行 VLAN 间路由              │   │
│  └─────────────────────────────────────────┘   │
│                      │                          │
│                      │ ✅ 通过路由通信          │
│                      ▼                          │
│               [允许跨 VLAN 通信]                │
└─────────────────────────────────────────────────┘
```

### 5.2 方式一：路由器 + 物理接口

使用路由器为每个 VLAN 分配独立的物理接口。

**网络拓扑**：
```
         Router
    ┌─────────────┐
    │  Eth0/1     │───▶ VLAN 10 (192.168.10.0/24)
    │  Eth0/2     │───▶ VLAN 20 (192.168.20.0/24)
    │  Eth0/3     │───▶ VLAN 30 (192.168.30.0/24)
    └─────────────┘
```

**优点**：
- 配置简单直观
- 易于理解
- 故障排查简单

**缺点**：
- 占用大量路由器接口
- 成本较高
- 可扩展性差

### 5.3 方式二：路由器子接口（Router on a Stick）

在路由器的一个物理接口上配置多个子接口，每个子接口对应一个 VLAN。

**网络拓扑**：
```
                    Router
                 ┌──────────┐
    VLAN 10 ────▶│Eth0.1    │  192.168.10.1/24
    VLAN 20 ────▶│Eth0.2    │  192.168.20.1/24
    VLAN 30 ────▶│Eth0.3    │  192.168.30.1/24
                 │Eth0      │◀──── Trunk
                 └──────────┘
                      │
                      │ Trunk (802.1Q)
                      │
                 ┌──────────┐
                 │ Switch   │
                 └──────────┘
```

**工作原理**：
1. 交换机将带 VLAN 标签的帧发送给路由器
2. 路由器根据子接口的 VLAN ID 匹配相应的子接口
3. 路由器进行路由转发
4. 路由器将帧打上目标 VLAN 标签后发送回交换机

**优点**：
- 节省路由器接口
- 易于扩展
- 成本较低

**缺点**：
- 所有流量经过单条链路，带宽可能成为瓶颈
- 需要 Trunk 链路支持

### 5.4 方式三：三层交换机（SVI）

使用三层交换机的交换虚拟接口（SVI，Switch Virtual Interface）实现 VLAN 间路由。

**网络拓扑**：
```
                三层交换机
    ┌────────────────────────────┐
    │                            │
    │  ┌─────┐  ┌─────┐  ┌─────┐ │
    │  │VLAN10│  │VLAN20│  │VLAN30│ │
    │  │ .1  │  │ .1  │  │ .1  │ │
    │  └──┬──┘  └──┬──┘  └──┬──┘ │
    │     │        │        │    │
    │     └────────┼────────┘    │
    │              │             │
    │         [三层交换引擎]      │
    │              │             │
    └──────────────┼─────────────┘
                   │
              ┌────┴────┐
              │ 核心路由 │
              └─────────┘
```

**工作原理**：
1. 三层交换机维护 VLAN 接口
2. 同一 VLAN 内的通信通过二层交换
3. 不同 VLAN 间的通信通过三层交换引擎路由
4. 使用 ASIC 硬件转发，性能高

**优点**：
- 性能高（硬件转发）
- 延迟低
- 易于扩展
- 功能丰富（支持 ACL、QoS 等）

**缺点**：
- 成本较高
- 配置相对复杂

### 5.5 VLAN 间路由配置对比

| 特性 | 路由器物理接口 | 路由器子接口 | 三层交换机 SVI |
|------|---------------|-------------|---------------|
| 性能 | 中 | 中 | 高 |
| 成本 | 高 | 中 | 中高 |
| 扩展性 | 差 | 好 | 好 |
| 配置复杂度 | 低 | 中 | 中 |
| 延迟 | 高 | 中 | 低 |
| 适用场景 | 小型网络 | 中型网络 | 中大型网络 |

## 6. 华三（H3C）交换机 VLAN 配置详解

### 6.1 创建 VLAN

**方法一：创建单个 VLAN**
```bash
# 进入系统视图
<H3C> system-view

# 创建 VLAN 10
[H3C] vlan 10

# 命名 VLAN（可选）
[H3C-vlan10] name 研发部

# 退出 VLAN 视图
[H3C-vlan10] quit
```

**方法二：批量创建 VLAN**
```bash
# 连续创建多个 VLAN
[H3C] vlan 10 to 20

# 创建不连续的多个 VLAN
[H3C] vlan 10, 20, 30, 50
```

**方法三：创建 VLAN 并进入 VLAN 视图**
```bash
[H3C] vlan 100
[H3C-vlan100] #
# 可以继续配置 VLAN 相关属性
```

### 6.2 查看 VLAN 信息

```bash
# 查看所有 VLAN
[H3C] display vlan

# 查看特定 VLAN 信息
[H3C] display vlan 10

# 查看 VLAN 简要信息
[H3C] display vlan brief

# 查看端口 VLAN 配置
[H3C] display port vlan [interface-type interface-number]
```

**display vlan 输出示例**：
```
 VLAN ID: 10
 VLAN Name: 研发部
 VLAN Type: Static
 VLAN State: Active
 VLAN Description: 
 Remote VLAN: No
 MSTP ID: 0
```

### 6.3 分配端口到 VLAN

#### 6.3.1 Access 端口配置

**步骤 1：进入端口视图**
```bash
[H3C] interface GigabitEthernet 1/0/1
```

**步骤 2：配置端口类型为 Access**
```bash
[H3C-GigabitEthernet1/0/1] port link-type access
```

**步骤 3：分配端口到 VLAN**
```bash
# 方法一：同时配置端口类型和 VLAN
[H3C-GigabitEthernet1/0/1] port default vlan 10

# 方法二：先配置端口类型，再分配 VLAN
[H3C-GigabitEthernet1/0/1] port link-type access
[H3C-GigabitEthernet1/0/1] port default vlan 10
```

**步骤 4：验证配置**
```bash
[H3C-GigabitEthernet1/0/1] display this
#
interface GigabitEthernet1/0/1
 port link-type access
 port default vlan 10
#
return
```

#### 6.3.2 批量将端口加入 VLAN

**方法一：端口组方式**
```bash
# 创建端口组
[H3C] port-group manual 1

# 将端口加入端口组
[H3C-port-group-manual-1] group-member GigabitEthernet 1/0/1 to GigabitEthernet 1/0/10

# 批量配置端口类型和 VLAN
[H3C-port-group-manual-1] port link-type access
[H3C-port-group-manual-1] port default vlan 10
```

**方法二：VLAN 视图方式**
```bash
# 进入 VLAN 视图
[H3C] vlan 10

# 将端口加入 VLAN
[H3C-vlan10] port GigabitEthernet 1/0/1 to GigabitEthernet 1/0/10
```

#### 6.3.3 Hybrid 端口配置

Hybrid 端口可以同时处理 tagged 和 untagged 流量，更加灵活。

**配置示例：**
```bash
# 进入端口视图
[H3C] interface GigabitEthernet 1/0/1

# 配置端口类型为 Hybrid
[H3C-GigabitEthernet1/0/1] port link-type hybrid

# 配置 PVID（默认为 VLAN 1）
[H3C-GigabitEthernet1/0/1] port hybrid pvid vlan 10

# 配置允许通过的 VLAN（Tagged）
[H3C-GigabitEthernet1/0/1] port hybrid vlan 10 20 30 tagged

# 配置允许通过的 VLAN（Untagged）
[H3C-GigabitEthernet1/0/1] port hybrid vlan 10 20 30 untagged
```

**Hybrid 端口详细配置说明**：

| 命令 | 说明 |
|------|------|
| `port hybrid vlan vlan-id-list tagged` | 发送时保留 VLAN 标签 |
| `port hybrid vlan vlan-id-list untagged` | 发送时移除 VLAN 标签 |
| `port hybrid pvid vlan vlan-id` | 设置端口的 PVID |

### 6.4 Trunk 端口配置

#### 6.4.1 基本 Trunk 配置

```bash
# 进入端口视图
[H3C] interface GigabitEthernet 1/0/24

# 配置端口类型为 Trunk
[H3C-GigabitEthernet1/0/24] port link-type trunk

# 允许通过的 VLAN
[H3C-GigabitEthernet1/0/24] port trunk permit vlan 10 20 30

# 或者允许所有 VLAN
[H3C-GigabitEthernet1/0/24] port trunk permit vlan all
```

#### 6.4.2 配置 Native VLAN

```bash
# 配置 Native VLAN（默认为 VLAN 1）
[H3C-GigabitEthernet1/0/24] port trunk native vlan 10
```

#### 6.4.3 Trunk 配置示例

```bash
# 交换机 A 配置
#
# 创建 VLAN
vlan 10
 name 研发部
vlan 20
 name 市场部

# 配置上联端口为 Trunk
interface GigabitEthernet 1/0/24
 port link-type trunk
 port trunk permit vlan 10 20
 port trunk native vlan 1

# 配置下联端口为 Access
interface GigabitEthernet 1/0/1
 port link-type access
 port default vlan 10

interface GigabitEthernet 1/0/2
 port link-type access
 port default vlan 20
```

### 6.5 VLAN 间路由配置（三层交换机）

#### 6.5.1 启用 IP 路由

```bash
# 启用三层转发功能
[H3C] ip routing enable
# 或者在某些型号上
[H3C] ip forwarding
```

#### 6.5.2 配置 SVI 接口

```bash
# 方法一：直接创建 VLAN 接口
[H3C] interface Vlan-interface 10
[H3C-Vlan-interface10] ip address 192.168.10.1 255.255.255.0
[H3C-Vlan-interface10] description 研发部网关

# 创建第二个 VLAN 接口
[H3C] interface Vlan-interface 20
[H3C-Vlan-interface20] ip address 192.168.20.1 255.255.255.0
[H3C-Vlan-interface20] description 市场部网关
```

#### 6.5.3 完整配置示例

```bash
# ============================================
# H3C 三层交换机 VLAN 间路由完整配置
# ============================================

# 系统基础配置
sysname H3C-Core-Switch
ip routing enable

# 创建 VLAN
vlan 10
 name 研发部
vlan 20
 name 市场部
vlan 30
 name 财务部
vlan 100
 name 管理网

# 配置 Access 端口
#
# 研发部接入端口
interface range GigabitEthernet 1/0/1 to GigabitEthernet 1/0/10
 port link-type access
 port default vlan 10

# 市场部接入端口
interface range GigabitEthernet 1/0/11 to GigabitEthernet 1/0/20
 port link-type access
 port default vlan 20

# 财务部接入端口（安全隔离）
interface range GigabitEthernet 1/0/21 to GigabitEthernet 1/0/25
 port link-type access
 port default vlan 30

# 配置 Trunk 端口（连接汇聚层交换机）
interface GigabitEthernet 1/0/48
 port link-type trunk
 port trunk permit vlan 10 20 30 100
 port trunk native vlan 100

# 配置 VLAN 接口（网关）
#
# 研发部网关
interface Vlan-interface 10
 ip address 192.168.10.1 255.255.255.0
 description Gateway for R&D

# 市场部网关
interface Vlan-interface 20
 ip address 192.168.20.1 255.255.255.0
 description Gateway for Marketing

# 财务部网关
interface Vlan-interface 30
 ip address 192.168.30.1 255.255.255.0
 description Gateway for Finance

# 管理网网关
interface Vlan-interface 100
 ip address 192.168.100.1 255.255.255.0
 description Management

# 保存配置
save force
```

#### 6.5.4 验证 VLAN 间路由

```bash
# 查看 VLAN 接口状态
[H3C] display ip interface brief

# 查看路由表
[H3C] display ip routing-table

# 测试连通性
[H3C] ping 192.168.10.10
[H3C] ping 192.168.20.10

# 查看 VLAN 信息
[H3C] display vlan
[H3C] display vlan 10
```

### 6.6 VLAN ACL 配置

#### 6.6.1 基本 VLAN ACL

```bash
# 创建 ACL
[H3C] acl advanced 3000

# 配置 ACL 规则（禁止 VLAN 10 访问 VLAN 20）
[H3C-acl-ipv4-adv-3000] rule permit ip source 192.168.10.0 0.0.0.255 destination 192.168.20.0 0.0.0.255
[H3C-acl-ipv4-adv-3000] rule deny ip source any destination any

# 应用 ACL 到 VLAN
[H3C] vlan 10
[H3C-vlan10] packet-filter 3000 inbound
```

#### 6.6.2 基于 VLAN 的流量控制

```bash
# 创建 QoS 策略
[H3C] qos policy VLAN10-Policy

# 配置流量分类
[H3C-qospolicy-VLAN10-Policy] classifier VLAN10-Class behavior VLAN10-Behavior

# 配置流量整形
[H3C-qosbehavior-VLAN10-Behavior] car cir 1024000 pir 2048000

# 应用到 VLAN
[H3C] vlan 10
[H3C-vlan10] qos apply policy VLAN10-Policy inbound
```

### 6.7 端口安全配置

#### 6.7.1 静态 MAC 地址绑定

```bash
# 进入端口视图
[H3C] interface GigabitEthernet 1/0/1

# 启用端口安全
[H3C-GigabitEthernet1/0/1] port security enable

# 配置安全 MAC 地址（静态绑定）
[H3C-GigabitEthernet1/0/1] port security mac-address 00:11:22:33:44:55 vlan 10

# 配置最大安全 MAC 地址数
[H3C-GigabitEthernet1/0/1] port security max-mac-num 5

# 配置违规动作
[H3C-GigabitEthernet1/0/1] port security violation protect
# 可选：protect（丢弃）、restrict（丢弃+告警）、shutdown（关闭端口）
```

#### 6.7.2 动态 MAC 地址学习

```bash
# 进入端口视图
[H3C] interface GigabitEthernet 1/0/1

# 配置端口安全模式
[H3C-GigabitEthernet1/0/1] port security mode macAddressLearned

# 配置 MAC 地址老化时间
[H3C-GigabitEthernet1/0/1] port security mac-address aging time 1440
```

### 6.8 QinQ 配置（双层 VLAN 标签）

QinQ（802.1Q-in-802.1Q）用于实现 VLAN 标签的嵌套。

#### 6.8.1 基本 QinQ 配置

```bash
# 进入端口视图
[H3C] interface GigabitEthernet 1/0/1

# 配置端口类型为 QinQ
[H3C-GigabitEthernet1/0/1] port link-type dot1q-tunnel

# 配置外层 VLAN（运营商 VLAN）
[H3C-GigabitEthernet1/0/1] port dot1q vlan 100

# 启用 VLAN 标签学习
[H3C-GigabitEthernet1/0/1] dot1q tunnel encapsulation ignore-ctl
```

#### 6.8.2 灵活 QinQ（VLAN Mapping）

```bash
# 进入端口视图
[H3C] interface GigabitEthernet 1/0/1

# 配置灵活 QinQ
[H3C-GigabitEthernet1/0/1] port vlan-mapping vlan 10 map dot1q vid 100
[H3C-GigabitEthernet1/0/1] port vlan-mapping vlan 20 map dot1q vid 200
```

## 7. Linux VLAN 配置

### 7.1 使用 ip 命令配置 VLAN

#### 7.1.1 创建 VLAN 接口

```bash
# 方法一：使用 ip 命令创建 VLAN
ip link add link eth0 name eth0.10 type vlan id 10

# 方法二：简写方式
ip link add eth0.10 type vlan id 10
```

#### 7.1.2 配置 IP 地址

```bash
# 为 VLAN 接口配置 IP 地址
ip addr add 192.168.10.1/24 dev eth0.10

# 启用 VLAN 接口
ip link set eth0.10 up

# 查看 VLAN 接口
ip addr show eth0.10
```

#### 7.1.3 删除 VLAN 接口

```bash
# 删除 VLAN 接口
ip link delete eth0.10
```

#### 7.1.4 完整示例

```bash
# 创建 VLAN 10
ip link add link eth0 name eth0.10 type vlan id 10
ip addr add 192.168.10.1/24 dev eth0.10
ip link set eth0.10 up

# 创建 VLAN 20
ip link add link eth0 name eth0.20 type vlan id 20
ip addr add 192.168.20.1/24 dev eth0.20
ip link set eth0.20 up

# 启用 IP 转发
echo 1 > /proc/sys/net/ipv4/ip_forward

# 查看所有 VLAN 接口
ip -d link show | grep -A 1 vlan
```

### 7.2 使用 vconfig 命令配置 VLAN（传统方法）

```bash
# 安装 vconfig（如需要）
# apt-get install vlan

# 创建 VLAN
vconfig add eth0 10

# 配置 IP 地址
ifconfig eth0.10 192.168.10.1 netmask 255.255.255.0 up

# 设置 VLAN Tag
vconfig set_flag eth0.10 1 1
```

### 7.3 网桥 + VLAN 配置

在虚拟化环境中，通常需要结合网桥和 VLAN 使用。

#### 7.3.1 创建网桥

```bash
# 创建网桥
ip link add br0 type bridge

# 启用网桥
ip link set br0 up
```

#### 7.3.2 将物理端口加入网桥

```bash
# 将物理端口加入网桥
ip link set eth0 master br0

# 或者先创建子接口再加入网桥
ip link add eth0.10 type vlan id 10
ip link set eth0.10 master br0
```

#### 7.3.3 完整示例：KVM + VLAN

```bash
# 创建网桥 br0
ip link add br0 type bridge
ip link set br0 up

# 为每个 VLAN 创建网桥
ip link add br0.10 type bridge
ip link add link br0 name br0.10 type vlan id 10
ip link set br0.10 up

# 将虚拟机端口加入对应的 VLAN 网桥
ip link set vnet0 master br0.10
```

### 7.4 systemd-networkd 配置 VLAN

在现代 Linux 系统中，可以使用 systemd-networkd 配置 VLAN。

#### 7.4.1 网络配置文件

```ini
# /etc/systemd/network/10-eth0.network
[Match]
Name=eth0

[Network]
DHCP=no

# /etc/systemd/network/20-eth0.10.netdev
[NetDev]
Name=eth0.10
Kind=vlan

[VLAN]
Id=10

# /etc/systemd/network/30-eth0.10.network
[Match]
Name=eth0.10

[Network]
Address=192.168.10.1/24
```

### 7.5 Debian/Ubuntu 网络配置文件

```bash
# /etc/network/interfaces

# 物理接口
auto eth0
iface eth0 inet manual

# VLAN 10
auto eth0.10
iface eth0.10 inet static
    address 192.168.10.1
    netmask 255.255.255.0
    vlan-raw-device eth0

# VLAN 20
auto eth0.20
iface eth0.20 inet static
    address 192.168.20.1
    netmask 255.255.255.0
    vlan-raw-device eth0
```

### 7.6 CentOS/RHEL 网络配置文件

```bash
# /etc/sysconfig/network-scripts/ifcfg-eth0
DEVICE=eth0
TYPE=Ethernet
ONBOOT=yes
BOOTPROTO=none

# /etc/sysconfig/network-scripts/ifcfg-eth0.10
DEVICE=eth0.10
VLAN=yes
TYPE=Vlan
PHYSDEV=eth0
VLAN_ID=10
BOOTPROTO=static
IPADDR=192.168.10.1
NETMASK=255.255.255.0
ONBOOT=yes
```

## 8. VLAN 高级特性

### 8.1 Super VLAN（聚合 VLAN）

Super VLAN（也称 VLAN 聚合）允许一个 VLAN 包含多个 Sub VLAN，节省 IP 地址。

**应用场景**：
- 大量小型部门需要独立广播域
- IP 地址资源有限

```bash
# 创建 Super VLAN
[H3C] vlan 100
[H3C-vlan100] supervlan

# 创建 Sub VLAN
[H3C] vlan 10
[H3C-vlan10] subvlan 101 102 103

# 配置 Sub VLAN IP 地址（同一网段，不同子网段）
[H3C] interface Vlan-interface 100
[H3C-Vlan-interface100] ip address 192.168.100.1 255.255.255.0

# 配置 ARP 代理（可选）
[H3C-Vlan-interface100] arp proxy enable
```

### 8.2 MSTP + VLAN

MSTP（Multiple Spanning Tree Protocol）结合 VLAN 使用，实现负载均衡。

```bash
# 启用 MSTP
[H3C] stp enable
[H3C] stp mode mstp

# 配置 MST 域
[H3C] stp region-configuration
 [H3C-mstp-region] region-name H3C-Network
 [H3C-mstp-region] revision-level 1
 [H3C-mstp-region] instance 10 vlan 10 20
 [H3C-mstp-region] instance 20 vlan 30 40
 [H3C-mstp-region] active region-configuration

# 配置根桥
[H3C] stp instance 10 root primary
[H3C] stp instance 20 root secondary
```

### 8.3 Voice VLAN（语音 VLAN）

用于为 IP 电话划分专用 VLAN，确保语音流量优先传输。

```bash
# 全局启用 Voice VLAN
[H3C] voice vlan enable

# 配置 Voice VLAN 模式
[H3C] voice vlan mode auto

# 进入端口视图配置
[H3C] interface GigabitEthernet 1/0/1
[H3C-GigabitEthernet1/0/1] voice vlan vlan-id 100
[H3C-GigabitEthernet1/0/1] voice vlan qos 6
```

### 8.4 Guest VLAN（访客 VLAN）

用于为未授权用户提供有限的网络访问。

```bash
# 配置 Guest VLAN
[H3C] interface GigabitEthernet 1/0/1
[H3C-GigabitEthernet1/0/1] guest vlan 200

# 配置认证失败 VLAN
[H3C-GigabitEthernet1/0/1] auth-fail vlan 300
```

## 9. 常见问题与故障排查

### 9.1 常见 VLAN 配置错误

#### 9.1.1 Native VLAN 不匹配

**问题描述**：
Trunk 两端的 Native VLAN 不同，导致 VLAN 跳跃攻击或通信异常。

**错误配置示例**：
```
Switch A: port trunk native vlan 10
Switch B: port trunk native vlan 1   # 错误！不一致
```

**正确配置**：
```
Switch A: port trunk native vlan 10
Switch B: port trunk native vlan 10  # 必须一致
```

**安全建议**：将 Native VLAN 改为不使用的 VLAN
```
[H3C] interface GigabitEthernet 1/0/24
[H3C-GigabitEthernet1/0/24] port trunk native vlan 999
```

#### 9.1.2 Trunk 端口未允许所需 VLAN

**问题描述**：Trunk 端口未允许特定 VLAN 通过，导致跨交换机 VLAN 通信失败。

**排查步骤**：
```bash
# 查看 Trunk 端口允许的 VLAN
[H3C] display port trunk interface GigabitEthernet 1/0/24
```

**解决方法**：
```bash
[H3C] interface GigabitEthernet 1/0/24
[H3C-GigabitEthernet1/0/24] port trunk permit vlan 10 20 30
```

#### 9.1.3 PVID 与 VLAN 不匹配

**问题描述**：Access 端口的 PVID 与分配的 VLAN 不一致。

**解决方法**：
```bash
[H3C] interface GigabitEthernet 1/0/1
[H3C-GigabitEthernet1/0/1] port default vlan 10
# 或
[H3C-GigabitEthernet1/0/1] port hybrid pvid vlan 10
```

### 9.2 故障排查命令

#### 9.2.1 查看 VLAN 信息

```bash
# 查看所有 VLAN
[H3C] display vlan

# 查看特定 VLAN 成员
[H3C] display vlan 10

# 查看端口 VLAN 映射
[H3C] display port vlan GigabitEthernet 1/0/1
```

#### 9.2.2 查看 MAC 地址表

```bash
# 查看整个 MAC 地址表
[H3C] display mac-address

# 查看特定 VLAN 的 MAC 地址
[H3C] display mac-address vlan 10

# 查看特定端口的 MAC 地址
[H3C] display mac-address interface GigabitEthernet 1/0/1
```

#### 9.2.3 查看 Trunk 状态

```bash
# 查看所有 Trunk 端口状态
[H3C] display port trunk

# 查看特定 Trunk 端口详情
[H3C] display port trunk interface GigabitEthernet 1/0/24
```

#### 9.2.4 查看 STP 状态

```bash
# 查看 STP 简要信息
[H3C] display stp brief

# 查看 MSTP 实例
[H3C] display stp instance 10

# 查看端口 STP 角色
[H3C] display stp interface GigabitEthernet 1/0/1
```

### 9.3 VLAN 间路由故障排查

#### 9.3.1 检查 VLAN 接口状态

```bash
# 查看所有 VLAN 接口
[H3C] display ip interface brief

# 查看特定 VLAN 接口详情
[H3C] display interface Vlan-interface 10
```

#### 9.3.2 检查路由表

```bash
# 查看路由表
[H3C] display ip routing-table

# 查看特定网段的路由
[H3C] display ip routing-table 192.168.10.0
```

#### 9.3.3 测试连通性

```bash
# 从交换机 ping 同一 VLAN 内的设备
[H3C] ping 192.168.10.10

# 从交换机 ping 不同 VLAN 的设备
[H3C] ping 192.168.20.10

# 使用 tracert 追踪路径
[H3C] tracert 192.168.20.10
```

### 9.4 VLAN 通信问题排查流程

```
┌─────────────────────────────────────────────┐
│         VLAN 通信问题排查流程               │
└─────────────────────────────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 1. 检查物理连接     │
         │ - 端口是否 UP       │
         │ - 灯状态是否正常    │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 2. 检查 VLAN 配置  │
         │ - 端口是否在正确    │
         │   的 VLAN 中       │
         │ - VLAN 是否创建    │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 3. 检查 Trunk 链路  │
         │ - Trunk 是否建立    │
         │ - 是否允许 VLAN    │
         │   通过             │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 4. 检查 MAC 地址   │
         │ - MAC 地址学习    │
         │ - MAC 地址表     │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 5. 检查三层路由    │
         │ - SVI 接口是否 UP  │
         │ - 路由表是否正确  │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 6. 检查 ACL/安全   │
         │ - ACL 是否阻断    │
         │ - 端口安全配置   │
         └─────────────────────┘
```

## 10. VLAN 最佳实践

### 10.1 规划建议

| 建议 | 说明 |
|------|------|
| **VLAN 划分原则** | 按部门/功能/安全等级划分，便于管理和控制 |
| **VLAN ID 规划** | 建议使用有规律的编号，如 10xx 系列、20xx 系列 |
| **预留 VLAN** | 预留一些 VLAN ID 用于管理、语音、访客等 |
| **Native VLAN** | 改为不使用的 VLAN，增强安全性 |
| **管理 VLAN** | 将管理接口放在独立的 VLAN，与业务 VLAN 分离 |

### 10.2 安全建议

1. **禁用未使用端口**
   ```bash
   [H3C] interface range GigabitEthernet 1/0/26 to GigabitEthernet 1/0/48
   [H3C-if-range] shutdown
   ```

2. **启用端口安全**
   ```bash
   [H3C] interface GigabitEthernet 1/0/1
   [H3C-GigabitEthernet1/0/1] port security enable
   [H3C-GigabitEthernet1/0/1] port security max-mac-num 5
   [H3C-GigabitEthernet1/0/1] port security violation restrict
   ```

3. **配置 BPDU 保护**
   ```bash
   [H3C] stp bpdu-protection
   [H3C] interface GigabitEthernet 1/0/1
   [H3C-GigabitEthernet1/0/1] stp edged-port enable
   ```

4. **配置环路保护**
   ```bash
   [H3C] interface GigabitEthernet 1/0/1
   [H3C-GigabitEthernet1/0/1] stp loop-protection
   ```

### 10.3 性能优化建议

1. **合理设置 Trunk 允许列表**
   - 只允许必要的 VLAN 通过，减少不必要的数据处理

2. **启用 Jumbo Frame**
   - 如果网络设备支持，启用 Jumbo Frame 减少 CPU 开销

3. **合理配置 STP**
   - 关闭不需要的端口的 STP
   - 使用 PortFast 加速接入层端口收敛

## 11. VLAN 扩展技术

### 11.1 VXLAN（Virtual Extensible LAN）

VXLAN 是 VLAN 的扩展，用于解决 VLAN ID 数量限制（4096 个）的问题。

**特点**：
- 支持 1600 万个 VLAN ID
- 使用 UDP 封装，在三层网络中传输二层数据
- 主要用于数据中心虚拟化

### 11.2 NVGRE（Network Virtualization using GRE）

Microsoft 提出的网络虚拟化方案，使用 GRE 封装。

### 11.3 GENEVE（Generic Network Virtualization Encapsulation）

新一代网络虚拟化封装协议，支持更灵活的扩展。

---

## 12. 总结

本文档详细介绍了 VLAN 的基础知识、华三交换机配置以及 Linux 环境下的 VLAN 实现。主要内容包括：

1. **VLAN 基础概念**：VLAN 的定义、工作原理、编号标准
2. **VLAN 类型**：基于端口、MAC 地址、协议、IP 子网等
3. **Trunk 技术**：802.1Q 协议、VLAN 标签处理
4. **VLAN 间路由**：路由器子接口、三层交换机 SVI
5. **华三交换机配置**：VLAN 创建、端口分配、Trunk、VLAN 间路由、ACL、端口安全、QinQ
6. **Linux VLAN 配置**：ip 命令、vconfig、网桥、systemd-networkd
7. **高级特性**：Super VLAN、MSTP、Voice VLAN、Guest VLAN
8. **故障排查**：常见问题、排查命令、排查流程
9. **最佳实践**：规划建议、安全建议、性能优化

---

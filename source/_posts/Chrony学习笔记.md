---
title: Chrony/NTP学习笔记
date: 2018-01-31 22:42:55
tags: [server, Chrony, NTP]
categories: [系统运维]
---

**本篇包含以下内容**

- [NTP 协议介绍](#ntp-%e5%8d%8f%e8%ae%ae%e4%bb%8b%e7%bb%8d)
  - [Chrony 基础搭建](#chrony-%e5%9f%ba%e7%a1%80%e6%90%ad%e5%bb%ba)
  - [ntpd 基础搭建](#ntpd-%e5%9f%ba%e7%a1%80%e6%90%ad%e5%bb%ba)

<!-- more -->

# NTP 协议介绍

NTP 全称 Network Time Protocol 网络时间协议，用于同步计算机时间。保证局域网服务器与时间服务器的时间保持一致，并支持使用加密确认的方式防止恶意协议攻击。<br>

自 CentOS7.2 后，chronyd 服务代替原来的 ntpd 服务，性能提高且配置简单。

根据红帽文档，chronyd 与 ntpd 的区别在于：

- chronyd 使用更好的算法，同步精度、速度与对系统的影响都比 ntpd 更好。
- chronyd 可以在更大的范围内调整系统时间速率，且能在时钟损坏或不稳定的计算机上正常工作。
- 当网络故障时，chronyd 仍能很好地工作，而 ntpd 必须定时轮询时间参考才能正常工作。
- chronyd 可以快速适应时钟速率的突然变化，ntpd 则需要一段时间才能稳定。
- chronyd 提供对孤立网络的支持，手动输入校准时间，并通过算法计算实时时间，估计计算机增减时间的速率，从而调整时间。

## Chrony 基础搭建

环境

- CentOS7.4

步骤

1. 安装 chrony 服务（默认已安装）
   `yum install chrony`<br>
   安装完后会有两个程序，一个 chronyd 服务，一个 chronyc 监控配置程序。
2. 启动服务，设置开机自启<br>
   `systemctl start chronyd`<br>
   `systemctl enable chronyd`<br>
3. chrony 的配置文件/etc/chrony.conf

```
server ntp.sjtu.edu.cn iburst
server s1a.time.edu.cn iburst
server s1b.time.edu.cn iburst
server s1d.time.edu.cn iburst
//server 添加时间服务器，能添加很多

driftfile /var/lib/chrony/drift
//chronyd中的校准文件，根据实际时间计算出计算机增减时间的比率，能在重启后做出补偿

makestep 1.0 3
//当系统时钟漂移过快后，会通过很长的调整期纠正，该命令指定在调整期大于某阈值时才调整
//此处是当偏移大于1秒，系统时钟调整3次。

rtcsync
//启用内核模式，系统时间每11分钟拷贝到实时时钟

#allow 192.168.0.0/16
//允许指定网段或主机使用服务

#keyfile /etc/chrony.keys
//设置密钥文件，可做NTP加密

logdir /var/log/chrony
//设置日志文件

```

4. 防火墙放行并重启服务<br>
   `firewall-cmd --permanent --add-service=ntp`<br>
   `firewall-cmd --permanent --add-rich-rule='rule family=ipv4 port port=123 protocol=udp accept'`<br>
   `firewall-cmd --reload`<br>
   `systemctl restart chronyd`
5. 查看同步源信息

```
chronyc sourcestats
//查看同步源状态
210 Number of sources = 4
Name/IP Address            NP  NR  Span  Frequency  Freq Skew  Offset  Std Dev
==============================================================================
202.120.2.100.dns.sjtu.e>   0   0     0     +0.000   2000.000     +0ns  4000ms
10.112.202.in-addr.arpa.>   0   0     0     +0.000   2000.000     +0ns  4000ms
ntpa.nic.edu.cn             0   0     0     +0.000   2000.000     +0ns  4000ms
time.njnet.edu.cn           4   3    10   +810.140  43784.844  +7121us    14ms

chronyc sources //查看同步源，结果与上一条类似

```

6. 自动同步时间<br>
   `chronyc sources -v`

若要局域网内同步时间，只要客户端都安装 chrony，且配置文件的 server 设置为此服务器 ip 即可。

## ntpd 基础搭建

1. 安装 ntpd 服务
   `yum install ntp`
2. 修改配置文件`/etc/ntp.conf`
   在 restrict 段添加允许的主机网段
   `restrict 192.168.163.0 mask 255.255.255.0`
   允许指定网段或主机使用服务（类似 chrony 的 allow）
   server 字段与 chrony 类似，指定上游 ntp 服务器。
3. 重启 ntpd`systemctl restart ntpd.service`

在 ntpd 服务未开启时，可用命令`ntpdate 0.centos.pool.ntp.org`手动同步。这条命令只能在 ntpd 未开启时才有效。

命令`ntpq -p`列出 NTP 服务器与上游服务器的连接状态

```
# ntpq -p
     remote           refid      st t when poll reach   delay   offset  jitter
==============================================================================
*static-5-103-13 .GPS.            1 u   19   64    1  777.937  -99.910 133.624
+mx.comglobalit. 128.227.205.3    2 u   19   64    1  413.258   84.278  15.570
-ntp6.flashdance 192.36.143.130   2 u   18   64    1  438.957  196.165  32.565
+119.79-161-57.c 129.242.4.241    2 u   50   64    1  670.566   58.678  51.049

remote：上层ntp的IP地址或主机名，'+'表示优先，'*'表示次优先
refid：参考的上一层NTP主机的地址
st：stratum阶层
poll：下次更新在几秒后
offset：时间补偿的结果
```

**扩展内容**

```
系统时间与BIOS时间不一定相同。
查看硬件BIOS时间：
# hwclock -r
Wed 02 May 2018 05:00:32 PM CST  -0.854732 seconds
将当前系统时间写入BIOS中
# hwclock -w
```

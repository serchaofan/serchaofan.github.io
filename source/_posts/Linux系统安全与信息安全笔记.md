---
title: 信息安全概述与Linux系统安全
date: 2019-01-21 23:57:43
tags: [安全, 运维]
categories: [系统运维]
comments: false
---

- [Linux 后门入侵检测](#linux-后门入侵检测)
  - [rootkit 检测](#rootkit-检测)
- [服务器受到攻击后的处理](#服务器受到攻击后的处理)

<!--more-->

# Linux 后门入侵检测

## rootkit 检测

rootkit 是一种木马后门工具，主要通过替换系统文件达到入侵和隐蔽目的，攻击能力强，攻击者能隐蔽行迹并获取 root 权限。

rootkit 分为两种：

- 文件级别：通过程序或系统漏洞进入系统后，修改系统文件隐蔽自己。通常会将程序替换为木马，例如 login、ls、ps、ifconfig 等。
- 内核级别：比文件级别更加高级，攻击者能获得系统底层的完全控制权，即可以修改内核。内核级 rootkit 主要依附在内核上，并不对系统文件做任何修改，一般检测工具无法检测。

可使用 rkhunter 工具检测 rootkit 威胁。[官网下载](http://rootkit.nl/projects/rootkit_hunter.html)。进入解压目录后

```
./installer.sh --install
```

rkhunter 命令参数

```
-c      # 检测本地系统
```

# 服务器受到攻击后的处理

1. 切断网络
2. 查找攻击源：分析系统日志和用户登录日志、开放端口、进程服务
3. 分析入侵原因和途径：可能是系统漏洞、程序漏洞
4. 检查锁定可疑用户：通过 w，或日志`/var/log/secure`查看异常登录
5. 检查并关闭系统可疑进程：pidof 命令、`/proc/[pid]/fd|exe`目录
6. 检查文件系统完好性：`rpm -Va`命令
7. 备份用户数据
8. 重新安装系统
9. 修复程序或系统漏洞
10. 恢复数据和连接网络

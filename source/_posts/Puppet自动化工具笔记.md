---
title: Puppet自动化工具笔记
date: 2018-10-01 10:48:31
tags: [Puppet, 运维, 自动化]
---

- [Puppet 概述](#puppet-%e6%a6%82%e8%bf%b0)
  - [Puppet 工作流程](#puppet-%e5%b7%a5%e4%bd%9c%e6%b5%81%e7%a8%8b)
  - [Puppet 安装部署](#puppet-%e5%ae%89%e8%a3%85%e9%83%a8%e7%bd%b2)

<!--more-->

# Puppet 概述

Puppet 是一个基于 Ruby 开发的主机配置管理工具，采用 C/S 结构，服务器端称为 Puppet Master 或 Puppet Server，客户端称为 Puppet Agent。

Puppet 有自己的语言，可管理配置文件、用户、cron 任务、软件包、服务等，这些紫铜实体称为资源。

## Puppet 工作流程

{% asset_img 1.png %}

1. 客户端向 Master 发送认证请求
2. Master 通过认证返回确认信息
3. 客户端调用 facter 探测主机的变量，如主机名、内存大小、IP 地址，然后通过 SSL 发送给 Master
4. Master 检测主机名，找到对应 node 配置，解析内容，只解析 facter 发来信息与 node 有关的代码。解析分为：语法检查、生成伪代码 catalog，然后发送给客户端
5. 客户端接收伪代码并执行
6. 客户端在执行时判断是否有 file 文件，若有就向文件服务器发送请求
7. 客户端判断是否有配置 report，若有配置，则将结果发送给 Master。Master 将结果写入日志。

Puppet 采用的**拉取模式**：Agent 定期（默认 30 分钟）向 Master 发送自身状态。

Puppet 服务器和客户端之间通信采用的协议是**XMLRPC over HTTPS**。

## Puppet 安装部署

首先确保时间同步。然后搭建 ruby 环境，或者直接安装 puppet，也会自动解决依赖。

`yum install ruby`。ruby 版本 2.4。puppet 到http://yum.puppetlabs.com/ 下载安装官方源。`rpm -ivh http://yum.puppetlabs.com/puppetlabs-release-el-7.noarch.rpm`以及`http://yum.puppetlabs.com/puppet6/puppet-release-el-7.noarch.rpm`。

然后用过 yum 安装 puppet-agent 和 puppet-server，版本为 6.0.2。

安装完后，会自动创建用户与用户组 puppet。设置`/etc/hosts`文件，添加客户端。

puppet 的配置目录`/etc/puppet`

```
puppet/
├── auth.conf            # 认证配置
├── fileserver.conf      # 文件服务器配置
├── hiera.yaml           #
├── manifests            # 存放init.pp和其他配置的目录
├── modules              # 存放模块的目录
├── puppet.conf          # 主配置文件
└── ssl                  # 存放SSL认证相关的文件，如密钥、证书等
```

启动 puppetmaster 服务`systemctl start puppetmaster`，也可通过命令`puppet master --verbose --no-daemonize`启动，会显示详细的启动过程。

puppetmaster 会开启一个端口 8140

在客户端只要安装`ruby`和 `puppet`。

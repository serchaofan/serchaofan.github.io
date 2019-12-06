---
title: Puppet自动化工具笔记
date: 2018-10-01 10:48:31
tags: [Puppet,运维,自动化]
---

* [Puppet概述](#Puppet概述)
* []()



<!--more-->



# Puppet概述

Puppet是一个基于Ruby开发的主机配置管理工具，采用C/S结构，服务器端称为Puppet Master或Puppet Server，客户端称为Puppet Agent。

Puppet有自己的语言，可管理配置文件、用户、cron任务、软件包、服务等，这些紫铜实体称为资源。



## Puppet工作流程

{% asset_img 1.png %}

1. 客户端向Master发送认证请求
2. Master通过认证返回确认信息
3. 客户端调用facter探测主机的变量，如主机名、内存大小、IP地址，然后通过SSL发送给Master
4. Master检测主机名，找到对应node配置，解析内容，只解析facter发来信息与node有关的代码。解析分为：语法检查、生成伪代码catalog，然后发送给客户端
5. 客户端接收伪代码并执行
6. 客户端在执行时判断是否有file文件，若有就向文件服务器发送请求
7. 客户端判断是否有配置report，若有配置，则将结果发送给Master。Master将结果写入日志。

Puppet采用的**拉取模式**：Agent定期（默认30分钟）向Master发送自身状态。

Puppet服务器和客户端之间通信采用的协议是**XMLRPC over HTTPS**。



## Puppet安装部署

首先确保时间同步。然后搭建ruby环境，或者直接安装puppet，也会自动解决依赖。

`yum install ruby`。ruby版本2.4。puppet到http://yum.puppetlabs.com/ 下载安装官方源。`rpm -ivh http://yum.puppetlabs.com/puppetlabs-release-el-7.noarch.rpm`以及`http://yum.puppetlabs.com/puppet6/puppet-release-el-7.noarch.rpm`。

然后用过yum安装puppet-agent和puppet-server，版本为6.0.2。

安装完后，会自动创建用户与用户组puppet。设置`/etc/hosts`文件，添加客户端。



puppet的配置目录`/etc/puppet`

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

启动puppetmaster服务`systemctl start puppetmaster`，也可通过命令`puppet master --verbose --no-daemonize`启动，会显示详细的启动过程。

puppetmaster会开启一个端口8140





在客户端只要安装`ruby `和 `puppet`。
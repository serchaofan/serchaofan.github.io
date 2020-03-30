---
title: Gitlab服务搭建笔记
tags: []
categories: []
date: 2020-02-14 16:14:41
---

GitLab 是利用 Ruby On Rails 一个开源的版本管理系统，实现一个自托管的 Git 项目仓库，可通过 Web 界面进行访问公开的或者私人项目。它拥有与 GitHub 类似的功能，能够浏览源代码，管理缺陷和注释。

<!--more-->

gitlab 组成：

- nginx
- gitlab-shell：用于处理 Git 命令和修改 authorized keys 列表
- gitlab-workhorse：智能反向代理服务器，可帮助缓解 Unicorn 的压力
- logrotate：日志记录
- postgresql：存储应用程序元数据和用户信息
- redis：存储会话数据、临时缓存信息、后台作业队列
- sidekiq：Sidekiq 是 Ruby 后台作业处理器，可从 Redis 队列中提取作业并进行处理。 后台作业允许 GitLab 通过将工作移至后台来提供更快的请求/响应周期。
- unicorn：一个用于运行核心 Rails 应用程序的 Ruby 应用程序服务器，该应用程序提供了 GitLab 中面向用户的功能

{% asset_img 1.png %}

gitlab 文件目录：

- 主配置文件: `/etc/gitlab/gitlab.rb`
- 文档根目录: `/opt/gitlab`
- 默认存储库位置: `/var/opt/gitlab/git-data/repositories`
- Nginx 配置文件: `/var/opt/gitlab/nginx/conf/gitlab-http.conf`
- Postgresql 数据目录: `/var/opt/gitlab/postgresql/data`

# GitLab 部署

搭建环境 Centos7

在安装 Gitlab 前需要先安装的软件

- openssh-server：用于各个主机与 gitlab 进行 ssh 连接
- postfix：邮件通知需要

```
yum install -y openssh-server postfix
systemctl enable postfix sshd
systemctl start postfix sshd
```

若开启了防火墙，需要放行服务 http 和 https

由于 Gitlab 的官方脚本可能用不了，可以使用清华的源进行安装。先配置`/etc/yum.repos.d/gitlab.repo`

```ini
[gitlab-ce]
name=Gitlab CE Repository
baseurl=https://mirrors.tuna.tsinghua.edu.cn/gitlab-ce/yum/el$releasever/
gpgcheck=0
enabled=1


# 最好将$releasever直接改为版本号，即 7
baseurl=https://mirrors.tuna.tsinghua.edu.cn/gitlab-ce/yum/el7/
```

然后安装 gitlab

```
yum install -y gitlab-ce
```

修改配置文件`/etc/gitlab/gitlab.rb`

```
# 修改external_url，改为本机域名
external_url 'http://gitlab.example.com'

# 设置邮箱
gitlab_rails['gitlab_email_enabled'] = true
gitlab_rails['gitlab_email_from'] = 'xxx@163.com'
user['git_user_email'] = "xxx@163.com"

# 设置smtp邮件服务器
gitlab_rails['smtp_enable'] = true
gitlab_rails['smtp_address'] = "smtp.163.com"
gitlab_rails['smtp_port'] = 25
gitlab_rails['smtp_user_name'] = "xxx@163.com"
gitlab_rails['smtp_password'] = "xxxxxxxxx"
gitlab_rails['smtp_domain'] = "163.com"
gitlab_rails['smtp_authentication'] = "login"
gitlab_rails['smtp_enable_starttls_auto'] = true
gitlab_rails['smtp_tls'] = false
```

执行`gitlab-ctl reconfigure`，gitlab 开始自动安装配置。
浏览器直接访问服务器 ip 或域名即可进入 gitlab，首次登录会要求设置用户 root 的密码（要复杂的），然后登录即可，使用与 github 类似。

# 常用命令

# Gitlab 实现 CI 持续集成

Gitlab 自带持续集成方案即 Gitlab CI，因此无需额外配置或搭建额外的 CI 系统。
Gitlab CI 的触发为 Git 提交检索`.gitlab-ci.yaml`文件触发。

> 参考文章：
>
> [从零开始搭建 Gitlab 服务器](https://www.jianshu.com/p/43860be68b52)
>
> [搭建 GitLab 服务器 ( CTO 必会)](https://learnku.com/articles/2568/build-gitlab-server-cto-will)
>
> [GitLab 的安装及使用教程](https://yq.aliyun.com/articles/74395)
>
> [GitLab Architecture Overview](https://docs.gitlab.com/ce/development/architecture.html)

> [敏捷无敌之 Gitlab CI 持续集成](https://blog.51cto.com/cloumn/detail/94)

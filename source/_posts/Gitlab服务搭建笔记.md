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
Gitlab CI 的触发为 Git 提交检索`.gitlab-ci.yaml`文件触发，而执行过程是在客户端的**Gitlab-Runner**上执行的。

Gitlab-Runner就是一台安装了Gitlab-Runner软件的主机，只要该服务器在Gitlab Server端注册，则该Gitlab Runner就能在Server端的`.gitlab-ci.yaml`中使用该Runner执行pipeline的stage。Runner可分布在不同服务器上，一台服务器上也可以有多个Runner。

Gitlab Runner有以下分类：
- Shared Runner：共享型，所有项目都能使用该Runner执行job
- Specfic Runner：特定型，该Runner只为特定项目服务
- Group Runner：若将该Runner注册到项目组中，则该项目组中的项目可使用该Runner

Gitlab Runner状态：
- Locked：被某个项目锁定，只服务该项目，不能用于其他项目
- Paused：被暂停，不能接受任何job

流程：
1. 开发提交代码并发出Merge Request，触发pipeline
2. Server分配Runner执行pipeline
3. 通过公共Runner部署代码到生产服务器

{% asset_img 2.png %}

注册时需要为Runner指定Executor执行器，用于在不同场景下进行构建任务，不同Executor支持不同平台及执行不同方法。以下为常见Executor：
- Shell：直接将Runner注册到Server端口，后期所有运行的job所需依赖都需要手动安装在这台注册的系统上。
- Docker：Docker镜像作为执行器，容易进行依赖管理
- Docker Machine：使用Docker Machine构建机，支持自动缩放
- Virtualbox：虚拟机执行job
- SSH：类似跳板，连接到外部服务器，并在那进行构建
- Kubernetes：放在k8s集群中构建，集群为每个gitlab作业创建一个pod来构建任务，构建完成后再释放掉。

`.gitlab-ci.yaml`中的重要概念：
- pipeline：一套构建任务的集合，包含很多流程，如依赖安装、编译、测试、部署等
- stages：步骤，pipeline中包含多个stage，所有stage都从上到下顺序执行，若其中一个stage执行失败，则不再继续执行。只有所有stage都执行成功，pipeline状态才为成功。
- jobs：每个stage由多个job组成，同一个stage中的job是并行执行的，任一个job失败导致stage失败导致pipeline失败。只有所有job都执行成功，stage才为成功。

{% asset_img 3.png %}

Gitlab CI/CD流程：
1. 校验：完成CI，包含代码扫描、性能测试、单元测试、容器扫描、依赖扫描等，stage失败就打回给开发者修复，直到分支的pipeline都构建测试正常。
2. 打包：gitlab提供多种打包方式：Docker镜像（Container Registry）、Npm包（NPM Registry）、Maven工件（Maven Repository）、Conan包（Conan Repository）
3. 发布：完成CD持续部署，将通过测试和构建的分支merge到主分支，手动确认应用部署进入正式环境，进行应用发布。

`.gitlab-ci.yaml`中的常用关键字：
- stages
- jobs
- variables：变量，在jobs中起作用
- environment：用于定义job部署到特殊环境中，若没有该环境则自动创建
- scirpts：runner执行的命令和脚本，必填
- tags：指定注册在该项目下的runner（runner也要设置tag）
- except：在一个job下，指定一个git分支不进行此构建，若only和except在一个job中同时存在，以only为准
- only：一个job中指定一个git分支可执行此构建
- when：何时开始job。可设为on_success、on_failure、always、manual
- before_script：在job执行前的命令
- after_script：定义作业部署完成后的环境名称
- cache：定义一组文件列表，可在后续stage使用
- image：指定stage使用的docker镜像

gitlab-ci.yaml文件样例：
```yaml
stages:
  - build
  - test
  - deploy

variables:
  BASE_DIR: "/usr/proj/"

cache:
  paths:
  - node_modules/
  - dist/

before_script:
  - cp ${BASE_DIR}.env.example ${BASE_DIR}.env
  - yarn install
  - yarn build

build_job:      # 创建job，名为build_job
  stage: build
  script: 
    - yarn build
  tags:
    - dev
  only:
    - develop
  when: always

test_job:
  stage: test
  script:
    - yarn test
  tags:
    -dev
  only:
    - develop
  when: manual

deploy_job:
  stage: deploy
  only:
    - master
  script:
    - pm2 delete api || true
    - pm2 start dist/index.js --name api
  tags:
    - dev
  when: always
```

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

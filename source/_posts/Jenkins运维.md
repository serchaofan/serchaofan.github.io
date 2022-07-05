---
title: Jenkins运维
date: 2019-01-21 23:28:13
tags: [Jenkins, SRE, DevOps]
categories: [SRE]
comments: false
---

- [jenkins 介绍](#jenkins-介绍)
- [jenkins 搭建](#jenkins-搭建)
  - [war 部署](#war-部署)
  - [apt 安装](#apt-安装)
  - [Docker 部署](#docker-部署)
- [配置系统](#配置系统)
  - [系统设置](#系统设置)
    - [配置 JDK、Maven、Ant](#配置-jdkmavenant)
    - [配置发件人地址](#配置发件人地址)
    - [配置邮件通知](#配置邮件通知)
  - [安全设置](#安全设置)
  - [用户设置](#用户设置)
  - [插件设置](#插件设置)
- [项目构建设置](#项目构建设置)
- [Pipeline](#pipeline)

<!-- more -->

# jenkins 介绍

jenkins 是一个基于 java 开发的在自动化服务器，是一款开源 CI&CD 软件，用于自动化各种任务，包括构建、测试和部署软件。

CI 系统内容可参考[DevOps 概念整理](/2020/DevOps概念整理)

特性：

- 易于安装
- 易于配置
- 集成 RSS/Email，通过 RSS 发布构建结果或通过 email 通知
- 生成 Junit/TestNG 测试报告
- 支持分布式构建，让多台计算机一起构建
- 文件识别，能跟踪哪次构建了哪些 jar 及哪个版本的 jar
- 插件支持，大量官方插件以及可自定义插件

# jenkins 搭建

## war 部署

下载最新的 jenkins war 包 [下载地址](http://mirrors.jenkins.io/war-stable/latest/jenkins.war)

两种启动方法：

- 直接`java -jar jenkins.war`，然后通过 8080 端口访问
- 将 war 包放到 tomcat 的 webapps 目录下，然后启动 tomcat，通过`本机域名/jenkins`访问

## apt 安装

对于 Debian/Ubuntu 系统，通过 apt 安装

```
wget -q -O - https://pkg.jenkins.io/debian/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb http://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'
sudo apt-get update
sudo apt-get install jenkins
```

安装软件包会自动完成以下内容：

- 将 Jenkins 设置为启动时启动的守护进程。查看`/etc/init.d/jenkins`获取更多细节
- 创建一个'jenkins'用户来运行此服务
- 直接将控制台日志输出到文件`/var/log/jenkins/jenkins.log`。如果您正在解决 Jenkins 问题，请检查此文件
- `/etc/default/jenkins`为启动填充配置参数，例如 JENKINS_HOME
- 将 Jenkins 设置为在端口 8080 上进行监听。

## Docker 部署

```
docker run \
  -u root \
  --rm \
  -d \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins-data:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkinsci/blueocean
```

官方推荐使用 jenkinsci/blueocean 镜像，该镜像包含当前的长期支持 (LTS) 的 Jenkins 版本 （可以投入使用） ，捆绑了所有 Blue Ocean 插件和功能，不需要单独安装 Blue Ocean 插件。
也可以使用 jenkins tls 版本 jenkins/jenkins:tls

因为需要获取登录密码，所以必须先在本机创建`/var/jenkins_home`作 jenkins 的 volume，即 jenkins 的默认存放密码的目录。
因为需要配置 jdk、maven 等目录，所以也需要作 volume 映射。
因此，需要添加几项参数：

```
docker run -u root -d \
   -p 8080:8080 -p 50000:50000 \
   -v /var/run/docker.sock:/var/run/docker.sock \
   -v /usr/lib/jvm/java-8-openjdk-amd64:/usr/lib/jvm/java-8-openjdk-amd64 \
   -v /var/jenkins_home:/var/jenkins_home \
   --name jenkins \
   jenkinsci/blueocean
```

需要修改`/var/jenkins_home`的权限，使当前用户能有管理权限（所属人），这样才能查看 secrets 下的 initialAdminPassword 文件。`secrets`目录的默认权限为：`700`

# 配置系统

## 系统设置

### 配置 JDK、Maven、Ant

进入全局工具配置（Global Tool Configuration），进行工具配置
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120033303.png)

JDK 配置最好不要选自动配置，JAVA_HOME 要与 volume 设置的路径一致。

同理，Maven 和 Ant，要先有 volume 映射，再配置。

### 配置发件人地址

进入配置系统（Configure System），找到 Jenkins Location 配置

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120033059.png)

Jenkins URL 改为`域名/jenkins`，Email 改成 jenkins 要发送报告到的邮箱

### 配置邮件通知

进入配置系统（Configure System），找到 E-mail Notification 配置

## 安全设置

## 用户设置

## 插件设置

# 项目构建设置

# Pipeline

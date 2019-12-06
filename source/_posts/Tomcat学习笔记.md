---
title: Tomcat学习笔记
date: 2018-08-01 21:04:02
tags: [Tomcat, server, web, java]
---

{% asset_img tomcat.png %}

基于tomcat9.0.13，jdk1.8

* [Tomcat概述](#Tomcat概述)
* [Tomcat环境搭建](#Tomcat环境搭建)



<!--more-->



# Tomcat概述

Tomcat是Apache基金会下的一个核心项目，是一个轻量级的web应用服务器，主要用于作为JSP应用与Servlet的后端服务器。最早项目名叫catalina，后改名为tomcat。

Tomcat注重于servlet引擎，对静态页面的加载不如apache，因此常常tomcat与apache组网，apache用于静态页面生成，动态请求会转发给tomcat处理。





# Tomcat环境搭建

搭建Tomcat，首先要配置JAVA环境，下载jdk，解压`/usr/local/jdk8`。然后在`/etc/profile`配置环境变量

```
export JAVA_HOME=/usr/local/jdk8
export CLASSPATH=$JAVA_HOME/lib
export PATH=$JAVA_HOME/bin:$PATH
```

使用`java -version`和`javac -version`检查是否安装及配置成功



## Tomcat目录结构

```
# tree -d -L 1
.
├── bin         # 存放启动和关闭Tomcat的脚本文件
├── conf        # 存放配置文件
├── lib         # 存放服务器支撑jar包
├── logs        # 存放日志文件
├── temp        # 存放临时文件
├── webapps     # web应用目录
└── work        # Tomcat工作目录
```

**`bin`目录**

```
├── catalina.sh        # Tomcat的核心脚本文件，用于启动、停止tomcat等操作
├── ciphers.sh
├── configtest.sh
├── daemon.sh
├── digest.sh
├── makebase.sh
├── setclasspath.sh
├── shutdown.sh        # Tomcat停止脚本
├── startup.sh         # Tomcat启动脚本，相当于catalina.sh run，而且是后台运行
├── tool-wrapper.sh
└── version.sh         # 显示Tomcat版本信息
```

**`conf`目录**

```

```









## 配置WEB应用

使用`catalina.sh run`或`start.sh`启动Tomcat。tomcat默认会监听三个端口`8005`、`8009`、`8080`。

有五种方法配置web应用

* 在`conf`目录中`context.xml`中配置，配置会被所有web应用加载
* 在`conf`目录中引擎目录(`catalina`)的主机目录(`localhost`)下新建`server.xml.default`配置，会被主机的所有web应用加载
* 在`conf`目录中`catalina`的`localhost`目录中创建任意一个`.xml`文件，在文件中添加上下文，而文件名会被用作web应用的名称（虚拟站点名）。一个web应用可以映射多个虚拟目录。
* 在主机目录下`META-INF/`中`context.xml`
* 在`conf`目录下`server.xml`中在`<Host>`中添加上下文（就是web应用路径）
---
title: Tomcat学习笔记
date: 2018-08-01 21:04:02
tags: [Tomcat, server, web, java]
---

tomcat9.0.13，jdk1.8

<!--more-->

# Tomcat 概述

Tomcat 是 Apache 基金会下的一个核心项目，是一个轻量级的 web 应用服务器，主要用于作为 JSP 应用与 Servlet 的后端服务器。最早项目名叫 catalina，后改名为 tomcat。

Tomcat 注重于 servlet 引擎，对静态页面的加载不如 apache，因此常常 tomcat 与 apache 组网，apache 用于静态页面生成，动态请求会转发给 tomcat 处理。

## Tomcat 结构

{% asset_img 1.png %}

Server 为 Tomcat 的一个实例，一个 JVM 只能包含一个 Tomcat 实例。Server 的端口号为 8005，监听的是 shutdown 命令，若接收到 shutdown 信息，则关闭 tomcat。可在`server.xml`中看到

```
<Server port="8005" shutdown="SHUTDOWN">
```

Service 包含两个部分：

- Connector：处理连接相关事务，提供 socket 与（request 和 response）的转化
- Container：封装和管理 servlet，具体处理 request 请求

一个 Service 只有一个 Container，可有多个 Connector。

有两个默认的 service：

- 一个端口为 8080，负责建立 http 连接
- 一个端口为 8009，负责与其他 http 服务器建立连接

### Tomcat 与 HTTP 的通信方式

有两种方式：

1. Tomcat 提供专门的插件 JK，负责 Tomcat 与 HTTP 服务通信，把 JK 插件安装在对方 HTTP 服务器上，当 http 服务器收到请求会先通过 JK 过滤 URL，决定是否把请求发送到 Tomcat。
2. AJP 协议（Apache JServ Protocol）。Tomcat 为实现与 HTTP 通信而定制的协议，有很高效率。过程如下：
   1. 请求到达 Tomcat，经过 Service 交给 Connector，将请求封装为 Request 和 Response 处理
   2. 封装后交给 Container 处理
   3. 再返回给 Container，Connector 通过 Socket 将结果返回给客户端

### Connector

{% asset_img 2.png %}

Connector 使用 ProtocolHandler 处理请求，不同 ProtocolHandler 代表不同连接类型

ProtocolHandler 包含三个部件：

1. Endpoint：处理底层 socket 连接，用来实现 TCP/IP。Endpoint 的抽象实现 AbstractEndpoint 定义了两个内部类 Acceptor 和 AsyncTimeout，以及一个接口 Handler
   - Acceptor 用于监听请求
   - AsyncTimeout 用于检查异步 Request 超时
   - Handler 用于处理接收到的 socket，交给 Processor
2. Processor：将 Endpoint 收到的 socket 封装成 Request，用来实现 HTTP
3. Adapter：将 Request 交给 Container（Servlet 容器）进行具体处理

{% asset_img 3.png %}

### Container

Container 用于封装 Servlet 以及具体处理 Request 请求

{% asset_img 4.png %}

Container 包含四个子容器：

1. Engine：用于管理多个站点，一个 Service 最多一个 Engine
2. Host：站点，每个 Host 代表一个虚拟主机，可通过配置 Host 添加站点
3. Context：应用，对应程序或一个 （WEB-INF 目录以及下面的 web.xml 文件）
4. Wrapper：Servlet

```
webapps
|-- ROOT
|-- docs
|-- examples
|-- host-manager
`-- manager

```

webapps 目录下每个文件夹都是一个 context，ROOT 存放主应用，其他目录存放子应用，整个 webaapps 就是一个 Host 站点。
ROOT 下可直接通过域名访问，其他子应用通过域名+路径访问

Container 使用的 pipeline-valve 处理请求。Pipeline-Valve 是责任链模式

> 责任链模式：在一个请求处理过程中有很多处理者（handler）依次对请求处理，每个处理者负责自己相应的处理，处理完后将处理后的请求返回，依次让下一个处理者处理。

Pipeline-valve 与普通责任链不同的地方：

- 每个 pipeline 都有特定 valve，而且在管道的最后一个执行，称为 Basevalve，该 valve 不可删除
- 上层容器的管道 Basevalve 会调用下层容器的管道

四个子容器的 Basevalve 分别在：

- StandardEngineValve
- StandardHostValve
- StandardContextValve
- StandardWrapperValve

{% asset_img 5.png %}

Connector 接收的请求会传给最上层的 EnginePipeline，依次执行最终到 StandardWrapperValve。
此时 StandardWrapperValve 会创建 Filterchain，调用其 doFilter 方法处理请求，Filterchain 包含配置的与请求匹配的 Filter 和 Servlet，doFilter 会依次调用所有的 Filter 的 doFilter 和 Servlet 的 service 方法，请求即被处理。
所有的 PipelineValve 执行完成后，将结果返回给 Connector，Connector 再通过 socket 将结果返回给客户端。

### Tomcat 连接器

Tomcat 连接器分为两类：

1. HTTP 连接器
2. Web 服务器连接器

HTTP 连接器有三种：

- 基于 java 的 HTTP/1.1 连接器：Tomcat 默认使用的连接器，即 Coyote；它是 Tomcat 作为 standalone 模式工作时所用到的连接器，可直接响应来自用户浏览器的关于 JSP、servlet 和 HTML 的请求；此连接器是一个 Java 类，定义在 server.xml 当中，默认使用 8080 端口
- 高性能 NIO HTTP/1.1 连接器（java 开发）：支持非阻塞式 IO 和 Comnet，在基于库向 tomcat 发起请求时，此连接器表现不俗
- native APR HTTP/1.1 连接器（C++开发）：在负载较大的场景中，此连接器可以提供非常好的性能

# Tomcat 环境搭建

搭建 Tomcat，首先要配置 JAVA 环境，下载 jdk，解压`/usr/local/jdk8`。
或者直接安装 openjdk，选择版本 1.8

```
debian/ubuntu：
apt-get install openjdk-8-jre openjdk-8-jdk

设置JAVA_HOME为/usr/lib/jvm/java-8-openjdk-amd64/

centos/redhat/fedora：
yum install java-1.8.0-openjdk java-1.8.0-openjdk-devel

设置JAVA_HOME为/usr/lib/jvm/java-1.8.0-openjdk/
```

然后在`/etc/profile`配置环境变量

```
export JAVA_HOME=/usr/local/jdk8
export CLASSPATH=$JAVA_HOME/lib
export PATH=$JAVA_HOME/bin:$PATH
```

使用`java -version`和`javac -version`检查是否安装及配置成功

## Tomcat 目录结构

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
conf/
|-- catalina.policy
|-- catalina.properties
|-- context.xml
|-- jaspic-providers.xml
|-- jaspic-providers.xsd
|-- logging.properties
|-- server.xml
|-- tomcat-users.xml
|-- tomcat-users.xsd
`-- web.xml
```

- server.xml：Tomcat 的主配置文件，包含 Service, Connector, Engine, Realm, Valve, Hosts 主组件的相关配置信息；
- web.xml：遵循 Servlet 规范标准的配置文件，用于配置 servlet，并为所有的 Web 应用程序提供包括 MIME 映射等默认配置信息；
- context.xml：所有 host 的默认配置信息；
- tomcat-users.xml：Realm 认证时用到的相关角色、用户和密码等信息；Tomcat 自带的 manager 默认情况下会用到此文件；在 Tomcat 中添加/删除用户，为用户指定角色等将通过编辑此文件实现；
- catalina.policy：Java 相关的安全策略配置文件，在系统资源级别上提供访问控制的能力；
- catalina.properties：Tomcat 内部 package 的定义及访问相关的控制，也包括对通过类装载器装载的内容的控制；Tomcat6 在启动时会事先读取此文件的相关设置；

Tomcat 以面向对象的方式运行，它可以在运行时动态加载配置文件中定义的对象结构，这有点类似于 apache 的 httpd 模块的调用方式。server.xml 中定义的每个主元素都会被创建为对象，并以某特定的层次结构将这些对象组织在一起。

### server.xml

配置层次：

```
<server>
  <service>
    <connector />
    <engine>
      <host>
        <context>
        </context>
      </host>
      <host>
      .....
      </host>
    </engine>
  </service>
</server>
```

组件类别：

- 顶级组件：位于配置顶层
  - server
- 容器类组件：可包含其他组件
  - service：
  - engine：
  - host：
  - context：
  - webapp：
- 连接器组件：连接用户请求到 tomcat
  - connector
- 嵌套类组件：位于容器中，不包含其他组件
  - valve：
  - access log valve：
  - remote address filter valve：
  - logger：

* Server
  示例：
  ```
    <Server port="8005" shutdown="SHUTDOWN">
        <Listener className="org.apache.catalina.startup.VersionLoggerListener" />
        ......
    </Server>
  ```
  相关属性：
  `className`: 用于实现此 Server 容器的完全限定类的名称；
  `port`: 接收 shutdown 指令的端口，默认仅允许通过本机访问，默认为 8005；
  `shutdown`: 发往此 Server 用于实现关闭 tomcat 实例的命令字符串，默认为 SHUTDOWN；
* Service
  示例：
  ```
    <Service name="Catalina">
  ```

### webapp 结构

webapp 有特定的组织格式，是一种层次型目录结构；通常包含了 servlet 代码文件、jsp 页面文件、类文件、部署描述符文件等等，一般会打包成归档格式

示例：

```
examples/
|-- WEB-INF
|   |-- classes
|   |-- jsp
|   |-- jsp2
|   |-- lib
|   |-- tags
|   `-- web.xml
|-- index.html
|-- jsp
|   |--......
|   |-- images
|   |-- include
|   |-- index.html
......
```

- `/`：web 应用的根目录，ROOT 为根目录内容
- `/WEB-INF`：包含当前 webapp 的 deploy 描述符，如所有的 servlets 和 JSP 等动态文件的详细信息，会话超时时间和数据源等；通常用于定义当前 webapp 特有的资源，通常 web.xml 和 context.xml 均放置于此目录
- `/WEB-INF/classes`：包含所有服务器端类及当前应用程序相关的其它第三方类等
- `/WEB-INF/lib`：包含 JSP 所用到的 JAR 文件，此 webapp 自有能够被打包为 jar 格式的类

## 配置 WEB 应用

有五种方法配置 web 应用

- 在`conf`目录中`context.xml`中配置，配置会被所有 web 应用加载
- 在`conf`目录中引擎目录(`catalina`)的主机目录(`localhost`)下新建`server.xml.default`配置，会被主机的所有 web 应用加载
- 在`conf`目录中`catalina`的`localhost`目录中创建任意一个`.xml`文件，在文件中添加上下文，而文件名会被用作 web 应用的名称（虚拟站点名）。一个 web 应用可以映射多个虚拟目录。
- 在主机目录下`META-INF/`中`context.xml`
- 在`conf`目录下`server.xml`中在`<Host>`中添加上下文（就是 web 应用路径）

> 参考文章
> [四张图带你了解 Tomcat 系统架构](https://dbaplus.cn/news-134-1930-1.html) > [Tomcat 安装及配置详解](http://www.ttlsa.com/tomcat/tomcat-install-and-configure/)

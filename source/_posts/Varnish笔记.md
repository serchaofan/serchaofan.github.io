---
title: Varnish笔记
date: 2018-05-31 12:00:39
tags: [varnish, 缓存, 代理]
---

- [Varnish 概述](#varnish-%e6%a6%82%e8%bf%b0)
  - [Squid 与 Varnish 对比](#squid-%e4%b8%8e-varnish-%e5%af%b9%e6%af%94)
- [Varnish 基本配置](#varnish-%e5%9f%ba%e6%9c%ac%e9%85%8d%e7%bd%ae)

<!--more-->

{% asset_img varnish-bunny.png %}

# Varnish 概述

Varnish 是一款高性能、开源的反向代理服务器和缓存服务器。并且，Varnish 还能提供以下功能：

- web 应用防火墙
- DDoS 防护
- 网站防盗链
- 负载均衡
- 单点登录（SSO）网关
- 认证与授权
- 后端主机快速修复
- HTTP 路由

Varnish 缓存策略的实现是通过 VCL（Varnish Configuration Language）实现，VCL 的语法简单，继承了 C 语言的很多特性，使得 VCL 样式看起来很像 C 和 PELR 语言，运行 Varnish 时，此配置将转换为 C 代码，然后送入 C 编译器，加载并执行。

## Squid 与 Varnish 对比

| 软件    | 存储模式  | 共享存储         | 性能 |
| ------- | --------- | ---------------- | ---- |
| Squid   | 硬盘      | 可并联，但很复杂 | 较高 |
| Varnish | 硬盘/内存 | 不能             | 很高 |

Varnish 对比 Squid 的优点：

- Varnish 稳定性比 Squid 高，Squid 发生故障的几率要高于 Varnish
- Varnish 访问速度比 Squid 快，因为 Varnish 采用了**Visual Page Cache**，所有缓存之久从内存中读取，而 Squid 从硬盘读取，所以 Varnish 会更快。
- Varnish 支持更高的并发连接，因为 Varnish 的 TCP 连接释放要比 Squid 快。
- Varnish 可以通过管理端口，使用正则表达式批量清除缓存。
- Varnish 可通过 fork 进行多进程处理，而 Squid 仅是单进程。

Varnish 对比 Squid 的缺点：

- 一旦 Varnish 宕机或重启，缓存数据会在内存中丢失，所有请求就又给了后端服务器，造成后端的压力。
- Varnish 在高并发下，CPU、I/O 和内存资源开销会高于 Squid。

# Varnish 基本配置

最好直接从官网下载，不要通过 epel 库下载，因为 epel 库中的 varnish 版本过老。或者从 varnish 官方提供的 repo 中下载。[官方 repo 配置（貌似已不可用）](https://packagecloud.io/varnishcache/varnish60/install#manual-rpm)。或者下载源码编译安装。

编译安装可能需要的依赖`python-docutils`、`libedit-devel`

进入解压目录，直接`./configure --prefix=/usr/local/varnish6`编译之后`make && make install`即可。

Varnish 提供以下工具：

- **`varnishd`**：是 Varnish 的核心进程，以守护进程方式运行，接收 http 请求并转发到后端，进行缓存并响应客户端。存放在安装目录的`sbin`中

- **`varnishtest`**：Varnish 测试工具，可验证 Varnish 安装、可自定义 client 请求模型、可与 Varnish 交互

- **`varnishadm`**：Varnish 实例命令行管理工具

- **`varnishstat`**：可访问全局计算器，提供全面统计信息。

- **`varnishlog`**：显示 Varnish 日志，显示的是实时日志，最好设置好过滤规则，支持精确日志匹配

- **`varnishncsa`**、**`varnishtop`**、**`varnishhist`**是 Varnish 的性能及状态分析工具

  - `varnishhist`：读取 varnish 日志，生成连续的柱状图，若缓存命中则标记`|`，若没命中则标记`#`

    ```
    15_                           |
                                  |              |
                                  |              #
    +--------------+--------------+--------------+--------------+----
    |1e-6          |1e-5          |1e-4          |1e-3          |1e-2
    ```

  - `varnishtop`：读取日志，显示实时日志信息，类似`varnishlog`，支持过滤

  - `varnishncsa`：实时显示请求日志信息

安装目录中是没有配置文件的，需要将解压目录中`etc/example.vcl`复制到安装目录中，并改名为`default.vcl`。

修改配置文件

```
backend default {      # 默认的后端服务器配置，默认为本机
    .host = "172.16.246.135";    # 后端服务器IP
    .port = "80";    # 本地的代理端口。当要从后端取数据时，就会访问本地的该指定端口
}
```

然后开启 varnish。`varnishd -f /var/local/varnish6/default.vcl`，通过`-f`指定配置文件，而且配置文件的路径一定要是**绝对路径**，否则会提示没有该文件。确保该指定端口在本地没有被占用。

启动成功后，可以看到默认 varnish 启动了两个进程

```
# ps -ef | grep varnish
root      62560      1  0 02:23 ?        00:00:00 sbin/varnishd -f /usr/local/varnish6/default.vcl
root      62571  62560  0 02:23 ?        00:00:00 sbin/varnishd -f /usr/local/varnish6/default.vcl
```

通过浏览器访问 Varnish 服务器，使用开发者工具可看到响应头中的消息显示是 Varnish 返回的。

{% asset_img 1.png %}

可以通过`backend`块定义多个后端服务器。

```
backend host2 {
  .host="172.16.246.136";
  .port="81";
  .connect_timeout=3s;
}
```

> 参考文章
>
> [Varnish 从菜鸟到专家（一）](https://mp.weixin.qq.com/s?__biz=MzIyMDA1MzgyNw==&mid=2651970143&idx=1&sn=8117adafc988b11c2e43db95e1060571&chksm=8c349273bb431b65feb0c59cf9f940e103ba14806b811e80b68aa6d3ea150d8afdf7c48e18a7&mpshare=1&scene=23&srcid=0909L9lKHa2NEFTMf3W19eAv#rd)
>
> 高性能网站构建实战

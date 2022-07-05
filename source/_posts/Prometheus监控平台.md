---
title: Prometheus监控平台
tags: [Prometheus, 监控, 云计算]
categories: [监控]
date: 2019-12-13 11:41:10
comments: false
---

Prometheus 是最初在 SoundCloud 上构建的开源系统监视和报警工具包。Prometheus 于 2016 年加入了 CNCF，这是继 Kubernetes 之后的第二个托管项目。

<!--more-->

- [Prometheus 基本概念](#prometheus-基本概念)
  - [特点](#特点)
  - [组成](#组成)
  - [工作流程](#工作流程)
  - [数据模型](#数据模型)
  - [四种 Metric 类型](#四种-metric-类型)
  - [数据采集](#数据采集)
  - [instance 和 jobs](#instance-和-jobs)
  - [Prometheus Server](#prometheus-server)
  - [使用 PromQL 查询监控数据](#使用-promql-查询监控数据)
  - [常用函数](#常用函数)
- [Prometheus Server 配置文件详细说明](#prometheus-server-配置文件详细说明)
  - [抓取配置](#抓取配置)
  - [将 prometheus 数据自动写入 influxdb](#将-prometheus-数据自动写入-influxdb)
- [AlertManager 报警](#alertmanager-报警)
- [HTTP API](#http-api)
  - [表达式请求](#表达式请求)
  - [请求元数据](#请求元数据)
  - [targets](#targets)
  - [rules](#rules)
  - [alerts](#alerts)
  - [alertmanager](#alertmanager)
  - [status](#status)

# Prometheus 基本概念

## 特点

强大的多维度数据模型：

- 时间序列数据通过 metric 名和键值对来区分。
- 所有的 metrics 都可以设置任意的多维标签。
- 数据模型更随意，不需要刻意设置为以点分隔的字符串。
- 可以对数据模型进行聚合，切割和切片操作。
- 支持双精度浮点类型，标签可以设为全 unicode。
- 灵活而强大的查询语句（PromQL）：在同一个查询语句，可以对多个 metrics 进行乘法、加法、连接、取分数位等操作。
- 易于管理： Prometheus server 是一个单独的二进制文件，可直接在本地工作，不依赖于分布式存储。
- 高效：平均每个采样点仅占 3.5 bytes，且一个 Prometheus server 可以处理数百万的 metrics。
- 使用 pull 模式采集时间序列数据，这样不仅有利于本机测试而且可以避免有问题的服务器推送坏的 metrics。
- 可以采用 push gateway 的方式把时间序列数据推送至 Prometheus server 端。
- 可以通过服务发现或者静态配置去获取监控的 targets。
- 有多种可视化图形界面。
- 易于伸缩。

> 由于数据采集可能会有丢失，所以 Prometheus 不适用对采集数据要 100% 准确的情形

## 组成

- Prometheus Server: 用于收集和存储时间序列数据。Prometheus Server 本身就是一个时序数据库，将采集到的监控数据按照时间序列的方式存储在本地磁盘当中。
- Client Library: 客户端库，为需要监控的服务生成相应的 metrics 并暴露给 Prometheus server。当 Prometheus server 来 pull 时，直接返回实时状态的 metrics。
- Exporters: Exporter 将监控数据采集的端点通过 HTTP 服务的形式暴露给 Prometheus Server，Prometheus Server 通过访问该 Exporter 提供的 Endpoint 端点，即可获取到需要采集的监控数据
  一般来说可以将 Exporter 分为 2 类：
  - 直接采集：这一类 Exporter 直接内置了对 Prometheus 监控的支持，比如 cAdvisor，Kubernetes，Etcd，Gokit 等，都直接内置了用于向 Prometheus 暴露监控数据的端点。
  - 间接采集：间接采集，原有监控目标并不直接支持 Prometheus，因此我们需要通过 Prometheus 提供的 Client Library 编写该监控目标的监控采集程序。例如： Mysql Exporter，JMX Exporter，Consul Exporter 等。
- Alertmanager: 在 Prometheus Server 中支持基于 PromQL 创建告警规则，如果满足 PromQL 定义的规则，则会产生一条告警，而告警的后续处理流程则由 AlertManager 进行管理。在 AlertManager 中我们可以与邮件，Slack 等等内置的通知方式进行集成，也可以通过 Webhook 自定义告警处理方式。
  AlertManager 即 Prometheus 体系中的告警处理中心。从 Prometheus server 端接收到 alerts 后，会进行去除重复数据，分组，并路由到对收的接受方式，发出报警。常见的接收方式有：电子邮件，pagerduty，OpsGenie, webhook 等。
- Push Gateway: 主要用于短期的 jobs。由于这类 jobs 存在时间较短，可能在 Prometheus 来 pull 之前就消失了。为此，这次 jobs 可以直接向 Prometheus server 端推送它们的 metrics。这种方式主要用于服务层面的 metrics，对于机器层面的 metrices，需要使用 node exporter。


## 工作流程

Prometheus server 定期从配置好的 jobs 或者 exporters 中拉 metrics，或者接收来自 Pushgateway 发过来的 metrics，或者从其他的 Prometheus server 中拉 metrics。
Prometheus server 在本地存储收集到的 metrics，并运行已定义好的 alert.rules，记录新的时间序列或者向 Alertmanager 推送报警。
Alertmanager 根据配置文件，对接收到的报警进行处理，发出告警。
在图形界面中，可视化采集数据。

## 数据模型

Prometheus 中存储的数据为时间序列，是由 metric 的名字和一系列的标签（键值对）唯一标识的，不同的标签则代表不同的时间序列。

- metric name：该名字应该具有语义，一般用于表示 metric 的功能，例如：`http*requests_total`, 表示 http 请求的总数。其中，metric 名字由 ASCII 字符，数字，下划线，以及冒号组成，且必须满足正则表达式 `[a-zA-Z*:][a-zA-Z0-9_:]\_`。
- 标签 label：使同一个时间序列有了不同维度的识别。例如 `http*requests_total{method="Get"}` 表示所有 http 请求中的 Get 请求。当 method="post" 时，则为新的一个 metric。标签中的键由 ASCII 字符，数字，以及下划线组成，且必须满足正则表达式 `[a-zA-Z*:][a-zA-Z0-9_:]\_`。
- 样本 timestamp + value：实际的时间序列，每个序列包括一个 float64 的值和一个毫秒级的时间戳。
- 格式：`<metric name>{<label name>=<label value>, …}`，例如：`http_requests_total{method="POST",endpoint="/api/tracks"}`。

## 四种 Metric 类型

Prometheus 客户端库主要提供四种主要的 metric 类型：

- Counter
  一种累加的 metric，只增不减（除非系统发生重置），典型的应用如：`http_requests_total`，`node_cpu` 等等。
  例如，查询 `http_requests_total{method="get", job="Prometheus", handler="query"}` 返回 `8`，10 秒后，再次查询，则返回`14`。
  一般在定义 Counter 类型指标的名称时推荐使用\_total 作为后缀。
- Gauge
  一种常规的 metric，典型的应用如：温度，运行的 goroutines 的个数。Gauge 类型的指标侧重于反应系统的当前状态。
  可以任意加减。
  例如：`go_goroutines{instance="172.17.0.2", job="Prometheus"}` 返回值 `147`，10 秒后返回 `124`。
- Histogram
  可以理解为柱状图，典型的应用如：请求持续时间，响应大小。
  可以对观察结果采样，分组及统计。
- Summary
  类似于 Histogram, 典型的应用如：请求持续时间，响应大小。
  提供观测值的 count 和 sum 功能。
  提供百分位的功能，即可以按百分比划分跟踪结果。

Histogram 和 Summary 主用用于统计和分析样本的分布情况。

在大多数情况下人们都倾向于使用某些量化指标的平均值，例如 CPU 的平均使用率、页面的平均响应时间。这种方式的问题很明显，以系统 API 调用的平均响应时间为例：如果大多数 API 请求都维持在 100ms 的响应时间范围内，而个别请求的响应时间需要 5s，那么就会导致某些 WEB 页面的响应时间落到中位数的情况，而这种现象被称为长尾问题。

为了区分是平均的慢还是长尾的慢，最简单的方式就是按照请求延迟的范围进行分组。例如，统计延迟在 0~10ms 之间的请求数有多少而 10~20ms 之间的请求数又有多少。通过这种方式可以快速分析系统慢的原因。Histogram 和 Summary 都是为了能够解决这样问题的存在，通过 Histogram 和 Summary 类型的监控指标，我们可以快速了解监控样本的分布情况。

与 Summary 类型的指标相似之处在于 Histogram 类型的样本同样会反应当前指标的记录的总数(以`_count` 作为后缀)以及其值的总量（以`_sum` 作为后缀）。不同在于 Histogram 指标直接反应了在不同区间内样本的个数，区间通过标签 len 进行定义。

不同在于 Histogram 通过 `histogram_quantile` 函数是在服务器端计算的分位数。 而 Sumamry 的分位数则是直接在客户端计算完成。因此对于分位数的计算而言，Summary 在通过 PromQL 进行查询时有更好的性能表现，而 Histogram 则会消耗更多的资源。反之对于客户端而言 Histogram 消耗的资源更少。


## 数据采集
Prometheus支持两种数据采集方式：Pull和Push。
- pull：prometheus server去agent拉取数据
- push：agent主动上报数据到prometheus server

对比：
1. Push时效性较好，可将采集数据立即上报。Pull采用周期性采集。若对实时性要求非常高，最好采用Push。
2. Push采集后立刻上报，本地不会保存采集数据。Pull正好相反，agent本身需要有一定的数据存储能力，prometheus仅负责简单拉取。
3. Push方式，控制方为agent，agent来决定上报周期和内容。Pull的话，prometheus来控制周期和内容。
4. Push方式必须在agent配置prometheus的地址。pull方式prometheus可做到与agent解耦，agent不用感知prometheus的存在。

Prometheus的两种配置更新方式：
1. 调用prometheus的reload接口，即`localhost:9090/-/reload`，需要先开启`--web.enable-lifecycle`，推荐这个方式。
2. 发送HUP信号给prometheus，即`kill -HUP <prometheus进程ID>`，需要获取进程id，并不方便。


## instance 和 jobs

- instance: 一个单独 scrape 的目标， 一般对应于一个进程。
- jobs: 一组同种类型的 instances（主要用于保证可扩展性和可靠性）


## Prometheus Server

下载安装：https://prometheus.io/download/#prometheus
解压后将目录中的命令（prometheus、promtool、tsdb）放到`/usr/local/bin` 中。
其采集的数据会以文件的形似存储在本地中，默认的存储路径为当前目录的 `data/`中。若不存在会自动创建。
用户也可以通过参数`--storage.tsdb.path="data/"`修改本地数据存储的路径。
**但是启动一定要 `prometheus.yml` 文件，若没有就启动不了**

默认配置文件：

```
global:
scrape_interval: 15s  Set the scrape interval to every 15 seconds. Default is every 1 minute.
evaluation_interval: 15s  Evaluate rules every 15 seconds. The default is every 1 minute.

alerting:
alertmanagers:

- static_configs:
  - targets:

rule_files:

scrape_configs:
- job_name: 'prometheus'
  static_configs:
  - targets: ['localhost:9090']
```

配置为 systemd 服务：

```
[Unit]
Description=Prometheus Server
After=network.target

[Service]
Type=simple
Restart=on-failure
ExecStart=/usr/local/bin/prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/var/lib/prometheus

[Install]
WantedBy=multi-user.target
```

docker 启动：

```
docker run -p 9090:9090 -v /etc/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus
```

启动后，可通过 9090 端口访问 web 页面，或`/metrics` 访问纯数据

为了能够让 Prometheus Server 能够从当前 node exporter 获取到监控数据，这里需要修改 Prometheus 配置文件。编辑`prometheus.yml` 并在 `scrape_configs` 节点下添加以下内容

```
scrape_configs:
- job_name: 'prometheus'
  static_configs:
  - targets: ['localhost:9090']

 采集 node exporter 监控数据

- job_name: 'node'
  static_configs:
  - targets: ['localhost:9100']
```


常见指标：

- `node*boot_time`：系统启动时间
- `node_cpu`：系统 CPU 使用量
- `nodedisk*`：磁盘 IO
- `nodefilesystem*`：文件系统用量
- `node_load1`：系统负载
- `nodememeory*`：内存使用量
- `nodenetwork*`：网络带宽
- `node_time`：当前系统时间
- `go*_`：node exporter 中 go 相关指标
- `process__`：node exporter 自身进程相关运行指标

## 使用 PromQL 查询监控数据


PromQL 是 Prometheus 自定义的一套强大的数据查询语言，除了使用监控指标作为查询关键字以为，还内置了大量的函数，帮助用户进一步对时序数据进行处理。

可通过`node_cpu_seconds_total{mode='idle'}`查找具体的某项的值
`rate(node_cpu_seconds_total{mode='idle'}[2m])` 查看过去 2min 的增长速率

在 Prometheus 中，每一个暴露监控样本数据的 HTTP 服务称为一个实例。例如在当前主机上运行的 node exporter 可以被称为一个实例(Instance)。
当前在每一个 Job 中主要使用了静态配置(static_configs)的方式定义监控目标。除了静态配置每一个 Job 的采集 Instance 地址以外，Prometheus 还支持与 DNS、Consul、E2C、Kubernetes 等进行集成实现自动发现 Instance 实例，并从这些 Instance 上获取监控数据。
除了通过使用“up”表达式查询当前所有 Instance 的状态以外，还可以通过 Prometheus UI 中的 Targets 页面查看当前所有的监控采集任务，以及各个任务下所有实例的状态。

Prometheus 会将所有采集到的样本数据以时间序列（time-series）的方式保存在内存数据库中，并且定时保存到硬盘上。time-series 是按照时间戳和值的序列顺序存放的，我们称之为向量(vector). 每条 time-series 通过指标名称(metrics name)和一组标签集(labelset)命名。

在 time-series 中的每一个点称为一个样本（sample），样本由以下三部分组成：

- 指标(metric)：metric name 和描述当前样本特征的 labelsets;
- 时间戳(timestamp)：一个精确到毫秒的时间戳;
- 样本值(value)： 一个 float64 的浮点型数据表示当前样本的值。

```
http_request_total{status="200", method="GET"}@1434417560938 => 94355
|----metric name--|----------labelsets-------|---timestamp--|--value-|
```

其中`__`作为前缀的标签，是系统保留的关键字，只能在系统内部使用。标签的值则可以包含任何 Unicode 编码的字符。在 Prometheus 的底层实现中指标名称实际上是以`__name__=<metric name>`的形式保存在数据库中的

```
http_request_total{status="200", method="GET"} == {__name__="http_request_total", status="200", method="GET"}
```

PromQL 支持用户根据时间序列的标签匹配模式来对时间序列进行过滤，目前主要支持两种匹配模式：完全匹配和正则匹配。
PromQL 支持使用=和!=两种完全匹配模式
PromQL 还可以支持使用正则表达式作为匹配条件，多个表达式之间使用`|`进行分离：

- 使用`label=~regx`表示选择那些标签符合正则表达式定义的时间序列；
- 反之使用`label!~regx`进行排除；

直接查找时，返回值中只会包含该时间序列中的最新的一个样本值，这样的返回结果我们称之为瞬时向量。而相应的这样的表达式称之为瞬时向量表达式。如果我们想过去一段时间范围内的样本数据时，我们则需要使用区间向量表达式，时间范围通过时间范围选择器[]进行定义，通过区间向量表达式查询到的结果我们称为区间向量。时间选择器单位：`s - 秒`、`m - 分钟`、`h - 小时`、`d - 天`、`w - 周`、`y - 年`
如果想查询，5 分钟前的瞬时样本数据，或昨天一天的区间内的样本数据，可以使用位移操作，位移操作的关键字为 offset。

```
http_request_total{} offset 5m
http_request_total{}[1d] offset 1d
```

如果描述样本特征的标签(label)在并非唯一的情况下，通过 PromQL 查询数据，会返回多条满足这些特征维度的时间序列。而 PromQL 提供的聚合操作可以用来对这些时间序列进行处理，形成一条新的时间序列

```
 查询系统所有 http 请求的总量
sum(http_request_total)

 按照 mode 计算主机 CPU 的平均使用时间
avg(node_cpu) by (mode)

 按照主机查询各个主机的 CPU 使用率
sum(sum(irate(node_cpu{mode!='idle'}[5m])) / sum(irate(node_cpu[5m]))) by (instance)
```

PromQL 还直接支持用户使用标量(Scalar)和字符串(String)。

- 标量（Scalar）：一个浮点型的数字值，标量只有一个数字，没有时序。
- 字符串（String）：一个简单的字符串值，直接使用字符串，作为 PromQL 表达式，则会直接返回字符串。

PromQL 还支持丰富的操作符，用户可以使用这些操作符对进一步的对事件序列进行二次加工。这些操作符包括：数学运算符，逻辑运算符，布尔运算符等等。
数学运算工作方式：依次找到与左边向量元素匹配（标签完全一致）的右边向量元素进行运算，如果没找到匹配元素，则直接丢弃。同时新的时间序列将不会包含指标名称。
布尔运算则支持用户根据时间序列中样本的值，对时间序列进行过滤。瞬时向量与标量进行布尔运算时，PromQL 依次比较向量中的所有时间序列样本的值，如果比较结果为 true 则保留，反之丢弃。瞬时向量与瞬时向量直接进行布尔运算时，同样遵循默认的匹配模式：依次找到与左边向量元素匹配（标签完全一致）的右边向量元素进行相应的操作，如果没找到匹配元素，则直接丢弃。

布尔运算符的默认行为是对时序数据进行过滤。而在其它的情况下我们可能需要的是真正的布尔结果。这时可以使用 bool 修饰符改变布尔运算的默认行为。

```
http_requests_total > bool 1000
```

使用 bool 修改符后，布尔运算不会对时间序列进行过滤，而是直接依次瞬时向量中的各个样本数据与标量的比较结果 0 或者 1。从而形成一条新的时间序列。

```
http_requests_total{code="200",handler="query",instance="localhost:9090",job="prometheus",method="get"} 1
http_requests_total{code="200",handler="query_range",instance="localhost:9090",job="prometheus",method="get"} 0
```

如果是在两个标量之间使用布尔运算，则必须使用 bool 修饰符

通过集合运算，可以在两个瞬时向量与瞬时向量之间进行相应的集合操作。支持以下集合运算符：`and` (并且)， `or` (或者) ，`unless` (排除)

```
vector1 and vector2 会产生一个由 vector1 的元素组成的新的向量。该向量包含 vector1 中完全匹配 vector2 中的元素组成。
vector1 or vector2 会产生一个新的向量，该向量包含 vector1 中所有的样本数据，以及 vector2 中没有与 vector1 匹配到的样本数据。
vector1 unless vector2 会产生一个新的向量，新向量中的元素由 vector1 中没有与 vector2 匹配的元素组成。
```

在 PromQL 操作符中优先级由高到低依次为：

1. `^`
2. `*`, `/`, `%`
3. `+`, `-`
4. `==`, `!=`, `<=`, `<`, `>=`, `>`
5. `and`, `unless`
6. `or`

PromQL 中有两种典型的匹配模式：一对一（one-to-one）,多对一（many-to-one）或一对多（one-to-many）。

```
vector1 <operator> vector2
```

在操作符两边表达式标签不一致的情况下，可以使用 on(label list)或者 ignoring(label list）来修改便签的匹配行为。使用 ignoring 可以在匹配时忽略某些便签。而 on 则用于将匹配行为限定在某些便签之内。

```
<vector expr> <bin-op> ignoring(<label list>) <vector expr>
<vector expr> <bin-op> on(<label list>) <vector expr>
```

对于样本：

```
method_code:http_errors:rate5m{method="get", code="500"} 24
method_code:http_errors:rate5m{method="get", code="404"} 30
method_code:http_errors:rate5m{method="put", code="501"} 3
method_code:http_errors:rate5m{method="post", code="500"} 6
method_code:http_errors:rate5m{method="post", code="404"} 21

method:http_requests:rate5m{method="get"} 600
method:http_requests:rate5m{method="del"} 34
method:http_requests:rate5m{method="post"} 120
```

若要对两个关键字进行操作，必须进行限制一方的标签，否则无法匹配，通过 ignoring，将 code 标签忽略

```
method_code:http_errors:rate5m{code="500"} / ignoring(code) method:http_requests:rate5m
```

匹配的结果

```
{method="get"} 0.04 // 24 / 600 第一行与第七行
{method="post"} 0.05 // 6 / 120 第四行与第九行
```

多对一和一对多两种匹配模式指的是“一”侧的每一个向量元素可以与"多"侧的多个元素匹配的情况。在这种情况下，必须使用 group 修饰符：group_left 或者 group_right 来确定哪一个向量具有更高的基数（充当“多”的角色）。

```
<vector expr> <bin-op> ignoring(<label list>) group_left(<label list>) <vector expr>
<vector expr> <bin-op> ignoring(<label list>) group_right(<label list>) <vector expr>
<vector expr> <bin-op> on(<label list>) group_left(<label list>) <vector expr>
<vector expr> <bin-op> on(<label list>) group_right(<label list>) <vector expr>
```

多对一和一对多两种模式一定是出现在操作符两侧表达式返回的向量标签不一致的情况。因此需要使用 ignoring 和 on 修饰符来排除或者限定匹配的标签列表。
同样用上面的例子，右向量中的元素可能匹配到多个左向量中的元素 因此该表达式的匹配模式为多对一，需要使用 group 修饰符 group_left 指定左向量具有更好的基数。

```
method_code:http_errors:rate5m / ignoring(code) group_left method:http_requests:rate5m
```

匹配结果：

```
{method="get", code="500"} 0.04 // 24 / 600
{method="get", code="404"} 0.05 // 30 / 600
{method="post", code="500"} 0.05 // 6 / 120
{method="post", code="404"} 0.175 // 21 / 120
```

group 修饰符只能在比较和数学运算符中使用。在逻辑运算 and,unless 和 or 才注意操作中默认与右向量中的所有元素进行匹配。

PromQL 聚合可以将瞬时表达式返回的样本数据进行聚合，形成一个具有较少样本值的新的时间序列。

- `sum` (求和)
- `min` (最小值)
- `max` (最大值)
- `avg` (平均值)
- `stddev` (标准差)
- `stdvar` (标准差异)
- `count` (计数)
- `count_values` (对 value 进行计数)
- `bottomk` (样本值最小的 k 个元素)
- `topk` (样本值最大的 k 个元素)
- `quantile` (分布统计)

这些操作符被用于聚合所有标签维度，或者通过 without 或者 by 子语句来保留不同的维度。

```
<aggr-op>([parameter,] <vector expression>) [without|by (<label list>)]
```

其中只有 count_values, quantile, topk, bottomk 支持参数(parameter)。
without 用于从计算结果中移除列举的标签，而保留其它标签。by 则正好相反，结果向量中只保留列出的标签，其余标签则移除。通过 without 和 by 可以按照样本的问题对数据进行聚合。

如果指标 http_requests_total 的时间序列的标签集为 application, instance, 和 group，我们可以通过以下方式计算所有 instance 中每个 application 和 group 的请求总量：

```
sum(http_requests_total) without (instance)
```

等价于

```
sum(http_requests_total) by (application, group)
```

如果只需要计算整个应用的 HTTP 请求总量，可以直接使用表达式：

```
sum(http_requests_total)
```

`count_values` 用于时间序列中每一个样本值出现的次数。`count_values`会为每一个唯一的样本值输出一个时间序列，并且每一个时间序列包含一个额外的标签。这个标签的名字由聚合参数指定，同时这个标签值是唯一的样本值。
例如要计算运行每个构建版本的二进制文件的数量：

```
count_values("version", build_version)
```

返回结果如下：

```
{count="641"} 1
{count="3226"} 2
{count="644"} 4
```

`topk` 和 `bottomk` 则用于对样本值进行排序，返回当前样本值前 n 位，或者后 n 位的时间序列。
获取 HTTP 请求数前 5 位的时序样本数据，可以使用表达式：

```
topk(5, http_requests_total)
```

`quantile` 用于计算当前样本数据值的分布情况 `quantile(φ, express)` ，其中 0 ≤ φ ≤ 1。
例如，当 φ 为 0.5 时，即表示找到当前样本数据中的中位数：

```
quantile(0.5, http_requests_total)
```

返回结果如下：

```
{} 656
```

## 常用函数

|  函数名   | 作用                                           |  函数名   | 作用                                       |
| :-------: | ---------------------------------------------- | :-------: | ------------------------------------------ |
|    abs    | 返回绝对值                                     |  absent   | 检查是否有样本数据                         |
|   ceil    | 向上取整                                       |   floor   | 向下取整                                   |
|  changes  | 区间向量内每个样本数据值变化的次数             | clamp_max | 样本数据值若大于 max，则改为 max           |
| clamp_min | 样本数据值若小于 min，则改为 min               |   delta   | 区间向量第一个元素和最后一个元素之间的差值 |
| increase  | 区间向量中的第一个和最后一个样本并返回其增长量 |   irate   | 计算区间向量的增长率                       |
|   rate    | 计算区间向量在时间窗口内平均增长速率           |   round   | 返回向量中所有样本值的最接近的整数         |
|   sort    | 对向量按元素的值进行升序排序                   | sort_desc | 对向量按元素的值进行降序排序               |


# Prometheus Server 配置文件详细说明

```
global:
   查询目标的频率
  [ scrape_interval: <duration> | default = 1m ]

   查询失败的超时时间
  [ scrape_timeout: <duration> | default = 10s ]

   匹配规则的频率
  [ evaluation_interval: <duration> | default = 1m ]

   当与外部系统（外部存储、Alertmanager）联系时，可附加到任意时间序列或告警的标签
  external_labels:
    [ <labelname>: <labelvalue> ... ]

 指定规则文件
rule_files:
  [ - <filepath_glob> ... ]

 抓取配置
scrape_configs:
  [ - <scrape_config> ... ]

 与alertmanager相关的告警配置
alerting:
  alert_relabel_configs:
    [ - <relabel_config> ... ]
  alertmanagers:
    [ - <alertmanager_config> ... ]

 配置远端写入特性
remote_write:
  [ - <remote_write> ... ]

 配置远端读取特性
remote_read:
  [ - <remote_read> ... ]
```

## 抓取配置

```
scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
   采集node exporter监控数据
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100', "192.168.1.13:9100"]
```

## 将 prometheus 数据自动写入 influxdb
1. 安装influxdb，安装1.8版本，非2.0以上版本
  ```
  wget https://dl.influxdata.com/influxdb/releases/influxdb-1.8.10.x86_64.rpm
  sudo yum localinstall influxdb-1.8.10.x86_64.rpm

  systemctl start influxdb
  ```
2. 进入influxdb，创建prometheus库
  ```
   influx
  Connected to http://localhost:8086 version 1.8.10
  InfluxDB shell version: 1.8.10
  > create database prometheus;
  > show databases;
  name: databases
  name
  ----
  _internal
  prometheus
  > exit
  ```
3. 配置prometheus，在`prometheus.yml`中添加
  ```
  remote_write:
    - url: "http://192.168.13.41:8086/api/v1/prom/write?db=prometheus"

  remote_read:
    - url: "http://192.168.13.41:8086/api/v1/prom/read?db=prometheus"
  ```

> [prometheus如何存储influxdb官方文档](https://docs.influxdata.com/influxdb/v1.8/supported_protocols/prometheus/)



# AlertManager 报警

Prometheus 的报警分为两个部分。 Prometheus 服务器中的报警规则将报警发送到 Alertmanager。 然后，报警管理器将重复数据删除，分组，再通过电子邮件，通话通知系统和聊天平台等方法管理这些报警，包括静默，禁止，聚合和发出通知。

分组（Grouping）将性质相似的警报归类为单个通知。当许多系统同时发生故障，并且可能同时发出数百到数千个警报时，这种方法尤其有用。警报分组、分组通知的定时以及这些通知的接收者由配置文件中的路由树配置。

抑制（Inhibition）是当某些其他警报已经触发时，抑制某些警报的通知。发出警报，通知整个群集不可访问。 可以将 Alertmanager 配置为使与该群集有关的所有其他警报静音，这样可以防止与实际问题无关的数百或数千个触发警报的通知。通过 Alertmanager 的配置文件配置抑制。

静默（Sliences）是一种简单地在给定时间内静音警报的简单方法。静默是基于匹配器（matchers）配置的，就像路由树一样。将检查传入警报是否与活动静默的所有相等或正则表达式匹配。如果这样做了，将不会发送该警报的通知。静默是在 Alertmanager 的 web 界面配置的。

Alertmanager 支持配置以创建高可用性集群。这可以使用`——cluster-*`标志进行配置。重点是不要在 Prometheus 和它的 Alertmanagers 之间进行负载平衡，而是将 Prometheus 指向一个所有 Alertmanagers 的列表。

下载：https://prometheus.io/download/#alertmanager
解压后执行 alertmanager 命令，需要当前目录有配置文件，默认配置文件为：

```
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://127.0.0.1:5001/'
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
```

启动 alertmanager，通过 web 的 9093 端口访问

配置 systemd 服务`/usr/lib/systemd/system/alertmanager.service`：

```
[Unit]
Description=Alertmanager
After=network.target

[Service]
Type=simple
Restart=on-failure
ExecStart=/usr/local/bin/alertmanager --config.file=/etc/prometheus/alertmanager.yml --storage.path=/var/lib/alertmanager

[Install]
WantedBy=multi-user.target
```


# HTTP API

Prometheus API 使用了 JSON 格式的响应内容。 当 API 调用成功后将会返回 2xx 的 HTTP 状态码。当 API 调用失败时可能返回以下几种不同的 HTTP 状态码：

- `404 Bad Request`：参数错误或者缺失
- `422 Unprocessable Entity`：表达式无法执行
- `503 Service Unavailiable`：请求超时或者被中断

## 表达式请求

瞬时数据请求：`/api/v1/query`，有 GET 和 POST 两种方法。有以下参数，参数间用`&`连接：

- `query=`：PromQL 表达式
- `time=<rfc3339 | unix_timestamp>`：用于指定用于计算 PromQL 的时间戳。可选参数，默认情况下使用当前系统时间。
- `timeout=`：超时设置。可选参数，默认情况下使用`-query.timeout` 的全局设置。

请求结果的`data`段的结构如下：

```
{
  "resultType": "matrix" | "vector" | "scalar" | "string",
  "result": <value>
}
```

示例：

```
curl 'http://localhost:9090/api/v1/query?query=up&time=2015-07-01T20:10:51.781Z'
{
   "status" : "success",
   "data" : {
      "resultType" : "vector",
      "result" : [
         {
            "metric" : {
               "__name__" : "up",
               "job" : "prometheus",
               "instance" : "localhost:9090"
            },
            "value": [ 1435781451.781, "1" ]
         },
         ...
      ]
    }
}
```

区间数据请求：`/api/v1/query_range`，支持 GET 和 POST。有以下参数：

- `query=`: PromQL 表达式。
- `start=`: 起始时间。
- `end=`: 结束时间。
- `step=`: 查询步长。
- `timeout=`: 超时设置。可选参数，默认情况下使用`-query.timeout`的全局设置。

请求结果的`data`段结构：

```
{
  "resultType": "matrix",
  "result": <value>
}
```

示例：

```
curl 'http://localhost:9090/api/v1/query_range?query=up&start=2015-07-01T20:10:30.781Z&end=2015-07-01T20:11:00.781Z&step=15s'
{
   "status" : "success",
   "data" : {
      "resultType" : "matrix",
      "result" : [
         {
            "metric" : {
               "__name__" : "up",
               "job" : "prometheus",
               "instance" : "localhost:9090"
            },
            "values" : [
               [ 1435781430.781, "1" ],
               [ 1435781445.781, "1" ],
               [ 1435781460.781, "1" ]
            ]
         },
         ...
      ]
   }
}
```

## 请求元数据

请求序列信息：`/api/v1/series`，有 GET 和 POST 方法。有以下参数：

- `match[] = <series_selector>`：重复的序列选择器参数，用于选择要返回的序列。必须至少提供一个`match[]`参数。
- `start = <rfc3339 | unix_timestamp>`：开始时间戳。
- `end = <rfc3339 | unix_timestamp>`：结束时间戳。

查询结果的`data`部分由一个对象列表组成，这些对象包含标识每个系列的标签名/值对。

```
curl -g 'http://localhost:9090/api/v1/series?' --data-urlencode='match[]=up' --data-urlencode='match[]=process_start_time_seconds{job="prometheus"}'

{
   "status" : "success",
   "data" : [
      {
         "__name__" : "up",
         "job" : "prometheus",
         "instance" : "localhost:9090"
      },
      ...
   ]
}
```

获取标签（label）名：`/api/v1/labels`，支持 GET 和 POST。

```
curl 'localhost:9090/api/v1/labels'
{
    "status": "success",
    "data": [
        "__name__",
        "call",
        "code",
        "config",
        "dialer_name",
        "endpoint",
        ...
    ]
}
```

获取标签值：`/api/v1/label/<label_name>/values`，仅支持 GET

```
curl http://localhost:9090/api/v1/label/job/values
{
   "status" : "success",
   "data" : [
      "node",
      "prometheus"
   ]
}
```

## targets

获取 targets：`/api/v1/targets`，支持 GET。
活动（active）目标和已删除（dropped）目标都是响应的一部分。 `labels`表示在重新标记后的标签集。`discoverLabel`表示在重新标记之前在服务发现期间检索到的未修改的标签。

```
curl http://localhost:9090/api/v1/targets
{
  "status": "success",
  "data": {
    "activeTargets": [
      {
        "discoveredLabels": {
          "__address__": "127.0.0.1:9090",
          "__metrics_path__": "/metrics",
          "__scheme__": "http",
          "job": "prometheus"
        },
        "labels": {
          "instance": "127.0.0.1:9090",
          "job": "prometheus"
        },
        "scrapeUrl": "http://127.0.0.1:9090/metrics",
        "lastError": "",
        "lastScrape": "2017-01-17T15:07:44.723715405+01:00",
        "health": "up"
      }
    ],
    "droppedTargets": [
      {
        "discoveredLabels": {
          "__address__": "127.0.0.1:9100",
          "__metrics_path__": "/metrics",
          "__scheme__": "http",
          "job": "node"
        },
      }
    ]
  }
}
```

## rules

获取 rules：`/api/v1/rules`，支持 GET。返回当前加载的报警和记录规则的列表，还返回由每个报警规则的 Prometheus 实例触发的当前活动报警。

```
curl http://localhost:9090/api/v1/rules

{
    "data": {
        "groups": [
            {
                "rules": [
                    {
                        "alerts": [
                            {
                                "activeAt": "2018-07-04T20:27:12.60602144+02:00",
                                "annotations": {
                                    "summary": "High request latency"
                                },
                                "labels": {
                                    "alertname": "HighRequestLatency",
                                    "severity": "page"
                                },
                                "state": "firing",
                                "value": "1e+00"
                            }
                        ],
                        "annotations": {
                            "summary": "High request latency"
                        },
                        "duration": 600,
                        "health": "ok",
                        "labels": {
                            "severity": "page"
                        },
                        "name": "HighRequestLatency",
                        "query": "job:request_latency_seconds:mean5m{job=\"myjob\"} > 0.5",
                        "type": "alerting"
                    },
                    {
                        "health": "ok",
                        "name": "job:http_inprogress_requests:sum",
                        "query": "sum(http_inprogress_requests) by (job)",
                        "type": "recording"
                    }
                ],
                "file": "/rules.yaml",
                "interval": 60,
                "name": "example"
            }
        ]
    },
    "status": "success"
}
```

## alerts

获取 alerts：`/api/v1/alerts`，支持 GET。返回所有启用的报警的列表。

```
curl http://localhost:9090/api/v1/alerts

{
    "data": {
        "alerts": [
            {
                "activeAt": "2018-07-04T20:27:12.60602144+02:00",
                "annotations": {},
                "labels": {
                    "alertname": "my-alert"
                },
                "state": "firing",
                "value": "1e+00"
            }
        ]
    },
    "status": "success"
}
```

## alertmanager

获取 alertmanager 信息：`/api/v1/alertmanagers`。支持 GET。返回 Prometheus alertmanager 发现的当前状态的概述。

```
curl http://localhost:9090/api/v1/alertmanagers
{
  "status": "success",
  "data": {
    "activeAlertmanagers": [
      {
        "url": "http://127.0.0.1:9090/api/v1/alerts"
      }
    ],
    "droppedAlertmanagers": [
      {
        "url": "http://127.0.0.1:9093/api/v1/alerts"
      }
    ]
  }
}
```

## status

获取该结点的当前的 Prometheus 配置：`/api/v1/status/config`，支持 GET。
配置作为转储的 YAML 文件返回。 由于 YAML 库的限制，不包括 YAML 注释。

```
curl http://localhost:9090/api/v1/status/config
{
  "status": "success",
  "data": {
    "yaml": "<content of the loaded config file in YAML>",
  }
}
```

获取配置 Prometheus 的标志值：`/api/v1/status/flags`，支持 GET。

```
curl http://localhost:9090/api/v1/status/flags
{
  "status": "success",
  "data": {
    "alertmanager.notification-queue-capacity": "10000",
    "alertmanager.timeout": "10s",
    "log.level": "info",
    "query.lookback-delta": "5m",
    "query.max-concurrency": "20",
    ...
  }
}
```

获取关于 Prometheus 服务器的各种运行时信息属性：`/api/v1/status/runtimeinfo`，支持 GET。
根据运行时属性的性质，返回的值具有不同的类型。

```
curl http://localhost:9090/api/v1/status/runtimeinfo
{
  "status": "success",
  "data": {
    "startTime": "2019-11-02T17:23:59.301361365+01:00",
    "CWD": "/",
    "reloadConfigSuccess": true,
    "lastConfigTime": "2019-11-02T17:23:59+01:00",
    "chunkCount": 873,
    "timeSeriesCount": 873,
    "corruptionCount": 0,
    "goroutineCount": 48,
    "GOMAXPROCS": 4,
    "GOGC": "",
    "GODEBUG": "",
    "storageRetention": "15d"
  }
}
```

获取关于 Prometheus 服务器的各种构建信息属性：`/api/v1/status/buildinfo`，支持 GET。

```
curl http://localhost:9090/api/v1/status/buildinfo
{
  "status": "success",
  "data": {
    "version": "2.13.1",
    "revision": "cb7cbad5f9a2823a622aaa668833ca04f50a0ea7",
    "branch": "master",
    "buildUser": "julius@desktop",
    "buildDate": "20191102-16:19:59",
    "goVersion": "go1.13.1"
  }
}
```


---
title: Prometheus监控平台
tags: [Prometheus, 监控, 云计算]
categories: [监控]
date: 2019-12-13 11:41:10
comments: false
---

Prometheus 是最初在 SoundCloud 上构建的开源系统监视和报警工具包。Prometheus 于 2016 年加入了 CNCF，这是继 Kubernetes 之后的第二个托管项目。

<!--more-->

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

Histogram 和 Summary 主要用于统计和分析样本的分布情况。

在大多数情况下人们都倾向于使用某些量化指标的平均值，例如 CPU 的平均使用率、页面的平均响应时间。这种方式的问题很明显，以系统 API 调用的平均响应时间为例：如果大多数 API 请求都维持在 100ms 的响应时间范围内，而个别请求的响应时间需要 5s，那么就会导致某些 WEB 页面的响应时间落到中位数的情况，而这种现象被称为长尾问题。

为了区分是平均的慢还是长尾的慢，最简单的方式就是按照请求延迟的范围进行分组。例如，统计延迟在 0~10ms 之间的请求数有多少而 10~20ms 之间的请求数又有多少。通过这种方式可以快速分析系统慢的原因。Histogram 和 Summary 都是为了能够解决这样问题的存在，通过 Histogram 和 Summary 类型的监控指标，我们可以快速了解监控样本的分布情况。

与 Summary 类型的指标相似之处在于 Histogram 类型的样本同样会反应当前指标的记录的总数(以`_count` 作为后缀)以及其值的总量（以`_sum` 作为后缀）。不同在于 Histogram 指标直接反应了在不同区间内样本的个数，区间通过标签 len 进行定义。

不同在于 Histogram 通过 `histogram_quantile` 函数是在**服务器端计算**的分位数。 而 Sumamry 的分位数则是直接在**客户端计算**完成。因此对于分位数的计算而言，Summary 在通过 PromQL 进行查询时有更好的性能表现，而 Histogram 则会消耗更多的资源。反之对于客户端而言 Histogram 消耗的资源更少。


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


# Prometheus配置文件详细说明

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

## kubernetes_sd_configs
k8s服务发现配置。允许从Kubernetes的REST API中检索抓取目标，并始终与集群状态保持同步。

role分别有以下几种：
- `node`：每个集群节点都被看做一个node target，地址默认为Kubelet的HTTP端口。target地址默认为`NodeInternalIP`、`NodeExternalIP`、`NodeLegacyHostIP`和`NodeHostName`这些节点对象地址类型顺序中的第一个现存在的地址。
  可用meta label：
  - `__meta_kubernetes_node_name`: 节点对象的名称
  - `__meta_kubernetes_node_provider_id`: 节点对象的云提供商名
  - `__meta_kubernetes_node_label_<labelname>`: 节点对象的每个label
  - `__meta_kubernetes_node_labelpresent_<labelname>`: 节点对象的每个label都为`true`
  - `__meta_kubernetes_node_annotation_<annotationname>`: 节点对象的每个annotation
  - `__meta_kubernetes_node_annotationpresent_<annotationname>`: 节点对象的每个annotation都为`true`
  - `__meta_kubernetes_node_address_<address_type>`: 节点地址对象的第一个地址（若存在）
- `service`：每个服务的每个端口都作为一个service target，将设置为服务的Kubernetes DNS名称和相应的服务端口。
  可用meta label：
  - `__meta_kubernetes_namespace`: 服务对象的namespace
  - `__meta_kubernetes_service_annotation_<annotationname>`: 服务对象的每个annotation
  - `__meta_kubernetes_service_annotationpresent_<annotationname>`: 服务对象的每个annotation都为`true`
  - `__meta_kubernetes_service_cluster_ip`: 服务对象的clusterIP
  - `__meta_kubernetes_service_external_name`: 服务对象的DNS名
  - `__meta_kubernetes_service_label_<labelname>`: 服务对象的每个label
  - `__meta_kubernetes_service_labelpresent_<labelname>`: 服务对象的每个label都为`true`
  - `__meta_kubernetes_service_name`: 服务对象的名字
  - `__meta_kubernetes_service_port_name`: 服务对象的端口
  - `__meta_kubernetes_service_port_protocol`: 服务对象的端口协议
  - `__meta_kubernetes_service_type`: 服务对象的类型
- `pod`：每个pod的每个容器的端口都作为一个target，如果容器没有指定端口，则会为每个容器创建一个无端口target，以便通过重标记手动添加端口。
  可用meta label：
  - `__meta_kubernetes_namespace`: pod对象的namespace
  - `__meta_kubernetes_pod_name`: pod对象的名字
  - `__meta_kubernetes_pod_ip`: pod对象的pod ip
  - `__meta_kubernetes_pod_label_<labelname>`: pod对象的每个label
  - `__meta_kubernetes_pod_labelpresent_<labelname>`: pod对象的每个label都为`true`
  - `__meta_kubernetes_pod_annotation_<annotationname>`: pod对象的每个annotation
  - `__meta_kubernetes_pod_annotationpresent_<annotationname>`: pod对象的每个annotation都为`true`
  - `__meta_kubernetes_pod_container_init`: 若容器为一个InitContainer，则为`true`
  - `__meta_kubernetes_pod_container_name`: pod对象的容器名
  - `__meta_kubernetes_pod_container_port_name`: pod对象的容器端口名
  - `__meta_kubernetes_pod_container_port_number`: pod对象的容器端口
  - `__meta_kubernetes_pod_container_port_protocol`: pod对象的容器端口协议
  - `__meta_kubernetes_pod_ready`: pod对象的启动状态，`true`或`false`
  - `__meta_kubernetes_pod_phase`: pod对象的运行状态`Pending`, `Running`, `Succeeded`, `Failed` 或 `Unknown`
  - `__meta_kubernetes_pod_node_name`: pod对象的运行node名
  - `__meta_kubernetes_pod_host_ip`: pod对象的运行node ip
  - `__meta_kubernetes_pod_uid`: pod对象的uid
  - `__meta_kubernetes_pod_controller_kind`: pod对象controller的类型
  - `__meta_kubernetes_pod_controller_name`: pod对象controller的名称
- `endpoints`：每个endpoint对象作为一个target。如果endpoint是由pod支持的，则pod的所有未绑定到endpoint端口的附加容器端口也被发现为target。
  可用meta label：
  - `__meta_kubernetes_namespace`: endpoint对象的namespace
  - `__meta_kubernetes_endpoints_name`: endpoint对象的名称
  - 对于直接从endpoint列表发现的所有target，都会带上以下的label：
    - `__meta_kubernetes_endpoint_hostname`: endpoint对象的hostname
    - `__meta_kubernetes_endpoint_node_name`: endpoint对象的node名
    - `__meta_kubernetes_endpoint_ready`: endpoint对象的状态，`true`或`false`
    - `__meta_kubernetes_endpoint_port_name`: endpoint对象的端口
    - `__meta_kubernetes_endpoint_port_protocol`: endpoint对象的端口协议
    - `__meta_kubernetes_endpoint_address_target_kind`: endpoint对象的地址类型
    - `__meta_kubernetes_endpoint_address_target_name`: endpoint对象的地址名
  - 如果endpoint属于一个服务，则会附加这个service的所有label
  - 如果endpoint映射一个pod，则会附加这个pod的所有label
- `endpointslice`
- `ingress`：每个ingress的路径作为一个target
  可用meta label：
  - `__meta_kubernetes_namespace`: ingress对象的namespace
  - `__meta_kubernetes_ingress_name`: ingress对象的名称
  - `__meta_kubernetes_ingress_label_<labelname>`: ingress对象的每个label
  - `__meta_kubernetes_ingress_labelpresent_<labelname>`: ingress对象的每个label都为`true`
  - `__meta_kubernetes_ingress_annotation_<annotationname>`: ingress对象的每个annotation
  - `__meta_kubernetes_ingress_annotationpresent_<annotationname>`: ingress对象的每个annotation都为`true`
  - `__meta_kubernetes_ingress_class_name`: ingress对象的class名（若存在）
  - `__meta_kubernetes_ingress_scheme`: ingress对象的scheme，若配置了TLS，则为`https`，默认为`http`
  - `__meta_kubernetes_ingress_path`: ingress对象的path，默认为 `/`

## relabel_config
可以在目标的标签集被抓取之前动态地重写它。
```yaml
# The source labels select values from existing labels. Their content is concatenated
# using the configured separator and matched against the configured regular expression
# for the replace, keep, and drop actions.
[ source_labels: '[' <labelname> [, ...] ']' ]

# Separator placed between concatenated source label values.
[ separator: <string> | default = ; ]

# Label to which the resulting value is written in a replace action.
# It is mandatory for replace actions. Regex capture groups are available.
[ target_label: <labelname> ]

# Regular expression against which the extracted value is matched.
[ regex: <regex> | default = (.*) ]

# Modulus to take of the hash of the source label values.
[ modulus: <int> ]

# Replacement value against which a regex replace is performed if the
# regular expression matches. Regex capture groups are available.
[ replacement: <string> | default = $1 ]

# Action to perform based on regex matching.
[ action: <relabel_action> | default = replace ]
```
<regex> is any valid RE2 regular expression. It is required for the replace, keep, drop, labelmap,labeldrop and labelkeep actions. The regex is anchored on both ends. To un-anchor the regex, use .*<regex>.*.

<relabel_action> determines the relabeling action to take:

replace: Match regex against the concatenated source_labels. Then, set target_label to replacement, with match group references (${1}, ${2}, ...) in replacement substituted by their value. If regex does not match, no replacement takes place.
lowercase: Maps the concatenated source_labels to their lower case.
uppercase: Maps the concatenated source_labels to their upper case.
keep: Drop targets for which regex does not match the concatenated source_labels.
drop: Drop targets for which regex matches the concatenated source_labels.
hashmod: Set target_label to the modulus of a hash of the concatenated source_labels.
labelmap: Match regex against all source label names, not just those specified in source_labels. Then copy the values of the matching labels to label names given by replacement with match group references (${1}, ${2}, ...) in replacement substituted by their value.
labeldrop: Match regex against all label names. Any label that matches will be removed from the set of labels.
labelkeep: Match regex against all label names. Any label that does not match will be removed from the set of labels.


# K8S集群中Prometheus的规划与部署
规划概括：
1. 简单，实现自动发现，拒绝手工配置
2. 详尽，能采集的都要采集
3. 打标签，并规范标签，通过annotation打标签

规划具体思路：
1. 新建一个namespace，叫monitor，prometheus监控相关的都在这个空间
2. 必部署组件：blackbox_exporter，metrics-server，kube-state-metrics
3. node_exporter可以放集群内也可以放宿主机上，看具体规划
4. 指定一个单独节点跑prometheus的pod，给这个节点打上污点，并在prometheus的yaml中设置容忍
5. 若这个Prometheus为总的Prometheus，则需要进行持久化存储，若这个Prometheus还会汇聚到一个联邦Prometheus，则无需持久化存储，并且只要保留24小时数据即可（以下是按照后者进行规划部署）。

## Role与SA
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus
rules:
- apiGroups: [""]
  resources:
  - nodes
  - nodes/proxy
  - services
  - endpoints
  - pods
  verbs: ["get", "list", "watch"]
- apiGroups:
  - extensions
  - networking.k8s.io # 兼容不同version的权限 fix 修复权限问题
  resources:
  - ingresses
  verbs: ["get", "list", "watch"]
- nonResourceURLs: ["/metrics"]
  verbs: ["get"]
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: monitor
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prometheus
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: prometheus
subjects:
- kind: ServiceAccount
  name: prometheus
  namespace: monitor
```

## Deployment与Service
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitor
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus    
      tolerations:     # 设置容忍，可以调度到有apptype污点的节点，与下面的nodeSelector配合，即可确保这个node上只有prometheus能运行
      - key: "apptype"
        operator: "Exists"
        effect: "NoSchedule"
      nodeSelector:
        app: prometheus    # 调度到app=prometheus的机器
        kubernetes.io/os: linux
      containers:
      - image: prom/prometheus:v2.32.1
        name: prometheus
        command:
        - "/bin/prometheus"
        args:
        - "--config.file=/etc/prometheus/prometheus.yml"
        - "--storage.tsdb.path=/prometheus"
        - "--storage.tsdb.retention=24h"
        - "--web.enable-lifecycle"
        ports:
        - containerPort: 9090
          protocol: TCP
        volumeMounts:
        - mountPath: "/prometheus"
          name: data
        - mountPath: "/etc/prometheus"
          name: config-volume
        resources:
          requests:
            cpu: "2"
            memory: "2Gi"
          limits:
            cpu: "2"
            memory: "2Gi"
      volumes:
      - name: data
        emptyDir: {}
      - name: config-volume
        configMap:
          name: prometheus-config
---
kind: Service
apiVersion: v1
metadata:
  labels:
    app: prometheus
  name: prometheus
  namespace: monitor
spec:
  type: NodePort
  ports:
  - port: 9090
    targetPort: 9090
    nodePort: 30090
  selector:
    app: prometheus
```

## configMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitor
data:
  prometheus.yml: |
    global:
      scrape_interval:     30s
      evaluation_interval: 30s

    scrape_configs:
    ....job列表....
```

以下会对每个job进行详细描述

### apiservers
```yaml
- job_name: 'apiservers'
  kubernetes_sd_configs:
  - role: endpoints
  scheme: https
  tls_config:
    ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
  bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
  relabel_configs:
  - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
    action: keep
    regex: default;kubernetes;https
```
获取apiserver的信息，获取到的指标以`apiserver_`开头

### cadvisor
```yaml
- job_name: 'cadvisor'
  kubernetes_sd_configs:
  - role: node
  scheme: https
  tls_config:
    ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    insecure_skip_verify: false
  bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
  relabel_configs:
  - action: labelmap
    regex: __meta_kubernetes_node_label_(.+)
  - target_label: __address__
    replacement: kubernetes.default.svc:443
  - source_labels: [__meta_kubernetes_node_name]
    regex: (.+)
    target_label: __metrics_path__
    replacement: /api/v1/nodes/${1}/proxy/metrics/cadvisor
```
收集container相关信息，获取到的指标以`container_`开头

### kubelet
```yaml
- job_name: "kubelet"
  honor_timestamps: true
  scrape_interval: 1m
  scrape_timeout: 1m
  metrics_path: /metrics
  scheme: https
  kubernetes_sd_configs:
  - role: node
  bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
  tls_config:
    ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    insecure_skip_verify: false
  relabel_configs:
  - separator: ;
    regex: __meta_kubernetes_node_label_(.+)
    replacement: $1
    action: labelmap
  - separator: ;
    regex: (.*)
    target_label: __address__
    replacement: kubernetes.default.svc:443
    action: replace
  - source_labels: [__meta_kubernetes_node_name]
    separator: ;
    regex: (.+)
    target_label: __metrics_path__
    replacement: /api/v1/nodes/${1}/proxy/metrics
    action: replace
```
收集kubelet相关信息，获取到的指标以`kubelet_`开头

### service_endpoints_metrics
```yaml
- job_name: 'service_endpoints_metrics'

  kubernetes_sd_configs:
  - role: endpoints
  relabel_configs:
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
    action: keep
    regex: true
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scheme]
    action: replace
    target_label: __scheme__
    regex: (https?)
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_path]
    action: replace
    target_label: __metrics_path__
    regex: (.+)
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_env]    # prometheus.io/env
    action: replace
    target_label: env
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_dept]   # prometheus.io/dept
    action: replace
    target_label: dept
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_project] # prometheus.io/project
    action: replace
    target_label: project
  - source_labels: [__address__, __meta_kubernetes_service_annotation_prometheus_io_port]
    action: replace
    target_label: __address__
    regex: ([^:]+)(?::\d+)?;(\d+)
    replacement: $1:$2

  - action: labelmap
    regex: __meta_kubernetes_service_label_(.+)
  - source_labels: [__meta_kubernetes_namespace]
    action: replace
    target_label: kubernetes_namespace
  - source_labels: [__meta_kubernetes_service_name]
    action: replace
    target_label: kubernetes_name
  - source_labels: [__meta_kubernetes_pod_host_ip]
    action: replace
    target_label: node_ip
  - source_labels: [__meta_kubernetes_pod_ip]
    action: replace
    target_label: pod_ip
```
自动获取暴露prometheus数据指标的服务的metrics，只要在该服务的annotations中添加相关信息即可。

例如kube-state-metrics服务，可访问`/metrics`获取prometheus指标，则可以按以下方法配置
```yaml
apiVersion: v1
kind: Service
metadata:
  annotations:
    prometheus.io/path: /metrics
    prometheus.io/scrape: "true"
  name: kube-state-metrics
  namespace: monitor
```

一些定义的参数：
- `prometheus.io/path`：指定获取指标的path，若不填就是默认`/metrics`，根据实际情况填写
- `prometheus.io/port`：服务的端口
- `prometheus.io/scrape`：是否开启，`true`为开启，`false`不开启，没设置就不开启
- `prometheus.io/env`：设置环境标签，与上面的`__meta_kubernetes_service_annotation_prometheus_io_env`对应
- `prometheus.io/dept`：设置部门标签，与上面的`__meta_kubernetes_service_annotation_prometheus_io_dept`对应
- `prometheus.io/project`：设置项目标签，与上面的`__meta_kubernetes_service_annotation_prometheus_io_project`对应


### http_get
```yaml
- job_name: 'http_get'

  metrics_path: /probe
  params:
    module: [http_2xx]
  kubernetes_sd_configs:
  - role: service
  relabel_configs:
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_http_get]
    action: keep
    regex: true

  # __address__  匹配完整服务地址加端口 <service>.<namespace>.svc:<port>
  # __meta_kubernetes_service_annotation_prometheus_io_path 匹配 /actuator/info     
  # 最后匹配出 <service>.<namespace>.svc:<port>/actuator/info

  - source_labels: [__address__,__meta_kubernetes_service_annotation_prometheus_io_path]
    action: replace
    regex: (.+);(.*)
    replacement: http://$1$2  # 拼接需要监控的url
    target_label: __param_target

  - target_label: __address__
    replacement: blackbox-exporter.monitor.svc:9115

  - source_labels: [__meta_kubernetes_service_annotation_kubernetes_io_env]
    action: replace
    target_label: env
  - source_labels: [__meta_kubernetes_service_annotation_kubernetes_io_project]
    action: replace
    target_label: project
  - source_labels: [__meta_kubernetes_service_annotation_kubernetes_io_dept]
    action: replace
    target_label: dept

  - source_labels: [__param_target]
    target_label: instance

  # 额外添加标签
  - action: labelmap
    regex: __meta_kubernetes_service_label_(.+)

  - source_labels: [__meta_kubernetes_namespace]
    target_label: namespace

  - source_labels: [__meta_kubernetes_service_name]
    target_label: service_name

  - source_labels: [__meta_kubernetes_service_name]
    target_label: app
```
HTTP探针状态监控，使用的是blackbox-exporter。

以下为几个参数：
- `prometheus.io/path`：服务健康检查路径
- `prometheus.io/http_get`：是否开启收集，`true`为开启，`false`为不开启，没设置就不开启
- `prometheus.io/env`：环境标签
- `prometheus.io/project`：项目标签
- `prometheus.io/dept`：部门标签

例：
```yaml
  annotations:
    kubernetes.io/http_get: "true"
    kubernetes.io/path: "/actuator/info"
    kubernetes.io/env: "prod"
    kubernetes.io/project: "xxx"
    kubernetes.io/dept: "xxx"
```

### ingress_http_get
```yaml
- job_name: 'ingress_http_get'

  metrics_path: /probe
  params:
    module: [http_2xx]
  kubernetes_sd_configs:
  - role: ingress
  relabel_configs:
  - source_labels: [__meta_kubernetes_ingress_annotation_kubernetes_io_probed]
    action: keep
    regex: true

  - source_labels: [__meta_kubernetes_ingress_scheme,__address__,__meta_kubernetes_ingress_annotation_kubernetes_io_path]
    target_label: __param_target
    regex: (.+);(.+);(.*)
    replacement: ${1}://${2}${3}

  - target_label: __address__
    replacement: 外部blackbox-exporter IP:9115 # 监控 ingress域名 使用外部blackbox-exporter，因为集群内部可能访问不到域名

  - source_labels: [__param_target]
    target_label: instance

  - source_labels: [__meta_kubernetes_ingress_annotation_kubernetes_io_auth]
    action: replace
    target_label: auth
  - source_labels: [__meta_kubernetes_ingress_annotation_kubernetes_io_env]
    action: replace
    target_label: env
  - source_labels: [__meta_kubernetes_ingress_annotation_kubernetes_io_project]
    action: replace
    target_label: project
  - source_labels: [__meta_kubernetes_ingress_annotation_kubernetes_io_dept]
    action: replace
    target_label: dept

  # 额外添加标签
  - action: labelmap
    regex: __meta_kubernetes_ingress_label_(.+)

  - source_labels: [__meta_kubernetes_namespace]
    target_label: kubernetes_namespace

  - source_labels: [__meta_kubernetes_ingress_name]
    target_label: kubernetes_name

  - source_labels: [__meta_kubernetes_ingress_name]
    target_label: app
```
Ingress探针设置，使用的是集群外部部署的blackbox-exporter。

以下为几个参数：
- `prometheus.io/path`：服务健康检查路径
- `prometheus.io/probed`：是否开启收集，`true`为开启，`false`为不开启，没设置就不开启
- `prometheus.io/env`：环境标签
- `prometheus.io/project`：项目标签
- `prometheus.io/dept`：部门标签

例：
```yaml
  annotations:
    kubernetes.io/probed: "true"
    kubernetes.io/path: "/"
    kubernetes.io/env: "prod"
    kubernetes.io/project: "xxx"
    kubernetes.io/dept: "xxx"
```
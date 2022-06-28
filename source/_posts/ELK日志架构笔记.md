---
title: ELK日志架构笔记
date: 2018-09-24 16:28:34
tags: [Elasticsearch, ELK, Kafka, Kibana, Logstash, 运维, 日志, Filebeat]
categories: [大数据, 日志, 架构]
---

本篇文章将完整描述基于ELK的日志系统的设计与部署，以及所有涉及的知识点。

<!--more-->

## Elasticsearch

Elasticsearch 是基于 Lucene 的搜索框架，使用 Java 编写，它提供了一个分布式多用户能力的全文搜索引擎，基于 RESTful web 接口，上手容易，拓展节点方便，可用于存储和检索海量数据，接近实时搜索，海量数据量增加，搜索响应性能几乎不受影响。

> Apache Lucene：目前存在的拥有最先进，高性能和全功能搜索引擎功能的库。但仅仅是一个库，Elasticsearch 则是提供了 Lucene 库的 RESTful API 接口，将所有的功能打包成一个单独的服务，做到”开箱即用“。

Elasticsearch 主要特点：

- 全文检索，结构化检索
- 数据统计、分析，接近实时处理
- 分布式搜索（可部署数百台服务器）
- 自动发现节点
- 副本机制
- 处理 PB 级别的结构化或者非结构化数据
- 保障可用性
- 搜索纠错，自动完成
- 与各种语言基础，与 Hadoop、Spark 等大数据分析平台集成

使用场景：日志搜索，数据聚合，数据监控，报表统计分析

> 使用 Elasticsearch 的大企业：维基百科、卫报、StackOverflow、Github、ebay

### Elasticsearch 安装

1. 因为 Lucene 和 Elasticsearch 都是 Java 写的，所以首先搭建 JDK 环境，下载 JDK1.8，设置环境变量，并`source /etc/profile`应用

   ```
   echo "export JAVA_HOME=/usr/local/jdk1.8" >> /etc/profile
   echo "export CLASSPATH=\$JAVA_HOME/lib" >> /etc/profile
   echo "export PATH=\$JAVA_HOME/bin:\$PATH" >> /etc/profile
   source /etc/profile
   ```

2. 下载 Elasticsearch，目前版本为 6.4.1，解压到`/usr/local/elasticsearch-6.4`

3. 不能使用 root 运行`elasticsearch`，需要创建一个用户

   ```
   useradd elastic
   chown -R elastic:elastic /usr/local/elasticsearch-6.4
   ```

4. 切换到该用户，并执行`elasticsearch`。等待一段时间启动，然后执行`curl localhost:9200`查看。若看到 json 对象信息则说明成功。

   ```
   curl localhost:9200
   {
     "name" : "3dcAoxl",
     "cluster_name" : "elasticsearch",
     "cluster_uuid" : "GNdmHFuXTsK-6B-swVNQag",
     "version" : {
       "number" : "6.4.1",
       "build_flavor" : "default",
       "build_type" : "tar",
   ......
     },
     "tagline" : "You Know, for Search"
   }
   ```

**运行报错**

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290241549.jpg)

```
bootstrap checks failed  #bootstrap检查失败
max virtual memory areas vm.max_map_count [65530] is too low, increase to at least [262144]  #最大虚拟内存太低
```

解决：

1. 临时解决： `sysctl -w vm.max_map_count=262144`
2. 永久解决：修改`/etc/sysctl.conf`文件，添加 `vm.max_map_count`设置，并执行`sysctl -p`

```
max file descriptors [4096] for elasticsearch process is too low, increase to at least [65536]
```

解决：修改 unix 最大同时打开文件数，`ulimit -n 65536`

```
elasticsearch
  -E <键值对>            设置参数
  -d, --daemonize       后台启动
  -p, --pidfile <Path>  设置PID文件
  -q, --quiet           静默启动
  -s, --silent          显示最少的输出
  -v, --verbose         显示详细输出
```

## Elasticsearch 配置文件

ES 核心配置文件`config/elasticsearch.yml`

```
cluster.name: my-application     #集群名称，若相同，且是同一网段会自动加入
node.name: node-1                #当前节点名称
node.attr.rack: r1               #
network.host: 127.0.0.1          #默认情况下，Elastic只允许本机访问
                                 #若要远程访问，取消注释并修改值为0.0.0.0


```

JVM 配置文件`jvm.option`，最好不要调。

```
-Xms1g     #最小堆内存
-Xmx1g     #最大堆内存
#两个值最好一致，且为机器物理内存的一半到2/3，也不能太小

-XX:+UseConcMarkSweepGC
-XX:CMSInitiatingOccupancyFraction=75
-XX:+UseCMSInitiatingOccupancyOnly
#垃圾回收算法，官方已经优化过了，不用调整
```

## Elasticsearch 概念

Elasticsearch 是 **面向文档** 的，意味着它存储整个对象或文档。且 Elasticsearch 不仅存储文档，而且索引每个文档的内容使之可以被检索。在 Elasticsearch 中，是对文档进行索引、检索、排序和过滤，而不是对行列数据。这就是 ES 能支持复杂的全文搜索的原因。

Elasticsearch 使用 JSON 作为文档的序列化格式。存储数据到 Elasticsearch 的行为叫做**索引**（动词，索引一个文档就是存储一个文档到索引），一个 Elasticsearch 集群可以包含多个索引 ，相应的每个索引可以包含多个**类型** 。这些不同的类型存储着多个文档 ，每个文档又有多个**字段** 。Elasticsearch 和 Lucene 使用**倒排索引（也称反向索引）**结构达到较高的检索速度。倒排索引就是关系型数据库通过增加一个索引到**指定列**上以提高搜索速度。

### REST

Representational State Transfer 表述性状态传递，是一种软件架构风格，提供的是一组设计原则和约束条件，主要用于客户端与服务器交互的软件，使得软件更简洁、有层次，更利于实现缓存等机制。

REST 提供的与资源交互的方法：类似于 HTTP，但 REST 的方法仅仅面向资源，无法对 web 应用操作。

- GET：列出 URI 以及资源中详细信息
- PUT：将给定的一组资源替换当前资源
- POST：在指定资源中创建、追加一个新资源
- DELETE：删除资源
- HEAD：获取头信息

```
PUT /megacorp/employee/1
{
    "first_name" : "John",
    "last_name" :  "Smith",
    "age" :        25,
    "about" :      "I love to go rock climbing",
    "interests": [ "sports", "music" ]
}
```

`megacorp`为索引名，`employee`为类型名，`1`为雇员 ID。Elasticsearch 仅需要找到雇员 ID 文件，就能知道该雇员的所有信息。

若要与关系型数据库对照，**索引**（indice 或 index）对应**库**，**类型**（type）对应**表**，**文档**（document）对应**行**，**字段**（field）对应**列**

Elasticsearch 通过将数据**分片（shards）**存储以解决数据量大时不能直接存储在一块硬盘中，且无法一次性搜索超大的数据量的情况。创建索引时，只需定义所需的分片数即可。每个分片本身都是一个功能齐全且独立的“索引”，可以托管在集群中的任何节点上。

> 每个 Elasticsearch 分片都是 Lucene 索引。每个 Lucene 可包含的最大文件数量为 Integer.MAX_VALUE - 128 个文件可以使用`/_cat/shards`监视分片大小。

并通过创建分片的**副本（replicas）**，当主分片不可用时，副本就充当主分片使用。Elasticsearch 为每个索引分配 5 个主分片和 1 个副本，若集群中有两个节点，该索引的分片数会翻倍，即 10 个分片。

### 集群原理

一个运行的 Elasticsearch 实例为一个节点，集群是由一个或多个拥有相同`cluster.name`的节点构成的，当有节点加入集群中或者从集群中移除节点时，集群将会重新平均分布所有的数据。

> `cluster.name`默认为`elasticsearch`

主节点：负责管理集群范围内的所有变更（增删索引和节点等），任何节点都可以成为主节点。主节点并不需要涉及到文档级别的变更和搜索等操作，因此流量的增加它也不会成为瓶颈。

每个节点都知道任意文档所处的位置，并且能够将请求直接转发到存储客户所需文档的节点。

### 集群健康

可通过`curl localhost:9200/_cluster/health`或使用`telnet 127.0.0.1 9200`并输入`GET /_cluster/health HTTP/1.1`获取集群的健康状况，或通过`curl 127.0.0.1 9200/_cat/health?v`查看。

```
{
    "cluster_name":     "elasticsearch",
    "status":           "green",
    "timed_out":        false,
......
}
```

其中健康状况就是字段`status`，有三个可能值：

- `green`：所有的主分片和副本分片都正常运行
- `yellow`：所有的主分片都正常运行，但不是所有的副本分片都正常运行
- `red`：有主分片没能正常运行，数据可能丢失，需要紧急修复

### 水平扩容

读操作、搜索和返回数据都可以同时被主分片或副本分片所处理，所以拥有越多的副本分片时，也将拥有越高的吞吐量。在运行中的集群上是可以动态调整副本分片数目的 ，可以按需伸缩集群。

```
curl -H "Content-Type: application/json" -X PUT localhost:9200/blogs/_settings -d '
{
    "number_of_replicas": 2
}'
```

如果只是**在相同节点数目的集群上增加更多的副本分片并不能提高性能**，因为**每个分片从节点上获得的资源会变少**，需要增加更多的硬件资源来提升吞吐量，但是**更多的副本分片数提高了数据冗余量**。

### 添加索引

可通过`curl`添加索引

```
curl -H "Content-Type: application/json" -X PUT localhost:9200/blogs/article/1 -d '
{
    "title":   "article1",
    "content": "article1"
}'
# -H设置内容类型，要设为JSON格式
# -X设置请求类型，设为PUT
# -d设置请求数据
```

若添加成功就会返回以下信息：

```
{
    "_index": "blogs",
    "_type": "article",
    "_id": "1",
    "_version": 1,
    "result": "created",
    "_shards":{
        "total": 2,        #目前总共的分片数
        "successful": 1,
        "failed": 0
    },
    "_seq_no": 0,
    "_primary_term": 1
}
```

对已存在的记录再进行 PUT 操作就会更新该记录，同时，该字段的`_version`和`_result`都会改变，`_version`会`+1`，`_result`会变为`updated`。

再通过`curl localhost:9200/blogs/article/1`，获取该文章的元数据，以及`_source`属性，存储的就是文章中定义的内容。

```
{
    "_index": "blogs",
    "_type": "article",
    "_id": "1",
    "_version": 1,
    "found": true,
    "_source": {
        "title": "article1",
        "content": "article1"
    }
}
```

可通过`curl localhost:9200/_cat/indices?v`获取当前节点的索引信息

若要删除某个索引或类型或文档，都可通过`curl -X DELETE localhost:9200/要删的资源`删除。

### 简单搜索

`curl localhost:9200/_search?pretty`获取本节点的所有文档信息，并且返回结果不仅告知匹配了哪些文档，还包含了整个文档本身：显示搜索结果给最终用户所需的全部信息。`?pretty`会将 json 重新排版显示。

```
{
  ......
  "hits" : {
    "total" : 2,
    "max_score" : 1.0,
    "hits" : [
      {
        "_index" : "blogs",
        "_type" : "article",
        "_id" : "2",
        "_score" : 1.0,
        "_source" : {
          "title" : "article2",
          "content" : "article2"
        }
      },
      ......
    ]
  }
}
```

可通过`_all`字段进行指定文档或类型中的搜索，例如`/_all/employee/_search?`进行指定类型中搜索（所有索引的中的`employee`（如果存在））

`?q=字段:值`进行**查询字符串（Query-string）**搜索

```
curl localhost:9200/_search?q=title:article2
{
    ......
    "hits":{"total":1,"max_score":0.2876821,"hits":[{"_index":"blogs","_type":"article","_id":"2","_score":0.2876821,"_source":
{
    "title":   "article2",
    "content": "article2" }}]}}
```

### 查询表达式搜索

使用的是 Elasticsearch 开发的 DSL（领域特定语言），基于 JSON 定义查询，能够构造复杂的查询语句。

不使用 Query-string 查询，而是通过请求体查询，请求会通过 Json 构造。

```
curl localhost:9200/_search -X GET -H "Content-Type: application/json" -d '
{
    "query":{
        "match":{           #使用了match类型查询
            "title": "article1"
        }
    }
}'
```

常用请求体搜索规则：

`"query":{}`表示开始查询，其中定义许多查询规则，会计算评分数量（相关度）`_score`

- `"bool"`：进行布尔匹配
  - `"must"`：包含
  - `"must_not"`：不包含
- `"match"`：普通匹配，若用空格隔开多个关键字，则 es 认为是或的关系，如果要同时满足多个关键词，即与关系，必须用`bool`查询
- `"match_phrase"`：短语精确匹配
- `"filter"`：过滤器，不会计算评分数量
  - `"range"`：匹配范围，例如：`"range":{age":{"gt":30}}`匹配 age 大于 30
- `"size"`：设置一次返回的结果数量，默认为 10 条。
- `"from"`：设置移位，默认从位置 0 开始

```
# 已经alias curl_lo_g='curl -X GET -H 'Content-Type:application/json''
# export LO_ES='localhost:9200'

curl_lo_g ${LO_ES}/_all/employee/_search -d '
{
  "query": {
    "bool": {
      "filter": {
        "range": {
          "age": {
            "gt": "30"   #要加上双引号
          }
        }
      },                 #这里有逗号
      "must": {
        "match": {
          "hobby": "swimming"
        }
      }
    }
  }
}'
```

对于 filter 和 query 的区别：

- 大部分 filter 的速度**快于**query 的速度
- filter 不会计算相关度得分，且结果会**有缓存，效率高**
- 全文搜索、**评分排序**，使用 query
- 是非过滤，**精确匹配**，使用 filter

### 高亮搜索

能将搜索结果的要搜索的字符串高亮显示，

```
curl_lo_g ${LO_ES}/_all/employee/_search -d '
{
  "query": {
    "match": {
      "hobby": "climbing"
    }
  },
  "highlight": {      #只需要添加highlight搜索即可
    "fields": {       #fields指定高亮的字段
      "hobby": {}     #需要高亮搜索的字段
    }
  }
}'

......
{"_index":"tech","_type":"employee","_id":"3","_score":0.2876821,"_source":
{
  "name": "wangwu",
  "age": "26",
  "address": "yangzhou",
  "hobby": ["swimming", "climbing"]
},
"highlight":{             #标出高亮部分
  "hobby":[
    "<em>climbing</em>"   #高亮部分由HTML标签<em>封装
                          #告诉浏览器把其中的文本表示为强调的内容
                          #通常为斜体
  ]}}]}}
```

### 聚合

聚合 aggregations 用于生成基于数据的精细分析结果，类似 SQL 的`group by`。

## Logstash

Logstash 是一个开源的服务器端数据处理管道（Pipeline），它可以同时从多个源中提取数据，对其进行转换，然后将其发送到数据存储（如 Elasticsearch）。支持丰富的 Input 和 Output 类型，能够处理各种应用的日志。

Logstash 对于每一行数据（称为 event）按流水线三个部分进行操作：

- input：负责产生事件（即数据），即数据源，如 syslog、数据库日志、web 日志、文件系统日志、java 的 log4j、网络日志、防火墙等各类日志，kafka、RabbitMQ 等消息队列，移动设备、智能家居、传感器、联网汽车等 IoT 数据，以及 Beats 能获取的数据。是必须配置
- filter：负责数据处理与转换，包括过滤，分类等操作。不是必须配置。
- output：负责数据的输出，可输出到数据分析或存储的软件，如 Elasticsearch，nagios，kibana 等数据处理软件。是必须配置

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290244846.png)
Logstash 开箱即用，包含许多聚合（aggregation）和突变（mutation），以及模式匹配（pattern matching），地理映射（geo mapping）和动态查找（dynamic lookup）功能。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290243196.png)

## Logstash 安装

1. 下载 Logstash 包，版本为 6.4.1，解压到`/usr/local/logstash6.4`

2. 进入 logstash 的`bin`目录执行`./logstash -e 'input{stdin{}} output{stdout{codec=>rubydebug}}'`，需要等待一段时间，期间会有信息，直到出现`Successfully started Logstash API endpoint {:port=>9600}`，然后输入`hello world`即可看到以下信息。若要退出，按`Ctrl+D`。

   ```
   hello world
   {
          "message" => "hello world",
             "host" => "VM_0_7_centos",
         "@version" => "1",
       "@timestamp" => 2018-09-26T11:09:10.781Z
   }
   ```

docker 下载 Logstash：直接`docker pull logstash`即可。

docker 下启动 Logstash：首先要确保本地存放 pipeline 配置文件的目录存在。通过在该目录添加配置文件。或者直接`-v ~/config:/usr/share/logstash/config`可直接修改所有配置

`docker run -it -v ~/pipeline:/usr/share/logstash/pipeline logstash`

Logstash 配置文件：

- `logstash.yml`：主配置文件
- `pipelines.yml`：管道的配置，包括 input，filter，output
- `jvm.options`：JVM 配置文件
- `log4j2.properties`：log4j2 的配置
- `startup.options`：启动脚本选项文件，包含 Logstash 的变量。若要让 Logstash 按修改后的配置运行，需要重新用 root 运行`bin/system-install`导入参数。
- 自定义的 Logstash 配置文件，一般以`.conf`结尾，同样存放在配置文件目录中。

logstash 命令

```
logstash
    -n NAME          指定logstash的node.name，若不指定默认是当前的主机名
    -f CONFIG_PATH   从特定文件或目录加载logstash配置
    -e CONFIG_STRING 使用给定的字符串作为配置数据（与配置文件的语法相同）
                     默认输入：“input {stdin {type => stdin}}”
                     默认输出：“output {stdout {codec => rubydebug}}“
                     若直接使用默认，则-e "" 即可（不能什么都不加）
    --field-reference-parser MODE 在解析字段引用时使用的模式
    字段引用解析器用于扩展管道配置中的字段引用，能更好地处理非法和模糊输入
    可用的MODE值：1. LEGACY：LEGACY解析器，不发出警告
                2. COMPAT：COMPAT解析器，对每个不同的模糊或非法语法输入警告一次（默认使用）
                3.STRICT：STRICT解析器，模糊或非法语法输入会引发插件运行时异常
    --modules MODULES   加载logstash模块，不能与'-e'或'-f'一起使用
                        因为会覆盖在logstash.yml中加载的模块
    两种写法：--modules module1 --modules module2 ...
            --modules=module1,module2
    -M MODULES_VARIABLE Load variables for module template.
                                  Multiple instances of '-M' or
                                  '--modules.variable' are supported.
                                  Ignored if '--modules' flag is not used.
                                  Should be in the format of
                                  '-M "MODULE_NAME.var.PLUGIN_TYPE.PLUGIN_NAME.VARIABLE_NAME=VALUE"'
                                  as in
                                  '-M "example.var.filter.mutate.fieldname=fieldvalue"'
    --setup                       Load index template into Elasticsearch, and saved searches,
                                  index-pattern, visualizations, and dashboards into Kibana when
                                  running modules.
                                   (default: false)
    --cloud.id CLOUD_ID           Sets the elasticsearch and kibana host settings for
                                  module connections in Elastic Cloud.
                                  Your Elastic Cloud User interface or the Cloud support
                                  team should provide this.
                                  Add an optional label prefix '<label>:' to help you
                                  identify multiple cloud.ids.
                                  e.g. 'staging:dXMtZWFzdC0xLmF3cy5mb3VuZC5pbyRub3RhcmVhbCRpZGVudGlmaWVy'
    --cloud.auth CLOUD_AUTH       Sets the elasticsearch and kibana username and password
                                  for module connections in Elastic Cloud
                                  e.g. 'username:<password>'
    --pipeline.id ID              Sets the ID of the pipeline.
                                   (default: "main")
    -w COUNT  指定pipeline worker数量（即线程数），默认1
    --experimental-java-execution (Experimental) Use new Java execution engine.
                                   (default: false)
    -b, --pipeline.batch.size SIZE Size of batches the pipeline is to work in.
                                   (default: 125)
    -u, --pipeline.batch.delay DELAY_IN_MS When creating pipeline batches, how long to wait while polling
                                  for the next event.
                                   (default: 50)
    --pipeline.unsafe_shutdown    Force logstash to exit during shutdown even
                                  if there are still inflight events in memory.
                                  By default, logstash will refuse to quit until all
                                  received events have been pushed to the outputs.
                                   (default: false)
    --path.data PATH   数据存储目录。插件需要能访问该目录，默认安装目录下的data/
    -p, --path.plugins PATH   插件目录，可指定多个Plugins are expected to be in a specific directory hierarchy:
                                  'PATH/logstash/TYPE/NAME.rb' where TYPE is 'inputs' 'filters', 'outputs' or 'codecs' and NAME is the name of the plugin.
                                   (default: [])
    -l PATH      指定Logstash的日志目录，默认安装目录下的logs/
    --log.level LEVEL             设置日志等级（fatal/error/warn/info/debug/trace），默认info
    --config.debug                Print the compiled config ruby code out as a debug log (you must also have --log.level=debug enabled).
                                  WARNING: This will include any 'password' options passed to plugin configs as plaintext, and may result
                                  in plaintext passwords appearing in your logs!
                                   (default: false)
    -i, --interactive SHELL       Drop to shell instead of running as normal.
                                  Valid shells are "irb" and "pry"

    -t           检查logstash配置文件语法是否正常
    -r           自动检测配置文件是否变动，若变动自动重载
    --config.reload.interval RELOAD_INTERVAL How frequently to poll the configuration location
                                  for changes, in seconds.
                                   (default: 3000000000)
    --http.host HTTP_HOST         Web API binding host (default: "127.0.0.1")
    --http.port HTTP_PORT         Web API http port (default: 9600..9700)
    --log.format FORMAT           Specify if Logstash should write its own logs in JSON form (one
                                  event per line) or in plain text (using Ruby's Object#inspect)
                                   (default: "plain")
    --path.settings SETTINGS_DIR  包含logstash.yml的目录，可通过LS_SETTINGS_DIR环境变量配置
    默认"/usr/local/logstash6.4/config"
    --verbose 相当于设置日志等级为info
    --debug   相当于设置日志等级为debug
    --quiet   相当于设置日志等级为info
```

## Logstash 如何工作

### 关闭 Logstash

可通过`systemctl stop logstash`或直接`kill`关闭。Logstash 有自己关闭过程，以达到安全地关闭：

- 首先停止所有的`input`、`filter`、`output`插件
- 处理完所有管道中的事件
- 最后关闭 Logstash 进程

在处理过程中，以下的状况会影响关闭过程：

- `input`插件以很慢的速度接收数据
- 速度慢的`filter`，如执行`sleep(10000)`的`Ruby filter`或执行非常繁重的查询的 Elasticsearch 过滤器。
- 一个断开连接的`output`插件，等待重新连接以刷新正在进行的事件。

Logstash 有一个停顿检测机制（stall detection），可以在关闭过程中分析管道和插件的行为。此机制会对内部队列中的飞行事件（in-flight events）数量和繁忙的 worker 线程列表定期生成信息报告。

若要在 Logstash 关闭阶段直接强行关闭，可在主配置文件中设置`pipeline.unsafe_shutdown`值为`true`，但这样可能造成数据丢失，不安全。

## Logstash 配置文件

### logstash.yml

因为配置文件的语法是 YAML，所以有两种写法：

```yaml
pipeline:
  batch:
    size: 125
    delay: 50
#等同于
pipeline.batch.size: 125
pipeline.batch.delay: 50
```

配置文件也支持`${}`引用变量

如果使用命令的`--modules`指定模块，则配置文件中所有配置的模块都会被忽略。

模块的配置：

```yaml
modules:
  - name: 模块名
    var.插件类型.插件名.键: 值
```

所有配置参数：

```
node.name             #节点名，默认为主机名

#path参数
path.data             #数据存放目录，默认为安装目录的data/
path.config           #logstash.yml路径
path.plugins          #插件的路径
#插件应该位于特定的目录层次结构中：PATH/logstash/TYPE/NAME.rb
#其中TYPE的值可以是inputs，filters，outputs或codecs，NAME是插件的名称

#http参数
http.port             #监听的http主机端口，默认为9600
http.host             #监听的http主机IP，默认为127.0.0.1

#日志log参数
log.level             #日志等级（fatal/error/warn/info/debug/trace），默认info
log.format            #日志格式，默认为plain格式
path.logs             #日志的路径，默认安装目录的logs/

#pipeline参数（关于pipeline的配置可专门存放在一个配置文件中，如pipeline.yml）
pipeline.id           #pipeline的ID，默认为main
pipeline.workers      #管道的worker数量，默认为CPU的核数
pipeline.batch.size   #单个工作线程将从输入收集的最大事件数，默认125。增大此值会加大内存开销，还需调整JVM堆内存参数
pipeline.batch.delay  #event被调度到worker前等待的时间，单位毫秒，默认50
pipeline.unsafe_shutdown  #在关闭时立刻退出，会导致数据丢失。
        #默认为false，完全退出前会将数据处理好并输出到屏幕再退出

#config参数
config.string         #pipeline配置
config.test_and_exit  #检查配置是否有效，然后退出。默认为false不检查
config.reload.automatic  #定期检查配置是否已更改，并在配置发生更改时重新加载配置。默认false不检查
config.reload.interval  #检查配置是否变动的时间间隔，需要上一条开启。默认3s
config.debug          #是否开启调试日志消息。若开启还需要将log.level的值设为debug。默认false
                      #注：日志消息可能会包含明文密码
config.support_escapes #是否开启转义字符，即启用\转义。默认false

modules               #设置模块

#queue参数
queue.type            #用于事件缓冲的队列模型（model to use for event buffering），有以下两种，默认memory。
       memory：传统基于内存的队列  persisted：基于磁盘的响应队列（disk-based ACKed queueing）
path.queue            #启用持久队列（即上一项值为persisted）时存储数据文件的目录。默认data/queue
queue.pagt_capacity   #启用持久队列时使用的页面数据文件的大小。默认64MB
queue.max_events      #启用持久队列时队列中未读事件的最大数量。默认0，不限制
queue.max_bytes       #队列的总容量，以字节数表示。确保磁盘容量大于此值。默认1G
#若与上一项同时配置，则Logstash会加载先配置的一项
queue.checkpoint.acks #启用持久队列时强制检查点之前的最大ACK响应事件数。默认1024，若设为0则不限制
queue.checkpoint.writes #在启用持久队列时强制检查点之前写入事件的最大数量。默认1024，若设为0则不限制
queue.drain           #启用后，Logstash将等待直到持久队列耗尽，然后才能关闭。默认false

#dead_letter_queue参数
dead_letter_queue.enable  #是否启用dead_letter_queue，简称DLQ功能。默认false不启用
dead_letter_queue.max_bytes #每个DLQ的最大大小。超出就会删除条目，默认1G
path.dead_letter_queue #DLQ目录的位置，默认为安装目录的data/dead_letter_queue
```

### 自定义 Logstash 配置文件

自定义的配置文件主要用于指定`input`、`filter`、`output`插件等管道参数。

配置文件支持的值类型：

- 列表 Lists：`[ ]`中包含多个值。如`path => ['XXX','XXX']`

- 布尔值 Boolean：指定`true`或`false`

- 字节 Bytes：是字符串字段，表示有效的字节单位。支持`SI`（k M G T P E Z Y）和二进制（`binary`）（Ki Mi Gi Ti Pi Ei Zi Yi）单位。二进制单位基数为 1024，SI 单位基数为 1000。此字段不区分大小写，并接受值和单位之间的空格。

- 编解码器 codec：表示数据的 Logstash 编解码器的名称。编解码器可用于输入和输出。例：`codec => json`

  - 输入编解码器提供了一种在数据**进入输入之前对其进行解码**的便捷方式。

  - 输出编解码器提供了一种在数据**离开输出之前对数据进行编码**的便捷方式。

  - 使用输入或输出编解码器无需在 Logstash 管道中使用单独的过滤器。

- 哈希 Hash：键值对集合，多条键值对间使用空格间隔，而不是逗号

- 数字 Number：数字必须为浮点型或整型

- 密码 Password：密码必须是一个字符串，且该字符串应未被记录或打印

- URI：可以是完整的 URL，也可以是类似邮件地址，如`user:pass@XXX.net`，如果 URI 包含密码，则不会记录或打印 URI 的密码部分

- 路径 Path：表示有效操作系统路径的字符串

- 字符串 String：必须用引号括住，可以是单引号或双引号

- 转义序列 Escape Sequences：默认不启用转义序列。如果要在字符串中使用转义字符，需要在`logstash.yml`中设置`config.support_escapes：true`。

## Logstash 日志

Logstash 的日志存放在`LS_HOME/logs`中，默认日志等级为`INFO`， Logstash 的日志框架基于`Log4j 2`框架，其大部分功能直接暴露给用户。

在调试问题时，尤其是插件问题时，一般将日志记录级别增加到`DEBUG`以获取更详细的消息。从 5.0 版本开始，可以在 Logstash 中配置特定日志子系统的日志记录。

Logstash 提供一个带有开箱即用设置的`log4j2.properties`文件，可以更改轮换策略，类型和其他 log4j2 配置。需要重启 Logstash 以应用该配置。

慢日志（Slowlog）用于报告在通过管道（pipeline）时花费不正常时间的事件的日志消息。慢日志同样存放在`LS_HOME/logs`中。可在主配置文件中添加 slowlog 的配置，如下：

```yaml
slowlog.threshold.warn: 2s
slowlog.threshold.info: 1s
slowlog.threshold.debug: 500ms
slowlog.threshold.trace: 100ms
```

以上配置指定了触发慢日志的条件。在过滤器中处理超过 100ms 的事件会在慢日志中记录为 trace 等级的事件，超过 2 秒的事件会记录为等级为 warn 的事件

可通过`curl -X GET localhost:9600/_node/logging?pretty`获取关于日志的信息

```json
curl localhost:9600/_node/logging?pretty
{
  "host" : "VM_0_7_centos",
  "version" : "6.4.1",
  "http_address" : "127.0.0.1:9600",
  "id" : "07b4b966-d732-4263-bc16-1efc6e927e1c",
  "name" : "VM_0_7_centos",
  "loggers" : {             #显示的是日志子系统以及日志等级
    "logstash.agent" : "INFO",
    "logstash.api.service" : "INFO",
    "logstash.codecs.line" : "INFO",
    "logstash.codecs.rubydebug" : "INFO",
......
```

可通过`curl -X PUT localhost:9600/_node/logging?pretty -H 'Content-Type: application/json' -d '{...}'`动态设置指定日志子系统的日志等级。例如：

```
curl -XPUT 'localhost:9600/_node/logging?pretty' -H 'Content-Type: application/json' -d '
{
    "logger.logstash.outputs.elasticsearch" : "DEBUG"
}'
```

则会在`log4j2.properties`配置中自动添加上该指定配置。若要重置已通过日志记录 API 动态更改的任何日志记录级别，需要通过将 PUT 请求发送到`_node/logging/reset`将所有日志记录级别都恢复为`log4j2.properties`文件中指定的值

`curl -X PUT localhost:9600/_node/logging/reset?pretty`

将其他任意日志导入 Logstash 的操作：编写一个 pipeline 配置文件`test.conf`，或直接在`pipeline.yml`添加

```
input {        #设置input参数
  file {
    #通过列表添加两个日志
    path => ['/var/log/httpd/access_log','/var/log/squid/access.log']
  }
}
output {        #标准输出，一定要加，否则无法输出到屏幕
  stdout {}
}
```

启动 Logstash，`bin/logstash -f config/test.conf`。会不断获取 httpd 和 squid 的日志消息

```
{
          "path" => "/var/log/httpd/access_log",
       "message" => "127.0.0.1 - - [02/Oct/2018:16:11:16 +0800] \"GET / HTTP/1.0\" 200 10 \"-\" \"ApacheBench/2.3\"",
    "@timestamp" => 2018-10-02T08:11:20.344Z,
      "@version" => "1",
          "host" => "VM_0_7_centos"
}
{
          "path" => "/var/log/squid/access.log",
       "message" => "1538467887.306    656 180.126.242.119 TCP_TUNNEL/200 33103 CONNECT xui.ptlogin2.qq.com:443 - HIER_DIRECT/xui.ptlogin2.qq.com -",
    "@timestamp" => 2018-10-02T08:11:27.355Z,
      "@version" => "1",
          "host" => "VM_0_7_centos"
}
```

若要将 elasticsearch 的日志都再导入 elasticsearch，可进行以下配置：

```
input {
  file {
    path => '/usr/local/es-6.4/logs/elasticsearch.log'
    type => 'elasticsearch'
    start_position => 'beginning'   #从日志的头开始读
  }
}
output {
  elasticsearch {          #使用elasticsearch插件
    hosts => '127.0.0.1:9200'   #指定elasticsearch源
    index => 'es_message-%{+YYYY.MM.dd}'  #指定index
  }
  stdout{
    codec => rubydebug
  }
}
```

启动 Logstash 就会显示已导入 elasticsearch 的日志

```
{
          "type" => "elasticsearch",
       "message" => "[2018-10-03T16:06:50,392][INFO ][o.e.c.m.MetaDataMappingService] [system135] [.kibana/PnIK501cQUydUEIVp0icjw] update_mapping [doc]",
    "@timestamp" => 2018-10-03T08:06:50.560Z,
      "@version" => "1",
          "host" => "system5.example.com",
          "path" => "/usr/local/es-6.4/logs/elasticsearch.log"
}
```

## Logstash 常用插件

默认的 Logstash 安装包括 Beats 输入插件。 Beats 输入插件使 Logstash 能够从 Elastic Beats 框架接收事件，任何与 Beats 框架一起使用的 Beat（如 Packetbeat 和 Metricbeat），也可以将事件数据发送到 Logstash。

- `Grok`：是 Logstash 过滤器的基础，用于从非结构化数据中获取结构，具有丰富的集成模式，能快速处理 Web，系统，网络和其他类型的事件格式。
- `Codecs`：通常用于简化对 JSON 和多行事件等常见事件结构的处理。

## Kibana

Kibana 是一个开源分析和可视化平台，旨在与 Elasticsearch 协同工作。可使用 Kibana 搜索，查看以及与存储在 Elasticsearch 索引中的数据进行交互，可以轻松地执行高级数据分析，并在各种图表（charts），表格（tables）和地图（maps）中可视化数据。

Kibana 是基于 JS 的 WEB 界面，在 Node.js 上运行，而官方在 Kibana 包中包含了必要的 Node.js 二进制文件，并且不支持针对单独维护的 Node.js 版本运行 Kibana，因此不需要单独搭建 Nodejs 环境。

应将 Kibana 配置为针对相同版本的 Elasticsearch 节点运行，即版本要一致。

注：从 V6.0.0 开始，Kibana 仅支持 64 位操作系统。

## Kibana 安装

下载 Kibana 包，版本为 6.4.1，解压到`/usr/local/kibana6.4`

kibana 需要 elasticsearch 的开启才能正常使用，否则启动 kibana 会不断报错，进入 Kibana 后也会提示 status 为 red，无法正常使用，因此需要先启动 elasticsearch。开启后，进入 kibana 目录下`bin`执行`kibana`命令。需要等待一段时间直到出现信息`[info][listening][server][http] Server running at http://localhost:5601`。通过浏览器`localhost:5601`访问 kibana。

注：内存或 CPU 不足会将 Elasticsearch 杀死，Kibana 也就无法启动

Kibana 的文件结构：除了`bin`、`config`、`data`、`plugins`，kibana 还有以下目录：

- `node`：
- `node_modules`
- `optimize`：存放透明的源代码。某些管理操作（例如，插件安装）导致源代码在运行中被重新传输。
- `src`
- `webpackShims`

可在浏览器访问`localhost:5601/status`查看 kibana 是否启动正常，插件是否加载正常，以及 kibana 的当前信息。

## Kibana 配置

Kibana 只有一个配置文件`KIBANA_HOME/config/kibana.yml`。默认运行在 localhost 的 5601 端口。

常见配置：

```
server.port: 5601          #Kibana服务端口
server.host: "localhost"   #向哪些主机开放端口，若要所有主机都能访问，即客户端能远程访问，需要设为0.0.0.0
server.name: "your-hostname" #Kibana实例名，一般为主机名
server.basePath: ""        #
server.maxPayloadBytes: 1048576
server.rewriteBasePath: false

elasticsearch.url: "http://localhost:9200"  #Elasticsearch的地址，需要设置正确
elasticsearch.preserveHost: true
kibana.index: ".kibana"
kibana.defaultAppId: "home"
#elasticsearch.username: "user"           #设置es授权用户名
#elasticsearch.password: "pass"           #设置es授权用户密码
#server.ssl.enabled: false                #是否开启ssl
#server.ssl.certificate: /path/to/your/server.crt
#server.ssl.key: /path/to/your/server.key
#elasticsearch.ssl.certificate: /path/to/your/client.crt
#elasticsearch.ssl.key: /path/to/your/client.key
```

## Kibana 基本功能

### 添加 index 的管理

首先要在 elasticsearch 添加 index 数据

```
curl -X PUT -H "Content-Type: application/json" localhost:9200/tech/employee/1 -d '
{
  "name": "zhangsan",
  "age": "25",
  "address": "nanjing",
  "hobby": [ "football", "tennis", "game" ]
}'
```

然后刷新 kibana，进入 Management 中的 Kibana，选 Index pattern，并创建。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290244380.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290244292.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290244348.png)

创建完成后，进入 Discover 菜单，可查看插入的数据

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290245798.png)

### 使用 kibana 提供的数据进行分析

从[kibana 文档](https://www.elastic.co/guide/en/kibana/current/tutorial-load-dataset.html)中下载数据，可选择银行账户数据 account.json，
下载后通过以下操作导入 elasticsearch。开启 kibana，进入 Management 添加 index pattern，然后进入 Discover 菜单，选择 bank，添加要看的字段。

```
curl -H 'Content-Type: application/x-ndjson' -XPOST 'localhost:9200/bank/account/_bulk?pretty' --data-binary @accounts.json
```

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290245453.png)

为数据创建报表，进入 Visualize 菜单，可根据需要选择报表形式，此处选 Pie 饼图，然后再选择 bank 即可进入定制界面。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290245590.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290245324.png)

选择 split slices，然后在聚合（aggregation）中选择 range，然后进行自定义数据范围

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290246237.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206290246537.png)

## ELK 架构

若环境的内存少，就在 es 配置文件添加以下配置

bootstrap.memory_lock: false 为避免内存与磁盘间的 swap，会损耗大量性能

bootstrap.system_call_filter: false

> 参考文章
>
> [全文搜索引擎 Elasticsearch 入门教程](http://www.ruanyifeng.com/blog/2017/08/elasticsearch.html)
>
> 每天 5 分中玩转 docker 容器技术
>
> [Elasticsearch: 权威指南](https://elasticsearch.cn/book/elasticsearch_definitive_guide_2.x/index.html)
>
> [Elasticsearch 官方文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/getting-started.html)
>
> [Logstash 简单介绍](https://blog.csdn.net/chenleiking/article/details/73563930)
>
> [ELK 之 Logstash](https://blog.csdn.net/iguyue/article/details/77006201)
>
> [Logstash 官方文档](https://www.elastic.co/guide/en/logstash/current/index.html)
>
> [ES 之五：ElasticSearch 聚合](https://www.cnblogs.com/duanxz/p/6528161.html)

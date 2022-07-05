---
title: Consul-Template使用
tags: [consul, consul-template]
date: 2022-07-05 22:28:03
categories: [自动化运维]
comments: false
---

<!--more-->

Consul-Template工具提供了一种编程方法，用于呈现来自各种位置(包括Consul KV)的配置文件。它是替换经常需要自定义格式的复杂API查询的理想选择。模板工具基于Go模板，并具有许多相同的属性。

Consul-Template主要有两种作用：
- 更新配置文件。Consul模板工具可用于更新业务配置文件。例如用于管理需要在动态基础设施中定期更新的负载均衡配置文件。
- 发现Consul数据中心和服务的数据。可以在Consul数据中心收集有关服务的信息。例如，可以收集数据中心上运行的所有服务的列表，或者可以发现Redis服务的所有服务地址。

# 部署
需要先部署Consul，用作配置的前端

> 下载地址：https://github.com/hashicorp/consul/tags

解压完就是一个`consul`命令，可以放到`/usr/sbin`等`PATH`路径下。

启动consul前需要先创建consul的数据和配置目录，这里就直接都放在`/data/consul`目录下，数据目录是`data`，配置目录是`consul.d`
```
/data/consul/
├── consul.d
├── data
```
然后启动consul，建议用supervisor管理
```ini
# cat /etc/supervisord.d/consul.ini
[program:consul]
command=consul agent -server -bootstrap-expect 1 -bind=主机IP -client=0.0.0.0 -data-dir=/data/consul/data -node=consul -config-dir=/data/consul/consul.d -ui
redirect_stderr=true
stdout_logfile=/data/logs/consul.log
autostart=true
autorestart=true
startsecs=10
```

准备部署consul-template，首先下载包，也是解压完也是一个命令`consul-template`，放到`PATH`路径下

> 下载地址：https://github.com/hashicorp/consul-template/tags

创建配置目录`templates`，放在`/data/consul`下
```
/data/consul/
├── consul.d
├── data
└── templates
```
在`templates`中创建主配置文件`consul-template.conf`
```conf
log_level = "warn"
syslog {
  enabled = true
  facility = "LOCAL5"
}

consul {
  address = "localhost:8500"
  retry {
    enabled = true
    attempts = 12
    backoff = "250ms"
    #max_backoff = "3ms"
    }
}

template {
  source = "/data/consul/templates/模板文件.ctmpl"
  destination = "生成文件的路径"
  command = ""
  backup = true
  command_timeout = "60s"
  left_delimiter = "{$"
  right_delimiter = "$}"
  wait {
    min = "2s"
    max = "20s"
  }
}
```
举例，配置中template块的内容如下
```
template {
  source = "/data/consul/templates/app.ctmpl"
  destination = "/data/app_config"
  command = ""
  backup = true
  command_timeout = "60s"
  left_delimiter = "{$"
  right_delimiter = "$}"
  wait {
    min = "2s"
    max = "20s"
  }
}
```
则表示按照`/data/consul/templates/app.ctmpl`配置中的模板去生成文件，生成的文件为`/data/app_config`

继续在`templates`目录中创建模板文件，如案例中的`/data/consul/templates/app.ctmpl`，指定consul结构树中的名称，consul-template会根据这个路径去consul中找该目录下的配置，再生成配置
```
{$ range tree "app" $}
{$ .Value $}
{$ end $}
```
例如这边写了app这个目录，则需要在consul中创建这个树目录节点。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202207052350704.png)

创建app这个目录，若是目录需要以`/`结尾
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202207052350195.png)

创建完目录节点后，就可以进这个目录创建真正的配置文件了。例如，在app1这个文件中写入一个json数据。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202207052352996.png)

重启consul-template进程，即可在指定位置看到生成的文件
```
# cat /data/app_config

{
    "name": "app1"
}
```
只要不修改`templates`目录中的配置，就不需要重启consul-template进程。之后修改配置都可以直接在consul的网页界面中配置，会自动同步到服务器上。

如果在app目录节点下再创建一个文件，叫`app2`，同样写入一个json数据

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202207060001369.png)

则此时查看配置文件就能发现，多了一条app2中的配置。
```
# cat /data/app_config

{
  "name": "app1"
}

{
  "name": "app2"
}
```


---
title: Docker Compose学习笔记
date: 2018-07-30 17:32:29
tags: [docker, docker-compose, 云计算, 容器编排]
categories: [云计算]
---

环境：docker：18.06.1，docker-compose：1.22.0

docker18.06 对应的 Compose 文件格式版本为 3.7

本篇包含以下内容：

- [docker-compose 介绍](#docker-compose介绍)
- [Compose 文件格式](#Compose文件格式)
- [docker-compose 示例](#docker-compose示例)

<!-- more -->

# docker-compose 介绍

`Docker Compose`是一个编排多容器分布式部署的工具，提供命令集管理容器化应用的完整开发周期，包括服务构建，启动和停止。在配置文件中，所有的容器通过 services 来定义，然后使用 docker-compose 脚本来启动，停止和重启应用，和应用中的服务以及所有依赖服务的容器。

**Compose 的特性**

- 通过项目名称将单个主机隔离成多个环境，能将应用环境复制多份，还能防止使用相同名称的服务的应用间的干扰
- 能够保护卷中的数据，如果 Compose 发现存在之前运行过的容器，它会把旧容器中的数据卷拷贝到新的容器中
- 只会重新创建改变过的容器，Compose 会缓存用于创建容器的配置信息，当你重启服务时，如果服务没有被更改，Compose 就会重用已经存在的容器，加快了修改应用的速度

**编排：**Orchestration，根据被部署的对象间的耦合关系以及被部署对象对环境的依赖，制定部署流程中各个动作的执行顺序，部署过程中所需要的依赖文件和被部署文件的存储位置和获取方式，以及如何验证部署成功。这些信息都会在编排工具中以制定格式定义并保存。

**部署：**Deployment，按照编排所指定的内容和流程，在目标机器上执行编排指定环境初始化，存放指定的依赖和文件，运行指定的部署动作，按照编排中规则确认是否部署成功。

> 以上编排和部署定义摘选自《docker 容器与容器云》

**docker-compose 安装**

使用 pip 快速安装`pip install docker-compose`
或通过 compose 的 github 库按提示安装[docker-compose 的 github](https://github.com/docker/compose/releases)

```
curl -L https://github.com/docker/compose/releases/download/1.22.0/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

docker-compose 参数选项：

```
docker-compose [-f <arg>...] [options] [COMMAND] [ARGS...]
  -f, --file FILE             指定compose文件，默认为docker-compose.yml
  -p, --project-name NAME     指定项目名，默认为所在目录名
  --verbose                   显示详细过程信息
  --log-level LEVEL           设置日志级别(DEBUG, INFO, WARNING, ERROR, CRITICAL)
  --no-ansi                   不打印ANSI控制字符
  -H, --host HOST             指定要连接的主机

  --tls                       使用tls，就是指--tlsverify
  --tlscacert CA_PATH         指定只承认该CA颁发的证书
  --tlscert CLIENT_CERT_PATH  TLS证书路径
  --tlskey TLS_KEY_PATH       TLS密钥路径
  --tlsverify                 使用TLS
  --skip-hostname-check       不根据客户端证书中指定的名称检查守护程序的主机名
  --project-directory PATH    指定工作目录，默认为compose文件所在目录
  --compatibility             Compose将尝试将v3文件中的部署密钥转换为其非Swarm等效项
```

**docker-compose 命令：**

- **`build`**：构建或重构服务（services）

  ```
  build [options] [--build-arg key=val...] [SERVICE...]
      --compress              使用gzip压缩构建上下文
      --force-rm              始终移除中间容器
      --no-cache              构建镜像时不使用缓存
      --pull                  总是尝试拉取最新镜像
      -m, --memory MEM        设置构建镜像的内存上限
      --build-arg key=val     设置服务的构建时变量
  ```

- **`bundle`**：从 Compose 文件生成 Docker 包

  镜像必须存储摘要，这需要与 Docker Registry 进行交互。如果没有为所有镜像存储摘要，可以使用`docker-compose pull`或`docker-compose push`来获取。

  ```
  bundle [options]
      --push-images              在打包时自动推送已使用build指定的服务的镜像
      -o, --output PATH          包文件路径，默认为"项目名.dab"
  ```

- **`config`**：校验并查看 compose 文件

  ```
  config [options]
      --resolve-image-digests  将镜像标签写入摘要
      -q, --quiet              静默模式，只校验配置，不打印信息
      --services               列出所有服务
      --volumes                列出所有数据卷
  ```

- **`down`**：停止并删除容器、网络、镜像、数据卷

  默认能删除的内容：

  - Compose 文件中定义的服务的容器
  - Compose 文件的`networks`中定义的网络
  - 默认网络（如果使用）

  ```
  down [options]
      --rmi type              删除镜像，必须指定类型：
                                'all': 删除任何服务使用的所有镜像
                                'local': 只删除没有通过image指定自定义标签的镜像
      -v, --volumes           删除在Compose文件的"volumes"中声明的命名卷和附加到容器的匿名卷。
      --remove-orphans        为服务删除没有在compose文件中声明的容器
      -t, --timeout TIMEOUT   指定几秒后关闭（默认10s）
  ```

- **`events`**：从容器接收实时事件

  ```
  events [options] [SERVICE...]
      --json      使用json格式输出事件
  ```

- **`exec`**：在运行的容器中执行命令

  ```
  exec [options] [-e KEY=VAL...] SERVICE COMMAND [ARGS...]
      -d, --detach      后台运行命令
      --privileged      给进程额外的权限
      -u, --user USER   指定运行命令的用户
      -T                禁止分配伪终端，exec默认分配一个伪终端
      --index=index     设置容器的索引（如果一个服务有多个容器），默认为1
      -e, --env KEY=VAL 设置环境变量
      -w, --workdir DIR 设置工作目录
  ```

- **`images`**：列出镜像

  ```
  images [options] [SERVICE...]
      -q, --quiet  静默模式，只显示镜像号
  ```

- **`kill`**：杀死容器

  ```
  kill [options] [SERVICE...]
      -s SIGNAL         发送给容器的SIGNAL，默认为SIGKILL
  ```

- **`logs`**：显示容器的输出

  ```
  logs [options] [SERVICE...]
      --no-color          单色输出
      -f, --follow        按照日志输出
      -t, --timestamps    显示时间戳
      --tail="all"        显示日志的末尾行数
  ```

- **`pause`**：暂停服务

  ```
  pause [SERVICE...]
  ```

- **`ps`**：列出容器，执行此命令时必须`cd`到项目的根目录下

  ```
  ps [options] [SERVICE...]
      -q, --quiet          静默，只显示容器号
      --services           显示服务
      --filter KEY=VAL     根据属性过滤服务
  ```

- **`port`**：显示用于绑定的公共端口

  ```
  port [options] SERVICE PRIVATE_PORT
      --protocol=proto  选择协议，tcp或udp，默认tcp
      --index=index     设置容器的索引，默认为1
  ```

- **`pull`**：拉取服务镜像

  ```
  pull [options] [SERVICE...]
      --ignore-pull-failures  忽略拉取失败的镜像
      --parallel              并行拉取多个镜像，默认开启，官方不推荐
      --no-parallel           禁止并行拉取多个镜像
      -q, --quiet             静默模式，不显示拉取信息
      --include-deps          同时拉取依赖的服务
  ```

- **`push`**：推送服务镜像

  ```
  push [options] [SERVICE...]
      --ignore-push-failures  忽略推送失败的镜像
  ```

- **`restart`**：重启服务

  ```
  restart [options] [SERVICE...]
    -t, --timeout TIMEOUT      指定几秒后重启（默认10s）
  ```

- **`rm`**：删除停止的容器

  ```
  rm [options] [SERVICE...]
      -f, --force   不询问确认删除
      -s, --stop    在删除前自动停止容器
      -v            删除任何关联的匿名数据卷，默认不会删除
  ```

- **`run`**：运行一次性命令

  ```
  run [options] [-v VOLUME...] [-p PORT...] [-e KEY=VAL...] [-l KEY=VALUE...] SERVICE [COMMAND] [ARGS...]
      -d, --detach          后台运行
      --name NAME           设置容器名
      --entrypoint CMD      覆盖容器的ENTRYPOINT
      -e KEY=VAL            设置环境变量
      -l, --label KEY=VAL   添加或覆盖标签
      -u, --user=""         以指定用户执行，可设置用户名或uid
      --no-deps             不启动相连的服务，默认依赖的服务也会启动
      --rm                  在运行后删除容器，不与-d兼容
      -p, --publish=[]      发布公共端口
      --service-ports       通过已启用并映射到主机的端口执行命令
      --use-aliases         在容器连接的网络中使用服务的网络别名
      -v, --volume=[]       Bind mount挂载一个数据卷
      -T                    禁止分配伪终端（tty），默认run会分配一个
      -w, --workdir=""      容器中的工作目录
  ```

- **`start`**：启动已存在的容器

  ```
  start [SERVICE...]
  ```

- **`stop`**：停止运行中的容器，并不会删除它们

  ```
  stop [options] [SERVICE...]
    -t, --timeout TIMEOUT      指定几秒后关闭（默认10s）
  ```

- **`top`**：显示服务的进程

  ```
  top [SERVICE...]
  ```

- **`unpause`**：恢复暂停的服务

  ```
  unpause [SERVICE...]
  ```

- **`up`**：创建并启动容器

  默认会启动相连的服务。

  ```
  up [options] [--scale SERVICE=NUM...] [SERVICE...]
      -d, --detach               后台运行。与--abort-on-container-exit不兼容
      --no-color                 单色输出
      --quiet-pull               静默拉取
      --no-deps                  不启动连接的服务
      --force-recreate           强制重建服务（即使配置和镜像都没变）
      --always-recreate-deps     重建依赖的服务，与--no-recreate不兼容
      --no-recreate              若容器存在就不会重建，与--force-recreate和-V不兼容
      --no-build                 即使镜像丢失也不重建镜像
      --no-start                 在构建服务后不启动该服务
      --build                    在启动容器前先构建镜像
      --abort-on-container-exit  如果任何容器停止，就停止所有容器，与-d不兼容
      -t, --timeout TIMEOUT      设置容器几秒后关闭（默认10s）
      -V, --renew-anon-volumes   重建匿名卷而不是从以前的容器中恢复数据。
      --remove-orphans           删除服务的compose文件中未定义的容器
      --exit-code-from SERVICE   返回指定服务的退出码 Implies --abort-on-container-exit.
      --scale SERVICE=NUM        将SERVICE扩展到NUM个实例。会覆盖Compose文件中的"scale"设置（如果存在）
  ```

# Compose 文件格式

Compose 文件采用 YAML，文件名以`.yml`或`.yaml`结尾，默认应存放在项目的根目录中，文件名应为`docker-compose.yml`。在 Compose 文件中无需再指定 Dockerfile 中已定义的项。

文件格式为 3.7，所以 compose 文件最开始要写上`version: "3"`

然后定义服务`services`，在`services:`下添加服务，开始对服务的配置。

`build`：用于指定在构建时应用的配置选项。

`context`：用于指定构建上下文。

`dockerfile`：用于指定 Dockerfile 文件

`args`：用于给 Dockerfile 文件中`ARG`定义的参数传参

```
version: "3"
services:
  webapp:
    build: ./dir     可以这样直接指定上下文路径

  webapp:
    build:           也可以作为具有在上下文中指定的路径的对象
      context: ./dir 然后通过context指定上下文路径
      当提供的值是相对路径时，context被解释为相对于Compose文件的位置。此目录也是发送到Docker daemon的构建上下文
    build:
      context: .
      dockerfile: webapp.dockerfile   还可以指定Dockerfile文件
      args:          可以为Dockerfile文件传参
        args1: 123
        args2: 345
      也可以这样表示：
      args:
      - args1=123
      - args2=345
    image: webapp:tag  可以指定构建镜像，会生成一个名为webapp，并打上tag标签的镜像
    在群集模式下使用Compose文件（版本3）部署堆栈时，将忽略image选项。 docker stack命令仅接受预先构建的图像。
```

> 注：YAML 布尔值（true，false，yes，no，on，off）必须用引号括起来，以便解析器将它们解释为字符串。

`cache_from`：指定 Docker 引擎用于实现缓存的镜像列表

`labels`：使用标签将元数据添加到生成的镜像中，可使用数组或字典

`shm_size`：为构建的容器设置`/dev/shm`分区的大小，指定字节数或字节值字符串，如`2mb`或`2000000`

`target`：根据 Dockerfile 中的定义构建指定的阶段

```
  build:
    context: .
    target: prod
```

`cap_add`和`cap_drop`：添加或删除容器功能

```
cap_add:
  - ALL

cap_drop:
  - NET_ADMIN
  - SYS_ADMIN
```

`command`：覆盖容器启动后默认执行的命令

```
command: bundle exec thin -p 3000
或使用列表表示：
command: ["bundle", "exec", "thin", "-p", "3000"]
```

`container_name`：自定义该容器名称。由于 Docker 容器名称必须是唯一的，因此如果指定了自定义名称，则无法将服务扩展到多个容器

`volumes`：卷挂载路径设置。格式：`宿主机源路径:容器目的路径[:访问权限]`，默认访问权限为读写。可使用相对路径，相对于 compose 文件所在目录。

`links`：链接到另一个服务中的容器，格式：`服务名[:别名]`

`external-links`：链接到 docker-compose.yml 外部的容器，甚至并非 Compose 管理的容器。

`expose`：暴露端口，但不映射到宿主机，只被连接的服务访问。最好使用字符串表示数字，因为 YAML 会解析`xx:yy`这种数字格式为 60 进制，容器端口小于 60 可能出错。

`ports`：暴露端口信息，格式：`[宿主机IP:][端口:]容器端口`，可用`-`表示一个端口范围

# docker-compose 示例

## 官方 wordpress 案例

只需要一个`docker-compose.yml`文件即可

```yaml
version: "3.3"

services:
  db:
    image: mysql:5.7
    volumes:
      - db_data:/var/lib/mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: wordpress
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wordpress

  wordpress:
    depends_on:
      - db
    image: wordpress:latest
    ports:
      - "8000:80"
    restart: always
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wordpress
      WORDPRESS_DB_NAME: wordpress
volumes:
  db_data: {}
```

然后通过 8000 端口访问。
命令`docker-compose down`删除容器和默认网络，但保留 WordPress 数据库。

命令`docker-compose down --volumes`删除容器，默认网络和 WordPress 数据库。

## 官方 Django 案例

配置 Dockerfile

```dockerfile
FROM python
ENV PYTHONUNBUFFERED 1
RUN mkdir /code
WORKDIR /code
COPY requirements.txt /code/
RUN pip install -r requirements.txt
COPY . /code/
```

配置 requirements.txt

```
Django>=2.0
psycopg2>=2.7
```

配置 compose 文件

```yaml
version: "3"

services:
  db:
    image: postgres
  web:
    build: .
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - .:/code
    ports:
      - "8000:8000"
    depends_on:
      - db
```

创建 Django 项目

```
docker-compose run web django-admin startproject djangoapp .
```

启动后，django 项目就创建完成了，当前目录就是 django 的根目录，编辑`settings.py`，修改数据库配置

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'postgres',
        'USER': 'postgres',
        'HOST': 'db',
        'PORT': 5432,
    }
}
```

同时根据 compose 文件中的暴露地址修改 settings 中的 `ALLOWED_HOSTS`

```python
ALLOWED_HOSTS = ['0.0.0.0']
```

然后`docker-compose up`启动，通过配置的 8000 端口访问

```
$ docker-compose ps
     Name                    Command               State           Ports
---------------------------------------------------------------------------------
djangoapp_db_1    docker-entrypoint.sh postgres    Up      5432/tcp
djangoapp_web_1   python manage.py runserver ...   Up      0.0.0.0:8000->8000/tcp


$ docker ps -a
CONTAINER ID        IMAGE               COMMAND                  CREATED             STATUS              PORTS                    NAMES
17743c2c1145        djangoapp_web       "python manage.py ru…"   10 minutes ago      Up 17 seconds       0.0.0.0:8000->8000/tcp   djangoapp_web_1
4a5e0f4f5559        postgres            "docker-entrypoint.s…"   43 minutes ago      Up 18 seconds       5432/tcp                 djangoapp_db_1

```

## 官方 Flask 案例

创建`app.py`

```python
import time

import redis
from flask import Flask

app = Flask(__name__)
cache = redis.Redis(host='redis', port=6379)


def get_hit_count():
    retries = 5
    while True:
        try:
            return cache.incr('hits')
        except redis.exceptions.ConnectionError as exc:
            if retries == 0:
                raise exc
            retries -= 1
            time.sleep(0.5)


@app.route('/')
def hello():
    count = get_hit_count()
    return 'Hello World! I have been seen {} times.\n'.format(count)
```

配置`requirements.txt`

```
flask
redis
```

创建 Dockerfile

```dockerfile
FROM python:3.7-alpine
WORKDIR /code
ENV FLASK_APP app.py
ENV FLASK_RUN_HOST 0.0.0.0
RUN apk add --no-cache gcc musl-dev linux-headers
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt
COPY . .
CMD ["flask", "run"]
```

创建 compose 文件

```yaml
version: "3"
services:
  web:
    build: .
    ports:
      - "5000:5000"
  redis:
    image: "redis:alpine"
```

然后`docker-compose up`启动即可，通过 5000 端口访问  
也可添加 volume，存储项目代码

```yaml
version: "3"
services:
  web:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - .:/code
    environment:
      FLASK_ENV: development
  redis:
    image: "redis:alpine"
```

**参考文章**

- [Docker 三剑客之 Compose-一](https://blog.csdn.net/vchy_zhao/article/details/70238413)
- [Docker 三剑客之 Compose-二](https://blog.csdn.net/vchy_zhao/article/details/70238432)
- [Docker 三剑客之 Compose-三](https://blog.csdn.net/vchy_zhao/article/details/70238461)
- [docker-compose 教程（安装，使用, 快速入门）](https://blog.csdn.net/pushiqiang/article/details/78682323)
- [docker-compose 官方文档](https://docs.docker.com/compose/)
- [Docker 系列之（五）：使用 Docker Compose 编排容器](https://www.cnblogs.com/ee900222/p/docker_5.html)

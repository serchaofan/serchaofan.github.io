---
title: Superset部署
tags: [Superset, 大数据]
categories: [大数据]
date: 2022-07-05 23:17:22
comments: false
---

下载superset仓库zip包到`/data/`下，解压后做软链接`superset -> superset-1.5.1`

进入superset下的docker/目录，创建requirements-local.txt文件，写入以下依赖。
```
clickhouse-sqlalchemy==0.1.4  # 如果不用clickhouse，则不用写
dataclasses
flask-appbuilder
```

修改`docker-compose-non-dev.yml`文件，将superset_app容器暴露的端口从8088换成80
```yaml
superset:
  env_file: docker/.env-non-dev
  image: *superset-image
  container_name: superset_app
  command: ["/app/docker/docker-bootstrap.sh", "app-gunicorn"]
  user: "root"
  restart: unless-stopped
  ports:
    - 80:8088
```

拉取镜像，需要指定TAG为superset版本，否则会拉取最新的开发镜像。
```
TAG=1.5.1 docker-compose -f docker-compose-non-dev.yml pull
```

启动容器
```
TAG=1.5.1 docker-compose -f docker-compose-non-dev.yml up -d
```

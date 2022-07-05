---
title: PrometheusExporter维护
tags: [Prometheus, exporter]
categories: [监控]
date: 2022-07-05 22:10:57
comments: false
---

<!--more-->

- node_expoter
- mysqld_exporter
- redis_exporter
- blackbox_exporter
- elasticsearch_exporter
- kafka_exporter
- rocketmq_exporter

# Node exporter

主要用于暴露 metrics 给 Prometheus，其中 metrics 包括：cpu 的负载，内存的使用情况，网络等。
下载安装：https://prometheus.io/download/#node_exporter
解压后将 node_exporter 放到`/usr/local/bin`中，然后执行。可通过浏览器访问 9100 端口`/metrics`查看

可创建 systemd 服务：

```
[Unit]
Description=node_exporter
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/node_exporter
Restart=on-failure
[Install]
WantedBy=multi-user.target
```

若在k8s集群内部署，则使用以下yaml文件
```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: monitor
spec:
  selector:
    matchLabels:
      name: node-exporter
  template:
    metadata:
      labels:
        name: node-exporter
    spec:
      hostPID: true
      hostIPC: true
      hostNetwork: true
      containers:
      - name: node-exporter
        image: prom/node-exporter:v1.3.1
        ports:
        - containerPort: 9101
        resources:
          requests:
            cpu: 0.15
        securityContext:
          privileged: true
        args:
        - --path.procfs
        - /host/proc
        - --path.sysfs
        - /host/sys
        - --collector.filesystem.ignored-mount-points
        - '"^/(sys|proc|dev|host|etc)($|/)"'
        volumeMounts:
        - name: dev
          mountPath: /host/dev
        - name: proc
          mountPath: /host/proc
        - name: sys
          mountPath: /host/sys
        - name: rootfs
          mountPath: /rootfs
      tolerations:
      - key: "node-role.kubernetes.io/master"
        operator: "Exists"
        effect: "NoSchedule"
      volumes:
        - name: proc
          hostPath:
            path: /proc
        - name: dev
          hostPath:
            path: /dev
        - name: sys
          hostPath:
            path: /sys
        - name: rootfs
          hostPath:
            path: /
```

# Mysqld Exporter

若指定环境变量`DATA_SOURCE_NAME="user:password@(hostname:3306)/"`，则启动命令可以不用写配置参数`--config.my-cnf=客户端配置路径`，否则，需要创建这个客户端配置文件，示例如下：
```ini
[client]
user=用户名
password=密码
port=端口
host=MySQL地址
```

使用supervisor管理
```ini
[program:mysql_exporter_xxx]
user=root
directory=/data/mysqld_exporter
DATA_SOURCE_NAME=用户名:密码@(IP地址:端口)/
command=/data/mysqld_exporter/mysqld_exporter --web.listen-address=:9401
autostart=true
autorestart=true
startsecs = 10
redirect_stderr=true
stdout_logfile=/data/logs/mysql_exporter_xxx.log
```
# Redis Exporter
> 下载地址：https://github.com/oliver006/redis_exporter/releases

使用supervisor管理
```ini
[program:redis_exporter_xxx]
command=/data/redis_exporter/redis_exporter  -redis.addr=主机IP:端口  -redis.password=密码  -web.listen-address 0.0.0.0:9210
directory=/data/redis_exporter
redirect_stderr=true
stdout_logfile=/data/logs/redis_exporter_xxx.log
autostart=true
autorestart=true
startsecs=10
```

k8s集群内部署yaml
```yaml
apiVersion: v1
kind: Service
metadata:
  annotations:
    prometheus.io/path: /metrics
    prometheus.io/port: "9121"
    prometheus.io/scrape: "true"
  name: redis-exporter
  namespace: dev
spec:
  selector:
    app: redis-exporter
  ports:
  - port: 9121
    targetPort: 9121
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-exporter
  namespace: dev
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis-exporter
  template:
    metadata:
      labels:
        app: redis-exporter
    spec:
      containers:
        - image: oliver006/redis_exporter
          imagePullPolicy: IfNotPresent
          name: redis-exporter
          env:
          - name: REDIS_ADDR
            value: "redis:6379"
          - name: REDIS_PASSWORD
            value: "xxxxxx"
          livenessProbe:
            httpGet:
              path: /metrics
              port: 9121
              scheme: HTTP
            failureThreshold: 3
            initialDelaySeconds: 5
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 2
          readinessProbe:
            httpGet:
              path: /metrics
              port: 9121
              scheme: HTTP
            failureThreshold: 3
            initialDelaySeconds: 5
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 2
          resources:
            limits:
              cpu: "100m"
              memory: "200Mi"
            requests:
              cpu: "100m"
              memory: "200Mi"

```

# Blackbox Exporter
> 下载地址：https://github.com/prometheus/blackbox_exporter/releases

使用supervisor管理
```ini
[program:blackbox_exporter]
command=/data/blackbox_exporter/blackbox-exporter --config.file=/data/blackbox_exporter/blackbox.yml --web.listen-address=":9115"
directory=/data/blackbox_exporter
redirect_stderr=true
stdout_logfile=/data/logs/blackbox_exporter.log
autostart=true
autorestart=true
startsecs=10
```

k8s集群内部署yaml
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: blackbox-exporter
  namespace: monitor
data:
  blackbox.yml: |-
    modules:
      http_2xx:
        prober: http
        timeout: 5s
        http:
          valid_http_versions: ["HTTP/1.1", "HTTP/2"]
          valid_status_codes: [200]
          method: GET
          preferred_ip_protocol: "ip4"
      http_post_2xx:
        prober: http
        timeout: 5s
        http:
          valid_http_versions: ["HTTP/1.1", "HTTP/2"]
          method: POST
          preferred_ip_protocol: "ip4"
      tcp_connect:
        prober: tcp
        timeout: 2s
      icmp:
        prober: icmp
        timeout: 2s
        icmp:
          preferred_ip_protocol: "ip4"

---
apiVersion:  apps/v1
kind: Deployment
metadata:
  name: blackbox-exporter
  namespace: monitor
spec:
  selector:
    matchLabels:
      app: blackbox-exporter
  replicas: 1
  template:
    metadata:
      labels:
        app: blackbox-exporter
    spec:
      restartPolicy: Always
      containers:
      - name: blackbox-exporter
        image: prom/blackbox-exporter:v0.19.0
        imagePullPolicy: IfNotPresent
        ports:
        - name: blackbox-port
          containerPort: 9115
        readinessProbe:
          tcpSocket:
            port: 9115
          initialDelaySeconds: 5
          timeoutSeconds: 5
        resources:
          requests:
            memory: 500Mi
            cpu: 200m
          limits:
            memory: 500Mi
            cpu: 200m
        volumeMounts:
        - name: config
          mountPath: /etc/blackbox_exporter
        args:
        - '--config.file=/etc/blackbox_exporter/blackbox.yml'
        - '--log.level=debug'
        - '--web.listen-address=:9115'
      volumes:
      - name: config
        configMap:
          name: blackbox-exporter
---
apiVersion: v1
kind: Service
metadata:
  annotations:
    prometheus.io/scrape: 'true'
  name: blackbox-exporter
  namespace: monitor

spec:
  selector:
    app: blackbox-exporter
  ports:
  - name: blackbox
    port: 9115
    targetPort: 9115
    protocol: TCP
```

# Elasticsearch Exporter
> 下载地址：https://github.com/prometheus-community/elasticsearch_exporter/releases

使用supervisor管理
```ini
[program:elasticsearch_exporter]
command=/data/elasticsearch_exporter/elasticsearch_exporter --es.uri=http://ES账号:ES密码@ES地址:端口 --es.all --web.listen-address=":9122"
directory=/data/elasticsearch_exporter
redirect_stderr=true
stdout_logfile=/data/logs/elasticsearch_exporter.log
autostart=true
autorestart=true
startsecs=10
```

# Kafka Exporter
> 下载地址：https://github.com/danielqsj/kafka_exporter/releases

使用supervisor管理
```ini
[program:kafka_exporter]
command=/data/kafka_exporter/kafka_exporter --kafka.server=服务器IP:9092 --kafka.server=服务器IP:9092 --web.listen-address=":9308"
directory=/data/kafka_exporter
redirect_stderr=true
stdout_logfile=/data/logs/kafka_exporter.log
autostart=true
autorestart=true
startsecs=10
```

k8s集群内部署yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name:  kafka-exporter
  namespace: monitor
spec:
  selector:
    matchLabels:
      app:  kafka-exporter
  template:
    metadata:
      labels:
        app:  kafka-exporter
    spec:
      containers:
      - name:  kafka-exporter
        image: registry.cn-hangzhou.aliyuncs.com/yaml/images:kafka-exporter-1.4.2
        args: ["--kafka.server=服务器IP:9092"]
        ports:
        - containerPort: 9308
          name: http
---
apiVersion: v1
kind: Service
metadata:
  annotations:
    prometheus.io/path: /metrics
    prometheus.io/port: "9308"
    prometheus.io/scrape: "true"
  name:  kafka-exporter
  namespace: monitor
spec:
  selector:
    app:  kafka-exporter
  ports:
  - port: 9308
    targetPort: 9308
```
# Rocketmq Exporter

k8s集群内部署yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rocketmq-exporter
  namespace: monitor
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rocketmq-exporter
  template:
    metadata:
      labels:
        app: rocketmq-exporter
    spec:
      containers:
      - env:
        - name: rocketmq.config.namesrvAddr
          value: rocketmq.default:9876
        - name: rocketmq.config.webTelemetryPath
          value: /metrics
        - name: server.port
          value: "5557"
        - name: rocketmq.config.rocketmqVersion
          value: V4_5_1
        image: lendea/rocketmq-exporter:0.2.0
        imagePullPolicy: Always
        name: rocketmq-exporter
        ports:
        - containerPort: 5557
          name: http
          protocol: TCP
      restartPolicy: Always
    
---
apiVersion: v1
kind: Service
metadata:
  annotations:
    prometheus.io/path: /metrics
    prometheus.io/port: "5557"
    prometheus.io/scrape: "true"
  name: rocketmq-exporter
  namespace: monitor
spec:
  ports:
  - name: metrics
    port: 5557
    protocol: TCP
    targetPort: 5557
  selector:
    app: rocketmq-exporter
```
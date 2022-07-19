---
title: Nacos
tags: [Nacos, Kubernetes]
categories: []
date: 2022-07-10 16:45:57
comments: false
---

<!--more-->

# K8S中部署Nacos集群
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nacos
  namespace: nacos-namespace
spec:
  selector:
    matchLabels:
      app: nacos
  serviceName: nacos-headless
  replicas: 3
  template:
    metadata:
      labels:
        app: nacos
      annotations:
        pod.alpha.kubernetes.io/initialized: "true"
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchExpressions:
                  - key: "app"
                    operator: In
                    values:
                      - nacos
              topologyKey: "kubernetes.io/hostname"

      containers:
      - env:
        - name: NACOS_REPLICAS
          value: "3"
        - name: NACOS_SERVER_PORT
          value: "8848"
        - name: NACOS_APPLICATION_PORT
          value: "8848"
        - name: PREFER_HOST_MODE
          value: hostname
        - name: MYSQL_SERVICE_HOST
          value: xx.xx.xx.xx
        - name: MYSQL_SERVICE_DB_NAME
          value: nacos_config
        - name: MYSQL_SERVICE_PORT
          value: "3306"
        - name: MYSQL_SERVICE_USER
          value: nacos
        - name: MYSQL_SERVICE_PASSWORD
          value: xxxxxxxx
        - name: PREFER_HOST_MODE
          value: "hostname"
        - name: NACOS_SERVERS
          value: "nacos-0.nacos-headless.nacos-namespace.svc.cluster.local.:8848 nacos-1.nacos-headless.nacos-namespace.svc.cluster.local.:8848 nacos-2.nacos-headless.nacos-namespace.svc.cluster.local.:8848"

        image: nacos/nacos-server:v2.0.3
        imagePullPolicy: IfNotPresent

        name: nacos
        ports:
          - containerPort: 8848
            name: http
            protocol: TCP
          - containerPort: 9848
            name: client-rpc
            protocol: TCP
          - containerPort: 9849
            name: raft-rpc
            protocol: TCP
          - containerPort: 7848
            name: old-raft-rpc
            protocol: TCP

        resources:
          limits:
            cpu: 2
            memory: 2Gi
          requests:
            cpu: 1
            memory: 2Gi
---
apiVersion: v1
kind: Service
metadata:
  name: nacos-headless
  namespace: nacos-namespace
spec:
  clusterIP: None
  ports:
  - name: http
    port: 8848
    protocol: TCP
    targetPort: 8848
  - name: client-rpc
    port: 9848
    protocol: TCP
    targetPort: 9848
  - name: raft-rpc
    port: 9849
    protocol: TCP
    targetPort: 9849
  - name: old-raft-rpc
    port: 7848
    protocol: TCP
    targetPort: 7848
  selector:
    app: nacos
---
apiVersion: v1
kind: Service
metadata:
  name: nacos
  namespace: nacos-namespace
spec:
  ports:
  - name: http
    port: 8848
    protocol: TCP
    targetPort: 8848
  - port: 9848
    name: client-rpc
    targetPort: 9848
  - port: 9849
    name: raft-rpc
    targetPort: 9849
  ## 兼容1.4.x版本的选举端口
  - port: 7848
    name: old-raft-rpc
    targetPort: 7848
  selector:
    app: nacos
  type: ClusterIP
```
---
title: Java应用基础镜像维护
tags: [Java, Docker]
categories: [Java]
date: 2022-07-05 23:16:37
comments: false
---

目录结构
```
.
├── arthas           # Arthas问题分析工具
├── Dockerfile
├── entrypoint.sh    # 启动脚本
```

以下为Dockerfile
```dockerfile
FROM openjdk:8-jdk-buster
ADD ./entrypoint.sh /entrypoint.sh
ADD ./arthas /arthas
RUN ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo Asia/Shanghai > /etc/timezone && \
    chmod +x /entrypoint.sh
```

以下为`entrypoint.sh`启动脚本
```bash
#!/bin/bash

if [ -n "$JVM_PARAM" ];    # 添加JVM_PARAM环境变量，使java服务能修改JVM参数
then
  JVM_OPTS=$JVM_PARAM
  echo "JVM_OPTS: $JVM_OPTS"
else
  JVM_OPTS="-server -Xms2048m -Xmx2048m -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=512m"
  echo "JVM_OPTS: $JVM_OPTS"
fi


JAVA_OPTS="$JVM_OPTS -XX:+HeapDumpOnOutOfMemoryError -XX:+PrintGCDateStamps -Xloggc:/logs/gc.log"
JAVA_OPTS="$JAVA_OPTS -XX:+PrintGCDetails -XX:+UseParallelGC -XX:+UseParallelOldGC"
JAVA_OPTS="$JAVA_OPTS -Djava.security.egd=file:/dev/./urandom"
AGENT_OPTS="-javaagent:/xxx/xxx.jar"     # 可以指定javaagent，前提是Dockerfile中将agent的jar包复制进容器

echo -e "\033[32m
===============================================
`env | grep -Ev 'PASSWORD|_TCP|_PORT_'`
JAVA_OPTS: ${JAVA_OPTS}
AGENT_OPTS: ${AGENT_OPTS}
===============================================
\033[0m"

if [ "true" == "$AGENT_ENABLED" ];then
    java $JAVA_OPTS ${AGENT_OPTS} -jar /app.jar
else
    java $JAVA_OPTS -jar /app.jar      # 后续构建镜像都是将服务jar包放在根目录，并命名为app.jar
fi
```

构建应用镜像的Dockerfile中最后一行只要为以下内容即可。
```dockerfile
ENTRYPOINT [ "/entrypoint.sh" ]
```
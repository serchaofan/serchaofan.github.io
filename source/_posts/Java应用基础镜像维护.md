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

以下为 Dockerfile（JDK 17 基础镜像）

> 原 `openjdk:8-jdk-buster` 已从 Docker Hub 下架，现改为仍在维护的 `eclipse-temurin:17-jdk-jammy`；`ADD` 也改成语义更明确的 `COPY`。

```dockerfile
FROM eclipse-temurin:17-jdk-jammy
COPY ./entrypoint.sh /entrypoint.sh
COPY ./arthas /arthas
RUN ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo Asia/Shanghai > /etc/timezone && \
    mkdir -p /logs && \
    chmod +x /entrypoint.sh
```

以下为 `entrypoint.sh` 启动脚本（JDK 17）

```bash
#!/bin/bash

if [ -n "$JVM_PARAM" ]; then    # 添加 JVM_PARAM 环境变量，使 java 服务能修改 JVM 参数
  JVM_OPTS=$JVM_PARAM
  echo "JVM_OPTS: $JVM_OPTS"
else
  JVM_OPTS="-server -XX:MaxRAMPercentage=75.0 -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=256m"
  echo "JVM_OPTS: $JVM_OPTS"
fi

JAVA_OPTS="$JVM_OPTS -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/heapdump.hprof"
JAVA_OPTS="$JAVA_OPTS -Xlog:gc*:file=/logs/gc.log:time,uptime,level,tags:filecount=5,filesize=50m"
JAVA_OPTS="$JAVA_OPTS -Djava.security.egd=file:/dev/./urandom"
AGENT_OPTS="-javaagent:/xxx/xxx.jar"     # 可以指定 javaagent，前提是 Dockerfile 中将 agent 的 jar 包复制进容器

echo -e "\033[32m
===============================================
`env | grep -Ev 'PASSWORD|_TCP|_PORT_'`
JAVA_OPTS: ${JAVA_OPTS}
AGENT_OPTS: ${AGENT_OPTS}
===============================================
\033[0m"

if [ "true" == "$AGENT_ENABLED" ]; then
    java $JAVA_OPTS ${AGENT_OPTS} -jar /app.jar
else
    java $JAVA_OPTS -jar /app.jar      # 后续构建镜像都是将服务 jar 包放在根目录，并命名为 app.jar
fi
```

构建应用镜像的 Dockerfile 中最后一行只要为以下内容即可。

```dockerfile
ENTRYPOINT [ "/entrypoint.sh" ]
```

## 容器内存与 JVM

JDK 17 默认开启 `-XX:+UseContainerSupport`，会按 cgroup 限额计算堆大小，并原生支持 cgroup v2（JDK 15 起）。早期脚本把 `-Xms/-Xmx` 写死为 2048m，带来的问题是：容器限额调大后 JVM 用不上；限额调小后堆本身就占满限额，还没等堆满就被内核杀掉。

改用百分比时，必须**删掉 `-Xms/-Xmx`**，否则百分比参数不生效：

```bash
JVM_OPTS="-server -XX:MaxRAMPercentage=75.0 \
  -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=256m"
```

- 百分比只在未设置 `-Xms/-Xmx` 时生效（`-Xmx` 覆盖 `MaxRAMPercentage`，`-Xms` 覆盖 `InitialRAMPercentage`）；`-XX:MaxRAM` 不失效，但会改变百分比的计算基数；没有 cgroup 限额时会按宿主机内存计算
- `InitialRAMPercentage` 默认只有 1.5625，调大意味着启动即提交更多内存，多实例部署时容易互相挤压，一般不必调
- 堆只是容器内存的一部分，还要给 Metaspace、线程栈（默认约 1MB/线程）、Direct Buffer、Code Cache、GC 结构、JIT、mmap 的 jar/JNI 和 page cache 留余量，所以 `MaxRAMPercentage` 一般不超过 75%
- 未设置 `-XX:MaxDirectMemorySize` 时，Direct Memory 上限等于最大堆，是“75% 仍不够”的常见原因；限额小于 1GiB 时建议直接写绝对值（`-Xmx` + `-XX:MaxDirectMemorySize`），不要用百分比

两种 OOM 要区分开：

- JVM 堆溢出：抛 `java.lang.OutOfMemoryError`。默认不退出，业务线程可能继续处理请求；开启 `-XX:+ExitOnOutOfMemoryError` 会退出（JDK 17 下实测退出码为 3，不是 1），`-XX:+CrashOnOutOfMemoryError` 则是 abort（退出码 134）
- 容器内存超限：被内核 OOM killer 杀死，退出码 **137**（128 + SIGKILL），JVM 来不及打印日志。但 137 也可能是 `docker stop` 超时或 `docker kill`，需要交叉验证

确认容器是否因 OOM 被杀：

```bash
docker inspect -f '{{.State.OOMKilled}}' <容器>
# Kubernetes: kubectl describe pod 看 Reason: OOMKilled
# cgroup v2: cat /sys/fs/cgroup/memory.events | grep oom_kill
# 宿主机: dmesg -T | grep -i 'killed process'
```

需要保留堆现场时加 `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/heapdump.hprof`。默认 dump 写到进程工作目录（Docker 下通常是 `/`），非 root 用户写不进去；dump 大小约等于堆大小，目录要挂载到卷上，多实例不要写同名文件。

排查堆外内存可加 `-XX:NativeMemoryTracking=summary`（必须启动时加，有额外开销），再执行：

```bash
jcmd <pid> VM.native_memory baseline
# 复现问题后
jcmd <pid> VM.native_memory summary.diff scale=MB
```

若仍需维护 JDK 8/11 镜像：上游对 cgroup v2 的支持从 JDK 15 开始，11u 从 11.0.16、8u 从 8u372 回移。低于这些版本时 JVM 只认 cgroup v1，在 cgroup v2 宿主机上会退回按宿主机内存计算默认堆（约物理内存 1/4），可能直接超出容器限额，此时应显式写 `-Xmx`。

## 多阶段构建

基础镜像用 JDK 会把整套编译工具带进运行环境，体积大且攻击面广。推荐把构建和运行拆成两个阶段，运行阶段只保留 JRE 和产物：

```dockerfile
FROM maven:3.9.16-eclipse-temurin-17 AS builder
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline || true
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:17-jre-jammy
ENV TZ=Asia/Shanghai
RUN groupadd -r -g 10001 app && useradd -r -u 10001 -g app -m -d /home/app app \
    && mkdir -p /logs && chown -R app:app /logs
COPY --from=builder /src/target/app.jar /app.jar
COPY --chown=app:app entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER 10001:10001
ENTRYPOINT [ "/entrypoint.sh" ]
```

前置条件：pom 中把产物名固定为 `app`，否则 `mvn package` 生成的是 `${artifactId}-${version}.jar`，上面的 `COPY` 会失败：

```xml
<build>
  <finalName>app</finalName>
</build>
```

几个细节：

- JDK 17 已移除 `-XX:+PrintGCDateStamps`、`-XX:+UseParallelOldGC`，旧版 Java 8 的 entrypoint 直接跑会报 `Unrecognized VM option` 启动失败，必须使用本文的 JDK 17 脚本
- 从 Java 8 升级到 17 需要单独回归（Spring Boot 2.x/3.x、`javax`→`jakarta`、反射与字节码兼容性），不能当作等价替换
- 先拷 `pom.xml` 再拷源码，可以复用依赖下载这一层缓存；但 `dependency:go-offline` 并不能保证下载全部插件依赖，`package` 阶段仍可能联网。更稳的是 BuildKit 缓存挂载（需 Docker 20.10+ 且启用 BuildKit）：`RUN --mount=type=cache,target=/root/.m2 mvn -B -q -DskipTests package`
- 多模块工程要拷贝所有模块的 pom，只拷父 pom 会构建失败
- `COPY` 优先于 `ADD`，`ADD` 的自动解压和远程下载行为容易产生意外
- 基础镜像固定到具体 tag 或 digest，避免滚动 tag 漂移；定期用 Trivy 等工具扫描
- 日志、dump 等需要写入的目录挂载为卷；容器 rootfs 可设为只读

## 非 root 运行

上面用固定 UID/GID 的 `USER 10001:10001`。用 `USER app` 这种字符串形式时，Kubernetes 的 `securityContext.runAsNonRoot: true` 无法校验，会报 `container has runAsNonRoot and image has non-numeric user (app), cannot verify user is non-root`。

还需要注意：

- 低端口：优先改用 8080 等高位端口。Docker 20.10+ 在私有 netns 中默认把 `net.ipv4.ip_unprivileged_port_start` 设为 0，非 root 通常可直接绑定低位端口；K8s/containerd 需按运行时确认。仅加 `--cap-add=NET_BIND_SERVICE` 对非 root 用户未必生效，必要时用 `setcap` 或显式 sysctl
- 挂载目录的属组/权限要与运行用户匹配；K8s 可用 `fsGroup`（设置卷的属组，仅对支持该语义的卷生效）
- `groupadd/useradd` 来自 shadow-utils，Debian/Ubuntu/RHEL 等都有；alpine 用 BusyBox 的 `addgroup/adduser`
- entrypoint 中不要依赖 root 才能执行的命令（如改系统时间、装包）
- 需要绑定特权能力时，用 `--cap-add` 精确添加，而不是直接 `--privileged`
- K8s 中可配合 `readOnlyRootFilesystem: true`、`allowPrivilegeEscalation: false`、`capabilities.drop: ["ALL"]`

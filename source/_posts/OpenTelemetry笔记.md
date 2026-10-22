---
title: OpenTelemetry笔记
date: 2026-10-23 18:00:00
tags: [OpenTelemetry, 可观测性, Java, 分布式追踪, 监控]
categories: [监控]
comments: false
---

OpenTelemetry（简称 OTel）是 CNCF 的可观测性标准，统一了 Traces、Metrics、Logs 等遥测数据的采集、处理和导出方式。它不是一个新的监控后端，而是一套 API、SDK、协议和 Collector 生态，让应用只埋点一次，就能把数据送到任意兼容的后端。

本文基于 OpenTelemetry 官方最新文档整理，先讲清概念和架构，再以 Java 为例，完整说明 SDK 初始化、Tracing、Metrics、Logs、Context、Sampling、Collector、Spring Boot 集成和生产实践。

> 版本说明：文中 Java SDK 示例以 OpenTelemetry Java 1.67.x 为主线，Java Agent/Instrumentation 2.x 为例。实际项目请以 Maven Central 和官方文档的最新稳定版为准。

<!-- more -->

- [OpenTelemetry 是什么](#opentelemetry-%E6%98%AF%E4%BB%80%E4%B9%88)
- [核心概念](#%E6%A0%B8%E5%BF%83%E6%A6%82%E5%BF%B5)
- [架构与数据流](#%E6%9E%B6%E6%9E%84%E4%B8%8E%E6%95%B0%E6%8D%AE%E6%B5%81)
- [Java 生态与依赖](#java-%E7%94%9F%E6%80%81%E4%B8%8E%E4%BE%9D%E8%B5%96)
- [快速开始：Java Agent](#%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8Bjava-agent)
- [手动初始化 SDK](#%E6%89%8B%E5%8A%A8%E5%88%9D%E5%A7%8B%E5%8C%96-sdk)
- [Tracing 实战](#tracing-%E5%AE%9E%E6%88%98)
- [Metrics 实战](#metrics-%E5%AE%9E%E6%88%98)
- [Logs 与日志关联](#logs-%E4%B8%8E%E6%97%A5%E5%BF%97%E5%85%B3%E8%81%94)
- [Context 与 Baggage](#context-%E4%B8%8E-baggage)
- [Sampling](#sampling)
- [Resource 与 Semantic Conventions](#resource-%E4%B8%8E-semantic-conventions)
- [Collector](#collector)
- [Spring Boot 实战](#spring-boot-%E5%AE%9E%E6%88%98)
- [生产实践](#%E7%94%9F%E4%BA%A7%E5%AE%9E%E8%B7%B5)
- [测试](#%E6%B5%8B%E8%AF%95)
- [常见坑](#%E5%B8%B8%E8%A7%81%E5%9D%91)
- [一次请求的完整链路](#%E4%B8%80%E6%AC%A1%E8%AF%B7%E6%B1%82%E7%9A%84%E5%AE%8C%E6%95%B4%E9%93%BE%E8%B7%AF)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# OpenTelemetry 是什么

## 定义

OpenTelemetry 是一套开源的、厂商中立的可观测性框架，提供：

- **统一的 API**：应用和库只依赖 API，不绑定具体厂商或后端。
- **多语言 SDK**：负责采样、批处理、资源、导出等实现。
- **自动埋点**：Java Agent、Spring Boot Starter、各类库的 instrumentation。
- **OTLP 协议**：统一的遥测数据传输协议（gRPC/HTTP + Protobuf）。
- **Collector**：接收、处理、路由、导出遥测数据的代理/网关。

它解决的核心问题是：**应用埋点与后端解耦**。今天用 Jaeger，明天换 Tempo；今天只看 Trace，明天加 Metrics/Logs，都不需要重写业务埋点。

## 三大信号

| 信号 | 回答的问题 | 典型数据 |
| ---- | ---------- | -------- |
| Traces | 一次请求经过了哪些服务、每一步耗时多少 | Span、TraceID、SpanID、父子关系、事件、状态 |
| Metrics | 系统整体趋势如何、是否超过阈值 | Counter、Gauge、Histogram、属性 |
| Logs | 某个时刻具体发生了什么 | 时间戳、级别、消息、属性、Trace 关联 |
| Baggage | 跨服务传递业务上下文 | 键值对，随请求传播 |
| Profiles | 性能瓶颈在哪个函数/栈 | 采样剖析数据（仍在演进） |

## OpenTelemetry 不是什么

- **不是监控后端**：不存储、不展示、不告警；这些由 Jaeger、Tempo、Prometheus、Loki、Grafana、商业 APM 等负责。
- **不是日志框架**：不替代 SLF4J/Logback/Log4j，而是把日志桥接到 OTel。
- **不是只做 Trace**：Metrics 和 Logs 也是一等公民。
- **不是零成本**：采样、属性基数、导出批量、Collector 资源都需要设计。

## 与 Prometheus、Grafana、Jaeger 的关系

```text
应用（OTel SDK/Agent）
        │ OTLP
        ▼
OTel Collector ──► Traces 后端（Jaeger/Tempo）
        ├───────► Metrics 后端（Prometheus/Mimir）
        └───────► Logs 后端（Loki/ELK）
```

- Prometheus 是指标存储/查询系统；OTel 可以通过 Collector 或 exporter 把指标送到 Prometheus。
- Grafana 是可视化层；可以查询 Prometheus、Tempo、Loki 等。
- Jaeger/Tempo 是追踪后端；接收 OTLP 或 Jaeger 格式。
- OTel 负责“产生和传输”，后端负责“存储和展示”。

# 核心概念

## Signals

OpenTelemetry 用 Signal 表示一类遥测数据：

- **Traces**：分布式追踪。
- **Metrics**：指标。
- **Logs**：日志。
- **Baggage**：跨服务上下文，不是独立的存储信号。
- **Profiles**：性能剖析，仍在发展阶段。

## API、SDK、Instrumentation

| 层 | 作用 | 谁使用 |
| -- | ---- | ------ |
| API | 定义 Tracer、Meter、Logger、Span、Context 等接口 | 业务代码、库作者 |
| SDK | API 的具体实现：采样、处理、导出、资源 | 应用启动时配置 |
| Instrumentation | 自动/手动埋点 | Agent、Starter、库、业务代码 |
| Collector | 接收、处理、导出遥测数据 | 运维/平台团队 |

关键原则：

- **库和框架只依赖 API**，不要打包 SDK。
- **应用负责初始化 SDK**，并且只初始化一次。
- **Agent 和手动 SDK 不要重复初始化**。
- 只引入 `opentelemetry-api` 而没有 SDK/Agent 时，API 是 no-op，不会产生任何数据。

## Resource

Resource 描述“遥测数据来自哪里”，是所有信号共享的元数据：

```text
service.name = order-service
service.version = 1.2.0
service.instance.id = order-service-7f9c
deployment.environment.name = prod
cloud.provider = aliyun
k8s.cluster.name = prod-cluster
k8s.namespace.name = order
```

Resource 应该统一配置到 TracerProvider、MeterProvider、LoggerProvider。

## Context

Context 是不可变的键值容器，用来在函数调用和线程之间隐式传递：

- 当前 Span 存在 Context 中，新建 Span 默认以当前 Span 为父。
- Baggage 存在 Context 中，随请求传播。
- Metrics 的 exemplar、Logs 的 trace 关联都依赖 Context。

## Semantic Conventions

Semantic Conventions（语义约定）是 OTel 定义的标准属性名，例如：

| 场景 | 属性 |
| ---- | ---- |
| 服务 | `service.name`、`service.version`、`service.instance.id` |
| 环境 | `deployment.environment.name` |
| HTTP 服务端 | `http.request.method`、`url.path`、`http.response.status_code`、`server.address` |
| HTTP 客户端 | `http.request.method`、`server.address`、`server.port` |
| 数据库 | `db.system.name`、`db.namespace`、`db.operation.name` |
| 消息 | `messaging.system`、`messaging.destination.name`、`messaging.operation` |
| 异常 | `exception.type`、`exception.message`、`exception.stacktrace` |

使用语义约定可以让 Dashboard、告警和后端自动识别数据，不要随意发明同名属性。

## OTLP

OTLP（OpenTelemetry Protocol）是 OTel 的标准传输协议：

- **gRPC**：默认端口 `4317`。
- **HTTP/Protobuf**：默认端口 `4318`，路径为 `/v1/traces`、`/v1/metrics`、`/v1/logs`。
- 数据使用 Protobuf 编码，支持 Traces、Metrics、Logs。
- Collector 的 `otlp` receiver 同时支持 gRPC 和 HTTP。

Java Agent 2.x 和 Spring Boot Starter 2.x 默认使用 `http/protobuf`，不是 gRPC。连接 4317 时要显式设置 `grpc`。

# 架构与数据流

## 典型链路

```text
┌─────────────────────────────────────────────────────┐
│ Application                                         │
│  OTel API + SDK / Java Agent / Spring Boot Starter  │
│  Traces + Metrics + Logs                            │
└───────────────────────┬─────────────────────────────┘
                        │ OTLP（gRPC 4317 / HTTP 4318）
                        ▼
┌─────────────────────────────────────────────────────┐
│ OpenTelemetry Collector                             │
│  receivers → processors → exporters                 │
│  batch / memory_limiter / tail_sampling / attributes│
└───────────┬───────────────────┬─────────────────────┘
            │                   │
            ▼                   ▼
     Traces Backend       Metrics Backend / Logs Backend
     Jaeger/Tempo         Prometheus/Mimir/Loki/ELK
```

## 三种部署形态

| 形态 | 说明 | 适用 |
| ---- | ---- | ---- |
| 无 Collector | 应用直接导出到后端 | 测试、小规模 |
| Agent 模式 | 每台主机/每个 Pod 一个 Collector | 边缘采集、缓冲、批处理 |
| Gateway 模式 | 中心 Collector 集群 | 多集群、统一处理、tail sampling |

## 数据流的关键点

- 应用只负责产生数据，不关心后端地址和协议细节。
- Collector 负责批处理、重试、限流、采样、脱敏、路由。
- 后端负责存储、查询、可视化和告警。
- Trace 的 Context 必须跨 HTTP、RPC、消息队列传播，否则链路会断。

# Java 生态与依赖

## 依赖分层

| 依赖 | 用途 | 是否应该进业务代码 |
| ---- | ---- | ------------------ |
| `opentelemetry-api` | API 接口 | 是 |
| `opentelemetry-sdk` | SDK 实现 | 应用启动模块 |
| `opentelemetry-exporter-otlp` | OTLP 导出 | 应用启动模块 |
| `opentelemetry-sdk-extension-autoconfigure` | 环境变量/配置自动装配 | 可选 |
| `opentelemetry-instrumentation-annotations` | `@WithSpan`、`@SpanAttribute` | 可选 |
| `opentelemetry-spring-boot-starter` | Spring Boot 自动埋点 | Spring Boot 应用 |
| `opentelemetry-javaagent` | 零代码 Agent | 部署时挂载 |
| `opentelemetry-sdk-testing` | 单元测试 | 测试作用域 |

## Maven BOM

```xml
<properties>
  <opentelemetry.version>1.67.0</opentelemetry.version>
  <opentelemetry-instrumentation.version>2.32.0-alpha</opentelemetry-instrumentation.version>
</properties>

<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>io.opentelemetry</groupId>
      <artifactId>opentelemetry-bom</artifactId>
      <version>${opentelemetry.version}</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
```

> `opentelemetry-bom` 管理 SDK/API/Exporter 版本；`opentelemetry-instrumentation-bom` 管理 instrumentation 版本。不要混用不兼容的版本。

## 依赖示例

```xml
<dependencies>
  <!-- API：业务代码只依赖它 -->
  <dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-api</artifactId>
  </dependency>

  <!-- SDK：应用启动时使用 -->
  <dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-sdk</artifactId>
  </dependency>

  <!-- OTLP 导出 -->
  <dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-otlp</artifactId>
  </dependency>

  <!-- 注解埋点 -->
  <dependency>
    <groupId>io.opentelemetry.instrumentation</groupId>
    <artifactId>opentelemetry-instrumentation-annotations</artifactId>
    <version>${opentelemetry-instrumentation.version}</version>
  </dependency>

  <!-- 测试 -->
  <dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-sdk-testing</artifactId>
    <scope>test</scope>
  </dependency>
</dependencies>
```

## 选择哪种埋点方式

| 场景 | 推荐 |
| ---- | ---- |
| 已有 Spring Boot 服务，想快速接入 | Java Agent（零代码） |
| 不想加 `-javaagent`，希望依赖化 | Spring Boot Starter |
| 需要完全控制 SDK、采样、导出 | 手动初始化 SDK |
| 开发公共库 | 只依赖 `opentelemetry-api` |
| 需要业务级 Span | 手动埋点 + Agent/Starter 自动埋点 |
| 测试断言 | `opentelemetry-sdk-testing` |

**不要同时使用 Java Agent 和 Spring Boot Starter**，否则可能重复埋点。

# 快速开始：Java Agent

## 下载 Agent

从 OpenTelemetry Java Instrumentation 的 GitHub Releases 下载：

```bash
curl -L -o opentelemetry-javaagent.jar \
  https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar
```

校验 checksum，并固定版本，不要在生产使用 `latest`。

## 启动应用

```bash
java -javaagent:/opt/otel/opentelemetry-javaagent.jar \
  -Dotel.service.name=order-service \
  -Dotel.exporter.otlp.endpoint=http://otel-collector:4317 \
  -Dotel.exporter.otlp.protocol=grpc \
  -Dotel.traces.sampler=parentbased_traceidratio \
  -Dotel.traces.sampler.arg=0.1 \
  -jar order-service.jar
```

环境变量方式更适合容器：

```bash
export OTEL_SERVICE_NAME=order-service
export OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_TRACES_SAMPLER=parentbased_traceidratio
export OTEL_TRACES_SAMPLER_ARG=0.1
export OTEL_RESOURCE_ATTRIBUTES=service.version=1.2.0,deployment.environment.name=prod
export OTEL_PROPAGATORS=tracecontext,baggage

java -javaagent:/opt/otel/opentelemetry-javaagent.jar -jar order-service.jar
```

常用环境变量：

| 变量 | 示例 | 说明 |
| ---- | ---- | ---- |
| `OTEL_SERVICE_NAME` | `order-service` | 服务名，写入 `service.name` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://collector:4317` | OTLP 地址 |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` / `http/protobuf` | 4317 用 grpc，4318 用 http/protobuf |
| `OTEL_EXPORTER_OTLP_HEADERS` | `api-key=xxx` | 认证 Header |
| `OTEL_TRACES_SAMPLER` | `parentbased_traceidratio` | 采样器 |
| `OTEL_TRACES_SAMPLER_ARG` | `0.1` | 采样比例 |
| `OTEL_RESOURCE_ATTRIBUTES` | `service.version=1.2.0,deployment.environment.name=prod` | 资源属性 |
| `OTEL_PROPAGATORS` | `tracecontext,baggage` | 传播器 |
| `OTEL_TRACES_EXPORTER` | `otlp` / `none` | Trace 导出 |
| `OTEL_METRICS_EXPORTER` | `otlp` / `prometheus` / `none` | 指标导出 |
| `OTEL_LOGS_EXPORTER` | `otlp` / `none` | 日志导出 |
| `OTEL_SDK_DISABLED` | `true` | 临时关闭 SDK |
| `OTEL_JAVAAGENT_DEBUG` | `true` | Agent 调试日志 |

Java Agent 2.x 默认协议是 `http/protobuf`；如果你的 Collector 暴露的是 4317 gRPC 端口，必须显式设置 `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`。

## Docker

```dockerfile
FROM eclipse-temurin:21-jre

COPY target/order-service.jar /app/order-service.jar
COPY opentelemetry-javaagent.jar /opt/otel/opentelemetry-javaagent.jar

ENV OTEL_SERVICE_NAME=order-service
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
ENV OTEL_EXPORTER_OTLP_PROTOCOL=grpc

ENTRYPOINT ["java", "-javaagent:/opt/otel/opentelemetry-javaagent.jar", "-jar", "/app/order-service.jar"]
```

## Kubernetes

```yaml
env:
  - name: OTEL_SERVICE_NAME
    value: order-service
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: http://otel-collector.observability:4317
  - name: OTEL_EXPORTER_OTLP_PROTOCOL
    value: grpc
  - name: OTEL_TRACES_SAMPLER
    value: parentbased_traceidratio
  - name: OTEL_TRACES_SAMPLER_ARG
    value: "0.1"
  - name: OTEL_RESOURCE_ATTRIBUTES
    value: service.version=1.2.0,deployment.environment.name=prod,k8s.namespace.name=order
  - name: JAVA_TOOL_OPTIONS
    value: "-javaagent:/opt/otel/opentelemetry-javaagent.jar"
```

## 验证

```bash
# 查看 Agent 日志（默认输出到 stderr）
kubectl logs deploy/order-service | grep -i opentelemetry

# 检查 Collector 是否收到数据
curl http://otel-collector:8888/metrics | grep otelcol_receiver
```

常见问题：

- Agent 没生效：检查 `-javaagent` 路径、JVM 参数是否被覆盖。
- 没有数据：检查 endpoint、协议、网络、TLS、Collector 日志。
- 4317 用了 `http/protobuf`：先确认协议，4317 通常配 `grpc`，4318 配 `http/protobuf`。
- Agent 日志太多：设置 `OTEL_JAVAAGENT_LOGGING=simple` 或 `none`。

# 手动初始化 SDK

## 完整初始化示例

```java
package com.example.otel;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.baggage.propagation.W3CBaggagePropagator;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import io.opentelemetry.context.propagation.ContextPropagators;
import io.opentelemetry.context.propagation.TextMapPropagator;
import io.opentelemetry.exporter.otlp.logs.OtlpGrpcLogRecordExporter;
import io.opentelemetry.exporter.otlp.metrics.OtlpGrpcMetricExporter;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.logs.SdkLoggerProvider;
import io.opentelemetry.sdk.logs.export.BatchLogRecordProcessor;
import io.opentelemetry.sdk.metrics.SdkMeterProvider;
import io.opentelemetry.sdk.metrics.export.PeriodicMetricReader;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.sdk.trace.samplers.Sampler;
import java.time.Duration;

public final class OpenTelemetryConfig {

    public static OpenTelemetry init() {
        String endpoint = System.getenv().getOrDefault(
                "OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317");

        Resource resource = Resource.getDefault().toBuilder()
                .put(AttributeKey.stringKey("service.name"), "order-service")
                .put(AttributeKey.stringKey("service.version"), "1.2.0")
                .put(AttributeKey.stringKey("deployment.environment.name"), "prod")
                .build();

        OtlpGrpcSpanExporter spanExporter = OtlpGrpcSpanExporter.builder()
                .setEndpoint(endpoint)
                .setTimeout(Duration.ofSeconds(10))
                .build();

        SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
                .setResource(resource)
                .setSampler(Sampler.parentBased(Sampler.traceIdRatioBased(0.1)))
                .addSpanProcessor(BatchSpanProcessor.builder(spanExporter)
                        .setScheduleDelay(Duration.ofSeconds(5))
                        .setMaxQueueSize(2048)
                        .setMaxExportBatchSize(512)
                        .build())
                .build();

        SdkMeterProvider meterProvider = SdkMeterProvider.builder()
                .setResource(resource)
                .registerMetricReader(PeriodicMetricReader.builder(
                                OtlpGrpcMetricExporter.builder()
                                        .setEndpoint(endpoint)
                                        .setTimeout(Duration.ofSeconds(10))
                                        .build())
                        .setInterval(Duration.ofSeconds(15))
                        .build())
                .build();

        SdkLoggerProvider loggerProvider = SdkLoggerProvider.builder()
                .setResource(resource)
                .addLogRecordProcessor(BatchLogRecordProcessor.builder(
                                OtlpGrpcLogRecordExporter.builder()
                                        .setEndpoint(endpoint)
                                        .setTimeout(Duration.ofSeconds(10))
                                        .build())
                        .setScheduleDelay(Duration.ofSeconds(5))
                        .build())
                .build();

        ContextPropagators propagators = ContextPropagators.create(
                TextMapPropagator.composite(
                        W3CTraceContextPropagator.getInstance(),
                        W3CBaggagePropagator.getInstance()));

        OpenTelemetrySdk sdk = OpenTelemetrySdk.builder()
                .setTracerProvider(tracerProvider)
                .setMeterProvider(meterProvider)
                .setLoggerProvider(loggerProvider)
                .setPropagators(propagators)
                .build();

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            tracerProvider.shutdown();
            meterProvider.shutdown();
            loggerProvider.shutdown();
        }));
        return sdk;
    }
}
```

关键点：

- **SDK 只初始化一次**，不要每个请求新建。
- `Resource` 要同时设置到三个 Provider。
- `BatchSpanProcessor` 和 `PeriodicMetricReader` 是异步批量导出，避免阻塞业务。
- 注册 shutdown hook，确保退出前 flush。
- 生产环境设置队列、超时、批量大小，避免 OOM 或丢数据。

## 使用自动配置

如果希望用环境变量/系统属性配置 SDK，可以用：

```java
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.sdk.autoconfigure.AutoConfiguredOpenTelemetrySdk;

OpenTelemetry openTelemetry = AutoConfiguredOpenTelemetrySdk.initialize()
        .getOpenTelemetrySdk();
```

它读取 `OTEL_*` 配置，适合不想手写 SDK 初始化、又不想挂 Agent 的场景。

## GlobalOpenTelemetry

库或框架通常通过全局实例获取：

```java
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.OpenTelemetry;

OpenTelemetry openTelemetry =
        GlobalOpenTelemetry.isSet() ? GlobalOpenTelemetry.get() : OpenTelemetryConfig.init();
```

- Java Agent 会自动设置 `GlobalOpenTelemetry`。
- 手动初始化时，如果库依赖全局实例，需要用 `GlobalOpenTelemetry.set(sdk)`。
- 不要重复 `set`，否则会告警或覆盖。

# Tracing 实战

## 获取 Tracer

```java
import io.opentelemetry.api.trace.Tracer;

Tracer tracer = openTelemetry.getTracer("com.example.order", "1.0.0");
```

`getTracer(scopeName, scopeVersion)` 的 scope 用于标识埋点来源，便于后端按库/模块过滤。

## 创建 Span 的标准写法

```java
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.context.Scope;

public Order createOrder(OrderRequest request) {
    Span span = tracer.spanBuilder("order.create")
            .setSpanKind(SpanKind.INTERNAL)
            .setAttribute(AttributeKey.stringKey("order.channel"), request.channel())
            .setAttribute(AttributeKey.longKey("order.item.count"), request.items().size())
            .startSpan();

    try (Scope ignored = span.makeCurrent()) {
        Order order = doCreateOrder(request);
        span.setAttribute("order.id", order.id());
        span.setStatus(StatusCode.OK);
        return order;
    } catch (Exception e) {
        span.recordException(e);
        span.setStatus(StatusCode.ERROR, e.getMessage());
        throw e;
    } finally {
        span.end();
    }
}
```

要点：

- `startSpan()` 之后必须 `end()`，放在 `finally`。
- `makeCurrent()` 让子 Span 自动挂到当前 Span 下。
- 异常要 `recordException` + `setStatus(ERROR)`。
- 成功可以设置 `StatusCode.OK`，但不是必须。
- 不要在 `finally` 里重复记录异常。

## SpanKind

| 类型 | 含义 | 示例 |
| ---- | ---- | ---- |
| `SERVER` | 服务端接收请求 | HTTP 入口、gRPC 服务端 |
| `CLIENT` | 客户端发起请求 | HTTP 客户端、数据库客户端 |
| `PRODUCER` | 消息生产者 | Kafka producer |
| `CONSUMER` | 消息消费者 | Kafka consumer |
| `INTERNAL` | 内部操作 | 业务方法、缓存、计算 |

SpanKind 影响后端拓扑图和指标聚合，尽量使用语义正确的类型。

## 嵌套 Span

```java
Span parent = tracer.spanBuilder("order.create").startSpan();
try (Scope scope = parent.makeCurrent()) {
    Span child = tracer.spanBuilder("inventory.reserve").startSpan();
    try (Scope childScope = child.makeCurrent()) {
        // 业务逻辑
    } finally {
        child.end();
    }
} finally {
    parent.end();
}
```

如果忘记 `makeCurrent()`，子 Span 不会自动挂到父 Span 下，需要显式 `setParent(Context)`。

## 事件

Span Event 适合记录“某个时间点发生了什么”：

```java
span.addEvent("cache.miss", Attributes.of(
        AttributeKey.stringKey("cache.name"), "order-cache",
        AttributeKey.stringKey("cache.key"), orderId));
```

不要把大量日志或大对象塞进 Event，事件会随 Span 一起存储。

## Link

Link 用于关联“不是父子关系”的 Span，例如批处理、异步消费：

```java
Context producerContext = ...; // 从消息头 extract 得到的 Context
SpanContext linkContext = Span.fromContext(producerContext).getSpanContext();

Span consumer = tracer.spanBuilder("order.consume")
        .setSpanKind(SpanKind.CONSUMER)
        .addLink(linkContext)
        .startSpan();
```

## 手动注入与提取

跨进程调用需要传播 Trace Context：

```java
import io.opentelemetry.context.Context;
import io.opentelemetry.context.propagation.TextMapSetter;
import java.net.http.HttpRequest;

TextMapSetter<HttpRequest.Builder> setter =
        (carrier, key, value) -> carrier.header(key, value);

HttpRequest.Builder builder = HttpRequest.newBuilder()
        .uri(URI.create("http://inventory-service/reserve"))
        .GET();

openTelemetry.getPropagators()
        .getTextMapPropagator()
        .inject(Context.current(), builder, setter);
```

服务端提取：

```java
import io.opentelemetry.context.propagation.TextMapGetter;
import io.opentelemetry.context.Scope;

TextMapGetter<HttpHeaders> getter = new TextMapGetter<>() {
    @Override
    public Iterable<String> keys(HttpHeaders carrier) {
        return carrier.names();
    }

    @Override
    public String get(HttpHeaders carrier, String key) {
        return carrier.firstValue(key).orElse(null);
    }
};

Context extracted = openTelemetry.getPropagators()
        .getTextMapPropagator()
        .extract(Context.current(), headers, getter);

try (Scope scope = extracted.makeCurrent()) {
    Span serverSpan = tracer.spanBuilder("http.server")
            .setSpanKind(SpanKind.SERVER)
            .startSpan();
    try (Scope serverScope = serverSpan.makeCurrent()) {
        // 处理请求
    } finally {
        serverSpan.end();
    }
}
```

使用 Agent/Starter 时，HTTP 服务端和客户端通常会自动注入/提取；手动埋点主要用于自定义协议或未被自动埋点的客户端。

## 异步与线程池

Context 不会自动跨线程传播，必须显式包装：

```java
Context context = Context.current();

executor.submit(context.wrap(() -> {
    Span asyncSpan = tracer.spanBuilder("order.async").startSpan();
    try (Scope scope = asyncSpan.makeCurrent()) {
        // 异步任务
    } finally {
        asyncSpan.end();
    }
}));
```

常见错误：

- 直接 `executor.submit(() -> ...)`，Context 丢失，子 Span 变成新的根。
- 在线程池中复用 Span 对象，导致生命周期混乱。
- 在异步回调中忘记 `makeCurrent()`。

## 一次请求的 Span 结构

```text
HTTP POST /orders                     SERVER   (Agent/Starter 自动)
├── OrderService.create               INTERNAL (手动 @WithSpan/Span)
│   ├── SELECT orders                 CLIENT   (JDBC 自动)
│   ├── HTTP POST inventory/reserve   CLIENT   (HTTP Client 自动)
│   └── Kafka publish order.created   PRODUCER (Kafka 自动)
└── response
```

原则：

- 自动埋点负责框架边界（HTTP、DB、消息）。
- 手动埋点负责业务语义（订单创建、库存锁定、风控决策）。
- 不要给每个 getter/setter 都加 Span，Span 太细会增加开销和噪音。

# Metrics 实战

## 获取 Meter

```java
import io.opentelemetry.api.metrics.Meter;

Meter meter = openTelemetry.getMeter("com.example.order");
```

## Counter

```java
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.metrics.LongCounter;

LongCounter ordersCreated = meter.counterBuilder("orders.created")
        .setDescription("Number of created orders")
        .setUnit("{order}")
        .build();

ordersCreated.add(1, Attributes.of(
        AttributeKey.stringKey("channel"), "web",
        AttributeKey.stringKey("result"), "success"));
```

Counter 只增不减，适合请求数、错误数、处理条数。

## Histogram

```java
import io.opentelemetry.api.metrics.DoubleHistogram;

DoubleHistogram orderDuration = meter.histogramBuilder("order.process.duration")
        .setDescription("Order processing duration")
        .setUnit("s")
        .build();

long start = System.nanoTime();
try {
    // 业务逻辑
} finally {
    double seconds = (System.nanoTime() - start) / 1_000_000_000.0;
    orderDuration.record(seconds, Attributes.of(
            AttributeKey.stringKey("channel"), "web"));
}
```

Histogram 适合延迟、响应大小等分布数据。不要用平均值代替分位数。

## Gauge

```java
meter.gaugeBuilder("queue.depth")
        .setDescription("Current queue depth")
        .setUnit("{item}")
        .buildWithCallback(observable -> observable.record(queue.size()));
```

异步 Gauge 在回调中读取当前值，适合队列长度、连接数等。

## UpDownCounter

```java
LongUpDownCounter inFlight = meter.upDownCounterBuilder("orders.inflight").build();
inFlight.add(1);
try {
    // 处理
} finally {
    inFlight.add(-1);
}
```

适合可增可减的当前值，如正在处理的请求数。

## 属性与基数

Metrics 的每个属性组合都会生成一条时间序列：

```java
ordersCreated.add(1, Attributes.of(
        AttributeKey.stringKey("channel"), "web",
        AttributeKey.stringKey("result"), "success"));
```

高基数属性会导致内存和存储爆炸：

- 不要用 `user.id`、`order.id`、`request.id` 做属性。
- 不要用完整 URL、原始 IP、错误堆栈做属性。
- 使用有限的枚举值，如 `channel=web|app|api`。
- 用 View 丢弃不需要的指标或限制基数。

SDK 默认对每个 instrument 的每个 collection cycle 限制约 2000 个唯一属性组合，可以通过 `CardinalityLimitSelector` 或 View 调整。

## Exemplars

Exemplar 把指标测量关联到具体 Trace：

- Histogram 记录延迟时，可以附带当前 TraceID。
- 后端可以从慢指标直接跳到对应 Trace。
- 需要后端和 exporter 支持。

业务代码通常不需要手动创建 exemplar，SDK 会从当前 Context 自动关联；确保记录指标时 Context 中有 Span。

# Logs 与日志关联

## 两种日志接入方式

| 方式 | 说明 | 推荐 |
| ---- | ---- | ---- |
| Log Bridge API | 用 OTel `Logger` 直接写日志 | 适合写 appender/桥接，不推荐业务直接用 |
| Log Appender | 把 Logback/Log4j 日志桥接到 OTel | 应用最常用 |
| Agent 注入 | Agent 把 trace_id/span_id 注入日志 MDC | 与现有日志框架配合 |

官方明确：`LoggerProvider` / `Logger` 是 **Log Bridge API**，主要给日志框架的 appender 使用，不是用来替代 SLF4J/Logback/Log4j。

## Logback Appender

```xml
<dependency>
  <groupId>io.opentelemetry.instrumentation</groupId>
  <artifactId>opentelemetry-logback-appender-1.0</artifactId>
  <version>${opentelemetry-instrumentation.version}</version>
</dependency>
```

在 `logback.xml` 中配置 `OpenTelemetryAppender`：

```xml
<configuration>
  <appender name="console" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
    </encoder>
  </appender>

  <appender name="OpenTelemetry"
            class="io.opentelemetry.instrumentation.logback.appender.v1_0.OpenTelemetryAppender">
    <captureExperimentalAttributes>true</captureExperimentalAttributes>
    <mdcAttributesIncluded>request-*,user-?</mdcAttributesIncluded>
    <mdcAttributesExcluded>*-secret</mdcAttributesExcluded>
    <structuredAttributesExcluded>*-secret</structuredAttributesExcluded>
  </appender>

  <root level="INFO">
    <appender-ref ref="console"/>
    <appender-ref ref="OpenTelemetry"/>
  </root>
</configuration>
```

应用启动时把 SDK 安装到 appender：

```java
import io.opentelemetry.instrumentation.logback.appender.v1_0.OpenTelemetryAppender;
import io.opentelemetry.sdk.OpenTelemetrySdk;

OpenTelemetrySdk sdk = (OpenTelemetrySdk) OpenTelemetryConfig.init();
OpenTelemetryAppender.install(sdk);
```

关键设置：

| 设置 | 作用 |
| ---- | ---- |
| `captureExperimentalAttributes` | 捕获 `thread.name`、`thread.id` |
| `captureCodeAttributes` | 捕获代码位置，可能有性能开销 |
| `captureArguments` | 捕获日志参数 |
| `captureTemplate` | 捕获消息模板 |
| `mdcAttributesIncluded` / `mdcAttributesExcluded` | 控制哪些 MDC 字段进入日志属性 |
| `structuredAttributesIncluded` / `structuredAttributesExcluded` | 控制 SLF4J KeyValuePair/Logstash 结构化属性 |
| `numLogsCapturedBeforeOtelInstall` | SDK 安装前缓存并回放的日志条数，默认 1000 |

注意：

- MDC 默认不会全部捕获，需要显式配置 include/exclude，避免把敏感字段带出去。
- `OpenTelemetryAppender.install(sdk)` 要在 SDK 初始化后尽早调用。
- 日志量大时，建议同时配置 Collector 过滤/采样，不要在应用里全部同步导出。
- 使用 Agent 时，Agent 也可能注入 trace 上下文；避免和自定义 appender 重复产生同一份日志。

## 日志关联 Trace

理想情况下，每条日志都带：

```text
trace_id=4bf92f3577b34da6a3ce929d0e0e4736
span_id=00f067aa0ba902b7
trace_flags=01
```

这样在日志平台点击 `trace_id` 就能跳到 Trace。

如果使用 Agent + Logback，Agent 会把 trace 上下文注入 MDC；日志格式中加：

```xml
<pattern>%d{ISO8601} %-5level [%X{trace_id:-},%X{span_id:-}] %logger{36} - %msg%n</pattern>
```

## 日志最佳实践

- 使用结构化日志，关键字段放 MDC/KeyValuePair。
- 不要把整个对象序列化进日志。
- 不要在日志中记录密码、token、身份证、银行卡等敏感信息。
- 采样日志时保留 ERROR/WARN，避免把故障日志采掉。
- 日志量大的服务优先在 Collector 做过滤/采样，而不是全部上报。

# Context 与 Baggage

## Context 的作用

Context 是 OTel 的“隐式传递容器”：

- 当前 Span 放在 Context 中。
- Baggage 放在 Context 中。
- Metrics exemplar、Logs trace 关联都从 Context 读取。

## Scope

```java
Span span = tracer.spanBuilder("operation").startSpan();
try (Scope scope = span.makeCurrent()) {
    // 这里的 Span.current() 是 span
} finally {
    span.end();
}
```

`makeCurrent()` 返回 `Scope`，必须在 `finally` 中关闭，否则 Context 会泄漏到后续代码。

## Baggage

Baggage 用于跨服务传递业务上下文：

```java
import io.opentelemetry.api.baggage.Baggage;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;

Baggage baggage = Baggage.current().toBuilder()
        .put("tenant.id", tenantId)
        .put("request.channel", "web")
        .build();

try (Scope scope = Context.current().with(baggage).makeCurrent()) {
    // 下游 HTTP 调用会自动传播 baggage
}
```

读取：

```java
String tenantId = Baggage.current().getEntryValue("tenant.id");
```

注意事项：

- Baggage 会随请求传播到所有下游，可能被第三方看到。
- 不要放密码、token、身份证等敏感信息。
- Baggage 不宜过大，避免 HTTP Header 膨胀。
- Baggage 不是 Span Attribute，不会自动出现在 Span 上；需要显式读取并 `setAttribute`。

## 跨线程传递

```java
Context context = Context.current();

executor.submit(context.wrap(() -> {
    // 这里可以访问父 Span 和 Baggage
}));
```

`Context.wrap` 支持 `Runnable`、`Callable`、`ExecutorService`、`Consumer`、`Supplier`、`Function` 等。

## 跨进程传播

默认使用：

- W3C Trace Context：`traceparent`、`tracestate`
- W3C Baggage：`baggage`

配置：

```bash
OTEL_PROPAGATORS=tracecontext,baggage
```

如果对接旧系统，可加 `b3`、`jaeger` 等，但不要同时启用过多导致 Header 冲突。

# Sampling

## 为什么采样

Trace 数据量可能非常大，全量采集成本高。采样在“保留可观测性”和“控制成本”之间做取舍。

## Head Sampling

在 Trace 开始时决定是否采样：

- 基于 TraceID 的概率采样。
- 决策会通过 `traceparent` 的 sampled flag 传给下游。
- 保证整条 Trace 要么全采、要么全不采。
- 实现简单、开销低。

Java SDK 配置：

```java
.setSampler(Sampler.parentBased(Sampler.traceIdRatioBased(0.1)))
```

环境变量：

```bash
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

`parentBased` 表示：

- 有父 Span 时跟随父采样决定。
- 根 Span 按 10% 比例采样。

## Tail Sampling

在 Trace 结束后，根据整条 Trace 的信息决定是否保留：

- 保留所有错误 Trace。
- 保留慢 Trace。
- 按服务/属性设置不同采样率。
- 需要 Collector 的 `tail_sampling` processor。
- 需要等待 `decision_wait`，并保证同一 Trace 的所有 Span 到达同一 Collector 实例。

适合大规模系统，但实现和运维复杂度更高。

## Head + Tail 组合

常见策略：

1. 应用侧 Head Sampling 采 10%-30%，降低传输量。
2. Collector 侧 Tail Sampling 保留全部错误和慢请求。
3. 后端按保留策略存储。

注意：Head Sampling 已经丢弃的 Trace，Tail Sampling 无法恢复。

## 采样不会减少 Metrics/Logs

采样只作用于 Traces。Metrics 和 Logs 需要单独做基数治理、过滤和采样。

# Resource 与 Semantic Conventions

## Resource 配置

```java
Resource resource = Resource.getDefault().toBuilder()
        .put(AttributeKey.stringKey("service.name"), "order-service")
        .put(AttributeKey.stringKey("service.version"), "1.2.0")
        .put(AttributeKey.stringKey("service.instance.id"), instanceId)
        .put(AttributeKey.stringKey("deployment.environment.name"), "prod")
        .build();
```

环境变量：

```bash
OTEL_SERVICE_NAME=order-service
OTEL_RESOURCE_ATTRIBUTES=service.version=1.2.0,deployment.environment.name=prod,k8s.namespace.name=order
```

`OTEL_SERVICE_NAME` 会覆盖 `service.name`。

## 语义约定

优先使用官方属性名：

```java
import static io.opentelemetry.semconv.SemanticAttributes.*;

span.setAttribute(HTTP_REQUEST_METHOD, "POST");
span.setAttribute(URL_PATH, "/orders");
span.setAttribute(HTTP_RESPONSE_STATUS_CODE, 200L);
span.setAttribute(SERVER_ADDRESS, "order-service");
```

> 不同 semconv 版本的常量类/包名可能变化；以项目引入的 `opentelemetry-semconv` 版本为准。

## Span 命名

Span 名称要低基数、可聚合：

| 推荐 | 不推荐 |
| ---- | ------ |
| `GET /orders/{id}` | `GET /orders/123456` |
| `order.create` | `createOrder-123456` |
| `inventory.reserve` | `reserve inventory for user 42` |
| `kafka.consume order.created` | `consume message 8f3a...` |

高基数 Span 名称会让后端无法聚合，直接拖垮追踪系统。

## 属性基数与 PII

- 属性值应是有限枚举或低基数标识。
- 不要把用户 ID、订单 ID、请求 ID 作为 Metric 属性。
- Span Attribute 可以放少量高基数 ID，但要注意存储成本和隐私。
- 不要记录密码、token、身份证、银行卡、手机号等敏感信息。
- 需要排障的 ID 可以放日志，并做脱敏。

# Collector

## Collector 的作用

Collector 是遥测数据的代理/网关：

- 接收 OTLP/gRPC/HTTP、Jaeger、Zipkin、Prometheus 等数据。
- 批处理、重试、限流、内存保护。
- 属性处理、过滤、脱敏、采样。
- 路由到不同后端。
- 统一 TLS、认证、多租户。

## 最小配置

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
  batch: {}

exporters:
  otlphttp:
    endpoint: https://otel-backend.example.com:4318

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlphttp]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlphttp]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlphttp]
```

## 常用 Processor

| Processor | 作用 |
| --------- | ---- |
| `memory_limiter` | 防止 Collector OOM，必须放 pipeline 第一位 |
| `batch` | 批量发送，降低网络开销 |
| `attributes` | 增加/删除/重命名属性 |
| `filter` | 过滤不需要的 Span/Metric/Log |
| `tail_sampling` | 按 Trace 结果采样 |
| `resource` | 补充资源属性 |
| `transform` | 使用 OTTL 转换数据 |

## Tail Sampling 注意事项

Tail Sampling 需要看到整条 Trace：

- 同一 Trace 的所有 Span 必须路由到同一 Collector 实例。
- 多实例部署时使用 `loadbalancing` exporter，按 TraceID 路由。
- `decision_wait` 太短会误判，太长会增加内存。
- 错误和慢请求优先保留，普通请求按比例采样。

示例：

```yaml
processors:
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    expected_new_traces_per_sec: 1000
    policies:
      - name: errors
        type: status_code
        status_code:
          status_codes: [ERROR]
      - name: slow
        type: latency
        latency:
          threshold_ms: 500
      - name: baseline
        type: probabilistic
        probabilistic:
          sampling_percentage: 10
```

这个策略表示：保留所有错误 Trace、所有超过 500ms 的 Trace，其余按 10% 采样。

## Agent 模式与 Gateway 模式

| 模式 | 优点 | 缺点 |
| ---- | ---- | ---- |
| Agent（DaemonSet/Sidecar） | 就近采集、低延迟、缓冲 | 资源分散、配置管理复杂 |
| Gateway（中心集群） | 统一处理、集中采样、易扩展 | 网络跳数增加、单点风险 |
| 混合 | Agent 采集 + Gateway 处理 | 架构复杂，但生产常用 |

# Spring Boot 实战

## 方式一：Java Agent

最简单，零代码：

```bash
java -javaagent:/opt/otel/opentelemetry-javaagent.jar \
  -Dotel.service.name=order-service \
  -Dotel.exporter.otlp.endpoint=http://otel-collector:4317 \
  -Dotel.exporter.otlp.protocol=grpc \
  -jar order-service.jar
```

Agent 会自动埋点：

- Spring MVC / WebFlux 入口
- RestTemplate / WebClient / OkHttp / Apache HttpClient
- JDBC / HikariCP / MyBatis
- Redis / Kafka / RabbitMQ
- 日志 trace 上下文注入
- 常见的线程池/异步框架

## 方式二：Spring Boot Starter

```xml
<dependency>
  <groupId>io.opentelemetry.instrumentation</groupId>
  <artifactId>opentelemetry-spring-boot-starter</artifactId>
  <version>${opentelemetry-instrumentation.version}</version>
</dependency>
```

配置（等价环境变量）：

```yaml
otel:
  service:
    name: order-service
  exporter:
    otlp:
      endpoint: http://otel-collector:4317
      protocol: grpc
  traces:
    sampler: parentbased_traceidratio
  resource:
    attributes:
      deployment.environment.name: prod
```

采样比例建议用标准环境变量 `OTEL_TRACES_SAMPLER_ARG=0.1`，避免不同版本 Starter 的属性绑定差异。

不要同时使用 Agent 和 Starter，否则可能重复埋点。

## 业务 Span

```java
import io.opentelemetry.instrumentation.annotations.SpanAttribute;
import io.opentelemetry.instrumentation.annotations.WithSpan;

@Service
public class OrderService {

    @WithSpan("order.create")
    public Order create(@SpanAttribute("order.channel") String channel,
                        @SpanAttribute("order.item.count") int itemCount) {
        // 业务逻辑
        return order;
    }
}
```

注意：

- `@WithSpan` 依赖 AOP/代理，自调用（同一个类内部调用）不会生效。
- 注解方式适合业务方法；复杂逻辑仍建议手动 `Span` 以便控制属性和异常。
- `@SpanAttribute` 的值会作为 Span 属性，避免放高基数或敏感数据。

## WebClient / RestTemplate

Agent/Starter 会自动注入 Trace Context。若使用自定义 HTTP 客户端，需要手动注入：

```java
openTelemetry.getPropagators()
        .getTextMapPropagator()
        .inject(Context.current(), request, setter);
```

## Kafka

- Producer：自动创建 `PRODUCER` Span，并把 Trace Context 写入消息 Header。
- Consumer：自动提取 Header，创建 `CONSUMER` Span。
- 批量消费时，一条消息可能对应多个上游 Trace，使用 Span Link 关联。

## 异步任务

Spring 的 `@Async` 线程池通常会被 Agent/Starter 包装；自定义线程池需要手动 `Context.wrap`：

```java
executor.submit(Context.current().wrap(() -> {
    // 保留父 Span
}));
```

## Actuator 与健康检查

- 不要给健康检查、Prometheus 抓取等高频低价值请求创建过多 Span。
- 可以用 Agent 的 suppression 配置或 Collector 过滤规则排除。
- 确保 `/actuator/health` 不被采样成噪音。

# 生产实践

## 性能

- 使用批量处理器，不要用 `SimpleSpanProcessor` 在生产同步导出。
- 设置合理的队列大小、批量大小、导出超时。
- 导出失败要能降级，不能阻塞业务线程。
- 避免在热路径创建大量属性对象，能复用就复用。
- 控制 Span 数量，不要把每个方法都包一层。

## 采样与成本

- 全量 Trace 成本高，按流量设置 head sampling。
- 错误和慢请求用 tail sampling 保留。
- Metrics 关注基数和保留时间。
- Logs 关注量和敏感信息。
- 定期评估“采样后是否还能定位问题”。

## 安全

- OTLP 使用 TLS，生产不要明文传输。
- 使用 API Key/mTLS 保护 Collector。
- 不要把 Collector 暴露到公网。
- 不要在属性/日志中记录密码、token、身份证、银行卡等。
- 对 PII 做脱敏或哈希。
- 限制 Collector 的接收大小和速率，防止滥用。

## 版本与升级

- 使用 BOM 统一 SDK/Exporter 版本。
- Agent、Instrumentation、Collector 分开升级，先测试。
- 关注 Semantic Conventions 的破坏性变更（如属性重命名）。
- 升级后检查 Dashboard、告警、采样配置是否仍然有效。
- 固定 Agent 版本，不要用 `latest`。

## 可观测性管道自身

监控 Collector：

- 接收/导出速率
- 队列长度、丢弃数
- 导出失败、重试
- 内存使用、CPU
- `otelcol_*` 指标

监控应用侧：

- Span 导出失败
- 队列满
- Agent 日志错误
- 采样率是否符合预期

## 排错清单

| 现象 | 排查 |
| ---- | ---- |
| 没有 Trace | Agent 是否挂载、endpoint/协议、Collector 日志 |
| 只有部分服务有 Trace | Context 传播是否断开、Header 是否被网关丢弃 |
| 子 Span 不关联 | 是否 `makeCurrent()`、异步是否 `Context.wrap` |
| 4317 连不上 | 协议用 `grpc`，端口 4317；HTTP 用 4318 |
| TLS 失败 | 证书、CA、SNI、Collector TLS 配置 |
| 数据量过大 | 采样、属性基数、日志量、Collector 限流 |
| 日志没有 trace_id | appender/MDC 配置、Agent 是否注入 |
| 指标缺失 | MeterProvider、MetricReader、导出间隔、后端 |
| 应用启动变慢 | Agent 版本、类加载、排除不需要的 instrumentation |

# 测试

## 使用 OpenTelemetryExtension

```java
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.sdk.testing.junit5.OpenTelemetryExtension;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;

import static io.opentelemetry.sdk.testing.assertj.OpenTelemetryAssertions.assertThat;

class OrderServiceTest {

    @RegisterExtension
    static final OpenTelemetryExtension otel = OpenTelemetryExtension.create();

    @Test
    void createsOrderSpan() {
        Tracer tracer = GlobalOpenTelemetry.getTracer("test");
        // 调用被测代码，内部使用 GlobalOpenTelemetry
        // ...

        assertThat(otel.getSpans()).hasSize(1);
        assertThat(otel.getSpans().get(0))
                .hasName("order.create")
                .hasAttribute(AttributeKey.stringKey("order.channel"), "web");
    }
}
```

`OpenTelemetryExtension` 会自动：

- 创建带内存 exporter 的 SDK。
- 注册 `GlobalOpenTelemetry`。
- 每个测试前清空已捕获数据。

## 使用 InMemorySpanExporter

```java
InMemorySpanExporter exporter = InMemorySpanExporter.create();
SdkTracerProvider provider = SdkTracerProvider.builder()
        .addSpanProcessor(SimpleSpanProcessor.create(exporter))
        .build();
OpenTelemetrySdk sdk = OpenTelemetrySdk.builder()
        .setTracerProvider(provider)
        .build();
```

测试重点：

- Span 名称、父子关系、SpanKind。
- 关键属性是否存在、值是否正确。
- 异常是否记录、状态是否为 ERROR。
- 异步代码是否保留了 Context。
- 日志是否带 trace_id/span_id。

# 常见坑

| 坑 | 后果 | 正确做法 |
| -- | ---- | -------- |
| 忘记 `span.end()` | Span 不完整、内存泄漏 | `finally` 中 `end()` |
| 忘记 `makeCurrent()` | 子 Span 不关联 | `try (Scope ...)` |
| 线程池丢失 Context | 链路断裂 | `Context.current().wrap(...)` |
| 每个请求新建 SDK | 资源泄漏、重复导出 | 全局初始化一次 |
| Agent + Starter 同时使用 | 重复 Span/指标 | 二选一 |
| 高基数属性 | 内存/存储爆炸 | 用有限枚举、View、采样 |
| 把用户 ID 放进 Metric | 基数失控 | 放日志或 Span，且脱敏 |
| Span 名称含 ID | 后端无法聚合 | 低基数名称 |
| 同步导出 Span | 阻塞业务 | 批量处理器 |
| 没有 shutdown hook | 退出丢数据 | `sdk.close()` |
| 认为采样会减少 Metrics | 成本预估错误 | Metrics/Logs 单独治理 |
| endpoint 用了 4317 但协议是 http | 连不上 | 4317=grpc，4318=http/protobuf |
| 关闭了 TLS 校验 | 中间人风险 | 配置正确 CA |
| 把密码写进 attribute | 数据泄露 | 脱敏、禁止记录 |
| 只埋点不建 Dashboard | 数据无法使用 | 同步建设查询和告警 |
| 自调用 `@WithSpan` | 不生效 | 拆分 Bean 或手动 Span |
| 忽略 Collector 队列 | 丢数据 | 监控队列/丢弃/重试指标 |

# 一次请求的完整链路

以「创建订单」为例，完整链路如下：

```text
Client
  │ POST /orders
  ▼
API Gateway
  │ traceparent
  ▼
order-service
  ├── SERVER  POST /orders                 (Agent/Starter 自动)
  ├── INTERNAL order.create                (手动 @WithSpan/Span)
  │   ├── CLIENT SELECT ...                (JDBC 自动)
  │   ├── CLIENT POST inventory/reserve    (HTTP Client 自动)
  │   └── PRODUCER order.created           (Kafka 自动)
  └── response
        │ traceparent + baggage
        ▼
inventory-service
  ├── SERVER  POST /inventory/reserve      (自动)
  └── INTERNAL inventory.reserve           (手动)
```

这条链路里：

- **自动埋点**负责框架边界：HTTP、JDBC、Kafka、Redis。
- **手动埋点**负责业务语义：`order.create`、`inventory.reserve`。
- **Context** 通过 HTTP Header 和 Kafka Header 传播。
- **Baggage** 可以带 `tenant.id`，但不要带敏感信息。
- **Metrics** 记录订单数、失败数、处理延迟。
- **Logs** 带 `trace_id`/`span_id`，可从日志跳到 Trace。
- **Sampling** 在根 Span 决定是否采样，下游继承。
- **Collector** 负责批处理、限流、tail sampling 和导出。
- **后端** 负责存储、查询、Dashboard 和告警。

# 参考资料

- [OpenTelemetry 官方文档](https://opentelemetry.io/docs/)
- [What is OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/)
- [Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
- [Metrics](https://opentelemetry.io/docs/concepts/signals/metrics/)
- [Logs](https://opentelemetry.io/docs/concepts/signals/logs/)
- [Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
- [Sampling](https://opentelemetry.io/docs/concepts/sampling/)
- [Resources](https://opentelemetry.io/docs/concepts/resources/)
- [Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
- [Java](https://opentelemetry.io/docs/languages/java/)
- [Java API](https://opentelemetry.io/docs/languages/java/api/)
- [Java SDK](https://opentelemetry.io/docs/languages/java/sdk/)
- [Java Agent](https://opentelemetry.io/docs/languages/java/automatic/)
- [Java Agent Configuration](https://opentelemetry.io/docs/languages/java/automatic/configuration/)
- [Instrumentation ecosystem](https://opentelemetry.io/docs/languages/java/instrumentation/)
- [Spring Boot Starter](https://opentelemetry.io/docs/zero-code/java/spring-boot-starter/)
- [Collector](https://opentelemetry.io/docs/collector/)
- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
- [OpenTelemetry Java GitHub](https://github.com/open-telemetry/opentelemetry-java)
- [OpenTelemetry Java Instrumentation GitHub](https://github.com/open-telemetry/opentelemetry-java-instrumentation)
- [OpenTelemetry Java Examples](https://github.com/open-telemetry/opentelemetry-java-docs)

---
title: Spring Boot 深度笔记
tags: [Spring Boot, Java, Spring Framework, 微服务]
categories: [Java]
date: 2026-10-22 17:40:00
comments: false
---

本文基于 **Spring Boot 4.1.2** 官方文档重写，面向有生产经验的 Java 开发，讲清自动配置、配置体系、Bean 生命周期、Web、数据访问、事务、安全、可观测性、测试、原生镜像、部署和性能。Spring Boot 4.x 基于 Spring Framework 7，最低 Java 17，默认 Jackson 3，很多 2.x/3.x 的写法已经变化。

最后更新：2026-10-22

<!--more-->

- [版本与基线](#版本与基线)
- [项目结构与启动](#项目结构与启动)
- [自动配置原理](#自动配置原理)
- [配置体系](#配置体系)
- [Bean 生命周期与依赖注入](#bean-生命周期与依赖注入)
- [Web 开发](#web-开发)
- [HTTP 客户端](#http-客户端)
- [数据访问](#数据访问)
- [事务与并发](#事务与并发)
- [安全](#安全)
- [Actuator 与可观测性](#actuator-与可观测性)
- [测试](#测试)
- [AOT 与原生镜像](#aot-与原生镜像)
- [打包与部署](#打包与部署)
- [性能与调优](#性能与调优)
- [常见坑](#常见坑)
- [企业实践](#企业实践)
- [附录](#附录)

# 版本与基线

- **Spring Boot 4.1.2**（官方文档当前版本）
- **Spring Framework 7.0.10+**
- **Java 17+**，兼容到 Java 27
- Maven 3.6.3+；Gradle 8.14+/9.x
- 内嵌容器：Tomcat 11.0.x、Jetty 12.1.x，Servlet 6.1
- 默认 JSON：Jackson 3
- ORM：Hibernate 7.2
- 监控：Micrometer 1.16+、Micrometer Tracing
- 安全：Spring Security 7

Spring Boot 4 的重要变化：

- Jakarta EE 11，`javax.*` 彻底不再适用
- Jackson 3 成为默认，Jackson 2 以废弃形式保留
- 自动配置类不再暴露 public 成员
- HTTP Service Client 自动配置
- 新增 `spring-boot-starter-opentelemetry`
- `spring.threads.virtual.enabled=true` 可启用虚拟线程
- `management.tracing.enabled` 改名 `management.tracing.export.enabled`
- `spring.dao.exceptiontranslation.enabled` 改名 `spring.persistence.exceptiontranslation.enabled`

# 项目结构与启动

典型结构：

```
src/main/java/com/example/app
  ├── AppApplication.java
  ├── config/
  ├── controller/
  ├── service/
  ├── repository/
  └── domain/
src/main/resources
  ├── application.yaml
  ├── application-prod.yaml
  ├── static/
  └── templates/
```

启动类：

```java
@SpringBootApplication
public class AppApplication {
    public static void main(String[] args) {
        SpringApplication.run(AppApplication.class, args);
    }
}
```

`@SpringBootApplication` 组合了：

- `@SpringBootConfiguration`
- `@EnableAutoConfiguration`
- `@ComponentScan`

默认扫描启动类所在包及子包。不要把启动类放在过高层级，避免扫描无关模块。

启动流程简化：

```
SpringApplication.run
  → 准备 Environment（配置、profile）
  → 创建 ApplicationContext
  → 加载 BeanDefinition
  → 执行 AutoConfiguration
  → refresh：实例化、注入、初始化
  → 启动内嵌容器
  → 发布 ApplicationReadyEvent
```

# 自动配置原理

自动配置的目标：根据 classpath、已有 Bean、配置属性，自动装配“合理默认值”。

## 条件装配

核心注解：

- `@ConditionalOnClass`
- `@ConditionalOnMissingClass`
- `@ConditionalOnBean`
- `@ConditionalOnMissingBean`
- `@ConditionalOnProperty`
- `@ConditionalOnWebApplication`
- `@ConditionalOnResource`
- `@ConditionalOnExpression`

示例：

```java
@AutoConfiguration
@ConditionalOnClass(DataSource.class)
@ConditionalOnProperty(name = "app.datasource.enabled", havingValue = "true", matchIfMissing = true)
public class AppDataSourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    DataSource dataSource(AppDataSourceProperties props) {
        return DataSourceBuilder.create()
            .url(props.url())
            .username(props.username())
            .password(props.password())
            .build();
    }
}
```

## 注册自动配置

Spring Boot 3+/4 使用：

```
META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

内容：

```
com.example.autoconfig.AppDataSourceAutoConfiguration
```

旧的 `spring.factories` 不再用于自动配置注册。

## 条件评估顺序

- 先判断 classpath
- 再判断 Bean 是否存在
- 再判断属性
- 最后才创建 Bean

常见问题：

- 自己定义了 Bean，但自动配置仍然生效：检查是否 `@ConditionalOnMissingBean`、Bean 名称/类型是否匹配
- 自动配置没生效：`--debug` 查看 conditions report
- 自动配置顺序：用 `@AutoConfigureBefore`/`@AutoConfigureAfter`，不要依赖扫描顺序

## 覆盖自动配置

- 自己声明同类型 Bean
- `@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)`
- `spring.autoconfigure.exclude=...`
- 用 `@ConfigurationProperties` 调整参数，而不是复制整套配置

# 配置体系

## 配置来源优先级

从高到低（简化）：

1. 命令行参数
2. `SPRING_APPLICATION_JSON`
3. ServletConfig/ServletContext 参数
4. JNDI
5. Java System properties
6. OS 环境变量
7. `random.*`
8. profile-specific 外部配置
9. profile-specific 打包内配置
10. 外部 `application.*`
11. 打包内 `application.*`
12. `@PropertySource`
13. 默认属性

实践：

- 容器环境用环境变量覆盖
- 不要把生产密码写进 jar
- 用 `spring.config.import` 引入外部配置
- 配置优先级要写进 runbook

## application.yaml

```yaml
spring:
  application:
    name: order-service
  profiles:
    active: prod
  config:
    import: optional:file:/etc/app/secret.yaml
server:
  port: 8080
```

多 profile：

```yaml
spring:
  profiles:
    group:
      prod: prod-db,prod-mq
```

`application-prod.yaml` 覆盖 `application.yaml`；多个 profile 时最后一个生效。

## @ConfigurationProperties

```java
@ConfigurationProperties(prefix = "app.order")
@Validated
public record OrderProperties(
    @NotBlank String endpoint,
    @Min(1) @Max(100) int maxRetries,
    Duration timeout
) {}
```

启用：

```java
@SpringBootApplication
@ConfigurationPropertiesScan
public class AppApplication {}
```

优点：

- 类型安全
- 集中管理
- 支持校验
- 生成 metadata，IDE 可提示

注意：

- 构造器绑定需要 `@ConstructorBinding` 或 record
- 默认值用 `@DefaultValue`
- 嵌套对象、List、Map 都支持
- 不要把 `@ConfigurationProperties` 和 `@Component` 混用导致重复注册

## 配置校验

```java
@ConfigurationProperties(prefix = "app.payment")
@Validated
public class PaymentProperties {
    @NotBlank
    private String url;
    @DurationMin(seconds = 1)
    private Duration timeout;
}
```

启动时失败比运行时报错好。

## 配置元数据

引入：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-configuration-processor</artifactId>
  <optional>true</optional>
</dependency>
```

IDE 会提示属性、类型、默认值。

## 配置加密

Spring Boot 不内置配置加密。常见：

- Vault
- AWS Secrets Manager
- Kubernetes Secret
- Jasypt（谨慎，密钥管理仍是问题）
- 云 KMS

不要把密钥和密文放在同一个仓库。

# Bean 生命周期与依赖注入

## 生命周期

```
实例化
  → 属性填充
  → Aware 回调
  → BeanPostProcessor.before
  → @PostConstruct / InitializingBean
  → 自定义 init-method
  → BeanPostProcessor.after（AOP 代理在这里）
  → 使用
  → @PreDestroy / DisposableBean
  → 自定义 destroy-method
```

## 注入方式

- 构造器注入：推荐，依赖不可变、易测试
- Setter 注入：可选依赖
- 字段注入：不推荐，隐藏依赖、难测试

```java
@Service
public class OrderService {
    private final OrderRepository repository;

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }
}
```

## 作用域

- `singleton`：默认
- `prototype`：每次获取新实例
- `request`/`session`/`application`：Web 作用域
- 自定义 scope

注意：

- singleton 注入 prototype 只会注入一次
- 需要每次新实例用 `ObjectProvider`
- request scope 在异步线程中不可用

## 条件与 Profile

```java
@Configuration
@Profile("prod")
public class ProdConfig {}

@Bean
@ConditionalOnProperty(name = "app.cache.enabled", havingValue = "true")
Cache cache() { ... }
```

## AOP 代理

`@Transactional`、`@Async`、`@Cacheable`、`@Retryable` 都依赖代理。

限制：

- 同类内部调用不经过代理，事务/异步/缓存失效
- private/final 方法不能被 CGLIB 代理
- 代理对象注入要按接口或类正确使用
- 自调用改用 `TransactionTemplate`、拆类或 `AopContext.currentProxy()`

# Web 开发

## REST Controller

```java
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse create(@Valid @RequestBody CreateOrderRequest req) {
        return service.create(req);
    }
}
```

## 参数校验

```java
public record CreateOrderRequest(
    @NotNull Long userId,
    @NotEmpty List<@Valid OrderItem> items
) {}
```

- `@Valid` 触发 Bean Validation
- 方法级 `@Validated` 支持 `@RequestParam` 校验
- 自定义约束实现 `ConstraintValidator`
- 校验失败返回 400，统一异常处理

## 统一异常处理

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    public ProblemDetail notFound(OrderNotFoundException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
        pd.setTitle("Order not found");
        pd.setProperty("orderId", e.getOrderId());
        return pd;
    }
}
```

Spring Framework 6+/Boot 3+ 支持 `ProblemDetail`（RFC 9457），比自定义错误结构更标准。

## 过滤器与拦截器

- `Filter`：Servlet 层，能改 request/response，适合认证、日志、CORS、压缩
- `HandlerInterceptor`：Spring MVC 层，能访问 Handler，适合权限、审计
- `@ControllerAdvice`：全局异常/数据绑定
- `OncePerRequestFilter`：避免重复执行

## 内容协商

- `produces`/`consumes`
- `Accept` 头
- Jackson 3 默认
- 自定义 `HttpMessageConverter`

## 静态资源与上传

- `src/main/resources/static`
- `spring.web.resources.*`
- multipart：`spring.servlet.multipart.max-file-size`、`max-request-size`
- 大文件用流式处理，不要全部读入内存

## 虚拟线程

```properties
spring.threads.virtual.enabled=true
```

- Tomcat 请求处理可用虚拟线程
- 自动配置的 HTTP 客户端也会使用虚拟线程
- 阻塞代码受益明显
- 注意 `synchronized` 导致的 pinning（JDK 24+ 有改进，但仍要评估）
- 不要用虚拟线程替代连接池/限流

# HTTP 客户端

## RestClient

Spring 6.1+ 的同步客户端，替代 `RestTemplate`：

```java
@Bean
RestClient restClient(RestClient.Builder builder) {
    return builder
        .baseUrl("https://api.example.com")
        .defaultHeader("X-Client", "order-service")
        .build();
}
```

调用：

```java
OrderResponse resp = restClient.get()
    .uri("/orders/{id}", id)
    .retrieve()
    .body(OrderResponse.class);
```

## HTTP Service Client

```java
@HttpExchange(url = "https://api.example.com")
public interface OrderClient {

    @GetExchange("/orders/{id}")
    OrderResponse get(@PathVariable Long id);
}
```

启用：

```java
@Configuration
@EnableHttpServiceClients
public class HttpClientConfig {}
```

Spring Boot 4 提供自动配置和属性支持。

## WebClient

- 响应式/非阻塞
- 适合高并发、流式
- 不要在 MVC 线程里 `block()`
- 配置连接池、超时、重试、指标

## 超时与重试

- 连接超时、读超时都要设
- 重试只对幂等请求
- 配合熔断/限流（Resilience4j 等）
- 记录下游延迟和错误率

# 数据访问

## JDBC

- `JdbcClient`（Spring 6.1+）或 `JdbcTemplate`
- HikariCP 默认连接池
- 显式 SQL，性能可控
- 适合复杂查询/批量

```java
List<Order> orders = jdbcClient.sql("select * from orders where user_id = :id")
    .param("id", userId)
    .query(Order.class)
    .list();
```

## JPA / Hibernate

```java
@Entity
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private long version;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();
}
```

常见问题：

- N+1：用 `@EntityGraph`、fetch join、批量抓取
- 懒加载在事务外失败：DTO 投影或在事务内组装
- 大结果集：分页/流式
- 乐观锁：`@Version` + 重试
- 双向关系：维护一致性，避免无限递归（用 DTO）

## Repository

```java
public interface OrderRepository extends JpaRepository<Order, Long> {
    @EntityGraph(attributePaths = "items")
    Optional<Order> findWithItemsById(Long id);
}
```

- 方法名查询适合简单条件
- 复杂查询用 `@Query`/Specification/Querydsl
- 分页用 `Pageable`
- 投影用 interface/record DTO，避免实体泄漏

## 迁移

- Flyway/Liquibase
- 迁移脚本版本化，禁止手工改生产库
- 大表变更评估锁和回滚
- 迁移与应用发布解耦

## 连接池

```properties
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=3000
spring.datasource.hikari.max-lifetime=1800000
```

- 池大小按数据库容量和并发，不是越大越好
- 连接泄漏会耗尽池
- 监控 active/idle/pending

# 事务与并发

## @Transactional

```java
@Transactional
public void createOrder(CreateOrderRequest req) {
    Order order = orderRepository.save(...);
    inventoryService.deduct(...);
}
```

关键属性：

- `propagation`：REQUIRED、REQUIRES_NEW、NESTED 等
- `isolation`：READ_COMMITTED、REPEATABLE_READ 等
- `readOnly`
- `timeout`
- `rollbackFor`/`noRollbackFor`

默认：

- 运行时异常回滚
- 受检异常不回滚（需显式配置）
- 只对 public 方法生效（代理限制）

## 常见坑

- 同类自调用，事务不生效
- 异常被 catch 后没抛出，事务不回滚
- 事务中调用远程服务，长事务占用连接
- `@Transactional` 放在 private/final 方法
- 多数据源时事务管理器不匹配
- 异步线程不继承事务

## 事务模板

需要细粒度控制时：

```java
transactionTemplate.execute(status -> {
    // ...
    return result;
});
```

## 异步

```java
@Async("taskExecutor")
public CompletableFuture<Result> doAsync() { ... }
```

- 自定义 `TaskExecutor`，不要用默认无界队列
- 处理异常（`AsyncUncaughtExceptionHandler`）
- 事务上下文不传播
- 优雅停机要等待任务

## 调度

```java
@Scheduled(cron = "0 0 2 * * *")
public void dailyJob() { ... }
```

- 多实例会重复执行，需要分布式锁/调度平台
- 任务要幂等
- 长任务不要阻塞调度线程池
- 配置 `spring.task.scheduling.pool.size`

# 安全

## SecurityFilterChain

```java
@Bean
SecurityFilterChain security(HttpSecurity http) throws Exception {
    http
        .csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health/**").permitAll()
            .anyRequest().authenticated())
        .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
    return http.build();
}
```

## OAuth2/JWT

```properties
spring.security.oauth2.resourceserver.jwt.issuer-uri=https://issuer.example.com
```

- 校验 issuer、audience、过期时间
- 自定义 `JwtAuthenticationConverter` 映射权限
- 不要自己解析 JWT 而不校验签名
- 时钟偏差要留余量

## 方法安全

```java
@PreAuthorize("hasRole('ADMIN')")
public void delete(Long id) { ... }
```

需要 `@EnableMethodSecurity`。

## CORS/CSRF

- 前后端分离通常关闭 CSRF（用 token 认证）
- 使用 Cookie 会话时要防 CSRF
- CORS 明确 allowedOrigins，不要 `*` + credentials

## 密码

- `BCryptPasswordEncoder`/`Argon2PasswordEncoder`
- 不要用 MD5/SHA1
- 不要在日志打印密码/token

# Actuator 与可观测性

## 依赖

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

## 暴露端点

```properties
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.endpoint.health.show-details=when_authorized
```

生产不要暴露 `env`、`heapdump`、`threaddump` 给公网。

## 健康检查与探针

```properties
management.endpoint.health.probes.enabled=true
```

- `/actuator/health/liveness`
- `/actuator/health/readiness`
- Kubernetes 用 liveness/readiness/startup probes
- readiness 要包含数据库/下游关键依赖
- liveness 不要包含外部依赖，避免雪崩重启

## 指标

- Micrometer `MeterRegistry`
- `@Timed`、`@Counted`、`@Observed`
- HTTP server/client 指标
- JVM、Hikari、Tomcat、Kafka 等
- Prometheus endpoint 或 OTLP

## 追踪

- Micrometer Tracing + OpenTelemetry
- `spring-boot-starter-opentelemetry`
- W3C trace context
- 日志关联 traceId/spanId
- 采样率按流量调整

## 日志

- Logback 默认
- 结构化日志（JSON）
- 请求 ID/MDC
- 不要记录敏感信息
- `logging.console.enabled=false` 可关闭控制台

# 测试

## @SpringBootTest

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OrderApiTest {
    @Autowired TestRestTemplate rest;
}
```

- 启动完整上下文，慢
- 尽量复用上下文缓存
- 不要在每个测试改配置导致新上下文

## 切片测试

- `@WebMvcTest`：Controller 层
- `@DataJpaTest`：JPA + 内存库/Testcontainers
- `@JsonTest`：JSON 序列化
- `@RestClientTest`：HTTP 客户端
- `@JdbcTest`：JDBC

切片测试快，但只覆盖一层。

## Mock

- Spring Boot 3.4+ 使用 `@MockitoBean` 替代 `@MockBean`
- `@MockitoSpyBean` 替代 `@SpyBean`
- 不要 mock 掉被测对象

## Testcontainers

```java
@Testcontainers
@SpringBootTest
class OrderRepositoryTest {
    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");
}
```

- 真实数据库/中间件
- `@ServiceConnection` 自动注入连接信息
- CI 需要 Docker
- 容器启动慢，注意复用

## 测试配置

- `application-test.yaml`
- `@DynamicPropertySource`
- `@TestPropertySource`
- 随机端口
- 不要依赖生产数据

# AOT 与原生镜像

## AOT

Spring Boot 支持 AOT 处理：

- 提前生成 Bean 定义、代理、反射提示
- 缩短启动时间
- 为 GraalVM native image 做准备

```bash
mvn -Pnative native:compile
```

或 Buildpacks：

```bash
mvn spring-boot:build-image -Pnative
```

## 原生镜像限制

- 反射、动态代理、JNI 需要 hints
- 类路径在构建时固定
- 启动快、内存低，但构建慢
- 不适合频繁动态加载类的应用
- 测试要覆盖 native 模式

注册反射：

```java
@RegisterReflectionForBinding(OrderResponse.class)
```

或实现 `RuntimeHintsRegistrar`。

# 打包与部署

## 可执行 Jar

```bash
mvn clean package
java -jar target/app.jar
```

Spring Boot Maven Plugin 生成可执行 jar。

## 分层 Jar

用于 Docker 缓存：

```xml
<layers>
  <enabled>true</enabled>
</layers>
```

```bash
java -Djarmode=tools -jar app.jar extract --layers --destination extracted
```

## Buildpacks

```bash
mvn spring-boot:build-image
```

- 不需要写 Dockerfile
- 自动分层、JVM 优化
- 可定制 builder

## Dockerfile

```dockerfile
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY target/app.jar app.jar
USER 10001
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75.0","-jar","/app.jar"]
```

## Kubernetes

```yaml
livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8080
readinessProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 8080
```

优雅停机：

```properties
server.shutdown=graceful
spring.lifecycle.timeout-per-shutdown-phase=30s
```

- 先摘流量，再停机
- 处理 SIGTERM
- 等待进行中的请求完成

# 性能与调优

## Tomcat

```properties
server.tomcat.threads.max=200
server.tomcat.threads.min-spare=20
server.tomcat.accept-count=100
server.tomcat.max-connections=8192
```

- 线程数不是越大越好
- 阻塞 IO 多时增加线程/虚拟线程
- 连接数受文件句柄和内存限制
- 监控 busy threads、queue、latency

## 虚拟线程

- 适合大量阻塞 IO
- 减少线程池大小
- 注意 pinning（synchronized/native）
- 数据库连接池仍是瓶颈
- 压测验证

## 连接池

- Hikari 最大连接数 = 数据库容量 / 实例数
- 连接等待时间要短
- 监控 active/idle/pending/timeout

## 缓存

- `@Cacheable`、Caffeine、Redis
- 缓存穿透/击穿/雪崩
- TTL、容量、一致性
- 不要缓存敏感数据

## JVM

- 容器感知 `MaxRAMPercentage`
- G1/ZGC 按延迟要求
- GC 日志/JFR
- 堆外内存（Netty）要计入容器 limit

# 常见坑

- `@Transactional` 自调用失效
- `@Async` 自调用失效
- 字段注入导致循环依赖/难测试
- `@ConfigurationProperties` 没加 `@EnableConfigurationProperties`/`@ConfigurationPropertiesScan`
- profile 配置覆盖顺序搞错
- 自动配置排除后忘了补 Bean
- N+1 查询
- 懒加载在事务外
- 大事务占用连接
- 连接池太小/太大
- Actuator 暴露敏感端点
- JWT 不校验签名/issuer
- CORS 配置过宽
- Jackson 2→3 包名/行为变化
- native image 反射缺失
- 测试上下文缓存被破坏
- 依赖冲突（Jakarta/Servlet/Jackson）
- 用 `spring.jpa.hibernate.ddl-auto=update` 上生产
- 生产开 `devtools`
- 日志打印敏感信息

# 企业实践

## 分层与边界

- Controller 只做协议适配
- Service 承载业务和事务
- Repository 只做数据访问
- DTO 与实体分离
- 不要让 JPA 实体直接暴露到 API

## 配置管理

- 12-factor：配置与环境分离
- 生产配置走 ConfigMap/Secret/Vault
- 配置变更可审计、可回滚
- 启动时校验配置
- 敏感配置不落盘

## 可观测性

- 指标、日志、追踪统一
- 关键接口 SLO
- 错误率/延迟/饱和度
- 启动/关闭事件
- 依赖健康

## 发布

- 灰度/金丝雀
- 数据库迁移向前兼容
- 健康探针
- 优雅停机
- 回滚方案

## 安全

- 依赖漏洞扫描
- 最小权限
- 密钥轮换
- 安全响应头
- 输入校验
- 审计日志

## 测试

- 单元 + 切片 + 集成 + 契约
- Testcontainers
- native 测试
- 性能基线

# 附录

## 常用注解

- `@SpringBootApplication`
- `@Configuration`
- `@Bean`
- `@ConfigurationProperties`
- `@EnableConfigurationProperties`
- `@ConditionalOn*`
- `@Transactional`
- `@Async`
- `@Scheduled`
- `@RestController`
- `@ControllerAdvice`
- `@Validated`
- `@PreAuthorize`
- `@Observed`/`@Timed`

## 常用配置

```properties
spring.application.name=app
server.port=8080
spring.profiles.active=prod
spring.threads.virtual.enabled=true
spring.datasource.hikari.maximum-pool-size=20
spring.jpa.open-in-view=false
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.endpoint.health.probes.enabled=true
server.shutdown=graceful
```

## 官方参考

- [Spring Boot 4.1.2 Documentation](https://docs.spring.io/spring-boot/)
- [System Requirements](https://docs.spring.io/spring-boot/system-requirements.html)
- [Auto-configuration](https://docs.spring.io/spring-boot/reference/using/auto-configuration.html)
- [Externalized Configuration](https://docs.spring.io/spring-boot/reference/features/external-config.html)
- [Observability](https://docs.spring.io/spring-boot/reference/actuator/observability.html)
- [Testing](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)
- [GraalVM Native Images](https://docs.spring.io/spring-boot/reference/packaging/native-image/introducing-graalvm-native-images.html)
- [Spring Boot 4.0 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Release-Notes)

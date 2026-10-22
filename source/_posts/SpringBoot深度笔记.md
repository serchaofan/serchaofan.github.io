---
title: Spring Boot 保姆级教程
tags: [Spring Boot, Java, Spring Framework, 微服务]
categories: [Java]
date: 2026-10-22 17:40:00
comments: false
---

本文基于 **Spring Boot 4.1.2** 官方文档编写，分成「教程篇」和「原理篇」：教程篇从装 JDK 开始，带你做一个能跑、能测、能部署的订单服务；原理篇再拆自动配置、Bean 生命周期、Web、数据、事务、安全、可观测性和测试。没有 Spring Boot 经验也能跟着做。

<!--more-->

- [教程篇：从 0 到 1 做订单服务](#%E6%95%99%E7%A8%8B%E7%AF%87%E4%BB%8E-0-%E5%88%B0-1-%E5%81%9A%E8%AE%A2%E5%8D%95%E6%9C%8D%E5%8A%A1)
- [原理篇](#%E5%8E%9F%E7%90%86%E7%AF%87)
- [先看全局：Spring Boot 是什么](#%E5%85%88%E7%9C%8B%E5%85%A8%E5%B1%80spring-boot-%E6%98%AF%E4%BB%80%E4%B9%88)
- [从 main() 到一次 HTTP 请求](#%E4%BB%8E-main-%E5%88%B0%E4%B8%80%E6%AC%A1-http-%E8%AF%B7%E6%B1%82)
- [组件地图](#%E7%BB%84%E4%BB%B6%E5%9C%B0%E5%9B%BE)
- [注解词典](#%E6%B3%A8%E8%A7%A3%E8%AF%8D%E5%85%B8)
- [版本与基线](#%E7%89%88%E6%9C%AC%E4%B8%8E%E5%9F%BA%E7%BA%BF)
- [项目结构与启动](#%E9%A1%B9%E7%9B%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E5%90%AF%E5%8A%A8)
- [自动配置原理](#%E8%87%AA%E5%8A%A8%E9%85%8D%E7%BD%AE%E5%8E%9F%E7%90%86)
- [配置体系](#%E9%85%8D%E7%BD%AE%E4%BD%93%E7%B3%BB)
- [Bean 生命周期与依赖注入](#bean-%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F%E4%B8%8E%E4%BE%9D%E8%B5%96%E6%B3%A8%E5%85%A5)
- [Web 开发](#web-%E5%BC%80%E5%8F%91)
- [HTTP 客户端](#http-%E5%AE%A2%E6%88%B7%E7%AB%AF)
- [数据访问](#%E6%95%B0%E6%8D%AE%E8%AE%BF%E9%97%AE)
- [事务与并发](#%E4%BA%8B%E5%8A%A1%E4%B8%8E%E5%B9%B6%E5%8F%91)
- [安全](#%E5%AE%89%E5%85%A8-1)
- [Actuator 与可观测性](#actuator-%E4%B8%8E%E5%8F%AF%E8%A7%82%E6%B5%8B%E6%80%A7)
- [测试](#%E6%B5%8B%E8%AF%95-1)
- [AOT 与原生镜像](#aot-%E4%B8%8E%E5%8E%9F%E7%94%9F%E9%95%9C%E5%83%8F)
- [打包与部署](#%E6%89%93%E5%8C%85%E4%B8%8E%E9%83%A8%E7%BD%B2)
- [性能与调优](#%E6%80%A7%E8%83%BD%E4%B8%8E%E8%B0%83%E4%BC%98)
- [常见坑](#%E5%B8%B8%E8%A7%81%E5%9D%91-1)
- [企业实践](#%E4%BC%81%E4%B8%9A%E5%AE%9E%E8%B7%B5)
- [附录](#%E9%99%84%E5%BD%95)

# 教程篇：从 0 到 1 做订单服务

这一篇按顺序做，不要跳步。每一步都有代码、命令和预期结果；报错时先看第 13 节。

## 0. 你将做出什么

最终你会有一个订单服务：

- `POST /api/orders` 创建订单
- `GET /api/orders/{id}` 查询订单
- PostgreSQL 持久化 + Flyway 建表
- 参数校验、统一错误响应
- Basic Auth 保护接口
- Actuator 健康检查
- 单元/切片/集成测试
- 可执行 jar 和 Docker 镜像

技术栈：

- Spring Boot 4.1.x
- Java 17+（教程用 Java 25 LTS）
- Maven
- PostgreSQL 17
- Docker

## 1. 准备环境

安装并验证：

```bash
java -version
mvn -version
docker --version
```

预期：

- Java 17 或更高
- Maven 3.6.3 或更高
- Docker 可用

如果 `java -version` 不是 17+，先装 JDK 25 LTS。不要用 IDE 自带的老 JDK 运行。

## 2. 创建项目

打开 <https://start.spring.io>，选择：

- Project：Maven
- Language：Java
- Spring Boot：4.1.x
- Java：25
- Group：`com.example`
- Artifact：`orders`
- Dependencies：
  - Spring Web
  - Validation
  - Spring Data JPA
  - PostgreSQL Driver
  - Flyway Migration
  - Spring Boot Actuator
  - Testcontainers

生成并解压，或用命令行：

```bash
curl -G https://start.spring.io/starter.zip \
  -d type=maven-project \
  -d language=java \
  -d javaVersion=25 \
  -d groupId=com.example \
  -d artifactId=orders \
  -d name=orders \
  -d packageName=com.example.orders \
  -d dependencies=web,validation,data-jpa,postgresql,flyway,actuator,testcontainers \
  -o orders.zip
unzip orders.zip -d orders
cd orders
```

初始结构：

```
orders/
├── pom.xml
├── mvnw
├── src/main/java/com/example/orders/OrdersApplication.java
├── src/main/resources/application.properties
└── src/test/java/com/example/orders/OrdersApplicationTests.java
```

`pom.xml` 里最重要的是：

```xml
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>4.1.2</version>
</parent>
```

parent 负责依赖版本管理；starter 负责把一组依赖打包给你。

## 3. 第一次启动

把 `application.properties` 改名为 `application.yaml`（也可以保留 properties），先不配数据库：

```yaml
spring:
  application:
    name: orders
server:
  port: 8080
```

启动：

```bash
./mvnw spring-boot:run
```

Windows 用：

```bash
mvnw.cmd spring-boot:run
```

预期日志：

```text
Tomcat started on port 8080 (http)
Started OrdersApplication in 2.3 seconds
```

验证：

```bash
curl -i http://localhost:8080/actuator/health
```

预期：

```json
{"status":"UP"}
```

如果 404，检查 `spring-boot-starter-actuator` 是否在 `pom.xml`；如果 401，说明你提前加了 Security，先移除或看第 9 节。

停止：`Ctrl+C`。

## 4. 第一个接口

先不接数据库，返回一个假订单，确认 Web 链路通。

`src/main/java/com/example/orders/api/CreateOrderRequest.java`：

```java
package com.example.orders.api;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateOrderRequest(
    @NotNull Long userId,
    @NotNull @DecimalMin("0.01") BigDecimal amount
) {}
```

`OrderResponse.java`：

```java
package com.example.orders.api;

import java.math.BigDecimal;

public record OrderResponse(
    Long id,
    Long userId,
    BigDecimal amount,
    String status
) {}
```

`OrderController.java`：

```java
package com.example.orders.api;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse create(@Valid @RequestBody CreateOrderRequest request) {
        return new OrderResponse(1L, request.userId(), request.amount(), "CREATED");
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable Long id) {
        return new OrderResponse(id, 1L, new java.math.BigDecimal("99.90"), "CREATED");
    }
}
```

重启后调用：

```bash
curl -i -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"amount":99.90}'
```

预期：

```http
HTTP/1.1 201
Content-Type: application/json

{"id":1,"userId":1,"amount":99.90,"status":"CREATED"}
```

查询：

```bash
curl http://localhost:8080/api/orders/1
```

这一步发生了什么：

- `@RestController` 把类注册成 Bean，并把返回值写进响应体
- `@RequestMapping("/api/orders")` 给类加统一前缀
- `@PostMapping` 映射 POST 请求
- `@RequestBody` 用 Jackson 3 把 JSON 转成 `CreateOrderRequest`
- `@Valid` 触发 Jakarta Validation
- `@PathVariable` 把 URL 里的 `{id}` 绑定到参数

## 5. 参数校验与统一错误

请求体加了 `@NotNull`、`@DecimalMin`，但校验失败默认返回 400，结构不统一。加一个全局处理器。

`src/main/java/com/example/orders/api/ApiExceptionHandler.java`：

```java
package com.example.orders.api;

import java.net.URI;
import java.util.NoSuchElementException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail validation(MethodArgumentNotValidException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST, "request validation failed");
        pd.setTitle("Invalid request");
        pd.setType(URI.create("https://example.com/problems/validation"));
        pd.setProperty("errors", ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .toList());
        return pd;
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ProblemDetail notFound(NoSuchElementException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setTitle("Resource not found");
        return pd;
    }
}
```

测试非法请求：

```bash
curl -i -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"amount":0}'
```

预期 400，响应是 `application/problem+json`，包含 `errors`。

解释：

- `@RestControllerAdvice` 对所有 Controller 生效
- `@ExceptionHandler` 指定处理的异常类型
- `ProblemDetail` 是 RFC 9457 标准错误结构，比自定义 `{code,msg}` 更通用

## 6. 连接 PostgreSQL

先启动数据库。`compose.yaml`：

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: orders
      POSTGRES_USER: orders
      POSTGRES_PASSWORD: orders
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

启动：

```bash
docker compose up -d
docker compose ps
```

`application.yaml` 加数据源：

```yaml
spring:
  application:
    name: orders
  datasource:
    url: jdbc:postgresql://localhost:5432/orders
    username: orders
    password: orders
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true

server:
  port: 8080
```

建表脚本 `src/main/resources/db/migration/V1__create_orders.sql`：

```sql
create table orders (
    id         bigserial primary key,
    user_id    bigint not null,
    amount     numeric(12, 2) not null,
    status     varchar(32) not null,
    version    bigint not null default 0,
    created_at timestamptz not null default now()
);
```

重启应用。预期日志出现 Flyway 迁移成功，Hibernate 校验通过。

如果报 `Connection refused`：数据库没起或端口不对。  
如果报 `Flyway validate failed`：不要改已经执行过的迁移文件，新增 `V2__...sql`。

## 7. 用 JPA 读写订单

`src/main/java/com/example/orders/domain/Order.java`：

```java
package com.example.orders.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @Version
    private long version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Order() {}

    public Order(Long userId, BigDecimal amount) {
        this.userId = userId;
        this.amount = amount;
        this.status = OrderStatus.CREATED;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public BigDecimal getAmount() { return amount; }
    public OrderStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
}
```

`OrderStatus.java`：

```java
package com.example.orders.domain;

public enum OrderStatus {
    CREATED, PAID, CANCELLED
}
```

`OrderRepository.java`：

```java
package com.example.orders.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {}
```

`OrderService.java`：

```java
package com.example.orders.service;

import com.example.orders.api.*;
import com.example.orders.domain.*;
import java.util.NoSuchElementException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private final OrderRepository repository;

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public OrderResponse create(CreateOrderRequest request) {
        Order order = repository.save(new Order(request.userId(), request.amount()));
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public OrderResponse get(Long id) {
        return repository.findById(id)
            .map(this::toResponse)
            .orElseThrow(() -> new NoSuchElementException("order " + id));
    }

    private OrderResponse toResponse(Order order) {
        return new OrderResponse(
            order.getId(), order.getUserId(), order.getAmount(), order.getStatus().name());
    }
}
```

改 Controller，注入 Service：

```java
package com.example.orders.api;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final com.example.orders.service.OrderService service;

    public OrderController(com.example.orders.service.OrderService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse create(@Valid @RequestBody CreateOrderRequest request) {
        return service.create(request);
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable Long id) {
        return service.get(id);
    }
}
```

重启并测试：

```bash
curl -i -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"amount":99.90}'
```

这次 `id` 来自数据库，重启后数据仍在。

解释：

- `@Entity` 告诉 JPA 这是表映射
- `@Id` + `@GeneratedValue` 声明主键和生成策略
- `@Version` 做乐观锁
- `@Transactional` 在 Service 外层开事务；Controller 不要直接写事务
- `JpaRepository` 由 Spring Data 自动生成实现，不需要写实现类

## 8. 配置属性

`src/main/java/com/example/orders/config/OrderProperties.java`：

```java
package com.example.orders.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.order")
public record OrderProperties(
    @NotNull Duration paymentTimeout,
    @Min(1) int maxItems
) {}
```

在启动类加 `@ConfigurationPropertiesScan`：

```java
@SpringBootApplication
@ConfigurationPropertiesScan
public class OrdersApplication { ... }
```

`application.yaml`：

```yaml
app:
  order:
    payment-timeout: 30s
    max-items: 20
```

在 Service 里注入即可：

```java
在 `OrderService` 构造器里注入 `OrderProperties` 即可，Spring Boot 会按 `app.order.*` 自动绑定。
```

解释：

- `@ConfigurationProperties` 把一组配置绑定到对象
- `@Validated` + Jakarta Validation 在启动时校验
- record 用构造器绑定，配置缺失会启动失败，比运行时才发现好

## 9. 加安全认证

加依赖：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

`SecurityConfig.java`：

```java
package com.example.orders.config;

import org.springframework.context.annotation.*;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health/**").permitAll()
                .anyRequest().authenticated())
            .httpBasic(Customizer.withDefaults());
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService users(PasswordEncoder encoder) {
        UserDetails user = User.withUsername("demo")
            .password(encoder.encode("demo"))
            .roles("USER")
            .build();
        return new InMemoryUserDetailsManager(user);
    }
}
```

调用：

```bash
curl -u demo:demo http://localhost:8080/api/orders/1
```

不带认证会返回 401。

说明：

- `SecurityFilterChain` 是 Security 7 的配置方式
- `authorizeHttpRequests` 控制 URL 权限
- `PasswordEncoder` 用 BCrypt，不要明文存密码
- 教程用内存用户；生产用 OAuth2/JWT 或数据库用户

## 10. Actuator 健康检查

`application.yaml`：

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      probes:
        enabled: true
```

访问：

```bash
curl -s http://localhost:8080/actuator/health
curl -s http://localhost:8080/actuator/health/liveness
curl -s http://localhost:8080/actuator/health/readiness
```

- liveness：进程是否活着，不要包含外部依赖
- readiness：是否可以接流量，包含数据库等关键依赖
- 生产不要把 `env`、`heapdump` 暴露到公网

## 11. 写测试

### 11.1 Web 切片测试

```java
package com.example.orders.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.orders.service.OrderService;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(OrderController.class)
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc(addFilters = false)
class OrderControllerTest {

    @Autowired MockMvc mvc;

    @MockitoBean OrderService service;

    @Test
    void createReturns201() throws Exception {
        when(service.create(any())).thenReturn(
            new OrderResponse(1L, 1L, new BigDecimal("99.90"), "CREATED"));

        mvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"userId":1,"amount":99.90}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(1));
    }
}
```

### 11.2 数据层 + Testcontainers

```java
package com.example.orders.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class OrderRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @Autowired OrderRepository repository;

    @Test
    void savesOrder() {
        Order saved = repository.save(new Order(1L, new BigDecimal("10.00")));
        assertThat(saved.getId()).isNotNull();
    }
}
```

### 11.3 启动测试

```bash
./mvnw test
```

预期：`BUILD SUCCESS`。

常见问题：

- Docker 没启动，Testcontainers 起不来
- 上下文缓存被不同配置破坏，测试变慢
- `@MockitoBean` 替代旧的 `@MockBean`

## 12. 打包与部署

打包：

```bash
./mvnw clean package
java -jar target/orders-0.0.1-SNAPSHOT.jar
```

Dockerfile：

```dockerfile
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY target/orders-0.0.1-SNAPSHOT.jar app.jar
USER 10001
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app.jar"]
```

构建运行：

```bash
docker build -t orders:1.0 .
docker run --rm -p 8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/orders \
  orders:1.0
```

Linux 上 `host.docker.internal` 默认不可用，改用宿主机 IP 或 `--network host`。

Kubernetes 探针和优雅停机：

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

```yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
```

## 13. 常见错误速查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 启动报 `UnsupportedClassVersionError` | JDK 太老 | 换 Java 17+ |
| 端口 8080 被占用 | 已有进程 | `server.port` 换端口 |
| `/actuator/health` 404 | 没加 actuator | 加 starter |
| 401 | Security 默认保护 | 配 `SecurityFilterChain` 或带认证 |
| 400 + `problem+json` | 参数校验失败 | 看 `errors` |
| 415 | Content-Type 不对 | 加 `application/json` |
| `Connection refused` | 数据库没起 | `docker compose up -d` |
| `No default constructor` | JPA 实体缺无参构造 | 加 `protected Order() {}` |
| `ddl-auto=validate` 失败 | 表结构和实体不一致 | 改 Flyway 脚本 |
| Flyway checksum mismatch | 改了已执行脚本 | 新增 V2，不要改 V1 |
| Testcontainers 起不来 | Docker 未启动/无权限 | 启动 Docker/检查 socket |
| 测试上下文反复重建 | 配置不同/`@MockBean` 不同 | 统一测试配置 |

## 14. 下一步

跟做完这一篇，你已经掌握：

- 项目创建、启动、配置
- REST 接口、参数校验、统一错误
- JPA、事务、Flyway
- 配置属性、安全、Actuator
- 测试、打包、Docker

接下来读「原理篇」：

- 自动配置为什么生效
- Bean 生命周期和代理
- 配置优先级
- 事务失效场景
- 测试切片
- 原生镜像

# 原理篇


# 先看全局：Spring Boot 是什么

## 没有 Spring Boot 时，你要做什么

用原生 Spring Framework 写一个 Web 服务，通常要手动做这些事：

1. 引入 Spring MVC、Jackson、Tomcat、日志、校验等一堆依赖，并解决版本冲突
2. 创建 `ApplicationContext`
3. 配置 `DispatcherServlet`
4. 启动内嵌 Tomcat 或部署 WAR
5. 配置 JSON 转换器、异常处理、静态资源
6. 配置数据源、连接池、事务管理器
7. 写启动脚本、健康检查、监控

Spring Boot 把这些“标准答案”固化下来：你加依赖、写少量配置、定义 Bean，剩下的它按约定装配好。

## Spring Boot 的三层能力

```
+------------------------------------------------------+
| 1. 依赖管理：starter + BOM                            |
|    你写 spring-boot-starter-web，它带来 MVC/Tomcat/JSON |
+------------------------------------------------------+
| 2. 自动配置：AutoConfiguration + 条件注解              |
|    检测 classpath 和已有 Bean，自动创建默认 Bean        |
+------------------------------------------------------+
| 3. 运行时：内嵌容器 + Actuator + 测试/打包/原生镜像     |
|    直接 java -jar 启动，自带健康检查和生产特性          |
+------------------------------------------------------+
```

一句话：**Spring Boot = Spring Framework + 约定好的默认配置 + 内嵌运行时 + 生产能力**。

## 你只需要关心三件事

- **依赖**：需要什么能力，加对应 starter
- **配置**：哪些默认值不适用，用 `application.yaml` 或环境变量覆盖
- **Bean**：哪些对象需要自己定义，用 `@Bean`/`@Component` 声明

其他事情，先假设 Spring Boot 已经做对了；不生效时再用 `--debug` 看条件报告。

## 约定优于配置

例如：

- 把 `application.yaml` 放在 `src/main/resources`，Boot 自动加载
- 启动类在根包，Boot 自动扫描子包
- 加 `spring-boot-starter-web`，Boot 自动启动 Tomcat 并注册 `DispatcherServlet`
- 配置了 `spring.datasource.url`，Boot 自动创建 `DataSource`
- 加 `spring-boot-starter-actuator`，自动暴露健康检查和指标

约定不是魔法，背后都是自动配置类和条件注解；后面会拆开讲。

# 从 main() 到一次 HTTP 请求

先跟着一条请求走一遍，建立整体地图。

## 启动阶段

```java
@SpringBootApplication
public class AppApplication {
    public static void main(String[] args) {
        SpringApplication.run(AppApplication.class, args);
    }
}
```

`SpringApplication.run` 大致做这些事：

1. **准备 Environment**：加载 `application.yaml`、环境变量、命令行参数、profile
2. **创建 ApplicationContext**：默认是 `AnnotationConfigServletWebServerApplicationContext`
3. **扫描 BeanDefinition**：`@ComponentScan` 找到 `@Component/@Service/@Repository/@Controller`
4. **执行自动配置**：读取 `AutoConfiguration.imports`，按条件注册 Bean
5. **refresh**：实例化 Bean、依赖注入、执行 `BeanPostProcessor`、创建 AOP 代理
6. **启动内嵌容器**：Tomcat/Jetty 开始监听端口
7. **发布事件**：`ApplicationReadyEvent`，应用可用

关键点：

- `Environment` 先于 Bean 创建，所以配置能影响自动配置
- `BeanDefinition` 只是“配方”，refresh 时才真正创建对象
- AOP 代理在 `BeanPostProcessor` 阶段生成，所以自调用会绕过代理

## 请求阶段

```
浏览器/客户端
  → Tomcat（连接、线程池、HTTP 解析）
  → FilterChain（安全、CORS、日志、编码）
  → DispatcherServlet（前端控制器）
  → HandlerMapping（找到 Controller 方法）
  → HandlerAdapter（调用方法、参数绑定、校验）
  → Controller
  → Service
  → Repository / EntityManager
  → 数据库
  → HttpMessageConverter（对象转 JSON）
  → 响应
```

每一层对应一个组件：

- Tomcat：内嵌 Servlet 容器
- Filter：Servlet 规范，Spring Security 就在这一层
- DispatcherServlet：Spring MVC 的入口
- HandlerMapping：根据 URL 找 handler
- HandlerAdapter：负责调用 handler，处理 `@RequestParam`、`@RequestBody`、`@Valid`
- HttpMessageConverter：Jackson 3 负责 JSON
- `@ControllerAdvice`：异常处理
- `DataSource`/`EntityManager`：数据访问
- `@Transactional`：AOP 代理在 Service 方法外层开事务

## 你写的代码在哪一层

| 你写的 | 所在层 | 职责 |
| --- | --- | --- |
| `@RestController` | Web 层 | 接收 HTTP、返回响应 |
| `@Service` | 业务层 | 业务逻辑、事务边界 |
| `@Repository` | 数据层 | 数据访问 |
| `@Entity` | 领域模型 | 映射数据库表 |
| `@Configuration` | 配置层 | 声明 Bean |
| `@ConfigurationProperties` | 配置层 | 绑定配置 |
| `@ControllerAdvice` | Web 层 | 全局异常/绑定 |
| `Filter` | Servlet 层 | 请求前后处理 |
| `@Aspect` | 横切层 | 日志、权限、事务等 |

# 组件地图

| 组件 | 负责什么 | 被谁调用 | 在哪里见到 |
| --- | --- | --- | --- |
| `spring-boot-starter-*` | 一组依赖的集合 | Maven/Gradle | `pom.xml` |
| `spring-boot-autoconfigure` | 自动配置类 | Spring Boot | 依赖树、`--debug` |
| `AutoConfiguration.imports` | 自动配置注册表 | `@EnableAutoConfiguration` | `META-INF/spring/` |
| `ApplicationContext` | IoC 容器 | `SpringApplication` | 启动日志、`@Autowired` |
| `BeanFactory` | Bean 的底层工厂 | `ApplicationContext` | 很少直接接触 |
| `BeanDefinition` | Bean 的“配方” | 容器 | `@Bean`/扫描 |
| `BeanPostProcessor` | Bean 创建前后扩展 | 容器 | AOP、`@Async` |
| `Environment` | 配置和 profile | 容器 | `application.yaml` |
| `DispatcherServlet` | MVC 前端控制器 | Tomcat | Web 请求入口 |
| `HandlerMapping` | URL → handler | `DispatcherServlet` | `@RequestMapping` |
| `HandlerAdapter` | 调用 handler | `DispatcherServlet` | 参数绑定/校验 |
| `HttpMessageConverter` | 对象 ↔ JSON | MVC | Jackson 3 |
| `Filter` | Servlet 层拦截 | Tomcat | Security、CORS |
| `HandlerInterceptor` | MVC 层拦截 | `DispatcherServlet` | 权限、审计 |
| `DataSource` | 数据库连接 | JPA/JDBC | HikariCP |
| `EntityManager` | JPA 持久化上下文 | Repository | Hibernate 7 |
| `PlatformTransactionManager` | 事务管理 | `@Transactional` | 事务代理 |
| `Actuator` | 健康、指标、端点 | 运维/监控 | `/actuator/*` |
| `Micrometer` | 指标门面 | Actuator/应用 | `MeterRegistry` |
| `Spring TestContext` | 测试上下文缓存 | 测试框架 | `@SpringBootTest` |
| `AOT` | 启动时生成代码 | 构建/运行 | native image |
| `spring-boot-maven-plugin` | 打包/运行/镜像 | Maven | `mvn spring-boot:*` |

# 注解词典

按“用在哪里、解决什么问题”分组。初学时先记住每组 2–3 个核心注解，其余用到再查。

## 启动与容器

| 注解 | 作用 | 放在哪 | 常见坑 |
| --- | --- | --- | --- |
| `@SpringBootApplication` | 组合启动注解 | 启动类 | 只能有一个 |
| `@SpringBootConfiguration` | 标记配置类 | 启动类 | 被组合，很少单独用 |
| `@EnableAutoConfiguration` | 开启自动配置 | 配置类 | 排除自动配置时用 |
| `@ComponentScan` | 扫描组件 | 配置类 | 默认扫描当前包及子包 |
| `@Configuration` | 声明配置类 | 类 | `proxyBeanMethods=false` 可减代理 |
| `@Bean` | 声明 Bean | 方法 | 方法名默认是 Bean 名 |
| `@Import` | 导入配置/组件 | 配置类 | 不是扫描，是显式导入 |
| `@Component` | 通用组件 | 类 | 语义不如 `@Service` 清晰 |
| `@Service` | 业务组件 | 类 | 只是语义标记 |
| `@Repository` | 数据访问组件 | 类 | 会做异常转换 |
| `@Controller` | MVC 控制器 | 类 | 返回视图 |
| `@RestController` | REST 控制器 | 类 | = `@Controller` + `@ResponseBody` |
| `@ConfigurationProperties` | 绑定配置 | 类/record | 需要启用扫描或注册 |
| `@EnableConfigurationProperties` | 注册配置类 | 配置类 | 非扫描场景用 |
| `@ConfigurationPropertiesScan` | 扫描配置类 | 启动类 | 和 `@Component` 二选一 |
| `@Validated` | 开启校验 | 类/方法 | 分组校验要配合 `@Valid` |
| `@Profile` | 按环境启用 | 类/方法 | profile 覆盖顺序 |
| `@ConditionalOn*` | 条件装配 | 配置类/Bean | 条件不满足时静默跳过 |
| `@AutoConfiguration` | 自动配置类 | 类 | 需要注册到 imports 文件 |
| `@AutoConfigureBefore` | 自动配置顺序 | 类 | 不要依赖扫描顺序 |
| `@AutoConfigureAfter` | 自动配置顺序 | 类 | 同上 |
| `@Scope` | Bean 作用域 | 类/方法 | singleton 注入 prototype 只注入一次 |
| `@Lazy` | 延迟初始化 | 类/方法 | 启动快，但首次访问慢 |
| `@Primary` | 同类型首选 | 类/方法 | 多实现时用 |
| `@Qualifier` | 指定 Bean | 注入点 | 和 `@Primary` 配合 |
| `@DependsOn` | 依赖初始化顺序 | 类/方法 | 尽量用构造器依赖代替 |
| `@Order` | 排序 | 类/方法 | 只影响有序集合 |

## Web

| 注解 | 作用 | 放在哪 | 常见坑 |
| --- | --- | --- | --- |
| `@RequestMapping` | 映射 URL | 类/方法 | 方法级会继承类级 |
| `@GetMapping`/`@PostMapping` 等 | 指定 HTTP 方法 | 方法 | 不要用 `@RequestMapping` 代替所有 |
| `@PathVariable` | 取路径变量 | 参数 | 名称要和 `{}` 一致 |
| `@RequestParam` | 取查询参数 | 参数 | `required=false` 要显式 |
| `@RequestBody` | 取请求体 | 参数 | 依赖 `HttpMessageConverter` |
| `@ResponseBody` | 返回值写响应体 | 方法/类 | `@RestController` 已包含 |
| `@ResponseStatus` | 指定状态码 | 方法/异常 | 异常处理时更常用 `ProblemDetail` |
| `@ControllerAdvice` | 全局增强 | 类 | 只对 MVC 生效 |
| `@RestControllerAdvice` | 全局 REST 增强 | 类 | = `@ControllerAdvice` + `@ResponseBody` |
| `@ExceptionHandler` | 处理异常 | 方法 | 匹配最具体的异常 |
| `@CrossOrigin` | 跨域 | 类/方法 | 生产用全局 CORS 配置 |
| `@Valid` | 触发校验 | 参数 | 嵌套对象要加 `@Valid` |
| `@Validated` | 方法级校验 | 类/方法 | 分组校验 |
| `@HttpExchange` | HTTP 接口 | 接口/方法 | 客户端/服务端可共用 |
| `@GetExchange`/`@PostExchange` | 指定方法 | 方法 | 与 `@HttpExchange` 配合 |
| `@ImportHttpServices` | 注册 HTTP 客户端组 | 配置类 | Spring Framework 7 的写法 |

## 数据与事务

| 注解 | 作用 | 放在哪 | 常见坑 |
| --- | --- | --- | --- |
| `@Entity` | JPA 实体 | 类 | 需要无参构造 |
| `@Table` | 指定表名 | 类 | 默认类名 |
| `@Id` | 主键 | 字段 | 必须有 |
| `@GeneratedValue` | 主键生成 | 字段 | 策略要和数据库匹配 |
| `@Column` | 列映射 | 字段 | 不要和 `@Entity` 字段名冲突 |
| `@Version` | 乐观锁 | 字段 | 更新要处理冲突 |
| `@OneToMany`/`@ManyToOne` | 关系映射 | 字段 | 注意 N+1 和懒加载 |
| `@JoinColumn` | 外键列 | 字段 | 双向关系要维护一致 |
| `@Repository` | 数据访问 | 接口/类 | Spring Data 接口可省略 |
| `@Query` | 自定义 JPQL/SQL | 方法 | 原生 SQL 要 `nativeQuery=true` |
| `@Modifying` | 更新/删除查询 | 方法 | 需要事务 |
| `@EntityGraph` | 抓取策略 | 方法 | 解决 N+1 |
| `@Transactional` | 事务 | 类/方法 | 自调用失效、异常回滚规则 |
| `@TransactionalEventListener` | 事务事件 | 方法 | 事务提交后执行 |

## AOP、异步、缓存、调度

| 注解 | 作用 | 放在哪 | 常见坑 |
| --- | --- | --- | --- |
| `@Aspect` | 切面 | 类 | 需要 AOP 依赖 |
| `@Pointcut` | 切点 | 方法 | 表达式要可维护 |
| `@Before`/`@After`/`@Around` | 通知 | 方法 | `@Around` 要 `proceed()` |
| `@Async` | 异步执行 | 方法 | 需要 `@EnableAsync`，自调用失效 |
| `@EnableAsync` | 开启异步 | 配置类 | 自定义线程池 |
| `@Scheduled` | 定时任务 | 方法 | 多实例会重复执行 |
| `@EnableScheduling` | 开启调度 | 配置类 | 线程池大小 |
| `@Cacheable` | 缓存读 | 方法 | 需要 `@EnableCaching` |
| `@CacheEvict` | 缓存失效 | 方法 | key 设计要一致 |
| `@EnableCaching` | 开启缓存 | 配置类 | 需要 CacheManager |

## 安全

| 注解 | 作用 | 放在哪 | 常见坑 |
| --- | --- | --- | --- |
| `@EnableWebSecurity` | 开启 Web 安全 | 配置类 | Spring Boot 常自动配置 |
| `@EnableMethodSecurity` | 开启方法安全 | 配置类 | 默认关闭 |
| `@PreAuthorize` | 调用前鉴权 | 方法 | 表达式要可读 |
| `@PostAuthorize` | 返回后鉴权 | 方法 | 性能与语义 |
| `@Secured` | 角色鉴权 | 方法 | 不支持复杂表达式 |

## 可观测性

| 注解 | 作用 | 放在哪 | 常见坑 |
| --- | --- | --- | --- |
| `@Timed` | 记录耗时 | 方法 | 需要 Micrometer |
| `@Counted` | 计数 | 方法 | 指标基数 |
| `@Observed` | Observation | 方法 | 需要开启注解扫描 |

## 测试

| 注解 | 作用 | 放在哪 | 常见坑 |
| --- | --- | --- | --- |
| `@SpringBootTest` | 完整上下文 | 类 | 慢，尽量复用上下文 |
| `@WebMvcTest` | MVC 切片 | 类 | 不加载 Service/Repository |
| `@DataJpaTest` | JPA 切片 | 类 | 默认回滚 |
| `@JsonTest` | JSON 切片 | 类 | 只测序列化 |
| `@RestClientTest` | HTTP 客户端切片 | 类 | mock server |
| `@MockitoBean` | 替换 Bean | 字段 | Spring Boot 3.4+ |
| `@MockitoSpyBean` | Spy Bean | 字段 | 同上 |
| `@Testcontainers` | 容器测试 | 类 | 需要 Docker |
| `@Container` | 声明容器 | 字段 | 生命周期 |
| `@ServiceConnection` | 自动连接容器 | 字段 | 需要对应模块 |
| `@DynamicPropertySource` | 动态配置 | 静态方法 | 在上下文启动前执行 |
| `@TestPropertySource` | 测试配置 | 类 | 覆盖优先级 |

## 原生镜像

| 注解 | 作用 | 放在哪 | 常见坑 |
| --- | --- | --- | --- |
| `@RegisterReflectionForBinding` | 注册反射 | 类 | 只在 native 需要 |
| `@ImportRuntimeHints` | 导入 hints | 配置类 | 动态反射要自己写 |

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

启用（Spring Framework 7 的 `@ImportHttpServices` 按组注册）：

```java
@Configuration
@ImportHttpServices(group = "order", types = OrderClient.class)
public class HttpClientConfig {}
```

Spring Boot 4 提供自动配置和属性支持，也可以直接注入接口代理。

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

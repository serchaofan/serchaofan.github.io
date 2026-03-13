---
title: Golang进阶
tags: []
date: 2020-02-21 15:18:37
categories: [Golang]
comments: false
---

# 第1章：并发编程模型

## 1.1 Goroutine调度机制与GMP模型

Go语言的并发模型是其核心优势之一。理解Goroutine的调度机制对于编写高效的并发程序至关重要。

### 什么是Goroutine

Goroutine是Go语言实现的轻量级线程，由Go运行时（runtime）管理。与传统线程相比，Goroutine具有以下特点：

- 创建成本低：初始栈空间仅2KB（可动态增长到最大1GB）
- 调度由Go runtime完成：而非操作系统
- 原生支持并发：通过go关键字即可创建
- channel实现通信：通过channel实现Goroutine间的通信与同步

### GMP模型详解

GMP模型是Go运行时实现的现代协程调度器：

- G（Goroutine）：用户级轻量级线程，承载用户代码
- M（Machine）：操作系统线程，由runtime管理
- P（Processor）：处理器，维护G队列和调度上下文

```go
package main

import (
    "fmt"
    "runtime"
    "sync"
    "time"
)

func main() {
    fmt.Printf("GOMAXPROCS: %d\n", runtime.GOMAXPROCS(0))
    fmt.Printf("NumCPU: %d\n", runtime.NumCPU())

    var wg sync.WaitGroup
    
    for i := 0; i < 10; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            fmt.Printf("Goroutine %d running\n", id)
            time.Sleep(10 * time.Millisecond)
        }(i)
    }

    wg.Wait()
    fmt.Println("All goroutines completed")
}
```

## 1.2 Channel高级用法

### 1.2.1 缓冲通道与非缓冲通道

**非缓冲通道**：发送和接收会阻塞直到配对操作
**缓冲通道**：缓冲区满之前发送不阻塞，缓冲区空之前接收不阻塞

```go
package main

import (
    "fmt"
)

func main() {
    // 非缓冲通道
    unbuffered := make(chan int)
    
    go func() {
        unbuffered <- 42
    }()
    
    value := <-unbuffered
    fmt.Printf("Received: %d\n", value)
    
    // 缓冲通道
    buffered := make(chan string, 3)
    buffered <- "first"
    buffered <- "second"
    buffered <- "third"
    
    fmt.Println(<-buffered)
}
```

### 1.2.2 超时控制与超时检测

```go
import "context"
import "time"

// 使用select和time.After
select {
case result := <-ch:
    fmt.Println("Success:", result)
case <-time.After(1 * time.Second):
    fmt.Println("Timeout!")
}

// 使用context（推荐）
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
defer cancel()
```

### 1.2.3 Select多路复用

```go
select {
case msg1 := <-ch1:
    fmt.Println("Received from ch1:", msg1)
case msg2 := <-ch2:
    fmt.Println("Received from ch2:", msg2)
default:
    fmt.Println("No channel ready")
}
```

## 1.3 并发同步原语

### 1.3.1 互斥锁与读写锁

```go
var mu sync.Mutex
counter := 0

mu.Lock()
counter++
mu.Unlock()

// 读写锁
var rwmu sync.RWMutex
rwmu.RLock()
rwmu.RUnlock()
rwmu.Lock()
rwmu.Unlock()
```

### 1.3.2 等待组

```go
var wg sync.WaitGroup

for i := 0; i < 3; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
    }()
}

wg.Wait()
```

### 1.3.3 单次执行

```go
var once sync.Once

for i := 0; i < 10; i++ {
    go func() {
        once.Do(func() {
            fmt.Println("Only once!")
        })
    }()
}
```

## 1.4 Context上下文传递

### 1.4.1 取消信号与超时控制

```go
// 手动取消
ctx, cancel := context.WithCancel(context.Background())

// 超时控制
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)

// 绝对时间截止
ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(1*time.Hour))
```

### 1.4.2 上下文传递

Context应作为第一个参数在调用链中传递：

```go
func processRequest(ctx context.Context) {
    callService(ctx)
}

func callService(ctx context.Context) {
    traceID := ctx.Value("traceID")
}
```

## 1.5 并发模式与技巧

### 1.5.1 生产者-消费者模型

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

func main() {
    tasks := make(chan int, 100)
    results := make(chan int, 100)
    var wg sync.WaitGroup
    
    for i := 0; i < 3; i++ {
        wg.Add(1)
        go consumer(i, tasks, results, &wg)
    }
    
    go producer(tasks)
    
    go func() {
        wg.Wait()
        close(results)
    }()
    
    for result := range results {
        fmt.Printf("Result: %d\n", result)
    }
}

func producer(tasks chan<- int) {
    defer close(tasks)
    for i := 1; i <= 20; i++ {
        tasks <- i
        time.Sleep(10 * time.Millisecond)
    }
}

func consumer(id int, tasks <-chan int, results chan<- int, wg *sync.WaitGroup) {
    defer wg.Done()
    for task := range tasks {
        results <- task * 2
    }
}
```

### 1.5.2 并发安全的数据结构

```go
var m sync.Map
m.Store("name", "Alice")
value, ok := m.Load("name")
m.Delete("age")
```

### 1.5.3 并发限流

```go
import "golang.org/x/time/rate"

limiter := rate.NewLimiter(rate.Limit(100), 100)
if !limiter.Allow() {
    // 限流
}
```

## 1.6 并发调试

### 数据竞争检测

```bash
go run -race main.go
go test -race ./...
```

## 1.7 分布式并发

### 分布式锁（Redis）

```go
type RedisLock struct {
    redis  RedisClient
    key    string
    value  string
    expiry time.Duration
}

func (r *RedisLock) TryLock(ctx context.Context) (bool, error) {
    return r.redis.SetNX(ctx, r.key, r.value, r.expiry)
}
```

### 分布式事务（2PC/TCC）

2PC：两阶段提交
TCC：Try-Confirm-Cancel

# 第2章：高性能开发与优化

## 2.1 性能分析工具链

### CPU Profiling（pprof）

```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
```

### 内存 Profiling

```go
import "runtime/pprof"

f, _ := os.Create("heap.prof")
runtime.GC()
pprof.WriteHeapProfile(f)
```

## 2.2 代码优化技巧

### 减少内存分配

```go
// 预分配
s := make([]int, 0, 1000)

// sync.Pool
bufferPool := &sync.Pool{
    New: func() interface{} {
        return make([]byte, 1024)
    },
}
```

## 2.3 并发优化

### 流水线模式

```go
func pipeline() {
    stage1 := make(chan int)
    stage2 := make(chan int)
    
    go func() {
        for i := 1; i <= 100; i++ {
            stage1 <- i
        }
        close(stage1)
    }()
    
    go func() {
        for n := range stage1 {
            stage2 <- n * n
        }
        close(stage2)
    }()
    
    for result := range stage2 {
        fmt.Println(result)
    }
}
```

## 2.4 网络与IO优化

### 连接池

```go
httpClient := &http.Client{
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 100,
        IdleConnTimeout:     90 * time.Second,
    },
}
```

# 第3章：工程化与最佳实践

## 3.1 代码质量

### SOLID原则

- 单一职责（SRP）
- 开闭原则（OCP）
- 接口隔离（ISP）
- 依赖倒置（DIP）

### 模块化设计

```go
// 按功能划分包
// - internal/pkg: 内部业务逻辑
// - service/: 服务层
// - handler/: HTTP处理
// - repository/: 数据访问
```

## 3.2 错误处理与日志

### 结构化日志（zap）

```go
import "go.uber.org/zap"

logger, _ := zap.NewProduction()
defer logger.Sync()

logger.Info("Request processed",
    zap.String("request_id", "req-123"),
)
```

### 错误包装

```go
if err := step2(); err != nil {
    return fmt.Errorf("step1 failed: %w", err)
}
```

## 3.3 测试

### 表驱动测试

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        input    int
        expected int
    }{
        {"positive", 5, 25},
        {"zero", 0, 0},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := square(tt.input)
            if result != tt.expected {
                t.Errorf("square(%d) = %d", tt.input, result)
            }
        })
    }
}
```

### Mock依赖

```go
type Database interface {
    GetUser(id int) (*User, error)
}

type MockDatabase struct{}

func (m MockDatabase) GetUser(id int) (*User, error) {
    return &User{ID: id, Name: "Test"}, nil
}
```

# 第4章：网络编程与微服务架构

## 4.1 HTTP/2与gRPC

### gRPC服务定义

```protobuf
syntax = "proto3";

service UserService {
    rpc GetUser (GetUserRequest) returns (User);
    rpc ListUsers (ListUsersRequest) returns (stream User);
}

message User {
    string id = 1;
    string name = 2;
}
```

### gRPC服务器实现

```go
type userServiceServer struct {
    UnimplementedUserServiceServer
    users map[string]*User
}

func (s *userServiceServer) GetUser(ctx context.Context, req *GetUserRequest) (*User, error) {
    user, ok := s.users[req.Id]
    if !ok {
        return nil, status.Errorf(codes.NotFound, "user not found")
    }
    return user, nil
}
```

### 拦截器

```go
func unaryServerInterceptor() grpc.UnaryServerInterceptor {
    return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
        start := time.Now()
        resp, err := handler(ctx, req)
        fmt.Printf("Method: %s, Duration: %v\n", info.FullMethod, time.Since(start))
        return resp, err
    }
}
```

## 4.2 中间件与链路追踪

### 中间件模式

```go
func loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        fmt.Printf("%s %s %v\n", r.Method, r.URL.Path, time.Since(start))
    })
}
```

### OpenTelemetry

```go
import "go.opentelemetry.io/otel"
import "go.opentelemetry.io/otel/exporters/jaeger"

func initTracer() (*otel.TracerProvider, error) {
    exp, _ := jaeger.New(jaeger.WithAgentEndpoint())
    tp := otel.NewTracerProvider(otel.WithBatcher(exp))
    otel.SetTracerProvider(tp)
    return tp, nil
}
```

## 4.3 静态资源优化

### Gzip压缩

```go
func gzipHandler(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
            next.ServeHTTP(w, r)
            return
        }
        w.Header().Set("Content-Encoding", "gzip")
        gz := gzip.NewWriter(w)
        defer gz.Close()
        next.ServeHTTP(w, r)
    })
}
```

## 4.4 API网关与服务发现

### 服务注册（Consul）

```go
import "github.com/hashicorp/consul/api"

config := api.DefaultConfig()
client, _ := api.NewClient(config)

registration := &api.AgentServiceRegistration{
    ID:      "my-service-1",
    Name:    "my-service",
    Port:    8080,
    Address: "localhost",
}
client.Agent().ServiceRegister(registration)
```

## 4.5 服务网格（Istio）

Istio架构：
- Control Plane (istiod)：配置管理、证书颁发
- Data Plane (Envoy Sidecar)：服务间通信

## 4.6 熔断与降级

```go
import "github.com/sony/gobreaker"

settings := gobreaker.Settings{
    Name:        "my-circuit-breaker",
    MaxRequests: 3,
    Interval:    10 * time.Second,
    Timeout:     30 * time.Second,
}

cb := gobreaker.NewCircuitBreaker(settings)
result, err := cb.Execute(func() (interface{}, error) {
    return callRemoteService()
})
```

## 4.7 mTLS认证

```go
// 服务端
creds, _ := credentials.NewServerTLSFromFile("cert.pem", "key.pem")
server := grpc.NewServer(grpc.Creds(creds))

// 客户端
creds, _ := credentials.NewClientTLSFromFile("cert.pem", "servername")
conn, _ := grpc.Dial("server:port", grpc.WithTransportCredentials(creds))
```

## 4.8 JWT认证

```go
import "github.com/golang-jwt/jwt/v4"

func GenerateToken(userID string) (string, error) {
    claims := jwt.MapClaims{
        "user_id": userID,
        "exp":     time.Now().Add(24 * time.Hour).Unix(),
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte("secret"))
}
```

## 4.9 消息队列

### Kafka生产者

```go
import "github.com/segmentio/kafka-go"

writer := &kafka.Writer{
    Addr:     kafka.TCP("localhost:9092"),
    Topic:    "my-topic",
}

writer.WriteMessages(context.Background(),
    kafka.Message{Key: []byte("key"), Value: []byte("value")},
)
```

---

> 参考资料
> - Go官方文档：https://go.dev/doc/
> - 《The Go Programming Language》
> - Uber Go语言编码规范

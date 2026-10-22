---
title: HTTP协议基础笔记
date: 2018-05-31 12:02:09
tags: [网络, http]
categories: [网络]
comments: false
---

HTTP（HyperText Transfer Protocol）是 Web 的应用层协议，负责在客户端和服务端之间传输请求与响应。它看起来简单，但真正做深会涉及语义、缓存、连接管理、HTTP/2/3、代理、安全、Cookie、CORS 和请求走私等大量细节。

本文按 RFC 9110（HTTP Semantics）、RFC 9111（Caching）、RFC 9112（HTTP/1.1）、RFC 9113（HTTP/2）、RFC 9114（HTTP/3）以及 Cookie、TLS、CORS 等规范重写，重点讲清「协议语义」和「生产环境里的坑」。

> HTTP 的版本只影响**怎么传输**，不改变核心语义。方法是否安全、是否幂等、缓存是否可用、状态码含义，在 HTTP/1.1、HTTP/2、HTTP/3 中是一致的。

<!-- more -->

- [HTTP 是什么](#http-%E6%98%AF%E4%BB%80%E4%B9%88)
- [版本演进](#%E7%89%88%E6%9C%AC%E6%BC%94%E8%BF%9B)
- [URI 与资源](#uri-%E4%B8%8E%E8%B5%84%E6%BA%90)
- [消息与分帧](#%E6%B6%88%E6%81%AF%E4%B8%8E%E5%88%86%E5%B8%A7)
- [方法与语义](#%E6%96%B9%E6%B3%95%E4%B8%8E%E8%AF%AD%E4%B9%89)
- [状态码](#%E7%8A%B6%E6%80%81%E7%A0%81)
- [首部字段](#%E9%A6%96%E9%83%A8%E5%AD%97%E6%AE%B5)
- [连接管理](#%E8%BF%9E%E6%8E%A5%E7%AE%A1%E7%90%86)
- [HTTP/2](#http2-1)
- [HTTP/3](#http3-1)
- [缓存](#%E7%BC%93%E5%AD%98)
- [条件请求与范围请求](#%E6%9D%A1%E4%BB%B6%E8%AF%B7%E6%B1%82%E4%B8%8E%E8%8C%83%E5%9B%B4%E8%AF%B7%E6%B1%82)
- [Cookie 与会话](#cookie-%E4%B8%8E%E4%BC%9A%E8%AF%9D)
- [内容协商与压缩](#%E5%86%85%E5%AE%B9%E5%8D%8F%E5%95%86%E4%B8%8E%E5%8E%8B%E7%BC%A9)
- [认证与授权](#%E8%AE%A4%E8%AF%81%E4%B8%8E%E6%8E%88%E6%9D%83)
- [同源与 CORS](#%E5%90%8C%E6%BA%90%E4%B8%8E-cors)
- [Web 安全头](#web-%E5%AE%89%E5%85%A8%E5%A4%B4)
- [代理 CDN 与转发](#%E4%BB%A3%E7%90%86-cdn-%E4%B8%8E%E8%BD%AC%E5%8F%91)
- [性能优化](#%E6%80%A7%E8%83%BD%E4%BC%98%E5%8C%96)
- [调试与工具](#%E8%B0%83%E8%AF%95%E4%B8%8E%E5%B7%A5%E5%85%B7)
- [常见误区](#%E5%B8%B8%E8%A7%81%E8%AF%AF%E5%8C%BA)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# HTTP 是什么

## 定位

HTTP 是应用层协议，通常基于 TCP（HTTP/1.1、HTTP/2）或 QUIC（HTTP/3），采用请求/响应模型：

```text
Client ── request ──▶ Server
Client ◀─ response ── Server
```

HTTP 的核心抽象：

- **资源（Resource）**：由 URI 标识。
- **方法（Method）**：对资源做什么。
- **状态码（Status Code）**：结果类别。
- **首部（Header Fields）**：元数据、缓存、认证、内容协商。
- **消息体（Content）**：可选的数据。

HTTP 是**无状态**的：每个请求独立，服务端不自动保留上一次请求的上下文。状态通过 Cookie、Token、Session、缓存等机制在上层实现。

## 语义与传输分离

这是理解 HTTP 的关键：

- **语义**：方法、状态码、缓存、条件请求、内容协商。由 RFC 9110/9111 定义。
- **传输**：连接复用、分帧、多路复用、压缩。由 HTTP/1.1、HTTP/2、HTTP/3 分别定义。

升级到 HTTP/2 或 HTTP/3 不会让 `GET` 变成非安全方法，也不会改变 `304` 的含义。

## 常见误解

- **“HTTP 是无状态，所以不能登录”**：登录靠 Cookie/Token，不是 HTTP 本身。
- **“HTTP/2 一定比 HTTP/1.1 快”**：高丢包、单连接、错误优先级下不一定。
- **“HTTPS 就是 HTTP 加密”**：HTTPS 是 HTTP over TLS，还包含证书、身份认证、HSTS 等。
- **“CORS 是服务端安全机制”**：CORS 是浏览器同源策略的放宽机制，不保护服务端。
- **“缓存就是存文件”**：HTTP 缓存有完整的 freshness、validation、Vary 语义。

# 版本演进

| 版本 | 传输 | 关键特性 | 典型问题 |
| ---- | ---- | -------- | -------- |
| HTTP/0.9 | TCP | 只有 GET，无首部 | 历史 |
| HTTP/1.0 | TCP | 首部、状态码、Content-Type | 每个请求一个连接 |
| HTTP/1.1 | TCP | 持久连接、chunked、Host、缓存 | 队头阻塞、pipelining 少支持 |
| HTTP/2 | TCP + TLS（通常） | 二进制分帧、多路复用、HPACK、流控 | TCP 层队头阻塞、复杂度 |
| HTTP/3 | QUIC/UDP + TLS 1.3 | 独立流、QPACK、0-RTT、连接迁移 | UDP 部署、0-RTT 重放、生态 |

## HTTP/1.1

- 默认持久连接（keep-alive）。
- `Host` 首部成为必需，支持虚拟主机。
- chunked transfer coding、trailers、范围请求、条件请求、缓存语义完善。
- pipelining 理论上可复用连接发送多个请求，但因队头阻塞和中间件支持差，实际很少使用。

## HTTP/2

- 二进制分帧，一个 TCP 连接上多路复用多个 stream。
- HPACK 压缩首部。
- 流控、优先级、服务器推送（已基本废弃）。
- 仍受 TCP 层队头阻塞影响：一个丢包会阻塞所有 stream。

## HTTP/3

- 基于 QUIC（UDP），TLS 1.3 内置。
- 每个 stream 独立，解决 TCP 层队头阻塞。
- QPACK 压缩首部。
- 0-RTT、连接迁移、改进的丢包恢复。
- 部署依赖 UDP 443、负载均衡和 CDN 支持。

# URI 与资源

## URI / URL / URN

- **URI**：统一资源标识符，广义的资源标识。
- **URL**：统一资源定位符，包含访问方式（scheme、host、path）。
- **URN**：统一资源名，与位置无关的持久名称。

HTTP 请求目标通常是 URL 的 path + query：

```text
https://example.com:443/api/orders?id=123#detail
└──┬──┘   └────┬────┘└┬┘└────┬────┘└──┬──┘└──┬──┘
 scheme      host    port   path     query fragment
```

- `#fragment` 不会发送给服务器。
- `Host`/`:authority` 用于虚拟主机路由。
- path 的编码、归一化、`..`、`//`、大小写会影响路由和安全。

## 资源与表示

- 资源是抽象实体，表示（representation）是某一时刻的字节形式。
- 同一资源可以有多种表示：HTML/JSON、不同语言、不同压缩、不同图片格式。
- 内容协商选择表示；`Vary` 告诉缓存按哪些请求头区分。

# 消息与分帧

## HTTP/1.1 消息结构

请求：

```http
GET /api/orders?id=123 HTTP/1.1
Host: example.com
Accept: application/json
User-Agent: curl/8

```

响应：

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 42
Cache-Control: max-age=60

{"id":123,"status":"created"}
```

- 起始行：请求行/状态行。
- 首部字段：`name: value`，字段名大小写不敏感。
- 空行 CRLF。
- 消息体可选。
- obs-fold（首部折行）已废弃，不要依赖。
- 首部值的前后空白、逗号列表、重复字段要按规范处理。

## 消息体长度

HTTP/1.1 判断 body 长度：

1. `Transfer-Encoding: chunked`：chunked 编码，最后 0 长度 chunk + trailers。
2. `Content-Length`：精确字节数。
3. 连接关闭：读到 EOF（仅响应，且不推荐）。
4. 请求方法/状态码本身无 body（如 HEAD、204、304）。

规则：

- `Content-Length` 和 `Transfer-Encoding` 同时出现是危险的，可能导致请求走私。
- 多个 `Content-Length` 或值不一致必须拒绝。
- chunked 的 chunk size 是十六进制，trailer 可以携带额外首部。
- HTTP/2/3 用 DATA 帧表达 body，不再使用 chunked；`Transfer-Encoding` 被禁止（`TE: trailers` 例外）。

## 请求走私

请求走私（Request Smuggling）来自前后端对消息边界理解不一致：

- `CL.TE`：前端按 Content-Length，后端按 Transfer-Encoding。
- `TE.CL`：前端按 Transfer-Encoding，后端按 Content-Length。
- `TE.TE`：两端对 Transfer-Encoding 的混淆/重复处理不同。
- 重复 Content-Length、变形 Transfer-Encoding、HTTP/2 降级到 HTTP/1.1 都是高危点。

防护：

- 前端/后端使用同一套严格解析器。
- 拒绝同时出现 CL 和 TE、重复 CL、非法 TE。
- 不信任客户端传来的 hop-by-hop 头。
- 尽量端到端 HTTP/2/3，减少降级。
- WAF/网关做规范化，但不能替代正确实现。

# 方法与语义

| 方法 | 安全 | 幂等 | 可缓存 | 典型用途 |
| ---- | ---- | ---- | ------ | -------- |
| GET | 是 | 是 | 是 | 获取资源 |
| HEAD | 是 | 是 | 是 | 获取元数据，无 body |
| POST | 否 | 否 | 通常否 | 创建/提交/非幂等操作 |
| PUT | 否 | 是 | 否 | 整体替换资源 |
| PATCH | 否 | 否 | 否 | 部分更新 |
| DELETE | 否 | 是 | 否 | 删除资源 |
| OPTIONS | 是 | 是 | 否 | 能力查询/CORS 预检 |
| TRACE | 是 | 是 | 否 | 回显请求（通常禁用） |
| CONNECT | 否 | 否 | 否 | 建立隧道 |

## 安全与幂等

- **安全（Safe）**：不改变服务端状态，只读。GET/HEAD/OPTIONS/TRACE。
- **幂等（Idempotent）**：重复执行结果一致。GET/HEAD/PUT/DELETE/OPTIONS/TRACE。
- POST 不幂等；PATCH 不保证幂等。
- 幂等不等于“不会产生副作用”，而是“重复执行的效果与一次相同”。
- 网络超时后，幂等方法可以安全重试；POST 需要幂等键（`Idempotency-Key`，行业约定，不是 HTTP 标准方法语义）。

## 常见错误

- 用 GET 执行删除/支付等有副作用的操作。
- 用 POST 代替 PUT，导致重试产生重复数据。
- PATCH 使用 JSON Merge Patch 还是 JSON Patch 不明确。
- 认为 DELETE 一定返回 204；也可能 200/202。
- 认为 PUT 只能创建；PUT 也可以更新/创建。

# 状态码

| 类别 | 含义 |
| ---- | ---- |
| 1xx | 信息/临时响应 |
| 2xx | 成功 |
| 3xx | 重定向/缓存验证 |
| 4xx | 客户端错误 |
| 5xx | 服务端错误 |

## 常见状态码

| 状态码 | 含义 | 关键点 |
| ------ | ---- | ------ |
| 100 | Continue | `Expect: 100-continue` |
| 101 | Switching Protocols | Upgrade/WebSocket |
| 103 | Early Hints | 提前推送 Link/资源提示 |
| 200 | OK | 通用成功 |
| 201 | Created | 创建成功，配合 `Location` |
| 202 | Accepted | 异步接受，未完成 |
| 204 | No Content | 成功但无 body |
| 206 | Partial Content | Range 请求 |
| 301 | Moved Permanently | 永久重定向，可能改变方法 |
| 302 | Found | 临时重定向，历史行为混乱 |
| 303 | See Other | 用 GET 访问 `Location` |
| 304 | Not Modified | 条件请求命中缓存 |
| 307 | Temporary Redirect | 保持方法和 body |
| 308 | Permanent Redirect | 永久 + 保持方法 |
| 400 | Bad Request | 请求语法/语义错误 |
| 401 | Unauthorized | 需要认证，配 `WWW-Authenticate` |
| 403 | Forbidden | 已认证但无权限 |
| 404 | Not Found | 资源不存在 |
| 405 | Method Not Allowed | 配 `Allow` |
| 406 | Not Acceptable | 内容协商失败 |
| 408 | Request Timeout | 请求超时 |
| 409 | Conflict | 版本/状态冲突 |
| 410 | Gone | 永久不存在 |
| 411 | Length Required | 需要 Content-Length |
| 412 | Precondition Failed | 条件请求失败 |
| 413 | Content Too Large | body 过大 |
| 414 | URI Too Long | URI 过长 |
| 415 | Unsupported Media Type | 媒体类型不支持 |
| 416 | Range Not Satisfiable | Range 越界 |
| 421 | Misdirected Request | 连接复用到错误主机 |
| 422 | Unprocessable Content | 语义校验失败 |
| 425 | Too Early | 0-RTT 重放风险 |
| 426 | Upgrade Required | 需要升级协议 |
| 428 | Precondition Required | 要求条件请求 |
| 429 | Too Many Requests | 限流，配 `Retry-After` |
| 431 | Request Header Fields Too Large | 首部过大 |
| 451 | Unavailable For Legal Reasons | 法律原因 |
| 500 | Internal Server Error | 服务端错误 |
| 501 | Not Implemented | 方法不支持 |
| 502 | Bad Gateway | 上游响应无效 |
| 503 | Service Unavailable | 暂时不可用，配 `Retry-After` |
| 504 | Gateway Timeout | 上游超时 |
| 505 | HTTP Version Not Supported | 版本不支持 |
| 511 | Network Authentication Required | 网络认证（ captive portal） |

## 重定向语义

- 301/302 历史上允许把 POST 改成 GET；不要依赖。
- 303 明确要求用 GET 访问新位置。
- 307/308 明确保持方法和 body。
- 308 是永久 + 保持方法；301 是永久但方法行为历史不一致。
- 重定向不要跨协议降级，不要把 HTTPS 跳到 HTTP。

# 首部字段

## 请求首部

| 字段 | 作用 |
| ---- | ---- |
| `Host` | 目标主机（HTTP/1.1 必需） |
| `User-Agent` | 客户端标识 |
| `Accept` | 可接受的媒体类型 |
| `Accept-Encoding` | 可接受的压缩编码 |
| `Accept-Language` | 语言偏好 |
| `Authorization` | 认证凭据 |
| `Cookie` | Cookie |
| `Referer` | 来源页面（注意拼写） |
| `Origin` | CORS/跨源请求来源 |
| `If-Match` / `If-None-Match` | 条件请求（ETag） |
| `If-Modified-Since` / `If-Unmodified-Since` | 条件请求（时间） |
| `Range` | 范围请求 |
| `If-Range` | 范围请求条件 |
| `Content-Type` | body 媒体类型 |
| `Content-Length` | body 长度 |
| `Content-Encoding` | body 压缩编码 |
| `Transfer-Encoding` | 传输编码 |
| `Expect` | 期望行为，如 100-continue |
| `Connection` | 连接控制（hop-by-hop） |
| `TE` | 可接受的传输编码/trailers |
| `Upgrade` | 协议升级 |
| `Via` | 代理链 |
| `Forwarded` | 代理转发信息 |
| `Sec-Fetch-*` | 浏览器请求元数据 |
| `Sec-CH-UA` | 客户端提示 |

## 响应首部

| 字段 | 作用 |
| ---- | ---- |
| `Date` | 响应生成时间 |
| `Server` | 服务端标识（可省略） |
| `Content-Type` | 媒体类型 + charset |
| `Content-Length` | body 长度 |
| `Content-Encoding` | 压缩编码 |
| `Transfer-Encoding` | chunked 等 |
| `Connection` | 连接控制 |
| `Cache-Control` | 缓存策略 |
| `ETag` | 资源版本标识 |
| `Last-Modified` | 最后修改时间 |
| `Expires` | 过期时间（旧） |
| `Vary` | 缓存按哪些请求头区分 |
| `Age` | 缓存年龄 |
| `Location` | 重定向/创建位置 |
| `Set-Cookie` | 设置 Cookie |
| `WWW-Authenticate` | 认证挑战 |
| `Allow` | 允许的方法 |
| `Retry-After` | 重试等待 |
| `Alt-Svc` | 替代服务（HTTP/3 发现） |
| `Strict-Transport-Security` | HSTS |
| `Content-Security-Policy` | CSP |
| `X-Content-Type-Options` | nosniff |
| `X-Frame-Options` | 防 clickjacking |
| `Referrer-Policy` | Referer 策略 |
| `Permissions-Policy` | 浏览器能力策略 |
| `Cross-Origin-Opener-Policy` | COOP |
| `Cross-Origin-Embedder-Policy` | COEP |
| `Cross-Origin-Resource-Policy` | CORP |

## hop-by-hop 与 end-to-end

- hop-by-hop 首部只对单跳有效：`Connection`、`Keep-Alive`、`Proxy-Authenticate`、`Proxy-Authorization`、`TE`、`Trailer`、`Transfer-Encoding`、`Upgrade`。
- `Connection` 列出的字段也是 hop-by-hop，代理必须移除。
- end-to-end 首部应透传，除非明确要修改。
- 代理错误透传 hop-by-hop 头会导致请求走私/连接问题。

# 连接管理

## HTTP/1.1 持久连接

- 默认 keep-alive，一个 TCP 连接可处理多个请求。
- `Connection: close` 表示关闭。
- `Keep-Alive` 可带 timeout/max，但不是标准必须。
- 连接复用减少 TCP/TLS 握手，但要注意服务端超时、客户端连接池、负载均衡 idle timeout。

## Pipelining

- 客户端可以连续发送多个请求，不等待响应。
- 响应必须按请求顺序返回，前一个慢请求会阻塞后面（队头阻塞）。
- 中间件/代理支持差，现代浏览器基本不用。
- HTTP/2 用 stream 多路复用替代。

## 队头阻塞

- HTTP/1.1：请求级队头阻塞。
- HTTP/2：TCP 层丢包会阻塞所有 stream。
- HTTP/3：QUIC stream 独立，减少跨 stream 阻塞，但仍有拥塞控制和应用层限制。

## 100-continue

```http
Expect: 100-continue
```

- 客户端先发首部，服务端认为可以接收时回 `100 Continue`，客户端再发 body。
- 适合大 body，避免浪费带宽。
- 服务端可以直接回 `417 Expectation Failed` 或最终响应。
- 不是所有代理/客户端都正确实现。

## Upgrade / CONNECT

- `Upgrade: websocket` + `Connection: Upgrade` → `101 Switching Protocols`。
- `CONNECT host:port` 用于代理隧道（HTTPS 代理）。
- HTTP/2 中 CONNECT 语义保留，但 Upgrade 机制不同。
- 代理要正确处理 CONNECT 的权限和超时，避免开放代理。

# HTTP/2

## 核心变化

- 二进制分帧，不再是文本行。
- 一个 TCP 连接多路复用多个 stream。
- HPACK 压缩首部。
- 流控、优先级、服务器推送。
- 通常基于 TLS + ALPN `h2`；也支持 h2c（明文，通常仅内部）。

## 帧结构

每个帧 9 字节头：

```text
+-----------------------------------------------+
| Length (24) | Type (8) | Flags (8) | R | Stream ID (31) |
+-----------------------------------------------+
| Frame Payload ...
```

常见帧类型：

| 类型 | 值 | 作用 |
| ---- | -- | ---- |
| DATA | 0x0 | 传输 body |
| HEADERS | 0x1 | 首部 |
| PRIORITY | 0x2 | 优先级（已废弃） |
| RST_STREAM | 0x3 | 终止 stream |
| SETTINGS | 0x4 | 连接参数 |
| PUSH_PROMISE | 0x5 | 服务器推送 |
| PING | 0x6 | 保活/测量 |
| GOAWAY | 0x7 | 关闭连接 |
| WINDOW_UPDATE | 0x8 | 流控 |
| CONTINUATION | 0x9 | 首部续帧 |

## Stream

- 客户端发起奇数 stream ID，服务端偶数。
- 一个 stream 是双向字节流。
- 状态：idle、open、half-closed、closed。
- `RST_STREAM` 取消单个 stream。
- `GOAWAY` 告知不再接受新 stream，已存在的可继续/重试。
- 并发 stream 数受 `SETTINGS_MAX_CONCURRENT_STREAMS` 限制。

## HPACK

- 静态表 + 动态表 + Huffman 编码。
- 首部字段名小写。
- 连接级动态表，跨 stream 共享。
- 压缩上下文有状态，代理/网关必须正确维护。
- 压缩可能带来侧信道风险（如 BREACH 类攻击），不要把 secret 和用户输入放在同一压缩上下文。

## 流控

- 连接级和 stream 级两个窗口。
- 默认初始窗口 65535 字节，可用 `WINDOW_UPDATE` 扩大。
- 接收方不读会导致发送方阻塞。
- 代理/网关要正确处理窗口，避免死锁/内存膨胀。

## 优先级与推送

- RFC 9113 中 PRIORITY 帧/优先级树已废弃，改用扩展优先级（如 RFC 9218 `Priority` 头）。
- 服务器推送在浏览器中基本被移除/不推荐，不要依赖。
- 推送会增加复杂度和缓存问题；用 early hints/预加载替代。

## HTTP/2 限制

- 仍受 TCP 队头阻塞影响。
- 单连接多路复用可能导致一个大响应影响其他流。
- 连接级流控/窗口配置不当会吞吐下降。
- 中间件对 h2 支持不完整时，可能出现降级/走私。
- 禁止 connection-specific 首部：`Connection`、`Keep-Alive`、`Proxy-Connection`、`Transfer-Encoding`、`Upgrade`；`TE: trailers` 例外。

# HTTP/3

## 核心变化

- 基于 QUIC（RFC 9000），UDP 443。
- TLS 1.3 内置在 QUIC 握手中。
- 每个 stream 独立，解决 TCP 层队头阻塞。
- QPACK 压缩首部。
- 支持 0-RTT、连接迁移。
- ALPN `h3`。

## QUIC 特性

- 连接 ID 支持连接迁移/NAT rebinding。
- 0-RTT 可减少握手延迟，但有重放风险。
- 丢包恢复按 packet/stream 处理。
- 加密和传输一体化，不再有“TCP + TLS”两层。
- 需要 UDP 防火墙/负载均衡支持。

## 0-RTT 与重放

- 0-RTT 数据在握手完成前发送，可能被重放。
- 只应对安全/幂等请求使用 0-RTT。
- 服务端可用 `425 Too Early` 拒绝。
- 代理可能添加 `Early-Data: 1` 标识。
- 不要对支付、下单等非幂等操作使用 0-RTT。

## 发现与部署

- 服务端通过 `Alt-Svc: h3=":443"; ma=86400` 告知 HTTP/3 可用。
- 也可通过 HTTPS DNS 记录发现。
- 客户端首次可能仍走 HTTP/2，后续升级。
- 负载均衡/CDN 必须支持 QUIC；UDP 被禁会导致回退。
- 监控 UDP 丢包、MTU、连接迁移、0-RTT 拒绝率。

## HTTP/3 限制

- UDP 在部分企业网络被阻断。
- 调试工具/生态不如 HTTP/2 成熟。
- 0-RTT 重放、连接迁移、放大攻击防护需要正确配置。
- QPACK 动态表仍可能带来头部阻塞，但比 TCP HOL 小。

# 缓存

## 缓存的关键概念

- **fresh**：缓存副本仍在新鲜期内，可直接使用。
- **stale**：过期，需要验证或重新获取。
- **validation**：用 ETag/Last-Modified 询问源站是否变化。
- **cache key**：通常 method + URI，加上 `Vary` 指定的请求头。
- **private cache**：浏览器缓存。
- **shared cache**：CDN/反向代理缓存。

## Cache-Control

| 指令 | 作用 |
| ---- | ---- |
| `max-age=N` | 新鲜期 N 秒 |
| `s-maxage=N` | 共享缓存新鲜期，覆盖 max-age |
| `public` | 可被共享缓存 |
| `private` | 只允许私有缓存 |
| `no-cache` | 可存但每次使用前必须验证 |
| `no-store` | 不存储 |
| `must-revalidate` | 过期后必须验证，不能使用 stale |
| `proxy-revalidate` | 共享缓存必须验证 |
| `immutable` | 新鲜期内不重新验证 |
| `stale-while-revalidate=N` | 过期后 N 秒内可先返回 stale，同时后台刷新 |
| `stale-if-error=N` | 源站错误时可用 stale N 秒 |
| `must-understand` | 只有理解该指令的缓存才能存储 |
| `no-transform` | 代理不得转换内容 |

## 新鲜度计算

```text
freshness_lifetime = max-age 或 (Expires - Date)
current_age = max(0, response_time - date_value) + Age
```

- `Age` 由共享缓存添加，表示副本已经存在多久。
- 没有显式新鲜度时，缓存可能使用启发式（如 Last-Modified 的 10%），但不可靠。
- `no-cache` 不是“不缓存”，`no-store` 才是“不存储”。

## 验证

- `ETag` + `If-None-Match`：强/弱比较。
- `Last-Modified` + `If-Modified-Since`：秒级精度，弱验证。
- 源站返回 `304 Not Modified`，可更新缓存首部，不返回 body。
- `Vary` 决定缓存 key 的请求头维度；漏掉会导致缓存错乱/投毒。

## Vary 与缓存键

```http
Vary: Accept-Encoding, Origin
```

- 同一 URL 因 `Accept-Encoding` 不同可能有 gzip/br 两个副本。
- CORS 响应必须 `Vary: Origin`，否则一个源的响应可能被另一个源复用。
- 多语言按 `Accept-Language` 变化时要 `Vary`。
- `Vary: *` 基本不可缓存。

## 缓存安全

- 认证响应默认不应被共享缓存，除非显式 `public` 且理解风险。
- `Set-Cookie` 响应不应被共享缓存。
- 缓存键要包含 Host、路径归一化、Vary 维度；避免 Host header 投毒。
- 不要缓存带用户敏感信息的响应到 CDN。
- 缓存欺骗：攻击者让 CDN 缓存私有页面，再让受害者访问。
- 缓存投毒：利用未纳入 key 的 header/参数注入内容。

# 条件请求与范围请求

## 条件请求

| 首部 | 作用 |
| ---- | ---- |
| `If-Match` | ETag 匹配才执行（强比较） |
| `If-None-Match` | ETag 不匹配才执行；GET 命中返回 304 |
| `If-Modified-Since` | 资源未修改则 304 |
| `If-Unmodified-Since` | 未修改才执行，否则 412 |
| `If-Range` | Range 与 ETag/时间匹配才返回部分内容 |

用途：

- 缓存验证（304）。
- 乐观并发控制（If-Match + ETag，失败 412）。
- 断点续传（If-Range）。

## Range

```http
Range: bytes=0-1023
```

响应：

```http
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/5000
Accept-Ranges: bytes
```

- 多段 Range 返回 `multipart/byteranges`。
- 越界返回 `416 Range Not Satisfiable`，带 `Content-Range: bytes */5000`。
- Range 可用于大文件、视频拖动，也可被滥用做放大/DoS；限制范围和并发。
- 压缩与 Range 交互复杂，通常对压缩内容禁用/特殊处理。

# Cookie 与会话

## Set-Cookie / Cookie

```http
Set-Cookie: session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600
Cookie: session=abc123
```

属性：

| 属性 | 作用 |
| ---- | ---- |
| `Domain` | 作用域；省略则 host-only |
| `Path` | 路径前缀 |
| `Expires` | 绝对过期时间 |
| `Max-Age` | 相对过期秒数，优先于 Expires |
| `Secure` | 仅 HTTPS 发送 |
| `HttpOnly` | JS 不可读 |
| `SameSite` | Lax/Strict/None 跨站策略 |
| `Partitioned` | CHIPS 分区 Cookie |

## SameSite

- `Strict`：跨站请求不发送。
- `Lax`：顶层导航 GET 可发送；现代浏览器默认。
- `None`：跨站发送，必须配 `Secure`。
- SameSite 不是 CSRF 的完整解决方案；仍需 CSRF token/Origin 校验。

## Cookie 前缀

- `__Secure-`：必须 Secure。
- `__Host-`：必须 Secure、Path=/、不能有 Domain。
- 用于防止子域覆盖/降级。

## 安全

- Cookie 不是加密存储，不要放敏感明文。
- HttpOnly 防 XSS 读取，但不能防 XSS 发起请求。
- Secure 防明文传输。
- SameSite 降低 CSRF，但不能替代 CSRF token。
- 防止 session fixation：登录后轮换 session ID。
- 防止 cookie tossing：子域设置同名 Cookie 覆盖父域。
- Cookie 大小通常 4KB，超限会被截断/拒绝。
- 第三方 Cookie 被浏览器限制，跨站场景考虑 CHIPS/Storage Access API。

# 内容协商与压缩

## 内容协商

请求：

```http
Accept: application/json, text/html;q=0.9
Accept-Encoding: br, gzip
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
```

- q-value 0-1，越大越优先。
- 服务端可选择表示，不能接受时返回 406。
- `Vary` 必须包含协商维度，否则缓存错乱。
- `Content-Type` 的 charset 要明确，避免编码歧义。

## 压缩

- `Content-Encoding: gzip/br/zstd`：表示 body 压缩。
- `Transfer-Encoding: chunked`：表示传输分块，不是压缩。
- 压缩减少带宽，但增加 CPU；Brotli 通常比 gzip 更好，zstd 在某些场景更优。
- 不要压缩已经压缩的图片/视频。
- 压缩 + 加密 + 用户输入可能产生 BREACH 类侧信道；敏感响应慎用动态压缩。
- 解压要有大小限制，防止压缩炸弹。

# 认证与授权

## 401 vs 403

- 401：未认证/认证失败，响应带 `WWW-Authenticate`。
- 403：已认证但无权限。
- 404 也可用于隐藏资源存在性。

## 常见方案

| 方案 | 说明 |
| ---- | ---- |
| Basic | `Authorization: Basic base64(user:pass)`，必须 TLS |
| Digest | 挑战响应，已不推荐 |
| Bearer | `Authorization: Bearer <token>`，OAuth/JWT |
| mTLS | 客户端证书 |
| Cookie Session | 浏览器会话 |

## Basic

```http
Authorization: Basic dXNlcjpwYXNz
```

- Base64 不是加密，只是编码。
- 必须 HTTPS。
- 适合内部工具/简单场景，不适合作为长期用户认证。

## Bearer / OAuth / OIDC

- Bearer token 是不透明凭据，泄露即失效。
- JWT 要校验签名、issuer、audience、exp、nbf、alg。
- 不要把 token 放 URL/日志。
- OAuth 的授权码流程、PKCE、scope 由 OAuth 规范定义，不是 HTTP 本身。

## 授权

- 认证解决“你是谁”，授权解决“你能做什么”。
- 服务端必须每次校验权限，不能只依赖前端隐藏按钮。
- 对象级授权（IDOR）是常见漏洞：`/orders/123` 要校验当前用户是否有权访问 123。
- 网关做粗粒度认证，业务做细粒度授权。

# 同源与 CORS

## 同源

同源 = scheme + host + port 完全相同。

- `https://a.com` 与 `http://a.com` 不同源。
- `https://a.com` 与 `https://a.com:443` 同源（默认端口）。
- `https://a.com` 与 `https://sub.a.com` 不同源。

## CORS 流程

简单请求直接发送，浏览器检查响应：

```http
Access-Control-Allow-Origin: https://app.example.com
```

非简单请求先预检：

```http
OPTIONS /api/orders
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type, authorization
```

响应：

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 600
Vary: Origin
```

关键点：

- 带 credentials 时，`Access-Control-Allow-Origin` 不能是 `*`。
- `Access-Control-Allow-Credentials: true` 时，前端要 `credentials: include`。
- 需要暴露的响应头用 `Access-Control-Expose-Headers`。
- 预检结果要 `Vary: Origin`，避免缓存串源。
- CORS 是浏览器行为，服务端仍要认证/授权。
- 常见漏洞：反射任意 Origin、信任 `null`、子域信任过宽、正则绕过。

# Web 安全头

## HSTS

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- 只对 HTTPS 响应有效。
- 让浏览器后续强制 HTTPS。
- `includeSubDomains` 影响所有子域，确认都支持 HTTPS。
- `preload` 进入浏览器内置列表，移除困难。
- 首次访问仍可能走 HTTP，先做 301 跳转。

## HPKP

已废弃，不要使用。用 Certificate Transparency、CAA、HSTS 替代。

## CSP

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

- 限制资源加载来源，降低 XSS 影响。
- `nonce`/`hash` 比 `unsafe-inline` 安全。
- `strict-dynamic` 可配合 nonce。
- `report-only` 先观察再强制。
- CSP 不是 XSS 的唯一防线，输出编码/模板转义仍必须。

## 其他头

| 头 | 作用 |
| -- | ---- |
| `X-Content-Type-Options: nosniff` | 禁止 MIME 嗅探 |
| `X-Frame-Options: DENY/SAMEORIGIN` | 防 clickjacking（旧） |
| `Content-Security-Policy: frame-ancestors` | 防 clickjacking（新） |
| `Referrer-Policy` | 控制 Referer 泄露 |
| `Permissions-Policy` | 限制摄像头/麦克风/地理位置等 |
| `Cross-Origin-Opener-Policy` | 隔离窗口关系 |
| `Cross-Origin-Embedder-Policy` | 要求跨源资源显式授权 |
| `Cross-Origin-Resource-Policy` | 限制资源被跨源加载 |
| `Content-Security-Policy: upgrade-insecure-requests` | 升级混合内容 |
| `Subresource-Integrity`（SRI） | 校验脚本/样式完整性 |
| `Clear-Site-Data` | 清除缓存/Cookie/存储 |

## 混合内容

HTTPS 页面加载 HTTP 资源会被浏览器阻止/升级。使用 HSTS、CSP `upgrade-insecure-requests`、全站 HTTPS。

# 代理 CDN 与转发

## 转发头

| 头 | 说明 |
| -- | ---- |
| `Forwarded` | 标准化的代理链信息 |
| `X-Forwarded-For` | 客户端 IP 链（事实标准） |
| `X-Forwarded-Proto` | 原始协议 |
| `X-Forwarded-Host` | 原始 Host |
| `Via` | 代理链标识 |

安全：

- 只信任来自已知代理的转发头。
- 客户端可以伪造 `X-Forwarded-For`，不能直接拿第一个值当真实 IP。
- 代理应追加而不是覆盖，但入口代理要清洗客户端传入值。
- `Forwarded` 的解析要严格，逗号/引号/IPv6 都可能被滥用。

## 代理与缓存

- 共享缓存要遵守 `Cache-Control`、`Vary`、`Authorization`、`Set-Cookie`。
- 不要缓存带用户信息的响应。
- Host header 投毒：缓存键包含错误 Host 可能影响其他用户。
- 缓存欺骗：把私有页面伪装成静态资源缓存。
- 代理要剥离 hop-by-hop 头，避免请求走私。

## WebSocket / CONNECT

- WebSocket 通过 `Upgrade` + `Connection: Upgrade` 建立。
- 代理要支持长连接、超时、心跳、背压。
- CONNECT 用于隧道，代理必须限制目标端口/权限，避免开放代理。
- HTTP/2/3 对 WebSocket 有扩展支持（RFC 8441），不是所有代理都支持。

# 性能优化

## 连接与协议

- 复用连接，减少 TCP/TLS 握手。
- 开启 TLS session resumption（session ticket/PSK）。
- HTTP/2 多路复用，避免 HTTP/1.1 队头阻塞。
- 高丢包/移动网络考虑 HTTP/3。
- 避免不必要的重定向和跨域预检。

## 缓存与压缩

- 静态资源长缓存 + 内容 hash 文件名。
- HTML/API 使用合适的 `Cache-Control`、ETag、Vary。
- 开启 Brotli/gzip/zstd，注意压缩侧信道。
- CDN 缓存静态资源，动态内容按业务缓存。
- 使用 103 Early Hints 提前提示关键资源。

## 资源提示

- `preconnect`：提前建立连接。
- `dns-prefetch`：提前解析 DNS。
- `preload`：提前加载关键资源。
- `prefetch`：空闲时预取未来资源。
- 不要滥用 preload，避免挤占带宽。

## 服务端

- 减少 TTFB：缓存、数据库索引、异步化。
- 控制响应大小，分页/流式。
- 避免大 Cookie/大 Header。
- 合理设置 keep-alive/idle timeout，和负载均衡一致。
- 监控 P50/P95/P99，不只看平均。

# 调试与工具

## curl

```bash
curl -v https://example.com
curl -I https://example.com
curl --http1.1 https://example.com
curl --http2 https://example.com
curl --http3 https://example.com
curl --compressed https://example.com
curl -w '%{http_code} %{time_total} %{time_connect} %{time_appconnect}\n' -o /dev/null -s https://example.com
curl --resolve example.com:443:1.2.3.4 https://example.com
```

- `-k` 只用于测试，不要在生产跳过证书校验。
- `--http2-prior-knowledge` 用于明文 h2c 测试。
- `--http3` 需要 curl 编译支持 HTTP/3。

## TLS / HTTP2

```bash
openssl s_client -connect example.com:443 -alpn h2 -servername example.com
nghttp -nv https://example.com
h2load -n 1000 -c 10 https://example.com
```

## 浏览器

- DevTools Network：协议列（h2/h3）、Timing、Priority、Cache。
- `chrome://net-export` 抓网络日志。
- `chrome://net-internals/#hsts` 查看 HSTS。
- 查看 `Alt-Svc` 判断 HTTP/3。

## 抓包

- Wireshark 解析 HTTP/1.1、HTTP/2、QUIC。
- HTTP/2 需要 TLS key log 或明文 h2c。
- QUIC 需要 UDP 抓包和密钥日志。

# 常见误区

- **301 和 302 可以随便用**：方法保持/改变行为不同，用 307/308 更明确。
- **no-cache 是不缓存**：no-cache 是必须验证；no-store 才是不存储。
- **Vary 不重要**：漏 Vary 会导致缓存串内容/投毒。
- **CORS 能保护 API**：CORS 是浏览器策略，服务端仍需认证授权。
- **SameSite 能完全防 CSRF**：不能，仍需 token/Origin 校验。
- **HTTP/2 一定比 HTTP/1.1 快**：取决于丢包、连接复用、服务端实现。
- **HTTP/2 推送是必须的**：浏览器已基本移除，不要依赖。
- **0-RTT 可以随便用**：有重放风险，只对安全/幂等请求。
- **X-Forwarded-For 第一个就是客户端 IP**：可伪造，只信任已知代理。
- **Content-Length 和 Transfer-Encoding 可以共存**：高危，可能导致请求走私。
- **HSTS preload 可以随便开**：移除困难，先确认所有子域 HTTPS。
- **Range 只能用于下载**：也是 DoS 面，要限制范围和并发。
- **压缩总是好事**：动态压缩 + 敏感数据有侧信道风险。

# 参考资料

- [RFC 9110 - HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- [RFC 9111 - HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
- [RFC 9112 - HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112)
- [RFC 9113 - HTTP/2](https://www.rfc-editor.org/rfc/rfc9113)
- [RFC 9114 - HTTP/3](https://www.rfc-editor.org/rfc/rfc9114)
- [RFC 9000 - QUIC](https://www.rfc-editor.org/rfc/rfc9000)
- [RFC 9204 - QPACK](https://www.rfc-editor.org/rfc/rfc9204)
- [RFC 7541 - HPACK](https://www.rfc-editor.org/rfc/rfc7541)
- [RFC 6265 - HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265)
- [RFC 6797 - HSTS](https://www.rfc-editor.org/rfc/rfc6797)
- [RFC 7469 - HPKP（已废弃）](https://www.rfc-editor.org/rfc/rfc7469)
- [RFC 8446 - TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)
- [RFC 7617 - Basic Authentication](https://www.rfc-editor.org/rfc/rfc7617)
- [RFC 6750 - Bearer Token](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 8297 - 103 Early Hints](https://www.rfc-editor.org/rfc/rfc8297)
- [RFC 5861 - stale-while-revalidate](https://www.rfc-editor.org/rfc/rfc5861)
- [RFC 8246 - immutable](https://www.rfc-editor.org/rfc/rfc8246)
- [MDN HTTP](https://developer.mozilla.org/docs/Web/HTTP)
- [web.dev HTTP](https://web.dev/learn/http)

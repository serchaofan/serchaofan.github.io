---
title: HTTP协议基础笔记
date: 2018-05-31 12:02:09
tags: [网络, http]
categories: [网络]
comments: false
---

- [Web 概述](#web-概述)
- [HTTP 概述](#http-概述)
- [HTTP 报文](#http-报文)
  - [HTTP 请求方式](#http-请求方式)
  - [HTTP 首部](#http-首部)
    - [HTTP 请求报文（Request）](#http-请求报文request)
    - [HTTP 响应报文（Response）](#http-响应报文response)
  - [状态码](#状态码)
- [HTTP Cookie](#http-cookie)
- [HTTP 连接](#http-连接)
- [HTTP 缓存](#http-缓存)
- [HTTP 安全](#http-安全)
  - [内容安全策略 CSP](#内容安全策略-csp)
  - [HTTP 公钥锁定 HPKP](#http-公钥锁定-hpkp)
  - [HTTP 严格传输安全 HSTS](#http-严格传输安全-hsts)
  - [X-Content-Type-Options](#x-content-type-options)
  - [X-Frame-Options](#x-frame-options)
  - [X-XSS-Protection](#x-xss-protection)

<!-- more -->

# Web 概述

WWW（World Wide Web）环球信息网，也称万维网，由 W3C 万维网联盟管理。万维网并不等同互联网，万维网只是互联网所能提供的服务其中之一，是靠着互联网运行的一项服务。
WWW 的三种技术：HTML，HTTP，URL

**URI：** 统一资源标识符，表示服务器资源名称，给定了 URI，HTTP 便能解析资源。URI 有两种形式：

- **URL 统一资源定位符**：描述特定服务器上指定资源的位置，是固定的。包含三部分：
  - 方案 scheme：说明访问资源使用的协议方式，如 `http://`
  - 服务器因特网地址，即域名或 IP 地址
  - 指定服务器上的指定资源，即访问路径
    **几乎所有 URI 都是 URL**
- **URN 统一资源名**：特定资源的唯一名称，与资源所在地址无关，资源可以四处搬运。

# HTTP 概述

超文本传输 ​​ 协议 Hyper Text Transfer Protocol（HTTP）是用于传输诸如 HTML 的超媒体文档的应用层协议，用于 Web 浏览器和 Web 服务器之间的通信，基于 TCP/IP，采用 C/S 模式。HTTP 是无状态协议，意味着服务器不会在两个请求之间保留任何数据（状态）。

HTTP 的三个常见版本：

- HTTP/1.0：客户端只能从 web 服务器获取一个 web 资源
- HTTP/1.1：客户端能在一个连接上获取多个 web 资源（有数量限制，超出部分请求被阻塞）
- HTTP/2.0：多流并行，一个连接可获取多个 web 资源

特点：

- 简单快速：HTTP 协议简单，报文简单易懂，HTTP 服务器程序规模 小，通信速度快。
- 灵活：HTTP 允许传输任意类型的数据对象。正在传输的类型由`Content-Type`加以标记。
- 可扩展：通过 HTTP 首部，只要服务端和客户端就新首部达成语义一致，新功能就可以被轻松加入进来。
- 无状态：在同一个连接中，两个执行成功的请求之间是没有关系的。但是可以通过 HTTP 的头部扩展和 HTTP Cookies 解决，把 Cookies 添加到头部中，让每次请求都能共享相同的上下文信息，来创建有状态的会话。

# HTTP 报文

## HTTP 请求方式

- GET：请求访问已被 URL 识别的资源，不会对信息产生影响，每次 GET 方法都是相同的，GET 放在 URL 首部，GET 提交的数据大小一般限制为 1024 字节，大小随浏览器而。采用明文传输，速度快。只产生一个 TCP 数据包。GET 能被缓存。
- POST：请求服务器传输信息实体的主体，POST 放在报文中，没有具体限制，由于放在报文中所以无法看见，安全，form 表单必须使用 POST。会产生两个 TCP 数据包。POST 不可被缓存。POST 提交数据大小没有限制。
- PUT：传输文件，在请求报文的主体中包含文件内容，然后保存到请求 URL 指定的位置（出于安全，网站一般不会用）
- HEAD：获取报文首部，用于确认 URI 的有效性及资源更新的日期时间等
- DELETE：请求 URL 删除指定的资源，与 PUT 相反（同样一般不用）
- OPTIONS：查询指定 URL 资源支持的方法
- TRACE：追踪路径，让服务器将之前的请求通信返还给客户端
- CONNECT：要求在与代理服务器通信时建立隧道，实现用隧道协议进行 TCP 通信，主要使用 SSL（安全套接层）和 TLS（传输层安全）协议把通信内容加密后经过网络传输。

GET 与 POST 的区别：

| GET                                        | POST                 |
| ------------------------------------------ | -------------------- |
| 请求访问已被 URL 识别的资源                | 将实体提交到指定资源 |
| 放在 URL 首部，明文传输，可见              | 封装在报文中，不可见 |
| 产生一个 TCP 包                            | 产生两个 TCP 包      |
| 能被缓存                                   | 不可被缓存           |
| 数据传输大小随浏览器而定，一般为 1024 字节 | 没有具体限制         |

## HTTP 首部

### HTTP 请求报文（Request）

```
GET https://developer.mozilla.org/zh-CN/docs/Web/HTTP HTTP/2.0
Host: developer.mozilla.org
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:60.0) Gecko/20100101 Firefox/60.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate, br
Cookie: dwf_sg_task_completion=False; messages="67ba01ba64d7aac589a5e34d72bb89050449f64e$[[\"__json_message\"\0541\05430\054\"Redirected from https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Forms\"\054\"wiki_redirect\"]]"
Connection: keep-alive
```

**报文解析：**
第一行为请求行，包含三个部分：

- 执行动作：即请求方式。
- 请求目标：完整路径，通常是一个 URL，或者是协议、端口和域名的绝对路径
  - 绝对路径，末尾加上?与查询字符串，称为原始形式
  - 完整 URL，称为绝对形式，通常 GET 使用
  - 域名:端口，仅在使用 CONNECT 建立 HTTP 隧道时才使用
  - 星号形式\*，配合 OPTIONS 方法使用，代表整个服务器
- HTTP 版本

第二行以后的内容都称为 HTTP 头（Headers），可分为：

1. 通用（一般）头（general headers）：适用于请求和响应消息，但与最终消息主体中传输的数据无关。
   例：`Connection`，`Date`，`Keep-Alive`等
2. 请求头（request headers）：包含有关要获取的资源或客户端本身更多信息
   例：`Host`，`User-Agent`，`Accept`，`Accept-Encoding`等
3. 响应头（response headers）：包含有关服务器响应的补充信息，如其位置或服务器本身（名称和版本等）。
   例：`Server`，`Set-Cookie`，`X-Frame-Options`，`Etag`等
4. 实体头（entity headers）：包含有关实体主体的更多信息，比如主体长(`Content-Length`)度或其 MIME 类型。
   例：`Content-Type`，`Content-Length`，`Content-Encoding`等

消息头也可以根据代理对其的处理方式分为：

- 端到端消息头：这类消息头必须被传输到最终的消息接收者，也即，请求的服务器或响应的客户端。中间的代理服务器必须转发未经修改的端到端消息头，并且必须缓存它们。
- 逐跳消息头：这类消息头仅对单次传输连接有意义，不能通过代理或缓存进行重新转发。这些消息头包括 `Connection`, `Keep-Alive`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailer`, `Transfer-Encoding` 及 `Upgrade`。注意，只能使用 `Connection` 来设置逐跳一般头。

请求的最后一部分是它的 body。不是所有的请求都有一个 body：例如获取资源的请求，GET，HEAD，DELETE 和 OPTIONS，通常它们不需要 body。 有些请求将数据发送到服务器以便更新数据：常见的的情况是 POST 请求（包含 HTML 表单数据）。
Body 大致可分为两类：

- Single-resource bodies，由一个单文件组成。该类型 body 由两个 header 定义： `Content-Type` 和 `Content-Length`.
- Multiple-resource bodies，由多部分 body 组成，每一部分包含不同的信息位。通常是和 HTML Forms 连系在一起。

### HTTP 响应报文（Response）

```
HTTP/2.0 200 OK
content-type: text/css; charset="utf-8"
access-control-allow-origin: *
cache-control: max-age=315360000, public, immutable
date: Tue, 05 Jun 2018 16:24:09 GMT
last-modified: Tue, 05 Jun 2018 15:59:27 GMT
server: meinheld/0.6.1
strict-transport-security: max-age=63072000
x-content-type-options: nosniff
x-xss-protection: 1; mode=block
content-encoding: gzip
vary: Accept-Encoding
age: 336026
x-cache: Hit from cloudfront
via: 1.1 ec1e0045303188984bc160bff8921bbd.cloudfront.net (CloudFront)
x-amz-cf-id: D0Bs8VzYr7qYkVfUiXYivsQqygQPctoPwabrnWC0zSPCwYedUyHAWg==
X-Firefox-Spdy: h2
```

**响应报文解析：**

- 第一行为响应行，包含三个字段：
  - HTTP 版本
  - 状态码
  - 状态信息
- 第二行开始为响应头，与请求头类似
- 以及可选项，比起请求报文，响应报文中更常见地包含获取的资源 body。

响应的最后一部分是 body。不是所有的响应都有 body：具有状态码 (如 201 或 204) 的响应，通常不会有 body。

Body 大致可分为三类：

- Single-resource bodies，由已知长度的单个文件组成。该类型 body 由两个 header 定义：Content-Type 和 Content-Length。
- Single-resource bodies，由未知长度的单个文件组成，通过将 Transfer-Encoding 设置为 chunked 来使用 chunks 编码。
- Multiple-resource bodies，由多部分 body 组成，每部分包含不同的信息段。但这是比较少见的。

## 状态码

**类别：**

- 1XX：信息类------->请求正在处理，属于临时响应
- 2XX：成功类------->请求正常处理完毕
- 3XX：重定向------->需要附加操作完成请求
- 4XX：客户端错误---->服务器无法处理请求
- 5XX：服务器错误---->服务器处理请求出错

**常见状态码：**

**1XX 信息响应**

- 100 Continue：迄今为止的所有内容都是可行的，客户端应该继续请求，如果已经完成，则忽略它。
- 101 Switching Protocol：响应客户端的 Upgrade 标头发送的，并且指示服务器也正在切换的协议。
- 102 Processing (WebDAV)：服务器已收到并正在处理该请求，但没有响应可用。

**2XX 成功响应**

- **200** OK：正常，客户端的请求在服务器被正常处理
- 201 Created：该请求已成功，并因此创建了一个新的资源。这通常是在 PUT 请求之后发送的响应。
- **202** Accepted：请求已经接收到，但还未响应，没有结果。意味着不会有一个异步的响应去表明当前请求的结果，预期另外的进程和服务去处理请求，或者批处理。
- 203 Non-Authoritative Information：服务器已成功处理了请求，但返回的信息可能来自另一来源。
- **204** No Content：正常处理，但无资源返回，响应报文中不含实体主体
- **205** Reset Content：服务器成功处理了请求，且没有返回任何内容。
- 206 Partial Content：客户端进行了范围请求且服务器成功执行了这部分的 GET 请求

**3XX 重定向**

- **300** Multiple Choice：针对请求，服务器可执行多种操作。 服务器可根据 user agent 选择一项操作，或提供操作列表供请求者选择。
- **301** Moved Permanently：永久性重定向，请求的资源已被分配了新的 URI（以后都用新 URI）
- **302** Found：临时性重定向，请求的资源被暂时的移动到了由 Location 头部指定的 URL 上（本次使用新 URI 访问）
- 303 See Other：请求对应的资源存在另一个 URI,应该使用 GET 方法定向获取请求的资源
  当 301、302、303 响应状态码返回，几乎所有浏览器都会把 POST 改成 GET，并删除请求报文内的主体，之后请求自动再次发送
- 304 Not Modified：如果客户端发送了一个带条件的 GET 请求且该请求已被允许，而文档的内容（自上次访问以来或者根据请求的条件）并没有改变，则服务器应当返回这个状态码。304 响应禁止包含消息体，因此始终以消息头后的第一个空行结尾。
- 305 Use Proxy：请求者只能使用代理访问请求的网页。 （已不再使用，但目前仍能生效）
- 307 Temporary Redirect：服务器目前从不同位置的网页响应请求，但请求者应继续使用原有位置来进行以后的请求。
- **308** Permanent Redirect：资源现在永久位于响应头中`Location`指定的另一个 URI。

**4XX 请求错误**

- **400** Bad Request：响应状态码表示由于语法无效，服务器无法理解该请求
- **401** Unauthorized：发送的请求需要有通过 http 认证（BASIC 认证、DIGEST 认证）的认证信息。该响应必须包含一个适用于被请求资源的 WWW-Authenticate 信息头用以询问用户信息。若之前已经进行了一次请求，则表示用户认证失败
- **403** Forbidden：服务器端有能力处理该请求，但是拒绝授权访问
- **404** Not Found：服务器端无法找到所请求的资源
- 405 Method Not Allowed：禁用请求中指定的方法。
- 406 Not Acceptable：无法使用请求的内容特性响应请求的网页。
- 407 Proxy Authentication Required：此状态代码与 401（未授权）类似，但指定请求者应当授权使用代理。
- **408** Request Timeout：服务器等候请求时发生超时。
- 409 Conflict：服务器在完成请求时发生冲突。 服务器必须在响应中包含有关冲突的信息。
- **410** Gone：如果请求的资源已永久删除，服务器就会返回此响应。
- 411 Length Required：服务器不接受不含有效内容长度标头字段的请求。
- 412 Precondition Failed：服务器未满足请求者在请求中设置的其中一个前提条件。
- 413 Payload Too Large：服务器无法处理请求，因为请求实体过大，超出服务器的处理能力。
- 414 URI Too Long：请求的 URI 过长，服务器无法处理。
- 415 Unsupported Media Type：请求的格式不受请求页面的支持。
- 416 Requested Range Not Satisfiable：如果页面无法提供请求的范围，则服务器会返回此状态代码。
- 417 Expectation Failed：服务器未满足”期望”请求标头字段的要求。

**5XX 服务器错误**

- **500** Internal Server Error ：服务器端错误，所请求的服务器遇到意外的情况并阻止其执行请求。
- **502** Bad Gateway：服务器作为网关或代理，从上游服务器收到无效响应。
- **503** Server Unavailable：服务器暂时处于超负载或者正在停机维护，现在无法处理请求
- **504** Gateway Timeout：服务器作为网关或代理，但是没有及时从上游服务器收到请求。
- 505 HTTP Version Not Supported：服务器不支持请求中所用的 HTTP 协议版本。

# HTTP Cookie

HTTP Cookie（也叫 Web Cookie 或浏览器 Cookie）是服务器发送到用户浏览器并保存在本地的一小块数据，它会在浏览器下次向同一服务器再发起请求时被携带并发送到服务器上。通常，它用于告知服务端两个请求是否来自同一浏览器，如保持用户的登录状态。Cookie 使基于无状态的 HTTP 协议记录稳定的状态信息成为了可能。

Cookie 主要用于以下三个方面：

- 会话状态管理（如用户登录状态、购物车、游戏分数或其它需要记录的信息）
- 个性化设置（如用户自定义设置、主题等）
- 浏览器行为跟踪（如跟踪分析用户行为等）

当服务器收到 HTTP 请求时，服务器可以在响应头里面添加一个 Set-Cookie 选项。浏览器收到响应后通常会保存下 Cookie，之后对该服务器每一次请求中都通过 Cookie 请求头部将 Cookie 信息发送给服务器。另外，Cookie 的过期时间、域、路径、有效期、适用站点都可以根据需要来指定。

```
Set-Cookie: <cookie名>=<cookie值>
```

- 会话期 Cookie 是最简单的 Cookie：浏览器关闭之后它会被自动删除，也就是说它仅在会话期内有效。会话期 Cookie 不需要指定过期时间（Expires）或者有效期（Max-Age）。需要注意的是，有些浏览器提供了会话恢复功能，这种情况下即使关闭了浏览器，会话期 Cookie 也会被保留下来，就好像浏览器从来没有关闭一样。
- 持久性 Cookie 可以指定一个特定的过期时间（Expires）或有效期（Max-Age）。
  ```
  Set-Cookie: id=a3fWa; Expires=Wed, 21 Oct 2015 07:28:00 GMT;
  ```
  当 Cookie 的过期时间被设定时，设定的日期和时间只与客户端相关，而不是服务端。

标记为 Secure 的 Cookie 只应通过被 HTTPS 协议加密过的请求发送给服务端。但即便设置了 Secure 标记，敏感信息也不应该通过 Cookie 传输，因为 Cookie 有其固有的不安全性，Secure 标记也无法提供确实的安全保障。

```
Set-Cookie: id=a3fWa; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Secure; HttpOnly
```

Domain 和 Path 标识定义了 Cookie 的作用域：即 Cookie 应该发送给哪些 URL。

- Domain 标识指定了哪些主机可以接受 Cookie。如果不指定，默认为当前文档的主机（不包含子域名）。如果指定了 Domain，则一般包含子域名。
  例如，如果设置 `Domain=mozilla.org`，则 Cookie 也包含在子域名中（如`developer.mozilla.org`）。
- Path 标识指定了主机下的哪些路径可以接受 Cookie（该 URL 路径必须存在于请求 URL 中）。以字符 `/`作为路径分隔符，子路径也会被匹配。

SameSite Cookie 允许服务器要求某个 cookie 在跨站请求时不会被发送，从而可以阻止跨站请求伪造攻击（CSRF）。

```
Set-Cookie: key=value; SameSite=Strict

Strict：浏览器将只发送相同站点请求的cookie(即当前网页URL与请求目标URL完全一致)。如果请求来自与当前location的URL不同的URL，则不包括标记为Strict属性的cookie。
若不开启SameSite，则设为None
```

每个 Cookie 都会有与之关联的域（Domain）
如果 Cookie 的域和页面的域相同，那么称这个 Cookie 为第一方 Cookie（first-party cookie）
如果 Cookie 的域和页面的域不同，则称之为第三方 Cookie（third-party cookie.）
一个页面包含图片或存放在其他域上的资源（如图片广告）时，第一方的 Cookie 也只会发送给设置它们的服务器。
通过第三方组件发送的第三方 Cookie 主要用于广告和网络追踪。
大多数浏览器默认都允许第三方 Cookie，但是可以通过附加组件来阻止第三方 Cookie

Cookie 的一个极端使用例子是僵尸 Cookie（或称之为“删不掉的 Cookie”），这类 Cookie 较难以删除，甚至删除之后会自动重建。它们一般是使用 Web storage API、Flash 本地共享对象或者其他技术手段来达到的。

# HTTP 连接

连接管理是一个 HTTP 的关键话题：打开和保持连接在很大程度上影响着网站和 Web 应用程序的性能。
在 HTTP/1.x 里有多种模型：短连接, 长连接, 和 HTTP 流水线。

HTTP 的连接管理适用于两个连续节点之间的连接，如 hop-by-hop，而不是 end-to-end。
当模型用于从客户端到第一个代理服务器的连接和从代理服务器到目标服务器之间的连接时(或者任意中间代理)效果可能是不一样的。
HTTP 协议头受不同连接模型的影响，比如 Connection 和 Keep-Alive，就是 hop-by-hop 协议头，它们的值是可以被中间节点修改的。

**短连接**
短连接是 HTTP 最早期的模型，也是 HTTP/1.0 的默认模型。每一个 HTTP 请求都由它自己独立的连接完成，这意味着发起每一个 HTTP 请求之前都会有一次 TCP 握手，而且是连续不断的。
短连接破坏了 TCP 具备的能力，新的冷连接降低了其性能。
在 HTTP/1.1 中，只有当 Connection 被设置为 close 时才会用到这个模型。

**长连接**
一个长连接会保持一段时间，重复用于发送一系列请求，节省了新建 TCP 连接握手的时间，还可以利用 TCP 的性能增强能力。
当然这个连接也不会一直保留着：连接在空闲一段时间后会被关闭(服务器可以使用 Keep-Alive 协议头来指定一个最小的连接保持时间)。
缺点：就算是在空闲状态，它还是会消耗服务器资源，而且在重负载时，还有可能遭受 DoS attacks 攻击。这种场景下，可以使用非长连接，即尽快关闭那些空闲的连接，也能对性能有所提升。
把 `Connection` 设置成 `close` 以外的其它参数都可以让其保持长连接，通常会设置为 `retry-after`。在 HTTP/1.1 里，默认就是长连接的，协议头都不用再去声明它。

**流水线**
默认情况下，HTTP 请求是按顺序发出的。下一个请求只有在当前请求收到应答过后才会被发出。由于会受到网络延迟和带宽的限制，在下一个请求被发送到服务器之前，可能需要等待很长时间。
流水线是在同一条长连接上发出连续的请求，而不用等待应答返回。这样可以避免连接延迟。理论上讲，性能还会因为两个 HTTP 请求有可能被打包到一个 TCP 消息包中而得到提升。
并不是所有类型的 HTTP 请求都能用到流水线：只有 idempotent 方式，比如 GET、HEAD、PUT 和 DELETE 能够被安全的重试：如果有故障发生时，流水线的内容要能被轻易的重试。

HTTP 流水线在现代浏览器中并不是默认被启用的，因为：

- Web 开发者并不能轻易的遇见和判断那些搞怪的代理服务器的各种莫名其妙的行为。
- 正确的实现流水线是复杂的：传输中的资源大小，多少有效的 RTT 会被用到，还有有效带宽，流水线带来的改善有多大的影响范围。
- 流水线受制于 HOL（Head-Of-Line）问题。

**域名分片**
作为 HTTP/1.x 的连接，请求是序列化的，哪怕本来是无序的，在没有足够庞大可用的带宽时，也无从优化。
一个解决方案是，浏览器为每个域名建立多个连接，以实现并发请求。曾经默认的连接数量为 2 到 3 个，现在比较常用的并发连接数已经增加到 6 条。如果尝试大于这个数字，就有触发服务器 DoS 保护的风险。

如果服务器端想要更快速的响应网站或应用程序的应答，它可以迫使客户端建立更多的连接。
例如，不要在同一个域名下获取所有资源，假设有个域名是 `www.example.com`，可以把它拆分成好几个域名：`www1.example.com`、`www2.example.com`、`www3.example.com`。所有这些域名都指向同一台服务器，浏览器会同时为每个域名建立 6 条连接(在这个例子中，连接数会达到 18 条)。

# HTTP 缓存

缓存大致分为两类：

- 私有缓存：只能用于单独用户。浏览器缓存拥有用户通过 HTTP 下载的所有文档。这些缓存为浏览过的文档提供向后/向前导航，保存网页，查看源码等功能，可以避免再次向服务器发起多余的请求。它同样可以提供缓存内容的离线浏览。
- 共享缓存可以被多个用户使用。例如，ISP 或你所在的公司可能会架设一个 web 代理来作为本地网络基础的一部分提供给用户。这样热门的资源就会被重复使用，减少网络拥堵与延迟。

常见的 HTTP 缓存只能存储 GET 响应，对于其他类型的响应则无能为力。缓存的关键主要包括 request method 和目标 URI（一般只有 GET 请求才会被缓存）。 普遍的缓存案例:

- 一个检索请求的成功响应: 对于 GET 请求，响应状态码为：200，则表示为成功。一个包含例如 HTML 文档，图片，或者文件的响应。
- 永久重定向: 响应状态码：301。
- 错误响应: 响应状态码：404 的一个页面。
- 不完全的响应: 响应状态码 206，只返回局部的信息。
- 除了 GET 请求外，如果匹配到作为一个已被定义的 cache 键名的响应。

HTTP/1.1 定义的 `Cache-Control`头用来区分对缓存机制的支持情况， 请求头和响应头都支持这个属性。通过它提供的不同的值来定义缓存策略。

- 禁止缓存：缓存中不得存储任何关于客户端请求和服务端响应的内容。
  ```
  Cache-Control: no-store
  ```
- 强制确定缓存：每次有请求发出时，缓存会将此请求发到服务器，服务器端会验证请求中所描述的缓存是否过期，若未过期（注：实际就是返回 304），则缓存才使用本地缓存副本。
  ```
  Cache-Control: no-cache
  ```
- 共有缓存：该响应可以被任何中间人（比如中间代理、CDN 等）缓存。若指定了 public，则一些通常不被中间人缓存的页面（比如 带有 HTTP 验证信息（帐号密码）的页面 或 某些特定状态码的页面），将会被其缓存。
  ```
  Cache-Control: public
  ```
- 私有缓存：该响应是专用于某单个用户的，中间人不能缓存此响应，该响应只能应用于浏览器私有缓存中。默认为 private。
  ```
  Cache-Control: private
  ```

**缓存过期机制：**

- `max-age`：指定的是距离请求发起的时间的秒数
  ```
  Cache-Control: max-age=31536000
  ```
- `expires`：指定的是日期
  ```
  Expires: Wed, 21 Oct 2015 07:28:00 GMT
  ```

缓存会定期地将一些副本删除，这个过程叫做**缓存驱逐**。
服务器更新一个资源时，不可能直接通知客户端更新缓存，所以双方必须为该资源约定一个过期时间，**在该过期时间之前，该资源（缓存副本）就是新鲜的，当过了过期时间后，该资源（缓存副本）则变为陈旧的**。
驱逐算法用于将陈旧的资源（缓存副本）替换为新鲜的，注意，**一个陈旧的资源（缓存副本）是不会直接被清除或忽略的**。
当客户端发起一个请求时，**缓存检索到已有一个对应的陈旧资源（缓存副本），则缓存会先将此请求附加一个`If-None-Match`头，然后发给目标服务器，以此来检查该资源副本是否是依然还是算新鲜的**。
若服务器返回了 `304 (Not Modified)`（该响应不会有带有实体信息），则表示此资源副本是新鲜的。
若服务器通过 `If-None-Match` 或 `If-Modified-Since`判断后发现已过期，那么会带有该资源的实体内容返回。

对于请求，服务器会先查看`Cache-control: max-age`，若不含该属性则会去查看是否包含 `Expires` 属性。
如果 `max-age` 和 `expires` 属性都没有，则会找头里的 `Last-Modified` 信息，如果有，缓存的寿命就等于头里面 `Date` 减去 `Last-Modified`除以 10，即`Date - Last-Modified / 10`

**缓存验证确认：**当使用了`must-revalidate`指令，那就意味着缓存在考虑使用一个陈旧的资源时，必须先验证它的状态，已过期的缓存将不被使用。

```
Cache-Control: must-revalidate
```

用户点击刷新按钮时会开始缓存验证。如果缓存的响应头信息里含有`Cache-control: must-revalidate`的定义，在浏览的过程中也会触发缓存验证。
另外，在浏览器偏好设置里设置 `Advanced->Cache` 为强制验证缓存也能达到相同的效果。

当缓存的文档过期后，需要进行缓存验证或者重新获取资源。只有在服务器返回强校验器或者弱校验器时才会进行验证。

`ETag` 响应头作为**缓存的一种强校验器**，是一个对用户代理不透明的值。对于像浏览器这样的 HTTP 用户代理，不知道 ETag 代表什么，不能预测它的值是多少。如果资源请求的响应头里含有 ETag, 客户端可以在后续的请求的头中带上 `If-None-Match`头来验证缓存。

```
例：ETag: "51142bc1-7449-479b075b2891b"
```

`Last-Modified`响应头可以作为一种弱校验器，因为它只能精确到一秒。如果响应头里含有这个信息，客户端可以在后续的请求中带上 `If-Modified-Since` 来验证缓存。

当向服务端发起缓存校验的请求时，服务端会返回 `200 ok`表示返回正常的结果或者 `304 Not Modified`(不返回 body)表示浏览器可以使用本地缓存文件。304 的响应头也可以同时更新缓存文档的过期时间。

**Vary 头**
`Vary` HTTP 响应头决定了对于后续的请求头，如何判断是请求一个新的资源还是使用缓存的文件。
当缓存服务器收到一个请求，只有当前的请求和原始（缓存）的请求头跟缓存的响应头里的 Vary 都匹配，才能使用缓存的响应。

```
例：Vary: User-Agent
```

使用 vary 头有利于内容服务的动态多样性。例如，使用 `Vary: User-Agent` 头，缓存服务器需要通过 User-Agent 判断是否使用缓存的页面。如果需要区分移动端和桌面端的展示内容，利用这种方式就能避免在不同的终端展示错误的布局。

# HTTP 安全

## 内容安全策略 CSP

## HTTP 公钥锁定 HPKP

## HTTP 严格传输安全 HSTS

## X-Content-Type-Options

## X-Frame-Options

## X-XSS-Protection

**参考文章**

> HTTP | MDN https://developer.mozilla.org/zh-CN/docs/Web/HTTP
> 关于 HTTP 协议，一篇就够了 https://www.cnblogs.com/ranyonsue/p/5984001.html
> 开发之前应该了解的 HTTP https://blog.csdn.net/qq_35414779/article/details/78981151

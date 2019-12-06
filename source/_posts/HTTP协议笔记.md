---
title: HTTP协议基础笔记
date: 2018-05-31 12:02:09
tags: [网络,http]
---

本篇包含以下内容
* [Web概述](#Web概述)
* [HTTP概述](#HTTP概述)
* [HTTP报文](#HTTP报文)
  * [HTTP首部](#HTTP首部)
  * [状态码](#状态码)
  * [HTTP请求方式](#HTTP请求方式)
* [HTTP_Cookie](#HTTP_Cookie)
<!-- more -->

## Web概述
WWW（World Wide Web）环球信息网，也称万维网，由W3C万维网联盟管理。万维网并不等同互联网，万维网只是互联网所能提供的服务其中之一，是靠着互联网运行的一项服务。
WWW的三种技术：HTML，HTTP，URL

**URI：**统一资源标识符，表示服务器资源名称，给定了URI，HTTP便能解析资源。URI有两种形式：
* **URL统一资源定位符**：描述特定服务器上指定资源的位置，是固定的。包含三部分：
  * 方案：说明访问资源使用的协议方式，如http://
  * 服务器因特网地址
  * 指定服务器上的指定资源
**几乎所有URI都是URL**
* **URN统一资源名**：特定资源的唯一名称，与资源所在地址无关，资源可以四处搬运。




## HTTP概述
超文本传输​​协议Hyper Text Transfer Protocol（HTTP）是用于传输诸如HTML的超媒体文档的应用层协议，用于Web浏览器和Web服务器之间的通信，基于TCP/IP，采用C/S模式。HTTP是无状态协议，意味着服务器不会在两个请求之间保留任何数据（状态）。

HTTP的三个常见版本：
* HTTP/1.0：客户端只能从web服务器获取一个web资源
* HTTP/1.1：客户端能在一个连接上获取多个web资源（有数量限制，超出部分请求被阻塞）
* HTTP/2.0：多流并行，一个连接可获取多个web资源

特点：
* 简单快速：HTTP协议简单，报文简单易懂，HTTP服务器程序规模 小，通信速度快。
* 灵活：HTTP允许传输任意类型的数据对象。正在传输的类型由`Content-Type`加以标记。
* 可扩展：通过HTTP首部，只要服务端和客户端就新首部达成语义一致，新功能就可以被轻松加入进来。
* 无状态：在同一个连接中，两个执行成功的请求之间是没有关系的。但是可以通过HTTP的头部扩展和HTTP Cookies解决，把Cookies添加到头部中，让每次请求都能共享相同的上下文信息，来创建有状态的会话。




## HTTP报文
HTTP消息头（HEADER，也称首部）
1.通用（一般）头：适用于请求和响应消息，但与最终消息主体中传输的数据无关
2.请求头：包含有关要获取的资源或客户端本身更多信息
3.响应头：包含有关服务器响应的补充信息，如其位置或服务器本身（名称和版本等）
4.实体头：包含有关实体主体的更多信息，比如主体长(Content-Length)度或其MIME类型


### HTTP请求方式
* GET：请求访问已被URL识别的资源，不会对信息产生影响，每次GET方法都是相同的，GET放在URL首部，GET提交的数据大小一般限制为1024字节，大小随浏览器而。采用明文传输，速度快。只产生一个TCP数据包。GET能被缓存。
* POST：请求服务器传输信息实体的主体，POST放在报文中，没有具体限制，由于放在报文中所以无法看见，安全，form表单必须使用POST。会产生两个TCP数据包。POST不可被缓存。POST提交数据大小没有限制。
* PUT：传输文件，在请求报文的主体中包含文件内容，然后保存到请求URL指定的位置（出于安全，网站一般不会用）
* HEAD：获取报文首部，用于确认URI的有效性及资源更新的日期时间等
* DELETE：请求URL删除指定的资源，与PUT相反（同样一般不用）
* OPTIONS：查询指定URL资源支持的方法
* TRACE：追踪路径，让服务器将之前的请求通信返还给客户端
* CONNECT：要求在与代理服务器通信时建立隧道，实现用隧道协议进行TCP通信，主要使用SSL（安全套接层）和TLS（传输层安全）协议把通信内容加密后经过网络传输。

GET与POST的区别：

|GET|POST|
|--|----|
|请求访问已被URL识别的资源|将实体提交到指定资源|
|放在URL首部，明文传输，可见|封装在报文中，不可见|
|产生一个TCP包|产生两个TCP包|
|能被缓存|不可被缓存|
|数据传输大小随浏览器而定，一般为1024字节|没有具体限制|

### HTTP首部
HTTP请求报文（Request）
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
* 执行动作：即请求方式。
* 请求目标：完整路径，通常是一个URL，或者是协议、端口和域名的绝对路径
  * 绝对路径，末尾加上?与查询字符串，称为原始形式
  * 完整URL，称为绝对形式，通常GET使用
  * 域名:端口，仅在使用 CONNECT 建立 HTTP 隧道时才使用
  * 星号形式\*，配合 OPTIONS 方法使用，代表整个服务器
* HTTP版本

第二行以后的内容都称为HTTP首部（Headers）。
* Host：请求的服务器主机名
User-Agent：用户代理端，即客户端（浏览器），包含详细的浏览器名和

HTTP响应报文（Response）
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
第一行为响应行，包含两个部分：
* HTTP版本
* 状态码
第二行开始为响应首部
* Content-Type：指示服务器文档的MIME类型。帮助用户代理（浏览器）去处理接收到的数据。


### 状态码
**类别：**
* 1XX：信息类------->请求正在处理，属于临时响应
* 2XX：成功类------->请求正常处理完毕
* 3XX：重定向------->需要附加操作完成请求
* 4XX：客户端错误---->服务器无法处理请求
* 5XX：服务器错误---->服务器处理请求出错

**常见状态码：**

**1XX信息响应**
* 100 Continue：迄今为止的所有内容都是可行的，客户端应该继续请求，如果已经完成，则忽略它。
* 101 Switching Protocol：响应客户端的 Upgrade 标头发送的，并且指示服务器也正在切换的协议。
* 102 Processing (WebDAV)：服务器已收到并正在处理该请求，但没有响应可用。

**2XX成功响应**
* 200 OK：正常，客户端的请求在服务器被正常处理
* 201 Created：该请求已成功，并因此创建了一个新的资源。这通常是在PUT请求之后发送的响应。
* 202 Accepted：请求已经接收到，但还未响应，没有结果。意味着不会有一个异步的响应去表明当前请求的结果，预期另外的进程和服务去处理请求，或者批处理。
* 203 Non-Authoritative Information：服务器已成功处理了请求，但返回的信息可能来自另一来源。
* 204 No Content：正常处理，但无资源返回，响应报文中不含实体主体
* 205 Reset Content：服务器成功处理了请求，且没有返回任何内容。
* 206 Partial Content：客户端进行了范围请求且服务器成功执行了这部分的GET请求

**3XX重定向**
* 300 Multiple Choice：针对请求，服务器可执行多种操作。 服务器可根据user agent选择一项操作，或提供操作列表供请求者选择。
* 301 Moved Permanently：永久性重定向，请求的资源已被分配了新的URI（以后都用新URI）
* 302 Found：临时性重定向，请求的资源被暂时的移动到了由Location 头部指定的 URL 上（本次使用新URI访问）
* 303 See Other：请求对应的资源存在另一个URI,应该使用GET方法定向获取请求的资源
当301、302、303响应状态码返回，几乎所有浏览器都会把POST改成GET，并删除请求报文内的主体，之后请求自动再次发送
* 304 Not Modified：如果客户端发送了一个带条件的 GET 请求且该请求已被允许，而文档的内容（自上次访问以来或者根据请求的条件）并没有改变，则服务器应当返回这个状态码。304响应禁止包含消息体，因此始终以消息头后的第一个空行结尾。
* 305 Use Proxy：请求者只能使用代理访问请求的网页。 （已不再使用，但目前仍能生效）
* 307 Temporary Redirect：服务器目前从不同位置的网页响应请求，但请求者应继续使用原有位置来进行以后的请求。
* 308 Permanent Redirect：资源现在永久位于响应头中`Location`指定的另一个URI。

**4XX请求错误**
* 400 Bad Request：响应状态码表示由于语法无效，服务器无法理解该请求
* 401 Unauthorized：发送的请求需要有通过http认证（BASIC认证、DIGEST认证）的认证信息。该响应必须包含一个适用于被请求资源的 WWW-Authenticate 信息头用以询问用户信息。若之前已经进行了一次请求，则表示用户认证失败
* 403 Forbidden：服务器端有能力处理该请求，但是拒绝授权访问
* 404 Not Found：服务器端无法找到所请求的资源
* 405 Method Not Allowed：禁用请求中指定的方法。
* 406 Not Acceptable：无法使用请求的内容特性响应请求的网页。
* 407 Proxy Authentication Required：此状态代码与 401（未授权）类似，但指定请求者应当授权使用代理。
* 408 Request Timeout：服务器等候请求时发生超时。
* 409 Conflict：服务器在完成请求时发生冲突。 服务器必须在响应中包含有关冲突的信息。
* 410 Gone：如果请求的资源已永久删除，服务器就会返回此响应。
* 411 Length Required：服务器不接受不含有效内容长度标头字段的请求。
* 412 Precondition Failed：服务器未满足请求者在请求中设置的其中一个前提条件。
* 413 Payload Too Large：服务器无法处理请求，因为请求实体过大，超出服务器的处理能力。
* 414 URI Too Long：请求的URI过长，服务器无法处理。
* 415 Unsupported Media Type：请求的格式不受请求页面的支持。
* 416 Requested Range Not Satisfiable：如果页面无法提供请求的范围，则服务器会返回此状态代码。
* 417 Expectation Failed：服务器未满足”期望”请求标头字段的要求。

**5XX服务器错误**
* 500 Internal Server Error ：服务器端错误，所请求的服务器遇到意外的情况并阻止其执行请求。
* 502 Bad Gateway：服务器作为网关或代理，从上游服务器收到无效响应。
* 503 Server Unavailable：服务器暂时处于超负载或者正在停机维护，现在无法处理请求　
* 504 Gateway Timeout：服务器作为网关或代理，但是没有及时从上游服务器收到请求。
* 505 HTTP Version Not Supported：服务器不支持请求中所用的 HTTP 协议版本。










**参考文章**

> HTTP | MDN https://developer.mozilla.org/zh-CN/docs/Web/HTTP
> 关于HTTP协议，一篇就够了 https://www.cnblogs.com/ranyonsue/p/5984001.html
> 开发之前应该了解的HTTP https://blog.csdn.net/qq_35414779/article/details/78981151
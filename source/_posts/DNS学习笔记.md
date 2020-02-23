---
date: 2018-01-28 20:22:42
title: DNS学习笔记
tags: [server, DNS]
categories: [应用运维]
---

**本篇 DNS 笔记包含以下内容**

- [DNS 简介](#dns-%e7%ae%80%e4%bb%8b)
- [DNS 解析原理](#dns-%e8%a7%a3%e6%9e%90%e5%8e%9f%e7%90%86)
  - [DNS 域名解析原理（迭代）](#dns-%e5%9f%9f%e5%90%8d%e8%a7%a3%e6%9e%90%e5%8e%9f%e7%90%86%e8%bf%ad%e4%bb%a3)
  - [域名解析方法](#%e5%9f%9f%e5%90%8d%e8%a7%a3%e6%9e%90%e6%96%b9%e6%b3%95)
- [DNS 深入理解](#dns-%e6%b7%b1%e5%85%a5%e7%90%86%e8%a7%a3)
- [基础配置](#%e5%9f%ba%e7%a1%80%e9%85%8d%e7%bd%ae)
  - [正向解析](#%e6%ad%a3%e5%90%91%e8%a7%a3%e6%9e%90)
  - [反向解析](#%e5%8f%8d%e5%90%91%e8%a7%a3%e6%9e%90)
- [常用命令](#%e5%b8%b8%e7%94%a8%e5%91%bd%e4%bb%a4)

<!-- more -->

# DNS 简介

DNS 全称 Domain Name System 域名解析服务，用于解析域名与 IP 地址对应关系。

DNS 基于 UDP，UDP 端口号 53，也会使用 TCP 的 53 端口，先会用 UDP 查找，若 UDP 查不到或请求大于 512 字节时才用 TCP 查找。同时，UDP 进行名称解析，TCP 进行区域解析。

**DNS 组成：**

- 域名服务器：提供域名解析服务的软件。DNS 域名解析服务中最高效的是 Bind。Bind 的程序名叫 named。
- 解析器：访问域名服务器的客户端，负责解析从域名服务器获取的响应。如 nslookup。

目前互联网的命名方式为层次树状结构，任何互联网上的主机或路由器都有唯一层次结构的名字，即域名。

**功能**

- 正向解析：根据域名查找对应 IP
- 反向解析：根据 IP 查找对应域名

# DNS 解析原理

## DNS 域名解析原理（迭代）

1. 客户端将域名解析请求发给本地域名服务器或`/etc/resolv.conf`中列出的服务器
2. 本地域名服务器收到后，查询本地缓存，若有就返回
3. 若没有就把请求发给根域名服务器，迭代查询
4. 本地域名服务器会将最终的结果存入缓存，同时将结果返回给主机。
   > `/etc/resolv.conf`用于定义 dns 查询指向的服务器以及解析顺序
   > 文件结构

```
domain  domain_name       # 声明本地域名，即解析时自动隐式补齐的域名
search  domain_name_list  # 指定域名搜索顺序(最多6个)，和domain不能共存，若共存了，则后面的行生效
nameserver  IP-Address           # 设置DNS指向，最多3个
options timeout:n attempts:n  # 指定解析超时时间(默认5秒)和解析次数(默认2次)
```

## 域名解析方法

- 递归：服务器收到请求时，若不能解析，则把请求转发到下一台服务器直到有一台解析成功。注：是收到请求的服务器去问，一个问下一个，最后解析完成后原路返回。

{% asset_img digui.png %}

- 迭代：服务器收到请求时，若不能解析，则按根域->一级域名->二级域名->三级域名依次询问，直到解析成功。注：是本地服务器去不断问。

{% asset_img diedai.png %}

禁止递归查询的原因：对于授权域名服务器，若打开了递归查询，相当于配置为开放 DNS 服务器，会造成大量数据流量。所以在授权域名服务器上，应该禁用递归查询。
`recursion no;`

- 反向解析：根据 IP 查找对应域名。将创建一个 in-addr.arpa 的专门的域处理。
- 高速缓存：DNS 会将解析的信息保存在高速缓存中。每条记录都对应一个 TTL，设置在缓存中保存的时间。

# DNS 深入理解

**DNS 报文解析**
{% asset_img format.png %}

**分类**

- 主域名服务器 master server：在特定区域内具有唯一性的域名解析服务器
- 辅域名服务器 slave server：从主服务器获取域名解析信息并维护，以防主服务器宕机。会通过 TCP 与主域名服务器通信，获取 zone 数据。
- 缓存服务器 Caching-Only Server：向其他服务器查询域名解析信息，每获取一个就放在高速缓存中，提高重复查询效率。

**域名服务器类型**

- 根域名服务器：最高层次的域名服务器，存放所有顶级域名服务器的 IP 地址与域名。当一个本地域名服务器对一个域名无法解析时，就会直接找根域名服务器，根域名服务器会告知应该去哪个顶级域名服务器查询。全球共 13 个根域名服务器。可通过`dig`查看。
- 顶级域名服务器：负责管理在该服务器上注册的二级域名服务器的 IP 地址和域名。
- 授权域名服务器：DNS 采用分区方式设置域名服务器。一个服务器所管理的范围为区。区的范围小于等于域的范围，每个区都设有一台权限域名服务器，负责将其分区的主机域名解析。由专业域名服务公司维护，若授权域名服务器出现故障，域名将不能被解析。
- 本地域名服务器：也称默认域名服务器，当主机发出 DNS 查询报文时，会最先询问本地域名服务器。

**域名结构**
每一级域名都由英文字母与数字组成，不超过 63 字符，且不区分大小写，完整域名不超过 255 字符。
目前顶级域名 TLD（Top Level Domain）三大类：国家顶级域名、国际顶级域名、通用顶级域名。
互联网的命名空间是按照机构的组织划分的，与物理网络无关，与 IP 子网无关。

- . 根域，管理一级域名
- com、or、gov、cn 等一级域名，管理二级域名
- baidu、google 等二级域名，管理三级域名，当国家为一级域名时，com 等一级域名便会下降一级别，依次类推
- 依次会有三级，四级
- www、ftp、mail 等主机域名，为提供服务的主机名

DNS 系统采用阶层式管理，上一级的服务器只记录下一层的主机名（服务器名）

**资源记录**
语法`{name} {TTL} class record-type record-specfic-data`

- `name`：域记录名。通常只有第一个 DNS 资源记录会配置，其他资源记录的 name 可能为空，那么其他资源记录会接受先前资源记录的名字。
- `TTL`：生存时间。指定该数据在数据库中保存的时间，此栏若为空，表示默认生存时间在授权资源记录中指定。
- `class`：记录的类。大范围用于 Internet 地址和其他信息地址类为 IN（基本都是 IN）。
- `record-type`：记录类型。常为 A、NS、MX、CNAME
- `record-specfic-data`：记录指定数据。

记录类型：

- A：**IPv4 地址**记录，将主机映射到 IPv4 地址

  ```
  # host -v -t A baidu.com
  ;; ANSWER SECTION:
  baidu.com.              5       IN      A       123.125.115.110
  baidu.com.              5       IN      A       220.181.57.216
  ```

- AAAA：**IPv6 地址**记录，将主机名映射到 IPv6 地址

- CNAME：规范名称记录，将一个记录别名化为另一个记录，其中应具有 A 或 AAAA 记录。**就是实际主机名**
  当 DNS 解析器收到 CNAME 记录为查询响应时，DNS 解析器会使用规范名称重新发出查询。CNAME 记录数据可指向 DNS 中任何位置的名称，无论在区域内还是区域外。
  应避免将 CNAME 记录指向其他 CNAME 记录以避免 CNAME 循环。CNAME 记录链必须以 A 或 AAAA 记录结束。当使用 CDN 时，也可使用 CNAME 链。NS 和 MX 记录不可指向 CNAME 记录。

  ```
  # host -v -t CNAME baidu.com
  ;; ANSWER SECTION:
  www.baidu.com.          5       IN      CNAME   www.a.shifen.com.
  ```

- PTR：**指针记录**，将 IPv4 或 IPv6 地址映射到主机名，**用于反向 DNS 解析**。对行为类似于主机名的 IP 进行编码。

  ```
  # host -v -t PTR 202.108.22.220
  ;; ANSWER SECTION:
  220.22.108.202.in-addr.arpa. 5  IN      PTR     xd-22-220-a8.bta.net.cn.
  ```

- NS：**名称服务器**记录，将域名映射到 DNS 名称服务器。区域的每个公开授权名称服务器必须具有 NS 记录。

  ```
  # host -v -t ns baidu.com
  ;; ANSWER SECTION:
  baidu.com.              5       IN      NS      ns7.baidu.com.
  ```

- SOA：**授权起始记录**，提供有关 DNS**区域工作方式**的信息。每个区域正好有一个 SOA 记录，指定主服务器，以及辅（从）服务器更新副本的方式。

  ```
  # host -v -t SOA baidu.com
  ;; AUTHORITY SECTION:
  baidu.com.              5       IN      SOA     dns.baidu.com. sa.baidu.com. 2012138777 300 300 2592000 7200
  # dns.baidu.com.   主名称服务器（Master）
  # sa.baidu.com.    DNS区域负责人的邮箱地址，因为@在zone文件中有意义，所以改为了.
  # 2012138777       区域版本号（序列号）
  # 300              检查区域更新频率（单位s）（refresh）
  # 300              在重试失败的刷新前应等待的时间（单位s）（retry）
  # 2592000          刷新失败，在停止使用其旧区域副本前等待的时间（单位s）（expire）
  # 7200             若解析器查询某个名称并该名称不存在，解析器将“记录不存在”信息进行缓存的时间（单位s）

  值的设置范围：
  刷新频率（refresh）>= 2 × 重试刷新时间（retry）
  refresh+retry < 超时时间（expire）
  expire >= retry × 10
  expire >= 7天
  ```

- MX：**邮件交换**记录，将域名映射到邮件交换。邮件交换将接收该名称的电子邮件。
  数据为优先级，用于在多个 MX 记录间确定顺序，以及用于该名称的邮件交换的主机名。

  ```
  # dig -t mx google.com
  ;; ANSWER SECTION:
  google.com.		5	IN	MX	40 alt3.aspmx.l.google.com.
  google.com.		5	IN	MX	50 alt4.aspmx.l.google.com.
  google.com.		5	IN	MX	20 alt1.aspmx.l.google.com.
  google.com.		5	IN	MX	30 alt2.aspmx.l.google.com.
  google.com.		5	IN	MX	10 aspmx.l.google.com.

  #邮件域名前的数字，为优先级，值越低越优先，具有优先的邮件处理权
  ```

- TXT：**文本记录**，将名称映射到文本。通常用于提供发送方策略框架 SPF、域密钥识别邮件 DKIM、基于域的消息身份验证报告一致性 DMARC 等数据。

  ```
  # dig -t txt google.com
  ;; ANSWER SECTION:
  google.com.		5	IN	TXT	"v=spf1 include:_spf.google.com ~all"
  google.com.		5	IN	TXT	"facebook-domain-verification=22rm551cu4k0ab0bxsw536tlds4h95"
  google.com.		5	IN	TXT	"docusign=05958488-4752-4ef2-95eb-aa7ba8a3bd0e"

  # txt记录是按一定格式编写的，最常用的是SPF（sender policy framework），登记某个域名拥有的用来外发邮件的所有IP
  # SPF就是用于反垃圾邮件，阻止发件人发送假冒域中发件人地址的电子邮件
  # v=spf1 include:_spf.google.com ~all
  # 其中v标识spf版本，include指定spf标识，~all表示其余都不认可
  ```

  SPF 防止伪造邮件的过程：

  1. 邮件服务器收到邮件后，先检查哪个域声明发送了该邮件，并检查该域名的 SPF 记录的 DNS
  2. 确定发送服务器的 IP 地址是否与 SPF 记录中已发布的 IP 地址匹配
  3. 对该邮件打分，若匹配，则通过验证并打一个正分，否则不通过并打一个负分

- SRV：服务记录，用于查找支持域的特定服务的主机。
  使用格式设置为包含服务和协议名称的域名。如`_service._protocol.domainname`，SRV 记录可记录为域提供服务的主机名和服务端口号，还包括优先级和权重值。

> 名称服务器 Name Server：存储域名资源信息的程序，会响应解析器的请求。利用该服务器，整个网络可划分为一个域的分层结构。整个域名空间可划分为多个区域 zone，zone 通常表示管理界限的划分，也就是 DNS 树状结构上的一点。每个 zone 都有一个主域名服务器，还可有多个辅域名服务器。

反向解析：IP 是倒过来写的。

```
# dig -x 8.8.4.4
;; ANSWER SECTION:
4.4.8.8.in-addr.arpa.	5	IN	PTR	google-public-dns-b.google.com.
```

# 基础配置

环境

- CentOS7，内核 3.10
- 虚拟机网段：`192.168.163.0/24`
- DNS 服务器 IP 地址：`192.168.163.102/24`
- DNS 服务器主机名：`system2.example.com`
- 网关：`192.168.163.254`
- 客户端主机名：`system3.example.com`

DNS 服务相关配置文件

- `/etc/named.conf`：主配置文件
- `/etc/named.rfc1912.zones`：区域配置文件
- `/etc/reslov.conf`：本地的 DNS 服务器
- `/etc/nsswitch.conf`：优先级配置文件
- `/var/named/`目录：存放区域（zone）文件

**步骤**

- 安装 bind 服务
  `yum groupinstall DNS\ Server`

- 开启 named 服务
  防火墙放行 dns，rich rules 放行 UDP 和 TCP 的 53 端口
  `systemctl enable named.service`
  `firewall-cmd --add-service=dns --permanent`
  `firewall-cmd --permanent --add-rich-rule='rule family=ipv4 port port=53 protocol=udp protocol=tcp accept'`
  `firewall-cmd --reload`

- 修改配置文件
  修改配置文件最好先做备份 `cp -a XX XX.bak`
  首先修改`/etc/named.conf`

  **注：注释需要用`;` **

```
只摘取部分
options {		//指定bind服务参数
	//listen-on  指定bind侦听的本机IP及端口
	listen-on port 53 { any; };
	//要将{}中改为any，本机的任意IP都监听（一台服务器可能有多个IP）
	listen-on-v6 port 53 { ::1; };
	//directory 指定区域配置文件的路径
	//若使用chroot则该路径是相对路径，对应/var/named/chroot/var/named/
	directory 	"/var/named";
	//改为any，接受任意IP的DNS查询请求
	//也可指定网段，只给该网段做DNS
	allow-query   { any; };

	;forward only;      #只做转发
	forwarders {114.114.114.114; 8.8.8.8;};  #上层的DNS服务器
};
zone "." IN {		//指定当前bind可管辖的区域
	type hint;		//指定区域类型
	file "named.ca";//指定区域配置文件
};
//以下是区域配置文件和密钥文件
include "/etc/named.rfc1912.zones";
include "/etc/named.root.key";
```

修改后直接重新加载配置文件`rndc reload`，之后测试是否生效

```
# dig www.google.com @127.0.0.1
#@127.0.0.1是用于指定本地解析
.......
;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;www.google.com.			IN	A

;; ANSWER SECTION:
www.google.com.	  113	   IN              A      208.101.60.87
# 域名（FQDN）     TTL值  关键词INTERNET   RR类型  IPv4地址
```

## 正向解析

修改`/etc/named.rfc1912.zones`
配置正向解析区域文件
`named.conf`中也能写区域配置，但为了安全和管理，将主配置和区域配置分开为两个文件

```
zone "example.com" IN {
	type master;    //指定区域类型master
	file "example.com.zone";
	//指定区域配置文件路径（相对路径，相对于named.conf中directory指定路径）
	//表示若要解析example.com的域名就要去该文件找
	allow-update { none; };
	//不允许客户机动态更新解析信息
}
```

DNS 区域类型

- master：主要区域，拥有该区域数据文件，并对此区域提供管理数据
- slave：辅助区域，拥有主要区域数据的只读副本，从主区域同步所有区域数据
- hint：dns 启动时，使用 hint 区域的信息查找最近的根域名服务器，没有就使用默认根服务器

然后配置解析数据信息文件`/var/named/example.com.zone`
配置文件有模板，可复制`/var/named/named.localhost`并改名
最好将文件名改为域名.zone

```
	$TTL 1D
	@       IN SOA  example.com. root.example.com. (
	                                0   ;   serial    //更新序列号
	                                1D    ; refresh   //更新时间
	                                1H    ; retry     //重试延时
	                                1W    ; expire    //失效时间
	                                3H )  ; minimum   //无效解析记录的缓存时间
	        NS      ns.example.com.
	ns      IN A    192.168.163.102
	        IN MX 10        mail.example.com.
	mail    IN A    192.168.163.102
	www     IN A    192.168.163.102

	// TTL 指定资源记录存放在缓存中的时间，单位秒，一般直接调用$TTL的值
	// @为当前域，根据主配置文件的zone区域决定
	// IN是网络类型，表示自身
	// SOA记录：起始授权记录，在一个区域一定是唯一的，定义区域的全局参数
	// example.com. DNS区域地址（完整的，要加.根域）
	// root.example.com. 服务器邮箱地址（完整）
	//NS记录：名称服务器记录，在一个区域至少一条，记录区域的授权服务器，一般就指定为主机名ns
	//该记录下一行就指定该服务器的ip地址
	//ns 为主机名 A为地址记录，写域名对应IP
	//MX邮件交换记录：指定邮件服务器，用于根据收件人地址后缀定位邮件服务器，为管理员自己接收邮件的域名
	//其他主机名也是一样
```

>     主和辅服务器都应该列在上级域的NS记录中，才能形成一个正式的授权。也应该列在自己主机的域文件中，任何列在NS记录中的服务器必须配置为那个域的授权域名服务器。

## 反向解析

修改`/etc/named.rfc1912.zones`，添加

```
zone "163.168.192.in-addr.arpa" IN {
        type master;    # 服务类型master
        file "192.168.163.arpa";
}
```

反向解析的参考配置文件为`/var/named/named.loopback`

可通过`named-checkconf`或`named-checkzone`检查配置文件语法是否正确。
至此基础配置完成，重启服务

- 使用命令`nslookup`
  输入域名测试
  {% asset_img nslookup.png %}

# 常用命令

**`rndc`**：bind 的管理配置工具

```
rndc COMMANDS
  reload              重载主配置文件和区域解析库文件
  reload zone         重载区域解析库文件
  retransfer zone     手动启动区域传输过程
  notify zone         重新对区域传送通知
  reconfig            重载主配置文件和区域解析库文件
  querylog            开启或关闭查询日志
  trace               递增debug级别
rndc-confgen     生成rndc配置文件
```

**`host`：**查询某个域名或主机名所对应的所有 IP 地址

```
# host baidu.com
baidu.com has address 123.125.115.110
baidu.com has address 220.181.57.216
```

**`nslookup`：**查询一台主机 IP 及对应的域名

```
两种模式：
交互式：不加参数   非交互式：加参数
# nslookup baidu.com
Server:         192.168.163.254
Address:        192.168.163.254#53

# nslookup
> baidu.com
Server:         192.168.163.254
Address:        192.168.163.254#53
```

**`dig`**：查询 DNS 服务器

```
dig -t    指定查询类型
	例：dig -t mx|soa|ns
dig -x    反向解析
```

> 参考书籍：
> 骏马金龙 DNS & bind 从基础到深入http://www.cnblogs.com/f-ck-need-u/p/7367503.html
> 骏马金龙 Linux 的网络管理http://www.cnblogs.com/f-ck-need-u/p/7074594.html
> Linux 就该这么学
> Linux 运维最佳实践
> Linux 系统管理与网络管理
> Linux 服务器架设指南
> Linux 服务器架设、性能调优、集群管理教程

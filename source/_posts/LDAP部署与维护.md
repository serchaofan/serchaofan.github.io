---
title: LDAP部署与维护
date: 2018-11-24 09:22:47
tags: [LDAP, 验证]
categories: [系统运维]
comments: false
---

# 目录服务
**目录**是一类为了浏览和搜索数据而设计的特殊数据库，按照**树状**形式存储信息，目的包含基于属性的描述性信息，支持高级过滤功能。

目录不支持大多数事务型数据库支持的高吞吐量和复杂更新操作。**目录服务适合的业务应用于大量查询与搜索操作，而不是大量写入操作。目录服务器还能提供主从服务器同步目录数据功能。**

> DNS 就是一个典型的大范围分布式目录服务

目录服务器功能：

- 按照网络管理员指令，强制实施安全策略，保证目录信息安全
- 目录数据库可分布在一个网络的多台计算机上，提高响应速度
- 复制目录，使更多用户可使用目录，提高可靠性和稳定性
- 将目录划分为多个数据源（存储区），以存储大量对象

## X.500
X.500 是构成全球分布式的名录服务系统的协议，描述了用户信息的存储和访问方式，X.500 不是一个协议，而是一个协议族，包括从 X.501 到 X.525 等一系列完整的目录服务协议。X.500 采用层次结构（类似 DNS）。

X.500 相关协议或机制：

- **DAP 目录访问协议**：控制服务器和客户端之间的通信
- DSA 目录系统代理：用于存储目录信息的数据库，采用分层格式，提供快速高效的搜索功能，与目录信息树 DIT 连接。**DSA 之间通过链操作实现分布式访问。**
- DUA 目录用户代理：用于访问一个或多个 DSA 的用户接口程序
- DSP 目录系统协议：控制两个或多个 DSA 间、DUA 与 DSA 间的交互
- DISP 目录信息映像协议：定义了如何将选定的信息在服务器间进行复制
- DOP 目录操作绑定协议：定义了服务器间自动协商连接配置的机制
- X.501：模型定义，定义目录服务的基本模型和概念
- X.509：认证框架，定义如何处理目录服务中客户和服务器的认证
- X.511：抽象服务定义，定义 X.500 提供的服务原语
- X.518：分布式操作过程定义，定义如何跨平台处理目录服务
- X.520：定义属性类型和数据元素
- X.521：定义了对象类
- X.525：定义在多个服务器间的复制操作
- X.530：定义目录管理系统的使用

X.500 的 OSI 模型：

独立的目录信息树 DIT，采用层级化节点结构，每个节点都有一个唯一名称标识 DN（也称唯一辨别名），唯一名称由相对唯一名称 RDN（也称相对辨别名）标识和父节点标识组成。

X.500 特征：

- 分散维护：运行 X.500 的每个站点只负责本地目录，可立刻进行更新和维护
- 搜索性能：X.500 有强大的搜索功能，支持用户建立复杂查询
- 单一全局命名空间：为用户提供单一同性命名空间（Single Homogeneous Namespace），类似 DNS，但比 DNS 灵活且可扩展。
- 结构化信息结构：目录中定义了信息结构，允许本地扩展
- 基于标准的目录服务：请求应用目录信息的应用（邮件、资源分配器等）能访问重要且有价值的信息
- 基于 OSI 协议，需要在会话层和表示层进行许多连接的建立和包处理

## LDAP
LDAP 就是活动目录在 Linux 上的一个实现。

LDAP（Lightweight Directory Access Protocol）轻量目录访问协议，基于 X.500 标准，支持 TCP/IP。

LDAP 支持一主多从、多主多从以及分布式。

DAP 是一个重量级的协议，在整个 OSI 协议栈上操作，需要占用大量计算资源，而 LDAP 设计在 TCP/IP 上，以小得多的资源消耗实现了大多数 DAP 功能。LDAP 服务器可当做网关访问 X.500 服务器，但基本都是在 X.500 服务器上直接实现 LDAP。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120026324.png)

单独的 LDAP 守护程序 slapd，可看做是轻量级 X.500 服务器。LDAP 就是轻量级的 DAP。

LDAP 与 X.500 的相同点：

- 都实现了通用的平台结构
- 信息模型上，都使用了项、对象类、属性等概念描述信息
- 命名空间上，都使用了目录信息树结构和层次命名模型
- 功能模型上，都使用了相似操作命令
- 认证框架上，都实现了用户名密码、安全加密认证
- 灵活性上，目录规模都可大可小
- 分布性上，目录信息都可分布在多个目录服务器上，服务器由各组织管理，保证目录信息总体结构一致

LDAP 常用名词：

- dc：Domain Component，域名部分，会将完整域名分成几部分。如 example.com 会分为 dc=example,dc=com
- uid：User id，用户 ID。最常见的 uid 是从`/etc/passwd`中转来的条目。
- ou：Organization Unit，组织单位，类似文件系统的子目录，是一个容器对象，可包含其他各种对象。
- cn：Common Name，公共名称。最常见的 cn 是从`/etc/group`中转来的条目
- sn：Surname，姓
- dn：Distinguished Name，唯一辨别名，类似文件系统的绝对路径，每个对象都有一个唯一名称。
- rdn：Relative dn：相对辨别名，类似文件系统的相对路径，是与目录树结构无关的部分。
- c：Country，国家。如 CN、US
- o：Organization，组织。如 Inc

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120024971.png)

LDAP 目录结构与信息：

- 目录数据库以目录信息树 DIT 为存储方式的。
- DIT 由条目（Entry）构成，条目相当于关系数据库中的表的记录。
- 条目又由 DN 的键值对（Attribute-Value）组成
- LDAP 允许通过 objectClass 来控制哪些属性是条目必须的，objectClass 的值是条目必须遵从的方案 schema 定义的。
- LDAP 目录的根称为 BaseDN
- ou 下是真正的用户条目
- LDAP 数据导入导出的格式是 LDIF，LDIF 是 LDAP 数据库信息的一种文本格式。

LDAP 特点总结：

- 跨平台
- 树型结构，无需 SQL 语句维护
- 静态数据快速查询
- 使用基于推拉的复制信息技术
- 支持多种安全协议（SASL、SSL、TLS）和多种访问控制
- 支持异类数据存储（存储文件可以是文本或图片）
- C/S 模型

LDAP 常见应用：

- 数字证书管理、授权管理、单点登录
- 分布式计算环境 DCE、统一描述发现与集成协议 UDDI
- MAIL、DNS、网络用户管理、电话号码簿
- 内网组织信息服务、电子政务目录、人口基础库

LDAP 目录数据文件：

LDIF（LDAP Data Interchange Format，轻量级目录交换格式）是一种 ASCII 文件格式，能够向目录导入与修改信息。

LDIF 文件注意点：

- 空行分割一个条目或定义
- #注释
- 属性: 属性值
- 属性可被重复赋值
- 每行结尾不能有空格
- 每条记录必须有至少一个 objectClass 属性

### LDAP 的配置模式
- 基本的目录查询服务：slapd 仅为本地域提供目录服务，不会以任何方式与别的目录服务器交互。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120027508.png)

- 目录查询代理服务：带有指针（Refferals），类似 DNS，若本地的 LDAP 无法处理，则会返回一个指针，指向更高级的服务器地址。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120027137.png)

- 异机复制数据，即主从同步：LDAP 的 slurpd 守护进程是用于将 slapd 上的改变传播到一个或多个从的 slapd 上。可以通过 inotify+rsync 方案实现简单的同步。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120027474.png)

# LDAP Docker部署
使用的镜像为：`osixia/openldap`
> 官方Github仓库：https://github.com/osixia/docker-openldap

启动命令：
```
docker run -d --name ldap-service \
              --hostname ldap-service \
              -p 389:389 -p 689:689 \
              -v /data/openldap/database:/var/lib/ldap \
              -v /data/openldap/config:/etc/ldap/slapd.d \
              --env LDAP_ORGANISATION="公司名" \
              --env LDAP_DOMAIN="公司域名" \
              --env LDAP_ADMIN_PASSWORD="admin账号的密码" \
              --env LDAP_TLS=false \
              --detach osixia/openldap:stable
```
> 注：
> 启动前需要先建目录/data/openldap，这个是ldap数据目录，需要定期备份。
> LDAP_ORGANISATION 指定的是公司名，若不填就是默认值Example Inc.
> LDAP_DOMAIN 指定的是公司域名，若不填则是默认值example.org。该值会转化为namingContexts的值`dc=xxx,dc=xxx`，例如example.org会转为`dc=example,dc=org`，也就是DN中的后缀。

该容器启动后开放了389和689两个端口，即OpenLDAP监听的端口：
- 389：默认监听端口，是传输明文数据的
- 636：加密监听端口，默认启动时不开启，是传输密文数据的

常用的ldap管理界面，是由php编写的，同样可通过容器启动。
> 官方Github仓库：https://github.com/osixia/docker-phpLDAPadmin

```
docker run --name phpldapadmin-service \
            -p 6443:443 -p 6680:80 \
            --hostname phpldapadmin-service \
            --link ldap-service \
            --env PHPLDAPADMIN_LDAP_HOSTS=ldap-service \
            --env PHPLDAPADMIN_HTTPS=false \
            --detach osixia/phpldapadmin:stable
```
> 注：
> --link 指定的是上面启动的ldap的容器名，将两个容器连接
> PHPLDAPADMIN_LDAP_HOSTS环境指定的也是ldap的容器名，这个环境变量指定的就是LDAP服务器的域名或IP，docker容器间网络便能使用容器名访问。

启动完成后就能通过6680端口访问，admin用户登录名就是`cn=admin,dc=xxx,dc=xxx`
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211655037.png)

一般的目录层级为：
```
ou=group
|- ou=某某大部门
    |- ou=某某子部门
ou=people
|- cn=用户
```
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211657950.png)

或者只留一个`ou=people`下面直接建用户就行，连`group`都不用。

配套的还有个小工具，自助密码修改服务，也是用Docker部署。
> 官方Github仓库：https://github.com/ltb-project/self-service-password

启动前创建/data/self-service-password目录，并需要在该目录中创建一个php文件，填写ldap服务的连接配置。
```
docker run -p 6681:80 \
            -v /data/self-service-password/config.inc.local.php:/var/www/conf/config.inc.local.php \
            -itd ltbproject/self-service-password:latest
```
以下为
```php
<?php
$ldap_url = "ldap://LDAP服务器地址";
$ldap_starttls = false;
$ldap_binddn = "cn=admin,dc=xxx,dc=xxx";
$ldap_bindpw = 'admin密码';
$ldap_base = "dc=xxx,dc=xxx";
$ldap_login_attribute = "cn";
$ldap_fullname_attribute = "cn";
$keyphrase = "xxxxx";
$use_tokens = false;
?>
```
> keyphrase可以是随机字符串，用于加密，不过不要随意变动

# LDAP 对接其他系统
## Gitlab
公司的gitlab版本为14.9，支持以下写法
```
gitlab_rails['ldap_enabled'] = true
gitlab_rails['prevent_ldap_sign_in'] = false

###! **remember to close this block with 'EOS' below**
gitlab_rails['ldap_servers'] = YAML.load <<-'EOS'
  main: # 'main' is the GitLab 'provider ID' of this LDAP server
    label: 'LDAP'
    host: '填写LDAP服务器IP'
    port: 389
    uid: 'uid'
    bind_dn: 'cn=admin,dc=xxx,dc=xxx'
    password: '填写admin密码'
    encryption: 'plain' # "start_tls" or "simple_tls" or "plain"
    verify_certificates: true
#     smartcard_auth: false
    active_directory: false
    allow_username_or_email_login: false
#     lowercase_usernames: false
#     block_auto_created_users: false
    base: 'dc=xxx,dc=xxx'
    attributes:
      username: ['uid', 'mail']
      email:    ['mail']
EOS
```
gitlab重启后再访问就多了LDAP登录的方式
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211720987.png)

## Jenkins
需要先确保LDAP插件安装完成
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211728646.png)
在全局安全配置中的安全域指定LDAP，并填入LDAP连接信息
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211726837.png)
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211727679.png)

## Yearning
Yearning SQL审计平台也支持LDAP登录，在设置页面，填入LDAP信息，并重启yearning服务（一定要重启，不然不生效）
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211732851.png)
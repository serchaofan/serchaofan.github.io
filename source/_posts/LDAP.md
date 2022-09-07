---
title: LDAP
date: 2018-11-24 09:22:47
tags: [LDAP]
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

# LDAP
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
- DNS、网络用户管理、电话号码簿
- 内网组织信息服务、电子政务目录、人口基础库
- 机器认证
- 用户认证
- 用户与系统组管理
- 地址簿
- 组织结构展示
- 资产跟踪
- 电话信息存储
- 用户资源管理
- Email地址查询
- 应用配置存储
- PBX 配置存储

LDAP 目录数据文件：

LDIF（LDAP Data Interchange Format，轻量级目录交换格式）是一种 ASCII 文件格式，能够向目录导入与修改信息。

LDIF 文件注意点：

- 空行分割一个条目或定义
- #注释
- 属性: 属性值
- 属性可被重复赋值
- 每行结尾不能有空格
- 每条记录必须有至少一个 objectClass 属性

## Configuration Choices
- 本地目录服务（Local Directory Service）：只运行一个slapd服务，仅为本地域提供目录服务，不会以任何方式与别的目录服务器交互。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202208311755137.png "")

- 带下线的本地目录服务（Local Directory Service with Referrals）：带有指针或者叫下线（Refferals），类似 DNS，若本地的 LDAP 无法处理，则会返回一个指针，指向更高级的服务器地址。当需要提供本地目录服务，且需要参与全局目录的时候，或者想将请求转发给别的从属服务器处理时，就能用这种方式配置。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202208311756629.png)

- 复制的目录服务（Replicated Directory Service）：slapd包含了对LDAP 基于同步的复制的支持，叫做syncrepl，可以用来维护多份目录信息的shadow copies，存放在多个目录服务器上。图中的provider是一个syncrepl provider，consumer也是syncrepl consumer。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202209051000579.png "")

## Configuration
openldap 2.3以及之后的版本已经变为使用动态运行时配置引擎slapd-config。
slapd-config该服务有以下特性：
- 完全支持LDAP
- 被标准LDAP操作进行管理
- 存储配置数据到LDIF数据库，通常在`/usr/local/etc/openldap/slapd.d`目录
- 运行所有slapd配置选项热加载，通常不需要重启服务使配置生效

> 注：虽然slapd-config使用LDIF格式存储配置，但是绝对不能直接修改LDIF文件，所有的配置操作必须通过LDAP操作，如ldapadd、ldapdelete、ldapmodify。离线操作（服务没在跑）则使用slapadd、slapmodify。

### Configuration Layout
slapd配置被存储为特殊的LDAP目录结构，这种结构具有预定义的schema和DIT。会使用特定的objectClass来定义全局的配置选项、schema定义、后台、数据库定义以及相关的其他项。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202209010950017.png "")

结构树的根节点为 `cn=config`，包含了全局的配置设置。`cn=schema,cn=config`包含了系统schema，该节点下子节点包含了用户schema，可以是从配置加载，也能在运行中添加。

LDIF配置规则：
- `#`开头的就是注释
- 如果一行开头是一个空格，则改行被认为是上一行的子配置
- 不同的实体之间需要空一行（或者多行）

```
# global configuration settings
dn: cn=config
objectClass: olcGlobal
cn: config
&lt;global config settings&gt;

# schema definitions
dn: cn=schema,cn=config
objectClass: olcSchemaConfig
cn: schema
&lt;system schema&gt;
```

#### cn=config
该实体包含的指令会被应用到整个服务，大部分指令都是和系统、连接相关的。该实体必有一个`olcGlobal`的objectClass

例：
```
dn: cn=config
objectClass: olcGlobal
cn: config
olcIdleTimeout: 30
olcLogLevel: Stats
olcReferral: ldap://root.openldap.org
```
- olcIdleTimeout：空闲连接的超时时间，单位秒。默认为0，即关闭这个功能
- olcLogLevel：日志等级。如果开多个，则都写在一行
```
olcLogLevel conns filter
```
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202209011038244.png "")
- olcReferral：当slapd找不到一个本地数据库处理请求时，会将此配置的地址回传

#### cn=module
如果slapd开启了热加载模块，`cn=module`可用来指定多个需要加载的模块集，模块实体必须有`olcModuleList`objectClass。
例：
```
dn: cn=module{0},cn=config
objectClass: olcModuleList
cn: module{0}
olcModuleLoad: /usr/local/lib/smbk5pwd.la

dn: cn=module{1},cn=config
objectClass: olcModuleList
cn: module{1}
olcModulePath: /usr/local/lib:/usr/local/lib/slapd
olcModuleLoad: accesslog.la
olcModuleLoad: pcache.la
```
- olcModuleLoad：指定module的文件名，如果没有olcModulePath，则需要填写绝对路径，若有olcModulePath，则只要填写文件名即可
- olcModulePath：指定module的目录路径

#### cn=schema
该实体保存了所有的schema定义，并且这些都是硬编码在slapd代码中的。所有配置的值都是slapd生成的，所以不需要在配置文件中提供schema的值。不过，这个entry必须被定义，来作为用户定义的schema去添加的基础服务。实体必须有`olcSchemaConfig`objectClass。

例：
```
dn: cn=schema,cn=config
objectClass: olcSchemaConfig
cn: schema

dn: cn=test,cn=schema,cn=config
objectClass: olcSchemaConfig
cn: test
olcAttributeTypes: ( 1.1.1
  NAME 'testAttr'
  EQUALITY integerMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.27 )
olcAttributeTypes: ( 1.1.2 NAME 'testTwo' EQUALITY caseIgnoreMatch
  SUBSTR caseIgnoreSubstringsMatch SYNTAX 1.3.6.1.4.1.1466.115.121.1.44 )
olcObjectClasses: ( 1.1.3 NAME 'testObject'
  MAY ( testAttr $ testTwo ) AUXILIARY )
```
- olcAttributeTypes：定义一种attribute type
- olcObjectClasses：定义一种object class

### backend


## Backends
backends 根据ldap请求完成实际的存储与拉取数据的操作，是被静态编译进slapd服务（当开启了module支持，也可以动态加载）。


### LDIF
LDIF后台是一个基础的存储后台，以LDIF格式将实体存储到文本文件，并利用文件系统创建树状数据库结构。

对于一个entry，对应的ldif基本格式如下：
```
# comment
dn: <distinguished name>
<attrdesc>: <attrvalue>
<attrdesc>: <attrvalue>
```
如果要将一行内容分成多行写，则只要换行，并在最开头加上一个空格
```
dn: cn=Barbara J Jensen,dc=example,dc=
 com
cn: Barbara J
 Jensen
 
以上写法等同于
dn: cn=Barbara J Jensen,dc=example,dc=com
cn: Barbara J Jensen
```

## Schema Specification
### 分散的Schema配置
每种schema的规范都放在slapd.conf中定义的某个文件，这些文件通常放在`/usr/local/etc/openldap/schema`下。

| File | Description  |
| -- | --|
| core.schema | OpenLDAP _core_ (required) |
| cosine.schema | Cosine and Internet X.500 (useful) |
| inetorgperson.schema | InetOrgPerson (useful) |
| misc.schema | Assorted (experimental) |
| nis.schema | Network Information Services (FYI) |
| openldap.schema | OpenLDAP Project (experimental) |

### 扩展Schema
schema可被扩展来支持额外的语法、匹配规则、属性类型、object class。
定义一个新的schema需要5步：
1. 获取一个Object Identifier
2. 选择一个名称前缀
3. 创建本地schema文件
4. 自定义attribute
5. 自定义object class

每种schema类型都是由一个全局的Objetct Identifier（OID）标识，OID通常用来标识其他对象，OID的分配也是树状结构，OID通常被SNMP使用。企业OID是需要申请的，通过组织IANA申请，也可以通过国家的机构例如ANSI、BSI等。

#### Attribute Type规范

规范：
```
AttributeTypeDescription = "(" whsp
    numericoid whsp              ; AttributeType identifier
  \[ "NAME" qdescrs \]             ; name used in AttributeType
  \[ "DESC" qdstring \]            ; description
  \[ "OBSOLETE" whsp \]
  \[ "SUP" woid \]                 ; derived from this other
                                 ; AttributeType
  \[ "EQUALITY" woid              ; Matching Rule name
  \[ "ORDERING" woid              ; Matching Rule name
  \[ "SUBSTR" woid \]              ; Matching Rule name
  \[ "SYNTAX" whsp noidlen whsp \] ; Syntax OID
  \[ "SINGLE-VALUE" whsp \]        ; default multi-valued
  \[ "COLLECTIVE" whsp \]          ; default not collective
  \[ "NO-USER-MODIFICATION" whsp \]; default user modifiable
  \[ "USAGE" whsp AttributeUsage \]; default userApplications
  whsp ")"

AttributeUsage =
  "userApplications"     /
  "directoryOperation"   /
  "distributedOperation" / ; DSA-shared
  "dSAOperation"          ; DSA-specific, value depends on server
```
当whsp为一个空格` `时，numericoid以点分隔形式作为全局唯一OID。qdescrs是一个或多个名称。woid可以是名称或者OID。

例：`inetorgperson.schema`文件中的 `displayName`和 `core.schema`文件中的`cn`
```
attributetype ( 2.16.840.1.113730.3.1.241
	NAME 'displayName'
	DESC 'RFC2798: preferred name to be used when displaying entries'
	EQUALITY caseIgnoreMatch
	SUBSTR caseIgnoreSubstringsMatch
	SYNTAX 1.3.6.1.4.1.1466.115.121.1.15
	SINGLE-VALUE )

attributeType ( 2.5.4.3 NAME ( 'cn' 'commonName' )
        DESC 'common name(s) associated with the object'
        SUP name )
```

Syntax后指定的是语法的OID
| **Name** | **OID** | **Description** |
| --- | --- | --- |
| boolean | 1.3.6.1.4.1.1466.115.121.1.7 | boolean value |
| directoryString | 1.3.6.1.4.1.1466.115.121.1.15 | Unicode (UTF-8) string |
| distinguishedName | 1.3.6.1.4.1.1466.115.121.1.12 | LDAP DN |
| integer | 1.3.6.1.4.1.1466.115.121.1.27 | integer |
| numericString | 1.3.6.1.4.1.1466.115.121.1.36 | numeric string |
| OID | 1.3.6.1.4.1.1466.115.121.1.38 | object identifier |
| octetString | 1.3.6.1.4.1.1466.115.121.1.40 | arbitrary octets |

EQUALITY、SUBSTR等指定的rules
| **Name** | **Type** | **Description** |
| --- | --- | --- |
| booleanMatch | equality | boolean |
| caseIgnoreMatch | equality | case insensitive, space insensitive |
| caseIgnoreOrderingMatch | ordering | case insensitive, space insensitive |
| caseIgnoreSubstringsMatch | substrings | case insensitive, space insensitive |
| caseExactMatch | equality | case sensitive, space insensitive |
| caseExactOrderingMatch | ordering | case sensitive, space insensitive |
| caseExactSubstringsMatch | substrings | case sensitive, space insensitive |
| distinguishedNameMatch | equality | distinguished name |
| integerMatch | equality | integer |
| integerOrderingMatch | ordering | integer |
| numericStringMatch | equality | numerical |
| numericStringOrderingMatch | ordering | numerical |
| numericStringSubstringsMatch | substrings | numerical |
| octetStringMatch | equality | octet string |
| octetStringOrderingMatch | ordering | octet string |
| octetStringSubstringsMatch ordering | octet st | ring |
| objectIdentiferMatch | equality | object identifier |

#### Object Class规范

规范：
```
ObjectClassDescription = "(" whsp
        numericoid whsp      ; ObjectClass identifier
        \[ "NAME" qdescrs \]
        \[ "DESC" qdstring \]
        \[ "OBSOLETE" whsp \]
        \[ "SUP" oids \]       ; Superior ObjectClasses
        \[ ( "ABSTRACT" / "STRUCTURAL" / "AUXILIARY" ) whsp \]
                ; default structural
        \[ "MUST" oids \]      ; AttributeTypes
        \[ "MAY" oids \]       ; AttributeTypes
        whsp ")"
```
当whsp为一个空格` `时，numericoid以点分隔形式作为全局唯一OID。qdescrs是一个或多个名称。oids可以是一个或多个名称或者OID。

例：`inetorgperson.schema`文件中的`inetOrgPerson` Object Class
```
objectclass	( 2.16.840.1.113730.3.2.2
    NAME 'inetOrgPerson'
	DESC 'RFC2798: Internet Organizational Person'
    SUP organizationalPerson
    STRUCTURAL
	MAY (
		audio $ businessCategory $ carLicense $ departmentNumber $
		displayName $ employeeNumber $ employeeType $ givenName $
		homePhone $ homePostalAddress $ initials $ jpegPhoto $
		labeledURI $ mail $ manager $ mobile $ o $ pager $
		photo $ roomNumber $ secretary $ uid $ userCertificate $
		x500uniqueIdentifier $ preferredLanguage $
		userSMIMECertificate $ userPKCS12 )
	)
```

#### OID宏
后定义的OID宏可以获取到先定义的OID宏的值。

例：
```
objectIdentifier myOID  1.1
objectIdentifier mySNMP myOID:1
objectIdentifier myLDAP myOID:2
objectIdentifier myAttributeType        myLDAP:1
objectIdentifier myObjectClass  myLDAP:2
attributetype ( myAttributeType:3 NAME 'x-my-PhotoURI'
        DESC 'URI and optional label referring to a photo'
        SUP labeledURI )
objectclass ( myObjectClass:1 NAME 'x-my-PhotoObject'
        DESC 'mixin x-my-Photo'
        AUXILIARY
        MAY x-my-Photo )
```

## Dynamic Directory Services
简称dds。dds允许定义动态对象，使用的是`dynamicObject` objectClass。
动态对象有有限的生命周期，由TTL决定刷新间隔，过期时间就是当前时间加上被要求的TTL时间，如果动态对象到了生命周期结束而没有被refresh过期时间，则会被自动删除。

```
overlay dds
dds-max-ttl     1d
dds-min-ttl     10s
dds-default-ttl 1h
dds-interval    120s
dds-tolerance   5s
```
- dds-max-ttl：最大的TTL值
- dds-min-ttl：最小的TTL值
- dds-default-ttl：默认的TTL值
- dds-interval：过期检查间隔时间
- dds-tolerance：过期检查的容忍时间
由过期检查间隔时间和容忍时间可以知道，一个动态对象的lifetime就是`dds-interval + dds-tolerance`

例：
```
dn: cn=OpenLDAP Documentation Meeting,ou=Meetings,dc=example,dc=com
cn: OpenLDAP Documentation Meeting
objectClass: groupOfNames
objectClass: dynamicObject
member: uid=ghenry,ou=People,dc=example,dc=com
member: uid=hyc,ou=People,dc=example,dc=com
```

## LDAP命令详解
ldap常见命令
- ldapadd：ldapadd实际就是ldapmodify的软链接
- ldapdelete：删除操作
- ldapmodify：修改操作
- ldappasswd：密码操作
- ldapurl：url格式化操作
- ldapcompare：比较操作
- ldapexop：扩展操作
- ldapmodrdn：重命名操作
- ldapsearch：搜索操作

### 通用连接参数
```
-D  {bindDN}   用于绑定到服务器的 DN

-h  {host}     目录服务器主机名或 IP 地址   Default value: localhost
-H  {uri}      目录服务器的ldap格式地址。如果用了-h 就不用 -H了
-p  {port}     目录服务器端口号  Default value: 389

-w  {bindPassword} 用于绑定到服务器的密码
-W  提示输入密码
```

常用的就是
- `-D <binddn> -w <password> -h <hostip>`
- `-D <binddn> -w <password> -H ldap://{hostip}`

### ldapmodify
```
-a  添加条目
```

例：
```
编写ldif文件，将新增用户的ldif信息写入
dn: cn=zhangsan,ou=people,dc=ebay,dc=com
changetype: add
cn: zhangsan
gidnumber: 500
givenname: san
homedirectory: /home/users/zhangsan
objectclass: inetOrgPerson
objectclass: posixAccount
objectclass: top
sn: zhang
uid: zhangsan
uidnumber: 1002
userpassword: {MD5}lueSGJZetyySpUndWjMBEg==
```
注：必须将`changetype: add`写在dn下面，也就是第二行，不能写在别的行内。否则添加时会有以下报错：
```
ldapmodify: modify operation type is missing at line 2, entry "cn=zhangsan,ou=people,dc=ebay,dc=com"
```
成功添加会有以下信息：
```
adding new entry "cn=zhangsan,ou=people,dc=ebay,dc=com"
```

若要修改对象，则将`changetype`设为`modify`，并且在第三行必须加上操作
- `add: <attribute>`：添加属性值
- `replace: <attribute>`：替换属性值
- `delete: <attribute>`：删除属性值

```
dn: cn=zhangsan,ou=people,dc=ebay,dc=com
changetype: modify
replace: homeDirectory
homeDirectory: /home/users/zhangsan1111111
```
```
dn: cn=zhangsan,ou=people,dc=ebay,dc=com
changetype: modify
add: mobile
mobile: 222222222
```
```
dn: cn=zhangsan,ou=people,dc=ebay,dc=com
changetype: modify
delete: mobile
```

### ldapsearch
ldap的搜索操作。以下仅列出一些常用参数。
```
Usage:  ldapsearch  {options} filter [attributes ...]
Command options:

-A, --typesOnly
    仅检索属性名称，而不检索属性值
-b, --baseDN {baseDN}
    搜索基 DN
-c, --continueOnError
    即使出现错误也继续进行处理
--countEntries
    计算服务器返回的条目数

-n, --dry-run
    显示将要执行的操作，但不执行任何操作

-S, --sortOrder {sortOrder}
    使用提供的排序顺序对结果进行排序
--simplePageSize {numEntries}
    将简单分页结果控制用于给定页面大小
    Default value: 1000
```

例：
```
ldapsearch -D "cn=admin,dc=example,dc=com" -w xxxxx -H ldap://localhost -b "ou=people,dc=example,dc=com"

# people, example.com
dn: ou=people,dc=example,dc=com
ou: people
objectClass: organizationalUnit
objectClass: top

......
# search result
search: 2
result: 0 Success
```

```
ldapsearch -D "cn=admin,dc=example,dc=com" -w xxxxx -H ldap://localhost  -b 'dc=example,dc=com' "(cn=zhangsan)" homeDirectory

dn: cn=zhangsan,ou=people,dc=example,dc=com
homeDirectory: /home/users/zhangsan
```

`-b`参数指定搜索的baseDN，不可缺少，否则找不到

# LDAP Docker部署
使用的镜像为：`osixia/openldap`
> 官方Github仓库：https://github.com/osixia/docker-openldap

启动命令：
```
docker run -d --name ldap-service \
              --hostname ldap-service \
              -p 389:389 -p 636:636 \
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

该容器启动后开放了389和636两个端口，即OpenLDAP监听的端口：
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

# LDAP Kubernetes部署

```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ldap
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ldap
  template:
    metadata:
      labels:
        app: ldap
    spec:
      containers:
        - name: ldap
          image: osixia/openldap:stable
          args: ["--copy-service"]
          volumeMounts:
            - name: container-run
              mountPath: /container/run
          env:
          - name: LDAP_ORGANISATION
            value: XXX
          - name: LDAP_DOMAIN
            value: XXX.XXX
          - name: LDAP_ADMIN_PASSWORD
            value: XXXXX
          ports:
            - containerPort: 389
              name: openldap
            - name: ssl-ldap-port
              containerPort: 636
          livenessProbe:
            tcpSocket:
              port: openldap
            initialDelaySeconds: 20
            periodSeconds: 10
            failureThreshold: 10
          readinessProbe:
            tcpSocket:
              port: openldap
            initialDelaySeconds: 20
            periodSeconds: 10
            failureThreshold: 10
      volumes:
        - name: container-run
          emptyDir: {}
```

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
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211720987.png "")

## Jenkins
需要先确保LDAP插件安装完成
![未找到图片：https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211728646.png](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211728646.png "未找到图片：https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211728646.png")
在全局安全配置中的安全域指定LDAP，并填入LDAP连接信息
![未找到图片：https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211726837.png](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211726837.png "未找到图片：https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211726837.png")
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211727679.png "")

## Yearning
Yearning SQL审计平台也支持LDAP登录，在设置页面，填入LDAP信息，并重启yearning服务（一定要重启，不然不生效）
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202206211732851.png "")


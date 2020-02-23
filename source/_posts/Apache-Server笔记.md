---
title: Apache-Server笔记
date: 2018-05-02 17:19:50
tags: [server, Apache, http, LAMP, LAMT]
categories: [应用运维]
---

{% asset_img 0.png %}

  <!-- more -->

本片包含以下内容：

- [Apache-httpd 服务器介绍](#apache-httpd-%e6%9c%8d%e5%8a%a1%e5%99%a8%e4%bb%8b%e7%bb%8d)
- [httpd 服务器安装](#httpd-%e6%9c%8d%e5%8a%a1%e5%99%a8%e5%ae%89%e8%a3%85)
- [httpd 配置文件](#httpd-%e9%85%8d%e7%bd%ae%e6%96%87%e4%bb%b6)
- [httpd 虚拟主机](#httpd-%e8%99%9a%e6%8b%9f%e4%b8%bb%e6%9c%ba)
- [httpd 认证授权](#httpd-%e8%ae%a4%e8%af%81%e6%8e%88%e6%9d%83)
- [.htaccess 文件](#htaccess-%e6%96%87%e4%bb%b6)
  - [.htaccess 文件的常用示例](#htaccess-%e6%96%87%e4%bb%b6%e7%9a%84%e5%b8%b8%e7%94%a8%e7%a4%ba%e4%be%8b)
- [页面重定向](#%e9%a1%b5%e9%9d%a2%e9%87%8d%e5%ae%9a%e5%90%91)
- [CGI](#cgi)
- [动态 httpd](#%e5%8a%a8%e6%80%81-httpd)
- [httpd 与 SSL](#httpd-%e4%b8%8e-ssl)
- [httpd 日志](#httpd-%e6%97%a5%e5%bf%97)
  - [日志切割](#%e6%97%a5%e5%bf%97%e5%88%87%e5%89%b2)
  - [Webalizer 分析统计日志](#webalizer-%e5%88%86%e6%9e%90%e7%bb%9f%e8%ae%a1%e6%97%a5%e5%bf%97)
- [httpd 代理](#httpd-%e4%bb%a3%e7%90%86)
- [Apache-MPM 模式](#apache-mpm-%e6%a8%a1%e5%bc%8f)
- [Apache 实用第三方模块](#apache-%e5%ae%9e%e7%94%a8%e7%ac%ac%e4%b8%89%e6%96%b9%e6%a8%a1%e5%9d%97)
  - [Gzip 压缩](#gzip-%e5%8e%8b%e7%bc%a9)
  - [防 DDOS 攻击](#%e9%98%b2-ddos-%e6%94%bb%e5%87%bb)
- [LAMP 环境搭建](#lamp-%e7%8e%af%e5%a2%83%e6%90%ad%e5%bb%ba)
    - [参考文章](#%e5%8f%82%e8%80%83%e6%96%87%e7%ab%a0)

# Apache-httpd 服务器介绍

Apache 服务器全称 Apache-HTTP-Server，而 httpd 就是 Apache 服务器端运行的软件，提供 WWW 服务器平台。

**Apache 特性**

- 简单强大的配置文件
- 支持虚拟主机
- 支持多种 HTTP 认证
- 集成 Perl 脚本，代理服务器模块
- 支持通用网关接口、FastCGI
- 支持实时监视服务器状态和定制服务器日志
- 支持 SSL、服务器端包含指令 SSI
- 可通过第三方模块支持 Java Servlets
- 提供对用户会话的跟踪
- 采用模块化设计模型

**Apache 最重要的特性就是：采用模块化设计模型**。模块分为：

- 静态模块：是 Apache 最基本的模块，无法随时添加和卸载，在编译安装时设定
- 动态模块：是可以随时添加和卸载的模块，使得部署有最大的灵活性

Apache 的模块会被编译为动态共享对象 DSO，这些 DSO 独立于 httpd，可以在编译时就添加，也可以后期通过 Apache Extension Tool 工具编译添加模块，可使用`httpd -M`查看模块加载清单。

# httpd 服务器安装

httpd 版本 2.4.34。可以使用源码安装，可进行更精细的设定。

```
./configure
  --enable-so               # 开启模块化功能，支持DSO
  --enable-mods-shared      # 指明以DSO方式编译的模块，all表示所有模块，most表示大部分模块
  --enable-ssl              # 支持ssl加密
  --enable-rewrite          # 支持地址重写
  --with-mpm                # 设置httpd工作模式
  --with-suexec-bin         # suexec库的路径，用于支持SUID、SGID
  --with-apr                # 指定apr程序的绝对路径
```

> apr：Apache Portable Runtime（APR）项目的任务是创建和维护软件库，为底层平台特定的实现提供可预测且一致的接口。主要目标是提供一个 API，软件开发人员可以对其进行编码，并确保可预测的行为，如果不是相同的行为，无论他们的软件构建在哪个平台上，都可以减轻他们编写特殊情况条件以解决问题的需要。
>
> 源码安装前需要安装 apr 和 apr-util，仍然需要源码安装

下载 apr 和 apr-util 的源码包，先安装 apr，先要确保安装了`gcc`

`./configure --prefix=/usr/local/apr-1.6`然后`make && make install`

再安装 apr-util，需要`--with-apr`指定 apr 的安装路径

`./configure --prefix=/usr/local/apr-util-1.6 --with-apr=/usr/local/apr-1.6`然后`make && make install`

可能会报一个错`xml/apr_xml.c:35:19: 致命错误：expat.h：No such file or directory`，需要安装`expat-devel`，`yum install expat expat-devel`即可。

安装与 Apache 相关的依赖库或软件，直接`yum|dnf`安装即可：

```
pcre-devel          # perl正则表达式库
libxml2-devel       # xml文件库，很重要
libpng-devel        # png图像库
libjpeg-devel       # jpeg图像库
libmcrypt-devel     # mcrypt加密库
zlib-devel          # zlib压缩库
freetype-devel      # freetype字体库
autoconf            # 生成配置脚本的软件，不一定要
gd-devel            # gd图像库
libcurl-devel       # curl库
openssl-devel       # openssl库。注：php5不支持openssl1.1.0版本以上的
```

然后

```./configure --prefix=/usr/local/httpd-2.4 --with-apr=/usr/local/apr-1.6 --with-apr-util=/usr/local/apr-util-1.6
./configure --prefix=/usr/local/httpd-2.4 \
            --with-apr=/usr/local/apr-1.6 \
            --with-apr-util=/usr/local/apr-util-1.6
  # 若不指定--prefix，会默认安装在/usr/local/apache2中
```

并`make && make install`即可。源码安装后可能不能直接使用 Apache 的管理命令，需要添加环境变量，`export PATH=/usr/local/httpd-2.4/bin:$PATH`，也可以永久添加。

httpd 提供两种编译方式：静态编译和动态编译

- 静态编译：把模块直接编译进 httpd 核心，httpd 启动时所有静态编译的模块都会启动
- 动态编译：将模块编译好，但不编译进 httpd 核心，httpd 启动动态模块并不会启动，而是需要在配置文件中`LoadModule`加载才能启动，实现了模块热插拔。

可在编译时指定`--enable-模块名=shared|static`指定模块是动态或静态编译。

> httpd 能够实现动态编译的原因在于 httpd 默认会安装`mod_so`，此模块提供了配置文件的`LoadModule`和`LoadFile`指令，在编译时指定`--enable-so`即可，而此模块只能使用静态编译，若指定为`shared`则编译时会出错。

动静态编译的优先级：

1. 不指定模块编译选项，则默认值为`--enable-mods-shared=most`即动态编译大部分模块
2. 显式指定的优先级高，如果某个模块既指定了静态，又指定了动态，则静态优先。
3. 静态关键字规则优先于动态关键字规则，即若`--enable-mods-static=few`和`--enable-mod-shared=all`同时配置，静态优于动态，静态生效。

也可通过各种源安装。`yum|dnf install httpd`。安装完成后，Apache 会提供`apachectl`脚本命令，可进行 httpd 的启动、关闭和测试，若没有修改配置文件下使用`start`启动 httpd，会报以下错误信息：

```
Could not reliably determine the server's fully qualified domain name
```

报错说明 httpd 无法确定服务器域的名称，可通过修改主配置文件的`ServerName`解决。修改后再通过`apachectl starts`启动 httpd，再直接打命令`apachectl`能看到 httpd 已在运行的消息`httpd (pid 2012) already running`。也可以通过`systemctl start httpd`启动 httpd。

若开启了`firewalld`服务，需要放行`80/tcp`端口，放行`http`服务。

httpd 的主要目录（yum 源安装）：

- `/etc/httpd`：httpd 服务根目录
- `/etc/httpd/conf`和`/etc/httpd/conf.d`：httpd 服务配置文件目录
- `/var/www/html`：网站数据目录
- `/var/log/httpd`：httpd 日志目录，里面存放有`access_log`访问日志和`error_log`错误日志

若是通过 yum 源安装的 httpd，则在`/etc/httpd`中的`logs`，`modules`和`run`目录都是软连接。

```
/etc/httpd/logs --> /var/log/httpd
/etc/httpd/modules --> /usr/lib64/httpd/modules
/etc/httpd/run --> /run/httpd
```

`apachectl`命令：

```
apachectl
  -V           # 查看apache版本信息，以及模块、编译信息
  -l           # 查看已被编译的模块
  start        # 启动httpd，如果已在运行就会返回错误
  stop         # 停止httpd
  restart      # 重启httpd
  fullstatus   # 显示mod_status的完整状态报告。需要在服务器上启用mod_status，并在系统上使用基于文本的浏览器
  status       # 显示简要状态报告，信息与systemctl status httpd一致
  graceful     # 优雅地重启Apache httpd守护进程。如果守护程序未运行，则启动它。这与正常重启不同，因为当前打开的连接不会中止。副作用是旧的日志文件不会立即关闭。这意味着，如果在日志轮换脚本中使用，则可能需要大量延迟才能确保在处理旧日志文件之前将其关闭。
  graceful-stop # 让已运行的httpd进程不再接受新请求，并给他们足够的时间处理当前正在处理的事情，处理完成后才退出。所以在进程退出前，日志文件暂时不会关闭，正在进行的连接暂时不会断开。
  configtest   # 配置文件语法测试，相当于apachectl -t
```

`httpd`命令：与`apachectl`一致

```
httpd                # 可直接启动httpd
  -D name            # 定义一个在< IfDefine name >中使用的name，以此容器中的指令
  -d directory       # 指定ServerRoot
  -f file            # 指定配置文件
  -C "directive"     # 指定在加载配置文件前要处理的指令(directive)
  -c "directive"     # 指定在加载配置文件后要处理的指令
  -e level           # 显示httpd启动时的日志调试级别
  -E file            # 将启动信息记录到指定文件中
  -v                 # 显示版本号
  -V                 # 显示编译配置选项
  -h                 # 显示帮助信息
  -l                 # 显示已编译但非动态编译的模块，即静态编译的模块
  -L                 # 显示静态模块可用的指令列表
  -t -D DUMP_VHOSTS  # 显示虚拟主机的设置信息
  -t -D DUMP_RUN_CFG # 显示运行参数
  -S                 # 等价于-t -D DUMP_VHOSTS -D DUMP_RUN_CFG。在调试如何解析配置文件时非常有用
  -t -D DUMP_MODULES # 显示所有已被加载的模块，包括静态和动态编译的模块
  -M                 # 等价于-t -D DUMP_MODULES
  -t                 # 检查配置文件语法
  -T                 # 不检查DocumentRoot，直接启动
  -X                 # 调试模式，此模式下httpd进程依赖于终端
  -k                 # 管理httpd进程，接受start|restart|graceful|graceful-stop|stop
```

# httpd 配置文件

httpd 主配置文件主要由指令和容器构成，容器使用`<容器名></容器名>`作为开始和结束，容器的指令一般只在容器内生效，每个指令都是某个模块提供的，指令生效方式是从上往下读取，所以不要变更指令位置。

**主配置文件重点指令**：

- `ServerRoot`：设置 Apache 的安装主目录，若采用源码安装，默认路径为`/usr/local/apache2`
- `Listen`：设置服务器监听端口 IP 及端口号，默认监听服务器本机所有 IP 地址的 80 端口。格式：`Listen [IP地址:]端口 [协议]`，默认监听所有 IP，使用 TCP 协议。可多次使用 Listen 以开启多个端口
- `LoadModule`：加载模块。格式 `LoadModule 模块名 模块文件名`，模块文件一般存放在 ServerRoot 的 module 目录中
- `ServerAdmin`：主服务器返回给客户端的错误消息中的管理员邮箱地址
- `ServerName`：设置服务器本机的主机名和端口，用于 URL 重定向
- `User`：apache 在本地系统上运行的用户名
- `Group`：apache 在本地系统上运行的组名
- `DocumentRoot`：网络路径相对路径的根，是文档的根目录，使用 rpm 包安装则默认值为`/var/www`，使用源码安装则默认为`$ServerRoot/htdocs`
- `ErrorLog`：服务器错误日志存放位置，默认使用相对路径`logs/error_log`
- `ErrorLogFormat`：错误日志格式
- `CustomLog`：客户端访问日志文件路径及日志格式，格式：`CustomLog 文件名 格式`，默认相对路径为`logs/access_log`
- `LogFormat`：用户日志文件格式，一般用这里指定的格式创建别名，然后通过`CustomLog`调用该格式
- `LogLevel`：日志消息等级，分为`debug/info/notice/warm/error/crit/alert/emerg`
- `AllowOverride`：支持从`.htaccess`文件中重写前面的指令，若值为`None`，表示不支持
- `Require`：给所有用户或特定用户/组授予或拒绝对目录的访问
- `Include`：允许 Apache 在主配置目录加载其他配置文件，默认为`conf.d/*.conf`
- `Options`：为特殊目录设置选项，语法格式为`Options [+|-]选项`。
  - `All`：开启除`MultiViews`之外的所有选项
  - `None`：不启用额外功能
  - `FollowSymlinks`：允许 Options 指定目录下的文件链接到目录外的文件或目录
  - `Indexes`：若与 URL 对应的 Options 目录下找不到`DirectoryIndex`指定的首页文件，则会将当前目录的所有文件索引出来
- `Order`：控制默认访问状态以及`Allow`和`Deny`的顺序
  - 若为`Order deny,allow`则先检查拒绝，当拒绝与允许冲突时，`allow`优先，默认规则`allow`，即只要是`deny`排在前面，就只要写拒绝的 IP 地址即可，使用`Deny from [IP地址]|all`
  - 若为`Order allow,deny`则先检查允许，当拒绝与允许冲突时，`deny`优先，默认规则`deny`，即只要是`allow`排在前面，就只要写拒绝的 IP 地址即可，使用`Allow from [IP地址]|all`
- `Alias`：用于将 URL 路径映射到本地文件系统的路径，且本地路径不受 DocumentRoot 的限制，该目录中的脚本不允许执行。格式：`Alias URL路径 "本地资源的文件系统路径"`。`Alias`不支持正则，而`AliasMatch`支持，格式一致。
- `ScriptAlias`：类似于 Alias，并且能将 Web 路径映射到 DocumentRoot 之外的文件系统位置，还告诉 Apache 指定的目录存在 CGI 脚本，可以执行脚本
- `DirectoryIndex`：作为索引的文件名，默认找`index.html`。若 url 中未指定网页文件，则会返回该目录下`DirectoryIndex`定义的文件，可指定多个文件，若都不存在，会生成所有文件列表，此时`Option Indexes`必须打开。
- `UserDir`：定义和本地用户的主目录相对的目录，可将公共的 html 文件放入该目录，即每个用户的个人站点。默认设置为`public_html`，每个用户都可在自己的主目录下创建名为`public_html`的目录，该目录下的 html 文件可通过`域名/~用户名`访问。若值为`disabled`表示禁止使用个人站点。
- `Timeout`：客户端与服务器连接的超时间隔
- `KeepAlive`：开启长连接。HTTP/1.1 中支持一次连接多次传输，可在一次连接中传递多个 HTTP 请求
- `KeepAliveTimeout`：一次连接中多次请求间的超时间隔
- `MaxKeepAliveRequests`：一个 HTTP 连接中最多可请求的次数，若为 0，表示无限制

> [指令文档](https://httpd.apache.org/docs/2.4/mod/quickreference.html)

**常用容器：**

- `IfDefine`：使管理员能采用多种配置方式启动 Apache，当启动 httpd 时使用命令`httpd -D 自定义名`便会匹配，若测试条件为真，就会加载该容器中定义的参数。格式：`<IfDefine [!]自定义名>`

- `IfModule`：可以封装仅在条件满足时才会处理的命令，根据模块是否加载决定条件是否满足。语法：`<IfModule [!] 模块>指令</IfModule>`

- `Directory`：仅用于特定的文件系统目录、子目录及目录下内容，通常**用绝对路径**，即使是相对路径，也是相对于文件系统的根目录。语法：`<Directory 路径>指令</Directory>`，路径可使用`~`匹配正则表达式。

- `DirectoryMatch`：类似 Directory，可直接用正则表达式匹配

- `Files`：类似 Directory，但 Files 内指令仅能应用与特定文件，匹配的范围是**它所在的上下文**。语法：`<Files 文件名>指令</Files>`，可使用`~`匹配正则表达式

- `FilesMatch`：与 Files 类似，可直接用正则表达式匹配

- `Location`：该容器内的指令仅对特定 URL 有效。格式`<Location URL>指令</Location>`，可使用`~`匹配正则表达式。`Location`支持三种匹配模式：

  - 精确匹配：精确到资源的 URL 路径
  - 加尾随斜线：匹配目录内容，如`<Location "/myapp/">`
  - 无尾随斜线：匹配目录和目录内容，如`<Location "/myapp">`

- `LocationMatch`：类似 Location，可直接用正则表达式匹配

- > 在 DirectoryMatch，Files，FilesMatch，Location，LocationMatch 中，若出现包含关系，如一个目录同时匹配到了两个相同类型容器，则会选择匹配先定义的容器

- `VirtualHost`：虚拟主机，可直接用正则表达式匹配。语法：`VirtualHost IP地址:[端口号]`，IP 地址为监听的本地网卡 IP，若为`*`则表示监听本地所有网卡
- `EnableSendfile`：使用 sendfile 系统调用，把静态文件发送给客户端，获得更好的性能

# httpd 虚拟主机

基于 IP 的虚拟主机可根据不同 IP 地址及端口号定位不同的网站请求，但需要独立的公网 IP 地址。基于域名的虚拟主机能实现在一台公网服务器上部署多个网站，服务器根据客户端访问 HTTP 头部信息实现网站的分离解析。

客户端请求到达后，服务器根据`<VirtualHost IP地址:[端口号]>`匹配主机，若 IP 地址 为`*`，表示匹配本地所有 IP 地址

匹配顺序：

- 匹配虚拟主机。匹配虚拟主机的规则为最佳匹配法，IP 地址越精确，匹配就越优先。
- 如果基于名称的虚拟主机无法匹配上，则采用虚拟主机列表中的第一个虚拟主机作为响应主机。
- 如果所有虚拟主机都无法匹配上，则采用从主配置段落中的主机。

首先配置虚拟主机配置文件，将`/usr/share/doc/httpd/httpd-vhosts.conf`复制到`/etc/httpd/conf.d/`目录下，可改名，以此为模板，创建一台虚拟主机。配置完成后重启 httpd。

```
<VirtualHost *:80>
    DocumentRoot "/var/www/virhost1"
    ServerName virhost1.example.com
    ErrorLog "/var/log/httpd/virhost1-error_log"
    CustomLog "/var/log/httpd/virhost1-access_log" common
</VirtualHost>
<Directory "/var/www/virhost1">
    Require all granted
    Options Indexes
    AllowOverride None
</Directory>
```

注：在实验机上，需要将该地址解析出来，所以要修改`/etc/hosts`，在环回口后添加`virhost1.example.com`，再访问即可。

**注：物理站点与虚拟站点不能同时存在，如果启动虚拟站点，物理站点立刻失效。若要让之前的物理站点恢复访问，就将该站点按虚拟站点的格式重新搭建**

# httpd 认证授权

httpd 提供各种认证模块，名称以`mod_auth`开头。基础的 http 认证模块为`mod_auth_basic`。

可以通过命令`htpasswd`生成用于网页认证的用户信息文件，该命令在`httpd-tools`包中，支持 3 种加密算法：MD5、SHA 和系统上的 crypt()函数，默认为 md5。

```
htpasswd [-cimBdpsDv] [-C cost] passwordfile username
htpasswd -b[cmBdpsDv] [-C cost] passwordfile username password

 -c  创建一个新密码文件
 -n  不会更新密码文件，仅仅在输出显示，因此不用指定密码文件。而若不指定此项就必须指定密码文件，不能与-c一起用
 -b  在命令行中读取密码，若不指定，系统会提示输入
 -i  从输入读取密码（类似echo XXX | htpasswd -i），常用于脚本
 -m  使用md5加密（默认）
 -B  使用bcrypt函数加密，很安全
 -C  使用bcrypt函数加密的次数，默认为5，范围是4到31，次数越多越安全，但会更慢
 -d  使用crypt函数加密，不安全
 -s  使用SHA加密密码，不安全
 -p  不加密密码，不安全
 -D  删除指定认证用户
```

主配置文件的认证指令：

```
AuthType       指定web身份认证的类型，有四种类型：
    none      不认证
    basic     文件认证（默认），需要mod_auth_basic模块
    digest    md5摘要认证，需要mod_auth_digest模块
    form      表单认证，需要mod_auth_form模块
AuthName       设置身份认证时的提示信息
AuthUserFile   指定web用户认证列表，即htpasswd命令生成的密码文件
AuthGroupFile  指定组认证文件，文件中分组格式为"组名: 组成员...."
```

**`Require`指令**：只能放在`Directory`容器中，用于控制对目录的访问权限，功能由`mod_authz_core`模块提供。有以下配置：

- `Require all granted | denied`：允许|拒绝所有人访问该目录
- `Require method http方法 ...`：只有指定的 http 方法（如 get,post）才能访问该目录
- `Require expr 正则表达式`：只要满足指定正则表达式才能访问
- `Require user 用户...`：只有指定用户能访问
- `Require valid-user 用户...`：认证列表中所有用户都可访问
  > 关于用户的认证需要`mod_authz_user`模块
- `Require group 组...`：指定组内的用户才能访问
- `Require file-owner`：web 用户名必须与请求文件的 UID 对应用户名一致才能访问
- `Require file-group`：web 用户名必须为请求文件的 gid 组中的一员才能访问
  > 组认证需要`mod_authz_groupfile`模块
- `Require ip IP地址[/Mask]...`：指定 IP 能访问该目录
- `Require host 域名...`：指定域名能访问该目录
  > 关于 ip 和 host 的认证需要`mod_authz_host`模块
- 若`Require`后加上`not`则是取反。

**认证实验：**

首先创建密码认证文件：`htpasswd -cb /etc/httpd/secret mike 123456`，认证用户并不需要在系统中存在。

配置文件中的认证配置：

```
<Directory "/var/www/virhost1">
    Options Indexes
    AllowOverride None
    #若通过.htaccess文件配置了以下认证信息，则需要将AllowOverride的值设为AuthConig
    AuthType Basic
    AuthName "Enter Auth Username and Password:"
    AuthUserFile /etc/httpd/secret
    Require user mike
</Directory>
```

重启 httpd，通过浏览器访问，会提示输入用户名密码。

{% asset_img 4.png %}

创建组认证文件`echo "group1: mike" > /etc/httpd/auth_group`，修改配置文件：

```
<Directory "/var/www/virhost1">
    Options Indexes
    AllowOverride None
    AuthType Basic
    AuthName "Enter Auth Username and Password:"
    AuthUserFile /etc/httpd/secret
    AuthGroupFile /etc/httpd/auth_group
    Require user mike
    Require group group1
</Directory>
```

# .htaccess 文件

`.htaccess`文件提供了一种基于每个目录进行配置更改的方法，该文件包含一个或多个配置，而该文件存放在某个`Directory`下，则该文件中的配置都应用于这个`Directory`。

如果有权限访问 httpd 主服务器配置文件，则应该完全避免使用`.htaccess`文件，使用`.htaccess`文件会降低 Apache http 服务器的速度。

如果想给`.htaccess`文件改名，则需要在配置文件中用指令`AccessFileName "文件名"`说明。

是否启用`.htaccess`文件取决于`AllowOverride`指令，该指令决定是否启用文件中定义的指令。

通常，只有在无法访问主服务器配置文件时才应使用`.htaccess` 文件。`.htaccess` 文件主要面向于没有 root 访问权限而无法改动主配置文件的用户，允许他们通过配置各自网站的`.htaccess` 文件自行进行配置修改。

应该避免使用`.htaccess`文件的两点原因：

- 当 AllowOverride 设置为允许使用`.htaccess` 文件时，httpd 将在每个目录中查找`.htaccess` 文件。因此，允许`.htaccess` 文件会导致性能下降，且每次请求文档时都会加载`.htaccess` 文件。

  httpd 必须在所有更高级别的目录中查找`.htaccess` 文件，以便拥有必须应用的完整指令。 例如，如果从目录`/www/htdocs/example`中请求文件，httpd 必须查找以下文件

  ```
  /.htaccess
  /www/.htaccess
  /www/htdocs/.htaccess
  /www/htdocs/example/.htaccess
  ```

  这样会查找四个文件，即使不存在。

  若指定重定向的指令，则在`.htaccess` 上下文中，必须重新编译每个对目录的请求的正则表达式

- 允许用户修改服务器配置可能导致无法控制的更改，必须对用户的权限进行精细的控制，准确地设置 AllowOverride 的内容。

由于会从最上级目录迭代向下查找`.htaccess` 文件，所以，若不同的`.htaccess` 文件中有相同指令，则最下层的`.htaccess` 文件中的该指令生效，下层的文件中的指令会覆盖上层文件中相同的指令。

## .htaccess 文件的常用示例

**认证（Authentication）**：需要在`<Directory>`中配置`AllowOverride AuthConfig`

```
AuthType Basic
AuthName "Password Required"
AuthUserFile "/www/passwords/password.file"
AuthGroupFile "/www/passwords/group.file"
Require group admins
```

**服务器端包括（Server Side Includes，SSI）**：提供了向现有 HTML 文档添加动态内容的方法，而无需通过 CGI 程序或其他动态技术。 SSI 适用于在大部分内容都是静态的网页中添加小块动态信息，例如当前时间。若网页大部分内容都是动态生成的，则并不适用。

**若要使能 SSI，则需要在配置文件中或.htaccess 文件中添加`Options +Includes`**，表示允许为 SSI 指令解析文件。

还需要告诉 Apache 需要解析的文件，例如：

```
AddType text/html .shtml
AddOutputFilter INCLUDES .shtml
```

缺点：如果想将 SSI 指令添加到现有页面，则必须更改该页面的名称以及该页面的所有链接。

**重写规则（Rewrite Rules）**：在.htaccess 文件中使用 RewriteRule 时，每个目录的上下文会稍微改变一下，规则被认为是相对于当前目录，而不是原始请求的 URI。

```
在根目录中的.htaccess文件
RewriteRule "^images/(.+)\.jpg" "images/$1.png"

在images中的.htaccess文件
RewriteRule "^(.+)\.jpg" "$1.png"
```

**CGI 配置**：允许指定目录中的 CGI 程序运行

```
Options +ExecCGI
AddHandler cgi-script cgi pl
若要将目录中的所有文件都看做CGI程序，则将AddHandler替换为
SetHandler cgi-script
```

# 页面重定向

# CGI

CGI（common gateway interface，通用网关接口）是 Web 服务器运行时外部程序的规范，按 CGI 编写的程序**可以扩展服务器功能**，处理动态内容。CGI 应用程序**能与浏览器进行交互**，还可**通过数据库 API 与数据库服务器等外部数据源进行通信**,从数据库服务器中获取数据。对于 HTTP，只有 get 和 post 方法允许执行 cgi 脚本。

{% asset_img 9.png %}

常见的 CGI 术语：

- **fastcgi**：是 cgi 协议的优化版本
- **php-cgi**：php-cgi 实现了 fastcgi，但性能不佳，单进程处理请求。
- **php-fpm**：全称：php-fastcgi process manager，是 php-cgi 的改进版，管理多个 php-cgi 的进程及线程
- **cgi 进程或线程**：用于接收 web 服务器的动态请求，调用并初始化 zend 虚拟机
- **zend 虚拟机**：对 php 文件的语法分析、编译并执行，执行完成后关闭

{% asset_img 10.png %}

CGI 的三种交互模式：

- cgi 模式：httpd 每收到一个动态请求就 fork 一个 cgi 进程，该进程返回结果后就自动销毁
- 动态模块模式：将 php-cgi 模块编译进 httpd
- php-fpm 模式：使用 php-fpm 管理 php-cgi，httpd 不再控制 php-cgi 进程的启动，可将 php-fpm 独立运行在其他非 web 服务器上，实现动静分离

# 动态 httpd

安装 Apache 后，会在存放网页的目录中生成一个目录`cgi-bin`，关于 CGI 的配置在主配置文件中。

指令`ScriptAlias`：使 Apache 允许执行一个特定目录中的 CGI 程序，当客户端请求此特定目录中的资源时，Apache 假定其中所有的文件都是 CGI 程序并试图运行它。格式：`ScriptAlias /cgi-bin/ "CGI存放目录"`

```
<IfModule alias_module>
    ScriptAlias /cgi-bin/ "/var/www/cgi-bin/"
</IfModule>
<Directory "/var/www/cgi-bin">
    AllowOverride None
    Options None
    Require all granted
</Directory>
```

关于 CGI 模块加载的配置在`conf.modules.d/01-cgi.conf`中。

```
<IfModule mpm_worker_module>
   LoadModule cgid_module modules/mod_cgid.so
</IfModule>
<IfModule mpm_event_module>
   LoadModule cgid_module modules/mod_cgid.so
</IfModule>
# worker和event使用mod_cgid，而prefork使用mod_cgi
<IfModule mpm_prefork_module>
   LoadModule cgi_module modules/mod_cgi.so
</IfModule>
```

若开启了 Selinux，则还需要修改`cgi-bin`的上下文`chcon -R -t httpd_sys_script_exec_t /var/www/cgi-bin`

# httpd 与 SSL

SSL 对 Apache 能提供的功能：

- 认证用户与服务器
- 提供数据保密性和完整性

SSL 协议的工作流程包括**服务器认证阶段**和**用户认证阶段**

- 客户端向服务器发送一个 hello 开始消息，发起一个会话连接
- 服务器根据客户端信息确定是否生成新的主密钥，如果需要就会在响应 hello 信息中添加生成主密钥需要的信息
- 客户端收到响应信息，根据信息生成一个主密钥，用服务器的公钥加密发给服务器
- 服务器收到后返回客户一个用主密钥认证的信息，让客户端认证服务器
- 服务器通过客户端认证后，进入用户认证阶段，由服务器开始对客户端的认证
- 服务器向客户端发起提问（封装在数字签名中）
- 客户端返回答案和公钥，提供认证信息

{% asset_img 7.png %}

HTTPS 安全超文本传输协议，内置在浏览器中，对数据压缩和解密。HTTPS 就是用 SSL 作为 HTTP 应用层的子层，使用 TCP443 端口。

Apache 通过`mod_ssl`模块实现对 TLS/SSL 的支持，该模块存放在`/usr/lib64/httpd/modules/mod_ssl.so`，并有配置文件`/etc/httpd/conf.modules.d/00-ssl.conf`。还有相关模块`mod_socache_shmcb`，是一个共享对象缓存提供程序，提供对共享内存段内高性能循环缓冲区支持的缓存的创建和访问，已默认加载。

httpd 服务器配置自签名证书：

```
openssl genrsa -out /etc/pki/tls/private/server.key 2048    #生成私钥
openssl req -new -x509 -key /etc/pki/tls/private/server.key -out /etc/pki/tls/certs/server.crt  #根据私钥生成根证书
    Country Name (2 letter code) [XX]:CN            #国家名
    State or Province Name (full name) []:jiangsu   #省名
    Locality Name (eg, city) [Default City]:Yangzhou    #地名
    Organization Name (eg, company) [Default Company Ltd]:NJUPT  #公司名
    Organizational Unit Name (eg, section) []:Tech    #部门名
    Common Name (eg, your name or your server's hostname) []:system1  #主机名
    Email Address []:system1@example.com  #邮箱
```

也可以通过进入`/etc/pki/tls/certs`并使用命令`make server.key`创建私钥。

配置 SSL 虚拟主机，需要引用`/etc/httpd/conf.d/ssl.conf`中的配置，并做修改。

```
<VirtualHost *:443>
    SSLEngine on
    SSLProtocol all -SSLv2 -SSLv3
    SSLCipherSuite HIGH:3DES:!aNULL:!MD5:!SEED:!IDEA
    SSLHonorCipherOrder on
    SSLCertificateFile /etc/pki/tls/certs/server.crt
    SSLCertificateKeyFile /etc/pki/tls/private/server.key

    DocumentRoot "/var/www/html"
    ServerName system1.example.com
    ErrorLog "/var/log/httpd/error_log"
    CustomLog "/var/log/httpd/access_log" common
</VirtualHost>
```

由于是对已存在的虚拟主机进行 SSL 封装，所以，需要在原虚拟主机中添加两条指令进行重定向，使任何访问原 http 地址的客户端都跳转到 https 地址。

```
<VirtualHost *:80>
    DocumentRoot "/var/www/html"
    ServerName system1.example.com
    ErrorLog "/var/log/httpd/error_log"
    CustomLog "/var/log/httpd/access_log" common
    RewriteEngine  on
    RewriteRule  ^(/.*)$  https://%{HTTP_HOST}$1  [redirect=301]
</VirtualHost>
```

通过浏览器访问`http://system1.example.com`，会出现不安全提示

{% asset_img 8.png %}

确认添加例外后，就能自动跳转到`https://system1.example.com`。

# httpd 日志

当 Apache 开始运行后，会生成 4 种标准日志文件：

- 错误日志 error_log
- 访问日志 access_log
- 传输日志
- cookie 日志

若使用 SSL 加密，还会生成`ssl_access_log`、`ssl_error_log`、`ssl_request_log`。当日志文件过大时，Apache 会自动生成新的日志文件，文件的名称以配置文件中指定。

`LogFormat`指定的日志记录格式变量：

| 变量       | 含义                                              |
| ---------- | ------------------------------------------------- |
| %b         | 发送字节（不含 HTTP 标题）                        |
| %f         | 文件名                                            |
| %h         | 远程主机                                          |
| %a         | 远程 IP 地址                                      |
| %{HEADER}i | HEADER 内容：发送给服务器的请求                   |
| %p         | 服务器的服务端口                                  |
| %r         | 请求的第一行，类似 GET / HTTP/1.0                 |
| %s         | 状态（起始请求），最后请求状态为%>s               |
| %t         | 时间，格式是 common 日志格式中的时间格式          |
| %{format}t | 时间，格式由 format 给出                          |
| %T         | 服务器请求花费的时间（单位秒）                    |
| %u         | 来自 auth 的远程用户，若返回码为 401 则可能是假的 |
| %U         | 请求的 URL 路径                                   |
| %v         | 服务器的提供服务 ServerName                       |

错误日志记录的等级：

| 等级   | 解释                   |
| ------ | ---------------------- |
| Emerg  | 紧急，系统不可用       |
| Alert  | 需要立刻注意           |
| Crit   | 危险警告               |
| Error  | 除上述三种外的其他情况 |
| Warm   | 警告                   |
| Notice | 需要引起注意           |
| Info   | 一般消息               |
| Debug  | Debug 模式产生的消息   |

访问日志的种类：

- 普通日志：在 LogFormat 定义的名字为 common
- 参考日志：记录客户访问站点的用户身份，名字为 referer
- 代理日志：记录请求的用户代理，名字为 agent
- 综合日志：结合了上面三种，名字为 combined

## 日志切割

Apache 提供了命令`rotatelogs`，对日志进行切割，将庞大的日志文件切割为相对小的文件。

```
以轮替时间做切割：rotatelogs [options] 日志文件 [轮替时间（单位秒）][偏移量]
以日志大小做切割：rotatelogs [options] 日志文件 [日志文件大小]
偏移量为相对于UTC的分钟数，若省略，默认为0，即使用UTC时间。东八区即为8x60=480

可以把以下配置添加到主配置文件：
TransferLog "|rotatelogs 日志文件 86400"
TransferLog "|rotatelogs 日志文件 5M"

默认生成的日志名为"日志名.日志开始记录的时间"，如果使用轮替时间，则该值就是轮替时间的倍数，可通过cron服务设置。如果日志文件包含了strftime转换格式，则使用该格式。当轮替时间结束或日志文件大小达到指定值，就会生成一个新日志文件

  -v       详细的操作信息会被错误输出(strerr)
  -l       使用本地时间。不要在改变了GMT偏移量的环境中使用该选项，若设置了此选项，也就不用设置偏移量了
  -f       在程序启动时强制开启日志
  -t       截断日志
  -e       输出日志到标准输出
  -c       创建日志，无论是否为空
```

若要按时间轮替日志文件：

- `ErrorLog "|rotatelogs 日志存放目录/%Y%m%d_error.log 86400 480"`
- `CustomLog "|rotatelogs 日志存放目录/%Y%m%d_access.log 86400 480" common`

若要按日志大小轮替日志文件：

- `ErrorLog "|rotatelogs -l 目录/%Y%m%d_error.log 5M"`

- `CustomLog "|rotatelogs -l 目录/%Y%m%d_access.log 5M" common`

## Webalizer 分析统计日志

Webalizer 是一个高效的 web 服务器日志分析程序。webalizer 基本支持所有的日志文件格式，包括 common，combined。目前还支持 ftp 日志、squid 日志分析。

直接`yum install webalizer`即可。webalizer 的配置主要通过配置文件`webalizer.conf`实现。

```
LogFile      /var/log/httpd/access_log #日志文件的路径，也可通过命令行选项指定
OutputDir    /var/www/usage #统计报表的输出位置
HistoryName  /var/lib/webalizer/webalizer.hist #webalizer生成的历史文件名
Incremental  yes #设置是否增量
IncrementalName /var/lib/webalizer/webalizer.current #保存当前数据的文件名
PageType     htm* #定义哪些类型的URL属于页面访问
UseHTTPS     no #若在一台安全服务器上运行，需要开启
DNSCache     /var/lib/webalizer/dns_cache.db #反向DNS解析的缓存文件
DNSChildren  10 #设置用于DNS解析的子进程，值要在5到20间
Quiet        yes #不显示输出信息
FoldSeqErr   yes #强制忽略次序错误，因为Apache HTTP服务器可能会生成无序日志条目
HideURL      *.gif #设置需要隐藏的内容
SearchEngine  yahoo.com p= #设置搜索引擎和URL查询格式
```

**一般只要配置`LogFile`和`OutputDir`即可。**

```
webalizer [options] [log file]
  -v       显示日志详细信息
  -d       显示额外的debug信息
  -F type  设置日志类型（clf | ftp | squid | w3c）
  -f       忽略次序错误
  -i       忽略历史文件
  -p       保留状态（递增）
  -b       忽视状态（递增）
  -q       忽略消息信息
  -Q       忽略所有信息
  -T       显示时间信息
  -c file  指定配置文件
  -n name  指定服务器主机名
  -o dir   指定存放结果的文件
  -t name  指定报告题目的主机名
  --ip     查看指定IP地址的访问情况
  --start  指定开始时间
  --end    指定结束时间
```

在`/var/www/usage`下生成了几张图片和两个 html 文件，其中`index.html`是简要信息，`usage_日期.html`是详细的分析文件

<center>index.html</center>

{% asset_img 5.png %}

<center>usage_日期.html</center>

{% asset_img 6.png %}

# httpd 代理

httpd 通过`ProxyRequests`指令配置正向代理的功能

```
ProxyRequests on
ProxyVia on
<Proxy "*">      #访问任意外网URL
    Require host 允许通过代理访问外网的内网服务器
    #也可以是Require all granted
</Proxy>
```

# Apache-MPM 模式

MPM(`Multi-Processing Modules`)，Apache 的多路处理模块，有三种模式：`prefork`、`worker`、`event`。

编译时可通过`--with-mpm`指定模式，也可以通过`--enable-mpms-shared=all`支持全部三种。httpd2.4 以上默认采用`event`模式。并可通过`apachectl -l`看到编译了
`event.c`模块。

> httpd2.4 通过 rpm 安装会发现仍采用 prefork 模式，而源码安装则已使用 event 模式

可以修改`httpd.conf`中添加以下模块（源码安装）或`/etc/httpd/conf.modules.d/00-mpm.conf`（rpm 安装）改变模式

```
LoadModule mpm_prefork_module modules/mod_mpm_prefork.so 或
LoadModule mpm_worker_module modules/mod_mpm_worker.so 或
LoadModule mpm_event_module modules/mod_mpm_event.so
```

- `prefork`：实现了一个非线程、预派生的工作模式。在 Apache 启动之初，就会**预派生一些子进程**，然后等待连接。可以减少频繁创建和销毁进程的开销，**每个子进程只有一个线程**。成熟稳定，可以**兼容新老模块**，也**不需要担心线程安全问题**。**效率比`worker`略高**
  - 缺点：**一个进程相对地占用更多的资源，消耗大量内存，不擅长处理高并发的场景**。

{% asset_img 1.png %}

- `worker`：使用了**多进程和多线程的混合模式**，也同样会预派生一些子进程，然后每个子进程创建一些线程，同时包括**一个监听线程**，每个请求过来会被分配到一个线程来服务。**占用内存少，适合高并发环境**
  - **使用线程的原因：**线程比进程更加轻量级，因为**线程通常会共享父进程的内存地址的，因此内存占用会减少一些**。如果一个线程异常挂了，会**导致父进程和它的其他正常子线程都挂了，只会影响 Apache 的一部分**，而不是整个服务。
  - 缺点：**必须考虑线程安全问题**，因为多个子进程时共享父进程的内存地址的。若使用 keepalive 的长连接方式，某个线程一直占据，若过多的线程被占用，会导致高并发时无服务线程可用。

{% asset_img 2.png %}

- `event`：从 Apache2.2 才被加入 MPM，Apache2.4 开始成为默认 MPM。类似 worker 模式，但解决了 keepalive 问题。有一个**专门的线程来管理这些 keep-alive 线程**，当有真实请求过来的时候，将请求传递给服务线程，**执行完毕后，又允许它释放**，这样增强了在高并发场景下的请求处理能力。

{% asset_img 3.png %}

**各 MPM 模式的简单优化：** 若是 rpm 安装，就在`httpd.conf`中添加，若为源码安装，就在`/usr/local/httpd-2.4/conf/extra/httpd-mpm.conf`中找到对应模块修改。以下参数基本采用配置文件默认值。

- `worker`模式

```
<IfModule mpm_worker_module>
    ServerLimit           25  #服务器允许配置的上限进程数
    # 与ThreadLimit结合使用，可设置MaxClients允许配置的最大数值
    # 在重启期间对ServerLimit的修改都会被忽略，但对MaxClients的修改可生效

    ThreadLimit          200  #每个子进程可配置的线程数的上限
    # 也设置了ThreadPerChild的上限，默认为64

    StartServers           3  #服务器启动时建立的子进程数，默认为3
    MinSpareThreads       75  #最小空闲线程数，默认75。
    #若服务器中空闲进程太少，子进程会自动产生空闲进程等待

    MaxSpareThreads      250  #最大空闲线程数，默认250。
    #若服务器中空闲进程太多，子进程会杀死多余的空闲进程。
    #取值范围：>= MinSpareThreads+ThreadsPerChild

    MaxClients          2500  #允许同时运行的最大进程数，任何超过限制的请求进入等待队列
    #默认值为ServerLimit*ThreadsPerChild。若要增加此项，则同时也要增加ServerLimit

    ThreadsPerChild       25  #每个子进程建立的常驻执行线程数，默认25。
    #子进程创建这些线程后就不创建新线程了

    MaxConnectionsPerChild 0  #处理多少个请求后子进程自动销毁，默认值0意味着永不销毁。
    # 在Apache2.4版本以前，叫做MaxRequestsPerChild
    #当负载较高时，为了使每个进程处理更多的请求，避免销毁、创建进程的开销，一般建议设置为0或较大的数字。
</IfModule>
```

- `prefork`模式

```
<IfModule mpm_prefork_module>
    StartServers              5
    MinSpareServers           5  #最小空闲进程数，与MinSpareThreads同理
    MaxSpareServers          10  #最大空闲进程数，与MaxSpareThreads同理
    ServerLimit            2000
    MaxClients             1000  #默认MaxClients最多有256个线程
    MaxConnectionsPerChild    0
</IfModule>
```

修改模式重启 httpd，查看进程，能看到五个子进程

```
ps -ef | grep httpd
root       2241      1  1 22:05 ?        00:00:00 /usr/sbin/httpd -DFOREGROUND
apache     2242   2241  0 22:05 ?        00:00:00 /usr/sbin/httpd -DFOREGROUND
apache     2243   2241  0 22:05 ?        00:00:00 /usr/sbin/httpd -DFOREGROUND
apache     2244   2241  0 22:05 ?        00:00:00 /usr/sbin/httpd -DFOREGROUND
apache     2245   2241  0 22:05 ?        00:00:00 /usr/sbin/httpd -DFOREGROUND
apache     2248   2241  0 22:05 ?        00:00:00 /usr/sbin/httpd -DFOREGROUND
```

- `event`模式

```
<IfModule mpm_event_module>
    StartServers             3
    MinSpareThreads         75
    MaxSpareThreads        250
    ThreadsPerChild         25
    MaxRequestWorkers      400
    MaxConnectionsPerChild   0
</IfModule>
```

# Apache 实用第三方模块

若要在 httpd 上添加新的模块，可以通过修改模块配置文件增加`LoalModule`指令添加，也可以使用`httpd-devel`提供的工具`apxs`直接添加，需要 httpd 开启了 DSO。

```
apxs
  -n 模块名    指定模块名，可与-i和-g组合
  -i          安装模块，可指定多个
  -a          自动在主配置文件加上LoadModule
  -A          自动在主配置文件加上#LoadModule，即安装了但先不启用
  -c C文件     将.c文件编译为.so文件
```

模块间可能存在依赖，可根据报错信息解决。

## Gzip 压缩

Gzip 将 Apache 网页内容压缩后传输给客户端，加快网页加载速度，建议开启。Gzip 有两个模块：`mod_gzip`和`mod_deflate`，

## 防 DDOS 攻击

应对 DDOS 攻击的模块为`mod_evasive`，可通过`yum install mod_evasive`获取。安装完成后会生成`/usr/lib64/httpd/modules/mod_evasive24.so`，以及`/etc/httpd/conf.d/mod_evasive.conf`

# LAMP 环境搭建

直接用`yum|dnf`安装 php，php 版本为 7.1。php 的核心包：

- `php`：在`/etc/httpd/conf.d/`创建了`php.conf`，在`/usr/lib64/httpd/modules/`创建了`libphp7.so`
- `php-common`：创建了大量模块存放在`/usr/lib64/php/modules/`，帮助文档，配置文件`/etc/php.ini`以及`/etc/php.d/`中各个配置文件。
- `php-fpm`：创建了配置文件`/etc/php-fpm.conf`及`/etc/php-fpm.d/`
- `php-cli`：创建了命令`php`、`php-cgi`、`phar`、`phpize`存放在`/usr/bin/`中

使用`systemctl start php-fpm`启动。

### 参考文章

- 高性能网站构建实战
- Linux 系统管理与网络管理
- Linux 就该这么学
- Linux 运维之道（第二版）
- Linux 服务器架设指南（第二版）
- 防线-企业 Linux 安全运维理念和实战
- RHCSA/RHCE 红帽 Linux 认证学习指南（第 7 版）
- [Apache 性能优化之 MPM 选择和配置](https://blog.csdn.net/ccscu/article/details/70182476)
- [Apache 的三种 MPM 模式比较：prefork，worker，event](http://blog.jobbole.com/91920/)
- [apache 的三种 mpm 模式](https://blog.csdn.net/njys1/article/details/60867092)
- [浅谈.htaccess 文件--避免滥用.htaccess 文件](https://www.cnblogs.com/jpdoutop/p/httpd-htaccess.html)
- [Apache HTTP Server Tutorial: .htaccess files](https://httpd.apache.org/docs/2.4/howto/htaccess.html)
- [Apache httpd Tutorial: Introduction to Server Side Includes](https://httpd.apache.org/docs/2.4/howto/ssi.html)
- [简单说明 CGI 和动态请求是什么](https://www.cnblogs.com/f-ck-need-u/p/7627035.html)

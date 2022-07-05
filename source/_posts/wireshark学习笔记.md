---
title: Wireshark学习笔记
date: 2018-05-18 21:21:35
tags: [网络, wireshark]
categories: [网络]
comments: false
---

**基于 wireshark v2.4.5**
本篇包含以下内容

- [基本操作](#基本操作)
  - [捕获过滤器](#捕获过滤器)
- [tshark 命令使用](#tshark-命令使用)
  - [常用操作](#常用操作)
- [参考文章](#参考文章)

<!--more-->

# 基本操作

两种过滤器：

- 捕获过滤器 Capture Filter：也称抓包过滤器，使用伯克利包过滤语言（BPF），依赖于 BPF 的库（libpcap，Winpcap），用于限制抓的包，即抓包前的设定
- 显示过滤器 Display Capture：用于限制已经抓的包的显示，即抓包后的设定

## 捕获过滤器

1. type（类型）限定词
   host、net、port、portrange
2. dir（方向）限定词
   src、dst
3. proto（协议）限定词
   ether、arp、icmp、ip、tcp、udp、http、ftp

逻辑运算：`&&`或`and`（与）、`||`或`or`（或）、`!`或`not`（非）
过滤器基本语法
`[protocol] [direction] [host] [value] [logical operations] [other expression]`

捕获-->捕获过滤器 有常用的语法案例
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202202250257512.PNG)

常用过滤表达式举例：
`ether`

# tshark 命令使用

tshark 是一个网络协议分析器。 它允许从实时网络捕获数据包数据，或从先前保存的捕获文件中读取数据包，将这些数据包的解码形式打印到标准输出或将数据包写入文件。TShark 的本机捕获文件格式是 pcapng 格式，也是 wireshark 和各种其他工具使用的格式。

tshark 参数选项：

```
捕获接口:
　　-i: -i <interface> 指定捕获接口，默认是第一个非本地循环接口
　　-f: -f <capture filter> 设置抓包过滤表达式，遵循libpcap过滤语法，在抓包的过程中过滤，如果是分析本地文件则用不到
　　-s: -s <snaplen> 设置快照长度，用来读取完整的数据包，因为网络中传输有65535的限制，值0代表快照长度65535，默认也是这个值
　　-p: 以非混合模式工作，只关心和本机有关的流量
　　-I: 在监控模式（monitor）抓包
　　-B: -B <buffer size> 设置缓冲区的大小，只对windows生效，默认是2M
　　-y: -y<link type> 设置抓包的数据链路层协议，不设置则默认为-L找到的第一个协议，局域网一般是EN10MB等
　　-D: 打印接口的列表
　　-L: 列出本机支持的数据链路层协议，供-y参数使用

捕获停止选项:
　　-c: -c <packet count> 捕获n个包之后结束，默认捕获无限个
　　-a: -a <autostop cond.> ... duration:NUM  在num秒之后停止捕获
　　														filesize:NUM  在numKB之后停止捕获
　　　　　　　　　　　　　　　　　   files:NUM     在捕获num个文件之后停止捕获

捕获输出选项:
    -b <ringbuffer opt.> ... ring buffer的文件名由-w参数决定,-b参数采用test:value的形式书写
    												 duration:NUM - 在NUM秒之后切换到下一个文件
    												 filesize:NUM - 在NUM KB之后切换到下一个文件
    												 files:NUM - 形成环形缓冲，在NUM文件达到之后

RPCAP选项:
　　remote packet capture protocol，远程抓包协议进行抓包；
　　-A:  -A <user>:<password>,使用RPCAP密码进行认证;

输入文件:
　　-r: -r <infile> 设置读取本地文件

处理选项:
　　-2: 执行两次分析
　　-R: -R <read filter>,包的读取过滤器，可以在wireshark的filter语法上查看；在wireshark的视图->过滤器视图，在这一栏点击表达式，就会列出来对所有协议的支持。
　　-Y: -Y <display filter>,使用读取过滤器的语法，在单次分析中可以代替-R选项;
　　-n: 禁止所有地址名字解析（默认为允许所有）
　　-N: 启用某一层的地址名字解析。“m”代表MAC层，“n”代表网络层，“t”代表传输层，“C”代表当前异步DNS查找。如果-n和-N参数同时存在，-n将被忽略。如果-n和-N参数都不写，则默认打开所有地址名字解析。
　　-d: 将指定的数据按有关协议解包输出,如要将tcp 8888端口的流量按http解包，应该写为“-d tcp.port==8888,http”;tshark -d. 可以列出所有支持的有效选择器。
　　
输出选项:
　　-w: -w <outfile|-> 设置raw数据的输出文件。这个参数不设置，tshark将会把解码结果输出到stdout,“-w -”表示把raw输出到stdout。如果要把解码结果输出到文件，使用重定向“>”而不要-w参数。
　　-F: -F <output file type>,设置输出的文件格式，默认是.pcapng,使用tshark -F可列出所有支持的输出文件类型。
　　-V: 增加细节输出;
　　-O: -O <protocols>,只显示此选项指定的协议的详细信息。
　　-P: 即使将解码结果写入文件中，也打印包的概要信息；
　　-S: -S <separator> 行分割符
　　-x: 设置在解码输出结果中，每个packet后面以HEX dump的方式显示具体数据。
　　-T: -T pdml|ps|text|fields|psml,设置解码结果输出的格式，包括text,ps,psml和pdml，默认为text
　　-e: 如果-T fields选项指定，-e用来指定输出哪些字段;
　　-E: -E <fieldsoption>=<value>如果-T fields选项指定，使用-E来设置一些属性，比如
　　　　header=y|n
　　　　separator=/t|/s|<char>
　　　　occurrence=f|l|a
　　　　aggregator=,|/s|<char>
　　-t: -t a|ad|d|dd|e|r|u|ud 设置解码结果的时间格式。“ad”表示带日期的绝对时间，“a”表示不带日期的绝对时间，“r”表示从第一个包到现在的相对时间，“d”表示两个相邻包之间的增量时间（delta）。
　　-u: s|hms 格式化输出秒；
　　-l: 在输出每个包之后flush标准输出
　　-q: 结合-z选项进行使用，来进行统计分析；
　　-X: <key>:<value> 扩展项，lua_script、read_format，具体参见 man pages；
　　-z：统计选项，具体的参考文档;tshark -z help,可以列出，-z选项支持的统计方式。
```

## 常用操作

若不使用任何选项，会抓取第一个非回环网卡的所有网络包。若指定`-i`网卡，则只监听该网卡的流量

```
root@kali:~# tshark -i eth0
Capturing on 'eth0'
    1 0.000000000 192.168.80.139 → 192.168.80.2 DNS 69 Standard query 0xfe4e A baidu.com
    2 0.000103735 192.168.80.139 → 192.168.80.2 DNS 69 Standard query 0x7c57 AAAA baidu.com
    3 0.005903526 192.168.80.2 → 192.168.80.139 DNS 101 Standard query response 0xfe4e A baidu.com A 123.125.115.110 A 220.181.57.216
```

输出信息从左到右依次为：

```
抓包开始时间  源IP  目的IP  协议  包长度  包信息
```

# 参考文章

> [[Wireshark 命令行工具 tshark 详解(含例子)-01](https://www.cnblogs.com/liun1994/p/6142505.html)]

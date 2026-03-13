---
title: Sed、Awk与Shell编程
date: 2018-09-29 12:08:18
tags: [sed, awk, Linux]
categories: [Shell]
comments: false
---

- [Sed](#sed)
  - [Sed 基础](#sed-基础)
  - [Sed 命令详解](#sed-命令详解)
  - [Sed 高级应用](#sed-高级应用)
  - [Sed 实战案例](#sed-实战案例)
- [Awk](#awk)
  - [Awk 基础](#awk-基础)
  - [Awk 变量与操作符](#awk-变量与操作符)
  - [Awk 流程控制](#awk-流程控制)
  - [Awk 函数](#awk-函数)
  - [Awk 实战案例](#awk-实战案例)
- [Shell 编程](#shell-编程)
  - [Shell 基础](#shell-基础)
  - [变量与参数](#变量与参数)
  - [运算符](#运算符)
  - [流程控制](#流程控制)
  - [函数](#函数)
  - [文本处理实战](#文本处理实战)

<!--more-->

# Sed

## Sed 基础

`sed`（Stream Editor）是一个面向字符流的编辑器，对文本进行过滤和替换操作。sed 一次仅读取一行进行操作，非常适合处理大文件。

### sed 工作原理

sed 默认**不修改源文件**，仅仅将处理结果输出到屏幕。它的工作流程如下：

```
┌─────────────────────────────────────────────────────────┐
│                    sed 工作流程                         │
└─────────────────────────────────────────────────────────┘

  输入文件 ──▶ 模式空间 ──▶ 处理命令 ──▶ 输出
              (Buffer)    (执行指令)    (屏幕/文件)
              
  - 模式空间：sed 一次读取一行到模式空间
  - 保持空间：用于暂存数据，可与模式空间交换
```

### 基本语法

```bash
sed [选项] '命令' [输入文件...]
sed [选项] -f 脚本文件 [输入文件...]
```

### 常用选项

| 选项 | 说明 |
|------|------|
| `-n`, `--quiet`, `--silent` | 静默模式，不自动打印模式空间内容 |
| `-e` 脚本 | 添加多个编辑命令 |
| `-f` 脚本文件 | 从文件读取编辑命令 |
| `-i[SUFFIX]` | 直接修改源文件（in-place），可选备份 |
| `-r`, `--regexp-extended` | 使用扩展正则表达式 |
| `-l N` | 指定 l 命令的输出行长度 |
| `-s`, `--separate` | 将多个文件视为独立文件 |
| `-u`, `--unbuffered` | 最小化缓冲区输入输出 |

### 定界符

sed 默认使用 `/` 作为定界符，但可以更换为其他符号：

```bash
# 使用 / 作为定界符
sed 's/old/new/' file

# 使用 | 作为定界符（当替换内容包含 / 时很有用）
sed 's|/old/path|/new/path|' file

# 使用 # 作为定界符
sed 's#old#new#' file

# 使用 : 作为定界符
sed 's:old:new:' file
```

## Sed 命令详解

sed 的基本命令格式：`[地址]指令 内容`

### 1. a\ - 追加

在指定行**之后**添加新内容：

```bash
# 在第2行后添加一行
sed '2a\新添加的内容' file

# 在所有包含 "error" 的行后添加
sed '/error/a\处理完成' file

# 在第1到4行后每行都添加（每行后都添加）
sed '1,4a\新内容' file

# 在最后一行后添加 ($ 表示最后一行)
sed '$a\最后一行内容' file

# 添加多行内容
sed '1a\第一行\第二行\第三行' file
```

### 2. i\ - 插入

在指定行**之前**添加新内容：

```bash
# 在第2行前插入
sed '2i\插入的内容' file

# 在包含 "start" 的行前插入
sed '/start/i\--- 开始 ---' file

# 在文件开头插入
sed '1i\文件头部' file
```

### 3. c\ - 替换

替换整行内容：

```bash
# 替换第2行
sed '2c\替换后的内容' file

# 替换包含 "old" 的行
sed '/old/c\新内容' file

# 替换连续多行
sed '1,3c\这是一行替换内容' file
```

### 4. d - 删除

删除指定的行：

```bash
# 删除第2行
sed '2d' file

# 删除最后一行
sed '$d' file

# 删除空白行
sed '/^$/d' file

# 删除包含 "error" 的行
sed '/error/d' file

# 删除第1到3行
sed '1,3d' file

# 删除空行和只有空格的行
sed '/^[[:space:]]*$/d' file

# 删除以 # 开头的行（注释行）
sed '/^#/d' file
```

### 5. s - 替换

最常用的替换命令：

```bash
# 基本替换（替换第一个匹配）
sed 's/old/new/' file

# 替换所有匹配 (global)
sed 's/old/new/g' file

# 替换第 n 个匹配
sed 's/old/new/2' file

# 替换第2到第4个匹配
sed 's/old/new/2g' file

# 忽略大小写
sed 's/old/new/I' file

# 打印替换后的行（与 -n 配合）
sed -n 's/old/new/p' file
```

### 6. p - 打印

打印模式空间的内容：

```bash
# 打印所有行
sed 'p' file

# 只打印第5行
sed -n '5p' file

# 打印包含 "pattern" 的行
sed -n '/pattern/p' file

# 打印第5到10行
sed -n '5,10p' file
```

### 7. n - 下一行

移动到下一行：

```bash
# 打印奇数行
sed -n 'p;n' file

# 打印偶数行
sed -n 'n;p' file
```

### 8. y - 字符转换

字符一对一转换：

```bash
# 把小写转大写
sed 'y/abcdefghijklmnopqrstuvwxyz/ABCDEFGHIJKLMNOPQRSTUVWXYZ/' file

# 数字替换
sed 'y/123/456/' file
```

### 9. w - 写入文件

将匹配行写入指定文件：

```bash
# 将包含 "error" 的行写入 error.log
sed -n '/error/w error.log' file

# 将第1到10行写入 part.txt
sed '1,10w part.txt' file
```

### 10. r - 读取文件

读取文件内容插入：

```bash
# 在第5行后插入 file2 的内容
sed '5r file2.txt' file1

# 在包含 "END" 的行后插入
sed '/END/r footer.txt' file
```

## Sed 高级应用

### 地址与范围

```bash
# 单行地址
sed '5d' file                    # 删除第5行

# 行号范围
sed '1,10d' file                 # 删除1-10行

# 正则匹配范围
sed '/start/,/end/d' file        # 从包含 start 的行删到包含 end 的行

# 首次匹配后若干行
sed '/pattern/,+5d' file         # 删除匹配行及其后5行
```

### 多命令组合

```bash
# 使用 -e 添加多个命令
sed -e '1d' -e 's/old/new/' file

# 使用分号分隔
sed '1d;s/old/new/' file

# 使用 {} 分组
sed '/pattern/{
  s/old/new/
  p
}' file
```

### 正则表达式

```bash
# 匹配行首 ^
sed '/^$/d' file                # 删除空行

# 匹配行尾 $
sed '/.$/d' file                # 删除以句号结尾的行

# 匹配任意字符 .
sed 's/.../xxx/' file           # 替换任意3个字符

# 匹配0个或多个 *
sed '/ab*c/d' file              # 删除包含 a 后面0个或多个 b 再接 c 的行

# 匹配1个或多个 +
sed -r '/a+/d' file             # 删除包含一个或多个 a 的行

# 匹配0个或1个 ?
sed -r '/colou?r/d' file         # 删除 color 或 colour

# 字符类 []
sed '/[aeiou]/d' file           # 删除包含元音字母的行

# 预定义字符类
sed '/[[:digit:]]/d' file       # 删除包含数字的行
sed '/[[:alpha:]]/d' file       # 删除包含字母的行
sed '/[[:space:]]/d' file       # 删除包含空白的行
```

### 特殊字符应用

```bash
# & 表示匹配的字符串
sed 's/word/[&]/g' file         # 给每个单词加 []

# \( \) 捕获分组
sed 's/\(abc\)/\1def/' file     # abc -> abcdef
sed 's/\(a\)\(b\)/\2\1/' file   # ab -> ba

# \n 反向引用
echo "abc def" | sed 's/\(.*\) \(.*\)/\2 \1/'  # def abc
```

### 保持空间应用

sed 有另一个缓冲区称为"保持空间"（hold space）：

```bash
# x - 交换模式空间和保持空间
sed 'x' file                     # 第一行变成最后一行

# h - 把模式空间复制到保持空间
sed 'h' file                     # 保持空间保存模式空间内容

# H - 追加到保持空间
sed 'H' file                     # 保持空间追加模式空间

# g - 把保持空间复制到模式空间
sed 'g' file                     # 模式空间被保持空间替换

# G - 追加到模式空间
sed 'G' file                     # 模式空间追加保持空间

# 实用：逆转行顺序
sed -n '1!G;h;$!d' file

# 实用：将两行合并为一行
sed 'N;s/\n/ /' file
```

### 标签与跳转

```bash
# 定义标签
:b
# 跳转到标签
sed ':b;s/old/new/;tb' file     # 替换直到不再变化

# 条件跳转
sed '/error/b; s/old/new/' file # 遇到 error 就跳过替换
```

## Sed 实战案例

### 案例1：批量替换文件中的路径

```bash
# 将 /old/path 替换为 /new/path
sed -i 's|/old/path|/new/path|g' file.txt

# 递归处理目录下所有文件
find /path -type f -name "*.txt" -exec sed -i 's|/old|/new|g' {} \;
```

### 案例2：删除 HTML 标签

```bash
# 删除所有 HTML 标签
sed 's/<[^>]*>//g' file.html

# 删除空标签
sed 's/<[^>]*><[^>]*>//g' file.html
```

### 案例3：添加行号

```bash
# 左边添加行号
sed = file.txt | sed 'N;s/\n/\t/'

# 右边添加行号
sed = file.txt | sed 'N;s/ /\t/'
```

### 案例4：提取 IP 地址

```bash
# 从文件提取 IP 地址
grep -o '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' file.txt

# 或者使用 sed
sed -n '/[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}/p' file.txt
```

### 案例5：格式化文本

```bash
# 删除行首空格
sed 's/^[ ]*//' file

# 删除行尾空格
sed 's/[ ]*$//' file

# 删除行首行尾空格
sed 's/^[ ]*//;s/[ ]*$//' file

# 制表符转空格（每个制表符转4个空格）
sed 's/\t/    /g' file
```

### 案例6：修改配置文件

```bash
# 注释掉包含 "PORT" 的行
sed -i '/^PORT/s/^/#/' config.conf

# 取消注释
sed -i '/^#PORT/s/^#//' config.conf

# 在配置文件开头添加
sed -i '1i# Configuration File' config.conf

# 在配置文件末尾添加
sed -i '$a# End of Config' config.conf
```

### 案例7：处理日志

```bash
# 提取特定日期的日志
sed -n '/2024-01-01/p' access.log

# 提取错误日志
sed -n '/ERROR/p' application.log

# 统计每个 IP 访问次数
sed -n 's/^.*from \([0-9.]*\).*/\1/p' access.log | sort | uniq -c
```

---

# Awk

## Awk 基础

Awk 是一种**模式匹配的程序设计语言**，用于对文本和数据进行扫描和处理。常见操作是将数据转换为格式化的报表。

### 工作原理

Awk 逐行扫描文件，寻找匹配特定模式的行，并对其进行处理：

```
┌─────────────────────────────────────────────────────────┐
│                    Awk 工作流程                         │
└─────────────────────────────────────────────────────────┘

  输入文件 ──▶ 读取一行 ──▶ 匹配模式 ──▶ 执行动作 ──▶ 下一行
                    │
                    ▼
              BEGIN { }    # 初始化（执行一次）
              
                    │
                    ▼
              /pattern/ { } # 匹配模式（每行执行）
              
                    │
                    ▼
              END { }      # 收尾（执行一次）
```

### 基本语法

```bash
awk 'pattern {action}' file
awk -F ':' 'pattern {action}' file
awk -f script.awk file
```

### 常用选项

| 选项 | 说明 |
|------|------|
| `-F` | 指定字段分隔符 |
| `-v` | 定义变量 |
| `-f` | 从文件读取 awk 脚本 |
| `-v OFS='\t'` | 指定输出字段分隔符 |
| `-v RS=''` | 指定记录分隔符（多行记录） |

### 内置变量

| 变量 | 说明 |
|------|------|
| `$0` | 整行记录 |
| `$1-$n` | 第 n 个字段 |
| `NF` | 字段数量 (Number of Fields) |
| `NR` | 当前记录号 (Number of Records) |
| `FNR` | 当前文件的记录号 |
| `FS` | 输入字段分隔符 (默认空格/tab) |
| `OFS` | 输出字段分隔符 (默认空格) |
| `RS` | 输入记录分隔符 (默认换行) |
| `ORS` | 输出记录分隔符 (默认换行) |
| `FILENAME` | 当前文件名 |
| `ARGC` | 命令行参数数量 |
| `ARGV` | 命令行参数数组 |

### 字段分隔符

```bash
# 默认按空格/tab分隔
awk '{print $1, $2}' file

# 指定冒号为分隔符
awk -F ':' '{print $1, $3}' /etc/passwd

# 使用多个分隔符
awk -F '[:/]' '{print $1, $2}' file

# 使用正则作为分隔符
awk -F '/[:#]+/' '{print $1}' file

# 在脚本中指定 FS
awk 'BEGIN{FS=":"} {print $1}' /etc/passwd
```

## Awk 变量与操作符

### 变量使用

```bash
# 简单变量
awk '{name="test"; print name}' file

# 字段变量
awk '{print $1, $3}' file

# 内置变量
awk 'NR==5 {print}' file           # 打印第5行

# 数组
awk '{arr[$1]++} END{for(k in arr) print k, arr[k]}' file
```

### 运算符

```bash
# 算术运算符
+  -  *  /  %  ^

# 赋值运算符
=  +=  -=  *=  /=  %=  ^=

# 比较运算符
==  !=  <  >  <=  >=  ~  !~   # ~ 表示匹配正则

# 逻辑运算符
&&  ||  !

# 三元运算符
condition ? value1 : value2

# 字符串连接
awk '{str = $1 " - " $2; print str}' file
```

### 模式匹配

```bash
# 正则匹配
awk '/error/ {print}' log.txt
awk '$1 ~ /pattern/ {print}' file

# 精确匹配
awk '$1 == "value" {print}' file

# 数值比较
awk '$3 > 100 {print}' file

# 组合条件
awk '/error/ && $3 > 50 {print}' file
awk '/error/ || /warning/ {print}' file

# 范围模式
awk '/start/,/end/ {print}' file
```

## Awk 流程控制

### 条件判断

```bash
# 单分支
awk '{if ($1 > 100) print "big"}' file

# 双分支
awk '{if ($1 > 100) print "big"; else print "small"}' file

# 多分支
awk '{
  if ($1 >= 90) print "A"
  else if ($1 >= 80) print "B"
  else if ($1 >= 70) print "C"
  else print "D"
}' file
```

### 循环

```bash
# for 循环
awk '{
  for (i=1; i<=NF; i++) sum += $i
  print sum
}' file

# for 遍历数组
awk '{arr[$1]++} END{for (k in arr) print k, arr[k]}' file

# while 循环
awk '{
  i=1
  while (i<=NF) {
    print $i
    i++
  }
}' file

# do-while 循环
awk '{
  do {
    print $0
    getline
  } while ($0 != "end")
}' file
```

### 数组

```bash
# 定义数组
awk 'BEGIN{
  arr[0] = "zero"
  arr[1] = "one"
  arr["name"] = "value"
}'

# 数组遍历
awk '{
  for (key in array) print key, array[key]
}' file

# 判断键是否存在
awk 'BEGIN{
  arr["a"] = 1
  if ("b" in arr) print "exists"
  else print "not exists"
}'

# 删除数组元素
awk 'BEGIN{
  arr[1] = "one"
  delete arr[1]
}'
```

## Awk 函数

### 内置函数

```bash
# 字符串函数
awk 'BEGIN{
  str = "Hello World"
  print length(str)        # 字符串长度
  print index(str, "World") # 子串位置
  print substr(str, 1, 5)  # 子串截取
  print toupper(str)       # 转大写
  print tolower(str)       # 转小写
  print split(str, arr, " ") # 分割字符串
  print gsub(/o/, "0", str)   # 全局替换（返回替换次数）
  print sub(/o/, "0", str)    # 替换第一个
  print sprintf("%05d", 42)   # 格式化
}'

# 数学函数
awk 'BEGIN{
  print sqrt(16)        # 平方根
  print exp(1)          # e 的幂
  print log(2.718)     # 自然对数
  print sin(3.14)      # 三角函数
  print int(3.14)      # 取整
  print rand()         # 随机数 0-1
  srand(10)            # 设置随机种子
}'

# 时间函数
awk 'BEGIN{
  print systime()      # Unix 时间戳（秒）
  print strftime("%Y-%m-%d %H:%M:%S")  # 格式化时间
}'
```

### 自定义函数

```awk
awk 'function max(a, b) {
  return (a > b) ? a : b
}
{
  print max($1, $2)
}' file
```

## Awk 实战案例

### 案例1：统计文件大小

```bash
# 统计目录下文件大小
ls -l | awk '{sum += $5} END {print "Total:", sum, "bytes"}'

# 统计目录总大小
du -sh /path | awk '{print $1}'
```

### 案例2：分析日志

```bash
# 统计 IP 访问次数
awk '{print $1}' access.log | sort | uniq -c | sort -nr | head -10

# 统计每个状态码的数量
awk '{print $9}' access.log | sort | uniq -c | sort -rn

# 统计访问最频繁的时间段
awk '{print $4}' access.log | cut -d: -f1,2 | sort | uniq -c | sort -rn

# 找出错误日志
awk '/ERROR/ {print}' application.log

# 统计平均响应时间
awk '{sum+=$11; count++} END {print "Average:", sum/count}' access.log
```

### 案例3：处理 CSV 文件

```bash
# 打印特定列
awk -F',' '{print $1, $3}' data.csv

# 打印表头
awk -F',' 'NR==1 {print}' data.csv

# 过滤数据
awk -F',' '$3 > 1000 {print}' data.csv

# 添加序号
awk -F',' '{print NR, $0}' data.csv
```

### 案例4：数据格式化

```bash
# 格式化输出
awk 'BEGIN{printf "%-10s %-5s\n", "Name", "Score"} 
     {printf "%-10s %-5d\n", $1, $2}' data.txt

# 表格形式输出
awk 'BEGIN{print "=========="} 
     {printf "| %-8s |\n", $1} 
     END{print "=========="}' file
```

### 案例5：文本处理

```bash
# 合并两文件
awk 'NR==FNR{a[$1]=$2; next} {print $1, a[$1]}' file1 file2

# 去重
awk '!seen[$0]++' file

# 找出重复行
awk 'seen[$0]++' file

# 计算列总和
awk '{sum=0; for(i=1;i<=NF;i++) sum+=$i; print sum}' file
```

### 案例6：条件统计

```bash
# 统计男生女生人数
awk '$3=="M" {male++} $3=="F" {female++} END {print "Male:", male, "Female:", female}' data.txt

# 统计成绩分布
awk '{
  if ($2 >= 90) grade="A"
  else if ($2 >= 80) grade="B"
  else if ($2 >= 70) grade="C"
  else grade="D"
  count[grade]++
}
END {
  for (g in count) print g, count[g]
}' scores.txt
```

---

# Shell 编程

## Shell 基础

### Shell 脚本执行方式

```bash
# 方式1: 使用 bash 命令（不需要可执行权限）
bash script.sh

# 方式2: 添加可执行权限后执行
chmod +x script.sh
./script.sh

# 方式3: source 命令（当前 shell 执行）
source script.sh

# 方式4: 管道执行
echo 'echo "hello"' | bash
```

### Shell 类型

```bash
# 查看可用 shell
cat /etc/shells

# 查看当前 shell
echo $SHELL
echo $0

# 切换 shell
bash        # 启动 bash
sh          # 启动 sh
zsh         # 启动 zsh
```

### 注释

```bash
# 单行注释

: << 'EOF'
这是
多行
注释
EOF

# 或
: '
这是
多行
注释
'
```

## 变量与参数

### 系统变量

```bash
# 常用系统变量
echo $HOME      # 当前用户家目录
echo $USER      # 当前用户
echo $UID       # 当前用户 ID
echo $PATH      # 可执行程序路径
echo $PWD       # 当前目录
echo $LANG      # 默认语言
echo $IFS       # 内部字段分隔符
echo $HOSTNAME  # 主机名
echo $RANDOM    # 随机数 0-32767
echo $SECONDS   # 脚本运行秒数
```

### 变量定义

```bash
# 普通变量
NAME="Tom"
AGE=25

# 只读变量
readonly PI=3.14159

# 整型变量
declare -i NUM=10

# 数组变量
ARR=(1 2 3 4)
ARR[0]=1
echo ${ARR[0]}      # 访问单个元素
echo ${ARR[@]}      # 访问所有元素
echo ${#ARR[@]}     # 数组长度

# 关联数组（字典）
declare -A DICT
DICT[name]="Tom"
DICT[age]=25
echo ${DICT[name]}
```

### 环境变量

```bash
# 临时环境变量
export VAR=value

# 永久环境变量（当前用户）
echo 'export PATH=$PATH:/new/path' >> ~/.bashrc
source ~/.bashrc

# 永久环境变量（系统）
echo 'PATH=$PATH:/new/path' >> /etc/profile
```

### 变量引用

```bash
NAME="Tom"

# 基本引用
echo $NAME
echo ${NAME}

# 字符串长度
echo ${#NAME}

# 子串截取
STR="Hello World"
echo ${STR:0:5}      # 从第0个字符开始，取5个 -> Hello
echo ${STR:6}       # 从第6个开始取到末尾 -> World
echo ${STR:-default} # 变量为空时使用默认值

# 字符串替换
echo ${STR/Hello/Hi}     # 替换第一个
echo ${STR//l/L}         # 替换所有

# 删除子串
echo ${STR#Hello}        # 从开头删除最短匹配
echo ${STR##Hello}       # 从开头删除最长匹配
echo ${STR%World}        # 从结尾删除最短匹配
echo ${STR%%World}       # 从结尾删除最长匹配
```

### 位置参数

```bash
#!/bin/bash
echo $0    # 脚本名称
echo $1    # 第1个参数
echo $2    # 第2个参数
echo ${10} # 第10个参数（需要花括号）
echo $#    # 参数总数
echo $@    # 所有参数（独立）
echo $*    # 所有参数（整体）
```

### shift 命令

```bash
#!/bin/bash
while [ $# -gt 0 ]; do
  echo "Current: $1, Remaining: $#"
  shift    # 参数左移
done

# 使用 shift n 跳过参数
shift 3   # 跳过前3个参数
```

### 特殊变量

```bash
$?    # 上一条命令退出状态（0成功，非0失败）
$$    # 当前进程 PID
$!    # 上一个后台进程的 PID
$-    # 当前 shell 的选项标志
$_    # 上一条命令的最后一个参数
```

## 运算符

### 算术运算

```bash
# 方式1: $[ ]
result=$[ 1 + 2 ]
result=$[ $a * $b ]

# 方式2: $(())
result=$(( 1 + 2 ))
result=$(($a + $b))

# 方式3: expr（注意空格）
result=`expr 1 + 2`
result=$(expr $a + $b)

# 方式4: let
let result=1+2
let a+=1

# 方式5: bc（浮点数）
result=$(echo "1.5 + 2.3" | bc)
result=$(echo "scale=2; 10/3" | bc)
```

### 关系运算

```bash
# 数字比较
[ $a -eq $b ]   # equal
[ $a -ne $b ]   # not equal
[ $a -gt $b ]   # greater than
[ $a -lt $b ]   # less than
[ $a -ge $b ]   # greater or equal
[ $a -le $b ]   # less or equal

# 字符串比较
[ "$str1" = "$str2" ]   # equal
[ "$str1" != "$str2" ]  # not equal
[ -z "$str" ]           # 长度为0
[ -n "$str" ]           # 长度不为0
[ "$str" ]              # 非空

# 文件测试
[ -e file ]     # 文件存在
[ -f file ]     # 普通文件
[ -d file ]     # 目录
[ -r file ]     # 可读
[ -w file ]     # 可写
[ -x file ]     # 可执行
[ -s file ]     # 文件大小>0
[ -L file ]     # 符号链接
[ file1 -nt file2 ]  # file1 比 file2 新
[ file1 -ot file2 ]  # file1 比 file2 旧
```

### 逻辑运算

```bash
# 与
[ $a -gt 0 -a $b -gt 0 ]
[[ $a -gt 0 && $b -gt 0 ]]

# 或
[ $a -gt 0 -o $b -gt 0 ]
[[ $a -gt 0 || $b -gt 0 ]]

# 非
[ ! $a -gt 0 ]
[[ ! $a -gt 0 ]]
```

## 流程控制

### 条件判断

```bash
# if 语句
if [ condition ]; then
  command
fi

# if-else
if [ condition ]; then
  command1
else
  command2
fi

# if-elif-else
if [ $a -gt 10 ]; then
  echo "big"
elif [ $a -gt 5 ]; then
  echo "medium"
else
  echo "small"
fi

# 常用条件判断
# 文件相关
if [ -f /path/to/file ]; then
  echo "File exists"
fi

# 目录相关
if [ -d /path/to/dir ]; then
  echo "Directory exists"
fi

# 字符串判断
if [ -z "$var" ]; then
  echo "Empty"
fi

# 多个条件
if [ $a -gt 0 ] && [ $b -gt 0 ]; then
  echo "Both positive"
fi
```

### case 语句

```bash
case $variable in
  value1)
    command1
    ;;
  value2)
    command2
    ;;
  value3|value4)    # 多个值
    command3
    ;;
  *)
    default_command
    ;;
esac

# 示例
case $1 in
  start)
    echo "Starting..."
    ;;
  stop)
    echo "Stopping..."
    ;;
  restart)
    echo "Restarting..."
    ;;
  *)
    echo "Usage: $0 {start|stop|restart}"
    exit 1
    ;;
esac
```

### 循环

#### for 循环

```bash
# 方式1: 列表
for i in 1 2 3 4 5; do
  echo $i
done

# 方式2: 序列
for i in {1..5}; do
  echo $i
done

# 方式3: 步进
for i in {0..10..2}; do
  echo $i   # 0 2 4 6 8 10
done

# 方式4: C 风格
for ((i=0; i<10; i++)); do
  echo $i
done

# 方式5: 遍历文件
for file in *.txt; do
  echo "Processing $file"
done

# 方式6: 遍历数组
for item in "${array[@]}"; do
  echo $item
done
```

#### while 循环

```bash
# 基本 while
while [ condition ]; do
  command
done

# 读取文件行
while read line; do
  echo "$line"
done < file.txt

# 读取文件字段
while IFS=: read -r user pass uid gid; do
  echo "User: $user, UID: $uid"
done < /etc/passwd

# 无限循环
while true; do
  command
done

# 或
while :; do
  command
done
```

#### until 循环

```bash
# 条件为 false 时循环，直到条件为 true
until [ condition ]; do
  command
done

# 示例
until [ $i -gt 10 ]; do
  echo $i
  ((i++))
done
```

#### 循环控制

```bash
# break - 跳出循环
for i in 1 2 3 4 5; do
  if [ $i -eq 3 ]; then
    break
  fi
  echo $i
done

# continue - 跳过本次循环
for i in 1 2 3 4 5; do
  if [ $i -eq 3 ]; then
    continue
  fi
  echo $i
done
```

## 函数

### 函数定义

```bash
# 方式1
function name {
  commands
  return value
}

# 方式2
name() {
  commands
  return value
}
```

### 函数参数

```bash
#!/bin/bash

# 定义函数
greet() {
  echo "Hello, $1!"
  echo "You are $2 years old"
}

# 调用函数
greet "Tom" 25

# 获取参数数量
count_args() {
  echo $#
}

# 获取所有参数
echo_all() {
  echo "$@"
  echo "$*"
}
```

### 函数返回值

```bash
# 返回值（状态码 0-255）
get_status() {
  return 0  # 成功
  return 1  # 失败
}

# 使用返回值
if get_status; then
  echo "Success"
fi

# 返回数据（通过 echo）
get_data() {
  echo "result1"
  echo "result2"
}

# 接收返回数据
result=$(get_data)
```

### 局部变量

```bash
example() {
  local var="I'm local"
  echo $var
}
```

### 递归函数

```bash
factorial() {
  if [ $1 -le 1 ]; then
    echo 1
  else
    local temp=$(($1 - 1))
    local result=$(factorial $temp)
    echo $(($1 * $result))
  fi
}

factorial 5  # 120
```

## 文本处理实战

### 案例1：日志分析脚本

```bash
#!/bin/bash
# 分析 Web 访问日志

LOG_FILE=${1:-/var/log/nginx/access.log}

echo "========== 日志分析报告 =========="
echo "文件: $LOG_FILE"
echo ""

# 总请求数
total=$(wc -l < "$LOG_FILE")
echo "总请求数: $total"

# 独立 IP 数
ips=$(awk '{print $1}' "$LOG_FILE" | sort -u | wc -l)
echo "独立 IP 数: $ips"

# 各状态码统计
echo ""
echo "状态码统计:"
awk '{print $9}' "$LOG_FILE" | sort | uniq -c | sort -rn

# 访问最频繁的 IP
echo ""
echo "访问最频繁的 Top 10 IP:"
awk '{print $1}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -10

# 访问最频繁的 URL
echo ""
echo "访问最频繁的 Top 10 URL:"
awk '{print $7}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -10

# 按小时统计访问量
echo ""
echo "按小时统计访问量:"
awk '{print $4}' "$LOG_FILE" | cut -d: -f1 | sort | uniq -c | sort -rn
```

### 案例2：批量重命名文件

```bash
#!/bin/bash
# 批量重命名文件

# 将 *.txt 重命名为 *.txt.bak
for file in *.txt; do
  if [ -f "$file" ]; then
    mv "$file" "$file.bak"
    echo "Renamed: $file -> $file.bak"
  fi
done

# 去除文件名中的空格
for file in *\ *; do
  if [ -f "$file" ]; then
    newname=$(echo "$file" | tr ' ' '_')
    mv "$file" "$newname"
  fi
done

# 批量添加前缀
PREFIX="backup_"
for file in *.txt; do
  [ -f "$file" ] && mv "$file" "$PREFIX$file"
done

# 批量修改扩展名
for file in *.TXT; do
  [ -f "$file" ] && mv "$file" "${file%.TXT}.txt"
done
```

### 案例3：数据库备份脚本

```bash
#!/bin/bash
# MySQL 数据库备份脚本

# 配置
DB_HOST="localhost"
DB_USER="backup"
DB_PASS="password"
DB_NAME="mydb"
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 执行备份
echo "Starting backup of $DB_NAME..."
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

# 检查备份是否成功
if [ $? -eq 0 ]; then
  echo "Backup completed successfully!"
  
  # 删除 7 天前的备份
  find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
  echo "Old backups cleaned up."
else
  echo "Backup failed!"
  exit 1
fi
```

### 案例4：系统监控脚本

```bash
#!/bin/bash
# 系统监控脚本

# CPU 使用率
cpu_usage() {
  top -bn1 | grep "Cpu(s)" | awk '{print "CPU: " 100 - $8 "%"}'
}

# 内存使用情况
mem_usage() {
  free -h | awk '/Mem:/ {print "Memory: " $3 "/" $2}'
}

# 磁盘使用情况
disk_usage() {
  df -h | awk '/\/$/ {print "Disk: " $3 "/" $2 " (" $5 " used)"}'
}

# 负载平均值
load_avg() {
  uptime | awk -F'load average:' '{print "Load:" $2}'
}

# 在线用户
online_users() {
  who | wc -l | awk '{print "Online users:" $1}'
}

# 进程数
process_count() {
  ps aux | wc -l | awk '{print "Total processes:" $1-1}'
}

# 输出监控信息
echo "========== 系统监控 =========="
echo "$(date)"
echo ""
cpu_usage
mem_usage
disk_usage
load_avg
online_users
process_count
```

### 案例5：自动部署脚本

```bash
#!/bin/bash
# 应用自动部署脚本

set -e  # 遇到错误立即退出

APP_DIR="/opt/myapp"
BACKUP_DIR="/opt/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "========== 开始部署 =========="
echo "时间: $(date)"
echo ""

# 停止服务
echo "[1/6] 停止服务..."
systemctl stop myapp || true

# 备份当前版本
if [ -d "$APP_DIR" ]; then
  echo "[2/6] 备份当前版本..."
  mv "$APP_DIR" "$BACKUP_DIR/myapp_$TIMESTAMP"
fi

# 创建目录
echo "[3/6] 创建应用目录..."
mkdir -p "$APP_DIR"

# 解压新版本
echo "[4/6] 解压新版本..."
unzip -q /tmp/myapp.zip -d "$APP_DIR"

# 设置权限
echo "[5/6] 设置权限..."
chown -R myuser:mygroup "$APP_DIR"
chmod +x "$APP_DIR/bin/myapp"

# 启动服务
echo "[6/6] 启动服务..."
systemctl start myapp

# 检查状态
if systemctl is-active --quiet myapp; then
  echo ""
  echo "========== 部署成功 =========="
else
  echo "部署失败！请检查服务状态"
  exit 1
fi
```

### 案例6：文本格式化工具

```bash
#!/bin/bash
# 文本格式化工具

# 去除行首空格
trim_left() {
  sed 's/^[ ]*//'
}

# 去除行尾空格
trim_right() {
  sed 's/[ ]*$//'
}

# 去除空行
remove_blank() {
  sed '/^$/d'
}

# 添加行号
add_line_numbers() {
  awk '{printf "%5d  %s\n", NR, $0}'
}

# 转为大写
to_upper() {
  tr 'a-z' 'A-Z'
}

# 转为小写
to_lower() {
  tr 'A-Z' 'a-z'
}

# Tab 转空格
tab_to_space() {
  expand -t 4
}

# 空格转 Tab
space_to_tab() {
  unexpand -t 4
}

# 根据参数执行相应操作
case "$1" in
  -l|--trim-left)
    trim_left
    ;;
  -r|--trim-right)
    trim_right
    ;;
  -b|--remove-blank)
    remove_blank
    ;;
  -n|--number)
    add_line_numbers
    ;;
  -u|--upper)
    to_upper
    ;;
  -d|--down)
    to_lower
    ;;
  -t|--tab2space)
    tab_to_space
    ;;
  *)
    echo "Usage: $0 {option}"
    echo "  -l, --trim-left     去除行首空格"
    echo "  -r, --trim-right    去除行尾空格"
    echo "  -b, --remove-blank  去除空行"
    echo "  -n, --number        添加行号"
    echo "  -u, --upper         转为大写"
    echo "  -d, --down          转为小写"
    echo "  -t, --tab2space     Tab 转空格"
    ;;
esac
```

## Shell 脚本调试

### 调试选项

```bash
# 语法检查
bash -n script.sh

# 详细输出
bash -x script.sh

# 调试函数
set -x   # 开启调试
set +x   # 关闭调试

# 调试模式
set -e   # 命令失败立即退出
set -u   # 使用未定义变量时报错
set -o pipefail  # 管道中任何一个命令失败就退出
```

### 常用调试技巧

```bash
# 在关键位置添加调试输出
DEBUG=1
[ "$DEBUG" = "1" ] && echo "Debug: variable = $var"

# 打印函数调用栈
debug() {
  echo "Called from: ${FUNCNAME[1]}"
}

# 时间统计
start_time=$(date +%s)
# ... 执行命令 ...
end_time=$(date +%s)
echo "Elapsed: $((end_time - start_time)) seconds"
```

## 常见问题与技巧

### 字符串处理技巧

```bash
# 字符串替换
str="hello world"
echo ${str/world/linux}   # hello linux

# 模式匹配删除
filename="/path/to/file.txt"
echo ${filename##*/}      # file.txt (删除最长匹配)
echo ${filename#*/}       # to/file.txt (删除最短匹配)

# 数组操作
arr=(one two three)
echo ${arr[@]:1:2}        # two three (切片)
arr+=(four)               # 追加元素
unset arr[0]              # 删除元素
```

### 文件操作技巧

```bash
# 读取文件到数组
mapfile -t lines < file.txt

# 逐行读取
while IFS= read -r line; do
  echo "$line"
done < file.txt

# 文件安全删除
shred -u file             # 多次覆写并删除
```

### 性能优化

```bash
# 使用内部命令
# 慢
for i in $(cat file); do
  echo $i
done

# 快
while read -r line; do
  echo "$line"
done < file

# 使用数组代替子进程
# 慢
result=$(echo "1 2 3 4 5" | tr ' ' '\n' | sort -n | tail -1)

# 快
arr=(1 2 3 4 5)
max=${arr[0]}
for i in "${arr[@]}"; do
  ((i > max)) && max=$i
done
echo $max
```

---

> 参考资料
>
> - 《Shell 从入门到精通》
> - GNU Coreutils 文档
> - AWK Language Programming
> - Sed - An Introduction and Tutorial

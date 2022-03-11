---
title: YAML学习笔记
date: 2018-04-29 15:28:40
tags: [Lang, YAML]
---


**本篇介绍 YAML 的语法，包括以下部分：**

- YAML 简介
- 规范
- 数据结构

  <!-- more -->

# YAML 简介

YAML 是一个类似 XML、JSON 的标记性语言。YAML 强调以数据为中心，并不是以标识语言为重点。因而 YAML 本身的定义比较简单，号称“一种人性化的数据格式语言”。实质上是一种通用的数据串行化格式，专门用于写配置文件。

**YAML 与 XML、JSON 的区别：** YAML 比 XML 和 JSON 都简单，易阅读，并且能表示出更加复杂的结构，运行效率也很高。

# 规范

- 大小写敏感
- 使用缩进表示层级关系
- 缩进时不能使用 Tab 键，只能用空格
- 缩进空格数不重要，只要相同层级左侧对齐即可（类似 Python）
- `#`表示注解

# 数据结构

- 对象：键值对的集合
- 数组：按次序排列的值，也称序列、列表
- 纯量：单个，不可再分的值

# 对象

通过冒号分隔键、值<br>
`person: zhangsan` <br>
也可通过行内表示法，写成行内对象<br>
`person: { name: zhangsan, age: 20 }`

# 数组

一组连词线开头的行，构成一个数组

```yaml
- zhangsan
- lisi
- wangwu
```

也可通过行内表示法 <br>
`person: [zhangsan, lisi, wangwu]` <br>

# 复合结构

对象和数组可以结合使用，形成复合结构。<br>

- 对象嵌套对象

```yaml
age:
  zhangsan: 20
  lisi: 21
  wangwu: 19
```

- 对象嵌套数组

```yaml
lang:
  - c
  - python
  - java
```

- 数组嵌套数组
  **数据结构的子成员是一个数组，则可以在该项下面缩进一个空格，yaml 语法会自动只空一格**

```yaml
-
  - c
  - java
  - python
还可这样表示
-- c
 - java
 - python
还可这样表示
- [c, java, python]
```

- 数组嵌套对象

```yaml
- id: 1
  name: zhangsan
- id: 2
  name: lisi
```

- 综合实例

```yaml
ports:
  - port: 80
      targetPort: 8082
  - port: 81
      targetPort: 8083
```

# 纯量

纯量的数据类型与 js 相同

- 字符串
- 布尔值 `true`和`false`
- 整数
- 浮点数
- Null `~`
- 时间：采用 ISO8601 标准 `time: 2018-04-29T17:30:08+08:00`
- 日期：采用 ISO8601 标准 `date: 2018-04-29`

```yaml
integer: 12345 # 整数标准形式
octal: 0o34 # 八进制表示，第二个是字母 o
hex: 0xFF # 十六进制表示
float: 1.23e+3 # 浮点数
fixed: 13.67 # 固定小数
minmin: -.inf # 表示负无穷
notNumber: .NaN # 无效数字
null: # 空值
boolean: [true, false] # 布尔值
```

YAML 允许使用两个感叹号，强制转换数据类型

```yaml
下面是可转换的类型（内置类型）
 !!int               # 整数类型
 !!float             # 浮点类型
 !!bool              # 布尔类型
 !!str               # 字符串类型
 !!binary            # 也是字符串类型
 !!timestamp         # 日期时间类型
 !!null              # 空值
 !!set               # 集合
 !!omap, !!pairs     # 键值列表或对象列表
 !!seq               # 序列，也是列表
 !!map               # 键值表
```

```yaml
例：
obj1: !!str 123
obj2: !!str true
omap: !!omap
 - Mark: 65
 - Sammy: 63
 - Key: 58
set: !!set           # ? 表示键为数组，在这里数组为 null
 ? Mark
 ? Sammy
 ? Key
```

#### 字符串

**字符串默认不使用引号表示**

```yaml
str: hello
```

如果字符串之中包含空格或特殊字符，需要放在引号之中。

```yaml
str: "hello,world"
```

单引号和双引号都可以使用，双引号不会对特殊字符转义。

```yaml
str1: "hello\n" #会将\n识别为换行
str2: 'hello\n' #会认为字符串就是hello\n
```

字符串可以写成多行，从第二行开始，必须有一个单空格缩进。换行符会被转为空格。

```yaml
str: 这是
  多行
  字符串
```

多行字符串可以使用`|`保留换行符，也可以使用`>`折叠换行。

```yaml
str1: |
  abc
  def  # "会保存\n"
str2: >
  abd
  def  # "不会保存\n"
```

`+`表示保留文字块末尾的换行，`-`表示删除字符串末尾的换行。

```yaml
s1: |
  abc
# 即表示s1: 'abc\\n'
s2: |+
  abc

# 即表示s2: 'abc\\n\\n'
s3: |-
  abc

# 即表示s3: 'abc'
```

字符串之中可以插入 HTML 标记。

```yaml
page: |
  <div>abcabc</div>
```

# 引用

锚点`&`和别名`*`，可以用来引用。<br>
`&`用来建立锚点（defaults），`<<`表示合并到当前数据，`*`用来引用锚点。

```yaml
student: &stu # &用于起别名
  zhangsan: 1
  lisi: 2
class1:
  <<: *stu
等同于
class1:
  zhangsan: 1
  lisi: 2
```

# 文件

YAML 文件可以由一或多个文档组成（也即相对独立的组织结构组成），文档间使用`---`在每文档开始作为分隔符。同时，文档也可以使用`...`作为结束符（可选，但标明后会有利于网络上传输）。

```yaml
---
文件1
---
文件2
```

<br><br><br>

> 参考文章：
> YAML 语言教程-阮一峰 http://www.ruanyifeng.com/blog/2016/07/yaml.html
> YAML 书写规范 http://www.cnblogs.com/wdliu/p/7080305.html
> YAML 最最基础语法 https://blog.csdn.net/vincent_hbl/article/details/75411243
> yaml1.2 官方文档 http://yaml.org/spec/1.2/spec.html

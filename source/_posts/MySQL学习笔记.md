---
title: MySQL完全笔记
date: 2018-04-30 09:10:31
tags: [数据库,MySQL]
categories: [应用运维]
---

**基于MySQL5.7**

本篇包含以下知识点：
* [MySQL体系结构](#MySQL体系)
* [存储引擎](#存储引擎)
* [数据类型](#数据类型)
  * [运算符](#运算符)
  * [函数](#函数)
* [表操作](#表操作)
* [数据操作](#数据操作)

<!-- more -->

* [索引](#索引)
* [视图](#视图)
* [触发器](#触发器)
* [存储过程与函数](#存储过程与函数)
* [事务](#事务)
* [安全](#安全)
* [日志](#日志)
* [维护](#维护)

{% asset_img mysql.jpg mysql %}

# MySQL体系
MySQL采用C/S体系，因此在使用时，是运行两个程序：
* mysqld：MySQL服务器程序，运行在数据库服务器上，负责监听并处理请求
* mysql-client：运行在客户端上，负责连接到数据库服务器并发出指令。

# 存储引擎
MySQL具有**可替换存储引擎构架**的特征。MySQL功能分为两部分：
* 外层部分：完成与客户端的连接，调查SQL语句的内容
* 内层部分：即存储引擎部分，负责接收外层的数据操作指令，完成实际的数据输入输出及文件操作。
MySQL支持多种存储引擎，可通过`show engines;`查看mysql支持的存储引擎，MySQL共支持9种存储引擎，其中最主要的两个引擎为MyISAM和InnoDB，默认引擎为InnoDB。

MyISAM与InnoDB的区别：

| 特性 | MyISAM | InnoDB |
| - | - | - |
|存储限制|有|64TB|
|事务安全|不支持|支持|
|锁机制|表锁|行锁|
|B树索引|支持|支持|
|哈希索引|不支持|不支持|
|全文索引|支持|不支持|
|集群索引|不支持|支持|
|数据缓存||支持|
|索引缓存|支持|支持|
|数据可压缩|支持|不支持|
|空间使用|低|高|
|内存使用|低|高|
|批量插入速度|高|低|
|外键|不支持|支持|

* InnoDB只有表结构，数据全部存储在ibdata1文件中，算法复杂。
* MyISAM将表，数据，索引全部单独存储。
* MyISAM适合对事务完整型无要求并以访问为主的应用，访问速度快。
* InnoDB适合频繁更新、删除操作，对事务要求高，需要实现并发控制的应用。

可通过`show create table 表名`查询表中使用的存储引擎。
也可通过`alter table 表名 engine=引擎`更改表的存储引擎。

# 数据类型
* 整数
  * tinyint：1字节
  * smallint：2字节
  * mediumint：3字节
  * int：4字节
  * bigint：8字节

  整数类型都分为有符号与无符号。默认有符号，可在类型前加上unsigned创建无符号类型。
  插入数据只能插入整数，若字段设置了是整数类型，就算插入浮点数也会转换为整数。
  零填充：zerofill，若数据位数不满设置位数值，则前面补充0，且若设置零填充，数据类型自动变为无符号类型。零填充意义：保持数据格式

```
mysql> desc my_int;
+-------------+--------------+------+-----+---------+-------+
| Field       | Type         | Null | Key | Default | Extra |
+-------------+--------------+------+-----+---------+-------+
| tinyint_1   | tinyint(4)   | YES  |     | NULL    |       |
| smallint_1  | smallint(6)  | YES  |     | NULL    |       |
| mediumint_1 | mediumint(9) | YES  |     | NULL    |       |
| int_1       | int(11)      | YES  |     | NULL    |       |
| bigint_1    | bigint(20)   | YES  |     | NULL    |       |
+-------------+--------------+------+-----+---------+-------+
# 括号中的数值为显示位数（宽度），可修改，不会影响数据。
mysql> alter table my_int modify int_1 int zerofill;
# zerofill 会在显示宽度不满时用0填满
mysql> select int_1 from my_int;
+------------+
| int_1      |
+------------+
| 0000000004 |
+------------+
```
* 浮点数
  * float：4字节，也可设置为float(M,D)
  * double：8字节
  * decimal(M,D)：定点数，M+2字节，取值范围与double一致，但有效范围由M与D决定，M为一共的位数，D为小数部分的位数。
  小数部分超出没问题，会自动四舍五入，但整数部分不能超出。
```
create table my_float(
	float_1 float(5,2),
	double_1 double(5,2),
	decimal_1 decimal(5,2)
);
mysql> insert into my_float values(1.115,1.115,1.115);
# 整数部分不能超出规定长度，但小数部分可以，小数的超出部分会四舍五入。
mysql> select * from my_float;
+---------+----------+-----------+
| float_1 | double_1 | decimal_1 |
+---------+----------+-----------+
|    1.12 |     1.12 |      1.12 |
+---------+----------+-----------+
```
* 字符串
  * char(length)：定长字符串，定义时指定长度，最大255字节。
  * varchar(length)：变长字符串，最大长度65536个字节，一般会自动多加一个字节。实际存储从第二个字节开始，接着要用1到2个字节表示实际长度（长度超过255时需要2个字节），因此最大长度不能超过65535。
    varchar 会保留字符串末尾的空格，而 char 会删除。
  * text：存储文字的文本字符串
  * blob：存储二进制的文本字符串
  若数据量非常大（超过255字节），可选用文本字符串。
  * 枚举字符串：enum()，用于规定数据格式，节省空间（枚举实际存储的是数值）。
  * 集合字符串：set()，集合存储的也是数值，且可以多选

|存储数据|char(4)|varchar(4)|char占用字节|varchar占用字节|
|-|-|-|-|-|
|abcd|abcd|abcd|4x3|4x3+1|
|abcde|错误|错误|超出长度|超出长度|

如何选择定长或变长字符串？
	* 定长字符串：磁盘空间浪费，但效率高，若数据确定长度一样，就选定长（如身份证，电话号）
	* 变长字符串：磁盘空间节省，但效率低，若数据长度不确定，就选变长（如住址，姓名）

枚举字符串举例
```
mysql> create table my_enum(sex enum('m','f'));
mysql> insert into my_enum values('m');
Query OK, 1 row affected (0.01 sec)
# 字段赋值必须填枚举中的字符串
mysql> insert into my_enum values('a');
ERROR 1265 (01000): Data truncated for column 'sex' at row 1

```
在MySQL中，系统会自动转换数据类型。枚举中字符串是数值的证明如下：
```
mysql> select sex+0,sex from my_enum \G
*************************** 1. row ***************************
sex+0: 1
  sex: m
*************************** 2. row ***************************
sex+0: 2
  sex: f
# 由此可知，枚举中字符串的数值是按照枚举顺序从1开始。
# 于是也可以通过数值插入
mysql> insert into my_enum values(1),(2);
Query OK, 2 rows affected (0.00 sec)
```

> 枚举原理：枚举在进行数据规范（定义）的时候，系统会自动建立一个数字与枚举元素的对应关系（存放在日志），然后在进行数据插入时，系统自动将字符转换成对应的数字存储，在进行数据提取时，系统自动将数值转换成对应字符串显示。

集合字符串举例：
```
mysql> create table my_set(lang set('c','c++','python','java'));
# 与枚举类似，集合也可通过数值进行赋值
```
* 日期和时间
  * date：4字节，1001年到9999年的日期
  * datetime：8字节，1001年到9999年的日期，并能保存时间
  * timestamp：4字节，1970年1月1日到现在的秒数，最大到2038年
  * time：3字节
  * year：1字节，最小值1901，最大值2155
MySQL提供函数`from_unixtime()`将unix时间戳转换为时间，`unix_timestamp()`将日期转换为unix时间戳。
默认情况下，如果插入时没有指定 TIMESTAMP 列的值，会将这个值设置为当前时间。应该尽量使用 TIMESTAMP，因为它比 DATETIME 空间效率更高。
datetime与时区无关，timestamp与时区有关。

记录长度：
任何一条记录的长度最长不能超过65535个字节，一条记录的最长字节数为65534，但可以人为填满。
MySQL中text文本字符串不占用记录长度：额外存储，但text字符串也属于记录的一部分，所以一定要占据记录中的部分长度（10字节，保存数据的地址与长度）

## 运算符
算数运算符：加、减、乘、除、模
```
mysql> select 6+4 加,
     6-2 减,
     6*4 乘,
     6/4 除,
     6 DIV 4 除,
     6%4 模,
     6 MOD 4 模;
+----+----+----+--------+------+------+------+
| 加 | 减 | 乘 | 除     | 除   | 模   | 模   |
+----+----+----+--------+------+------+------+
| 10 |  4 | 24 | 1.5000 |    1 |    2 |    2 |
+----+----+----+--------+------+------+------+
当除数为0时，结果为NULL
```
比较运算符：大于、小于、等于、不等于、IS NULL、BETWEEN AND、IN、LIKE、REGEXP

|比较运算符|说明|
|---|---|
|>或>=|大于或大于等于|
|<或<=|小于或小于等于|
|=或<=>|等于|
|!=或<>|不等于|
|BETWEEN AND|在指定范围|
|IS NULL|为空|
|IN|在指定集合|
|LIKE|通配符匹配|
|REGEXP|正则表达式匹配|

常用正则表达式

|模式字符|说明|案例|
|--|--|--|
|^|匹配字符串开始|'^a'|
|$|匹配字符串结束|'g$'|
|.|匹配字符串中任意一个字符|'a.c'|
|[字符集合]|匹配字符集合内的任意一个字符|'[abc]'|
|[\^字符集合]|匹配字符集合外的任意一个字符|'^abc'|
|str1｜str2|匹配符合的字符串|'abc｜cde'|
|\*|匹配字符，包含0个和1个|'a\*'|
|\+|匹配字符，包含1个|'a\+'|
|字符串{N}|字符串出现N次|'abc{2}'|
|字符串(M,N)|字符串至少出现M次，最多N次|'abc(2,3)'|

逻辑运算符
`AND`(`&&`)：与，`OR`(`||`)：或，`NOT`(`!`)：非，`XOR`：异或

位运算符
`&`：按位与，`|`：按位或，`~`：按位取反，`^`：按位异或，`<<`：按位左移，`>>`：按位右移
可使用BIN()函数显示二进制。

## 函数
SQL语句的移植性较强，而函数的移植性不强，因为各种数据库软件都有自己特有的函数。
Mysql函数分为：
* [字符串函数](#字符串函数)
* [数值函数](#数值函数)
* [日期函数](#日期函数)
* [系统信息函数](#系统信息函数)

### 字符串函数

|函数|功能|
|--|--|
|concat(str1,str2...)|连接字符串|
|insert(str,x,y,instr)|用字符串str的x位置开始y个字符长的子串替换字符串instr|
|lower(str)|将str的所有字符换为小写|
|upper(str)|将str的所有字符换为大写|
|left(str,x)|返回str的最左边的x个字符|
|right(str,x)|返回str的最右边的x个字符|
|lpad(str,n,pad)|使用pad字符串对str最左边进行填充直到长度为n|
|rpad(str,n,pad)|使用pad字符串对str最右边进行填充直到长度为n|
|ltrim(str)|去掉str左边的空格|
|rtrim(str)|去掉str右边的空格|
|trim(str)|去除str行头和行尾的空格|
|repeat(str,x)|返回str重复x次的结果|
|replace(str,a,b)|使用字符串b替换str中所有字符串a|
|strcmp(str1,str2)|比较字符串|
|substring(str,x,y)|返回str中从x位置起y个长度的字符串|

### 数值函数

|函数|功能|
|--|--|
|abs(x)|返回x的绝对值|
|ceil(x)|返回大于x的最小整数值|
|floor(x)|返回小于x的最大整数值|
|mod(x)|返回x%y|
|rand()|返回0-1的随机数|
|rand(x)|返回0-1的随机数，x对应的随机数是固定的|
|round(x,y)|返回x的四舍五入后y位小数的值（y可选）|
|truncate(x,y)|返回x截断为y位小数的值|

### 日期和时间函数

|函数|功能|
|--|--|
|curdate()|获取当前日期|
|curtime()|获取当前时间|
|now()|获取当前日期和时间|
|unix_timestamp(date)|获取date的unix时间戳|
|from_unixtime(timestamp)|获取unix时间戳|
|week(date)|返回date为一年中的第几周|
|year(date)|返回date的年份|
|monthname(date)|返回date的月份|
|hour(time)|返回time的小时值|
|minute(time)|返回time的分钟值|

### 系统信息函数

|函数|功能|
|--|--|
|version()|返回版本号|
|database()|返回当前数据库名|
|user()|返回当前用户|
|last_insert_id()|返回最近生成的Auto_Increment值|

### 特殊功能函数
|password(str)|对str加密|
|format(x,n)|对x格式化，保留n位小数|
|inet_aton(ip)|将IP地址转换为数字|
|inet_ntoa(x)|将数字转换为IP地址|
|get_loct(name,time)|创建一个持续时间time的名为name的锁|
|release_loct(name)|对名字为name的锁解锁|
|benchmark(count,expr)|将表达式expr执行count次|
|convert(s USING cs)|将字符串s的字符集变为cs|
|convert(x,type)|将x转为type类型|

# 表操作
创建表
```
create table 表名(
	字段1 数据类型,
	字段2 数据类型,
	......
);
也可直接create table 数据库名.表名(); # 这样不需要先进入库，直接建表。
```
表创建后，数据库文件下会生成对应表的结构文件.frm（与存储引擎有关）。

查看创建语句
`show create table 表名;`
查看表结构
`desc/show 表名;`

```
mysql> desc user;

# field：字段名
# type：字段类型
# null：（列属性）是否允许为空，null不是数据类型
# key：索引：pri主键，uni唯一键
# defalut：（列属性）默认值
# extra：（列属性）扩充属性
```
更改表名
`rename table 表名 to 新表名;`
更改表属性
```
alter table 表名 表选项 参数

表选项:
add column 字段名 数据类型 [位置]; # 新增字段
modify 字段名 数据类型 [属性] [位置]; # 修改字段
change 旧字段 新字段 数据类型 [属性] [位置]; # 重命名字段
drop 字段名; # 删除字段
位置：first：第一个，after 字段：在字段后
```
删除表
`drop table 表名;` 若要删除多张表，用`,`分隔表名

表约束：保证数据的合法性
* 空属性：NULL（默认），NOT NULL（不为空）
	要做到数据不为空，空就没有意义，空数据无法参与运算，所以定义字段时就要设置not null，若字段未指定该选项，当字段为空时，MySQL会用NULL填充，而NULL会占用一个字节，当指定了not null后，该字段必须有值，确保数据准确性。
* 列描述comment：无实际含义，描述字段
* 默认值default：可在字段设置时添加default ，在插入字段时不赋初值就会使用默认值
* 主键primary key：一张表只有一个字段可以使用对应键，用来唯一的约束该字段里的数据，不能重复，一张表最多只有一个主键，主键默认不为空（not null）。
	增加主键：
```
	法一：在创建字段时就添加primary key 关键字
	create table user(
		id int primary key,
		name varchar(20)
	);
	法二：在创建表时，在所有字段后使用primary key(字段名) 创建主键，如有多个字段作为主键，可以是复合主键
	create table user(
		id int,
		name varchar(20),
		primary key(id,name)
	);
	mysql> desc user1;
	+-------+-------------+------+-----+---------+-------+
	| Field | Type        | Null | Key | Default | Extra |
	+-------+-------------+------+-----+---------+-------+
	| id    | int(11)     | NO   | PRI | NULL    |       |
	| name  | varchar(20) | NO   | PRI | NULL    |       |
	+-------+-------------+------+-----+---------+-------+
	法三：追加主键
	alter table 表名 add primary key(字段); 或
	alter table 表名 modify 字段名 类型 primary key;
	# 前提：字段对应数据是独立的（不重复）
```
	主键约束：主键字段数据不允许相同，若相同则数据操作失败
	主键删除：无法更新主键，只有删除了以后才能再添加
	`alter table 表名 drop primary key;`
	
	分类

		逻辑主键：字段无业务含义（如id），一般以此类字段做主键
		业务主键：字段存放业务数据

* 自增长auto-increment：若该字段未赋值或仅有默认值，会自动触发，会给字段值不断+1（当前字段中最大值），形成新字段，常与主键搭配。
	**注：** 字段做自增长的前提：本身是一个索引（key属性有值），字段值必须是整型数字。一张表最多只有一个字段自增长。
	修改自增长：修改的值必须比该字段当前最大值大(小的话不生效)
	`alter table 表 auto_increment = x;`
	查看自增长变量
	`show variables like 'auto_increment%';`
	```
	mysql> show variables like 'auto_increment%';
	+--------------------------+-------+
	| Variable_name            | Value |
	+--------------------------+-------+
	| auto_increment_increment | 1     |
	| auto_increment_offset    | 1     |
	+--------------------------+-------+
	increment为自增长步数
	offset为自增长起始值
	修改：set auto_increment_increment = x;
	# 修改是对整个数据库，且仅是会话级
	alter table 表 modify即可修改
	```
* 唯一键unique key：数据不能重复，允许为空，也可多个为空，空字段不参与唯一键比较。

# 数据操作
**数据插入**
```
insert into 表名 values(字段1,字段2,...),(字段1,字段2,...),...;	
# 插入数据（直接插数据，字段要一一对应）
insert into 表名 (字段1名,字段2名,...) values(字段1,字段2,字段3),...;	
# 可指定插入字段，就不用对齐了
```
若主键冲突，即主键对应的值已存在，插入就会失败。有以下两种解决方法。
法一：更新
`insert into 表名(字段(要包含主键)) values() on duplicate key update 字段 = 值;`
法二：替换
`replace into 表名(字段(包含主键)) values(); `

蠕虫复制：将已有的数据进行新增，数据成倍增加
	用法1：从已有表创建新表（仅仅复制表结构）
	`create table 表名 like 库名.表名;`
	例：`mysql> create table user_worm like user;`
	用法2：将查出的数据复制到一张表
	`insert into 表名(字段) select 字段 from 表名;`
	例：`mysql> insert into user_worm (id,name,sex,age) select id,name,sex,age from user;`
**蠕虫复制的意义：** 可以快速让表中数据膨胀到一定数量级以测试表的压力与效率

**数据更新**
`update 表名 set 字段 = 值 [where] [limit 限制更新数量（前几行）];`

**数据删除**
`delete from 表名 [where];`
**数据删除不会改变表的结构，如自增长不会归零，只能删除表后再重建**
`truncate 表名;` # 先删除该表后再创建该表

**数据查询**
```
select [选项] 字段[别名] from 表名 [where][group by][having][order by][limit];

选项：
	all/* ：保留所有结果，默认（尽量不要打印所有）
	distinct：去重
	别名： 字段名 as 别名
```

常用关键字：
* `where`：where子句用于过滤满足条件的数据。子句返回结果为0或1。
where是唯一一个直接从磁盘读取数据时就开始判断的条件（从读取到第一条数据时就进行判断，成立就保存在内存）。
where后的参数

|参数|说明|
|--|--|
|between...and...|介于某个范围之内（闭区间）|
|not between...and...|不在某个范围之内|
|in(项1,项2...)|在指定项内|
|not in(项1,项2...)|不在指定项内|
|like|搜索匹配，常与模式匹配符配合使用|
|not like|like的反义|
|is null|空值判断符|
|is not null|非空判断符|
|not/and/or|逻辑运算符，分别表示否、并且、或，用于多个逻辑连接|
|%|模式匹配符，表示任意字串|

> 优先级：NOT > AND > OR

* `group by`：根据某字段分组，用于按组统计数据
常用统计函数：
```
count()：统计分组后的记录数
max()：每组中最大值
min()：每组中最小值
avg()：求平均值
sum()：求和
```
可在`group by`后加上`asc`或`desc`，分别表示升序或降序。
若只是分类，并不会显示所有数据，仅仅是分组，列出有哪些组。

可以设置多个字段进行排序，会按照字段的书写顺序进行先后排序。
例如，`group by age,score`会先对age进行排序，然后对结果再进行score的排序。
函数`group_concat(字段名)`可对分组结果中的某个字段进行字符串的连接。

* `with rollup`：回溯统计，根据当前分组字段向上级分组汇报
多字段回溯：考虑第一层分组会有回溯，第二层要看第一层分组的组数，组数是多少就回溯几次

* `having`：进行条件判断
在where判断后，由于数据已进入内存，所以不能再用where判断了，要对where判断的结果再次判断，就要用having。having能做where做到几乎所有事情，而where不能做having能做的很多事情。

分组统计的结果只能having使用
```
mysql> select id,score,count(*),group_concat(name) 
       from user 
       group by score 
       having count(*)>=1;
+-------+-------+----------+--------------------+
| id    | score | count(*) | group_concat(name) |
+-------+-------+----------+--------------------+
| 10002 |    68 |        2 | mike,jessie        |
| 10001 |    78 |        3 | jack,kate,lisi     |
| 10006 |    86 |        2 | zhangsan,wangwu    |
| 10005 |    97 |        1 | jason              |
+-------+-------+----------+--------------------+
```

* `order by`：排序，依赖校对集，显示所有记录，认升序排序。
多字段排序：根据某个字段排序，然后对排序好的结果再按某字段排序

* `limit`：限制数量
```
用法1：limit 长度   限制记录数（排名前N个）
mysql> select * from user order by score desc limit 3;
+-------+----------+------+------+-------+
| id    | name     | sex  | age  | score |
+-------+----------+------+------+-------+
| 10005 | jason    | m    |   22 |    97 |
| 10008 | wangwu   | m    |   20 |    86 |
| 10006 | zhangsan | m    |   21 |    86 |
+-------+----------+------+------+-------+

用法2：limit 起始,长度      从某起始位置（最小为0）开始限制（实现分页）
mysql> select * from user order by score desc limit 4,8;
+-------+--------+------+------+-------+
| id    | name   | sex  | age  | score |
+-------+--------+------+------+-------+
| 10003 | kate   | f    |   19 |    78 |
| 10007 | lisi   | f    |   19 |    78 |
| 10002 | mike   | m    |   21 |    68 |
| 10004 | jessie | f    |   20 |    68 |
+-------+--------+------+------+-------+
```

## 多表查询
**关系分为：**
* 一对一：一张表的一条记录最多只能与另一张表的一条数据对应
* 一对多：一张表的一条记录可与另一张表的多条数据对应
* 多对多：两张表互相存在一对多关系

### 联合查询
也称“并”（UNOIN），多次查询（多条select），在记录上进行拼接。
每一条select获取的字段数必须一致，字段名可以不一致，但字段数一定一致。会自动删除重复的记录（所有字段和值全部一致的记录）。
```
select 语句1 union select 语句2
union选项：
	all       # 保留所有
	distinct  # 去重
```
**联合查询的意义：**
1. 查询同一张表，但需求不同  
2. 多表查询：多张表结构完全一样，保存数据类型也一致

> 在联合查询中，**order by不能直接使用，必须搭配limit限定最大数**

例：
```
mysql> (select id,name,score 
    from user 
    order by score) 
    union 
    (select id,name,score 
    from stu 
    order by score);
+-------+------------+-------+
| id    | name       | score |
+-------+------------+-------+
| 10001 | jack       |    78 |
| 10002 | mike       |    68 |
| 10003 | kate       |    78 |
| 10004 | jessie     |    68 |
| 10005 | jason      |    97 |
| 10006 | zhangsan   |    86 |

并没有排序，当加上limit 后即可实现排序
mysql> (select id,name,score 
    from user 
    order by score desc 
    limit 999) 
    union 
    (select id,name,score 
    from stu 
    order by score desc 
    limit 999);
是两张表分别进行排序，然后合并
```

### 连接查询
将多张表进行数据的拼接。
分类：内连接（Inner Join），外连接（Outer Join），交叉连接（Cross Join）。
连接查询的速度很慢，通常使用子查询。

#### 内连接
从左表中读取每一条记录与右表中所有记录匹配，只保留匹配的数据
```
语法：
select 字段 
	from 左表 
	inner join 右表 
	on 左表.字段 = 右表.字段;
```
> 若这两张表要查询的字段唯一，就不需要加表名。
字段别名及表别名的使用：查询数据时，不同表有同名字段，可使用别名。

**若内连接不指定on  ，效果会和交叉连接一样。可用where代替on（但where没on效率高）**

内连接根据不同的实现作用又分为：
* 自然连接：natural join，仅进行匹配以及去重。不能指定执行过程中的匹配条件。
* 等值连接：用`=`匹配字段值相等的记录
* 不等连接：用`!=`匹配字段值不相等的记录

**注：内连接和外连接都可以模拟自然连接，只要在连接后面加using(字段名)，就可使用同名字段作为连接条件，自动合并**
```
select * from stu join user using(id,name,score);
```

#### 外连接
从主表中读取每一条记录与另一张表中所有记录匹配，会保留所有记录
以一张表为主，称为主表，根据主表的位置，外连接又分为左连接和右连接。
* 左连接left join：以左表为主表
* 右连接right join：以右表为主表
* 全外连接full outer join：除了匹配的记录，还包括不匹配的记录
结果记录数至少为主表的总记录数，副表的为匹配的记录会显示为null
显示仍为左连接在表的靠左部分，右连接在表的靠右部分
```
语法：
左连接
select 字段 from 左表  
    left|right join 右表
    on 左表.字段 = 右表.字段;
```

### 子查询
虽然可通过连接查询实现多表查询，但性能很慢，因此推荐使用子查询进行多表查询。

**子查询分类：**
* 按位置分类：子查询在外部查询中出现的位置
  * from子查询：子查询在from之后
  * where子查询：在where中
  * exist子查询：在exists中
* 按结果分类：根据子查询得到的结果查询
  * 标量子查询：子查询得到的结果是一行一列
  * 列子查询：结果是一列多行
  * 行子查询：结果是多列一行（也可以多行多列）
  * 表子查询：子查询得到的结果是多行多列（出现在from后）

**标量子查询**
```
mysql> select * from stu_info where id = (select id from stu where id = 20001);
+-------+------------+------------+
| id    | birthday   | birthplace |
+-------+------------+------------+
| 20001 | 1998-07-03 | 河南       |
+-------+------------+------------+
```
**列子查询**
```
关键字IN的子查询
mysql> select * from stu_info 
    where birthplace 
    in (select birthplace 
    from stu_info 
    where birthplace = '江苏');
+-------+------------+------------+
| id    | birthday   | birthplace |
+-------+------------+------------+
| 20003 | 1998-10-03 | 江苏       |
| 20005 | 1998-10-02 | 江苏       |
| 20007 | 1997-11-24 | 江苏       |
+-------+------------+------------+

关键字ANY（或SOME）的子查询
    三种匹配规则：
    1. = ANY ，与关键字IN作用相同
    2. > ANY（或>=） ，比子查询中记录的最小值大的即可
    3. < ANY（或<=） ，比子查询中记录的最大值小的即可

mysql> select * from stu 
    where score >= ANY (
        select score 
        from stu 
        where age = 19);
+-------+----------+------+------+-------+
| id    | name     | sex  | age  | score |
+-------+----------+------+------+-------+
| 20001 | chenning | f    |   20 |    98 |
| 20004 | yunlu    | f    |   19 |    93 |
| 20007 | chenliu  | m    |   20 |    94 |
+-------+----------+------+------+-------+

关键字ALL的子查询
    两种匹配规则：
    1. > ALL ，比子查询中记录的最大值还要大
    2. < ALL ，比子查询中记录的最小值还要小

mysql> select * from stu 
    where score > ALL (
        select score 
        from stu where age = 19); 
+-------+----------+------+------+-------+
| id    | name     | sex  | age  | score |
+-------+----------+------+------+-------+
| 20001 | chenning | f    |   20 |    98 |
| 20007 | chenliu  | m    |   20 |    94 |
+-------+----------+------+------+-------+

关键字EXISTS的子查询
用于判断是否满足（跨表），接在where后，exists返回值只有0和1
    两种匹配：
    1. EXISTS，存在
    2. NOT EXISTS，不存在

mysql> select * from stu where not exists(select * from stu_info where birthplace = '河南');
解释：只要不存在河南的学生，就将所有学生信息打印出。EXISTS语句仅仅是判断where中的条件，并不会进行select的输出控制。
```

**行子查询**
```
mysql> select * from stu 
    where (age,score) = (
    	select age,score 
    	from stu where id = 20001);
+-------+----------+------+------+-------+
| id    | name     | sex  | age  | score |
+-------+----------+------+------+-------+
| 20001 | chenning | f    |   20 |    98 |
+-------+----------+------+------+-------+
```

# 索引
系统通过算法将已有的数据单独建立一个文件，文件能实现快速查找匹配数据
**作用：**1.提高查询数据效率 2.约束数据的有效性
**增加索引的前提条件：**因为索引本身会产生文件（较大），所以若某个数据经常使用时就可使用索引。

根据存储类型，可将索引分为：B树索引（默认索引）和哈希索引。
InnoDB和MyISAM引擎都支持B树索引，Memory引擎支持哈希索引

Mysql支持六种索引：
* 普通索引 index
* 唯一索引 unique
* 全文索引 fulltext index
* 单列索引
* 多列索引
* 空间索引

以下情况时适合创建索引：
1. 经常被查询的字段，即where子句出现的字段
2. 在分组的字段，即group by子句出现的字段
3. 存在依赖关系的子表和父表间的联合查询，即主键和外键字段
4. 设置唯一完整性约束的字段

不适合创建索引的情况：
1. 查询中很少被使用的字段
2. 拥有许多重复值的字段

## 普通索引
在创建索引时，不附加任何限制条件，可创建在任何数据类型上

```
1. 创建表时创建普通索引
create table 表名(
    字段 类型,
    index|key 索引名(字段1(长度) {ASC|DESC}));

2. 在已存在的表上创建普通索引
create index 索引名
    on 表名 (字段(长度) {ASC|DESC});

3. 修改表创建索引
alter table 表名
    add index|key 索引名(字段(长度) {ASC|DESC});
```
用INDEX或KEY参数都可创建索引。索引名与字段关联，可设置索引长度（因为不同存储引擎定义了表的最大索引数和最大索引长度），还可设置升降序。

> Mysql支持的存储引擎对每个表支持至少16个索引，总索引长度至少为256字节。


## 唯一索引
创建索引时，限制索引的值必须唯一。根据创建索引的方式分为：自动索引和手动索引。
自动索引：在数据库表中设置完整性约束时，该表会被系统自动创建索引。
当设置表中的某个字段设置主键或唯一键完整性约束时，系统会自动关联该字段的唯一索引。
```
1. 在创建表时创建唯一索引
create table 表名(
    字段 类型,
    unique index|key 索引名(字段(长度) {ASC|DESC});

2. 在已存在的表上创建唯一索引
create unique index 索引名
    on 表名(字段(长度) {ASC|DESC});

3. 修改表创建索引
alter table 表名
    add unique index|key 索引名(字段(长度) {ASC|DESC});
```

## 全文索引
针对文章内部的关键字进行索引，表引擎必须为MyISAM。
主要用于关联数据类型为char、varchar、text的字段，以便能够更加快速地查询数据量较大的字符串类型的字段。
默认情况全文索引搜索不区分大小写，若全文索引所关联的字段为二进制类型，则以区分大小写搜索。

**注：不要在导入数据时使用fulltext，应该在导入后使用**
```
1. 创建表时创建全文索引
create table 表名(
    字段 属性,
    fulltext index|key 索引名(字段(长度) {ASC|DESC}))engine=MYISAM;

2. 在已存在的表上创建全文索引
create fulltext index 索引名
    on 表名(字段(长度) {ASC|DESC});

3. 修改表创建索引
alter table 表名
    add fulltext index|key 索引名(字段(长度) {ASC|DESC});
```
全文索引操作符：

|操作符|说明|
|--|--|
|+|包含|
|-|排除|
|<|包含且增加等级|
|>|包含且减少等级|
|( )|表达式|
|\*|词尾通配符|
|" "|字符串|

## 多列索引
在创建索引时所关联的字段不是一个字段，而是多个字段。只有查询条件使用了关联字段的第一个字段，多列字段才会被使用。
```
1. 创建表时创建多列索引
create table 表名(
    字段 类型,
    index|key 索引名(
        字段1(长度) {ASC|DESC},
        ...
        字段n(长度) {ASC|DESC});

2. 在已存在的表上创建多列索引
create index 索引名
    on 表名 (
        字段1(长度) {ASC|DESC},
        ...
        字段n(长度) {ASC|DESC});

3. 修改表创建索引
alter table 表名
    add index|key 索引名(
        字段1(长度) {ASC|DESC},
        ...
        字段n(长度) {ASC|DESC});
```

# 视图
本质是一种虚拟表，内容与真实表相似，但并不在数据库中以存储的数据值形式存在，数据来自自定义视图的查询所引用基本表，并在具体引用视图时动态生成。

创建视图：`create view 视图名 as select语句;`
**注：有多张基表时，要保证字段名不同，可用别名区分**
修改视图：
```
1. 使用ALTER语句修改视图
alter view 视图名 
    as select语句;

2. 使用CREATE OR REPLACE语句修改视图
create or replace view 视图名
    as select 语句;
这个方式修改视图会在视图存在的情况下直接修改，而若不存在就创建视图。
```
删除视图：`drop view 视图名;`

**可以向单表中插数据，但不能向多表插数据，且插入数据只能插视图中有的字段**

```
查看视图
show tables;

查看视图详细信息
show table status (from 数据库);

查看视图定义信息
show create view 视图名;

查看视图设计信息
desc 视图名;
```

# 触发器
触发器的执行是由事件来触发、激活从而实现执行。为某张表绑定一段代码，当对表操作时，就会触发代码执行。
触发器由三部分组成：
* 事件类型：增删改--insert、delete、update
* 触发时间：before、after
* 触发对象：表中记录
```
创建触发器：
create trigger 触发器名
    before|after 触发事件
    on 表名 for each row 
    触发后动作;
# for each row 表示任何一条记录上的操作满足触发事件
# 后面跟上的是激活触发器后执行的语句

创建包含多条执行语句的触发器：
create trigger 触发器名
    before|after 触发事件
    on 表名 for each row
    begin
        触发后动作
    end
# 在BEGIN和END间因为有多条语句需要使用分号隔开
# 而在mysql中默认分号为结束，因此需要在创建触发器前将结束符重新设置，并在创建完成后再将触发器设置回分号。
delimiter 结束符

删除触发器
drop trigger 触发器名;

查看触发器
show triggers;

mysql> show triggers\G
*************************** 1. row ***************************
             Trigger: my_trigger1        # 触发器名
               Event: INSERT             # 触发事件
               Table: stu                # 操作表
           Statement: begin              # 激活触发器后的动作
insert into stu_journal values('insert',now());
end
              Timing: AFTER              # 触发器执行的时间
             Created: 2018-07-08 14:10:54.01
            sql_mode: STRICT_TRANS_TABLES,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
             Definer: root@localhost
character_set_client: gbk
collation_connection: gbk_chinese_ci
  Database Collation: utf8_general_ci

查看系统表triggers中所有记录
select * from information_schema.triggers\G

mysql> select * from information_schema.triggers 
    where trigger_name='my_trigger1'\G

*************************** 1. row ***************************
           TRIGGER_CATALOG: def
            TRIGGER_SCHEMA: test
              TRIGGER_NAME: my_trigger1
        EVENT_MANIPULATION: INSERT
      EVENT_OBJECT_CATALOG: def
       EVENT_OBJECT_SCHEMA: test
        EVENT_OBJECT_TABLE: stu
              ACTION_ORDER: 1
          ACTION_CONDITION: NULL
          ACTION_STATEMENT: begin
insert into stu_journal values('insert',now());
end
        ACTION_ORIENTATION: ROW
             ACTION_TIMING: AFTER
ACTION_REFERENCE_OLD_TABLE: NULL
ACTION_REFERENCE_NEW_TABLE: NULL
  ACTION_REFERENCE_OLD_ROW: OLD
  ACTION_REFERENCE_NEW_ROW: NEW
                   CREATED: 2018-07-08 14:10:54.01
                  SQL_MODE: STRICT_TRANS_TABLES,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
                   DEFINER: root@localhost
      CHARACTER_SET_CLIENT: gbk
      COLLATION_CONNECTION: gbk_chinese_ci
        DATABASE_COLLATION: utf8_general_ci
```

# 存储过程与函数
一个完整的操作会包含 多条SQL语句，在执行过程中需要根据前面的SQL语句的执行结果有选择的执行后面的SQL语句。
存储过程与函数可理解为一条或多条SQL语句的集合，且也是事先经过编译并存储在数据库中的一段SQL语句集合，是一种没有返回值的函数。

**存储过程与函数的优点：**
* 允许表春组件式编程，提高了SQL语句的重用性、共享性、可移植性
* 实现较快执行速度，减少网络流量
* 可被作为一种安全机制

缺点：
* 编写复杂
* 需要创建数据库对象的权限

存储过程和函数的区别：
* 函数必须有返回值，存储过程没有

## 存储过程
### 创建存储过程
```
delimiter 结束符
create procedure 过程名(procedure_parameter参数)
    characteristic特性
    begin
        过程体
    end 结束符
delimiter ;
与触发器类似，同样需要先用delimiter修改结束符
```
其中procedure_parameter参数的格式如下
`输入/输出类型 参数名 参数类型`

输入输出类型有三种
* IN：输入类型，数据只从外部传入内部，可是数值也可是变量。存储过程可能会修改这个值，但是对于调用者来说，在存储过程返回结果时，所做的修改是不可见的。
* OUT：输出类型，只允许过程使用内部数据，外部传入内部只能是变量。其初始值为NULL，当存储过程返回时，这个值对调用者来说是可见的。
* INOUT：输入输出类型，外部可在内部使用，内部修改也可在外部使用，只能传变量，存储过程可能会修改这个值，当存储过程返回的时候，所做的修改对调用者来说是可见的。

参数类型可为Mysql支持的任何类型

characteristic特性的可选参数
```
[NOT] DETERMINSTIC：存储过程的执行结果是否确定
# DETERMINSTIC表示确认，加NOT则为不确认

{CONTAINS SQL|NO SQL|READS SQL DATA|MODIFIES SQL DATA}：表示使用SQL语句的限制
# CONTAINS SQL：表示可包含SQL，但不包含读或写数据的语句
# NO SQL：表示不包含SQL语句
# READS SQL DATA：表示包含读数据语句
# MODIFIES SQL DATA：表示包含写数据语句
# 默认为CONTAINS SQL

SQL SECURITY {DEFINER|INVOKER}：表示谁有权限执行
# DEFINER：表示只有定义者自己能执行
# INVOKER：表示调用者都可执行
# 默认为DEFINER

COMMENT 注释
```
示例：
```
delimiter $
create procedure proce_sel_stu(in stuid int)
comment '显示stu表指定学号的学生姓名和成绩'
bgein
    select name,score from stu where id=stuid;
end$$
delimiter ;
```
使用`call 存储过程名(参数);`对存储过程的调用。

**查看存储过程**
查看存储过程创建语句
`show create procedure 存储过程名\G`
查看存储过程状态信息
`show procedure status like '过程名'\G`

在`information_schema`库中存在一张存储所有存储过程和函数的表`routines`，因此此表也可查看存储过程和函数。

**修改存储过程**
```
alter procedure 过程名
  特性
```
存储过程不能修改过程体，只能删除后重新创。
**删除存储过程**
`drop procedure 存储过程名;`

## 函数
```
创建函数
delimiter 结束符
create function 函数名(参数)
  returns 返回数据类型
  特性
  begin
    函数体
  end结束符
delimiter ;

# 特性与存储过程一致
# 参数不用指定输入输出
```
**注：函数不存在“重写”，即函数名不能相同。并且推荐函数名的格式为func_XXX或function_XXX**
示例：
```
delimiter $$
create function func_sel_stu(stuid int)
  returns int
  begin
    return (select score from stu where id=stuid);
  end $$
delimiter ;
```
使用`select 函数(参数);`调用函数。

**查看函数**
查看函数创建函数
`show create function 函数名\G`
查看函数状态信息
`show function status like '函数名'\G`
**修改函数**
```
alter function 函数名
  特性
```
存储过程不能修改函数体，只能删除后重新创。
**删除函数**
`drop function 函数名;`

## 存储过程和函数表达式
* 变量
使用`declare 变量名（可多个，逗号分隔） 类型 [默认值]`声明变量
使用`set 变量名=XX（可以是值，也可以是赋值表达式，可多个，逗号分隔）;`赋值变量
也可以通过`select 字段 into 变量（可多个） from ...;`将查询结果赋给变量。
**注：将查询结果赋值给变量时，该查询语句的返回结果只能是单行**
* 条件
条件用于提高安全性。条件用于定义在处理过程中遇到问题时相应的处理步骤。
```
定义条件
declare 条件名 condition for condition_value状态值

状态值：
mysql_error_code     mysql错误值
SQLSTATE[VALUE] sqlstate_value   指定sql状态
不要使用mysql error code 0或以‘00’开头的code或一个SQLSTATE，因为这些指示成功而不是一个错误条件。

定义处理
delimiter 结束符
declare 处理类型 handler 
  for 状态值（可多个）
  begin
    处理
  end 结束符
delimiter ;

处理类型，即当handler被触发后需要执行什么动作
1. CONTINUE：继续执行
2. EXIT：终止程序
3. UNDO

状态值，handler触发的条件：
1. mysql error code或SQLSTATE value
2. 定义条件时的条件名
3. SQLWARNING：代表所有以01开头的SQLSTATE
4. NOT FOUND：代表所有以02开头的SQLSTATE
5. SQLEXCEPTION：代表除01和02开头的SQLSTATE
```

[详细SQLSTATE表](https://www.cnblogs.com/mqxs/p/6019992.html)

示例：
```
DECLARE no_such_table CONDITION FOR 1051;
DECLARE CONTINUE HANDLER FOR no_such_table
  BEGIN
    -- body of handler
  END;
```
* 游标
指定由select语句返回的行集合结果集，并遍历该结果集，可看做一种数据类型，类似指针或数组下标。
使用`declare 游标名 cursor for select语句;`声明游标
使用`open 游标名`打开游标。打开时，游标指向的是第一条数据的前一位。
使用`fetch 游标名 into 变量名（可多个，逗号分隔）`使用游标，遍历赋值给变量。
使用`close 游标名`关闭游标
* 流程控制
条件控制
```
if条件分支
if 条件 then
  执行语句
elseif
  执行语句
else
  执行语句
end if;

case条件分支
case 条件判断的变量
  when 条件 then 执行语句
  when 条件 then 执行语句
end case
```
**注：创建条件控制需要修改语句结束符**
循环控制
```
[标签:]where 条件 do
  执行语句
end where[标签];

循环控制：循环内部进行循环判断和控制
interate：迭代，类似continue
leave：离开，类似break

[标签:]where 条件 do
  执行语句
  leave | interate 循环名;
end where[标签];

[标签:]loop
  执行语句
end loop[标签]

[标签:]repeat 条件 do
  执行语句
end repeat[标签]

可使用标签，两个标签分别代表循环的开始和结束，但必须一致，也可省略
若要退出循环，使用leave 标签
```

# 事务
为保证数据库记录的更新从一个一致性状态变更为另一个一致性状态。
事务的四个特性：
* 原子性：事务中所有操作视为一个原子单元，对事务所进行的数据修改等操作只能是完全提交或完全回滚。
* 一致性：事务完成时，所有变更必须应用于事务的修改
* 隔离性：一个事务中的操作必须与其他事务所做的修改隔离，当前事务不会查看由另一个并发事务正在修改的数据（通过锁机制实现）
* 持久性：事务完成后，所做的所有修改对数据的影响是永久的

**InnoDB支持事务，而MyISAM不支持事务**
事务安全：保护连续操作同时满足。意义：保证数据操作的完整性
事务操作分为：自动事务（默认），手动事务

**手动事务：**
* 开启事务：告诉系统以下所有操作不直接写入数据表，先放到事务日志中。
`start transaction;`或`begin;`
此后的操作会保存在事务日志中，并不是真的对操作了数据表，所以若再通过另一个命令行用户登录查看时，该数据是未被操作的。
* 关闭事务：选择性的将日志文件中操作的结果同步到数据表
包含两个操作：
1. 提交事务`commit`：同步数据表，操作成功     
2. 回滚事务`rollback`：直接清空日志表，操作失败

**自动事务：**
通过autocommit变量控制
查看自动事务状态`show variables like 'autocommit';`默认开启
`set autocommit = off;`关闭事务自动提交。关闭自动后，需要手动选择处理提交或回滚

事务原理：
事务开启后，所有操作临时保存在事务日志，只有在commit时才会同步到数据表，其他情况都会导致清空。
其中日志文件分为两个：
* REDO日志：记录事务日志。每条SQL进行数据库更新操作时，首先将REDO日志写入到日志缓存区中。当客户端执行COMMIT命令提交时，日志缓冲区的内容被刷新到磁盘。
REDO日志对应`ib_logfile`文件，默认大小5MB，建议设置为512MB以便容纳较大的事务。
在Mysql崩溃恢复时，会重新执行REDO日志记录。
* UNDO日志：也称为回滚段。用于事务异常时的回滚处理，复制事务前得到数据库内容到UNDO缓冲区，然后在合适的时间将内容刷新到磁盘。磁盘上不存在单独的UNDO日志文件，而是存放在表空间对应的`.ibd`数据文件中。

回滚点：在某个成功的操作完成后，后续的操作可能成功可能失败，可以自当前成功的位置设置一个点，可以供后续失败操作返回到该位置，而不是返回所有操作。
`savepoint  回滚点名;`
`rollback  回滚点名;`
```
# 使用start transaction 或 begin开启事务
mysql> start transaction;
mysql> update stu set age=22 where id=20007;
mysql> commit;    或
mysql> rollback;
```
## 事务隔离级别
SQL定义了4种隔离级别，指定了事务中哪些数据改变其他事务可见，哪些数据改变其他事务不可见。
低隔离级别可支持更高并发处理，同时占用的系统资源更少。
可通过`show variables like 'tx_isolation'`查看当前事务隔离级别。

* `READ-UNCOMMITTED`：读取未提交内容，所有事务都可以看到其他未提交事务的执行结果。读取未提交的数据称为**脏读**。
开启A与B事务，A更新，B不操作，但A在提交前，B能读到更新后的数据，而此时A回滚了，也就是B还是读到了错误的数据。
* `READ-COMMITTED`：读取提交内容，一个事务从开始到提交前所做的任何改变都是不可见的，事务只能看见已经提交的变化。同一事务的其他实例在该实例处理时可能会有新的数据提交导致数据改变，所以同一查询可能返回不同结果。
* `REPEATABLE-READ`：可重读，Mysql默认事务隔离级别。确保同一事务的多个实例在并发读取数据时，会看到同样的数据行。
存在问题：A的操作对表中所有行，B的操作是添加一行，于是A会发现有一行没有被修改。这个问题称为幻读。
解决：InnoDB的多版本并发控制MVCC机制。InnoDB通过为每个数据行增加两个隐含值的方式实现，两个隐含值记录行的创建时间和过期时间。每行记录事件发生时的系统版本号。每一次开始一个新事务时版本号会自动加1，每个事务保存开始时的版本号，每个查询根据事务的版本号查询结果。
* `SERIALIZABLE`：可串行化。最高的隔离级别。通过强制事务排序，使各事务不可能冲突。通过在每个读的数据行上加上共享锁实现。不推荐使用。

## InnoDB锁机制
锁机制：为解决数据库并发控制问题，保证数据一致性，需要对并发操作控制，并实现Mysql各个隔离级别。
有以下类型：
* 共享锁：S（Share），锁粒度是单行或多行。一个事务获取了共享锁后，可对锁定范围内的数据执行读操作。
事务A与B，若A获取了共享锁，B仍可获得共享锁，但不能获得排他锁。
若A获得了排他锁，B不能获得共享锁和排他锁。
* 排他锁：X（eXclusive），排他锁的粒度与共享锁相同。事务获取排他锁后，可对锁定范围的数据执行写操作。
* 意向锁：一种表锁，粒度为整张表。分为意向共享锁IS和意向排他锁IX。
表示一个事务有意对数据上共享锁或排他锁。锁与锁之间的关系，要么相容，要么互斥。
相容：事务A获得了锁a，事务B还可获得锁b
互斥：事务A获得了锁a，事务B在A释放a之前不能获得锁b

**锁粒度**
锁粒度分为表锁和行锁。
innodb默认是行锁，但如果在事务操作的过程中，没有使用索引，那么系统会自动全表检索数据，自动升级为表锁。
行锁：只有当前行被锁住，别的用户不能操作。行锁支持最大并发。InnoDB使用行锁。支持并发读写。
表锁：整张表被锁住，别的用户不能操作。开销最小，允许的并发量也最小。MyISAM使用表锁。
当行或表被锁住时，若另一用户也要更改就只能等待锁被解除（commit或rollback），否则无法操作成功。

# 安全
## 权限机制
三张关于权限的表，存放在`mysql`库中。
* user
* db
* host

### mysql.user表
一共有45个字段，可分为4类：用户字段、权限字段、安全字段、资源控制字段
* 用户字段
  三个字段：host主机名，user用户名，password密码
* 权限字段
  一系列以`_priv`结尾的字段，这些字段决定了权限。两个返回值，Y和N，默认为N。

|字段|权限名|权限范围|
|--|--|--|
| Select_priv            | select                  |查询表|
| Insert_priv            | insert                  |插入表|
| Update_priv            | update                  |更新表|
| Delete_priv            | delete                  |删除表|
| Create_priv            | create                  |库、表、索引|
| Drop_priv              | drop                    |库、表|
| Reload_priv            | reload                  |库、表|
| Shutdown_priv          | shutdown                |关闭服务器|
| Process_priv           | process                 |服务器管理|
| File_priv              | file                    |加载服务器主机的文件|
| Grant_priv             | grant                   |库、表、存储过程、函数|
| References_priv        | references              |库、表|
| Index_priv             | index                   |用索引查表|
| Alter_priv             | alter                   |修改表|
| Show_db_priv           | show databases          |服务器|
| Super_priv             | super                   |超级权限|
| Create_tmp_table_priv  | create temporary tables |临时表|
| Lock_tables_priv       | lock tables             |锁定表|
| Execute_priv           | execute                 |执行存储过程或函数|
| Repl_slave_priv        | replication slave       |服务器管理|
| Repl_client_priv       | replication client      |服务器管理|
| Create_view_priv       | create view             |创建视图|
| Show_view_priv         | show view               |查看视图|
| Create_routine_priv    | create routine          |创建存储过程或函数|
| Alter_routine_priv     | alter routine           |修改存储过程或函数|
| Create_user_priv       | create user             |创建用户|
| Event_priv             | event                   |计时器|
| Trigger_priv           | create trigger          |触发器|
| Create_tablespace_priv | create tablespace       |创建表空间|

* 安全字段
用于判断用户是否能够登录成功

|字段|说明|
|--|--|
| ssl_type      |支持ssl加密的安全字段 |
| ssl_cipher    |支持ssl加密的安全字段 |
| x509_issuer   |支持x509的字段 |
| x509_subject  |支持x509的字段 |

可通过以下方式查看是否字段支持ssl加密
```
mysql> show variables like 'have_openssl';
+---------------+----------+
| Variable_name | Value    |
+---------------+----------+
| have_openssl  | DISABLED |
+---------------+----------+
```
* 资源控制字段

|字段|说明|
|--|--|
| max_questions         |每小时允许执行多少次查询|
| max_updates           |每小时允许执行多少次更新|
| max_connections       |每小时允许建立多少次连接|
| max_user_connections  |单个用户可同时具有的连接数|
所有资源控制字段的默认值为0，表示是没有限制。

## 用户机制
包括：登录和退出Mysql，创建用户，删除用户，修改用户密码，修改用户权限等。

连接Mysql服务器的命令：
```
mysql 
  -h Mysql服务器的地址，可用域名，也可用IP地址
  -p 指定所连接Mysql服务器的端口，默认3306
  -u 登录Mysql使用的用户
  -p 将提示输入密码
  DBname 指定登录到的库
  -e 指定执行的SQL语句
```
对用户的操作：
* **创建用户：**
```
1. create user 用户名[@主机] [identified by "密码"];

2. insert into mysql.user(Host,User,Password) values(主机名,用户名,PASSWORD("密码"));
# 要使用PASSWORD()对密码加密

3. grant 权限 on 库.表 to 用户名[@主机] [identified by "密码"];
在赋予权限后，要flush privileges;刷新权限
```
* **修改用户账户密码：**
```
1. mysqladmin -u 用户名 -p 原密码 "新密码"
# 新密码必须用双引号括起来

2. set password=PASSWORD("新密码");
# 修改当前登录用户的密码（即只修改自己的密码）

3. update mysql.user set password=PASSWORD("新密码") where user="用户名" and host="localhost";
```
* **修改普通用户账户密码：**
```
1. grant 权限 on 库.表 to 用户名 [identified by "密码"];

2. set password for 用户名[@主机]=PASSWORD("新密码");

3. update mysql.user set password=PASSWORD("新密码") where user="用户名" and host="主机名";

4. set password=PASSWORD("新密码");
# 修改当前登录用户的密码（即只修改自己的密码）
```
* **删除普通用户账号：**
```
1. drop user 用户名1,用户名2....

2. delete from mysql.user where user="用户名" and host="主机";
```

## 对用户的权限管理
* **对用户授权：**
```
grant 权限 on 库.表 to 用户 [identified by "密码"] with 选项;
# with后有以下选项：
GRANT OPTION：被授权用户可将权限授权给其他用户
MAX_QUERIES_PER_HOUR count：设置每小时可执行count次查询
MAX_UPDATES_PER_HOUR count：设置每小时可执行count次更新
MAX_CONNECTIONS_PER_HOUR count：设置每小时可建立count次查询
MAX_USER_CONNECTIONS count：设置单个用户可同时具有count个连接
```
* **查看用户拥有权限：**
`show grant for 用户名[@主机];`
* **收回用户拥有权限：**
```
revoke 权限 on 库.表 from 用户名 [identified by "密码"];

若要直接回收全部权限，可使用以下语句
revoke all privileges,grant option from 用户名 [identified by "密码"];
```

# 日志
Mysql日志分为：
* 二进制日志：以二进制形式记录数据库的各种操作，但不记录查询语句
* 错误日志：记录Mysql服务器启动、关闭、运行时的错误信息
* 通用查询日志：记录Mysql启动和关闭信息、客户端连接信息、更新数据SQL语句、查询SQL语句
* 慢查询日志：记录执行时间超过指定时间的各种操作，可用于定位Mysql性能瓶颈

## 二进制日志
二进制日志默认关闭。可通过mysql配置文件`my.ini`的`log-bin`参数，将注释去掉即可开启二进制日志。
`log-bin = 二进制日志路径`
路径是可选。若没指定路径，会使用默认名`主机名-bin.number`，number格式为000001开始的计数，并保存到默认目录：数据库的数据文件目录，即`C:\ProgramData\MySQL\MySQL Server 5.7\Data`。
> 每次重启Mysql服务器都会生成一个新的二进制日志文件，number会递增

可通过`mysqlbinlog 二进制日志`查看。**不能直接打开，否则是乱码。**

若要停止二进制日志，只要将`my.ini`中的log-bin恢复注释或删除即可。或者在数据库中通过对变量的设置实现开启或关闭二进制日志。
`set SQL_LOG_BIN=`若为1表示开启，若为0表示关闭
> 只有有super权限的用户才能执行set语句

删除二进制日志
`reset master;`可删除所有二进制日志文件
`purge master logs to 日志文件`可删除number所有小于该日志的日志
`purge master logs before 'yyyy-mm-dd hh:MM:ss'`删除指定日期前创建的二进制日志

## 错误日志
Mysql默认开启错误日志，也无法被禁止。同样该日志默认也存放在`C:\ProgramData\MySQL\MySQL Server 5.7\Data`中，文件名称格式为`Mysql主机名.err`。可修改`my.ini`的`error-bin`修改日志的路径。

错误日志以文本文件形式存储信息，可直接打开。
命令`mysqladmin -u root -p flush-logs`会先创建一个新的错误日志，然后将旧的错误日志改名为`原文件名-old`。

## 通用查询日志
由于该日志记录了客户端Mysql的所有请求，若实例的访问量较大，则此日志会急剧增大，影响Mysql性能，一般建议关闭。

若要开启通用查询日志，设置`my.ini`的`general-log=1`，默认未开启。
`general_log_file`设置通用查询日志的路径，格式为`文件名.log`，默认为`主机名.log`。

也可通过设置环境变量开启或关闭，`set global general_log = on;`开启通用查询日志。若要关闭，设为off即可。
通过`show variables like '%general_log%';`查看相关变量（只有是否开启和文件路径）。

同样可以使用`mysqladmin -u root -p flush-logs`删除日志，但Mysql会创建一个新日志覆盖旧日志。

## 慢查询日志
默认慢查询日志是关闭的。可通过`my.ini`的`slow-query-log=1`开启。
可通过`slow_query_log_file`设置慢查询日志的路径，文件格式为`文件名-slow.log`，默认为`主机名-slow.log`。默认存放在`C:\ProgramData\MySQL\MySQL Server 5.7\Data`。
可通过`long_query_time`设置超时时间，默认为10s。
修改配置后需要重启Mysql才能生效。所以最好通过修改环境变量动态开启关闭。
`set global slow_query_log=on;`开启慢查询日志
`set global long_query_time=3;`设置超时时间，对设置后的新连接有效，可重新连接Mysql。

Mysql提供工具`mysqldumpslow.pl`对慢查询日志文件进行分析，该工具在`C:\Program Files\MySQL\MySQL Server 5.7\bin`中。
**该工具由perl语言编写，因此需要perl环境**
```
mysqldumpslow.pl
    -s 分析慢查询日志时指定排序参数，有以下可选参数
        al 平均锁定时间
        ar 平均返回记录数
        at 平均查询时间
    -t 只显示指定的行数
```

若要停止慢查询日志，可将`my.ini`的`slow-query-log`与`long_query_time`注释即可。或通过修改环境变量`slow-query-log=off`关闭。
若要删除慢查询日志，可通过命令`mysqladmin -u root -p flush-logs`创建新的日志，会覆盖旧日志。

# 维护
## 数据库备份与还原
使用`mysqldump`命令进行数据备份
`mysqldump -u [username] -p [dbname] [table1]... > [path]/[filename].sql`
备份单个数据库，可指定表（可多张），若不指定，就备份整个库。导出的sql文件路径与名称都可自定义。
`mysqldump -u [username] -p --databases [dbname]... > [path]/[filename].sql`备份多个数据库
`mysqldump -u [username] -p --all -databases > [path]/[filename].sql`备份所有数据库

**还原数据**
需要先在mysql中创建对应库，然后在数据库外执行命令。
`mysql -u [username] -p [dbname] < [path]/[filename].sql`
可指定数据库，指定就还原该数据库下的表，不指定就还原所有库。

若要通过复制对数据恢复，则需要保证两个Mysql的版本号一致，且只能对存储引擎为MYISAM的表有效。

**将数据库表与文本文件互相导入导出**
导出有三种方法：
* `select ...into outfile...;`命令
* `mysqldump`命令
* `mysql`命令

```
1. select 字段名 from 表名 过滤条件    # 第一部分是普通的查询语句
      into outfile 文件名 选项;   # 设置要导出到的文件以及文件的参数选项
有六种选项：
    fields terminated by 字符串：用于设置字段的分隔符，默认为'\t'
    fields enclosed by 字符：用于设置括上字段值的字符符号，默认不使用任何符号
    fields optionally enclosed by 字符：用于设置括上char、varchar、text等字段值的字符符号，默认不使用任何符号
    fields escaped by 字符：用于设置转义字符的字符符号，默认为'\'
    lines starting by 字符：用于设置每行开头的字符符号，默认不使用任何符号
    lines terminated by 字符串：用于设置每行结束时的字符串符号，默认为'\n'

例：select * from user
        into outfile '.\user.txt'
        fields terminated by '\,'
        optionally enclosed by '\"'
        lines terminated by '\r\n';

2. mysqldump -u 用户名 -p -T 文件目录 数据库 表名 选项
有四种选项：
    --fields-terminated-by=字符串 ：设置字段的分隔符，默认为'\t'
    --fields-enclosed-by=字符 ：设置括上字段值的字符符号，默认不使用任何符号
    --fields-optionally-enclosed-by=字符 ：设置括上char、varchar、text等字段值的字符符号，默认不使用任何符号
    --lines-terminated-by=字符串 ：设置每行结束时的字符串符号，默认为'\n'

例：mysqldump -u 用户名 -p -T '.\' test user "--fields-terminated-by=," "--lines-terminated-by=\r\n"
使用mysqldump命令不仅会在指定目录中生成[表名].txt文件，还会生成[表名].sql文件。

3. mysql -u 用户名 -p -e "select 字段 from 表名" 数据库名 > 文件名
     -e选项用于执行查询语句

例：mysql -u root -p -e "select * from user" test > .\user.txt
```

导入有两种方法：
* `load data infile`命令
* `mysqlimport`命令

```
1. load data infile 文件名 into table 表名 选项;
有九种选项。前六种与导出的select六种一致，后三种为：
     ignore N lines ：忽视文件的前N行数据
     字段列表：实现根据字段列表中的字段和顺序加载记录
     set column=EXPR ：设置列的转换条件EXPR，即所指定的列经过相应转换后才会被加载

例：load data infile '.\uesr.txt' into table user
        into outfile '.\user.txt'
        fields terminated by '\,'
        optionally enclosed by '\"'
        lines terminated by '\r\n';

2. mysqlimport -u 用户名 -p 数据库名 文件名 选项
有六种选项。其中四种与导出的mysqldump选项一致，其余两种为： 
    --fields-escaped-by=字符 ：设置转移字符
    --ignore-lines=N ：忽略文件的前N行记录

例：mysqlimport -u root -p test ".\user.txt" "--fields-terminated-by=," "--lines-terminated-by=\r\n"
```

## 数据库迁移
分为三种情况：
* 相同版本间迁移：使用mysqldump和mysql进行备份与恢复
```
案例：
mysqldump -h 主机A -u root -p=密码 -all-databases 
| 
mysql -h 主机B -u root -p=密码
# 其中 | 即为管道符
```
* 不同版本间迁移：又分为高版本向低版本迁移和低版本向高版本迁移
```
高版本向低版本迁移：
高版本会兼容低版本
若表的存储引擎为MYISAM，可直接复制或使用命令mysqlhotcopy。
若表的存储引擎为InnoDB，可使用mysqldump与mysql的组合进行备份与恢复

而低版本并不兼容高版本，所以迁移会较困难
```
* 不同数据库间迁移
若从MYSQL迁移到SQL SERVER，可通过MyODBC实现。若从MYSQL迁移到ORACLE，可先导出sql文件，然后手动修改create语句。

## 简单的性能优化思路
* 可通过`show variables`和`show status`查看修改配置和变量参数进行调优
* 若多个任务中一个执行缓慢，会影响其他任务。可通过`show processlist`显示所有活动进程，或执行`kill`终结消耗资源过多的进程
* 最好多次试验连接或子查询，找到效率最高的搜索方法。在select时可通过`explain`语句查看select的执行情况
* 使用存储过程的速度会提高
* 若不必要，不要直接执行`select * `语句
* 使用UNION连接select语句，比一系列OR条件的select语句效率高
* 对象索引可改善数据检索的性能，但会损失插入、更新、删除的性能。对于不常查询的表最好不要创建索引
* 关键字like的执行效率很低，一般会通过`full text`代替like

## 常见查看命令显示解析
### SHOW TABLE STATUS
`show table status (from 数据库名) (like 表达式);`
会直接显示该数据库中所有表的状态信息。
```
           Name: stu         # 表名或视图名
         Engine: InnoDB      # 存储引擎
        Version: 10          # .frm文件版本
     Row_format: Dynamic     # 行存储格式
           Rows: 7           # 行数目
 Avg_row_length: 2340        # 行平均长度
    Data_length: 16384       # 文件长度
Max_data_length: 0           # 文件最大长度
   Index_length: 0           # 索引文件长度
      Data_free: 0           # 表被整序后，但未使用的字节数目
 Auto_increment: NULL        # 下一个Auto_increment值
    Create_time: 2018-07-07 08:58:34   # 表的创建时间
    Update_time: 2018-07-07 09:01:00   # 最后一次更新时间
     Check_time: NULL        # 最后一次检查时间
      Collation: utf8_general_ci       # 字符集
       Checksum: NULL        # 表的活性校验
 Create_options:             # 表的额外选项
        Comment:             # 表的注释
```


> 参考资料
-  MYSQL数据库应用从入门到精通（第二版）
- [Mysql 异常处理--condition和handler](https://blog.csdn.net/ashic/article/details/52126979)
- [Mysql系列--骏马金龙](http://www.cnblogs.com/f-ck-need-u/p/7586194.html)
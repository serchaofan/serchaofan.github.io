---
title: MongoDB基础笔记
date: 2018-10-29 11:41:54
tags: [MongoDB, 数据库]
categories: [应用运维]
---

基于 MongoDB 4.0.3

- [MongoDB 概述](#MongoDB概述)
- [CRUD](#CRUD)
- [索引](#索引)
- [权限](#权限)

<!-- more -->

# MongoDB 概述

MongoDB 是一个跨平台的基于分布式文件存储的面向文档的数据库，提供高性能，高可用性和易于扩展。由 C++ 语言编写，旨在为 WEB 应用提供可扩展的高性能数据存储解决方案。

MongoDB 中的记录是一个文档，由键值对组成。 MongoDB 文档类似于 JSON 对象。字段的值可以包括其他文档，数组和文档数组。

MongoDB 特点：

- 提供**高性能**数据持久性：对嵌入式数据模型的支持减少了数据库系统的 I / O 活动。索引支持更快的查询，并且可以包含来自嵌入式文档和数组的键。

- 丰富的查询语言

- **高可用性**：MongoDB 的复制工具称为副本集（replica set），它提供自动故障转移和数据冗余。

  > 副本集是一组 MongoDB 服务器，它们维护相同的数据集，提供冗余并提高数据可用性。

- 水平扩展（Horizontal Scalability）：分片将数据分配到集群的不同机器上。支持基于分片键（shard key）创建数据区域（zones of data）

- 支持主从复制。主服务器可以执行读写操作，从服务器从主机复制数据，只能用于读取或备份

- MongoDB 能够实现负载均衡

- 支持多个存储引擎（WiredTiger、In-Memory、MMAPv1）

- 提供可插拔存储引擎 API，允许第三方为 MongoDB 开发存储引擎

- 可以将不同结构的文档存储在同一个数据库中

- 可对任何属性创建索引

- 支持二进制数据和大型对象

MongoDB 结构：

- database：数据库
- collection：集合，对应了 SQL 的 table
- document：文档，对应了 SQL 的 row，即值
- field：域，对应 SQL 的 column 字段
- index：索引
- primary key：主键，MongoDB 自动将**`_id`**字段设置为主键

安装 MongoDB 需要安装`mongodb-org`、`mongodb-org-mongos`、`mongodb-server`、`mongodb-org-shell`、`mongodb-org-tools`

MongoDB 默认端口 27017，配置文件`/etc/mongod.conf`。

常见命令：

- `db`：显示当前数据库名
- `show dbs`：显示所有数据库，默认有四个，`admin`、`config`、`local`、`test`
- `use 数据库名`：切换数据库，若不存在就会自动创建
- `db.dropDatabase()`：删除数据库，删除前一定要切换到该数据库
- `show collections`：显示当前库中的所有集合
- `db.collection.drop()`：删除指定集合
- `show users`：显示当前数据库的所有用户

MongoDB 的数据类型：

- ObjectID：文档 ID，12 字节，十六进制数。由以下信息构成：
  - 前 4 个字节为创建时的时间戳
  - 接下来 3 个字节为机器 ID
  - 接下来 2 个字节为 MongoDB 的服务进程 ID
  - 最后 3 个字节为简单的增量值
  - 例：`5bd6b780 ba51d7 f829 d135e9`
- String：字符串，必须是有效的 UTF-8
- Boolean：布尔值
- Integer：整型
- Double：浮点型
- Arrays：数组或列表
- Object：用于嵌入式文档，一个值就是一个文档
- Null：Null 值
- Timestamp：时间戳
- Date：当前日期或时间，unix 格式

# CRUD

- `db.createCollection(name, options)`：创建集合。options 是一个文档，用于指定集合配置。
- `db.collection.insertOne()`：插入单个文档，若集合不存在，会自动创建

- `db.collection.insertMany()`：插入多个文档
- `db.collection.insert()`：既可以插入单个文档，也可插入多个文档

```
db.users.insertOne(
  {
    name: "zhangsan",
    age: 22,
    hobby: ["climbing", "swimming", "game"]
  }
)

db.users.insertMany([
  {
    name: "lisi",
    age: 23,
    hobby: ["swimming", "game"]
  }, {
    name: "wangwu",
    age: 25,
    hobby: ["tennis", "swimming"]
  }, {
    name: "zhaoliu",
    age: 21,
    hobby: ["game"]
  }
])
```

在 MongoDB 中，存储在集合中的每个文档都需要一个唯一的`_id`字段作为主键。如果插入的文档省略了`_id`字段，MongoDB 驱动程序会自动为`_id`字段生成`ObjectId`。

**MongoDB 中的所有写入操作都是单个文档级别的原子操作。**

- `db.collection.find()`：从集合中检索文档

```
db.users.find( {} )                 # 显示所有记录

{ <field1>: <value1>, ... }  直接指定键值查询
db.users.find(
	{ name: "zhaoliu" }             # name为zhaoliu
)

{ <field1>: { <operator1>: <value1> }, ... }  使用查询运算符指定条件
db.users.find(
	{
		age: {$gt: 23},             # age大于23
		hobby: "climbing"           # 且hobby中有climbing
	}
)
db.users.find(
	{
        $or: [                      # or关系
        	{ age: {$gt: 23} },     # 要么age大于23
        	{ hobby: "climbing" }   # 要么hobby中有climbing
        ]
	}
)
db.users.find(
	{
        age: {$gt: 23},             # age大于23
        $or: [                      # 下面的为或关系
            { hobby: "climbing" },  # 要么hobby中有climbing
            { hobby: "game" }       # 要么hobby中有game
        ]
	}
)
相当于SQL：select * from users where age > 23 and (hobby="climbing" or hobby="game")

db.users.find(
	{ age: { $in: [23, 24] } }      # 查询age在[23, 24]中的文档
)

db.users.find(
	{ hobby: [ "swimming", "game" ] }    # hobby必须包含该列表（包括列表中顺序也要一致）
)
db.users.find(
	{ hobby: { $all: [ "game", "swimming" ] }}  # hobby必须包含该列表（顺序不用一致）
)

$elemMatch运算符匹配包含数组字段的文档，其中至少有一个元素匹配所有指定的查询条件。
例：{ _id: 1, results: [ 82, 85, 88 ] },{ _id: 2, results: [ 75, 88, 89 ] }
db.scores.find(
   { results: { $elemMatch: { $gte: 80, $lt: 85 } } }
)
返回结果为_id为1的文档

若包含数组（列表），可通过指定列表的下标进行匹配
db.users.find(
	{
		"hobby.1": "climbing"  # 查找hobby列表的下标为1的值为climbing的文档，一定要加引号
	}
)

在匹配数组中的文档时，该字典的字段顺序必须完全一致
匹配列表中的文章，只要有一项满足就会被匹配
例：{"item" : "paper", "instock" : [ { "warehouse" : "A", "qty" : 60 }, { "warehouse" : "B", "qty" : 15 } ] }
则db.inventory.find( { 'instock.qty': { $lte: 20 } } )也能匹配到该条文档
```

- `db.collection.updateOne()`：更新单个文档
- `db.collection.updateMany()`：更新多个文档
- `db.collection.update()`：更新一个或多个文档
- `db.collection.replaceOne()`：替换除`_id`字段之外的文档的整个内容
- `db.collection.save()`：更新现有文档或插入新文档，用法与`update()`或`insert()`一致

```
db.users.update(
	{ name: "zhangsan" },               # 指定要改的满足条件的文档
	{ $set:                             # 指定$set进行修改
		{
        	"hobby.1": "tennis"
		}
    }
)

db.users.replaceOne(
	{ name: "zhangsan" },
	{
        name: "zhangsan",
        age: 24,
        hobby: ["swimming", "basketball", "football"]
	}
)
替换文档必须仅包含字段/值对，即不包括更新运算符表达式。
_id字段始终是文档中的第一个字段。字段名称的更新（包括重命名）可能会导致文档中字段的重新排序。
```

- `db.collection.deleteOne()`：删除一个文档
- `db.collection.deleteMany()`：删除多个文档
- `db.collection.remove()`：删除单个文档或与指定过滤器匹配的所有文档。

```
db.users.deleteOne(
	{
        name: "zhangsan"
	}
)
```

# 索引

先创建 200000 条数据做测试

```
for(i = 0; i < 200000;i++){
	db.test.insert(
		{ name: "test"+i }
	)
}
```

查询指定数据

```
db.test.find(
	{
		name: "test10000"
	}
).explain('executionStats')
# explain('executionStats')用于显示查询过程信息
```

返回结果

```
"executionStats" : {
		"executionSuccess" : true,
		"nReturned" : 1,
		"executionTimeMillis" : 93,        # 花费93毫秒
		"totalKeysExamined" : 0,
		"totalDocsExamined" : 210000,
...
```

创建索引：`db.collection.ensureIndex()`

```
db.test.ensureIndex({ name: 1 })
对name创建索引，1表示升序，-1表示降序
```

再次执行查询语句，得到以下结果

```
"executionStats" : {
		"executionSuccess" : true,
		"nReturned" : 1,
		"executionTimeMillis" : 0,       # 创建索引后，基本不消耗时间
		"totalKeysExamined" : 1,
		"totalDocsExamined" : 1,
...
```

唯一索引：`db.collection.ensureIndex({ name: 1 }, { unique: true })`

联合索引：`db.collection.ensureIndex({ name: 1, XXX: 1 })`设置多个字段

查看当前集合的所有索引：`db.collection.getIndexes()`

```
[
	{
		"v" : 2,
		"key" : {
			"_id" : 1         # _id为主键，也是默认的索引
		},
		"name" : "_id_",
		"ns" : "test.test"
	},
	{
		"v" : 2,
		"key" : {
			"name" : 1        # 添加的索引name
		},
		"name" : "name_1",
		"ns" : "test.test"
	}
]
```

删除指定索引：`db.collection.dropIndexes('索引名')`

# 权限

MongoDB 采用**角色-用户-数据库**的管理模式

常见的系统角色：

- **root**：只能在 admin 数据库中可用，是超级用户，具有超级权限
- **read**：允许用户读取指定数据库
- **readWrite**：允许用户读写指定数据库

**创建超级管理员**

先切换到 admin 数据库，然后创建

```
db.createUser(
	{
    user: 'admin',
    pwd: '123123',
    roles: [{
      role: 'root',
      db: 'admin'
    }]
	}
)
```

然后修改 MongoDB 的配置文件`/etc/mongod.conf`

找到`security`配置，删除注释，并添加内容

```
security:
  authorization: enabled
```

然后重启 MongoDB，`systemctl restart mongod`，再重进 mongo

执行`show dbs`，出现报错，说明授权起作用了

```
[js] Error: listDatabases failed:{
	"ok" : 0,
	"errmsg" : "command listDatabases requires authentication",
	"code" : 13,
	"codeName" : "Unauthorized"
} :
......
```

需要指定用户名和密码以及参数`--authenticationDatabase admin`

`mongo -u username -p password --authenticationDatabase admin`，登录后可以正常操作数据库

为单独的应用创建用户，专门用于该数据库的读写。

首先切换到测试数据库 test，创建用户 testuser

```

```

退出 MongoDB，重新使用该用户登录

`mongo -u testuser -p 123123 --authenticationDatabase test`

能查看到的数据库就只有`test`了，切换到别的数据库也无法查看任何数据

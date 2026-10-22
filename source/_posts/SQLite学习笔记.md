---
title: SQLite学习笔记
date: 2018-09-07 20:39:39
tags: [SQLite, 数据库]
categories: [数据库]
comments: false
---

SQLite 是一个进程内的、无服务器的、零配置的、支持事务的嵌入式关系型数据库。它不是一个 C/S 架构的数据库，而是以库的形式链接到应用程序中，数据库就是磁盘上的一个普通文件。

本篇笔记主要包含以下内容

<!-- more -->

- [SQLite 特点](#sqlite-%E7%89%B9%E7%82%B9)
- [安装](#%E5%AE%89%E8%A3%85)
- [数据类型与类型亲和性](#%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%E4%B8%8E%E7%B1%BB%E5%9E%8B%E4%BA%B2%E5%92%8C%E6%80%A7)
- [命令行工具](#%E5%91%BD%E4%BB%A4%E8%A1%8C%E5%B7%A5%E5%85%B7)
- [数据库与表操作](#%E6%95%B0%E6%8D%AE%E5%BA%93%E4%B8%8E%E8%A1%A8%E6%93%8D%E4%BD%9C)
- [约束](#%E7%BA%A6%E6%9D%9F)
- [增删改查](#%E5%A2%9E%E5%88%A0%E6%94%B9%E6%9F%A5)
- [索引](#%E7%B4%A2%E5%BC%95)
- [视图与触发器](#%E8%A7%86%E5%9B%BE%E4%B8%8E%E8%A7%A6%E5%8F%91%E5%99%A8)
- [事务与并发](#%E4%BA%8B%E5%8A%A1%E4%B8%8E%E5%B9%B6%E5%8F%91)
- [PRAGMA 常用配置](#pragma-%E5%B8%B8%E7%94%A8%E9%85%8D%E7%BD%AE)
- [备份与恢复](#%E5%A4%87%E4%BB%BD%E4%B8%8E%E6%81%A2%E5%A4%8D)
- [性能优化](#%E6%80%A7%E8%83%BD%E4%BC%98%E5%8C%96)
- [编程语言中使用](#%E7%BC%96%E7%A8%8B%E8%AF%AD%E8%A8%80%E4%B8%AD%E4%BD%BF%E7%94%A8)
- [SQLite 的局限](#sqlite-%E7%9A%84%E5%B1%80%E9%99%90)
- [FAQ](#faq)
- [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# SQLite 特点

- **无服务器**：不需要单独的数据库服务进程，直接读写数据库文件。
- **零配置**：无需安装、启动、配置，没有用户和权限体系。
- **单文件**：整个数据库（表、索引、视图、触发器）都存放在一个跨平台的文件中。
- **事务安全**：支持 ACID，即使断电或进程崩溃也能保证数据一致性。
- **轻量**：编译后体积小，运行时占用内存少，适合嵌入式设备、移动端、桌面应用。
- **公共领域（Public Domain）**：可自由用于商业项目。
- **跨平台**：数据库文件格式在 32/64 位、大小端机器之间通用。

SQLite 适合读多写少、单机、数据量适中的场景，例如移动 App、桌面软件、小型网站、测试环境、数据分析和缓存。**不适合**高并发写入、超大规模数据、需要网络访问和多用户权限管理的场景。

# 安装

Linux 下直接通过包管理器安装：

```bash
# Debian/Ubuntu
apt install sqlite3 libsqlite3-dev

# CentOS/RHEL
yum install sqlite sqlite-devel
```

macOS 自带 sqlite3，Windows 可从官网下载预编译的 `sqlite-tools` 包，得到 `sqlite3.exe`。

编译安装（可选）：

```bash
wget https://www.sqlite.org/2024/sqlite-autoconf-3450000.tar.gz
tar xzf sqlite-autoconf-3450000.tar.gz
cd sqlite-autoconf-3450000
./configure --prefix=/usr/local
make && make install
```

查看版本：

```bash
sqlite3 --version
```

# 数据类型与类型亲和性

SQLite 采用**动态类型**，值本身有类型，列没有强制的类型。共有 5 种存储类型（Storage Class）：

| 存储类型 | 说明 |
| -------- | ---- |
| NULL     | 空值 |
| INTEGER  | 有符号整数，按大小存为 1/2/3/4/6/8 字节 |
| REAL     | 8 字节 IEEE 浮点数 |
| TEXT     | 字符串，默认 UTF-8/UTF-16 编码 |
| BLOB     | 二进制数据，原样存储 |

声明列类型时，SQLite 会根据类型名称推断**类型亲和性（Type Affinity）**：

| 亲和性   | 匹配的声明类型                        | 行为 |
| -------- | ------------------------------------- | ---- |
| INTEGER  | 含 `INT` 的类型，如 `INTEGER`、`BIGINT` | 能无损转为整数时存为 INTEGER |
| TEXT     | 含 `CHAR`、`CLOB`、`TEXT`             | 数值会转为文本存储 |
| BLOB     | 含 `BLOB` 或未声明类型                | 原样存储，不做转换 |
| REAL     | 含 `REAL`、`FLOA`、`DOUB`             | 能转为浮点时存为 REAL |
| NUMERIC  | 其他类型，如 `NUMERIC`、`DECIMAL`、`BOOLEAN`、`DATE` | 优先整数，其次浮点，否则文本 |

几个常见约定：

- `BOOLEAN` 没有独立类型，通常用 `INTEGER` 存 `0/1`。
- `DATETIME`/`DATE` 通常存为 `TEXT`（ISO8601 格式）或 Unix 时间戳（INTEGER）。
- `INTEGER PRIMARY KEY` 是 `rowid` 的别名，自增且高效。
- `AUTOINCREMENT` 会额外维护 `sqlite_sequence` 表，保证 ID 不复用，一般不需要。

从 3.37 开始支持 **STRICT 表**，强制列类型检查：

```sql
CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL) STRICT;
```

# 命令行工具

```bash
sqlite3 mydb.db          # 打开/创建数据库
sqlite3                  # 打开内存数据库
sqlite3 mydb.db "SELECT * FROM t;"   # 直接执行 SQL
```

常用点命令（以 `.` 开头，不是 SQL）：

| 命令 | 说明 |
| ---- | ---- |
| `.help` | 查看帮助 |
| `.databases` | 列出已连接的数据库 |
| `.tables` | 列出表 |
| `.schema [表名]` | 查看建表语句 |
| `.indexes [表名]` | 列出索引 |
| `.headers on` | 显示列名 |
| `.mode column` / `.mode table` / `.mode csv` / `.mode json` | 输出格式 |
| `.width 10 20` | 设置列宽 |
| `.nullvalue NULL` | 设置 NULL 的显示方式 |
| `.output file.txt` / `.once file.txt` | 输出到文件 |
| `.read script.sql` | 执行 SQL 文件 |
| `.import data.csv tablename` | 导入 CSV |
| `.dump [表名]` | 导出 SQL |
| `.backup backup.db` | 在线备份 |
| `.restore backup.db` | 恢复 |
| `.timer on` | 显示执行耗时 |
| `.quit` / `.exit` | 退出 |

示例：

```bash
sqlite3 app.db <<'EOF'
.headers on
.mode column
.tables
SELECT * FROM users LIMIT 5;
EOF
```

# 数据库与表操作

创建、删除表：

```sql
CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    NOT NULL,
    email    TEXT    UNIQUE,
    age      INTEGER DEFAULT 0,
    created  TEXT    DEFAULT (datetime('now', 'localtime'))
);

DROP TABLE IF EXISTS users;
```

修改表结构（SQLite 的 `ALTER TABLE` 能力有限）：

```sql
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users RENAME TO members;
ALTER TABLE users RENAME COLUMN phone TO mobile;
ALTER TABLE users DROP COLUMN phone;      -- 3.35+，受约束限制
```

SQLite 没有 `ALTER COLUMN`，修改列类型/约束需要「新建表 → 复制数据 → 删除旧表 → 重命名」：

```sql
BEGIN;
CREATE TABLE users_new (...);
INSERT INTO users_new SELECT ... FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
COMMIT;
```

多数据库与附加：

```sql
ATTACH DATABASE 'other.db' AS other;
SELECT * FROM other.t1;
DETACH DATABASE other;
```

临时表只在当前连接有效：

```sql
CREATE TEMP TABLE tmp_data (id INTEGER, v TEXT);
```

# 约束

| 约束 | 说明 |
| ---- | ---- |
| `PRIMARY KEY` | 主键，`INTEGER PRIMARY KEY` 即 rowid |
| `NOT NULL` | 非空 |
| `UNIQUE` | 唯一，可多列组合 |
| `CHECK` | 条件校验 |
| `DEFAULT` | 默认值 |
| `FOREIGN KEY` | 外键，默认**不生效**，需 `PRAGMA foreign_keys = ON` |

```sql
CREATE TABLE orders (
    id       INTEGER PRIMARY KEY,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount   REAL    NOT NULL CHECK (amount >= 0),
    status   TEXT    NOT NULL DEFAULT 'new',
    UNIQUE (user_id, status)
);
```

注意：

- 外键检查是**连接级别**的，每次连接都要执行 `PRAGMA foreign_keys = ON;`。
- `UNIQUE` 允许多个 `NULL`（NULL 不等于 NULL）。
- 冲突处理：`INSERT OR REPLACE`、`INSERT OR IGNORE`、`ON CONFLICT DO UPDATE`（UPSERT）。

# 增删改查

插入：

```sql
INSERT INTO users (name, email, age) VALUES ('Tom', 'tom@example.com', 20);

-- 多行插入
INSERT INTO users (name, age) VALUES ('A', 1), ('B', 2), ('C', 3);

-- UPSERT（3.24+）
INSERT INTO users (id, name, age) VALUES (1, 'Tom', 21)
ON CONFLICT(id) DO UPDATE SET age = excluded.age;

-- 返回插入/更新的行（3.35+）
INSERT INTO users (name) VALUES ('Jerry') RETURNING id, name;
```

查询：

```sql
SELECT id, name, age FROM users WHERE age >= 18 ORDER BY age DESC LIMIT 10 OFFSET 20;

SELECT count(*) AS total, avg(age) AS avg_age FROM users;

SELECT age, count(*) FROM users GROUP BY age HAVING count(*) > 1;

-- 模糊匹配，注意 LIKE 对 ASCII 不区分大小写
SELECT * FROM users WHERE name LIKE 'T%';

-- 分页
SELECT * FROM users ORDER BY id LIMIT 20 OFFSET 40;
```

更新与删除：

```sql
UPDATE users SET age = age + 1 WHERE id = 1;
DELETE FROM users WHERE age < 18;
```

常用内置函数：

```sql
SELECT length('hello');                     -- 5
SELECT upper('abc'), lower('ABC');
SELECT substr('abcdef', 2, 3);              -- bcd
SELECT replace('a-b-c', '-', '_');
SELECT round(3.14159, 2);                   -- 3.14
SELECT abs(-10), max(1, 2), min(1, 2);
SELECT coalesce(NULL, 'default');
SELECT ifnull(NULL, 0);
SELECT typeof(123);                         -- integer
SELECT datetime('now');                     -- UTC
SELECT datetime('now', 'localtime');
SELECT strftime('%Y-%m-%d %H:%M:%S', 'now');
SELECT date('now', '+1 day');
SELECT julianday('now');
```

JSON（3.38+ 内置）：

```sql
SELECT json_extract('{"a":{"b":1}}', '$.a.b');   -- 1
SELECT json_extract(extra, '$.tags') FROM items;
SELECT value FROM items, json_each(items.extra, '$.tags');
```

窗口函数与 CTE：

```sql
SELECT name, age, row_number() OVER (ORDER BY age DESC) AS rn FROM users;

WITH adult AS (SELECT * FROM users WHERE age >= 18)
SELECT count(*) FROM adult;

WITH RECURSIVE cnt(x) AS (
    SELECT 1
    UNION ALL
    SELECT x + 1 FROM cnt WHERE x < 10
)
SELECT x FROM cnt;
```

# 索引

```sql
CREATE INDEX idx_users_name ON users(name);
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_age_name ON users(age, name);       -- 组合索引
CREATE INDEX idx_users_adult ON users(age) WHERE age >= 18; -- 部分索引
CREATE INDEX idx_users_lower_name ON users(lower(name));    -- 表达式索引
DROP INDEX idx_users_name;
REINDEX idx_users_name;
```

使用建议：

- 在 `WHERE`、`JOIN`、`ORDER BY` 常用列上建索引。
- 组合索引遵循**最左前缀**原则，`(age, name)` 可服务 `age` 或 `age, name`，不能单独服务 `name`。
- 索引会加快查询，但会增加写入成本和存储空间，不要滥建。
- 用 `EXPLAIN QUERY PLAN` 查看是否走索引：

```sql
EXPLAIN QUERY PLAN SELECT * FROM users WHERE name = 'Tom';
```

输出中的 `SCAN` 表示全表扫描，`SEARCH ... USING INDEX` 表示使用索引。若查询字段全部包含在索引中（覆盖索引），可以避免回表。

# 视图与触发器

视图：

```sql
CREATE VIEW v_adult AS SELECT id, name, age FROM users WHERE age >= 18;
SELECT * FROM v_adult;
DROP VIEW v_adult;
```

触发器：

```sql
CREATE TRIGGER trg_users_updated
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO user_logs(user_id, action, at)
    VALUES (NEW.id, 'update', datetime('now'));
END;
```

触发器支持 `BEFORE`/`AFTER`/`INSTEAD OF`、`INSERT`/`UPDATE`/`DELETE`，行级触发。可用 `NEW` 和 `OLD` 引用新旧行。触发器里的逻辑会隐式包含在触发语句的事务中，注意不要在触发器中做重操作。

# 事务与并发

```sql
BEGIN;                -- 默认 DEFERRED
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

ROLLBACK;             -- 回滚

BEGIN IMMEDIATE;      -- 立即获取写锁，推荐用于写事务
...
COMMIT;
```

三种事务模式：

- `DEFERRED`：默认，第一次读写时才加锁，可能在提交时才发现冲突。
- `IMMEDIATE`：立即获取 RESERVED 锁，其他写事务会等待，适合写操作。
- `EXCLUSIVE`：立即获取排他锁，WAL 模式下与 IMMEDIATE 类似。

保存点：

```sql
SAVEPOINT sp1;
UPDATE ...;
ROLLBACK TO sp1;
RELEASE sp1;
```

并发模型：

- 传统 rollback journal 模式下，写事务会阻塞读，读也会阻塞写。
- **WAL（Write-Ahead Logging）模式**下，读写互不阻塞，但同一时刻只允许一个写者。
- 多个连接同时写会得到 `database is locked`，应设置 `busy_timeout` 或使用 `IMMEDIATE` 事务减少冲突。

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

# PRAGMA 常用配置

PRAGMA 是 SQLite 特有的配置/查询语句：

```sql
PRAGMA database_list;            -- 当前连接的数据库
PRAGMA table_info(users);        -- 列信息
PRAGMA index_list(users);        -- 索引列表
PRAGMA foreign_key_list(orders); -- 外键
PRAGMA integrity_check;          -- 完整性检查
PRAGMA quick_check;
PRAGMA user_version;             -- 自定义版本号，可用于迁移
PRAGMA page_count;
PRAGMA page_size;
PRAGMA freelist_count;
```

常用可写配置：

```sql
PRAGMA journal_mode = WAL;       -- 推荐
PRAGMA synchronous = NORMAL;     -- WAL 下推荐 NORMAL，兼顾安全与性能
PRAGMA foreign_keys = ON;        -- 开启外键
PRAGMA busy_timeout = 5000;      -- 锁等待毫秒数
PRAGMA cache_size = -20000;      -- 负数表示 KB，约 20MB
PRAGMA temp_store = MEMORY;      -- 临时表放内存
PRAGMA mmap_size = 268435456;   -- 256MB 内存映射
PRAGMA auto_vacuum = INCREMENTAL;
PRAGMA wal_autocheckpoint = 1000;
```

注意：`journal_mode`、`page_size`、`auto_vacuum` 等部分 PRAGMA 会持久化在数据库文件中，其余多为连接级临时设置。

# 备份与恢复

命令行备份（在线、安全）：

```bash
sqlite3 app.db ".backup backup.db"
sqlite3 app.db ".dump" > dump.sql
sqlite3 new.db < dump.sql
```

SQL 方式（3.27+）：

```sql
VACUUM INTO 'backup.db';
```

直接复制文件在数据库未使用 WAL 且没有写入时是安全的；启用 WAL 后还有 `-wal`、`-shm` 文件，**不要只复制主文件**。推荐使用 `.backup` 或 `VACUUM INTO`。

恢复：把备份文件覆盖回去即可，或用 `.restore`：

```bash
sqlite3 app.db ".restore backup.db"
```

# 性能优化

- 使用 **WAL 模式**：`PRAGMA journal_mode = WAL;`
- 批量写入使用事务包裹，避免每条语句一次 fsync：

```sql
BEGIN;
INSERT INTO t VALUES (...);
INSERT INTO t VALUES (...);
COMMIT;
```

- 批量导入时临时降低安全性：

```sql
PRAGMA synchronous = OFF;
PRAGMA journal_mode = MEMORY;
-- 导入完成后改回
```

- 定期执行 `ANALYZE` 更新统计信息，帮助查询优化器选择索引：

```sql
ANALYZE;
PRAGMA optimize;
```

- 用 `VACUUM` 整理碎片、回收空间（需要额外磁盘空间，执行期间会锁库）：

```sql
VACUUM;
```

- 使用 **预编译语句（prepared statement）** 复用执行计划。
- 只查询需要的列，避免 `SELECT *`。
- 合理使用索引与覆盖索引，用 `EXPLAIN QUERY PLAN` 验证。
- 开启 `PRAGMA mmap_size` 提升读性能（视内存而定）。
- 频繁写入场景考虑 `synchronous = NORMAL`，但要接受极端情况下丢失最后几个事务的风险。

# 编程语言中使用

Python 标准库自带 `sqlite3`：

```python
import sqlite3
from contextlib import closing

conn = sqlite3.connect("app.db")
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA foreign_keys = ON")

with conn:  # 自动提交/回滚，不会自动关闭连接
    conn.execute(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ("Tom", "tom@example.com"),
    )

with closing(conn.cursor()) as cur:
    cur.execute("SELECT id, name FROM users WHERE age > ?", (18,))
    for row in cur:
        print(row["id"], row["name"])

conn.close()
```

要点：

- 始终使用 `?` 占位符传参，不要拼接 SQL，避免注入。
- `executemany()` 适合批量插入。
- `with conn` 只管理事务，不关闭连接。
- SQLite 默认类型转换较宽松，需要精确控制时可注册适配器/转换器。
- 多线程共享连接需 `check_same_thread=False` 并自行加锁，通常更推荐每个线程独立连接。

Node.js（`better-sqlite3`，同步 API，性能好）：

```js
const Database = require("better-sqlite3");
const db = new Database("app.db");
db.pragma("journal_mode = WAL");

const insert = db.prepare("INSERT INTO users (name, age) VALUES (?, ?)");
insert.run("Tom", 20);

const rows = db.prepare("SELECT * FROM users WHERE age > ?").all(18);
console.log(rows);
```

Go 使用 `modernc.org/sqlite`（纯 Go）或 `mattn/go-sqlite3`（CGO），通过 `database/sql` 操作，注意设置 `_pragma=busy_timeout(5000)`、`_pragma=journal_mode(WAL)` 等连接参数。

# SQLite 的局限

- 单写者模型，写并发能力有限，不适合高并发写入。
- 没有网络协议，不能像 MySQL 那样被多台机器直接访问（需要借助应用层或 LiteFS/rqlite 等方案）。
- 没有用户、权限、角色管理，文件权限即安全边界。
- 没有存储过程，触发器和视图能力相对简单。
- `ALTER TABLE` 能力有限，复杂的表结构变更需要重建表。
- 不适合超大规模数据（一般建议单库几十 GB 以内，视场景而定）。
- 大量小事务写入性能受 fsync 限制，应合并事务。
- 锁是数据库级别的，长事务会阻塞其他写入。

# FAQ

**Q：`database is locked` 怎么解决？**

A：通常是多个连接同时写。设置 `PRAGMA busy_timeout = 5000;`，写事务用 `BEGIN IMMEDIATE`，缩短事务时间，或启用 WAL 模式。避免在事务中执行耗时操作。

**Q：主键用 `INTEGER PRIMARY KEY` 还是 `AUTOINCREMENT`？**

A：优先 `INTEGER PRIMARY KEY`，它复用 rowid，性能更好。`AUTOINCREMENT` 只保证 ID 单调不复用，代价是额外的表和写入开销，仅在业务确实要求 ID 不复用时使用。

**Q：为什么外键不生效？**

A：SQLite 默认关闭外键约束，需要在每个连接上执行 `PRAGMA foreign_keys = ON;`。

**Q：删除数据后文件为什么不变小？**

A：删除只是把页标记为空闲，文件不会自动收缩。执行 `VACUUM` 重建数据库，或开启 `auto_vacuum` 增量回收。

**Q：时间应该怎么存？**

A：推荐存 UTC 的 ISO8601 文本（`strftime('%Y-%m-%dT%H:%M:%SZ','now')`）或 Unix 时间戳整数，展示时再按本地时区转换。不要存本地时间，避免时区和夏令时问题。

**Q：WAL 模式需要注意什么？**

A：会额外产生 `-wal` 和 `-shm` 文件；备份不能只复制主文件；网络文件系统（NFS/SMB）上使用 WAL 可能不可靠，应放在本地磁盘。

**Q：如何做数据库版本迁移？**

A：利用 `PRAGMA user_version` 记录版本号，应用启动时比较并依次执行迁移脚本，整个过程放在事务中。

# 参考资料

- 官方文档：<https://www.sqlite.org/docs.html>
- SQL 语法：<https://www.sqlite.org/lang.html>
- PRAGMA 列表：<https://www.sqlite.org/pragma.html>
- 何时使用 SQLite：<https://www.sqlite.org/whentouse.html>
- Python sqlite3：<https://docs.python.org/3/library/sqlite3.html>

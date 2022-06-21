---
title: Python基础完全笔记
date: 2019-02-03 12:56:22
tags: [Python, lang]
---

- [函数式编程](#函数式编程)
  - [高阶函数](#高阶函数)
    - [map 与 reduce](#map-与-reduce)
    - [filter](#filter)
    - [sorted](#sorted)
  - [装饰器](#装饰器)
  - [偏函数](#偏函数)
- [面向对象编程](#面向对象编程)
  - [特殊方法与特殊变量](#特殊方法与特殊变量)
  - [静态方法、类方法与继承](#静态方法类方法与继承)
  - [\_\_new\_\_和 metaclass](#__new__和-metaclass)
  - [反射](#反射)
- [测试](#测试)
- [进程与线程](#进程与线程)
- [正则表达式](#正则表达式)
- [网络编程](#网络编程)
- [数据库编程](#数据库编程)
- [文本处理](#文本处理)
- [协程与异步 IO](#协程与异步-io)
- [Web 编程](#web-编程)
- [常见内建模块](#常见内建模块)

<!--more-->

# 函数式编程

## 高阶函数

### map 与 reduce

### filter

### sorted

## 装饰器

## 偏函数

# 面向对象编程

## 特殊方法与特殊变量

所有保留属性：

- `Class.__doc__`：类的帮助信息，显示类的帮助信息

  ```
  >>> class Person():
  ...     '''
  ...     Person 类
  ...     '''
  ...     def __init__(self, name):
  ...         self.name = name
  ...
  >>> peter = Person("peter")
  >>> Person.__doc__

      Person 类
  ```

- `Class.__name__`：类名

  ```
  >>> Person.__name__
  Person
  ```

- `Class.__module__`：类所在模块

  ```
  >>> Person.__module__
  __main__
  ```

- `Class.__bases__`：类所继承的基类

  ```
  >>> Person.__base__
  <class 'object'>
  ```

- `Class.__dict__`：类型字典，存储所有类的成员信息（类属性）

  ```
  >>> Person.__dict__
  {'__module__': '__main__', '__doc__': '\n    Person 类\n    ', '__init__': <function Person.__init__ at 0x0000027E01DAC7B8>, '__dict__': <attribute '__dict__' of 'Person' objects>, '__weakref__':
  <attribute '__weakref__' of 'Person' objects>}
  ```

- `Class().__class__`：对象的类

  ```
  >>> peter.__class__
  <class '__main__.Person'>
  ```

- `Class().__module__`：对象的实例类所在模块

  ```
  >>> peter.__module__
  '__main__'
  ```

- `Class().__dict__`：对象字典，存储所有实例成员信息（实例属性，不包括类属性）

  ```
  >>> peter.__dict__
  {'name': 'peter'}
  ```

- `Class().__call__`：当对象后加了`()`，则会触发执行

  ```
  在类中添加方法__call__
  ...     def __call__(self, *args, **kwargs):
  ...         print("person", args, kwargs)
  >>> peter = Person("peter")
  >>> peter()
  person () {}
  >>> peter("peter", 1, 2, 3)
  person ('peter', 1, 2, 3) {}
  >>> peter("peter", 1, 2, 3, name="peter")
  person ('peter', 1, 2, 3) {'name': 'peter'}
  ```

- `Class().__str__`：在打印对象时再同时打印`__str__`定义的默认输出值

  ```
  在类中添加__str__方法
  ...     def __str__(self):
  ...         return "<obj: %s>" % self.name
  >>> print(peter)
  <obj: peter>
  ```

- `Class.__getitem__`、`class.__setitem__`、`class.__delitem__`：将对象当作字典，但可以进行调用权限控制

  ```python
  class Dog():
      def __init__(self):
          self.data = {}
      def __getitem__(self, key):
          print("__getitem__ key: %s" % key)
          return self.data.get(key)
      def __setitem__(self, key, value):
          print("__setitem__ key: %s, value: %s" % (key,value))
          self.data[key] = value
      def __delitem__(self, key):
          print("__delitem__", "key: %s" % key)

  >>> d = Dog()
  >>> d['name'] = 'tom'
  __setitem__ key: name, value: tom
  >>> d['name']
  __getitem__ key: name
  'tom'
  >>> del d['name']
  __delitem__ key: name
  ```

## 静态方法、类方法与继承

静态方法虽然定义在类中，但与类没有实际关系。需要在定义时，添加`@staticmethod`，而调用时，仍然是通过类的对象或类调用。

```python
class Person(object):
    def __init__(self, name="AAA"):
        self.name = name

    def eat(self):
        print("{} is eating".format(self.name))

    @staticmethod
    def drink(self):
        print("{} is drinking".format(self.name))

p = Person()
# 普通方法可不需要参数
p.eat()

# 静态方法必须传入一个该类的对象
print("通过对象p调用静态方法：")
p.drink(p)
print("-------------------------")
print("通过类直接调用静态方法：")
Person.drink(p)

# 执行结果
AAA is eating
通过对象p调用静态方法：
AAA is drinking
-------------------------
通过类直接调用静态方法：
AAA is drinking
```

静态方法只是名义上归类管理，实际上静态方法中无法访问类或实例中的任何属性。

类方法只能访问类变量，不能访问实例变量。在定义方法前加上`@classmethod`标记，可通过类的对象或类直接调用。

```python
class Person(object):
    name = "BBB"
    # 初始化方法对类方法的参数无效
    def __init__(self, name="AAA"):
        self.name = name

    @classmethod
    def drink(self):
        print("{} is drinking".format(self.name))

p = Person()
p.drink()
Person.drink()

# 执行结果
BBB is drinking
BBB is drinking
```

属性方法会把一个方法变为一个静态属性，即不能作为一个函数（有括号的）。只能通过对象调用，不能直接类名调用。

```python
class Person(object):
    def __init__(self, name="AAA"):
        self.name = name

    @property
    def drink(self):
        print("{} is drinking".format(self.name))

p = Person()
p.drink

# 如果方法是带参数的，则这样调用会出错。
    @property
    def drink(self, something):
        print("{} is drinking {}".format(self.name, self.something))

```

解决方法：设置一个专门的设置属性值的函数 setter，而原来的属性方法就不需要带参数了，而让 setter 方法进行设置参数值。setter 方法就是类似 java 的 setter 方法

```python
    @property
    def drink(self):
        print("{} is drinking {}".format(self.name, self.something))

    @drink.setter
    def setDrink(self, something):
      self.something = something
      print("set drink to : {}".format(self.something))

p = Person()
# 先调用setter方法设置属性值
p.setDrink = "coffee"
p.drink

# 执行结果
set drink to : coffee
AAA is drinking coffee
```

同理，删除对象属性的方法 deleter 也可定义。

```python
    @drink.deleter
    def deleteDrink(self):
      print("delete drink {}".format(self.something))
      del self.something

p = Person()
p.drink = "coffee"
del p.deleteDrink
try:
  print(p.something)
except:
  print("p.something属性已被删除")

# 执行结果
set drink to : coffee
delete drink coffee
p.something属性已被删除
```

## \_\_new\_\_和 metaclass

```
>>> class Foo(object):
...     def __init__(self, name):
...         self.name = name

>>> f = Foo("tom")  # 普通方式创建类的实例
>>> print(type(f))    # 对象实例的类型是Foo
<class '__main__.Foo'>
>>> print(type(Foo))    # 类Foo的类型是type
<class 'type'>

特殊方法创建类实例
>>> def func():
...   print("func_1")
...
>>> Foo = type('Foo', (), {'func_1': func})
>>> print(type(Foo))
<class 'type'>
>>> f = Foo
>>> f.func_1()  # Foo对象调用方法func
func_1


>>> def __init__(self, name):
...     self.name = name
...     print("__init__ %s" % name)
...
>>> def func(self):
...     print("func_1", self.name)
...
>>>
>>> Foo = type('Foo', (object,), {'func_1': func, '__init__': __init__})
>>> foo = Foo("tom")  # 实例创建完成
__init__ tom
>>> foo.func_1()
func_1 tom
```

因此可知，**类是由`type`类实例化产生的。**那么 type 类又是如何创建类的呢、如何创建对象的？

**类中有一个属性`__metaclass__`，用来表示该类由谁来实例化创建，通过`__metaclass__`设置一个 type 类的派生类**

```
class Foo(object):
    def __init__(self, name):
        self.name = name
        print("Foo __init__")

    def __new__(cls, *args, **kwargs):
        print("Foo __new__")

先创建一个对象
>>> foo = Foo("tom")
Foo __new__
```

可以知道创建对象时只调用了`__new__`，而且没有执行`__init__`，并没有实例化。**因此，可以得知`__new__`是真正实现实例化的方法。并且当创建类时，会自动已经创建好`__new__`，并不需要重写。**

因为此时`__new__`还没有真正创建好实例，所以要添加一条

```
    def __new__(cls, *args, **kwargs):
        print("Foo __new__")
        # 返回类的实例，cls即为Foo类本身，继承父类的__new__方法
        return object.__new__(cls)
```

## 反射

反射就是**通过字符串映射或修改程序运行时的状态、属性、方法。**

- `hasattr(object, func)`：判断对象是否有指定方法、属性、状态，若有则返回 True，否则返回 False

  ```
  >>> class Dog(object):
  ...     def __init__(self, name):
  ...         self.name = name
  ...     def eat(self):
  ...         print("%s is eating" % self.name)
  ...

  >>> dog = Dog("tom")  # 创建对象
  >>>
  >>> choice = input("input func name: ")
  input func name: eat
  >>> print(hasattr(dog, choice))   # 若对象有该方法，就返回True
  True
  >>> choice = input("input func name: ")
  input func name: walk
  >>> print(hasattr(dog, choice))  # 若对象没有该方法，返回False
  False
  ```

- `getattr(obj, func)`：获取该状态、属性、方法

  ```
  >>> choice = input("input func name: ")
  input func name: eat
  >>> getattr(dog, choice)  # 得到方法的内存地址
  <bound method Dog.eat of <__main__.Dog object at 0x00000201A8B0A3C8>>
  >>> getattr(dog, choice)()  # 执行方法
  tom is eating

  # 因此可以这样写
  >>> if hasattr(dog, choice):
  ...     getattr(dog, choice)()
  ...
  tom is eating
  ```

- `setattr(obj, name, value)`：设置状态、属性、方法

  ```
  >>> def inputError():
  ...     print("input wrong func name")
  ...
  >>> if hasattr(dog, choice):
  ...     getattr(dog, choice)()
  ... else:
  ...     setattr(dog, choice, inputError)  # 若输入不存在，则将choice设为一个指定方法
  ...
  input wrong func name
  ```

- `delattr(obj, name)`：删除指定的属性或方法

  ```
  >>> choice = input("input func name: ")
  input func name: eat
  >>> if hasattr(dog, choice):
  ...     delattr(dog, choice)   # 删除choice
  ... else:
  ...     setattr(dog, choice, inputError)
  ...
  Traceback (most recent call last):
    File "<stdin>", line 2, in <module>
  AttributeError: eat   # 报错，已没有choice
  ```

# 测试

# 进程与线程

# 正则表达式

# 网络编程

套接字 socket 是计算机网络数据结构，在任何类型的通信开始之前，网络应用程序必须创建套接字。

Socket API 的调用顺序和 TCP 的数据流：

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203251137444.png)

python 网络编程需要使用 socket 库。

socket 具有很多的地址簇，其中常见的有：

- `AF_UNIX`：被绑定到一个文件系统的节点。会返回 Linux 的抽象命名空间中的地址的字节对象，此命名空间中的套接字可以与普通文件系统套接字通信，因此打算在 Linux 上运行的程序可能需要处理这两种类型的地址。
- `AF_INET`：IPv4 的地址信息，是一对`(host, port)`，host 可以是 IP 地址或是域名
- `AF_INET6`：IPv6 的地址信息，是一对`(host, port, flowinfo, scopeid)`

客户端简单实现：

```
import socket
client = socket.socket()  # 生成socket对象（连接）

client.connect(('localhost', 9000))  # 连接端口，参数为主机和端口的元组
client.send(b"hello")   # python3规定必须为字节流，所以必须转换

print("开始接收server端返回信息")
server_data = client.recv(1024)  # 接收server的返回信息
print("recv:", server_data)
```

服务器端简单实现：

```
import socket, os
server = socket.socket()
server.bind(('localhost', 9000))   # 绑定本地端口

print("server开始监听")
server.listen()   # 开始监听

conn, addr = server.accept()   # 准备接收数据，会返回连接对象和对端IP地址
# conn就是客户端连接服务器时，服务器为其生成的一个连接对象
print("conn: ", conn, ",addr: ", addr)

print("开始接收client信息")
client_data = conn.recv(1024)  # 接收客户端数据
print("recv: ", client_data)

conn.send(client_data)
server.close()
```

先开启 server 程序，之后执行 client 程序

```
# 开启server端
python sock_server.py
server开始监听
conn:  <socket.socket fd=524, family=AddressFamily.AF_INET, type=SocketKind.SOCK_STREAM, proto=0, laddr=('127.0.0.1', 9000), raddr=('127.0.0.1', 12215)> ,addr:  ('127.0.0.1', 12215)
开始接收client信息
recv:  b'hello'

# 开启client端
python sock_client.py
开始接收server端返回信息
recv: b'hello'
```

而此时若传输中文就会报错

```
python3规定必须为字节流，所以必须转换
SyntaxError: bytes can only contain ASCII literal characters.
```

需要在客户端修改

```
client.send("你好".encode('utf-8'))
```

然后服务器端会收到：

```
recv:  b'\xe4\xbd\xa0\xe5\xa5\xbd'
```

因此需要在服务器端解码

```
print("recv: ", client_data.decode())
```

若要服务器端不断监听，客户端不断发送

```
# 客户端只要在send嵌套在while中即可
while True:
    msg = input(">> ").strip()
    client.send(msg.encode("utf-8"))

# 服务器端只要在recv嵌套在while中即可
# accept一定要在while外面，否则会出错卡住
while True:
    client_data = conn.recv(1024)  # 接收客户端数据
    print("recv: ", client_data.decode())
```

# 数据库编程

# 文本处理

# 协程与异步 IO


# Web 编程

# 常见内建模块

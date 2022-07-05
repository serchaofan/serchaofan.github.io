---
title: NFS基础笔记
date: 2018-05-02 17:18:46
tags: [NFS]
categories: [存储]
comments: false
---

- [NFS 原理](#nfs-原理)
- [NFS 基础配置](#nfs-基础配置)
  - [服务器端](#服务器端)
  - [NFS 客户端](#nfs-客户端)
  - [nfs 挂载优化](#nfs-挂载优化)
    - [系统安全相关](#系统安全相关)
    - [挂载性能相关](#挂载性能相关)
<!-- more -->

# NFS 原理

NFS（Network Files Network）网络文件系统，允许网络中主机通过通过 TCP/IP 进行资源共享。采用 C/S 工作模式，NFS 服务器相当于文件服务器，将某个目录设置为输出目录，客户端可将服务器端的输出目录挂载在本地进行访问。NFSv4 基于 TCP，端口号 2049。
RPC（Remote Procedure Call）远程过程调用，是一种通过网络从远程计算机程序上请求服务，跨越了传输层和应用层的协议。
NFS 在传输数据时使用的端口会随机选择，而客户端是通过 RPC 知道服务器端使用的哪个端口传输数据。NFS 的 RPC 主要功能是记录每个 NFS 功能对应的端口号，并在 NFS 客户端请求时将该端口和功能信息传给该客户端，确保客户端连到正确的端口。
当 NFS 服务启动时会随即取用若干端口，并主动向 RPC 服务注册这些端口，然后 RPC 使用固定的 111 端口监听 NFS 客户端请求，并将正确的端口信息返回给客户端。

**注：** 在启动 NFS 之前先要启动 RPC 服务，否则 NFS 无法向 RPC 注册，若 RPC 重启则原来注册的数据就全部丢失，NFS 也需重启以重新注册 RPC。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120045970.png)

1. 用户访问 web 页面，web 服务器上的 nfs 客户端便会向后端的 NFS 服务器通过 rpc 服务发出请求。
2. nfs 服务器端 rpc 找到对应注册的 nfs 端口后，通知 nfs 客户端的 rpc
3. nfs 客户端得到了服务器端的取数据的端口，与 nfs daemon 连接存取数据
4. nfs 客户端在将得到的文件传给前端

**NFS 局限：**

- 存在单点故障，可通过高可用集群解决
- 高并发场景，NFS 性能有限
- 客户端认证基于 IP 和主机名，安全性一般
- NFS 传输明文，不对数据完整性验证
- 多台客户端挂载一个 NFS 时，耦合度高，管理维护麻烦

# NFS 基础配置

环境：

- 两台虚拟机
  192.168.163.103/24
  192.168.163.104/24
- 系统：CentOS7
- Selinux：关闭
- 防火墙：关闭

## 服务器端

NFS 服务依赖于 RPC 服务与外界通信，所以需要安装 rpcbind 程序
而 NFS

1. 安装 NFS 主程序和 RPC 程序
   `yum install nfs-utils rpcbind`
   `systemctl enable nfs-server`
   `systemctl start nfs-server rpcbind.service`
2. 配置文件`/etc/exports`

可通过`rpcinfo -p localhost`查看已注册的端口

```
# rpcinfo -p localhost
   program vers proto   port  service
    100000    4   tcp    111  portmapper
    100000    3   tcp    111  portmapper
    100000    2   tcp    111  portmapper
    100000    4   udp    111  portmapper
    100000    3   udp    111  portmapper
    100000    2   udp    111  portmapper
    100024    1   udp  49302  status
    100024    1   tcp  49199  status
    100005    1   udp  20048  mountd
    100005    1   tcp  20048  mountd
    100005    2   udp  20048  mountd
    100005    2   tcp  20048  mountd
    100005    3   udp  20048  mountd
    100005    3   tcp  20048  mountd
    100003    3   tcp   2049  nfs
    100003    4   tcp   2049  nfs
```

nfs 相关进程

- rpc.statd：检查文件一致性
- rpc.idmapd：名字映射
- rpc.mountd：权限管理验证（nfs mount daemon）
- nfsd：NFS 主进程，管理登入，ID 身份判明等

**`/etc/exports`文件配置**

```
# 格式为：共享目录  分享给的主机1(参数)  主机2(参数) ...
/var/nfsshare  192.168.163.*(rw,sync)  *.example.com(rw)
# 客户端地址可以是 IP、主机名、域名、网段
```

**参数列表**

| 参数           | 含义                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| ro             | 客户端只读                                                                     |
| rw             | 客户端可读写                                                                   |
| sync           | 数据同步写入内存与磁盘，保证数据一致性，效率低                                 |
| async          | 异步 IO，数据先暂时存与内存，待需要时写入硬盘，效率高，但数据丢失风险高        |
| noaccess       | 阻止访问该目录及其子目录                                                       |
| all_squash     | 无论 NFS 客户端使用什么用户访问，都映射为 NFS 服务器端的匿名用户，即 nfsnobody |
| root_squash    | 当 NFS 客户端使用 root 访问时，映射为 NFS 服务器端的匿名用户，即 nfsnobody     |
| no_root_squash | 当 NFS 客户端使用 root 访问时，仍映射为 NFS 服务器端的 root，并不安全          |
| wdelay         | 为合并多次更新而延迟写入磁盘                                                   |
| no_wdelay      | 尽可能快地写入磁盘                                                             |
| secure         | 限制 nfs 服务只能使用小于 1024 的 TCP/IP 端口传输数据                          |
| insecure       | 可使用大于 1024 的端口                                                         |
| anounuid       | 指定 NFS 服务器中的用户为匿名用户                                              |
| anoungid       | 指定 NFS 服务器中的用户组为匿名用户组                                          |

> 默认情况下，nfs 服务会禁止客户端的 root 用户对共享目录进行写操作，目的是为了保证当 nfs 以共享目录工作时，共享目录的数据不会被客户端随意修改，但是当 nfs 以远程存储工作时，这个功能就不合理，所以当 nfs 以远程存储来工作时，需要在服务端设置 no_root_squash 选项关闭该功能。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120045184.png)

配置完后使用`exportfs -rv`命令，不需要重启 NFS。

```
exportfs
	-a  导出所有列在/etc/exports的目录
	-v  显示所有被导出或取消导出的目录
	-r  重新导出所有列在/etc/exports的目录
	-u [目录] 取消指定目录的导出，与-a同时用时，会取消配置文件中所有目录的导出
```

`nfsstat`命令可查看当前 NFS 信息

```
nfsstat
	-s 显示NFS服务器信息
	-c 显示NFS客户端信息
	-m 显示每个NFS文件系统的统计信息（在客户端上查看）
	-r 显示RPC信息
```

若开启了 firewalld，则需要放行 nfs 和 rpcbind 还有 mountd 服务，放行端口 2049

```
firewall-cmd --permanent --add-service=nfs
firewall-cmd --permanent --add-service=rpc-bind
firewall-cmd --permanent --add-service=mountd
firewall-cmd --permanent --add-port=2049/tcp 文件
chcon -R -t public_content_t /var/nfsshare
setsebool -P nfs_export_all_rw on
setsebool -P nfs_export_all_ro on
```

## NFS 客户端

1. 需要安装`nfs-utils rpcbind`
   `yum install nfs-utils rpcbind`
2. 通过`showmount`查看 NFS 服务器的共享信息

```
showmount [options] [NFS服务器]
	-e 显示NFS服务器的共享列表
	-a 显示本机挂载NFS资源情况
```

```
# showmount -e 192.168.163.102
Export list for 192.168.163.102:
/var/nfsshare 192.168.163.*
```

3. 挂载到本机

```
# mkdir /nfsshare  #创建挂载目录
# mount -t nfs 192.168.163.102:/var/nfsshare /nfsshare
# df -h
Filesystem                     Size  Used Avail Use% Mounted on
......
192.168.163.102:/var/nfsshare   17G  8.1G  9.0G  48% /nfsshare
```

在 mount 时也可使用`-o`指定文件系统的选项

```
	rsize=   从NFS服务器读文件时每次使用的字节数，默认1024字节
	wsize=   向NFS服务器写文件时每次使用的字节数，默认1024字节
	timeo=   RPC调用超时后，确定重试算法的参数
	soft   软挂载方式，当客户端请求得不到回应时，提示IO错误并退出
	hard   硬挂载方式，当客户端请求得不到回应时，提示服务器无响应，但继续请求。默认硬挂载
	intr   NFS文件操作超时并时硬挂载时，允许中断文件操作并向调用它的程序返回EINTR
	ro   只读方式挂载NFS文件系统
	rw   读写方式挂载NFS文件系统
	fg   在前台重试挂载
	bg   在后台重试挂载
```

也可通过配置文件`/etc/fstab`开机自动挂载

```
# vim /etc/fstab
......
192.168.163.102:/var/nfsshare  /nfsshare  nfs  defaults 0 0
```

**使用 mount 或配置文件/etc/fstab 挂载的不足：**NFS 服务器与客户端的连接不是永久的，任何一方的掉线都会导致另一方等待超时。并且即使很多用户都挂载了共享目录，也会有大部分的用户在大部分时间是不会使用的，这样造成了 NFS 服务器资源的大量消耗。可通过 autofs 服务按需动态挂载解决该问题。

4. 使用 autofs 自动挂载
   autofs 是一个提供按需挂载的服务，只有在用户访问该挂载点时才会动态挂载该共享目录。
   安装 autofs 程序，并开机自启
   `yum install autofs`
   `systemctl enable autofs.service`
   `systemctl start autofs.service`
   创建 autofs 关于 nfs 主配置文件，也可以直接在 autofs 的主配置文件`/etc/auto.master`中添加内容。

```
# vim /etc/auto.master.d/nfs.autofs
主配置文件的配置格式：
挂载点顶层目录      映射文件
/nfs                  /etc/nfs.misc
由于挂载点为/nfs/share，所以顶层目录为/nfs
```

创建 nfs 配置的映射文件`/etc/nfs.misc`

```
# vim /etc/nfs.misc
映射文件格式：
挂载点     [-挂载选项]       NFS服务器名或IP:共享目录
挂载点是对于挂载点顶层目录的相对路径
share   -fstype=nfs,rw   192.168.163.102:/var/nfsshare
```

配置完成后重启 autofs 服务即可。
进入`/nfs`目录中，查看并无内容。然后进入`share`便可查看到挂载目录的内容。再通过`df`查看，已成功挂载。

**注：**由于在客户端挂载时也会指定选项，若与服务器端选项不同，在执行操作时可能会报错，即：选项以服务器端配置为准。

## nfs 挂载优化

### 系统安全相关

对企业一般来说，NFS 只共享静态数据，不需要 suid、exec 权限，不应允许执行命令。所以在挂载时应该指定以下参数

```
mount -t nfs -o nosuid,noexec,nodev,rw 10.0.0.1:/data /mnt
```

### 挂载性能相关

- 禁止更新目录及文件时间戳挂载
  ```
  mount -t nfs -o noatime,nodiratime 10.0.0.1:/data
  ```
- 安全加优化
  ```
  mount -t nfs -o nosuid,noexec,nodev,noatime,nodiratime,intr,rsize=131072,wsize=131072 10.0.0.1:/data /mnt
  ```
  > rsize 为 nfs 客户端读 server 的数据块大小，wsize 为 nfs 客户端写 server 的数据块大小，最好设为 1024 的倍数
  > 配置这两个参数可以让一次读写更多数据包，提高访问性能
- 内核层面优化
  - `net.core.wmem_default`：接受套接字缓冲区大小的默认值，默认为 124928
  - `net.core.rmem_default`：发送套接字缓冲区大小的默认值，默认为 124928
  - `net.core.rmem_max`：接受套接字缓冲区大小的最大值，默认同上
  - `net.core.wmem_max`：发送套接字缓冲区大小的最大值，默认同上
    **可以将这些参数调大**

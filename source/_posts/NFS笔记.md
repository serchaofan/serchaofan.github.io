---
title: NFS基础笔记
date: 2018-05-02 17:18:46
tags: [server, nfs]
categories: [应用运维]
---

本篇笔记包含以下内容：

- [NFS 原理](#NFS原理)
- [NFS 基础配置](#NFS基础配置)
  - [服务器端](#服务器端)
  - [客户端](#客户端)
    <!-- more -->

## NFS 原理

NFS（Network Files Network）网络文件系统，允许网络中主机通过通过 TCP/IP 进行资源共享。采用 C/S 工作模式，NFS 服务器相当于文件服务器，将某个目录设置为输出目录，客户端可将服务器端的输出目录挂载在本地进行访问。NFSv4 基于 TCP，端口号 2049。
RPC（Remote Procedure Call）远程过程调用，是一种通过网络从远程计算机程序上请求服务，跨越了传输层和应用层的协议。

## NFS 基础配置

环境：

- 两台虚拟机
  192.168.163.103/24
  192.168.163.104/24
- 系统：CentOS7
- Selinux：关闭
- 防火墙：关闭

### 服务器端

NFS 服务依赖于 RPC 服务与外界通信，所以需要安装 rpcbind 程序
而 NFS

- 安装 NFS 主程序和 RPC 程序
  `yum install nfs-utils rpcbind`
  `systemctl enable nfs-server`
  `systemctl start nfs-server rpcbind.service`
- 配置文件`/etc/exports`

```
# 格式为：共享目录  分享给的主机1(参数)  主机2(参数) ...
/var/nfsshare  192.168.163.*(rw,sync)  *.example.com(rw)
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

配置完后重启 nfs-server 服务，或者使用`exportfs`命令

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
firewall-cmd --permanent --add-port=2049/tcp 2049/udp
```

> mountd 提供挂载服务，与 nfs 无关，只是为了方便客户端挂载

若开启了 Selinux，需要添加上下文

```
chcon -R -t public_content_t /var/nfsshare
setsebool -P nfs_export_all_rw on
setsebool -P nfs_export_all_ro on
```

### NFS 客户端

- 需要安装`nfs-utils rpcbind`
  `yum install nfs-utils rpcbind`
- 通过`showmount`查看 NFS 服务器的共享信息

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

- 挂载到本机

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

- 使用 autofs 自动挂载
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

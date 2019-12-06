---
date: 2018-01-29 8:32:43
title: iSCSI学习笔记
tags: [server,iSCSI]
---
## iSCSI学习笔记-1
**第一篇iSCSI笔记主要是基础配置，包含以下内容**

* iSCSI介绍
* iSCSI基础搭建

<!-- more -->

##### 常见存储方式
* DAS 直接附加存储：外接存储设备直接连在服务器内部总线上，数据存储设备是整个服务器结构的一部分。
* NAS 网络接入存储：存储设备独立于服务器，作为文件服务器独立存在与网络中。存储设备通过标准的网络拓扑（如以太网）添加到一群计算机。
* SAN 存储区域网络：创造了存储的网络化。包含两种部署方式
 1. FCSAN：使用光纤通道
 2. IPSAN：使用IP通道（如以太网线与iSCSI技术）

##### SCSI与iSCSI
* SCSI 小型计算机系统接口：一种通用接口标准，多用于服务器系统级接口。SCSI 结构基于C/S模式，其通常应用环境是：设备互相靠近，并且这些设备由 SCSI 总线连接。
* iSCSI Internet小型计算机系统接口：一种基于TCP/IP的协议，用于建立管理IP存储设备、主机与客户机之间的连接，并创建SAN。SAN 使得 SCSI 协议应用于高速数据传输网络成为可能，这种传输以数据块级别（block-level）在多个数据存储网络间进行。

iSCSI 的主要功能是在 TCP/IP 网络上的主机系统（启动器 initiator）和存储设备（目标器 target）之间进行大量数据的封装和可靠传输。此外，iSCSI 提供了在 IP 网络封装 SCSI 命令，且运行在 TCP 上。

* 服务器：target   
* 客户端：initiator

#### 实验
环境<br>
* CentOS7，内核3.10
* 两台虚拟机，system1与system2，system1为服务器，system2为客户端
* 虚拟机网段192.168.163.0/24
* system1 IP：192.168.163.100/24
* system2 IP：192.168.163.102/24

首先搭建服务器
1. 安装target与targetcli并开机启动
服务器端要安装的服务为targetd，还需安装targetcli程序进行配置
```
yum install targetd targetcli
systemctl enable targetd target
systemctl start targetd target
```
2. 确保系统有空闲可用的裸磁盘
本处选择/dev/sdc1，大小5G
3. 进入`targetcli`程序配置
```
目录结构
o- /                
  o- backstores     
  | o- block        
  | o- fileio       
  | o- pscsi        
  | o- ramdisk      
  o- iscsi          
  o- loopback       
```
进入block，创建设备disk1
`create dev=/dev/sdc1 name=disk1`
另一种写法
`create disk1 /dev/sdc1`
然后进入iscsi目录，设置服务器端识别号
>识别号规范：iqn.年-月.域名反置:服务器主机名

`create wwn=iqn.2018-01.com.example:system1`
该标识符可以自己设定如上配置，也可让系统自动生成直接在iscsi目录中`create`
设置后iscsi目录结构如下
```
o- iscsi 
  o- iqn.2018-01.com.example:system1 
    o- tpg1 
      o- acls 
      o- luns 
      o- portals 
        o- 0.0.0.0:3260 
```
进入acls/ 添加客户端身份标识
`create wwn=iqn.2018-01.com.example:system2`
进入luns/ 给该组设置可用的存储设备
`create /backstores/block/disk1`
disk1就是block中创建的设备名
此时iscsi目录结构
```
o- iscsi 
  o- iqn.2018-01.com.example:system1 
    o- tpg1 
      o- acls 
      | o- iqn.2018-01.com.example:system2 
      |   o- mapped_lun0 
      o- luns 
      | o- lun0 
      o- portals 
        o- 0.0.0.0:3260 
```
进入portals/ 修改服务端端口号
有可能里面没有默认配置，直接创建。若有默认配置就先删除再创建`delete 0.0.0.0 ip_port=3260`
`create 192.168.163.100 3260`
此处ip地址为服务器端IP，端口号为3260
全部配置完exit退出配置程序
4. 防火墙放行对应端口号，重启服务
端口号3260，且tcp端口放行
```
firewall-cmd --permanent --add-port=3260/tcp
firewall-cmd --reload
systemctl restart targetd target
```

然后是客户端搭建
1. 安装客户端软件
`yum install iscsi-initiator-utils`
2. 设置客户端识别号
该文件需要自己输入配置，输入客户端的识别码
`vim /etc/iscsi/initiatorname.iscsi`
`initiatorname=iqn.2018-01.com.example:system2`
3. 启动服务
`systemctl enable iscsi iscsid`
`systemctl start iscsi iscsid`
4. 获取硬盘
`iscsiadm -m discovery -t st -p 192.168.163.100 -l`
> iscsiadm 用于管理iSCSI数据库配置文件的命令行工具
-m discovery 表示发现查找
-t senbtargets  表示发布的target，简写st 
-p IP 指定服务器地址 
-l 表示login，可不加

```
连接成功信息:
Logging in to [iface: default, target: iqn.2018-01.com.example:system1, portal: 192.168.163.100,3260] (multiple)
Login to [iface: default, target: iqn.2018-01.com.example:system1, portal: 192.168.163.100,3260] successful.
```
通过命令`lsblk`查看是否拿到
```
[root@system2 ~]# lsblk
NAME            MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
sda               8:0    0   20G  0 disk 
├─sda1            8:1    0    1G  0 part /boot
└─sda2            8:2    0   19G  0 part 
  ├─centos-root 253:0    0   17G  0 lvm  /
  └─centos-swap 253:1    0    2G  0 lvm  [SWAP]
sdb               8:16   0    5G  0 disk 
sr0              11:0    1 1024M  0 rom  

```
发现出现了sdb，大小为5G，已成功获取
---
title: KVM学习笔记
date: 2018-10-03 08:33:46
tags: [KVM, 虚拟化]
---

* [虚拟化概述](#虚拟化概述)
* [KVM概述](#KVM概述)
* [KVM操作](#KVM操作)

<!--more-->



# 虚拟化概述











# KVM概述

KVM（Kernel-based Virtual Machine）基于内核的虚拟机，是一个Linux内核模块，使得Linux变成一个Hypervisor（一个虚拟化的管理程序）。











## KVM环境

首先要查看本机是否支持KVM，KVM基于x86虚拟化扩展技术（`Intel VT`或`AMD-V`）。

可通过`cat /proc/cpuinfo | egrep "vmx|svm"`查看，若有返回，则说明支持。其中`vmx`是对应Intel的处理器，`svm`是对应AMD的处理器，根据本机情况查找关键字。

或者可通过`lsmod | grep kvm`查看，若有该模块也可说明支持。

若用VMware虚拟机，需要在虚拟机的settings中开启虚拟化选项

{% asset_img 0.png %}

确保已关闭selinux。



安装kvm相关包（并非都要装）

* `qemu-kvm` 主要的KVM程序包
* `virt-manager` GUI虚拟机管理工具（需要桌面环境）
* `virt-top` 虚拟机统计命令
* `virt-viewer` GUI连接程序，连接到已配置好的虚拟机
* `libvirt` C语言工具包，提供libvirt服务
* `libvirt-client` 为虚拟客户机提供的C语言工具包
* `virt-install` 基于libvirt服务的虚拟机创建命令
* `bridge-utils` 创建和管理桥接设备的工具

> libvirt是KVM的管理工具，包含守护进程程序libvirtd，API库和命令行工具virsh

`dnf install qemu-kvm libvirt virt-install bridge-utils `，这是命令行操作kvm需要的软件。开启KVM服务`systemctl start libvirtd`，并设置开机启动。

在启动以后，会自动创建一张虚拟网卡

```
virbr0: flags=4099<UP,BROADCAST,MULTICAST>  mtu 1500
        inet 192.168.122.1  netmask 255.255.255.0  broadcast 192.168.122.255
        ether 52:54:00:b0:61:8a  txqueuelen 1000  (Ethernet)
```

并且还会启动dnsmasq服务

```
nobody     6320      1  0 18:39 ?        00:00:00 /sbin/dnsmasq --conf-file=/var/lib/libvirt/dnsmasq/default.conf --leasefile-ro --dhcp-script=/usr/libexec/libvirt_leaseshelper
root       6323   6320  0 18:39 ?        00:00:00 /sbin/dnsmasq --conf-file=/var/lib/libvirt/dnsmasq/default.conf --leasefile-ro --dhcp-script=/usr/libexec/libvirt_leaseshelper
```

网卡的配置存放在`/etc/libvirt/qemu/networks/default.xml`中。



# KVM操作

创建一个硬盘`qemu-img create -f raw /opt/kvm.raw 10G`，这里创建的硬盘虽然还没使用，但会直接占用硬盘空间，需要有一定的大小，因为要装系统。

```
# ll -h /opt/kvm.raw 
-rw-r--r-- 1 root root 1.0G 11月 12 18:49 /opt/kvm.raw
```

可通过`qemu-img info /opt/kvm.raw `查看该硬盘的信息

```
image: /opt/kvm.raw
file format: raw
virtual size: 1.0G (1073741824 bytes)
disk size: 0`
```

若硬盘空间不够，就添加虚拟硬盘。注意，需要在虚拟机里有安装的镜像，所以要在虚拟机设置中把镜像设置连接。

{% asset_img 1.png %}

然后创建镜像，把`/dev/cdrom`复制到一个容量足够的目录中。`dd if=/dev/cdrom of=/disk/sdb1/fedora25.iso`

创建一个虚拟机

```
virt-install --virt-type kvm \
             --name kvm-fedora \
             --ram 512 \
             --cdrom=/disk/sdb1/fedora27.iso \
             --network network=default \
             --noautoconsole \
             --os-type=linux \
             --os-variant=fedora25 \
             --graphics vnc,listen=0.0.0.0 \
             --disk path=/opt/kvm.raw
           
提示开始安装，使用ss -anpt查看端口变化
State      Recv-Q Send-Q        Local Address:Port                       Peer Address:Port              
LISTEN     0      1                         *:5900                                  *:*          
开始监听5900端口
```

此时查看创建的KVM虚拟机，如果没有，可能是没有启动，可通过加上`--all`显示所有虚拟机

```
# virsh list
 Id    名称                         状态
----------------------------------------------------
 1     kvm-fedora                     running
```

也可查看本机信息

```
# virsh nodeinfo 
CPU 型号：        x86_64
CPU：               4
CPU 频率：        2399 MHz
.....
内存大小：      4027656 KiB
```

并且，会在`/etc/libvirt/qemu/`下创建了一个`kvm-fedora.xml`配置文件。

若没有启动，可通过`virsh start kvm-fedora`启动虚拟机。

`virsh destroy `停止指定虚拟机，还能通过`virsh list --all`查看到

`virsh undefine`删除标记，即彻底删除该虚拟机



> 参考资料
>
> [KVM --介绍](https://www.cnblogs.com/polly-ling/articles/7154334.html)
>
> [KVM虚拟化](https://www.cnblogs.com/chenjiahe/category/845519.html)
>
> [CentOS7安装KVM虚拟机详解](https://github.com/jaywcjlove/handbook/blob/master/CentOS/CentOS7%E5%AE%89%E8%A3%85KVM%E8%99%9A%E6%8B%9F%E6%9C%BA%E8%AF%A6%E8%A7%A3.md)
>
> [KVM](https://www.cnblogs.com/sammyliu/category/696699.html)
>
> [Cloudman-KVM](https://www.cnblogs.com/CloudMan6/tag/KVM/)


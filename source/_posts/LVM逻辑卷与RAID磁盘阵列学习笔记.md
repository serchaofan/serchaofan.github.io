---
title: LVM逻辑卷与RAID磁盘阵列学习笔记
date: 2018-08-01 20:55:08
tags: [LVM, RAID, Linux]
categories: [系统运维]
---

本篇包含以下内容

- [LVM 逻辑卷](#lvm-逻辑卷)
  - [LVM 概述](#lvm-概述)
  - [LVM 创建与调整](#lvm-创建与调整)
  - [LVM 快照](#lvm-快照)
- [RAID 磁盘阵列](#raid-磁盘阵列)
  - [RAID 概述](#raid-概述)
  - [RAID 基础搭建](#raid-基础搭建)
    - [使用`RAID 5`进行备份](#使用raid-5进行备份)
- [参考资料](#参考资料)

<!-- more -->

# LVM 逻辑卷

## LVM 概述

LVM(`Logical Volume Manager`)逻辑卷管理器，可以灵活调整存储空间大小，并不会对现有数据造成任何损坏。红帽系的系统全部默认开启了 LVM。

几个关键术语：

- PV(`Physical Volume`，物理卷)：最低层的存储设备（硬盘，分区）
- VG(`Volume Group`，卷组)：单个或多个 PV 构成的存储资源池，不能直接存放数据
- LV(`Logical Volume`，逻辑卷)：从 VG 中划分出的存储空间，可直接存放数据
- PE(`Physical Extend`，物理扩展单元)：逻辑层面上最小的存储单元（类似 block），一个 PE 大小 4MB，是告诉 PV，表明存储单元位于 PV 的哪个位置。PE 大小必须满足 2 的指数幂
- LE(`Logical Extend`，逻辑扩展单元)：与 PE 类似，默认情况下，PE 与 LE 一样大。LE 告诉 LV，表明存储单元处于 VG 的哪个位置

LVM 创建流程：

1. 使用几块硬盘或分区（未创建文件系统）创建物理卷，并将分区的识别号设置为 LVM，即`8e`
2. 将多个物理卷组合成一个卷组，卷组会根据指定的 PE 大小将空间划分为多个 PE，在 LVM 中存储以 PE 为单元
3. 在卷组中分出逻辑卷，这些逻辑卷在外界看来就是多个独立的硬盘分区
4. 对逻辑卷制作文件系统，并挂载

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120029437.png)

LVM 写入机制：
LV 是从 VG 中划分出来的，LV 中的 PE 很可能来自于多个 PV。在向 LV 存储数据时，有多种存储机制，其中两种是：

- 线性模式(`linear`)：先写完来自于同一个 PV 的 PE，再写来自于下一个 PV 的 PE。
- 条带模式(`striped`)：一份数据拆分成多份，分别写入该 LV 对应的每个 PV 中，所以读写性能较好，类似于 RAID 0。

尽管`striped`读写性能较好也不建议使用该模式，因为 lvm 的着重点在于弹性容量扩展而非性能，要实现性能应该使用 RAID 来实现，而且使用`striped`模式时要进行容量的扩展和收缩将比较麻烦。默认的是使用线性模式。

> 引用自[骏马金龙的 LVM 详解](http://www.cnblogs.com/f-ck-need-u/p/7049233.html#auto_id_1)

## LVM 创建与调整

实验环境：

- CentOS7
- `/dev/sdb`　大小 20G
- 将`/dev/sdb`分为 4 个分区，每个分区 5G，并将磁盘标识号设为`8e`，表示 LVM

```
# fdisk -l /dev/sdb

Disk /dev/sdb: 21.5 GB, 21474836480 bytes, 41943040 sectors
Units = sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
I/O size (minimum/optimal): 512 bytes / 512 bytes
Disk label type: dos
Disk identifier: 0xde948938

   Device Boot      Start         End      Blocks   Id  System
/dev/sdb1            2048    10487807     5242880   8e  Linux LVM
/dev/sdb2        10487808    20973567     5242880   8e  Linux LVM
/dev/sdb3        20973568    31459327     5242880   8e  Linux LVM
/dev/sdb4        31459328    41943039     5241856   8e  Linux LVM
```

1. 准备裸磁盘与裸分区，制作 PV
   使用`pvcreate [裸磁盘/裸分区]`创建 PV

```
# pvcreate /dev/sdb1 /dev/sdb2 /dev/sdb3 /dev/sdb4
  Physical volume "/dev/sdb1" successfully created.
  Physical volume "/dev/sdb2" successfully created.
  Physical volume "/dev/sdb3" successfully created.
  Physical volume "/dev/sdb4" successfully created.
```

可使用`pvdisplay [磁盘/分区]`查看 pv 信息

```
pvdisplay选项列表
  若不指定磁盘或分区，就是查看所有PV
  -m    # 查看该设备中PE的使用分布图
  -s    # 查看pv简短信息
```

`pvs`或`pvscan`也可查看所有 PV 信息

```
# pvscan
  PV /dev/sda2   VG centos          lvm2 [<19.00 GiB / 0    free]
  PV /dev/sdb4                      lvm2 [<5.00 GiB]
  PV /dev/sdb2                      lvm2 [5.00 GiB]
  PV /dev/sdb1                      lvm2 [5.00 GiB]
  PV /dev/sdb3                      lvm2 [5.00 GiB]
  Total: 5 [<39.00 GiB] / in use: 1 [<19.00 GiB] / in no VG: 4 [<20.00 GiB]
  最后一行显示的是"pv的总容量/已使用的pv容量/空闲的pv容量"
```

`pvremove [分区]`删除 PV
`pvmove [分区]`删除 PV 中的所有数据

2. 制作 VG
   `vgcreate [VG名][多个裸磁盘]`制作卷组

```
vgcreate选项列表
  -s    # 指定PE大小。不指定默认大小4M
  -l    # 卷组上允许创建的最大逻辑卷数
  -p    # 卷组中允许添加的最大物理卷数
  在创建VG后，只有VG没有数据时才能修改属性，如PE大小
```

```
# vgcreate -s 8M my_vg1 /dev/sdb1 /dev/sdb2
  Volume group "my_vg1" successfully created
# vgcreate -s 8M my_vg2 /dev/sdb3 /dev/sdb4
  Volume group "my_vg2" successfully created
```

`vgdisplay [VG名]`查看 VG 信息
`vgs`和`vgscan`也可显示所有 VG 信息

`vgreduce [VG名] [PV名]`从 VG 中删除指定 PV
`vgextend [VG名] [PV名]`添加 PV 到 VG 中

```
# vgreduce my_vg1 /dev/sdb2
  Removed "/dev/sdb2" from volume group "my_vg1"
# vgextend my_vg1 /dev/sdb2
  Volume group "my_vg1" successfully extended
```

```
vgchange [选项] [VG名]  修改卷组的属性
经常被用来设置卷组是处于活动状态或非活动状态。
处于活动状态的卷组无法被删除，必须使用vgchange命令将卷组设置为非活动状态后才能删除。
  -a y|n 设置卷组的活跃|非活跃状态
```

`vgremove [VG名]`删除 VG

3. 创建逻辑卷 LV
   `lvcreate -L N -n [LV名][VG名]`创建逻辑卷

```
lvcreate选项列表
  -L N    # 指定逻辑卷大小N，若N不是PE的整数倍，系统会自动将LV大小变大为PE整数倍
  -n      # 指定LV名
  -l n    # 指定PE个数，即通过PE个数指定逻辑卷大小
```

```
# lvcreate -L 6G -n my_lv1 my_vg1
  Logical volume "my_lv1" created.
# lvcreate -l 1000 -n my_lv2 my_vg2
  Logical volume "my_lv2" created.

# lvscan
  ACTIVE            '/dev/centos/swap' [2.00 GiB] inherit
  ACTIVE            '/dev/centos/root' [<17.00 GiB] inherit
  ACTIVE            '/dev/my_vg2/my_lv2' [7.81 GiB] inherit
  ACTIVE            '/dev/my_vg1/my_lv1' [6.00 GiB] inherit
```

`lvdisplay [LV名]`查看指定或所有 LV 详细信息
`lvs`和`lvscan`可查看全部 LV 信息

`lvextend [选项] +[扩容大小] [LV]`用于扩展逻辑卷的空间大小，而不中断应用程序对逻辑卷的访问

```
lvextend选项
  -L 指定逻辑卷的大小
  -l 指定逻辑卷的大小（LE数）
  若不添加加号，则要指定扩容后的大小（一定要比增容前大）
  若添加加号，则要指定要扩容的大小
```

```
# lvextend -L +100M /dev/my_vg1/my_lv1
  Rounding size to boundary between physical extents: 104.00 MiB.
  Size of logical volume my_vg1/my_lv1 changed from 6.00 GiB (768 extents) to 6.10 GiB (781 extents).
  Logical volume my_vg1/my_lv1 successfully resized.

# lvextend -l +10 /dev/my_vg2/my_lv2
  Size of logical volume my_vg2/my_lv2 changed from 7.81 GiB (1000 extents) to 7.89 GiB (1010 extents).
  Logical volume my_vg2/my_lv2 successfully resized.
```

`lvreduce [选项] -[缩小大小] [LV]`减少 LVM 逻辑卷占用的空间大小。有可能会删除逻辑卷上已有的数据
参数与用法与`lvextend`一致
`lvresize [选项] [+|-][扩大或缩小大小] [LV]`调整 LVM 逻辑卷的空间大小，可以增大空间和缩小空间，可能会使逻辑卷上已有的数据丢失
参数与用法与`lvextend`与`lvreduce`一致。

若该 LV 已制作完文件系统并挂载完成，而要对该 LV 进行容量的改变操作，首先需要`umount`将挂载取消，然后使用上述命令进行容量改变操作，然后再制作文件系统并挂载。
**然而，通过任何查看命令都会发现 LV 大小并没有改变。因此，在改变大小后，还要继续以下操作。**

- 若文件系统为`ext4`，则需要执行`resize2fs [LV路径]`
- 若文件系统为`xfs`，则需要执行`xfs_growfs [LV路径]`
  **xfs 文件系统只支持增大分区空间的情况，不支持减小的情况**。硬要减小的话，只能在减小后将逻辑分区重新通过 mkfs.xfs 命令重新格式化才能挂载上，这样的话这个逻辑分区上原来的数据就丢失了。
  `xfs`是不支持裁剪的，`ext`是支持裁剪的，所以`xfs`尽量不要缩小 LV

建议在修改容量后执行`e2fsck -f [LV路径]`检查是否修改后的大小会影响数据。

```
# e2fsck -f /dev/my_vg1/my_lv1
e2fsck 1.42.9 (28-Dec-2013)
Pass 1: Checking inodes, blocks, and sizes
Pass 2: Checking directory structure
Pass 3: Checking directory connectivity
Pass 4: Checking reference counts
Pass 5: Checking group summary information
/dev/my_vg1/my_lv1: 11/400624 files (0.0% non-contiguous), 64167/1599488 blocks
```

`lvremove [LV名]`删除指定 LV

## LVM 快照

LVM 提供快照功能，可将逻辑卷的数据进行备份，并可快速恢复

实验选用`/dev/my_vg1/my_lv1`，并将该 LV 挂载在`/my_lv1`

```
# lvdisplay /dev/my_vg1/my_lv1
  --- Logical volume ---
  LV Path                /dev/my_vg1/my_lv1
  LV Name                my_lv1
  VG Name                my_vg1
......
  LV Size                6.10 GiB
......
```

`lvcreate -s -n [快照名] -L [快照大小] [LV路径]`创建快照

```
  -s 创建快照
  -n 指定快照名
  -L 快照大小
```

```
# lvcreate -s -L 1G -n my_snapshot /dev/my_vg1/my_lv1
  Using default stripesize 64.00 KiB.
  Logical volume "my_snapshot" created.

可通过lvscan查看，最后多了一条快照信息
# lvscan
  ACTIVE            '/dev/centos/swap' [2.00 GiB] inherit
  ACTIVE            '/dev/centos/root' [<17.00 GiB] inherit
  ACTIVE            '/dev/my_vg2/my_lv2' [7.89 GiB] inherit
  ACTIVE   Original '/dev/my_vg1/my_lv1' [6.10 GiB] inherit
  ACTIVE   Snapshot '/dev/my_vg1/my_snapshot' [1.00 GiB] inherit
```

在`/my_lv1`中创建文件`dd if=/dev/zero of=/my_lv1/files count=1 bs=100M`
然后将该 LV 卸载`umount /my_lv1`
最后将快照恢复`lvconvert --merge /dev/my_vg1/my_snapshot`

```
# lvconvert --merge /dev/my_vg1/my_snapshot
  Merging of volume my_vg1/my_snapshot started.
  my_lv1: Merged: 69.90%
  my_lv1: Merged: 100.00%
快照恢复过后会自动删除
```

将 LV 重新挂载到`/my_lv1`，发现文件夹中已经没有任何文件了，说明快照恢复成功。

# RAID 磁盘阵列

## RAID 概述

Redundant Array of Independent Disks 独立硬盘组，作用是防止硬盘物理损坏以及增加存储设备的吞吐量。
常见的 RAID 形式有：`RAID 0`、`RAID 1`、`RAID 3`、`RAID 5`、`RAID 6`、`RAID 10`、`RAID 01`、`RAID 50`。

- `RAID 0`：将多个磁盘合并为 1 个大磁盘，读写速度极大提高，但不具冗余，因为通过硬件或软件串联，数据是依次被写入各个硬盘，所以任何一块损坏都会导致数据丢失。
- `RAID 1`：两组以上的 N 个硬盘相互做镜像，让数据被多块硬盘同时写入。一块损坏可立刻通过热交换恢复数据。由于做备份，硬盘空间只有 50%。
- `RAID 3`：将数据条块化分布于不同的硬盘上，使用简单的奇偶校验，并用单块磁盘存放奇偶校验信息。如果一块磁盘失效，奇偶盘及其他数据盘可以重新产生数据;如果奇偶盘失效则不影响数据使用。RAID 3 对于大量的连续数据可提供很好的传输率，但对于随机数据来说，奇偶盘会成为写操作的瓶颈。
- `RAID 5`：使用硬盘分割技术，至少需 3 块硬盘。既提高传输速度，也可实现镜像备份。但采用奇偶校验信息，写速度相当慢，读速度与 RAID0 相近，且镜像保障程度也不及 RAID1。空间利用率高。是在所有磁盘上交叉存储数据与奇偶校验信息，并不是单独保存在某块内存中，而是分别互相保存在每一块硬盘，raid5 并不是备份实际硬盘数据，而是在硬盘出现故障后通过奇偶校验信息尝试恢复数据。
  `RAID5`的利用率为总可用盘容量的`(n-1)/n`
- `RAID 6`：相较 RAID5 增加第二个独立的奇偶校验信息块，数据可靠性非常高，需要四个以上硬盘
- `RAID 7`：全称是最优化的异步高 I/O 速率和高数据传输率，不仅仅是一种技术，它还是一个独立存储计算机，自身带的操作系统和管理工具，完全可以独立运行。采用了非同步访问，极大地减轻了数据写瓶颈，提高了 I/O 速度，存储计算机操作系统可使主机 I/O 传递性能达到最佳，能够自动执行恢复操作，并可管理备份磁盘的重建过程。该技术已被 raid7 公司垄断。
- `RAID 10（企业主要用）/01`：
  - 10 为 1+0 先镜射再分割数据，两个两个组成 raid1，再两组两组组成 raid0，拥有较高速度与较高数据保护性，但需要 4 块以上且数量为偶数的硬盘数，因为使用 raid1，所以利用率也是 50%。安全性比 01 强，速度也比 01 强，恢复速度快于 5
  - 01 为 0+1 先分割再镜射，两个两个组 raid0，再两组两组组 raid1
- `RAID 50`：至少需要 6 块硬盘，将数据分为条带同时存入多个磁盘，以数据校验位保证数据安全，目的在于提高 RAID5 的读写性能

## RAID 基础搭建

RAID 的创建管理由`mdadm`命令实现

```
mdadm [模式] [RAID设备名] [选项] [成员设备]
  -a    # 检测设备名
  -As   # 激活raid（停止的时候）
  -n    # 指定设备数量
  -c    # 指定数据块大小
  -l    # 指定raid级别
  -C    # 创建
  -v    # 显示过程
  -G    # 修改raid
  -f    # 模拟设备损坏
  -r    # 移除设备
  [raid] -a [磁盘] 将磁盘添加到raid阵列
  [raid] -r [磁盘] 将磁盘移出raid阵列
  -Q    # 查看摘要信息
  -D    # 查看详细信息（cat /proc/mdstat查看阵列状态）
  -S    # 停止阵列
  -x    # 备份盘个数
  --detail   # 查看RAID阵列
```

实验目的：搭建`RAID 10`
实验环境

- CentOS7
- `/dev/sdb`分出 4 分区，每个 5G 大小

`mdadm -Cv /dev/md0 -a yes -n 4 -l 10 /dev/sdb1 /dev/sdb2 /dev/sdb3 /dev/sdb4`创建 RAID

可通过`cat /proc/mstat`查看简要 RAID 信息

```
# cat /proc/mdstat
Personalities : [raid10]
md0 : active raid10 sdb4[3] sdb3[2] sdb2[1] sdb1[0]
      10475520 blocks super 1.2 512K chunks 2 near-copies [4/4] [UUUU]
```

也可通过`mdadm -D /dev/md0`查看指定 RAID 信息

```
# mdadm -D /dev/md0
/dev/md0:
           Version : 1.2
     Creation Time : Thu Aug  2 09:56:25 2018
        Raid Level : raid10
        Array Size : 10475520 (9.99 GiB 10.73 GB)
      # Array Size总共能使用的空间，因为是raid10，所以总可用空间为400M左右，除去元数据，大于370M左右
     Used Dev Size : 5237760 (5.00 GiB 5.36 GB)
   # Used Dev Size每颗raid组或设备上的可用空间，也即每个RAID1组可用大小为190M左右
      Raid Devices : 4   # raid中设备的个数
     Total Devices : 4   # 总设备个数，包括raid中设备个数，备用设备个数等
       Persistence : Superblock is persistent

       Update Time : Thu Aug  2 09:57:17 2018
             State : clean
      # 当前raid状态，有clean/degraded(降级)/recovering/resyncing
    Active Devices : 4
   Working Devices : 4
    Failed Devices : 0
     Spare Devices : 0

            Layout : near=2
   # RAID10数据分布方式，有near/far/of set，默认为near，即数据的副本存储在相邻设备的相同偏移上。
   # near=2表示要备份2份数据
        Chunk Size : 512K

Consistency Policy : resync

              Name : bogon:0  (local to host bogon)
              UUID : 1aa0ce46:4762919a:71542e42:47b8bc7b
            Events : 17

    Number   Major   Minor   RaidDevice State
       0       8       17        0      active sync set-A   /dev/sdb1
       1       8       18        1      active sync set-B   /dev/sdb2
       2       8       19        2      active sync set-A   /dev/sdb3
       3       8       20        3      active sync set-B   /dev/sdb4
```

制作文件系统并挂载该 RAID
`mkfs.ext4 /dev/md0 && mount /dev/md0 /mnt/md0`

模拟 RAID 损坏，这里模拟损坏`/dev/sdb3`
`mdadm /dev/md0 -f /dev/sdb3`
此时查看 RAID 信息

```
# mdadm -D /dev/md0
......
             State : clean, degraded
    Active Devices : 3   # 活跃的设备仅3台
   Working Devices : 3   # 工作中的设备仅3台
    Failed Devices : 1   # 出现故障的设备1台
     Spare Devices : 0
......
    Number   Major   Minor   RaidDevice State
       0       8       17        0      active sync set-A   /dev/sdb1
       1       8       18        1      active sync set-B   /dev/sdb2
       -       0        0        2      removed
       3       8       20        3      active sync set-B   /dev/sdb4

       2       8       19        -      faulty   /dev/sdb3
　　　　# /dev/sdb3的状态为faulty
```

由于 raid10 允许一组 raid1 存在故障，不会影响使用。

进行恢复，首先要卸载文件系统`umount /mnt/md0`
然后移除`/dev/sdb3`，`mdadm /dev/md0 -r /dev/sdb3`
最后再次添加进 RAID 组，`mdadm /dev/md0 -a /dev/sdb3`
立刻查看 RAID 状态

```
# mdadm -D /dev/md0
......
   Active Devices : 3
   Working Devices : 4
    Failed Devices : 0
     Spare Devices : 1

            Layout : near=2
        Chunk Size : 512K

Consistency Policy : resync

    Rebuild Status : 38% complete

              Name : bogon:0  (local to host bogon)
              UUID : 1aa0ce46:4762919a:71542e42:47b8bc7b
            Events : 30

    Number   Major   Minor   RaidDevice State
       0       8       17        0      active sync set-A   /dev/sdb1
       1       8       18        1      active sync set-B   /dev/sdb2
       4       8       19        2      spare rebuilding   /dev/sdb3
       3       8       20        3      active sync set-B   /dev/sdb4
可以看出此时活跃设备仍为3台，但工作设备已变为4台，空闲设备为1台
Rebuild Status : 38% complete 表示正在重建该设备
在/dev/sdb3的状态上也可看出正在重建rebuilding
```

若要彻底停用该阵列，只需要先卸载文件系统，然后执行`mdadm -S /dev/md0`即可。

### 使用`RAID 5`进行备份

`mdadm -Cv /dev/md0 -n 3 -x 1 -l 5 /dev/sdb1 /dev/sdb2 /dev/sdb3 /dev/sdb4`
其中`-n 3`表示选择 3 块磁盘做主盘，`-x 1`表示选 1 张做备份盘，加起来一共 4 张磁盘。
此时查看 RAID 信息

```
# mdadm -D /dev/md0
/dev/md0:
           Version : 1.2
     Creation Time : Thu Aug  2 10:35:01 2018
        Raid Level : raid5
        Array Size : 10475520 (9.99 GiB 10.73 GB)
     Used Dev Size : 5237760 (5.00 GiB 5.36 GB)
      Raid Devices : 3
     Total Devices : 4
       Persistence : Superblock is persistent

       Update Time : Thu Aug  2 10:35:28 2018
             State : clean
    Active Devices : 3
   Working Devices : 4
    Failed Devices : 0
     Spare Devices : 1

            Layout : left-symmetric
        Chunk Size : 512K

Consistency Policy : resync

              Name : bogon:0  (local to host bogon)
              UUID : 9d0e9a0d:38372c14:2ad4666f:feb13f5c
            Events : 18

    Number   Major   Minor   RaidDevice State
       0       8       17        0      active sync   /dev/sdb1
       1       8       18        1      active sync   /dev/sdb2
       4       8       19        2      active sync   /dev/sdb3

       3       8       20        -      spare   /dev/sdb4
可看出/dev/sdb4做了备份盘，状态为空闲
```

# 参考资料

> [百度百科--RAID 磁盘阵列](https://baike.baidu.com/item/RAID%E7%A3%81%E7%9B%98%E9%98%B5%E5%88%97/10588130?fr=aladdin) > [RAID 基础，RAID10 与 RAID01 比较，RAID10 与 RAID5 比较](http://blog.itpub.net/787018/viewspace-666280/) > [骏马金龙--RAID](http://www.cnblogs.com/f-ck-need-u/p/7049501.html) > [骏马金龙--LVM](http://www.cnblogs.com/f-ck-need-u/p/7049233.html) > [图文并茂 RAID 技术全解](http://www.hack520.com/169.html)
> Linux 就该这么学

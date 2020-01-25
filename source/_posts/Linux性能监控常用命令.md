---
title: Linux性能监控与优化
date: 2018-08-01 20:57:03
tags: [Linux, 运维, 性能]
categories: [系统运维]
---

- [top 与 htop]()
- [uptime,free 和 vmstat]()
- [mpstat 与 iostat]()
- [ps 和 pstree]()

<!-- more -->

**所有工具进行系统性能分析的思路都是相同的。**

# top 与 htop

## top

查看动态进程状态，默认每 5 秒刷新一次。

```
top
  -d：指定top刷新的时间间隔，默认是5 秒
  -b：批处理模式，每次刷新分批显示
  -n：指定top刷新几次就退出，可以配合-b使用
  -p：指定监控的pid，指定方式为-pN1 -pN2 ...或-pN1, N2 [,...]
  -u：指定要监控的用户的进程，可指定UID或用户名
```

```
top - 02:20:36 up  6:48,  1 user,  load average: 0.00, 0.00, 0.00
Tasks: 145 total,   2 running, 143 sleeping,   0 stopped,   0 zombie
%Cpu(s):  0.0 us,  0.0 sy,  0.0 ni,100.0 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st
KiB Mem :  2029396 total,  1600964 free,   161512 used,   266920 buff/cache
KiB Swap:  2097148 total,  2097148 free,        0 used.  1670652 avail Mem
```

- Tasks 为进程数
- `us`：用户进程（非优雅进程，即未修改优先级）占用 cpu 百分比
- `sy`：系统进程（内核进程）占用 cpu 百分比
- `ni`：进程空间内改变过优先级的进程占 cpu 百分比
- `id`：空闲 cpu 百分比。如果系统慢但这个值很高，则可以推断不是 CPU 负载的问题
- `wa`：I/O 等待时间比率。若系统慢但这个值低，则也可排除磁盘或网络 I/O 负载问题
- `hi`：不可中断睡眠时间比率
- `si`：可中断睡眠时间比率
- `st`：被偷走时间比率，一般为虚拟机占用

```
   PID USER      PR  NI    VIRT    RES    SHR S  %CPU %MEM     TIME+ COMMAND
```

- PR：优先级
- NI：nice 值，负数为高优先级，正数为低优先级
- VIRT：虚拟内存总量
- RES：进程实际使用内存
- SHR：共享内存
- S：进程状态。有五种状态：D-不可中断的睡眠态 R-运行态 S-睡眠态 T-停止 Z-僵尸态
- TIME+：进程使用 CPU 的时间总计（单位 1/100 秒）

进入 top 视图后的操作

- 1：查看每个逻辑 CPU 的状况
- P：按 cpu 使用率排序（默认）
- M：按内存使用率排序
- N：按 PID 排序
- T：根据 TIME+进行排序
- H：切换为线程
- l：切换负载信息
- m：切换显示内存信息（只是将数字改为类似进度条）
- t：切换显示进程和 CPU 状态信息（只是将数字改为类似进度条）
- k：指定要杀死的进程号
- A：切换显示模式。有四个窗口，在左上角显示，按 a（后一个）或 w（前一个）进行窗口切换
  Def：默认字段组 Job：任务字段组 Mem：内存字段组 Usr：用户字段组
- d 或 s：修改刷新间隔
- f：选择要添加显示的字段，标上\*为已选的
- R：反向排序
- c：显示进程的完整命令路径名
- V：树视图，命令会按进程的父子关系显示
- u：显示指定用户的进程
- n 或#：设置最多显示的进程量
- r：设置指定进程的 nice 优先级
- F: 选择要排序的字段

## htop

默认没有安装，需要`dnf install htop`

可通过鼠标点击操作，`h`查看帮助

# uptime,free 和 vmstat

## uptime

获取主机运行时间，查询系统负载

```
09:05:53 up 12 days,13:33,2 users,load average: 0.01,0.02,0.05
```

- 09:05:53--当前时间
- up 12 days, 13:33--系统启动时长
- 2 users--当前登录系统的用户数
- load average: 0.01,0.02,0.05--系统在最近的 1,5,15 分钟的平均负载

> 负载率(load)，即特定时间长度内，cpu 运行队列中的平均进程数(包括线程)，一般平均每分钟每核的进程数小于 3 都认为正常，大于 5 时负载已经非常高。Linux 运行队列包括正在运行的、在等待的、处于可中断睡眠态（IO 等待）的进程。若为多核 CPU，还需要除以核数。
>
> 平均负载最佳值为 1，意味着每个进程都能立刻访问 CPU，并且没有丢失 CPU 周期

平均负载为 1 表示，单 CPU 系统处于恒定负载，若为 4 则表示系统处于它可承受负载能力的 4 倍。明确负载是：CPU 密集型（等待 CPU 资源的进程）、RAM 密集型（频繁使用的 RAM 被移入交换区）和 I/O 密集型（争夺磁盘或网络 I/O 的进程）非常重要。

CPU 密集型系统比 I/O 密集型和 RAM 密集型相应度更高，因为磁盘 I/O 或 RAM 资源耗尽时，进程会逐渐变慢直至停止，而 CPU 密集型仍能快速执行命令。

## free

查看内存与 swap 分区使用状况，实际是从`/proc/meminfo`中读取数据的

```
free
 -b         单位b
 -k         单位kb（默认）
 -m         单位mb
 -g         单位gb
 -h         自动选择单位
 -l         显示高内存、低内存详细统计数据
 -t         显示内存与swap的总和
 -s N       设置刷新周期（单位秒），ctrl+C退出
 -c N       设置刷新次数
 -w         分开显示buffers和cache

total  used  free  shared  buff/cache  available
# cache为缓存：把读取的数据放在内存中，再次读的话就直接从内存中读了，加快读取
# buffer为缓冲：写入数据时，把分散的写入操作保存到内存中，然后集中写入硬盘，减少磁盘碎片与硬盘反复寻道，加快写入
```

## vmstat

报告进程、内存、分页、块 IO、中断、CPU 活动信息，能够显示平均数据和实时样本。

```
vmstat [options] [delay [count]]
 -a      显示内存信息
 -f      显示自从系统启动以来产生的子进程数量
 -m      显示slab信息
 -n      与-a类似
 -s      事件计数器和内存状态
 -d      磁盘状态
 -D      磁盘状态概述
 -p 分区  磁盘分区统计信息
 -S 单位  输出与-n一致，但可指定单位
 -t      显示时间戳，输出比-n增加了一项CST时间戳
 刷新间隔 [次数]  设置持续刷新间隔及刷新次数
```

- 虚拟内存模式

  ```
  vmstat
  procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
  r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
  Proc：
    r：可运行进程的数量（正在运行+等待运行）
    b：不可中断睡眠进程的数量
  memory：
    swpd：虚拟内存使用量
    free：空闲内存
    buff：缓冲区内存
    cache：用作缓存的内存
  swap：
    si：swap in,从磁盘换入的内存数量/s
    so：swap out,交换到磁盘的内存数量/s
  io：
    bi：block in,从块设备收到的块数/s
    bo：block out,发送到块设备的块数/s
  system：
    in：interrupt,每秒中断数量
    cs：context switch,每秒上下文切换数量
  cpu：
    us：非内核代码运行时间
    sy：内核代码运行时间
    id：idle,空闲花费时间，包含IOwait时间
    wa：wait,IO等待花费时间
    st：steal,虚拟软件花费时间
  ```

- 磁盘模式

  ```
  vmstat -d
  disk- ------------reads------------ ------------writes----------- -----IO------
        total merged sectors      ms  total merged sectors      ms    cur    sec
  disk：磁盘名
  reads：
    total：成功读取的总量
    merged：合并后分组的读
    sectors：成功读取的扇区
    ms：读取花费时间（单位毫秒）
  writes：
    total：成功写入的总量
    merged：合并后分组的写
    sectors：成功写入的扇区
    ms：写入花费时间（单位毫秒）
  IO：
    cur：正在进行的IO
    sec：IO花费时间（单位秒）
  ```

一旦 Linux 将一个文件载入到 RAM 中，当程序使用完这个文件，并不会将它从 RAM 中删除，而是缓存在 RAM 中，如果还有程序要访问这个文件，会大大提高读取速度。若系统需要为活动进程提供 RAM，则经过一段时间，系统的可用 RAM 就会越来越少。

想要知道进程确切使用了多少内存，需要将总消耗内存减去缓存文件大小。若一个进程转为空闲状态，则 Linux 会将占用的内存释放。

# mpstat、 iostat 与 sar

`mpstat`与`iostat`都在`sysstat`包中，若没有这两个命令，则需要安装`sysstat`
sysstat 包包含以下命令：

- iostat
- mpstat
- pidstat
- sar
- tapestat

若要进行长时间的负载记录和统计，需要启动 sysstat 服务。`systemctl start sysstat.service`，启用 sysstat 后，会每 10 分钟收集一次系统状态，并存储到`/var/log/sa`或`/var/log/sysstat`中
若是 debian 系的系统，还需要修改配置`/etc/sysconfig/sysstat`，将`ENABLED`修改为 true，开启收集系统动态数据。

## mpstat

用于报告在多处理器服务器上每个可用 CPU 的统计数据。

```
mpstat [ 选项 ] [ <时间间隔> [ <次数> ] ]
  -A     相当于-u -I ALL -P ALL
  -I {SUM|CPU|SCPU|ALL}  报告中断统计数据
    SUM  报告每个处理器中断的总数量，显示CPU编号和intr/s一个或多个CPU每秒接收每个独特中断的个数
    CPU  显示intr/s，但排列难以阅读
    SCPU 显示intr/s，排版容易阅读
    ALL  显示所有中断统计信息
  -P {cpu编号|ON|ALL}
    cpu  指明统计的cpu编号（0开始）
    ON   每个在线CPU的统计数据
    ALL  所有CPU的统计数据
  -u  统计CPU使用率，输出与-P一致
  时间间隔interval [次数times]   指定报告时间间隔及次数，最后会生成平均值
```

```
mpstat -u
CPU  %usr  %nice  %sys  %iowait  %irq  %soft  %steal  %guest  %gnice  %idle
```

- CPU：CPU 编号
- `%usr`：用户级别（应用）执行时 CPU 使用率
- `%nice`：用户级别使用 nice 优先级执行时 CPU 使用率
- `%sys`：系统级别（内核）执行时 CPU 使用率（不包括硬件软件中断服务的时间）
- `%iowait`：系统未完成磁盘 I/O 请求期间，CPU 空闲时间百分比
- `%irq`：CPU 硬件中断时间百分比
- `%soft`：CPU 软件中断时间百分比
- `%steal`：虚拟化软件为其他虚拟 CPU 服务时，虚拟 CPU 非主动等待时间百分比
- `%guest`：CPU 运行虚拟处理器花费时间百分比
- `%idle`：CPU 空闲时间百分比

## iostat

当 I/O 等待时间占 CPU 时间比例很高时，首先要检查系统是否正在大量使用交换空间，若还有大量可用 RAM，则查看哪个进程占用了大量 I/O。

```
avg-cpu:  %user   %nice %system %iowait  %steal   %idle
           9.71    0.01    4.89    0.09    0.00   85.30

Device             tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
loop0             0.00         0.00         0.00        147          0
......
sda               7.57        96.06       114.12   39466421   46888861
......
sdb               0.00         0.01         0.00       3562        144
loop13            0.00         0.00         0.00       1419          0
sdc               0.09         9.42         0.01    3869460       3816
```

- tps：设备每秒传输量（I/O 请求）
- kB_read/s：每秒从设备读取的数据量
- kB_wrtn/s：每秒向设备写入的数据量
- kB_read：从设备读取的总数据量
- kB_wrtn：向设备写入的总数据量

当系统处于 I/O 高负载时，首先观察每个分区的负载，并确定分区中存放的是什么服务的数据，然后确定高负载 I/O 操作是写入还是读取，从而分析是什么服务占用了大量 I/O。

## sar

sar 用于收集系统的各种负载信息。数据存在`/var/log/sa/`下的`saX`文件中，X 为当天是本月的几号，如当月 19 号，则会生成日志`/var/log/sa/sa19`。

```
	-B	             分页状况
	-b	             I/O 和传输速率信息状况
	-d	             块设备状况
	-F [ MOUNT ]     文件系统统计信息
	-H	             交换空间利用率
	-I { <int_list> | SUM | ALL } 中断统计
	-n { <keyword> [,...] | ALL } 网络统计
		DEV	    网络接口
		NFS	    NFS客户端
		NFSD	  NFS服务器端
		SOCK	  Sockets	(v4)
		IP	    IP负载(v4)
		TCP	    TCP负载(v4)
	-q	             队列长度和平均负载
	-r [ ALL ]       内存利用率信息
	-S	             交换空间利用率信息
	-u [ ALL ]       CPU 利用率信息
	-v	             内核表统计信息
	-W	             交换信息
	-w	             任务创建与系统转换信息
	-y	             TTY 设备信息
```

`sar`直接输出当天的 CPU 统计信息。默认 10 分钟收集一次。

```
12:25:14     LINUX RESTART	(4 CPU)

12时35分01秒     CPU     %user     %nice   %system   %iowait    %steal     %idle
12时45分01秒     all      5.67      0.00      4.74      0.11      0.00     89.47
12时55分01秒     all      5.67      0.00      4.60      0.06      0.00     89.67
......
14时25分01秒     all      5.58      0.00      4.74      0.03      0.00     89.65
14时35分01秒     all      5.61      0.00      4.72      0.03      0.00     89.63
平均时间:     all      5.65      0.00      4.71      0.05      0.00     89.60
```

`sar -r`输出 RAM 统计信息

```
20:20:03    kbmemfree   kbavail kbmemused  %memused kbbuffers  kbcached  kbcommit   %commit  kbactive   kbinact   kbdirty
12:30:02       268208    451380    549032     67.18      3268    275912    312828     10.73    211764    134792         0
12:40:02       268152    451324    549088     67.19      3268    275912    312828     10.73    211764    134792         0
......
14:30:02       265232    448896    552008     67.55      3268    276348    312824     10.73    214348    132792         0
14:40:02       265244    448908    551996     67.54      3268    276348    312824     10.73    214356    132792         0
Average:       265875    449326    551365     67.47      3268    276153    312999     10.74    213254    133725         0
```

`sar -b`输出磁盘统计信息

```
20:20:03          tps      rtps      wtps   bread/s   bwrtn/s
12:30:02         0.38      0.04      0.34      3.04      9.77
12:40:02         0.02      0.00      0.02      0.00      0.28
12:50:02         0.05      0.00      0.05      0.00      0.78
......
14:40:02         0.03      0.00      0.03      0.00      0.47
Average:         0.10      0.01      0.09      0.31      1.69
```

tps 为每秒总传输的数据量，是 rtps 和 wtps 的总和。bread/s 为平均每秒读取的数据量。

`sar -s`和`-e`通常组合使用，指定要查看的项在某段时间内的统计

```
# sar -s 12:33:00 -e 13:21:00

12:40:02        CPU     %user     %nice   %system   %iowait    %steal     %idle
12:50:02        all      0.16      0.00      0.47      0.01      0.00     99.36
13:00:02        all      0.12      0.00      0.48      0.01      0.00     99.40
13:10:02        all      0.11      0.00      0.46      0.01      0.00     99.42
13:20:02        all      0.12      0.00      0.45      0.01      0.00     99.42
Average:        all      0.13      0.00      0.47      0.01      0.00     99.40
```

若要查看本月指定几号的记录，则用`-f`指定统计日志文件

```
# sar -r -f /var/log/sa/sa19 -s 13:00:00 -e 13:30:00

13:00:02    kbmemfree   kbavail kbmemused  %memused kbbuffers  kbcached  kbcommit   %commit  kbactive   kbinact   kbdirty
13:10:02       265584    448928    551656     67.50      3268    276048    313296     10.75    212760    134228         0
13:20:02       265520    448888    551720     67.51      3268    276052    313296     10.75    212776    134232         0
Average:       265552    448908    551688     67.51      3268    276050    313296     10.75    212768    134230         0
```

# ps 和 pstree

## ps

ps 命令有两种风格：BSD 和 Unix。BSD 格式的参数前不加`-`，Unix 格式会在参数前加`-`

- 查看所有进程

  ```
  ps ax    # a表示此tty下的所有程序（不区分用户），x表示所有程序（不区分tty终端机），若增加u参数，可以用户为主的格式来显示程序状况
  ps -ef   # -e显示所有程序，只显示PID、TTY、TIME、CMD，-f增加显示UID、PPID、C、STIME

  ps aux
  USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
  USER：进程发起用户
  PID：进程号
  %CPU，%MEM：CPU，内存占用率
  VSZ：虚拟内存（单位kb）
  RSS：常驻内存（实际物理内存）（单位kb）
  TTY：该进程在哪个终端运行
  STAT：进程状态
    S：可中断睡眠
    <：高优先级
    s：子进程
    +：位于后台
    R：运行（Running）
    T：停止状态（Terminate）
    Z：僵尸进程（Zombie）
  START————进程开启时间
  TIME：进程已启动时间
  COMMAND：产生进程的命令名

  ps -ef中不同的几个
  PPID：父进程ID
  C：CPU占用率
  STIME：进程启动时间
  ```

- 显示用户进程

  ```
  ps -f -u [用户名1,用户名2...]   #-u指定用户，可指定多个，不能加-e，不然等于没指定
  例：ps -f -u apache
  ```

- 显示指定进程

  ```
  ps -f -C [进程]    # -C指定进程名，进程名必须是精确的，不能用通配符。同样不能指定-e
  例：ps -f -C httpd
  ps -f -p [进程号]  # -p指定进程号
  ```

- 通过 cpu 或内存占用对进程排序

  ```
  ps -ef --sort=[+|-]pcpu,[+|-]pmem
  --sort用于指定多个字段，pcpu为按CPU排序，pmem为按内存排序，+为升序，-为降序
  例：ps -ef --sort=-pcpu | head -6 显示CPU占用排名前五的进程
  ```

- 以树显示进程层级关系

  ```
  ps -f --forest
  例：ps -f --forest -C httpd
  ```

- 查看指定父进程下的所有子进程

  ```
  ps --ppid [PPID]
  ```

- 显示进程的线程

  ```
  ps -f -L -C [进程]或-p [进程号]   #显示指定进程的线程
  例：ps -f -L -C httpd
  ```

- 指定要显示的列

  ```
  ps -o pid,uname,pcpu,pmem,comm,etime
  其中：uname为用户名，etime为进程已运行时间
  ```

- 通过`watch`命令将 ps 变为实时查看器

  ```
  watch
    -n 指定指令执行间隔
    -d 高亮显示指令输出信息不同之处
  例：watch -n 1 'ps -e -o pid,uname,cmd,pmem,pcpu --sort=-pcpu,-pmem | head -11'
  ```

## pstree

查看进程树，常用选项

```
-p          显示进程PID
-g          显示进程组ID，即PGID
-u          显示进程所属用户
-a          显示进程的命令及参数
-H PID      高亮显示指定进程及它的所有父进程
-T          只显示进程，不显示线程
-t          显示完整的线程名
-s          显示进程的父进程
-n          按PID排序输出
-Z          显示selinux上下文（需要开启selinux）
```

> 参考文章
>
> - [10 basic examples of Linux ps command](https://www.binarytides.com/linux-ps-command/)
> - [ps 命令的 10 个例子](https://linux.cn/article-2358-1.html)
> - Linux 性能优化大师
> - DevOps 故障排除 Linux 服务器运维最佳实践

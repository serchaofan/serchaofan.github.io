---
title: Linux-Namespace学习笔记
tags: [namespace]
date: 2018-12-30 14:42:04
categories: [Linux]
comments: false
---

学习 Namespace 的笔记与 C 语言 Demo 参考书目：《Docker 容器与容器云》


<!--more-->

## 简介

Linux 目前有 8 种 Namespace（本文讲解其中 7 种，time namespace 暂不展开）。

| namespace | 系统调用参数  |          隔离内容          |
| :-------: | :-----------: | :------------------------: |
|    UTS    | CLONE_NEWUTS  |        主机名与域名        |
|    IPC    | CLONE_NEWIPC  | 信号量、消息队列、共享内存 |
|    PID    | CLONE_NEWPID  |          进程编号          |
|  Network  | CLONE_NEWNET  |  网络设备、网络栈、端口等  |
|   Mount   |  CLONE_NEWNS  |           挂载点           |
|   User    | CLONE_NEWUSER |        用户与用户组        |
|  Cgroup   | CLONE_NEWCGROUP |  cgroup 视图（/proc/[pid]/cgroup、cgroupfs）  |

namespace 有以下 API：`clone()`、`setns()`、`unshare()`

`clone()`是 Linux 系统调用 `fork()`的一种更通用的方式

```
int clone(int (*child_func)(void *), void *child_stack, int flags, void *arg);

child_func 传入子进程运行的程序主函数
child_stack 传入子程序使用的栈空间
flags 表示使用哪些 CLONE_* 标志位
arg 传入用户参数
```

从 3.8 版本开始，可通过`/proc/[pid]/ns` 目录查看指向不同 namespace 号的文件，`[]`中的就是 namespace 号。

```
ll /proc/$$/ns
# 或
ls -l /proc/self/ns

lrwxrwxrwx. 1 root root 0 1 月 9 05:31 ipc -> ipc:[4026531839]
lrwxrwxrwx. 1 root root 0 1 月 9 05:31 mnt -> mnt:[4026531840]
lrwxrwxrwx. 1 root root 0 1 月 9 05:31 net -> net:[4026531956]
lrwxrwxrwx. 1 root root 0 1 月 9 05:31 pid -> pid:[4026531836]
lrwxrwxrwx. 1 root root 0 1 月 9 05:31 user -> user:[4026531837]
lrwxrwxrwx. 1 root root 0 1 月 9 05:31 uts -> uts:[4026531838]
lrwxrwxrwx. 1 root root 0 1 月 9 05:31 cgroup -> cgroup:[4026532xxx]
```
> `cgroup` 条目只在 Linux 4.6+ 内核出现，namespace 号以实际机器为准。

设置链接的作用：一旦 link 文件被打开，只要打开的文件描述符存在，则即使该 namespace 下的所有进程都结束，这个 namespace 仍会继续存在，后续的进程仍能加入进来。

通过 `setns()`加入一个已存在的 namespace

```c
int setns(int fd, int nstype);

fd 为要加入 namespace 的文件描述符
nstype 让调用者检查 fd 指向的 namespace 类型是否符合实际要求。若为 0 表示不检查
```

通过 `unshare()`在原先进程上进行 namespace 隔离，而不用启动新的进程。现代 runc/libcontainer 会同时使用 `unshare`、`clone` 和 `setns`（例如 exec 进入已有 namespace）。

```c
int unshare(int flags);
```

`fork()`系统调用，fork 函数不属于 namespace 的 API，属于 Linux 系统自带的调用。能创建新的进程，并分配资源。`fork()`调用一次却能返回两次，父进程和子进程各返回一次。可能有三种返回值：

- 在父进程中，返回新创建的子进程的进程 ID
- 在子进程中，返回 0
- 若出现错误，返回一个负值

一个实例代码：

```c
#include <unistd.h>
#include <stdio.h>
int main(){
    pid_t fpid;
    int count = 0;
    fpid = fork();
    if(fpid < 0)
        printf("error");
    else if(fpid == 0)
        printf("child process id: %d\n", getpid());
    else
        printf("parent process id: %d\n", getpid());
    return 0;
}
```

编译后输出：

```
parent process id: 33008
child process id: 33009
```

父进程退出后，子进程会成为孤儿进程，由 init/subreaper 接管；若子进程先退出而父进程没有 `wait/waitpid` 回收，则子进程会变成僵尸进程。父进程调用 `wait/waitpid` 是为了回收僵尸进程，并不是“自己才能正常退出”。

以下是 7 种隔离的具体实现，以下为学习顺序

- [简介](#简介)
- [UTS](#uts)
- [IPC](#ipc)
- [PID](#pid)
- [Mount](#mount)
- [Network](#network)
- [User](#user)
- [Cgroup](#cgroup)

## UTS

简单实现 UTS 隔离，实现代码`uts.c`

```c
#define _GNU_SOURCE
#include<sys/types.h>
#include<sys/wait.h>
#include<stdio.h>
#include<sched.h>
#include<signal.h>
#include<unistd.h>

#define STACK_SIZE (1024*1024)

static char child_stack[STACK_SIZE];
char* const child_args[] = {"/bin/bash", NULL};

int child_main(void* args){
    printf("在子进程中！\n");
    sethostname("newnamespace", 12);
    execv(child_args[0], child_args);
    return 1;
}

/*
sethostname函数来自unistd.h库，用于设置主机名
int sethostname(const char *name, size_t len);

execv函数来自unistd.h库，用于运行其他程序
int execv(const char *pathname, char * const argv[]);
*/

int main(){
    printf("程序开始\n");
    int child_pid = clone(child_main, child_stack + STACK_SIZE, CLONE_NEWUTS | SIGCHLD, NULL);
    waitpid(child_pid, NULL, 0);
    printf("已退出\n");
    return 0;
}

/*
waitpid来自sys/wait.h头文件，暂停执行调用进程，直到pid参数指定的子进程发生更改状态。 默认情况下，waitpid()仅等待已终止的子项。
pid_t waitpid(pid_t pid, int *status, int options);
*/
```

编译运行，实现了域名隔离

```
[root@s1 uts]# gcc -Wall uts.c -o uts
[root@s1 uts]# ./uts
程序开始
在子进程中！
[root@newnamespace uts]# exit
exit
已退出
[root@s1 uts]#
```

## IPC

简单实现 IPC 隔离，代码与 uts.c 基本一致，只需要添加一个标识位`CLONE_NEWIPC`

```c
int child_pid = clone(child_main, child_stack + STACK_SIZE,
        CLONE_NEWIPC | CLONE_NEWUTS | SIGCHLD, NULL);
```

先创建一个消息队列

```
[root@s1 ipc]# ipcmk -Q
Message queue id: 0
[root@s1 ipc]# ipcs -q

------ Message Queues --------
key        msqid      owner      perms  used-bytes   messages
0xf1646a41 0          root       644  0            0
```

编译后运行 ipc

```
[root@s1 ipc]# gcc -Wall ipc.c -o ipc
[root@s1 ipc]# ./ipc
程序开始
在子进程中！
[root@newnamespace ipc]# ipcs -q

------ Message Queues --------
key        msqid      owner      perms  used-bytes   messages

```

已实现了 IPC 隔离，在子进程中查看不到原先创建的消息队列

## PID

每个 PID namespace 都有自己的计数器，内核为所有 PID namespace 维护一个树状结构，最顶层是系统初始化时创建的，称为 root namespace，新的 Namespace 称为 child namespace。
所属父进程能看到子节点的进程，并可通过信号等方式对子节点的进程产生影响。而子节点不能看到父进程 PID namespace 中的内容。

同样代码仍然使用`ipc.c` 的，只要添加一个标志位`CLONE_NEWPID`，保存为`pid.c`

```c
int child_pid = clone(child_main, child_stack + STACK_SIZE,
        CLONE_NEWPID | CLONE_NEWIPC | CLONE_NEWUTS | SIGCHLD, NULL);
```

首先查看当前的 shell 的 PID，再运行 pid，查看 shell 的 PID

```
[root@s1 pid]# echo $$
35580
[root@s1 pid]# ./pid
程序开始
在子进程中！
[root@newnamespace pid]# echo $$
1
```

init 进程的 PID 为 1，作为所有进程的父进程，维护一张进程表，检查进程状态，一旦有子进程因父进程的错误变为孤儿进程，init 会收养该子进程，并回收资源，结束进程。

内核为 PID namespace 中的 init 进程赋予了**信号屏蔽**的特权，若 init 中没有编写处理某个信号的代码，则与 init 同一个 PID namespace 的进程发送给 init 的该信号就会被屏蔽。主要用于防止 init 进程被误杀。

祖先 namespace 向子 namespace 的 **init 进程**发送信号时，若 init 没有安装对应的处理函数，除`SIGKILL`和`SIGSTOP`外的信号会被忽略；发给子 namespace 中其他进程的信号正常投递。`SIGKILL`和`SIGSTOP`无法被屏蔽，因此父节点仍有权终止子节点的进程。

当子节点的 init 进程被销毁，即使`/proc/[pid]/ns/pid`处于挂载或打开状态，导致 namespace 保存下来，但该 namespace 也无法通过`setns()`或`fork()`创建进程。

当一个容器中存在多个进程时，容器内的 init 进程可对信号捕获，对子进程做信息保存、资源回收等处理。

在新的 PID namespace 中用`ps`查看，仍然会看到所有进程。因为与 PID 相关的`/proc`文件系统（procfs）没有挂载到一个与原`/proc`不同的位置

```
[root@newnamespace pid]# ps -a
   PID TTY          TIME CMD
 36025 pts/1    00:00:00 pid
 36026 pts/1    00:00:00 bash
 36060 pts/1    00:00:00 ps
```

挂载文件系统 proc 到/proc

```
[root@newnamespace pid]# mount -t proc proc /proc
[root@newnamespace pid]# ps a
   PID TTY      STAT   TIME COMMAND
     1 pts/1    S      0:00 /bin/bash
    38 pts/1    R+     0:00 ps a
```

但此时并没有进行 mount namespace 的隔离，所以该操作实际上影响了 root namespace 的文件系统。因此退出后，仍要重新挂载 proc：`mount -t proc proc /proc`

调用`unshare()`创建新的 PID namespace、或`setns()`加入已有 PID namespace 时，调用者本身不会立即进入新的 PID 视图，之后创建的子进程才会进入并成为 init。因为调用`getpid()`得到的 PID 由调用者所在的 PID namespace 决定，立即切换 PID 视图会造成进程看到的 PID 变化。

## Mount

通过隔离文件系统挂载点对隔离文件系统提供支持，是第一个支持的 Linux namespace。

进程创建 mount namespace 时，会把当前的文件结构复制给新的 namespace，并且子节点中的挂载只影响自身，不影响外部。但也会有例外，因此，2006 年引入的**挂载传播**解决了该问题，定义了挂载对象（mount object）间的关系：

- 共享挂载（share relationship）：若两个挂载对象具有共享关系，则一个挂载对象中的挂载事件会传播到另一个挂载对象，反之亦然。
- 从属关系（slave relationship）：若两个挂载对象形成从属关系，则一个挂载对象中的挂载事件会传播到另一个挂载对象，反之不行。从属对象是事件的接受者。

有可能出现的挂载状态：

- 共享挂载（share）：传播事件的挂载对象
- 从属挂载（slave）：接收传播事件的挂载对象
- 共享/从属挂载（shared and slave）：既传播又接收事件的挂载对象
- 私有挂载（private）：既不传播也不接收事件的挂载对象
- 不可绑定挂载（unbindable）：类似私有挂载，但不允许执行绑定挂载，即这块文件对象不可被复制

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120029202.png)

`mount`提供以上的各种挂载方式：

```
 --make-shared           mark a subtree as shared
 --make-slave            mark a subtree as slave
 --make-private          mark a subtree as private
 --make-unbindable       mark a subtree as unbindable
 --make-rshared          recursively marka whole subtree as shared
 --make-rslave           recursively marka whole subtree as slave
 --make-rprivate         recursively marka whole subtree as private
 --make-runbindable      recursively marka whole subtree as unbindable
```

代码仍然只需要添加标志位`CLONE_NEWNS`

```c
#define _GNU_SOURCE
#include<sys/types.h>
#include<sys/wait.h>
#include<stdio.h>
#include<sched.h>
#include<signal.h>
#include<unistd.h>

#define STACK_SIZE (1024*1024)

static char child_stack[STACK_SIZE];
char* const child_args[] = {"/bin/bash", NULL};

int child_main(void* args){
    printf("在子进程中！\n");
    sethostname("newnamespace", 12);
    execv(child_args[0], child_args);
    return 1;
}

int main(){
    printf("程序开始\n");
    int child_pid = clone(child_main,
            child_stack + STACK_SIZE,
            CLONE_NEWNS | CLONE_NEWPID | CLONE_NEWIPC | CLONE_NEWUTS | SIGCHLD, NULL);
    waitpid(child_pid, NULL, 0);
    printf("已退出\n");
    return 0;
}
```

编译后运行，挂载 CDROM

```
[root@newnamespace mount]# mount /dev/cdrom /mnt
mount: /dev/sr0 is write-protected, mounting read-only
[root@newnamespace mount]# df
Filesystem              1K-blocks    Used Available Use% Mounted on
/dev/mapper/centos-root  17811456 1836940  15974516  11% /
......
/dev/sda1                 1038336  129608    908728  13% /boot
/dev/sr0                  4414592 4414592         0 100% /mnt
```

## Network

网络隔离包括：网络设备、IPv4 和 IPv6 协议栈、IP 路由表、防火墙、`/proc/net`、`/sys/class/net`、套接字等。

通过创建 veth pair（虚拟网络设备对）实现容器内外的通信。当创建的 network namespace 被释放时，这个 namespace 中的物理网卡会返回到 root namespace，而不是创建 namespace 的父进程。

在建立好 veth pair 前，新旧 namespace 间通过管道（pipe）通信。以 docker 为例，docker daemon 在宿主进程上创建 veth pair，把一端绑定在 docker0 网桥上，另一端接入新建的 network namespace，在 veth pair 建立完成前，docker daemon 和 init 通过管道通信，直到 init 接收到 docker daemon 发送的 veth 设备信息，然后关闭管道，并启动 eth0。

代码仅需要在 mount.c 上添加标志位`CLONE_NEWNET`，保存为`network.c`

```c
int child_pid = clone(child_main,
            child_stack + STACK_SIZE,
            CLONE_NEWNET | CLONE_NEWNS | CLONE_NEWPID | CLONE_NEWIPC | CLONE_NEWUTS | SIGCHLD, NULL);
```

编译运行后，查看网络设备，只有一个环回口

```
[root@s1 network]# ./network
程序开始
在子进程中！
[root@newnamespace network]# ifconfig
[root@newnamespace network]# ip addr
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN qlen 1
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
```

## User

user namespace 主要隔离安全相关的标识符和属性，包括用户（组）ID、root 目录、密钥和特殊权限。user namespace 也类似 PID namespace，是树状结构。

为了能查看用户权限，需要在代码中添加内容。需要导入`sys/capability.h`，该包需要安装`libcap-dev`（debian）或`libcap-devel`（redhat）。

在`child_main`函数中添加

```c
int child_main(void* args){
    cap_t caps;
    printf("在子进程中！\n");
    sethostname("newnamespace", 12);
    printf("eUID=%ld, eGID=%ld\n", (long)geteuid(), (long)getegid());
    caps = cap_get_proc();
    printf("capabilities: %s\n", cap_to_text(caps, NULL));
    execv(child_args[0], child_args);
    return 1;
}
```

并在 main 函数添加标志位`CLONE_NEWUSER`，并且需要删除以前的`CLONE`标识符，否则可能无法正常显示。

```c
int child_pid = clone(child_main,
            child_stack + STACK_SIZE,
            CLONE_NEWUSER | SIGCHLD, NULL);
```

因为添加了 capability 头文件，在编译时需要添加选项`-lcap`，且要放在源文件之后：`gcc -Wall userns.c -o userns -lcap`

```
root:user > ./userns
程序开始
在子进程中！
eUID=65534, eGID=65534
capabilities: = cap_chown,cap_dac_override,......
nobody:user >
```

子节点的 UID 和 GID 都变为了 65534（默认的），并且用户名变为 nobody。capabilities 为子节点中该用户的权限，已经有所有权限了。65534 表示尚未与外部的 namespace 的用户（组）映射。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120029746.png)

进行用户绑定，通过在`/proc/[pid]/uid_map`和`/proc/[pid]/gid_map`写入对应绑定信息即可。

```
ID-inside-ns   ID-outside-ns   length
```

注：

- **这两个文件各只能写入一次，不允许修改**
- **写入进程必须拥有目标 user namespace 中的 `CAP_SETUID`（uid_map）或 `CAP_SETGID`（gid_map），且必须位于该 namespace 或其父 namespace 中**
- 非特权用户做单行映射时，写 `gid_map` 前通常需要先写 `setgroups=deny`；Linux 5.12+ 映射父 namespace 的 UID 0 还涉及 `CAP_SETFCAP` 规则
- 第一个字段`ID-inside-ns`表示新建的 user namespace 中对应的 UID/GID，第二个字段`ID-outside-ns`表示外部映射的 UID/GID，`length`表示映射范围，通常就填 1，表示只映射一个。

创建函数设置 UID 和 GID

```c
void set_uid_map(pid_t pid, int inside_id, int outside_id, int length){
    char path[256];
    sprintf(path, "/proc/%d/uid_map", getpid());
    FILE* uid_map = fopen(path, "w");
    fprintf(uid_map, "%d %d %d", inside_id, outside_id, length);
    fclose(uid_map);
}

void set_gid_map(pid_t pid, int inside_id, int outside_id, int length){
    char path[256];
    sprintf(path, "/proc/%d/gid_map", getpid());
    FILE* gid_map = fopen(path, "w");
    fprintf(gid_map, "%d %d %d", inside_id, outside_id, length);
    fclose(gid_map);
}
```

然后在 child_main 函数中添加对这两个函数的调用

```c
int child_main(void* args){
    cap_t caps;
    printf("在子进程中！\n");
    set_uid_map(getpid(), 0, 1000, 1);
    set_gid_map(getpid(), 0, 1000, 1);
    printf("eUID=%ld, eGID=%ld\n", (long)geteuid(), (long)getegid());
    caps = cap_get_proc();
    printf("capabilities: %s\n", cap_to_text(caps, NULL));
    execv(child_args[0], child_args);
    return 1;
}
```

`userns.c`完整文件：

```c
#define _GNU_SOURCE
#include<sys/types.h>
#include<sys/wait.h>
#include<stdio.h>
#include<sched.h>
#include<signal.h>
#include<unistd.h>
#include<sys/capability.h>

#define STACK_SIZE (1024*1024)

static char child_stack[STACK_SIZE];
char* const child_args[] = {"/bin/bash", NULL};

void set_uid_map(pid_t pid, int inside_id, int outside_id, int length){
    char path[256];
    sprintf(path, "/proc/%d/uid_map", getpid());
    FILE* uid_map = fopen(path, "w");
    fprintf(uid_map, "%d %d %d", inside_id, outside_id, length);
    fclose(uid_map);
}

void set_gid_map(pid_t pid, int inside_id, int outside_id, int length){
    char path[256];
    sprintf(path, "/proc/%d/gid_map", getpid());
    FILE* gid_map = fopen(path, "w");
    fprintf(gid_map, "%d %d %d", inside_id, outside_id, length);
    fclose(gid_map);
}

int child_main(void* args){
    cap_t caps;
    printf("在子进程中！\n");
    // sethostname("newnamespace", 12);
    // printf("------------");
    set_uid_map(getpid(), 0, 1000, 1);
    set_gid_map(getpid(), 0, 1000, 1);
    printf("eUID=%ld, eGID=%ld\n", (long)geteuid(), (long)getegid());
    caps = cap_get_proc();
    printf("capabilities: %s\n", cap_to_text(caps, NULL));
    execv(child_args[0], child_args);
    return 1;
}

int main(){
    printf("程序开始\n");
    int child_pid = clone(child_main,
            child_stack + STACK_SIZE,
            CLONE_NEWUSER | SIGCHLD, NULL);
    waitpid(child_pid, NULL, 0);
    printf("已退出\n");
    return 0;
}
```

重新编译执行，结果如下

```
gutianyi:user > ./userns
程序开始
在子进程中！
eUID=0, eGID=0
capabilities: = cap_chown......
root:user >
```

> 注：非特权单行映射时，执行用户必须与 `outside_id` 对应；以 root 或带 `CAP_SETUID` 的父 namespace 运行时可映射任意 ID。

Linux 内核将原来与超级用户相关的高级权限划分为不同的单元，称为 Capability。管理员可独立对特定的 Capability 进行使用或禁用。在 Docker 中同时使用了 user namespace 和 Capability，加强了容器安全性。

## Cgroup

cgroup namespace 隔离的是进程看到的 **cgroup 视图**，而不是资源控制本身。`/proc/self/cgroup` 的路径始终相对 namespace 根；在 namespace 内重新挂载 cgroupfs 时，挂载根也会是 namespace 根（直接 bind mount 宿主已有的 cgroupfs 挂载则不保证）。

- `CLONE_NEWCGROUP` 自 Linux 4.6 引入，cgroup v1 与 v2 都适用，隔离的是 cgroup 视图而非资源限制
- cgroup v1：`/proc/self/cgroup` 每个控制器一行（`<id>:<controllers>:<path>`），`/sys/fs/cgroup` 下是多个按控制器划分的挂载点
- cgroup v2：unified hierarchy，`/proc/self/cgroup` 只有一行 `0::<path>`，`/sys/fs/cgroup` 是单个 cgroup2 挂载

namespace 本身不决定读写：只读与否取决于 cgroupfs 的挂载选项。Docker 在 v2 下默认以 `ro` 挂载 `/sys/fs/cgroup`，因此容器内通常呈现为以自身 cgroup 为根的只读视图；若以 `rw` 挂载，子 cgroup 仍可写。

cgroup namespace 的根在创建时确定（即创建进程当时所在的 cgroup），之后不能更改；容器运行时正是先进入容器 cgroup，再创建 cgroup namespace。

它的主要作用是**信息隐藏**和**防误操作**：容器内执行 `cat /proc/self/cgroup` 不会暴露宿主机的完整路径，也降低了误改宿主机 cgroup 层级的风险。但它不是严格的安全边界：已打开的文件描述符、宿主的 bind mount 等方式仍可能绕过；跨 namespace 查看其它进程时，路径中还可能出现 `..`。

Docker 从 20.10 起支持 `--cgroupns=host` / `--cgroupns=private`：cgroup v2 下默认 `private`，v1 下默认 `host`。检查容器内的视图：

```bash
# 以下输出以 cgroup v2 + systemd cgroup driver 的宿主机为例
$ docker run --rm --cgroupns=private alpine cat /proc/self/cgroup
0::/

$ docker run --rm --cgroupns=host alpine cat /proc/self/cgroup
0::/system.slice/docker-<full-id>.scope

# cgroupfs driver 下 host 模式为：0::/docker/<full-id>
# cgroup v1 下 private 模式为多行，如：12:memory:/、11:cpuset:/
```

cgroup namespace 通常与 mount namespace 搭配（挂载 cgroupfs 需要），在容器里也常和 PID namespace 一起使用：前者只重定 cgroup 视图的根，后者只重定 PID 视图；CPU/内存限制由 cgroup 控制器负责，进程数上限由 pids 控制器负责，都不是 namespace 的职责。

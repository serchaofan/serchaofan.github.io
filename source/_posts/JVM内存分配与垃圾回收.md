---
title: JVM内存分配与垃圾回收
tags: [JVM, Java, GC, SRE]
categories: [Java]
date: 2020-01-07 21:50:08
comments: false
---

本文以资深 Java 开发视角重写，参考 JDK 25 LTS / JDK 27 官方文档，讲清 JVM 内存布局、对象分配、堆 sizing、GC 原理、G1/ZGC/Shenandoah/Parallel/Serial 的取舍、GC 日志与排障，并在最后给出 SRE 视角的专业见解。

最后更新：2026-10-22

<!--more-->

- [版本与范围](#%E7%89%88%E6%9C%AC%E4%B8%8E%E8%8C%83%E5%9B%B4)
- [JVM 运行时内存](#jvm-%E8%BF%90%E8%A1%8C%E6%97%B6%E5%86%85%E5%AD%98)
- [对象分配与布局](#%E5%AF%B9%E8%B1%A1%E5%88%86%E9%85%8D%E4%B8%8E%E5%B8%83%E5%B1%80)
- [堆 sizing 与容器](#%E5%A0%86-sizing-%E4%B8%8E%E5%AE%B9%E5%99%A8)
- [GC 基础原理](#gc-%E5%9F%BA%E7%A1%80%E5%8E%9F%E7%90%86)
- [垃圾收集器](#%E5%9E%83%E5%9C%BE%E6%94%B6%E9%9B%86%E5%99%A8)
- [G1 深挖](#g1-%E6%B7%B1%E6%8C%96)
- [ZGC 深挖](#zgc-%E6%B7%B1%E6%8C%96)
- [其他收集器](#%E5%85%B6%E4%BB%96%E6%94%B6%E9%9B%86%E5%99%A8)
- [GC 选型](#gc-%E9%80%89%E5%9E%8B)
- [GC 日志与诊断工具](#gc-%E6%97%A5%E5%BF%97%E4%B8%8E%E8%AF%8A%E6%96%AD%E5%B7%A5%E5%85%B7)
- [调优方法论](#%E8%B0%83%E4%BC%98%E6%96%B9%E6%B3%95%E8%AE%BA)
- [常见故障](#%E5%B8%B8%E8%A7%81%E6%95%85%E9%9A%9C)
- [SRE 视角](#sre-%E8%A7%86%E8%A7%92)
- [企业实践](#%E4%BC%81%E4%B8%9A%E5%AE%9E%E8%B7%B5)
- [附录](#%E9%99%84%E5%BD%95)

# 版本与范围

- **JDK 25 LTS**：2025-09 GA，生产基线
- **JDK 27**：2026-09 GA，当前最新非 LTS
- 默认收集器：server-class 机器上是 G1，否则 Serial
- ZGC 从 JDK 23 起默认分代（JEP 474）；JDK 21 起分代 ZGC 可用（JEP 439）
- 本文以 HotSpot 为主，OpenJDK 发行版通用

GC 选型没有“最佳”，只有“匹配业务”：

- 吞吐优先：Parallel
- 通用平衡：G1（默认）
- 极低延迟：ZGC / Shenandoah
- 小堆/单核：Serial
- 性能测试/特殊场景：Epsilon

# JVM 运行时内存

```
+--------------------------------------------------+
|                  JVM Process                     |
|                                                  |
|  Heap        Metaspace      Code Cache           |
|  Young/Old   Class metadata JIT code             |
|                                                  |
|  Thread Stacks   Direct Buffers   GC structures  |
|  PC/Registers    NIO/Netty        Card/RS/bitmap |
|                                                  |
|  Native memory: malloc, mmap, JNI, zip, crypto   |
+--------------------------------------------------+
```

## Heap

- 所有线程共享
- 存放对象实例和数组
- 分代：Young（Eden/Survivor）、Old
- GC 的主要区域
- 由 `-Xms`/`-Xmx` 控制

## Metaspace

- 类元数据、方法、常量池、注解等
- JDK 8 起取代 PermGen
- 默认不设上限，受本机内存限制
- `-XX:MetaspaceSize` 初始阈值，`-XX:MaxMetaspaceSize` 上限
- 类加载泄漏会表现为 Metaspace 持续增长

## Code Cache

- JIT 编译后的机器码
- `-XX:ReservedCodeCacheSize`、`-XX:InitialCodeCacheSize`
- 满了会停止 JIT，性能下降
- 关注 `CodeCache` 使用率和编译线程

## Thread Stack

- 每个线程私有
- 存放栈帧、局部变量、操作数栈
- `-Xss` 控制，Linux x64 默认通常 1MB
- 线程数 × 栈大小是常被忽略的 native 内存

## Direct Memory

- `ByteBuffer.allocateDirect`、Netty、NIO
- 不走 Heap，但受 `-XX:MaxDirectMemorySize` 限制
- 未设置时默认上限约等于最大堆
- 泄漏表现为堆正常但进程 RSS 持续上涨

## Native Memory

- JNI、zip、crypto、GC 元数据、线程栈、mmap
- `-XX:NativeMemoryTracking=summary` + `jcmd VM.native_memory` 排查
- 容器 OOM 往往不是 Heap 超限，而是 Heap + Metaspace + Direct + Thread + Native 总和超限

# 对象分配与布局

## 对象布局

HotSpot 对象通常包括：

```
+----------------+----------------+---------------------+
| Mark Word      | Klass Pointer  | Instance Fields     |
| hash/GC/锁状态 | 类元数据指针   | 字段 + padding      |
+----------------+----------------+---------------------+
```

- 对象按 8 字节对齐
- 压缩指针（Compressed Oops）在堆 < 32GB 时常用
- 数组多一个 length 字段
- 对象头大小影响小对象内存占用
- 字段重排（field layout）由 JVM 优化

## 分配路径

1. **TLAB**：线程本地分配缓冲区，绝大多数对象在 TLAB 内指针碰撞分配
2. **慢路径**：TLAB 不足，申请新 TLAB 或直接在 Eden 分配
3. **大对象**：超过阈值直接进入 Old 或 Humongous Region（G1）
4. **逃逸分析**：JIT 可能做标量替换/栈上分配，减少堆分配

TLAB 的意义：

- 避免多线程竞争堆指针
- 提升分配速度
- TLAB 大小自适应，关注 `-XX:TLABSize`、`-XX:TLABWasteTargetPercent`

## 分配速率

- 分配速率高会加快 Young GC
- 晋升速率高会加快 Old GC
- 大对象/大数组会造成碎片和 Humongous 压力
- 短生命周期对象多，G1/ZGC 的分代假设更有效

# 堆 sizing 与容器

## 默认值

Oracle 文档的 ergonomics：

- 初始堆：物理内存的 1/64
- 最大堆：物理内存的 1/4
- server-class：2+ CPU 且内存 ≥ 1792MB
- server-class 默认 G1，否则 Serial

这些默认值不适合生产容器，必须显式设置。

## 容器

- `-XX:+UseContainerSupport` 默认开启（JDK 10+，8u191+）
- JVM 读取 cgroup 内存限制
- `-XX:MaxRAMPercentage` 默认 25%
- `-XX:InitialRAMPercentage` 默认 1.5625%
- `-XX:MinRAMPercentage` 用于小堆
- `-Xmx` 会覆盖百分比
- `-XX:ActiveProcessorCount` 可覆盖 CPU 数

推荐：

```bash
-XX:MaxRAMPercentage=75.0
-XX:InitialRAMPercentage=50.0
-XX:+ExitOnOutOfMemoryError
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/logs/heapdump.hprof
```

为什么不是 100%：

- Metaspace
- Direct Memory
- 线程栈
- Code Cache
- GC 自身结构
- JNI/native
- 容器 page cache 也会计入 cgroup

## 堆大小公式

粗略估算：

```
容器内存 ≥ 堆 × 1.3 ~ 1.5 + 固定开销
```

更准确：

```
容器 limit ≥ Heap + Metaspace + Direct + Threads×Xss + CodeCache + GC overhead + Native + 余量
```

- 堆不是越大越好：大堆会增加 GC 停顿/并发回收压力
- 小堆会增加 GC 频率和 CPU 开销
- 先测 live set，再定堆大小
- `-Xms=-Xmx` 可减少堆伸缩，但会提高常驻内存

## 容器 OOM

- `OOMKilled` / exit 137：cgroup 内存超限
- JVM 堆 OOM：`java.lang.OutOfMemoryError`，进程可能不退出
- 两者排查路径不同
- 看 `docker inspect` 的 `OOMKilled`、`/sys/fs/cgroup/memory.events`、`dmesg`

# GC 基础原理

## 什么是垃圾

从 GC Roots 不可达的对象：

- 栈帧局部变量
- 静态变量
- JNI 引用
- 活动线程
- 类加载器/常量

## GC 动作

- **Mark**：标记存活对象
- **Sweep**：回收未标记对象
- **Copy**：把存活对象复制到新区域
- **Compact**：压缩，减少碎片
- **Evacuate**：G1 的复制/疏散

## STW

Stop-The-World：暂停应用线程完成某些阶段。暂停时间直接影响尾延迟。

## 三色标记

- 白：未访问
- 灰：已访问，引用未扫描完
- 黑：已访问，引用扫描完

并发标记要解决“对象消失”问题：

- **SATB**（Snapshot-At-The-Beginning）：G1 使用，记录标记开始时的引用快照
- **增量更新**：CMS 历史方案

## 写屏障与读屏障

- 写屏障：对象引用写入时记录，维护卡表/记忆集
- 读屏障：读取引用时处理，ZGC/Shenandoah 使用
- 屏障有 CPU 开销，是并发收集器吞吐下降的原因之一

## 分代假设

- 大多数对象朝生夕死
- 存活越久的对象越可能继续存活

分代收集利用这个假设，降低每次 GC 的扫描范围。

## Card Table 与 Remembered Set

- 卡表：把堆分成固定大小 card（G1 常用 512B），记录跨代引用
- Remembered Set：记录从其他 Region 指向当前 Region 的引用
- 避免每次 Young GC 扫描整个 Old
- 记忆集占用内存，跨代引用多时开销大

# 垃圾收集器

## Serial

- 单线程 STW
- 适合小堆、单核、客户端
- `-XX:+UseSerialGC`
- 简单、开销小

## Parallel

- 多线程 STW，吞吐优先
- 分代，Young/Old 并行
- 适合批处理、离线计算、可接受停顿
- `-XX:+UseParallelGC`
- 关注 `-XX:ParallelGCThreads`、`MaxGCPauseMillis`

## G1

- 默认收集器
- Region 化、分代、并发标记、增量回收
- 目标：可预测停顿 + 较高吞吐
- 适合大多数服务端应用
- `-XX:+UseG1GC`

## ZGC

- 并发标记/转移/重定位
- 停顿通常 < 1ms，几乎与堆大小无关
- 适合低延迟、大堆
- `-XX:+UseZGC`
- 需要更多 CPU 和内存余量

## Shenandoah

- 低延迟并发压缩收集器
- OpenJDK 发行版支持
- `-XX:+UseShenandoahGC`
- 适合对停顿敏感的场景，生态/调优资料少于 G1/ZGC

## Epsilon

- 不做垃圾回收，只分配
- 用于性能测试/短生命周期任务
- `-XX:+UseEpsilonGC`
- 堆满即 OOM，不适合生产常驻服务

# G1 深挖

## Region

G1 把堆分成大小相等的 Region：

```
+----+----+----+----+----+----+
| E  | S  | O  | O  | H  | H  |
+----+----+----+----+----+----+
```

- Region 大小 1–32MB，2 的幂
- 默认目标约 2048 个 Region
- Eden/Survivor/Old 是逻辑角色，不是连续空间
- Humongous：对象 ≥ Region 的一半，分配在连续 Humongous Region
- Humongous 回收代价高，容易造成碎片和 Full GC

## 收集周期

1. Young-Only 阶段：普通 Young GC，对象晋升
2. Old 占用达到 IHOP，触发 Concurrent Start
3. 并发标记
4. Remark
5. Cleanup
6. Space-Reclamation：Mixed GC，回收部分 Old Region
7. 回到 Young-Only

关键参数：

- `-XX:MaxGCPauseMillis=200`：目标，不是保证
- `-XX:G1HeapRegionSize`
- `-XX:InitiatingHeapOccupancyPercent=45`（Adaptive IHOP 开启时是初始值）
- `-XX:G1NewSizePercent`、`-XX:G1MaxNewSizePercent`
- `-XX:G1MixedGCLiveThresholdPercent`
- `-XX:G1HeapWastePercent`
- `-XX:G1MixedGCCountTarget`
- `-XX:G1ReservePercent`
- `-XX:+UseStringDeduplication`

## 记忆集与卡表

- 每个 Region 有 Remembered Set
- 卡表 512B
- 跨 Region 引用多时，记忆集开销大
- 大量跨代引用会导致 GC 变慢

## Evacuation Failure

- 目标 Region 不够，对象无法复制
- 日志：`Evacuation Failure: Allocation/Pinned`
- `Pinned`：JNI `GetPrimitiveArrayCritical`/`GetStringCritical` 等导致对象被钉住
- 可能触发 Full GC
- 处理：增大堆/Region、减少大对象、避免长时间 JNI critical、调 `G1ReservePercent`

## Full GC

- G1 的兜底，整堆压缩
- 通常意味着晋升失败、Humongous 碎片、并发标记跟不上
- 频繁 Full GC 要看 allocation rate、live set、IHOP、Region 大小
- 不要用 `-XX:+DisableExplicitGC` 掩盖问题，先查 `System.gc` 来源

## 日志

```bash
-Xlog:gc*:file=/logs/gc.log:time,uptime,level,tags:filecount=5,filesize=50m
-Xlog:gc+phases=debug
-Xlog:gc+heap=debug
-Xlog:safepoint
```

关注：

- Young/Mixed/Full GC 频率
- 每次停顿时间
- 回收前后堆占用
- Humongous 分配
- Evacuation Failure
- 并发标记周期
- 晋升速率

# ZGC 深挖

## 特点

- 并发标记、并发转移、并发重定位
- 停顿通常 < 1ms
- 停顿与堆大小基本无关
- 支持几百 MB 到 16TB 堆
- JDK 23 起默认分代
- 需要更多 CPU 余量

## 核心机制

- **Colored Pointers**：64 位指针中带元数据位
- **Load Barrier**：读取引用时修正/标记
- **Store Barrier**：分代 ZGC 维护记忆集和标记
- **并发转移**：对象在应用运行时移动
- **Region**：ZGC 自己的 Region 管理

分代 ZGC 的目标：

- 降低分配停顿风险
- 降低堆内存开销
- 降低 GC CPU 开销
- 保持 <1ms 停顿

## 堆 sizing

- `-Xmx` 是最重要的参数
- 需要容纳 live set + 分配余量
- 分配速率越高，需要越多余量
- `-XX:SoftMaxHeapSize` 软上限，避免过早增长
- `-XX:-ZUncommit` 禁止归还未用内存
- `-XX:ZUncommitDelay=300` 归还延迟
- `-Xms=-Xmx` + `-XX:+AlwaysPreTouch` 可降低运行时缺页/归还未内存的抖动

## 大页

```bash
echo 9216 > /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages
java -XX:+UseZGC -Xms16G -Xmx16G -XX:+UseLargePages ...
```

- 大页提升 TLB 命中，降低延迟
- 需要 root 配置 huge page pool
- 容器环境要确认宿主/容器 huge page 可见性

## 适用

- 低延迟 API/交易/网关
- 大堆且停顿敏感
- 能接受一定吞吐下降和更高 CPU/内存开销
- 不适合 CPU 已经很紧张、吞吐优先的批处理

# 其他收集器

## Parallel

- 吞吐优先，STW
- 适合离线批处理、ETL、可接受秒级停顿
- 调 `-XX:ParallelGCThreads`、`-XX:MaxGCPauseMillis`
- 大堆 Full GC 可能很长

## Shenandoah

- 并发压缩，低延迟
- 适合对停顿敏感、使用 OpenJDK 的场景
- 调优资料和生态不如 G1/ZGC
- 关注 `-XX:ShenandoahGCHeuristics` 等发行版特定参数

## Serial

- 小堆、单核、容器边车/工具
- 简单可靠
- 不适合大堆服务端

# GC 选型

| 场景 | 推荐 | 理由 |
| --- | --- | --- |
| 通用 Web/API | G1 | 默认、平衡 |
| 低延迟交易/网关 | ZGC | 停顿 <1ms |
| 大堆且停顿敏感 | ZGC | 停顿与堆大小无关 |
| 批处理/离线 | Parallel | 吞吐高 |
| 小堆/单核 | Serial | 开销小 |
| 性能测试 | Epsilon | 排除 GC 干扰 |
| OpenJDK 低延迟 | Shenandoah | 并发压缩 |

选型步骤：

1. 明确 SLO：吞吐、P50/P99/P999 延迟、可用性
2. 先跑默认 G1，采集基线
3. 有明确证据再换收集器
4. 一次只改一个变量
5. 用生产相似流量压测
6. 灰度发布，观察 GC 日志和业务指标
7. 保留回滚

不要凭“网上说 ZGC 最快”就换。ZGC 的 CPU/内存成本、GC 线程、容器限制都要评估。

# GC 日志与诊断工具

## 启动参数

```bash
-Xlog:gc*:file=/logs/gc.log:time,uptime,level,tags:filecount=5,filesize=50m
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/logs/heapdump.hprof
-XX:NativeMemoryTracking=summary
```

## jcmd

```bash
jcmd <pid> GC.heap_info
jcmd <pid> GC.class_histogram
jcmd <pid> GC.heap_dump /logs/heap.hprof
jcmd <pid> Thread.print
jcmd <pid> VM.native_memory summary
jcmd <pid> JFR.start name=profile duration=60s filename=/logs/profile.jfr
```

## jstat

```bash
jstat -gcutil <pid> 1000
jstat -gc <pid> 1000
jstat -gccause <pid> 1000
```

关注：

- Eden/Survivor/Old 使用率
- YGC/FGC 次数和时间
- GCT 总 GC 时间
- 最近 GC 原因

## jmap / jstack

```bash
jmap -histo:live <pid>
jmap -dump:live,format=b,file=/logs/heap.hprof <pid>
jstack <pid> > /logs/thread.txt
```

## JFR

- 低开销持续采集
- 记录 GC、分配、锁、IO、线程、异常
- 用 JMC 或 `jfr` 工具分析
- 生产建议常开或按需开启

## NMT

```bash
java -XX:NativeMemoryTracking=summary ...
jcmd <pid> VM.native_memory summary
jcmd <pid> VM.native_memory baseline
jcmd <pid> VM.native_memory summary.diff
```

用于区分 Heap、Metaspace、Thread、Code、GC、Internal、Other。

## OS 工具

- `top`/`ps`：RSS、CPU
- `pmap`/`smaps`：进程内存映射
- `perf`：CPU 热点
- `async-profiler`：CPU/分配/锁火焰图
- `dmesg`/`journalctl`：OOM killer、cgroup
- `docker inspect`/cgroup：OOMKilled

# 调优方法论

## 步骤

1. **定义目标**：P99 延迟、GC 停顿、吞吐、内存上限
2. **建立基线**：默认参数、生产相似流量、至少 30 分钟
3. **采集证据**：GC 日志、JFR、NMT、heap histogram、线程栈
4. **提出假设**：例如“Humongous 分配导致 Mixed GC 频繁”
5. **一次改一个变量**：堆、Region、IHOP、收集器
6. **验证**：对比 P99、GC 时间、CPU、RSS
7. **灰度/回滚**：小流量验证，保留旧参数

## 常见调优方向

- 延迟高：先看 GC 停顿、 safepoint、锁、下游
- 吞吐低：看 GC 频率、CPU、分配速率
- 内存高：看 live set、Metaspace、Direct、线程栈、Native
- Full GC 频繁：看晋升失败、Humongous、IHOP、堆不足
- 容器 OOM：看总内存，不只看 Heap

## 不要做的事

- 复制网上参数
- 同时改多个参数
- 用 `-Xmn` 硬编码 Young 大小（G1 不推荐）
- 用 `-XX:+DisableExplicitGC` 掩盖 `System.gc`
- 只看 GC 次数，不看停顿和业务影响
- 用 `nobarrier`/关闭一致性换性能

# 常见故障

## 频繁 Full GC

原因：

- 堆不足/live set 太大
- 晋升失败
- Humongous 碎片
- 并发标记跟不上分配速率
- 显式 `System.gc`
- Metaspace/ClassLoader 泄漏

处理：

- 看 GC 日志和 heap histogram
- 增大堆/Region，减少大对象
- 调 IHOP/Reserve
- 排查泄漏
- 必要时换 ZGC

## 长停顿

- Young/Mixed GC 停顿超目标
- 大对象/Humongous
- 记忆集过大
- 线程数过多/CPU 争抢
- safepoint 长时间等待
- 换 ZGC/Shenandoah 评估

## Metaspace OOM

- 动态生成类（CGLIB/ByteBuddy/脚本）
- ClassLoader 泄漏
- 热部署/OSGi
- 设置 `MaxMetaspaceSize` 并监控
- 用 `jcmd GC.class_histogram`/`jmap -clstats`

## Direct Memory 泄漏

- Netty `ByteBuf` 未释放
- NIO DirectBuffer
- 堆正常但 RSS 上涨
- `-XX:MaxDirectMemorySize` 限制
- NMT 看 Internal/Other

## 线程泄漏

- 线程池未关闭
- 阻塞/死锁
- 线程数 × Xss 占 native
- `jstack`、`Thread.print`、JFR

## 容器 OOM

- exit 137/OOMKilled
- 堆 + 非堆 + native 超 cgroup
- `MaxRAMPercentage` 设太高
- 线程/直接内存/元空间增长
- 用 `memory.events`、`dmesg`、NMT 排查

## JVM 堆 OOM

- `Java heap space`
- `GC overhead limit exceeded`
- `Metaspace`
- `Direct buffer memory`
- `unable to create native thread`

不同 OOM 类型对应不同排查路径。

# SRE 视角

以下是从 SRE 角度对 JVM 服务的专业见解。

## JVM 是服务的一部分，不是黑盒

- GC 停顿会直接变成用户延迟
- Heap/非堆/native 会直接影响容器 OOM
- JVM 参数是配置，要版本化、评审、灰度
- 不要把 JVM 调优当成“上线后再说”

## SLI/SLO

建议监控：

- 请求成功率
- P50/P95/P99/P999 延迟
- GC 停顿 P99/最大值
- GC 时间占比
- Heap after GC / live set
- 分配速率、晋升速率
- Full GC 次数
- Metaspace/Direct/Thread/CodeCache
- 容器 RSS 与 limit
- 重启次数、OOMKilled

SLO 要包含 GC 影响：

- 不要用“排除 GC 的延迟”自欺欺人
- GC 导致的超时也算错误预算
- 尾延迟比平均值更重要

## 告警

- Full GC 频率/时长超阈值
- Heap after GC 持续 > 70%–80%
- 容器 RSS 接近 limit
- Metaspace/Direct 持续增长
- GC 停顿导致 SLO burn
- 频繁重启/OOMKilled
- safepoint 时间异常

告警要可行动，附 Dashboard、GC 日志、runbook。

## 容量

- 按 live set + 分配速率 + 余量定堆
- 预留 non-heap/native/线程栈
- ZGC 需要更多 CPU/内存余量
- G1 大堆要关注停顿和记忆集
- 容器 limit 不是“越大越好”，要成本约束
- 定期 rightsizing，避免长期超配

## 变更

- JVM 参数进 Git，按服务/环境管理
- 一次只改一个变量
- 灰度/金丝雀发布
- 对比 GC 日志、P99、错误率、RSS
- 保留回滚参数
- 升级 JDK 要回归 GC 行为和依赖兼容

## 可观测性

- GC 日志集中采集，带 pod/服务标签
- JFR 按需/持续采样
- Micrometer/OTel 暴露 JVM 指标
- Dashboard 分服务、实例、版本
- 关联 GC 停顿与请求延迟/trace
- 保留 heap dump 和 thread dump 的采集流程

## 事故响应

- OOMKilled：先看 cgroup 和 NMT，不要盲目加内存
- Heap OOM：拿 heap dump，分析 dominator tree
- GC 风暴：看 Full GC、Humongous、分配速率
- 线程泄漏：thread dump/JFR
- 回滚最近变更，保留现场

## 成本

- 过度堆配置浪费内存
- ZGC 的并发线程和内存余量有成本
- 用 rightsizing 和分层 SLO 控制成本
- 不是所有服务都需要 ZGC/大堆

## SRE 反模式

- 只监控 Heap，不看 RSS/native
- 用平均延迟掩盖尾延迟
- 复制别人的 JVM 参数
- 没有 GC 日志
- OOM 后直接重启，不保留现场
- 把 GC 调优当一次性任务
- 没有容量模型，靠报警扩容

# 企业实践

## 服务分层

- 核心低延迟：ZGC/G1 + 严格 SLO + 持续 JFR
- 通用服务：G1 + 75% 堆 + 监控
- 批处理：Parallel + 吞吐优先
- 边车/工具：Serial/小堆
- 性能测试：Epsilon（隔离 GC）

## 容器基线

```bash
-XX:MaxRAMPercentage=75.0
-XX:InitialRAMPercentage=50.0
-XX:+ExitOnOutOfMemoryError
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/logs/heapdump.hprof
-Xlog:gc*:file=/logs/gc.log:time,uptime,level,tags:filecount=5,filesize=50m
```

按服务调整，不要一刀切。

## JDK 升级

- 25 LTS 作为生产基线
- 27 非 LTS 先评估
- 升级前跑 GC/性能回归
- 关注默认 GC、容器支持、JFR、弃用参数
- 保留旧 JDK 回滚

## 反模式

- 堆设成容器 limit 的 100%
- 只看 GC 次数不看停顿
- 用 `-Xmn` 硬调 G1 Young
- 用 `-XX:+DisableExplicitGC` 掩盖问题
- 不保留 heap dump
- 没有基线就调参
- 所有服务复制同一套参数

# 附录

## 常用参数

```bash
# 堆
-Xms4g -Xmx4g
-XX:MaxRAMPercentage=75.0
-XX:InitialRAMPercentage=50.0

# GC
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:InitiatingHeapOccupancyPercent=45
-XX:+UseZGC
-XX:SoftMaxHeapSize=4g

# 诊断
-Xlog:gc*:file=/logs/gc.log:time,uptime,level,tags:filecount=5,filesize=50m
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/logs/heapdump.hprof
-XX:NativeMemoryTracking=summary

# 容器
-XX:+UseContainerSupport
-XX:ActiveProcessorCount=4
```

## 常用命令

```bash
jcmd <pid> GC.heap_info
jcmd <pid> GC.class_histogram
jcmd <pid> GC.heap_dump /logs/heap.hprof
jcmd <pid> Thread.print
jcmd <pid> VM.native_memory summary
jcmd <pid> JFR.start name=profile duration=60s filename=/logs/profile.jfr

jstat -gcutil <pid> 1000
jmap -histo:live <pid>
jstack <pid>
```

## 官方参考

- [JDK 25](https://openjdk.org/projects/jdk/25/)
- [JDK 27](https://openjdk.org/projects/jdk/27/)
- [HotSpot GC Tuning Guide (JDK 25)](https://docs.oracle.com/en/java/javase/25/gctuning/)
- [java command (JDK 25)](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)
- [JEP 439: Generational ZGC](https://openjdk.org/jeps/439)
- [JEP 474: ZGC Generational Mode by Default](https://openjdk.org/jeps/474)

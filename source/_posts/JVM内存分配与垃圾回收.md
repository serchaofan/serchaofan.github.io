---
title: JVM内存分配与垃圾回收
tags: [JVM, Java]
categories: [Java]
date: 2020-01-07 21:50:08
---

本篇笔记不包含具体如何调优，只记录相关JVM内存分配与垃圾回收机制概念，以及常见的jvm工具使用方法。

<!-- more -->

# JVM概念
JVM（Java Virtual Machine，Java虚拟机）为Java的核心技术，所有Java程序都运行在JVM内部，JVM相当于一个虚拟计算机，常见的JVM为Sun公司Hotspot VM，是jdk与openjdk的默认自带的虚拟机。

JVM是JRE（Java Runtime Environment）的一部分，因此安装了Jre后，也就有了JVM。

# JVM运行时内存区结构
JVM中每个区域都有各自的用途，存储各自的数据类型，但都有一个本质，就是存储程序的运行时数据。
![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202207010324443.png)

JVM中的内存区可根据受访权限的不同定义为**线程共享**与**线程私有**两大类，**线程共享内存区**指的是可以允许被所有线程共享访问的一类内存区，包含**堆区**、**方法区**和**运行时常量池**三个内存区。

## 堆区
Java堆区在JVM启动的时候被创建，且在实际的内存空间中可以是不连续的，堆区是一块用于存储对象实例的内存区，也是GC（Garbage Collection，垃圾收集器）执行垃圾回收的重点区域。

存储在JVM中的java对象可以被划分为两类，一类是生命周期较短的瞬时对象，这类对象的创建与消亡都非常迅速；另一类是生命周期较长的对象。对于不同生命周几的java对象，应该采取不用的垃圾收集策略，因此分代收集诞生。

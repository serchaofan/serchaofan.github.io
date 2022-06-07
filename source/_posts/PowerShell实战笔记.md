---
title: PowerShell实战笔记
date: 2019-06-01 21:25:28
tags: [PowerShell]
---

本笔记主要参照《Windows PowerShell 实战指南》的步骤学习，以及知识点补充。目录参照该书。

<!--more-->

- [帮助系统](#帮助系统)
- [运行命令](#运行命令)
- [提供程序](#提供程序)
- [管道](#管道)
  - [终止进程或停止服务](#终止进程或停止服务)
  - [读取 csv 或 XML 文件](#读取-csv-或-xml-文件)
- [命令示例](#命令示例)
  - [收集计算机信息](#收集计算机信息)

# 帮助系统

查看当前的 PowerShell 版本，输入`$PSVersionTable`

```
PS C:\WINDOWS\system32> $PSVersionTable

Name                           Value
----                           -----
PSVersion                      5.1.17134.765
PSEdition                      Desktop
PSCompatibleVersions           {1.0, 2.0, 3.0, 4.0...}
BuildVersion                   10.0.17134.765
CLRVersion                     4.0.30319.42000
WSManStackVersion              3.0
PSRemotingProtocolVersion      2.3
SerializationVersion           1.1.0.1
```

查看指定命令的帮助文档 `help 命令`或`get-help`

```
PS C:\WINDOWS\system32> help Get-Service

语法
    Get-Service [[-Name] <string[]>]  [<CommonParameters>]
    ......
```

更新帮助文档 `update-help`

可使用`( )`指定操作的顺序，括号中的会先执行。

例：先创建一个文件叫`names.txt`，写入要操作的目标主机名

```
PS C:\Users\gutianyi> Get-EventLog Application -ComputerName (Get-Content names.txt)

   Index Time          EntryType   Source                 InstanceID Message
   ----- ----          ---------   ------                 ---------- -------
   13446 6月 01 21:46  Information ESENT                         916 svchost (16532,G,98) 由于 Beta 网站模式设置 0x8...
   13445 6月 01 21:39  Information ESENT                         916 svchost (3084,G,98) 由于 Beta 网站模式设置 0x80...
   13444 6月 01 21:38  Information ESENT                         916 svchost (4488,G,98) 由于 Beta 网站模式设置 0x80...
   ......
```

查看命令示例 `help 命令 -examples`

```
PS C:\Users\gutianyi> help Get-EventLog -Examples

名称
    Get-EventLog

摘要
    Gets the events in an event log, or a list of the event logs, on the local or remote computers.


    Example 1: Get event logs on a computer

    PS C:\>Get-EventLog -List

    This command gets the event logs on the computer.
    Example 2: Get the five most recent entries from a specific event log
    ......
```

# 运行命令

Cmdlet 是一个原生的 PowerShell 命令行工具，是以 Powershell 自己脚本语言编写的。

Cmdlet 的命令规范，以一个动词开始，后面跟上一个`-`，之后是一个单数名词。动词可通过`Get-Verb`查看，大概有 100 个。

```
PS C:\Users\gutianyi> Get-Verb

Verb        Group
----        -----
Add         Common
Clear       Common
Close       Common
Copy        Common
Enter       Common
Exit        Common
Find        Common
......
```

查看命令别称 `get-alias -Definition '命令'`

```
PS C:\Users\gutianyi> Get-Alias -Definition 'Get-Service'

CommandType     Name                                               Version    Source
-----------     ----                                               -------    ------
Alias           gsv -> Get-Service
```

提示命令帮助信息 `show-command 命令`，会弹出图形提示框，填入信息后自动生成命令。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120049483.png)

# 提供程序

提供程序（PSProvider）本质上是一个适配器，可以访问某些数据存储介质，并使这些截至看起来像是磁盘驱动器一样。可通过模块或管理单元将提供程序添加到 PowerShell 中。

查看当前 shell 中存在的提供程序：

```powershell
PS C:\Users\gutianyi> Get-PSProvider

Name                 Capabilities                                      Drives
----                 ------------                                      ------
Registry             ShouldProcess, Transactions                       {HKLM, HKCU}
Alias                ShouldProcess                                     {Alias}
Environment          ShouldProcess                                     {Env}
FileSystem           Filter, ShouldProcess, Credentials                {C}
Function             ShouldProcess                                     {Function}
Variable             ShouldProcess                                     {Variable}
```

提供程序的功能（Capabilities）：

- ShouldProcess：支持`-WhatIf`和`-Confirm`参数，保证在正式执行这部分脚本之前能对他们进行测试。
- Filter：支持`-Filter`参数
- Credentials：允许使用可变更的凭据去连接数据存储，即支持`-Credentials`参数。
- Transactions：支持事务，即允许在该提供程序中将多个变更作为一个原子操作进行提交或回滚。

可使用某个提供程序去创建一个 PSDrive，PSDrive 可通过一个特定的提供程序去连接到某些存储介质，类似资源管理器，本质是创建一个驱动器映射。可查看当前已连接的驱动器

```
PS C:\Users\gutianyi> Get-PSDrive

Name           Used (GB)     Free (GB) Provider      Root                                               CurrentLocation
----           ---------     --------- --------      ----                                               ---------------
Alias                                  Alias
C                 204.70         31.68 FileSystem    C:\                                                 Users\gutianyi
Cert                                   Certificate   \
Env                                    Environment
Function                               Function
HKCU                                   Registry      HKEY_CURRENT_USER
HKLM                                   Registry      HKEY_LOCAL_MACHINE
Variable                               Variable
WSMan                                  WSMan
```

Windows 文件系统主要由三部分组成：

- 磁盘驱动器：是最上层的对象，包含文件夹与文件
- 文件夹：是一种容器对象，可包含文件或其他文件夹
- 文件：是最小的对象

在 PowerShell 中，并不使用文件和文件夹的说法，而是使用“项（Item）”指代文件或文件夹，因为 PSDrive 还可能映射到注册表（并不是文件系统）。

查看一个项的属性

```
PS C:\Users\gutianyi> Get-ItemProperty -Path C:\


    目录:


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
d--hs-         2019/6/1     12:39                C:\

PS C:\Users\gutianyi> Get-ItemProperty -Path C:\Users\gutianyi\Documents\ISOs\CentOS-7-x86_64-DVD-1804.iso


    目录: C:\Users\gutianyi\Documents\ISOs


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----       2018/11/24     18:33     4470079488 CentOS-7-x86_64-DVD-1804.iso
```

变更当前路径 `Set-Location 路径`，即进行文件夹切换，类似`cd`。

```
PS C:\Users\gutianyi> Set-Location C:\MyPrograms
PS C:\MyPrograms>
```

新建一个项，可以是文件、文件夹、注册表等，需要`-ItemType`指定类型

```
PS C:\Users\gutianyi\Documents> New-Item -ItemType Directory powershell-test


    目录: C:\Users\gutianyi\Documents


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
d-----         2019/6/2     11:12                powershell-test

PS C:\Users\gutianyi\Documents\powershell-test> New-Item -ItemType File test1


    目录: C:\Users\gutianyi\Documents\powershell-test


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----         2019/6/2     11:15              0 test1
```

查看指定项的子项（即子目录或文件），`get-childitem`与`dir`一致，允许使用通配符。

```
PS C:\Users\gutianyi\Documents> Get-ChildItem .\powershell-test\


    目录: C:\Users\gutianyi\Documents\powershell-test


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----         2019/6/2     11:15              0 test1
```

若路径中本身就包含了通配符，需要忽略，则需要使用参数`-LiteralPath`，不会解释任何字符为通配符。

修改注册表，以 HKEY_CURRENT_USER 为例。

```
PS C:\Users\gutianyi\Documents> Set-Location -Path HKCU:
PS HKCU:\> Set-Location .\Software\Microsoft\Windows\
PS HKCU:\Software\Microsoft\Windows\> Get-ChildItem

    Hive: HKEY_CURRENT_USER\Software\Microsoft\Windows

Name                           Property
----                           --------
CurrentVersion
DWM                            Composition                  : 1
                               ColorizationColor            : 3288365271
                               ColorizationColorBalance     : 89
                               ColorizationAfterglow        : 3288365271
                               ColorizationAfterglowBalance : 10
                               ColorizationBlurBalance      : 1
                               ColorizationGlassAttribute   : 1
                               AccentColor                  : 4292311040
                               ColorPrevalence              : 0
                               EnableAeroPeek               : 1
Shell
ShellNoRoam
TabletPC
Windows Error Reporting        LastQueuePesterTime               : 131958139657061437
                               LastRateLimitedDumpGenerationTime : 132034409468928434
Winlogon

PS HKCU:\Software\Microsoft\Windows> Set-ItemProperty -Path .\DWM\ -PSProperty EnableAeroPeek -Value 0
```

# 管道

将输出结果通过管道导到 CSV 或 XML 文件，通过`export-csv 文件`或`export-clixml 文件`

```
PS C:\Users\gutianyi\Documents> Get-Process | Export-Csv process.csv
PS C:\Users\gutianyi\Documents> Get-Process | Export-Clixml process.xml
```

比较两个文件或同个命令输出结果的不同，需要用到命令`compare-object`或`diff`（`compare-object`的别名）

```
PS C:\Users\gutianyi\Documents> diff -ReferenceObject (Import-Clixml .\process.xml) -DifferenceObject (Get-Process) -Property name

name               SideIndicator
----               -------------
cloudmusic         =>
cloudmusic         =>
cloudmusic         =>
firefox            =>
firefox            =>
firefox            =>
SearchProtocolHost =>
DocToPDF           <=
QQ                 <=
TXPlatform         <=
YNoteCefRender     <=
YNoteCefRender     <=
YNoteCefRender     <=
YoudaoNote         <=
```

若要直接将命令输出结果重定向到一个文件，可直接通过`>`导出。`>`是 powershell 为兼容 cmd 的一个快捷方式，实际在处理时使用的是`命令 | Outfile xxx.txt`。默认`Outfile`输出的文件最大列数为 80，若命令的列数超过了 80，则需要限制命令输出的参数。

还可以将输出转为 HTML，使用命令`ConvertTo-HTML`，后面最好再管道输出为文件，否则会直接将所有结果输出到终端。也可以转换为 CSV 文件或 XML 文件。

```
PS C:\Users\gutianyi\Documents> Import-Clixml .\process.xml | ConvertTo-Html | Out-File process.html
PS C:\Users\gutianyi\Documents> Import-Clixml .\process.xml | ConvertTo-Csv | Out-File process.csv
```

## 终止进程或停止服务

使用`Stop-Process`终止进程。

```
PS C:\Users\gutianyi> Get-Process -Name FoxitReader | Stop-Process
```

Cmdlets 内部定义有影响级别，且不允许修改，可通过变量`$ConfirmPreference`查看，默认为 High

```
PS C:\Users\gutianyi> $ConfirmPreference
High
```

当 Cmdlet 内部影响等级大于等于 Shell 的`$confirmpreference`时，不管 cmdlet 做什么，shell 都会询问`Are you Sure?`。若内部影响级别小于`$confirmpreference`时，则不会询问。但若要在操作时弹出确认，则可以添加参数`-confirm`

```
PS C:\Users\gutianyi> Get-Process -Name chrome | Stop-Process -Confirm

确认
是否确实要执行此操作?
正在目标“chrome (1432)”上执行操作“Stop-Process”。
[Y] 是(Y)  [A] 全是(A)  [N] 否(N)  [L] 全否(L)  [S] 暂停(S)  [?] 帮助 (默认值为“Y”): y

确认
```

若要查看停止进程或服务时，会执行哪些操作，减小误操作风险，可以加上`-whatif`参数，仅是查看，并不会真正执行。

```
PS C:\Users\gutianyi> Get-Process -Name chrome | Stop-Process -whatif
WhatIf: 正在目标“chrome (1676)”上执行操作“Stop-Process”。
WhatIf: 正在目标“chrome (2412)”上执行操作“Stop-Process”。
WhatIf: 正在目标“chrome (4856)”上执行操作“Stop-Process”。
WhatIf: 正在目标“chrome (9912)”上执行操作“Stop-Process”。
WhatIf: 正在目标“chrome (11848)”上执行操作“Stop-Process”。
.....
```

## 读取 csv 或 XML 文件

可通过`get-content 文件` 读取文件，但是该指令并不会对数据进行过滤及解析，排版不友好，会存在一些垃圾信息，如提示信息或文件信息。

而使用指令`import-csv`则会进行解析，清除掉无用或重复的信息，并格式化数据，便于查看。

# 命令示例

## 收集计算机信息

> 参考文章或书目：
>
> Windows PowerShell 实战指南（第二版）（Learn Windows Powershell In A Month Of Launches）
>
> [Microsoft PowerShell 文档](https://docs.microsoft.com/zh-cn/powershell/scripting/overview?view=powershell-5.1)
>
> [PowerShell 在线教程](https://www.pstips.net/powershell-online-tutorials)

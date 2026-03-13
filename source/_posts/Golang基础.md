---
title: Golang基础
tags: []
date: 2020-02-21 15:18:37
categories: [Golang]
comments: false
---

- [第1章：环境搭建与工具链](#第1章环境搭建与工具链)
  - [1.1 Go语言安装与配置](#11-go语言安装与配置)
    - [1.1.1 跨平台安装指南（Windows/Mac/Linux）](#111-跨平台安装指南windowsmaclinux)
    - [1.1.2 环境变量配置（$GOPATH vs. 模块模式）](#112-环境变量配置gopath-vs-模块模式)
    - [1.1.3 验证安装与版本管理（go version）](#113-验证安装与版本管理-go-version)
  - [1.2 模块管理（go mod）](#12-模块管理go-mod)
    - [1.2.1 初始化模块（go mod init）](#121-初始化模块-go-mod-init)
    - [1.2.2 依赖管理（go get、go mod tidy）](#122-依赖管理go-getgo-mod-tidy)
    - [1.2.3 版本控制与依赖升级](#123-版本控制与依赖升级)
  - [1.3 工具链使用](#13-工具链使用)
    - [1.3.1 代码格式化（go fmt）](#131-代码格式化go-fmt)
    - [1.3.2 构建与运行（go build/run）](#132-构建与运行go-buildrun)
    - [1.3.3 文档生成（godoc）](#133-文档生成godoc)
- [第2章：基础语法与程序结构](#第2章基础语法与程序结构)
  - [2.1 基本语法规范](#21-基本语法规范)
    - [2.1.1 代码结构（包声明、导入、主函数）](#211-代码结构包声明导入主函数)
    - [2.1.2 分号与代码风格](#212-分号与代码风格)
  - [2.2 数据类型](#22-数据类型)
    - [2.2.1 基本类型（整数、浮点、布尔、字符串）](#221-基本类型整数浮点布尔字符串)
    - [2.2.2 复合类型（数组、切片、Map、结构体）](#222-复合类型数组切片map结构体)
    - [2.2.3 零值与类型转换](#223-零值与类型转换)
  - [2.3 变量与常量](#23-变量与常量)
    - [2.3.1 变量声明（var、短变量声明:=）](#231-变量声明var短变量声明)
    - [2.3.2 常量定义（const）](#232-常量定义const)
    - [2.3.3 作用域与可见性规则](#233-作用域与可见性规则)
  - [2.4 控制流](#24-控制流)
    - [2.4.1 条件语句（if/else、switch）](#241-条件语句ifelseswitch)
    - [2.4.2 循环语句（for、range）](#242-循环语句forrange)
    - [2.4.3 跳转语句（break/continue/goto）](#243-跳转语句breakcontinuegoto)
- [第3章：函数与错误处理](#第3章函数与错误处理)
  - [3.1 函数基础](#31-函数基础)
    - [3.1.1 函数定义与参数传递（值传递 vs. 引用传递）](#311-函数定义与参数传递值传递-vs-引用传递)
    - [3.1.2 多返回值与命名返回值](#312-多返回值与命名返回值)
    - [3.1.3 可变参数与匿名函数](#313-可变参数与匿名函数)
  - [3.2 错误处理机制](#32-错误处理机制)
    - [3.2.1 错误类型（error接口）](#321-错误类型error接口)
    - [3.2.2 错误处理流程（检查错误、返回错误）](#322-错误处理流程检查错误返回错误)
    - [3.2.3 panic与recover机制](#323-panic与recover机制)
  - [3.3 延迟执行（defer）](#33-延迟执行defer)
    - [3.3.1 defer的工作原理](#331-defer的工作原理)
    - [3.3.2 资源清理与栈式执行](#332-资源清理与栈式执行)
- [第4章：包与模块化开发](#第4章包与模块化开发)
  - [4.1 包管理基础](#41-包管理基础)
    - [4.1.1 包的导入与别名](#411-包的导入与别名)
    - [4.1.2 可见性规则（大写首字母导出）](#412-可见性规则大写首字母导出)
  - [4.2 自定义包开发](#42-自定义包开发)
    - [4.2.1 包结构设计](#421-包结构设计)
    - [4.2.2 init函数与包初始化顺序](#422-init函数与包初始化顺序)
  - [4.3 标准库常用包概览](#43-标准库常用包概览)
    - [4.3.1 fmt包（格式化输入输出）](#431-fmt包格式化输入输出)
    - [4.3.2 os包（文件与系统操作）](#432-os包文件与系统操作)
    - [4.3.3 encoding/json（JSON编解码）](#433-encodingjsonjson编解码)
    - [4.3.4 time包（时间处理）](#434-time包时间处理)
- [第5章：接口与类型系统](#第5章接口与类型系统)
  - [5.1 接口定义与实现](#51-接口定义与实现)
    - [5.1.1 接口的隐式实现](#511-接口的隐式实现)
    - [5.1.2 空接口（interface{}）的应用](#512-空接口interface的应用)
  - [5.2 类型嵌入与组合](#52-类型嵌入与组合)
    - [5.2.1 结构体嵌入与继承](#521-结构体嵌入与继承)
    - [5.2.2 方法集与接口组合](#522-方法集与接口组合)
  - [5.3 类型断言与类型转换](#53-类型断言与类型转换)
    - [5.3.1 类型断言（type switch）](#531-类型断言type-switch)
    - [5.3.2 类型转换与反射](#532-类型转换与反射)
- [第6章：测试与性能基准](#第6章测试与性能基准)
  - [6.1 单元测试](#61-单元测试)
    - [6.1.1 测试函数编写规范（TestXxx）](#611-测试函数编写规范testxxx)
    - [6.1.2 表驱动测试与子测试（t.Run）](#612-表驱动测试与子测试trun)
  - [6.2 性能基准测试](#62-性能基准测试)
    - [6.2.1 Benchmark函数与指标分析](#621-benchmark函数与指标分析)
    - [6.2.2 性能优化示例](#622-性能优化示例)
  - [6.3 代码覆盖率与工具](#63-代码覆盖率与工具)
    - [6.3.1 go test -cover的使用](#631-go-test--cover的使用)
    - [6.3.2 可视化覆盖率报告](#632-可视化覆盖率报告)
  - [6.4 测试工具链](#64-测试工具链)
    - [6.4.1 测试框架（如testing.T）](#641-测试框架如testingt)
    - [6.4.2 依赖Mock与测试替身](#642-依赖mock与测试替身)

<!--more-->

# 第1章：环境搭建与工具链

## 1.1 Go语言安装与配置

### 1.1.1 跨平台安装指南（Windows/Mac/Linux）

Go语言（又称Golang）由Google开发，以其简洁、高效和并发支持著称。在开始学习Go之前，首先需要搭建开发环境。

#### Windows安装

**方式一：官方安装包（推荐）**

1. 访问 [Go官网下载页面](https://go.dev/dl/) 或 [Golang中国](https://golang.google.cn/dl/)
2. 下载 Windows 版本的 MSI 或 ZIP 安装包
3. 运行安装程序或解压到指定目录（如 `C:\Go`）
4. 添加环境变量：将 `C:\Go\bin` 添加到 PATH

**方式二：使用 Chocolatey**

```powershell
# 安装 Go
choco install golang

# 验证安装
go version
```

**方式三：使用 Scoop**

```powershell
scoop install go
```

**环境变量配置（Windows）**

```powershell
# 手动配置环境变量
[System.Environment]::SetEnvironmentVariable("GOROOT", "C:\Go", "User")
[System.Environment]::SetEnvironmentVariable("GOPATH", "$env:USERPROFILE\go", "User")
# 添加到 PATH
[System.Environment]::SetEnvironmentVariable("PATH", "$env:PATH;C:\Go\bin", "User")
```

#### macOS安装

**方式一：官方安装包**

1. 下载 macOS 版本的 PKG 安装包
2. 运行安装程序，默认安装到 `/usr/local/go`
3. 打开终端验证安装

**方式二：Homebrew（推荐）**

```bash
# 安装 Go
brew install go

# 验证安装
go version
# 输出：go version go1.21.5 darwin/amd64
```

**方式三：Go版本管理工具（g）**

```bash
# 安装 g（Go版本管理器）
brew install g

# 安装指定版本
g install 1.21.5

# 切换版本
g use 1.21.5
```

#### Linux安装

**方式一：包管理器**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install golang-go

# CentOS/RHEL
sudo yum install golang

# Fedora
sudo dnf install golang
```

**方式二：手动安装**

```bash
# 下载 Go 二进制文件
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz

# 解压到 /usr/local
sudo tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz

# 添加到 PATH（~/.bashrc 或 ~/.zshrc）
export PATH=$PATH:/usr/local/go/bin

# 使配置生效
source ~/.bashrc

# 验证安装
go version
```

**方式三：Go版本管理工具（g）**

```bash
# 安装 g
curl -sL https://git.io/g-install | sh

# 使用 g 管理版本
g install 1.21.5
g use 1.21.5
```

### 1.1.2 环境变量配置（$GOPATH vs. 模块模式）

Go语言的发展经历了两个主要阶段：GOPATH模式和模块模式。理解这两种模式对于 Go 开发至关重要。

#### GOPATH 模式

GOPATH 是 Go 语言早期使用的依赖管理方式，需要设置环境变量指定代码存放位置。

**核心环境变量：**

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `GOROOT` | Go 安装目录 | `/usr/local/go` 或 `C:\Go` |
| `GOPATH` | 工作区目录 | `~/go` 或 `C:\Users\user\go` |
| `GOBIN` | 可执行文件安装目录 | `$GOPATH/bin` |

**目录结构：**

```
$GOPATH/
├── src/           # 源代码
│   ├── github.com/
│   │   └── username/
│   │       └── project/
│   └── golang.org/
│       └── x/
├── pkg/           # 编译后的包
│   └── linux_amd64/
│       └── github.com/
└── bin/           # 可执行文件
    └── hello
```

**特点：**
- 所有项目代码必须在 `$GOPATH/src` 下
- 依赖通过 `go get` 下载到 `$GOPATH/src`
- 不同项目共享同一套依赖
- Go 1.11 之前唯一的模块管理方式

#### 模块模式（Go Modules）

Go 1.11 引入模块模式，1.16 成为默认模式。这是现代 Go 开发的推荐方式。

**核心概念：**

- **Module（模块）**：一个代码单元，每个模块有独立的版本管理
- **go.mod**：模块定义文件，记录模块名、Go 版本、依赖等
- **go.sum**：依赖的校验和，确保构建可重现
- **go.modreplace`：替换依赖路径（用于本地开发）

**模块模式的优势：**

| 特性 | GOPATH | 模块模式 |
|------|--------|----------|
| 项目位置 | 必须在 `$GOPATH/src` | 任意位置 |
| 依赖管理 | 全局共享 | 项目级独立 |
| 版本控制 | 无 | 语义化版本 |
| 依赖分发 | GOPATH | Go Proxy |

**初始化模块：**

```bash
# 创建新模块
mkdir myproject
cd myproject
go mod init github.com/username/myproject
# 或者
go mod init myproject
```

**生成的 go.mod：**

```go
module github.com/username/myproject

go 1.21
```

#### 环境变量配置示例

```bash
# 方式一：使用默认值（推荐）
# Go 会自动设置合理的默认值

# 方式二：自定义 GOPATH
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin

# 方式三：启用模块模式（Go 1.16+ 默认启用）
export GO111MODULE=on    # 显式启用模块模式
export GO111MODULE=off  # 使用 GOPATH 模式
export GO111MODULE=auto # 自动检测

# 查看当前 Go 环境配置
go env
```

**常用 go env 命令：**

```bash
# 查看特定环境变量
go env GOROOT
go env GOPATH
go env GO111MODULE
go env GOPROXY  # 模块代理

# 设置环境变量
go env -w GOPROXY=https://goproxy.cn,direct
go env -w GOSUMDB=off
```

### 1.1.3 验证安装与版本管理（go version）

安装完成后，验证 Go 环境是否正确配置。

#### 验证安装

```bash
# 基本验证
go version
# 输出：go version go1.21.5 darwin/amd64

# 查看完整环境信息
go env

# 检查 Go 安装路径
go env GOROOT
# 输出：/usr/local/go (Linux/Mac) 或 C:\Go (Windows)

# 检查工作区路径
go env GOPATH
# 输出：/Users/username/go (Mac) 或 C:\Users\username\go (Windows)
```

#### 运行第一个 Go 程序

```go
// hello.go
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
```

```bash
# 运行程序
go run hello.go
# 输出：Hello, World!

# 或者先编译再运行
go build hello.go
./hello  # Linux/Mac
hello.exe # Windows
```

#### Go 版本管理

Go 语言采用语义化版本号，格式为 `goMajor.Minor.Patch`。

**查看可用版本：**

```bash
# 查看本地已安装的 Go 版本
go version

# 使用 g 查看可用版本
g list

# 在线查看可用版本
go version -m ./your-binary
```

**升级/降级 Go 版本：**

```bash
# 使用 g 升级
g install latest
g install 1.21.0
g use 1.21.0 --local

# 使用官方安装包重新安装
# 1. 下载新版本
# 2. 替换安装目录
# 3. 验证版本
```

**Go 版本兼容性：**

Go 保证向后兼容性。`go 1.21` 表示模块需要 Go 1.21+ 编译。

```go
// go.mod
module mymodule

go 1.21  // 最低要求 Go 1.21
```

## 1.2 模块管理（go mod）

### 1.2.1 初始化模块（go mod init）

Go Modules 是 Go 1.11 引入的官方依赖管理机制，现在已成为 Go 项目的标准。

#### 初始化新模块

```bash
# 在项目目录初始化
go mod init github.com/username/projectname

# 或使用自定义模块名
go mod init mymodule

# 或使用公司/组织域名
go mod init gitlab.company.com/team/project
```

#### go.mod 文件结构

```go
module github.com/username/myproject

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/go-redis/redis/v8 v8.11.5
    gorm.io/gorm v1.25.5
)

require (
    github.com/bytedance/sonic v1.9.1 // indirect
    github.com/chenzhuoyu/base64x v0.0.0-20221115062448-fe3a3abad311 // indirect
    github.com/gabriel-vasile/mimetype v1.4.2 // indirect
    github.com/gin-contrib/sse v0.1.0 // indirect
    github.com/go-playground/locales v0.14.1 // indirect
    github.com/go-playground/universal-translator v0.18.1 // indirect
    github.com/go-playground/validator/v10 v10.14.0 // indirect
    github.com/goccy/go-json v0.10.2 // indirect
    github.com/json-iterator/go v1.1.12 // indirect
    github.com/klauspost/cpuid/v2 v2.2.4 // indirect
    github.com/leodido/go-urn v1.2.4 // indirect
    github.com/mattn/go-isatty v0.0.19 // indirect
    github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
    github.com/modern-go/reflect2 v1.0.2 // indirect
    github.com/pelletier/go-toml/v2 v2.0.8 // indirect
    github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
    github.com/ugorji/go/codec v1.2.11 // indirect
    golang.org/x/arch v0.3.0 // indirect
    golang.org/x/crypto v0.9.0 // indirect
    golang.org/x/net v0.10.0 // indirect
    golang.org/x/sys v0.8.0 // indirect
    golang.org/x/text v0.9.0 // indirect
    google.golang.org/protobuf v1.30.0 // indirect
    gopkg.in/yaml.v3 v3.0.1 // indirect
)
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `module` | 模块名称（唯一标识） |
| `go` | Go 版本号 |
| `require` | 直接依赖 |
| `indirect` | 间接依赖（仅 go.mod 中需要，go.sum 不需要标记） |
| `replace` | 替换依赖（用于本地开发） |
| `exclude` | 排除依赖 |

#### 已有项目迁移到模块

```bash
# 进入项目目录
cd myproject

# 初始化模块（自动检测依赖）
go mod init github.com/username/myproject

# 自动添加依赖
go mod tidy

# 或者手动添加依赖
go get github.com/gin-gonic/gin@v1.9.1
```

### 1.2.2 依赖管理（go get、go mod tidy）

#### go get 命令详解

```bash
# 安装最新版本的依赖
go get github.com/gin-gonic/gin

# 安装指定版本
go get github.com/gin-gonic/gin@v1.9.0
go get github.com/gin-gonic/gin@v1.9.1

# 安装最新补丁版本（使用 @latest）
go get github.com/gin-gonic/gin@latest

# 安装预发布版本
go get github.com/gin-gonic/gin@beta
go get github.com/gin-gonic/gin@alpha

# 安装特定提交
go get github.com/gin-gonic/gin@c844b18

# 从本地安装
go get ./mylocalpackage

# 更新到最新版本
go get -u github.com/gin-gonic/gin

# 更新所有依赖
go get -u ./...
```

#### go mod tidy 命令

`go mod tidy` 自动整理依赖：

1. 移除未使用的依赖
2. 添加缺失的依赖
3. 更新 go.sum

```bash
# 整理依赖
go mod tidy

# 详细输出
go mod tidy -v

# 示例输出：
# github.com/username/myproject imports
#     github.com/gin-gonic/gin: modified (pin to v1.9.1)
#     github.com/go-redis/redis/v8: added (v8.11.5)
```

#### 常用依赖管理命令

```bash
# 下载所有依赖
go mod download

# 下载指定依赖
go mod download github.com/gin-gonic/gin

# 下载到 GOPATH/pkg/mod 缓存
go mod download all

# 查看依赖列表
go list -m all
go list -m -json all

# 查看依赖树
go mod graph

# 验证依赖（检查 go.sum）
go mod verify

# 移除未使用的依赖
go mod tidy
```

### 1.2.3 版本控制与依赖升级

#### 语义化版本

Go Modules 使用语义化版本（Semantic Versioning）：

```
vMAJOR.MINOR.PATCH
v1.2.3
  │  │  │
  │  │  └── Patch: bug 修复，兼容变更
  │  └───── Minor: 新功能，兼容变更
  └───────── Major: 破坏性变更
```

**版本选择：**

| 版本规范 | 说明 | 示例 |
|----------|------|------|
| `v1.2.3` | 精确版本 | v1.2.3 |
| `v1.2.x` | 最新的 v1.2 | v1.2.5 |
| `v1.x` | 最新的 v1 | v1.9.1 |
| `v0.0.0` | 最新的 | 最新的 |
| `v1.2.3-pre` | 预发布版本 | v1.2.3-beta.1 |

#### 升级依赖

```bash
# 查看可用的次版本和补丁版本
go list -m -versions github.com/gin-gonic/gin

# 升级到最新的补丁版本
go get github.com/gin-gonic/gin@latest

# 升级到最新的次版本
go get github.com/gin-gonic/gin@v1.9

# 升级所有依赖
go get -u ./...

# 交互式升级
go get -u
```

#### 降级依赖

```bash
# 降级到特定版本
go get github.com/gin-gonic/gin@v1.8.0

# 查看历史版本
go list -m -versions github.com/gin-gonic/gin

# 恢复到上一个已知良好的版本
go mod tidy
# 如果需要，可以手动指定版本
go get github.com/gin-gonic/gin@v1.8.2
```

#### 使用 go.mod replace

本地开发时替换依赖：

```go
// go.mod
module myproject

go 1.21

require (
    github.com/company/utils v1.0.0
)

// 使用本地路径替换
replace github.com/company/utils => ../utils

// 或使用绝对路径
replace github.com/company/utils => /Users/developer/go/utils
```

## 1.3 工具链使用

### 1.3.1 代码格式化（go fmt）

Go 强制使用统一的代码风格，提供了官方格式化工具。

#### go fmt 使用

```bash
# 格式化当前目录的所有 .go 文件
go fmt ./...

# 显示需要格式化的内容（不修改）
go fmt -n ./...

# 详细模式
go fmt -x ./...
```

#### gofmt（底层工具）

`gofmt` 是底层格式化工具，`go fmt` 实际上是 `gofmt -l -w` 的封装。

```bash
# 基本格式化
gofmt hello.go

# 原地修改
gofmt -w hello.go

# 显示差异
gofmt -d hello.go

# 使用指定缩进
gofmt -tabsize=4 hello.go

# 使用空格代替 tab
gofmt -tabs=false hello.go
```

#### 格式化规则示例

```go
// 格式化前
package main
import("fmt";      func main(){
fmt.Println("Hello")})

// 格式化后
package main

import (
    "fmt"
)

func main() {
    fmt.Println("Hello")
}
```

#### IDE/Editor 集成

大多数 IDE 会在保存时自动格式化：

- **VS Code**：安装 Go 扩展，设置 `go.formatTool` 为 `gofmt`
- **GoLand**：默认启用 `Reformat on Save`
- **Vim/Neovim**：使用 `vim-go` 插件

### 1.3.2 构建与运行（go build/run）

#### go run - 快速运行

```bash
# 运行单个文件
go run hello.go

# 运行多个文件
go run main.go utils.go

# 运行时设置环境变量
GOOS=linux GOARCH=arm64 go run hello.go
```

**注意**：`go run` 会编译并运行，但不会生成可执行文件。

#### go build - 编译

```bash
# 编译当前目录
go build

# 指定输出文件名
go build -o myapp

# 编译指定文件
go build -o myapp main.go

# 编译并安装到 $GOPATH/bin
go install

# 安装指定包
go install github.com/username/hello@latest
```

**编译输出：**

```bash
# Linux/macOS 生成同名可执行文件
go build -o hello hello.go
./hello

# Windows 生成 .exe 文件
go build -o hello.exe hello.go
hello.exe
```

#### 构建约束

通过 build tags 指定编译条件：

```go
// +build linux

package main

// 仅在 Linux 下编译
func linuxOnly() {
    println("Linux")
}
```

```go
// +build !windows

package main

// 仅在非 Windows 下编译
func notWindows() {
    println("Not Windows")
}
```

```go
// +build prod

package main

// 仅在 prod 标签下编译
func productionOnly() {
    println("Production")
}
```

使用：

```bash
go build -tags=prod
```

#### 交叉编译

Go 原生支持交叉编译，无需额外工具。

```bash
# macOS -> Linux
GOOS=linux GOARCH=amd64 go build -o hello-linux hello.go

# macOS -> Windows
GOOS=windows GOARCH=amd64 go build -o hello.exe hello.go

# macOS -> ARM64 (Apple Silicon)
GOOS=darwin GOARCH=arm64 go build -o hello-arm64 hello.go

# Linux -> Windows
GOOS=windows GOARCH=amd64 go build -o hello.exe hello.go

# 常见平台组合
# GOOS: linux, darwin, windows, freebsd, openbsd, netbsd
# GOARCH: 386, amd64, arm, arm64, ppc64, ppc64le, mips64, mips64le, riscv64
```

### 1.3.3 文档生成（godoc）

#### 使用 godoc

```bash
# 安装 godoc
go install golang.org/x/tools/cmd/godoc@latest

# 启动本地文档服务器
godoc -http=:6060

# 访问 http://localhost:6060
```

#### go doc 命令行文档

```bash
# 查看包文档
go doc fmt
go doc fmt.Println

# 查看函数文档
go doc os.Exit
go doc json.Decoder

# 查看类型文档
go doc reflect.Type

# 更详细的输出
go doc -all fmt
```

#### 注释生成文档

Go 使用注释生成文档，遵循约定俗成的规则：

```go
// Package math provides basic constants and mathematical functions.
//
// The math package provides basic constants and mathematical
// functions that are not covered in the built-in package.
package math

// Pi returns the pi constant.
//
// Pi returns the ratio of a circle's circumference to its diameter.
func Pi() float64 {
    return 3.14159265358979323846
}

// Abs returns the absolute value of x.
//
// Special cases:
//     Abs(+Inf) = +Inf
//     Abs(-Inf) = +Inf
//     Abs(NaN) = NaN
func Abs(x float64) float64 {
    if x < 0 {
        return -x
    }
    if x == 0 {
        return 0 // return positive zero
    }
    return x
}
```

**注释规则：**

- 包注释：放在 `package` 关键字前的注释块
- 函数/类型注释：紧挨着声明前的注释
- 导出标识符（首字母大写）的注释会生成文档
- 注释以被文档化的对象名称开头

```go
// Fprint formats using the default formats for its operands and writes to w.
// Spaces are added between operands when neither is a string.
// It returns the number of bytes written and any write error encountered.
func Fprint(w io.Writer, a ...interface{}) (n int, err error) {
    // ...
}
```

# 第2章：基础语法与程序结构

## 2.1 基本语法规范

### 2.1.1 代码结构（包声明、导入、主函数）

Go 程序由包（package）组成，每个 `.go` 文件必须在第一行声明所属包。

#### 包声明

```go
// 声明当前文件属于 main 包
package main

// 声明当前文件属于 utils 包
package utils
```

- `package main`：可执行程序的入口包
- 其他包：库包，可以被其他包导入使用
- 同一个包的所有文件必须放在同一目录下

#### 导入声明

```go
// 单行导入
import "fmt"
import "os"

// 分组导入（推荐）
import (
    "fmt"
    "os"
    "strings"
)

// 导入并重命名
import (
    f "fmt"           // 重命名为 f
    myos "os"         // 重命名为 myos
    . "math"          // 导入 math 的所有符号，直接使用（慎用）
    _ "image/png"     // 导入仅执行 init()，不提供命名空间
)

// 不使用下划线导入
// _ 用于导入包但不使用其中的任何符号
// 常用于注册驱动（如数据库驱动、图像格式）
import _ "github.com/go-sql-driver/mysql"
```

#### 主函数

```go
// main 函数是程序入口
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
```

#### 完整示例

```go
// hello.go
package main

import (
    "fmt"
    "math"
    "strings"
)

func main() {
    // 打印 Hello World
    fmt.Println("Hello, World!")
    
    // 使用 math 包
    fmt.Printf("PI = %.2f\n", math.Pi)
    
    // 使用 strings 包
    fmt.Println(strings.ToUpper("hello"))
}
```

### 2.1.2 分号与代码风格

Go 编译器会自动插入分号，但了解其规则有助于理解代码。

#### 分号插入规则

Go 代码中通常不写分号，但编译器会自动添加：

```go
// 编译器实际生成的代码
func main() {
    fmt.Println("Hello");
};

// 注意事项：左括号必须在行尾，不能另起一行
// 错误写法
func main()
{
    fmt.Println("Hello")
}

// 正确写法
func main() {
    fmt.Println("Hello")
}
```

#### 代码风格建议

```go
// 1. 导入多个包时，按字母顺序排列
import (
    "encoding/json"
    "fmt"
    "io"
    "os"
)

// 2. 变量和函数名使用混合大小写（驼峰命名）
var userName string
func CalculateSum() {}

// 3. 常量使用全大写加下划线
const MAX_VALUE = 100
const PI = 3.14159

// 4. 缩写词保持一致的大小写
// 错误：getURL, URLParser
// 正确：getURL, URLParser 或 GetURL, UrlParser

// 5. 简洁的代码往往更好
// 冗余
var x int = 10
// 简洁
x := 10
```

## 2.2 数据类型

### 2.2.1 基本类型（整数、浮点、布尔、字符串）

Go 是静态类型语言，每个变量都有明确的类型。

#### 整数类型

| 类型 | 说明 | 取值范围 |
|------|------|----------|
| `int8` | 8位有符号整数 | -128 ~ 127 |
| `uint8` | 8位无符号整数 | 0 ~ 255 |
| `int16` | 16位有符号整数 | -32768 ~ 32767 |
| `uint16` | 16位无符号整数 | 0 ~ 65535 |
| `int32` | 32位有符号整数 | -21亿 ~ 21亿 |
| `uint32` | 32位无符号整数 | 0 ~ 42亿 |
| `int64` | 64位有符号整数 | 很大 |
| `uint64` | 64位无符号整数 | 很大 |
| `int` | 平台相关有符号整数 | 32位或64位 |
| `uint` | 平台相关无符号整数 | 32位或64位 |
| `uintptr` | 足以存储指针的整数 | 平台相关 |

**使用示例：**

```go
package main

import "fmt"

func main() {
    // 有符号整数
    var a int = 10
    var b int8 = -128
    var c int16 = 32767
    var d int32 = 2147483647
    var e int64 = 9223372036854775807

    // 无符号整数
    var f uint = 10
    var g uint8 = 255
    var h uint16 = 65535
    var i uint32 = 4294967295
    var j uint64 = 18446744073709551615

    // 平台相关类型
    k := 10 // int
    l := uint(10) // uint

    fmt.Println(a, b, c, d, e, f, g, h, i, j, k, l)

    // 数字字面量
    decimal := 42        // 十进制
    hex := 0xFF          // 十六进制
    octal := 0777        // 八进制
    binary := 0b1010     // 二进制

    fmt.Printf("decimal: %d, hex: %d, octal: %d, binary: %d\n", 
               decimal, hex, octal, binary)

    // 自动推断类型
    fmt.Printf("Type: %T, Value: %v\n", decimal, decimal)
}
```

#### 浮点数类型

| 类型 | 说明 | 精度 |
|------|------|------|
| `float32` | 32位浮点数 | 约7位小数 |
| `float64` | 64位浮点数 | 约15位小数 |
| `complex64` | 32位复数 | |
| `complex128` | 64位复数 | |

**使用示例：**

```go
package main

import "fmt"
import "math"

func main() {
    // 浮点数定义
    f1 := 3.14       // float64
    f2 := float32(3.14) // float32
    f3 := 1e10       // 科学计数法
    f4 := 1.5e-5     // 0.000015

    fmt.Println(f1, f2, f3, f4)

    // 浮点数精度问题
    a := 0.1
    b := 0.2
    c := a + b
    fmt.Println(c)           // 0.30000000000000004
    fmt.Printf("%.2f\n", c)  // 0.30

    // math 包常用函数
    fmt.Println(math.MaxFloat32)  // 最大 float32
    fmt.Println(math.MaxFloat64)  // 最大 float64
    fmt.Println(math.Inf(1))      // 正无穷
    fmt.Println(math.NaN())       // 非数

    // 判断是否为 NaN
    n := math.NaN()
    fmt.Println(n == n)  // false

    // 复数
    var c1 complex64 = 1 + 2i
    c2 := complex(3, 4)
    fmt.Println(real(c1), imag(c1))
    fmt.Println(c1 * c2)
}
```

#### 布尔类型

```go
package main

import "fmt"

func main() {
    // 布尔类型
    var b1 bool = true
    b2 := false

    fmt.Println(b1, b2)

    // 布尔运算
    fmt.Println(true && false)  // false (AND)
    fmt.Println(true || false)  // true  (OR)
    fmt.Println(!true)          // false (NOT)

    // 布尔转换
    // Go 中布尔不能与其他类型转换

    // 常见误区
    n := 10
    // 错误写法
    // if n { }  // 编译错误
    // 正确写法
    if n != 0 {
        fmt.Println("n is not zero")
    }

    // 简短布尔赋值
    if v, ok := getValue(); ok {
        fmt.Println(v)
    }
}

func getValue() (int, bool) {
    return 10, true
}
```

#### 字符串类型

```go
package main

import (
    "fmt"
    "strings"
    "unicode/utf8"
)

func main() {
    // 字符串定义
    s1 := "Hello, World!"
    s2 := `多行字符串
    可以包含换行`

    fmt.Println(s1)
    fmt.Println(s2)

    // 字符串长度
    fmt.Println(len("Hello"))           // 5 (字节数)
    fmt.Println(utf8.RuneCountInString("Hello")) // 5 (字符数)
    fmt.Println(utf8.RuneCountInString("你好")) // 2

    // 字符串遍历
    str := "Hello世界"
    
    // 字节遍历
    for i := 0; i < len(str); i++ {
        fmt.Printf("%x ", str[i])
    }
    fmt.Println()

    // 字符遍历（正确方式）
    for i, r := range str {
        fmt.Printf("%d: %c ", i, r)
    }
    fmt.Println()

    // 字符串拼接
    s := "Hello" + " " + "World"
    s += "!"
    fmt.Println(s)

    // strings 包常用函数
    fmt.Println(strings.ToUpper("hello"))
    fmt.Println(strings.ToLower("HELLO"))
    fmt.Println(strings.Contains("hello world", "world"))
    fmt.Println(strings.Replace("foo bar", "o", "0", -1))
    fmt.Println(strings.Split("a,b,c", ","))
    fmt.Println(strings.Trim("  hello  ", " "))
    fmt.Println(strings.Join([]string{"a", "b"}, "-"))

    // 字符串与字节切片转换
    bytes := []byte("hello")
    strFromBytes := string(bytes)

    // 字符串与 rune 切片转换
    runes := []rune("hello世界")
    strFromRunes := string(runes)

    fmt.Println(bytes, strFromBytes)
    fmt.Println(runes, strFromRunes)
}
```

### 2.2.2 复合类型（数组、切片、Map、结构体）

#### 数组

数组是固定长度的同类型元素的序列。

```go
package main

import "fmt"

func main() {
    // 数组声明
    var arr1 [5]int              // 长度为5的 int 数组，初始值为 [0, 0, 0, 0, 0]
    arr2 := [3]int{1, 2, 3}     // 带初始值的声明
    arr3 := [...]int{1, 2, 3, 4} // 自动推断长度

    fmt.Println(arr1)
    fmt.Println(arr2)
    fmt.Println(arr3)

    // 指定索引初始化
    arr4 := [5]int{0: 1, 2: 3, 4: 5} // [1, 0, 3, 0, 5]

    fmt.Println(arr4)

    // 数组长度和容量
    fmt.Println(len(arr4), cap(arr4)) // 5, 5

    // 数组遍历
    for i := 0; i < len(arr2); i++ {
        fmt.Printf("arr2[%d] = %d\n", i, arr2[i])
    }

    // 使用 range 遍历
    for i, v := range arr2 {
        fmt.Printf("arr2[%d] = %d\n", i, v)
    }

    // 只遍历值
    for _, v := range arr2 {
        fmt.Println(v)
    }

    // 数组是值类型
    a := [3]int{1, 2, 3}
    b := a  // 复制整个数组
    b[0] = 100
    fmt.Println(a, b) // [1 2 3] [100 2 3]

    // 数组作为函数参数（值传递）
    modifyArray(a)
    fmt.Println(a) // [1 2 3]（未改变）

    // 使用指针
    modifyArrayPtr(&a)
    fmt.Println(a) // [100 2 3]
}

func modifyArray(arr [3]int) {
    arr[0] = 100
}

func modifyArrayPtr(arr *[3]int) {
    arr[0] = 100
}
```

#### 切片（Slice）

切片是数组的动态视图，长度可变。

```go
package main

import "fmt"

func main() {
    // 切片声明
    var s1 []int              // nil 切片
    s2 := []int{1, 2, 3}      // 带初始值
    s3 := make([]int, 5)      // 长度5，容量5
    s4 := make([]int, 3, 10)  // 长度3，容量10

    fmt.Println(s1, s2, s3, s4)

    // 从数组创建切片
    arr := [5]int{1, 2, 3, 4, 5}
    s5 := arr[1:4]   // [2, 3, 4]  (左闭右开)
    s6 := arr[:3]    // [1, 2, 3]
    s7 := arr[2:]    // [3, 4, 5]
    s8 := arr[:]     // [1, 2, 3, 4, 5]

    fmt.Println(s5, s6, s7, s8)

    // 切片的长度和容量
    fmt.Printf("len=%d, cap=%d\n", len(s5), cap(s5))

    // 切片操作
    s := []int{1, 2, 3}
    
    // append - 添加元素
    s = append(s, 4)
    s = append(s, 5, 6)
    fmt.Println(s) // [1 2 3 4 5 6]

    // 超过容量时自动扩容
    for i := 0; i < 10; i++ {
        s = append(s, i)
        fmt.Printf("len=%d, cap=%d\n", len(s), cap(s))
    }

    // copy - 复制切片
    s1 := []int{1, 2, 3}
    s2 := make([]int, len(s1))
    copy(s2, s1)
    fmt.Println(s1, s2) // [1 2 3] [1 2 3]

    // delete - 删除元素
    s = []int{1, 2, 3, 4, 5}
    // 删除 index 2 的元素
    s = append(s[:2], s[3:]...)
    fmt.Println(s) // [1 2 4 5]

    // 切片遍历
    for i, v := range s {
        fmt.Printf("s[%d] = %d\n", i, v)
    }

    // 多维切片
    matrix := [][]int{
        {1, 2, 3},
        {4, 5, 6},
    }
    fmt.Println(matrix)
}
```

#### Map（字典）

Map 是无序的键值对集合。

```go
package main

import "fmt"

func main() {
    // Map 声明
    var m1 map[string]int           // nil map
    m2 := map[string]int{}          // 空 map
    m3 := map[string]int{
        "apple":  5,
        "banana": 3,
        "orange": 2,
    }

    // 使用 make 创建
    m4 := make(map[string]int)
    m5 := make(map[string]int, 10)  // 预分配空间

    fmt.Println(m1, m2, m3, m4, m5)

    // 访问元素
    fmt.Println(m3["apple"])  // 5

    // 添加/修改元素
    m3["grape"] = 10
    m3["apple"] = 6

    // 判断键是否存在
    value, ok := m3["pear"]
    if ok {
        fmt.Println("pear exists:", value)
    } else {
        fmt.Println("pear does not exist")
    }

    // 删除元素
    delete(m3, "banana")
    fmt.Println(m3)

    // 遍历 Map
    for key, value := range m3 {
        fmt.Printf("%s: %d\n", key, value)
    }

    // 只遍历 key
    for key := range m3 {
        fmt.Println(key)
    }

    // 只遍历 value
    for _, value := range m3 {
        fmt.Println(value)
    }

    // Map 是引用类型
    m6 := m3
    m6["apple"] = 100
    fmt.Println(m3["apple"], m6["apple"]) // 100 100

    // 使用 Map 作为 Set（去重）
    set := make(map[string]bool)
    items := []string{"apple", "banana", "apple", "orange", "banana"}
    
    for _, item := range items {
        set[item] = true
    }
    fmt.Println(set) // map[apple:true banana:true orange:true]
}
```

#### 结构体

结构体是自定义的复合数据类型。

```go
package main

import "fmt"

type Person struct {
    Name string
    Age  int
    City string
}

// 带有方法的结构体
type Employee struct {
    Person
    ID     string
    Salary float64
}

// 标签定义
type User struct {
    Username string `json:"username"`
    Password string `json:"-"`
    Age      int    `json:"age,omitempty"`
}

func main() {
    // 结构体初始化
    p1 := Person{Name: "Tom", Age: 30, City: "Beijing"}
    p2 := Person{"Jerry", 25, "Shanghai"}  // 按字段顺序
    p3 := new(Person)                        // 返回指针

    fmt.Println(p1, p2, p3)

    // 访问字段
    fmt.Println(p1.Name, p1.Age)

    // 修改字段
    p1.Age = 31
    fmt.Println(p1)

    // 结构体是值类型
    p4 := p1
    p4.Name = "Mike"
    fmt.Println(p1.Name, p4.Name) // Tom Mike

    // 结构体指针
    p5 := &Person{Name: "Bob", Age: 35}
    fmt.Println(p5.Name)      // 自动解引用
    (*p5).Name = "Alice"
    fmt.Println(p5.Name)

    // 匿名结构体
    person := struct {
        Name string
        Age  int
    }{
        Name: "Anonymous",
        Age:  20,
    }
    fmt.Println(person)

    // 结构体标签
    u := User{
        Username: "admin",
        Password: "123456",
        Age:      18,
    }
    fmt.Printf("%+v\n", u)

    // 嵌入结构体
    e := Employee{
        Person: Person{Name: "John", Age: 28},
        ID:     "E001",
        Salary: 10000.0,
    }
    fmt.Println(e.Name, e.ID) // 可以直接访问嵌入的字段
}
```

### 2.2.3 零值与类型转换

#### 零值

Go 中变量声明后会自动初始化为零值。

```go
package main

import "fmt"

func main() {
    // 各种类型的零值
    var i int          // 0
    var f float64     // 0
    var b bool        // false
    var s string      // ""
    var p *int        // nil
    var arr []int     // nil
    var m map[string]int  // nil
    var c chan int    // nil

    fmt.Printf("int: %d, float: %f, bool: %v, string: %q\n", i, f, b, s)
    fmt.Printf("pointer: %v, slice: %v, map: %v, chan: %v\n", p, arr, m, c)

    // 零值的作用
    // 1. 数组
    var nums [5]int
    fmt.Println(nums) // [0 0 0 0 0]

    // 2. 切片（nil 切片可以直接 append）
    var slice []int
    slice = append(slice, 1, 2, 3)
    fmt.Println(slice) // [1 2 3]

    // 3. Map（nil Map 不能直接操作）
    var m1 map[string]int
    // m1["a"] = 1 // 报错：panic: assignment to entry in nil map
    
    // 需要先 make
    m1 = make(map[string]int)
    m1["a"] = 1
    fmt.Println(m1)
}
```

#### 类型转换

Go 中类型转换需要显式进行。

```go
package main

import (
    "fmt"
    "math"
)

func main() {
    // 整数转换
    var i int = 10
    var j int64 = int64(i)
    var k uint = uint(i)
    
    fmt.Println(i, j, k)

    // 浮点数转换
    var f float64 = 3.14159
    var f32 float32 = float32(f)
    
    fmt.Printf("%.5f -> %.5f\n", f, f32)

    // 字符串与字节切片
    str := "hello"
    bytes := []byte(str)
    backToStr := string(bytes)
    
    fmt.Println(bytes, backToStr)

    // 字符串与 rune
    runes := []rune("你好")
    strFromRunes := string(runes)
    fmt.Println(runes, strFromRunes)

    // fmt.Sprintf 格式化转换
    s := fmt.Sprintf("%d", 123)
    fmt.Println(s)

    // strconv 包进行字符串转换
    // 字符串转整数
    n, err := strconv.Atoi("123")
    fmt.Println(n, err)

    // 整数转字符串
    s = strconv.Itoa(456)
    fmt.Println(s)

    // 字符串转浮点数
    f, err := strconv.ParseFloat("3.14", 64)
    fmt.Println(f, err)

    // 浮点数转字符串
    s = strconv.FormatFloat(3.14, 'f', -1, 64)
    fmt.Println(s)

    // 强制类型转换的风险
    var largeInt int64 = 1<<50
    smallInt := int(largeInt) // 溢出
    fmt.Println(largeInt, smallInt)

    // math 包提供的安全转换函数
    i := 100
    f = float64(i)
    // 安全转换回 int
    if i2 := int(f); float64(i2) == f {
        fmt.Println("Safe conversion:", i2)
    }
}
```

## 2.3 变量与常量

### 2.3.1 变量声明（var、短变量声明:=）

```go
package main

import "fmt"

func main() {
    // 1. var 声明单个变量
    var name string = "Tom"
    var age int = 30

    // 2. var 声明多个变量
    var (
        city string = "Beijing"
        score float64 = 95.5
    )

    // 3. 类型推断
    var country = "China"  // 类型推断为 string

    // 4. 短变量声明（:=）
    hobby := "coding"
    height := 175

    // 5. 短声明多个变量
    a, b := 1, 2
    x, y := "hello", 3.14

    // 6. 注意事项
    // 6.1 := 只能在函数内部使用
    // num := 10 // 错误：函数外不能使用

    // 6.2 重复声明（至少一个新变量）
    var c int
    c, d := 1, 2  // c 已声明，d 新声明

    // 7. 变量赋值
    var e int
    e = 100
    fmt.Println(e)

    // 8. 匿名变量
    func() {
        // 使用 _ 丢弃不需要的返回值
    }()
}
```

### 2.3.2 常量定义（const）

```go
package main

import (
    "fmt"
    "unsafe"
)

const (
    // 常量组
    StatusOK = 200
    StatusNotFound = 404
    StatusServerError = 500
)

const (
    // iota - 常量计数器
    A = iota  // 0
    B         // 1
    C         // 2
    D = iota  // 3
)

const (
    // 复杂使用
    E = 1 << iota  // 1 << 0 = 1
    F              // 1 << 1 = 2
    G              // 1 << 2 = 4
    H              // 1 << 3 = 8
)

const (
    // 跳过某些值
    I = iota  // 0
    _         // 1 (跳过)
    _         // 2 (跳过)
    J         // 3
)

func main() {
    // 基本常量
    const PI = 3.14159
    const Name = "Go"

    // 数值常量
    const (
        Big   = 1 << 100
        Small = Big >> 99
    )

    // 类型常量
    const(
        UintSize = unsafe.Sizeof(uint(0))
    )

    fmt.Println(StatusOK, A, B, C, D, E, F, G, H, I, J)
    fmt.Println(PI, Name, UintSize)
}
```

### 2.3.3 作用域与可见性规则

```go
package main

import "fmt"

// 全局变量（包级作用域）
var globalVar = "I am global"

const (
    PublicConst = "Visible"     // 可导出
    privateConst = "Hidden"     // 不可导出
)

func main() {
    // 局部变量（函数作用域）
    localVar := "I am local"
    
    fmt.Println(globalVar, localVar)

    // 块作用域
    {
        blockVar := "I am in block"
        fmt.Println(blockVar)
    }
    // fmt.Println(blockVar) // 错误：blockVar 未定义

    // 循环作用域
    for i := 0; i < 3; i++ {
        fmt.Println(i)
    }
    // fmt.Println(i) // 错误：i 未定义

    // if 块作用域
    if x := 10; x > 5 {
        fmt.Println(x)
    }
}

// 可见性规则：
// 1. 大写字母开头的标识符可导出（public）
// 2. 小写字母开头的标识符不可导出（private）
// 3. 包级别可见性

// 导出的函数
func PublicFunc() {}

// 未导出的函数
func privateFunc() {}
```

## 2.4 控制流

### 2.4.1 条件语句（if/else、switch）

```go
package main

import "fmt"

func main() {
    // 基本 if
    age := 18
    if age >= 18 {
        fmt.Println("Adult")
    }

    // if-else
    if age < 18 {
        fmt.Println("Minor")
    } else {
        fmt.Println("Adult")
    }

    // else if
    score := 85
    if score >= 90 {
        fmt.Println("A")
    } else if score >= 80 {
        fmt.Println("B")
    } else if score >= 70 {
        fmt.Println("C")
    } else {
        fmt.Println("D")
    }

    // 条件初始化（作用域仅在 if 语句内）
    if x := 10; x > 5 {
        fmt.Println(x) // x 可用
    }
    // fmt.Println(x) // 错误

    // switch 基本用法
    day := 3
    switch day {
    case 1:
        fmt.Println("Monday")
    case 2:
        fmt.Println("Tuesday")
    case 3, 4, 5:  // 多个值
        fmt.Println("Wednesday-Friday")
    default:
        fmt.Println("Unknown")
    }

    // switch 不需要 break（自动退出）
    // 使用 fallthrough 穿透
    switch i := 2; i {
    case 1:
        fmt.Println("one")
    case 2:
        fmt.Println("two")
        fallthrough
    case 3:
        fmt.Println("three")
    }

    // switch 不带表达式
    num := 10
    switch {
    case num > 0:
        fmt.Println("Positive")
    case num < 0:
        fmt.Println("Negative")
    default:
        fmt.Println("Zero")
    }

    // type switch
    var data interface{} = "hello"
    switch v := data.(type) {
    case string:
        fmt.Println("String:", v)
    case int:
        fmt.Println("Int:", v)
    default:
        fmt.Println("Unknown type")
    }
}
```

### 2.4.2 循环语句（for、range）

```go
package main

import "fmt"

func main() {
    // 基本 for 循环
    for i := 0; i < 5; i++ {
        fmt.Println(i)
    }

    // 省略初始值
    i := 0
    for ; i < 5; i++ {
        fmt.Println(i)
    }

    // 省略条件（死循环）
    /*
    for {
        fmt.Println("Infinite loop")
    }
    */

    // 省略递增
    for i < 5 {
        fmt.Println(i)
        i++
    }

    // break 和 continue
    for i := 0; i < 10; i++ {
        if i == 3 {
            continue // 跳过本次循环
        }
        if i == 7 {
            break // 退出循环
        }
        fmt.Println(i)
    }

    // range 遍历
    // 1. 遍历数组/切片
    nums := []int{1, 2, 3, 4, 5}
    for index, value := range nums {
        fmt.Printf("index: %d, value: %d\n", index, value)
    }

    // 只遍历值
    for _, value := range nums {
        fmt.Println(value)
    }

    // 2. 遍历字符串
    str := "hello世界"
    for i, r := range str {
        fmt.Printf("index: %d, rune: %c\n", i, r)
    }

    // 3. 遍历 Map
    m := map[string]int{"a": 1, "b": 2, "c": 3}
    for key, value := range m {
        fmt.Printf("key: %s, value: %d\n", key, value)
    }

    // 4. 遍历通道
    ch := make(chan int)
    go func() {
        ch <- 1
        ch <- 2
        ch <- 3
        close(ch)
    }()
    for v := range ch {
        fmt.Println(v)
    }

    // 5. 忽略返回值
    for range 5 {
        fmt.Println("loop 5 times")
    }
}
```

### 2.4.3 跳转语句（break/continue/goto）

```go
package main

import "fmt"

func main() {
    // break - 跳出循环
    for i := 0; i < 10; i++ {
        if i == 5 {
            break
        }
        fmt.Println(i)
    }
    fmt.Println("break executed")

    // continue - 跳过本次循环
    for i := 0; i < 5; i++ {
        if i == 2 {
            continue
        }
        fmt.Println(i)
    }

    // goto - 跳转（慎用）
    fmt.Println("start")
    goto label
    fmt.Println("this will be skipped")
label:
    fmt.Println("jumped here")

    // goto 在函数内跳转
    i := 0
loop:
    for {
        fmt.Println(i)
        i++
        if i < 5 {
            goto loop // 跳转到 loop 标签
        }
        break
    }

    // break 跳出指定循环
outer:
    for i := 0; i < 3; i++ {
        for j := 0; j < 3; j++ {
            if j == 1 {
                break outer // 跳出外层循环
            }
            fmt.Println(i, j)
        }
    }
    fmt.Println("outer loop ended")
}
```

# 第3章：函数与错误处理

## 3.1 函数基础

### 3.1.1 函数定义与参数传递（值传递 vs. 引用传递）

```go
package main

import "fmt"

func main() {
    // 值传递
    a := 10
    modifyValue(a)
    fmt.Println("After modifyValue:", a) // 10（未改变）

    // 引用传递（指针）
    modifyValuePtr(&a)
    fmt.Println("After modifyValuePtr:", a) // 20（已改变）

    // 切片和 Map 本身就是引用类型
    s := []int{1, 2, 3}
    modifySlice(s)
    fmt.Println("After modifySlice:", s) // [1 2 3 100]

    m := map[string]int{"a": 1}
    modifyMap(m)
    fmt.Println("After modifyMap:", m) // map[a:1 b:2]
}

// 值传递 - 复制整个值
func modifyValue(x int) {
    x = 20
}

// 引用传递 - 传递指针
func modifyValuePtr(x *int) {
    *x = 20
}

// 切片作为参数（引用传递）
func modifySlice(s []int) {
    s = append(s, 100) // 修改了原切片
    // 或者直接修改元素
    // s[0] = 100
}

// Map 作为参数（引用传递）
func modifyMap(m map[string]int) {
    m["b"] = 2 // 修改了原 Map
    // Map 为 nil 时不能写入，需要先 make
}
```

### 3.1.2 多返回值与命名返回值

```go
package main

import "fmt"

func main() {
    // 多返回值
    a, b := 10, 20
    sum, product := sumAndProduct(a, b)
    fmt.Println("Sum:", sum, "Product:", product)

    // 忽略返回值
    result, _ := sumAndProduct(a, b)
    fmt.Println("Result:", result)

    // 命名返回值
    quotient, remainder := divide(10, 3)
    fmt.Println("Quotient:", quotient, "Remainder:", remainder)

    // 命名返回值与 naked return
    result1, result2 := namedReturn(5)
    fmt.Println(result1, result2)
}

// 多返回值函数
func sumAndProduct(a, b int) (int, int) {
    return a + b, a * b
}

// 命名返回值
func divide(a, b int) (quotient, remainder int) {
    quotient = a / b
    remainder = a % b
    return // naked return
}

// 命名返回值的注意事项
func namedReturn(x int) (y, z int) {
    y = x * 2
    z = x * 3
    return // 返回 y 和 z
}
```

### 3.1.3 可变参数与匿名函数

```go
package main

import "fmt"

func main() {
    // 可变参数
    fmt.Println(sum(1, 2, 3, 4, 5))
    fmt.Println(sum(1, 2))

    // 传递切片
    nums := []int{1, 2, 3, 4, 5}
    fmt.Println(sum(nums...))

    // 命名可变参数
    printValues("Numbers:", 1, 2, 3)
    printValues("Strings:", "a", "b", "c")

    // 匿名函数
    add := func(a, b int) int {
        return a + b
    }
    fmt.Println(add(3, 4))

    // 立即执行函数
    func() {
        fmt.Println("Immediately invoked")
    }()

    // 闭包
    counter := createCounter()
    fmt.Println(counter()) // 1
    fmt.Println(counter()) // 2
    fmt.Println(counter()) // 3

    // 高阶函数
    numbers := []int{1, 2, 3, 4, 5}
    doubled := mapInt(numbers, func(n int) int {
        return n * 2
    })
    fmt.Println(doubled) // [2 4 6 8 10]
}

// 可变参数函数
func sum(nums ...int) int {
    total := 0
    for _, n := range nums {
        total += n
    }
    return total
}

// 命名可变参数
func printValues(prefix string, values ...interface{}) {
    fmt.Print(prefix)
    for _, v := range values {
        fmt.Print(" ", v)
    }
    fmt.Println()
}

// 闭包函数
func createCounter() func() int {
    count := 0
    return func() int {
        count++
        return count
    }
}

// 高阶函数
func mapInt(nums []int, fn func(int) int) []int {
    result := make([]int, len(nums))
    for i, n := range nums {
        result[i] = fn(n)
    }
    return result
}
```

## 3.2 错误处理机制

### 3.2.1 错误类型（error接口）

```go
package main

import (
    "errors"
    "fmt"
)

func main() {
    // 使用 errors.New 创建错误
    err := errors.New("something went wrong")
    fmt.Println(err)

    // 使用 fmt.Errorf 创建格式化错误
    err = fmt.Errorf("invalid value: %d", 100)
    fmt.Println(err)

    // 自定义错误类型
    err = &CustomError{
        Code:    500,
        Message: "Database connection failed",
    }
    fmt.Println(err)
}

// 自定义错误类型
type CustomError struct {
    Code    int
    Message string
}

func (e *CustomError) Error() string {
    return fmt.Sprintf("Error %d: %s", e.Code, e.Message)
}

// error 接口定义
// type error interface {
//     Error() string
// }
```

### 3.2.2 错误处理流程（检查错误、返回错误）

```go
package main

import (
    "errors"
    "fmt"
)

func main() {
    // 基本的错误检查
    result, err := divide(10, 0)
    if err != nil {
        fmt.Println("Error:", err)
    } else {
        fmt.Println("Result:", result)
    }

    // 简化写法
    if result, err := divide(10, 3); err != nil {
        fmt.Println(err)
    } else {
        fmt.Println(result)
    }

    // 错误传播
    if err := callProcess(); err != nil {
        fmt.Println("Process failed:", err)
    }
}

func divide(a, b int) (int, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

func callProcess() error {
    if err := step1(); err != nil {
        return fmt.Errorf("step1 failed: %w", err)
    }
    if err := step2(); err != nil {
        return fmt.Errorf("step2 failed: %w", err)
    }
    return nil
}

func step1() error {
    return nil
}

func step2() error {
    return errors.New("something wrong in step2")
}
```

### 3.2.3 panic与recover机制

```go
package main

import "fmt"

func main() {
    // panic - 触发恐慌
    // defer - 延迟执行
    // recover - 恢复恐慌

    // 基本使用
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("Recovered from panic:", r)
        }
    }()

    fmt.Println("Start")
    panic("Something went wrong!")
    fmt.Println("This will not execute")
}

func safeCall() {
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("Caught panic:", r)
        }
    }()

    // 可能 panic 的代码
    // panic("critical error")
}

// 使用 panic 和 recover 的注意事项
// 1. recover 必须在 defer 中调用
// 2. panic 会立即终止当前函数
// 3. defer 会按栈的顺序执行
```

## 3.3 延迟执行（defer）

### 3.3.1 defer的工作原理

```go
package main

import "fmt"

func main() {
    // defer 延迟执行
    fmt.Println("1. Start")
    
    defer fmt.Println("2. Deferred - executes at the end")
    
    fmt.Println("3. End")
    // 输出: 1. Start -> 3. End -> 2. Deferred
}
```

### 3.3.2 资源清理与栈式执行

```go
package main

import "fmt"

func main() {
    // 多个 defer 按栈顺序执行（后进先出）
    for i := 1; i <= 3; i++ {
        defer fmt.Println("defer:", i)
    }
    // 输出: 3, 2, 1

    // 典型用途：文件关闭
    // file, _ := os.Open("test.txt")
    // defer file.Close()

    // 典型用途：解锁
    // mu.Lock()
    // defer mu.Unlock()

    // defer 参数在定义时求值
    i := 10
    defer fmt.Println("deferred:", i) // 输出 10，不是 100
    i = 100
}
```

# 第4章：包与模块化开发

## 4.1 包管理基础

### 4.1.1 包的导入与别名

```go
package main

// 导入单个包
import "fmt"
import "os"

// 分组导入（推荐）
import (
    "fmt"
    "os"
    "strings"
)

// 导入并重命名
import (
    f "fmt"           // 重命名
    myos "os"         // 重命名
    . "math"          // 导入 math 的所有符号到当前命名空间
    _ "image/png"     // 仅执行 init()，不提供命名空间
)

func main() {
    f.Println("Hello")
    myos.Exit(0)
    // 直接使用 PI，不需要 math.PI
    fmt.Println(PI)
}
```

### 4.1.2 可见性规则（大写首字母导出）

```go
package utils

// 导出的函数（大写开头）
func Add(a, b int) int {
    return a + b
}

// 未导出的函数（小写开头）
func add(a, b int) int {
    return a + b
}

// 导出的常量
const Version = "1.0.0"

// 未导出的常量
const version = "1.0.0"
```

## 4.2 自定义包开发

### 4.2.1 包结构设计

```
myproject/
├── go.mod
├── main.go
└── utils/
    ├── go.mod          // 可选
    ├── string.go
    └── math.go
```

### 4.2.2 init函数与包初始化顺序

```go
package mypackage

import "fmt"

// init 函数在包导入时执行
func init() {
    fmt.Println("mypackage initialized")
}

// 每个文件可以有多个 init
func init() {
    fmt.Println("mypackage init 2")
}

// 初始化顺序：
// 1. 导入的包按深度优先顺序初始化
// 2. 同一包内的 init 按文件名字母顺序执行
// 3. main 包最后执行
```

## 4.3 标准库常用包概览

### 4.3.1 fmt包（格式化输入输出）

```go
package main

import (
    "fmt"
)

func main() {
    // Print 系列
    fmt.Print("Hello")           // 不换行
    fmt.Println("Hello")         // 换行
    fmt.Printf("Hello %s", "World") // 格式化

    // 格式化动词
    // %v  通用格式
    // %d  十进制整数
    // %s  字符串
    // %f  浮点数
    // %T  类型
    // %p  指针

    // Sprintf - 返回字符串
    s := fmt.Sprintf("Name: %s, Age: %d", "Tom", 30)
    fmt.Println(s)

    // Fprintf - 输出到文件
    // fmt.Fprintf(os.Stdout, "Hello\n")
}
```

### 4.3.2 os包（文件与系统操作）

```go
package main

import (
    "fmt"
    "os"
    "io"
)

func main() {
    // 文件操作
    // 创建文件
    file, err := os.Create("test.txt")
    if err != nil {
        fmt.Println(err)
        return
    }
    defer file.Close()

    // 写入文件
    n, err := file.WriteString("Hello, World!")
    fmt.Println(n, err)

    // 读取文件
    data := make([]byte, 100)
    n, err = file.Read(data)
    fmt.Println(string(data[:n]), err)

    // 检查文件是否存在
    _, err = os.Stat("test.txt")
    if os.IsNotExist(err) {
        fmt.Println("File does not exist")
    }

    // 目录操作
    os.Mkdir("mydir", 0755)
    os.RemoveAll("mydir")

    // 环境变量
    fmt.Println(os.Getenv("PATH"))

    // 命令行参数
    fmt.Println(os.Args)
}
```

### 4.3.3 encoding/json（JSON编解码）

```go
package main

import (
    "encoding/json"
    "fmt"
)

type Person struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
    City string `json:"city,omitempty"`
}

func main() {
    // 结构体转 JSON
    p := Person{Name: "Tom", Age: 30}
    jsonBytes, err := json.Marshal(p)
    fmt.Println(string(jsonBytes), err)

    // 带缩进的 JSON
    jsonBytes, _ = json.MarshalIndent(p, "", "  ")
    fmt.Println(string(jsonBytes))

    // JSON 转结构体
    jsonStr := `{"name":"Jerry","age":25}`
    var p2 Person
    json.Unmarshal([]byte(jsonStr), &p2)
    fmt.Println(p2)

    // Map 转 JSON
    m := map[string]interface{}{
        "name": "Alice",
        "age":  28,
    }
    jsonBytes, _ = json.Marshal(m)
    fmt.Println(string(jsonBytes))
}
```

### 4.3.4 time包（时间处理）

```go
package main

import (
    "fmt"
    "time"
)

func main() {
    // 获取当前时间
    now := time.Now()
    fmt.Println(now)

    // 时间戳
    fmt.Println(now.Unix())     // 秒
    fmt.Println(now.UnixNano()) // 纳秒

    // 时间解析
    t, _ := time.Parse("2006-01-02 15:04:05", "2024-01-01 10:00:00")
    fmt.Println(t)

    // 格式化
    fmt.Println(now.Format("2006-01-02 15:04:05"))

    // 时间加减
    future := now.Add(time.Hour * 24)
    past := now.Add(-time.Hour * 24)

    // 定时器
    <-time.After(time.Second) // 等待1秒

    // 睡眠
    time.Sleep(time.Second)
}
```

# 第5章：接口与类型系统

## 5.1 接口定义与实现

### 5.1.1 接口的隐式实现

```go
package main

import "fmt"

// 接口定义
type Writer interface {
    Write([]byte) (int, error)
}

// 实现接口（隐式实现）
type FileWriter struct{}

func (f FileWriter) Write(data []byte) (int, error) {
    return len(data), nil
}

func main() {
    // 使用接口
    var w Writer = FileWriter{}
    n, err := w.Write([]byte("Hello"))
    fmt.Println(n, err)
}
```

### 5.1.2 空接口（interface{}）的应用

```go
package main

import "fmt"

func main() {
    // 空接口可以存储任意类型
    var i interface{}
    i = 10
    i = "hello"
    i = []int{1, 2, 3}

    // 使用空接口作为函数参数
    printValue(10)
    printValue("hello")
    printValue([]int{1, 2})
}

func printValue(v interface{}) {
    fmt.Printf("Type: %T, Value: %v\n", v, v)
}
```

## 5.2 类型嵌入与组合

### 5.2.1 结构体嵌入与继承

```go
package main

import "fmt"

type Person struct {
    Name string
    Age  int
}

func (p Person) Greet() {
    fmt.Printf("Hello, I'm %s\n", p.Name)
}

type Employee struct {
    Person  // 嵌入
    Company string
}

func main() {
    e := Employee{
        Person: Person{Name: "Tom", Age: 30},
        Company: "Google",
    }
    e.Greet() // 调用嵌入的方法
    fmt.Println(e.Name, e.Company)
}
```

### 5.2.2 方法集与接口组合

```go
package main

import "fmt"

type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

// 接口组合
type ReadWriter interface {
    Reader
    Writer
}

type File struct{}

func (f File) Read(p []byte) (n int, err error) {
    return len(p), nil
}

func (f File) Write(p []byte) (n int, err error) {
    return len(p), nil
}

func main() {
    var rw ReadWriter = File{}
    fmt.Println(rw)
}
```

## 5.3 类型断言与类型转换

### 5.3.1 类型断言（type switch）

```go
package main

import "fmt"

func main() {
    var i interface{} = "hello"

    // 类型断言
    s := i.(string)
    fmt.Println(s)

    // 安全类型断言
    if s, ok := i.(string); ok {
        fmt.Println(s)
    }

    // type switch
    switch v := i.(type) {
    case string:
        fmt.Println("string:", v)
    case int:
        fmt.Println("int:", v)
    default:
        fmt.Println("unknown type")
    }
}
```

### 5.3.2 类型转换与反射

```go
package main

import (
    "fmt"
    "reflect"
)

func main() {
    // 基本类型转换
    var i int = 10
    var f float64 = float64(i)
    fmt.Println(f)

    // 反射
    t := reflect.TypeOf(i)
    v := reflect.ValueOf(i)
    fmt.Println(t, v)

    // 通过反射修改变量值
    x := 10
    rv := reflect.ValueOf(&x)
    rv.Elem().SetInt(100)
    fmt.Println(x)
}
```

# 第6章：测试与性能基准

## 6.1 单元测试

### 6.1.1 测试函数编写规范（TestXxx）

```go
package main

import "testing"

// 测试函数以 Test 开头
func TestAdd(t *testing.T) {
    result := Add(2, 3)
    if result != 5 {
        t.Errorf("Add(2, 3) = %d; want 5", result)
    }
}

func TestAddNegative(t *testing.T) {
    result := Add(-1, -1)
    if result != -2 {
        t.Errorf("Add(-1, -1) = %d; want -2", result)
    }
}

// 被测试的函数
func Add(a, b int) int {
    return a + b
}
```

运行测试：
```bash
go test -v ./...
```

### 6.1.2 表驱动测试与子测试（t.Run）

```go
package main

import "testing"

func TestAddTableDriven(t *testing.T) {
    // 表驱动测试
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive", 2, 3, 5},
        {"negative", -1, -1, -2},
        {"zero", 0, 0, 0},
        {"mixed", -5, 10, 5},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := Add(tt.a, tt.b)
            if result != tt.expected {
                t.Errorf("Add(%d, %d) = %d; want %d", 
                    tt.a, tt.b, result, tt.expected)
            }
        })
    }
}

func Add(a, b int) int {
    return a + b
}
```

## 6.2 性能基准测试

### 6.2.1 Benchmark函数与指标分析

```go
package main

import "testing"

func BenchmarkAdd(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Add(1, 2)
    }
}

func BenchmarkAddParallel(b *testing.B) {
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            Add(1, 2)
        }
    })
}

func Add(a, b int) int {
    return a + b
}
```

运行基准测试：
```bash
go test -bench=. -benchmem
```

### 6.2.2 性能优化示例

```go
package main

import "testing"

// 优化前
func ConcatStringsOld(strs []string) string {
    result := ""
    for _, s := range strs {
        result += s
    }
    return result
}

// 优化后
func ConcatStringsNew(strs []string) string {
    // 使用 string.Builder
    var builder strings.Builder
    for _, s := range strs {
        builder.WriteString(s)
    }
    return builder.String()
}

func BenchmarkConcatOld(b *testing.B) {
    strs := []string{"a", "b", "c", "d", "e"}
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        ConcatStringsOld(strs)
    }
}

func BenchmarkConcatNew(b *testing.B) {
    strs := []string{"a", "b", "c", "d", "e"}
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        ConcatStringsNew(strs)
    }
}
```

## 6.3 代码覆盖率与工具

### 6.3.1 go test -cover的使用

```bash
# 运行测试并显示覆盖率
go test -cover ./...

# 生成覆盖率文件
go test -coverprofile=coverage.out ./...

# 查看覆盖率详情
go tool cover -func=coverage.out

# HTML 覆盖率报告
go tool cover -html=coverage.out -o coverage.html
```

### 6.3.2 可视化覆盖率报告

```bash
# 生成 HTML 报告
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
open coverage.html  # macOS
```

## 6.4 测试工具链

### 6.4.1 测试框架（如testing.T）

```go
package main

import "testing"

func TestExample(t *testing.T) {
    // 常规测试
    if 1+1 != 2 {
        t.Fatal("Math is broken")
    }

    // 跳过测试
    t.Skip("Skipping for now")

    // 辅助函数
    t.Log("This is a log")
    t.Logf("Formatted: %d", 42)

    // 子测试
    t.Run("sub test 1", func(t *testing.T) {
        t.Log("In sub test 1")
    })

    // 测试组
    t.Run("group", func(t *testing.T) {
        t.Run("sub1", func(t *testing.T) {})
        t.Run("sub2", func(t *testing.T) {})
    })
}
```

### 6.4.2 依赖Mock与测试替身

```go
package main

import (
    "testing"
)

// 接口定义
type Database interface {
    GetUser(id int) (User, error)
}

type User struct {
    ID   int
    Name string
}

// 真实实现
type RealDatabase struct{}

func (r RealDatabase) GetUser(id int) (User, error) {
    return User{ID: id, Name: "Real User"}, nil
}

// Mock 实现
type MockDatabase struct {
    User User
    Err  error
}

func (m MockDatabase) GetUser(id int) (User, error) {
    return m.User, m.Err
}

// 使用 Mock 的测试
func TestGetUserName(t *testing.T) {
    // 使用 Mock
    db := MockDatabase{
        User: User{ID: 1, Name: "Test User"},
    }
    
    name, err := GetUserName(db, 1)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    
    if name != "Test User" {
        t.Errorf("expected 'Test User', got '%s'", name)
    }
}

// 依赖接口的函数
func GetUserName(db Database, id int) (string, error) {
    user, err := db.GetUser(id)
    if err != nil {
        return "", err
    }
    return user.Name, nil
}
```

---

> 参考资料
>
> - Go 官方文档：https://go.dev/doc/
> - 《The Go Programming Language》
> - Go 语言中文文档：https://books.studygolang.com/gopl-zh/
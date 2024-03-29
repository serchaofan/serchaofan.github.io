---
title: DevOps
tags: [DevOps]
date: 2020-02-14 18:39:56
categories: [DevOps]
comments: false
---

- [DevOps](#devops)
- [持续集成、持续交付与持续部署](#持续集成持续交付与持续部署)
  - [持续集成](#持续集成)
  - [持续交付](#持续交付)
- [持续部署](#持续部署)

<!--more-->

# DevOps

DevOps 是使软件开发和 IT 团队之间的流程自动化的一组实践，以便他们可以更快，更可靠地构建，测试和发布软件。 DevOps 的概念建立在建立团队之间协作文化的基础上，这些团队过去一直相对孤立地运作。DevOps 的好处包括增加信任度，更快的软件发布，快速解决关键问题的能力以及更好地管理计划外工作。

从本质上讲，DevOps 是一种文化，一种运动，一种哲学。它是开发和运维之间的有力握手，强调思维方式的转变、更好的协作和更紧密的集成。它将敏捷、持续交付、自动化和更多的东西结合在一起，以帮助开发和运营团队更高效、更快地创新，并向业务和客户交付更高的价值。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120100635.png)

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120100995.png)

DevOps 优势：

- 速度：可以更快速地针对客户进行创新、更好地适应不断变化的市场，同时更有效地推动业务成果。微服务和持续交付能够让团队充分掌控服务，然后更快速地发布更新。
- 快速交付：提高发布的频率和速度，以便能够更快速地进行创新并完善产品。发布新功能和修复错误的速度越快，就越能快速地响应客户需求并建立竞争优势。持续集成和持续交付是自动执行软件发布流程（从构建到部署）的两项实践经验。
- 可靠性：确保应用程序更新和基础设施变更的品质，以便能够在保持最终用户优质体验的同时，更加快速可靠地进行交付。使用持续集成和持续交付等实践经验来测试每次变更是否安全以及能够正常运行。监控和日志记录实践经验能够帮助实时了解当前的性能。
- 规模：大规模运行和管理基础设施及开发流程。自动化和一致性可在降低风险的同时，帮助有效管理复杂或不断变化的系统。例如，基础设施即代码能够以一种可重复且更有效的方式来管理部署、测试和生产环境。
- 增强合作：建立一个适应 DevOps 文化模式的更高效的团队，强调主人翁精神和责任感。开发人员和运营团队密切合作，共同承担诸多责任，并将各自的工作流程相互融合。这有助于减少效率低下的工作，同时节约大家的时间（例如，缩短开发人员和运营团队之间的交接时间，编写将运行环境考虑在内的代码）。
- 安全性：在快速运转的同时保持控制力和合规性。利用自动实施的合规性策略、精细控制和配置管理技术，可以在不牺牲安全性的前提下采用 DevOps 模式。例如，利用基础设施即代码和策略即代码，可以大规模定义并追踪合规性。

DevOps包含但不限于：
- 故障早期检测
- 更好的资源利用率
- 更快地进入市场
- 执行透明度
- 单击部署
- 提升构建
- 基于批准的发布
- 自动化方法
- 高质量发布
- 缩短恢复时间
- 提高生产率
- 决策支持

# 持续集成、持续交付与持续部署

CI/CD 是一种通过在应用开发阶段引入自动化来频繁向客户交付应用的方法。CI/CD 的核心概念是持续集成、持续交付和持续部署。作为一个面向开发和运营团队的解决方案，CI/CD 主要针对在集成新代码时所引发的问题（亦称：“集成地狱”）。

CI/CD 中的“CI”始终指持续集成，它属于开发人员的自动化流程。成功的 CI 意味着应用代码的新更改会定期构建、测试并合并到共享存储库中。该解决方案可以解决在一次开发中有太多应用分支，从而导致相互冲突的问题。

CI/CD 中的“CD”指的是持续交付和/或持续部署，这些相关概念有时会交叉使用。两者都事关管道后续阶段的自动化，但它们有时也会单独使用，用于说明自动化程度。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120100604.png)

## 持续集成

持续集成（Continuous Integration）：在软件开发过程中，频繁地将代码集成到主干上，然后进行自动化测试。
持续集成的目的，就是让产品可以快速迭代，同时还能保持高质量。它的核心措施是，代码集成到主干之前，必须通过自动化测试。只要有一个测试用例失败，就不能集成。

持续集成（CI）可以帮助开发人员更加频繁地（有时甚至每天）将代码更改合并到共享分支或“主干”中。一旦开发人员对应用所做的更改被合并，系统就会通过自动构建应用并运行不同级别的自动化测试（通常是单元测试和集成测试）来验证这些更改，确保这些更改没有对应用造成破坏。这意味着测试内容涵盖了从类和函数到构成整个应用的不同模块。如果自动化测试发现新代码和现有代码之间存在冲突，CI 可以更加轻松地快速修复这些错误。

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120100772.png)

优势：

- 快速发现错误。每完成一点更新，就集成到主干，可以快速发现错误，定位错误也比较容易。
- 防止分支大幅偏离主干。如果不是经常集成，主干又在不断更新，会导致以后集成的难度变大，甚至难以集成。

一个 CI 系统的基本功能：

- 软件构建自动化：配置完成后，CI 系统会依照预先制订的时间表，或针对特定事件，对目标软件进行构建
- 构建可持续的自动化检查：能持续获取新增或修改后加入的源代码，CI 系统能不断确认这些新代码是否破坏原有软件的成功构建，这也就减少了开发者检查代码变化情况要花费的时间
- 构建可持续的自动化测试：构建检查的扩展部分，构建后执行预先指定的一套测试规则，完成后触发通知（email，rss 等）
- 生成后后续过程的自动化：当自动化检查和测试完成后，软件构建的周期中可能需要一些额外的任务，如生成文档、打包软件、部署到运行环境等

CI 系统的基本结构：

![](https://cdn.jsdelivr.net/gh/serchaofan/picBed/blog/202203120100750.png)

CI 系统流程：

1. 开发者将代码提交到源代码仓库
2. CI 为每个项目创建一个单独的工作区，当预设或请求一次新的构建时，CI 会将源代码仓库的源码存放到相应工作区
3. CI 会在对应工作区内执行构建
4. 构建完成后，CI 会在新的构件中执行一套测试（如果配置的话），完成后通过 RSS 或 Email 通知相关人员
5. 若构建成功，该构件会被打包转移到一个部署目标（如应用服务器），或存储为软件仓库中的一个新版本。（软件仓库可以是 CI 系统内部的一个部分（自己搭），也可以是外部的一个仓库（第三方仓库服务））
6. CI 通常会根据请求发起相应的操作，如即时构建、生成报告、或检索一些构建好的构件

## 持续交付

持续交付（Continuous Delivery）：频繁地将软件的新版本，交付给质量团队或者用户，以供评审。如果评审通过，代码就进入生产阶段。持续交付可以看作持续集成的下一步。它强调的是，不管怎么更新，软件是随时随地可以交付的。

完成 CI 中构建及单元测试和集成测试的自动化流程后，持续交付可自动将已验证的代码发布到存储库。为了实现高效的持续交付流程，务必要确保 CI 已内置于开发管道。持续交付的目标是拥有一个可随时部署到生产环境的代码库。
在持续交付中，每个阶段（从代码更改的合并，到生产就绪型构建版本的交付）都涉及测试自动化和代码发布自动化。在流程结束时，运维团队可以快速、轻松地将应用部署到生产环境中。

# 持续部署

持续部署（Continuous Deployment）：代码通过评审以后，自动部署到生产环境，是持续交付的下一步。持续部署的目标是，代码在任何时刻都是可部署的，可以进入生产阶段。持续部署的前提是能自动化完成测试、构建、部署等步骤。

 基础设施即代码（架构即代码）

基础设施即代码是一种实践经验，其中基础设施通过代码和软件部署技术（例如版本控制和持续集成）得以预置和管理。借助云的 API 驱动型模式，开发人员和系统管理员能够以编程方式与基础设施进行大规模互动，而无需手动设置和配置资源。因此，工程师可以使用基于代码的工具来连接基础设施，并且能够以处理应用程序代码的方式来处理基础设施。基础设施和服务器由代码进行定义，因此可以使用标准化模式进行快速部署、使用最新补丁和版本进行更新，或者以可重复的方式进行复制。

配置管理
开发人员和系统管理员使用代码将操作系统和主机配置、操作性任务等自动化。代码的使用实现了配置变更的可重复性和标准化。它将开发人员和系统管理员从手动配置操作系统、系统应用程序或服务器软件的任务中解放出来。

策略即代码
由于基础设施及其配置全都通过云进行代码编写，所以组织可以动态地大规模监控与实现合规性。因此，组织可以自动跟踪、验证和重新配置由代码描述的基础设施。这样一来，组织能够更加轻松地掌控资源变更，并确保安全措施以分布式方式得到妥善执行（例如，采用 PCI-DSS 或 HIPAA 确保信息安全性或合规性）。这使组织内部的团队能够更快速地运作，因为不合规的资源可能被自动标记为需要进一步调查，甚至被自动纠正为合规资源。

可变架构与不可变架构

可变架构（mutable infrastructure）：可变架构是 IT 服务器基础架构，能够定期直接进行修改和更新。传统上，由于可变方法提供更大的短期灵活性，服务器体系结构是可变的。 但是，可变的基础结构会以不可变的基础结构为可能，但要以不同服务器部署之间的可预测性和一致性为代价。

在可变架构中，将更改应用到现有架构之上，并且随着时间的推移，架构会建立更改历史记录。遵循可变架构范例的工具如 Ansible，Puppet 和 Chef 。

可变架构的优势包括：

- 架构可以更精确地满足服务器上运行的应用程序的需求。
- 更新通常更快，并且可以适应每个单独的服务器。
- IT 员工无需从头开始创建新服务器，而是可以“个人”级别了解每台服务器，这有时可以帮助更快地解决问题。

可变架构的缺点包括：

- 技术问题很难诊断或重现，因为每个服务器都具有唯一的配置，这种现象通常称为“配置漂移（Configuration Drift）”。
- 对服务器的更改不一定会记录在案，从而使版本跟踪更加困难。
- 由于需要手动配置，配置服务器通常是一个漫长的过程。

不可变架构（immutable infrastructure）指服务器基础设施，一旦部署，就不能修改。它通常与 DevOps 和持续交付相关。如果需要进行更改或更新，则将在服务器上部署一个全新的实例，并进行适当的修改。新的环境可以在几分钟内在云中生成。这使得不可变架构对于 96%的企业来说更加可行。遵循不变基础架构范例的技术如 Terraform 。

不变基础架构的优点包括：

- 版本跟踪和回滚要容易得多。 IT 部门可以在部署新服务器或虚拟机时保留其标签。
- 由于不同服务器之间的配置一致，因此测试更易于运行。
- 不可能出现配置漂移。如果服务器已启动并正在运行，则 IT 员工可以知道该服务器的确切状态，避免任何意外情况。

不变的基础架构的缺点包括：

- 基础架构完全无法就地修改。例如，如果存在 zero-day 漏洞，则所有具有相同配置的服务器都必须接收安全更新。
- 不可变架构提高的敏捷性和动态性有时可能与传统的 IT 安全实践不符。

 有状态与无状态

Web 浏览器和服务器的网络协议分为两种：无状态（Stateless）协议和有状态（Stateful）协议。根据服务器或服务器端软件保存状态或会话信息的要求，可以区分这两种协议。

1. 无状态协议：
   无状态协议是网络协议的一种，客户端将请求发送到服务器，服务器根据当前状态返回响应。它不需要服务器为多个请求保留会话信息或有关每个通信对端的状态。如 HTTP，UDP，DNS 都是无状态协议。
   无状态协议的特点：

   - 简化了服务器的设计。
   - 只要较少的资源，因为系统不需要跟踪多连接通信和会话详细信息。
   - 在无状态协议中，每个信息包都是自己拥有的，而不参考其他任何包。
   - 无状态协议中的每个通信都是离散的，与之前或之后的通信无关。

2. 有状态协议：
   在有状态协议中，如果客户端将请求发送到服务器，则它期望某种响应，如果未获得任何响应，则它将重新发送该请求。如 FTP，Telnet 都是有状态协议。
   有状态协议的特点：
   - 通过跟踪连接信息为客户端提供更好的性能。
   - 有状态的应用程序需要后备存储。
   - 有状态请求始终取决于服务器端状态。
   - TCP 会话遵循有状态协议，因为这两个通信端都在会话生命周期内维护有关会话本身的信息。

有状态与无状态对比表格：

|                           有状态协议                           |                                     无状态协议                                     |
| :------------------------------------------------------------: | :--------------------------------------------------------------------------------: |
|             不要求服务器保留服务器信息或会话细节。             |                           要求服务器保存状态和会话信息。                           |
|                   在 Internet 上很容易实现。                   |                          在逻辑上很难在 Internet 中实现。                          |
|                        处理事务非常快。                        |                                  处理事务非常慢。                                  |
|             服务器和客户机之间没有紧密的依赖关系。             |                        服务器和客户端之间存在紧密的依赖关系                        |
|                       简化了服务器设计。                       |                           使服务器的设计非常复杂和繁重。                           |
| 因为没有必须还原的状态，发生故障的服务器可以在崩溃后重新启动。 | 在崩溃时不能更好地工作，因为有状态服务器必须保留状态信息和内部状态的会话详细信息。 |

 微服务

 自动化

> 参考文章
> [持续集成、持续交付、持续部署简介](https://jaminzhang.github.io/ci/cd/CI-CD-Introduction/)

> [持续集成是什么？](https://www.ruanyifeng.com/blog/2015/09/continuous-integration.html)

> [[持续交付实践] 开篇：持续集成&持续交付综述 ](https://testerhome.com/topics/9977)

> [什么是 CI/CD？](https://www.redhat.com/zh/topics/devops/what-is-ci-cd)

> [Continuous Integration: A “Typical” Process](https://developers.redhat.com/blog/2017/09/06/continuous-integration-a-typical-process/)
>
> [Difference between Stateless and Stateful Protocol](https://www.geeksforgeeks.org/difference-between-stateless-and-stateful-protocol/)
>
> [A SIDE-BY-SIDE COMPARISON OF IMMUTABLE VS. MUTABLE INFRASTRUCTURE](https://eplexity.com/a-side-by-side-comparison-of-immutable-vs-mutable-infrastructure/)

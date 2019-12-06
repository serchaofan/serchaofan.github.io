---
title: Ansible基础学习笔记
date: 2018-05-28 00:01:18
tags: [ansible,运维,监控,自动化]
---

本篇包含以下内容
* [Ansible结构](#Ansible结构)

* [Ansible安装](#Ansible安装)

* [Inventory](#Inventory)

* [Ansible常见模块](#Ansible常见模块)

* [Playbook](#Playbook)

  <!-- more -->

* [Ansible变量](#Ansible变量)

* [Jinja2过滤器](#Jinja2过滤器)

* [Ansible-Tower](#Ansible-Tower)



Ansible是一个部署一群远程主机的工具，使用SSH实现管理节点和远程节点间的通信，实现批量自动化操作。

{% asset_img 0.png %}

Ansible有企业版本的收费软件Ansible Tower，中心化的Ansible管理节点，向管理员提供web接口。实现：1. 管理员在Ansible Tower上使用分享主机的SSH密钥，但不能查看和复制私钥  2. Ansible的web上的所有管理员都可共享Playbook脚本  3. Ansible Tower可收集展示所有主机的Playbook执行情况。

Ansible Tower提供了一个数据库来存储inventory配置信息，这个数据库可以通过web访问，或通过REST访问。Tower与所有使用的Ansible动态inventory源保持同步，并提供了一个图形化的inventory编辑器。 

# Ansible结构

Ansible具有以下核心组件：
* ansible core：ansible核心程序
* Host Inventory：主机信息文件
* Playbooks：剧本，用于简便管理主机
* Core Modules：核心模块，Ansible通过模块进行管理
* Custom Modules：自定义模块，补充核心模块的功能
* Connection Plugins：连接插件，用于Ansible和主机的通信
* Plugins：其他各种插件，提供连接或功能接口

{% asset_img jiegou.png %}

Ansible特性：
* 基于Python实现，有三个关键模块：Paramiko（ssh连接插件）、PyYAML（YAML语言）、jinja2（定义模板，即Playbook）
* 部署简单，轻量级，无需在客户端安装agent，去中心化
* 默认使用SSH。1.基于密钥 2.在inventory文件指定密码
* 支持自定义模块，支持各种编程语言
* 主从模式master和slave
* 使用playbook进行主机管理
* 幂等性：一种操作重复多次结果相同，只需运行一次playbook就可将需要配置的机器都置为期望状态，同一台机器多次执行一个playbook是安全的
* Ansible是模块化的，通过调用模块来实现管理
* 支持多层部署，可通过VM和容器为多层应用程序的部署配置提供支持
* 为架构的多个层次带来一致性，借助Ansible可通过编程操作计算架构中从基础设施到应用程序的每一层
* Ansible支持异构IT环境，支持Windows和Linux及多个硬件平台和云平台

{% asset_img liucheng.png %}


**实验系统CentOS-7**
**主节点服务器：192.168.163.102**
**从节点服务器：192.168.163.103**

# Ansible安装
首先安装epel-release，能够获得更多的Ansible包资源。  `yum install epel-release`
然后安装Ansible  `yum install ansible`

Ansible有以下配置文件：
* `/etc/ansible/ansible.cfg`  主配置文件
* `/etc/ansible/hosts`  Inventory配置文件

Ansible配置以ini格式存储数据，Ansible几乎所有配置都可通过Playbook或环境变量重新赋值。当运行Ansible命令时，会按照以下顺序查找并读取配置文件。
1. `ANSIBLE_CONFIG`：环境变量指定的路径
2. `./ansible.cfg`：当前目录的ansible.cfg配置文件
3. `~/ansible.cfg`：家目录的ansible.cfg配置文件
4. `/etc/ansible/ansible.cfg`：ansible主配置文件

Ansible主配置文件中的几个重要参数
```
inventory = /root/ansible/hosts   # inventory文件的位置
library = /usr/share/my_modules/  # ansible模块位置
forks = 5           # 默认情况下Ansible最多能有多少个进程同时工作，默认5个进程并行处理。
                    # 可以根据控制端性能和被管理节点的数量来确定
sudo_user = root    # 默认执行命令的用户
remote_port = 22    # 指定连接被管理节点的管理端口，默认是22
host_key_checking = False  # 是否检查SSH主机的密钥
timeout = 20        # SSH连接的超时间隔，单位：秒
log_path = /var/log/ansible.log   # Ansible默认不记录日志
# 若开启了日志，则要通过该参数设置日志文件路径
# 模块将会调用被管节点的rsyslog来记录，执行Ansible的用户需要有写入日志的权限
remote_tmp     = ~/.ansible/tmp     # 远程主机的临时文件存放位置
local_tmp      = ~/.ansible/tmp     # 本机的临时文件存放位置
```

Ansible提供文档命令可查看指定的用法说明
`ansible-doc`命令用于查看Ansible帮助文档
```
  -h 查看帮助
  -l 列出所有Ansible模块
  -s <module> 查找指定模块的用法
```

**公钥认证**
Ansible默认开启公钥认证，Ansible主节点应该与所有要管理的节点进行ssh验证。主要使用以下命令：
```
ssh-keygen  创建密钥对
ssh-copy-id -i ~/.ssh/id_rsa.pub root@<节点IP地址>
```
然后在`/etc/ansible/hosts`添加该节点的IP地址

如果有个主机重新安装并在`/home/.ssh/known_hosts`文件中中有了不同的key，就会一直提示错误。
若节点主机未进行公钥认证，即没有在该文件中初始化，则每次使用ansible命令时都会要求确认key信息。

若要禁用ansible确认密钥的行为，可在主配置文件中参数`host_key_checking = False`设置，也可以通过环境变量`ANSIBLE_HOST_KEY_CHECKING=False`设置。

**ansible主命令**
```
ansible  <host-pattern> [options]
	# host-pattern可填inventory的组名，ip地址，all（所有主机）
	# 一些简单常用参数
	-f 设置一次处理的主机个数，即并行执行
	-m 设置使用的模块
	-a 模块的参数
	-i 指定inventory文件
```

# Inventory
Ansible可同时操作属于一个组的多台主机,组和主机之间的关系通过inventory文件配置，默认的文件路径为`/etc/ansible/hosts`。
inventory文件遵循INI文件风格，方括号[]中是组名,用于对系统进行分类,便于对不同系统进行个别的管理。一个系统可以属于不同的组，属于两个组的变量都可以为这台主机所用。组名可自定义。

```
# 可以直接写要管理的主机IP地址或域名
192.168.163.103

#也可设置管理组
[test]
192.168.163.103
system[1:5].example.com
# 数字简写模式，表示system1--sysetm5
# 也支持字母简写，system[a:f].example.com

# 可对每个服务器设置连接类型和连接用户名
localhost  ansible_connection=local
system3.example.com  ansible_connection=ssh  ansible_ssh_user=ansible

# 可定义变量，可使用变量定义的配置主机变量
host1  http_port=80  maxRequestsPerChild=808
# 也可定义组变量
[test:vars]
ntp_server=ntp.example.com

# 还可组嵌套，即在其他组中引用一个组
# 这些变量可以给ansible-playbook使用,但不能给ansible使用。
[team1]
host1
[team2]
host2
[test:hosts]
team1
team2
```
当Inventory中存在有效主机时，ansible就默认隐式地可以使用`localhost`作为本机，但inventory中没有任何主机时是不允许使用它的，且`all`或`*`所代表的所有主机也不会包含localhost。

一些常见的Inventory参数：
```
ansible_ssh_host    # ansible使用ssh要连接的主机
ansible_ssh_port    # ssh的端口。默认为22
ansible_ssh_user    # ssh登录的用户名。默认为root
ansible_ssh_pass    # ssh登录远程用户时的认证密码
	# 不安全，最好使用 --ask-pass
ansible_sudo_pass   # sudo命令输入的root密码（当使用非root用户操作时）
	# 不安全，最好使用 --ask-sudo-pass
ansible_connection   # 连接远程主机使用的模式，默认为smart智能模式
	# smart：若本地ssh支持持久连接时采用ssh连接，否则采用python的paramiko ssh连接
	# paramiko：python的ssh连接库
ansible_ssh_private_key_file   # ssh登录远程用户时的认证私钥文件
ansible_ssh_common_args      # 指定ssh、scp等命令的参数
ansible_shell_type  # 指定远程主机执行命令时的shell解析器，默认为sh
ansible_python_interpreter   # 远程主机上的python解释器路径。默认为/usr/bin/python
```

**Inventory配置文件可以有多个，且可以通过Dynamic Inventory来动态生成**
只需在ansible的主配置文件中将`inventory`参数设置为对应的文件或目录即可，如果是目录，那么此目录下的所有文件都是inventory文件。

可创建多个独立文件用于保存变量，然后在主文件中引用
**注：这些独立文件的格式为YAML**
在独立文件`/etc/ansible/group_vars/servers`中添加

```
---
ntp_server: ntp.example.com
database_server: system2.example.com
```
然后在inventory文件中指定该文件`/etc/ansible/group_vars/servers`
可以为一个主机，或一个组，创建一个目录，目录名就是主机名或组名。目录中的可以创建多个文件，文件中的变量都会被读取为主机或组的变量。



# Ansible常见模块
## cron

```
cron 计划任务模块
	month         # 指定月份
	minute        # 指定分钟
	job           # 指定任务（需要state=present）
	day           # 指定小时
	hour          # 指定小时
	weekday       # 周几
	name          # 指定名称（默认为*）
	user          # 使用的用户身份去执行
	special_time  # 指定执行的时间
	reboot        # 重启时
	yearly        # 每年
	# 还有annually  monthly  weekly  daily  hourly
	state         # 添加或删除
	present       # 安装
	absent        # 移除
	backup        # 对远程主机上原有任务计划做备份
	cron_file     # 使用指定文件替换远程主机上/etc/cron.d/中的任务计划

	例：ansible webserver -m cron -a ' minute="*/10" job="/bin/echo hello" name="test" state=present '
```
## user
```
user 用户账号管理
	name         # 用户名
	uid          # UID
	state        # 状态
		present      # 添加
		absent       # 移除
	password     # 设置密码
	group        # 所属组
	groups       # 附加组（用逗号分隔）
	home         # 家目录
	createhome   # 是否创建家目录
	comment      # 注释
	system       # 是否设为系统用户
	generate_ssh_key=yes        # 是否加密密码
	ssh_key_bits=2048           # 加密密钥长度
	ssh_key_file=.ssh/id_rsa    # 密码文件
	注：指定password参数时，不能使用后面这一串密码会被直接传送到被管理主机的/etc/shadow文件中，所以需要先将密码字符串进行加密处理。然后将得到的字符串放到password中即可。
	默认加密方式是根据/etc/login.defs的ENCRYPT_METHOD指定，默认为SHA512
```
## group
```
group 组管理
	gid      # GID
	name     # 组名
	state    # 状态
	system   # 是否是系统组
```
## copy
```
copy 复制文件，类似scp，需要关闭所有机器的selinux，否则会报错
	src      # 本地源路径
	dest     # 远程主机目标路径
	owner    # 指定拥有者
	group    # 指定所属组
	mode     # 设置权限
	content  # 取代src=，表示直接用此处信息生成文件内容
	backup   # 在覆盖前备份原文件，两个选项（yes | no）
	directory_mode    # 递归设置目录权限，默认为系统默认权限
	force  # 用于设置当目标主机包含该文件，但内容不同时的操作
	       # 若设置为yes，则强制覆盖，若为no，则只有当目标主机的目标位置不存在该文件时，才复制。
	       # 默认为yes
# 所有的file模块里的选项都可以在这里使用
# 若出现了有关selinux的报错，可在被控机上安装libselinux-python解决
# ansible all -m yum
```
## template
用法和copy模块用法基本一致，主要用于复制模板。
```
template
    backup    # 拷贝的同时也创建一个包含时间戳信息的备份文件，默认为no
    dest=     # 目标路径
    force     # 设置为yes (默认)时，将覆盖远程同名文件。设置为no时，忽略同名文件的拷贝
    group     # 设置远程文件的所属组
    owner     # 设置远程文件的所有者
    mode      # 设置远程文件的权限。使用数值表示时不能省略第一位，如0644。
              # 也可以使用'u+rwx'或'u=rw,g=r,o=r'等方式设置
    src=      # ansible控制器上Jinja2格式的模板所在位置，可以是相对或绝对路径
    validate  # 在复制到目标主机后但放到目标位置之前，执行此选项指定的命令。
              # 一般用于检查配置文件语法，语法正确则保存到目标位置。
              # 如果要引用目标文件名，则使用%s，下面的示例中的s%即表示目标机器上的/etc/nginx/nginx.conf。
```
## file
```
file 设置文件属性
	path         # 设置文件路径（必填）
	dest         # 设置目的路径
	name         # 设置文件名
	owner        # 指定拥有者
	group        # 指定所属组
	mode         # 设置权限
	recurse      # 递归设置目录属性
	state        # 文件状态
		file         # 文件不存在就不会被创建
		dictionary   # 若目录不存在，就自动创建
		link         # 创建软连接
		hard         # 创建硬链接
		touch        # 若不存在就自动创建
		absent       # 删除文件或目录
	src          # 指定源文件，只应用于state=link的情况
	force        # 强制创建软链接。
	             # 两种情况：1.当源文件不存在，但之后会建立
	                        2.要先取消已创建的软链接，再重新创
```
## service
```
service 管理服务运行状态
	enabled      # 是否开机自启（yes| no）
	name         # 指定服务名（必填）
	state        # 指定服务状态
		started      # 启动
		stoped       # 停止
		restarted    # 重启
		reloaded     # 重新加载
	arguments    # 服务参数
	pattern      # 设置模式
	# 通过status指令来查看服务的状态时
	# 若没有响应，就会通过ps指令在进程中根据该模式进行查找
	# 如果匹配到，则认为该服务依然在运行
	runlevel     # 运行级别
	sleep        # 若执行restarted，则在stop和start键沉睡几秒
```
## command
若不指定模块，则默认使用command模块。command模块不能解析变量(如$HOME)和某些操作符("<", ">", "\|", ";"以及"&")，若需要使用以上符号，就要用shell模块。
```
command
    chdir        # 在执行定义的命令前进入指定目录
    creates      # 创建文件，参数为一个文件或一个glob表达式，若已经存在就不会执行
    removes:     # 删除文件，参数为一个文件或一个glob表达式，若不存在就不会执行
    stdin:       # 可要求输入读取指定值
```
## shell
```
shell 在远程主机上运行命令，一般要使用管道符语法时，会使用shell模块。与raw模块类似
	例：ansible all -m shell -a 'echo hello'
```
## script
```
script 将本地脚本复制到远程主机并运行 
	例：ansible  all -m script -a '/tmp/a.sh'
```
## yum
```
yum 安装程序包
    config_file         # yum的配置文件
    disable_gpg_check   # 关闭gpg_check
    disablerepo         # 不启用某个源
    enablerepo          # 启用某个源
    name                # 程序包名
    state               # 设置状态
        present         # 安装
        latest          # 安装
        absent          # 卸载
```
注：yum模块是基于python2，若要基于python3安装，需要模块dnf。否则会以下报错：
```
    192.168.163.103 | FAILED! => {
    "changed": false,
    "msg": "The Python 2 bindings for rpm are needed for this module. If you require Python 3 support use the `dnf` Ansible module instead.. The Python 2 yum module is needed for this module. If you require Python 3 support use the `dnf` Ansible module instead."
	}
```
也可通过command模块直接安装：`ansible 主机 -m command -a 'yum -y install 软件'`

## dnf
类似yum，但由于yum基于python2，若有依赖于python3的软件包则会报错，因此可用dnf代替，并且dnf的安装速度都有提升。常用参数与yum一致。
## setup 
```
setup 收集远程主机的facts，获取主机信息
    # 每个被管理节点在接受并运行管理命令前，会将自己主机相关信息（如操作系统信息，IP地址等报告给ansible）
    filter     # 过滤器（正则表达式）
    例：ansible 192.168.163.103 -m setup -a 'filter=ansible_eth[0-2]'
```
```
---
- hosts: group1
  remote_user: root
  tasks:
    - name: get system info
      debug: msg="system = {{ ansible_os_family }} kernel = {{ ansible_kernel }} ip_addr = {{ ansible_all_ipv4_addresses }}"
# 用ansible XXX -m setup就能看到所有变量名
```

收集Facts会消耗额外的时间，若不需要，可以在playbook中关闭

```
- hosts: group1
  gather_facts: no
```

## synchronize

```
synchronize 使用rsync同步文件
    archive       # 归档，相当于同时开启recursive(递归)、links、perms、times、owner、group、-D选项都为yes ，默认该项为开启
    checksum      # 跳过检测sum值，默认关闭
    compress      # 是否开启压缩，默认yes
    copy_links    # 复制链接文件，默认为no ，注意后面还有一个links参数
    delete        # 删除不存在的文件，默认no
    dest          # 目录路径
    dest_port     # 默认目录主机上的端口 ，默认是22，走的ssh协议
    dirs          # 传速目录不进行递归，默认为no，即进行目录递归
    rsync_opts    # rsync参数部分
    set_remote_user    # 主要用于/etc/ansible/hosts中定义或默认使用的用户-与rsync使用的用户不同的情况
    mode          # push或pull 模块
        # push模式一般用于从本机向远程主机上传文件
        # pull 模式用于从远程主机上取文件
```
## mount
```
mount 设置挂载点
    dump
    fstype     # 必选项，挂载文件的类型
    name       # 必选项，挂载点
    opts       # 传递给mount命令的参数
    src        # 必选项，要挂载的文件
    state      # 必选项present：只处理fstab中的配置
    present    # 只处理fstab中的配置
    absent     # 删除挂载点
    mounted    # 自动创建挂载点并挂载
    umounted   # 卸载
```
## get_url
```
get_url    用于从http、ftp、https服务器上下载文件（类似于wget）
	sha256sum   # 下载完成后进行sha256 check；
	timeout     # 下载超时时间，默认10s
	url         # 下载的URL
	dest        # 本地存放路径
	url_password/url_username    # 主要用于需要用户名密码进行验证的情况
	use_proxy   # 使用代理，代理需事先在环境变更中定义
```

**查看模块用法信息`ansible-doc 模块名`**



# Playbook

一个简单的配置管理和多主机部署系统。Playbook是由一个或多个“Plays”组成的列表。将事先归为一组的主机装扮为通过Ansible的任务Task定义好的角色。任务也就是调用Ansible的模块将多个“play”组织到一个playbook中。playbook的模板使用Python的jinja2模块处理。

Playbook的组成：
1. Inventory
2. Modules
3. Ad Hoc Commands
4. Playbooks，包含以下部分
```
Tasks：任务，即调用模块完成的某操作。这是Playbook的核心，定义顺序执行的Action，每个Action调用一个Ansible模块
Variables：变量
Template：模板
Handlers：处理器，由某事件触发执行的操作
Roles：角色
```
**playbook基本组件**
play的主体部分是task list，task list中各个任务按次序逐个在hosts指定的主机上运行，即在所有主机上完成第一个任务后再按顺序完成第二个，若中途某个主机出现错误，则所有执行的任务都可能回滚。

建议每个任务都定义一个name标签，且每个task执行一个模块
```yaml
- hosts: test          # 指定主机组，也可指定单个主机
  remote_user: root    # 指定远程主机上执行任务的用户（也可用于各个task中）
  sudo: yes            # sudo执行命令，也可在task中添加
  sudo_user:           # sudo身份
  tasks:               # 任务列表
    - name: install latest apache
      yum: name=httpd state=latest
    - name: run apache
      service: name=httpd state=started   # 运行service模块，后面跟上参数选项
```
## 命令解析
`ansible-playbook`对yaml文件进行执行

```
ansible-playbook [选项] yml文件
  -f                     # 指定并行进程数，默认为5
  -i 或 --inventory      # 指定Inventory文件
  -e 或 --extra-vars=    # 设置额外的环境变量
  --flush-cache          # 清空收集到的facts缓存
  --list-tasks           # 列出所有将被执行的tasks
  --list-tags            # 列出所有可获得的tags
  --step                 # 每执行一步都进行交互式确认
  --syntax-check         # 检查playbook语法 
  --list-hosts           # 列出执行该playbook会影响的主机
  -v 或 --verbose        # 查看详细输出
  
```
`ansible-pull`拉取指定主机的配置


## 变量引用
```yaml
- hosts: test
    vars: 
      service: httpd
      package: httpd
    # 或直接在本地创建变量文件，然后在playbook中通过vars_files调用
    vars_files:
      - XXX/XXX.yml
    tasks:
      - name: install latest apache
      # 若要通过上面定义的变量引用，则需要两对大括号调用
        yum: name={{ package }} state=latest
      - name: run apache
        service: name={{ service }} state=started
```
```yaml
# 若定义的是一个对象，可直接用中括号或点调用子属性
---
- hosts: group1
  remote_user: root
  vars:
    foo:
      field1: one
      field2: two
  tasks:
    - name: echo foo.field1
      #  debug: msg="echo {{foo.field1}}"
      debug: msg="echo {{foo['field1']}}"
    - name: echo foo.field2
      debug: msg="echo {{foo.field2}}"

结果：
TASK [echo foo.field1] *********************************************************
ok: [172.16.246.133] => {
    "msg": "echo one"
}

TASK [echo foo.field2] *********************************************************
ok: [172.16.246.133] => {
    "msg": "echo two"
}
```

简单试验分析：

```yaml
创建test.yml
- hosts: system3
  tasks:
    - name: echo hello
      command: 'echo hello'
    - name: create user
      user: name=apache password=redhat state=present uid=1003

root@system2 ~ > ansible-playbook test.yml

PLAY [system3] *****************************************************************

TASK [Gathering Facts] *********************************************************
ok: [192.168.163.103]

TASK [echo hello] **************************************************************
changed: [192.168.163.103]

TASK [create user] *************************************************************
changed: [192.168.163.103]

PLAY RECAP *********************************************************************
192.168.163.103            : ok=3    changed=2    unreachable=0    failed=0  

# changed说明发生了改变。
# 若再次执行一遍，会出现以下改变

TASK [echo hello] **************************************************************
changed: [192.168.163.103]

TASK [create user] *************************************************************
ok: [192.168.163.103]

PLAY RECAP *********************************************************************
192.168.163.103            : ok=3    changed=1    unreachable=0    failed=0  
# 创建用户不再是changed，而是ok，而输出打印hello仍然为changed。
# 因为用户已创建了，就不会再创建，这体现了playbook的幂等性。而打印文字并不符合只需要执行一遍的特性。
```
## register

register为注册变量，即：将任务执行的结果当做一个变量的值，待后面的任务使用。

```yaml
---
- hosts: group1
  remote_user: root
  tasks:
    - shell: ls
      register: result
    - debug: msg="{{ result.stdout }}"
# 就能输出在对端主机ls得到的结果
结果：
TASK [debug] *******************************************************************
ok: [172.16.246.133] => {
    "msg": "anaconda-ks.cfg"
}
```

## 命令行传参

```yaml
- hosts: '{{group}}'    # 一定要加引号（无论是单引号还是双引号），否则会产生YAML陷阱，报错
  remote_user: '{{user}}'
  .....
```

在执行ansible-playbook时添加参数`--extra-vars "group=group1 user=root"`

## notify与handler

当远端发生改动时，playbooks本身可以识别这种改动,并且有一个基本的事件系统,可以响应这种改动。
notify会在playbook的每一个task结束时触发,即使有多个不同的task通知发生了改动（changed），notify只会被触发一次。
Handlers也是task的列表，若notify有定义，则handlers一定要有对应的处理方法。handlers主要用在重启服务，或系统重启。

一个handler最多只执行一次，并且**在所有task都执行完后再执行**，即handler是按照定义的顺序执行的，并不是按照task的调用顺序执行的。如果有多个任务调用同一个handler，则也只执行一次。

```
- hosts: test
    tasks:
      - name: install apache
        yum: name=httpd state=latest
        notify: yum error    # 关注可能发生的错误（不一定是错误），类似抛出异常
        # 若notify有多个，可通过列表定义
          - yum error
          - httpd error  # 定义了多个，则handler也要有对应处理
    handlers:            # 当关注的资源发生变化时采取的措施
      - name: yum error  # 当有notify抛出，也要有对应的解决方案，name要与对应的notify的名字一致。
        service: name=httpd state=restarted
```
## 逻辑控制
三种逻辑控制语句：

* `when`：条件判断，类似if
* `loop`：（迭代）循环，类似while
* `block`：将几个任务组成一个代码块，以便针对一组操作的异常进行处理

### 条件判断

当需要根据变量等信息判断是否需要执行某task时，则需要条件判断

```yaml
tasks:
  - name: echo hello
    command: echo hello
    when: ansible_fqdn == 'system3.example.com'
# 在task后添加when子句即可进行条件测试，when语句支持jinja2语法
# when语句中还能使用Jinja2的很多'filter'

执行结果：
TASK [echo hello] **************************************************************
skipping: [192.168.163.104]
changed: [192.168.163.103]

PLAY RECAP *********************************************************************
192.168.163.103            : ok=2    changed=1    unreachable=0    failed=0
192.168.163.104            : ok=1    changed=0    unreachable=0    failed=0

# 经过判断system4不满足when条件，所以skipping跳过，而system3满足，所以changed

可使用and、or、not进行逻辑连接或判断，==、!=、>、<、>=、<=进行算数比较

可使用is exists或is not exists判断指定的文件是否存在，且可通过not取反
即not XXX is exists 等于 XXX is not exists

可使用defined、undefined、none判断变量是否已定义，以及变量是否为空

可使用success或succeeded、failure或failed、change或changed、skip或skipped分别判断任务返回状态是否为成功、任务返回状态是否为失败、任务返回状态是否为改变、任务返回状态是否为跳过

可使用file、directory、link、mount判断路径是否为一个文件、目录、链接、挂载点

可使用lower、upper判断字符串是否为纯小写、纯大写

可使用even、odd判断数值是否为偶数、奇数，可用divisibleby(num)判断是否可以整除数值num

可用version(version值,'算数比较符')比较版本与指定值的大小

可用string、number分别判断值是否为字符串或数字

可用subset、superset（版本2.5及以上）|issubset、issuperset（版本2.5以下）判断一个list是否是另一个list的子集或父集
```
### 迭代（循环）

重复同类的task时使用。item定义迭代，with_items定义循环列表。
with_items中的列表值可以使字典，若是字典，引用时要使用item.键名

```yaml
列表形式
- apache
- php
字典形式
- {name: apache, conf: /etc/httpd.conf}
- {name: php, conf: /etc/php.ini}

试验：
- name: create user
  user: name={{item}} state=present
  with_items: 
    - zhangsan
    - lisi
就相当于
  user: name=zhangsan state=present
  user: name=lisi state=present

或者在vars中定义列表，然后使用with_items调用
vars: 
  user_list=['zhangsan', 'lisi']
tasks:
  - user: name={{item}} state=present
    with_items: "{{ user_list }}"
    
嵌套循环
tasks:
    - debug: msg="{{ item.0 }} {{ item.1 }}"
#或 -debug: msg="layer1: {{item[0]}} layer2: {{item[2]}}"
      with_nested:      # 使用with_nested进行嵌套循环
        - ['1', '2']    # 这个循环用item.0表示
        - ['4', '5']    # 这个循环用item.1表示
结果：
TASK [debug] *******************************************************************
ok: [172.16.246.133] => (item=[u'1', u'4']) => {
...
    "msg": "1 4"
}
ok: [172.16.246.133] => (item=[u'1', u'5']) => {
...
    "msg": "1 5"
}
ok: [172.16.246.133] => (item=[u'2', u'4']) => {
...
    "msg": "2 4"
}
ok: [172.16.246.133] => (item=[u'2', u'5']) => {
...
    "msg": "2 5"
}

文件列表循环
在当前目录下创建demo目录，并在其中创建httpd_1.conf和httpd_2.conf，编写Playbook
  tasks:
    - debug: msg="{{ item }}" 
      with_fileglob:     # 使用with_fileglob进行文件列表循环
        - ./demo/*       # 要循环的文件路径
结果：
TASK [debug] *******************************************************************
ok: [172.16.246.133] => (item=/root/./demo/httpd_1.conf) => {
    "item": "/root/./demo/httpd_1.conf", 
    "msg": "/root/./demo/httpd_1.conf"
}
ok: [172.16.246.133] => (item=/root/./demo/httpd_2.conf) => {
    "item": "/root/./demo/httpd_2.conf", 
    "msg": "/root/./demo/httpd_2.conf"
}
```
### Block块

```yaml
多个Action组成block块，可进行一个块的执行
  tasks: 
  - debug:
      msg: "task1 not in block"
  - block:
      - debug:
          msg: "task2 in block"
      - debug:
          msg: "task3 in block"
    when: 2 > 1
	# block块中的when是用于判断block块是否执行的条件
```

但Block块更常见的用法是“错误处理”。当某任务出错时，能够执行指定的其他任务。作用与`when XXX is failed`一致。

```yaml
  tasks: 
    - block: 
        - shell: "ls ./aaa"        # 该目录不存在，会出错
      rescue:       # 一旦出错就会调用rescue任务，类似except，处理异常
        - debug: 
            msg: "caught an error"  
      always:       # 总是会执行的语句，类似finally
        - debug:
            msg: "this always executes"
结果：
TASK [command] 
fatal: ......
TASK [debug] 
ok: [172.16.246.133] => {
    "msg": "caught an error"
}
TASK [debug] 
ok: [172.16.246.133] => {
    "msg": "this always executes"
}
```



### 模板

通过配置模板，可将配置文件中的参数按照inventory文件中变量以及ansible facts中变量动态赋值，使得每个指定的主机的配置都是定制的。
首先要创建一个templates目录。`mkdir /etc/ansible/templates`
将配置文件放入该目录，并最好改名为`xxx.conf.j2`
```yaml
以httpd为例，修改配置文件/etc/ansible/templates/httpd.conf.j2
Listen {{ http_port }}    # 使用inventory定义变量
User {{ username }}       # 同上
Group {{ groupname }}     # 同上
ServerName {{ ansible_fqdn }}    # 使用facts变量

然后修改/etc/ansible/hosts文件
[test]
192.168.163.103 http_port=8081 username=system3 groupname=system3 
192.168.163.104 http_port=8082 username=system4 groupname=system4 

然后在playbook中将本地的配置文件复制到远端，以下是完整试验
- hosts: test
  vars:
    service: httpd
  tasks:
  - name: alter config
    template: src=/etc/ansible/templates/httpd.conf.j2 dest=/etc/httpd/conf/httpd.conf
    notify:
    - restart httpd
  - name: start httpd
    service: name={{ service }} enabled=true state=started 
  handlers:
  - name: restart httpd
    service: name={{ service }} state=restarted

执行ansible-playbook test.yml。之后查看103和104主机的httpd配置文件
system3和system4上，httpd配置文件都更改成功。以下为system3上的配置
Listen 8081
Include conf.modules.d/*.conf
User system3
Group system3
ServerAdmin root@localhost
ServerName system3.example.com
```
### tags标签
可以为playbook中的每个任务都打上标签，标签的主要作用是可以在ansible-playbook中设置只执行被打上tag的任务或忽略被打上tag的任务。
```yaml
tasks:
- name: install apache
  yum: name=httpd state=present
  tags: apache
- name: install mysql
  yum: name=mysql-server state=present
  tags: mysql
当执行playbook时，可通过--tags= 运行打上指定tag的task
ansible-playbook test.yml --tags="apache" 则只运行安装打上apache标签的task
ansible-playbook test.yml --skip-tags="apache"则会跳过执行apache标签的task
  tags: always
打上always标签的task总会被执行，不管是否指定了--tags="XXX"

--tags tagged    # 会执行所有打上tag的task，不管打上的是什么标签
--tags untagged  # 会执行所有没有打标签的task
--tags all       # 执行所有任务，无论是否打标签
```
### include和roles
如果把所有play都写在一个playbook中，会导致文件不易阅读。ansible可以将多个不同任务分别写在不同的playbook中，然后使用include将其包含进去，实现Playbook的重用。roles也是一种整合playbook的方式。include的维护成本较高，重用能力有限，而role更加灵活，且可以重用一组文件。

#### include
使用include语句引用task文件的方法，可允许你将一个配置策略分解到更小的文件中，将tasks从其他文件拉取过来（handlers也是tasks）。即include可以导入两种文件：导入task、导入playbook。
```yaml
导入task：
创建一个单独的yml配置文件，a.yml
---
  - name: echo hello
    command: echo 'hello'
  - name: echo value
    command: echo {{value}}

在主playbook中便可通过include引用该文件
- hosts: test
  tasks:
    - include: a.yml value='hello'
       # 可以直接在文件名后传参数
       # 也可以通过vars传参
  tasks: 
    - include: a.yml
      vars: 
        value: hello

导入playbook：
并不在task中通过include调用yml了，而是直接在最外层导入playbook
- hosts: test
.....
- include: test1.yml
- include: apache.yml http_port=8000  # 传参方式与上面一样

在include中使用tags
- include: test1.yml
  tags: [aaa, bbb]
```

#### roles
角色，封装playbook，实现复用性，能够根据层次型结构自动加载变量文件、tasks以及handlers等。
roles就是通过分别将变量、文件、任务、模板以及处理器放置于单独的目录中，然后通过include调用的一种机制。roles一般用于基于主机构建服务的场景中，也可以使用于构建守护进程的场景中。

创建role的步骤：
1. 在playbooks目录中创建roles目录
2. 在roles目录中创建角色名的目录
3. 在每个角色命令的目录中创建files、handlers、meta、tasks、templates、vars目录。若用不到的目录也可不创
4. 在playbook中调用各角色

> 如果定义了环境变量`ANSIBLE_ROLES_PATH`，则也会查找该目录下的role

role有默认的存放目录`/etc/ansible/roles`，若既没有定义环境变量，也没有在playbook中定义变量`roles_path`，则会在该默认目录中查找role。**如果既定义了环境变量，又定义了`roles_path`，则后者失效。**

roles中各目录：

* `tasks`目录：至少包含一个main.yml，其定义了此角色的任务列表，此文件可用include包含其他task目录
* `files`目录：存放有copy或script等模块调用的文件
* `templates`目录：template模块会自动在此文件中寻找jinja2模板
* `handlers`目录：此目录中应包含一个main.yml，定义此角色用到的handler
* `yml`文件：用于定义此角色用到的个handler，
* `vars`目录：应包含一个main.yml，定义此角色用到的变量
* `meta`目录：应包含一个main.yml，定义此角色的特殊设定和依赖关系
* `defaults`目录：应包含一个main.yml，为当前角色设定默认变量时使用此目录

可使用命令`ansible-galaxy init role-name`在当前目录中自动生成指定的role目录

案例目录结构

```
roles
├── test1
│   ├── files
│   ├── handlers
│   ├── meta
│   ├── tasks
│   ├── templates
│   └── vars
└── test2
    ├── files
    ├── handlers
    ├── meta
    ├── tasks
    ├── templates
    └── vars
```
将要编写的task文件存放在tasks目录中，编写main.yml。
将httpd的配置文件复制到files目录中。

```yaml
- name: install httpd
  yum: name=httpd state=present
- name: install config
  copy: src=httpd.conf dest=/etc/httpd/conf/httpd.conf 
  # 这里copy的源可直接写文件名，会自动定位到files目录中
  tags:
  - conf
  notify:
  - restart httpd
- name: start httpd
  service: name=httpd state=started
```
然后在handlers中添加handler文件，在目录中创建main.yml
```yaml
- name: restart httpd
  service: name=httpd state=restarted
```
在于roles平级的目录中创建site.yml文件（名字可自定义），就是主配置文件。roles后面也可跟上参数，也可跟上条件判断。
```yaml
- hosts: system1
  remote_port: root
  roles: 
    - test1
- hosts: system3
  roles:
    - test2
- hosts: system4
  roles: 
    - test1
    - test2
```

带参数的role

```
a.yml和roles的目录结构
a.yml
roles/
└── myrole
    └── tasks
        └── main.yml

在main.yml中指定task
---
  - debug: msg="{{ param }}"
在a.yml中的配置如下：
---
- hosts: group1
  remote_user: root
  roles:
    - role: myrole
      param: " task first"
    - role: myrole
      param: " task second"
执行结果：
TASK [myrole : debug] 
ok: [172.16.246.133] => {
    "msg": " task first"
}
TASK [myrole : debug] 
ok: [172.16.246.133] => {
    "msg": " task second"
}
会循环遍历a.yml中设置指定参数执行
```

role的默认参数defaults，在myrole中创建defaults目录，并创建main.yml

```
roles/
└── myrole
    ├── defaults
    │   └── main.yml
    └── tasks
        └── main.yml
在defaults中的main.yml中只要配置
---
param: "default param"
将a.yml中的myrole下的参数配置删除
roles:
    - myrole
再执行，就会调用defaults中的指定参数
TASK [myrole : debug]
ok: [172.16.246.133] => {
    "msg": "default param"
}
但执行速度会变慢
```

role与when的结合：当满足条件时才采用指定值

```
roles: 
  - role: myrole
    param: "myrole param"
  - role: myrole
    when: 2>1
结果：
TASK [myrole : debug] 
ok: [172.16.246.133] => {
    "msg": "myrole param"
}
TASK [myrole : debug]
ok: [172.16.246.133] => {
    "msg": "default param"
}
```

在role中使用tags

```
roles: 
  - role: myrole
    tags: ['aaa', 'bbb']
```

role和tasks的执行顺序

1. pre_tasks：是在最先执行的task
2. roles：roles会在tasks前执行
3. tasks
4. post_tasks：最后执行的task

## 常用技巧

* 若要使command或shell的成功返回值不为0，有以下两种方式
```yaml
tasks:
 - name: run this command and ignore the result
   shell: /usr/bin/somecommand || /bin/true
或
tasks:
 - name: run this command and ignore the result
   shell: /usr/bin/somecommand
   ignore_errors: True
```



# Ansible变量

Ansible有三个组成部分：

* Global：作用域为全局。在以下方面定义：
  * Ansible配置文件中定义
  * 环境变量
  * ansible及ansible-playbook命令行传入的变量
* Play：作用域为Play（一个Playbook由多个Play组成）。在以下方面定义：
  * Play中vars关键词定义的变量
  * 通过模块include_vars定义的变量
  * role在文件default/main.yml和vars/main.yml中定义的变量
* Host：作用域为某个主机。在以下方面定义：
  * 定义在主机Inventory中的变量
  * 主机的系统变量
  * 注册变量



**Ansible所有变量的优先级（从高到低）：**

* **extra vars**：通过命令传入的变量

* **task vars**：仅在该任务中使用的变量

  ```
  tasks:
    - XXXX
      vars:
        XXX: XXX
  ```

* **block vars**：只在Playbook的任务中某个block定义的变量

  ```
  tasks:
  ....
    - block: 
      - XXX: XXXX
      vars: 
        XXX: XXX
  ```

* **role include vars**：在`tasks/main.yml`中，通过include加载的变量

  ```
  - name: xxx
    include_vars: "XXX.yml"
  ```

* **role and include vars**：role的变量。在`vars/main.yml`中定义的变量

* **set_facts**：这是一个模块，通过该模块加入一些Facts变量

  ```
  - set_fact:
    XXX: XXX
  ```

* **registered vars**：注册变量

* **play vars_files**：将变量单独放在一个文件中，通过关键字`var_files`从文件中加载的变量

  ```
  var_files:
    - XXX.yml
  ```

* **play vars_prompt**：需要用户在执行Playbook时输入的变量

  ```
  vars_prompt:
    - name: "yourname"
  tasks: 
    - debug: msg="your name is {{yourname}}"
  
  在执行Playbook时传参
  ansible-playbook a.yml -e 'yourname=zhangsan'
  ```

* **play vars**：Playbook中的`vars`关键字下定义的参数

* **host facts**：Ansible在执行Playbook时，收集到的远程主机的信息

* **playbook host_vars**：Playbook同级子目录`host_vars`中文件内定义的变量

* **playbook group_vars**：Playbook同级子目录`group_vars`中文件内定义的变量

* **inventory host_vars**：可在两个地方定义。一是在inventory文件中直接定义，二是在Inventory文件的同级子目录`host_vars`中**与host同名的文件**中定义

* **inventory group_vars**：可在两个地方定义。一是在inventory文件中直接定义，二是在Inventory文件的同级子目录`group_vars`中**与group同名的文件**中定义

* **inventory vars**：Inventory文件中定义的变量

* **role defaults**：role的默认变量，在`defaults/main.yml`中定义



# Lookup

lookup既能读取Ansible管理节点上文件系统的文件内容，还能读取数据库内容。



* lookup读取文件

  ```
  vars: 
    contents: "{{ lookup('file', 'data/test.txt') }}"
  将data/test.txt中的内容赋给变量contents，file指定读取的对象类型是文件
  ```

* lookup生成随机密码，若文件不存在，会自动创建，并将生成的密码存入。若文件存在，则直接读取作为密码

  ```
  vars: 
    password: "{{ lookup('password', '/etc/password/zhangsan length=6') }}"
  tasks:
    - debug: msg="password {{password}}"
    
  执行结果：
  TASK [debug]
  ok: [172.16.246.133] => {
      "msg": "password BWNcQ2 "
  }
  ```

* lookup读取环境变量

  ```
  tasks:
    - debug: msg="{{ lookup('env', 'HOME') }}"
    
  结果：
  ok: [172.16.246.133] => {
      "msg": "/root"
  }
  ```

* lookup读取Linux命令执行结果

  ```
  tasks:
    - debug: msg="{{ lookup('pipe', 'uname -r') }}"
    
  结果：
  ok: [172.16.246.133] => {
      "msg": "4.8.6-300.fc25.x86_64"
  }
  ```

* lookup读取template变量替换后的文件

  ```
  tasks:
    - debug: msg="{{ lookup('template', './httpd.conf.j2') }}"
  ```

* lookup读取配置文件

  ```
  demo.ini配置文件：
  [global]
  port = 873
  .....
  [rsync_test]
  comment = rsync test
  path = /root/rsync_test
  .....
  
  tasks:
    - debug: msg="global-port {{ lookup('ini', 'port section=global file=./demo.ini') }}"
    - debug: msg="rsync_test-path {{ lookup('ini', 'path section=rsync_test file=./demo.ini') }}"
  # lookup的第二个参数分为几个部分：要查的字段  section=节的名称  file=文件名 
  若是properties文件，则需要添加参数type=properties
  完整的几个参数：
  参数名            默认值               含义
  type             ini                 文件类型
  file             ansible.ini         文件名
  section          global              节
  re               False               字段的正则表达式
  default          ""                  字段不存在时的返回值
   
  执行结果：
  ok: [172.16.246.133] => {
      "msg": "global-port 873"
  }
  ok: [172.16.246.133] => {
      "msg": "rsync_test-path /root/rsync_test"
  }
  ```

* lookup读取CSV文件的指定单元

  ```
  csv文件：
  name       age   sex
  zhangsan   22    male
  lisi       23    male
  
  tasks:
    - debug: msg="{{lookup('csvfile', 'lisi file=./demo.csv delimiter=, col=0')}}"
  # 获取lisi的第0列，即名字lisi
  ok: [172.16.246.133] => {
      "msg": "lisi"
  }
  支持的参数：
  参数名      默认值        含义
  file       ansible.csv  文件名
  col        1            列号（从0开始计数）
  delimiter  TAB          CSV文件的分隔符
  default    ""           元素不存在时的返回值
  encoding   utf-8        CSV文件的编码
  ```

* lookup读取DNS解析的值。可以向DNS服务器查询指定域的DNS记录，可查询任何DNS记录（包括正向和反向）

  ```
  tasks:
    - debug: msg="ipv4 address of baidu.com  {{ lookup('dig', 'baidu.com') }}"
    - debug: msg="txt record of baidu.com  {{ lookup('dig', 'baidu.com', 'qtype=TXT') }}"
    - debug: msg="txt record of baidu.com {{ lookup('dig', 'baidu.com./TXT') }}"
    - debug: msg="MX record of 163.com {{ lookup('dig', '163.com./MX', 'wantlist=True') }}"
    
  需要安装dnspython模块，直接pip install 即可
  执行结果：
  ok: [172.16.246.133] => {
      "msg": "ipv4 address of 'baidu.com'   220.181.57.216,123.125.115.110"
  }
  ok: [172.16.246.133] => {
      "msg": "txt record of 'baidu.com'  v=spf1 include:spf1.baidu.com include:spf2.baidu.com include:spf3.baidu.com a mx ptr -all,google-site-verification=GHb98-6msqyx_qqjGl5eRatD3QTHyVB6-xQ3gJB5UwM"
  }
  ok: [172.16.246.133] => {
      "msg": "txt record of 'baidu.com' v=spf1 include:spf1.baidu.com include:spf2.baidu.com include:spf3.baidu.com a mx ptr -all,google-site-verification=GHb98-6msqyx_qqjGl5eRatD3QTHyVB6-xQ3gJB5UwM"
  }
  ok: [172.16.246.133] => {
      "msg": "MX record of '163.com' 50 163mx00.mxmail.netease.com.,10 163mx01.mxmail.netease.com.,10 163mx03.mxmail.netease.com.,10 163mx02.mxmail.netease.com."
  }
  
  反向解析：
  - debug: msg="fqdn of '8.8.8.8' {{ lookup('dig', '8.8.8.8/PTR') }}"
  结果：
  ok: [172.16.246.133] => {
      "msg": "fqdn of '8.8.8.8' google-public-dns-a.google.com."
  }
  ```



# Jinja2过滤器

Jinja2是Python的web开发中常用的模板语言，也被用于管理配置文件。Jinja2是Flask作者仿Django模板开发的模板引擎。但Jinja2具有更好的性能，更加灵活，具有很好的可读性。

* 格式化数据


* 强制定义变量
对于未定义变量，Ansible默认行为是fail，也可关闭。


* 未定义变量默认值
Jinja2提供一个有用default过滤器，设置默认变量值。比强制定义变量更好。


* 忽略未定义变量和参数
可使用default过滤器忽略未定义的变量和模块参数

Jinja2的三种语法：

- 控制结构

  ```jinja2
  {% %}
  ```

- 变量取值

  ```jinja2
  {{ }}
  ```

- 注释

  ```jinja2
  {# #}
  ```



## Jinja语法

Jinja2控制结构：

```jinja2
{% if ... %}
{% elif ... %}
{% else %}
{% endif %}
```

Jinja2的for循环：

```jinja2
{% for .. in .. %}
{% endfor %}
```

for循环中的特殊变量：

| 变量           | 描述                            |
| -------------- | ------------------------------- |
| loop.index     | 当前循环的次数（从1开始计数）   |
| loop.index0    | 当前循环的次数（从0开始计数）   |
| loop.revindex  | 到循环结束的次数（从1开始计数） |
| loop.revindex0 | 到循环结束的计数（从0开始计数） |
| loop.first     | 如果是第一次迭代，为True        |
| loop.last      | 如果是最后一次迭代，为True      |
| loop.length    | 序列中的项目数                  |
| loop.cycle     | 在一串序列间取值的辅助函数      |

Jinja2的宏。类似函数，将行为抽象成可重复调用的代码块

```jinja2
{% macro input(name, type='text', value='') %}
  <input type='{{ type }}' name='{{ name }}' value='{{ value }}'>
{% endmacro %}
```

宏的调用：

```jinja2
<p>{{ input('username', value='user') }}</p>
<p>{{ input('password', 'password') }}</p>

相当于
<p><input type='text', name='username', value='user'></p>
<p><input type='password', name='password'></p>
```

Jinja2继承。若Jinja2仅用于配置文件，则基本用不到继承功能，而在网页开发中，继承相当强大，常用于配置模板文件，在Django和Flask中会被大量使用，减少重复代码的开发编写，使html文件更加简洁易读。

```jinja2
{% block block块名 %}
{% endblock block块名 %} 
在endblock中block块名可以不加，但为了阅读性最好加上

在html文件的最前面应该添加要继承的模板文件
{% extends "xxx.html" %}

继承模板中指定块的内容
{% block xxx %}
{{ super() }}
{% endblock %}
```

## 过滤器

* `quote`：给字符串加上引号

  ```jinja2
  {{ str | quote }}
  ```

* `default`：为没有定义的变量提供默认值

  ```jinja2
  {{ variable | default('xxxx') }}
  ```

* `omit`：忽略变量的占位符。常与dafault合用，当定义了参数时则会调用该参数，而若没有该参数时，则不会传入任何值

  ```jinja2
  {{ variable | default(omit) }}
  
  例：
  - file: dest={{ item.path }} state=touch mode={{ item.mode|default(omit) }}
    with_items:
      - path: /tmp/demo1    # demo1没有设置mode，因此mode不会传入任何值。omit起到为有值的item项占位
      - path: /tmp/demo2    # demo2的path和mode都有
        mode: "0664"
  ```

* `mandatory`：强制变量必须定义，否则报错。Ansible默认若变量没有定义，则使用未定义的变量会报错。也可以在Ansible配置文件中修改参数`error_on_undefined_vars = False`，即使遇到未定义变量，也不会报错。若要强制约束一个变量必须定义，则可以使用`mandatory`。

  ```jinja2
  {{ undefined_variable | mandatory }}
  ```

* `bool`：判断变量是否为布尔类型

  ```jinja2
  {{ variable | bool }}
  ```

* `ternary`：Playbook的条件表达式。类似(A?B:C)

  ```jinja2
  {{ 条件判断 | ternary("满足时采用的值", "不满足时采用的值") }}
  ```

* `basename`、`dirname`、`expanduser`、`realpath`、`relpath`、`splitext`

  ```jinja2
  {{ path | basename }}      获取路径中的文件名
  {{ path | dirname }}       获取文件的目录
  {{ path | expanduser }}    当前用户目录
  {{ path | realpath }}      获取链接文件所指文件的真实路径
  {{ path | relpath }}       获取相对于某一根目录的相对路径
  {{ path | splitext }}      把文件名用点号分割成多个部分
  ```

  ```
    vars:
      conf_path: "/etc/httpd.conf"
      yml_path: "~/a.yml"
    tasks:
      - debug: msg="{{ conf_path | basename }}"
      - debug: msg="{{ conf_path | dirname }}"
      - debug: msg="{{ yml_path | expanduser }}"
      - debug: msg="{{ yml_path | realpath }}"
      - debug: msg="{{ yml_path | relpath('/home') }}"
      - debug: msg="{{ conf_path | splitext }}"
      
  执行结果：
      "msg": "httpd.conf"      #/etc/httpd.conf的文件名
      "msg": "/etc"            #/etc/httpd.conf文件所在目录名
      "msg": "/root/a.yml"     #~/a.yml，用实际用户替代~
      "msg": "/root/~/a.yml"   #仅对链接文件有效，指向真实文件的路径
      "msg": "../root/~/a.yml" #~/a.yml相对于指定路径的相对路径
      "msg": "(u'/etc/httpd', u'.conf')"  #分隔文件与所在目录
  ```

  若是Windows系统，Ansible提供的路径过滤器：

  ```
  {{ path | win_basename }}       # 获取文件名
  {{ path | win_dirname }}        # 获取文件所在目录路径
  {{ path | win_splitdrive }}     # 将路径分隔成多个部分
  ```

* `b64encode`、`b64decode`、`to_uuid`、`hash`

  ```
  {{ string | b64encode }}       # 将字符串转化为base64格式
  {{ string | b64decode }}       # 将字符串（base64格式）解码
  {{ string | to_uuid }}         # 将字符串转变为UUID
  {{ string | hash('sha1') }}    # 使用sha1求出字符串的哈希，还可用md5、blowfish求
  {{ string | checksum }}        # 使用checksum求哈希
  {{ string | password_hash('') }}  # 使用哈希算法求密码的hash
  ```

* 判断是否是合法IP地址。

  ```
  {{ ip_addr_str | ipaddr }}    # 判断IP地址是否合法
  {{ ip_addr_str | ipv4 }}      # 返回ipv4地址
  {{ ip_addr_str | ipv6 }}      # 返回ipv6地址
  {{ ip_addr_str | ipaddr('address') }}  # 返回纯ip地址（不带掩码）
  ```

* `to_datetime`：字符串类型时间转换为时间戳

  ```
  {{ date_str | to_datetime }}
  ```

* Json操作

  ```jinja2
    vars:
      value:
        - key1: "value1"
        - key2: "value2"
    tasks:
      - name: outputfile /tmp/b.txt
        blockinfile:
          dest: /tmp/b.txt
          block: |
            {{ value | to_json }}
            ------------------------
            {{ value | to_yaml }}
            ------------------------
            {{ value | to_nice_json }}
            ------------------------
            {{ value | to_nice_yaml }}
  
  执行结果：在指定的主机上查看/tmp/b.txt
  [{"key1": "value1"}, {"key2": "value2"}]
  ------------------------
  - {key1: value1}
  - {key2: value2}
  
  ------------------------
  [
      {
          "key1": "value1"
      }, 
      {
          "key2": "value2"
      }
  ]
  ------------------------
  -   key1: value1
  -   key2: value2
  ```

* 在Json对象中搜索符合条件的属性

  ```jinja2
    vars:
      host_group:
        cluster1:
          - name: "host1"
          - name: "host2"
    tasks:
      - debug: var=item
        with_items: "{{ host_group | json_query('cluster1[*].name') }}"
        
  执行结果：
  ok: [172.16.109.132] => (item=host1) => {
      "item": "host1"
  }
  ok: [172.16.109.132] => (item=host2) => {
      "item": "host2"
  }
  ```

* 测试变量，只返回true或false

  ```yaml
  variable | match("正则表达式")   完全匹配，从头匹配到最后表达式中字段即可，并不是字段后还会匹配
  variable | search("正则表达式")  部分匹配，只要匹配字符串中包含该匹配字段即可
  
    vars:
      url: "https://example.com/user/foo/resources/bar"
    tasks:
      - debug: msg="match 1 {{url | match("https://example.com/.*/resources/.*")}} "
      - debug: msg="match 2 {{url | match("/user/")}}"
      - debug: msg="match 3 {{url | match(".*/user")}}"
      - debug: msg="match 4 {{url | match("user/.*")}}"
      - debug: msg="match 5 {{url | search("foo")}}"
   结果：
      "msg": "match 1 True "
      "msg": "match 2 False"
      "msg": "match 3 True"
      "msg": "match 4 False"
      "msg": "match 5 True"
  ```

* 比较版本

  ```yaml
  version | version_compare("要比较的版本号", "比较运算符")
  
    vars:
      version: "18.06"
    tasks:
      - debug: msg="does 12.04 > version(18.06)? {{version | version_compare("12.04", ">")}}"
      - debug: msg="does 19.04 > version(18.06)? {{version | version_compare("19.04", ">")}}"
  结果：
      "msg": "does 12.04 > version(18.06)? True"
      "msg": "does 19.04 > version(18.06)? False"
  ```

* 测试List包含关系，返回true或false

  ```yaml
  list_1 | issuperset(list_2)      list_1是否包含list_2
  list_2 | insubset(list_1)        list_2是否是list_1的子列表
  
    vars:
      list_1: ['a','b','c','d','e']
      list_2: ['b','c']
    tasks:
      - debug: msg="list_1 included list_2 {{ list_1 | issuperset(list_2) }}"
      - debug: msg="list_2 is included in list_1 {{ list_2 | issubset(list_1) }}"
  结果：
      "msg": "list_1 included list_2 True"
      "msg": "list_2 is included in list_1 True"
  ```

* 测试文件路径，返回true或false

  ```yaml
  path | is_file       是否是文件
  path | is_dir        是否是目录
  path | is_link       是否是链接
  path | exists        是否存在
  
    vars:
      path_1: /root/a.yml
      path_2: /etc
    tasks:
      - debug: msg="a.yml is file {{path_1|is_file}}"
      - debug: msg="/etc is dir {{path_2|is_dir}}"
      - debug: msg="a.yml is link file {{path_1|is_link}}"
      - debug: msg="/etc exists {{path_2|exists}}"
  结果：
      "msg": "a.yml is file True"
      "msg": "/etc is dir True"
      "msg": "a.yml is link file False"
      "msg": "/etc exists True"
  ```

* 测试命令执行结果，返回true或false

  ```yaml
  result | failed      # 是否失败
  result | changed     # 是否改变
  result | success     # 是否成功
  result | skipped     # 是否跳过
  
    tasks:
      - shell: ls
        register: result
        ignore_errors: true
      - debug: msg="execute failed? {{ result|failed }}"
      - debug: msg="execute changed? {{ result|changed }}"
      - debug: msg="execute success? {{ result|success }}"
      - debug: msg="execute skipped? {{ result|skipped }}"
  结果：
      "msg": "execute failed? False"
      "msg": "execute changed? True"
      "msg": "execute success? True"
      "msg": "execute skipped? False"
  ```



# Ansible-Tower

Ansible Tower是中心化的ansible管理节点，管理员通过登录Tower来运行Playbook，无须与每台主机都建立ssh连接。

{% asset_img 1.png %}

在Tower中还能实现权限管理、Playbook执行状态统计、REST API。[ansible-tower下载](https://releases.ansible.com/ansible-tower/setup-bundle/)。解压后查看其中的`inventory`文件

```
[tower]
localhost ansible_connection=local

[database]

[all:vars]
admin_password=''        # Tower管理员的密码

pg_host=''
pg_port=''

pg_database='awx'        
pg_username='awx'
pg_password='redhat'     

rabbitmq_username=tower
rabbitmq_password=''
rabbitmq_cookie=cookiemonster
```









> 参考资料
>
> [Ansible中文权威指南](http://www.ansible.com.cn/index.html)
> [Ansible ：一个配置管理和IT自动化工具](https://linux.cn/article-4215-3.html)
> [Ansible系列](http://www.cnblogs.com/f-ck-need-u/p/7576137.html#ansible)
> [大神带你 20 分钟学会 Ansible！](https://mp.weixin.qq.com/s?__biz=MzAxNTcyNzAyOQ==&mid=2650960643&idx=1&sn=ba6a46d24f181eeb1308087830648cd8&chksm=800973d9b77efacf2e0cc0ad2a4c015b7c67b511f1cb1786f4c74f2243e69e97da2955dce681&mpshare=1&scene=23&srcid=0626IdjKI6mMzTfKSPwq6Dua#rd)
> [Ansible详解（一）](https://www.cnblogs.com/ilurker/p/6421624.html)
> [Ansible详解（二）](https://www.cnblogs.com/ilurker/p/6421637.html)
>
> [朱双印个人日志-Ansible](http://www.zsythink.net/archives/category/%E8%BF%90%E7%BB%B4%E7%9B%B8%E5%85%B3/ansible)
>
> Linux集群与自动化运维
>
> Ansible快速入门技术原理与实战
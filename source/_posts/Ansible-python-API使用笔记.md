---
title: Ansible-python-API使用笔记
tags: [API, python, ansible]
date: 2020-01-07 22:49:09
categories: [Python]
comments: false
---
**Ansible python API v2.9.4  , Ansible v2.9.4**

<!--more-->

# API官方案例
```python
import json
import shutil
from ansible.module_utils.common.collections import ImmutableDict
from ansible.parsing.dataloader import DataLoader
from ansible.vars.manager import VariableManager
from ansible.inventory.manager import InventoryManager
from ansible.playbook.play import Play
from ansible.executor.task_queue_manager import TaskQueueManager
from ansible.plugins.callback import CallbackBase
from ansible import context
import ansible.constants as C

class ResultCallback(CallbackBase):
    def v2_runner_on_ok(self, result, **kwargs):
        host = result._host
        print(json.dumps({host.name: result._result}, indent=4))


context.CLIARGS = ImmutableDict(connection='local', module_path=['/to/mymodules'], forks=10, become=None,
                                become_method=None, become_user=None, check=False, diff=False)

loader = DataLoader()
passwords = dict(vault_pass='secret')

results_callback = ResultCallback()

inventory = InventoryManager(loader=loader, sources='localhost,')

variable_manager = VariableManager(loader=loader, inventory=inventory)

play_source =  dict(
        name = "Ansible Play",
        hosts = 'localhost',
        gather_facts = 'no',
        tasks = [
            dict(action=dict(module='shell', args='ls'), register='shell_out'),
            dict(action=dict(module='debug', args=dict(msg='{{shell_out.stdout}}')))
         ]
    )

play = Play().load(play_source, variable_manager=variable_manager, loader=loader)

tqm = None
try:
    tqm = TaskQueueManager(
              inventory=inventory,
              variable_manager=variable_manager,
              loader=loader,
              passwords=passwords,
              stdout_callback=results_callback, 
          )
    result = tqm.run(play)
finally:
    if tqm is not None:
        tqm.cleanup()

    shutil.rmtree(C.DEFAULT_LOCAL_TMP, True)
```

# API详解
## CallbackBase
`CallbackBase`是需要重写的结果返回类。类的定义位于`ansible.plugins.plugins.callback`的`__init__.py`中。
因为ansible版本是>2的，所以可以重写的方法开头是带有`v2`的。一些可重写的方法：
- `v2_runner_on_failed`：当执行失败后执行的方法
- `v2_runner_on_ok`：当执行成功后执行的方法
- `v2_runner_on_unreachable`：当出现无法连接的情况执行的方法



**参考文献**

> [Ansible 官方文档](https://docs.ansible.com/ansible/latest/dev_guide/developing_api.html#)

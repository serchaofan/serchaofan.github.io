---
title: Jumpserver管理的虚拟机添加到Prometheus
tags: []
categories: []
date: 2022-07-09 23:50:37
comments: false
---

创建一个Python脚本，通过Jumpserver的API获取到所有assets的信息，并处理成Prometheus格式的json文件

```python
import requests
import json

class JumpServerApi:
    def __init__(self):
        self.jumpserver_url = 'http://xx.xx.xx.xx'
        self.username = "xxx"
        self.password = "xxxxxx"

        self.headers = {
            "Authorization": 'Bearer ' + self.get_token(),
            'X-JMS-ORG': '00000000-0000-0000-0000-000000000002'
        }

    def get_token(self):
        url = self.jumpserver_url + '/api/v1/authentication/auth/'
        data = {
            "username": self.username,
            "password": self.password
        }
        response = requests.post(url, data=data)
        return json.loads(response.text)['token']

    def get_label(self, label_id):
        url = self.jumpserver_url + '/api/v1/assets/labels/' + label_id + '/'
        response = requests.get(url, headers=self.headers)
        result = json.loads(response.text)
        return result.get("name"), result.get("value")

    def get_assets_list(self):
        url = self.jumpserver_url + '/api/v1/assets/assets/'
        response = requests.get(url, headers=self.headers)
        result = json.loads(response.text)['results']
        assets_list = []
        for host in result:
            labels = {
                "ip": host.get("ip"),
                "hostname": host.get("hostname")
            }
            host_json = {
                "targets": [labels['ip']+":9100"],
            }
            label_list = host.get("labels")
            
            for label_id in label_list:
                label_key, label_value = self.get_label(label_id)
                labels[label_key] = label_value
            host_json["labels"] = labels
            assets_list.append(host_json)
        return assets_list

api = JumpServerApi()
data = api.get_assets_list()
json_str = json.dumps(data, ensure_ascii=False)

with open('/data/prometheus/conf.d/jumpserver.json', 'w', encoding='utf-8') as json_file:
    json_file.write(json_str)
    json_file.close()
```

Json列表中的每一条都是以下格式：
```json
{
    "targets": ["xx.xx.xx.xx:9100"], 
    "labels": {
        "ip": "xx.xx.xx.xx", 
        "hostname": "xxxxxx", 
        "label_1": "xxx",
        "label_2": "xxx"
    }
}
```

然后在Prometheus的配置中添加一条
```yaml
  - job_name: "jumpserver_host"
    file_sd_configs:
      - files:
         - /data/prometheus/conf.d/jumpserver.json
        refresh_interval: 30s
```

设置定时任务自动运行即可
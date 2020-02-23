---
title: JavaScript基础知识点
date: 2019-02-03 12:57:29
tags: [JavaScript]
categories: [后端开发]
---

本篇包含以下内容：

- [处理事件](#%e5%a4%84%e7%90%86%e4%ba%8b%e4%bb%b6)
  - [窗口事件](#%e7%aa%97%e5%8f%a3%e4%ba%8b%e4%bb%b6)
    - [onload](#onload)
    - [onunload](#onunload)
    - [onbeforeunload](#onbeforeunload)
    - [onresize](#onresize)
    - [onmove](#onmove)
    - [onabort](#onabort)
    - [onerror](#onerror)
    - [onscroll](#onscroll)
  - [鼠标事件](#%e9%bc%a0%e6%a0%87%e4%ba%8b%e4%bb%b6)
    - [onmousedown](#onmousedown)
- [表单与正则表达式](#%e8%a1%a8%e5%8d%95%e4%b8%8e%e6%ad%a3%e5%88%99%e8%a1%a8%e8%be%be%e5%bc%8f)

<!-- more -->

# 处理事件

## 窗口事件

### onload

当用户进入页面，并且所有元素都加载完成后，就会触发这个事件，如广告弹窗，多用于在加载页面时要进行多个操作。

> `window.onload`调用时只会生效一次，所以要执行多次则需要编写函数进行处理，实现在触发 onload 时执行希望运行的函数名称。

案例 HTML：

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="demo1.js"></script>
  </head>
  <body>
    <div id="page">
      <h1>DEMO1</h1>
    </div>
  </body>
</html>
```

js 脚本：

```javascript
addOnload(func1);
addOnload(func2);

function addOnload(newfunc) {
    # 存储已设置的window.onload
    var oldOnload = window.onload;

    #若已设置了window.onload，则应该是一个函数
    if(typeof oldOnload == 'function') {
        window.onload = function () {
            # 执行先前指定的函数，并执行新传入的函数
            oldOnload();
            newfunc();
        }
    }else {
        # 若OldOnload不是函数，则加载新传入的函数
        window.onload = newfunc;
    }
}

# 自定义要调用的函数
function func1() {
    document.getElementById('page').style.backgroundColor = '#00f';
}
function func2() {
    document.getElementById('page').style.color = '#f00';
}
```

在打开网页时，便会加载指定函数。

{% asset_img 1.png %}

### onunload

当用户离开网页时，就会触发 onunload 事件，如退出一些网站时，就会不断跳出新的网站。

### onbeforeunload

在用户开始离开页面之前触发。不同于 onunload 的在用户离开之后触发。onbeforeunload 常常用于确保用户在填写表单时不会因为点错直接丢失表单，而是询问是否退出。

```
<body>
<script>
    window.onbeforeunload = function () {
        return "是否要退出，可能会遗失已填的表单数据?"
    }
</script>
<form action="#">
    <p>
        <label>Username: </label>
        <input type="text">
    </p>
    <p>
        <label>Password: </label>
        <input type="text">
    </p>
    <p><input type="submit"></p>
</form>
</body>
</html>
```

在用户要离开本页面时或做跳转时，会触发提示。

{% asset_img 2.png %}

### onresize

当调整窗口大小时，会触发。

### onmove

当窗口移动时，会触发。

### onabort

当用户取消网页上的图像加载时，会触发。有的浏览器不支持，基本不用。

### onerror

当页面出现 JavaScript 错误时，会触发，最好不设置。

### onscroll

当页面上下滚动时，会触发。

## 鼠标事件

### onmousedown

# 表单与正则表达式

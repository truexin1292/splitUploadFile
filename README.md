# fileUploadDemo
Node + H5 实现大文件分片上传、断点续传、文件压缩

### 1.opn:  https://www.kancloud.cn/csnikey/fepro-guide/594582
```
npm install opn
```
- opn模块通常是作为跨平台的打开文件或者网站的模块，
在web应用中最常见的使用是比如项目开发或者启动的时候打开浏览器进行访问。
---
优点:
- 长期维护
- 支持应用参数
- 因为它使用spawn而不是更安全exec
- 修复了大部分未node-open解决的问题
- 包含Linux 的最新xdg-open脚本
---

```js
const opn = require('opn');

// Opens the image in the default image viewer
opn('unicorn.png').then(() => {
	// image viewer closed
});

// Opens the url in the default browser
opn('http://sindresorhus.com');

// Specify the app to open in
opn('http://sindresorhus.com', {app: 'firefox'});

// Specify app arguments
opn('http://sindresorhus.com', {app: ['google chrome', '--incognito']});
```

### 2.formidable: https://www.jianshu.com/p/fa358da69c18
```bazaar
Node.js模块，用于解析表单数据，特别是文件上传。

特性
快速(~500mb/秒)，非缓冲多部分解析器
自动写入文件上传到磁盘
低内存占用
优雅的错误处理
非常高的测试覆盖率
```

### 压缩率
1.2m => 110k

27.7m => 900k



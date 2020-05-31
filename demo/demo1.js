let formidable = require('formidable');
let http = require('http');
let util = require('util');
let os = require("os");
let osStr = os.platform();
let uri = "http://localhost:8080";
let opn = require("opn");

http.createServer(function (req, res) {
  if (req.url === '/upload' && req.method.toLowerCase() === 'post') {
    // parse a file upload
    let form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.write('received upload:\n\n');
      res.end(util.inspect({ fields: fields, files: files }));
    });
    return;
  }

  // show a file upload form
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(
    '<form action="/upload" enctype="multipart/form-data" method="post">' +
    '<input type="text" name="title"><br>' +
    '<input type="file" name="upload" multiple="multiple"><br>' +
    '<input type="submit" value="Upload">' +
    '</form>'
  );
}).listen(
  8080,
  () => {
    // windows平台必须设置app,可以设置相关的app启动参数，特殊说明，chrome的指定字符串，
    // win: chrome; mac: google chrome; linux: google-chrome
    if (osStr.indexOf("win") > -1) {
      opn(uri, {
        // app: [ 'chrome' ], // win
        // app: [ 'google-chrome' ], // linux
        app: [ 'google chrome' ], // mac
      });
    } else {
      opn(uri);
    }
  }
);

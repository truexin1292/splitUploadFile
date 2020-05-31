let express = require('express');
let formidable = require('formidable');
let fs = require('fs-extra');
let path = require('path');
let concat = require('concat-files');
let opn = require('opn');
let multer = require('multer');//接收图片
let webp = require('webp-converter');

let app = express();
let uploadDir = 'nodeServer/uploads';
let uploadDir2 = 'public/uploads/';

// 处理静态资源
app.use(express.static(path.join(__dirname)));

// 处理跨域
app.all('*', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type,Content-Length, Authorization, Accept,X-Requested-With'
  );
  res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
  res.header('X-Powered-By', ' 3.2.1');
  if (req.method === 'OPTIONS') { // 让options请求快速返回
    res.send(200);
  } else {
    next();
  }
});

app.get('/', function (req, resp) {
  let query = req.query;
  resp.send('success!');
});

// 检查文件的MD5
app.get('/check/file', (req, resp) => {
  let query = req.query;
  let fileName = query.fileName;
  let fileMd5Value = query.fileMd5Value;
  // 获取文件Chunk列表
  getChunkList(
    path.join(uploadDir, fileName),
    path.join(uploadDir, fileMd5Value),
    data => {
      resp.send(data);
    }
  )
});

// 检查chunk的MD5
app.get('/check/chunk', (req, resp) => {
  let query = req.query;
  let chunkIndex = query.index;
  let md5 = query.md5;

  fs.stat(path.join(uploadDir, md5, chunkIndex), (err, stats) => {
    if (stats) {
      resp.send({
        stat: 1,
        exit: true,
        desc: 'Exit 1'
      })
    } else {
      resp.send({
        stat: 1,
        exit: false,
        desc: 'Exit 0'
      })
    }
  })
});

app.all('/merge', (req, resp) => {
  let query = req.query;
  let md5 = query.md5;
  let size = query.size;
  let fileName = query.fileName;
  console.log(md5, fileName);
  mergeFiles(path.join(uploadDir, md5), uploadDir, fileName, size);
  resp.send({
    stat: 1
  })
});

app.all('/upload', (req, resp) => {
  var form = new formidable.IncomingForm({
    uploadDir: 'nodeServer/tmp'
  });
  form.parse(req, function (err, fields, file) {
    let index = fields.index;
    let total = fields.total;
    let fileMd5Value = fields.fileMd5Value;
    let folder = path.resolve(__dirname, 'nodeServer/uploads', fileMd5Value);
    folderIsExit(folder).then(val => {
      let destFile = path.resolve(folder, fields.index);
      console.log('----------->', file.data.path, destFile);
      copyFile(file.data.path, destFile).then(
        successLog => {
          resp.send({
            stat: 1,
            desc: index
          })
        },
        errorLog => {
          resp.send({
            stat: 0,
            desc: 'Error'
          })
        }
      )
    })
  });

  // 文件夹是否存在, 不存在则创建文件
  function folderIsExit(folder) {
    console.log('folderIsExit', folder);
    return new Promise(async (resolve, reject) => {
      let result = await fs.ensureDirSync(path.join(folder));
      console.log('result----', result);
      resolve(true);
    })
  }

  // 把文件从一个目录拷贝到别一个目录
  function copyFile(src, dest) {
    return new Promise((resolve, reject) => {
      fs.rename(src, dest, err => {
        if (err) {
          reject(err)
        } else {
          resolve('copy file:' + dest + ' success!')
        }
      })
    });
  }
});

// 获取文件Chunk列表
async function getChunkList(filePath, folderPath, callback) {
  let isFileExit = await isExist(filePath);
  let result = {};
  // 如果文件(文件名, 如:node-v7.7.4.pkg)已在存在, 不用再继续上传, 真接秒传
  if (isFileExit) {
    result = {
      stat: 1,
      file: {
        isExist: true,
        name: filePath
      },
      desc: 'file is exist'
    }
  } else {
    let isFolderExist = await isExist(folderPath);
    console.log(folderPath);
    // 如果文件夹(md5值后的文件)存在, 就获取已经上传的块
    let fileList = [];
    if (isFolderExist) {
      fileList = await listDir(folderPath);
    }
    result = {
      stat: 1,
      chunkList: fileList,
      desc: 'folder list'
    }
  }
  callback(result);
}

// 文件或文件夹是否存在
function isExist(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      // 文件不存在
      if (err && err.code === 'ENOENT') {
        resolve(false);
      } else {
        resolve(true);
      }
    })
  })
}

// 列出文件夹下所有文件
function listDir(path) {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      // 把mac系统下的临时文件去掉
      if (data && data.length > 0 && data[0] === '.DS_Store') {
        data.splice(0, 1);
      }
      resolve(data);
    })
  })
}

// 合并文件
async function mergeFiles(srcDir, targetDir, newFileName, size) {
  console.log(...arguments);
  let targetStream = fs.createWriteStream(path.join(targetDir, newFileName));
  let fileArr = await listDir(srcDir);
  fileArr.sort((x, y) => {
    return x - y;
  });
  // 把文件名加上文件夹的前缀
  for (let i = 0; i < fileArr.length; i++) {
    fileArr[i] = srcDir + '/' + fileArr[i];
  }
  console.log(fileArr);
  concat(fileArr, path.join(targetDir, newFileName), () => {
    console.log('Merge Success!');
  })
}

// -------------------------------------- multer ------------------------
var upload = multer({ // 定义图片上传的临时目录
  dest: "public/uploads"
});

// 单域多文件上传：input[file]的 multiple=="multiple"
app.post('/upload/more',
  upload.array('imageFile', 5),
  function (req, res, next) {
    // req.files 是 前端表单name=="imageFile" 的多个文件信息（数组）,限制数量5，应该打印看一下
    for (var i = 0; i < req.files.length; i++) {
      // 图片会放在uploads目录并且没有后缀，需要自己转存，用到fs模块
      // 对临时文件转存，fs.rename(oldPath, newPath,callback);
      fs.rename(req.files[i].path, uploadDir2 + req.files[i].originalname, function (err) {
        if (err) {
          throw err;
        }
        console.log('done!');
      })
    }

    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*"//允许跨域。。。
    });
    // req.body 将具有文本域数据, 如果存在的话
    res.end(JSON.stringify(req.files) + JSON.stringify(req.body));
  }
);

// 单域单文件上传：input[file]的 multiple != "multiple"
app.post('/upload/single',
  upload.single('imageFile'),
  function (req, res, next) { // req.file 是 前端表单name=="imageFile" 的文件信息（不是数组）
    console.log(req.file)
    var imgType = req.file.mimetype; // 图片类型
    var originUrl = uploadDir2 + req.file.originalname; // 上传原图片的地址
    var webpUrl = uploadDir2 + req.file.originalname.split(".")[0] + ".webp";
    fs.rename(
      req.file.path,
      originUrl,
      function (err) {
        if (err) {
          throw err;
        }
        console.log('上传成功!');
      }
    );

    if (imgType === "image/png" || imgType === "image/jpeg") {
      // 压缩转换为webp格式图片 webp.cwebp前两个参数，第一个为原文件地址，第二个为生成的目标文件
      webp.cwebp(
        originUrl,
        webpUrl,
        "-q 80",
        function (status, error) {
          console.log(status, error);
          //第一种方式
          let downloadImg = webpUrl;
          res.download(downloadImg); //直接调用download方法即可

          //第二种方式
          // let downloadImg = webpUrl;
          // let load = fs.createReadStream(__dirname + '/' + road); //创建输入流入口
          // res.writeHead(200, {
          //   'Content-Type': 'application/force-download',
          //   'Content-Disposition': 'attachment; filename=name'
          // });
          // load.pipe(res);// 通过管道方式写入
        }
      );
      // 压缩图片为webp格式后删除原文件
      setTimeout(() => { // 等待0.5s后删除原文件，也可以使用await
        fs.unlink(originUrl, function (error) {
          if (error) {
            console.log(error);
            return false;
          }
          console.log('删除文件成功');
        })
      }, 500);
    }

    // res.send({
    //   stat: 1,
    //   desc: 'Success'
    // })
  }
);

var cpUpload = upload.fields([ { name: 'avatar', maxCount: 1 }, { name: 'gallery', maxCount: 8 } ]);
app.post('/cool-profile', cpUpload, function (req, res, next) {
  // req.files 是一个对象 (String -> Array) 键是文件名, 值是文件数组
  //
  //  req.files['avatar'][0] -> File
  //  req.files['gallery'] -> Array
  //
  // req.body 将具有文本域数据, 如果存在的话
});

app.listen(5000, () => {
  console.log('服务启动完成，端口监听5000！');
  opn('http://localhost:5000');
});

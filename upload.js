const express = require('express');
const formidable = require('formidable');
const fs = require('fs-extra');
const path = require('path');
const concat = require('concat-files');
const opn = require('opn');
const multer = require('multer');//接收图片
const webp = require('webp-converter');
const bodyParser = require('body-parser');

const app = express();
const uploadDir = 'nodeServer/uploads';
const uploadDir2 = 'public/uploads/';

// 处理静态资源
app.use(express.static(path.join(__dirname)));
// app.use(bodyParser.json());

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

app.get('/', (req, resp) => {
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
  let form = new formidable.IncomingForm({
    uploadDir: 'nodeServer/tmp'
  });
  form.parse(req, (err, fields, file) => {
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
let multerUpload = multer({ // 定义图片上传的临时目录
  dest: "public/uploads"
});

// 多文件上传：input[file]的 multiple=="multiple"
app.post(
  '/upload/more',
  multerUpload.array('imageFile', 5),
  (req, res, next) => { // req.files 是 前端表单name=="imageFile" 的多个文件信息（数组），限制数量5
    const files = req.files || [];
    console.log('more-files', files);
    files.forEach(v => {
      renameFile(v);
    })
    res.send({
      code: 200,
      data: files,
      decs: 'success'
    })
  }
);

app.post(
  '/upload/single',
  multerUpload.single('imageFile'),
  async (req, res, next) => { // req.file 是 前端表单name=="imageFile" 的文件信息（不是数组）
    console.log('single-file', req.file);
    let imgType = req.file.mimetype; // 图片类型
    let originUrl = uploadDir2 + req.file.originalname; // 上传原图片的地址
    let webpUrl = uploadDir2 + req.file.originalname.split(".")[0] + ".webp";
    renameFile(req.file);
    if (imgType === "image/png" || imgType === "image/jpeg") {
      // 压缩转换为webp格式图片 webp.cwebp前两个参数，第一个为原文件地址，第二个为生成的目标文件
      await webp.cwebp(
        originUrl,
        webpUrl,
        "-q 80",
        (status, err) => {
          console.log(status, err);
          if (err) {
            console.log('cwebp转化出错：', err);
            return;
          }
          // 压缩图片为webp格式后删除原文件
          fs.unlink(
            originUrl, err => {
              if (err) {
                throw err;
              } else {
                console.log('删除文件成功');
              }
            }
          );

          // 第一种方式：下载
          // res.download(webpUrl); //直接调用download方法即可

          // 第二种方式：下载
          // let load = fs.createReadStream(__dirname + '/' + webpUrl); //创建输入流入口
          // res.writeHead(200, {
          //   'Content-Type': 'application/force-download',
          //   'Content-Disposition': 'attachment; filename=name'
          // });
          // load.pipe(res);// 通过管道方式写入

          // 第三种方式：返回数据
          res.send({
            code: 200,
            data: {
              ...req.file,
              webpUrl: webpUrl
            },
            decs: 'success'
          })
        }
      );
    }
  }
);

app.post(
  '/files',
  multerUpload.fields(
    [
      { name: 'avatar', maxCount: 1 },
      { name: 'gallery', maxCount: 8 }
    ]
  ),
  (req, res, next) => {
    // console.log('files', req.files,req.files.avatar,req.files.gallery);
    //  req.files 是一个对象 (String -> Array) 键是文件名, 值是文件数组
    //  req.files['avatar'][0] -> File
    //  req.files['gallery'] -> Array
    //  req.body 将具有文本域数据, 如果存在的话
    const avatar = req.files.avatar || [];
    const gallery = req.files.gallery || [];
    avatar.forEach(v => {
      renameFile(v);
    });
    gallery.forEach(v => {
      renameFile(v);
    });
    res.send({
      code: 200,
      data: req.files,
      decs: 'success'
    })
  }
);

function renameFile(file) {
  // 图片会放在uploads目录并且没有后缀，需转存，用到fs模块，对临时文件转存，fs.rename(oldPath, newPath,callback);
  fs.rename(
    file.path,
    uploadDir2 + file.originalname,
    err => {
      if (err) {
        throw err;
      } else {
        console.log(`文件${ file.originalname }上传且重命名成功！`);
      }
    }
  )
}

app.listen(5000, () => {
  console.log('服务启动完成，端口监听5000！');
  opn('http://localhost:5000');
});


// app.get("/form", function (req, res) { res.send(fs.readFileSync("./form.html", "utf8")) });
// 读取文件流并写入到public/test.png
// fs.writeFileSync('public/test.png', fs.readFileSync(files.upload.path));
//重定向到结果页
// res.redirect('/public/result.html');

const crypto = require('crypto'), 
      path   = require('path'), 
      fs     = require('fs'), 
      https  = require('https'), 
      mkdirp = require('mkdirp'), 
      unzip  = require('unzip'), 
      _      = require('lodash'), 
      async  = require('async');


const LOGGING_ENABLED = true;
const DIR_PREFIX = './downloads';

mkdirp(DIR_PREFIX);

function log(...args) {
  if (!LOGGING_ENABLED) return
  console.log(...args)
}

module.exports.generateManifestID = function generateManifestID(manifest) {
  const idString = `${manifest.version}|${manifest.mobileWorldContentPaths.en}`
    
  const id = crypto
    .createHash('md5')
    .update(idString)
    .digest('hex')
        
  return id
}

module.exports.changeExt = function changeExt(input, newExt) {
  return path.parse(input).name + '.' + newExt
}

function downloadToFile(destPath, url) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    const req = https.get(url, resp => {
      resp.pipe(file)

      file.on('finish', () =>
        file.close(() => {
          resolve(destPath)
        })
      )
    })

    req.on('error', err => {
      fs.unlink(destPath)
      reject(err)
    })
  })
}

module.exports.downloadToFile = function cacheableDownloadToFile(dest, url) {
  const destPath = path.join(DIR_PREFIX, dest)

  return new Promise((resolve, reject) => {
    fs.access(destPath, err => {
      if (err) {
        downloadToFile(destPath, url)
          .then(resolve)
          .catch(reject)
      } else {
        log(destPath, 'already exists, finishing early')
        resolve(destPath)
      }
    })
  })
}

function unzipFile(dest, orig) {
  return new Promise((resolve, reject) => {
    const extractor = unzip.Extract({ path: dest })

    extractor.on('close', () => {
      resolve(orig)
    });
    extractor.on('error', reject)

    fs.createReadStream(orig).pipe(extractor)
  })
}

module.exports.unzipFile = function cacheableUnzipFile(dest, orig) {
  const destPath = path.join(DIR_PREFIX, dest)
  const outputFile = path.join(
    DIR_PREFIX,
    module.exports.changeExt(orig, 'content')
  );

  return unzipFile(destPath, orig).then(() => outputFile)
}

module.exports.mapPromiseAll = function mapPromiseAll(items, func) {
  const promises = _.map(items, func)
  return Promise.all(promises)
}

module.exports.alsoResolveWith = function alsoResolveWith(
  promise,
  ...extraArgs
) {
  return promise.then(result => {
    return [result, ...extraArgs]
  })
}

function resolveCb(resolve, reject) {
  return (err, result) => {
    if (err) {
      console.log(err)
      reject(err)
    } else {
      resolve(result)
    }
  }
}

module.exports.resolveCb = resolveCb;

module.exports.mapLimitPromise = function mapLimitPromise(items, limit, func) {
  return new Promise((resolve, reject) => {
    async.mapLimit(
      items,
      limit,
      (item, cb) => {
        func(item)
          .then(result => cb(null, result))
          .catch(cb)
      },
      resolveCb(resolve, reject)
    )
  })
}

function mkdirpPromised(dir) {
  return new Promise((resolve, reject) => {
    mkdirp(dir, resolveCb(resolve, reject))
  })
}

function ensureDir(dest) {
  const fileDir = path.parse(dest).dir
  return mkdirpPromised(fileDir)
}

module.exports.writeFile = function writeFile(dest, contents) {
  return new Promise((resolve, reject) => {
    ensureDir(dest)
      .then(() => {
        const fileContents = _.isString(contents)
          ? contents
          : JSON.stringify(contents, null, 2);
        fs.writeFile(dest, fileContents, resolveCb(resolve, reject))
      })
      .catch(reject)
  })
}
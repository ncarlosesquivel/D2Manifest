const pathLib = require('path');
const { resolveCb, writeFile } = require('./service');
const _ = require('lodash');
const async = require('async');

const manifestStore = [];

const PATH_PREFIX = process.env.PATH_PREFIX;

if (!global.HACKY_THIS_ID) {
  global.HACKY_THIS_ID = 'temp123';
}

function pathsFromArray(path) {
  const finalPath = PATH_PREFIX ? [PATH_PREFIX, ...path] : path

  const filePath = pathLib.join('data', ...finalPath)
  const locKey = finalPath.join('/')

  return {
    filePath,
    locKey
  }
}

function saveFileWorker(task, cb) {
  const { path, obj, raw } = task

  const { filePath, locKey } = pathsFromArray(
    path
  )

  const fileBody = raw ? obj : JSON.stringify(obj)

  manifestStore.push({ path, filePath, locKey, obj })

  const id = path.join('.')
  console.log(id, 'uploading to', locKey)

  const contentType = locKey.includes('.html')
    ? 'text/html'
    : 'application/json';

  const promises = [
    // uploadToSpace(locKey, fileBody, { ContentType: contentType }),
    // uploadToSpace(versionedlocKey, fileBody, { ContentType: contentType }),
    writeFile(filePath, fileBody)
  ]

  return Promise.all(promises)
    .then(() => {
      console.log(id, 'successfully saved')
      cb()
    })
    .catch(err => {
      console.error(err)
    })
}

const fileUploadQueue = async.queue(saveFileWorker, 15);

module.exports.saveFile = function saveFileQueuer(path, obj, extra = {}) {
  return new Promise((resolve, reject) => {
    fileUploadQueue.push({ path, obj, ...extra }, resolveCb(resolve, reject))
  })
}

module.exports.collectManifest = function collectManifest() {
  const manifest = manifestStore.reduce((acc, file) => {
    const [...path] = file.path
    const fileName = path[path.length - 1].split('.')[0]
    path[path.length - 1] = fileName

    const objectPath = path.join('.')
    const url = `https://localhost/${file.locKey}` // change URI
    _.set(acc, objectPath, url)

    return acc
  }, {})

  return manifest;
}

module.exports.saveManifest = function saveManifest(extraData = {}) {
  const manifest = Object.assign(extraData, module.exports.collectManifest())

  const { filePath } = pathsFromArray(
    ['index.json']
  )

  const fileBody = JSON.stringify(manifest, null, 2)

  writeFile(filePath, fileBody)
}

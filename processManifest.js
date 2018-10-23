const axios = require('axios');

const {
  downloadToFile, 
  changeExt, 
  unzipFile, 
  mapPromiseAll, 
  alsoResolveWith, 
  generateManifestID, 
  mapLimitPromise
} = require('./service');

const processDatabase = require('./dumpData');
const fileManager = require('./fileManager');

const { MANIFEST_URL, API_KEY } = require('./config.json');
const LANG_LIMIT = 2;

function getSqlFile(dumpPath, dumpLang) {
  const dumpUrl = `https://www.bungie.net${dumpPath}`

  return downloadToFile(changeExt(dumpPath, 'zip'), dumpUrl, dumpLang).then(
    zipFile => unzipFile('', zipFile)
  );
}

let BUNGIE_MANIFEST;

module.exports = () => {
  const promise = axios.get(MANIFEST_URL, {
    headers: { 'X-API-Key': API_KEY }
  })
  
  return promise.then(resp => {
    let languages = resp.data.Response.mobileWorldContentPaths
    languages = {
      "en": languages["en"]
    }
    
    BUNGIE_MANIFEST = resp.data.Response
    global.HACKY_MANIFEST_ID = generateManifestID(BUNGIE_MANIFEST)
    
    return mapPromiseAll(languages, (dumpPath, dumpLang) => {
      console.log('Downloading language:', dumpLang)
      console.log('Path:', dumpPath)
      
      return alsoResolveWith(getSqlFile(dumpPath, dumpLang), dumpLang)
    })
  })
  .then(results => {
    return mapLimitPromise(results, LANG_LIMIT, ([sqlFile, lang]) => {
      console.log('dumping', lang)
      
      return processDatabase(sqlFile, lang)
    })
  })
  .then(() => {
    console.log('## Saving Manifest')
    
    const id = generateManifestID(BUNGIE_MANIFEST)

    return fileManager.saveManifest({
      id, 
      lastUpdated: new Date(), 
      bungieManifestVersion: BUNGIE_MANIFEST.version
    })
  })
}

const axios                     = require('axios'), 
      fs                        = require('fs'), 
      { generateManifestID }    = require('./service'), 
      processManifest           = require('./processManifest'), 
      { MANIFEST_URL, API_KEY } = require('./config.json');


const CURRENTLY_RUNNING = 'currently running';
const LAST_RUN_FILE = './lastrun.txt';

const statusFile = fs.readFileSync(LAST_RUN_FILE).toString();

console.log('Status file contents:', statusFile);

const [lastRun, lastStatus] = statusFile.split('\n');

console.log('Prev ID:', lastRun);
console.log('lastStatus:', lastStatus);

let didRun = false;
let thisId;

if ((lastStatus || '').includes(CURRENTLY_RUNNING)) {
  console.log("It's currently running, skip!");
} else {
  axios.get(MANIFEST_URL, { headers: { 'X-API-Key': API_KEY }
  })
  .then(resp => {
    thisId = generateManifestID(resp.data.Response)
    console.log('this ID:', thisId)

    if (thisId == lastRun) {
      return Promise.resolve()
    }

    fs.writeFileSync(LAST_RUN_FILE, `${lastRun}\n${CURRENTLY_RUNNING}`)

    console.log('Updating in response to a change in the manifest')
    didRun = true
      
    return processManifest();
  })
  .then(() => {
    if (didRun) {
      console.log('FINISHED.')
      fs.writeFileSync(LAST_RUN_FILE, thisId)
    } else {
      console.log('No change in ID.')
    }

    console.log(`Finished at ${new Date().toISOString()}`)
  })
  .catch(err => {
    console.log('err', err)
    console.log(`Process finished with an error ${err.message}`)
    fs.writeFileSync(LAST_RUN_FILE, lastRun)
  })
}

process.on('unhandledRejection', reason => {
  console.log(reason);
})
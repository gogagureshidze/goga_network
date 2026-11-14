const {spawnSync} = require('node:child_process');
const path = require('node:path');
const {local,findBinary,portOpen} = require('./local-development');
(async()=>{
  if (!await portOpen(33367)) {console.info('Project local MySQL is already stopped.');return;}
  require('./dev-setup').verifyOwnedDatabase();
  const result = spawnSync(findBinary('mysqladmin'),['--no-defaults','--protocol=SOCKET',`--socket=${path.join(local,'mysql.sock')}`,'--user=root','shutdown'],{env:{...process.env,MYSQL_PWD:''},stdio:'ignore'});
  if (result.status !== 0) throw new Error('Local MySQL shutdown failed. No other process was stopped.');
  console.info('Stopped only this project’s local MySQL. Data remains in .local/mysql. Restart with npm run dev:setup.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});

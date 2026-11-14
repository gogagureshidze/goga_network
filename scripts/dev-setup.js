/** Local-only, additive setup. Never reads .env DATABASE_URL or contacts a remote DB. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { root, local, useSupportedNode: ensureSupportedNode, portOpen, findBinary, runNode } = require('./local-development');
const { assertLocalDatabase } = require('../server/development-guard');
const markerFile = path.join(local, 'mysql-owner.json');
const data = path.join(local, 'mysql');
const socket = path.join(local, 'mysql.sock');
const envFile = path.join(root, '.env.local');
function checkedFile(file) {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Unsafe local setup file: ${path.basename(file)} must be a regular file.`);
    return true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function checkedDirectory(directory) {
  try {
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync(directory) !== path.resolve(directory)) throw new Error('Local runtime and data directories must not use symlinks.');
    return true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function readOwnerMarker(projectRoot = root, localDirectory = local) {
  const file = path.join(localDirectory, 'mysql-owner.json');
  if (!checkedDirectory(localDirectory) || !checkedFile(file)) throw new Error('Run npm run dev:setup first. Local database ownership was not established.');
  let marker;
  try { marker = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error('Local database ownership marker is unreadable or invalid.'); }
  if (!marker || marker.root !== projectRoot || marker.port !== 33367 || typeof marker.password !== 'string' || !/^[a-f0-9]{48}$/.test(marker.password)) throw new Error('Local database ownership marker is invalid; no database changes attempted.');
  return marker;
}
function mysql(sql, database) {
  const result = spawnSync(findBinary('mysql'), ['--no-defaults','--protocol=SOCKET',`--socket=${socket}`,'--user=root','--batch','--skip-column-names', ...(database ? [database] : [])], {input:sql,encoding:'utf8',env:{...process.env,MYSQL_PWD:''},maxBuffer:1024*1024});
  if (result.status !== 0) throw new Error('LOCAL_MYSQL_COMMAND_FAILED: inspect .local/mysql.log. No remote connection was attempted.');
  return result.stdout.trim();
}
function verifyOwnedDatabase() {
  readOwnerMarker();
  if (!checkedDirectory(data)) throw new Error('Local MySQL data directory is missing. Run npm run dev:setup first.');
  if (fs.lstatSync(socket).isSymbolicLink()) throw new Error('Local MySQL socket must not be a symlink.');
  const identity = mysql('SELECT @@port, @@datadir;').split('\t');
  if (identity[0] !== '33367' || path.resolve(identity[1] || '') !== data) throw new Error('Local MySQL ownership check failed. No schema writes attempted.');
}
async function main() {
  ensureSupportedNode();
  const mysqld = findBinary('mysqld');
  const ffmpeg = findBinary('ffmpeg'), ffprobe = findBinary('ffprobe');
  const currentText = checkedFile(envFile) ? fs.readFileSync(envFile,'utf8') : '';
  const current = require('node:util').parseEnv(currentText);
  if (current.DATABASE_URL) assertLocalDatabase(current);
  if (!checkedDirectory(local)) fs.mkdirSync(local,{recursive:true,mode:0o700});
  checkedDirectory(local);
  fs.chmodSync(local,0o700);
  const hasData = checkedDirectory(data);
  let marker;
  if (checkedFile(markerFile)) {
    marker = readOwnerMarker();
    fs.chmodSync(markerFile,0o600);
  } else {
    if (hasData || await portOpen(33367)) throw new Error('Unrecognized local database or occupied port 33367. No existing database will be reused or stopped.');
    marker = {root,port:33367,password:randomBytes(24).toString('hex')};
    fs.writeFileSync(markerFile,JSON.stringify(marker),{mode:0o600,flag:'wx'});
  }
  if (!hasData) {
    fs.mkdirSync(data,{mode:0o700});
    const initialized = spawnSync(mysqld,['--no-defaults','--initialize-insecure',`--datadir=${data}`,`--log-error=${path.join(local,'mysql.log')}`],{stdio:'ignore'});
    if (initialized.status !== 0) throw new Error('Local MySQL initialization failed; inspect .local/mysql.log. Existing data was not reset.');
  }
  if (!await portOpen(33367)) {
    const child = spawn(mysqld,['--no-defaults',`--datadir=${data}`,`--socket=${socket}`,`--pid-file=${path.join(local,'mysql.pid')}`,`--log-error=${path.join(local,'mysql.log')}`,'--bind-address=127.0.0.1','--port=33367','--mysqlx=0','--innodb-buffer-pool-size=64M','--max-connections=25'],{detached:true,stdio:'ignore'});
    child.unref();
    let ready = false;
    for (let attempt=0;attempt<80;attempt++) {
      if (await portOpen(33367)) {ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if (!ready) throw new Error('Local MySQL did not become ready; inspect .local/mysql.log.');
  }
  verifyOwnedDatabase();
  const password = marker.password; // Never passed in command arguments or printed.
  mysql(`CREATE DATABASE IF NOT EXISTS goga_development CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS goga_validation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'goga_local'@'localhost' IDENTIFIED BY '${password}';
GRANT ALL PRIVILEGES ON goga_development.* TO 'goga_local'@'localhost';`);
  const databaseUrl = `mysql://goga_local:${password}@127.0.0.1:33367/goga_development?connection_limit=3&pool_timeout=10&connect_timeout=5`;
  const voice = path.join(fs.realpathSync(os.tmpdir()),`goga-local-voice-${process.getuid?.() || 'user'}`);
  const settings = {
    DATABASE_URL:databaseUrl, APP_ORIGIN:'http://localhost:3000', NEXT_PUBLIC_SOCKET_URL:'http://localhost:3001',
    SOCKET_ALLOWED_ORIGINS:'http://localhost:3000', SOCKET_HOST:'127.0.0.1',
    NEXT_PUBLIC_MEDIA_API_URL:'http://localhost:3002', MEDIA_API_PUBLIC_ORIGIN:'http://localhost:3002',
    MEDIA_ALLOWED_ORIGINS:'http://localhost:3000', MEDIA_API_HOST:'127.0.0.1', MEDIA_API_PORT:'3002',
    GOGA_LOCAL_DEVELOPMENT:'true', DEPLOYMENT_ENV:'development', ENABLE_GROUP_CALLS:'false', GROUP_CALL_SECURITY_REVIEWED:'false',
    VOICE_STORAGE_DIR:voice, FFMPEG_PATH:ffmpeg, FFPROBE_PATH:ffprobe,
    WATCH_ALLOWED_HOSTS:current.WATCH_ALLOWED_HOSTS || 'localhost',
  };
  // Preserve unrelated local settings and every byte of the original .env.
  const retained = currentText.split('\n').filter(line=>!Object.keys(settings).some(key=>new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line)));
  // O_NOFOLLOW also closes the gap between the initial check and this write.
  const envHandle = fs.openSync(envFile,fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW,0o600);
  try {
    fs.fchmodSync(envHandle,0o600);
    fs.writeFileSync(envHandle,[...retained,...Object.entries(settings).map(([key,value])=>`${key}=${JSON.stringify(value)}`),''].join('\n'));
  } finally {fs.closeSync(envHandle);}
  const localEnv = {...process.env,...settings,NODE_ENV:'development'};
  assertLocalDatabase(localEnv);
  runNode(require.resolve('prisma/build/index.js'),['generate'],localEnv);
  // CLI output contains only our local schema/host, never the generated password.
  runNode(require.resolve('prisma/build/index.js'),['migrate','deploy'],localEnv);
  runNode(require.resolve('prisma/build/index.js'),['migrate','deploy'],{...localEnv,DATABASE_URL:'mysql://root@127.0.0.1:33367/goga_validation?connection_limit=5&connect_timeout=5'});
  const samples = path.join(root,'public/local-test');
  fs.mkdirSync(samples,{recursive:true});
  const sample = path.join(samples,'watch.mp4');
  if (!fs.existsSync(sample)) {
    const result = spawnSync(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','15','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',sample],{stdio:'ignore'});
    if (result.status !== 0) throw new Error('Local watch sample generation failed. Database setup succeeded.');
  }
  console.info('Isolated MySQL is ready on 127.0.0.1:33367 (goga_development and goga_validation).');
  console.info('.env.local now selects only local MySQL; original .env was not modified.');
  console.info('Start npm run dev, npm run dev:socket and npm run dev:media in separate terminals. Open http://localhost:3000.');
  console.info('Watch sample: http://localhost:3000/local-test/watch.mp4 (generated test pattern).');
}
if (require.main === module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports = { checkedFile, checkedDirectory, readOwnerMarker, verifyOwnedDatabase };

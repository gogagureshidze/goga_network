const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const net = require('node:net');
const root = path.resolve(__dirname, '..');
const local = path.join(root, '.local');
function supportedNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  return major === 24 || (major === 22 && minor >= 13);
}
function useSupportedNode() {
  if (supportedNode()) return;
  const candidate = '/opt/homebrew/opt/node@24/bin/node';
  if (fs.existsSync(candidate) && !process.env.GOGA_NODE_REEXEC) {
    const result = spawnSync(candidate, process.argv.slice(1), {stdio:'inherit',env:{...process.env,GOGA_NODE_REEXEC:'1',PATH:`${path.dirname(candidate)}:${process.env.PATH}`}});
    process.exit(result.status ?? 1);
  }
  throw new Error('Node 24 LTS (or Node 22 >=22.13) is required. Select it before running local commands.');
}
function loadDevelopmentEnv() {
  process.env.NODE_ENV = 'development';
  const {loadEnvConfig} = require('@next/env');
  // Next and Socket.IO must resolve the same precedence, including exported variables.
  loadEnvConfig(root, true, {info(){},error(){}});
  require('../server/development-guard').assertLocalDatabase(process.env);
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')) {
    throw new Error('CLERK_DEVELOPMENT_KEYS_REQUIRED: configure development keys securely in .env.local. Live Clerk credentials are not accepted by local launchers.');
  }
  process.env.GOGA_LOCAL_DEVELOPMENT = 'true';
  process.env.DEPLOYMENT_ENV = 'development';
  return process.env;
}
function portOpen(port) {
  // Next binds localhost, which can resolve to IPv6; socket/MySQL use IPv4.
  const hosts = port === 3000 ? ['127.0.0.1','::1'] : ['127.0.0.1'];
  return Promise.all(hosts.map(host => new Promise(resolve => {
    const socket = net.connect({host,port});
    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(750,()=>done(false));socket.once('connect',()=>done(true));socket.once('error',()=>done(false));
  }))).then(results => results.some(Boolean));
}
function findBinary(name) {
  const candidates = [process.env[`GOGA_${name.toUpperCase()}_PATH`], `/opt/homebrew/opt/mysql@8.4/bin/${name}`, `/usr/sbin/${name}`, `/usr/bin/${name}`, ...(process.env.PATH || '').split(path.delimiter).map(dir=>path.join(dir,name))].filter(Boolean);
  const found = candidates.find(candidate => {try {fs.accessSync(candidate,fs.constants.X_OK);return true;}catch{return false;}});
  if (!found) throw new Error(`${name} is unavailable. Install a supported local MySQL 8.4 package; this command never installs server software.`);
  return found;
}
function runNode(script, args = [], env = process.env) {
  const result = spawnSync(process.execPath,[script,...args],{cwd:root,env,stdio:'inherit'});
  if (result.status !== 0) throw new Error('Local command failed; inspect the preceding diagnostic.');
}
module.exports = {root,local,useSupportedNode,loadDevelopmentEnv,portOpen,findBinary,runNode};

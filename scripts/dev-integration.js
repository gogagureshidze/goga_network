const {spawnSync} = require('node:child_process');
const {root,useSupportedNode:ensureSupportedNode,portOpen} = require('./local-development');
(async()=>{
  ensureSupportedNode();
  if (!await portOpen(33367)) throw new Error('Run npm run dev:setup first. Integration tests use only the disposable goga_validation database.');
  // A loopback listener alone does not prove that this project owns its data.
  // Confirm the private marker and Unix-socket server identity before any tests.
  require('./dev-setup').verifyOwnedDatabase();
  const env = {...process.env,GOGA_TEST_DATABASE_URL:'mysql://root@127.0.0.1:33367/goga_validation?connection_limit=5&connect_timeout=5'};
  // Run serially: suites exercise concurrency internally against the same disposable DB.
  for (const suite of ['tests/mysql.integration.cjs','tests/runtime.integration.cjs','tests/fixtures.integration.cjs','tests/media-api.integration.cjs']) {
    const result = spawnSync(process.execPath,['--test',suite],{cwd:root,env,stdio:'inherit'});
    if (result.status !== 0) {process.exitCode=result.status || 1;return;}
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});

const test = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');

for (const script of ['scripts/dev-fixtures.js','scripts/dev-status.js']) {
  test(`${script} rejects a remote database before any connection and never prints credentials`, () => {
    const result = spawnSync(process.execPath,[script],{
      env:{...process.env,DATABASE_URL:'mysql://private_user:private_password@198.51.100.99:3306/production'},
      encoding:'utf8',timeout:5000,
    });
    assert.equal(result.error,undefined);
    assert.equal(result.status,1);
    assert.match(result.stderr,/Local (fixture setup|status) failed/);
    assert.doesNotMatch(result.stdout+result.stderr,/private_user|private_password|198\.51\.100\.99|mysql:\/\//);
  });
}

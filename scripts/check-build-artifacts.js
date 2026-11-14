// Inspect filenames only; never read or print environment/key contents.
const fs = require('node:fs/promises');
const path = require('node:path');
const root = process.cwd();
async function inspect(directory) {
  let checked = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) checked += await inspect(target);
    else if (entry.name.endsWith('.nft.json')) {
      const trace = JSON.parse(await fs.readFile(target, 'utf8'));
      for (const file of trace.files || []) {
        const resolved = path.resolve(path.dirname(target), file);
        const relative = path.relative(root, resolved);
        if (/^\.env(?:\.|$)/.test(relative) || relative.startsWith(`.git${path.sep}`) || relative.startsWith(`.local${path.sep}`) || relative.startsWith(`public${path.sep}local-test${path.sep}`) || /^[^/\\]+\.(?:pem|key)$/.test(relative)) {
          throw new Error(`Private file appears in a deployment trace: ${relative}`);
        }
      }
      checked++;
    }
  }
  return checked;
}
inspect(path.join(root, '.next')).then(count => {
  if (!count) throw new Error('No build traces found; run the production build first');
  console.log(`Checked ${count} deployment traces: no environment files, keys, Git metadata, local databases or local test media`);
}).catch(error => { console.error(error.message); process.exitCode = 1; });

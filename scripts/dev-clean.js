const fs = require('node:fs/promises');
const path = require('node:path');
const {root,portOpen} = require('./local-development');
(async()=>{
  if (await portOpen(3000)) throw new Error('Stop npm run dev before cleaning its cache. No files removed.');
  // The dedicated Next development directory is disposable; production build stays intact.
  await fs.rm(path.join(root,'.next/dev'),{recursive:true,force:true});
  console.info('Removed only .next/dev. Start npm run dev to rebuild its manifests.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});

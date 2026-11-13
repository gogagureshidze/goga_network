#!/usr/bin/env node
/** Staging-only retention rehearsal. Never loads .env or assumes a database target. */
const { createVoiceStorage } = require('../server/voice-storage');

async function pruneVoiceMedia({ prisma, storage, apply = false, now = new Date(), log = console.info }) {
  let cursor;
  let candidates = 0, removed = 0, bytes = 0;
  do {
    const assets = await prisma.mediaAsset.findMany({ where: { expiresAt: { lte: now }, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: 100 });
    if (!assets.length) break;
    for (const asset of assets) {
      candidates++; bytes += asset.bytes;
      if (apply) {
        await prisma.$transaction(async tx => {
          // Protect an asset concurrently attached to a sent message and extended to 90 days.
          const locked = await tx.$queryRaw`SELECT id FROM MediaAsset WHERE id = ${asset.id} AND expiresAt <= ${now} FOR UPDATE`;
          if (!locked.length) return;
          await storage.destroy(asset.publicId);
          await tx.message.updateMany({ where: { mediaAssetId: asset.id, text: null }, data: { text: 'Voice message expired' } });
          await tx.message.updateMany({ where: { mediaAssetId: asset.id }, data: { mediaUrl: null, mediaType: null, durationMs: null, waveform: [] } });
          await tx.mediaAsset.delete({ where: { id: asset.id } });
          removed++;
        });
      }
    }
    cursor = assets[assets.length - 1].id;
  } while (true);
  // A process can crash after durable file publication and before inserting metadata.
  // Only unreferenced files older than 48 hours qualify, so active uploads are preserved.
  const orphanCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  let orphanCandidates = 0;
  for (const file of await storage.listStored()) {
    if (file.modifiedAt >= orphanCutoff) continue;
    const asset = await prisma.mediaAsset.findUnique({ where: { publicId: file.publicId }, select: { id: true } });
    if (asset) continue;
    orphanCandidates++; bytes += file.bytes;
    if (apply) { await storage.destroy(file.publicId); removed++; }
  }
  const summary = { event: 'voice.retention', dryRun: !apply, candidates, orphanCandidates, removed, candidateBytes: bytes };
  log(JSON.stringify(summary));
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('Only --apply is supported; dry run is the default');
  if (!['staging', 'test', 'development'].includes(process.env.DEPLOYMENT_ENV)) throw new Error('Set DEPLOYMENT_ENV=staging and use a verified staging DATABASE_URL. Production retention requires a separately reviewed operational job.');
  if (!process.env.DATABASE_URL) throw new Error('A verified non-production DATABASE_URL is required');
  const { PrismaClient } = require('../src/generated/prisma');
  const prisma = new PrismaClient();
  try { await pruneVoiceMedia({ prisma, storage: createVoiceStorage(), apply: args.includes('--apply') }); }
  finally { await prisma.$disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { pruneVoiceMedia };

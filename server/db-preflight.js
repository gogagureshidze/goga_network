/** Read-only schema contract for the communications service. Never applies migrations. */
const REQUIRED_SCHEMA = Object.freeze({
  User: ['id', 'username', 'avatar', 'isPrivate', 'showActivityStatus'],
  Block: ['id', 'blockerId', 'blockedId'],
  Follower: ['id', 'followerId', 'followingId'],
  Post: ['id', 'desc', 'createdAt', 'updatedAt', 'userId'],
  Conversation: ['id', 'createdAt', 'updatedAt', 'user1Id', 'user2Id', 'kind', 'name', 'ownerId'],
  Message: ['id', 'text', 'createdAt', 'senderId', 'receiverId', 'conversationId', 'isRead', 'mediaUrl', 'mediaType', 'clientMessageId', 'editedAt', 'deletedAt', 'replyToId', 'durationMs', 'waveform', 'mediaAssetId'],
  ConversationMember: ['conversationId', 'userId', 'role', 'status', 'joinedAt', 'lastReadMessageId'],
  MessageReaction: ['messageId', 'userId', 'emoji'],
  MediaAsset: ['id', 'ownerId', 'conversationId', 'publicId', 'format', 'bytes', 'durationMs', 'waveform', 'createdAt', 'expiresAt'],
  CallSession: ['id', 'conversationId', 'initiatorId', 'kind', 'status', 'roomName', 'mediaVersion', 'screenVersion', 'screenLeaseId', 'screenRoomName', 'screenUserId', 'screenDeviceId', 'screenExpiresAt', 'createdAt', 'startedAt', 'endedAt', 'expiresAt'],
  RetiredMediaRoom: ['roomName', 'callId', 'createdAt', 'retainUntil', 'retryAt', 'attempts', 'lastErrorCode'],
  CallParticipant: ['callId', 'userId', 'status', 'joinedAt', 'leftAt', 'deviceId'],
  WatchParty: ['id', 'conversationId', 'hostId', 'sourceUrl', 'title', 'collaborative', 'playing', 'position', 'version', 'updatedAt', 'createdAt', 'endedAt'],
});
const NULLABLE_COLUMNS = new Set(['Conversation.user1Id', 'Conversation.user2Id', 'Message.receiverId']);

class DatabasePreflightError extends Error {
  constructor(code, checks = []) {
    super(code === 'DB_CLIENT_OUTDATED' ? 'Generate the Prisma client before starting the service'
      : code === 'DB_PREFLIGHT_TIMEOUT' ? 'Database preflight timed out'
      : 'Communications schema is not ready; review the migration status for the configured database');
    this.name = 'DatabasePreflightError';
    this.code = code;
    this.checks = checks;
  }
}

async function preflightDatabase(prisma, { timeoutMs = 10_000 } = {}) {
  const missingDelegates = Object.keys(REQUIRED_SCHEMA).filter(model => typeof prisma[model[0].toLowerCase() + model.slice(1)]?.findMany !== 'function');
  if (missingDelegates.length) throw new DatabasePreflightError('DB_CLIENT_OUTDATED', missingDelegates);
  let timer;
  let columns;
  try {
    // The query returns schema metadata only, never account IDs, message contents,
    // database names, credentials, or migration mutations.
    columns = await Promise.race([
      prisma.$queryRaw`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, IS_NULLABLE AS isNullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new DatabasePreflightError('DB_PREFLIGHT_TIMEOUT')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
  if (!Array.isArray(columns)) throw new DatabasePreflightError('DB_SCHEMA_NOT_READY');
  const existing = new Map();
  for (const column of columns) {
    if (!Object.hasOwn(REQUIRED_SCHEMA, column.tableName)) continue;
    if (!existing.has(column.tableName)) existing.set(column.tableName, new Map());
    existing.get(column.tableName).set(column.columnName, column.isNullable);
  }
  const checks = [];
  for (const [table, required] of Object.entries(REQUIRED_SCHEMA)) {
    if (!existing.has(table)) { checks.push(table); continue; }
    for (const column of required) {
      const key = `${table}.${column}`;
      if (!existing.get(table).has(column) || (NULLABLE_COLUMNS.has(key) && existing.get(table).get(column) !== 'YES')) checks.push(key);
    }
  }
  if (checks.length) throw new DatabasePreflightError('DB_SCHEMA_NOT_READY', checks);
  return { tablesChecked: Object.keys(REQUIRED_SCHEMA).length, columnsChecked: Object.values(REQUIRED_SCHEMA).reduce((count, fields) => count + fields.length, 0) };
}
module.exports = { REQUIRED_SCHEMA, NULLABLE_COLUMNS, DatabasePreflightError, preflightDatabase };

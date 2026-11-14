/** Allowlisted diagnostics: never log exception messages, SQL, URLs, tokens or payloads. */
const { randomUUID } = require('node:crypto');
const { REQUIRED_SCHEMA } = require('./db-preflight');
const MODELS = new Set(Object.keys(REQUIRED_SCHEMA));
const COLUMNS = new Set(Object.values(REQUIRED_SCHEMA).flat());
const CHECKS = new Set([...MODELS, ...Object.entries(REQUIRED_SCHEMA).flatMap(([table, columns]) => columns.map(column => `${table}.${column}`))]);
const NAMES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError', 'PrismaClientInitializationError', 'PrismaClientValidationError', 'DatabasePreflightError', 'ChatError', 'MediaError', 'TokenVerificationError']);
const CODES = new Set(['DB_CLIENT_OUTDATED', 'DB_SCHEMA_NOT_READY', 'DB_PREFLIGHT_TIMEOUT', 'SERVER_CONFIGURATION_INVALID', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EADDRINUSE', 'EACCES', 'EPERM', 'ENOSPC', 'ENOENT', 'FORBIDDEN', 'UNAUTHENTICATED', 'UNAUTHORIZED', 'RATE_LIMITED', 'UNAVAILABLE', 'INVALID_INPUT', 'CONFLICT', 'NOT_FOUND']);
const FILES = new Set(['socket-server.js', 'server/socket-app.js', 'server/chat-service.js', 'server/rooms.js', 'server/db-preflight.js', 'server/diagnostics.js', 'server/call-credentials.js', 'server/media-policy.js', 'server/voice-storage.js', 'server/request-limits.js', 'node_modules/@prisma/client/runtime/library.js', 'src/generated/prisma/runtime/library.js']);

function identifier(value, allowed) {
  if (typeof value !== 'string') return undefined;
  const suffix = value.split('.').pop().replace(/[`"']/g, '');
  return allowed.has(suffix) ? suffix : undefined;
}
function safeStackFrames(stack) {
  if (typeof stack !== 'string') return [];
  const frames = [];
  for (const line of stack.split('\n').slice(1, 30)) {
    if (!/^\s*at /.test(line)) continue;
    const match = /([^\s()]+):(\d+):(\d+)\)?$/.exec(line);
    if (!match) continue;
    const normalized = match[1].replace(/\\/g, '/');
    const file = [...FILES].find(candidate => normalized === candidate || normalized.endsWith(`/${candidate}`));
    if (file) frames.push({ file, line: Number(match[2]), column: Number(match[3]) });
    if (frames.length === 6) break;
  }
  return frames;
}
function safeErrorDetails(error) {
  const value = error && typeof error === 'object' ? error : {};
  const rawCode = value.code || value.errorCode;
  const code = typeof rawCode === 'string' && (/^P\d{4}$/.test(rawCode) || CODES.has(rawCode)) ? rawCode : undefined;
  const model = identifier(value.meta?.modelName, MODELS);
  const table = identifier(value.meta?.table, MODELS);
  const column = identifier(value.meta?.column, COLUMNS);
  const checks = Array.isArray(value.checks) ? value.checks.filter(check => CHECKS.has(check)).slice(0, 100) : [];
  return { name: NAMES.has(value.name) ? value.name : 'Error', ...(code ? { code } : {}), ...(model ? { model } : {}), ...(table ? { table } : {}), ...(column ? { column } : {}), ...(checks.length ? { checks } : {}), frames: safeStackFrames(value.stack) };
}
function diagnosticCode(error) {
  const code = error?.code || error?.errorCode;
  if (['DB_SCHEMA_NOT_READY', 'P2021', 'P2022'].includes(code)) return 'DB_SCHEMA_NOT_READY';
  if (code === 'DB_CLIENT_OUTDATED' || error?.name === 'PrismaClientValidationError') return 'DB_CLIENT_OUTDATED';
  if (['P1000', 'P1010'].includes(code)) return 'DB_ACCESS_DENIED';
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'DB_PREFLIGHT_TIMEOUT', 'ECONNREFUSED', 'ETIMEDOUT'].includes(code)) return 'DB_UNAVAILABLE';
  if (code === 'SERVER_CONFIGURATION_INVALID') return 'SERVER_CONFIGURATION_INVALID';
  if (code === 'EADDRINUSE') return 'LISTENER_ADDRESS_IN_USE';
  if (['EACCES', 'EPERM'].includes(code)) return 'PROCESS_PERMISSION_DENIED';
  return 'SERVER_OPERATION_FAILED';
}
function reportException(logger, event, error, context = {}) {
  const reference = { diagnosticId: randomUUID(), diagnosticCode: diagnosticCode(error) };
  const safeContext = {};
  for (const key of ['socketEvent', 'phase']) if (typeof context[key] === 'string' && /^[a-zA-Z_:.-]{1,64}$/.test(context[key])) safeContext[key] = context[key];
  logger.error?.(JSON.stringify({ timestamp: new Date().toISOString(), event, ...safeContext, ...reference, error: safeErrorDetails(error) }));
  return reference;
}
function clientDiagnostic(reference) {
  return { code: 'UNAVAILABLE', message: `The service is temporarily unavailable. Reference: ${reference.diagnosticCode}.`, ...reference };
}
module.exports = { safeErrorDetails, safeStackFrames, diagnosticCode, reportException, clientDiagnostic };

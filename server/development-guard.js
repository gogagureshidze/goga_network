/** Local commands must never fall through to the production DATABASE_URL in .env. */
function assertLocalDatabase(env, {allowValidation = false} = {}) {
  let url;
  try { url = new URL(env.DATABASE_URL || ''); } catch { throw new Error('LOCAL_DATABASE_REQUIRED: run npm run dev:setup; no database connection attempted.'); }
  const databases = allowValidation ? ['/goga_development', '/goga_validation'] : ['/goga_development'];
  if (url.protocol !== 'mysql:' || url.hostname !== '127.0.0.1' || url.port !== '33367' || !databases.includes(url.pathname) ||
      [...url.searchParams.keys()].some(key => !['connection_limit','pool_timeout','connect_timeout'].includes(key))) {
    throw new Error('UNSAFE_DEVELOPMENT_DATABASE: local development requires 127.0.0.1:33367/goga_development. Run npm run dev:setup. The configured database was not contacted.');
  }
  return url;
}
module.exports = { assertLocalDatabase };

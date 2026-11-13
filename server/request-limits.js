/** Small single-process HTTP/action limits. Deploy one Next process until a shared limiter is reviewed. */
const { ChatError } = require('./chat-service');
const stateKey = Symbol.for('goga.http.request-limits');
const state = globalThis[stateKey] || (globalThis[stateKey] = { buckets: new Map(), lastSweep: 0, voiceInFlight: 0 });
const policies = { message: [60, 60_000], share: [30, 60_000], voice: [6, 60_000], mediaRead: [600, 60_000], history: [120, 60_000] };
function consumeRequestLimit(userId, category, cost = 1, now = Date.now()) {
  if (typeof userId !== 'string' || !userId || userId.length > 191) throw new ChatError('UNAUTHENTICATED', 'Sign in required', 401);
  if (!policies[category] || !Number.isSafeInteger(cost) || cost < 1) throw new ChatError('INVALID_INPUT', 'Invalid request');
  const [limit, window] = policies[category];
  if (now - state.lastSweep >= 30_000) {
    for (const [key, bucket] of state.buckets) if (bucket.until <= now) state.buckets.delete(key);
    state.lastSweep = now;
  }
  const key = JSON.stringify([category, userId]);
  let bucket = state.buckets.get(key);
  if (!bucket || bucket.until <= now) {
    if (!bucket && state.buckets.size >= 10000) throw new ChatError('UNAVAILABLE', 'Try again shortly', 503);
    bucket = { count: 0, until: now + window }; state.buckets.set(key, bucket);
  }
  if (bucket.count + cost > limit) {
    const error = new ChatError('RATE_LIMITED', 'Too many requests. Please try again shortly.', 429);
    error.retryAfterMs = bucket.until - now;
    throw error;
  }
  bucket.count += cost;
}
function beginVoiceRequest(userId) {
  consumeRequestLimit(userId, 'voice');
  if (state.voiceInFlight >= 2) throw new ChatError('RATE_LIMITED', 'Voice upload is busy. Please retry shortly.', 429);
  state.voiceInFlight++;
  let finished = false;
  return () => { if (!finished) { finished = true; state.voiceInFlight--; } };
}
module.exports = { consumeRequestLimit, beginVoiceRequest };

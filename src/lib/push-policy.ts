const DEFAULT_PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];

export function validatePushSubscription(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Invalid push subscription");
  const value = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof value.endpoint !== "string" || value.endpoint.length > 2048) throw new Error("Invalid push endpoint");
  const url = new URL(value.endpoint);
  const configured = (process.env.PUSH_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  const hosts = new Set([...DEFAULT_PUSH_HOSTS, ...configured]);
  const providerAllowed = hosts.has(url.hostname.toLowerCase()) || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  // Only operator-approved push providers may receive outbound server requests.
  // Never allow arbitrary HTTPS hosts, IP literals, credentials or custom ports.
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.includes(":") || !providerAllowed || (url.pathname === "/" && !url.search)) throw new Error("Unsupported push provider");
  const decode = (key: unknown, length: number) => {
    if (typeof key !== "string" || key.length > 100 || !/^[A-Za-z0-9_-]+={0,2}$/.test(key)) throw new Error("Invalid push key");
    const bytes = Buffer.from(key, "base64url");
    if (bytes.length !== length) throw new Error("Invalid push key");
    return { key, bytes };
  };
  const publicKey = decode(value.keys?.p256dh, 65);
  if (publicKey.bytes[0] !== 4) throw new Error("Invalid push public key");
  const auth = decode(value.keys?.auth, 16);
  return { endpoint: url.href, keys: { p256dh: publicKey.key, auth: auth.key } };
}

const testRequests = new Map<string, number>();
export function allowPushTest(userId: string, now = Date.now()) {
  if ((testRequests.get(userId) || 0) > now - 30000) return false;
  if (testRequests.size >= 5000) for (const [id, at] of testRequests) if (at < now - 30000) testRequests.delete(id);
  if (testRequests.size >= 5000) return false;
  testRequests.set(userId, now);
  return true;
}

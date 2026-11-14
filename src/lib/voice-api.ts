// Public origin only. Clerk session tokens are obtained when needed and never
// placed in URLs, persistent storage, or requests to an unvalidated destination.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEDIA_PATH = /^\/api\/chat\/media\/([0-9a-f-]+)$/i;
export const MAX_VOICE_BYTES = 4 * 1024 * 1024;
export type GetVoiceToken = () => Promise<string | null>;
export type VoiceAttachment = { mediaAssetId: string; mediaUrl: string; mediaType: "voice"; durationMs: number; waveform?: number[]; conversationId?: number };

export function mediaApiOrigin(configured = process.env.NEXT_PUBLIC_MEDIA_API_URL, production = process.env.NODE_ENV === "production") {
  if (!configured) throw new Error("Voice messages are unavailable because the media service is not configured.");
  let url: URL;
  try { url = new URL(configured); } catch { throw new Error("The voice media service address is invalid."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && local && !production))) {
    throw new Error("The voice media service requires a secure origin.");
  }
  return url.origin;
}

export function privateVoicePath(src: string, mediaAssetId?: string | null) {
  const id = mediaAssetId ?? MEDIA_PATH.exec(src)?.[1];
  if (!id || !UUID.test(id)) throw new Error("This voice message has an invalid media reference.");
  return `/api/chat/media/${id}`;
}

function abortIfNeeded(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Voice request cancelled.", "AbortError");
}

async function authorizedRequest(path: string, getToken: GetVoiceToken, signal: AbortSignal, body?: FormData) {
  const origin = mediaApiOrigin();
  abortIfNeeded(signal);
  const token = await getToken();
  abortIfNeeded(signal);
  if (!token) throw new Error("Sign in again to use voice messages.");
  return fetch(`${origin}${path}`, {
    method: body ? "POST" : "GET", body, signal,
    headers: { Authorization: `Bearer ${token}` },
    credentials: "omit", mode: "cors", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer",
  });
}

async function boundedResponse(response: Response, limit: number, signal: AbortSignal) {
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    await response.body?.cancel();
    throw new Error("The voice service returned an oversized response.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The voice service returned an empty response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      abortIfNeeded(signal);
      const { value, done } = await reader.read();
      abortIfNeeded(signal);
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("The voice service returned an oversized response.");
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function responseError(status: number) {
  if (status === 401) return new Error("Your session expired. Sign in again to use voice messages.");
  if (status === 403 || status === 404) return new Error("This voice message is unavailable or you no longer have access.");
  if (status === 413) return new Error("This recording is too large. Record a shorter voice message.");
  if (status === 429) return new Error("The voice service is busy. Please retry shortly.");
  return new Error("The voice service could not complete the request. Please retry.");
}

export async function uploadPrivateVoice(form: FormData, getToken: GetVoiceToken, signal: AbortSignal): Promise<VoiceAttachment> {
  const response = await authorizedRequest("/api/chat/voice", getToken, signal, form);
  if (!response.ok) { await response.body?.cancel(); throw responseError(response.status); }
  let result: VoiceAttachment;
  try { result = JSON.parse(new TextDecoder().decode(await boundedResponse(response, 16384, signal))); }
  catch (error) { if (error instanceof Error && error.name === "AbortError") throw error; throw new Error("The voice service returned an invalid upload response."); }
  if (!result || typeof result.mediaAssetId !== "string" || !UUID.test(result.mediaAssetId) || result.mediaType !== "voice" || result.mediaUrl !== `/api/chat/media/${result.mediaAssetId}` || !Number.isFinite(result.durationMs) || result.durationMs < 100 || result.durationMs > 120000 || (result.waveform !== undefined && (!Array.isArray(result.waveform) || result.waveform.length > 64 || !result.waveform.every(value => Number.isFinite(value) && value >= 0 && value <= 1))) || (result.conversationId !== undefined && (!Number.isSafeInteger(result.conversationId) || result.conversationId < 1))) {
    throw new Error("The voice service returned an invalid upload response.");
  }
  return { mediaAssetId: result.mediaAssetId, mediaUrl: result.mediaUrl, mediaType: "voice", durationMs: result.durationMs, waveform: result.waveform, conversationId: result.conversationId };
}

export async function fetchPrivateVoice(src: string, mediaAssetId: string | null | undefined, getToken: GetVoiceToken, signal: AbortSignal) {
  const response = await authorizedRequest(privateVoicePath(src, mediaAssetId), getToken, signal);
  if (!response.ok) { await response.body?.cancel(); throw responseError(response.status); }
  if (response.status !== 200 || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "audio/mp4") {
    await response.body?.cancel();
    throw new Error("The voice service returned an unsupported audio response.");
  }
  const bytes = await boundedResponse(response, MAX_VOICE_BYTES, signal);
  if (bytes.length < 12) throw new Error("This voice recording is empty or damaged.");
  return new Blob([bytes], { type: "audio/mp4" });
}

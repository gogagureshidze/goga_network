import { auth } from '@clerk/nextjs/server';
import { Readable } from 'node:stream';
import { mediaService, mediaStorage } from '@/lib/media-server';
import { apiError } from '@/lib/http-security';
import { consumeRequestLimit } from '../../../../../../server/request-limits';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    consumeRequestLimit(userId, 'mediaRead');
    const asset = await mediaService.authorizeAsset(userId, (await params).id);
    const file = await mediaStorage().open(asset.publicId, request.headers.get('range'));
    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': 'audio/mp4',
      'Content-Disposition': 'inline',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(file.end - file.start + 1),
    });
    if (file.partial) headers.set('Content-Range', `bytes ${file.start}-${file.end}/${file.size}`);
    const abort = () => file.stream.destroy();
    request.signal.addEventListener('abort', abort, { once: true });
    file.stream.once('close', () => request.signal.removeEventListener('abort', abort));
    if (request.signal.aborted) abort();
    return new Response(Readable.toWeb(file.stream) as ReadableStream<Uint8Array>, { status: file.partial ? 206 : 200, headers });
  } catch (error) {
    const failure = error as { status?: number; size?: number };
    if (failure.status === 416) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${failure.size ?? '*'}`, 'Cache-Control': 'private, no-store' } });
    return apiError(error);
  }
}

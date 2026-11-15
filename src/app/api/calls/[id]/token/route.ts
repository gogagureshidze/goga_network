import { auth } from '@clerk/nextjs/server';
import { callCredentials } from '@/lib/call-server';
import { apiError, boundedBody, requireSameOrigin } from '@/lib/http-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    requireSameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'INVALID_CONTENT_TYPE' }, { status: 415 });
    const input = JSON.parse((await boundedBody(request, 1024)).toString('utf8'));
    if (!input || typeof input !== 'object' || Array.isArray(input)) return Response.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const { id } = await context.params;
    const result = await callCredentials().issueToken(userId, id, input.deviceId, {
      media: input.media ?? 'main', leaseId: input.leaseId,
    });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

import { auth } from '@clerk/nextjs/server';
import { callCredentials } from '@/lib/call-server';
import { apiError } from '@/lib/http-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { id } = await context.params;
    const deviceId = new URL(request.url).searchParams.get('deviceId');
    const result = await callCredentials().issueIce(userId, id, deviceId);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

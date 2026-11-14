// Clients resolve existing private media references against NEXT_PUBLIC_MEDIA_API_URL.
// Do not redirect bearer tokens or fall back to an ephemeral filesystem.
export const runtime = 'nodejs';
export async function GET() {
  return Response.json({ error: 'MEDIA_API_REQUIRED' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
export async function HEAD() {
  return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}

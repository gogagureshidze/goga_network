// Voice processing lives on the authenticated VPS API, never Netlify's filesystem.
export const runtime = 'nodejs';
export async function POST() {
  return Response.json({ error: 'MEDIA_API_REQUIRED' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}

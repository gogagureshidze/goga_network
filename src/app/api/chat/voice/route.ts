import { auth } from '@clerk/nextjs/server';
import { mediaService } from '@/lib/media-server';
import { apiError, boundedBody, requireSameOrigin } from '@/lib/http-security';
import { beginVoiceRequest } from '../../../../../server/request-limits';
import { MAX_VOICE_BYTES } from '../../../../../server/media-policy';
export const runtime = 'nodejs';
export async function POST(request:Request) {
  let release: (() => void) | undefined;
  try {
    const {userId}=await auth();
    if(!userId) return Response.json({error:'UNAUTHORIZED'},{status:401});
    requireSameOrigin(request);
    release = beginVoiceRequest(userId);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) return Response.json({error:'INVALID_CONTENT_TYPE'},{status:415});
    const body = await boundedBody(request,MAX_VOICE_BYTES+32768);
    const form = await new Response(body,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
    const audio=form.get('audio');
    if(!(audio instanceof File)) return Response.json({error:'INVALID_AUDIO'},{status:400});
    const result=await mediaService.uploadVoice(userId,{bytes:Buffer.from(await audio.arrayBuffer()),mime:audio.type,durationMs:Number(form.get('durationMs')),conversationId:form.get('conversationId')||undefined,receiverId:form.get('receiverId')||undefined,waveform:JSON.parse(String(form.get('waveform')||'[]'))});
    return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error){return apiError(error);}
  finally {release?.();}
}

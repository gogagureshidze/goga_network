import 'server-only';
export function requireSameOrigin(request:Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== expected) throw Object.assign(new Error('INVALID_ORIGIN'),{code:'INVALID_ORIGIN',status:403});
}
export function apiError(error:unknown) {
  const value = error as {code?:string;status?:number;message?:string;retryAfterMs?:number};
  const known = typeof value.status === 'number' && [400,401,403,404,408,409,413,415,416,429,503,507].includes(value.status);
  const status = known ? value.status! : 500;
  const code = known && typeof value.code === 'string' && /^[A-Z_]{1,64}$/.test(value.code) ? value.code : 'REQUEST_FAILED';
  const headers = new Headers({'Cache-Control':'private, no-store'});
  if (status === 429 && value.retryAfterMs) headers.set('Retry-After', String(Math.ceil(value.retryAfterMs / 1000)));
  return Response.json({error:code},{status,headers});
}
export async function boundedBody(request:Request,max:number) {
  if (Number(request.headers.get('content-length')) > max) throw Object.assign(new Error('TOO_LARGE'),{code:'TOO_LARGE',status:413});
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error('EMPTY_BODY'),{code:'EMPTY_BODY',status:400});
  const chunks:Uint8Array[]=[];let size=0;let timedOut=false;
  const timeout = setTimeout(() => {timedOut=true;void reader.cancel().catch(() => {});},20000);
  try {
    while(true){const part=await reader.read();if(part.done) break;size+=part.value.length;if(size>max){await reader.cancel();throw Object.assign(new Error('TOO_LARGE'),{code:'TOO_LARGE',status:413});}chunks.push(part.value);}
    if (timedOut) throw Object.assign(new Error('REQUEST_TIMEOUT'),{code:'REQUEST_TIMEOUT',status:408});
    return Buffer.concat(chunks);
  } finally {clearTimeout(timeout);reader.releaseLock();}
}

'use client';
import {useEffect,useState} from 'react';
import type {Socket} from 'socket.io-client';
import {LiveKitRoom,VideoConference,ConnectionState,MediaDeviceSelect} from '@livekit/components-react';
import '@livekit/components-styles';
import type {Call} from './types';
import PeerCall from './PeerCall';
export default function CallRoom(props:{call:Call;socket:Socket;userId:string;deviceId:string;onLeave:()=>void}) {
  const {call,onLeave}=props;const [credentials,setCredentials]=useState<{token:string;serverUrl:string}|null>(null);const [error,setError]=useState('');const [seconds,setSeconds]=useState(0);const [minimized,setMinimized]=useState(false);
  useEffect(()=>{const t=setInterval(()=>setSeconds(Math.max(0,Math.floor((Date.now()-new Date(call.startedAt||call.createdAt).getTime())/1000))),1000);return()=>clearInterval(t);},[call.createdAt,call.startedAt]);
  useEffect(()=>{
    if(call.transport!=='livekit')return;
    const controller=new AbortController();let alive=true;let timedOut=false;
    const timeout=setTimeout(()=>{timedOut=true;controller.abort();},12000);
    setCredentials(null);setError('');
    void fetch(`/api/calls/${call.id}/token`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:props.deviceId}),signal:controller.signal})
      .then(async r=>{if(!r.ok)throw new Error('Group calling is unavailable or your membership changed.');return r.json();})
      .then(value=>{if(alive)setCredentials(value);})
      .catch(e=>{if(alive&&(timedOut||e.name!=='AbortError'))setError(timedOut?'Group connection timed out. Hang up and retry.':e.message);})
      .finally(()=>clearTimeout(timeout));
    return()=>{alive=false;clearTimeout(timeout);controller.abort();};
  },[call.id,call.transport,props.deviceId]);
  return <section aria-label="Active call" className={`fixed bottom-3 right-3 z-[80] overflow-hidden rounded-2xl bg-gray-950 text-white shadow-2xl ${minimized?'w-72':'w-[min(94vw,720px)]'}`}><header className="flex items-center justify-between gap-2 p-3"><span>{call.kind==='VIDEO'?'Video':'Voice'} call · {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</span><button onClick={()=>setMinimized(v=>!v)}>{minimized?'Expand':'Minimize'}</button><button onClick={onLeave} className="rounded-lg bg-red-700 px-3 py-2">Hang up</button></header>
    <div style={{display:minimized?'none':undefined}}>{error&&<p role="alert" className="p-4 text-red-300">{error}</p>}
      {call.transport==='p2p'?<PeerCall {...props}/>:credentials?<LiveKitRoom token={credentials.token} serverUrl={credentials.serverUrl} connect audio video={call.kind==='VIDEO'} onDisconnected={onLeave} onError={e=>setError(e.message)} onMediaDeviceFailure={()=>setError('Camera or microphone permission was denied, or the device was disconnected. Check browser permissions and try again.')} data-lk-theme="default" style={{height:440}}><ConnectionState/><MediaDeviceSelect kind="audioinput"/><VideoConference/></LiveKitRoom>:<p className="p-4">Connecting to the configured group media server…</p>}
    </div></section>;
}

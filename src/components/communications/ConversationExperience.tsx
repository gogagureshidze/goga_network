'use client';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@clerk/nextjs';
import {emitWithAck,useRealtimeSocket} from '@/hooks/useRealtimeSocket';
import {useCommunications} from './CommunicationsProvider';
import type {Call,Party} from './types';
import WatchPartyPanel from './WatchPartyPanel';
export default function ConversationExperience({conversationId,receiverId}:{conversationId?:number;receiverId?:string}) {
  const {userId}=useAuth();const {socket,isConnected}=useRealtimeSocket();const comms=useCommunications();const [party,setParty]=useState<Party|null>(null);const [error,setError]=useState('');const [showForm,setShowForm]=useState(false);const [source,setSource]=useState('');const [authorized,setAuthorized]=useState(false);const [busy,setBusy]=useState(false);
  const activeConversation=useRef(conversationId);activeConversation.current=conversationId;
  useEffect(()=>{setParty(null);setError('');if(!socket||!conversationId||!isConnected)return;let valid=true;
    const ended=new Set<string>();
    const update=({party:next}:{party:Party})=>{if(!valid||next?.conversationId!==conversationId)return;if(next.endedAt)ended.add(next.id);setParty(p=>next.endedAt?(p?.id===next.id?null:p):ended.has(next.id)?p:!p||p.id!==next.id||next.version>=p.version?next:p);};
    socket.on('watchUpdated',update);
    void emitWithAck<{call:Call|null;party:Party|null}>(socket,'session:sync',{conversationId}).then(r=>{if(valid&&r.party)update({party:r.party});}).catch(e=>{if(valid)setError(e.message);});
    return()=>{valid=false;socket.off('watchUpdated',update);};
  },[socket,conversationId,isConnected]);
  useEffect(()=>{
    if(!socket||!isConnected||!party?.id||party.conversationId!==conversationId)return;
    const partyId=party.id;let alive=true;
    void emitWithAck<{party:Party}>(socket,'watch:join',{partyId}).then(({party:joined})=>{if(alive)setParty(current=>current?.id===joined.id&&joined.version>=current.version?joined:current);}).catch(reason=>{if(alive)setError(reason.message);});
    return()=>{alive=false;if(socket.connected)socket.emit('watch:leave',{partyId});};
  },[socket,isConnected,conversationId,party?.id,party?.conversationId]);
  const start=async(kind:'AUDIO'|'VIDEO')=>{setError('');setBusy(true);try{await comms?.startCall({conversationId,receiverId:conversationId?undefined:receiverId,kind});}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  return <div className="border-b border-orange-100 bg-white/70 p-2 dark:border-gray-700 dark:bg-gray-900"><div className="flex flex-wrap gap-2 text-sm"><button disabled={!isConnected||busy} onClick={()=>void start('AUDIO')} className="rounded-lg bg-orange-100 px-3 py-2 text-orange-950 disabled:opacity-50">Voice call</button><button disabled={!isConnected||busy} onClick={()=>void start('VIDEO')} className="rounded-lg bg-orange-100 px-3 py-2 text-orange-950 disabled:opacity-50">Video call</button><button disabled={!isConnected||!conversationId} onClick={()=>setShowForm(v=>!v)} className="rounded-lg bg-rose-100 px-3 py-2 text-rose-950 disabled:opacity-50">Watch together</button></div>
    {error&&<p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
    {showForm&&!party&&<form className="mt-3 space-y-2" onSubmit={e=>{e.preventDefault();if(!socket||!conversationId)return;setBusy(true);void emitWithAck<{party:Party}>(socket,'watch:create',{conversationId,sourceUrl:source,authorized,title:'Watch together'}).then(r=>{if(activeConversation.current===r.party.conversationId){setParty(r.party);setShowForm(false);setError('');}}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}><label className="block text-sm">Authorized video URL<input type="url" required value={source} onChange={e=>setSource(e.target.value)} placeholder="https://approved-host.example/video.mp4" className="mt-1 w-full rounded border p-2 dark:bg-gray-800"/></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)}/>I have permission to share this video with these participants.</label><p className="text-xs text-gray-500">Direct MP4, WebM or Ogg files on approved hosts. Each participant streams from that host. Subscription players and DRM content are not supported.</p><button disabled={!authorized||busy} className="rounded-lg bg-orange-600 px-3 py-2 text-white disabled:opacity-50">Create watch party</button></form>}
    {party&&party.conversationId===conversationId&&socket&&userId&&<WatchPartyPanel key={party.id} party={party} socket={socket} userId={userId} onUpdate={setParty}/>}
  </div>;
}

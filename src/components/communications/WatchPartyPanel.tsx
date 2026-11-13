'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { emitWithAck } from '@/hooks/useRealtimeSocket';
import { createMediaEventGuard, createPlaybackCommandQueue, projectPlayback } from '@/lib/watch-playback';
import type { Party } from './types';

type ChatMessage = { id: number; senderId: string; text: string | null };
export default function WatchPartyPanel({ party, socket, userId, onUpdate }: { party: Party; socket: Socket; userId: string; onUpdate: (party: Party | null) => void }) {
  const player = useRef<HTMLVideoElement>(null);
  const current = useRef(party);
  if (party.id !== current.current.id || party.version >= current.current.version) current.current = party;
  const update = useRef(onUpdate); update.current = onUpdate;
  const guard = useRef(createMediaEventGuard());
  const clock = useRef({ server: party.serverTime, local: Date.now() });
  const pending = useRef(0);
  const commands = useRef<ReturnType<typeof createPlaybackCommandQueue<Party>> | null>(null);
  const [error, setError] = useState('');
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [theater, setTheater] = useState(false);
  const [draft, setDraft] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const canControl = party.hostId === userId || party.collaborative;

  const apply = useCallback(() => {
    const video = player.current;
    if (!video || video.readyState < 1 || pending.current) return;
    const serverNow = clock.current.server + Date.now() - clock.current.local;
    const target = projectPlayback(current.current, serverNow, video.duration);
    const drift = target.position - video.currentTime;
    if (Math.abs(drift) > 1.2) {
      guard.current.expect('seeked');
      try { video.currentTime = target.position; } catch { guard.current.cancel('seeked'); }
    }
    video.playbackRate = target.playing && Math.abs(drift) > 0.15 ? (drift > 0 ? 1.03 : 0.97) : 1;
    if (target.playing && video.paused && !video.ended) {
      guard.current.expect('play');
      void video.play().then(() => setAutoplayBlocked(false)).catch(() => {
        guard.current.cancel('play'); setAutoplayBlocked(true);
      });
    }
    if (!target.playing && !video.paused) { guard.current.expect('pause'); video.pause(); }
  }, []);

  useEffect(() => {
    const queue = createPlaybackCommandQueue<Party>({
      current: () => current.current,
      send: async (version, action, extra) => (await emitWithAck<{ party: Party }>(socket, action === 'end' ? 'watch:end' : 'watch:control', { partyId: party.id, version, action, ...extra })).party,
      accept: snapshot => {
        current.current = snapshot;
        clock.current = { server: snapshot.serverTime, local: Date.now() };
        update.current(snapshot.endedAt ? null : snapshot);
      },
      recover: async () => (await emitWithAck<{ party: Party }>(socket, 'watch:join', { partyId: party.id })).party,
    });
    commands.current = queue;
    guard.current.clear(); pending.current = 0;
    return () => { queue.cancel(); commands.current = null; };
  }, [party.id, socket]);

  useEffect(() => {
    if (party.version < current.current.version) return;
    clock.current = { server: party.serverTime, local: Date.now() };
    apply();
  }, [party, apply]);
  useEffect(() => { const timer = setInterval(apply, 2000); return () => clearInterval(timer); }, [apply]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setTheater(false); };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, []);
  useEffect(() => {
    let alive = true;
    setChat([]);
    const merge = (messages: ChatMessage[], existing: ChatMessage[]) => [...new Map([...messages, ...existing].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id).slice(-30);
    void emitWithAck<{ messages: ChatMessage[] }>(socket, 'getMessages', { conversationId: party.conversationId, limit: 20 })
      .then(result => { if (alive) setChat(existing => merge(result.messages, existing)); }).catch(() => {});
    const receive = (message: ChatMessage & { conversationId: number }) => {
      if (message.conversationId === party.conversationId) setChat(existing => merge([message], existing.filter(item => item.id !== message.id)));
    };
    socket.on('receiveMessage', receive);
    return () => { alive = false; socket.off('receiveMessage', receive); };
  }, [socket, party.conversationId]);

  async function control(action: string, extra: Record<string, unknown> = {}) {
    const queue = commands.current;
    if (!queue) return;
    pending.current += 1;
    try { await queue.enqueue(action, extra); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Playback changed. Synchronize to retry.'); }
    finally { pending.current = Math.max(0, pending.current - 1); apply(); }
  }
  function nativeEvent(event: 'play' | 'pause' | 'seeked', action: 'play' | 'pause' | 'seek') {
    if (guard.current.consume(event)) return;
    if (canControl) void control(action, { position: player.current?.currentTime });
    else apply();
  }
  function resumeLocally() {
    const video = player.current;
    if (!video) return;
    guard.current.expect('play');
    void video.play().then(() => { setAutoplayBlocked(false); apply(); }).catch(() => { guard.current.cancel('play'); setAutoplayBlocked(true); });
  }

  return <section aria-label="Watch party" className={theater ? 'fixed inset-0 z-[70] flex flex-col overflow-auto bg-gray-950 p-4 text-white' : 'mt-3 rounded-xl bg-gray-950 p-3 text-white'}>
    <header className="mb-2 flex flex-wrap items-center gap-3">
      <strong>{party.title}</strong>
      <span className="text-xs text-gray-300">{party.participants?.length || 0} watching · {party.hostId === userId ? 'You are hosting' : party.collaborative ? 'Shared controls' : 'Host controls'}</span>
      <button className="ml-auto text-sm" onClick={() => setTheater(value => !value)}>{theater ? 'Exit theater' : 'Theater mode'}</button>
      {party.hostId === userId && <button className="text-sm text-red-300" onClick={() => void control('end')}>End party</button>}
    </header>
    <div className={theater ? 'grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_280px]' : ''}>
      <div>
        <video ref={player} src={party.sourceUrl} controls playsInline preload="metadata" onLoadedMetadata={apply}
          onPlay={() => nativeEvent('play', 'play')} onPause={() => nativeEvent('pause', 'pause')} onSeeked={() => nativeEvent('seeked', 'seek')}
          onError={() => setError('The source cannot be played. Check access, supported format and provider permissions.')}
          className={`w-full rounded-lg bg-black ${theater ? 'max-h-[75vh]' : 'max-h-72'}`} />
        {autoplayBlocked && <button className="mt-2 rounded bg-orange-700 px-3 py-2 text-sm" onClick={resumeLocally}>Enable playback on this device</button>}
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <button onClick={apply}>Synchronize now</button>
          {party.hostId === userId && <>
            <label><input type="checkbox" checked={party.collaborative} onChange={event => void control('collaborative', { collaborative: event.target.checked })} /> Allow shared playback controls</label>
            <select aria-label="Transfer host" value="" className="bg-gray-800" onChange={event => { if (event.target.value) void control('host', { hostId: event.target.value }); }}>
              <option value="">Transfer host</option>{party.participants?.filter(id => id !== userId).map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </>}
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-amber-300">{error}</p>}
        <p className="mt-2 text-xs text-gray-400">Playback synchronizes an authorized source. Start a voice or video call above to talk while watching.</p>
      </div>
      {theater && <aside className="flex min-h-64 flex-col rounded-xl bg-gray-900 p-3">
        <h3 className="mb-3 font-semibold">Conversation</h3>
        <div className="max-h-80 flex-1 space-y-2 overflow-auto text-sm">{chat.map(message => <p key={message.id} className="rounded bg-gray-800 p-2"><span className="text-xs text-orange-300">{message.senderId === userId ? 'You' : 'Member'} </span>{message.text || 'Media message'}</p>)}</div>
        <form className="mt-3 flex gap-2" onSubmit={event => {
          event.preventDefault(); if (!draft.trim()) return;
          const text = draft; setDraft('');
          void emitWithAck(socket, 'sendMessage', { conversationId: party.conversationId, text, clientMessageId: crypto.randomUUID() }).catch(reason => { setDraft(text); setError(reason.message); });
        }}><input aria-label="Watch party message" maxLength={4000} value={draft} onChange={event => setDraft(event.target.value)} className="min-w-0 flex-1 rounded bg-gray-800 p-2" /><button>Send</button></form>
      </aside>}
    </div>
  </section>;
}

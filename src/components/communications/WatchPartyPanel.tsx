'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { emitWithAck } from '@/hooks/useRealtimeSocket';
import { createMediaEventGuard, createPlaybackCommandQueue, projectPlayback } from '@/lib/watch-playback';
import type { Party } from './types';

type ChatMessage = { id: number; conversationId: number; senderId: string; text: string | null; clientMessageId?: string | null; deletedAt?: string | null };
type PendingMessage = { clientMessageId: string; text: string; delivery: 'sending' | 'failed' };
const mergeChat = (messages: ChatMessage[], existing: ChatMessage[]) => [...new Map([...messages, ...existing].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id).slice(-30);
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
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [unconfirmed, setUnconfirmed] = useState<PendingMessage[]>([]);
  const outgoing = useRef(new Map<string, PendingMessage>());
  const chatSession = useRef(0);
  const historyEvents = useRef<Map<number, ChatMessage> | null>(null);
  const refreshChat = useRef<(() => void) | null>(null);
  const canControl = party.hostId === userId || party.collaborative;

  const receiveMessage = useCallback((message: ChatMessage) => {
    if (message.conversationId !== party.conversationId) return;
    historyEvents.current?.set(message.id, message);
    if (message.senderId === userId && message.clientMessageId && outgoing.current.delete(message.clientMessageId)) {
      setUnconfirmed([...outgoing.current.values()]);
    }
    setChat(existing => mergeChat([message], existing.filter(item => item.id !== message.id)));
  }, [party.conversationId, userId]);

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
    let historyRequest = 0;
    chatSession.current += 1;
    const queued = outgoing.current;
    queued.clear();
    setChat([]);
    setUnconfirmed([]);
    const loadHistory = () => {
      const request = ++historyRequest;
      const live = new Map<number, ChatMessage>();
      historyEvents.current = live;
      setChatLoading(true);
      setChatError('');
      void emitWithAck<{ messages: ChatMessage[] }>(socket, 'getMessages', { conversationId: party.conversationId, limit: 30 })
        .then(result => {
          if (!alive || request !== historyRequest) return;
          // Replace stale displayed history; only events received after this
          // request began can take precedence over its authoritative snapshot.
          const messages = mergeChat(result.messages, [...live.values()]);
          setChat(messages);
          for (const message of messages) if (message.senderId === userId && message.clientMessageId) queued.delete(message.clientMessageId);
          setUnconfirmed([...queued.values()]);
        })
        .catch(() => {
          if (alive && request === historyRequest) setChatError('Conversation history could not be loaded. Messages shown may be out of date.');
        })
        .finally(() => {
          if (!alive || request !== historyRequest) return;
          historyEvents.current = null;
          setChatLoading(false);
        });
    };
    refreshChat.current = loadHistory;
    loadHistory();
    socket.on('receiveMessage', receiveMessage);
    socket.on('messageUpdated', receiveMessage);
    socket.on('connect', loadHistory);
    return () => {
      alive = false;
      chatSession.current += 1;
      queued.clear();
      historyEvents.current = null;
      refreshChat.current = null;
      socket.off('receiveMessage', receiveMessage);
      socket.off('messageUpdated', receiveMessage);
      socket.off('connect', loadHistory);
    };
  }, [socket, party.conversationId, receiveMessage, userId]);

  async function sendMessage(message: Pick<PendingMessage, 'clientMessageId' | 'text'>) {
    if (outgoing.current.get(message.clientMessageId)?.delivery === 'sending') return;
    const session = chatSession.current;
    outgoing.current.set(message.clientMessageId, { ...message, delivery: 'sending' });
    setUnconfirmed([...outgoing.current.values()]);
    try {
      const result = await emitWithAck<{ message: ChatMessage }>(socket, 'sendMessage', { conversationId: party.conversationId, text: message.text, clientMessageId: message.clientMessageId });
      // A socket echo may already confirm this send and include a subsequent edit.
      if (chatSession.current === session && outgoing.current.has(message.clientMessageId)) receiveMessage(result.message);
    } catch {
      if (chatSession.current !== session || !outgoing.current.has(message.clientMessageId)) return;
      outgoing.current.set(message.clientMessageId, { ...message, delivery: 'failed' });
      setUnconfirmed([...outgoing.current.values()]);
    }
  }

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
        {chatLoading && <p role="status" className="mb-2 text-xs text-gray-300">Loading conversation…</p>}
        {chatError && <div role="alert" className="mb-2 text-xs text-amber-300"><p>{chatError}</p><button type="button" className="mt-1 underline" onClick={() => refreshChat.current?.()}>Retry chat history</button></div>}
        <div className="max-h-80 flex-1 space-y-2 overflow-auto text-sm">
          {chat.map(message => <p key={message.id} className="rounded bg-gray-800 p-2"><span className="text-xs text-orange-300">{message.senderId === userId ? 'You' : 'Member'} </span>{message.deletedAt ? 'Deleted message' : message.text || 'Media message'}</p>)}
          {unconfirmed.map(message => <div key={message.clientMessageId} className="rounded bg-gray-800 p-2"><p><span className="text-xs text-orange-300">You </span>{message.text}</p><span className="text-xs text-gray-300">{message.delivery === 'sending' ? 'Sending…' : 'Not confirmed'}</span>{message.delivery === 'failed' && <button type="button" className="ml-2 text-xs text-orange-300 underline" onClick={() => void sendMessage(message)}>Retry message</button>}</div>)}
        </div>
        <form className="mt-3 flex gap-2" onSubmit={event => {
          event.preventDefault(); if (!draft.trim()) return;
          const text = draft; setDraft('');
          void sendMessage({text, clientMessageId:crypto.randomUUID()});
        }}><input aria-label="Watch party message" maxLength={4000} value={draft} onChange={event => setDraft(event.target.value)} className="min-w-0 flex-1 rounded bg-gray-800 p-2" /><button>Send</button></form>
      </aside>}
    </div>
  </section>;
}

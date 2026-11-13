'use client';
import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {useAuth} from '@clerk/nextjs';
import dynamic from 'next/dynamic';
import {emitWithAck, useRealtimeSocket} from '@/hooks/useRealtimeSocket';
import {createCallLifecycle} from '@/lib/call-lifecycle';
import type {Call} from './types';

const CallRoom = dynamic(() => import('./CallRoom'), {ssr: false});
type Comms = {startCall: (input: {conversationId?: number; receiverId?: string; kind: 'AUDIO' | 'VIDEO'}) => Promise<void>};
const Context = createContext<Comms | null>(null);
export const useCommunications = () => useContext(Context);

export default function CommunicationsProvider({children}: {children: ReactNode}) {
  const {userId} = useAuth();
  const {socket, isConnected} = useRealtimeSocket();
  const [call, setCall] = useState<Call | null>(null);
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deviceId] = useState(() => typeof crypto !== 'undefined' ? crypto.randomUUID() : '');
  const active = useRef<Call | null>(null);
  const invitation = useRef<Call | null>(null);
  const pending = useRef<number | null>(null);
  const lifecycle = useRef(createCallLifecycle());
  const showCall = useCallback((next: Call | null) => { active.current = next; setCall(next); }, []);
  const showInvitation = useCallback((next: Call | null) => { invitation.current = next; setIncoming(next); }, []);
  const close = useCallback((id: string) => {
    lifecycle.current.close(id);
    if (active.current?.id === id) showCall(null);
    if (invitation.current?.id === id) showInvitation(null);
  }, [showCall, showInvitation]);

  useEffect(() => {
    const guard = lifecycle.current;
    guard.reset();
    showCall(null);
    showInvitation(null);
    pending.current = null;
    setBusy(false);
    setError('');
    if (!socket || !userId) return;
    let disposed = false;
    let polling = false;
    const update = ({call: next}: {call: Call}) => {
      if (disposed || !guard.accepts(next.id)) return;
      const participant = next.participants.find(p => p.userId === userId);
      if (['ENDED', 'MISSED', 'REJECTED'].includes(next.status)) { close(next.id); return; }
      if (participant?.status === 'JOINED' && participant.deviceId === deviceId) {
        if (active.current && active.current.id !== next.id) return;
        showCall(next);
        if (invitation.current?.id === next.id) showInvitation(null);
      } else if (participant?.status === 'INVITED' && next.status === 'RINGING' && next.initiatorId !== userId) {
        showInvitation(next);
      } else {
        if (invitation.current?.id === next.id) showInvitation(null);
        if (active.current?.id === next.id) close(next.id);
      }
    };
    const reconnect = () => {
      const current = active.current;
      if (!current || polling || disposed) return;
      polling = true;
      const ticket = guard.ticket();
      void emitWithAck<{call: Call}>(socket, 'call:state', {callId: current.id, deviceId})
        .then(result => {
          if (!disposed && active.current?.id === current.id && guard.valid(ticket, current.id)) {
            update(result);
            setError('');
          }
        })
        .catch(() => {
          if (!disposed && active.current?.id === current.id && guard.valid(ticket, current.id)) close(current.id);
        }).finally(() => { polling = false; });
    };
    const revoke = ({callId, conversationId}: {callId?: string; conversationId?: number}) => {
      for (const current of [active.current, invitation.current]) {
        if (current && (current.id === callId || current.conversationId === conversationId)) close(current.id);
      }
    };
    const disconnect = () => { if (active.current) setError('Call signaling disconnected. Reconnecting…'); };
    socket.on('callUpdated', update);
    socket.on('callRevoked', revoke);
    socket.on('conversationRemoved', revoke);
    socket.on('connect', reconnect);
    socket.on('disconnect', disconnect);
    const health = setInterval(() => { if (socket.connected) reconnect(); }, 5000);
    return () => {
      disposed = true;
      guard.reset();
      if (active.current && socket.connected) socket.emit('call:leave', {callId: active.current.id, deviceId});
      active.current = null;
      clearInterval(health);
      socket.off('callUpdated', update);
      socket.off('callRevoked', revoke);
      socket.off('conversationRemoved', revoke);
      socket.off('connect', reconnect);
      socket.off('disconnect', disconnect);
    };
  }, [socket, userId, deviceId, close, showCall, showInvitation]);

  const callId = call?.id;
  useEffect(() => {
    if (isConnected || !callId) return;
    const deadline = setTimeout(() => {
      close(callId);
      setError('Call ended because signaling could not reconnect.');
    }, 20000);
    return () => clearTimeout(deadline);
  }, [isConnected, callId, close]);

  const startCall: Comms['startCall'] = async input => {
    if (!socket || !isConnected) throw new Error('Reconnect to start a call.');
    if (active.current || pending.current !== null) throw new Error('Leave your current call first.');
    const ticket = lifecycle.current.ticket();
    pending.current = ticket;
    try {
      const result = await emitWithAck<{call: Call}>(socket, 'call:start', {...input, deviceId});
      if (lifecycle.current.valid(ticket, result.call.id)) { showCall(result.call); setError(''); }
    } finally { if (pending.current === ticket) pending.current = null; }
  };
  const leave = (id: string) => {
    close(id);
    const ticket = lifecycle.current.ticket();
    if (socket) void emitWithAck(socket, 'call:leave', {callId: id, deviceId})
      .catch(() => { if (lifecycle.current.ticket() === ticket) setError('Unable to confirm hangup. The session will expire automatically.'); });
  };
  const respond = async (accept: boolean) => {
    const next = invitation.current;
    if (!socket || !next || pending.current !== null || (accept && active.current)) return;
    if (!accept) close(next.id);
    const ticket = lifecycle.current.ticket();
    pending.current = ticket;
    setBusy(true);
    try {
      const result = await emitWithAck<{call: Call}>(socket, 'call:respond', {callId: next.id, accept, deviceId});
      if (accept && lifecycle.current.valid(ticket, next.id)) { showInvitation(null); showCall(result.call); }
    } catch (cause) {
      if (lifecycle.current.ticket() === ticket) setError(cause instanceof Error ? cause.message : 'Unable to respond to this call.');
    } finally {
      if (pending.current === ticket) { pending.current = null; setBusy(false); }
    }
  };
  return <Context.Provider value={{startCall}}>{children}
    {error && <div role="alert" className="fixed bottom-4 right-4 z-[100] max-w-sm rounded-xl bg-red-900 p-4 text-white" onClick={() => setError('')}>{error}</div>}
    {incoming && <div role="dialog" aria-label="Incoming call" className="fixed bottom-5 right-5 z-[90] rounded-2xl bg-gray-900 p-5 text-white shadow-2xl">
      <p className="font-bold">Incoming {incoming.kind.toLowerCase()} call</p><p className="my-2 text-sm">A member of your conversation is calling.</p>
      <div className="flex gap-3">{[true, false].map(accept => <button key={String(accept)} className={`rounded-lg px-4 py-2 ${accept ? 'bg-green-700' : 'bg-rose-700'}`} disabled={busy || (accept && !!call)} onClick={() => void respond(accept)}>{accept ? (call ? 'Already in a call' : 'Accept') : 'Decline'}</button>)}</div>
    </div>}
    {call && socket && userId && <CallRoom key={call.id} call={call} socket={socket} userId={userId} deviceId={deviceId} onLeave={() => leave(call.id)}/>}
  </Context.Provider>;
}

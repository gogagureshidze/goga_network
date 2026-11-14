"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Message, Friend } from "../app/chat/page";
import SharedPost from "./SharedPost";
import { getMessages } from "@/actions/getMessages";
import { emitWithAck, useRealtimeSocket } from "@/hooks/useRealtimeSocket";
import VoiceMessage from "./chat/VoiceMessage";
import VoiceRecorder, { type VoiceAttachment } from "./chat/VoiceRecorder";
import { Reply, Pencil, Trash2, X } from "lucide-react";
import { leaveConversationRoom, mergeMessages, reconcileHistory } from "@/lib/chat-client";
import ConversationExperience from "@/components/communications/ConversationExperience";

type Props = {
  selectedFriend: Friend | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  Avatar: React.ComponentType;
  SendIcon: React.ComponentType;
  onBack?: () => void;
  userId: string;
};

type RawMessage = Omit<Message, "createdAt" | "isOwn" | "editedAt" | "deletedAt" | "waveform"> & {
  createdAt: Date | string;
  editedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  waveform?: unknown;
};

export default function MainChat({ selectedFriend, messages, setMessages, Avatar, SendIcon, onBack, userId }: Props) {
  const { socket, isConnected, connectionError, reconnect } = useRealtimeSocket();
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>(selectedFriend?.conversationId);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const oldestRef = useRef<number | undefined>(undefined);
  const fetchingOlder = useRef(false);
  const generation = useRef(0);
  const pending = useRef(new Map<string, Message>());
  const fetchingHistory = useRef(false);
  const liveDuringFetch = useRef<Message[]>([]);
  const selection = useRef(selectedFriend);
  selection.current = selectedFriend;
  const currentConversation = useRef(conversationId);
  currentConversation.current = conversationId;
  const lastTypingSent = useRef(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingExpiry = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastRead = useRef(0);
  const composerRevision = useRef(0);
  const selectionKey = selectedFriend ? `${selectedFriend.kind || "DIRECT"}:${selectedFriend.id}` : "";

  const format = useCallback((message: RawMessage): Message => ({
    ...message,
    createdAt: new Date(message.createdAt).toISOString(),
    editedAt: message.editedAt ? new Date(message.editedAt).toISOString() : null,
    deletedAt: message.deletedAt ? new Date(message.deletedAt).toISOString() : null,
    waveform: Array.isArray(message.waveform) ? message.waveform.filter((value): value is number => typeof value === "number" && Number.isFinite(value)) : null,
    isOwn: message.senderId === userId,
    delivery: "sent",
  }), [userId]);

  const belongs = useCallback((message: Message | RawMessage) => {
    const friend = selection.current;
    if (!friend) return false;
    if (friend.conversationId) return message.conversationId === friend.conversationId;
    if (currentConversation.current && message.conversationId === currentConversation.current) return true;
    return (message.senderId === friend.id && message.receiverId === userId) || (message.senderId === userId && message.receiverId === friend.id);
  }, [userId]);

  const fetchPage = useCallback(async (friend: Friend, olderThan?: number) => {
    if (friend.kind === "GROUP" && friend.conversationId) {
      return await emitWithAck<{ messages: RawMessage[]; hasMore: boolean; conversationId: number }>(socket, "getMessages", { conversationId: friend.conversationId, before: olderThan, limit: 30 });
    }
    return await getMessages(friend.id, olderThan);
  }, [socket]);

  const refresh = useCallback(async () => {
    if (!selectedFriend) return;
    const request = ++generation.current;
    fetchingHistory.current = true;
    liveDuringFetch.current = [];
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPage(selectedFriend);
      if (request !== generation.current || !result) return;
      const incoming = result.messages.map(format);
      const resolved = (result as { conversationId?: number }).conversationId || incoming[0]?.conversationId || selectedFriend.conversationId;
      setConversationId(resolved);
      currentConversation.current = resolved;
      oldestRef.current = incoming[0]?.id;
      setHasMore(result.hasMore);
      const unsent = Array.from(pending.current.values()).filter(belongs);
      setMessages(reconcileHistory(incoming, unsent, liveDuringFetch.current));
      for (const message of incoming) if (message.clientMessageId) pending.current.delete(message.clientMessageId);
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
    } catch { if (request === generation.current) setError("Messages could not be loaded. Please try again."); }
    finally { if (request === generation.current) { fetchingHistory.current = false; setLoading(false); } }
  }, [selectedFriend, fetchPage, format, belongs, setMessages]);

  useEffect(() => {
    composerRevision.current += 1;
    setMessages([]);
    setConversationId(selectedFriend?.conversationId);
    currentConversation.current = selectedFriend?.conversationId;
    setReplyTo(null); setEditing(null); setInput(""); setTyping([]); setOnlineUsers([]);
    lastRead.current = 0;
    fetchingOlder.current = false;
    setLoadingOlder(false);
    void refresh();
    return () => { generation.current += 1; composerRevision.current += 1; };
  }, [selectionKey, refresh, setMessages, selectedFriend?.conversationId]);

  async function loadOlder() {
    if (fetchingOlder.current || !hasMore || !selectedFriend || loading) return;
    const request = generation.current;
    fetchingOlder.current = true;
    setLoadingOlder(true);
    const element = scrollRef.current;
    const height = element?.scrollHeight || 0;
    try {
      const result = await fetchPage(selectedFriend, oldestRef.current);
      if (!result || request !== generation.current) return;
      const incoming = result.messages.map(format);
      setHasMore(result.hasMore);
      if (incoming.length) oldestRef.current = incoming[0].id;
      setMessages((previous) => mergeMessages(previous, incoming));
      requestAnimationFrame(() => { if (element) element.scrollTop += element.scrollHeight - height; });
    } catch { setError("Older messages could not be loaded. Please retry."); }
    finally { fetchingOlder.current = false; if (request === generation.current) setLoadingOlder(false); }
  }

  const applyMessage = useCallback((raw: RawMessage) => {
    if (raw.clientMessageId) pending.current.delete(raw.clientMessageId);
    if (!belongs(raw)) return;
    const message = format(raw);
    if (fetchingHistory.current) liveDuringFetch.current.push(message);
    if (message.conversationId) setConversationId(message.conversationId);
    const element = scrollRef.current;
    const scroll = message.isOwn || Boolean(element && element.scrollHeight - element.scrollTop - element.clientHeight < 140);
    setMessages((previous) => mergeMessages(previous, [message]));
    if (scroll) requestAnimationFrame(() => { if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" }); });
  }, [belongs, format, setMessages]);

  useEffect(() => {
    if (!socket) return;
    const read = (data: { conversationId: number; userId: string; messageId: number }) => {
      if (data.conversationId !== currentConversation.current || data.userId === userId) return;
      setMessages((previous) => previous.map((message) => message.isOwn && message.id <= data.messageId ? { ...message, isRead: true, readBy: Array.from(new Set([...(message.readBy || []), data.userId])) } : message));
    };
    socket.on("receiveMessage", applyMessage);
    socket.on("messageUpdated", applyMessage);
    socket.on("messagesRead", read);
    socket.on("connect", refresh);
    return () => {
      socket.off("receiveMessage", applyMessage);
      socket.off("messageUpdated", applyMessage);
      socket.off("messagesRead", read);
      socket.off("connect", refresh);
    };
  }, [socket, applyMessage, refresh, userId, setMessages]);

  useEffect(() => {
    if (!socket || !conversationId || !isConnected) return;
    let active = true;
    const expiryTimers = typingExpiry.current;
    void emitWithAck<{ presence: string[] }>(socket, "joinConversation", { conversationId }).then((result) => { if (active) setOnlineUsers(result.presence || []); }).catch(() => {});
    const presenceTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void emitWithAck<{ presence: string[] }>(socket, "getPresence", { conversationId }).then((result) => { if (active) setOnlineUsers(result.presence || []); }).catch(() => { if (active) setOnlineUsers([]); });
    }, 30000);
    const update = (data: { conversationId: number; userId: string; isTyping: boolean }) => {
      if (data.conversationId !== conversationId || data.userId === userId) return;
      const previousTimer = typingExpiry.current.get(data.userId);
      if (previousTimer) clearTimeout(previousTimer);
      setTyping((previous) => data.isTyping ? Array.from(new Set([...previous, data.userId])) : previous.filter((id) => id !== data.userId));
      if (data.isTyping) typingExpiry.current.set(data.userId, setTimeout(() => setTyping((previous) => previous.filter((id) => id !== data.userId)), 5000));
    };
    socket.on("chatTyping", update);
    return () => {
      active = false;
      clearInterval(presenceTimer);
      socket.off("chatTyping", update);
      leaveConversationRoom(socket, conversationId);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      expiryTimers.forEach(clearTimeout);
      expiryTimers.clear();
    };
  }, [socket, conversationId, isConnected, userId]);

  useEffect(() => {
    const markRead = () => {
      if (!isConnected || !conversationId || document.visibilityState !== "visible" || !document.hasFocus()) return;
      const latest = messages.filter((message) => !message.isOwn && message.id > 0).at(-1);
      if (!latest || latest.id <= lastRead.current) return;
      const element = scrollRef.current;
      if (element && element.scrollHeight - element.scrollTop - element.clientHeight > 180) return;
      lastRead.current = latest.id;
      void emitWithAck(socket, "markRead", { conversationId, messageId: latest.id }).catch(() => { lastRead.current = 0; });
    };
    const frame = requestAnimationFrame(markRead);
    document.addEventListener("visibilitychange", markRead);
    window.addEventListener("focus", markRead);
    const element = scrollRef.current;
    element?.addEventListener("scroll", markRead, { passive: true });
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", markRead); window.removeEventListener("focus", markRead); element?.removeEventListener("scroll", markRead); };
  }, [socket, isConnected, conversationId, messages]);

  function onInput(value: string) {
    composerRevision.current += 1;
    setInput(value);
    if (!socket?.connected || !conversationId) return;
    if (Date.now() - lastTypingSent.current > 1500) { socket.emit("chatTyping", { conversationId, isTyping: true }); lastTypingSent.current = Date.now(); }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { if (socket.connected) socket.emit("chatTyping", { conversationId, isTyping: false }); }, 2200);
  }

  async function deliver(message: Message) {
    if (!message.clientMessageId) return;
    const queued = { ...message, delivery: "sending" as const };
    pending.current.set(message.clientMessageId, queued);
    if (belongs(message)) setMessages((previous) => mergeMessages(previous, [queued]));
    try {
      const result = await emitWithAck<{ message: RawMessage }>(socket, "sendMessage", {
        ...(message.conversationId ? { conversationId: message.conversationId } : { receiverId: message.receiverId }),
        clientMessageId: message.clientMessageId,
        text: message.text,
        replyToId: message.replyToId || undefined,
        mediaAssetId: message.mediaAssetId || undefined,
      });
      applyMessage(result.message);
    } catch (reason) {
      // An acknowledgement can be lost after persistence. Retrying keeps the
      // same clientMessageId, so it cannot create a second server message.
      if (!pending.current.has(message.clientMessageId)) return;
      const failed = { ...message, delivery: "failed" as const };
      pending.current.set(message.clientMessageId, failed);
      if (belongs(message)) { setMessages((previous) => mergeMessages(previous, [failed])); setError(reason instanceof Error ? reason.message : "Message was not confirmed. Retry below."); }
    }
  }

  function send(attachment?: VoiceAttachment) {
    if (!selectedFriend || (!input.trim() && !attachment) || !isConnected) return;
    if (editing && !attachment) {
      const request = ++composerRevision.current;
      const friend = selectedFriend;
      void mutation("editMessage", { messageId: editing.id, text: input.trim() }).then((success) => {
        if (success && composerRevision.current === request && selection.current === friend) { setEditing(null); setInput(""); }
      });
      return;
    }
    const message: Message = {
      id: -Date.now(), clientMessageId: crypto.randomUUID(), senderId: userId,
      ...(conversationId ? { conversationId } : { receiverId: selectedFriend.id }),
      receiverId: selectedFriend.kind === "GROUP" ? undefined : selectedFriend.id,
      text: attachment ? null : input.trim(), createdAt: new Date().toISOString(), isOwn: true,
      replyToId: replyTo?.id, ...attachment, delivery: "sending",
    };
    setError(null);
    void deliver(message);
    if (!attachment) setInput("");
    setReplyTo(null);
    if (socket?.connected && conversationId) socket.emit("chatTyping", { conversationId, isTyping: false });
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
  }

  async function mutation(event: string, payload: unknown) {
    setError(null);
    try { const result = await emitWithAck<{ message?: RawMessage }>(socket, event, payload); if (result.message) applyMessage(result.message); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The change could not be saved."); return false; }
  }

  function renderMessage(message: Message) {
    let sharedPost: React.ComponentProps<typeof SharedPost>["postData"] | null = null;
    if (message.mediaType === "shared_post" && message.mediaUrl && !message.deletedAt) {
      try { sharedPost = JSON.parse(message.mediaUrl).post; } catch { /* Old malformed shares remain readable as text. */ }
    }
    const quoted = messages.find((entry) => entry.id === message.replyToId) || message.replyTo;
    const reactions = Array.from(new Set((message.reactions || []).map((reaction) => reaction.emoji)));
    return (
      <article key={message.clientMessageId || message.id} className={`mb-4 flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
        <div className={`flex w-full max-w-[88%] flex-col gap-1 sm:max-w-[70%] lg:max-w-[420px] ${message.isOwn ? "items-end" : "items-start"}`}>
          {selectedFriend?.kind === "GROUP" && !message.isOwn && <span className="text-xs text-gray-500">{message.sender?.name || message.sender?.username || "Member"}</span>}
          {message.replyToId && <div className="max-w-full truncate border-l-2 border-orange-400 px-2 text-xs text-gray-500">Reply to: {quoted?.deletedAt ? "Deleted message" : quoted?.text || (quoted?.mediaType === "voice" ? "Voice message" : "Earlier message")}</div>}
          {message.deletedAt ? <p className="rounded-xl bg-gray-100 px-4 py-2 text-sm italic text-gray-500 dark:bg-gray-800">Message deleted</p> : <>
            {sharedPost ? <SharedPost postData={sharedPost} isOwn={message.isOwn} /> : message.text && <p className={`whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${message.isOwn ? "rounded-br-[4px] bg-orange-500 text-white" : "rounded-bl-[4px] bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100"}`}>{message.text}</p>}
            {message.mediaType === "voice" && message.mediaUrl && <VoiceMessage src={message.mediaUrl} mediaAssetId={message.mediaAssetId} durationMs={message.durationMs} waveform={message.waveform} />}
          </>}
          <span className="text-[10px] text-gray-500">{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{message.editedAt && " · edited"}{message.isOwn && ` · ${message.delivery === "sending" ? "Sending…" : message.delivery === "failed" ? "Not confirmed" : selectedFriend?.kind === "GROUP" && message.readBy?.length ? `Seen by ${message.readBy.length}` : message.isRead ? "Read" : "Sent"}`}</span>
          {message.delivery === "failed" && <button onClick={() => void deliver(message)} disabled={!isConnected} className="text-xs text-red-600 underline disabled:opacity-50">Retry message</button>}
          {!message.deletedAt && message.id > 0 && <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <button aria-label="Reply to message" onClick={() => { composerRevision.current += 1; setReplyTo(message); setEditing(null); }} className="p-1"><Reply size={14} /></button>
            <button aria-label="React with heart" disabled={!isConnected} onClick={() => void mutation("reactMessage", { messageId: message.id, emoji: "❤️", remove: message.reactions?.some((reaction) => reaction.userId === userId && reaction.emoji === "❤️") })} className="p-1">♡</button>
            {message.isOwn && <><button aria-label="Edit message" disabled={!message.text || message.mediaType === "shared_post" || !isConnected} onClick={() => { composerRevision.current += 1; setEditing(message); setReplyTo(null); setInput(message.text || ""); }} className="p-1 disabled:opacity-30"><Pencil size={13} /></button><button aria-label="Delete message" disabled={!isConnected} onClick={() => { if (window.confirm("Delete this message for everyone?")) void mutation("deleteMessage", { messageId: message.id }); }} className="p-1"><Trash2 size={13} /></button></>}
            {reactions.map((emoji) => <button key={emoji} onClick={() => void mutation("reactMessage", { messageId: message.id, emoji, remove: message.reactions?.some((reaction) => reaction.userId === userId && reaction.emoji === emoji) })} className="rounded-full bg-orange-100 px-2 py-1 text-gray-900">{emoji} {message.reactions?.filter((reaction) => reaction.emoji === emoji).length}</button>)}
          </div>}
        </div>
      </article>
    );
  }

  if (!selectedFriend) return <div className="flex flex-1 items-center justify-center text-gray-500">Select a conversation to start chatting</div>;
  return (
    <section aria-label={`Chat with ${selectedFriend.name}`} className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-3xl bg-white shadow-xl dark:bg-gray-800">
      <header className="flex items-center gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
        {onBack && <button onClick={onBack} className="text-sm text-rose-800 dark:text-white">Back</button>}
        <Avatar />
        <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{selectedFriend.name}</h2><p className="text-xs text-gray-500">{isConnected ? selectedFriend.kind === "GROUP" ? "Connected" : onlineUsers.includes(selectedFriend.id) ? "Online" : "Connected" : connectionError || "Connecting…"}</p></div>
        {!isConnected && <button onClick={reconnect} className="text-sm text-orange-600">Reconnect</button>}
      </header>
      <ConversationExperience key={selectionKey} conversationId={conversationId} receiverId={selectedFriend.kind === "GROUP" ? undefined : selectedFriend.id} />
      {error && <div role="alert" className="flex items-center justify-between gap-2 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError(null)}><X size={16} /></button></div>}
      <div ref={scrollRef} aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto bg-rose-50 px-4 py-4 dark:bg-gray-900">
        {loading ? <p role="status" className="py-4 text-center text-sm text-gray-500">Loading messages…</p> : <>
          {hasMore && <button disabled={loadingOlder} onClick={() => void loadOlder()} className="mx-auto mb-4 block text-xs text-orange-700 disabled:opacity-50 dark:text-orange-300">{loadingOlder ? "Loading…" : "Load older messages"}</button>}
          {!messages.length && <p className="py-8 text-center text-sm text-gray-500">Say hello to start the conversation.</p>}
          {messages.map(renderMessage)}
        </>}
      </div>
      {typing.length > 0 && <p role="status" className="px-4 py-1 text-xs text-gray-500">{selectedFriend.kind === "GROUP" ? `${typing.length} member${typing.length === 1 ? "" : "s"}` : selectedFriend.name} typing…</p>}
      <div className="space-y-3 border-t border-gray-200 p-3 dark:border-gray-700 sm:p-4">
        {(replyTo || editing) && <div className="flex items-center justify-between gap-2 text-xs text-gray-500"><span className="truncate">{editing ? "Editing" : "Replying to"}: {(editing || replyTo)?.text || "Voice message"}</span><button aria-label="Cancel reply or edit" onClick={() => { composerRevision.current += 1; setReplyTo(null); if (editing) setInput(""); setEditing(null); }}><X size={16} /></button></div>}
        <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); send(); }}>
          <input aria-label="Message" maxLength={4000} placeholder="Type a message…" value={input} onChange={(event) => onInput(event.target.value)} className="min-w-0 flex-1 rounded-full border border-gray-300 bg-gray-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-400 dark:border-gray-600 dark:bg-gray-700" />
          <button type="submit" aria-label={editing ? "Save edit" : "Send message"} disabled={!isConnected || !input.trim()} className="rounded-full bg-rose-800 p-3 text-white disabled:opacity-50"><SendIcon /></button>
        </form>
        {!editing && <VoiceRecorder key={selectionKey} receiverId={selectedFriend.kind === "GROUP" ? undefined : selectedFriend.id} conversationId={conversationId} disabled={!isConnected} onSend={send} />}
      </div>
    </section>
  );
}

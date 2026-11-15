"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Plus, Settings, Users, X } from "lucide-react";
import Image from "next/image";
import { applyInboxMessage, applyInboxRead, messagePreview, sortInbox, type InboxConversation as Conversation, type InboxMessage } from "@/lib/chat-inbox";
import { emitWithAck, useRealtimeSocket } from "@/hooks/useRealtimeSocket";
import type { Friend } from "@/app/chat/page";

export default function GroupConversations({ friends, selectedFriend, onSelect }: { friends: Friend[]; selectedFriend: Friend | null; onSelect: (friend: Friend | null) => void }) {
  const { user } = useUser();
  const { socket, isConnected } = useRealtimeSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [managing, setManaging] = useState<number | null>(null);
  const [inviteId, setInviteId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const refreshRequest = useRef(0);
  const presenceRevision = useRef(0);
  const serverPresenceRevision = useRef(-1);
  const currentSelection = useRef(selectedFriend);
  currentSelection.current = selectedFriend;
  const currentOnSelect = useRef(onSelect);
  currentOnSelect.current = onSelect;

  const reload = useCallback(async () => {
    if (!socket?.connected) return;
    try {
      const request = ++refreshRequest.current;
      const revision = presenceRevision.current;
      const result = await emitWithAck<{ conversations: Conversation[]; presence: string[]; presenceRevision: number }>(socket, "listConversations", {});
      if (request !== refreshRequest.current || !socket.connected) return;
      setConversations(sortInbox(result.conversations));
      if (revision === presenceRevision.current && result.presenceRevision >= serverPresenceRevision.current) { serverPresenceRevision.current = result.presenceRevision; setOnlineUsers(result.presence || []); }
      setLoaded(true);
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Conversations could not be loaded."); }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRefresh = 0;
    const scheduleReload = () => {
      // Coalesce message/read bursts while invalidating an older in-flight snapshot.
      refreshRequest.current += 1;
      if (timer) return;
      timer = setTimeout(() => { timer = undefined; lastRefresh = Date.now(); void reload(); }, Math.max(100, 1500 - (Date.now() - lastRefresh)));
    };
    const message = (data: InboxMessage) => {
      setConversations((previous) => applyInboxMessage(previous, data, user?.id));
      scheduleReload();
    };
    const read = (data: { conversationId: number; userId: string; messageId: number }) => { setConversations((previous) => applyInboxRead(previous, data, user?.id)); scheduleReload(); };
    const presence = (data: { presence: string[]; presenceRevision: number }) => {
      if (data.presenceRevision < serverPresenceRevision.current) return;
      serverPresenceRevision.current = data.presenceRevision;
      presenceRevision.current += 1;
      setOnlineUsers(data.presence || []);
    };
    const disconnected = () => { serverPresenceRevision.current = -1; refreshRequest.current += 1; presenceRevision.current += 1; setOnlineUsers([]); };
    const removed = (data: { conversationId: number }) => {
      setConversations((previous) => previous.filter((conversation) => conversation.id !== data.conversationId));
      setManaging((previous) => previous === data.conversationId ? null : previous);
      if (currentSelection.current?.conversationId === data.conversationId) currentOnSelect.current(null);
      scheduleReload();
    };
    const foreground = () => { if (document.visibilityState === "visible" && socket.connected) scheduleReload(); };
    socket.on("connect", scheduleReload);
    socket.on("disconnect", disconnected);
    socket.on("conversationsChanged", scheduleReload);
    socket.on("receiveMessage", message);
    socket.on("messageUpdated", message);
    socket.on("messagesRead", read);
    socket.on("presenceChanged", presence);
    socket.on("conversationRemoved", removed);
    document.addEventListener("visibilitychange", foreground);
    if (socket.connected) void reload();
    return () => {
      refreshRequest.current += 1;
      clearTimeout(timer);
      socket.off("connect", scheduleReload); socket.off("disconnect", disconnected);
      socket.off("conversationsChanged", scheduleReload); socket.off("conversationRemoved", removed);
      socket.off("receiveMessage", message); socket.off("messageUpdated", message);
      socket.off("messagesRead", read); socket.off("presenceChanged", presence);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [socket, reload, user?.id]);

  function select(conversation: Conversation) {
    const other = conversation.user1Id === user?.id ? conversation.user2 : conversation.user1;
    onSelect({ id: conversation.kind === "GROUP" ? `group:${conversation.id}` : other?.id || "", conversationId: conversation.id, kind: conversation.kind, name: conversation.name || other?.username || "Conversation", avatar: other?.avatar || "/noAvatar.png", lastMessage: messagePreview(conversation.messages?.[0]) });
  }

  async function action(event: string, payload: unknown) {
    if (pending) return false;
    setPending(true); setError(null);
    try { await emitWithAck(socket, event, payload); await reload(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The change could not be saved."); return false; }
    finally { setPending(false); }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !name.trim()) return;
    setPending(true); setError(null);
    try {
      const result = await emitWithAck<{ conversation: Conversation }>(socket, "createGroup", { name: name.trim(), memberIds: inviteIds });
      await reload(); select(result.conversation);
      setCreating(false); setName(""); setInviteIds([]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The group could not be created."); }
    finally { setPending(false); }
  }

  const newFriends = friends.filter((friend) => !conversations.some((conversation) => conversation.kind === "DIRECT" && friend.id === (conversation.user1Id === user?.id ? conversation.user2Id : conversation.user1Id)));
  const group = conversations.find((conversation) => conversation.id === managing);
  const ownMembership = group?.members.find((member) => member.userId === user?.id);
  const moderator = ownMembership?.role === "OWNER" || ownMembership?.role === "ADMIN";
  const available = friends.filter((friend) => !group?.members.some((member) => member.userId === friend.id));

  return <div className="border-b border-gray-200 p-3 dark:border-gray-700">
    <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inbox</h3><button disabled={!isConnected} onClick={() => { setCreating((value) => !value); setManaging(null); }} className="flex items-center gap-1 text-xs text-orange-700 disabled:opacity-50 dark:text-orange-300"><Plus size={14} /> New group</button></div>
    {error && <p role="alert" className="mb-2 text-xs text-red-600">{error} <button onClick={() => void reload()} className="underline">Retry</button></p>}
    {creating && <form onSubmit={create} className="mb-3 space-y-2 rounded-xl bg-orange-50 p-3 dark:bg-gray-700">
      <label className="block text-xs">Group name<input autoFocus aria-label="Group name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900" required /></label>
      <p className="text-xs text-gray-500 dark:text-gray-300">Invite up to 49 people. They choose whether to join.</p>
      <div className="max-h-40 space-y-1 overflow-y-auto">{friends.map((friend) => <label key={friend.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inviteIds.includes(friend.id)} disabled={inviteIds.length >= 49 && !inviteIds.includes(friend.id)} onChange={(event) => setInviteIds((previous) => event.target.checked ? [...previous, friend.id] : previous.filter((id) => id !== friend.id))} />{friend.name}</label>)}</div>
      <div className="flex gap-2"><button type="submit" disabled={pending || !isConnected} className="rounded-lg bg-orange-500 px-3 py-2 text-xs text-white disabled:opacity-50">{pending ? "Creating…" : "Create group"}</button><button type="button" onClick={() => setCreating(false)} className="text-xs">Cancel</button></div>
    </form>}
    {!loaded && !error && <p role="status" className="py-3 text-sm text-gray-500">{isConnected ? "Loading conversations…" : "Connecting…"}</p>}
    {loaded && !conversations.length && <p className="py-3 text-sm text-gray-500">Your conversations will appear here.</p>}
    <ul aria-label="Conversations" className="space-y-1">{conversations.map((conversation) => {
      const invited = conversation.members.some((member) => member.userId === user?.id && member.status === "INVITED");
      const other = conversation.user1Id === user?.id ? conversation.user2 : conversation.user1;
      const title = conversation.name || other?.username || "Conversation";
      const online = conversation.kind === "DIRECT" && Boolean(other && onlineUsers.includes(other.id));
      const unread = conversation.unreadCount || 0;
      const selected = selectedFriend?.conversationId === conversation.id || (conversation.kind === "DIRECT" && selectedFriend?.id === other?.id);
      const timestamp = conversation.messages?.[0]?.createdAt || conversation.lastMessageAt;
      return <li key={conversation.id} className={`rounded-xl p-2 ${selected ? "bg-orange-100 dark:bg-orange-950/40 ring-1 ring-orange-200 dark:ring-orange-900" : unread ? "bg-rose-50 dark:bg-rose-950/25" : "hover:bg-gray-100 dark:hover:bg-gray-700/60"}`}>
        <div className="flex items-center gap-2">
          <button disabled={invited} onClick={() => select(conversation)} aria-current={selected ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
            <span className="relative shrink-0">
              {conversation.kind === "GROUP" ? <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-gray-700 dark:text-orange-300"><Users size={20} /></span> : <Image src={other?.avatar || "/noAvatar.png"} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />}
              {online && <span aria-label="Online" title="Online" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-800" />}
            </span>
            <span className="min-w-0 flex-1"><span className="flex items-baseline gap-2"><span className={`min-w-0 flex-1 truncate text-sm ${unread ? "font-bold" : "font-medium"}`}>{title}</span>{timestamp && <time dateTime={new Date(timestamp).toISOString()} title={new Date(timestamp).toLocaleString()} className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">{new Date(timestamp).toLocaleDateString() === new Date().toLocaleDateString() ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}</time>}</span><span className="mt-1 flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-xs ${unread ? "text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>{invited ? "Group invitation" : messagePreview(conversation.messages?.[0])}</span>{unread > 0 && <span aria-label={`${unread} unread message${unread === 1 ? "" : "s"}`} className="min-w-5 shrink-0 rounded-full bg-rose-700 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white dark:bg-rose-600">{unread > 99 ? "99+" : unread}</span>}</span></span>
          </button>
          {conversation.kind === "GROUP" && !invited && <button aria-label={`Manage ${title}`} onClick={() => { setManaging(managing === conversation.id ? null : conversation.id); setCreating(false); }} className="shrink-0 rounded p-2 text-gray-500 hover:bg-black/5 dark:text-gray-300"><Settings size={15} /></button>}
        </div>
        {invited && <div className="mt-2 flex gap-3 text-xs"><button disabled={pending || !isConnected} onClick={() => void action("respondInvite", { conversationId: conversation.id, accept: true }).then((accepted) => { if (accepted) select(conversation); })} className="text-orange-700 dark:text-orange-300">Join group</button><button disabled={pending || !isConnected} onClick={() => void action("respondInvite", { conversationId: conversation.id, accept: false })}>Decline</button></div>}
      </li>;
    })}</ul>
    {group && <div className="mt-3 space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-600">
      <div className="flex items-center justify-between"><span className="truncate text-sm font-semibold">{group.name}</span><button aria-label="Close group settings" onClick={() => setManaging(null)}><X size={15} /></button></div>
      <ul className="max-h-56 space-y-2 overflow-y-auto">{group.members.map((member) => <li key={member.userId} className="text-xs"><div className="flex items-center justify-between gap-1"><span className="truncate">{member.user?.username || "Member"}{member.userId === user?.id && " (you)"}</span><span className="text-[10px] text-gray-500">{member.status === "INVITED" ? "Invited" : member.role.toLowerCase()}</span></div>
        {moderator && member.userId !== user?.id && member.role !== "OWNER" && <div className="mt-1 flex gap-3 text-[10px]">
          {ownMembership?.role === "OWNER" && member.status === "ACTIVE" && <button disabled={pending || !isConnected} onClick={() => void action("updateMember", { conversationId: group.id, memberId: member.userId, role: member.role === "ADMIN" ? "MEMBER" : "ADMIN" })} className="text-orange-700 dark:text-orange-300">{member.role === "ADMIN" ? "Remove admin role" : "Make admin"}</button>}
          {(ownMembership?.role === "OWNER" || member.role === "MEMBER") && <button disabled={pending || !isConnected} onClick={() => { if (window.confirm(`Remove ${member.user?.username || "this member"} from the group?`)) void action("updateMember", { conversationId: group.id, memberId: member.userId, remove: true }); }} className="text-red-600">{member.status === "INVITED" ? "Cancel invite" : "Remove"}</button>}
        </div>}
      </li>)}</ul>
      {moderator && available.length > 0 && <form onSubmit={(event) => { event.preventDefault(); if (inviteId) void action("inviteMember", { conversationId: group.id, memberId: inviteId }).then((success) => { if (success) setInviteId(""); }); }} className="flex gap-1"><select aria-label="Person to invite" value={inviteId} onChange={(event) => setInviteId(event.target.value)} className="min-w-0 flex-1 rounded border bg-white p-1 text-xs text-gray-900"><option value="">Invite a friend…</option>{available.map((friend) => <option key={friend.id} value={friend.id}>{friend.name}</option>)}</select><button disabled={!inviteId || pending || !isConnected} type="submit" className="text-xs text-orange-700 disabled:opacity-50 dark:text-orange-300">Invite</button></form>}
      <button disabled={pending || !isConnected} onClick={() => { if (window.confirm(ownMembership?.role === "OWNER" ? "Leave this group? Ownership passes to the earliest active member. If nobody else has joined, pending invitations are cancelled." : "Leave this group? A moderator must invite you to rejoin.")) void action("leaveGroup", { conversationId: group.id }).then((success) => { if (success) { setManaging(null); if (selectedFriend?.conversationId === group.id) onSelect(null); } }); }} className="text-xs text-red-600">Leave group</button>
    </div>}
    {newFriends.length > 0 && <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700"><h3 className="mb-2 text-xs font-semibold text-gray-500">Start a conversation</h3>{newFriends.map((friend) => <button key={friend.id} onClick={() => onSelect(friend)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"><Image src={friend.avatar || "/noAvatar.png"} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" /><span className="truncate">{friend.name}</span></button>)}</div>}
    {loaded && !friends.length && !conversations.length && <p className="py-3 text-xs text-gray-500">Follow people to start a direct conversation, or create a group.</p>}
  </div>;
}

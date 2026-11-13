"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Plus, Settings, Users, X } from "lucide-react";
import { emitWithAck, useRealtimeSocket } from "@/hooks/useRealtimeSocket";
import type { Friend } from "@/app/chat/page";

type Member = { userId: string; role: "OWNER" | "ADMIN" | "MEMBER"; status: "ACTIVE" | "INVITED"; user?: { id: string; username: string | null; avatar: string | null } };
type Conversation = { id: number; kind: "GROUP" | "DIRECT"; name: string | null; members: Member[]; user1Id?: string; user2Id?: string; user1?: Member["user"]; user2?: Member["user"]; messages?: { text: string | null; mediaType: string | null }[] };

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
  const currentSelection = useRef(selectedFriend);
  currentSelection.current = selectedFriend;
  const currentOnSelect = useRef(onSelect);
  currentOnSelect.current = onSelect;

  const reload = useCallback(async () => {
    if (!socket?.connected) return;
    try {
      const result = await emitWithAck<{ conversations: Conversation[] }>(socket, "listConversations", {});
      setConversations(result.conversations);
      setLoaded(true);
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Conversations could not be loaded."); }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const removed = (data: { conversationId: number }) => {
      setConversations((previous) => previous.filter((conversation) => conversation.id !== data.conversationId));
      setManaging((previous) => previous === data.conversationId ? null : previous);
      if (currentSelection.current?.conversationId === data.conversationId) currentOnSelect.current(null);
      void reload();
    };
    socket.on("connect", reload);
    socket.on("conversationsChanged", reload);
    socket.on("conversationRemoved", removed);
    if (socket.connected) void reload();
    return () => { socket.off("connect", reload); socket.off("conversationsChanged", reload); socket.off("conversationRemoved", removed); };
  }, [socket, reload]);

  function select(conversation: Conversation) {
    const other = conversation.user1Id === user?.id ? conversation.user2 : conversation.user1;
    onSelect({ id: conversation.kind === "GROUP" ? `group:${conversation.id}` : other?.id || "", conversationId: conversation.id, kind: conversation.kind, name: conversation.name || other?.username || "Conversation", avatar: other?.avatar || "/noAvatar.png", lastMessage: conversation.messages?.[0]?.text || "" });
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

  const groups = conversations.filter((conversation) => conversation.kind === "GROUP");
  const otherDirect = conversations.filter((conversation) => conversation.kind === "DIRECT" && !friends.some((friend) => friend.id === (conversation.user1Id === user?.id ? conversation.user2Id : conversation.user1Id)));
  const group = conversations.find((conversation) => conversation.id === managing);
  const ownMembership = group?.members.find((member) => member.userId === user?.id);
  const moderator = ownMembership?.role === "OWNER" || ownMembership?.role === "ADMIN";
  const available = friends.filter((friend) => !group?.members.some((member) => member.userId === friend.id));

  return <div className="border-b border-gray-200 p-3 dark:border-gray-700">
    <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Groups</h3><button disabled={!isConnected} onClick={() => { setCreating((value) => !value); setManaging(null); }} className="flex items-center gap-1 text-xs text-orange-700 disabled:opacity-50 dark:text-orange-300"><Plus size={14} /> New group</button></div>
    {error && <p role="alert" className="mb-2 text-xs text-red-600">{error} <button onClick={() => void reload()} className="underline">Retry</button></p>}
    {creating && <form onSubmit={create} className="mb-3 space-y-2 rounded-xl bg-orange-50 p-3 dark:bg-gray-700">
      <label className="block text-xs">Group name<input autoFocus aria-label="Group name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900" required /></label>
      <p className="text-xs text-gray-500 dark:text-gray-300">Invite up to 49 people. They choose whether to join.</p>
      <div className="max-h-40 space-y-1 overflow-y-auto">{friends.map((friend) => <label key={friend.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inviteIds.includes(friend.id)} disabled={inviteIds.length >= 49 && !inviteIds.includes(friend.id)} onChange={(event) => setInviteIds((previous) => event.target.checked ? [...previous, friend.id] : previous.filter((id) => id !== friend.id))} />{friend.name}</label>)}</div>
      <div className="flex gap-2"><button type="submit" disabled={pending || !isConnected} className="rounded-lg bg-orange-500 px-3 py-2 text-xs text-white disabled:opacity-50">{pending ? "Creating…" : "Create group"}</button><button type="button" onClick={() => setCreating(false)} className="text-xs">Cancel</button></div>
    </form>}
    {!groups.length && loaded && <p className="py-2 text-xs text-gray-500">Create a group to chat with friends.</p>}
    {groups.map((conversation) => {
      const invited = conversation.members.some((member) => member.userId === user?.id && member.status === "INVITED");
      return <div key={conversation.id} className={`my-1 rounded-xl p-2 ${selectedFriend?.conversationId === conversation.id ? "bg-orange-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
        <div className="flex items-center gap-2"><Users size={18} className="shrink-0 text-orange-600" /><button disabled={invited} onClick={() => select(conversation)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{conversation.name || "Group"}</span><span className="text-xs text-gray-500">{invited ? "Invitation" : `${conversation.members.filter((member) => member.status === "ACTIVE").length} members`}</span></button>{!invited && <button aria-label={`Manage ${conversation.name || "group"}`} onClick={() => { setManaging(managing === conversation.id ? null : conversation.id); setCreating(false); }} className="p-1"><Settings size={15} /></button>}</div>
        {invited && <div className="mt-2 flex gap-3 text-xs"><button disabled={pending || !isConnected} onClick={() => void action("respondInvite", { conversationId: conversation.id, accept: true }).then((accepted) => { if (accepted) select(conversation); })} className="text-orange-700 dark:text-orange-300">Join group</button><button disabled={pending || !isConnected} onClick={() => void action("respondInvite", { conversationId: conversation.id, accept: false })}>Decline</button></div>}
      </div>;
    })}
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
    {otherDirect.length > 0 && <div className="mt-3 border-t pt-2"><h3 className="text-xs text-gray-500">Other conversations</h3>{otherDirect.map((conversation) => <button key={conversation.id} onClick={() => select(conversation)} className="block w-full truncate p-2 text-left text-sm">{(conversation.user1Id === user?.id ? conversation.user2 : conversation.user1)?.username || "Conversation"}</button>)}</div>}
  </div>;
}

export type InboxMember = { userId: string; role: "OWNER" | "ADMIN" | "MEMBER"; status: "ACTIVE" | "INVITED"; user?: { id: string; username: string | null; avatar: string | null } };
export type InboxMessage = { id: number; conversationId?: number; senderId?: string; text: string | null; mediaType?: string | null; deletedAt?: string | Date | null; isRead?: boolean; createdAt: string | Date };
export type InboxConversation = {
  id: number; kind: "GROUP" | "DIRECT"; name: string | null; members: InboxMember[];
  user1Id?: string; user2Id?: string; user1?: InboxMember["user"]; user2?: InboxMember["user"];
  messages?: InboxMessage[]; unreadCount?: number; lastMessageAt?: string | null; createdAt?: string; updatedAt?: string;
};

export function messagePreview(message?: Pick<InboxMessage, "text" | "mediaType" | "deletedAt">) {
  if (!message) return "Start a conversation";
  if (message.deletedAt) return "Message deleted";
  if (message.mediaType === "voice") return "Voice message";
  if (message.mediaType === "shared_post") return "Shared a post";
  return message.text || (message.mediaType ? "Attachment" : "Message");
}

function messageTime(conversation: InboxConversation) {
  const value = conversation.messages?.[0]?.createdAt || conversation.lastMessageAt;
  return value ? new Date(value).getTime() || 0 : 0;
}

/** Membership edits must not reorder a conversation ahead of a newer message. */
export function sortInbox(conversations: InboxConversation[]) {
  return [...conversations].sort((a, b) => messageTime(b) - messageTime(a)
    || (b.messages?.[0]?.id || 0) - (a.messages?.[0]?.id || 0)
    || (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()) || b.id - a.id);
}

/** Update previews immediately; the server remains authoritative for unread counts. */
export function applyInboxMessage(conversations: InboxConversation[], message: InboxMessage, userId?: string) {
  return sortInbox(conversations.map((conversation) => {
    if (conversation.id !== message.conversationId) return conversation;
    const latest = conversation.messages?.[0];
    if (latest && latest.id > message.id) return conversation;
    const unreadIncrement = userId && message.senderId && message.senderId !== userId && !message.isRead && !message.deletedAt && (!latest || message.id > latest.id) ? 1 : 0;
    return { ...conversation, messages: [message], lastMessageAt: new Date(message.createdAt).toISOString(), unreadCount: (conversation.unreadCount || 0) + unreadIncrement };
  }));
}

/** A receipt from another device clears only messages covered by that cursor. */
export function applyInboxRead(conversations: InboxConversation[], receipt: { conversationId: number; userId: string; messageId: number }, viewerId?: string) {
  if (receipt.userId !== viewerId) return conversations;
  return conversations.map((conversation) => conversation.id === receipt.conversationId && (conversation.messages?.[0]?.id || 0) <= receipt.messageId
    ? { ...conversation, unreadCount: 0 } : conversation);
}

export function canReadVisibleMessage(input: { connected: boolean; visible: boolean; focused: boolean; loading: boolean; unobscured?: boolean; panelTop: number; panelBottom: number; messageTop: number; messageBottom: number }) {
  return input.connected && input.visible && input.focused && !input.loading && input.unobscured !== false && input.panelBottom > input.panelTop &&
    input.messageBottom <= input.panelBottom + 2 && input.messageBottom > input.panelTop && input.messageTop < input.panelBottom;
}

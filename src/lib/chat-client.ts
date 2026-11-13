type IdentifiedMessage = { id: number; createdAt: string; clientMessageId?: string | null };

/** Reconcile a server acknowledgement/echo with its optimistic row. */
export function mergeMessages<T extends IdentifiedMessage>(existing: T[], incoming: T[]): T[] {
  const result = [...existing];
  for (const message of incoming) {
    const index = result.findIndex((entry) =>
      (entry.id > 0 && message.id > 0 && entry.id === message.id) ||
      Boolean(message.clientMessageId && entry.clientMessageId === message.clientMessageId),
    );
    if (index === -1) result.push(message);
    else result[index] = message;
  }
  return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id - b.id);
}

/** Keep events received while a history request was in flight, including edits. */
export function reconcileHistory<T extends IdentifiedMessage>(history: T[], queued: T[], live: T[]): T[] {
  return mergeMessages(mergeMessages(queued, history), live);
}

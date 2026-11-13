// Prevent delayed acknowledgements and broadcasts from reviving locally closed calls.
export function createCallLifecycle() {
  let generation = 0;
  const closed = new Set<string>();
  return {
    ticket: () => generation,
    valid: (ticket: number, id: string) => ticket === generation && !closed.has(id),
    accepts: (id: string) => !closed.has(id),
    close(id: string) {
      closed.add(id);
      if (closed.size > 64) closed.delete(closed.values().next().value!);
    },
    reset() { generation++; closed.clear(); },
  };
}

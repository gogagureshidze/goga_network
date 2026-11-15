import type { Socket } from "socket.io-client";

type ActivityStatus = { showActivityStatus: boolean };

/** Rehydrate settings after reconnect without an older request overwriting a live change. */
export function observeActivityStatus(socket: Pick<Socket, "connected" | "on" | "off">, read: () => Promise<ActivityStatus>, onChange: (status: ActivityStatus) => void) {
  let closed = false;
  let revision = 0;
  const changed = (status: ActivityStatus) => {
    if (closed || typeof status.showActivityStatus !== "boolean") return;
    revision += 1;
    onChange(status);
  };
  const refresh = () => {
    const request = ++revision;
    void read().then((status) => { if (!closed && socket.connected && request === revision && typeof status.showActivityStatus === "boolean") onChange(status); }).catch(() => {});
  };
  const disconnected = () => { revision += 1; };
  socket.on("activityStatusChanged", changed);
  socket.on("connect", refresh);
  socket.on("disconnect", disconnected);
  if (socket.connected) refresh();
  return () => {
    closed = true;
    socket.off("activityStatusChanged", changed);
    socket.off("connect", refresh);
    socket.off("disconnect", disconnected);
  };
}

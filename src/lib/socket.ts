// // src/lib/socket.ts
// import { io, Socket } from "socket.io-client";

// let socket: Socket | null = null;

// export const getSocket = (userId: string): Socket => {
//   if (!socket) {
//     socket = io("wss://socket.goga.network", {
//       query: { userId },
//       transports: ["websocket"],
//       reconnection: true,
//       reconnectionAttempts: 10,
//       reconnectionDelay: 1000,
//     });
//   }
//   return socket;
// };

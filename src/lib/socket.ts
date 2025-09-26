// // src/lib/socket.ts
// import { io, Socket } from "socket.io-client";

// export const createSocket = (userId: string): Socket => {
//   const socket: Socket = io("wss://socket.goga.network", {
//     transports: ["websocket"],
//     path: "/socket.io",
//     reconnection: true,
//     reconnectionAttempts: 10,
//     reconnectionDelay: 1000,
//     query: { userId }, // pass userId on connect
//     withCredentials: true,
//   });
//   return socket;
// };

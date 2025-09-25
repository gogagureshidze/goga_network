const { createServer } = require("http");
const { Server } = require("socket.io");
const { PrismaClient } = require("./src/generated/prisma");
const prisma = new PrismaClient();

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://f69f1cfbb69b.ngrok-free.app",
      "https://goga-network-ahy0nnnnb-gogagureshidzes-projects.vercel.app",
      "https://goga-network.vercel.app",
      "https://goga-network.onrender.com",
      "https://goganetwork.netlify.app",
      "https://goga.network",
      "https://www.goga.network",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Track online users with socket mapping for proper cleanup
const onlineUsers = new Map(); // userId -> Set of socketIds

const broadcastOnlineCount = () => {
  const count = onlineUsers.size;
  const userList = Array.from(onlineUsers.keys());
  io.emit("onlineCount", count);
  console.log(`📡 Broadcast online count: ${count} users`);
  console.log(`👥 Online users: [${userList.join(", ")}]`);

  // Log all socket connections per user
  for (const [userId, sockets] of onlineUsers.entries()) {
    console.log(
      `   - User ${userId}: ${sockets.size} connections [${Array.from(
        sockets
      ).join(", ")}]`
    );
  }
};

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId?.toString();
  console.log(
    `✅ User ${userId || "unknown"} connected (socket: ${socket.id})`
  );

  if (userId) {
    // Add user to online tracking
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join user to their own room for targeted messaging
    socket.join(userId);

    console.log(
      `👤 User ${userId} now has ${
        onlineUsers.get(userId).size
      } active connections`
    );
    broadcastOnlineCount();
  } else {
    console.warn("⚠️ No userId provided in handshake query.");
  }

  // Send current online count immediately to new connection
  socket.emit("onlineCount", onlineUsers.size);

  socket.on("sendMessage", async (data) => {
    try {
      console.log("💬 Sending message:", data);

      const conversation =
        (await prisma.conversation.findFirst({
          where: {
            OR: [
              { user1Id: data.senderId, user2Id: data.receiverId },
              { user1Id: data.receiverId, user2Id: data.senderId },
            ],
          },
        })) ||
        (await prisma.conversation.create({
          data: { user1Id: data.senderId, user2Id: data.receiverId },
        }));

      const newMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: data.senderId,
          receiverId: data.receiverId,
          text: data.text,
        },
      });

      // Send to receiver's room (all their active connections)
      io.to(data.receiverId).emit("receiveMessage", newMessage);

      console.log(
        `✉️ Message sent from ${data.senderId} to ${data.receiverId}`
      );
    } catch (err) {
      console.error("❌ Error saving message:", err);
      socket.emit("messageError", { error: "Failed to send message" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket ${socket.id} disconnected`);

    if (userId) {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // If user has no more active connections, remove them completely
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          console.log(`👋 User ${userId} is now offline`);
        } else {
          console.log(
            `🔌 User ${userId} still has ${userSockets.size} active connections`
          );
        }

        broadcastOnlineCount();
      }
    }
  });

  // Handle connection errors
  socket.on("error", (error) => {
    console.error("🚨 Socket error:", error);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  httpServer.close(() => {
    prisma.$disconnect();
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  httpServer.close(() => {
    prisma.$disconnect();
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
  console.log(`🌐 CORS origins configured for multiple domains`);
});

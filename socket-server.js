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
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Track online users (unique IDs)
const onlineUsers = new Set();

const broadcastOnlineCount = () => {
  const count = onlineUsers.size;
  io.emit("onlineCount", count);
  console.log(`📡 Broadcast online count: ${count}`);
};

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId?.toString();
  console.log(
    `✅ User ${userId || "unknown"} connected (socket: ${socket.id})`
  );

  if (userId) {
    onlineUsers.add(userId);
    broadcastOnlineCount();
  } else {
    console.warn("⚠️ No userId provided in handshake query.");
  }

  socket.on("sendMessage", async (data) => {
    try {
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

      io.to(data.receiverId).emit("receiveMessage", newMessage);
    } catch (err) {
      console.error("❌ Error saving message:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(
      `❌ User ${userId || "unknown"} disconnected (socket: ${socket.id})`
    );
    if (userId) {
      onlineUsers.delete(userId);
      broadcastOnlineCount();
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
});

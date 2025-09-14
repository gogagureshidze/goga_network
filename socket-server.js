const { createServer } = require("http");
const { Server } = require("socket.io");
const { PrismaClient } = require("./src/generated/prisma");
const prisma = new PrismaClient();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ["GET", "POST", "DELETE", "PUT"],
  },
});

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log(`User ${userId} connected with socket ID ${socket.id}`);
  if (userId) {
    socket.join(userId);
  }

  socket.on("sendMessage", async (data) => {
    try {
      // Find or create a conversation
      const conversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { user1Id: data.senderId, user2Id: data.receiverId },
            { user1Id: data.receiverId, user2Id: data.senderId },
          ],
        },
      });

      let conversationId;
      if (conversation) {
        conversationId = conversation.id;
      } else {
        const newConversation = await prisma.conversation.create({
          data: {
            user1Id: data.senderId,
            user2Id: data.receiverId,
          },
        });
        conversationId = newConversation.id;
      }

      // Save the message to the database with the conversationId
      const newMessage = await prisma.message.create({
        data: {
          conversationId: conversationId,
          senderId: data.senderId,
          receiverId: data.receiverId,
          text: data.text,
        },
      });

      // Broadcast the message to the specific rooms of both the sender and receiver
      io.to(data.senderId).emit("receiveMessage", newMessage);
      io.to(data.receiverId).emit("receiveMessage", newMessage);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User ${userId} disconnected`);
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});

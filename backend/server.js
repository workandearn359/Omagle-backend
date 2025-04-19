const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Message = require("./models/Message");

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.get("/", (req, res) => res.send("Omagle Backend Live ✅"));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => console.error("MongoDB Error ❌", err));

// --- In-memory pairing logic ---
let waitingUsers = [];
const pairMap = new Map();

function matchUsers() {
  while (waitingUsers.length >= 2) {
    const user1 = waitingUsers.shift();
    const index = waitingUsers.findIndex(
      (u) => u.mood === user1.mood && u.interests.some(i => user1.interests.includes(i))
    );
    if (index !== -1) {
      const user2 = waitingUsers.splice(index, 1)[0];

      pairMap.set(user1.id, user2.id);
      pairMap.set(user2.id, user1.id);

      io.to(user1.id).emit("match", { partnerId: user2.id });
      io.to(user2.id).emit("match", { partnerId: user1.id });
    } else {
      waitingUsers.push(user1); // requeue if no match
      break;
    }
  }
}

io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on("findStranger", ({ mood, interests }) => {
    socket.mood = mood || "";
    socket.interests = interests || [];
    waitingUsers.push({ id: socket.id, mood: socket.mood, interests: socket.interests });
    socket.emit("searching");
    matchUsers();
  });

  socket.on("chat message", async ({ to, message }) => {
    if (to && io.sockets.sockets.get(to)) {
      io.to(to).emit("chat message", { from: socket.id, message });
      await Message.create({ from: socket.id, to, message, timestamp: new Date() });
    }
  });

  socket.on("next", () => {
    const partnerId = pairMap.get(socket.id);
    if (partnerId && io.sockets.sockets.get(partnerId)) {
      io.to(partnerId).emit("stranger disconnected");
      pairMap.delete(partnerId);
    }
    pairMap.delete(socket.id);
    socket.emit("searching");
    const index = waitingUsers.findIndex(u => u.id === socket.id);
    if (index !== -1) waitingUsers.splice(index, 1);
    waitingUsers.push({ id: socket.id, mood: socket.mood, interests: socket.interests });
    matchUsers();
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    const partnerId = pairMap.get(socket.id);
    if (partnerId && io.sockets.sockets.get(partnerId)) {
      io.to(partnerId).emit("stranger disconnected");
      pairMap.delete(partnerId);
    }
    pairMap.delete(socket.id);
    const index = waitingUsers.findIndex(u => u.id === socket.id);
    if (index !== -1) waitingUsers.splice(index, 1);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

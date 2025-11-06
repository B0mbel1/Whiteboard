const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

let users = [];

io.on("connection", (socket) => {
  console.log("✅ Użytkownik podłączony:", socket.id);

  socket.on("join", (user) => {
    users.push({ id: socket.id, ...user });
    console.log("👤 Dołączył:", user);
    io.emit("users", users);
  });

  socket.on("chat-message", (msg) => {
    io.emit("chat-message", msg);
  });

  socket.on("disconnect", () => {
    users = users.filter(u => u.id !== socket.id);
    io.emit("users", users);
    console.log("❌ Użytkownik rozłączony:", socket.id);
  });
});

server.listen(3001, () => {
  console.log("✅ Serwer działa na: http://localhost:3001");
});
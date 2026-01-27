const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const server = http.createServer(app);
const videoFileUsage = new Map();

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  maxHttpBufferSize: 1e8
});

// Middleware
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-file-name');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.mp4')) {
        res.setHeader('Content-Type', 'video/mp4');
      }
      if (filePath.endsWith('.webm')) {
        res.setHeader('Content-Type', 'video/webm');
      }
    }
  })
);

// Baza danych
const whiteboards = new Map();

// Endpointy
app.get('/', (req, res) => res.json({ message: 'Server OK' }));
app.get('/api/create-whiteboard', (req, res) => {
  const whiteboardId = generateId();
  whiteboards.set(whiteboardId, {
    users: new Map(),
    drawingData: [],
    textBoxes: [],
    notes: [],
    gifs: [],
    images: [],
    shapes: [],
    emojis: [],
    videos: [], // Tablica, nie Map
    backgroundMode: 'grid',
    chatMessages: []
  });
  res.json({ success: true, whiteboardId });
});

app.get('/api/whiteboard/:id', (req, res) => {
  res.json({ exists: whiteboards.has(req.params.id) });
});

// Upload video
app.post('/api/upload-video', (req, res) => {
  const fileName = req.headers['x-file-name']
    ? decodeURIComponent(req.headers['x-file-name'])
    : `video_${Date.now()}.mp4`;
  const uploadDir = 'uploads/videos';
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, fileName);
  const fileStream = fs.createWriteStream(filePath);
  
  req.pipe(fileStream);
  req.on('aborted', () => {
    fileStream.destroy();
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
  });
  
  fileStream.on('finish', () => {
    const stats = fs.statSync(filePath);
    res.json({
      success: true,
      videoUrl: `/uploads/videos/${fileName}`,
      fileName,
      size: stats.size
    });
  });
  
  fileStream.on('error', err => {
    console.error("File write error:", err);
    res.status(500).json({ error: 'Write failed' });
  });
});

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);
  let currentWhiteboardId = null;

  socket.on("join-whiteboard", (data) => {
    const { whiteboardId, user } = data;
    
    if (currentWhiteboardId && whiteboards.has(currentWhiteboardId)) {
      const prevWb = whiteboards.get(currentWhiteboardId);
      if (prevWb.users.has(socket.id)) {
        prevWb.users.delete(socket.id);
        io.to(currentWhiteboardId).emit("user-left", {
          userId: socket.id,
          users: Array.from(prevWb.users.values())
        });
      }
    }
    
    if (!whiteboards.has(whiteboardId)) {
      whiteboards.set(whiteboardId, {
        users: new Map(),
        drawingData: [],
        textBoxes: [],
        notes: [],
        gifs: [],
        images: [],
        shapes: [],
        emojis: [],
        videos: [], // Tablica, nie Map
        backgroundMode: 'grid',
        chatMessages: []
      });
    }
    
    const whiteboard = whiteboards.get(whiteboardId);
    const userData = {
      ...user,
      id: user.id || socket.id,
      socketId: socket.id,
      position: { x: 0, y: 0 }
    };
    
    whiteboard.users.set(socket.id, userData);
    currentWhiteboardId = whiteboardId;
    socket.join(whiteboardId);
    
    socket.emit("whiteboard-data", {
      users: Array.from(whiteboard.users.values()),
      drawingData: whiteboard.drawingData,
      textBoxes: whiteboard.textBoxes,
      notes: whiteboard.notes,
      gifs: whiteboard.gifs,
      images: whiteboard.images,
      videos: whiteboard.videos, // Bez Array.from - to już tablica
      shapes: whiteboard.shapes,
      emojis: whiteboard.emojis,
      backgroundMode: whiteboard.backgroundMode
    });
    
    socket.emit("chat-history", {
      whiteboardId,
      messages: whiteboard.chatMessages
    });
    
    io.to(whiteboardId).emit("users-updated", {
      users: Array.from(whiteboard.users.values())
    });
    
    socket.to(whiteboardId).emit("user-joined", {
      user: userData,
      users: Array.from(whiteboard.users.values())
    });
    
    console.log(`👤 User ${userData.id} joined whiteboard ${whiteboardId}`);
  });

  // ========== VIDEO HANDLERS ==========
  socket.on("video-create", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (!wb) return;

    if (wb.videos.some(v => v.id === data.video.id)) return;

    const video = {
      ...data.video,
      lastUpdate: Date.now()
    };

    wb.videos.push(video);

    if (video.fileName) {
      const count = videoFileUsage.get(video.fileName) || 0;
      videoFileUsage.set(video.fileName, count + 1);
    }

    // ✅ POPRAWKA: Broadcast tylko do innych użytkowników (bez nadawcy)
    socket.to(data.whiteboardId).emit("video-create", {
      whiteboardId: data.whiteboardId,
      video
    });
    
    console.log(`🎥 Video created: ${data.video.id} in ${data.whiteboardId}`);
  });

  socket.on("video-update", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (!wb) return;
    
    const video = wb.videos.find(v => v.id === data.id);
    if (!video) return;
    
    // Sprawdź czy wideo jest YouTube
    const isYouTube = video.provider === 'youtube';
    
    // Aktualizuj tylko przekazane właściwości
    if (data.updates) {
      const now = Date.now();
      
      // Dla YouTube - mniejsze opóźnienie (100ms), dla reszty 200ms
      const minDelay = isYouTube ? 100 : 200;
      
      if (video.lastUpdate && now - video.lastUpdate < minDelay) {
        return;
      }
      
      // Aktualizuj tylko playing i currentTime
      if (data.updates.playing !== undefined) {
        video.playing = data.updates.playing;
      }
      if (data.updates.currentTime !== undefined) {
        video.currentTime = data.updates.currentTime;
      }
      
      video.lastUpdate = now;
    }
    
    // Broadcast do wszystkich INNYCH użytkowników
    socket.to(data.whiteboardId).emit("video-update", {
      id: data.id,
      updates: data.updates,
      timestamp: data.timestamp || Date.now(),
      isYouTube: isYouTube // Dodajemy flagę dla klienta
    });
  });

  socket.on("video-transform", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (!wb) return;
    
    const video = wb.videos.find(v => v.id === data.id);
    if (!video) return;

    // Aktualizuj pozycję i rozmiar
    if (data.updates.x !== undefined) video.x = data.updates.x;
    if (data.updates.y !== undefined) video.y = data.updates.y;
    if (data.updates.width !== undefined) video.width = data.updates.width;
    if (data.updates.height !== undefined) video.height = data.updates.height;
    
    video.lastUpdate = Date.now();
    
    // Broadcast do wszystkich innych użytkowników
    socket.to(data.whiteboardId).emit("video-transform", {
      id: data.id,
      updates: data.updates
    });
  });

  socket.on("video-delete", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (!wb) return;
    
    const videoIndex = wb.videos.findIndex(v => v.id === data.id);
    if (videoIndex === -1) return;
    
    const deletedVideo = wb.videos[videoIndex];
    
    // Usuń z tablicy
    wb.videos.splice(videoIndex, 1);
    
    // Zaktualizuj licznik użycia pliku
    if (deletedVideo.fileName) {
      const count = (videoFileUsage.get(deletedVideo.fileName) || 1) - 1;
      if (count <= 0) {
        videoFileUsage.delete(deletedVideo.fileName);
        const filePath = path.join("uploads/videos", deletedVideo.fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted video file: ${deletedVideo.fileName}`);
        }
      } else {
        videoFileUsage.set(deletedVideo.fileName, count);
      }
    }

    // Broadcast do WSZYSTKICH użytkowników (w tym nadawcy)
    io.to(data.whiteboardId).emit("video-delete", {
      id: data.id
    });
    
    console.log(`🎥 Video deleted: ${data.id} from ${data.whiteboardId}`);
  });

  // ========== USER HANDLERS ==========
  socket.on("user-update", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.users.has(socket.id)) {
      Object.assign(wb.users.get(socket.id), data.updates);
      io.to(data.whiteboardId).emit("users-updated", {
        users: Array.from(wb.users.values())
      });
    }
  });

  // ========== TEXT HANDLERS ==========
  socket.on("text-create", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      if (!wb.textBoxes) wb.textBoxes = [];
      wb.textBoxes.push(data.textBox);
      socket.to(data.whiteboardId).emit("text-create", data);
      console.log(`📝 Text created: ${data.textBox.id}`);
    }
  });

  socket.on("text-update", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.textBoxes) {
      const textBox = wb.textBoxes.find(x => x.id === data.id);
      if (textBox) Object.assign(textBox, data.updates || data);
      socket.to(data.whiteboardId).emit("text-update", data);
    }
  });

  socket.on("text-delete", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.textBoxes) {
      wb.textBoxes = wb.textBoxes.filter(x => x.id !== data.id);
      socket.to(data.whiteboardId).emit("text-delete", data);
      console.log(`📝 Text deleted: ${data.id}`);
    }
  });

  // ========== NOTE HANDLERS ==========
  socket.on("note-create", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      if (!wb.notes) wb.notes = [];
      wb.notes.push(data.note);
      socket.to(data.whiteboardId).emit("note-create", data);
      console.log(`📒 Note created: ${data.note.id}`);
    }
  });

  socket.on("note-update", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.notes) {
      const note = wb.notes.find(x => x.id === data.id);
      if (note) Object.assign(note, data.updates || data);
      socket.to(data.whiteboardId).emit("note-update", data);
    }
  });

  socket.on("note-delete", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.notes) {
      wb.notes = wb.notes.filter(x => x.id !== data.id);
      socket.to(data.whiteboardId).emit("note-delete", data);
      console.log(`📒 Note deleted: ${data.id}`);
    }
  });

  // ========== EMOJI HANDLERS ==========
  socket.on("emoji-create", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      if (!wb.emojis) wb.emojis = [];
      wb.emojis.push(data.emoji);
      socket.to(data.whiteboardId).emit("emoji-create", data);
      console.log(`😊 Emoji created: ${data.emoji.id}`);
    }
  });

  socket.on("emoji-update", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.emojis) {
      const emoji = wb.emojis.find(x => x.id === data.id);
      if (emoji) Object.assign(emoji, data.updates || data);
      socket.to(data.whiteboardId).emit("emoji-update", data);
    }
  });

  socket.on("emoji-delete", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.emojis) {
      wb.emojis = wb.emojis.filter(x => x.id !== data.id);
      socket.to(data.whiteboardId).emit("emoji-delete", data);
      console.log(`😊 Emoji deleted: ${data.id}`);
    }
  });

  // ========== GIF HANDLERS ==========
  socket.on("gif-create", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      if (!wb.gifs) wb.gifs = [];
      wb.gifs.push(data.gif);
      socket.to(data.whiteboardId).emit("gif-create", data);
      console.log(`🎬 GIF created: ${data.gif.id}`);
    }
  });

  socket.on("gif-update", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.gifs) {
      const gif = wb.gifs.find(x => x.id === data.id);
      if (gif) Object.assign(gif, data.updates || data);
      socket.to(data.whiteboardId).emit("gif-update", data);
    }
  });

  socket.on("gif-delete", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.gifs) {
      wb.gifs = wb.gifs.filter(x => x.id !== data.id);
      socket.to(data.whiteboardId).emit("gif-delete", data);
      console.log(`🎬 GIF deleted: ${data.id}`);
    }
  });

  // ========== IMAGE HANDLERS ==========
  socket.on("image-create", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      if (!wb.images) wb.images = [];
      wb.images.push(data.image);
      socket.to(data.whiteboardId).emit("image-create", data);
      console.log(`🖼️ Image created: ${data.image.id}`);
    }
  });

  socket.on("image-update", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.images) {
      const image = wb.images.find(x => x.id === data.id);
      if (image) Object.assign(image, data.updates || data);
      socket.to(data.whiteboardId).emit("image-update", data);
    }
  });

  socket.on("image-delete", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.images) {
      wb.images = wb.images.filter(x => x.id !== data.id);
      socket.to(data.whiteboardId).emit("image-delete", data);
      console.log(`🖼️ Image deleted: ${data.id}`);
    }
  });

  // ========== SHAPE HANDLERS ==========
  socket.on("shape-create", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      if (!wb.shapes) wb.shapes = [];
      wb.shapes.push(data.shape);
      socket.to(data.whiteboardId).emit("shape-create", data);
      console.log(`🔷 Shape created: ${data.shape.id}`);
    }
  });

  socket.on("shape-update", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.shapes) {
      const shape = wb.shapes.find(x => x.id === data.id);
      if (shape) Object.assign(shape, data.updates || data);
      socket.to(data.whiteboardId).emit("shape-update", data);
    }
  });

  socket.on("shape-delete", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb && wb.shapes) {
      wb.shapes = wb.shapes.filter(x => x.id !== data.id);
      socket.to(data.whiteboardId).emit("shape-delete", data);
      console.log(`🔷 Shape deleted: ${data.id}`);
    }
  });

  // ========== DRAWING HANDLERS ==========
  socket.on("drawing", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      wb.drawingData.push(data);
      if (wb.drawingData.length > 1000) wb.drawingData.shift();
      socket.to(data.whiteboardId).emit("drawing", data);
    }
  });

  socket.on("erase-area", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      const eraseAction = {
        type: 'erase-area',
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        whiteboardId: data.whiteboardId,
        timestamp: data.timestamp || Date.now()
      };

      wb.drawingData.push(eraseAction);
      if (wb.drawingData.length > 20000) wb.drawingData.shift();
      socket.to(data.whiteboardId).emit("erase-area", eraseAction);
    }
  });

  // ========== CURSOR HANDLERS ==========
  socket.on("cursor-move", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      const user = wb.users.get(socket.id);
      if (user) {
        user.position = data.position;
        socket.to(data.whiteboardId).emit("cursor-move", {
          userId: socket.id,
          position: data.position,
          user
        });
      }
    }
  });

  socket.on("pointer-move", (data) => socket.to(data.whiteboardId).emit("pointer-move", data));
  socket.on("pointer-click", (data) => socket.to(data.whiteboardId).emit("pointer-click", data));

  // ========== CHAT HANDLERS ==========
  socket.on("chat-message", (data) => {
    const { whiteboardId, message } = data;
    const wb = whiteboards.get(whiteboardId);
    if (!wb) return;
    
    if (!wb.chatMessages) wb.chatMessages = [];
    const completeMessage = {
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user: {
        id: message.user?.id || socket.id,
        name: message.user?.name || 'Unknown',
        color: message.user?.color || '#666'
      },
      text: message.text,
      timestamp: message.timestamp || new Date().toISOString(),
      whiteboardId
    };
    
    wb.chatMessages.push(completeMessage);
    if (wb.chatMessages.length > 200) wb.chatMessages.shift();
    
    io.to(whiteboardId).emit("chat-message", { whiteboardId, message: completeMessage });
    
    console.log(`💬 Chat message in ${whiteboardId} from ${completeMessage.user.name}`);
  });

  socket.on("get-chat-history", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      socket.emit("chat-history", {
        whiteboardId: data.whiteboardId,
        messages: wb.chatMessages || []
      });
    }
  });

  // ========== WEBRTC HANDLERS ==========
  socket.on("call-user", (data) => socket.to(data.to).emit("call-made", { offer: data.offer, socket: socket.id }));
  socket.on("make-answer", (data) => socket.to(data.to).emit("answer-made", { answer: data.answer, socket: socket.id }));
  socket.on("ice-candidate", (data) => socket.to(data.to).emit("ice-candidate", { candidate: data.candidate, socket: socket.id }));

  // ========== BACKGROUND HANDLERS ==========
  socket.on("background-update", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      wb.backgroundMode = data.mode;
      io.to(data.whiteboardId).emit("background-update", { mode: data.mode });
      console.log(`🎨 Background updated to ${data.mode} in ${data.whiteboardId}`);
    }
  });

  // ========== REFRESH HANDLERS ==========
  socket.on("refresh-whiteboard-data", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      socket.emit("whiteboard-data", {
        users: Array.from(wb.users.values()),
        drawingData: wb.drawingData,
        textBoxes: wb.textBoxes,
        notes: wb.notes,
        gifs: wb.gifs,
        images: wb.images,
        videos: wb.videos, // Bez Array.from
        shapes: wb.shapes,
        emojis: wb.emojis,
        backgroundMode: wb.backgroundMode
      });
      
      socket.emit("chat-history", {
        whiteboardId: data.whiteboardId,
        messages: wb.chatMessages || []
      });
      
      console.log(`🔄 Whiteboard data refreshed for ${socket.id}`);
    }
  });

  // ========== DISCONNECT HANDLER ==========
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    if (!currentWhiteboardId || !whiteboards.has(currentWhiteboardId)) return;

    const whiteboard = whiteboards.get(currentWhiteboardId);

    whiteboard.users.delete(socket.id);
    io.to(currentWhiteboardId).emit("user-left", {
      userId: socket.id,
      users: Array.from(whiteboard.users.values())
    });

    // Sprzątanie video plików jeśli nikt już ich nie używa
    if (whiteboard.users.size === 0) {
      whiteboard.videos.forEach(v => {
        if (v.fileName) {
          const count = (videoFileUsage.get(v.fileName) || 1) - 1;
          if (count <= 0) {
            videoFileUsage.delete(v.fileName);
            const filePath = path.join("uploads/videos", v.fileName);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Cleanup: Deleted unused video file: ${v.fileName}`);
            }
          } else {
            videoFileUsage.set(v.fileName, count);
          }
        }
      });

      // Usuń whiteboard z pamięci jeśli nie ma już użytkowników
      whiteboards.delete(currentWhiteboardId);
      console.log("🧹 Whiteboard usunięty z pamięci:", currentWhiteboardId);
    }
  });
});

function generateId() {
  return Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 SERVER RUNNING: http://localhost:${PORT}`);
  
  const uploadDir = 'uploads/videos';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`📁 Created upload directory: ${uploadDir}`);
  }
});
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const server = http.createServer(app);

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

app.use('/uploads', express.static('uploads'));

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
    videos: new Map(),
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

// Process video link
app.post('/api/process-video-link', express.json(), async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const videoId = extractYouTubeId(url);
    if (videoId) return res.json({
      success: true,
      type: 'youtube',
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    });
  }
  
  if (url.includes('vimeo.com')) {
    const videoId = extractVimeoId(url);
    if (videoId) return res.json({
      success: true,
      type: 'vimeo',
      videoId,
      embedUrl: `https://player.vimeo.com/video/${videoId}`,
      thumbnail: await getVimeoThumbnail(videoId)
    });
  }
  
  if (url.match(/\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)$/i)) {
    return res.json({
      success: true,
      type: 'direct',
      url,
      canEmbed: true
    });
  }
  
  return res.json({
    success: true,
    type: 'generic',
    url,
    canEmbed: true
  });
});

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/watch\?v=([^"&?\/\s]{11})/,
    /youtube\.com\/embed\/([^"&?\/\s]{11})/,
    /youtu\.be\/([^"&?\/\s]{11})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

function extractVimeoId(url) {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /vimeo\.com\/video\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

async function getVimeoThumbnail(videoId) {
  return new Promise(resolve => {
    https.get(`https://vimeo.com/api/v2/video/${videoId}.json`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json[0]?.thumbnail_large || null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

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
        videos: new Map(),
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
      videos: Array.from(whiteboard.videos.values()),
      shapes: whiteboard.shapes,
      emojis: whiteboard.emojis,
      backgroundMode: whiteboard.backgroundMode
    });
    
    socket.emit("chat-history", {
      whiteboardId,
      messages: whiteboard.chatMessages
    });
    
    whiteboard.videos.forEach((video, videoId) => {
      socket.emit("video-sync", {
        whiteboardId,
        videoId,
        state: {
          playing: video.playing,
          currentTime: video.currentTime,
          volume: video.volume || 0.5,
          muted: video.muted || false
        }
      });
    });
    
    io.to(whiteboardId).emit("users-updated", {
      users: Array.from(whiteboard.users.values())
    });
    
    socket.to(whiteboardId).emit("user-joined", {
      user: userData,
      users: Array.from(whiteboard.users.values())
    });
  });

  // ========== VIDEO HANDLERS ==========
  socket.on("video-create", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (!wb || wb.videos.has(d.video.id)) return;
    
    const video = {
      ...d.video,
      id: d.video.id || `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      playing: false,
      currentTime: 0,
      volume: 0.5,
      muted: false,
      lastUpdated: Date.now(),
      lastUpdatedBy: socket.id
    };
    
    wb.videos.set(video.id, video);
    io.to(d.whiteboardId).emit("video-create", { whiteboardId: d.whiteboardId, video });
  });

  socket.on("video-update", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (!wb) return;
    const video = wb.videos.get(d.id);
    if (!video) return;
    
    const updates = d.updates || {};
    if (updates.x !== undefined) video.x = updates.x;
    if (updates.y !== undefined) video.y = updates.y;
    if (updates.width !== undefined) video.width = updates.width;
    if (updates.height !== undefined) video.height = updates.height;
    
    video.lastUpdated = Date.now();
    video.lastUpdatedBy = socket.id;
    
    socket.to(d.whiteboardId).emit("video-update", {
      id: d.id,
      updates,
      fromUserId: socket.id
    });
  });

  socket.on("video-volume", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (!wb) return;
    const video = wb.videos.get(d.id);
    if (!video) return;
    
    if (d.volume !== undefined) video.volume = d.volume;
    if (d.muted !== undefined) video.muted = d.muted;
    video.lastUpdated = Date.now();
    video.lastUpdatedBy = socket.id;
    
    socket.to(d.whiteboardId).emit("video-volume", {
      id: d.id,
      volume: d.volume,
      muted: d.muted,
      fromUserId: socket.id,
      timestamp: Date.now()
    });
  });

  socket.on("video-delete", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (!wb) return;
    wb.videos.delete(d.id);
    io.to(d.whiteboardId).emit("video-delete", {
      id: d.id,
      fromUserId: socket.id
    });
  });

  // Playback events
  socket.on("video-play", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (!wb) return;
    const video = wb.videos.get(d.id);
    if (!video) return;
    
    video.playing = true;
    video.currentTime = d.currentTime || 0;
    video.lastUpdated = Date.now();
    video.lastUpdatedBy = socket.id;
    
    io.to(d.whiteboardId).emit("video-play", {
      id: d.id,
      currentTime: video.currentTime,
      volume: video.volume,
      muted: video.muted,
      fromUserId: socket.id,
      timestamp: Date.now()
    });
  });

  socket.on("video-pause", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (!wb) return;
    const video = wb.videos.get(d.id);
    if (!video) return;
    
    video.playing = false;
    video.currentTime = d.currentTime || 0;
    video.lastUpdated = Date.now();
    video.lastUpdatedBy = socket.id;
    
    io.to(d.whiteboardId).emit("video-pause", {
      id: d.id,
      currentTime: video.currentTime,
      volume: video.volume,
      muted: video.muted,
      fromUserId: socket.id,
      timestamp: Date.now()
    });
  });

  socket.on("video-seek", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (!wb) return;
    const video = wb.videos.get(d.id);
    if (!video) return;
    
    if (typeof d.currentTime === 'number') {
      video.currentTime = d.currentTime;
      video.lastUpdated = Date.now();
      video.lastUpdatedBy = socket.id;
      
      io.to(d.whiteboardId).emit("video-seek", {
        id: d.id,
        currentTime: video.currentTime,
        volume: video.volume,
        muted: video.muted,
        fromUserId: socket.id,
        timestamp: Date.now()
      });
    }
  });

  socket.on("video-sync-request", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (!wb) return;
    const video = wb.videos.get(d.videoId);
    if (!video) return;
    
    socket.emit("video-sync", {
      videoId: d.videoId,
      whiteboardId: d.whiteboardId,
      state: {
        playing: video.playing,
        currentTime: video.currentTime,
        volume: video.volume || 0.5,
        muted: video.muted || false
      }
    });
  });

  // Other handlers (skrócone)
  socket.on("user-update", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.users.has(socket.id)) {
      Object.assign(wb.users.get(socket.id), d.updates);
      io.to(d.whiteboardId).emit("users-updated", {
        users: Array.from(wb.users.values())
      });
    }
  });

  // Tekst
  socket.on("text-create", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.textBoxes) wb.textBoxes = [];
      wb.textBoxes.push(d.textBox);
      socket.to(d.whiteboardId).emit("text-create", d);
    }
  });

  socket.on("text-update", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.textBoxes) {
      const t = wb.textBoxes.find(x => x.id === d.id);
      if (t) Object.assign(t, d);
      socket.to(d.whiteboardId).emit("text-update", d);
    }
  });

  socket.on("text-delete", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.textBoxes) {
      wb.textBoxes = wb.textBoxes.filter(x => x.id !== d.id);
      socket.to(d.whiteboardId).emit("text-delete", d);
    }
  });

  // Notatki
  socket.on("note-create", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.notes) wb.notes = [];
      wb.notes.push(d.note);
      socket.to(d.whiteboardId).emit("note-create", d);
    }
  });

  socket.on("note-update", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.notes) {
      const n = wb.notes.find(x => x.id === d.id);
      if (n) Object.assign(n, d);
      socket.to(d.whiteboardId).emit("note-update", d);
    }
  });

  socket.on("note-delete", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.notes) {
      wb.notes = wb.notes.filter(x => x.id !== d.id);
      socket.to(d.whiteboardId).emit("note-delete", d);
    }
  });

  // Emoji
  socket.on("emoji-create", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.emojis) wb.emojis = [];
      wb.emojis.push(d.emoji);
      socket.to(d.whiteboardId).emit("emoji-create", d);
    }
  });

  socket.on("emoji-update", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.emojis) {
      const e = wb.emojis.find(x => x.id === d.id);
      if (e) Object.assign(e, d);
      socket.to(d.whiteboardId).emit("emoji-update", d);
    }
  });

  socket.on("emoji-delete", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.emojis) {
      wb.emojis = wb.emojis.filter(x => x.id !== d.id);
      socket.to(d.whiteboardId).emit("emoji-delete", d);
    }
  });

  // GIFy
  socket.on("gif-create", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.gifs) wb.gifs = [];
      wb.gifs.push(d.gif);
      socket.to(d.whiteboardId).emit("gif-create", d);
    }
  });

  socket.on("gif-update", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.gifs) {
      const g = wb.gifs.find(x => x.id === d.id);
      if (g) Object.assign(g, d);
      socket.to(d.whiteboardId).emit("gif-update", d);
    }
  });

  socket.on("gif-delete", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.gifs) {
      wb.gifs = wb.gifs.filter(x => x.id !== d.id);
      socket.to(d.whiteboardId).emit("gif-delete", d);
    }
  });

  // Obrazy
  socket.on("image-create", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.images) wb.images = [];
      wb.images.push(d.image);
      socket.to(d.whiteboardId).emit("image-create", d);
    }
  });

  socket.on("image-update", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.images) {
      const img = wb.images.find(x => x.id === d.id);
      if (img) Object.assign(img, d);
      socket.to(d.whiteboardId).emit("image-update", d);
    }
  });

  socket.on("image-delete", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.images) {
      wb.images = wb.images.filter(x => x.id !== d.id);
      socket.to(d.whiteboardId).emit("image-delete", d);
    }
  });

  // Kształty
  socket.on("shape-create", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.shapes) wb.shapes = [];
      wb.shapes.push(d.shape);
      socket.to(d.whiteboardId).emit("shape-create", d);
    }
  });

  socket.on("shape-update", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.shapes) {
      const s = wb.shapes.find(x => x.id === d.id);
      if (s) Object.assign(s, d);
      socket.to(d.whiteboardId).emit("shape-update", d);
    }
  });

  socket.on("shape-delete", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.shapes) {
      wb.shapes = wb.shapes.filter(x => x.id !== d.id);
      socket.to(d.whiteboardId).emit("shape-delete", d);
    }
  });

  // Rysowanie
  socket.on("drawing", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      wb.drawingData.push(d);
      if (wb.drawingData.length > 1000) wb.drawingData.shift();
      socket.to(d.whiteboardId).emit("drawing", d);
    }
  });

  socket.on("erase-area", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      wb.drawingData.push({
        type: 'erase-area',
<<<<<<< Updated upstream
        x: d.x,
        y: d.y,
        width: d.width,
        height: d.height,
        whiteboardId: d.whiteboardId,
        timestamp: d.timestamp || Date.now()
      };

      wb.drawingData.push(eraseAction);
      if (wb.drawingData.length > 20000) wb.drawingData.shift();
      broadcast(d.whiteboardId, "erase-area", eraseAction);
=======
        ...d
      });
      socket.to(d.whiteboardId).emit("erase-area", d);
>>>>>>> Stashed changes
    }
  });

  // Kursor
  socket.on("cursor-move", d => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      const user = wb.users.get(socket.id);
      if (user) {
        user.position = d.position;
        socket.to(d.whiteboardId).emit("cursor-move", {
          userId: socket.id,
          position: d.position,
          user
        });
      }
    }
  });

  socket.on("pointer-move", d => socket.to(d.whiteboardId).emit("pointer-move", d));
  socket.on("pointer-click", d => socket.to(d.whiteboardId).emit("pointer-click", d));

  // Czat
  socket.on("chat-message", data => {
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
  });

  socket.on("get-chat-history", data => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      socket.emit("chat-history", {
        whiteboardId: data.whiteboardId,
        messages: wb.chatMessages || []
      });
    }
  });

  // WebRTC
  socket.on("call-user", d => socket.to(d.to).emit("call-made", { offer: d.offer, socket: socket.id }));
  socket.on("make-answer", d => socket.to(d.to).emit("answer-made", { answer: d.answer, socket: socket.id }));
  socket.on("ice-candidate", d => socket.to(d.to).emit("ice-candidate", { candidate: d.candidate, socket: socket.id }));

  // Tło
  socket.on("background-update", data => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      wb.backgroundMode = data.mode;
      io.to(data.whiteboardId).emit("background-update", { mode: data.mode });
    }
  });

  // Odświeżanie
  socket.on("refresh-whiteboard-data", data => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      socket.emit("whiteboard-data", {
        users: Array.from(wb.users.values()),
        drawingData: wb.drawingData,
        textBoxes: wb.textBoxes,
        notes: wb.notes,
        gifs: wb.gifs,
        images: wb.images,
        videos: Array.from(wb.videos.values()),
        shapes: wb.shapes,
        emojis: wb.emojis,
        backgroundMode: wb.backgroundMode
      });
      
      socket.emit("chat-history", {
        whiteboardId: data.whiteboardId,
        messages: wb.chatMessages || []
      });
    }
  });

  // Rozłączenie
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    if (currentWhiteboardId && whiteboards.has(currentWhiteboardId)) {
      const whiteboard = whiteboards.get(currentWhiteboardId);
      whiteboard.users.delete(socket.id);
      io.to(currentWhiteboardId).emit("user-left", {
        userId: socket.id,
        users: Array.from(whiteboard.users.values())
      });
    }
  });
});

function generateId() {
  return Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 SERVER RUNNING: http://localhost:${PORT}`);
  console.log(`🎬 Video synchronization: FIXED`);
  
  const uploadDir = 'uploads/videos';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`📁 Created upload directory: ${uploadDir}`);
  }
});
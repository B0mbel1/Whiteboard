const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Add express middleware to parse JSON
app.use(express.json());

// Add CORS middleware for Express routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Store whiteboards and users
const whiteboards = new Map();
// Track which users have joined which whiteboards to prevent duplicates
const userJoinTracker = new Map();

// Simple test route
app.get('/', (req, res) => {
  res.json({ message: 'Whiteboard server is running!' });
});

// Create whiteboard endpoint
app.get('/api/create-whiteboard', (req, res) => {
  try {
    const whiteboardId = generateId();
    whiteboards.set(whiteboardId, {
      users: new Map(),
      drawingData: [],
      textBoxes: [],
      notes: []
    });
    console.log(`📝 Created new whiteboard: ${whiteboardId}`);
    res.json({ 
      success: true,
      whiteboardId: whiteboardId 
    });
  } catch (error) {
    console.error('Error creating whiteboard:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create whiteboard' 
    });
  }
});

// Check if whiteboard exists
app.get('/api/whiteboard/:id', (req, res) => {
  const whiteboardId = req.params.id;
  const exists = whiteboards.has(whiteboardId);
  res.json({ exists });
});

// Helper function to log whiteboard state
function logWhiteboardState(whiteboardId) {
  const whiteboard = whiteboards.get(whiteboardId);
  if (whiteboard) {
    console.log(`📊 Whiteboard ${whiteboardId} state:`);
    console.log(`   Users: ${Array.from(whiteboard.users.values()).map(u => `${u.name} (${u.id})`).join(', ')}`);
    console.log(`   Drawings: ${whiteboard.drawingData.length}`);
  }
}

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // Track if this socket has already joined a whiteboard
  let hasJoinedWhiteboard = false;

  // Join a specific whiteboard room
  socket.on("join-whiteboard", (data) => {
    const { whiteboardId, user } = data;
    
    // Prevent multiple joins from the same socket
    if (hasJoinedWhiteboard) {
      console.log(`⚠️ Socket ${socket.id} already joined a whiteboard, ignoring duplicate join`);
      return;
    }
    
    console.log(`👤 User ${user.name} trying to join: ${whiteboardId}`);
    
    // Create whiteboard if it doesn't exist (for direct URL access)
    if (!whiteboards.has(whiteboardId)) {
      whiteboards.set(whiteboardId, {
        users: new Map(),
        drawingData: [],
        textBoxes: [],
        notes:[],
        gifs:[],
        shapes:[],
        emojis: []
      });
      console.log(`📝 Created whiteboard on join: ${whiteboardId}`);
    }
    
    const whiteboard = whiteboards.get(whiteboardId);

      // DEBUG: Sprawdź stan przed dołączeniem
  console.log(`🔍 BEFORE JOIN - Whiteboard ${whiteboardId} state:`, {
    notes: whiteboard.notes?.length || 0,
    textBoxes: whiteboard.textBoxes?.length || 0,
    notesDetails: whiteboard.notes?.map(n => ({ id: n.id, x: n.x, y: n.y })) || []
  });
    
    // Check if user already exists in this whiteboard
    if (whiteboard.users.has(socket.id)) {
      console.log(`⚠️ User ${socket.id} already in whiteboard, removing old entry`);
      whiteboard.users.delete(socket.id);
    }
    
    // Add user to whiteboard with socket ID as key
    whiteboard.users.set(socket.id, {
      id: socket.id,
      ...user,
      position: { x: 0, y: 0 }
    });
    
    // Mark this socket as having joined a whiteboard
    hasJoinedWhiteboard = true;
    
    // Join socket room
    socket.join(whiteboardId);
    
    console.log(`👤 User ${user.name} joined whiteboard: ${whiteboardId}`);
    logWhiteboardState(whiteboardId);
    
      // ✅ POPRAWKA: ZAWSZE wysyłaj kompletne dane
  const whiteboardData = {
    users: Array.from(whiteboard.users.values()),
    drawingData: whiteboard.drawingData || [],
    textBoxes: whiteboard.textBoxes || [],
    notes: whiteboard.notes || [],
    gifs: whiteboard.gifs || [],
    shapes: whiteboard.shapes || [],
    emojis: whiteboard.emojis || []
  };
  
  console.log(`📤 Sending whiteboard data to new user:`, {
    notes: whiteboardData.notes.length,
    textBoxes: whiteboardData.textBoxes.length
  });
  
  // Send current users and ALL data to the new user
  socket.emit("whiteboard-data", whiteboardData);
    
    // Notify other users in the room about the new user
    socket.to(whiteboardId).emit("user-joined", {
      user: { id: socket.id, ...user },
      users: Array.from(whiteboard.users.values())
    });
  });

  // ========== OBSŁUGA TEKSTU (ulepszona) ==========
socket.on("text-create", (data) => {
  const { whiteboardId, textBox } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard) {
    if (!whiteboard.textBoxes) {
      whiteboard.textBoxes = [];
    }
    
    // ✅ UPEWNIJ SIĘ ŻE TEXTBOX MA SPÓJNE DANE
    const textBoxToSave = {
      ...textBox,
      x: textBox.position ? textBox.position.x : textBox.x,
      y: textBox.position ? textBox.position.y : textBox.y
    };
    
    whiteboard.textBoxes.push(textBoxToSave);
    socket.to(whiteboardId).emit("text-create", { textBox: textBoxToSave });
  }
});

// server.js - w handlerze text-update ZASTĄP obecny kod tym:
socket.on("text-update", (data) => {
  const { whiteboardId, id, ...props } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard) {
    if (!whiteboard.textBoxes) {
      whiteboard.textBoxes = [];
    }
    
    const textBox = whiteboard.textBoxes.find(tb => tb.id === id);
    if (textBox) {
      // ✅ POPRAWKA: Zawsze aktualizuj position ORAZ x, y osobno
      if (props.position) {
        textBox.position = props.position;
        textBox.x = props.position.x;
        textBox.y = props.position.y;
      } else if (props.x !== undefined && props.y !== undefined) {
        textBox.x = props.x;
        textBox.y = props.y;
        textBox.position = { x: props.x, y: props.y };
      }
      
      if (props.text !== undefined) textBox.text = props.text;
      if (props.size) textBox.size = props.size;
      
      // ✅ POPRAWKA: Wyślij spójne dane
      socket.to(whiteboardId).emit("text-update", { 
        id, 
        position: textBox.position,
        x: textBox.x,
        y: textBox.y,
        text: textBox.text,
        size: textBox.size
      });
    }
  }
});

  socket.on("text-delete", (data) => {
    const { whiteboardId, id } = data;
    const whiteboard = whiteboards.get(whiteboardId);
    if (whiteboard) {
      whiteboard.textBoxes = whiteboard.textBoxes.filter(tb => tb.id !== id);
      socket.to(whiteboardId).emit("text-delete", { id });
    }
  });

   // ========== OBSŁUGA NOTATEK ==========
// W handlerze note-create, upewnij się że nowa notatka ma spójne dane:
socket.on("note-create", (data) => {
  const { whiteboardId, note } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  console.log(`➕ Note create received:`, { noteId: note.id, whiteboardId });
  
  if (whiteboard) {
    if (!whiteboard.notes) {
      whiteboard.notes = [];
    }
    
    // ✅ UPEWNIJ SIĘ ŻE NOTATKA MA SPÓJNE DANE
    const noteToSave = {
      ...note,
      // Jeśli mamy position, upewnij się że x i y są zgodne
      x: note.position ? note.position.x : note.x,
      y: note.position ? note.position.y : note.y
    };
    
    whiteboard.notes.push(noteToSave);
    console.log(`📝 Added note to whiteboard:`, { 
      id: noteToSave.id, 
      x: noteToSave.x, 
      y: noteToSave.y 
    });
    socket.to(whiteboardId).emit("note-create", { note: noteToSave });
  }
});

// ZASTĄP obecny handler note-update tym:
// server.js - w handlerze note-update ZASTĄP obecny kod tym:
socket.on("note-update", (data) => {
  const { whiteboardId, id, ...props } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  console.log("🔄 Note update received:", { id, props });
  
  if (whiteboard) {
    if (!whiteboard.notes) {
      whiteboard.notes = [];
    }
    
    const note = whiteboard.notes.find(n => n.id === id);
    if (note) {
      // ✅ POPRAWKA: Zawsze aktualizuj position ORAZ x, y osobno
      if (props.position) {
        note.position = props.position;
        note.x = props.position.x;  // ✅ ZAWSZE aktualizuj x
        note.y = props.position.y;  // ✅ ZAWSZE aktualizuj y
      } else if (props.x !== undefined && props.y !== undefined) {
        // Jeśli klient wysłał bezpośrednio x, y
        note.x = props.x;
        note.y = props.y;
        note.position = { x: props.x, y: props.y }; // ✅ ZAWSZE aktualizuj position
      }
      
      // Aktualizuj inne właściwości
      if (props.text !== undefined) note.text = props.text;
      if (props.size) note.size = props.size;
      
      console.log("📝 Updated note:", { 
        id, 
        x: note.x, 
        y: note.y, 
        position: note.position 
      });
      
      // ✅ POPRAWKA: Wyślij spójne dane do wszystkich klientów
      socket.to(whiteboardId).emit("note-update", { 
        id, 
        position: note.position,
        x: note.x,
        y: note.y,
        text: note.text,
        size: note.size,
        width: note.width || 180,    // ✅ ZAWSZE wyślij width
        height: note.height || 120   // ✅ ZAWSZE wyślij height
      });
    }
  }
});

  socket.on("note-delete", (data) => {
    const { whiteboardId, id } = data;
    const whiteboard = whiteboards.get(whiteboardId);
    if (whiteboard) {
      whiteboard.notes = whiteboard.notes.filter(n => n.id !== id);
      socket.to(whiteboardId).emit("note-delete", { id });
    }
  });

  // DODAJ PO handlerach dla notes (~linia 240):

// ========== OBSŁUGA EMOJI ==========
socket.on("emoji-create", (data) => {
  const { whiteboardId, emoji } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard) {
    if (!whiteboard.emojis) whiteboard.emojis = [];
    whiteboard.emojis.push(emoji);
    socket.to(whiteboardId).emit("emoji-create", { emoji });
  }
});

socket.on("emoji-update", (data) => {
  const { whiteboardId, id, ...updates } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard && whiteboard.emojis) {
    const emoji = whiteboard.emojis.find(e => e.id === id);
    if (emoji) {
      Object.assign(emoji, updates);
      socket.to(whiteboardId).emit("emoji-update", { id, ...updates });
    }
  }
});

socket.on("emoji-delete", (data) => {
  const { whiteboardId, id } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard && whiteboard.emojis) {
    whiteboard.emojis = whiteboard.emojis.filter(e => e.id !== id);
    socket.to(whiteboardId).emit("emoji-delete", { id });
  }
});

// ========== OBSŁUGA GIFÓW ==========
socket.on("gif-create", (data) => {
  const { whiteboardId, gif } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard) {
    if (!whiteboard.gifs) whiteboard.gifs = [];
    whiteboard.gifs.push(gif);
    socket.to(whiteboardId).emit("gif-create", { gif });
  }
});

socket.on("gif-update", (data) => {
  const { whiteboardId, id, ...updates } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard && whiteboard.gifs) {
    const gif = whiteboard.gifs.find(g => g.id === id);
    if (gif) {
      Object.assign(gif, updates);
      socket.to(whiteboardId).emit("gif-update", { id, ...updates });
    }
  }
});

socket.on("gif-delete", (data) => {
  const { whiteboardId, id } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard && whiteboard.gifs) {
    whiteboard.gifs = whiteboard.gifs.filter(g => g.id !== id);
    socket.to(whiteboardId).emit("gif-delete", { id });
  }
});

// ========== OBSŁUGA KSZTAŁTÓW ==========
socket.on("shape-create", (data) => {
  const { whiteboardId, shape } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard) {
    if (!whiteboard.shapes) whiteboard.shapes = [];
    whiteboard.shapes.push(shape);
    socket.to(whiteboardId).emit("shape-create", { shape });
  }
});

socket.on("shape-update", (data) => {
  const { whiteboardId, id, ...updates } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard && whiteboard.shapes) {
    const shape = whiteboard.shapes.find(s => s.id === id);
    if (shape) {
      Object.assign(shape, updates);
      socket.to(whiteboardId).emit("shape-update", { id, ...updates });
    }
  }
});

socket.on("shape-delete", (data) => {
  const { whiteboardId, id } = data;
  const whiteboard = whiteboards.get(whiteboardId);
  
  if (whiteboard && whiteboard.shapes) {
    whiteboard.shapes = whiteboard.shapes.filter(s => s.id !== id);
    socket.to(whiteboardId).emit("shape-delete", { id });
  }
});

  // Handle drawing events
  socket.on("drawing", (data) => {
    const { whiteboardId, tool, points, color, size } = data;
    const whiteboard = whiteboards.get(whiteboardId);
    
    if (whiteboard) {
      // Store drawing data (limit to last 1000 drawings to prevent memory issues)
      whiteboard.drawingData.push({
        tool,
        points,
        color,
        size,
        userId: socket.id,
        timestamp: Date.now()
      });
      
      // Keep only last 1000 drawings
      if (whiteboard.drawingData.length > 1000) {
        whiteboard.drawingData = whiteboard.drawingData.slice(-1000);
      }
      
      // Broadcast to other users in the room
      socket.to(whiteboardId).emit("drawing", {
        tool,
        points,
        color,
        size,
        userId: socket.id
      });
    }
  });

  // Handle cursor movement
  socket.on("cursor-move", (data) => {
    const { whiteboardId, position } = data;
    const whiteboard = whiteboards.get(whiteboardId);
    
    if (whiteboard && whiteboard.users.has(socket.id)) {
      // Update user position
      whiteboard.users.get(socket.id).position = position;
      
      // Broadcast to other users
      socket.to(whiteboardId).emit("cursor-move", {
        userId: socket.id,
        position,
        user: whiteboard.users.get(socket.id)
      });
    }
  });

  // Handle chat messages
  socket.on("chat-message", (data) => {
    const { whiteboardId, message } = data;
    console.log(`💬 Chat message in ${whiteboardId} from ${socket.id}:`, message.text);
    
    // Broadcast to all users including sender (for immediate feedback)
    io.to(whiteboardId).emit("chat-message", message);
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    
    // Find and remove user from all whiteboards
    for (const [whiteboardId, whiteboard] of whiteboards.entries()) {
      if (whiteboard.users.has(socket.id)) {
        const user = whiteboard.users.get(socket.id);
        whiteboard.users.delete(socket.id);
        
        // Notify other users
        socket.to(whiteboardId).emit("user-left", {
          userId: socket.id,
          users: Array.from(whiteboard.users.values())
        });
        
        console.log(`❌ User ${user.name} left whiteboard: ${whiteboardId}`);
        logWhiteboardState(whiteboardId);
        
        // Clean up empty whiteboards after 1 hour (you can adjust this)
        if (whiteboard.users.size === 0) {
          setTimeout(() => {
            if (whiteboard.users.size === 0) {
              whiteboards.delete(whiteboardId);
              console.log(`🧹 Cleaned up empty whiteboard: ${whiteboardId}`);
            }
          }, 3600000); // 1 hour
        }
        break;
      }
    }
  });
});

function generateId() {
  return Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Server running on: http://localhost:${PORT}`);
});
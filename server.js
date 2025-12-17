const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware do parsowania JSON
app.use(express.json());

// Middleware CORS dla Express
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Baza danych w pamięci
const whiteboards = new Map();

// Prosty route testowy
app.get('/', (req, res) => {
  res.json({ message: 'Server OK' });
});

// Endpoint tworzenia tablicy
app.get('/api/create-whiteboard', (req, res) => {
  try {
    const whiteboardId = generateId();
    whiteboards.set(whiteboardId, {
      users: new Map(),
      drawingData: [],
      textBoxes: [],
      notes: [],
      gifs: [],
      shapes: [],
      emojis: [],
      backgroundMode: 'grid'
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

// Sprawdzanie czy tablica istnieje
app.get('/api/whiteboard/:id', (req, res) => {
  const whiteboardId = req.params.id;
  res.json({ exists: whiteboards.has(whiteboardId) });
});

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  // Zmienna lokalna dla socketa - przechowuje ID pokoju, w którym jest użytkownik
  // To jest KLUCZOWE dla poprawnego działania odświeżania
  let currentWhiteboardId = null;

  socket.on("join-whiteboard", (data) => {
    const { whiteboardId, user } = data;

    // 1. Safety check: Jeśli socket był już w innym pokoju (lub tym samym przy szybkim reconnect), usuń go stamtąd.
    // To zapobiega dublowaniu użytkowników ("duchom")
    if (currentWhiteboardId && whiteboards.has(currentWhiteboardId)) {
      const prevWb = whiteboards.get(currentWhiteboardId);
      if (prevWb.users.has(socket.id)) {
        prevWb.users.delete(socket.id);
        // Powiadom stary pokój, że wyszedłeś
        socket.to(currentWhiteboardId).emit("user-left", {
          userId: socket.id,
          users: Array.from(prevWb.users.values())
        });
      }
    }

    // 2. Utwórz tablicę jeśli nie istnieje
    if (!whiteboards.has(whiteboardId)) {
      whiteboards.set(whiteboardId, {
        users: new Map(),
        drawingData: [],
        textBoxes: [],
        notes: [],
        gifs: [],
        shapes: [],
        emojis: [],
        backgroundMode: 'grid'
      });
      console.log(`📝 Created whiteboard on join: ${whiteboardId}`);
    }

    const whiteboard = whiteboards.get(whiteboardId);

    // 3. TWORZENIE POPRAWNEGO UŻYTKOWNIKA (FIX WEBRTC)
    // Kopiujemy dane usera, ale USUWAMY jego stare ID z frontendu (user_...)
    const safeUser = { ...user };
    if (safeUser.id) delete safeUser.id;

    // Nadajemy ID socketa jako jedyne obowiązujące ID
    const userData = {
      ...safeUser,
      id: socket.id,
      position: { x: 0, y: 0 }
    };

    // Dodaj użytkownika do mapy
    whiteboard.users.set(socket.id, userData);

    // Zapisz ID tablicy w zmiennej lokalnej socketa (dla disconnect)
    currentWhiteboardId = whiteboardId;

    // Dołącz do pokoju socket.io
    socket.join(whiteboardId);

    console.log(`👤 Joined ${whiteboardId}. Name: ${user.name} -> SOCKET ID: ${socket.id}`);

    // 4. Wyślij pełne dane tablicy do nowego użytkownika
    // W serwerze, w części gdzie wysyłasz dane do nowego użytkownika:
    const allData = {
      users: Array.from(whiteboard.users.values()),
      drawingData: whiteboard.drawingData || [],
      textBoxes: whiteboard.textBoxes || [],
      notes: whiteboard.notes || [],
      gifs: whiteboard.gifs || [],
      shapes: whiteboard.shapes || [],
      emojis: whiteboard.emojis || [],
      backgroundMode: whiteboard.backgroundMode || 'grid'
    };
    socket.emit("whiteboard-data", allData);

    // Dodaj też event, który aktualizuje listę użytkowników dla wszystkich w pokoju
    io.to(whiteboardId).emit("users-updated", {
      users: Array.from(whiteboard.users.values())
    });

    // 5. Poinformuj innych o nowym użytkowniku (używając poprawionego userData)
    socket.to(whiteboardId).emit("user-joined", {
      user: userData,
      users: Array.from(whiteboard.users.values())
    });
  });

  // ========== AKTUALIZACJA UŻYTKOWNIKA ==========
  socket.on("user-update", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.users.has(socket.id)) {
      const user = wb.users.get(socket.id);
      Object.assign(user, d.updates);

      // Powiadom wszystkich o aktualizacji użytkownika
      io.to(d.whiteboardId).emit("users-updated", {
        users: Array.from(wb.users.values())
      });
    }
  });

  // ========== AKTUALIZACJA UŻYTKOWNIKA (ZMIANA KOLORU/NICKU) ==========
  socket.on("user-update", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.users.has(socket.id)) {
      const user = wb.users.get(socket.id);

      // Aktualizuj dane użytkownika
      Object.assign(user, d.updates);

      console.log(`👤 User updated: ${socket.id}`, d.updates);

      // Rozgłoś aktualizację do WSZYSTKICH użytkowników w pokoju
      io.to(d.whiteboardId).emit("user-updated", {
        userId: socket.id,
        updates: d.updates
      });
    }
  });


  // ========== Handlery (pomocnicza funkcja broadcast) ==========
  const broadcast = (room, event, data) => socket.to(room).emit(event, data);

  // ========== OBSŁUGA TEKSTU ==========
  socket.on("text-create", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.textBoxes) wb.textBoxes = [];
      wb.textBoxes.push(d.textBox);
      broadcast(d.whiteboardId, "text-create", d);
    }
  });

  socket.on("text-update", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.textBoxes) {
      const t = wb.textBoxes.find(x => x.id === d.id);
      if (t) {
        Object.assign(t, d);
        broadcast(d.whiteboardId, "text-update", d);
      }
    }
  });

  socket.on("text-delete", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.textBoxes) {
      wb.textBoxes = wb.textBoxes.filter(x => x.id !== d.id);
      broadcast(d.whiteboardId, "text-delete", d);
    }
  });

  // ========== OBSŁUGA NOTATEK ==========
  socket.on("note-create", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.notes) wb.notes = [];
      wb.notes.push(d.note);
      broadcast(d.whiteboardId, "note-create", d);
    }
  });

  socket.on("note-update", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.notes) {
      const n = wb.notes.find(x => x.id === d.id);
      if (n) {
        Object.assign(n, d);
        broadcast(d.whiteboardId, "note-update", d);
      }
    }
  });

  socket.on("note-delete", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.notes) {
      wb.notes = wb.notes.filter(x => x.id !== d.id);
      broadcast(d.whiteboardId, "note-delete", d);
    }
  });

  // ========== OBSŁUGA EMOJI ==========
  socket.on("emoji-create", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.emojis) wb.emojis = [];
      wb.emojis.push(d.emoji);
      broadcast(d.whiteboardId, "emoji-create", d);
    }
  });

  socket.on("emoji-update", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.emojis) {
      const e = wb.emojis.find(x => x.id === d.id);
      if (e) {
        Object.assign(e, d);
        broadcast(d.whiteboardId, "emoji-update", d);
      }
    }
  });

  socket.on("emoji-delete", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.emojis) {
      wb.emojis = wb.emojis.filter(x => x.id !== d.id);
      broadcast(d.whiteboardId, "emoji-delete", d);
    }
  });

  // ========== OBSŁUGA GIFÓW ==========
  socket.on("gif-create", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.gifs) wb.gifs = [];
      wb.gifs.push(d.gif);
      broadcast(d.whiteboardId, "gif-create", d);
    }
  });

  socket.on("gif-update", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.gifs) {
      const g = wb.gifs.find(x => x.id === d.id);
      if (g) {
        Object.assign(g, d);
        broadcast(d.whiteboardId, "gif-update", d);
      }
    }
  });

  socket.on("gif-delete", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.gifs) {
      wb.gifs = wb.gifs.filter(x => x.id !== d.id);
      broadcast(d.whiteboardId, "gif-delete", d);
    }
  });

  // ========== OBSŁUGA KSZTAŁTÓW ==========
  socket.on("shape-create", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      if (!wb.shapes) wb.shapes = [];
      wb.shapes.push(d.shape);
      broadcast(d.whiteboardId, "shape-create", d);
    }
  });

  socket.on("shape-update", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.shapes) {
      const s = wb.shapes.find(x => x.id === d.id);
      if (s) {
        Object.assign(s, d);
        broadcast(d.whiteboardId, "shape-update", d);
      }
    }
  });

  socket.on("shape-delete", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.shapes) {
      wb.shapes = wb.shapes.filter(x => x.id !== d.id);
      broadcast(d.whiteboardId, "shape-delete", d);
    }
  });

  // ========== OBSŁUGA RYSOWANIA ==========
  socket.on("drawing", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      wb.drawingData.push(d);
      if (wb.drawingData.length > 1000) wb.drawingData.shift();
      broadcast(d.whiteboardId, "drawing", d);
    }
  });

  socket.on("erase-area", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb) {
      // 1. Zapisujemy akcję wymazywania do historii rysowania!
      // Dzięki temu przy odświeżeniu zostanie ona odtworzona w kolejności
      const eraseAction = {
        type: 'erase-area', // Ważne: oznaczamy typ
        x: d.x,
        y: d.y,
        width: d.width,
        height: d.height,
        whiteboardId: d.whiteboardId
      };

      wb.drawingData.push(eraseAction);

      // Ogranicznik historii (opcjonalny, taki sam jak przy drawing)
      if (wb.drawingData.length > 10000) wb.drawingData.shift();

      // 2. Rozsyłamy do innych
      broadcast(d.whiteboardId, "erase-area", d);
    }
  });

  // ========== KURSOR I WSKAŹNIK (POINTER) ==========
  socket.on("cursor-move", (d) => broadcast(d.whiteboardId, "cursor-move", d));

  // 🔹 AKTUALIZACJA UŻYTKOWNIKA (ZMIANA KOLORU/NICKU) - DODAJ TUTAJ
  socket.on("user-update", (d) => {
    const wb = whiteboards.get(d.whiteboardId);
    if (wb && wb.users.has(socket.id)) {
      const user = wb.users.get(socket.id);

      // Aktualizuj dane użytkownika
      Object.assign(user, d.updates);

      console.log(`👤 User updated: ${socket.id}`, d.updates);

      // Rozgłoś aktualizację do WSZYSTKICH użytkowników w pokoju
      io.to(d.whiteboardId).emit("user-updated", {
        userId: socket.id,
        updates: d.updates
      });
    }
  });

  // 🔹 NOWE: Obsługa pointera (szlak i kliknięcia) dla innych użytkowników
  socket.on("pointer-move", (d) => broadcast(d.whiteboardId, "pointer-move", d));
  socket.on("pointer-click", (d) => broadcast(d.whiteboardId, "pointer-click", d));

  // ========== CZAT ==========
  socket.on("chat-message", (d) => io.to(d.whiteboardId).emit("chat-message", d.message));

  // ========== WEBRTC SIGNALING (POPRAWIONE) ==========
  // WAŻNE: data.to to teraz prawidłowe socket.id dzięki fixowi w join-whiteboard
  socket.on("call-user", (d) => {
    socket.to(d.to).emit("call-made", {
      offer: d.offer,
      socket: socket.id
    });
  });

  socket.on("make-answer", (d) => {
    socket.to(d.to).emit("answer-made", {
      answer: d.answer,
      socket: socket.id
    });
  });

  socket.on("ice-candidate", (d) => {
    socket.to(d.to).emit("ice-candidate", {
      candidate: d.candidate,
      socket: socket.id
    });
  });

  // ========== ROZŁĄCZENIE (POPRAWIONE) ==========
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    // Używamy zmiennej currentWhiteboardId, aby szybko znaleźć pokój i usunąć użytkownika
    if (currentWhiteboardId && whiteboards.has(currentWhiteboardId)) {
      const whiteboard = whiteboards.get(currentWhiteboardId);

      // 1. Usuń użytkownika z mapy
      whiteboard.users.delete(socket.id);

      // 2. Wyślij natychmiastową aktualizację do pozostałych
      // To sprawia, że inni widzą, że użytkownik zniknął (np. podczas odświeżania)
      socket.to(currentWhiteboardId).emit("user-left", {
        userId: socket.id,
        users: Array.from(whiteboard.users.values())
      });

      // Sprzątanie pustych pokoi po godzinie
      if (whiteboard.users.size === 0) {
        setTimeout(() => {
          if (whiteboards.has(currentWhiteboardId) && whiteboards.get(currentWhiteboardId).users.size === 0) {
            whiteboards.delete(currentWhiteboardId);
            console.log(`🧹 Cleaned up empty whiteboard: ${currentWhiteboardId}`);
          }
        }, 3600000); // 1 hour
      }
    }
  });

  socket.on("background-update", (data) => {
    const wb = whiteboards.get(data.whiteboardId);
    if (wb) {
      wb.backgroundMode = data.mode;
      // Wyślij informację do wszystkich w pokoju (włącznie z nadawcą, dla pewności, lub użyj broadcast)
      io.to(data.whiteboardId).emit("background-update", { mode: data.mode });
    }
  });
});

function generateId() {
  return Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 SERWER POPRAWIONY! Running on: http://localhost:${PORT}\n`);
});
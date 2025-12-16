import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Toolbar from '../Toolbar/Toolbar';
import Canvas from '../Canvas/Canvas';
import Sidebar from '../Sidebar/Sidebar';
import PointerTrail from '../Toolbar/PointerTrail';
import ColorPicker from '../Toolbar/ColorPicker';
import './Whiteboard.css';

const WhiteboardRouter = () => {
  const { whiteboardId } = useParams();
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState({ pencil: 3, eraser: 10, brush: 5 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ DODAJ TE STANY - to najważniejsze!
  const [textBoxes, setTextBoxes] = useState([]);
  const [notes, setNotes] = useState([]);

  // Emojis
  const [emojis, setEmojis] = useState([]);
  const [activeEmoji, setActiveEmoji] = useState(null); // Tutaj przechowamy np. "😎" wybrane z paska

  //Gifs
  const [gifs, setGifs] = useState([]);
  const [activeGif, setActiveGif] = useState(null); // URL wybranego gifa

  //Shapes
  const [shapes, setShapes] = useState([]);
  const [activeShape, setActiveShape] = useState(null);

  // Images
  const [images, setImages] = useState([]);

  const [currentUser] = useState(() => {
    const userId = 'user_' + Math.random().toString(36).substring(2, 15);
    const userName = 'User' + Math.floor(Math.random() * 1000);
    const userColor = `hsl(${Math.random() * 360}, 80%, 60%)`;

    console.log("👤 Generated user:", { id: userId, name: userName, color: userColor });

    return {
      id: userId,
      name: userName,
      color: userColor
    };
  });

  const socketRef = useRef(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (whiteboardId && !hasJoinedRef.current) {
      initializeSocket(whiteboardId);
    }

    return () => {
      if (socketRef.current) {
        console.log("🔌 Disconnecting socket");
        socketRef.current.disconnect();
      }
    };
  }, [whiteboardId]);

  const initializeSocket = (whiteboardId) => {
    setIsLoading(true);
    hasJoinedRef.current = false;

    const newSocket = io('http://localhost:3001', {
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    console.log("🔌 Socket initialized for whiteboard:", whiteboardId);

    newSocket.on('connect', () => {
      console.log("✅ Connected to server");

      if (!hasJoinedRef.current) {
        hasJoinedRef.current = true;
        newSocket.emit('join-whiteboard', {
          whiteboardId: whiteboardId,
          user: currentUser
        });
        console.log("📤 Sent join-whiteboard event");
      }

      setIsLoading(false);
    });

    // ✅ DODAJ TE LISTENERY - to kluczowe dla notatek!
    newSocket.on('whiteboard-data', (data) => {
      console.log("📦 Received whiteboard data:", {
        notes: data.notes?.length || 0,
        textBoxes: data.textBoxes?.length || 0,
        notesDetails: data.notes?.map(n => ({ id: n.id, x: n.x, y: n.y })) || []
      });

      // ✅ UŻYJ danych z serwera, NIE initialNotes
      if (data.textBoxes) {
        setTextBoxes(data.textBoxes);
      }
      if (data.notes) {
        setNotes(data.notes);
      }
      if(data.gifs){
        setGifs(data.gifs);
      }
      if(data.shapes){
        setShapes(data.shapes);
      }
      if(data.images){
        setImages(data.images);
      }
      if(data.emojis){
        setEmojis(data.emojis);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error("❌ Connection error:", error);
      setIsLoading(false);
    });

  };

  //Shapes
  const handleShapeCreate = (shape) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('shape-create', { whiteboardId, shape });
    }
  };

  const handleShapeDelete = (id) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('shape-delete', { whiteboardId, id });
    }
  };
  const handleShapeUpdate = (id, updates) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('shape-update', {
        whiteboardId,
        id,
        ...updates
      });
    }
  };

  // Images
  const handleImageCreate = (image) => {
    // Lokalna aktualizacja
    setImages(prev => [...prev, image]);
    // Wysłanie do serwera
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('image-create', { whiteboardId, image });
    }
  };

  const handleImageDelete = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('image-delete', { whiteboardId, id });
    }
  };

  const handleImageUpdate = (id, updates) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('image-update', { whiteboardId, id, ...updates });
    }
  };

  const handleImageUpload = (fileDataUrl) => {
    const newImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x: window.innerWidth / 2 - 100, // Centrum (w przybliżeniu)
      y: window.innerHeight / 2 - 100,
      url: fileDataUrl,
      width: 200 // Domyślna szerokość
    };
    handleImageCreate(newImage);
  };


  //Gif
  const handleGifCreate = (gif) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('gif-create', { whiteboardId, gif });
    }
  };

  const handleGifDelete = (id) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('gif-delete', { whiteboardId, id });
    }
  };
  const handleGifUpdate = (id, updates) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('gif-update', { whiteboardId, id, ...updates });
    }
  };

  //emojis
  const handleEmojiCreate = (emoji) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('emoji-create', { whiteboardId, emoji });
    }
  };

  const handleEmojiUpdate = (id, updates) => {
  if (socketRef.current && whiteboardId) {
    socketRef.current.emit('emoji-update', {
      whiteboardId,
      id,
      ...updates
    });
  }
};

  const handleEmojiDelete = (id) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('emoji-delete', { whiteboardId, id });
    }
  };

  // ✅ DODAJ FUNKCJE OBSŁUGI NOTATEK
  const handleNoteCreate = (note) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('note-create', {
        whiteboardId,
        note
      });
    }
  };

  const handleNoteUpdate = (id, updates) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('note-update', {
        whiteboardId,
        id,
        ...updates
      });
    }
  };

  const handleNoteDelete = (id) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('note-delete', {
        whiteboardId,
        id
      });
    }
  };

  const handleDrawing = (drawingData) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('drawing', {
        whiteboardId,
        ...drawingData
      });
    }
  };

  const handleCursorMove = (position) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('cursor-move', {
        whiteboardId,
        position
      });
    }
  };

  const copyInviteLink = async () => {
    if (whiteboardId) {
      const link = `${window.location.origin}/${whiteboardId}`;
      try {
        await navigator.clipboard.writeText(link);
        alert('✅ Invite link copied to clipboard! Share it with others to collaborate!');
      } catch (err) {
        console.error('Failed to copy:', err);
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('✅ Invite link copied to clipboard! Share it with others to collaborate!');
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f0f0',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h2>Joining whiteboard {whiteboardId}...</h2>
        <div>Please wait</div>
      </div>
    );
  }

  return (
    <div className="whiteboard">
      <div className="whiteboard-header">
        <div className="whiteboard-info">
          <span className="whiteboard-id">Room: {whiteboardId}</span>
          <span className="user-info">You: {currentUser.name}</span>
        </div>
        <div className="header-controls">
          <button
            className="invite-btn"
            onClick={copyInviteLink}
          >
            📋 Copy Invite Link
          </button>
          <button className="fullscreen-btn">⛶ Fullscreen</button>
          <button className="save-btn">💾 Save</button>
        </div>
      </div>

      <div className="whiteboard-main">
        <Toolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          size={size}
          setSize={setSize}
          showColorPicker={showColorPicker}
          setShowColorPicker={setShowColorPicker}
          activeEmoji={activeEmoji}
          setActiveEmoji={setActiveEmoji}
          setActiveGif={setActiveGif}
          setActiveShape={setActiveShape}
          onImageUpload={handleImageUpload} // ✅ Przekazujemy funkcję uploadu
        />

        {/* 🔹 Przekazujemy socket i whiteboardId do PointerTrail */}
        <PointerTrail 
          active={tool === 'pointer'} 
          socket={socketRef.current}
          whiteboardId={whiteboardId}
        />

        {/* ✅ PRZEKAŻ NOTATKI DO CANVAS - to najważniejsze! */}
        <Canvas
          tool={tool}
          color={color}
          setTool={setTool}
          size={size[tool]}
          setShowColorPicker={setShowColorPicker}
          whiteboardId={whiteboardId}
          socket={socketRef.current}
          currentUser={currentUser}
          onDrawing={handleDrawing}
          onCursorMove={handleCursorMove}
          textBoxes={textBoxes}
          notes={notes}
          onNoteCreate={handleNoteCreate}
          onNoteUpdate={handleNoteUpdate}
          onNoteDelete={handleNoteDelete}
          emojis={emojis}
          activeEmoji={activeEmoji} // Aktualnie wybrane emoji do postawienia
          onEmojiCreate={handleEmojiCreate}
          onEmojiUpdate={handleEmojiUpdate}
          onEmojiDelete={handleEmojiDelete}
          gifs={gifs}                     // ✅ Przekazujemy listę
          activeGif={activeGif}           // ✅ Przekazujemy wybrany URL
          onGifCreate={handleGifCreate}   // ✅ Funkcja tworzenia
          onGifDelete={handleGifDelete}   // ✅ Funkcja usuwania
          onGifUpdate={handleGifUpdate}
          shapes={shapes}
          activeShape={activeShape}
          onShapeCreate={handleShapeCreate}
          onShapeDelete={handleShapeDelete}
          onShapeUpdate={handleShapeUpdate} // <--- Przekazujemy funkcję
          images={images}                 // ✅ Obrazy
          onImageCreate={handleImageCreate}
          onImageDelete={handleImageDelete}
          onImageUpdate={handleImageUpdate}
        />

        <Sidebar
          whiteboardId={whiteboardId}
          socket={socketRef.current}
          currentUser={currentUser}
        />

        {showColorPicker && (
          <div className="color-picker-wrapper">
            <ColorPicker color={color} setColor={setColor} setShowColorPicker={setShowColorPicker} />
          </div>
        )}
      </div>
    </div>
  );
};

export default WhiteboardRouter;
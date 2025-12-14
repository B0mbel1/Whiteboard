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

  // Stany obiektów
  const [textBoxes, setTextBoxes] = useState([]);
  const [notes, setNotes] = useState([]);
  const [emojis, setEmojis] = useState([]);
  const [activeEmoji, setActiveEmoji] = useState(null);
  const [gifs, setGifs] = useState([]);
  const [activeGif, setActiveGif] = useState(null);
  const [shapes, setShapes] = useState([]);
  const [activeShape, setActiveShape] = useState(null);

  // 🔥 STAN LISTY UŻYTKOWNIKÓW (Dla Sidebara i kamer)
  const [users, setUsers] = useState([]);

  // 🔥 UŻYTKOWNIK Z LOCALSTORAGE (TRWAŁOŚĆ)
  const [currentUser] = useState(() => {
    const storedUser = localStorage.getItem('whiteboard_user');
    if (storedUser) {
      console.log("👤 Loaded existing user:", JSON.parse(storedUser));
      return JSON.parse(storedUser);
    }

    const userId = 'user_' + Math.random().toString(36).substring(2, 15);
    const userName = 'User' + Math.floor(Math.random() * 1000);
    const userColor = `hsl(${Math.random() * 360}, 80%, 45%)`; // Ciemniejszy dla kontrastu tekstu

    const newUser = {
      id: userId,
      name: userName,
      color: userColor
    };

    localStorage.setItem('whiteboard_user', JSON.stringify(newUser));
    console.log("👤 Generated and saved new user:", newUser);
    return newUser;
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

    // 🔥 ODBIERANIE DANYCH I LISTY UŻYTKOWNIKÓW
    newSocket.on('whiteboard-data', (data) => {
      if (data.textBoxes) setTextBoxes(data.textBoxes);
      if (data.notes) setNotes(data.notes);
      if (data.gifs) setGifs(data.gifs);
      if (data.shapes) setShapes(data.shapes);
      if (data.emojis) setEmojis(data.emojis);
      
      // Aktualizuj listę użytkowników przy pierwszym wejściu
      if (data.users) {
        console.log("👥 Initial users list:", data.users);
        setUsers(data.users);
      }
    });

    // 🔥 AKTUALIZACJA LISTY GDY KTOŚ DOŁĄCZY
    newSocket.on('user-joined', (data) => {
      console.log("👋 User joined:", data.user);
      if (data.users) {
        setUsers(data.users); // Serwer wysyła pełną, zaktualizowaną listę
      }
    });

    // 🔥 AKTUALIZACJA LISTY GDY KTOŚ WYJDZIE
    newSocket.on('user-left', (data) => {
      console.log("👋 User left:", data.userId);
      if (data.users) {
        setUsers(data.users); // Serwer wysyła pełną, zaktualizowaną listę
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error("❌ Connection error:", error);
      setIsLoading(false);
    });

  };

  // --- Handlery ---

  const handleShapeCreate = (shape) => { if (socketRef.current && whiteboardId) socketRef.current.emit('shape-create', { whiteboardId, shape }); };
  const handleShapeDelete = (id) => { if (socketRef.current && whiteboardId) socketRef.current.emit('shape-delete', { whiteboardId, id }); };
  const handleShapeUpdate = (id, updates) => { if (socketRef.current && whiteboardId) socketRef.current.emit('shape-update', { whiteboardId, id, ...updates }); };

  const handleGifCreate = (gif) => { if (socketRef.current && whiteboardId) socketRef.current.emit('gif-create', { whiteboardId, gif }); };
  const handleGifDelete = (id) => { if (socketRef.current && whiteboardId) socketRef.current.emit('gif-delete', { whiteboardId, id }); };
  const handleGifUpdate = (id, updates) => { if (socketRef.current && whiteboardId) socketRef.current.emit('gif-update', { whiteboardId, id, ...updates }); };

  const handleEmojiCreate = (emoji) => { if (socketRef.current && whiteboardId) socketRef.current.emit('emoji-create', { whiteboardId, emoji }); };
  const handleEmojiUpdate = (id, updates) => { if (socketRef.current && whiteboardId) socketRef.current.emit('emoji-update', { whiteboardId, id, ...updates }); };
  const handleEmojiDelete = (id) => { if (socketRef.current && whiteboardId) socketRef.current.emit('emoji-delete', { whiteboardId, id }); };

  const handleNoteCreate = (note) => { if (socketRef.current && whiteboardId) socketRef.current.emit('note-create', { whiteboardId, note }); };
  const handleNoteUpdate = (id, updates) => { if (socketRef.current && whiteboardId) socketRef.current.emit('note-update', { whiteboardId, id, ...updates }); };
  const handleNoteDelete = (id) => { if (socketRef.current && whiteboardId) socketRef.current.emit('note-delete', { whiteboardId, id }); };

  const handleDrawing = (drawingData) => { if (socketRef.current && whiteboardId) socketRef.current.emit('drawing', { whiteboardId, ...drawingData }); };

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
          <span className="user-info" style={{borderLeft: `5px solid ${currentUser.color}`, paddingLeft: '10px'}}>
             You: <b>{currentUser.name}</b>
          </span>
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
        />

        <PointerTrail 
          active={tool === 'pointer'} 
          socket={socketRef.current}
          whiteboardId={whiteboardId}
        />

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
          activeEmoji={activeEmoji} 
          onEmojiCreate={handleEmojiCreate}
          onEmojiUpdate={handleEmojiUpdate}
          onEmojiDelete={handleEmojiDelete}
          gifs={gifs}                     
          activeGif={activeGif}           
          onGifCreate={handleGifCreate}   
          onGifDelete={handleGifDelete}   
          onGifUpdate={handleGifUpdate}
          shapes={shapes}
          activeShape={activeShape}
          onShapeCreate={handleShapeCreate}
          onShapeDelete={handleShapeDelete}
          onShapeUpdate={handleShapeUpdate}
        />

        {/* 🔥 Przekazujemy listę 'users' do Sidebar, aby kamery działały poprawnie */}
        <Sidebar
          whiteboardId={whiteboardId}
          socket={socketRef.current}
          currentUser={currentUser}
          users={users}
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
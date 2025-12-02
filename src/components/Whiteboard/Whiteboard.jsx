import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Toolbar from '../Toolbar/Toolbar';
import Canvas from '../Canvas/Canvas';
import Sidebar from '../Sidebar/Sidebar';
import ColorPicker from '../Toolbar/ColorPicker'; 
import PointerTrail from '../Toolbar/PointerTrail';

import './Whiteboard.css';

const Whiteboard = () => {
  const [tool, setTool] = useState('cursor');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState({ pencil: 3, eraser: 10, brush: 5 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [socket, setSocket] = useState(null);
  const [whiteboardId, setWhiteboardId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [textBoxes, setTextBoxes] = useState([]);
  const [notes, setNotes] = useState([]); 
  const [users, setUsers] = useState([]);

  // Tworzenie lub pobranie aktualnego użytkownika z sessionStorage
  const [currentUser] = useState(() => {
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) return JSON.parse(storedUser);

    const userId = 'user_' + Math.random().toString(36).substring(2, 15);
    const userName = 'User' + Math.floor(Math.random() * 1000);
    const userColor = `hsl(${Math.random() * 360}, 80%, 60%)`;

    const user = { id: userId, name: userName, color: userColor };
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    return user;
  });

  const socketRef = useRef(null);
  const hasJoinedRef = useRef(false); // Track if we've already joined
  const navigate = useNavigate();

  // Przy ładowaniu komponentu tworzona jest nowa tablica
  useEffect(() => {
    createNewWhiteboard();
  }, []);

  // Funkcja tworząca nową tablicę
  const createNewWhiteboard = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("📝 Creating new whiteboard...");

      const response = await fetch('http://localhost:3001/api/create-whiteboard');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to create whiteboard');

      const newWhiteboardId = data.whiteboardId;
      console.log("🎯 New whiteboard ID:", newWhiteboardId);

      // Aktualizacja URL i state
      navigate(`/${newWhiteboardId}`, { replace: true });
      setWhiteboardId(newWhiteboardId);

      // Inicjalizacja socketu i dołączenie do whiteboard
      initializeSocket(newWhiteboardId);
    } catch (error) {
      console.error('Error creating whiteboard:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Funkcja inicjalizująca socket
  const initializeSocket = (whiteboardId) => {
    try {
      hasJoinedRef.current = false; // Reset flagi join

      const newSocket = io('http://localhost:3001', {
        timeout: 10000,
        transports: ['websocket', 'polling']
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      console.log("🔌 Socket initialized for whiteboard:", whiteboardId);
      console.log("👤 Current user:", currentUser);

      // Połączenie z socketem
      newSocket.on('connect', () => {
        console.log("✅ Socket connected successfully");

        // Dołączenie do whiteboard tylko raz
        if (!hasJoinedRef.current) {
          hasJoinedRef.current = true;
          newSocket.emit('join-whiteboard', { whiteboardId, user: currentUser });
        }
      });

      // Odbiór pełnych danych whiteboard
      newSocket.on('whiteboard-data', (data) => {
        setTextBoxes(data.textBoxes || []);
        setNotes(data.notes || []);
        setUsers(data.users || []);
      });

      // Obsługa notatek
      newSocket.on('note-create', (data) => {
        setNotes(prev => [...prev, data.note]);
      });

      newSocket.on('note-update', (data) => {
        setNotes(prev => prev.map(note => note.id === data.id ? { ...note, ...data } : note));
      });

      newSocket.on('note-delete', (data) => {
        setNotes(prev => prev.filter(note => note.id !== data.id));
      });

      // Obsługa użytkowników
      newSocket.on('whiteboard-users', (data) => {
        setUsers(data.users);
      });

      newSocket.on('user-joined', ({ user }) => {
        setUsers(prev => {
          if (prev.some(u => u.id === user.id)) return prev;
          return [...prev, user];
        });
      });

      newSocket.on('user-left', ({ userId }) => {
        setUsers(prev => prev.filter(u => u.id !== userId));
      });

      newSocket.on('connect_error', (error) => {
        console.error("❌ Socket connection error:", error);
        setError('Failed to connect to server. Please check if the server is running.');
      });

      // Odświeżanie listy użytkowników co 10s
      const interval = setInterval(() => {
        if (socketRef.current && whiteboardId) {
          socketRef.current.emit('get-users', { whiteboardId });
        }
      }, 10000);

      return () => clearInterval(interval);

    } catch (error) {
      console.error("❌ Error initializing socket:", error);
      setError('Failed to initialize connection.');
    }
  };

  // Funkcje do obsługi notatek
  const handleNoteCreate = (note) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('note-create', { whiteboardId, note });
    }
  };

  const handleNoteUpdate = (id, updates) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('note-update', { whiteboardId, id, ...updates });
    }
  };

  const handleNoteDelete = (id) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('note-delete', { whiteboardId, id });
    }
  };

  // Funkcje do obsługi rysowania
  const handleDrawing = (drawingData) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('drawing', { whiteboardId, ...drawingData });
    }
  };

  const handleCursorMove = (position) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('cursor-move', { whiteboardId, position });
    }
  };

  // Kopiowanie linku do tablicy
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

  // Retry po błędzie
  const retryConnection = () => {
    setError(null);
    createNewWhiteboard();
  };

  // Obsługa errora
  if (error) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f0f0',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#e74c3c' }}>Error</h2>
        <div style={{ color: '#666', marginBottom: '10px' }}>{error}</div>
        <div style={{ color: '#999', fontSize: '14px', marginBottom: '20px' }}>
          Make sure the server is running on http://localhost:3001
        </div>
        <button 
          onClick={retryConnection}
          style={{
            padding: '10px 20px',
            background: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Obsługa loading
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
        <h2>Creating your whiteboard...</h2>
        <div>Please wait</div>
      </div>
    );
  }

  // Główny render komponentu
  return (
    <div className="whiteboard">
      <div className="whiteboard-header">
        <div className="whiteboard-info">
          <span className="whiteboard-id">Room: {whiteboardId}</span>
          <span className="user-info">You: {currentUser.name}</span>
          <span className="user-count-wrapper">
            👥 {users.length}

            {users.length > 0 && (
              <span className="user-list-dropdown">
                {users.map(user => (
                  <span
                    key={user.id}
                    className="user-list-item"
                    style={{ color: user.color }}>
                    {user.name}
                  </span>
                ))}
              </span>
            )}
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
          position="left"
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          size={size}
          setSize={setSize}
          showColorPicker={showColorPicker}
          setShowColorPicker={setShowColorPicker}
        />

        <PointerTrail active={tool === 'pointer'} />
        
        <Canvas 
          tool={tool}
          setTool={setTool}
          color={color}
          size={size[tool]}
          setShowColorPicker={setShowColorPicker}
          whiteboardId={whiteboardId}
          socket={socketRef.current}
          currentUser={currentUser}
          onDrawing={handleDrawing}
          onCursorMove={handleCursorMove}
          textBoxes={textBoxes}
          notes={notes} // Przekazanie notatek
          onNoteCreate={handleNoteCreate}
          onNoteUpdate={handleNoteUpdate}
          onNoteDelete={handleNoteDelete}
        />
        
        <Sidebar 
          whiteboardId={whiteboardId}
          socket={socketRef.current}
          currentUser={currentUser}
        />

        {showColorPicker && (
          <div className="color-picker-wrapper">
            <ColorPicker 
              color={color} 
              setColor={setColor} 
              setShowColorPicker={setShowColorPicker} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Whiteboard;
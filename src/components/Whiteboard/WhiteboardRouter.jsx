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

  const [textBoxes, setTextBoxes] = useState([]);
  const [notes, setNotes] = useState([]);
  const [users, setUsers] = useState([]);

  // 🔑 Zachowujemy użytkownika w sessionStorage
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
  const hasJoinedRef = useRef(false);
  const usersIntervalRef = useRef(null);

  useEffect(() => {
    if (whiteboardId && !hasJoinedRef.current) {
      initializeSocket(whiteboardId);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (usersIntervalRef.current) {
        clearInterval(usersIntervalRef.current);
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

    newSocket.on('connect', () => {
      console.log("✅ Connected to server");

      // Dołączamy do whiteboardu
      if (!hasJoinedRef.current) {
        hasJoinedRef.current = true;
        newSocket.emit('join-whiteboard', {
          whiteboardId,
          user: currentUser
        });
      }

      // 🔄 Pobieraj pełną listę użytkowników po dołączeniu
      newSocket.emit('get-users', { whiteboardId });
      setIsLoading(false);

      // 🔄 Odświeżaj listę użytkowników co 10 sekund
      usersIntervalRef.current = setInterval(() => {
        newSocket.emit('get-users', { whiteboardId });
      }, 10000);
    });

    // 🔹 Eventy
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

    newSocket.on('whiteboard-data', (data) => {
      if (data.textBoxes) setTextBoxes(data.textBoxes);
      if (data.notes) setNotes(data.notes);
    });

    newSocket.on('text-create', (data) => {
      setTextBoxes(prev => [...prev, data.textBox]);
    });

    newSocket.on('text-delete', (data) => {
      setTextBoxes(prev => prev.filter(tb => tb.id !== data.id));
    });

    newSocket.on('note-create', (data) => {
      setNotes(prev => [...prev, data.note]);
    });

    newSocket.on('note-delete', (data) => {
      setNotes(prev => prev.filter(note => note.id !== data.id));
    });

    newSocket.on('connect_error', (error) => {
      console.error("❌ Connection error:", error);
      setIsLoading(false);
    });
  };

  // Funkcje obsługi notatek i rysowania
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

  const copyInviteLink = async () => {
    if (!whiteboardId) return;
    const link = `${window.location.origin}/${whiteboardId}`;
    try {
      await navigator.clipboard.writeText(link);
      alert('✅ Invite link copied!');
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('✅ Invite link copied!');
    }
  };

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', background: '#f0f0f0' }}>
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
          <span className="user-count-wrapper">
            👥 {users.length}
            {users.length > 0 && (
              <span className="user-list-dropdown">
                {users.map(user => (
                  <span key={user.id} className="user-list-item" style={{ color: user.color }}>
                    {user.name}
                  </span>
                ))}
              </span>
            )}
          </span>
        </div>
        <div className="header-controls">
          <button className="invite-btn" onClick={copyInviteLink}>📋 Copy Invite Link</button>
          <button className="fullscreen-btn">⛶ Fullscreen</button>
          <button className="save-btn">💾 Save</button>
        </div>
      </div>

      <div className="whiteboard-main">
        <Toolbar 
          tool={tool} setTool={setTool} color={color} setColor={setColor} 
          size={size} setSize={setSize} showColorPicker={showColorPicker} setShowColorPicker={setShowColorPicker} 
        />
        <PointerTrail active={tool === 'pointer'} />
        <Canvas 
          tool={tool} color={color} setTool={setTool} size={size[tool]} setShowColorPicker={setShowColorPicker} 
          whiteboardId={whiteboardId} socket={socketRef.current} currentUser={currentUser} 
          onDrawing={handleDrawing} onCursorMove={handleCursorMove} textBoxes={textBoxes} 
          notes={notes} onNoteCreate={handleNoteCreate} onNoteUpdate={handleNoteUpdate} onNoteDelete={handleNoteDelete} 
        />
        <Sidebar whiteboardId={whiteboardId} socket={socketRef.current} currentUser={currentUser} />
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

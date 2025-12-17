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

  // Emojis
  const [emojis, setEmojis] = useState([]);
  const [activeEmoji, setActiveEmoji] = useState(null);

  // Gifs
  const [gifs, setGifs] = useState([]);
  const [activeGif, setActiveGif] = useState(null);

  // Shapes
  const [shapes, setShapes] = useState([]);
  const [activeShape, setActiveShape] = useState(null);

  // Users
  const [users, setUsers] = useState([]); // Dodano: Lista aktywnych użytkowników

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("whiteboard-user");
    
    if (saved) {
      return JSON.parse(saved);
    }
    
    const userId = 'user_' + Math.random().toString(36).substring(2, 15);
    const userName = 'User' + Math.floor(Math.random() * 1000);
    const userColor = `hsl(${Math.random() * 360}, 80%, 60%)`;
    
    //onsole.log("👤 Generated user:", { id: userId, name: userName, color: userColor });
    
    const user = {
      id: userId,
      name: userName,
      color: userColor
    };
    
    localStorage.setItem("whiteboard-user", JSON.stringify(user));
    return user;
  });

  const [showUserColorPicker, setShowUserColorPicker] = useState(false);
  const [showUsersList, setShowUsersList] = useState(false); // Dodano: Stan do pokazywania listy użytkowników

  const socketRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const userColorPickerRef = useRef(null);
  const userColorDotRef = useRef(null);
  const usersListRef = useRef(null); // Dodano: Ref dla listy użytkowników
  const usersCounterRef = useRef(null); // Dodano: Ref dla licznika użytkowników

  // Funkcja do wysyłania aktualizacji użytkownika na serwer
  const updateUserOnServer = (updates) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('user-update', {
        whiteboardId,
        updates
      });
      console.log("📤 Sent user update to server:", updates);
    }
  };

  // Funkcja zmiany koloru użytkownika
  const handleUserColorChange = (newColor) => {
    const updatedUser = { ...currentUser, color: newColor };
    setCurrentUser(updatedUser);
    localStorage.setItem("whiteboard-user", JSON.stringify(updatedUser));
    
    // WYSLIJ AKTUALIZACJE NA SERWER - DODANO
    updateUserOnServer({ color: newColor });
  };

  // Funkcja zmiany nazwy użytkownika
  const handleUserNameChange = (newName) => {
    if (newName.trim() === '') return;
    
    const updatedUser = { ...currentUser, name: newName };
    setCurrentUser(updatedUser);
    localStorage.setItem("whiteboard-user", JSON.stringify(updatedUser));
    
    // WYSLIJ AKTUALIZACJE NA SERWER - DODANO
    updateUserOnServer({ name: newName });
  };

  // Obsługa kliknięć poza pickerem koloru użytkownika
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Jeśli picker jest widoczny i kliknięto POZA nim i POZA kropką
      if (showUserColorPicker && 
          userColorPickerRef.current && 
          !userColorPickerRef.current.contains(event.target) &&
          userColorDotRef.current && 
          !userColorDotRef.current.contains(event.target)) {
        setShowUserColorPicker(false);
      }
      
      // Dodano: Obsługa kliknięcia poza listą użytkowników
      if (showUsersList && 
          usersListRef.current && 
          !usersListRef.current.contains(event.target) &&
          usersCounterRef.current && 
          !usersCounterRef.current.contains(event.target)) {
        setShowUsersList(false);
      }
    };

    // Dodaj listener zawsze
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserColorPicker, showUsersList]); // Dodano: showUsersList do zależności

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

    newSocket.on('whiteboard-data', (data) => {
      console.log("📦 Received whiteboard data:", {
        notes: data.notes?.length || 0,
        textBoxes: data.textBoxes?.length || 0,
        notesDetails: data.notes?.map(n => ({ id: n.id, x: n.x, y: n.y })) || [],
        users: data.users?.length || 0
      });

      if (data.textBoxes) {
        setTextBoxes(data.textBoxes);
      }
      if (data.notes) {
        setNotes(data.notes);
      }
      if (data.gifs) {
        setGifs(data.gifs);
      }
      if (data.shapes) {
        setShapes(data.shapes);
      }
      if (data.emojis) {
        setEmojis(data.emojis);
      }
      
      // Dodano: Pobieranie listy użytkowników z danych
      if (data.users) {
        setUsers(data.users);
      }
    });

    // Dodano: Obsługa aktualizacji listy użytkowników
    newSocket.on('users-updated', (data) => {
      console.log("👥 Users updated:", data.users?.length || 0);
      setUsers(data.users || []);
    });

    // Dodano: Obsługa dołączenia nowego użytkownika
    newSocket.on('user-joined', (data) => {
      console.log("👤 User joined:", data.user.name);
      setUsers(data.users || []);
    });

    // Dodano: Obsługa wyjścia użytkownika
    newSocket.on('user-left', (data) => {
      console.log("👤 User left:", data.userId);
      setUsers(data.users || []);
    });

    // Dodano: Obsługa aktualizacji użytkownika (np. zmiana koloru/nicku)
    newSocket.on('user-updated', (data) => {
      console.log("👤 User updated:", data.userId, data.updates);
      
      // Aktualizuj lokalną listę użytkowników
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === data.userId 
            ? { ...user, ...data.updates }
            : user
        )
      );
    });

    newSocket.on('connect_error', (error) => {
      console.error("❌ Connection error:", error);
      setIsLoading(false);
    });
  };

  // Shapes
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

  // Gif
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

  // Emojis
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

  // Notatki
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
        <div className="whiteboard-info" style={{ position: 'relative' }}>
          <span className="whiteboard-id" style={{ display: "inline-block", margin: "0px 10px 0px 0px" }}>
            Room: {whiteboardId}
          </span>
          <span className="user-info">
            You:&nbsp;
            <input
              value={currentUser.name}
              onChange={(e) => handleUserNameChange(e.target.value)}
              onBlur={(e) => {
                if (e.target.value.trim() === '') {
                  handleUserNameChange('User' + Math.floor(Math.random() * 1000));
                }
              }}
              style={{
                border: "none",
                borderBottom: "1px dashed rgba(255,255,255,0.6)",
                background: "transparent",
                color: "white",
                width: "110px",
                outline: "none"
              }}
            />
          </span>
          
          {/* Kropka użytkownika - kliknięcie otwiera picker */}
          <span
            ref={userColorDotRef}
            className="user-color"
            onClick={(e) => {
              e.stopPropagation();
              setShowUserColorPicker(true);
            }}
            style={{
              display: "inline-block",
              width: "14px",
              height: "14px",
              marginLeft: "8px",
              background: currentUser.color,
              borderRadius: "50%",
              cursor: "pointer",
              border: "1px solid #fff",
              position: "relative"
            }}
          />
          
          {/* ColorPicker dla koloru użytkownika */}
          {showUserColorPicker && (
            <div 
              ref={userColorPickerRef}
              className="user-color-picker-wrapper"
              style={{
                position: "absolute",
                top: "35px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1000,
                background: "white",
                borderRadius: "8px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                overflow: 'hidden'
              }}
            >
              <ColorPicker 
                color={currentUser.color} 
                setColor={handleUserColorChange}
                setShowColorPicker={setShowUserColorPicker}
              />
            </div>
          )}
          
          {/* Dodano: Licznik aktywnych użytkowników z rozwijaną listą */}
          <div style={{ position: 'relative', display: 'inline-block', marginLeft: '15px' }}>
            <span
              ref={usersCounterRef}
              className="users-counter"
              onMouseEnter={() => setShowUsersList(true)}
              onMouseLeave={() => setShowUsersList(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
                padding: '3px 10px',
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                fontSize: '13px',
                color: 'white',
                transition: 'all 0.2s ease',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              👥 Active Users: <strong style={{ marginLeft: '4px' }}>{users.length}</strong>
            </span>
            
            {/* Dodano: Lista użytkowników (pokazuje się na hover) */}
            {showUsersList && users.length > 0 && (
              <div
                ref={usersListRef}
                className="users-list-popup"
                onMouseEnter={() => setShowUsersList(true)}
                onMouseLeave={() => setShowUsersList(false)}
                style={{
                  position: 'absolute',
                  top: '35px',
                  left: '0',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  zIndex: 1000,
                  minWidth: '180px',
                  maxWidth: '250px',
                  padding: '12px',
                  border: '1px solid #e1e1e1'
                }}
              >
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  marginBottom: '8px',
                  fontWeight: '500',
                  borderBottom: '1px solid #eee',
                  paddingBottom: '6px'
                }}>
                  Online Users ({users.length})
                </div>
                
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {users.map(user => (
                    <div 
                      key={user.id} 
                      className="user-list-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: '1px solid #f5f5f5',
                        fontSize: '13px'
                      }}
                    >
                      <div 
                        className="user-color-dot"
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: user.color,
                          marginRight: '8px',
                          flexShrink: 0,
                          border: '1px solid #ddd'
                        }}
                      />
                      <span 
                        className="user-name"
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: '#333',
                          fontWeight: user.id === socketRef.current?.id ? '600' : '400'
                        }}
                        title={user.name}
                      >
                        {user.name} {user.id === socketRef.current?.id && '(You)'}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div style={{ 
                  fontSize: '11px', 
                  color: '#999', 
                  marginTop: '8px',
                  paddingTop: '6px',
                  borderTop: '1px solid #eee',
                  fontStyle: 'italic'
                }}>
                </div>
              </div>
            )}
          </div>
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
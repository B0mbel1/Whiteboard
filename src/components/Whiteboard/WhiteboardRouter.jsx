import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import html2canvas from 'html2canvas';
import Toolbar from '../Toolbar/Toolbar';
import Canvas from '../Canvas/Canvas';
import Sidebar from '../Sidebar/Sidebar';
import PointerTrail from '../Toolbar/PointerTrail';
import ColorPicker from '../Toolbar/ColorPicker';
import './Whiteboard.css';

const WhiteboardRouter = () => {
  const { whiteboardId } = useParams();
  const [tool, setTool] = useState('cursor');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState({ pencil: 3, eraser: 10, brush: 5 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [textBoxes, setTextBoxes] = useState([]);
  const [notes, setNotes] = useState([]);

  const [backgroundMode, setBackgroundMode] = useState('grid');

  // Emojis
  const [emojis, setEmojis] = useState([]);
  const [activeEmoji, setActiveEmoji] = useState(null);

  // Gifs
  const [gifs, setGifs] = useState([]);
  const [activeGif, setActiveGif] = useState(null);

  // Images
  const [images, setImages] = useState([]); // DODANE

  // Shapes
  const [shapes, setShapes] = useState([]);
  const [activeShape, setActiveShape] = useState(null);

  // Users
  const [users, setUsers] = useState([]);

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("whiteboard-user");

    if (saved) {
      return JSON.parse(saved);
    }

    const userId = 'user_' + Math.random().toString(36).substring(2, 15);
    const userName = 'User' + Math.floor(Math.random() * 1000);
    const userColor = `hsl(${Math.random() * 360}, 80%, 60%)`;

    console.log("👤 Generated user:", { id: userId, name: userName, color: userColor });

    const user = {
      id: userId,
      name: userName,
      color: userColor
    };

    localStorage.setItem("whiteboard-user", JSON.stringify(user));
    return user;
  });

  const [showUserColorPicker, setShowUserColorPicker] = useState(false);
  const [showUsersList, setShowUsersList] = useState(false);

  const socketRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const userColorPickerRef = useRef(null);
  const userColorDotRef = useRef(null);
  const usersListRef = useRef(null);
  const usersCounterRef = useRef(null);
  const [zoom, setZoom] = useState(1);

  const [panOffset, setPanOffset] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  });

  const updateUserOnServer = (updates) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('user-update', {
        whiteboardId,
        updates
      });
      console.log("📤 Sent user update to server:", updates);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Błąd podczas próby włączenia pełnego ekranu: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleUserColorChange = (newColor) => {
    const updatedUser = { ...currentUser, color: newColor };
    setCurrentUser(updatedUser);
    localStorage.setItem("whiteboard-user", JSON.stringify(updatedUser));
    updateUserOnServer({ color: newColor });

    setUsers(prevUsers => prevUsers.map(u =>
      u.id === currentUser.id ? { ...u, color: newColor } : u
    ));
  };

  const handleUserNameChange = (newName) => {
    if (newName.trim() === '') return;

    const updatedUser = { ...currentUser, name: newName };
    setCurrentUser(updatedUser);
    localStorage.setItem("whiteboard-user", JSON.stringify(updatedUser));
    updateUserOnServer({ name: newName });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserColorPicker &&
        userColorPickerRef.current &&
        !userColorPickerRef.current.contains(event.target) &&
        userColorDotRef.current &&
        !userColorDotRef.current.contains(event.target)) {
        setShowUserColorPicker(false);
      }

      if (showUsersList &&
        usersListRef.current &&
        !usersListRef.current.contains(event.target) &&
        usersCounterRef.current &&
        !usersCounterRef.current.contains(event.target)) {
        setShowUsersList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserColorPicker, showUsersList]);

  useEffect(() => {
    if (whiteboardId && !hasJoinedRef.current) {
      initializeSocket(whiteboardId);
    }

    return () => {
      if (socketRef.current) {
        console.log("🔌 Disconnecting socket");
        socketRef.current.disconnect();
      }
      hasJoinedRef.current = false;
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
      if (data.images) { // DODANE
        setImages(data.images);
      }
      if (data.shapes) {
        setShapes(data.shapes);
      }
      if (data.emojis) {
        setEmojis(data.emojis);
      }

      if (data.users) {
        setUsers(data.users);
      }

      if (data.backgroundMode) {
        setBackgroundMode(data.backgroundMode);
      }
    });

    newSocket.on('background-update', (data) => {
      setBackgroundMode(data.mode);
    });

    newSocket.on('users-updated', (data) => {
      console.log("👥 Users updated:", data.users?.length || 0);
      setUsers(data.users || []);
    });

    newSocket.on('user-joined', (data) => {
      console.log("👤 User joined:", data.user.name);
      setUsers(data.users || []);
    });

    newSocket.on('user-left', (data) => {
      console.log("👤 User left:", data.userId);
      setUsers(data.users || []);
    });

    newSocket.on('user-updated', (data) => {
      console.log("👤 User updated:", data.userId, data.updates);

      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === data.userId
            ? { ...user, ...data.updates }
            : user
        )
      );
    });

    // Images listeners
    newSocket.on('image-create', (data) => {
      setImages(prev => [...prev, data.image]);
    });

    newSocket.on('image-delete', (data) => {
      setImages(prev => prev.filter(img => img.id !== data.id));
    });

    newSocket.on('image-update', (data) => {
      setImages(prev => prev.map(img => img.id === data.id ? { ...img, ...data } : img));
    });

    newSocket.on('connect_error', (error) => {
      console.error("❌ Connection error:", error);
      setIsLoading(false);
    });

    newSocket.on('note-create', (data) => {
      setNotes(prev => [...prev, data.note]);
    });
    newSocket.on('note-update', (data) => {
      setNotes(prev => prev.map(n => {
        // Sprawdzamy czy to ta notatka, której id przyszło z serwera
        if (n.id === data.id) {
          // Scalamy stary stan notatki z nowymi danymi (np. nowym tekstem)
          return { ...n, ...data };
        }
        return n;
      }));
    });
    newSocket.on('note-delete', (data) => {
      setNotes(prev => prev.filter(n => n.id !== data.id));
    });

    newSocket.on('text-create', (data) => {
      setTextBoxes(prev => [...prev, data.textBox]);
    });
    newSocket.on('text-update', (data) => {
      setTextBoxes(prev => prev.map(t => {
        if (t.id === data.id) {
          // Scalamy stary stan z nowymi danymi (np. nowym tekstem)
          return { ...t, ...data };
        }
        return t;
      }));
    });
    newSocket.on('text-delete', (data) => {
      setTextBoxes(prev => prev.filter(t => t.id !== data.id));
    });
  };

  useEffect(() => {
    const handleResize = () => {
      // Opcjonalnie można tu aktualizować, ale zazwyczaj wystarczy init
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleBackgroundChange = (newMode) => {
    setBackgroundMode(newMode);
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('background-update', { whiteboardId, mode: newMode });
    }
  };

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

  // Images Handlers
  const handleImageCreate = (image) => {
    // Aktualizuj lokalny stan natychmiast
    setImages(prev => [...prev, image]);

    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('image-create', { whiteboardId, image });
    }
  };

  const handleImageDelete = (id) => {
    // Aktualizuj lokalny stan natychmiast
    setImages(prev => prev.filter(img => img.id !== id));

    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('image-delete', { whiteboardId, id });
    }
  };

  const handleImageUpdate = (id, updates) => {
    // Aktualizuj lokalny stan natychmiast
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));

    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('image-update', { whiteboardId, id, ...updates });
    }
  };

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

  const handleNoteCreate = (note) => {
    setNotes(prev => [...prev, note]); // 🔹 Aktualizujemy stan lokalnie
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('note-create', { whiteboardId, note });
    }
  };

  const handleNoteUpdate = (id, updates) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n)); // 🔹 Aktualizujemy stan lokalnie
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('note-update', { whiteboardId, id, ...updates });
    }
  };

  const handleTextCreate = (textBox) => {
    setTextBoxes(prev => [...prev, textBox]); // 🔹 Aktualizujemy stan lokalnie
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('text-create', { whiteboardId, textBox });
    }
  };

  const handleTextUpdate = (id, updates) => {
    setTextBoxes(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t)); // 🔹 Aktualizujemy stan lokalnie
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('text-update', { whiteboardId, id, ...updates });
    }
  };

  const handleTextDelete = (id) => {
    setTextBoxes(prev => prev.filter(t => t.id !== id)); // 🔹 Aktualizujemy stan lokalnie
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('text-delete', { whiteboardId, id });
    }
  };

  const handleNoteDelete = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id)); // 🔹 Aktualizujemy stan lokalnie
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('note-delete', { whiteboardId, id });
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

  const lastCursorTimeRef = useRef(0);

  const handleCursorMove = (position) => {
    const now = Date.now();
    // Wysyłamy dane max co 50ms
    if (now - lastCursorTimeRef.current > 50) {
      if (socketRef.current && whiteboardId) {
        socketRef.current.emit('cursor-move', {
          whiteboardId,
          position
        });
        lastCursorTimeRef.current = now;
      }
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

  const handleSave = async () => {
    try {
      const canvasArea = document.querySelector('.canvas-area');
      if (!canvasArea) {
        alert('Nie znaleziono obszaru canvas!');
        return;
      }

      const elementsToHide = [
        '.background-toggle',
        '.remote-cursor',
        '.selection-overlay'
      ];

      const originalStyles = [];

      elementsToHide.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          originalStyles.push({
            element: el,
            display: el.style.display
          });
          el.style.display = 'none';
        });
      });

      const saveBtn = document.querySelector('.save-btn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = '⏳ Saving...';

      try {
        const canvas = await html2canvas(canvasArea, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          ignoreElements: (element) => {
            return (
              element.classList?.contains('background-toggle') ||
              element.classList?.contains('remote-cursor') ||
              element.classList?.contains('selection-overlay')
            );
          }
        });

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

        link.download = `whiteboard-${whiteboardId || 'drawing'}_${dateStr}_${timeStr}.png`;
        link.href = dataUrl;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('✅ Whiteboard saved!');

      } finally {
        originalStyles.forEach(({ element, display }) => {
          if (display) {
            element.style.display = display;
          } else {
            element.style.removeProperty('display');
          }
        });

        saveBtn.textContent = originalText;
      }

    } catch (error) {
      console.error('Error saving whiteboard:', error);
      alert('Error saving whiteboard: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="whiteboard-loading-screen">
        <h2>Joining whiteboard {whiteboardId}...</h2>
        <div>Please wait</div>
      </div>
    );
  }

  return (
    <div className="whiteboard">
      <div className="whiteboard-header">
        <div className="whiteboard-info">
          <span className="whiteboard-id">
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
              className="user-name-input"
            />
          </span>

          {/* Kropka koloru użytkownika z inputem color */}
          <div className="user-color-wrapper">
            <label
              htmlFor="user-color-input"
              ref={userColorDotRef}
              className="user-color-dot"
              style={{
                backgroundColor: currentUser.color,
                cursor: 'pointer'
              }}
              title="Change your color"
            />

            {/* Ukryty input type="color" */}
            <input
              id="user-color-input"
              type="color"
              value={currentUser.color}
              onChange={(e) => handleUserColorChange(e.target.value)}
              style={{
                position: 'absolute',
                opacity: 0,
                width: '1px',
                height: '1px',
                pointerEvents: 'none'
              }}
            />
          </div>

          <div className="users-container">
            <span
              ref={usersCounterRef}
              className="users-counter"
              onMouseEnter={() => setShowUsersList(true)}
              onMouseLeave={() => setShowUsersList(false)}
            >
              👥 Active Users: <strong>{users.length}</strong>
            </span>

            {showUsersList && users.length > 0 && (
              <div
                ref={usersListRef}
                className="users-list-popup"
                onMouseEnter={() => setShowUsersList(true)}
                onMouseLeave={() => setShowUsersList(false)}
              >
                <div className="users-list-title">
                  Online Users ({users.length})
                </div>

                <div className="users-list-scroll">
                  {users.map(user => (
                    <div
                      key={user.id}
                      className="user-list-item"
                    >
                      <div
                        className="user-color-indicator"
                        style={{ backgroundColor: user.color }}
                      />
                      <span
                        className="user-name"
                        title={user.name}
                      >
                        {user.name} {user.id === socketRef.current?.id && '(You)'}
                      </span>
                    </div>
                  ))}
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
          <button
            className="fullscreen-btn"
            onClick={toggleFullscreen}
          >
            ⛶ Fullscreen
          </button>
          <button className="save-btn" onClick={handleSave}>💾 Save</button>
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
          onImageCreate={handleImageCreate} // DODANE
          panOffset={panOffset}
          zoom={zoom}
        />

        <PointerTrail
          active={tool === 'pointer'}
          socket={socketRef.current}
          whiteboardId={whiteboardId}
          zoom={zoom}             // 🔹 Dodaj toS
          panOffset={panOffset}
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
          users={users}
          onDrawing={handleDrawing}
          onCursorMove={handleCursorMove}
          textBoxes={textBoxes}
          notes={notes}
          onTextCreate={handleTextCreate}
          onTextUpdate={handleTextUpdate}
          onTextDelete={handleTextDelete}
          onNoteCreate={handleNoteCreate}
          onNoteUpdate={handleNoteUpdate}
          onNoteDelete={handleNoteDelete}
          emojis={emojis}
          activeEmoji={activeEmoji}
          setActiveEmoji={setActiveEmoji}
          onEmojiCreate={handleEmojiCreate}
          onEmojiUpdate={handleEmojiUpdate}
          onEmojiDelete={handleEmojiDelete}
          gifs={gifs}
          activeGif={activeGif}
          onGifCreate={handleGifCreate}
          onGifDelete={handleGifDelete}
          onGifUpdate={handleGifUpdate}
          images={images} // DODANE
          onImageCreate={handleImageCreate} // DODANE
          onImageUpdate={handleImageUpdate} // DODANE
          onImageDelete={handleImageDelete} // DODANE
          shapes={shapes}
          activeShape={activeShape}
          onShapeCreate={handleShapeCreate}
          onShapeDelete={handleShapeDelete}
          onShapeUpdate={handleShapeUpdate}
          backgroundMode={backgroundMode}
          onBackgroundChange={handleBackgroundChange}
          panOffset={panOffset}
          setPanOffset={setPanOffset}
          zoom={zoom}       // 🔹 PRZEKAZUJEMY WARTOŚĆ
          setZoom={setZoom} // 🔹 PRZEKAZUJEMY SETTER
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
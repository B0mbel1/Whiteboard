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
  
  // Dane tablicy
  const [textBoxes, setTextBoxes] = useState([]);
  const [notes, setNotes] = useState([]); 
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]); 
  
  // 🔹 NOWE: Dodano stany wymagane przez Canvas, aby uniknąć błędu crashowania
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [backgroundMode, setBackgroundMode] = useState('grid');

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
  
  const socketRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-create whiteboard when component mounts (main route)
    createNewWhiteboard();
  }, []);

  const createNewWhiteboard = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("📝 Creating new whiteboard...");
      
      const response = await fetch('http://localhost:3001/api/create-whiteboard');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create whiteboard');
      }
      
      const newWhiteboardId = data.whiteboardId;
      
      console.log("🎯 New whiteboard ID:", newWhiteboardId);
      
      // Update URL to show the whiteboard ID
      navigate(`/${newWhiteboardId}`, { replace: true });
      setWhiteboardId(newWhiteboardId);
      
      // Initialize socket and join whiteboard
      initializeSocket(newWhiteboardId);
      
      // ⚠️ WAŻNA POPRAWKA: Usunięto blok 'finally' z setIsLoading(false).
      // Nie wyłączamy ładowania tutaj, ponieważ następuje przekierowanie.
      // Wyłączenie ładowania powodowało próbę renderowania Canvasu bez danych, co crashowało aplikację.
      
    } catch (error) {
      console.error('Error creating whiteboard:', error);
      setError(error.message);
      setIsLoading(false); // Wyłączamy ładowanie TYLKO w przypadku błędu
    }
  };

  const initializeSocket = (whiteboardId) => {
    try {
      hasJoinedRef.current = false;
      
      const newSocket = io('http://localhost:3001', {
        timeout: 10000,
        transports: ['websocket', 'polling']
      });
      
      socketRef.current = newSocket;
      setSocket(newSocket);

      console.log("🔌 Socket initialized for whiteboard:", whiteboardId);

      newSocket.on('connect', () => {
        console.log("✅ Socket connected successfully");
        
        if (!hasJoinedRef.current) {
          hasJoinedRef.current = true;
          newSocket.emit('join-whiteboard', {
            whiteboardId: whiteboardId,
            user: currentUser
          });
        }
      });

      newSocket.on('whiteboard-data', (data) => {
          setTextBoxes(data.textBoxes || []);
          setNotes(data.notes || []); 
          setImages(data.images || []);
          setVideos(data.videos || []);
          if (data.backgroundMode) setBackgroundMode(data.backgroundMode);
      });

      newSocket.on('connect_error', (error) => {
        console.error("❌ Socket connection error:", error);
        setError('Failed to connect to server. Please check if the server is running.');
      });

    } catch (error) {
      console.error("❌ Error initializing socket:", error);
      setError('Failed to initialize connection.');
    }
  };

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

  const handleImageCreate = (image) => {
    setImages(prev => [...prev, image]);
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('image-create', { whiteboardId, image });
    }
  };

  const handleImageUpdate = (id, updates) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('image-update', { whiteboardId, id, ...updates });
    }
  };

  const handleImageDelete = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('image-delete', { whiteboardId, id });
    }
  };

  const handleVideoCreate = (video) => {
  setVideos(prev => [...prev, video]);
  if (socketRef.current && whiteboardId) {
    socketRef.current.emit('video-create', { whiteboardId, video });
  }
};

const handleVideoUpdate = (id, updates) => {
  setVideos(prev => prev.map(vid => vid.id === id ? { ...vid, ...updates } : vid));
  if (socketRef.current && whiteboardId) {
    socketRef.current.emit('video-update', { whiteboardId, id, ...updates });
  }
};

const handleVideoDelete = (id) => {
  setVideos(prev => prev.filter(vid => vid.id !== id));
  if (socketRef.current && whiteboardId) {
    socketRef.current.emit('video-delete', { whiteboardId, id });
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

  const handleBackgroundChange = (newMode) => {
    setBackgroundMode(newMode);
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('background-update', { whiteboardId, mode: newMode });
    }
  };

  const copyInviteLink = async () => {
    if (whiteboardId) {
      const link = `${window.location.origin}/${whiteboardId}`;
      try {
        await navigator.clipboard.writeText(link);
        alert('✅ Invite link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('✅ Invite link copied to clipboard!');
      }
    }
  };

  const retryConnection = () => {
    setError(null);
    createNewWhiteboard();
  };

  if (error) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f0f0f0', flexDirection: 'column', gap: '20px', padding: '20px', textAlign: 'center'
      }}>
        <h2 style={{ color: '#e74c3c' }}>Error</h2>
        <div style={{ color: '#666', marginBottom: '10px' }}>{error}</div>
        <button 
          onClick={retryConnection}
          style={{
            padding: '10px 20px', background: '#3498db', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="whiteboard-loading-screen">
        <h2>Creating your whiteboard...</h2>
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
          <button className="invite-btn" onClick={copyInviteLink}>📋 Copy Invite Link</button>
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
          onImageCreate={handleImageCreate}
          onVideoCreate={handleVideoCreate}
          // 🔹 PRZEKAZUJEMY panOffset (Toolbar tego potrzebuje do wyliczania pozycji wklejania)
          panOffset={panOffset}
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
          notes={notes}
          onNoteCreate={handleNoteCreate}
          onNoteUpdate={handleNoteUpdate}
          onNoteDelete={handleNoteDelete}
          images={images}
          onImageCreate={handleImageCreate}
          onImageUpdate={handleImageUpdate}
          onImageDelete={handleImageDelete}
          videos={videos}
          onVideoCreate={handleVideoCreate}
          onVideoUpdate={handleVideoUpdate}
          onVideoDelete={handleVideoDelete}
          // 🔹 PRZEKAZUJEMY brakujące propsy
          panOffset={panOffset}
          setPanOffset={setPanOffset}
          backgroundMode={backgroundMode}
          onBackgroundChange={handleBackgroundChange}
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

export default Whiteboard;
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Toolbar from '../Toolbar/Toolbar';
import Canvas from '../Canvas/Canvas';
import Sidebar from '../Sidebar/Sidebar';
import ColorPicker from '../Toolbar/ColorPicker';
import './Whiteboard.css';

const Whiteboard = () => {
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState({ pencil: 3, eraser: 10, brush: 5 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [socket, setSocket] = useState(null);
  const [whiteboardId, setWhiteboardId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentUser] = useState(() => {
    // Generate a more unique user ID
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
  const hasJoinedRef = useRef(false); // Track if we've already joined
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
      
    } catch (error) {
      console.error('Error creating whiteboard:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeSocket = (whiteboardId) => {
    try {
      // Reset join tracking
      hasJoinedRef.current = false;
      
      // Initialize socket connection
      const newSocket = io('http://localhost:3001', {
        timeout: 10000,
        transports: ['websocket', 'polling']
      });
      
      socketRef.current = newSocket;
      setSocket(newSocket);

      console.log("🔌 Socket initialized for whiteboard:", whiteboardId);
      console.log("👤 Current user:", currentUser);

      // Set up connection handlers
      newSocket.on('connect', () => {
        console.log("✅ Socket connected successfully");
        
        // Join the whiteboard only once after connection is established
        if (!hasJoinedRef.current) {
          hasJoinedRef.current = true;
          newSocket.emit('join-whiteboard', {
            whiteboardId: whiteboardId,
            user: currentUser
          });
        }
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
        // Fallback for browsers that don't support clipboard API
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

  const retryConnection = () => {
    setError(null);
    createNewWhiteboard();
  };

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
        />
        
        <Canvas 
          tool={tool}
          color={color}
          size={size[tool]}
          setShowColorPicker={setShowColorPicker}
          whiteboardId={whiteboardId}
          socket={socketRef.current}
          currentUser={currentUser}
          onDrawing={handleDrawing}
          onCursorMove={handleCursorMove}
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
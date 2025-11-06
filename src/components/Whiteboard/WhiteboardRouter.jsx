import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Toolbar from '../Toolbar/Toolbar';
import Canvas from '../Canvas/Canvas';
import Sidebar from '../Sidebar/Sidebar';
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

  useEffect(() => {
    if (whiteboardId && !hasJoinedRef.current) {
      initializeSocket(whiteboardId);
    }

    // Cleanup on unmount
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
    
    // Initialize socket connection
    const newSocket = io('http://localhost:3001', {
      timeout: 10000,
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = newSocket;
    setSocket(newSocket);

    console.log("🔌 Socket initialized for whiteboard:", whiteboardId);
    console.log("👤 Current user:", currentUser);

    // Set up connection success handler - JOIN ONLY AFTER CONNECTION
    newSocket.on('connect', () => {
      console.log("✅ Connected to server");
      
      // Join the whiteboard only once after connection is established
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

    newSocket.on('connect_error', (error) => {
      console.error("❌ Connection error:", error);
      setIsLoading(false);
    });

    // Handle reconnection events
    newSocket.on('reconnect', (attempt) => {
      console.log("🔁 Socket reconnected, attempt:", attempt);
      // Don't re-join on reconnect, the server should maintain our state
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      console.log("🔄 Attempting to reconnect:", attempt);
    });
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

export default WhiteboardRouter;
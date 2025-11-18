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
  // ===== Twoje stany UI (nie zmieniamy) =====
  const [tool, setTool] = useState('cursor');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState({ pencil: 3, eraser: 10, brush: 5 });
  const [showColorPicker, setShowColorPicker] = useState(false);

  // ===== Logika koleżanki: socket + backend =====
  const [socket, setSocket] = useState(null);
  const [whiteboardId, setWhiteboardId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const navigate = useNavigate();

  // ===== User info koleżanki (nie koliduje z Twoim kodem) =====
  const [currentUser] = useState(() => {
    const id = 'user_' + Math.random().toString(36).substring(2, 15);
    const name = 'User' + Math.floor(Math.random() * 1000);
    const color = `hsl(${Math.random() * 360}, 80%, 60%)`;

    return { id, name, color };
  });

  // Auto create whiteboard
  useEffect(() => {
    createNewWhiteboard();
  }, []);

  // ===== CREATE WHITEBOARD =====
  const createNewWhiteboard = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('http://localhost:3001/api/create-whiteboard');
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      setWhiteboardId(data.whiteboardId);

      // Update URL
      navigate(`/${data.whiteboardId}`, { replace: true });

      // Init socket
      initializeSocket(data.whiteboardId);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== INIT SOCKET =====
  const initializeSocket = (whiteboardId) => {
    hasJoinedRef.current = false;

    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      if (!hasJoinedRef.current) {
        hasJoinedRef.current = true;
        newSocket.emit('join-whiteboard', {
          whiteboardId,
          user: currentUser
        });
      }
    });

    newSocket.on('connect_error', () => {
      setError('Cannot connect to server.');
    });
  };

  // ===== DRAWING & CURSOR EVENTS =====
  const handleDrawing = (drawingData) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('drawing', {
        whiteboardId,
        ...drawingData
      });
    }
  };

  const handleCursorMove = (pos) => {
    if (socketRef.current && whiteboardId) {
      socketRef.current.emit('cursor-move', {
        whiteboardId,
        position: pos
      });
    }
  };

  // ===== INVITE LINK =====
  const copyInviteLink = async () => {
    const link = `${window.location.origin}/${whiteboardId}`;
    await navigator.clipboard.writeText(link);
    alert('Link copied!');
  };

  // ===== LOADING / ERROR UI =====
  if (error) {
    return (
      <div className="error-screen">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={createNewWhiteboard}>Retry</button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-screen">
        <h2>Creating whiteboard...</h2>
      </div>
    );
  }

  // ===== FINAL RENDER (Twoje UI + socket) =====
  return (
    <div className="whiteboard">

      {/* Header – Twój + koleżanki */}
      <div className="whiteboard-header">
        <button className="fullscreen-btn">⛶ Fullscreen</button>
        <div className='save-btn'>Zapisz💾</div>
        <div className="file-menu">Plik ▼</div>

        <div className="whiteboard-info">
          <span>Room: {whiteboardId}</span>
          <span>You: {currentUser.name}</span>
        </div>

        <button className="invite-btn" onClick={copyInviteLink}>📋 Invite</button>
      </div>

      <div className="whiteboard-main">

        {/* Toolbar LEFT — Twój kod */}
        <Toolbar 
          position="left"
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          size={size}
          setSize={setSize}
          setShowColorPicker={setShowColorPicker}
        />

        {/* Pointer trail – Twój */}
        <PointerTrail active={tool === 'pointer'} />

        {/* Canvas — Twój + socket.io */}
        <Canvas 
          tool={tool}
          setTool={setTool}
          color={color}
          size={size}
          setShowColorPicker={setShowColorPicker}
          whiteboardId={whiteboardId}
          socket={socketRef.current}
          currentUser={currentUser}
          onDrawing={handleDrawing}
          onCursorMove={handleCursorMove}
        />

        {/* Sidebar — Twój */}
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

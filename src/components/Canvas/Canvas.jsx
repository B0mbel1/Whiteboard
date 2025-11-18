import React, { useState, useRef, useEffect } from 'react';
import './Canvas.css';
import Note from './Note';

const Canvas = ({
  tool,
  color,
  size,
  setShowColorPicker,
  setTool,
  whiteboardId,
  socket,
  currentUser,
  onDrawing,
  onCursorMove
}) => {
  const [backgroundMode, setBackgroundMode] = useState('grid');
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [remoteCursors, setRemoteCursors] = useState(new Map());

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentDrawingRef = useRef(null);

  const safeSetTool = typeof setTool === 'function' ? setTool : () => { };

  // 🔹 Resize canvas and preserve content
  const updateCanvasSize = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = contextRef.current;
    if (!canvas || !container || !ctx) return;

    const rect = container.getBoundingClientRect();
    if (canvas.width === rect.width && canvas.height === rect.height) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.putImageData(imageData, 0, 0);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = getToolSize();
  };

  const getToolSize = () => {
    const baseSize = size?.[tool] ?? 3;
    if (tool === 'pencil') return Math.max(1, baseSize - 2);
    if (tool === 'brush') return baseSize + 10;
    if (tool === 'eraser') return baseSize + 30;
    return baseSize;
  };

  // 🔹 Setup canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    contextRef.current = ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = getToolSize();

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx) return;
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = getToolSize();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  }, [color, size, tool]);

  // 🔹 Notes selection & removal
  const removeNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedNoteId) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        removeNote(selectedNoteId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId]);

  const backgroundModes = [
    { id: 'white', name: 'Białe tło', icon: '🌕' },
    { id: 'grid', name: 'Kratka', icon: '🏁' },
    { id: 'lines', name: 'Siatka linii', icon: '📐' },
    { id: 'black', name: 'Czarne tło', icon: '🌑' },
  ];

  const toggleBackground = () => {
    const currentIndex = backgroundModes.findIndex(mode => mode.id === backgroundMode);
    const nextIndex = (currentIndex + 1) % backgroundModes.length;
    setBackgroundMode(backgroundModes[nextIndex].id);
    setTimeout(clearCanvas, 100);
  };

  const getCurrentBackgroundIcon = () =>
    backgroundModes.find(mode => mode.id === backgroundMode)?.icon;

  const clearCanvas = () => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (backgroundMode === 'white') {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (backgroundMode === 'black') {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // 🔹 Local drawing
  const startDrawing = ({ nativeEvent }) => {
    if (setShowColorPicker) setShowColorPicker(false);
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);

    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);

    currentDrawingRef.current = { tool, color, size, points: [{ x, y }] };
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    contextRef.current.closePath();
    setIsDrawing(false);

    if (currentDrawingRef.current && socket && whiteboardId) {
      socket.emit('drawing', { whiteboardId, ...currentDrawingRef.current });
    }

    if (currentDrawingRef.current && onDrawing) {
      onDrawing(currentDrawingRef.current);
    }

    currentDrawingRef.current = null;
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing || !contextRef.current) return;
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);

    if (currentDrawingRef.current) currentDrawingRef.current.points.push({ x, y });

    const ctx = contextRef.current;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.shadowBlur = 0;
    } else if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.shadowBlur = 5;
      ctx.shadowColor = color;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.shadowBlur = 0;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  // 🔹 Updated mouse down: handle notes + drawing
  const handleMouseDown = (e) => {
    if (tool === 'notes') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setNotes(prev => [...prev, { id: Date.now(), x, y, text: '' }]);

      // używamy safeSetTool zamiast setTool
      safeSetTool('cursor');

      e.stopPropagation();
      return;
    }

    startDrawing(e);
  };

  const handleMouseMove = (e) => {
    if (tool !== 'notes') draw(e);
    if (onCursorMove) {
      const pos = getCanvasCoordinates(e.clientX, e.clientY);
      onCursorMove(pos);
    }
  };

  // 🔹 Socket.io: remote drawings & cursors
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDrawing = (data) => drawRemote(data);
    const handleRemoteCursorMove = (data) => {
      if (data.userId !== socket.id) {
        setRemoteCursors(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId, { ...data, lastUpdate: Date.now() });
          return newMap;
        });
      }
    };
    const handleWhiteboardState = (data) => {
      clearCanvas();
      data.drawingData.forEach(drawRemote);
      const cursorsMap = new Map();
      data.users.filter(u => u.id !== socket.id).forEach(u => cursorsMap.set(u.id, { userId: u.id, position: u.position, user: u, lastUpdate: Date.now() }));
      setRemoteCursors(cursorsMap);
    };
    const handleUsersUpdated = (data) => {
      setRemoteCursors(prev => {
        const newMap = new Map();
        for (const [userId, cursor] of prev) {
          if (data.users.some(user => user.id === userId)) newMap.set(userId, cursor);
        }
        return newMap;
      });
    };

    socket.on('drawing', handleRemoteDrawing);
    socket.on('cursor-move', handleRemoteCursorMove);
    socket.on('whiteboard-data', handleWhiteboardState);
    socket.on('user-joined', handleUsersUpdated);
    socket.on('user-left', handleUsersUpdated);

    return () => {
      socket.off('drawing', handleRemoteDrawing);
      socket.off('cursor-move', handleRemoteCursorMove);
      socket.off('whiteboard-data', handleWhiteboardState);
      socket.off('user-joined', handleUsersUpdated);
      socket.off('user-left', handleUsersUpdated);
    };
  }, [socket]);

  const drawRemote = (data) => {
    const ctx = contextRef.current;
    if (!ctx || !data.points?.length) return;

    ctx.save();
    if (data.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = data.size;
      ctx.shadowBlur = 0;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = data.tool === 'brush' ? 5 : 0;
      ctx.shadowColor = data.tool === 'brush' ? data.color : 'transparent';
    }

    ctx.beginPath();
    ctx.moveTo(data.points[0].x, data.points[0].y);
    for (let i = 1; i < data.points.length; i++) ctx.lineTo(data.points[i].x, data.points[i].y);
    ctx.stroke();
    ctx.restore();
  };

  // 🔹 Clean up stale cursors
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors(prev => {
        const newMap = new Map();
        for (const [userId, cursor] of prev) {
          if (now - cursor.lastUpdate < 5000) newMap.set(userId, cursor);
        }
        return newMap;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const remoteCursorsArray = Array.from(remoteCursors.values());

  return (
    <div className="canvas-container" ref={containerRef}>
      <div className={`canvas-area background-${backgroundMode}`}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseUp={stopDrawing}
          onMouseMove={handleMouseMove}
          onMouseLeave={stopDrawing}
          style={{ cursor: tool === 'eraser' ? 'crosshair' : 'default', width: '100%', height: '100%', display: 'block' }}
        />

        {/* Render remote cursors */}
        {remoteCursorsArray.map(cursor => cursor.position && (
          <div key={cursor.userId} className="remote-cursor" style={{
            position: 'absolute',
            left: cursor.position.x,
            top: cursor.position.y,
            pointerEvents: 'none',
            zIndex: 1000,
            transform: 'translate(-50%, -50%)',
            transition: 'left 0.1s linear, top 0.1s linear'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: cursor.user?.color || '#ff4444',
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 0 4px rgba(0,0,0,0.5)'
            }} />
            <div style={{
              position: 'absolute',
              top: '15px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '12px',
              background: cursor.user?.color || '#ff4444',
              color: 'white',
              padding: '3px 8px',
              borderRadius: '10px',
              whiteSpace: 'nowrap',
              fontWeight: 'bold',
              border: '1px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>{cursor.user?.name || 'Unknown'}</div>
          </div>
        ))}

        {/* Notes */}
        {notes.map(note => (
          <Note
            key={note.id}
            id={note.id}
            x={note.x}
            y={note.y}
            onRemove={removeNote}
            selectedNoteId={selectedNoteId}
            setSelectedNoteId={setSelectedNoteId}
          />
        ))}

        {/* Background toggle */}
        <button className="background-toggle" onClick={toggleBackground} title={`Tło: ${backgroundModes.find(mode => mode.id === backgroundMode)?.name}`}>
          {getCurrentBackgroundIcon()}
        </button>
      </div>
    </div>
  );
};

export default Canvas;

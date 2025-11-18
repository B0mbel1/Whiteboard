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
  const [drawings, setDrawings] = useState([]); // wszystkie narysowane elementy

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentDrawingRef = useRef(null);

  const safeSetTool = typeof setTool === 'function' ? setTool : () => { };

  const backgroundModes = [
    { id: 'white', name: 'Białe tło', icon: '🌕' },
    { id: 'grid', name: 'Kratka', icon: '🏁' },
    { id: 'lines', name: 'Siatka linii', icon: '📐' },
    { id: 'black', name: 'Czarne tło', icon: '🌑' },
  ];

  const getToolSize = (toolParam = tool) => {
    const baseSize = size?.[toolParam] ?? 3;
    if (toolParam === 'pencil') return Math.max(1, baseSize + 2);
    if (toolParam === 'brush') return baseSize + 5;
    if (toolParam === 'eraser') return baseSize + 30;
    return baseSize;
  };

  // 🔹 Inicjalizacja canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    contextRef.current = ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = getToolSize();

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // 🔹 Aktualizacja toola i koloru
  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = getToolSize();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  }, [color, size, tool]);

  // 🔹 Resize canvas i odtworzenie rysunków
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = contextRef.current;
    if (!canvas || !container || !ctx) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    redrawAll(ctx, canvas.width, canvas.height);
  };

  const drawBackground = (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);

    // tło podstawowe
    if (backgroundMode === 'white' || backgroundMode === 'lines') {
      ctx.fillStyle = 'white';
    } else if (backgroundMode === 'black') {
      ctx.fillStyle = 'black';
    } else {
      ctx.fillStyle = 'transparent';
    }
    ctx.fillRect(0, 0, width, height);

    // grid i linie
    const step = 25;
    if (backgroundMode === 'grid') {
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (backgroundMode === 'lines') {
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
  };

  const redrawAll = (ctx, width, height) => {
    drawBackground(ctx, width, height);
    drawings.forEach(drawRemote);
  };

  // 🔹 Notes handling
  const removeNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedNoteId) return;
      if (e.key === 'Backspace' || e.key === 'Delete') removeNote(selectedNoteId);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId]);

  const toggleBackground = () => {
    const currentIndex = backgroundModes.findIndex(m => m.id === backgroundMode);
    const nextIndex = (currentIndex + 1) % backgroundModes.length;
    setBackgroundMode(backgroundModes[nextIndex].id);
    setTimeout(resizeCanvas, 50); // odśwież canvas
  };

  const getCurrentBackgroundIcon = () =>
    backgroundModes.find(m => m.id === backgroundMode)?.icon;

  const getCanvasCoordinates = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // 🔹 Local drawing
  const startDrawing = ({ nativeEvent }) => {
    if (setShowColorPicker) setShowColorPicker(false);
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);

    const ctx = contextRef.current;
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    currentDrawingRef.current = { tool, color, size: getToolSize(), points: [{ x, y }] };
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    const ctx = contextRef.current;
    ctx.closePath();
    isDrawingRef.current = false;

    if (currentDrawingRef.current) {
      // zapis lokalny
      setDrawings(prev => [...prev, currentDrawingRef.current]);
      // wysłanie na socket
      if (socket && whiteboardId) socket.emit('drawing', { whiteboardId, ...currentDrawingRef.current });
      if (onDrawing) onDrawing(currentDrawingRef.current);
    }
    currentDrawingRef.current = null;
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawingRef.current || !contextRef.current) return;
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);

    currentDrawingRef.current?.points.push({ x, y });
    const ctx = contextRef.current;

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

  const handleMouseDown = (e) => {
    if (['cursor', 'pointer', 'select'].includes(tool)) return;
    if (tool === 'notes') {
      const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
      setNotes(prev => [...prev, { id: Date.now(), x, y, text: '' }]);
      safeSetTool('cursor');
      e.stopPropagation();
      return;
    }
    startDrawing(e);
  };

  const handleMouseMove = (e) => {
    if (tool !== 'notes') draw(e);
    if (onCursorMove) onCursorMove(getCanvasCoordinates(e.clientX, e.clientY));
  };

  // 🔹 Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDrawing = (data) => {
      drawRemote(data);
      setDrawings(prev => [...prev, data]); // zapis wszystkich rysunków
    };
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
      setDrawings(data.drawingData || []);
      const cursorsMap = new Map();
      data.users.filter(u => u.id !== socket.id)
        .forEach(u => cursorsMap.set(u.id, { userId: u.id, position: u.position, user: u, lastUpdate: Date.now() }));
      setRemoteCursors(cursorsMap);
      resizeCanvas();
    };
    const handleUsersUpdated = (data) => {
      setRemoteCursors(prev => {
        const newMap = new Map();
        for (const [userId, cursor] of prev) {
          if (data.users.some(u => u.id === userId)) newMap.set(userId, cursor);
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

  // 🔹 Cleanup stale cursors
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
    <div className="canvas-container" ref={containerRef} style={{ flex: 1 }}>
      <div className={`canvas-area background-${backgroundMode}`}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseUp={stopDrawing}
          onMouseMove={handleMouseMove}
          onMouseLeave={stopDrawing}
          style={{ cursor: tool === 'eraser' ? 'crosshair' : 'default', width: '100%', height: '100%', display: 'block' }}
        />

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

        <button className="background-toggle" onClick={toggleBackground} title={`Tło: ${backgroundModes.find(m => m.id === backgroundMode)?.name}`}>
          {getCurrentBackgroundIcon()}
        </button>
      </div>
    </div>
  );
};

export default Canvas;

import React, { useState, useRef, useEffect } from 'react';
import './Canvas.css';
import Note from './Note';

const Canvas = ({ 
  tool, 
  color, 
  size, 
  setShowColorPicker, 
  whiteboardId, 
  socket, 
  setTool,
  currentUser,
  onDrawing,
  onCursorMove 
}) => {
  const [backgroundMode, setBackgroundMode] = useState('grid');
  const [remoteCursors, setRemoteCursors] = useState(new Map());
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentDrawingRef = useRef(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.strokeStyle = color;
    context.lineWidth = size;
    contextRef.current = context;

    // Clear canvas
    clearCanvas();

    if (socket) {
      console.log("📡 Setting up canvas listeners");

      // Handle drawing from other users
      const handleRemoteDrawing = (data) => {
        drawRemote(data);
      };

      // Handle cursor movement from OTHER users only
      const handleRemoteCursorMove = (data) => {
        if (data.userId !== socket.id) {
          setRemoteCursors(prev => {
            const newMap = new Map(prev);
            newMap.set(data.userId, {
              userId: data.userId,
              position: data.position,
              user: data.user,
              lastUpdate: Date.now()
            });
            return newMap;
          });
        }
      };

      // Handle initial whiteboard state - REDRAW EVERYTHING
      const handleWhiteboardState = (data) => {
        console.log("🎨 Redrawing", data.drawingData.length, "existing drawings");
        
        // Clear canvas first
        clearCanvas();
        
        // Redraw ALL existing drawings with a small delay to ensure canvas is ready
        setTimeout(() => {
          data.drawingData.forEach(drawing => {
            drawRemote(drawing);
          });
        }, 100);
        
        // Initialize cursors for OTHER users only
        const otherUsers = data.users.filter(user => user.id !== socket.id);
        const cursorsMap = new Map();
        otherUsers.forEach(user => {
          cursorsMap.set(user.id, {
            userId: user.id,
            position: user.position,
            user: user,
            lastUpdate: Date.now()
          });
        });
        setRemoteCursors(cursorsMap);
      };

      // Handle users updated - remove cursors for users who left
      const handleUsersUpdated = (data) => {
        setRemoteCursors(prev => {
          const newMap = new Map();
          for (const [userId, cursor] of prev) {
            if (data.users.some(user => user.id === userId)) {
              newMap.set(userId, cursor);
            }
          }
          return newMap;
        });
      };

      // Set up listeners
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
    }
  }, [socket]);

  const clearCanvas = () => {
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    
    if (backgroundMode === 'white') {
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
    } else if (backgroundMode === 'black') {
      context.fillStyle = 'black';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const drawRemote = (data) => {
    const context = contextRef.current;
    if (!context || !data.points || data.points.length === 0) return;

    context.save();
    
    if (data.tool === 'pencil' || data.tool === 'brush') {
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = data.color;
      context.lineWidth = data.size;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      
      if (data.tool === 'brush') {
        context.shadowBlur = 5;
        context.shadowColor = data.color;
      } else {
        context.shadowBlur = 0;
      }
    } else if (data.tool === 'eraser') {
      context.globalCompositeOperation = 'destination-out';
      context.strokeStyle = 'rgba(0,0,0,1)';
      context.lineWidth = data.size;
      context.shadowBlur = 0;
    }

    context.beginPath();
    context.moveTo(data.points[0].x, data.points[0].y);
    
    for (let i = 1; i < data.points.length; i++) {
      context.lineTo(data.points[i].x, data.points[i].y);
    }
    
    context.stroke();
    context.restore();
  };

  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // 🔹 Nowe: zaznaczona notatka
  const [selectedNoteId, setSelectedNoteId] = useState(null);

  // Funkcja do bezpiecznego zmiany rozmiaru canvas bez utraty zawartości
  const updateCanvasSize = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = contextRef.current;
    if (!canvas || !container || !ctx) return;

    const rect = container.getBoundingClientRect();
    if (canvas.width === rect.width && canvas.height === rect.height) return;

    // Zapisujemy aktualną zawartość
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    canvas.width = rect.width;
    canvas.height = rect.height;

    // Przywracamy zawartość
    ctx.putImageData(imageData, 0, 0);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    const toolSize = getToolSize();
    ctx.lineWidth = toolSize;
  };

const getToolSize = () => {
  const base = (typeof size === "object" && size?.[tool]) 
    ? size[tool] 
    : (typeof size === "number" ? size : 3);

  if (tool === 'pencil') return Math.max(1, base - 2);
  if (tool === 'brush') return base + 10;
  if (tool === 'eraser') return base + 30;

  return base;
};


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

  // Aktualizacja koloru i grubości
  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = getToolSize();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  }, [color, size, tool]);

  const startDrawing = ({ nativeEvent }) => {
      // ❗ Nie rysujemy, gdy tool NIE jest rysujący
  if (!['pencil', 'brush', 'eraser'].includes(tool)) return;
    if (setShowColorPicker) {
      setShowColorPicker(false);
    }
    
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);
    
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
    
    currentDrawingRef.current = {
      tool,
      color,
      size,
      points: [{ x, y }]
    };
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

      // ❗ zablokuj NIE-rysujące tool’e
  if (!['pencil', 'brush', 'eraser'].includes(tool)) {
    setIsDrawing(false);
    return;
  }
    
    contextRef.current.closePath();
    setIsDrawing(false);
    
    if (currentDrawingRef.current && onDrawing) {
      onDrawing(currentDrawingRef.current);
    }
    
    currentDrawingRef.current = null;
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing || !contextRef.current) return;

  // ❗ zablokuj jeśli tool nie rysuje
  if (!['pencil', 'brush', 'eraser'].includes(tool)) return;
    
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);
    
    if (currentDrawingRef.current) {
      currentDrawingRef.current.points.push({ x, y });
    }

    // Local drawing
    if (tool === 'pencil') {
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.strokeStyle = color;
      contextRef.current.shadowBlur = 0;
    } else if (tool === 'eraser') {
      contextRef.current.globalCompositeOperation = 'destination-out';
      contextRef.current.strokeStyle = 'rgba(0,0,0,1)';
      contextRef.current.shadowBlur = 0;
    } else if (tool === 'brush') {
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.strokeStyle = color;
      contextRef.current.shadowBlur = 5;
      contextRef.current.shadowColor = color;
    }

    contextRef.current.lineCap = 'round';
    contextRef.current.lineJoin = 'round';
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const handleCanvasClick = (e) => {
    if (tool !== 'notes') return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNotes(prev => [...prev, { id: Date.now(), x, y }]);
    if (setTool) setTimeout(() => setTool('cursor'), 0);
  };

  // 🔹 Nowa funkcja removeNote z obsługą zaznaczenia
  const removeNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
  };

  // 🔹 Obsługa Backspace/Delete dla zaznaczonej notatki
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


  const handleMouseMove = (e) => {
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    
    // Send cursor position continuously
    if (onCursorMove) {
      onCursorMove({ x, y });
    }

    if (isDrawing) {
      draw(e);
    }
  };

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
    
    // Clear and redraw canvas with new background
    setTimeout(() => {
      clearCanvas();
    }, 100);
  };

  const getCurrentBackgroundIcon = () =>
    backgroundModes.find(mode => mode.id === backgroundMode)?.icon;

  const handleMouseLeave = () => {
    if (tool === 'pointer') {
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'default';
    }
  };

  const handleMouseEnter = () => {
    if (tool === 'pointer') {
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'pointer';
    }
  };

  // Clean up old cursors periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors(prev => {
        const newMap = new Map();
        for (const [userId, cursor] of prev) {
          // Remove cursors that haven't been updated in 5 seconds
          if (now - cursor.lastUpdate < 5000) {
            newMap.set(userId, cursor);
          }
        }
        return newMap;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Convert Map to array for rendering
  const remoteCursorsArray = Array.from(remoteCursors.values());

  return (
    <div className="canvas-container" ref={containerRef}>
      <div className={`canvas-area background-${backgroundMode}`}
      onClick={handleCanvasClick}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={handleMouseMove}
          onMouseLeave={stopDrawing}
          style={{
            cursor: tool === 'eraser' ? 'crosshair' : 'default',
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
        {notes.map(note => (
          <Note
            key={note.id}
            id={note.id}
            x={note.x}
            y={note.y}
            onRemove={removeNote}
            selectedNoteId={selectedNoteId} // 🔹 przekaż zaznaczenie
            setSelectedNoteId={setSelectedNoteId} // 🔹 funkcja do zaznaczania
          />))}

        {remoteCursorsArray.map((cursor) => (
          cursor.position && (
            <div
              key={cursor.userId}
              className="remote-cursor"
              style={{
                position: 'absolute',
                left: cursor.position.x,
                top: cursor.position.y,
                pointerEvents: 'none',
                zIndex: 1000,
                transform: 'translate(-50%, -50%)',
                transition: 'left 0.1s linear, top 0.1s linear'
              }}
            >
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
              }}>
                {cursor.user?.name || 'Unknown'}
              </div>
            </div>
          )
          
        ))}
        
        <button 
          className="background-toggle"
          onClick={toggleBackground}
          title={`Tło: ${backgroundModes.find(mode => mode.id === backgroundMode)?.name}`}
        >
          {getCurrentBackgroundIcon()}
        </button>
      </div>
    </div>
  );
};

export default Canvas;

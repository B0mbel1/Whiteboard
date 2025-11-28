import React, { useState, useRef, useEffect } from 'react';
import './Canvas.css';
import { getStandardizedSize, getDisplaySize, getToolEffects } from '../../utils/toolSizes';
import { drawCompletePath, drawPathSegment } from '../../utils/drawingUtils';
import Note from './Note';
import Text from './Text';

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
  onCursorMove,
  textBoxes: initialTextBoxes,
  notes: initialNotes,
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete
}) => {
const [backgroundMode, setBackgroundMode] = useState('grid');
  const [remoteCursors, setRemoteCursors] = useState(new Map());
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentDrawingRef = useRef(null);
  const [notes, setNotes] = useState(initialNotes || []);
  const [textBoxes, setTextBoxes] = useState(initialTextBoxes || []);
  
  // 🔹 POPRAWIONE: Jedna deklaracja dla zaznaczonego tekstu i notatki
  const [selectedTextBoxId, setSelectedTextBoxId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);

  useEffect(() => {
    setTextBoxes(initialTextBoxes || []);
  }, [initialTextBoxes]);

    useEffect(() => {
    setNotes(initialNotes || []);
  }, [initialNotes]);

    const backgroundModes = [
    { id: 'white', name: 'Białe tło', icon: '🌕' },
    { id: 'grid', name: 'Kratka', icon: '🏁' },
    { id: 'lines', name: 'Siatka linii', icon: '📐' },
    { id: 'black', name: 'Czarne tło', icon: '🌑' },
  ];
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
  
  // Użyj aktualnego backgroundMode
  if (backgroundMode === 'white') {
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else if (backgroundMode === 'black') {
    context.fillStyle = 'black';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  // Dla 'grid' i 'lines' - CSS zajmie się tłem
};

    const drawRemote = (data) => {
    const context = contextRef.current;
    if (!context || !data.points || data.points.length < 2) return;

    // UŻYJ drawCompletePath dla spójności
    drawCompletePath(context, data.tool, data.color, data.size, data.points);
  };

  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

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
  
  return getDisplaySize(tool, base);
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


  //Z takim kodem dobrze synchronizuje
  const startDrawing = ({ nativeEvent }) => {
      // ❗ Nie rysujemy, gdy tool NIE jest rysujący
  if (!['pencil', 'brush', 'eraser'].includes(tool)) return;
    if (setShowColorPicker) {
      setShowColorPicker(false);
    }
    
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);
    
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);

    // // ❗ Nie rysujemy, gdy tool NIE jest rysujący
    // if (!['pencil', 'brush', 'eraser'].includes(tool)) return;

    // if (setShowColorPicker) setShowColorPicker(false);
    // const { offsetX, offsetY } = nativeEvent;
    // const ctx = contextRef.current;
    // ctx.beginPath();
    // ctx.arc(offsetX, offsetY, ctx.lineWidth / 2, 0, Math.PI * 2);
    // ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    // ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    // ctx.fill();

    // // rozpocznij rysowanie jak zwykle
    // ctx.beginPath();
    // ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    
    //To usuwamy w drugiej wersji
    currentDrawingRef.current = {
      tool,
      color,
      size,
      points: [{ x, y }]
    };
    // draw({ nativeEvent });
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
    if (!['pencil', 'brush', 'eraser'].includes(tool)) return;
    
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);
    
    if (currentDrawingRef.current) {
      const points = currentDrawingRef.current.points;
      const previousPoint = points[points.length - 1];
      points.push({ x, y });

      // Rysuj tylko NOWY segment używając drawPathSegment
      drawPathSegment(contextRef.current, tool, color, size, previousPoint, { x, y });
    }
  };

  const handleCanvasClick = (e) => {
    setSelectedNoteId(null);
    setSelectedTextBoxId(null);
    if (tool === 'notes') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newNote = { 
        id: Date.now() + Math.random(), 
        x, 
        y, 
        text: '',
        width: 180,
        height: 120
      };
      
      setNotes(prev => [...prev, newNote]);
      if (onNoteCreate) {
        onNoteCreate(newNote);
      }
      if (setTool) setTool('cursor');
    } else if (tool === 'text') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newTextBox = { id: Date.now(), x, y, text: '' };
      setTextBoxes(prev => [...prev, newTextBox]);
      if (socket) {
        socket.emit('text-create', { whiteboardId, textBox: newTextBox });
      }
      if (setTool) setTool('cursor');
    }
  };

  // 🔹 Nowa funkcja removeNote z obsługą zaznaczenia
  const removeNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
  };

  const handleTextUpdate = (id, newProps) => {
    setTextBoxes(prev =>
      prev.map(textBox =>
        textBox.id === id ? { ...textBox, ...newProps } : textBox
      )
    );
    if (socket) {
      socket.emit('text-update', { whiteboardId, id, ...newProps });
    }
  };

  const removeTextBox = (id) => {
    setTextBoxes(prev => prev.filter(tb => tb.id !== id));
    if (selectedTextBoxId === id) setSelectedTextBoxId(null);
    if (socket) {
      socket.emit('text-delete', { whiteboardId, id });
    }
  };

  // 🔹 Obsługa Backspace/Delete dla zaznaczonej notatki
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName.toLowerCase() === 'input' ||
          activeElement.tagName.toLowerCase() === 'textarea')
      ) {
        return;
      }

      if (selectedNoteId && (e.key === 'Backspace' || e.key === 'Delete')) {
        removeNote(selectedNoteId);
      }
      if (selectedTextBoxId && (e.key === 'Backspace' || e.key === 'Delete')) {
        removeTextBox(selectedTextBoxId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId, selectedTextBoxId]);

   // DODANE: funkcje do obsługi notatek
  const handleNoteUpdate = (id, updates) => {
    setNotes(prev => prev.map(note => 
      note.id === id ? { ...note, ...updates } : note
    ));
    
    if (onNoteUpdate) {
      onNoteUpdate(id, updates);
    }
  };

  const handleNoteDelete = (id) => {
    setNotes(prev => prev.filter(note => note.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
    
    if (onNoteDelete) {
      onNoteDelete(id);
    }
  };

    // DODANE: obsługa socket dla notatek
  useEffect(() => {
    if (socket) {
      const handleNoteCreate = (data) => {
        setNotes(prev => [...prev, data.note]);
      };
      
      const handleNoteUpdate = (data) => {
        setNotes(prev => prev.map(note => 
          note.id === data.id ? { ...note, ...data } : note
        ));
      };
      
      const handleNoteDelete = (data) => {
        setNotes(prev => prev.filter(note => note.id !== data.id));
      };

      socket.on('note-create', handleNoteCreate);
      socket.on('note-update', handleNoteUpdate);
      socket.on('note-delete', handleNoteDelete);
      
      return () => {
        socket.off('note-create', handleNoteCreate);
        socket.off('note-update', handleNoteUpdate);
        socket.off('note-delete', handleNoteDelete);
      };
    }
  }, [socket]);

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

  const toggleBackground = () => {
  const currentIndex = backgroundModes.findIndex(mode => mode.id === backgroundMode);
  const nextIndex = (currentIndex + 1) % backgroundModes.length;
  const newBackgroundMode = backgroundModes[nextIndex].id;
  
  setBackgroundMode(newBackgroundMode);
  
  // Natychmiastowe wyczyszczenie i ustawienie nowego tła
  clearCanvas();
};

// Zmień useEffect, aby reagował na zmianę backgroundMode
useEffect(() => {
  clearCanvas();
}, [backgroundMode]);

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

  useEffect(() => {
    if (socket) {
      const handleTextCreate = (data) => {
        setTextBoxes(prev => [...prev, data.textBox]);
      };
      const handleTextUpdate = (data) => {
        setTextBoxes(prev =>
          prev.map(textBox =>
            textBox.id === data.id ? { ...textBox, ...data } : textBox
          )
        );
      };
      const handleTextDelete = (data) => {
        setTextBoxes(prev => prev.filter(tb => tb.id !== data.id));
      };
      socket.on('text-create', handleTextCreate);
      socket.on('text-update', handleTextUpdate);
      socket.on('text-delete', handleTextDelete);
      return () => {
        socket.off('text-create', handleTextCreate);
        socket.off('text-update', handleTextUpdate);
        socket.off('text-delete', handleTextDelete);
      };
    }
  }, [socket]);

  // Convert Map to array for rendering
  const remoteCursorsArray = Array.from(remoteCursors.values());

  console.log("🎨 Canvas rendering:", {
  notesCount: notes.length,
  notes: notes.map(n => ({ id: n.id, x: n.x, y: n.y })),
  selectedNoteId: selectedNoteId
});

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
          // style={{
          //   cursor: tool === 'eraser' ? 'crosshair' : 'default',
          //   width: '100%',
          //   height: '100%',
          //   display: 'block'
          // }}
          style={{}}
        />
         {notes.map(note => (
          <Note
            key={note.id}
            id={note.id}
            x={note.x}
            y={note.y}
            width={note.width}
            height={note.height}
            initialText={note.text}
            onUpdate={handleNoteUpdate}
            onRemove={handleNoteDelete}
            selectedNoteId={selectedNoteId}
            setSelectedNoteId={setSelectedNoteId}
            socket={socket}
          />
        ))}
        {textBoxes.map(textBox => (
          <Text
            key={textBox.id}
            id={textBox.id}
            x={textBox.x}
            y={textBox.y}
            width={textBox.width}
            height={textBox.height}
            text={textBox.text}
            onUpdate={handleTextUpdate}
            onRemove={removeTextBox}
            selected={selectedTextBoxId === textBox.id}
            setSelected={setSelectedTextBoxId}
            socket={socket}
          />
        ))}

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

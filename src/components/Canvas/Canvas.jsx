import React, { useState, useRef, useEffect } from 'react';
import './Canvas.css';
import { getStandardizedSize, getDisplaySize, getToolEffects } from '../../utils/toolSizes';
import { drawCompletePath, drawPathSegment } from '../../utils/drawingUtils';
import Note from './Note';
import Text from './Text';
import Emoji from './Emoji';
import Gif from './Gif'; // lub ścieżka gdzie go utworzyłeś
import Shape from './Shape';

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
  onNoteDelete,
  emojis: initialEmojis,
  activeEmoji, // To jest emoji wybrane z Toolbara (np. "🔥")
  onEmojiCreate,
  onEmojiUpdate,
  onEmojiDelete,
  gifs: initialGifs,      // ✅
  activeGif,              // ✅ URL z toolbara
  onGifCreate,            // ✅
  onGifDelete,
  onGifUpdate,
  shapes: initialShapes,
  activeShape,
  onShapeCreate,
  onShapeDelete,
  onShapeUpdate,
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

  // 🔹 DODANE: Uproszczona historia undo/redo
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const historyRef = useRef({ history: [], step: -1 });

  const [selectedTextBoxId, setSelectedTextBoxId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);

  //Emojis
  const [emojis, setEmojis] = useState(initialEmojis || []);
  const [selectedEmojiId, setSelectedEmojiId] = useState(null);

  //Gif
  const [gifs, setGifs] = useState(initialGifs || []);
  const [selectedGifId, setSelectedGifId] = useState(null);

  //Shapes
  const [shapes, setShapes] = useState(initialShapes || []);
  const [selectedShapeId, setSelectedShapeId] = useState(null);

  // 🔹 DODANE: Typy akcji dla historii
  const ACTION_TYPES = {
    DRAWING: 'drawing',
    NOTE_CREATE: 'note_create',
    NOTE_DELETE: 'note_delete',
    TEXT_CREATE: 'text_create',
    TEXT_DELETE: 'text_delete',

    EMOJI_CREATE: 'emoji_create',
    EMOJI_DELETE: 'emoji_delete',

    GIF_CREATE: 'gif_create', // ✅
    GIF_DELETE: 'gif_delete',  // ✅

    SHAPE_CREATE: 'shape_create',
    SHAPE_DELETE: 'shape_delete',
  };
  useEffect(() => { setShapes(initialShapes || []); }, [initialShapes]);

  // 🔹 DODANE: Uproszczone funkcje do zarządzania historią
  const saveToHistory = (actionType, data) => {
    const newHistory = historyRef.current.history.slice(0, historyRef.current.step + 1);

    const historyItem = {
      type: actionType,
      data: data,
      timestamp: Date.now()
    };

    newHistory.push(historyItem);

    // Ogranicz historię do 50 kroków
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    historyRef.current = {
      history: newHistory,
      step: newHistory.length - 1
    };

    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyRef.current.step < 0) return;

    const currentStep = historyRef.current.step;
    const action = historyRef.current.history[currentStep];

    // Cofnij akcję w zależności od typu
    switch (action.type) {
      case ACTION_TYPES.DRAWING:
        // Dla rysowania po prostu cofamy się o krok
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        clearCanvas();
        redrawCanvas();
        break;

      case ACTION_TYPES.NOTE_CREATE:
        // Cofnięcie tworzenia = usunięcie notatki
        setNotes(prev => prev.filter(note => note.id !== action.data.note.id));
        if (onNoteDelete && action.data.note.id) {
          onNoteDelete(action.data.note.id);
        }
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;

      case ACTION_TYPES.NOTE_DELETE:
        // Cofnięcie usunięcia = przywrócenie notatki
        setNotes(prev => [...prev, action.data.note]);
        if (onNoteCreate && action.data.note) {
          onNoteCreate(action.data.note);
        }
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;

      case ACTION_TYPES.TEXT_CREATE:
        // Cofnięcie tworzenia = usunięcie textboxa
        setTextBoxes(prev => prev.filter(textBox => textBox.id !== action.data.textBox.id));
        if (socket && action.data.textBox.id) {
          socket.emit('text-delete', { whiteboardId, id: action.data.textBox.id });
        }
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;

      case ACTION_TYPES.TEXT_DELETE:
        // Cofnięcie usunięcia = przywrócenie textboxa
        setTextBoxes(prev => [...prev, action.data.textBox]);
        if (socket && action.data.textBox) {
          socket.emit('text-create', { whiteboardId, textBox: action.data.textBox });
        }
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;

      case ACTION_TYPES.EMOJI_CREATE:
        setEmojis(prev => prev.filter(e => e.id !== action.data.emoji.id));
        if (onEmojiDelete && action.data.emoji.id) {
          onEmojiDelete(action.data.emoji.id);
        }
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;

      case ACTION_TYPES.EMOJI_DELETE:
        setEmojis(prev => [...prev, action.data.emoji]);
        if (onEmojiCreate && action.data.emoji) {
          onEmojiCreate(action.data.emoji);
        }
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;

      case ACTION_TYPES.GIF_CREATE:
        setGifs(prev => prev.filter(g => g.id !== action.data.gif.id));
        if (onGifDelete && action.data.gif.id) onGifDelete(action.data.gif.id);
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;

      case ACTION_TYPES.GIF_DELETE:
        setGifs(prev => [...prev, action.data.gif]);
        if (onGifCreate && action.data.gif) onGifCreate(action.data.gif);
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;

      case ACTION_TYPES.SHAPE_CREATE:
        setShapes(prev => prev.filter(s => s.id !== action.data.shape.id));
        if (onShapeDelete) onShapeDelete(action.data.shape.id);
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;

      case ACTION_TYPES.SHAPE_DELETE:
        setShapes(prev => [...prev, action.data.shape]);
        if (onShapeCreate) onShapeCreate(action.data.shape);
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;

      default:
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
      //Dodał do gemini?
      // if (action.type === ACTION_TYPES.DRAWING) { clearCanvas(); redrawCanvas(); }
    }
  };

  const redo = () => {
    if (historyRef.current.step >= historyRef.current.history.length - 1) return;

    const nextStep = historyRef.current.step + 1;
    const action = historyRef.current.history[nextStep];

    // Ponów akcję w zależności od typu
    switch (action.type) {
      case ACTION_TYPES.DRAWING:
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        clearCanvas();
        redrawCanvas();
        break;

      case ACTION_TYPES.NOTE_CREATE:
        setNotes(prev => [...prev, action.data.note]);
        if (onNoteCreate) {
          onNoteCreate(action.data.note);
        }
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;

      case ACTION_TYPES.NOTE_DELETE:
        setNotes(prev => prev.filter(note => note.id !== action.data.note.id));
        if (onNoteDelete && action.data.note.id) {
          onNoteDelete(action.data.note.id);
        }
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;

      case ACTION_TYPES.TEXT_CREATE:
        setTextBoxes(prev => [...prev, action.data.textBox]);
        if (socket && action.data.textBox) {
          socket.emit('text-create', { whiteboardId, textBox: action.data.textBox });
        }
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;

      case ACTION_TYPES.TEXT_DELETE:
        setTextBoxes(prev => prev.filter(textBox => textBox.id !== action.data.textBox.id));
        if (socket && action.data.textBox.id) {
          socket.emit('text-delete', { whiteboardId, id: action.data.textBox.id });
        }
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;

      case ACTION_TYPES.EMOJI_CREATE:
        setEmojis(prev => [...prev, action.data.emoji]);
        if (onEmojiCreate) onEmojiCreate(action.data.emoji);
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;

      case ACTION_TYPES.EMOJI_DELETE:
        setEmojis(prev => prev.filter(e => e.id !== action.data.emoji.id));
        if (onEmojiDelete) onEmojiDelete(action.data.emoji.id);
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;

      case ACTION_TYPES.GIF_CREATE:
        setGifs(prev => [...prev, action.data.gif]);
        if (onGifCreate) onGifCreate(action.data.gif);
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;

      case ACTION_TYPES.GIF_DELETE:
        setGifs(prev => prev.filter(g => g.id !== action.data.gif.id));
        if (onGifDelete) onGifDelete(action.data.gif.id);
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;

      case ACTION_TYPES.SHAPE_CREATE:
        setShapes(prev => [...prev, action.data.shape]);
        if (onShapeCreate) onShapeCreate(action.data.shape);
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;

      case ACTION_TYPES.SHAPE_DELETE:
        setShapes(prev => prev.filter(s => s.id !== action.data.shape.id));
        if (onShapeDelete) onShapeDelete(action.data.shape.id);
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;

      default:
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
      //Dodał to gemini?
      // if(action.type === ACTION_TYPES.DRAWING) { clearCanvas(); redrawCanvas(); }
    }
  };

  const redrawCanvas = () => {
    const context = contextRef.current;
    if (!context) return;

    // Narysuj wszystkie kroki do aktualnego punktu w historii
    for (let i = 0; i <= historyRef.current.step; i++) {
      const action = historyRef.current.history[i];
      if (action.type === ACTION_TYPES.DRAWING && action.data && action.data.points && action.data.points.length > 1) {
        drawCompletePath(context, action.data.tool, action.data.color, action.data.size, action.data.points);
      }
    }
  };

  const removeShape = (id) => {
    const shapeToDelete = shapes.find(s => s.id === id);
    if (shapeToDelete) {
      // 1. Zapisz do historii
      saveToHistory(ACTION_TYPES.SHAPE_DELETE, { shapeId: id, shape: shapeToDelete });

      // 2. Usuń lokalnie
      setShapes(prev => prev.filter(s => s.id !== id));

      // 3. Resetuj zaznaczenie
      if (selectedShapeId === id) setSelectedShapeId(null);

      // 4. Wyślij przez socket
      if (onShapeDelete) onShapeDelete(id);
    }
  };

  const removeGif = (id) => {
    const gifToDelete = gifs.find(g => g.id === id);
    if (gifToDelete) {
      saveToHistory(ACTION_TYPES.GIF_DELETE, { gifId: id, gif: gifToDelete });
      setGifs(prev => prev.filter(g => g.id !== id));
      if (selectedGifId === id) setSelectedGifId(null);
      if (onGifDelete) onGifDelete(id);
    }
  };


  const removeEmoji = (id) => {
    const emojiToDelete = emojis.find(e => e.id === id);
    if (emojiToDelete) {
      saveToHistory(ACTION_TYPES.EMOJI_DELETE, { emojiId: id, emoji: emojiToDelete });

      setEmojis(prev => prev.filter(e => e.id !== id));
      if (selectedEmojiId === id) setSelectedEmojiId(null);

      if (onEmojiDelete) onEmojiDelete(id);
    }
  };

  useEffect(() => {
    setGifs(initialGifs || []);
  }, [initialGifs]);

  useEffect(() => {
    setEmojis(initialEmojis || []);
  }, [initialEmojis]);


  // 🔹 DODANE: Przekaż funkcje undo/redo do Toolbar
  useEffect(() => {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      toolbar.undo = undo;
      toolbar.redo = redo;
      toolbar.canUndo = () => historyRef.current.step >= 0;
      toolbar.canRedo = () => historyRef.current.step < historyRef.current.history.length - 1;
    }
  }, []);

  // 🔹 DODANE: Aktualizuj przyciski undo/redo gdy zmienia się historia
  useEffect(() => {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      toolbar.updateUndoRedoState?.();
    }
  }, [historyStep, history]);

  // 🔹 DODANE: Skróty klawiaturowe
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl+Y lub Ctrl+Shift+Z - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  //GIF
  const handleGifUpdate = (id, updates) => {
    console.log("🔄 Updating GIF:", id, updates);

    // Aktualizuj lokalnie dla płynności
    setGifs(prev => prev.map(gif =>
      gif.id === id ? { ...gif, ...updates } : gif
    ));

    // Wyślij na serwer
    if (onGifUpdate) {
      onGifUpdate(id, updates);
    }
    // Uwaga: Na razie nie dodajemy przesuwania/skalowania do historii Undo/Redo,
    // bo generuje to setki zdarzeń na sekundę.
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

    // ❗ zablokuj NIE-rysujące tool'e
    if (!['pencil', 'brush', 'eraser'].includes(tool)) {
      setIsDrawing(false);
      return;
    }

    contextRef.current.closePath();
    setIsDrawing(false);

    if (currentDrawingRef.current && onDrawing) {
      onDrawing(currentDrawingRef.current);

      // 🔹 DODANE: Zapisz do historii
      saveToHistory(ACTION_TYPES.DRAWING, currentDrawingRef.current);
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

  const handleShapeUpdate = (id, newProps) => {
    // Aktualizuj lokalny stan natychmiast dla płynności
    setShapes(prev => prev.map(shape =>
      shape.id === id ? { ...shape, ...newProps } : shape
    ));

    // Wyślij do serwera (WhiteboardRouter)
    if (onShapeUpdate) {
      onShapeUpdate(id, newProps);
    }
  };

  const handleCanvasClick = (e) => {
    if (e.target.closest('.shape-item') || e.target.closest('.emoji-item')) {
      return;
    }
    setSelectedNoteId(null);
    setSelectedTextBoxId(null);
    setSelectedEmojiId(null);
    setSelectedGifId(null);
    setSelectedShapeId(null);


    if (tool === 'notes') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x,
        y,
        text: '',
        width: 180,
        height: 120
      };

      setNotes(prev => {
        const exists = prev.some(note => note.id === newNote.id);
        return exists ? prev : [...prev, newNote];
      });

      // 🔹 DODANE: Zapisz do historii przed utworzeniem
      saveToHistory(ACTION_TYPES.NOTE_CREATE, { note: newNote });


      if (onNoteCreate) {
        onNoteCreate(newNote);
      }
      if (setTool) setTool('cursor');
    } else if (tool === 'text') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newTextBox = {
        id: Date.now(),
        x,
        y,
        text: '',
        width: 200,
        height: 100
      };

      // 🔹 DODANE: Zapisz do historii przed utworzeniem
      saveToHistory(ACTION_TYPES.TEXT_CREATE, { textBox: newTextBox });

      setTextBoxes(prev => [...prev, newTextBox]);
      if (socket) {
        socket.emit('text-create', { whiteboardId, textBox: newTextBox });
      }
      if (setTool) setTool('cursor');
    }

    if (tool === 'emoji' && activeEmoji) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newEmoji = {
        id: `emoji_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x,
        y,
        emoji: activeEmoji,
        size: 48 // Możesz to sparametryzować
      };

      // Dodaj lokalnie
      setEmojis(prev => [...prev, newEmoji]);

      // Zapisz historię
      saveToHistory(ACTION_TYPES.EMOJI_CREATE, { emoji: newEmoji });

      // Zapisz historię
      if (typeof saveToHistory === 'function') {
        saveToHistory(ACTION_TYPES.EMOJI_CREATE, { emoji: newEmoji });
      }

      // Wyślij socketem
      if (onEmojiCreate) onEmojiCreate(newEmoji);

      // ✅ DODANO: Zmiana narzędzia na kursor po postawieniu
      if (setTool) setTool('cursor');
    }

    if (tool === 'gif' && activeGif) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newGif = {
        id: `gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: x - 75, // Centrowanie (połowa szerokości 150px)
        y: y - 75,
        url: activeGif,
        width: 150
      };

      // Dodaj lokalnie
      setGifs(prev => [...prev, newGif]);

      // Zapisz historię
      saveToHistory(ACTION_TYPES.GIF_CREATE, { gif: newGif });

      // Wyślij socketem
      if (onGifCreate) onGifCreate(newGif);

      // Zmień na kursor
      if (setTool) setTool('cursor');
    }
    if (tool === 'shape' && activeShape) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 🆕 Domyślne wymiary zależne od typu
      let defaultWidth = 100;
      let defaultHeight = 100;
      let startX = x - 50; // Centrowanie dla pudełek
      let startY = y - 50;

      if (activeShape === 'arrow') {
        // Dla strzałki kliknięcie to początek (ogonek)
        startX = x;
        startY = y;
        // Domyślnie strzałka w prawo o długości 150px
        defaultWidth = 150;
        defaultHeight = 0;
      }

      const newShape = {
        id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: startX,
        y: startY,
        width: defaultWidth,
        height: defaultHeight,
        type: activeShape
      };

      // ... (reszta bez zmian: setShapes, saveToHistory, onShapeCreate, setTool)
      setShapes(prev => [...prev, newShape]);
      saveToHistory(ACTION_TYPES.SHAPE_CREATE, { shape: newShape });
      if (onShapeCreate) onShapeCreate(newShape);
      if (setTool) setTool('cursor');
    }

  };

  // 🔹 DODANE: Uproszczona funkcja removeNote z historią
  const removeNote = (id) => {
    const noteToDelete = notes.find(note => note.id === id);
    if (noteToDelete) {
      // 🔹 DODANE: Zapisz do historii przed usunięciem
      saveToHistory(ACTION_TYPES.NOTE_DELETE, { noteId: id, note: noteToDelete });

      setNotes(prev => prev.filter(n => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);

      if (onNoteDelete) {
        onNoteDelete(id);
      }
    }
  };

  const handleEmojiUpdate = (id, updates) => {
    // Aktualizuj lokalnie
    setEmojis(prev => prev.map(e =>
      e.id === id ? { ...e, ...updates } : e
    ));

    // Wyślij przez socket
    if (onEmojiUpdate) {
    onEmojiUpdate(id, updates);
  }
    // Uwaga: Na razie nie dodajemy tego do historii undo/redo, 
    // bo generowałoby to setki wpisów podczas jednego przeciągnięcia.
  };

  // 🔹 DODANE: Uproszczona funkcja handleNoteUpdate (bez historii)
  // Canvas.jsx - ZASTĄP funkcję handleNoteUpdate TYM:
  const handleNoteUpdate = (id, updates) => {
    console.log("🔄 Local handleNoteUpdate called:", id, updates);

    // NIE aktualizuj lokalnego stanu tutaj!
    // Tylko wyślij do serwera
    if (onNoteUpdate) {
      // Przygotuj dane do wysłania
      const dataToSend = { ...updates };

      // Jeśli updates zawiera position, upewnij się że x i y też są
      if (updates.position) {
        dataToSend.x = updates.position.x;
        dataToSend.y = updates.position.y;
      }

      console.log("📤 Sending note update to server:", id, dataToSend);
      onNoteUpdate(id, dataToSend);
    }

    // WAŻNE: NIE wywołuj setNotes tutaj!
    // Socket.io listener zaktualizuje stan po otrzymaniu odpowiedzi
  };

  const handleNoteDelete = (id) => {
    removeNote(id);
  };

  // 🔹 DODANE: Uproszczona funkcja removeTextBox z historią
  const removeTextBox = (id) => {
    const textBoxToDelete = textBoxes.find(textBox => textBox.id === id);
    if (textBoxToDelete) {
      // 🔹 DODANE: Zapisz do historii przed usunięciem
      saveToHistory(ACTION_TYPES.TEXT_DELETE, { textBoxId: id, textBox: textBoxToDelete });

      setTextBoxes(prev => prev.filter(tb => tb.id !== id));
      if (selectedTextBoxId === id) setSelectedTextBoxId(null);

      if (socket) {
        socket.emit('text-delete', { whiteboardId, id });
      }
    }
  };

  // 🔹 DODANE: Uproszczona funkcja handleTextUpdate (bez historii)
  // Canvas.jsx - ZASTĄP obecną funkcję handleTextUpdate tym:
  const handleTextUpdate = (id, newProps) => {
    console.log("🔄 Updating textbox:", id, newProps);

    setTextBoxes(prev => {
      const exists = prev.some(tb => tb.id === id);
      console.log("📦 Textbox exists before update:", exists);

      const updated = prev.map(textBox =>
        textBox.id === id ? { ...textBox, ...newProps } : textBox
      );

      console.log("📦 Textboxes after update:", updated.length);
      return updated;
    });

    if (socket) {
      socket.emit('text-update', { whiteboardId, id, ...newProps });
    }
  };

  // 🔹 DODANE: Obsługa Backspace/Delete dla zaznaczonej notatki z historią
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
      if (e.key === 'Backspace' || e.key === 'Delete') {
        console.log("Kasowanie - aktualnie zaznaczone:", {
          Note: selectedNoteId,
          Text: selectedTextBoxId,
          Emoji: selectedEmojiId,
          Gif: selectedGifId,
          Shape: selectedShapeId // <-- Logujemy też kształt
        });

        if (selectedEmojiId) {
          console.log("Próbuję usunąć emoji o ID:", selectedEmojiId);
          removeEmoji(selectedEmojiId);
        }
      }
      if (selectedNoteId && (e.key === 'Backspace' || e.key === 'Delete')) {
        removeNote(selectedNoteId);
      }
      if (selectedTextBoxId && (e.key === 'Backspace' || e.key === 'Delete')) {
        removeTextBox(selectedTextBoxId);
      }
      if (selectedEmojiId && (e.key === 'Backspace' || e.key === 'Delete')) {
        removeEmoji(selectedEmojiId);
      }
      if (selectedGifId && (e.key === 'Backspace' || e.key === 'Delete')) {
        removeGif(selectedGifId);
      }
      if (selectedShapeId) {
        removeShape(selectedShapeId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId, selectedTextBoxId, selectedEmojiId, selectedGifId, selectedShapeId]);

  // DODANE: obsługa socket dla notatek
  useEffect(() => {
    if (socket) {
      const handleNoteCreate = (data) => {
        setNotes(prev => [...prev, data.note]);
      };

      const handleNoteUpdate = (data) => {
        console.log("📝 Socket: note-update received:", {
          id: data.id,
          hasPosition: !!data.position,
          hasX: data.x !== undefined,
          hasY: data.y !== undefined
        });

        setNotes(prev => {
          const noteIndex = prev.findIndex(note => note.id === data.id);

          if (noteIndex === -1) {
            console.log("❌ Socket: note not found locally, cannot update");
            return prev;
          }

          // Pobierz istniejącą notatkę
          const existingNote = prev[noteIndex];

          // Przygotuj update - NIE nadpisuj całej notatki, tylko zaktualizuj pola
          const updates = { ...data };

          // Jeśli jest position, rozbij na x, y
          if (data.position) {
            updates.x = data.position.x;
            updates.y = data.position.y;
          }

          // Usuń position z updates (użyjemy tylko x, y)
          delete updates.position;

          // Stwórz zaktualizowaną notatkę - zachowaj wszystkie istniejące pola
          const updatedNote = {
            ...existingNote,
            ...updates
          };

          console.log("📝 Socket: updating note:", {
            oldId: existingNote.id,
            newId: updatedNote.id,
            oldX: existingNote.x,
            newX: updatedNote.x
          });

          // Zamień tylko tę jedną notatkę
          const newNotes = [...prev];
          newNotes[noteIndex] = updatedNote;

          return newNotes;
        });


      };

      const handleNoteDelete = (data) => {
        setNotes(prev => prev.filter(note => note.id !== data.id));
      };

    const handleEmojiUpdate = (data) => {
      setEmojis(prev => prev.map(e => 
        e.id === data.id ? { ...e, ...data } : e
      ));
    };
    
    const handleGifUpdateSocket = (data) => {
      setGifs(prev => prev.map(g => 
        g.id === data.id ? { ...g, ...data } : g
      ));
    };
    
    const handleShapeUpdate = (data) => {
      setShapes(prev => prev.map(s => 
        s.id === data.id ? { ...s, ...data } : s
      ));
    };

    const handleEmojiCreateSocket = (data) => {
        setEmojis(prev => {
          const exists = prev.some(e => e.id === data.emoji.id);
          return exists ? prev : [...prev, data.emoji];
        });
      };
      const handleEmojiDeleteSocket = (data) => {
        setEmojis(prev => prev.filter(e => e.id !== data.id));
      };

      const handleGifCreateSocket = (data) => {
        setGifs(prev => {
          const exists = prev.some(g => g.id === data.gif.id);
          return exists ? prev : [...prev, data.gif];
        });
      };
      const handleGifDeleteSocket = (data) => {
        setGifs(prev => prev.filter(g => g.id !== data.id));
      };

      const handleShapeCreateSocket = (data) => {
      setShapes(prev => {
        const exists = prev.some(s => s.id === data.shape.id);
        return exists ? prev : [...prev, data.shape];
      });
    };
    const handleShapeDeleteSocket = (data) => {
      setShapes(prev => prev.filter(s => s.id !== data.id));
    };

      socket.on('note-create', handleNoteCreate);
      socket.on('note-update', handleNoteUpdate);
      socket.on('note-delete', handleNoteDelete);
      socket.on('emoji-update', handleEmojiUpdate);
      socket.on('gif-update', handleGifUpdateSocket);
      socket.on('shape-update', handleShapeUpdate);
      socket.on('emoji-create', handleEmojiCreateSocket);
      socket.on('emoji-delete', handleEmojiDeleteSocket);
      socket.on('gif-create', handleGifCreateSocket);
      socket.on('gif-delete', handleGifDeleteSocket);
      socket.on('shape-create', handleShapeCreateSocket);
    socket.on('shape-delete', handleShapeDeleteSocket);

      return () => {
        socket.off('note-create', handleNoteCreate);
        socket.off('note-update', handleNoteUpdate);
        socket.off('note-delete', handleNoteDelete);
        socket.off('emoji-update', handleEmojiUpdate);
        socket.off('gif-update', handleGifUpdateSocket);
        socket.off('shape-update', handleShapeUpdate);
        socket.off('emoji-create', handleEmojiCreateSocket);
        socket.off('emoji-delete', handleEmojiDeleteSocket);
        socket.off('gif-create', handleGifCreateSocket);
        socket.off('gif-delete', handleGifDeleteSocket);
        socket.off('shape-create', handleShapeCreateSocket);
      socket.off('shape-delete', handleShapeDeleteSocket);
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

  // 🔹 DODANE: Wyczyść historię przy zmianie whiteboard
  useEffect(() => {
    historyRef.current = { history: [], step: -1 };
    setHistory([]);
    setHistoryStep(-1);
  }, [whiteboardId]);

  // Convert Map to array for rendering
  const remoteCursorsArray = Array.from(remoteCursors.values());

  console.log("🎨 Canvas rendering:", {
    notesCount: notes.length,
    textBoxesCount: textBoxes.length,
    selectedNoteId: selectedNoteId,
    selectedTextBoxId: selectedTextBoxId,
    emojis: emojis.length,         // <-- Dodane
    selEmoji: selectedEmojiId      // <-- Dodane (najważniejsze)
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
        {/* 🆕 RENDEROWANIE EMOJI */}
        {emojis.map(emojiData => (
          <Emoji
            key={emojiData.id}
            {...emojiData}
            selected={selectedEmojiId === emojiData.id}
            onSelect={setSelectedEmojiId}
            onRemove={removeEmoji}
            onUpdate={handleEmojiUpdate} // 🆕 Dodajemy ten prop
          />
        ))}
        {gifs.map(gif => (
          <Gif
            key={gif.id}
            {...gif}
            selected={selectedGifId === gif.id}
            onSelect={setSelectedGifId}
            onUpdate={handleGifUpdate} // ✅ PRZEKAŻ FUNKCJĘ UPDATE          
          />


        ))}
        {shapes.map(shape => (
          <Shape
            key={shape.id}
            {...shape}
            selected={selectedShapeId === shape.id}
            onSelect={setSelectedShapeId}
            onRemove={removeShape}
            onUpdate={handleShapeUpdate} // <--- WAŻNE
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
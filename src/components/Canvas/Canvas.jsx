import React, { useState, useRef, useEffect } from 'react';
import './Canvas.css';
import { getStandardizedSize, getDisplaySize, getToolEffects } from '../../utils/toolSizes';
import { drawCompletePath, drawPathSegment } from '../../utils/drawingUtils';
import Note from './Note';
import Text from './Text';
import Emoji from './Emoji';
import Gif from './Gif';
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
  activeEmoji,
  onEmojiCreate,
  onEmojiUpdate,
  onEmojiDelete,
  gifs: initialGifs,
  activeGif,
  onGifCreate,
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

  // Dwa canvasy: tło i rysunek
  const backgroundCanvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);

  const containerRef = useRef(null);
  const backgroundContextRef = useRef(null);
  const drawingContextRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const currentDrawingRef = useRef(null);
  const [notes, setNotes] = useState(initialNotes || []);
  const [textBoxes, setTextBoxes] = useState(initialTextBoxes || []);

  // Historia undo/redo
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const historyRef = useRef({ history: [], step: -1 });

  const [selectedTextBoxId, setSelectedTextBoxId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);

  // Emojis
  const [emojis, setEmojis] = useState(initialEmojis || []);
  const [selectedEmojiId, setSelectedEmojiId] = useState(null);

  // Gif
  const [gifs, setGifs] = useState(initialGifs || []);
  const [selectedGifId, setSelectedGifId] = useState(null);

  // Shapes
  const [shapes, setShapes] = useState(initialShapes || []);
  const [selectedShapeId, setSelectedShapeId] = useState(null);

  // Zaznaczenie
  const [selectionBox, setSelectionBox] = useState(null);
  const [selectionStart, setSelectionStart] = useState(null);

  const [selectionSnapshot, setSelectionSnapshot] = useState(null); // Stores the cut image URL
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const ACTION_TYPES = {
    DRAWING: 'drawing',
    NOTE_CREATE: 'note_create',
    NOTE_DELETE: 'note_delete',
    TEXT_CREATE: 'text_create',
    TEXT_DELETE: 'text_delete',
    EMOJI_CREATE: 'emoji_create',
    EMOJI_DELETE: 'emoji_delete',
    GIF_CREATE: 'gif_create',
    GIF_DELETE: 'gif_delete',
    SHAPE_CREATE: 'shape_create',
    SHAPE_DELETE: 'shape_delete',
    CLEAR_AREA: 'clear_area'
  };

  useEffect(() => { setShapes(initialShapes || []); }, [initialShapes]);

  // Funkcje historii
  const saveToHistory = (actionType, data) => {
    const newHistory = historyRef.current.history.slice(0, historyRef.current.step + 1);
    const historyItem = { type: actionType, data: data, timestamp: Date.now() };
    newHistory.push(historyItem);
    if (newHistory.length > 50) newHistory.shift();

    historyRef.current = { history: newHistory, step: newHistory.length - 1 };
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyRef.current.step < 0) return;
    const currentStep = historyRef.current.step;
    const action = historyRef.current.history[currentStep];

    switch (action.type) {
      case ACTION_TYPES.DRAWING:
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        clearDrawingCanvas();
        redrawCanvas();
        break;
      case ACTION_TYPES.NOTE_CREATE:
        setNotes(prev => prev.filter(note => note.id !== action.data.note.id));
        if (onNoteDelete && action.data.note.id) onNoteDelete(action.data.note.id);
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;
      case ACTION_TYPES.NOTE_DELETE:
        setNotes(prev => [...prev, action.data.note]);
        if (onNoteCreate && action.data.note) onNoteCreate(action.data.note);
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;
      case ACTION_TYPES.TEXT_CREATE:
        setTextBoxes(prev => prev.filter(textBox => textBox.id !== action.data.textBox.id));
        if (socket && action.data.textBox.id) socket.emit('text-delete', { whiteboardId, id: action.data.textBox.id });
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;
      case ACTION_TYPES.TEXT_DELETE:
        setTextBoxes(prev => [...prev, action.data.textBox]);
        if (socket && action.data.textBox) socket.emit('text-create', { whiteboardId, textBox: action.data.textBox });
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;
      case ACTION_TYPES.EMOJI_CREATE:
        setEmojis(prev => prev.filter(e => e.id !== action.data.emoji.id));
        if (onEmojiDelete && action.data.emoji.id) onEmojiDelete(action.data.emoji.id);
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;
      case ACTION_TYPES.EMOJI_DELETE:
        setEmojis(prev => [...prev, action.data.emoji]);
        if (onEmojiCreate && action.data.emoji) onEmojiCreate(action.data.emoji);
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
    }
  };

  const redo = () => {
    if (historyRef.current.step >= historyRef.current.history.length - 1) return;
    const nextStep = historyRef.current.step + 1;
    const action = historyRef.current.history[nextStep];

    switch (action.type) {
      case ACTION_TYPES.DRAWING:
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        clearDrawingCanvas();
        redrawCanvas();
        break;
      case ACTION_TYPES.NOTE_CREATE:
        setNotes(prev => [...prev, action.data.note]);
        if (onNoteCreate) onNoteCreate(action.data.note);
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;
      case ACTION_TYPES.NOTE_DELETE:
        setNotes(prev => prev.filter(note => note.id !== action.data.note.id));
        if (onNoteDelete && action.data.note.id) onNoteDelete(action.data.note.id);
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;
      case ACTION_TYPES.TEXT_CREATE:
        setTextBoxes(prev => [...prev, action.data.textBox]);
        if (socket && action.data.textBox) socket.emit('text-create', { whiteboardId, textBox: action.data.textBox });
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;
      case ACTION_TYPES.TEXT_DELETE:
        setTextBoxes(prev => prev.filter(textBox => textBox.id !== action.data.textBox.id));
        if (socket && action.data.textBox.id) socket.emit('text-delete', { whiteboardId, id: action.data.textBox.id });
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
    }
  };

  const commitSelection = () => {
    if (!selectionSnapshot || !selectionBox) return;

    const ctx = drawingContextRef.current;
    const img = new Image();
    img.onload = () => {
      // Restore drawing settings
      setupDrawingContext();
      // Draw image at current selection position
      ctx.drawImage(img, selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);

      // Save to history
      // Note: Ideally, you'd save the 'putImageData' or 'drawImage' action here
      saveToHistory(ACTION_TYPES.DRAWING, {
        tool: 'paste', // You might need to handle this in redrawCanvas specifically
        // Simple fallback: just clear snapshot, we accept it's now rasterized
      });
    };
    img.src = selectionSnapshot;

    // Reset selection state
    setSelectionSnapshot(null);
    setSelectionBox(null);
  };

  const redrawCanvas = () => {
    const context = drawingContextRef.current;
    if (!context) return;

    // Najpierw wyczyść drawing canvas
    clearDrawingCanvas();

    // Narysuj historię
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
      saveToHistory(ACTION_TYPES.SHAPE_DELETE, { shapeId: id, shape: shapeToDelete });
      setShapes(prev => prev.filter(s => s.id !== id));
      if (selectedShapeId === id) setSelectedShapeId(null);
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

  useEffect(() => { setGifs(initialGifs || []); }, [initialGifs]);
  useEffect(() => { setEmojis(initialEmojis || []); }, [initialEmojis]);

  useEffect(() => {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      toolbar.undo = undo;
      toolbar.redo = redo;
      toolbar.canUndo = () => historyRef.current.step >= 0;
      toolbar.canRedo = () => historyRef.current.step < historyRef.current.history.length - 1;
    }
  }, []);

  useEffect(() => {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      toolbar.updateUndoRedoState?.();
    }
  }, [historyStep, history]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => { setTextBoxes(initialTextBoxes || []); }, [initialTextBoxes]);
  useEffect(() => { setNotes(initialNotes || []); }, [initialNotes]);

  const backgroundModes = [
    { id: 'white', name: 'Białe tło', icon: '🌕' },
    { id: 'grid', name: 'Kratka', icon: '🏁' },
    { id: 'lines', name: 'Siatka linii', icon: '📐' },
    { id: 'black', name: 'Czarne tło', icon: '🌑' },
  ];

  // Funkcja do rysowania tła
  const drawBackground = () => {
    const canvas = backgroundCanvasRef.current;
    const context = backgroundContextRef.current;
    if (!canvas || !context) return;

    const width = canvas.width;
    const height = canvas.height;

    // Wyczyść tło
    context.clearRect(0, 0, width, height);

    switch (backgroundMode) {
      case 'white':
        context.fillStyle = 'white';
        context.fillRect(0, 0, width, height);
        break;

      case 'grid':
        context.fillStyle = '#f0f0f0';
        context.fillRect(0, 0, width, height);

        // Rysuj kratkę
        context.strokeStyle = '#d0d0d0';
        context.lineWidth = 1;

        const gridSize = 20;
        context.beginPath();

        // Pionowe linie
        for (let x = 0; x <= width; x += gridSize) {
          context.moveTo(x, 0);
          context.lineTo(x, height);
        }

        // Poziome linie
        for (let y = 0; y <= height; y += gridSize) {
          context.moveTo(0, y);
          context.lineTo(width, y);
        }

        context.stroke();
        break;

      case 'lines':
        context.fillStyle = 'white';
        context.fillRect(0, 0, width, height);

        // Rysuj linie jak w zeszycie
        context.strokeStyle = '#e0e0e0';
        context.lineWidth = 1;

        const lineSpacing = 24;
        context.beginPath();

        for (let y = lineSpacing; y < height; y += lineSpacing) {
          context.moveTo(0, y);
          context.lineTo(width, y);
        }

        context.stroke();
        break;

      case 'black':
        context.fillStyle = 'black';
        context.fillRect(0, 0, width, height);
        break;

      default:
        context.fillStyle = 'white';
        context.fillRect(0, 0, width, height);
    }
  };

  // Funkcja do konfiguracji kontekstu rysowania
  const setupDrawingContext = () => {
    const ctx = drawingContextRef.current;
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = getToolSize();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  };

  // Inicjalizacja dwóch canvasów
  useEffect(() => {
    const backgroundCanvas = backgroundCanvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    const container = containerRef.current;

    if (!backgroundCanvas || !drawingCanvas || !container) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Ustaw rozmiar dla obu canvasów
      backgroundCanvas.width = width;
      backgroundCanvas.height = height;
      drawingCanvas.width = width;
      drawingCanvas.height = height;

      // Inicjalizuj konteksty
      backgroundContextRef.current = backgroundCanvas.getContext('2d');
      drawingContextRef.current = drawingCanvas.getContext('2d');

      // Skonfiguruj kontekst rysowania
      setupDrawingContext();

      // Narysuj tło
      drawBackground();

      // Przerysuj historię na canvasie rysowania
      redrawCanvas();
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  // Aktualizuj tło gdy zmieni się tryb
  useEffect(() => {
    drawBackground();
  }, [backgroundMode]);

  // 🔹 DODANE: Aktualizuj kontekst rysowania gdy zmieniają się narzędzia/kolor/rozmiar
  useEffect(() => {
    setupDrawingContext();
  }, [color, size, tool]);

  useEffect(() => {
    if (socket) {
      console.log("📡 Setting up canvas listeners");
      const handleRemoteDrawing = (data) => { drawRemote(data); };
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
      const handleWhiteboardState = (data) => {
        console.log("🎨 Redrawing", data.drawingData.length, "existing drawings");
        clearDrawingCanvas();
        setTimeout(() => {
          data.drawingData.forEach(drawing => { drawRemote(drawing); });
        }, 100);
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

  const clearDrawingCanvas = () => {
    const context = drawingContextRef.current;
    const canvas = drawingCanvasRef.current;
    if (!context || !canvas) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawRemote = (data) => {
    const context = drawingContextRef.current;
    if (!context || !data.points || data.points.length < 2) return;
    drawCompletePath(context, data.tool, data.color, data.size, data.points);
  };

  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = drawingCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleGifUpdate = (id, updates) => {
    setGifs(prev => prev.map(gif => gif.id === id ? { ...gif, ...updates } : gif));
    if (onGifUpdate) onGifUpdate(id, updates);
  };

  // 🔹 POPRAWIONE: updateCanvasSize teraz też aktualizuje kontekst
  const updateCanvasSize = () => {
    const backgroundCanvas = backgroundCanvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    const container = containerRef.current;

    if (!backgroundCanvas || !drawingCanvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Zapisz obraz z drawing canvas przed zmianą rozmiaru
    let imageData = null;
    if (drawingCanvas.width > 0 && drawingCanvas.height > 0) {
      try {
        imageData = drawingContextRef.current?.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
      }
      catch (e) { console.warn("Nie udało się pobrać danych canvas:", e); }
    }

    // Ustaw nowe rozmiary
    backgroundCanvas.width = width;
    backgroundCanvas.height = height;
    drawingCanvas.width = width;
    drawingCanvas.height = height;

    // Ponownie zainicjalizuj konteksty
    backgroundContextRef.current = backgroundCanvas.getContext('2d');
    drawingContextRef.current = drawingCanvas.getContext('2d');

    // Skonfiguruj kontekst rysowania
    setupDrawingContext();

    // Przywróć obraz na drawing canvas
    if (imageData && drawingContextRef.current) {
      drawingContextRef.current.putImageData(imageData, 0, 0);
    }

    // Ponownie narysuj tło
    drawBackground();
  };

  const getToolSize = () => {
    const base = (typeof size === "object" && size?.[tool]) ? size[tool] : (typeof size === "number" ? size : 3);
    return getDisplaySize(tool, base);
  };

  // 🔹 POPRAWIONE: useEffect do inicjalizacji
  useEffect(() => {
    const backgroundCanvas = backgroundCanvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    if (!backgroundCanvas || !drawingCanvas) return;

    // Inicjalizuj konteksty
    backgroundContextRef.current = backgroundCanvas.getContext('2d');
    drawingContextRef.current = drawingCanvas.getContext('2d');

    // Skonfiguruj drawing context
    setupDrawingContext();

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    if (socket) {
      const handleEraseArea = (data) => {
        const ctx = drawingContextRef.current;
        if (ctx) {
          // Wyczyść piksele na canvasie rysowania
          ctx.clearRect(data.x, data.y, data.width, data.height);
        }
      };

      socket.on('erase-area', handleEraseArea);
      return () => {
        socket.off('erase-area', handleEraseArea);
      };
    }
  }, [socket]);

  const startDrawing = ({ nativeEvent }) => {
    if (nativeEvent.button !== 0) return;
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);

    // --- HANDLE SELECTION TOOL ---
    if (tool === 'select') {
      // 1. Check if we are clicking INSIDE an existing active selection to Move it
      if (selectionBox &&
        x >= selectionBox.x && x <= selectionBox.x + selectionBox.width &&
        y >= selectionBox.y && y <= selectionBox.y + selectionBox.height) {

        setIsDraggingSelection(true);
        setDragOffset({
          x: x - selectionBox.x,
          y: y - selectionBox.y
        });
        return;
      }

      // 2. If we have an active snapshot but clicked OUTSIDE, commit (paste) it first
      if (selectionSnapshot) {
        commitSelection();
        // Don't return, allow falling through to start a NEW selection below
      }
      // If we just had a box but no snapshot (rare case), clear it
      else if (selectionBox) {
        setSelectionBox(null);
      }

      // 3. Start a NEW Selection
      setSelectionStart({ x, y });
      setSelectionBox({ x, y, width: 0, height: 0 });
      setIsDrawing(true);
      return;
    }
    // -----------------------------

    if (!['pencil', 'brush', 'eraser'].includes(tool)) return;
    // ... rest of your existing drawing logic ...
    if (setShowColorPicker) setShowColorPicker(false);
    const ctx = drawingContextRef.current;
    setupDrawingContext();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsDrawing(true);
    currentDrawingRef.current = { tool, color, size, points: [{ x, y }, { x, y }] };
  };


  const stopDrawing = () => {
    // --- OBSŁUGA NARZĘDZIA SELECT (ZAZNACZANIE) ---
    if (tool === 'select') {
      setIsDrawing(false);

      // 1. Jeśli właśnie przesuwaliśmy "wycięty" kawałek -> po prostu przestań przesuwać
      if (isDraggingSelection) {
        setIsDraggingSelection(false);
        return;
      }

      // 2. Jeśli właśnie skończyliśmy RYSOWAĆ ramkę zaznaczenia -> WYKONAJ "WITIĘCIE" (LIFT)
      if (selectionBox) {
        const { x, y, width, height } = selectionBox;

        // Ignoruj bardzo małe zaznaczenia (przypadkowe kliknięcia)
        if (width > 5 && height > 5) {

          // Jeśli nie mamy jeszcze "snapshota" (wyciętego obrazka), to go tworzymy
          if (!selectionSnapshot) {
            const ctx = drawingContextRef.current;

            // A. Pobierz dane pikseli z zaznaczonego obszaru
            const imageData = ctx.getImageData(x, y, width, height);

            // B. Wyczyść ten obszar na oryginalnym canvasie (efekt "nożyczek")
            ctx.clearRect(x, y, width, height);

            // C. Skonwertuj piksele na obrazek (DataURL), aby wyświetlić go w ruchomym divie
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);

            const capturedImage = tempCanvas.toDataURL();
            setSelectionSnapshot(capturedImage); // Zapisz obrazek do stanu

            // D. Wyślij do innych użytkowników info, że ten kawałek zniknął (zrobiła się dziura)
            if (socket && whiteboardId) {
              socket.emit('erase-area', {
                whiteboardId,
                x, y, width, height
              });
            }

            // Uwaga: Nie usuwamy tutaj notatek/kształtów DOM, 
            // Paint zazwyczaj przenosi tylko piksele (rastry). 
            // Jeśli chcesz też przenosić obiekty, logika musiałaby być bardziej złożona.
          }
        } else {
          // Jeśli zaznaczenie było za małe i nie trzymamy żadnego obrazka -> reset
          if (!selectionSnapshot) {
            setSelectionBox(null);
          }
        }
      }

      setSelectionStart(null);
      return;
    }
    // ----------------------------------------------

    // --- OBSŁUGA STANDARDOWEGO RYSOWANIA (OŁÓWEK, PĘDZEL, GUMKA) ---
    if (!isDrawing) return;

    if (!['pencil', 'brush', 'eraser'].includes(tool)) {
      setIsDrawing(false);
      return;
    }

    // Upewnij się, że kontekst jest poprawny
    setupDrawingContext();

    // Zamknij ścieżkę
    if (drawingContextRef.current) {
      drawingContextRef.current.closePath();
    }

    setIsDrawing(false);

    // Zapisz do historii
    if (currentDrawingRef.current && onDrawing) {
      onDrawing(currentDrawingRef.current);
      saveToHistory(ACTION_TYPES.DRAWING, currentDrawingRef.current);
    }
    currentDrawingRef.current = null;
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing || !drawingContextRef.current) return;
    if (!['pencil', 'brush', 'eraser'].includes(tool)) return;
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);
    if (currentDrawingRef.current) {
      const points = currentDrawingRef.current.points;
      const previousPoint = points[points.length - 1];
      points.push({ x, y });

      // 🔹 DODANE: Upewnij się, że kontekst jest poprawnie skonfigurowany
      setupDrawingContext();

      drawPathSegment(drawingContextRef.current, tool, color, size, previousPoint, { x, y });
    }
  };

  const handleShapeUpdate = (id, newProps) => {
    setShapes(prev => prev.map(shape => shape.id === id ? { ...shape, ...newProps } : shape));
    if (onShapeUpdate) onShapeUpdate(id, newProps);
  };

  const handleCanvasClick = (e) => {
    // Blokujemy stawianie elementów prawym przyciskiem
    if (e.button !== 0) return;

    if (e.target.closest('.shape-item') || e.target.closest('.emoji-item')) return;
    setSelectedNoteId(null); setSelectedTextBoxId(null); setSelectedEmojiId(null); setSelectedGifId(null); setSelectedShapeId(null);

    if (tool === 'notes') {
      const rect = drawingCanvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newNote = { id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y, text: '', width: 180, height: 120 };
      setNotes(prev => prev.some(note => note.id === newNote.id) ? prev : [...prev, newNote]);
      saveToHistory(ACTION_TYPES.NOTE_CREATE, { note: newNote });
      if (onNoteCreate) onNoteCreate(newNote);
      if (setTool) setTool('cursor');
    } else if (tool === 'text') {
      const rect = drawingCanvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newTextBox = { id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y, text: '', width: 200, height: 100 };
      saveToHistory(ACTION_TYPES.TEXT_CREATE, { textBox: newTextBox });
      setTextBoxes(prev => [...prev, newTextBox]);
      if (socket) socket.emit('text-create', { whiteboardId, textBox: newTextBox });
      if (setTool) setTool('cursor');
    }

    if (tool === 'emoji' && activeEmoji) {
      const rect = drawingCanvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newEmoji = { id: `emoji_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y, emoji: activeEmoji, size: 48 };
      setEmojis(prev => [...prev, newEmoji]);
      saveToHistory(ACTION_TYPES.EMOJI_CREATE, { emoji: newEmoji });
      if (onEmojiCreate) onEmojiCreate(newEmoji);
      if (setTool) setTool('cursor');
    }

    if (tool === 'gif' && activeGif) {
      const rect = drawingCanvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newGif = { id: `gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: x - 75, y: y - 75, url: activeGif, width: 150 };
      setGifs(prev => [...prev, newGif]);
      saveToHistory(ACTION_TYPES.GIF_CREATE, { gif: newGif });
      if (onGifCreate) onGifCreate(newGif);
      if (setTool) setTool('cursor');
    }
    if (tool === 'shape' && activeShape) {
      const rect = drawingCanvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let defaultWidth = 100, defaultHeight = 100, startX = x - 50, startY = y - 50;
      if (activeShape === 'arrow') { startX = x; startY = y; defaultWidth = 150; defaultHeight = 0; }
      const newShape = { id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: startX, y: startY, width: defaultWidth, height: defaultHeight, type: activeShape };
      setShapes(prev => [...prev, newShape]);
      saveToHistory(ACTION_TYPES.SHAPE_CREATE, { shape: newShape });
      if (onShapeCreate) onShapeCreate(newShape);
      if (setTool) setTool('cursor');
    }
  };

  const removeNote = (id) => {
    const noteToDelete = notes.find(note => note.id === id);
    if (noteToDelete) {
      saveToHistory(ACTION_TYPES.NOTE_DELETE, { noteId: id, note: noteToDelete });
      setNotes(prev => prev.filter(n => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
      if (onNoteDelete) onNoteDelete(id);
    }
  };

  const handleEmojiUpdate = (id, updates) => {
    setEmojis(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    if (onEmojiUpdate) onEmojiUpdate(id, updates);
  };

  const handleNoteUpdate = (id, updates) => {
    if (onNoteUpdate) {
      const dataToSend = { ...updates };
      if (updates.position) { dataToSend.x = updates.position.x; dataToSend.y = updates.position.y; }
      onNoteUpdate(id, dataToSend);
    }
  };

  const handleNoteDelete = (id) => { removeNote(id); };

  const removeTextBox = (id) => {
    const textBoxToDelete = textBoxes.find(textBox => textBox.id === id);
    if (textBoxToDelete) {
      saveToHistory(ACTION_TYPES.TEXT_DELETE, { textBoxId: id, textBox: textBoxToDelete });
      setTextBoxes(prev => prev.filter(tb => tb.id !== id));
      if (selectedTextBoxId === id) setSelectedTextBoxId(null);
      if (socket) socket.emit('text-delete', { whiteboardId, id });
    }
  };

  const handleTextUpdate = (id, newProps) => {
    setTextBoxes(prev => prev.map(textBox => textBox.id === id ? { ...textBox, ...newProps } : textBox));
    if (socket) socket.emit('text-update', { whiteboardId, id, ...newProps });
  };

  // Obsługa klawiszy (Delete, Backspace, Ctrl+Z etc.)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      // Ignoruj jeśli użytkownik pisze w polu tekstowym (np. wewnątrz notatki)
      if (activeElement && (activeElement.tagName.toLowerCase() === 'input' || activeElement.tagName.toLowerCase() === 'textarea')) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {

        // --- 1. OBSŁUGA NARZĘDZIA SELECT (USUWANIE OBSZAROWE) ---
        if (selectionBox) {
          e.preventDefault();

          // A. Usuń "wycięte" piksele (snapshot)
          setSelectionSnapshot(null);

          // B. Funkcja pomocnicza: Sprawdź czy obiekt wchodzi w obszar zaznaczenia
          const isInsideSelection = (objX, objY, objW, objH) => {
            return (
              objX < selectionBox.x + selectionBox.width &&
              objX + objW > selectionBox.x &&
              objY < selectionBox.y + selectionBox.height &&
              objY + objH > selectionBox.y
            );
          };

          // C. Przejdź przez wszystkie listy obiektów i usuń te, które są w środku

          // Notatki
          notes.forEach(note => {
            if (isInsideSelection(note.x, note.y, note.width, note.height)) {
              removeNote(note.id);
            }
          });

          // Pola tekstowe
          textBoxes.forEach(tb => {
            if (isInsideSelection(tb.x, tb.y, tb.width, tb.height)) {
              removeTextBox(tb.id);
            }
          });

          // Emoji (zakładamy stały rozmiar ok. 48px jeśli nie podany)
          emojis.forEach(emoji => {
            const size = emoji.size || 48;
            if (isInsideSelection(emoji.x, emoji.y, size, size)) {
              removeEmoji(emoji.id);
            }
          });

          // Gify
          gifs.forEach(gif => {
            // Gify są często kwadratowe lub o szerokości zdefiniowanej
            const w = gif.width || 150;
            if (isInsideSelection(gif.x, gif.y, w, w)) {
              removeGif(gif.id);
            }
          });

          // Kształty
          shapes.forEach(shape => {
            const w = shape.width || 100;
            const h = shape.height || 100;
            // Dla strzałek wysokość może być 0, więc dajemy min 10px dla łatwiejszego łapania
            if (isInsideSelection(shape.x, shape.y, w, Math.max(h, 10))) {
              removeShape(shape.id);
            }
          });

          // Zakończ zaznaczanie
          setSelectionBox(null);
          return;
        }
        // -------------------------------------------------------

        // --- 2. USUWANIE POJEDYNCZYCH ELEMENTÓW (przez kliknięcie) ---
        if (selectedNoteId) removeNote(selectedNoteId);
        if (selectedTextBoxId) removeTextBox(selectedTextBoxId);
        if (selectedEmojiId) removeEmoji(selectedEmojiId);
        if (selectedGifId) removeGif(selectedGifId);
        if (selectedShapeId) removeShape(selectedShapeId);
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    // Lista zależności musi być pełna, aby funkcja widziała aktualny stan tablic
    notes, textBoxes, emojis, gifs, shapes,
    selectedNoteId, selectedTextBoxId, selectedEmojiId, selectedGifId, selectedShapeId,
    selectionBox, selectionSnapshot,
    undo, redo
  ]);

  useEffect(() => {
    if (socket) {
      const handleNoteCreate = (data) => setNotes(prev => [...prev, data.note]);
      const handleNoteUpdate = (data) => {
        setNotes(prev => {
          const noteIndex = prev.findIndex(note => note.id === data.id);
          if (noteIndex === -1) return prev;
          const updates = { ...data };
          if (data.position) { updates.x = data.position.x; updates.y = data.position.y; delete updates.position; }
          const updatedNote = { ...prev[noteIndex], ...updates };
          const newNotes = [...prev];
          newNotes[noteIndex] = updatedNote;
          return newNotes;
        });
      };
      const handleNoteDelete = (data) => setNotes(prev => prev.filter(note => note.id !== data.id));
      const handleEmojiUpdate = (data) => setEmojis(prev => prev.map(e => e.id === data.id ? { ...e, ...data } : e));
      const handleGifUpdate = (data) => setGifs(prev => prev.map(g => g.id === data.id ? { ...g, ...data } : g));
      const handleShapeUpdate = (data) => setShapes(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));

      const handleEmojiCreateSocket = (data) => setEmojis(prev => prev.some(e => e.id === data.emoji.id) ? prev : [...prev, data.emoji]);
      const handleEmojiDeleteSocket = (data) => setEmojis(prev => prev.filter(e => e.id !== data.id));
      const handleGifCreateSocket = (data) => setGifs(prev => prev.some(g => g.id === data.gif.id) ? prev : [...prev, data.gif]);
      const handleGifDeleteSocket = (data) => setGifs(prev => prev.filter(g => g.id !== data.id));
      const handleShapeCreateSocket = (data) => setShapes(prev => prev.some(s => s.id === data.shape.id) ? prev : [...prev, data.shape]);
      const handleShapeDeleteSocket = (data) => setShapes(prev => prev.filter(s => s.id !== data.id));

      socket.on('note-create', handleNoteCreate);
      socket.on('note-update', handleNoteUpdate);
      socket.on('note-delete', handleNoteDelete);
      socket.on('emoji-update', handleEmojiUpdate);
      socket.on('gif-update', handleGifUpdate);
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
        socket.off('gif-update', handleGifUpdate);
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
    if (onCursorMove) onCursorMove({ x, y });

    // --- HANDLE SELECTION DRAG/RESIZE ---
    if (tool === 'select') {
      // Case A: Moving the captured selection
      if (isDraggingSelection && selectionBox) {
        setSelectionBox({
          ...selectionBox,
          x: x - dragOffset.x,
          y: y - dragOffset.y
        });
        return;
      }

      // Case B: Creating the selection box (resizing)
      if (isDrawing && selectionStart) {
        const newWidth = x - selectionStart.x;
        const newHeight = y - selectionStart.y;
        setSelectionBox({
          x: newWidth > 0 ? selectionStart.x : x,
          y: newHeight > 0 ? selectionStart.y : y,
          width: Math.abs(newWidth),
          height: Math.abs(newHeight)
        });
      }
      return;
    }
    // ------------------------------------

    if (isDrawing) draw(e);
  };

  const toggleBackground = () => {
    const currentIndex = backgroundModes.findIndex(mode => mode.id === backgroundMode);
    const nextIndex = (currentIndex + 1) % backgroundModes.length;
    setBackgroundMode(backgroundModes[nextIndex].id);
    // Nie czyścimy drawing canvas - tylko zmieniamy tło
    drawBackground();
  };

  const getCurrentBackgroundIcon = () => backgroundModes.find(mode => mode.id === backgroundMode)?.icon;

  const handleMouseLeave = () => {
    if (tool === 'pointer' && drawingCanvasRef.current) drawingCanvasRef.current.style.cursor = 'default';
    stopDrawing();
  };

  const handleMouseEnter = () => {
    if (tool === 'pointer' && drawingCanvasRef.current) drawingCanvasRef.current.style.cursor = 'pointer';
  };

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

  useEffect(() => {
    if (socket) {
      const handleTextCreate = (data) => setTextBoxes(prev => [...prev, data.textBox]);
      const handleTextUpdate = (data) => setTextBoxes(prev => prev.map(textBox => textBox.id === data.id ? { ...textBox, ...data } : textBox));
      const handleTextDelete = (data) => setTextBoxes(prev => prev.filter(tb => tb.id !== data.id));
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

  useEffect(() => {
    historyRef.current = { history: [], step: -1 };
    setHistory([]);
    setHistoryStep(-1);
  }, [whiteboardId]);

  const remoteCursorsArray = Array.from(remoteCursors.values());

  return (
    <div className="canvas-container" ref={containerRef}>
      <div
      className={`canvas-area background-${backgroundMode} ${tool === 'select' ? 'is-selecting' : ''}`}
      onClick={handleCanvasClick}>
      <canvas
        ref={backgroundCanvasRef}
        className="background-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
          pointerEvents: 'none'
        }}
      />

      {/* Główny canvas do rysowania */}
      <canvas
        ref={drawingCanvasRef}
        className="drawing-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 2,
          backgroundColor: 'transparent'
        }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
      />

      {/* Renderowanie prostokąta zaznaczania */}
      {selectionBox && (
        <div
          className="selection-overlay"
          style={{
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
            // Add a border if we have a snapshot to make it look like a selected object
            border: '1px dashed #3498db'
          }}
        >
          {selectionSnapshot && (
            <img
              src={selectionSnapshot}
              alt="Selected area"
              className="selection-image"
              draggable={false} // Prevent browser native drag
            />
          )}
        </div>
      )}

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
      {emojis.map(emojiData => (
        <Emoji
          key={emojiData.id}
          {...emojiData}
          selected={selectedEmojiId === emojiData.id}
          onSelect={setSelectedEmojiId}
          onRemove={removeEmoji}
          onUpdate={handleEmojiUpdate}
        />
      ))}
      {gifs.map(gif => (
        <Gif
          key={gif.id}
          {...gif}
          selected={selectedGifId === gif.id}
          onSelect={setSelectedGifId}
          onUpdate={handleGifUpdate}
        />
      ))}
      {shapes.map(shape => (
        <Shape
          key={shape.id}
          {...shape}
          selected={selectedShapeId === shape.id}
          onSelect={setSelectedShapeId}
          onRemove={removeShape}
          onUpdate={handleShapeUpdate}
        />
      ))}

      {/* FIX: Dodano klucz fall-back dla kursorów */}
      {remoteCursorsArray.map((cursor, index) => (
        cursor.position && (
          <div
            key={cursor.userId || `cursor_${index}`}
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
    </div >
  );
};

export default Canvas;
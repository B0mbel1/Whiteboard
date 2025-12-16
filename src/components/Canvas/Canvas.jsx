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
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
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

  //Zaznaczenie
  // 🔹 DODANE: Stan dla zaznaczania obszaru
  const [selectionBox, setSelectionBox] = useState(null); // { x, y, width, height }
  const [selectionStart, setSelectionStart] = useState(null); // { x, y }

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
    CLEAR_AREA: 'clear_area' // Opcjonalne: do historii
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
        clearCanvas();
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
        clearCanvas();
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

  const redrawCanvas = () => {
    const context = contextRef.current;
    if (!context) return;
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
    clearCanvas();

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
        clearCanvas();
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
    if (!context || !data.points || data.points.length < 2) return;
    drawCompletePath(context, data.tool, data.color, data.size, data.points);
  };

  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleGifUpdate = (id, updates) => {
    setGifs(prev => prev.map(gif => gif.id === id ? { ...gif, ...updates } : gif));
    if (onGifUpdate) onGifUpdate(id, updates);
  };

  const updateCanvasSize = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = contextRef.current;
    if (!canvas || !container || !ctx) return;
    const rect = container.getBoundingClientRect();
    if (canvas.width === rect.width && canvas.height === rect.height) return;

    let imageData = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try { imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); }
      catch (e) { console.warn("Nie udało się pobrać danych canvas:", e); }
    }
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (imageData) ctx.putImageData(imageData, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    const toolSize = getToolSize();
    ctx.lineWidth = toolSize;
  };

  const getToolSize = () => {
    const base = (typeof size === "object" && size?.[tool]) ? size[tool] : (typeof size === "number" ? size : 3);
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

  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx) return;
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = getToolSize();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  }, [color, size, tool]);

  useEffect(() => {
    if (socket) {
      const handleEraseArea = (data) => {
        const ctx = contextRef.current;
        if (ctx) {
          // Wyczyść piksele na canvasie
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
    // ✅ ZMIANA: Sprawdzamy, czy wciśnięty przycisk to lewy (0).
    // Jeśli to prawy (2) lub środkowy (1), przerywamy funkcję.
    if (nativeEvent.button !== 0) return;

    if (tool === 'select') {
      const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);
      setSelectionStart({ x, y });
      setSelectionBox({ x, y, width: 0, height: 0 });
      setIsDrawing(true);
      return;
    }

    if (!['pencil', 'brush', 'eraser'].includes(tool)) return;
    if (setShowColorPicker) setShowColorPicker(false);
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    setIsDrawing(true);
    currentDrawingRef.current = { tool, color, size, points: [{ x, y }, { x, y }] };
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    if (tool === 'select' && selectionBox) {
      const { x, y, width, height } = selectionBox;

      if (width > 5 && height > 5) { // Ignoruj mikroskopijne zaznaczenia

        // 1. Usuń obiekty DOM (Notes, Shapes, Text, etc.)
        const checkCollision = (objX, objY, objW, objH) => {
          // Sprawdzenie czy obiekt koliduje/jest wewnątrz zaznaczenia
          return (
            objX < x + width &&
            objX + objW > x &&
            objY < y + height &&
            objY + objH > y
          );
        };

        // Batch delete lists
        const notesToDelete = [];
        const shapesToDelete = [];
        const emojisToDelete = [];
        const gifsToDelete = [];
        const textToDelete = [];

        // Notatki
        notes.forEach(note => {
          if (checkCollision(note.x, note.y, note.width, note.height)) {
            removeNote(note.id);
          }
        });

        // Kształty
        shapes.forEach(shape => {
          // Domyślne wymiary jeśli brak
          const w = shape.width || 100;
          const h = shape.height || 100;
          if (checkCollision(shape.x, shape.y, w, h)) {
            removeShape(shape.id);
          }
        });

        // Teksty
        textBoxes.forEach(tb => {
          if (checkCollision(tb.x, tb.y, tb.width, tb.height)) {
            removeTextBox(tb.id);
          }
        });

        // Emojis
        emojis.forEach(emoji => {
          // Przyjmujemy ok. 48px dla emoji
          if (checkCollision(emoji.x, emoji.y, 48, 48)) {
            removeEmoji(emoji.id);
          }
        });

        // Gify
        gifs.forEach(gif => {
          if (checkCollision(gif.x, gif.y, gif.width, gif.width)) { // Gify często kwadratowe
            removeGif(gif.id);
          }
        });

        // 2. Wyczyść rysunki na Canvas (Piksele)
        if (contextRef.current) {
          contextRef.current.clearRect(x, y, width, height);
        }

        // 3. Wyślij informację o wyczyszczeniu obszaru do innych
        if (socket && whiteboardId) {
          socket.emit('erase-area', {
            whiteboardId,
            x, y, width, height
          });
        }
      }

      // Reset
      setSelectionBox(null);
      setSelectionStart(null);
      setIsDrawing(false);
      return;
    }

    if (!['pencil', 'brush', 'eraser'].includes(tool)) { setIsDrawing(false); return; }
    contextRef.current.closePath();
    setIsDrawing(false);
    if (currentDrawingRef.current && onDrawing) {
      onDrawing(currentDrawingRef.current);
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
      drawPathSegment(contextRef.current, tool, color, size, previousPoint, { x, y });
    }
  };

  const handleShapeUpdate = (id, newProps) => {
    setShapes(prev => prev.map(shape => shape.id === id ? { ...shape, ...newProps } : shape));
    if (onShapeUpdate) onShapeUpdate(id, newProps);
  };

  const handleCanvasClick = (e) => {
    // ✅ ZMIANA: Blokujemy stawianie elementów (tekst, notatki, gify) prawym przyciskiem.
    if (e.button !== 0) return;

    if (e.target.closest('.shape-item') || e.target.closest('.emoji-item')) return;
    setSelectedNoteId(null); setSelectedTextBoxId(null); setSelectedEmojiId(null); setSelectedGifId(null); setSelectedShapeId(null);

    if (tool === 'notes') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newNote = { id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y, text: '', width: 180, height: 120 };
      setNotes(prev => prev.some(note => note.id === newNote.id) ? prev : [...prev, newNote]);
      saveToHistory(ACTION_TYPES.NOTE_CREATE, { note: newNote });
      if (onNoteCreate) onNoteCreate(newNote);
      if (setTool) setTool('cursor');
    } else if (tool === 'text') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newTextBox = { id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y, text: '', width: 200, height: 100 };
      saveToHistory(ACTION_TYPES.TEXT_CREATE, { textBox: newTextBox });
      setTextBoxes(prev => [...prev, newTextBox]);
      if (socket) socket.emit('text-create', { whiteboardId, textBox: newTextBox });
      if (setTool) setTool('cursor');
    }

    if (tool === 'emoji' && activeEmoji) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newEmoji = { id: `emoji_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y, emoji: activeEmoji, size: 48 };
      setEmojis(prev => [...prev, newEmoji]);
      saveToHistory(ACTION_TYPES.EMOJI_CREATE, { emoji: newEmoji });
      if (onEmojiCreate) onEmojiCreate(newEmoji);
      if (setTool) setTool('cursor');
    }

    if (tool === 'gif' && activeGif) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newGif = { id: `gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: x - 75, y: y - 75, url: activeGif, width: 150 };
      setGifs(prev => [...prev, newGif]);
      saveToHistory(ACTION_TYPES.GIF_CREATE, { gif: newGif });
      if (onGifCreate) onGifCreate(newGif);
      if (setTool) setTool('cursor');
    }
    if (tool === 'shape' && activeShape) {
      const rect = canvasRef.current.getBoundingClientRect();
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName.toLowerCase() === 'input' || activeElement.tagName.toLowerCase() === 'textarea')) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedNoteId) removeNote(selectedNoteId);
        if (selectedTextBoxId) removeTextBox(selectedTextBoxId);
        if (selectedEmojiId) removeEmoji(selectedEmojiId);
        if (selectedGifId) removeGif(selectedGifId);
        if (selectedShapeId) removeShape(selectedShapeId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId, selectedTextBoxId, selectedEmojiId, selectedGifId, selectedShapeId]);

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

    if (isDrawing && tool === 'select' && selectionStart) {
      const newWidth = x - selectionStart.x;
      const newHeight = y - selectionStart.y;

      // Obliczamy znormalizowane koordynaty (obsługa ciągnięcia w lewo/górę)
      setSelectionBox({
        x: newWidth > 0 ? selectionStart.x : x,
        y: newHeight > 0 ? selectionStart.y : y,
        width: Math.abs(newWidth),
        height: Math.abs(newHeight)
      });
      return;
    }

    if (isDrawing) draw(e);
  };

  const toggleBackground = () => {
    const currentIndex = backgroundModes.findIndex(mode => mode.id === backgroundMode);
    const nextIndex = (currentIndex + 1) % backgroundModes.length;
    setBackgroundMode(backgroundModes[nextIndex].id);
    clearCanvas();
  };

  useEffect(() => { clearCanvas(); }, [backgroundMode]);
  const getCurrentBackgroundIcon = () => backgroundModes.find(mode => mode.id === backgroundMode)?.icon;

  const handleMouseLeave = () => {
    if (tool === 'pointer' && canvasRef.current) canvasRef.current.style.cursor = 'default';
    stopDrawing();
  };

  const handleMouseEnter = () => {
    if (tool === 'pointer' && canvasRef.current) canvasRef.current.style.cursor = 'pointer';
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
      <div className={`canvas-area background-${backgroundMode}`} onClick={handleCanvasClick}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseEnter={handleMouseEnter}
        />
        {/* 🔹 DODANE: Renderowanie prostokąta zaznaczania */}
        {selectionBox && (
          <div
            className="selection-overlay"
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height
            }}
          />
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
    </div>
  );
};

export default Canvas;
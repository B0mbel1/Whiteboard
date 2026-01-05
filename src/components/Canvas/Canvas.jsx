import React, { useState, useRef, useEffect } from 'react';
import './Canvas.css';
import { getStandardizedSize, getDisplaySize, getToolEffects } from '../../utils/toolSizes';
import { drawCompletePath, drawPathSegment } from '../../utils/drawingUtils';
import Note from './Note';
import Text from './Text';
import Emoji from './Emoji';
import Gif from './Gif';
import ImageItem from './ImageItem';
import Shape from './Shape';
import Chat from './Chat';

// --- STAŁE GRANICZNE ---
const WORLD_LIMIT = 1500; 

const Canvas = ({
  tool,
  color,
  size,
  setShowColorPicker,
  whiteboardId,
  socket,
  setTool,
  currentUser,
  users,
  onDrawing,
  onCursorMove,
  textBoxes: initialTextBoxes,
  notes: initialNotes,
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete,
  emojis: initialEmojis,
  activeEmoji,
  setActiveEmoji,
  onEmojiCreate,
  onEmojiUpdate,
  onEmojiDelete,
  gifs: initialGifs,
  activeGif,
  onGifCreate,
  onGifDelete,
  onGifUpdate,
  images: initialImages,
  onImageCreate,
  onImageUpdate,
  onImageDelete,
  shapes: initialShapes,
  activeShape,
  onShapeCreate,
  onShapeDelete,
  onShapeUpdate,
  backgroundMode,
  onBackgroundChange,
}) => {
  const [remoteCursors, setRemoteCursors] = useState(new Map());
  const [isChatVisible, setIsChatVisible] = useState(false);

  const backgroundModeRef = useRef(backgroundMode);

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

  // Historia undo/redo (Twoja lokalna)
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const historyRef = useRef({ history: [], step: -1 });

  // --- NOWOŚĆ: Pamięć rysunków zdalnych (od innych) ---
  const remoteDrawingsRef = useRef([]); 

  // --- STANY DO PANNINGU ---
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 }); // Ref dla socketów i renderowania

  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  
  // Helpers
  const isWithinBounds = (x, y) => {
    return x >= -WORLD_LIMIT && x <= WORLD_LIMIT && y >= -WORLD_LIMIT && y <= WORLD_LIMIT;
  };

  const [selectedTextBoxId, setSelectedTextBoxId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);

  // Emojis
  const [emojis, setEmojis] = useState(initialEmojis || []);
  const [selectedEmojiId, setSelectedEmojiId] = useState(null);

  // Gif
  const [gifs, setGifs] = useState(initialGifs || []);
  const [selectedGifId, setSelectedGifId] = useState(null);

  // Images
  const [images, setImages] = useState(initialImages || []);
  const [selectedImageId, setSelectedImageId] = useState(null);

  // Shapes
  const [shapes, setShapes] = useState(initialShapes || []);
  const [selectedShapeId, setSelectedShapeId] = useState(null);

  // Zaznaczenie
  const [selectionBox, setSelectionBox] = useState(null);
  const [selectionStart, setSelectionStart] = useState(null);

  const [selectionSnapshot, setSelectionSnapshot] = useState(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [originalCaptureRect, setOriginalCaptureRect] = useState(null);

  const [clipboard, setClipboard] = useState(null);

  const isWorkingTool = ['select', 'pencil', 'brush', 'eraser'].includes(tool);

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
    IMAGE_CREATE: 'image_create',
    IMAGE_DELETE: 'image_delete',
    SHAPE_CREATE: 'shape_create',
    SHAPE_DELETE: 'shape_delete',
    CLEAR_AREA: 'clear_area',
    MASS_DELETE: 'mass_delete'
  };

  // --- Synchronizacja panOffsetRef ---
  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  // --- START NA ŚRODKU EKRANU ---
  useEffect(() => {
    if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const startOffset = {
            x: clientWidth / 2,
            y: clientHeight / 2
        };
        setPanOffset(startOffset);
        panOffsetRef.current = startOffset;
    }
  }, []);

  // --- OBSŁUGA KLAWISZA SPACJI ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          setIsSpacePressed(true);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- COORDS ---
  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = drawingCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { 
      x: clientX - rect.left - panOffsetRef.current.x, 
      y: clientY - rect.top - panOffsetRef.current.y 
    };
  };

  const getToolSize = () => {
    const base = (typeof size === "object" && size?.[tool]) ? size[tool] : (typeof size === "number" ? size : 3);
    return getDisplaySize(tool, base);
  };

  useEffect(() => { setShapes(initialShapes || []); }, [initialShapes]);

  // Historia
  const saveToHistory = (actionType, data) => {
    const newHistory = historyRef.current.history.slice(0, historyRef.current.step + 1);
    const historyItem = { type: actionType, data: data, timestamp: Date.now() };
    newHistory.push(historyItem);
    if (newHistory.length > 50) newHistory.shift();

    historyRef.current = { history: newHistory, step: newHistory.length - 1 };
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  useEffect(() => {
    backgroundModeRef.current = backgroundMode;
    drawBackground();
  }, [backgroundMode]);

  // Context Setup
  const setupDrawingContext = () => {
    const ctx = drawingContextRef.current;
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = getToolSize();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    
    // Kluczowe: używamy REF do transformacji, żeby była zawsze aktualna
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.translate(panOffsetRef.current.x, panOffsetRef.current.y);
  };

  const clearDrawingCanvas = () => {
    const context = drawingContextRef.current;
    const canvas = drawingCanvasRef.current;
    if (!context || !canvas) return;
    
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    setupDrawingContext();
  };

  // --- GŁÓWNA PĘTLA RYSOWANIA (LOCAL + REMOTE) ---
  const redrawCanvas = () => {
    const context = drawingContextRef.current;
    if (!context) return;

    clearDrawingCanvas();

    // 1. Najpierw rysujemy to co przyszło od innych (Remote)
    remoteDrawingsRef.current.forEach(action => {
       drawRemote(action);
    });

    // 2. Potem rysujemy Twoją historię (Local)
    for (let i = 0; i <= historyRef.current.step; i++) {
      const action = historyRef.current.history[i];
      if (action.type === ACTION_TYPES.DRAWING && action.data && action.data.points && action.data.points.length > 1) {
        drawCompletePath(context, action.data.tool, action.data.color, action.data.size, action.data.points);
      }
    }
  };

  // Undo / Redo
  const undo = () => {
    if (historyRef.current.step < 0) return;
    const currentStep = historyRef.current.step;
    const action = historyRef.current.history[currentStep];

    switch (action.type) {
      case ACTION_TYPES.DRAWING:
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
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
      setupDrawingContext();
      ctx.drawImage(img, selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
      saveToHistory(ACTION_TYPES.DRAWING, { tool: 'paste' });
    };
    img.src = selectionSnapshot;

    setSelectionSnapshot(null);
    setSelectionBox(null);
    setOriginalCaptureRect(null);
  };

  // --- TŁO ---
  const backgroundModes = [
    { id: 'white', name: 'Białe tło', icon: '🌕' },
    { id: 'grid', name: 'Kratka', icon: '🏁' },
    { id: 'lines', name: 'Siatka linii', icon: '📐' },
    { id: 'black', name: 'Czarne tło', icon: '🌑' },
  ];

  const drawBackground = () => {
    const canvas = backgroundCanvasRef.current;
    const context = backgroundContextRef.current;
    if (!canvas || !context) return;

    const width = canvas.width;
    const height = canvas.height;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    
    // Szare tło poza światem
    context.fillStyle = '#e5e5e5';
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(panOffsetRef.current.x, panOffsetRef.current.y);

    const areaStart = -WORLD_LIMIT;
    const areaSize = WORLD_LIMIT * 2;

    context.shadowColor = 'rgba(0, 0, 0, 0.2)';
    context.shadowBlur = 20;

    switch (backgroundModeRef.current) {
      case 'white':
        context.fillStyle = 'white';
        context.fillRect(areaStart, areaStart, areaSize, areaSize);
        break;
      case 'grid':
        context.fillStyle = '#f0f0f0';
        context.fillRect(areaStart, areaStart, areaSize, areaSize);
        context.shadowColor = 'transparent';
        context.beginPath();
        context.strokeStyle = '#d0d0d0';
        context.lineWidth = 1;
        const gridSize = 20;
        for (let x = areaStart; x <= WORLD_LIMIT; x += gridSize) {
            context.moveTo(x, areaStart);
            context.lineTo(x, WORLD_LIMIT);
        }
        for (let y = areaStart; y <= WORLD_LIMIT; y += gridSize) {
            context.moveTo(areaStart, y);
            context.lineTo(WORLD_LIMIT, y);
        }
        context.stroke();
        break;
      case 'lines':
        context.fillStyle = 'white';
        context.fillRect(areaStart, areaStart, areaSize, areaSize);
        context.shadowColor = 'transparent';
        context.beginPath();
        context.strokeStyle = '#e0e0e0';
        context.lineWidth = 1;
        const lineSpacing = 24;
        for (let y = areaStart; y <= WORLD_LIMIT; y += lineSpacing) {
          context.moveTo(areaStart, y);
          context.lineTo(WORLD_LIMIT, y);
        }
        context.stroke();
        break;
      case 'black':
        context.fillStyle = 'black';
        context.fillRect(areaStart, areaStart, areaSize, areaSize);
        break;
      default:
        context.fillStyle = 'white';
        context.fillRect(areaStart, areaStart, areaSize, areaSize);
    }
    context.restore();
  };

  // Przerysowanie przy zmianie pozycji
  useEffect(() => {
    drawBackground();
    redrawCanvas();
  }, [panOffset]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (socket) {
      const handleRemoteDrawing = (data) => { 
        // 1. Zapisz w pamięci
        remoteDrawingsRef.current.push(data);
        // 2. Narysuj od razu (żeby było widać w czasie rzeczywistym)
        drawRemote(data); 
      };

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
        // 1. Zapisz całą historię serwera w pamięci
        remoteDrawingsRef.current = data.drawingData || [];
        
        // 2. Przerysuj wszystko
        clearDrawingCanvas();
        redrawCanvas();
      };

      const handleEraseArea = (data) => {
        const action = { ...data, type: 'erase-area' };
        remoteDrawingsRef.current.push(action);

        const ctx = drawingContextRef.current;
        if (ctx) {
           setupDrawingContext();
           ctx.clearRect(data.x, data.y, data.width, data.height);
        }
      };

      const handleUsersUpdated = (data) => {};

      socket.on('drawing', handleRemoteDrawing);
      socket.on('cursor-move', handleRemoteCursorMove);
      socket.on('whiteboard-data', handleWhiteboardState);
      socket.on('user-joined', handleUsersUpdated);
      socket.on('user-left', handleUsersUpdated);
      socket.on('erase-area', handleEraseArea);

      return () => {
        socket.off('drawing', handleRemoteDrawing);
        socket.off('cursor-move', handleRemoteCursorMove);
        socket.off('whiteboard-data', handleWhiteboardState);
        socket.off('user-joined', handleUsersUpdated);
        socket.off('user-left', handleUsersUpdated);
        socket.off('erase-area', handleEraseArea);
      };
    }
  }, [socket, currentUser]);

  const drawRemote = (data) => {
    const context = drawingContextRef.current;
    if (!context) return;

    if (data.type === 'erase-area') {
      setupDrawingContext();
      context.clearRect(data.x, data.y, data.width, data.height);
      return;
    }

    if (!data.points || data.points.length < 2) return;
    setupDrawingContext();
    drawCompletePath(context, data.tool, data.color, data.size, data.points);
  };

  // --- Handlery ---

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

  const removeImage = (id) => {
    const imageToDelete = images.find(img => img.id === id);
    if (imageToDelete) {
      saveToHistory(ACTION_TYPES.IMAGE_DELETE, { imageId: id, image: imageToDelete });
      setImages(prev => prev.filter(img => img.id !== id));
      if (selectedImageId === id) setSelectedImageId(null);
      if (onImageDelete) onImageDelete(id);
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

  const removeNote = (id) => {
    const noteToDelete = notes.find(note => note.id === id);
    if (noteToDelete) {
      saveToHistory(ACTION_TYPES.NOTE_DELETE, { noteId: id, note: noteToDelete });
      setNotes(prev => prev.filter(n => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
      if (onNoteDelete) onNoteDelete(id);
    }
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

  const handleEmojiUpdate = (id, updates) => {
    setEmojis(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    if (onEmojiUpdate) onEmojiUpdate(id, updates);
  };

  const handleGifUpdate = (id, updates) => {
    setGifs(prev => prev.map(gif => gif.id === id ? { ...gif, ...updates } : gif));
    if (onGifUpdate) onGifUpdate(id, updates);
  };

  const handleImageUpdate = (id, updates) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
    if (onImageUpdate) onImageUpdate(id, updates);
  };

  const handleShapeUpdate = (id, newProps) => {
    setShapes(prev => prev.map(shape => shape.id === id ? { ...shape, ...newProps } : shape));
    if (onShapeUpdate) onShapeUpdate(id, newProps);
  };

  const toggleBackground = () => {
    const currentIndex = backgroundModes.findIndex(mode => mode.id === backgroundMode);
    const nextIndex = (currentIndex + 1) % backgroundModes.length;
    const newMode = backgroundModes[nextIndex].id;
    if (onBackgroundChange) {
      onBackgroundChange(newMode);
    }
  };

  const getCurrentBackgroundIcon = () => backgroundModes.find(mode => mode.id === backgroundMode)?.icon;

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
  useEffect(() => { setGifs(initialGifs || []); }, [initialGifs]);
  useEffect(() => { setImages(initialImages || []); }, [initialImages]);
  useEffect(() => { setEmojis(initialEmojis || []); }, [initialEmojis]);

  // Init
  useEffect(() => {
    const backgroundCanvas = backgroundCanvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    const container = containerRef.current;

    if (!backgroundCanvas || !drawingCanvas || !container) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      backgroundCanvas.width = width;
      backgroundCanvas.height = height;
      drawingCanvas.width = width;
      drawingCanvas.height = height;

      backgroundContextRef.current = backgroundCanvas.getContext('2d');
      drawingContextRef.current = drawingCanvas.getContext('2d');

      setupDrawingContext();
      drawBackground();
      
      if (socket && whiteboardId) {
          socket.emit('refresh-whiteboard-data', { whiteboardId });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    setupDrawingContext();
  }, [color, size, tool, panOffset]);

  // Socket Object Listeners
  useEffect(() => {
    if (socket) {
        const handlers = {
            'text-create': (d) => setTextBoxes(p => [...p, d.textBox]),
            'text-update': (d) => setTextBoxes(p => p.map(t => t.id === d.id ? {...t, ...d} : t)),
            'text-delete': (d) => setTextBoxes(p => p.filter(t => t.id !== d.id)),
            'note-create': (d) => setNotes(p => [...p, d.note]),
            'note-update': (d) => setNotes(p => {
                const idx = p.findIndex(n => n.id === d.id);
                if(idx === -1) return p;
                const updated = {...p[idx], ...d};
                if(d.position) { updated.x = d.position.x; updated.y = d.position.y; delete updated.position; }
                const newArr = [...p]; newArr[idx] = updated; return newArr;
            }),
            'note-delete': (d) => setNotes(p => p.filter(n => n.id !== d.id)),
            'emoji-create': (d) => setEmojis(p => [...p, d.emoji]),
            'emoji-update': (d) => setEmojis(p => p.map(e => e.id === d.id ? {...e, ...d} : e)),
            'emoji-delete': (d) => setEmojis(p => p.filter(e => e.id !== d.id)),
            'gif-create': (d) => setGifs(p => [...p, d.gif]),
            'gif-update': (d) => setGifs(p => p.map(g => g.id === d.id ? {...g, ...d} : g)),
            'gif-delete': (d) => setGifs(p => p.filter(g => g.id !== d.id)),
            'image-create': (d) => setImages(p => [...p, d.image]),
            'image-update': (d) => setImages(p => p.map(i => i.id === d.id ? {...i, ...d} : i)),
            'image-delete': (d) => setImages(p => p.filter(i => i.id !== d.id)),
            'shape-create': (d) => setShapes(p => [...p, d.shape]),
            'shape-update': (d) => setShapes(p => p.map(s => s.id === d.id ? {...s, ...d} : s)),
            'shape-delete': (d) => setShapes(p => p.filter(s => s.id !== d.id)),
        };

        Object.keys(handlers).forEach(event => socket.on(event, handlers[event]));
        return () => Object.keys(handlers).forEach(event => socket.off(event, handlers[event]));
    }
  }, [socket]);

  const remoteCursorsArray = Array.from(remoteCursors.values());

  const startDrawing = ({ nativeEvent }) => {
    if (isSpacePressed && nativeEvent.button === 0) {
        setIsPanning(true);
        lastMousePosRef.current = { x: nativeEvent.clientX, y: nativeEvent.clientY };
        return;
    }

    if (nativeEvent.button !== 0) return;
    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);

    // BLOKADA
    if (!isWithinBounds(x, y)) return; 

    if (tool === 'select') {
      if (isDraggingSelection) return;
      if (selectionSnapshot) {
        commitSelection();
      } else if (selectionBox) {
        setSelectionBox(null);
      }
      setSelectionStart({ x, y });
      setSelectionBox({ x, y, width: 0, height: 0 });
      setIsDrawing(true);
      return;
    }

    if (!['pencil', 'brush', 'eraser'].includes(tool)) return;
    if (setShowColorPicker) setShowColorPicker(false);
    
    setupDrawingContext();
    const ctx = drawingContextRef.current;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsDrawing(true);
    currentDrawingRef.current = { tool, color, size, points: [{ x, y }, { x, y }] };
  };

  const stopDrawing = () => {
    if (isPanning) {
        setIsPanning(false);
        return;
    }

    if (tool === 'select') {
      setIsDrawing(false);
      if (isDraggingSelection) {
        setIsDraggingSelection(false);
        return;
      }
      if (selectionBox) {
        const { x, y, width, height } = selectionBox;
        if (width > 5 && height > 5) {
          if (!selectionSnapshot) {
            const ctx = drawingContextRef.current;
            const bitmapX = x + panOffset.x;
            const bitmapY = y + panOffset.y;
            const imageData = ctx.getImageData(bitmapX, bitmapY, width, height);
            ctx.clearRect(x, y, width, height); 
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            const capturedImage = tempCanvas.toDataURL();
            setSelectionSnapshot(capturedImage);
            setOriginalCaptureRect({ x, y, width, height });
          }
        } else {
           if (!selectionSnapshot) setSelectionBox(null);
        }
      }
      setSelectionStart(null);
      return;
    }

    if (!isDrawing) return;
    if (!['pencil', 'brush', 'eraser'].includes(tool)) {
      setIsDrawing(false);
      return;
    }

    setupDrawingContext();
    if (drawingContextRef.current) {
      drawingContextRef.current.closePath();
    }
    setIsDrawing(false);

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
    
    if (!isWithinBounds(x, y)) return;

    if (currentDrawingRef.current) {
      const points = currentDrawingRef.current.points;
      const previousPoint = points[points.length - 1];
      points.push({ x, y });
      setupDrawingContext();
      drawPathSegment(drawingContextRef.current, tool, color, size, previousPoint, { x, y });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
        const dx = e.clientX - lastMousePosRef.current.x;
        const dy = e.clientY - lastMousePosRef.current.y;
        
        setPanOffset(prev => {
            const container = containerRef.current;
            if (!container) return { x: prev.x + dx, y: prev.y + dy };

            const halfW = container.clientWidth / 2;
            const halfH = container.clientHeight / 2;
            const OFFSET_LIMIT = WORLD_LIMIT + 500;
            const newX = prev.x + dx;
            const newY = prev.y + dy;
            const clampedX = Math.min(halfW + OFFSET_LIMIT, Math.max(halfW - OFFSET_LIMIT, newX));
            const clampedY = Math.min(halfH + OFFSET_LIMIT, Math.max(halfH - OFFSET_LIMIT, newY));

            return { x: clampedX, y: clampedY };
        });

        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
    }

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    if (onCursorMove) onCursorMove({ x, y });

    if (tool === 'select') {
      if (isDraggingSelection && selectionBox) {
        setSelectionBox({
          ...selectionBox,
          x: x - dragOffset.x,
          y: y - dragOffset.y
        });
        return;
      }
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

    if (isDrawing) draw(e);
  };
  
  const handleMouseLeave = () => { stopDrawing(); };
  const handleMouseEnter = () => { };

  const handleCanvasClick = (e) => {
    if (isSpacePressed || isPanning) return;
    if (e.button !== 0) return;
    if (e.target.closest('.shape-item') || e.target.closest('.emoji-item')) return;
    
    setSelectedNoteId(null); setSelectedTextBoxId(null); setSelectedEmojiId(null); 
    setSelectedGifId(null); setSelectedShapeId(null); setSelectedImageId(null);

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);

    if (!isWithinBounds(x, y)) return;

    if (tool === 'notes') {
      const newNote = { id: `note_${Date.now()}_${Math.random()}`, x, y, text: '', width: 180, height: 120 };
      setNotes(prev => [...prev, newNote]);
      saveToHistory(ACTION_TYPES.NOTE_CREATE, { note: newNote });
      if (onNoteCreate) onNoteCreate(newNote);
      setTool('cursor');
    } else if (tool === 'text') {
      const newTextBox = { id: `text_${Date.now()}_${Math.random()}`, x, y, text: '', width: 200, height: 100 };
      saveToHistory(ACTION_TYPES.TEXT_CREATE, { textBox: newTextBox });
      setTextBoxes(prev => [...prev, newTextBox]);
      if (socket) socket.emit('text-create', { whiteboardId, textBox: newTextBox });
      setTool('cursor');
    } else if (tool === 'emoji' && activeEmoji) {
      const newEmoji = { id: `emoji_${Date.now()}_${Math.random()}`, x, y, emoji: activeEmoji, size: 48 };
      setEmojis(prev => [...prev, newEmoji]);
      saveToHistory(ACTION_TYPES.EMOJI_CREATE, { emoji: newEmoji });
      if (onEmojiCreate) onEmojiCreate(newEmoji);
      setTool('cursor');
      setActiveEmoji(null);
    } else if (tool === 'gif' && activeGif) {
      const newGif = { id: `gif_${Date.now()}_${Math.random()}`, x: x - 75, y: y - 75, url: activeGif, width: 150 };
      setGifs(prev => [...prev, newGif]);
      saveToHistory(ACTION_TYPES.GIF_CREATE, { gif: newGif });
      if (onGifCreate) onGifCreate(newGif);
      setTool('cursor');
    } else if (tool === 'shape' && activeShape) {
      let defaultWidth = 100, defaultHeight = 100, startX = x - 50, startY = y - 50;
      if (activeShape === 'arrow') { startX = x; startY = y; defaultWidth = 150; defaultHeight = 0; }
      const newShape = { id: `shape_${Date.now()}_${Math.random()}`, x: startX, y: startY, width: defaultWidth, height: defaultHeight, type: activeShape, userId: currentUser.id, color: currentUser.color };
      setShapes(prev => [...prev, newShape]);
      saveToHistory(ACTION_TYPES.SHAPE_CREATE, { shape: newShape });
      if (onShapeCreate) onShapeCreate(newShape);
      setTool('cursor');
    }
  };

  useEffect(() => {
    const handlePaste = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          e.preventDefault();
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (event) => {
            const url = event.target.result;
            const container = document.querySelector('.canvas-container');
            let centerX = 300; let centerY = 300;
            if (container) {
              centerX = (container.clientWidth / 2) - panOffset.x - 150;
              centerY = (container.clientHeight / 2) - panOffset.y - 100;
            }
            const newImage = {
              id: `img_${Date.now()}_${Math.random()}`,
              x: centerX, y: centerY, url: url, width: 300
            };
            if (onImageCreate) onImageCreate(newImage);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onImageCreate, panOffset]);

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

  return (
    <div className="canvas-container" ref={containerRef}>
      <div
        className={`canvas-area background-${backgroundMode} ${tool === 'select' ? 'is-selecting' : ''} ${isSpacePressed ? (isPanning ? 'is-grabbing' : 'is-grab') : ''}`}
        onClick={handleCanvasClick}
        style={{ backgroundPosition: `${panOffset.x}px ${panOffset.y}px` }}
      >
        <canvas
          ref={backgroundCanvasRef}
          className="background-canvas"
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none' }}
        />

        <canvas
          ref={drawingCanvasRef}
          className="drawing-canvas"
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, backgroundColor: 'transparent' }}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseEnter={handleMouseEnter}
        />

        {selectionBox && (
          <div
            className="selection-overlay"
            style={{
              left: selectionBox.x + panOffset.x,
              top: selectionBox.y + panOffset.y,
              width: selectionBox.width,
              height: selectionBox.height,
              border: '1px dashed #3498db'
            }}
          >
            {selectionSnapshot && (
              <img src={selectionSnapshot} alt="Selection" className="selection-image" draggable={false} />
            )}
          </div>
        )}

        {notes.map(note => (
          <div key={note.id} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100%', height: '100%' }}>
            <Note
                {...note}
                x={note.x + panOffset.x}
                y={note.y + panOffset.y}
                onUpdate={(id, updates) => {
                    if (updates.position) {
                        handleNoteUpdate(id, { ...updates, position: { x: updates.position.x - panOffset.x, y: updates.position.y - panOffset.y } });
                    } else {
                        if(updates.x !== undefined) updates.x -= panOffset.x;
                        if(updates.y !== undefined) updates.y -= panOffset.y;
                        handleNoteUpdate(id, updates);
                    }
                }}
                onRemove={handleNoteDelete}
                selectedNoteId={selectedNoteId}
                setSelectedNoteId={setSelectedNoteId}
                socket={socket}
                tool={tool}
            />
          </div>
        ))}
        
        {textBoxes.map(textBox => (
          <Text
            key={textBox.id}
            {...textBox}
            x={textBox.x + panOffset.x}
            y={textBox.y + panOffset.y}
            tool={tool}
            onUpdate={(id, data) => {
                if (data.x !== undefined) data.x -= panOffset.x;
                if (data.y !== undefined) data.y -= panOffset.y;
                handleTextUpdate(id, data);
            }}
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
            x={emojiData.x + panOffset.x}
            y={emojiData.y + panOffset.y}
            tool={tool}
            selected={selectedEmojiId === emojiData.id}
            onSelect={setSelectedEmojiId}
            onRemove={removeEmoji}
            onUpdate={(id, data) => {
                if (data.x !== undefined) data.x -= panOffset.x;
                if (data.y !== undefined) data.y -= panOffset.y;
                handleEmojiUpdate(id, data);
            }}
          />
        ))}

        {gifs.map(gif => (
          <Gif
            key={gif.id}
            {...gif}
            x={gif.x + panOffset.x}
            y={gif.y + panOffset.y}
            selected={selectedGifId === gif.id}
            onSelect={setSelectedGifId}
            onUpdate={(id, data) => {
                 if (data.x !== undefined) data.x -= panOffset.x;
                 if (data.y !== undefined) data.y -= panOffset.y;
                 handleGifUpdate(id, data);
            }}
            tool={tool}
          />
        ))}

        {images.map(image => (
          <ImageItem
            key={image.id}
            {...image}
            x={image.x + panOffset.x}
            y={image.y + panOffset.y}
            selected={selectedImageId === image.id}
            onSelect={setSelectedImageId}
            onUpdate={(id, data) => {
                 if (data.x !== undefined) data.x -= panOffset.x;
                 if (data.y !== undefined) data.y -= panOffset.y;
                 handleImageUpdate(id, data);
            }}
          />
        ))}

        {shapes.map(shape => {
          const creator = users ? users.find(u => u.id === shape.userId) : null;
          const dynamicColor = creator ? creator.color : (shape.color || '#000000');
          return (
            <Shape
              key={shape.id}
              {...shape}
              x={shape.x + panOffset.x}
              y={shape.y + panOffset.y}
              color={dynamicColor}
              selected={selectedShapeId === shape.id}
              onSelect={setSelectedShapeId}
              onRemove={removeShape}
              onUpdate={(id, data) => {
                 if (data.x !== undefined) data.x -= panOffset.x;
                 if (data.y !== undefined) data.y -= panOffset.y;
                 handleShapeUpdate(id, data);
              }}
              tool={tool}
            />
          );
        })}

        {remoteCursorsArray.map((cursor, index) => (
            <div
                key={cursor.userId || `cursor_${index}`}
                className="remote-cursor"
                style={{
                  position: 'absolute',
                  left: cursor.position.x + panOffset.x,
                  top: cursor.position.y + panOffset.y,
                  pointerEvents: 'none',
                  zIndex: 1000,
                  transition: 'left 0.1s linear, top 0.1s linear'
                }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" style={{ fill: cursor.user?.color || '#ff4444', stroke: 'white', strokeWidth: 2 }}>
                  <path d="M5.5 3.21l10.08 5.31c1.26.66 1.13 2.51-.2 2.98l-3.32 1.17a1 1 0 0 1-.65.25l-3.46.74a1 1 0 0 0-.71.56l-1.24 3.06c-.52 1.28-2.35 1.18-2.7-.15L2.1 4.38c-.2-.77.58-1.5 1.32-1.17H5.5z" />
                </svg>
                <div style={{ position: 'absolute', left: '16px', top: '12px', backgroundColor: cursor.user?.color || '#ff4444', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                  {cursor.user?.name || 'Unknown'}
                </div>
            </div>
        ))}

        <button
          className="background-toggle"
          onClick={toggleBackground}
          title={`Tło: ${backgroundModes.find(mode => mode.id === backgroundMode)?.name}`}
          style={{ pointerEvents: isWorkingTool ? 'none' : 'auto' }}
        >
          {getCurrentBackgroundIcon()}
        </button>

        <button
          className={`chat-toggle ${isChatVisible ? 'active-chat' : ''}`}
          onClick={() => setIsChatVisible(!isChatVisible)}
          title={isChatVisible ? "Ukryj chat" : "Pokaż chat"}
          style={{ pointerEvents: isWorkingTool ? 'none' : 'auto' }}
        >
          {isChatVisible ? "✖" : "💬"}
        </button>

        {isChatVisible && (
          <Chat
            socket={socket}
            whiteboardId={whiteboardId}
            currentUser={currentUser}
            onClose={() => setIsChatVisible(false)}
          />
        )}

      </div>
    </div >
  );
};

export default Canvas;
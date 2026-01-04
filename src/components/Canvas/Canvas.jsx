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
  images: initialImages, // DODANE
  onImageCreate, // DODANE
  onImageUpdate, // DODANE
  onImageDelete, // DODANE
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

  // Images
  const [images, setImages] = useState(initialImages || []);
  const [selectedImageId, setSelectedImageId] = useState(null);

  // Shapes
  const [shapes, setShapes] = useState(initialShapes || []);
  const [selectedShapeId, setSelectedShapeId] = useState(null);

  // Zaznaczenie
  const [selectionBox, setSelectionBox] = useState(null);
  const [selectionStart, setSelectionStart] = useState(null);

  const [selectionSnapshot, setSelectionSnapshot] = useState(null); // Stores the cut image URL
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
    IMAGE_CREATE: 'image_create', // DODANE
    IMAGE_DELETE: 'image_delete', // DODANE
    SHAPE_CREATE: 'shape_create',
    SHAPE_DELETE: 'shape_delete',
    CLEAR_AREA: 'clear_area',
    MASS_DELETE: 'mass_delete' // <--- DODAJ TO
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

  useEffect(() => {
    backgroundModeRef.current = backgroundMode;
    // Wywołaj przerysowanie tła, gdy zmieni się prop backgroundMode
    drawBackground();
  }, [backgroundMode]);



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
      case ACTION_TYPES.IMAGE_CREATE: // DODANE
        setImages(prev => prev.filter(img => img.id !== action.data.image.id));
        if (onImageDelete && action.data.image.id) onImageDelete(action.data.image.id);
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;
      case ACTION_TYPES.IMAGE_DELETE: // DODANE
        setImages(prev => [...prev, action.data.image]);
        if (onImageCreate && action.data.image) onImageCreate(action.data.image);
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
      case ACTION_TYPES.MASS_DELETE:
        if (action.data.notes) setNotes(prev => [...prev, ...action.data.notes]);
        if (action.data.textBoxes) setTextBoxes(prev => [...prev, ...action.data.textBoxes]);
        if (action.data.emojis) setEmojis(prev => [...prev, ...action.data.emojis]);
        if (action.data.gifs) setGifs(prev => [...prev, ...action.data.gifs]);
        if (action.data.images) setImages(prev => [...prev, ...action.data.images]); // DODANE
        if (action.data.shapes) setShapes(prev => [...prev, ...action.data.shapes]);
        redrawCanvas();
        historyRef.current.step = currentStep - 1;
        setHistoryStep(currentStep - 1);
        break;
      // ----------------------------------
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
      case ACTION_TYPES.IMAGE_CREATE: // DODANE
        setImages(prev => [...prev, action.data.image]);
        if (onImageCreate) onImageCreate(action.data.image);
        historyRef.current.step = nextStep;
        setHistoryStep(nextStep);
        break;
      case ACTION_TYPES.IMAGE_DELETE: // DODANE
        setImages(prev => prev.filter(img => img.id !== action.data.image.id));
        if (onImageDelete) onImageDelete(action.data.image.id);
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

      case ACTION_TYPES.MASS_DELETE:
        // Ponownie usuwamy elementy
        const idsToRemove = {
          notes: action.data.notes?.map(x => x.id) || [],
          textBoxes: action.data.textBoxes?.map(x => x.id) || [],
          emojis: action.data.emojis?.map(x => x.id) || [],
          gifs: action.data.gifs?.map(x => x.id) || [],
          images: action.data.images?.map(x => x.id) || [], // DODANE
          shapes: action.data.shapes?.map(x => x.id) || []
        };

        if (idsToRemove.notes.length) setNotes(prev => prev.filter(x => !idsToRemove.notes.includes(x.id)));
        if (idsToRemove.textBoxes.length) setTextBoxes(prev => prev.filter(x => !idsToRemove.textBoxes.includes(x.id)));
        if (idsToRemove.emojis.length) setEmojis(prev => prev.filter(x => !idsToRemove.emojis.includes(x.id)));
        if (idsToRemove.gifs.length) setGifs(prev => prev.filter(x => !idsToRemove.gifs.includes(x.id)));
        if (idsToRemove.images.length) setImages(prev => prev.filter(x => !idsToRemove.images.includes(x.id))); // DODANE
        if (idsToRemove.shapes.length) setShapes(prev => prev.filter(x => !idsToRemove.shapes.includes(x.id)));

        // Dla rysunków nie musimy nic robić, bo stan selectionSnapshot został wyczyszczony przy pierwotnej akcji
        redrawCanvas();

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
    setOriginalCaptureRect(null);
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

  useEffect(() => { setGifs(initialGifs || []); }, [initialGifs]);
  useEffect(() => { setImages(initialImages || []); }, [initialImages]);
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

    switch (backgroundModeRef.current) {
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

  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    let cursorStyle = 'default';

    switch (tool) {
      case 'pencil':
        cursorStyle = 'url("/cursors/pencil.png") 0 32, auto';
        break;
      case 'brush':
        cursorStyle = 'url("/cursors/brush.png") 0 32, auto';
        break;
      case 'eraser':
        cursorStyle = 'url("/cursors/rubber.png") 0 32, auto';
        break;
      case 'pointer':
        cursorStyle = 'pointer';
        break;
      case 'select':
        cursorStyle = 'crosshair';
        break;
      default:
        cursorStyle = 'default';
    }

    canvas.style.cursor = cursorStyle;
  }, [tool]);

  const refreshWhiteboardData = () => {
    if (socket && whiteboardId) {
      console.log("🔄 Requesting whiteboard data on resize...");
      socket.emit('refresh-whiteboard-data', { whiteboardId });
    }
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
      setTimeout(() => {
        refreshWhiteboardData();
      }, 100);
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  // Aktualizuj tło gdy zmieni się tryb
  // useEffect(() => {
  //   drawBackground();
  // }, [backgroundMode]);

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

        const otherUsers = data.users.filter(user => user.id !== currentUser.id);
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
  }, [socket, currentUser]);

  const clearDrawingCanvas = () => {
    const context = drawingContextRef.current;
    const canvas = drawingCanvasRef.current;
    if (!context || !canvas) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawRemote = (data) => {
    const context = drawingContextRef.current;

    // Zabezpieczenie przed brakiem kontekstu
    if (!context) return;

    // 🆕 NOWA CZĘŚĆ: Obsługa wymazywania z historii
    if (data.type === 'erase-area') {
      context.clearRect(data.x, data.y, data.width, data.height);
      return;
    }

    // --- Stara logika rysowania ---
    if (!data.points || data.points.length < 2) return;
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

  const handleImageUpdate = (id, updates) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
    if (onImageUpdate) onImageUpdate(id, updates);
  };

  const getToolSize = () => {
    const base = (typeof size === "object" && size?.[tool]) ? size[tool] : (typeof size === "number" ? size : 3);
    return getDisplaySize(tool, base);
  };

  useEffect(() => {
    // Jeśli zmieniamy narzędzie na jakiekolwiek inne niż 'select'
    if (tool !== 'select') {
      if (selectionSnapshot) {
        // Jeśli mamy "wycięty" obrazek w pamięci (selectionSnapshot),
        // musimy go "przykleić" z powrotem do płótna (commit), żeby nie zniknął.
        commitSelection();
      } else {
        // Jeśli tylko rysowaliśmy ramkę, ale nic nie wycięliśmy -> po prostu czyścimy ramkę
        setSelectionBox(null);
        setSelectionStart(null);
        setOriginalCaptureRect(null);
      }
      // Resetujemy stan przeciągania
      setIsDraggingSelection(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

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

      if (isDraggingSelection) {
        setIsDraggingSelection(false);
        return;
      }

      if (selectionBox) {
        const { x, y, width, height } = selectionBox;

        if (width > 5 && height > 5) {

          if (!selectionSnapshot) {
            const ctx = drawingContextRef.current;

            const imageData = ctx.getImageData(x, y, width, height);
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
    setSelectedNoteId(null); setSelectedTextBoxId(null); setSelectedEmojiId(null); setSelectedGifId(null); setSelectedShapeId(null); setSelectedImageId(null);

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
      if (setActiveEmoji) setActiveEmoji(null);
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
      const newShape = { id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: startX, y: startY, width: defaultWidth, height: defaultHeight, type: activeShape, userId: currentUser.id, color: currentUser.color };
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

  // Obsługa wklejania zdjęć (Ctrl+V ze schowka systemowego)
  useEffect(() => {
    const handlePaste = (e) => {
      // Ignoruj jeśli użytkownik pisze w polu tekstowym
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const items = (e.clipboardData || e.originalEvent.clipboardData).items;

      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          e.preventDefault();
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (event) => {
            const url = event.target.result;
            // Wstawiamy na środku ekranu (lub tam gdzie byłby kursor, ale prościej na środku)
            // Możemy użyć środka widocznego obszaru
            const container = document.querySelector('.canvas-container');
            let centerX = 300;
            let centerY = 300;

            if (container) {
              centerX = container.scrollLeft + container.clientWidth / 2 - 150;
              centerY = container.scrollTop + container.clientHeight / 2 - 100;
            }

            const newImage = {
              id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              x: Math.max(50, centerX),
              y: Math.max(50, centerY),
              url: url,
              width: 300
            };

            if (onImageCreate) onImageCreate(newImage);
          };
          reader.readAsDataURL(blob);
          return; // Znaleziono obrazek, kończymy
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onImageCreate]);

  // Obsługa klawiszy (Delete, Backspace, Ctrl+Z etc.)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      // Ignoruj jeśli użytkownik pisze w polu tekstowym
      if (activeElement && (activeElement.tagName.toLowerCase() === 'input' || activeElement.tagName.toLowerCase() === 'textarea')) return;

      // --- KOPIOWANIE (Ctrl + C) ---
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        let itemToCopy = null;
        let type = null;

        if (selectedNoteId) {
          itemToCopy = notes.find(n => n.id === selectedNoteId);
          type = 'note';
        } else if (selectedTextBoxId) {
          itemToCopy = textBoxes.find(t => t.id === selectedTextBoxId);
          type = 'text';
        } else if (selectedEmojiId) {
          itemToCopy = emojis.find(em => em.id === selectedEmojiId);
          type = 'emoji';
        } else if (selectedGifId) {
          itemToCopy = gifs.find(g => g.id === selectedGifId);
          type = 'gif';
        } else if (selectedImageId) { // DODANE
          itemToCopy = images.find(img => img.id === selectedImageId);
          type = 'image';
        } else if (selectedShapeId) {
          itemToCopy = shapes.find(s => s.id === selectedShapeId);
          type = 'shape';
        }

        if (itemToCopy) {
          setClipboard({ type, data: { ...itemToCopy } }); // Kopiujemy dane
          console.log(`📋 Copied ${type} to clipboard`);
        }
        return;
      }

      // --- WKLEJANIE (Ctrl + V) ---
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (!clipboard) return;

        e.preventDefault(); // ZAPOBIEGAJ podwójnemu wklejaniu (blokuje event 'paste')

        const offset = 20; // Przesunięcie wklejonego elementu
        const newId = `${clipboard.type}_${Date.now()}_copy_${Math.random().toString(36).substr(2, 5)}`;

        // Tworzymy nowy obiekt z nowym ID i przesuniętą pozycją
        const newItem = {
          ...clipboard.data,
          id: newId,
          x: clipboard.data.x + offset,
          y: clipboard.data.y + offset
        };

        switch (clipboard.type) {
          case 'note':
            setNotes(prev => [...prev, newItem]);
            if (onNoteCreate) onNoteCreate(newItem); // Wyślij do serwera (używamy istniejących handlerów)
            saveToHistory(ACTION_TYPES.NOTE_CREATE, { note: newItem });
            setSelectedNoteId(newId); // Zaznacz nowy element
            break;

          case 'text':
            setTextBoxes(prev => [...prev, newItem]);
            if (socket) socket.emit('text-create', { whiteboardId, textBox: newItem });
            saveToHistory(ACTION_TYPES.TEXT_CREATE, { textBox: newItem });
            setSelectedTextBoxId(newId);
            break;

          case 'emoji':
            setEmojis(prev => [...prev, newItem]);
            if (onEmojiCreate) onEmojiCreate(newItem);
            saveToHistory(ACTION_TYPES.EMOJI_CREATE, { emoji: newItem });
            setSelectedEmojiId(newId);
            break;

          case 'gif':
            setGifs(prev => [...prev, newItem]);
            if (onGifCreate) onGifCreate(newItem);
            saveToHistory(ACTION_TYPES.GIF_CREATE, { gif: newItem });
            setSelectedGifId(newId);
            break;

          case 'image': // DODANE
            setImages(prev => [...prev, newItem]);
            if (onImageCreate) onImageCreate(newItem);
            saveToHistory(ACTION_TYPES.IMAGE_CREATE, { image: newItem });
            setSelectedImageId(newId);
            break;

          case 'shape':
            setShapes(prev => [...prev, newItem]);
            if (onShapeCreate) onShapeCreate(newItem);
            saveToHistory(ACTION_TYPES.SHAPE_CREATE, { shape: newItem });
            setSelectedShapeId(newId);
            break;

          default:
            break;
        }
        return;
      }

      // --- USUWANIE (Delete / Backspace) ---
      if (e.key === 'Backspace' || e.key === 'Delete') {

        // ... (tutaj wklej całą istniejącą logikę usuwania obszarowego i pojedynczego, którą już miałeś w kodzie) ...
        // PONIŻEJ WKLEJAM SKRÓCONĄ WERSJĘ TWOJEGO ORYGINALNEGO KODU USUWANIA DLA KONTEKSTU:

        if (selectionBox) {
          e.preventDefault();
          // ... (Twoja logika usuwania grupowego) ...
          // Tu była logika z ACTION_TYPES.MASS_DELETE itd.
          // Skopiuj to ze swojego starego pliku, nic tu nie zmieniałem w logice.

          // A. ZNAJDŹ WSZYSTKIE ELEMENTY DO USUNIĘCIA
          const isInsideSelection = (objX, objY, objW, objH) => {
            return (
              objX < selectionBox.x + selectionBox.width &&
              objX + objW > selectionBox.x &&
              objY < selectionBox.y + selectionBox.height &&
              objY + objH > selectionBox.y
            );
          };

          const notesToDelete = notes.filter(n => isInsideSelection(n.x, n.y, n.width, n.height));
          const textsToDelete = textBoxes.filter(t => isInsideSelection(t.x, t.y, t.width, t.height));
          const emojisToDelete = emojis.filter(e => isInsideSelection(e.x, e.y, e.size || 48, e.size || 48));
          const gifsToDelete = gifs.filter(g => isInsideSelection(g.x, g.y, g.width || 150, g.width || 150));
          const imagesToDelete = images.filter(img => isInsideSelection(img.x, img.y, img.width || 200, 100)); // DODANE - przybliżona wysokość
          const shapesToDelete = shapes.filter(s => isInsideSelection(s.x, s.y, s.width || 100, Math.max(s.height || 100, 10)));

          if (notesToDelete.length > 0 || textsToDelete.length > 0 || emojisToDelete.length > 0 || gifsToDelete.length > 0 || imagesToDelete.length > 0 || shapesToDelete.length > 0 || selectionSnapshot) {
            saveToHistory(ACTION_TYPES.MASS_DELETE, {
              notes: notesToDelete,
              textBoxes: textsToDelete,
              emojis: emojisToDelete,
              gifs: gifsToDelete,
              images: imagesToDelete, // DODANE
              shapes: shapesToDelete,
              wasSnapshotDeleted: !!selectionSnapshot
            });
          }

          if (selectionSnapshot && originalCaptureRect && socket) {
            socket.emit('erase-area', { whiteboardId, x: originalCaptureRect.x, y: originalCaptureRect.y, width: originalCaptureRect.width, height: originalCaptureRect.height });
          }

          if (notesToDelete.length) { setNotes(prev => prev.filter(n => !notesToDelete.some(del => del.id === n.id))); notesToDelete.forEach(n => socket && socket.emit('note-delete', { whiteboardId, id: n.id })); }
          if (textsToDelete.length) { setTextBoxes(prev => prev.filter(t => !textsToDelete.some(del => del.id === t.id))); textsToDelete.forEach(t => socket && socket.emit('text-delete', { whiteboardId, id: t.id })); }
          if (emojisToDelete.length) { setEmojis(prev => prev.filter(e => !emojisToDelete.some(del => del.id === e.id))); emojisToDelete.forEach(e => socket && socket.emit('emoji-delete', { whiteboardId, id: e.id })); }
          if (gifsToDelete.length) { setGifs(prev => prev.filter(g => !gifsToDelete.some(del => del.id === g.id))); gifsToDelete.forEach(g => socket && socket.emit('gif-delete', { whiteboardId, id: g.id })); }
          if (imagesToDelete.length) { setImages(prev => prev.filter(img => !imagesToDelete.some(del => del.id === img.id))); imagesToDelete.forEach(img => socket && socket.emit('image-delete', { whiteboardId, id: img.id })); } // DODANE
          if (shapesToDelete.length) { setShapes(prev => prev.filter(s => !shapesToDelete.some(del => del.id === s.id))); shapesToDelete.forEach(s => socket && socket.emit('shape-delete', { whiteboardId, id: s.id })); }

          setSelectionSnapshot(null);
          setSelectionBox(null);
          setOriginalCaptureRect(null);
          return;
        }

        // Usuwanie pojedyncze
        if (selectedNoteId) removeNote(selectedNoteId);
        if (selectedTextBoxId) removeTextBox(selectedTextBoxId);
        if (selectedEmojiId) removeEmoji(selectedEmojiId);
        if (selectedGifId) removeGif(selectedGifId);
        if (selectedImageId) removeImage(selectedImageId); // DODANE
        if (selectedShapeId) removeShape(selectedShapeId);
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    // 🔹 WAŻNE: Dodaj 'clipboard' do tablicy zależności
    notes, textBoxes, emojis, gifs, shapes,
    selectedNoteId, selectedTextBoxId, selectedEmojiId, selectedGifId, selectedShapeId,
    selectionBox, selectionSnapshot,
    undo, redo, clipboard
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
      const handleImageUpdateSocket = (data) => setImages(prev => prev.map(img => img.id === data.id ? { ...img, ...data } : img)); // DODANE
      const handleShapeUpdate = (data) => setShapes(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));

      const handleEmojiCreateSocket = (data) => setEmojis(prev => prev.some(e => e.id === data.emoji.id) ? prev : [...prev, data.emoji]);
      const handleEmojiDeleteSocket = (data) => setEmojis(prev => prev.filter(e => e.id !== data.id));
      const handleGifCreateSocket = (data) => setGifs(prev => prev.some(g => g.id === data.gif.id) ? prev : [...prev, data.gif]);
      const handleGifDeleteSocket = (data) => setGifs(prev => prev.filter(g => g.id !== data.id));
      const handleImageCreateSocket = (data) => setImages(prev => prev.some(img => img.id === data.image.id) ? prev : [...prev, data.image]); // DODANE
      const handleImageDeleteSocket = (data) => setImages(prev => prev.filter(img => img.id !== data.id)); // DODANE
      const handleShapeCreateSocket = (data) => setShapes(prev => prev.some(s => s.id === data.shape.id) ? prev : [...prev, data.shape]);
      const handleShapeDeleteSocket = (data) => setShapes(prev => prev.filter(s => s.id !== data.id));

      socket.on('note-create', handleNoteCreate);
      socket.on('note-update', handleNoteUpdate);
      socket.on('note-delete', handleNoteDelete);
      socket.on('emoji-update', handleEmojiUpdate);
      socket.on('gif-update', handleGifUpdate);
      socket.on('image-update', handleImageUpdateSocket); // DODANE
      socket.on('shape-update', handleShapeUpdate);
      socket.on('emoji-create', handleEmojiCreateSocket);
      socket.on('emoji-delete', handleEmojiDeleteSocket);
      socket.on('gif-create', handleGifCreateSocket);
      socket.on('gif-delete', handleGifDeleteSocket);
      socket.on('image-create', handleImageCreateSocket); // DODANE
      socket.on('image-delete', handleImageDeleteSocket); // DODANE
      socket.on('shape-create', handleShapeCreateSocket);
      socket.on('shape-delete', handleShapeDeleteSocket);

      return () => {
        socket.off('note-create', handleNoteCreate);
        socket.off('note-update', handleNoteUpdate);
        socket.off('note-delete', handleNoteDelete);
        socket.off('emoji-update', handleEmojiUpdate);
        socket.off('gif-update', handleGifUpdate);
        socket.off('image-update', handleImageUpdateSocket); // DODANE
        socket.off('shape-update', handleShapeUpdate);
        socket.off('emoji-create', handleEmojiCreateSocket);
        socket.off('emoji-delete', handleEmojiDeleteSocket);
        socket.off('gif-create', handleGifCreateSocket);
        socket.off('gif-delete', handleGifDeleteSocket);
        socket.off('image-create', handleImageCreateSocket); // DODANE
        socket.off('image-delete', handleImageDeleteSocket); // DODANE
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
    const newMode = backgroundModes[nextIndex].id;

    // Wywołujemy funkcję z rodzica (Routera)
    if (onBackgroundChange) {
      onBackgroundChange(newMode);
    }
  };

  const getCurrentBackgroundIcon = () => backgroundModes.find(mode => mode.id === backgroundMode)?.icon;

  const handleMouseLeave = () => {
    // Usuń linię ustawiającą cursor = 'default'
    stopDrawing();
  };

  const handleMouseEnter = () => {
    // Usuń linię ustawiającą cursor = 'pointer'
    // Kursor zostanie obsłużony przez powyższy useEffect na podstawie aktualnego 'tool'
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
  //const dynamicColor = creator ? creator.color : '#000000';

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
            tool={tool}
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
            tool={tool}
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
            tool={tool}
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
            tool={tool}
          />
        ))}
        {images.map(image => (
          <ImageItem
            key={image.id}
            {...image}
            selected={selectedImageId === image.id}
            onSelect={setSelectedImageId}
            onUpdate={handleImageUpdate}
          />
        ))}

        {shapes.map(shape => {
          // 1. Najpierw szukamy "żywego" użytkownika na liście online
          const creator = users ? users.find(u => u.id === shape.userId) : null;

          // 2. LOGIKA PRIORYTETÓW (To jest kluczowa zmiana):
          // - Jeśli user jest online (creator istnieje) -> weź jego AKTUALNY kolor (dynamiczny)
          // - Jeśli usera nie ma (offline) -> weź kolor zapisany w kształcie (shape.color)
          // - Jeśli nic nie ma -> czarny
          const dynamicColor = creator ? creator.color : (shape.color || '#000000');

          return (
            <Shape
              key={shape.id}
              {...shape}
              color={dynamicColor} // Przekazujemy ten dynamicznie wyliczony kolor
              selected={selectedShapeId === shape.id}
              onSelect={setSelectedShapeId}
              onRemove={removeShape}
              onUpdate={handleShapeUpdate}
              tool={tool}
            />
          );
        })}

        {remoteCursorsArray.map((cursor, index) => {
          // Pobierz dane usera z obiektu kursora
          const userName = cursor.user?.name || 'Unknown';
          const userColor = cursor.user?.color || '#ff4444';

          return (
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
                  transition: 'left 0.1s linear, top 0.1s linear' // Płynne przesuwanie
                }}
              >
                {/* Ikona kursora (kropka) */}
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: 'translate(-2px, -2px)', // Lekka korekta, by grot był w punkcie (x,y)
                    fill: userColor,
                    stroke: 'white',
                    strokeWidth: 2,
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
                  }}
                >
                  <path d="M5.5 3.21l10.08 5.31c1.26.66 1.13 2.51-.2 2.98l-3.32 1.17a1 1 0 0 1-.65.25l-3.46.74a1 1 0 0 0-.71.56l-1.24 3.06c-.52 1.28-2.35 1.18-2.7-.15L2.1 4.38c-.2-.77.58-1.5 1.32-1.17H5.5z" />
                </svg>

                {/* Etykieta z nazwą */}
                <div style={{
                  position: 'absolute',
                  left: '16px', // Odsunięcie od grota kursora
                  top: '12px',
                  backgroundColor: userColor,
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  border: '2px solid white',
                  pointerEvents: 'none'
                }}>
                  {userName}
                </div>
              </div>
            )
          );
        })}

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

        {/* CHAT */}
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
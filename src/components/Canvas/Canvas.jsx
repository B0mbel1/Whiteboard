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
const WORLD_LIMIT = 2500; //wczesniej 1500
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.5;

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
  onTextCreate,
  onTextUpdate,
  onTextDelete,
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
  panOffset,
  setPanOffset
}) => {
  const [remoteCursors, setRemoteCursors] = useState(new Map());
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // 🔹 Stan Zoomu
  const [zoom, setZoom] = useState(1);

  const backgroundModeRef = useRef(backgroundMode);
  const currentMousePosRef = useRef({ x: 0, y: 0 });

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

  const localDrawingsRef = useRef([]);

  // --- STANY DO PANNINGU (PRZESUWANIA) ---
  const panOffsetRef = useRef(panOffset);
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

  const remoteDrawingsRef = useRef([]);

  useEffect(() => { setShapes(initialShapes || []); }, [initialShapes]);

  // --- Synchronizacja panOffsetRef ---
  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  // --- 🔹 DODANO OBSŁUGĘ ZOOMOWANIA (Wheel) ---
  const handleWheel = (e) => {
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Oblicz punkt w świecie przed zoomem
    const worldX = (mouseX - panOffset.x) / zoom;
    const worldY = (mouseY - panOffset.y) / zoom;

    // Oblicz nowy zoom
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(zoom + delta, MIN_ZOOM), MAX_ZOOM);

    // Oblicz nowy panOffset, aby punkt pod myszką pozostał w tym samym miejscu
    const newPanX = mouseX - (worldX * newZoom);
    const newPanY = mouseY - (worldY * newZoom);

    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  // --- OBSŁUGA KLAWISZA SPACJI ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) return;
        setIsSpacePressed(true);
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

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;

    // getCanvasCoordinates zwraca już współrzędne ŚWIATA (uwzględniając zoom i pan)
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const url = event.target.result;

            // Ustalamy domyślne wymiary (zgodnie z Twoim kodem width=300)
            const defaultWidth = 300;
            const defaultHeight = 200; // Zakładamy przybliżoną wysokość do centrowania

            // 1. Obliczamy pozycję lewego górnego rogu (centrujemy obrazek na kursore)
            let finalX = x - (defaultWidth / 2);
            let finalY = y - (defaultHeight / 2);

            // 2. --- 🔹 LOGIKA OGRANICZEŃ (CLAMP) 🔹 ---

            // A. Sprawdzamy lewą i górną granicę (-WORLD_LIMIT)
            // Jeśli wychodzi poza -2500, ustawiamy na -2500
            finalX = Math.max(-WORLD_LIMIT, finalX);
            finalY = Math.max(-WORLD_LIMIT, finalY);

            // B. Sprawdzamy prawą i dolną granicę (WORLD_LIMIT)
            // Jeśli pozycja + szerokość wychodzi poza 2500, cofamy pozycję
            if (finalX + defaultWidth > WORLD_LIMIT) {
              finalX = WORLD_LIMIT - defaultWidth;
            }
            if (finalY + defaultHeight > WORLD_LIMIT) {
              finalY = WORLD_LIMIT - defaultHeight;
            }

            const newImage = {
              id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              x: finalX,
              y: finalY,
              url: url,
              width: defaultWidth
            };

            if (onImageCreate) onImageCreate(newImage);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  useEffect(() => {
    backgroundModeRef.current = backgroundMode;
    drawBackground();
  }, [backgroundMode]);

  const commitSelection = () => {
    if (!selectionSnapshot || !selectionBox) return;

    const ctx = drawingContextRef.current;
    const img = new Image();
    img.onload = () => {
      setupDrawingContext();
      // Rysujemy obrazek na canvasie, który już ma transform (zoom/pan)
      ctx.drawImage(img, selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    };
    img.src = selectionSnapshot;

    setSelectionSnapshot(null);
    setSelectionBox(null);
    setOriginalCaptureRect(null);
  };

  const redrawCanvas = () => {
    const context = drawingContextRef.current;
    if (!context) return;

    // Reset transformacji do czyszczenia
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);

    // Przywróć transformację zoom/pan
    setupDrawingContext();

    // 2. Przygotuj listę operacji (Remote + Local)
    let allOperations = [];

    // A. Remote
    if (remoteDrawingsRef.current && remoteDrawingsRef.current.length > 0) {
      allOperations = [...remoteDrawingsRef.current];
    }

    // B. Local
    if (localDrawingsRef.current && localDrawingsRef.current.length > 0) {
      allOperations = [...allOperations, ...localDrawingsRef.current];
    }

    // 3. Sortuj chronologicznie
    allOperations.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // 4. Rysuj
    allOperations.forEach(op => {
      if (op.type === 'erase-area') {
        context.clearRect(op.x, op.y, op.width, op.height);
      } else {
        if (op.points && op.points.length > 1) {
          drawCompletePath(context, op.tool, op.color, op.size, op.points);
        }
      }
    });
  };

  // Funkcje usuwania
  const removeShape = (id) => {
    const shapeToDelete = shapes.find(s => s.id === id);
    if (shapeToDelete) {
      setShapes(prev => prev.filter(s => s.id !== id));
      if (selectedShapeId === id) setSelectedShapeId(null);
      if (onShapeDelete) onShapeDelete(id);
    }
  };

  const removeGif = (id) => {
    const gifToDelete = gifs.find(g => g.id === id);
    if (gifToDelete) {
      setGifs(prev => prev.filter(g => g.id !== id));
      if (selectedGifId === id) setSelectedGifId(null);
      if (onGifDelete) onGifDelete(id);
    }
  };

  const removeImage = (id) => {
    const imageToDelete = images.find(img => img.id === id);
    if (imageToDelete) {
      setImages(prev => prev.filter(img => img.id !== id));
      if (selectedImageId === id) setSelectedImageId(null);
      if (onImageDelete) onImageDelete(id);
    }
  };

  const removeEmoji = (id) => {
    const emojiToDelete = emojis.find(e => e.id === id);
    if (emojiToDelete) {
      setEmojis(prev => prev.filter(e => e.id !== id));
      if (selectedEmojiId === id) setSelectedEmojiId(null);
      if (onEmojiDelete) onEmojiDelete(id);
    }
  };

  useEffect(() => { setGifs(initialGifs || []); }, [initialGifs]);
  useEffect(() => { setImages(initialImages || []); }, [initialImages]);
  useEffect(() => { setEmojis(initialEmojis || []); }, [initialEmojis]);
  useEffect(() => { setTextBoxes(initialTextBoxes || []); }, [initialTextBoxes]);
  useEffect(() => { setNotes(initialNotes || []); }, [initialNotes]);

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

    context.fillStyle = '#e5e5e5';
    context.fillRect(0, 0, width, height);

    context.save();
    // Tło również musi uwzględniać zoom
    context.translate(panOffsetRef.current.x, panOffsetRef.current.y);
    context.scale(zoom, zoom);

    const areaStart = -WORLD_LIMIT;
    const areaSize = WORLD_LIMIT * 2;

    context.shadowColor = 'rgba(0, 0, 0, 0.2)';
    context.shadowBlur = 20;

    // Dostosuj grubość linii do zoomu, aby nie znikały
    const lineWidth = 1 / zoom;

    switch (backgroundModeRef.current) {
      case 'white':
        context.fillStyle = 'white';
        context.fillRect(areaStart, areaStart, areaSize, areaSize);
        break;

      case 'grid':
        context.fillStyle = '#f0f0f0';
        context.fillRect(areaStart, areaStart, areaSize, areaSize);
        context.shadowColor = 'transparent';
        context.strokeStyle = '#d0d0d0';
        context.lineWidth = lineWidth;
        context.beginPath();
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
        context.strokeStyle = '#e0e0e0';
        context.lineWidth = lineWidth;
        const lineSpacing = 24;
        context.beginPath();
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

  useEffect(() => {
    if (!socket) return;
    const handleNewMessageNotification = (data) => {
      if (data && data.whiteboardId === whiteboardId && !isChatVisible) {
        setHasUnreadMessages(true);
      }
    };
    socket.on('chat-message', handleNewMessageNotification);
    return () => {
      socket.off('chat-message', handleNewMessageNotification);
    };
  }, [socket, whiteboardId, isChatVisible]);

  useEffect(() => {
    drawBackground();
    redrawCanvas();
  }, [panOffset, zoom]); // Dodano zoom do zależności

  const setupDrawingContext = () => {
    const ctx = drawingContextRef.current;
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = getToolSize();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

    // 🔹 POPRAWKA: setTransform(a, b, c, d, e, f) ustawia zarówno skalę jak i translację.
    // Usunięto nadmiarowe ctx.translate(), które powodowało podwójny offset.
    ctx.setTransform(zoom, 0, 0, zoom, panOffsetRef.current.x, panOffsetRef.current.y);
  };

  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    let cursorStyle = 'default';
    switch (tool) {
      case 'pencil': cursorStyle = 'url("/cursors/pencil.png") 0 32, auto'; break;
      case 'brush': cursorStyle = 'url("/cursors/brush.png") 0 32, auto'; break;
      case 'eraser': cursorStyle = 'url("/cursors/rubber.png") 0 32, auto'; break;
      case 'pointer': cursorStyle = 'pointer'; break;
      case 'select': cursorStyle = 'crosshair'; break;
      default: cursorStyle = 'default';
    }
    canvas.style.cursor = cursorStyle;
  }, [tool]);

  const refreshWhiteboardData = () => {
    if (socket && whiteboardId) {
      console.log("🔄 Requesting whiteboard data on resize...");
      socket.emit('refresh-whiteboard-data', { whiteboardId });
    }
  };

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

  useEffect(() => {
    setupDrawingContext();
  }, [color, size, tool, panOffset, zoom]);

  useEffect(() => {
    if (socket) {
      const handleRemoteDrawing = (data) => {
        remoteDrawingsRef.current.push(data);
        drawRemote(data);
      };

      const handleEraseArea = (data) => {
        remoteDrawingsRef.current.push({ ...data, type: 'erase-area' });
        const ctx = drawingContextRef.current;
        if (ctx) {
          setupDrawingContext();
          ctx.clearRect(data.x, data.y, data.width, data.height);
        }
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
        remoteDrawingsRef.current = data.drawingData || [];
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


  const clearDrawingCanvas = () => {
    const context = drawingContextRef.current;
    const canvas = drawingCanvasRef.current;
    if (!context || !canvas) return;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    setupDrawingContext();
  };

  const drawRemote = (data) => {
    if (!data) return;
    const context = drawingContextRef.current;
    if (!context) return;

    if (data.type === 'erase-area') {
      context.clearRect(data.x, data.y, data.width, data.height);
      return;
    }
    if (!data.points || data.points.length < 2) return;
    drawCompletePath(context, data.tool, data.color, data.size, data.points);
  };

  // 🔹 WSPÓŁRZĘDNE Z UWZGLĘDNIENIEM ZOOMU
  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = drawingCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Wzór: (ScreenPos - Pan) / Zoom
    return {
      x: (clientX - rect.left - panOffsetRef.current.x) / zoom,
      y: (clientY - rect.top - panOffsetRef.current.y) / zoom
    };
  };

  const getWorldFromScreen = (screenX, screenY) => {
    return {
      x: (screenX - panOffset.x) / zoom,
      y: (screenY - panOffset.y) / zoom
    };
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
    if (tool !== 'select') {
      if (selectionSnapshot) {
        commitSelection();
      } else {
        setSelectionBox(null);
        setSelectionStart(null);
        setOriginalCaptureRect(null);
      }
      setIsDraggingSelection(false);
    }
  }, [tool]);

  const startDrawing = ({ nativeEvent }) => {
    if (nativeEvent.button === 2) {
      setIsPanning(true);
      lastMousePosRef.current = { x: nativeEvent.clientX, y: nativeEvent.clientY };
      return;
    }

    if (nativeEvent.button !== 0) return;

    const { x, y } = getCanvasCoordinates(nativeEvent.clientX, nativeEvent.clientY);
    if (!isWithinBounds(x, y)) return;

    if (tool === 'select') {
      if (selectionBox &&
        x >= selectionBox.x && x <= selectionBox.x + selectionBox.width &&
        y >= selectionBox.y && y <= selectionBox.y + selectionBox.height) {

        setIsDraggingSelection(true);
        setDragOffset({ x: x - selectionBox.x, y: y - selectionBox.y });
        return;
      }
      if (selectionSnapshot) { commitSelection(); }
      else if (selectionBox) { setSelectionBox(null); }

      setSelectionStart({ x, y });
      setSelectionBox({ x, y, width: 0, height: 0 });
      setIsDrawing(true);
      return;
    }

    if (!['pencil', 'brush', 'eraser'].includes(tool)) return;

    if (setShowColorPicker) setShowColorPicker(false);
    const ctx = drawingContextRef.current;
    setupDrawingContext();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsDrawing(true);

    currentDrawingRef.current = {
      tool,
      color,
      size,
      points: [{ x, y }, { x, y }],
      timestamp: Date.now()
    };
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
            // Przeliczenie współrzędnych bitmapy dla getImageData jest skomplikowane przy zoomie.
            // getImageData pobiera piksele ekranowe (jeśli canvas nie jest skalowany przez CSS).
            // Używamy tutaj transformacji canvasa, więc współrzędne x, y są w świecie.
            // Niestety getImageData ignoruje transformacje kontekstu.
            // Aby to działało idealnie z zoomem, należy przeliczyć x/y na ekranowe.

            // Tymczasowe uproszczenie: Pobieramy obszar "świata", ale uwzględniając offsety
            // UWAGA: To narzędzie w trybie Zoom może wymagać głębszej refaktoryzacji "Select tool".
            // Dla prostego "wytnij/wklej" przy zoom=1 działa, przy zoom!=1 może być przesunięcie.

            // Próba naprawy dla Zoom:
            // Musimy wiedzieć gdzie fizycznie na canvasie (piksele) jest ten obszar.
            // ScreenX = WorldX * Zoom + PanX
            const screenX = x * zoom + panOffset.x;
            const screenY = y * zoom + panOffset.y;
            const screenW = width * zoom;
            const screenH = height * zoom;

            const imageData = ctx.getImageData(screenX, screenY, screenW, screenH);
            ctx.clearRect(x, y, width, height);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = screenW;
            tempCanvas.height = screenH;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);

            const capturedImage = tempCanvas.toDataURL();
            setSelectionSnapshot(capturedImage);
            setOriginalCaptureRect({ x, y, width, height });
          }
        } else {
          if (!selectionSnapshot) { setSelectionBox(null); }
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
      localDrawingsRef.current.push(currentDrawingRef.current);
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

  const handleShapeUpdate = (id, newProps) => {
    setShapes(prev => prev.map(shape => shape.id === id ? { ...shape, ...newProps } : shape));
    if (onShapeUpdate) onShapeUpdate(id, newProps);
  };

  const clampCreationPos = (x, y, w, h) => {
    const safeX = Math.max(-WORLD_LIMIT, Math.min(x, WORLD_LIMIT - w));
    const safeY = Math.max(-WORLD_LIMIT, Math.min(y, WORLD_LIMIT - h));
    return { x: safeX, y: safeY };
  };

  const handleCanvasClick = (e) => {
    if (isPanning) return;
    if (e.button !== 0) return;
    if (e.target.closest('.shape-item') || e.target.closest('.emoji-item')) return;
    setSelectedNoteId(null); setSelectedTextBoxId(null); setSelectedEmojiId(null); setSelectedGifId(null); setSelectedShapeId(null); setSelectedImageId(null);

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    if (!isWithinBounds(x, y)) return;

    if (tool === 'notes') {
      const w = 180, h = 120;
      const { x: safeX, y: safeY } = clampCreationPos(x, y, w, h);
      const newNote = { id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: safeX, y: safeY, text: '', width: w, height: h };
      setNotes(prev => prev.some(note => note.id === newNote.id) ? prev : [...prev, newNote]);
      if (onNoteCreate) onNoteCreate(newNote);
      if (setTool) setTool('cursor');
    } else if (tool === 'text') {
      const w = 200, h = 100;
      const { x: safeX, y: safeY } = clampCreationPos(x, y, w, h);
      const newTextBox = { id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: safeX, y: safeY, text: '', width: w, height: h };
      if (onTextCreate) onTextCreate(newTextBox);
      setTextBoxes(prev => [...prev, newTextBox]);
      if (socket) socket.emit('text-create', { whiteboardId, textBox: newTextBox });
      if (setTool) setTool('cursor');
    }

    if (tool === 'emoji' && activeEmoji) {
      const size = 48;
      const half = size / 2;
      const safeX = Math.max(-WORLD_LIMIT + half, Math.min(x, WORLD_LIMIT - half));
      const safeY = Math.max(-WORLD_LIMIT + half, Math.min(y, WORLD_LIMIT - half));

      const newEmoji = { id: `emoji_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: safeX, y: safeY, emoji: activeEmoji, size: size };
      setEmojis(prev => [...prev, newEmoji]);
      if (onEmojiCreate) onEmojiCreate(newEmoji);
      if (setTool) setTool('cursor');
      if (setActiveEmoji) setActiveEmoji(null);
    }

    if (tool === 'gif' && activeGif) {
      const w = 150;
      const rawX = x - (w / 2);
      const rawY = y - (w / 2);
      const { x: safeX, y: safeY } = clampCreationPos(rawX, rawY, w, w);

      const newGif = { id: `gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: safeX, y: safeY, url: activeGif, width: w };
      setGifs(prev => [...prev, newGif]);
      if (onGifCreate) onGifCreate(newGif);
      if (setTool) setTool('cursor');
    }
    if (tool === 'shape' && activeShape) {
      let defaultWidth = 100, defaultHeight = 100;
      let startX = x - 50, startY = y - 50;

      if (activeShape === 'arrow') {
        startX = x; startY = y; defaultWidth = 150; defaultHeight = 50;
      }

      const { x: safeX, y: safeY } = clampCreationPos(startX, startY, defaultWidth, defaultHeight);
      const newShape = { id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: safeX, y: safeY, width: defaultWidth, height: defaultHeight, type: activeShape, userId: currentUser.id, color: currentUser.color };
      setShapes(prev => [...prev, newShape]);
      if (onShapeCreate) onShapeCreate(newShape);
      if (setTool) setTool('cursor');
    }
  };

  const removeNote = (id) => {
    const noteToDelete = notes.find(note => note.id === id);
    if (noteToDelete) {
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
    if (onNoteUpdate) { onNoteUpdate(id, updates); }
  };

  const handleNoteDelete = (id) => { removeNote(id); };

  const handleTextUpdate = (id, updates) => {
    if (onTextUpdate) { onTextUpdate(id, updates); }
  };

  const removeTextBox = (id) => {
    if (onTextDelete) { onTextDelete(id); setSelectedTextBoxId(null); }
  };

  // W pliku Canvas.jsx

  useEffect(() => {
    const handlePaste = (e) => {
      // Ignorujemy wklejanie w inputach/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const items = (e.clipboardData || e.originalEvent.clipboardData).items;

      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          e.preventDefault();
          const blob = item.getAsFile();
          const reader = new FileReader();

          reader.onload = (event) => {
            const url = event.target.result;

            // Pobieramy pozycję myszki lub środek ekranu
            const mouseX = currentMousePosRef.current.x || (window.innerWidth / 2);
            const mouseY = currentMousePosRef.current.y || (window.innerHeight / 2);

            // 1. Obliczamy pozycję w świecie (World Coordinates)
            let worldX = (mouseX - panOffset.x) / zoom;
            let worldY = (mouseY - panOffset.y) / zoom;

            // 2. Szacujemy wymiary obrazka (domyślnie ImageItem ma 200px szerokości, zakładamy kwadrat dla bezpieczeństwa)
            const estimatedWidth = 200;
            const estimatedHeight = 200;

            // 3. LOGIKA OGRANICZEŃ (CLAMP)
            // Sprawdzamy lewą i górną krawędź
            if (worldX < -WORLD_LIMIT) worldX = -WORLD_LIMIT;
            if (worldY < -WORLD_LIMIT) worldY = -WORLD_LIMIT;

            // Sprawdzamy prawą i dolną krawędź
            if (worldX + estimatedWidth > WORLD_LIMIT) {
              worldX = WORLD_LIMIT - estimatedWidth;
            }
            if (worldY + estimatedHeight > WORLD_LIMIT) {
              worldY = WORLD_LIMIT - estimatedHeight;
            }

            // 4. Tworzymy obiekt z bezpiecznymi współrzędnymi
            const newImage = {
              id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              x: worldX, // Zapisujemy współrzędne ŚWIATA
              y: worldY,
              url: url,
              width: estimatedWidth
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
  }, [onImageCreate, panOffset, zoom]); // Dodano zależności panOffset i zoom

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName.toLowerCase() === 'input' || activeElement.tagName.toLowerCase() === 'textarea')) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        let itemToCopy = null;
        let type = null;

        if (selectedNoteId) { itemToCopy = notes.find(n => n.id === selectedNoteId); type = 'note'; }
        else if (selectedTextBoxId) { itemToCopy = textBoxes.find(t => t.id === selectedTextBoxId); type = 'text'; }
        else if (selectedEmojiId) { itemToCopy = emojis.find(em => em.id === selectedEmojiId); type = 'emoji'; }
        else if (selectedGifId) { itemToCopy = gifs.find(g => g.id === selectedGifId); type = 'gif'; }
        else if (selectedImageId) { itemToCopy = images.find(img => img.id === selectedImageId); type = 'image'; }
        else if (selectedShapeId) { itemToCopy = shapes.find(s => s.id === selectedShapeId); type = 'shape'; }

        if (itemToCopy) {
          setClipboard({ type, data: { ...itemToCopy } });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (!clipboard) return;
        e.preventDefault();
        const offset = 20;
        const newId = `${clipboard.type}_${Date.now()}_copy_${Math.random().toString(36).substr(2, 5)}`;
        const newItem = { ...clipboard.data, id: newId, x: clipboard.data.x + offset, y: clipboard.data.y + offset };

        switch (clipboard.type) {
          case 'note': setNotes(prev => [...prev, newItem]); if (onNoteCreate) onNoteCreate(newItem); setSelectedNoteId(newId); break;
          case 'text': setTextBoxes(prev => [...prev, newItem]); if (socket) socket.emit('text-create', { whiteboardId, textBox: newItem }); setSelectedTextBoxId(newId); break;
          case 'emoji': setEmojis(prev => [...prev, newItem]); if (onEmojiCreate) onEmojiCreate(newItem); setSelectedEmojiId(newId); break;
          case 'gif': setGifs(prev => [...prev, newItem]); if (onGifCreate) onGifCreate(newItem); setSelectedGifId(newId); break;
          case 'image': setImages(prev => [...prev, newItem]); if (onImageCreate) onImageCreate(newItem); setSelectedImageId(newId); break;
          case 'shape': setShapes(prev => [...prev, newItem]); if (onShapeCreate) onShapeCreate(newItem); setSelectedShapeId(newId); break;
          default: break;
        }
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectionBox) {
          e.preventDefault();
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
          const imagesToDelete = images.filter(img => isInsideSelection(img.x, img.y, img.width || 200, 100));
          const shapesToDelete = shapes.filter(s => isInsideSelection(s.x, s.y, s.width || 100, Math.max(s.height || 100, 10)));

          if (selectionSnapshot && originalCaptureRect) {
            if (socket) {
              socket.emit('erase-area', {
                whiteboardId,
                x: originalCaptureRect.x,
                y: originalCaptureRect.y,
                width: originalCaptureRect.width,
                height: originalCaptureRect.height,
                timestamp: Date.now()
              });
            }
            localDrawingsRef.current.push({
              type: 'erase-area',
              x: originalCaptureRect.x,
              y: originalCaptureRect.y,
              width: originalCaptureRect.width,
              height: originalCaptureRect.height,
              timestamp: Date.now()
            });
          }

          if (notesToDelete.length) { setNotes(prev => prev.filter(n => !notesToDelete.some(del => del.id === n.id))); notesToDelete.forEach(n => socket && socket.emit('note-delete', { whiteboardId, id: n.id })); }
          if (textsToDelete.length) { setTextBoxes(prev => prev.filter(t => !textsToDelete.some(del => del.id === t.id))); textsToDelete.forEach(t => socket && socket.emit('text-delete', { whiteboardId, id: t.id })); }
          if (emojisToDelete.length) { setEmojis(prev => prev.filter(e => !emojisToDelete.some(del => del.id === e.id))); emojisToDelete.forEach(e => socket && socket.emit('emoji-delete', { whiteboardId, id: e.id })); }
          if (gifsToDelete.length) { setGifs(prev => prev.filter(g => !gifsToDelete.some(del => del.id === g.id))); gifsToDelete.forEach(g => socket && socket.emit('gif-delete', { whiteboardId, id: g.id })); }
          if (imagesToDelete.length) { setImages(prev => prev.filter(img => !imagesToDelete.some(del => del.id === img.id))); imagesToDelete.forEach(img => socket && socket.emit('image-delete', { whiteboardId, id: img.id })); }
          if (shapesToDelete.length) { setShapes(prev => prev.filter(s => !shapesToDelete.some(del => del.id === s.id))); shapesToDelete.forEach(s => socket && socket.emit('shape-delete', { whiteboardId, id: s.id })); }

          setSelectionSnapshot(null);
          setSelectionBox(null);
          setOriginalCaptureRect(null);

          redrawCanvas();
          return;
        }

        if (selectedNoteId) removeNote(selectedNoteId);
        if (selectedTextBoxId) removeTextBox(selectedTextBoxId);
        if (selectedEmojiId) removeEmoji(selectedEmojiId);
        if (selectedGifId) removeGif(selectedGifId);
        if (selectedImageId) removeImage(selectedImageId);
        if (selectedShapeId) removeShape(selectedShapeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    notes, textBoxes, emojis, gifs, shapes, images,
    selectedNoteId, selectedTextBoxId, selectedEmojiId, selectedGifId, selectedShapeId,
    selectionBox, selectionSnapshot,
    clipboard
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
      const handleImageUpdateSocket = (data) => setImages(prev => prev.map(img => img.id === data.id ? { ...img, ...data } : img));
      const handleShapeUpdate = (data) => setShapes(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));

      const handleEmojiCreateSocket = (data) => setEmojis(prev => prev.some(e => e.id === data.emoji.id) ? prev : [...prev, data.emoji]);
      const handleEmojiDeleteSocket = (data) => setEmojis(prev => prev.filter(e => e.id !== data.id));
      const handleGifCreateSocket = (data) => setGifs(prev => prev.some(g => g.id === data.gif.id) ? prev : [...prev, data.gif]);
      const handleGifDeleteSocket = (data) => setGifs(prev => prev.filter(g => g.id !== data.id));
      const handleImageCreateSocket = (data) => setImages(prev => prev.some(img => img.id === data.image.id) ? prev : [...prev, data.image]);
      const handleImageDeleteSocket = (data) => setImages(prev => prev.filter(img => img.id !== data.id));
      const handleShapeCreateSocket = (data) => setShapes(prev => prev.some(s => s.id === data.shape.id) ? prev : [...prev, data.shape]);
      const handleShapeDeleteSocket = (data) => setShapes(prev => prev.filter(s => s.id !== data.id));

      socket.on('note-create', handleNoteCreate);
      socket.on('note-update', handleNoteUpdate);
      socket.on('note-delete', handleNoteDelete);
      socket.on('emoji-update', handleEmojiUpdate);
      socket.on('gif-update', handleGifUpdate);
      socket.on('image-update', handleImageUpdateSocket);
      socket.on('shape-update', handleShapeUpdate);
      socket.on('emoji-create', handleEmojiCreateSocket);
      socket.on('emoji-delete', handleEmojiDeleteSocket);
      socket.on('gif-create', handleGifCreateSocket);
      socket.on('gif-delete', handleGifDeleteSocket);
      socket.on('image-create', handleImageCreateSocket);
      socket.on('image-delete', handleImageDeleteSocket);
      socket.on('shape-create', handleShapeCreateSocket);
      socket.on('shape-delete', handleShapeDeleteSocket);

      return () => {
        socket.off('note-create', handleNoteCreate);
        socket.off('note-update', handleNoteUpdate);
        socket.off('note-delete', handleNoteDelete);
        socket.off('emoji-update', handleEmojiUpdate);
        socket.off('gif-update', handleGifUpdate);
        socket.off('image-update', handleImageUpdateSocket);
        socket.off('shape-update', handleShapeUpdate);
        socket.off('emoji-create', handleEmojiCreateSocket);
        socket.off('emoji-delete', handleEmojiDeleteSocket);
        socket.off('gif-create', handleGifCreateSocket);
        socket.off('gif-delete', handleGifDeleteSocket);
        socket.off('image-create', handleImageCreateSocket);
        socket.off('image-delete', handleImageDeleteSocket);
        socket.off('shape-create', handleShapeCreateSocket);
        socket.off('shape-delete', handleShapeDeleteSocket);
      };
    }
  }, [socket]);

  const handleMouseMove = (e) => {
    currentMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (isPanning) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;

      setPanOffset(prev => {
        const container = containerRef.current;
        if (!container) return { x: prev.x + dx, y: prev.y + dy };
        return { x: prev.x + dx, y: prev.y + dy };
      });

      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    if (onCursorMove) onCursorMove({ x, y });

    if (tool === 'select') {
      if (isDraggingSelection && selectionBox) {
        setSelectionBox({ ...selectionBox, x: x - dragOffset.x, y: y - dragOffset.y });
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

  const toggleBackground = () => {
    const currentIndex = backgroundModes.findIndex(mode => mode.id === backgroundMode);
    const nextIndex = (currentIndex + 1) % backgroundModes.length;
    const newMode = backgroundModes[nextIndex].id;
    if (onBackgroundChange) onBackgroundChange(newMode);
  };

  const getCurrentBackgroundIcon = () => backgroundModes.find(mode => mode.id === backgroundMode)?.icon;

  const handleMouseLeave = () => { stopDrawing(); };
  const handleMouseEnter = () => { };

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
    localDrawingsRef.current = [];
  }, [whiteboardId]);

  const remoteCursorsArray = Array.from(remoteCursors.values());

  return (
    <div className="canvas-container" ref={containerRef}>
      <div
        className={`canvas-area background-${backgroundMode} ${tool === 'select' ? 'is-selecting' : ''} ${isPanning ? 'is-grabbing' : ''}`}
        onClick={handleCanvasClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={handleWheel}
        style={{
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`
        }}
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
              left: (selectionBox.x * zoom) + panOffset.x,
              top: (selectionBox.y * zoom) + panOffset.y,
              width: selectionBox.width * zoom,
              height: selectionBox.height * zoom,
              border: '1px dashed #3498db'
            }}
          >
            {selectionSnapshot && (
              <img src={selectionSnapshot} alt="Selected area" className="selection-image" draggable={false} />
            )}
          </div>
        )}

        {notes.map(note => (
          <div key={note.id} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100%', height: '100%' }}>
            <Note
              key={note.id}
              {...note}
              x={(note.x * zoom) + panOffset.x}
              y={(note.y * zoom) + panOffset.y}
              width={note.width}
              height={note.height}
              zoom={zoom}
              panOffset={panOffset}
              limit={WORLD_LIMIT}
              onUpdate={(id, data) => {
                const cleanData = { ...data };
                if (cleanData.position) {
                  cleanData.x = (cleanData.position.x - panOffset.x) / zoom;
                  cleanData.y = (cleanData.position.y - panOffset.y) / zoom;
                  delete cleanData.position;
                } else if (cleanData.x !== undefined && cleanData.y !== undefined) {
                  cleanData.x = (cleanData.x - panOffset.x) / zoom;
                  cleanData.y = (cleanData.y - panOffset.y) / zoom;
                }
                handleNoteUpdate(id, cleanData);
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
            id={textBox.id}
            x={(textBox.x * zoom) + panOffset.x}
            y={(textBox.y * zoom) + panOffset.y}
            width={textBox.width}
            height={textBox.height}
            zoom={zoom}
            text={textBox.text}
            panOffset={panOffset}
            limit={WORLD_LIMIT}
            tool={tool}
            onUpdate={(id, data) => {
              const cleanData = { ...data };
              if (cleanData.position) {
                cleanData.x = (cleanData.position.x - panOffset.x) / zoom;
                cleanData.y = (cleanData.position.y - panOffset.y) / zoom;
                delete cleanData.position;
              } else if (cleanData.x !== undefined) {
                cleanData.x = (cleanData.x - panOffset.x) / zoom;
                cleanData.y = (cleanData.y - panOffset.y) / zoom;
              }
              handleTextUpdate(id, cleanData);
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
            x={(emojiData.x * zoom) + panOffset.x}
            y={(emojiData.y * zoom) + panOffset.y}
            size={(emojiData.size || 48) * zoom} // Rozmiar wysyłamy przeskalowany
            panOffset={panOffset}
            limit={WORLD_LIMIT}
            zoom={zoom} // 🔹 DODAJEMY ZOOM
            tool={tool}
            selected={selectedEmojiId === emojiData.id}
            onSelect={setSelectedEmojiId}
            onRemove={removeEmoji}
            onUpdate={(id, data) => {
              const cleanData = { ...data };
              // Odwracamy zoom dla pozycji
              if (cleanData.x !== undefined) cleanData.x = (cleanData.x - panOffset.x) / zoom;
              if (cleanData.y !== undefined) cleanData.y = (cleanData.y - panOffset.y) / zoom;
              // 🔹 Odwracamy zoom dla rozmiaru (bo Emoji.jsx oblicza nowy rozmiar w pikselach ekranu)
              if (cleanData.size !== undefined) cleanData.size = cleanData.size / zoom;
              handleEmojiUpdate(id, cleanData);
            }}
          />
        ))}

        {/* 🔹 POPRAWKA: Gify skalowane przez mnożenie x, y, width przez zoom */}
        {gifs.map(gif => (
          <Gif
            key={gif.id}
            {...gif}
            x={(gif.x * zoom) + panOffset.x}
            y={(gif.y * zoom) + panOffset.y}
            width={(gif.width || 150) * zoom} // Skalujemy szerokość
            panOffset={panOffset}
            limit={WORLD_LIMIT}
            zoom={zoom}
            selected={selectedGifId === gif.id}
            onSelect={setSelectedGifId}
            onUpdate={(id, data) => {
              const cleanData = { ...data };
              // Odwracamy zoom przy zapisie
              if (cleanData.x !== undefined) cleanData.x = (cleanData.x - panOffset.x) / zoom;
              if (cleanData.y !== undefined) cleanData.y = (cleanData.y - panOffset.y) / zoom;
              if (cleanData.width !== undefined) cleanData.width = cleanData.width / zoom;
              handleGifUpdate(id, cleanData);
            }}
            tool={tool}
          />
        ))}

        {/* 🔹 POPRAWKA: Obrazy skalowane przez mnożenie x, y, width przez zoom */}
        {images.map(image => (
          <ImageItem
            key={image.id}
            {...image}
            x={(image.x * zoom) + panOffset.x}
            y={(image.y * zoom) + panOffset.y}
            width={(image.width || 200) * zoom}
            panOffset={panOffset}
            limit={WORLD_LIMIT}
            zoom={zoom} // 🔹 <--- DODAJ TĘ LINIJKĘ
            selected={selectedImageId === image.id}
            onSelect={setSelectedImageId}
            onUpdate={(id, data) => {
              const cleanData = { ...data };
              if (cleanData.x !== undefined) cleanData.x = (cleanData.x - panOffset.x) / zoom;
              if (cleanData.y !== undefined) cleanData.y = (cleanData.y - panOffset.y) / zoom;
              if (cleanData.width !== undefined) cleanData.width = cleanData.width / zoom;
              handleImageUpdate(id, cleanData);
            }}
          />
        ))}

        {/* 🔹 POPRAWKA: Kształty skalowane przez mnożenie x, y, width, height przez zoom */}
        {shapes.map(shape => {
          const creator = users ? users.find(u => u.id === shape.userId) : null;
          const dynamicColor = creator ? creator.color : (shape.color || '#000000');

          return (
            <Shape
              key={shape.id}
              {...shape}
              x={(shape.x * zoom) + panOffset.x}
              y={(shape.y * zoom) + panOffset.y}
              width={(shape.width || 100) * zoom}
              height={(shape.height || 100) * zoom}
              panOffset={panOffset}
              limit={WORLD_LIMIT}
              zoom={zoom}
              color={dynamicColor}
              selected={selectedShapeId === shape.id}
              onSelect={setSelectedShapeId}
              onRemove={removeShape}
              onUpdate={(id, data) => {
                const cleanData = { ...data };
                if (cleanData.x !== undefined) cleanData.x = (cleanData.x - panOffset.x) / zoom;
                if (cleanData.y !== undefined) cleanData.y = (cleanData.y - panOffset.y) / zoom;
                if (cleanData.width !== undefined) cleanData.width = cleanData.width / zoom;
                if (cleanData.height !== undefined) cleanData.height = cleanData.height / zoom;
                handleShapeUpdate(id, cleanData);
              }}
              tool={tool}
            />
          );
        })}

        {/* 🔹 POPRAWKA: Kursory skalowane przez mnożenie pozycji przez zoom */}
        {remoteCursorsArray.map((cursor, index) => {
          const userName = cursor.user?.name || 'Unknown';
          const userColor = cursor.user?.color || '#ff4444';

          return (
            cursor.position && (
              <div
                key={cursor.userId || `cursor_${index}`}
                className="remote-cursor"
                style={{
                  position: 'absolute',
                  left: (cursor.position.x * zoom) + panOffset.x,
                  top: (cursor.position.y * zoom) + panOffset.y,
                  pointerEvents: 'none',
                  zIndex: 1000,
                  transition: 'left 0.1s linear, top 0.1s linear'
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: 'translate(-2px, -2px)',
                    fill: userColor,
                    stroke: 'white',
                    strokeWidth: 2,
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
                  }}
                >
                  <path d="M5.5 3.21l10.08 5.31c1.26.66 1.13 2.51-.2 2.98l-3.32 1.17a1 1 0 0 1-.65.25l-3.46.74a1 1 0 0 0-.71.56l-1.24 3.06c-.52 1.28-2.35 1.18-2.7-.15L2.1 4.38c-.2-.77.58-1.5 1.32-1.17H5.5z" />
                </svg>

                <div style={{
                  position: 'absolute',
                  left: '16px',
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
          className={`chat-toggle ${isChatVisible ? 'active-chat' : ''} ${hasUnreadMessages ? 'has-unread' : ''}`}
          onClick={() => {
            setIsChatVisible(!isChatVisible);
            if (!isChatVisible) { setHasUnreadMessages(false); }
          }}
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
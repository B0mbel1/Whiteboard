import React, { useState, useRef, useEffect } from 'react';
import './Canvas.css';
import Note from './Note';

const Canvas = ({ tool, color, size, setShowColorPicker, setTool }) => {
  const [backgroundMode, setBackgroundMode] = useState('grid');
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [notes, setNotes] = useState([]);

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
    let toolSize = size[tool] || 3;
    if (tool === 'pencil') toolSize = Math.max(1, toolSize - 2);
    if (tool === 'brush') toolSize += 10;
    if (tool === 'eraser') toolSize += 30;
    return toolSize;
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
    // Rysujemy tylko jeśli tool jest rysującym narzędziem
    if (!['pencil', 'brush', 'eraser'].includes(tool)) return;

    if (setShowColorPicker) setShowColorPicker(false);
    const { offsetX, offsetY } = nativeEvent;
    const ctx = contextRef.current;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);

    // Natychmiast rysujemy punkt
    draw({ nativeEvent });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    } else if (tool === 'brush' || tool === 'pencil') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.shadowBlur = tool === 'brush' ? 5 : 0;
      ctx.shadowColor = tool === 'brush' ? color : 'transparent';
    }

    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const handleCanvasClick = (e) => {
    if (tool !== 'notes') return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNotes(prev => [...prev, { id: Date.now(), x, y }]);

    // Wróć do kursora po dodaniu notatki
    if (setTool) setTimeout(() => setTool('cursor'), 0);
  };

  const removeNote = (id) => setNotes(prev => prev.filter(n => n.id !== id));

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
  };

  const getCurrentBackgroundIcon = () =>
    backgroundModes.find(mode => mode.id === backgroundMode)?.icon;


  const handleMouseLeave = () => {
    if (tool === 'pointer') {
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'default'; // zwykły kursor
    }
  };

  const handleMouseEnter = () => {
    if (tool === 'pointer') {
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'pointer'; // przywróć kursor pointer
    }
  };

  return (
    <div className="canvas-container" ref={containerRef}>
      <div
        className={`canvas-area background-${backgroundMode}`}
        onClick={handleCanvasClick}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onMouseLeave={stopDrawing}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
        {notes.map(note => (
          <Note key={note.id} id={note.id} x={note.x} y={note.y} onRemove={removeNote} />
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

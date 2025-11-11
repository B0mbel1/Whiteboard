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

  // Aktualizacja rozmiaru canvas
  const updateCanvasSize = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (canvas && container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      if (contextRef.current) {
        contextRef.current.lineCap = 'round';
        contextRef.current.strokeStyle = color;
        contextRef.current.lineWidth = size;
      }
    }
  };

  useEffect(() => {
    updateCanvasSize();
    const handleResize = () => updateCanvasSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      context.lineCap = 'round';
      context.strokeStyle = color;
      context.lineWidth = size;
      contextRef.current = context;
    }
  }, []);

  // Aktualizacja koloru
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
    }
  }, [color]);

  // Aktualizacja grubości i globalCompositeOperation
  useEffect(() => {
    if (!contextRef.current) return;
    const ctx = contextRef.current;

    // Pobieramy grubość z obiektu size
    let toolSize = size[tool] || 3; // domyślna wartość jeśli brak

    // Ołówek trochę cieńszy niż pędzel
    if (tool === 'pencil') {
      toolSize = Math.max(1, toolSize - 2); // zmniejszamy o 2, min 1
    }

    ctx.lineWidth = toolSize;

    // ustawienie trybu rysowania
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
  }, [size, tool, color]);

  const startDrawing = ({ nativeEvent }) => {
    if (setShowColorPicker) setShowColorPicker(false);
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      contextRef.current.closePath();
      setIsDrawing(false);
    }
  };

  const cancelDrawing = () => {
    if (isDrawing) {
      contextRef.current.closePath();
      setIsDrawing(false);
    }
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    const ctx = contextRef.current;

    if (tool === 'pencil' || tool === 'brush') {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.shadowBlur = tool === 'brush' ? 5 : 0;
      ctx.shadowColor = tool === 'brush' ? color : 'transparent';
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
    } else if (tool === 'eraser') {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
    }
  };

  const backgroundModes = [
    { id: 'white', name: 'Białe tło', icon: '🌕' },
    { id: 'grid', name: 'Kratka', icon: '🏁' },
    { id: 'lines', name: 'Siatka linii', icon: '📐' },
    { id: 'black', name: 'Czarne tło', icon: '🌑' }
  ];

  const toggleBackground = () => {
    const currentIndex = backgroundModes.findIndex(mode => mode.id === backgroundMode);
    const nextIndex = (currentIndex + 1) % backgroundModes.length;
    setBackgroundMode(backgroundModes[nextIndex].id);
  };

  const getCurrentBackgroundIcon = () => {
    return backgroundModes.find(mode => mode.id === backgroundMode)?.icon;
  };

const handleCanvasClick = (e) => {
  if (tool === 'notes') {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Dodajemy nową notatkę
    const newNote = { id: Date.now(), x, y };

    setNotes(prev => [...prev, newNote]);

    // Po postawieniu notatki wracamy do kursora
    if (typeof setTool === 'function') {
      setTimeout(() => setTool('cursor'), 0);
    }
  }
};

  const removeNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="canvas-container">
      <div
        className={`canvas-area background-${backgroundMode}`}
        ref={containerRef}
        onClick={handleCanvasClick}
      >
        <canvas
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onMouseLeave={cancelDrawing}
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
        {notes.map(note => (
          <Note
            key={note.id}
            id={note.id}
            x={note.x}
            y={note.y}
            onRemove={removeNote}
          />
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

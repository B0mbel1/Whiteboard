import React, { useState, useRef, useEffect } from 'react';
import './Canvas.css';
import Note from './Note';

const Canvas = ({ tool, setTool, color, size, setShowColorPicker }) => {
  const [backgroundMode, setBackgroundMode] = useState('grid');
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [notes, setNotes] = useState([]);

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
        contextRef.current.lineWidth = size[tool] || 2;
      }
    }
  };

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      context.lineCap = 'round';
      context.strokeStyle = color;
      context.lineWidth = size[tool] || 2;
      contextRef.current = context;
    }
  }, []);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
    }
  }, [color]);

  useEffect(() => {
    if (contextRef.current) {
      let newSize = size[tool] || 2;
      if (tool === 'brush') newSize *= 2;
      if (tool === 'pencil') newSize *= 0.5;
      if (tool === 'eraser') newSize *= 2;
      contextRef.current.lineWidth = newSize;
    }
  }, [size, tool]);

  const startDrawing = ({ nativeEvent }) => {
    if (setShowColorPicker) setShowColorPicker(false);
    if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') {
      const { offsetX, offsetY } = nativeEvent;
      contextRef.current.beginPath();
      contextRef.current.moveTo(offsetX, offsetY);
      setIsDrawing(true);
    }
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

    if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') {
      contextRef.current.lineTo(offsetX, offsetY);
      contextRef.current.stroke();
    }
  };

  const handleCanvasClick = (e) => {
    if (tool === 'notes') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // dodaj notatkę
      setNotes(prev => [...prev, { id: Date.now(), x, y }]);

      // automatycznie zmień tool na kursor
      setTool('cursor');
    }
  };

  const removeNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const backgroundModes = [
    { id: 'white', icon: '🌕' },
    { id: 'grid', icon: '🏁' },
    { id: 'lines', icon: '📐' },
    { id: 'black', icon: '🌑' }
  ];

  const toggleBackground = () => {
    const currentIndex = backgroundModes.findIndex(m => m.id === backgroundMode);
    setBackgroundMode(backgroundModes[(currentIndex + 1) % backgroundModes.length].id);
  };

  return (
    <div className="canvas-container">
      <div
        className={`canvas-area background-${backgroundMode}`}
        ref={containerRef}
        onClick={handleCanvasClick}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onMouseLeave={cancelDrawing}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
        {notes.map(note => (
          <Note key={note.id} id={note.id} x={note.x} y={note.y} onRemove={removeNote} />
        ))}
        <button className="background-toggle" onClick={toggleBackground}>
          {backgroundModes.find(m => m.id === backgroundMode)?.icon}
        </button>
      </div>
    </div>
  );
};

export default Canvas;

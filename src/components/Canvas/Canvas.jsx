import React, { useState, useRef, useEffect } from 'react';
import './Canvas.css';

const Canvas = ({ tool, color, size, setShowColorPicker }) => {
  const [backgroundMode, setBackgroundMode] = useState('grid'); // 'white', 'grid', 'lines', 'black'
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth * 0.7;
    canvas.height = window.innerHeight * 0.95;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.strokeStyle = color;
    context.lineWidth = size;
    contextRef.current = context;
  }, []);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
    }
  }, [color]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = size;
    }
  }, [size]);

  const startDrawing = ({ nativeEvent }) => {
    if (setShowColorPicker) {
      setShowColorPicker(false);
    }
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const stopDrawing = () => {
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) {
      return;
    }
    const { offsetX, offsetY } = nativeEvent;

    if (tool === 'pencil') {
      contextRef.current.lineCap = 'round';
      contextRef.current.lineJoin = 'round';
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.strokeStyle = color;
      contextRef.current.shadowBlur = 0;
      contextRef.current.shadowColor = 'transparent'; // Reset shadow for pencil
      contextRef.current.lineTo(offsetX, offsetY);
      contextRef.current.stroke();
    } else if (tool === 'eraser') {
      contextRef.current.lineCap = 'round';
      contextRef.current.lineJoin = 'round';
      contextRef.current.globalCompositeOperation = 'destination-out'; // Erase effect
      contextRef.current.strokeStyle = 'rgba(0,0,0,1)'; // Any color with full opacity for destination-out
      contextRef.current.shadowBlur = 0;
      contextRef.current.shadowColor = 'transparent'; // Reset shadow for eraser
      contextRef.current.lineTo(offsetX, offsetY);
      contextRef.current.stroke();
    } else if (tool === 'brush') {
      contextRef.current.lineCap = 'round'; // Changed to round for softer brush
      contextRef.current.lineJoin = 'round'; // Changed to round for softer brush
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.strokeStyle = color;
      contextRef.current.shadowBlur = 5; // Subtle blur for brush effect
      contextRef.current.shadowColor = color; // Shadow matches brush color
      contextRef.current.lineTo(offsetX, offsetY);
      contextRef.current.stroke();
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

  return (
    <div className="canvas-container">
      <div className={`canvas-area background-${backgroundMode}`}>
        <canvas
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          ref={canvasRef}
        />
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
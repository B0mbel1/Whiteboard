import React, { useState, useRef, useEffect } from 'react';
import './Canvas.css';

const Canvas = ({ tool, color, size, setShowColorPicker }) => {
  const [backgroundMode, setBackgroundMode] = useState('grid');
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Funkcja do aktualizacji rozmiaru canvas
  const updateCanvasSize = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    if (canvas && container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Ponowne ustawienie kontekstu po zmianie rozmiaru
      if (contextRef.current) {
        contextRef.current.lineCap = 'round';
        contextRef.current.strokeStyle = color;
        contextRef.current.lineWidth = size;
      }
    }
  };

  useEffect(() => {
    updateCanvasSize();
    
    const handleResize = () => {
      updateCanvasSize();
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
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

  // Reszta useEffect pozostaje bez zmian
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
    }
  }, [color]);

 useEffect(() => {
  if (contextRef.current) {
    let newSize = size;

    // 🖌️ Różne mnożniki dla różnych narzędzi
    if (tool === 'brush') {
      newSize = size * 2; // pędzel 2× grubszy
    } else if (tool === 'pencil') {
      newSize = size * 0.5; // ołówek 2× cieńszy
    } else if (tool === 'eraser') {
      newSize = size * 2; // gumka też 2× większa (jeśli chcesz)
    }

    contextRef.current.lineWidth = newSize;
  }
}, [size, tool]);


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
      contextRef.current.shadowColor = 'transparent';
      contextRef.current.lineTo(offsetX, offsetY);
      contextRef.current.stroke();
    } else if (tool === 'eraser') {
      contextRef.current.lineCap = 'round';
      contextRef.current.lineJoin = 'round';
      contextRef.current.globalCompositeOperation = 'destination-out';
      contextRef.current.strokeStyle = 'rgba(0,0,0,1)';
      contextRef.current.shadowBlur = 0;
      contextRef.current.shadowColor = 'transparent';
      contextRef.current.lineTo(offsetX, offsetY);
      contextRef.current.stroke();
    } else if (tool === 'brush') {
      contextRef.current.lineCap = 'round';
      contextRef.current.lineJoin = 'round';
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.strokeStyle = color;
      contextRef.current.shadowBlur = 5;
      contextRef.current.shadowColor = color;
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
      <div 
        className={`canvas-area background-${backgroundMode}`}
        ref={containerRef}
      >
        <canvas
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          ref={canvasRef}
          style={{
            display: 'block', // Zapobiega białym marginesom wokół canvas
            width: '100%',
            height: '100%'
          }}
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
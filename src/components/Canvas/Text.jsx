import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import './Text.css';

const Text = ({
  id,
  x,
  y,
  width,
  height,
  text: initialText,
  onUpdate,
  onRemove,
  selected,
  setSelected,
  socket,
  tool,
  panOffset,
  limit = 1500,
  zoom = 1
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(initialText || '');
  
  // Stan lokalny pozycji i rozmiaru
  const [position, setPosition] = useState({ x: x || 0, y: y || 0 });
  const [size, setSize] = useState({ width: width || 200, height: height || 100 });
  
  const textareaRef = useRef(null);
  
  // Refy stanu interakcji
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Refy do przechowywania NAJNOWSZYCH wartości stanu (rozwiązuje problem "stale closures")
  const latestText = useRef(text);
  const latestSize = useRef(size);
  const latestPosition = useRef(position);

  const isDrawingTool = ['pencil', 'brush', 'eraser'].includes(tool);

  // Aktualizuj refy przy każdym renderze
  useLayoutEffect(() => {
    latestText.current = text;
    latestSize.current = size;
    latestPosition.current = position;
  }, [text, size, position]);

  // 1. NAPRAWA "USUWANIA TEKSTU": Synchronizacja tekstu z props (np. po załadowaniu strony)
  useEffect(() => {
    if (!isEditing && initialText !== undefined && initialText !== text) {
      setText(initialText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText, isEditing]);

  // 2. Synchronizacja z Socketem
  useEffect(() => {
    if (socket) {
      const handleTextUpdate = (data) => {
        if (data.id === id) {
          if (!isEditing && data.text !== undefined) setText(data.text);
          
          // Aktualizuj rozmiar/pozycję z serwera TYLKO jeśli my ich nie zmieniamy
          if (!isDragging.current && !isResizing.current) {
             if (data.size) setSize(data.size);
             if (data.position) setPosition(data.position);
             else if (data.x !== undefined) setPosition({ x: data.x, y: data.y });
          }
        }
      };
      socket.on('text-update', handleTextUpdate);
      return () => {
        socket.off('text-update', handleTextUpdate);
      };
    }
  }, [socket, id, isEditing]);

  // 3. NAPRAWA "NIE MOŻNA PRZESUWAĆ": Synchronizacja pozycji z props
  // Ignorujemy aktualizacje z góry, jeśli użytkownik właśnie przesuwa lub skaluje element.
  useEffect(() => {
    if (!isDragging.current && !isResizing.current) {
      setPosition({ x: x || 0, y: y || 0 });
      setSize({ width: width || 200, height: height || 100 });
    }
  }, [x, y, width, height, zoom]); 

  const handleMouseDown = (e) => {
    if (isDrawingTool) return;
    
    // Ignorujemy kliknięcia w trybie edycji lub na uchwyt resize
    if (isEditing || e.target.classList.contains('resize-handle')) {
      return;
    }
    
    setSelected(id);
    
    isDragging.current = true;
    
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (isDragging.current) {
      e.preventDefault();
      
      let newScreenX = e.clientX - dragOffset.current.x;
      let newScreenY = e.clientY - dragOffset.current.y;

      // Obsługa Zoomu i Limitów
      if (panOffset) {
        // Screen -> World
        const worldX = (newScreenX - panOffset.x) / zoom;
        const worldY = (newScreenY - panOffset.y) / zoom;

        // Clamp
        const clampedWorldX = Math.max(-limit, Math.min(worldX, limit - size.width));
        const clampedWorldY = Math.max(-limit, Math.min(worldY, limit - size.height));

        // World -> Screen
        newScreenX = (clampedWorldX * zoom) + panOffset.x;
        newScreenY = (clampedWorldY * zoom) + panOffset.y;
      }
      
      setPosition({ x: newScreenX, y: newScreenY });
    }
  };

  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
      // Używamy refów, aby mieć pewność, że wysyłamy najnowsze dane
      if (onUpdate) {
        onUpdate(id, { 
          position: latestPosition.current, 
          text: latestText.current, 
          size: latestSize.current 
        });
      }
    }
  };

  const handleResizeMouseDown = (e) => {
    if (isDrawingTool) return;
    e.stopPropagation();
    e.preventDefault();
    
    isResizing.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleResizeMove = (moveEvent) => {
      moveEvent.preventDefault();
      
      // Uwzględniamy ZOOM
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const deltaY = (moveEvent.clientY - startY) / zoom;
      
      const newWidth = Math.max(50, startWidth + deltaX);
      const newHeight = Math.max(30, startHeight + deltaY);

      setSize({ width: newWidth, height: newHeight });
    };

    const stopResize = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', stopResize);
      
      // NAPRAWA DUPLIKATÓW/BŁĘDÓW: Używamy refów do odczytu najnowszego stanu
      if (onUpdate) {
        onUpdate(id, { 
            position: latestPosition.current, 
            text: latestText.current, 
            size: latestSize.current // Tu bierzemy najnowszy rozmiar z refa
        });
      }
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', stopResize);
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    setSelected(id);
  };

  const handleBlur = () => {
    if (onUpdate && text !== initialText) {
      onUpdate(id, { position, text, size });
    }
    setIsEditing(false);
  };

  const handleChange = (e) => {
    setText(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Globalne listenery dla dragowania
  useEffect(() => {
    const onMove = (e) => handleMouseMove(e);
    const onUp = (e) => handleMouseUp(e);

    if (isDragging.current) {
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, zoom, panOffset]);

  return (
    <div
      className={`text-box ${selected ? 'selected' : ''}`}
      style={{
        top: position.y,
        left: position.x,
        width: size.width,
        height: size.height,
        zIndex: selected ? 20 : 10,
        pointerEvents: isDrawingTool ? 'none' : 'auto',
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        position: 'absolute'
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="text-input"
          style={{ width: '100%', height: '100%' }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={isDrawingTool}
        />
      ) : (
        <div className="text-display">
          {text || 'Double click to edit'}
        </div>
      )}
      
      {selected && (
        <div
          className="resize-handle"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  );
};

export default Text;
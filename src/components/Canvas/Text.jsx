import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import './Text.css';

const Text = ({
  id,
  x,
  y,
  width,
  height,
  text: incomingText = '', // 🔹 ZMIANA: Odbieramy jako 'incomingText', tak jak w Note.jsx
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
  // Inicjalizujemy stan tym co przyszło z góry (lub pustym stringiem)
  const [text, setText] = useState(incomingText);
  
  // Stan lokalny pozycji i rozmiaru
  const [position, setPosition] = useState({ x: x || 0, y: y || 0 });
  const [size, setSize] = useState({ width: width || 200, height: height || 100 });
  
  const textareaRef = useRef(null);
  
  // Refy stanu interakcji
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Refy do przechowywania NAJNOWSZYCH wartości stanu (dla event listenerów)
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

  // 🔹 KLUCZOWA POPRAWKA: Synchronizacja tekstu z props (Server -> Local)
  // Działa tak samo jak w Note.jsx - jeśli przyjdą nowe dane (np. po odświeżeniu), aktualizujemy stan.
  useEffect(() => {
    if (!isEditing && incomingText !== undefined && incomingText !== text) {
      setText(incomingText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingText, isEditing]);

  // Synchronizacja z Socketem (bezpośrednie eventy, opcjonalne jeśli Canvas zarządza, ale bezpieczne)
  useEffect(() => {
    if (socket) {
      const handleTextUpdate = (data) => {
        if (data.id === id) {
          // Jeśli ktoś inny edytuje, a my nie, zaktualizuj tekst
          if (!isEditing && data.text !== undefined) {
             setText(data.text);
          }
          
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

  // Synchronizacja pozycji z props
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
      // Zapis pozycji po upuszczeniu
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
      
      if (onUpdate) {
        onUpdate(id, { 
            position: latestPosition.current, 
            text: latestText.current, 
            size: latestSize.current 
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
    setIsEditing(false);
    // Wyślij update tylko jeśli tekst faktycznie różni się od tego z serwera/propsów
    if (onUpdate && text !== incomingText) {
      onUpdate(id, { position, text, size });
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
  };

  const handleKeyDown = (e) => {
    // Zatwierdź Enterem (bez Shift)
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

  // Globalne listenery dla przesuwania
  useEffect(() => {
    const onMove = (e) => handleMouseMove(e);
    const onUp = (e) => handleMouseUp(e);
    
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    
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
          {/* Jeśli tekst jest pusty, wyświetl zachętę */}
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
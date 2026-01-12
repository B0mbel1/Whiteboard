import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import './Text.css';

const Text = ({
  id,
  x,
  y,
  width,
  height,
  text: incomingText = '',
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
  const [text, setText] = useState(incomingText);
  
  // Stan lokalny pozycji i rozmiaru
  const [position, setPosition] = useState({ x: x || 0, y: y || 0 });
  const [size, setSize] = useState({ width: width || 200, height: height || 100 });
  
  const textareaRef = useRef(null);
  
  // Refy stanu interakcji
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Refy do przechowywania NAJNOWSZYCH wartości stanu
  const latestText = useRef(text);
  const latestSize = useRef(size);
  const latestPosition = useRef(position);
  
  // Stabilizacja referencji funkcji onUpdate
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const isDrawingTool = ['pencil', 'brush', 'eraser'].includes(tool);

  // Aktualizuj refy
  useLayoutEffect(() => {
    latestText.current = text;
    latestSize.current = size;
    latestPosition.current = position;
  }, [text, size, position]);

  // 1. Odbieranie tekstu z serwera (tylko gdy NIE edytujemy)
  useEffect(() => {
    if (!isEditing && incomingText !== undefined) {
      setText(incomingText);
    }
  }, [incomingText, isEditing]);

  // 2. Odbieranie pozycji/rozmiaru z Socketu (Live updates)
  useEffect(() => {
    if (socket) {
      const handleSocketUpdate = (data) => {
        if (data.id === id) {
          if (!isDragging.current && !isResizing.current) {
             if (data.size) setSize(data.size);
             if (data.position) setPosition(data.position);
             else if (data.x !== undefined) setPosition({ x: data.x, y: data.y });
          }
        }
      };
      socket.on('text-update', handleSocketUpdate);
      return () => {
        socket.off('text-update', handleSocketUpdate);
      };
    }
  }, [socket, id]);

  // 3. Debounce wysyłania tekstu w trakcie pisania
  useEffect(() => {
    if (!isEditing) return;

    const timer = setTimeout(() => {
      if (text !== incomingText && onUpdateRef.current) {
        onUpdateRef.current(id, { 
          text: text, 
          position: latestPosition.current,
          size: latestSize.current
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [text, isEditing, incomingText, id]); 

  // Synchronizacja pozycji początkowej i przy zmianie zooma
  useEffect(() => {
    if (!isDragging.current && !isResizing.current) {
      setPosition({ x: x || 0, y: y || 0 });
      setSize({ width: width || 200, height: height || 100 });
    }
  }, [x, y, width, height, zoom]); 

  const handleMouseDown = (e) => {
    if (isDrawingTool) return;
    if (isEditing || e.target.classList.contains('resize-handle')) return;
    
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

      if (panOffset) {
        const worldX = (newScreenX - panOffset.x) / zoom;
        const worldY = (newScreenY - panOffset.y) / zoom;
        const clampedWorldX = Math.max(-limit, Math.min(worldX, limit - size.width));
        const clampedWorldY = Math.max(-limit, Math.min(worldY, limit - size.height));
        newScreenX = (clampedWorldX * zoom) + panOffset.x;
        newScreenY = (clampedWorldY * zoom) + panOffset.y;
      }
      setPosition({ x: newScreenX, y: newScreenY });
    }
  };

  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
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
    if (incomingText !== undefined) {
      setText(incomingText);
    }
    setIsEditing(true);
    setSelected(id);
  };

  // 🔹 ZMODYFIKOWANA FUNKCJA HANDLE BLUR
  const handleBlur = () => {
    setIsEditing(false);
    
    // Obliczamy nową pozycję (o 1px wyżej)
    const newY = position.y - 1;
    const newPosition = { ...position, y: newY };
    
    // 1. Aktualizujemy stan lokalny (żeby użytkownik od razu widział przesunięcie)
    setPosition(newPosition);

    // 2. Wysyłamy update do serwera (zawsze, bo pozycja się zmieniła)
    if (onUpdate) {
      onUpdate(id, { 
        position: newPosition, // wysyłamy zaktualizowaną pozycję
        text: text, 
        size: size 
      });
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
  };

  const handleKeyDown = (e) => {
    // Jeśli chcesz, by Enter też kończył edycję (i przesuwał o 1px), odkomentuj:
    /*
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
    */
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

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
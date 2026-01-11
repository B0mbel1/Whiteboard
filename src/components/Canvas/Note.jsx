import React, { useState, useRef, useEffect } from 'react';
import './Note.css';

const Note = ({
  id,
  x,
  y,
  width,
  height,
  text: incomingText = '', // 🔹 ZMIANA: Odbieramy 'text' (zgodnie z tym co wysyła serwer), nie 'initialText'
  onUpdate,
  onRemove,
  selectedNoteId,
  setSelectedNoteId,
  socket,
  tool,
  panOffset,
  limit = 1500,
  zoom = 1
}) => {
  // Inicjalizacja stanu tekstem z propsów
  const [text, setText] = useState(incomingText);
  const [pos, setPos] = useState({ x, y });
  const [size, setSize] = useState({ width: width || 180, height: height || 120 });
  
  const noteRef = useRef(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastPosition = useRef({ x, y });
  const isEditingRef = useRef(false); // Ref, aby nie nadpisywać tekstu podczas pisania

  const isDrawingTool = ['pencil', 'brush', 'eraser'].includes(tool);

  // 🔹 NAPRAWA: Synchronizacja stanu lokalnego, gdy dane przyjdą z serwera (np. po refreshu)
  useEffect(() => {
    // Aktualizujemy tylko jeśli nie edytujemy i tekst jest inny
    if (!isEditingRef.current && incomingText !== undefined && incomingText !== text) {
      setText(incomingText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingText]);

  // Synchronizuj zmiany z serwera (socket) w czasie rzeczywistym
  useEffect(() => {
    if (socket) {
      const handleNoteUpdate = (data) => {
        if (data.id === id) {
          // Jeśli ktoś inny edytuje, a my nie, zaktualizuj tekst
          if (data.text !== undefined && !isEditingRef.current) {
            setText(data.text);
          }
          if (data.size) setSize(data.size);
        }
      };
      socket.on('note-update', handleNoteUpdate);
      return () => { socket.off('note-update', handleNoteUpdate); };
    }
  }, [socket, id]);

  // Synchronizuj pozycję z props TYLKO jeśli nie przeciągamy
  useEffect(() => {
    if (!isDragging.current) {
      setPos({ x, y });
    }
  }, [x, y, zoom]); 

  const handleMouseDown = (e) => {
    if (isDrawingTool) return;
    
    setSelectedNoteId(id);
    lastPosition.current = { ...pos };

    if (e.target.closest('.note-header')) {
      isDragging.current = true;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;

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

    setPos({ x: newScreenX, y: newScreenY });
  };

  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
      const positionChanged = pos.x !== lastPosition.current.x || pos.y !== lastPosition.current.y;

      if (positionChanged && onUpdate) {
        onUpdate(id, {
          position: { x: pos.x, y: pos.y },
          text,
          size
        });
      }
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  const handleFocus = () => {
    isEditingRef.current = true;
  };

  const handleTextBlur = () => {
    isEditingRef.current = false;
    // Wyślij aktualizację tylko jeśli tekst jest inny niż ten z propsów
    if (onUpdate && text !== incomingText) {
      onUpdate(id, {
        position: { x: pos.x, y: pos.y },
        text,
        size
      });
    }
  };

  const handleResize = (newWidth, newHeight) => {
    const updatedSize = {
      width: newWidth > 100 ? newWidth : 100,
      height: newHeight > 80 ? newHeight : 80
    };
    setSize(updatedSize);

    if (onUpdate) {
      onUpdate(id, { position: pos, text, size: updatedSize });
    }
  };

  useEffect(() => {
    const onMove = (e) => handleMouseMove(e);
    const onUp = (e) => handleMouseUp(e);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pos, zoom, panOffset]);

  return (
    <div
      ref={noteRef}
      className={`note ${selectedNoteId === id ? 'selected-note' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
        pointerEvents: isDrawingTool ? 'none' : 'auto',
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        position: 'absolute' 
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="note-header">
        🗒️
        <button className="note-close" onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}>✕</button>
      </div>
      <textarea
        className="note-text"
        value={text}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        onFocus={handleFocus} // 🔹 Rejestrujemy wejście w tryb edycji
        placeholder="Twoja notatka..."
        onMouseDown={(e) => e.stopPropagation()}
        disabled={isDrawingTool}
      />
      <div
        className="note-resizer"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = size.width;
          const startHeight = size.height;

          const handleResizeMove = (moveEvent) => {
            const deltaX = (moveEvent.clientX - startX) / zoom;
            const deltaY = (moveEvent.clientY - startY) / zoom;
            
            const newWidth = startWidth + deltaX;
            const newHeight = startHeight + deltaY;
            handleResize(newWidth, newHeight);
          };

          const stopResize = () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', stopResize);
          };

          window.addEventListener('mousemove', handleResizeMove);
          window.addEventListener('mouseup', stopResize);
        }}
      />
    </div>
  );
};

export default Note;
import React, { useState, useRef, useEffect } from 'react';
import './Note.css';

const Note = ({ 
  id, 
  x, 
  y, 
  width, 
  height, 
  initialText = '', 
  onUpdate, 
  onRemove, 
  selectedNoteId, 
  setSelectedNoteId,
  socket 
}) => {
  const [text, setText] = useState(initialText);
  const [pos, setPos] = useState({ x, y });
  const [size, setSize] = useState({ width: width || 180, height: height || 120 });
  const noteRef = useRef(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastPosition = useRef({ x, y }); // 🔹 DODANE: Śledzenie poprzedniej pozycji

  // Synchronizuj zmiany z serwera
  useEffect(() => {
    if (socket) {
      const handleNoteUpdate = (data) => {
        if (data.id === id) {
          if (data.position) setPos(data.position);
          if (data.text !== undefined) setText(data.text);
          if (data.size) setSize(data.size);
        }
      };
      
      socket.on('note-update', handleNoteUpdate);
      return () => {
        socket.off('note-update', handleNoteUpdate);
      };
    }
  }, [socket, id]);

  const handleMouseDown = (e) => {
    setSelectedNoteId(id);
    lastPosition.current = { ...pos }; // 🔹 ZAPISZ pozycję przed rozpoczęciem przesuwania

    if (e.target.classList.contains('note-header')) {
      isDragging.current = true;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const newPos = {
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y
    };
    setPos(newPos);
  };

  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
      
      // 🔹 DODANE: Sprawdź czy pozycja się zmieniła
      const positionChanged = pos.x !== lastPosition.current.x || pos.y !== lastPosition.current.y;
      
      if (positionChanged && onUpdate) {
        onUpdate(id, { position: pos, text, size });
      }
    }
  };

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);
  };

  const handleTextBlur = () => {
    if (onUpdate && text !== initialText) {
      onUpdate(id, { position: pos, text, size });
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
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [pos]);

  return (
    <div
      ref={noteRef}
      className={`note ${selectedNoteId === id ? 'selected-note' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="note-header">
        🗒️
        <button className="note-close" onClick={() => onRemove(id)}>✕</button>
      </div>
      <textarea
        className="note-text"
        value={text}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        placeholder="Twoja notatka..."
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
            const newWidth = startWidth + (moveEvent.clientX - startX);
            const newHeight = startHeight + (moveEvent.clientY - startY);
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
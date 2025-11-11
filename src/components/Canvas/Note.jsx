import React, { useState, useRef, useEffect } from 'react';
import './Note.css';

const Note = ({ id, x, y, onRemove, initialText = '' }) => {
  const [text, setText] = useState(initialText);
  const [pos, setPos] = useState({ x, y });
  const [size, setSize] = useState({ width: 180, height: 120 });
  const noteRef = useRef(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // 🔹 Obsługa przeciągania notatki
  const handleMouseDown = (e) => {
    if (e.target.classList.contains('note-header')) {
      isDragging.current = true;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    setPos({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      ref={noteRef}
      className="note"
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
        onChange={(e) => setText(e.target.value)}
        placeholder="Twoja notatka..."
      />
      <div
        className="note-resizer"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = size.width;
          const startHeight = size.height;

          const handleResize = (moveEvent) => {
            const newWidth = startWidth + (moveEvent.clientX - startX);
            const newHeight = startHeight + (moveEvent.clientY - startY);
            setSize({ width: newWidth, height: newHeight });
          };

          const stopResize = () => {
            window.removeEventListener('mousemove', handleResize);
            window.removeEventListener('mouseup', stopResize);
          };

          window.addEventListener('mousemove', handleResize);
          window.addEventListener('mouseup', stopResize);
        }}
      />
    </div>
  );
};

export default Note;

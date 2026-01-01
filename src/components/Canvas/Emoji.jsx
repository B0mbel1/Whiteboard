import React, { useState, useEffect, useRef } from 'react';

const Emoji = ({
  id,
  x,
  y,
  emoji,
  size = 48,
  selected,
  onSelect,
  onRemove,
  onUpdate,
  tool
}) => {
  // --- Stan dla skalowania ---
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ y: 0, startSize: 0 });

  // --- Stan dla przesuwania (Drag & Drop) ---
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // 1. Logika SKALOWANIA
  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      y: e.clientY,
      startSize: size
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e) => {
      const deltaY = e.clientY - resizeStartRef.current.y;
      const newSize = Math.max(16, resizeStartRef.current.startSize + deltaY);
      onUpdate(id, { size: newSize });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, id, onUpdate]);

  // 2. Logika PRZESUWANIA
  const handleDragStart = (e) => {
    e.stopPropagation();
    console.log("🎯 Emoji: Próba zaznaczenia ID:", id); // <--- DODAJ TO
    if (e.target.tagName === 'BUTTON' || isResizing) return;

    // Zatrzymujemy mousedown, żeby nie rysować po canvasie

    onSelect(id);
    setIsDragging(true);

    dragOffsetRef.current = {
      x: e.clientX - x,
      y: e.clientY - y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e) => {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      onUpdate(id, { x: newX, y: newY });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, id, onUpdate]);

  const isDrawingTool = ['pencil', 'brush', 'eraser'].includes(tool);
  return (
    <div
      className="emoji-item"
      onMouseDown={handleDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontSize: `${size}px`,
        cursor: isDragging ? 'grabbing' : (selected ? 'grab' : 'pointer'),
        border: selected || isResizing ? '2px dashed #3498db' : '2px solid transparent',
        padding: '0px',
        lineHeight: 1,
        borderRadius: '4px',
        transform: 'translate(-50%, -50%)',
        userSelect: 'none',
        zIndex: isDragging || isResizing ? 100 : (selected ? 11 : 10),
        touchAction: 'none',
        pointerEvents: isDrawingTool ? 'none' : 'auto'
      }}
    >
      {emoji}


      {/* Przycisk usuwania */}
      {selected && !isDragging && !isResizing && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation(); // Tu też ważne!
            onRemove(id);
          }}
          style={{
            position: 'absolute',
            top: '-15px',
            right: '-15px',
            background: '#e74c3c',
            color: 'white',
            border: '2px solid white',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 12
          }}
        >
          ×
        </button>
      )}

      {/* Uchwyt do skalowania */}
      {(selected || isResizing) && (
        <div
          onMouseDown={handleResizeStart}
          // Dodajemy stopPropagation też tutaj, żeby kliknięcie w uchwyt nie robiło zamieszania
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: '-6px',
            right: '-6px',
            width: '12px',
            height: '12px',
            background: '#3498db',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'nwse-resize',
            zIndex: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
          }}
        />
      )}
    </div>
  );
};

export default Emoji;
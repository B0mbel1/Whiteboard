import React, { useState, useEffect, useRef } from 'react';

const DraggableResizableWrapper = ({
  id,
  x,
  y,
  width,
  isSelected,
  onSelect,
  onUpdate,
  children,
  minWidth = 50,
  aspectRatioLocked = true
}) => {
  const [localPos, setLocalPos] = useState({ x, y });
  const [localWidth, setLocalWidth] = useState(width);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, startWidth: 0 });
  const wrapperRef = useRef(null);

  // Synchronizacja z propsami
  useEffect(() => {
    if (!isDragging && !isResizing) {
      setLocalPos({ x, y });
      setLocalWidth(width);
    }
  }, [x, y, width, isDragging, isResizing]);

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    e.stopPropagation();
    onSelect(id);
    
    if (e.button === 0) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        startX: localPos.x,
        startY: localPos.y
      };
    }
  };

  const handleResizeMouseDown = (e, handleType) => {
    e.stopPropagation();
    setIsResizing(handleType);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startWidth: localWidth
    };
  };

  // Obsługa przeciągania i zmiany rozmiaru
  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        
        const newX = dragStartRef.current.startX + dx;
        const newY = dragStartRef.current.startY + dy;
        
        setLocalPos({ x: newX, y: newY });
        
        // ✅ WYŚLIJ UPDATE NATYCHMIAST dla real-time
        if (onUpdate) {
          onUpdate(id, { x: newX, y: newY });
        }
      }
      
      if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.x;
        let newWidth = resizeStartRef.current.startWidth + dx;
        
        if (newWidth < minWidth) newWidth = minWidth;
        
        setLocalWidth(newWidth);
        
        // ✅ WYŚLIJ UPDATE NATYCHMIAST dla real-time
        if (onUpdate) {
          const updates = { width: newWidth };
          
          // Jeśli zmieniamy rozmiar od lewej strony (zachodni uchwyt)
          if (isResizing.includes('w')) {
            const deltaX = resizeStartRef.current.startWidth - newWidth;
            const newX = localPos.x + deltaX;
            updates.x = newX;
            setLocalPos(prev => ({ ...prev, x: newX }));
          }
          
          onUpdate(id, updates);
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        // Możesz tutaj wysłać finalny update jeśli chcesz
        setIsDragging(false);
        setIsResizing(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, id, onUpdate, localPos.x, localPos.y, minWidth]);

  const handles = ['nw', 'ne', 'sw', 'se'];

  return (
    <div
      ref={wrapperRef}
      onClick={(e) => { e.stopPropagation(); onSelect(id); }}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: localPos.x,
        top: localPos.y,
        width: `${localWidth}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
        border: isSelected ? '2px solid #3498db' : '2px solid transparent',
        zIndex: isSelected ? 100 : 10,
        userSelect: 'none',
        touchAction: 'none'
      }}
    >
      {children}

      {/* Uchwyty do zmiany rozmiaru */}
      {isSelected && handles.map(handle => (
        <div
          key={handle}
          className={`resize-handle resize-handle-${handle}`}
          onMouseDown={(e) => handleResizeMouseDown(e, handle)}
          style={{
            position: 'absolute',
            width: '10px',
            height: '10px',
            background: 'white',
            border: '1px solid #3498db',
            zIndex: 101,
            ...getHandleStyle(handle)
          }}
        />
      ))}
    </div>
  );
};

// Helper do pozycjonowania uchwytów
const getHandleStyle = (handle) => {
  const style = {};
  if (handle.includes('n')) style.top = '-6px';
  if (handle.includes('s')) style.bottom = '-6px';
  if (handle.includes('w')) style.left = '-6px';
  if (handle.includes('e')) style.right = '-6px';
  
  let cursor = 'nwse-resize';
  if (handle === 'ne' || handle === 'sw') cursor = 'nesw-resize';
  style.cursor = cursor;
  
  return style;
};

export default DraggableResizableWrapper;
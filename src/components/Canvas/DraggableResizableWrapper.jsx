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
  aspectRatioLocked = true,
  style
}) => {
  const [localPos, setLocalPos] = useState({ x, y });
  const [localWidth, setLocalWidth] = useState(width);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, startWidth: 0, startLeft: 0, startTop: 0, startHeight: 0, aspectRatio: 1 });
  const wrapperRef = useRef(null);

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
    e.preventDefault(); // 🔹 Zapobiega zaznaczaniu tekstu na starcie
    setIsResizing(handleType);
    
    const currentHeight = wrapperRef.current ? wrapperRef.current.offsetHeight : 0;
    const ratio = localWidth / (currentHeight || 1);

    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startWidth: localWidth,
      startLeft: localPos.x,
      startTop: localPos.y,
      startHeight: currentHeight,
      aspectRatio: ratio
    };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e) => {
      // 🔹 KLUCZOWA ZMIANA: Blokuje domyślne zaznaczanie tekstu w przeglądarce podczas ruchu
      e.preventDefault(); 

      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        
        const newX = dragStartRef.current.startX + dx;
        const newY = dragStartRef.current.startY + dy;
        
        setLocalPos({ x: newX, y: newY });
        
        if (onUpdate) {
          onUpdate(id, { x: newX, y: newY });
        }
      }
      
      if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.x;
        // eslint-disable-next-line no-unused-vars
        const dy = e.clientY - resizeStartRef.current.y;
        
        const { startWidth, startLeft, startTop, startHeight, aspectRatio } = resizeStartRef.current;
        
        let newWidth = startWidth;
        let newX = startLeft;
        let newY = startTop;

        if (isResizing.includes('w')) {
          newWidth = startWidth - dx;
          newX = startLeft + dx;
        } else {
          newWidth = startWidth + dx;
        }
        
        if (newWidth < minWidth) {
          if (isResizing.includes('w')) {
             newX = (startLeft + startWidth) - minWidth;
          }
          newWidth = minWidth;
        }

        if (aspectRatioLocked) {
            const newHeight = newWidth / aspectRatio;
            if (isResizing.includes('n')) {
                newY = startTop + (startHeight - newHeight);
            }
        }
        
        setLocalWidth(newWidth);
        setLocalPos({ x: newX, y: newY });
        
        if (onUpdate) {
          onUpdate(id, { x: newX, y: newY, width: newWidth });
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing) {
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
  }, [isDragging, isResizing, id, onUpdate, localPos.x, localPos.y, minWidth, aspectRatioLocked]);

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
        userSelect: 'none', // 🔹 To już tu było, ale jest ważne
        touchAction: 'none',
        ...style
      }}
    >
      {children}

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
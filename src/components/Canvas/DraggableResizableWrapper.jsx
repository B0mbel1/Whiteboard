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
  aspectRatioLocked = true, // Zakładamy, że dla GIFów to jest true
  style
}) => {
  const [localPos, setLocalPos] = useState({ x, y });
  const [localWidth, setLocalWidth] = useState(width);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  // 1. Dodajemy startTop, startHeight i aspectRatio do refa
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
    setIsResizing(handleType);
    
    // 2. Pobieramy aktualne wymiary z DOM
    const currentHeight = wrapperRef.current ? wrapperRef.current.offsetHeight : 0;
    const ratio = localWidth / (currentHeight || 1); // Zabezpieczenie przed dzieleniem przez 0

    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startWidth: localWidth,
      startLeft: localPos.x,
      // Zapisujemy dane potrzebne do pionowego skalowania
      startTop: localPos.y,
      startHeight: currentHeight,
      aspectRatio: ratio
    };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e) => {
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
        const dy = e.clientY - resizeStartRef.current.y; // dy przydałoby się, gdyby aspectRatioLocked było false
        
        const { startWidth, startLeft, startTop, startHeight, aspectRatio } = resizeStartRef.current;
        
        let newWidth = startWidth;
        let newX = startLeft;
        let newY = startTop;

        // --- Logika pozioma (bez zmian) ---
        if (isResizing.includes('w')) {
          newWidth = startWidth - dx;
          newX = startLeft + dx;
        } else {
          newWidth = startWidth + dx;
        }
        
        // Zabezpieczenie minimalnej szerokości
        if (newWidth < minWidth) {
          if (isResizing.includes('w')) {
             newX = (startLeft + startWidth) - minWidth;
          }
          newWidth = minWidth;
        }

        // --- Nowa logika pionowa dla górnych uchwytów ---
        // Jeśli proporcje są zablokowane (GIFy), zmiana szerokości wymusza zmianę wysokości.
        if (aspectRatioLocked) {
            // Obliczamy jaka będzie nowa wysokość na podstawie nowej szerokości i proporcji
            const newHeight = newWidth / aspectRatio;

            // Jeśli ciągniemy za górny uchwyt ('n' - north), musimy przesunąć Y.
            // Jeśli element rośnie, newHeight > startHeight, różnica jest ujemna -> Y maleje (idzie w górę).
            // Jeśli element maleje, newHeight < startHeight, różnica jest dodatnia -> Y rośnie (idzie w dół).
            if (isResizing.includes('n')) {
                newY = startTop + (startHeight - newHeight);
            }
            // Dla dolnych uchwytów ('s') Y pozostaje bez zmian (startTop), co jest poprawne,
            // bo element rośnie "w dół".
        }
        
        setLocalWidth(newWidth);
        // Aktualizujemy X i Y jednocześnie
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
        // Wysokość jest automatyczna na podstawie szerokości i zawartości (GIFa)
        cursor: isDragging ? 'grabbing' : 'grab',
        border: isSelected ? '2px solid #3498db' : '2px solid transparent',
        zIndex: isSelected ? 100 : 10,
        userSelect: 'none',
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
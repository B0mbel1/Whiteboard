// src/components/Canvas/DraggableResizableWrapper.jsx
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
  aspectRatioLocked = true // Dla obrazów chcemy zachować proporcje
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const wrapperRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialRect = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Uchwyty do zmiany rozmiaru
  const handles = ['nw', 'ne', 'sw', 'se'];

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('resize-handle')) return; // Nie zaczynaj drag, jeśli kliknięto resize
    e.stopPropagation(); // Ważne: zapobiega rysowaniu na canvasie pod spodem
    onSelect(id);
    
    if(e.button === 0) { // Lewy przycisk myszy
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleResizeMouseDown = (e, handleType) => {
    e.stopPropagation();
    setIsResizing(handleType);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    const rect = wrapperRef.current.getBoundingClientRect();
    initialRect.current = { x, y, width, height: rect.height };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e) => {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;

      if (isDragging) {
        onUpdate(id, { x: x + dx, y: y + dy });
        // Aktualizujemy punkt startowy, żeby ruch był płynny
        dragStartPos.current = { x: e.clientX, y: e.clientY };
      } 
      
      if (isResizing) {
        let newWidth = initialRect.current.width;
        // let newHeight = initialRect.current.height; // (opcjonalne jeśli nie blokujemy aspektu)
        let newX = initialRect.current.x;
        let newY = initialRect.current.y;

        // Logika zmiany rozmiaru zależnie od narożnika
        if (isResizing.includes('e')) newWidth += dx;
        if (isResizing.includes('w')) {
            newWidth -= dx;
            newX += dx;
        }
        
        // Dla obrazów (aspectRatioLocked=true) wysokość dostosuje się sama, 
        // musimy tylko obsłużyć pozycję Y przy skalowaniu od góry ('n')
        if (aspectRatioLocked) {
           if (isResizing.includes('n')) {
               // To jest trudniejsze przy zachowaniu proporcji bez znanej wysokości.
               // Dla uproszczenia w tym przykładzie skupimy się na szerokości,
               // a przeglądarka dostosuje wysokość obrazka automatycznie.
               // Jeśli skalujemy od góry (n), musielibyśmy znać nową wysokość, żeby przesunąć Y.
               // W najprostszej wersji: skalowanie działa najlepiej ciągnąc za dolne rogi (se, sw).
           }
        }

        // Zabezpieczenie minimalnej szerokości
        if (newWidth < minWidth) newWidth = minWidth;

        // Wysyłamy update tylko jeśli coś się zmieniło
        const updates = {};
        if(newWidth !== width) updates.width = newWidth;
        if(newX !== x) updates.x = newX;
        // if(newY !== y) updates.y = newY; // Odkomentuj jeśli implementujesz pełne skalowanie Y

        if(Object.keys(updates).length > 0) {
             onUpdate(id, updates);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    // Nasłuchujemy na całym oknie, żeby nie zgubić kursora przy szybkim ruchu
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, x, y, width, id, onUpdate]);


  return (
    <div
      ref={wrapperRef}
      onClick={(e) => { e.stopPropagation(); onSelect(id); }}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: `${width}px`,
        // height: height ? `${height}px` : 'auto', // Dla GIFów height jest auto
        cursor: isDragging ? 'grabbing' : 'grab',
        border: isSelected ? '2px solid #3498db' : '2px solid transparent',
        zIndex: isSelected ? 100 : 10,
        userSelect: 'none',
        touchAction: 'none'
      }}
    >
      {children}

      {/* Uchwyty do zmiany rozmiaru (widoczne tylko gdy zaznaczone) */}
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
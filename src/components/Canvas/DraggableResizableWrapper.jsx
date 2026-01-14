import React, { useState, useEffect, useRef } from 'react';

const DraggableResizableWrapper = ({
  id,
  x,
  y,
  width,
  height,
  isSelected,
  onSelect,
  onUpdate,
  children,
  minWidth = 50,
  minHeight = 50,
  aspectRatioLocked = false,
  aspectRatio = 1,
  style,
  panOffset,
  limit = 2500,
  zoom = 1
}) => {
  // Stan do renderowania (wizualny)
  const [localPos, setLocalPos] = useState({ x, y });
  const [localSize, setLocalSize] = useState({
    width,
    height: height || (aspectRatioLocked ? width / aspectRatio : width)
  });

  // REFS: Trzymają aktualne dane bez czekania na re-render (TO NAPRAWIA SNAP-BACK)
  const posRef = useRef({ x, y });
  const sizeRef = useRef({ width, height });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const resizeStartRef = useRef({
    x: 0, y: 0,
    startWidth: 0, startHeight: 0,
    startLeft: 0, startTop: 0
  });
  const wrapperRef = useRef(null);

  // Synchronizacja z propsami (gdy przychodzą zmiany z zewnątrz/zooma)
  useEffect(() => {
    // Aktualizujemy tylko jeśli NIE przeciągamy (żeby nie walczyć z użytkownikiem)
    if (!isDragging && !isResizing) {
      setLocalPos({ x, y });
      const newHeight = height !== undefined
        ? height
        : (aspectRatioLocked ? width / aspectRatio : width);

      setLocalSize({ width, height: newHeight });

      // Aktualizujemy też refy!
      posRef.current = { x, y };
      sizeRef.current = { width, height: newHeight };
    }
  }, [x, y, width, height, aspectRatioLocked, aspectRatio, zoom, isDragging, isResizing]);

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    e.stopPropagation();
    if (onSelect) onSelect(id);

    if (e.button === 0) {
      setIsDragging(true);
      // Zapisujemy punkt startowy
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        startX: posRef.current.x, // Bierzemy z Ref, nie ze State
        startY: posRef.current.y
      };
    }
  };

  const handleResizeMouseDown = (e, handleType) => {
    e.stopPropagation();
    e.preventDefault();
    if (onSelect) onSelect(id);
    setIsResizing(handleType);

    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startWidth: sizeRef.current.width,
      startHeight: sizeRef.current.height,
      startLeft: posRef.current.x,
      startTop: posRef.current.y
    };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e) => {
      e.preventDefault();

      // --- DRAGGING ---
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        let newX = dragStartRef.current.startX + dx;
        let newY = dragStartRef.current.startY + dy;

        if (panOffset) {
          // Przeliczenie na współrzędne świata dla limitów
          const worldX = (newX - panOffset.x) / zoom;
          const worldY = (newY - panOffset.y) / zoom;
          const worldWidth = sizeRef.current.width / zoom;
          const worldHeight = sizeRef.current.height / zoom;

          const clampedWorldX = Math.max(-limit, Math.min(worldX, limit - worldWidth));
          const clampedWorldY = Math.max(-limit, Math.min(worldY, limit - worldHeight));

          newX = (clampedWorldX * zoom) + panOffset.x;
          newY = (clampedWorldY * zoom) + panOffset.y;
        }

        // Aktualizacja Refa (natychmiastowa)
        posRef.current = { x: newX, y: newY };
        // Aktualizacja State (wizualna)
        setLocalPos({ x: newX, y: newY });

        if (onUpdate) onUpdate(id, { x: newX, y: newY });
      }

      // --- RESIZING ---
      if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.x;
        const dy = e.clientY - resizeStartRef.current.y;

        const { startWidth, startHeight, startLeft, startTop } = resizeStartRef.current;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startLeft;
        let newY = startTop;

        if (isResizing.includes('e')) newWidth = startWidth + dx;
        if (isResizing.includes('w')) { newWidth = startWidth - dx; newX = startLeft + dx; }
        if (isResizing.includes('s')) newHeight = startHeight + dy;
        if (isResizing.includes('n')) { newHeight = startHeight - dy; newY = startTop + dy; }

        if (aspectRatioLocked) {
          if (isResizing.includes('e') || isResizing.includes('w')) {
            newHeight = newWidth / aspectRatio;
            if (isResizing.includes('n')) newY = startTop + (startHeight - newHeight);
          }
        }

        const minWScaled = minWidth * zoom;
        const minHScaled = minHeight * zoom;

        if (newWidth < minWScaled) { if (isResizing.includes('w')) newX = startLeft + startWidth - minWScaled; newWidth = minWScaled; }
        if (newHeight < minHScaled) { if (isResizing.includes('n')) newY = startTop + startHeight - minHScaled; newHeight = minHScaled; }

        // Aktualizacja Refów
        sizeRef.current = { width: newWidth, height: newHeight };
        posRef.current = { x: newX, y: newY };

        // Aktualizacja State
        setLocalSize({ width: newWidth, height: newHeight });
        setLocalPos({ x: newX, y: newY });

        if (onUpdate) onUpdate(id, { x: newX, y: newY, width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      // 🔹 FIX: Używamy danych z posRef.current i sizeRef.current.
      // Są one zawsze aktualne, nawet jeśli React jeszcze nie przerysował komponentu.
      if (onUpdate && (isDragging || isResizing)) {
        onUpdate(id, {
          x: posRef.current.x,
          y: posRef.current.y,
          width: sizeRef.current.width,
          height: sizeRef.current.height
        });
      }

      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, id, onUpdate, minWidth, minHeight, panOffset, limit, zoom, aspectRatioLocked, aspectRatio]);

  const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

  return (
    <div
      ref={wrapperRef}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); if (onSelect) onSelect(id); }}
      style={{
        position: 'absolute',
        left: localPos.x,
        top: localPos.y,
        width: `${localSize.width}px`,
        height: `${localSize.height}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
        boxSizing: 'border-box',
        border: isSelected ? '2px solid #3498db' : '2px solid transparent',
        // overflow: 'hidden',
        zIndex: isSelected ? 20 : 10,
        userSelect: 'none',
        touchAction: 'none',
        ...style
      }}
    >

      {(isDragging || isResizing) && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 9999, // Musi być na samym wierzchu
          cursor: isDragging ? 'grabbing' : 'nwse-resize'
        }} />
      )}
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
            zIndex: 21,
            boxSizing: 'content-box',
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
  if (handle === 'n' || handle === 's') { style.left = '50%'; style.transform = 'translateX(-50%)'; style.cursor = 'ns-resize'; }
  if (handle === 'e' || handle === 'w') { style.top = '50%'; style.transform = 'translateY(-50%)'; style.cursor = 'ew-resize'; }
  if (handle === 'nw' || handle === 'se') style.cursor = 'nwse-resize';
  if (handle === 'ne' || handle === 'sw') style.cursor = 'nesw-resize';
  return style;
};

export default DraggableResizableWrapper;
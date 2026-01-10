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
  style,
  panOffset,
  limit = 1500,
  zoom = 1 // 🔹 Odbieramy zoom (domyślnie 1)
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
    e.preventDefault();
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
      e.preventDefault();

      // --- PRZESUWANIE (DRAGGING) ---
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        let newX = dragStartRef.current.startX + dx;
        let newY = dragStartRef.current.startY + dy;

        if (panOffset) {
          const currentHeight = wrapperRef.current ? wrapperRef.current.offsetHeight : 0;

          // 1. Konwersja Screen -> World (dzielimy przez zoom)
          const worldX = (newX - panOffset.x) / zoom;
          const worldY = (newY - panOffset.y) / zoom;

          // 2. Obliczamy wymiary w Świecie (dzielimy przez zoom)
          const worldWidth = localWidth / zoom;
          const worldHeight = currentHeight / zoom;

          // 3. CLAMP (blokada w świecie)
          const clampedWorldX = Math.max(-limit, Math.min(worldX, limit - worldWidth));
          const clampedWorldY = Math.max(-limit, Math.min(worldY, limit - worldHeight));

          // 4. Konwersja World -> Screen (mnożymy przez zoom)
          newX = (clampedWorldX * zoom) + panOffset.x;
          newY = (clampedWorldY * zoom) + panOffset.y;
        }
        setLocalPos({ x: newX, y: newY });

        if (onUpdate) {
          // Tutaj przekazujemy pozycję EKRANOWĄ. Canvas.jsx przeliczy to z powrotem na świat w onUpdate.
          onUpdate(id, { x: newX, y: newY });
        }
      }

      // --- SKALOWANIE (RESIZING) ---
      if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.x;
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

        // Minimalna szerokość (skalowana zoomem)
        const minWidthScaled = minWidth * zoom;

        if (newWidth < minWidthScaled) {
          if (isResizing.includes('w')) newX = (startLeft + startWidth) - minWidthScaled;
          newWidth = minWidthScaled;
        }

        // --- 🔹 LOGIKA OGRANICZEŃ (CLAMP) DLA SKALOWANIA Z ZOOMEM 🔹 ---
        if (panOffset) {
          const worldX = (newX - panOffset.x) / zoom;
          const worldWidth = newWidth / zoom; // Szerokość w świecie

          // A. Rozciąganie w prawo (sprawdzamy prawą granicę)
          if (!isResizing.includes('w')) {
            const rightEdge = worldX + worldWidth;
            if (rightEdge > limit) {
              // Obliczamy maksymalną dozwoloną szerokość w świecie i zamieniamy na piksele
              const maxWorldWidth = limit - worldX;
              newWidth = maxWorldWidth * zoom;
            }
          }
          // B. Rozciąganie w lewo (sprawdzamy lewą granicę)
          else {
            if (worldX < -limit) {
              const overflowWorld = -limit - worldX; // Ile wyszliśmy (wartość dodatnia w świecie)
              const overflowScreen = overflowWorld * zoom; // Zamiana na piksele

              newX += overflowScreen;
              newWidth -= overflowScreen;
            }
          }
        }

        // Oblicz wysokość z proporcji
        if (aspectRatioLocked) {
          const newHeight = newWidth / aspectRatio;
          if (isResizing.includes('n')) {
            newY = startTop + (startHeight - newHeight);

            // Clampowanie góry (Y) przy zmianie rozmiaru
            if (panOffset) {
                const worldY = (newY - panOffset.y) / zoom;
                if (worldY < -limit) {
                    // Opcjonalnie: zablokuj wzrost, jeśli wychodzimy poza górną krawędź
                    // (Implementacja blokady w trybie aspect ratio jest skomplikowana UX-owo, 
                    // więc często się ją pomija lub po prostu blokuje Y, co psuje proporcje.
                    // Najprostsza wersja: zostawiamy to lub dodajemy logikę cofania zmian)
                }
            }
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
  }, [isDragging, isResizing, id, onUpdate, localPos.x, localPos.y, minWidth, aspectRatioLocked, panOffset, limit, zoom]); // 🔹 Dodano zoom do zależności

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
        zIndex: isSelected ? 20 : 10,
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
            zIndex: 21,
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
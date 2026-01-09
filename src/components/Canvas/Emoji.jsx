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
  tool,
  panOffset,
  limit = 1500
}) => {
  const [isResizing, setIsResizing] = useState(false);
  
  // Przechowujemy początkowe wartości, żeby resize był płynny
  const resizeStartRef = useRef({ 
    y: 0, 
    startSize: 0,
    startX: 0, // 🔹 Dodane: Zapamiętujemy pozycję startową
    startY: 0 
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const BORDER_BUFFER = 6; 

  // 1. Logika SKALOWANIA (ZMODYFIKOWANA)
  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      y: e.clientY,
      startSize: size,
      startX: x, // 🔹 Zapamiętujemy X
      startY: y  // 🔹 Zapamiętujemy Y
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e) => {
      const deltaY = e.clientY - resizeStartRef.current.y;
      
      // 1. Obliczamy nowy rozmiar (bez limitów na razie)
      // Pozwalamy mu rosnąć, nawet jeśli jest przy ścianie
      let newSize = Math.max(16, resizeStartRef.current.startSize + deltaY);

      // Pobieramy aktualną pozycję (dla płynności używamy prop 'x' i 'y' lub refów, 
      // tutaj bazujemy na propsach przekazywanych z góry, które są aktualizowane przez onUpdate)
      let newScreenX = x;
      let newScreenY = y;

      if (panOffset) {
        // --- LOGIKA "ODPYCHANIA" OD ŚCIAN ---

        // 2. Konwersja na świat
        let worldX = newScreenX - panOffset.x;
        let worldY = newScreenY - panOffset.y;

        // Promień (połowa rozmiaru) + bufor ramki
        const halfSize = (newSize + BORDER_BUFFER) / 2;

        // 3. Sprawdzamy kolizje z każdą ścianą
        // Jeśli nowa krawędź (worldX + halfSize) wychodzi poza limit...
        // ...to przesuwamy środek (worldX) w lewo, żeby krawędź została na limicie.
        
        // Prawa ściana
        if (worldX + halfSize > limit) {
          worldX = limit - halfSize;
        }
        // Lewa ściana
        else if (worldX - halfSize < -limit) {
          worldX = -limit + halfSize;
        }

        // Dolna ściana
        if (worldY + halfSize > limit) {
          worldY = limit - halfSize;
        }
        // Górna ściana
        else if (worldY - halfSize < -limit) {
          worldY = -limit + halfSize;
        }

        // 4. Aktualizujemy współrzędne ekranowe po przesunięciu
        newScreenX = worldX + panOffset.x;
        newScreenY = worldY + panOffset.y;
      }

      // 5. Wysyłamy aktualizację ZARÓWNO rozmiaru JAK I pozycji
      onUpdate(id, { 
        size: newSize,
        x: newScreenX,
        y: newScreenY
      });
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
  }, [isResizing, id, onUpdate, x, y, panOffset, limit]);

  // 2. Logika PRZESUWANIA (Bez zmian)
  const handleDragStart = (e) => {
    e.stopPropagation();
    if (e.target.tagName === 'BUTTON' || isResizing) return;

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
      let newScreenX = e.clientX - dragOffsetRef.current.x;
      let newScreenY = e.clientY - dragOffsetRef.current.y;

      if (panOffset) {
        const worldX = newScreenX - panOffset.x;
        const worldY = newScreenY - panOffset.y;

        const halfSize = (size + BORDER_BUFFER) / 2;
        
        const minBound = -limit + halfSize;
        const maxBound = limit - halfSize;

        const clampedWorldX = Math.max(minBound, Math.min(worldX, maxBound));
        const clampedWorldY = Math.max(minBound, Math.min(worldY, maxBound));

        newScreenX = clampedWorldX + panOffset.x;
        newScreenY = clampedWorldY + panOffset.y;
      }

      onUpdate(id, { x: newScreenX, y: newScreenY });
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
  }, [isDragging, id, onUpdate, panOffset, limit, size]);

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
        width: `${size}px`,
        height: `${size}px`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: `${size}px`,
        cursor: isDragging ? 'grabbing' : (selected ? 'grab' : 'pointer'),
        border: selected || isResizing ? '2px dashed #3498db' : '2px solid transparent',
        lineHeight: 1,
        borderRadius: '4px',
        transform: 'translate(-50%, -50%)', 
        userSelect: 'none',
        zIndex: isDragging || isResizing ? 20 : (selected ? 11 : 10),
        touchAction: 'none',
        pointerEvents: isDrawingTool ? 'none' : 'auto',
        overflow: 'visible' 
      }}
    >
      <span style={{ pointerEvents: 'none' }}>{emoji}</span>

      {selected && !isDragging && !isResizing && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
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

      {(selected || isResizing) && (
        <div
          onMouseDown={handleResizeStart}
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
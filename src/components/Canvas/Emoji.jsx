import React, { useState, useEffect, useRef } from 'react';

// 🔹 Dodajemy zoom do propsów (domyślnie 1)
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
  limit = 1500,
  zoom = 1 
}) => {
  const [isResizing, setIsResizing] = useState(false);
  
  const resizeStartRef = useRef({ 
    y: 0, 
    startSize: 0,
    startX: 0, 
    startY: 0 
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const BORDER_BUFFER = 6; 

  // 1. Logika SKALOWANIA (Z POPRAWKĄ NA ZOOM)
  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      y: e.clientY,
      startSize: size, // To jest rozmiar ekranowy (już przemnożony przez zoom w Canvas)
      startX: x, 
      startY: y  
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e) => {
      const deltaY = e.clientY - resizeStartRef.current.y;
      
      // 1. Obliczamy nowy rozmiar EKRANOWY
      // Minimalny rozmiar to 16px (skalowane zoomem, żeby nie zniknęło przy oddaleniu)
      let newScreenSize = Math.max(16 * zoom, resizeStartRef.current.startSize + deltaY);

      let newScreenX = x;
      let newScreenY = y;

      if (panOffset) {
        // --- LOGIKA "ODPYCHANIA" OD ŚCIAN Z ZOOMEM ---

        // 2. Konwersja na świat (Screen -> World)
        let worldX = (newScreenX - panOffset.x) / zoom;
        let worldY = (newScreenY - panOffset.y) / zoom;
        
        // Rozmiar w świecie
        const worldSize = newScreenSize / zoom;

        // Promień (połowa rozmiaru) + bufor ramki (w jednostkach świata)
        // Dzielimy BORDER_BUFFER przez zoom, żeby ramka była stała wizualnie
        const halfSizeWorld = (worldSize + (BORDER_BUFFER / zoom)) / 2;

        // 3. Sprawdzamy kolizje w świecie
        
        // Prawa ściana
        if (worldX + halfSizeWorld > limit) {
          worldX = limit - halfSizeWorld;
        }
        // Lewa ściana
        else if (worldX - halfSizeWorld < -limit) {
          worldX = -limit + halfSizeWorld;
        }

        // Dolna ściana
        if (worldY + halfSizeWorld > limit) {
          worldY = limit - halfSizeWorld;
        }
        // Górna ściana
        else if (worldY - halfSizeWorld < -limit) {
          worldY = -limit + halfSizeWorld;
        }

        // 4. Powrót na ekran (World -> Screen)
        newScreenX = (worldX * zoom) + panOffset.x;
        newScreenY = (worldY * zoom) + panOffset.y;
      }

      // 5. Wysyłamy aktualizację (wartości ekranowe)
      // Canvas.jsx w onUpdate podzieli je przez zoom przed zapisem do bazy
      onUpdate(id, { 
        size: newScreenSize,
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
  }, [isResizing, id, onUpdate, x, y, panOffset, limit, zoom]);

  // 2. Logika PRZESUWANIA (Z POPRAWKĄ NA ZOOM)
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
        // 1. Konwersja Screen -> World
        const worldX = (newScreenX - panOffset.x) / zoom;
        const worldY = (newScreenY - panOffset.y) / zoom;

        // Rozmiar w świecie i bufor
        const worldSize = size / zoom;
        const halfSizeWorld = (worldSize + (BORDER_BUFFER / zoom)) / 2;
        
        // Granice w świecie
        const minBound = -limit + halfSizeWorld;
        const maxBound = limit - halfSizeWorld;

        // 2. Clamp w świecie
        const clampedWorldX = Math.max(minBound, Math.min(worldX, maxBound));
        const clampedWorldY = Math.max(minBound, Math.min(worldY, maxBound));

        // 3. Konwersja World -> Screen
        newScreenX = (clampedWorldX * zoom) + panOffset.x;
        newScreenY = (clampedWorldY * zoom) + panOffset.y;
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
  }, [isDragging, id, onUpdate, panOffset, limit, size, zoom]); // Dodano zoom do zależności

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
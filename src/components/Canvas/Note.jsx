import React, { useState, useRef, useEffect } from 'react';
import './Note.css';

const Note = ({
  id,
  x,
  y,
  width,
  height,
  initialText = '',
  onUpdate,
  onRemove,
  selectedNoteId,
  setSelectedNoteId,
  socket,
  tool,
  panOffset,
  limit = 1500,
  zoom = 1
}) => {
  const [text, setText] = useState(initialText);
  // x i y przychodzą z Canvas już przeliczone (World * Zoom + Pan)
  const [pos, setPos] = useState({ x, y });
  const [size, setSize] = useState({ width: width || 180, height: height || 120 });
  
  const noteRef = useRef(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastPosition = useRef({ x, y });

  const isDrawingTool = ['pencil', 'brush', 'eraser'].includes(tool);

  // Synchronizuj zmiany z serwera (tylko tekst i rozmiar, pozycja jest zarządzana przez Canvas props)
  useEffect(() => {
    if (socket) {
      const handleNoteUpdate = (data) => {
        if (data.id === id) {
          if (data.text !== undefined) setText(data.text);
          if (data.size) setSize(data.size);
        }
      };
      socket.on('note-update', handleNoteUpdate);
      return () => { socket.off('note-update', handleNoteUpdate); };
    }
  }, [socket, id]);

  // ✅ POPRAWKA: Synchronizuj pozycję z props TYLKO jeśli nie przeciągamy
  useEffect(() => {
    if (!isDragging.current) {
      setPos({ x, y });
    }
  }, [x, y, zoom]); // Reaguj na zmianę zoomu i pozycji od rodzica

  const handleMouseDown = (e) => {
    if (isDrawingTool) return;
    
    // Ustawiamy notatkę jako wybraną
    setSelectedNoteId(id);
    lastPosition.current = { ...pos };

    // ✅ POPRAWKA: Używamy .closest(), aby złapać kliknięcie też w ikonę wewnątrz nagłówka
    if (e.target.closest('.note-header')) {
      isDragging.current = true;
      // Obliczamy offset myszki względem lewego górnego rogu notatki
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;

    // Oblicz nową surową pozycję ekranową
    let newScreenX = e.clientX - dragOffset.current.x;
    let newScreenY = e.clientY - dragOffset.current.y;

    // --- LOGIKA OGRANICZEŃ (LIMIT) ---
    // Musimy przeliczyć pozycję na "Świat" (World Coordinates), sprawdzić limit, i wrócić na ekran
    if (panOffset) {
      // 1. Screen -> World
      const worldX = (newScreenX - panOffset.x) / zoom;
      const worldY = (newScreenY - panOffset.y) / zoom;

      // 2. Clamp (ograniczenie)
      const clampedWorldX = Math.max(-limit, Math.min(worldX, limit - size.width));
      const clampedWorldY = Math.max(-limit, Math.min(worldY, limit - size.height));

      // 3. World -> Screen
      newScreenX = (clampedWorldX * zoom) + panOffset.x;
      newScreenY = (clampedWorldY * zoom) + panOffset.y;
    }
    // -------------------------

    setPos({ x: newScreenX, y: newScreenY });
  };

  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;

      const positionChanged = pos.x !== lastPosition.current.x || pos.y !== lastPosition.current.y;

      if (positionChanged && onUpdate) {
        // Wysyłamy do Canvas pozycję ekranową. 
        // Canvas.jsx w funkcji onUpdate przeliczy to z powrotem na World Coordinates (dzieląc przez zoom).
        onUpdate(id, {
          position: { x: pos.x, y: pos.y },
          text,
          size
        });
      }
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  const handleTextBlur = () => {
    if (onUpdate && text !== initialText) {
      onUpdate(id, {
        position: { x: pos.x, y: pos.y },
        text,
        size
      });
    }
  };

  const handleResize = (newWidth, newHeight) => {
    const updatedSize = {
      width: newWidth > 100 ? newWidth : 100,
      height: newHeight > 80 ? newHeight : 80
    };
    setSize(updatedSize);

    if (onUpdate) {
      onUpdate(id, { position: pos, text, size: updatedSize });
    }
  };

  useEffect(() => {
    // Podpinamy globalne listenery, żeby nie zgubić "upuszczenia" notatki poza jej obszarem
    if (isDragging.current) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    // Cleanup
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }); // Bez dependency array, żeby mieć zawsze świeże closure, ale optymalniej byłoby użyć refów lub useCallback

  // 🔹 ALTERNATYWNE PODEJŚCIE DO LISTENERÓW (BEZPIECZNIEJSZE DLA REACTA)
  // Zamiast powyższego useEffect, dodajemy listenery w handleMouseDown, a usuwamy w handleMouseUp.
  // Poniżej poprawiona wersja, która jest bardziej stabilna:

  useEffect(() => {
    const onMove = (e) => handleMouseMove(e);
    const onUp = (e) => handleMouseUp(e);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pos, zoom, panOffset]); // Zależności są ważne dla poprawnych obliczeń wewnątrz funkcji

  return (
    <div
      ref={noteRef}
      className={`note ${selectedNoteId === id ? 'selected-note' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
        pointerEvents: isDrawingTool ? 'none' : 'auto',
        // Skalujemy wizualnie, origin w lewym górnym rogu, żeby pasował do left/top
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        position: 'absolute' 
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="note-header">
        🗒️
        <button className="note-close" onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}>✕</button>
      </div>
      <textarea
        className="note-text"
        value={text}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        placeholder="Twoja notatka..."
        onMouseDown={(e) => e.stopPropagation()}
        disabled={isDrawingTool}
      />
      <div
        className="note-resizer"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = size.width;
          const startHeight = size.height;

          const handleResizeMove = (moveEvent) => {
            // Dzielimy deltę przez zoom, żeby skalowanie myszki pasowało do skalowania wizualnego
            const deltaX = (moveEvent.clientX - startX) / zoom;
            const deltaY = (moveEvent.clientY - startY) / zoom;
            
            const newWidth = startWidth + deltaX;
            const newHeight = startHeight + deltaY;
            handleResize(newWidth, newHeight);
          };

          const stopResize = () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', stopResize);
          };

          window.addEventListener('mousemove', handleResizeMove);
          window.addEventListener('mouseup', stopResize);
        }}
      />
    </div>
  );
};

export default Note;
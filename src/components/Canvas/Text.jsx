import React, { useState, useEffect, useRef } from 'react';
import './Text.css';

const Text = ({ id, x, y, width, height, text: initialText, onUpdate, onRemove, selected, setSelected, socket,tool }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(initialText || '');
  const [position, setPosition] = useState({ x: x || 0, y: y || 0 });
  const [size, setSize] = useState({ width: width || 200, height: height || 100 });
  const textareaRef = useRef(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isResizing = useRef(false);

  const isDrawingTool = ['pencil', 'brush', 'eraser'].includes(tool);

  useEffect(() => {
    if (socket) {
      const handleTextUpdate = (data) => {
        if (data.id === id) {
          console.log("📝 Text update received:", data);
          if (data.position) {
            setPosition(data.position);
          } else if (data.x !== undefined && data.y !== undefined) {
            setPosition({ x: data.x, y: data.y });
          }
          if (data.text !== undefined) setText(data.text);
          if (data.size) setSize(data.size);
        }
      };
      socket.on('text-update', handleTextUpdate);
      return () => {
        socket.off('text-update', handleTextUpdate);
      };
    }
  }, [socket, id]);

  useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  const handleMouseDown = (e) => {
    if (isDrawingTool) return;
    if (isEditing || e.target.classList.contains('resize-handle')) {
      return;
    }
    setSelected(id);
    if (!e.target.classList.contains('resize-handle')) {
      isDragging.current = true;
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging.current) {
      e.preventDefault(); // 🔹 DODANE: Blokuje zaznaczanie podczas przesuwania
      const newPos = {
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      };
      setPosition(newPos);
    }
  };

  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
      if (onUpdate) {
        onUpdate(id, { position, text, size });
      }
    }
    if (isResizing.current) {
      isResizing.current = false;
      if (onUpdate) {
        onUpdate(id, { position, text, size });
      }
    }
  };

  const handleResizeMouseDown = (e) => {
    if (isDrawingTool) return;
    e.stopPropagation();
    e.preventDefault(); // 🔹 DODANE
    isResizing.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleResizeMove = (moveEvent) => {
      moveEvent.preventDefault(); // 🔹 DODANE: Blokuje zaznaczanie podczas skalowania
      const newWidth = startWidth + (moveEvent.clientX - startX);
      const newHeight = startHeight + (moveEvent.clientY - startY);
      setSize({
        width: newWidth > 50 ? newWidth : 50,
        height: newHeight > 30 ? newHeight : 30
      });
    };

    const stopResize = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', stopResize);
      if (onUpdate) {
        onUpdate(id, { position, text, size });
      }
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', stopResize);
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    setSelected(id);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onUpdate) {
      onUpdate(id, { position, text, size });
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
  };

  useEffect(() => {
    if (isEditing) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [position]);

  return (
    <div
      className={`text-box ${selected ? 'selected' : ''}`}
      style={{
        top: position.y,
        left: position.x,
        width: size.width,
        height: size.height,
        zIndex: selected ? 20 : 10,
        pointerEvents: isDrawingTool ? 'none' : 'auto'
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="text-input"
          style={{ width: '100%', height: '100%' }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={isDrawingTool}
        />
      ) : (
        <div className="text-display">
          {text || 'Double click to edit'}
        </div>
      )}
      {selected && (
        <div
          className="resize-handle"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  );
};

export default Text;
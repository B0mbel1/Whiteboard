import React, { useState, useEffect, useRef } from 'react';
import './Text.css';

const Text = ({ id, x, y, width, height, text: initialText, onUpdate, onRemove, selected, setSelected, socket }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(initialText || '');
  const [position, setPosition] = useState({ x: x || 0, y: y || 0 });
  const [size, setSize] = useState({ width: width || 200, height: height || 100 });
  const textareaRef = useRef(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isResizing = useRef(false);

  // Synchronizuj zmiany z serwera
  useEffect(() => {
    if (socket) {
      const handleTextUpdate = (data) => {
        if (data.id === id) {
          if (data.position) setPosition(data.position);
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

  const handleMouseDown = (e) => {
    if (isEditing) return;
    
    setSelected(id);
    
    if (!e.target.classList.contains('resize-handle')) {
      isDragging.current = true;
      dragOffset.current = { 
        x: e.clientX - position.x, 
        y: e.clientY - position.y 
      };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging.current) {
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
    e.stopPropagation();
    isResizing.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleResizeMove = (moveEvent) => {
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
        height: size.height 
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
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
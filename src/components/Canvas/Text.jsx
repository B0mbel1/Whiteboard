import React, { useState, useEffect, useRef } from 'react';
import './Text.css';

const Text = ({ id, x, y, width, height, onUpdate, onRemove, selected, setSelected, socket }) => {
  const [isEditing, setIsEditing] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [text, setText] = useState('');
  const [position, setPosition] = useState({ x, y });
  const [size, setSize] = useState({ width: width || 200, height: height || 100 });
  const textareaRef = useRef(null);
  const textRef = useRef(null);

  const handleMouseDown = (e) => {
    if (isEditing || isResizing) return;
    setIsDragging(true);
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e) => {
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onUpdate(id, { position: { x: position.x, y: position.y }, text, size });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMouseMove = (e) => {
      const newWidth = startWidth + (e.clientX - startX);
      const newHeight = startHeight + (e.clientY - startY);
      setSize({ width: newWidth > 50 ? newWidth : 50, height: newHeight > 30 ? newHeight : 30 });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onUpdate(id, { position, text, size });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setSelected(null);
    onUpdate(id, { position, text, size });
  };

  const handleChange = (e) => {
    setText(e.target.value);
  };

  useEffect(() => {
    if (isEditing) {
      textareaRef.current.focus();
    }
  }, [isEditing]);
  
  useEffect(() => {
    if (socket) {
      const handleTextUpdate = (data) => {
        if (data.id === id) {
          setPosition(data.position);
          setText(data.text);
          if (data.size) {
            setSize(data.size);
          }
        }
      };
      socket.on('text-update', handleTextUpdate);
      return () => {
        socket.off('text-update', handleTextUpdate);
      };
    }
  }, [socket, id]);

  return (
    <div
      className={`text-box ${(selected || isEditing || isResizing) ? 'selected' : ''}`}
      style={{ top: position.y, left: position.x, width: size.width, height: size.height }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onClick={() => {
        if (!isEditing) {
          setSelected(id);
        }
      }}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          className="text-input"
        />
      ) : (
        <div ref={textRef} className="text-display">
          {text || 'Click to edit'}
        </div>
      )}
      {(selected || isEditing || isResizing) && (
        <div className="resize-handle" onMouseDown={handleResizeMouseDown}></div>
      )}
    </div>
  );
};

export default Text;

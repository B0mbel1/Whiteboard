import React, { useState, useEffect, useRef } from 'react';
import './Text.css';

const Text = ({ id, x, y, onUpdate, onRemove, selected, setSelected, socket }) => {
  const [isEditing, setIsEditing] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [text, setText] = useState('');
  const [position, setPosition] = useState({ x, y });
  const textareaRef = useRef(null);
  const textRef = useRef(null);

  const handleMouseDown = (e) => {
    if (isEditing) return;
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
      onUpdate(id, { position: { x: position.x, y: position.y }, text });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onUpdate(id, { position, text });
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
      className={`text-box ${selected ? 'selected' : ''}`}
      style={{ top: position.y, left: position.x }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onClick={() => setSelected(id)}
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
    </div>
  );
};

export default Text;

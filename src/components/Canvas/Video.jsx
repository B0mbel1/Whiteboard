import React, { useState, useRef, useEffect } from 'react';
import './Video.css';

const Video = ({
  id,
  x,
  y,
  width = 200,
  height = 150,
  url,
  playing = false,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  tool
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [isPlaying, setIsPlaying] = useState(playing);
  const videoRef = useRef(null);

  const handleMouseDown = (e) => {
    if (tool !== 'cursor') return;
    e.stopPropagation();
    onSelect(id);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    // Sprawdź czy kliknięto w narożnik do zmiany rozmiaru
    const resizeHandleSize = 8;
    const isInResizeArea = 
      offsetX > width - resizeHandleSize && 
      offsetY > height - resizeHandleSize;
    
    if (isInResizeArea) {
      setIsResizing(true);
      setResizeDirection('se'); // southeast corner
    } else {
      setIsDragging(true);
      setDragOffset({ x: offsetX, y: offsetY });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && selected) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      onUpdate(id, { x: newX, y: newY });
    } else if (isResizing && selected) {
      const newWidth = Math.max(100, e.clientX - x);
      const newHeight = Math.max(75, e.clientY - y);
      onUpdate(id, { width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeDirection(null);
  };

  const handleTogglePlay = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    onUpdate(id, { playing: newPlayingState });
    
    if (videoRef.current) {
      if (newPlayingState) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleDoubleClick = () => {
    handleTogglePlay();
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging || isResizing) {
        setIsDragging(false);
        setIsResizing(false);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, isResizing]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  return (
    <div
      className={`video-item ${selected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: width,
        height: height,
        cursor: tool === 'cursor' ? (isDragging ? 'grabbing' : 'grab') : 'default'
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className="video-container">
        <video
          ref={videoRef}
          src={url}
          width="100%"
          height="100%"
          controls={false}
          loop
          muted
          style={{
            objectFit: 'cover',
            borderRadius: '4px'
          }}
        />
        
        <div className="video-controls">
          <button 
            className="video-play-button"
            onClick={handleTogglePlay}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "⏸️" : "▶️"}
          </button>
        </div>
        
        {selected && (
          <>
            <div className="video-resize-handle" />
            <button 
              className="video-remove-button"
              onClick={() => onRemove(id)}
              title="Remove video"
            >
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Video;
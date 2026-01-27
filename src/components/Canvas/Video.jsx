import React, { useRef, useEffect, useCallback } from 'react';
import DraggableResizableWrapper from './DraggableResizableWrapper';

const Video = ({
  id,
  x,
  y,
  width,
  height,
  url,
  playing = false,
  currentTime = 0,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  panOffset,
  limit=1500,
  zoom=1,
  socket,
  whiteboardId,
  tool,
  registerVideoRef,
  unregisterVideoRef
}) => {
  const videoRef = useRef(null);
  const isLocalActionRef = useRef(false);
  const isDrawingTool = ['pencil', 'brush', 'eraser'].includes(tool);

  // Zarejestruj/odrejestruj video element
  useEffect(() => {
    if (videoRef.current && registerVideoRef) {
      registerVideoRef(id, videoRef.current);
    }
    
    return () => {
      if (unregisterVideoRef) {
        unregisterVideoRef(id);
      }
    };
  }, [id, registerVideoRef, unregisterVideoRef]);

  // Synchronizuj stan z props
  useEffect(() => {
    if (!videoRef.current) return;
    
    // Synchronizuj czas tylko jeśli różni się znacząco (> 0.5s)
    if (Math.abs(videoRef.current.currentTime - (currentTime || 0)) > 0.5) {
      videoRef.current.currentTime = currentTime || 0;
    }
    
    // Synchronizuj play/pause
    if (playing && videoRef.current.paused) {
      videoRef.current.play().catch(e => console.log("Auto-play prevented:", e));
    } else if (!playing && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [currentTime, playing]);

  const handleVideoPlay = useCallback(() => {
    if (!videoRef.current || isLocalActionRef.current) return;
    
    isLocalActionRef.current = true;
    
    if (onUpdate) {
      onUpdate(id, {
        playing: true,
        currentTime: videoRef.current.currentTime
      });
    }
    
    setTimeout(() => {
      isLocalActionRef.current = false;
    }, 100);
  }, [id, onUpdate]);

  const handleVideoPause = useCallback(() => {
    if (!videoRef.current || isLocalActionRef.current) return;
    
    isLocalActionRef.current = true;
    
    if (onUpdate) {
      onUpdate(id, {
        playing: false,
        currentTime: videoRef.current.currentTime
      });
    }
    
    setTimeout(() => {
      isLocalActionRef.current = false;
    }, 100);
  }, [id, onUpdate]);

  const handleVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current || isLocalActionRef.current) return;
    
    // Emituj update czasu tylko co 2 sekundy lub przy znaczącej zmianie
    const shouldUpdate = 
      Math.abs(videoRef.current.currentTime - (currentTime || 0)) > 2;
    
    if (shouldUpdate && onUpdate) {
      isLocalActionRef.current = true;
      
      onUpdate(id, {
        currentTime: videoRef.current.currentTime,
        playing: !videoRef.current.paused
      });
      
      setTimeout(() => {
        isLocalActionRef.current = false;
      }, 100);
    }
  }, [id, currentTime, onUpdate]);

  const handleVideoSeeked = useCallback(() => {
    if (!videoRef.current || isLocalActionRef.current) return;
    
    isLocalActionRef.current = true;
    
    if (onUpdate) {
      onUpdate(id, {
        currentTime: videoRef.current.currentTime
      });
    }
    
    setTimeout(() => {
      isLocalActionRef.current = false;
    }, 100);
  }, [id, onUpdate]);

  return (
    <DraggableResizableWrapper
      id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      isSelected={selected}
      onSelect={onSelect}
      onUpdate={onUpdate}
      panOffset={panOffset}
      limit={limit}
      zoom={zoom}
      aspectRatioLocked={true}
      aspectRatio={16/9}
      minWidth={100}
      minHeight={60}
      style={{ 
        pointerEvents: isDrawingTool ? 'none' : 'auto',
        overflow: 'hidden'
      }}
    >
      <div style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%',
        background: '#000'
      }}>
        <video
          ref={videoRef}
          src={url}
          width="100%"
          height="100%"
          controls
          onPlay={handleVideoPlay}
          onPause={handleVideoPause}
          onTimeUpdate={handleVideoTimeUpdate}
          onSeeked={handleVideoSeeked}
          style={{ 
            objectFit: "contain",
            display: 'block'
          }}
        />
      </div>
    </DraggableResizableWrapper>
  );
};

export default Video;
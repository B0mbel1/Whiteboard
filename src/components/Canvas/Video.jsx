import React, { useRef, useEffect, useState } from "react";
import DraggableResizableWrapper from "./DraggableResizableWrapper";

const Video = ({
  id,
  x,
  y,
  width,
  height,
  url,
  provider, // "file" | "youtube" | "vimeo"
  playing = false,
  currentTime = 0,
  selected,
  onSelect,
  onUpdate,
  panOffset,
  limit,
  zoom,
  socket,
  whiteboardId,
  tool
}) => {
  const videoRef = useRef(null);
  const isLocalAction = useRef(false);
  const [localState, setLocalState] = useState({
    playing: playing,
    currentTime: currentTime
  });

  // ========== SYNC INITIAL STATE ==========
  useEffect(() => {
    if (provider === "file" && videoRef.current) {
      videoRef.current.currentTime = currentTime;
      
      if (playing && videoRef.current.paused) {
        videoRef.current.play().catch(e => console.log("Autoplay prevented:", e));
      }
    }
  }, []);

  // ========== SOCKET LISTENERS ==========
  useEffect(() => {
    if (!socket || !whiteboardId) return;

    const handleVideoPlay = (data) => {
      if (data.id === id && data.whiteboardId === whiteboardId) {
        if (provider === "file" && videoRef.current) {
          isLocalAction.current = false;
          videoRef.current.currentTime = data.currentTime || 0;
          videoRef.current.play().catch(e => console.log("Play failed:", e));
          setLocalState(prev => ({ ...prev, playing: true, currentTime: data.currentTime }));
        }
      }
    };

    const handleVideoPause = (data) => {
      if (data.id === id && data.whiteboardId === whiteboardId) {
        if (provider === "file" && videoRef.current) {
          isLocalAction.current = false;
          videoRef.current.currentTime = data.currentTime || 0;
          videoRef.current.pause();
          setLocalState(prev => ({ ...prev, playing: false, currentTime: data.currentTime }));
        }
      }
    };

    const handleVideoSeek = (data) => {
      if (data.id === id && data.whiteboardId === whiteboardId) {
        if (provider === "file" && videoRef.current) {
          isLocalAction.current = false;
          videoRef.current.currentTime = data.currentTime || 0;
          setLocalState(prev => ({ ...prev, currentTime: data.currentTime }));
        }
      }
    };

    const handleVideoUpdate = (data) => {
      if (data.id === id && data.whiteboardId === whiteboardId && data.updates) {
        console.log("📡 Received video position/size update:", data.updates);
        // Aktualizuj pozycję/rozmiar
        if (onUpdate) {
          // Konwertuj współrzędne świata na ekran jeśli potrzeba
          onUpdate(id, data.updates);
        }
      }
    };

    socket.on("video-play", handleVideoPlay);
    socket.on("video-pause", handleVideoPause);
    socket.on("video-seek", handleVideoSeek);
    socket.on("video-update", handleVideoUpdate);

    // Request initial sync
    if (socket && whiteboardId && id) {
      socket.emit("video-sync-request", { whiteboardId, videoId: id });
    }

    socket.on("video-sync", (data) => {
      if (data.videoId === id && data.whiteboardId === whiteboardId && videoRef.current) {
        console.log("📡 Received video sync:", data.state);
        isLocalAction.current = false;
        videoRef.current.currentTime = data.state.currentTime || 0;
        
        if (data.state.playing && videoRef.current.paused) {
          videoRef.current.play().catch(e => console.log("Sync play failed:", e));
        } else if (!data.state.playing && !videoRef.current.paused) {
          videoRef.current.pause();
        }
        
        setLocalState(data.state);
      }
    });

    return () => {
      socket.off("video-play", handleVideoPlay);
      socket.off("video-pause", handleVideoPause);
      socket.off("video-seek", handleVideoSeek);
      socket.off("video-update", handleVideoUpdate);
      socket.off("video-sync");
    };
  }, [socket, id, whiteboardId, provider, onUpdate]);

  // ========== LOKALNE AKCJE ==========
  const emitPlay = () => {
    if (!socket || !videoRef.current) return;
    isLocalAction.current = true;
    const currentTime = videoRef.current.currentTime;
    
    socket.emit("video-play", {
      whiteboardId,
      id,
      currentTime: currentTime
    });
    
    if (onUpdate) onUpdate(id, { 
      playing: true, 
      currentTime: currentTime
    });
  };

  const emitPause = () => {
    if (!socket || !videoRef.current) return;
    isLocalAction.current = true;
    const currentTime = videoRef.current.currentTime;
    
    socket.emit("video-pause", {
      whiteboardId,
      id,
      currentTime: currentTime
    });
    
    if (onUpdate) onUpdate(id, { 
      playing: false, 
      currentTime: currentTime
    });
  };

  const emitSeek = () => {
    if (!socket || !videoRef.current) return;
    isLocalAction.current = true;
    
    socket.emit("video-seek", {
      whiteboardId,
      id,
      currentTime: videoRef.current.currentTime
    });
    
    if (onUpdate) onUpdate(id, { currentTime: videoRef.current.currentTime });
  };

  // ========== AKTUALIZACJA POZYCJI/ROZMIARU ==========
  const handlePositionSizeUpdate = (updates) => {
    if (!socket || !whiteboardId) return;
    
    console.log("📤 Emitting video position/size update:", updates);
    
    // Wyślij aktualizację przez socket
    socket.emit("video-update", {
      whiteboardId,
      id,
      updates
    });
    
    // Zaktualizuj lokalny stan
    if (onUpdate) {
      onUpdate(id, updates);
    }
  };

  // ========== RENDER ==========
  return (
    <DraggableResizableWrapper
      id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      isSelected={selected}
      onSelect={onSelect}
      onUpdate={handlePositionSizeUpdate} // 🔹 KLUCZOWE: Emituje zmiany pozycji/rozmiaru
      panOffset={panOffset}
      limit={limit}
      zoom={zoom}
      aspectRatioLocked={true}
      aspectRatio={16/9}
      style={{ pointerEvents: "auto" }}
    >
      {provider === "file" && (
        <video
          ref={videoRef}
          src={url}
          width="100%"
          height="100%"
          controls
          onPlay={emitPlay}
          onPause={emitPause}
          onSeeking={emitSeek}
          style={{ 
            background: "#000",
            objectFit: "contain"
          }}
        />
      )}

      {(provider === "youtube" || provider === "vimeo") && (
        <iframe
          src={url}
          width="100%"
          height="100%"
          allow="autoplay; encrypted-media"
          allowFullScreen
          style={{ 
            border: "none", 
            pointerEvents: "auto",
            aspectRatio: "16/9"
          }}
        />
      )}
    </DraggableResizableWrapper>
  );
};

export default Video;
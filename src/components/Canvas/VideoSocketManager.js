import { useEffect, useRef, useCallback } from 'react';

export const useVideoSocketManager = ({
  socket,
  whiteboardId,
  videos,
  setVideos,
  panOffset,
  zoom,
  onVideoUpdate
}) => {
  const isLocalActionRef = useRef(false);
  const lastUpdateTimeRef = useRef({});
  const videoRefs = useRef({}); // Refy do video elementów

  // Zarejestruj video element
  const registerVideoRef = useCallback((id, videoElement) => {
    if (videoElement) {
      videoRefs.current[id] = videoElement;
    }
  }, []);

  // Wyrejestruj video element
  const unregisterVideoRef = useCallback((id) => {
    delete videoRefs.current[id];
  }, []);

  // Emituj transformację video (pozycja/rozmiar)
  const emitVideoTransform = useCallback((id, updates) => {
    if (!socket || !whiteboardId) return;
    
    // Konwersja: Screen → World coordinates
    const worldUpdates = { ...updates };
    
    if (updates.x !== undefined && panOffset) {
      worldUpdates.x = (updates.x - panOffset.x) / zoom;
    }
    
    if (updates.y !== undefined && panOffset) {
      worldUpdates.y = (updates.y - panOffset.y) / zoom;
    }
    
    if (updates.width !== undefined) {
      worldUpdates.width = updates.width / zoom;
    }
    
    if (updates.height !== undefined) {
      worldUpdates.height = updates.height / zoom;
    }
    
    // Oznacz jako akcję lokalną (żeby nie wchodzić w pętlę)
    isLocalActionRef.current = true;
    
    socket.emit("video-transform", {
      whiteboardId,
      id,
      updates: worldUpdates,
      timestamp: Date.now()
    });
    
    setTimeout(() => {
      isLocalActionRef.current = false;
    }, 100);
    
    console.log("📤 Emitting video transform:", worldUpdates);
  }, [socket, whiteboardId, panOffset, zoom]);

  // Emituj update stanu odtwarzania
  const emitVideoStateUpdate = useCallback((id, updates) => {
    if (!socket || !whiteboardId) return;
    
    // Zapobiegaj zbyt częstym update'om
    const now = Date.now();
    const lastUpdate = lastUpdateTimeRef.current[id] || 0;
    
    if (now - lastUpdate < 300) return; // Min 300ms między update'ami
    
    isLocalActionRef.current = true;
    
    // Pobierz aktualny czas z video elementu jeśli jest dostępny
    const videoElement = videoRefs.current[id];
    if (videoElement && updates.currentTime === undefined) {
      updates.currentTime = videoElement.currentTime;
    }
    
    socket.emit("video-update", {
      whiteboardId,
      id,
      updates,
      timestamp: now
    });
    
    lastUpdateTimeRef.current[id] = now;
    
    setTimeout(() => {
      isLocalActionRef.current = false;
    }, 100);
    
    console.log("📤 Emitting video state update:", updates);
  }, [socket, whiteboardId]);

  // Emituj tworzenie nowego video
  const emitVideoCreate = useCallback((video) => {
    if (!socket || !whiteboardId) return;
    
    socket.emit("video-create", {
      whiteboardId,
      video: {
        ...video,
        playing: false,
        currentTime: 0,
        lastUpdate: Date.now()
      }
    });
  }, [socket, whiteboardId]);

  // Emituj usuwanie video - POPRAWIONE!
  const emitVideoDelete = useCallback((id) => {
    if (!socket || !whiteboardId) return;
    
    console.log(`🗑️ Emitting video delete for ${id}`);
    
    socket.emit("video-delete", {
      whiteboardId,
      id
    });
    
    // Usuń ref
    unregisterVideoRef(id);
  }, [socket, whiteboardId, unregisterVideoRef]);

  // Setup socket listeners - POPRAWIONE!
  useEffect(() => {
    if (!socket) return;

    const handleVideoTransformSocket = (data) => {
      if (isLocalActionRef.current) return;
      if (!data.id || !data.updates) return;
      
      console.log("📥 Received video transform:", data);
      
      // Konwersja: World → Screen coordinates
      const screenUpdates = { ...data.updates };
      
      if (data.updates.x !== undefined && panOffset) {
        screenUpdates.x = (data.updates.x * zoom) + panOffset.x;
      }
      
      if (data.updates.y !== undefined && panOffset) {
        screenUpdates.y = (data.updates.y * zoom) + panOffset.y;
      }
      
      if (data.updates.width !== undefined) {
        screenUpdates.width = data.updates.width * zoom;
      }
      
      if (data.updates.height !== undefined) {
        screenUpdates.height = data.updates.height * zoom;
      }
      
      // Aktualizuj stan lokalny
      setVideos(prev => prev.map(v => 
        v.id === data.id ? { ...v, ...data.updates } : v
      ));
      
      // Wywołaj callback
      if (onVideoUpdate) {
        onVideoUpdate(data.id, data.updates);
      }
    };

    const handleVideoUpdateSocket = (data) => {
      if (isLocalActionRef.current) return;
      if (!data.id || !data.updates) return;
      
      console.log("📥 Received video state update:", data);
      
      // Aktualizuj stan lokalny
      setVideos(prev => prev.map(v => {
        if (v.id === data.id) {
          const updatedVideo = { ...v };
          
          if (data.updates.playing !== undefined) {
            updatedVideo.playing = data.updates.playing;
          }
          if (data.updates.currentTime !== undefined) {
            updatedVideo.currentTime = data.updates.currentTime;
          }
          
          // Zastosuj zmiany do video elementu jeśli jest dostępny
          const videoElement = videoRefs.current[data.id];
          if (videoElement) {
            // Sprawdź czy czas się znacząco różni (> 0.5s)
            if (data.updates.currentTime !== undefined && 
                Math.abs(videoElement.currentTime - data.updates.currentTime) > 0.5) {
              videoElement.currentTime = data.updates.currentTime;
            }
            
            // Zastosuj play/pause
            if (data.updates.playing !== undefined) {
              if (data.updates.playing && videoElement.paused) {
                videoElement.play().catch(e => console.log("Remote play failed:", e));
              } else if (!data.updates.playing && !videoElement.paused) {
                videoElement.pause();
              }
            }
          }
          
          return updatedVideo;
        }
        return v;
      }));
      
      if (onVideoUpdate) {
        onVideoUpdate(data.id, data.updates);
      }
    };

    const handleVideoCreateSocket = (data) => {
      if (!data.video) return;
      
      console.log("📥 Received video create:", data.video);
      
      setVideos(prev => {
        // Sprawdź czy video już istnieje
        if (prev.some(v => v.id === data.video.id)) {
          return prev;
        }
        return [...prev, data.video];
      });
    };

    const handleVideoDeleteSocket = (data) => {
      if (!data.id) return;
      
      console.log("📥 Received video delete:", data.id);
      
      setVideos(prev => {
        const newVideos = prev.filter(v => v.id !== data.id);
        console.log(`🗑️ Deleting video ${data.id}, before: ${prev.length}, after: ${newVideos.length}`);
        return newVideos;
      });
      
      // Usuń ref
      unregisterVideoRef(data.id);
    };

    const handleVideoSync = (data) => {
      if (!data.videoId || !data.state) return;
      
      console.log("🔄 Received video sync:", data);
      
      setVideos(prev => prev.map(v => {
        if (v.id === data.videoId) {
          // Zastosuj sync tylko jeśli różni się znacząco
          const shouldSync = 
            Math.abs((v.currentTime || 0) - (data.state.currentTime || 0)) > 1 ||
            v.playing !== data.state.playing;
          
          if (shouldSync) {
            const videoElement = videoRefs.current[data.videoId];
            if (videoElement) {
              videoElement.currentTime = data.state.currentTime || 0;
              if (data.state.playing && videoElement.paused) {
                videoElement.play().catch(e => console.log("Sync play failed:", e));
              } else if (!data.state.playing && !videoElement.paused) {
                videoElement.pause();
              }
            }
            
            return {
              ...v,
              playing: data.state.playing || false,
              currentTime: data.state.currentTime || 0
            };
          }
        }
        return v;
      }));
    };

    // Nasłuchuj
    socket.on("video-transform", handleVideoTransformSocket);
    socket.on("video-update", handleVideoUpdateSocket);
    socket.on("video-create", handleVideoCreateSocket);
    socket.on("video-delete", handleVideoDeleteSocket);
    socket.on("video-sync", handleVideoSync);

    // Request initial sync po dołączeniu
    if (socket && whiteboardId) {
      setTimeout(() => {
        console.log("🔄 Requesting initial video sync");
        socket.emit("video-sync-request", { whiteboardId });
      }, 1000);
    }

    return () => {
      socket.off("video-transform", handleVideoTransformSocket);
      socket.off("video-update", handleVideoUpdateSocket);
      socket.off("video-create", handleVideoCreateSocket);
      socket.off("video-delete", handleVideoDeleteSocket);
      socket.off("video-sync", handleVideoSync);
    };
  }, [socket, whiteboardId, setVideos, onVideoUpdate, panOffset, zoom, unregisterVideoRef]);

  return {
    emitVideoTransform,
    emitVideoStateUpdate,
    emitVideoCreate,
    emitVideoDelete,
    registerVideoRef,
    unregisterVideoRef
  };
};
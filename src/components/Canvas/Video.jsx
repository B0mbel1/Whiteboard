import React, { useRef, useEffect, useState } from 'react';
import DraggableResizableWrapper from './DraggableResizableWrapper';
import './Video.css';

const Video = ({
  id,
  x,
  y,
  width = 480,
  height = 270,
  url,
  playing = false,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  tool,
  panOffset,
  limit = 1500,
  muted: initialMuted = false,
  volume: initialVolume = 0.5,
  controls = true,
  autoPlay = false,
  loop = true,
  type = "direct",
  socket,
  currentWhiteboardId
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(playing || autoPlay);
  const [showRemoveButton, setShowRemoveButton] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(width / height || 16/9);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const [localVolume, setLocalVolume] = useState(initialVolume);
  const [localMuted, setLocalMuted] = useState(initialMuted);
  const syncTimeoutRef = useRef(null);


  // Debug URL
  useEffect(() => {
    console.log(`🎬 Video ${id}:`, { type, url, width, height, aspectRatio });
  }, [id, type, url, width, height, aspectRatio]);

  // Ustal proporcje dla różnych typów wideo
  useEffect(() => {
    if (type === "youtube" || type === "vimeo") {
      setAspectRatio(16/9);
    } else if (type === "generic") {
      setAspectRatio(width / height || 16/9);
    } else {
      setAspectRatio(width / height);
    }
  }, [type, width, height]);

  // 🔹 NASŁUCHIWANIE ZDARZEŃ SOCKET - SYNCHRONIZACJA
  useEffect(() => {
    if (!socket) return;

    // Synchronizacja stanu wideo
    const handleVideoSync = (data) => {
      if (data.videoId === id && data.whiteboardId === currentWhiteboardId) {
        console.log(`🔄 Video ${id} synced from server:`, data.state);
        applyRemoteSync(data.state);
      }
    };

    // Play od innych użytkowników
    const handleVideoPlay = (data) => {
      if (data.id === id && data.fromUserId !== socket.id && data.whiteboardId === currentWhiteboardId) {
        console.log(`▶️ Remote PLAY: ${id} at ${data.currentTime}s`);
        setIsMaster(false);
        applyRemotePlay(data.currentTime);
      }
    };

    // Pause od innych użytkowników
    const handleVideoPause = (data) => {
      if (data.id === id && data.fromUserId !== socket.id && data.whiteboardId === currentWhiteboardId) {
        console.log(`⏸️ Remote PAUSE: ${id} at ${data.currentTime}s`);
        setIsMaster(false);
        applyRemotePause(data.currentTime);
      }
    };

    // Seek od innych użytkowników
    const handleVideoSeek = (data) => {
      if (data.id === id && data.fromUserId !== socket.id && data.whiteboardId === currentWhiteboardId) {
        console.log(`⏩ Remote SEEK: ${id} to ${data.currentTime}s`);
        setIsMaster(false);
        applyRemoteSeek(data.currentTime);
      }
    };

    // Aktualizacja pozycji/rozmiaru od innych użytkowników
    const handleVideoUpdate = (data) => {
      if (data.id === id && data.fromUserId !== socket.id && data.whiteboardId === currentWhiteboardId) {
        console.log(`📐 Remote UPDATE: ${id}`, data.updates);
        // Aktualizuj pozycję/rozmiar bez wywoływania onUpdate (żeby nie tworzyć pętli)
        if (data.updates.x !== undefined || data.updates.y !== undefined || 
            data.updates.width !== undefined || data.updates.height !== undefined) {
          // Te zmiany są już obsługiwane przez DraggableResizableWrapper przez socket
        }
      }
    };

    // Usunięcie wideo przez innego użytkownika
    const handleVideoDelete = (data) => {
      if (data.id === id && data.fromUserId !== socket.id && data.whiteboardId === currentWhiteboardId) {
        console.log(`🗑️ Remote DELETE: ${id}`);
        onRemove(id);
      }
    };

    socket.on("video-sync", handleVideoSync);
    socket.on("video-play", handleVideoPlay);
    socket.on("video-pause", handleVideoPause);
    socket.on("video-seek", handleVideoSeek);
    socket.on("video-update", handleVideoUpdate);
    socket.on("video-delete", handleVideoDelete);

    // Poproś o synchronizację przy załadowaniu
    if (socket && currentWhiteboardId) {
      setTimeout(() => {
        socket.emit("video-sync-request", {
          whiteboardId: currentWhiteboardId,
          videoId: id
        });
      }, 1000);
    }

    return () => {
      socket.off("video-sync", handleVideoSync);
      socket.off("video-play", handleVideoPlay);
      socket.off("video-pause", handleVideoPause);
      socket.off("video-seek", handleVideoSeek);
      socket.off("video-update", handleVideoUpdate);
      socket.off("video-delete", handleVideoDelete);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [socket, id, type, currentWhiteboardId]);

  // Inicjalizacja wideo TYLKO dla typów bezpośrednich
  useEffect(() => {
    if (type !== "direct") return;
    
    if (videoRef.current) {
      const video = videoRef.current;
      
      const handleLoadedData = () => {
        setIsLoaded(true);
        console.log("Video loaded successfully");
        
        if (video.videoWidth && video.videoHeight) {
          const naturalAspectRatio = video.videoWidth / video.videoHeight;
          setAspectRatio(naturalAspectRatio);
          
          if (Math.abs(height - (width / naturalAspectRatio)) > 5) {
            const newHeight = width / naturalAspectRatio;
            onUpdate(id, { height: newHeight });
          }
        }
      };
      
      const handlePlay = () => {
        setIsPlaying(true);
        if (!isSyncing && isMaster) {
          handleLocalPlay();
        }
      };
      
      const handlePause = () => {
        setIsPlaying(false);
        if (!isSyncing && isMaster) {
          handleLocalPause();
        }
      };
      
      const handleEnded = () => {
        setIsPlaying(false);
        onUpdate(id, { playing: false });
      };
      
      const handleVolumeChange = () => {
        setLocalVolume(video.volume);
        setLocalMuted(video.muted);
        // NIE wysyłamy volume update do serwera (zgodnie z życzeniem)
      };
      
      const handleSeeking = () => {
        if (!isSyncing && isMaster) {
          if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
          }
          
          syncTimeoutRef.current = setTimeout(() => {
            if (video.seeking && isMaster) {
              handleLocalSeek(video.currentTime);
            }
          }, 300);
        }
      };

      const handleTimeUpdate = () => {
        const now = Date.now();
        if (now - lastSyncTime > 1000 && isMaster) {
          setLastSyncTime(now);
          onUpdate(id, { currentTime: video.currentTime });
        }
      };
      
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('volumechange', handleVolumeChange);
      video.addEventListener('seeking', handleSeeking);
      video.addEventListener('timeupdate', handleTimeUpdate);
      
      video.volume = localVolume;
      video.muted = localMuted;
      video.loop = loop;
      video.controls = controls;
      
      if (autoPlay && !isSyncing) {
        video.play().catch(e => console.log("Auto-play prevented:", e));
      }
      
      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('volumechange', handleVolumeChange);
        video.removeEventListener('seeking', handleSeeking);
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [id, url, autoPlay, loop, controls, localVolume, localMuted, onUpdate, type, width, height, isSyncing, isMaster, lastSyncTime]);

  useEffect(() => {
    if (type === "direct" && videoRef.current && autoPlay && !isSyncing) {
      videoRef.current.play().catch(e => console.log("Auto-play prevented:", e));
    }
  }, [type, autoPlay, isSyncing]);

  // 🔹 FUNKCJE SYNCHRONIZACJI
  const applyRemoteSync = (remoteState) => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    
    // Dla direct video
    if (type === "direct" && videoRef.current) {
      const timeDiff = Math.abs(videoRef.current.currentTime - remoteState.currentTime);
      
      if (timeDiff > 2) {
        console.log(`🔄 Syncing video ${id}: local=${videoRef.current.currentTime}, remote=${remoteState.currentTime}`);
        videoRef.current.currentTime = remoteState.currentTime;
      }
      
      if (remoteState.playing && videoRef.current.paused) {
        videoRef.current.play().catch(e => console.log("Sync play error:", e));
      } else if (!remoteState.playing && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      
      if (remoteState.volume !== undefined) {
        videoRef.current.volume = remoteState.volume;
        setLocalVolume(remoteState.volume);
      }
      if (remoteState.muted !== undefined) {
        videoRef.current.muted = remoteState.muted;
        setLocalMuted(remoteState.muted);
      }
    }
    
    // Dla wszystkich typów - aktualizuj stan w komponencie
    if (remoteState.playing !== undefined) {
      setIsPlaying(remoteState.playing);
      onUpdate(id, { playing: remoteState.playing });
    }
    
    if (remoteState.currentTime !== undefined) {
      onUpdate(id, { currentTime: remoteState.currentTime });
    }
    
    setTimeout(() => setIsSyncing(false), 100);
  };

  const applyRemotePlay = (remoteTime) => {
    if (type === "direct") {
      if (!videoRef.current || isSyncing) return;
      
      setIsSyncing(true);
      setIsMaster(false);
      
      videoRef.current.currentTime = remoteTime;
      videoRef.current.play().catch(e => console.log("Remote play error:", e));
      
      setTimeout(() => setIsSyncing(false), 100);
    } else {
      // Dla YouTube/Vimeo tylko aktualizuj stan
      setIsMaster(false);
      setIsPlaying(true);
      onUpdate(id, { playing: true, currentTime: remoteTime });
    }
  };

  const applyRemotePause = (remoteTime) => {
    if (type === "direct") {
      if (!videoRef.current || isSyncing) return;
      
      setIsSyncing(true);
      setIsMaster(false);
      
      videoRef.current.currentTime = remoteTime;
      videoRef.current.pause();
      
      setTimeout(() => setIsSyncing(false), 100);
    } else {
      // Dla YouTube/Vimeo tylko aktualizuj stan
      setIsMaster(false);
      setIsPlaying(false);
      onUpdate(id, { playing: false, currentTime: remoteTime });
    }
  };

  const applyRemoteSeek = (remoteTime) => {
    if (type === "direct") {
      if (!videoRef.current || isSyncing) return;
      
      setIsSyncing(true);
      setIsMaster(false);
      
      videoRef.current.currentTime = remoteTime;
      
      const wasPlaying = !videoRef.current.paused;
      if (wasPlaying) {
        videoRef.current.play().catch(e => console.log("Seek continue play error:", e));
      }
      
      setTimeout(() => setIsSyncing(false), 100);
    } else {
      // Dla YouTube/Vimeo tylko aktualizuj stan
      setIsMaster(false);
      onUpdate(id, { currentTime: remoteTime });
    }
  };

  // Obsługa zmiany stanu playing z zewnątrz
  useEffect(() => {
    if (type !== "direct") return;
    
    if (videoRef.current && !isSyncing) {
      if (playing && !isPlaying) {
        setIsMaster(true);
        videoRef.current.play().catch(e => console.log("Play error:", e));
      } else if (!playing && isPlaying) {
        setIsMaster(true);
        videoRef.current.pause();
      }
    }
  }, [playing, isPlaying, type, isSyncing]);

  // 🔹 FUNKCJE LOKALNE (wysyłanie do serwera)
  const handleLocalPlay = () => {
    if (!socket || isSyncing || !currentWhiteboardId) return;
    
    setIsMaster(true);
    let currentTime = 0;
    
    if (type === "direct" && videoRef.current) {
      currentTime = videoRef.current.currentTime;
    }
    
    socket.emit("video-play", {
      whiteboardId: currentWhiteboardId,
      id: id,
      currentTime: currentTime
    });
    
    onUpdate(id, { playing: true, currentTime });
  };

  const handleLocalPause = () => {
    if (!socket || isSyncing || !currentWhiteboardId) return;
    
    setIsMaster(true);
    let currentTime = 0;
    
    if (type === "direct" && videoRef.current) {
      currentTime = videoRef.current.currentTime;
    }
    
    socket.emit("video-pause", {
      whiteboardId: currentWhiteboardId,
      id: id,
      currentTime: currentTime
    });
    
    onUpdate(id, { playing: false, currentTime });
  };

  const handleLocalSeek = (newTime) => {
    if (!socket || isSyncing || !currentWhiteboardId) return;
    
    setIsMaster(true);
    
    socket.emit("video-seek", {
      whiteboardId: currentWhiteboardId,
      id: id,
      currentTime: newTime
    });
    
    onUpdate(id, { currentTime: newTime });
  };

  const handleVolumeUpdate = (volume, muted) => {
    // NIE wysyłamy volume update do serwera (zgodnie z życzeniem)
    // Tylko lokalna aktualizacja
    onUpdate(id, { volume, muted });
  };

  const handleLocalRemove = () => {
    if (!socket || !currentWhiteboardId) {
      onRemove(id);
      return;
    }
    
    socket.emit("video-delete", {
      whiteboardId: currentWhiteboardId,
      id: id
    });
    
    onRemove(id);
  };

  // 🔹 HANDLERY UI
  const handleContainerClick = (e) => {
    e.stopPropagation();
    
    // Zapobiegaj wywołaniu jeśli kliknięto w przyciski
    if (e.target.classList.contains('video-remove-button') || 
        e.target.classList.contains('video-volume-button') ||
        e.target.closest('.video-volume-controls')) {
      return;
    }
    
    if (tool === 'cursor') {
      onSelect(id);
    }
  };

  const handleMouseEnter = () => {
    setShowRemoveButton(true);
  };

  const handleMouseLeave = () => {
    setShowRemoveButton(false);
  };

  const handleVideoClick = (e) => {
    if (!e.target.classList.contains('video-remove-button') &&
        !e.target.classList.contains('video-volume-button') &&
        !e.target.closest('.video-volume-controls')) {
      e.stopPropagation();
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    e.preventDefault();
    handleLocalRemove();
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (tool === 'cursor') {
      if (type === "direct" && videoRef.current) {
        if (videoRef.current.requestFullscreen) {
          videoRef.current.requestFullscreen();
        }
      } else if (type === "youtube" || type === "vimeo") {
        window.open(getOriginalUrl(url, type), '_blank');
      }
    }
  };

  // Funkcja do aktualizacji rozmiaru
  const handleUpdate = (id, updates) => {
    console.log(`🔄 Video ${id} update:`, updates);
    
    // Dla iframe, utrzymuj proporcje
    if ((type === "youtube" || type === "vimeo" || type === "generic") && updates.width && !updates.height) {
      const newHeight = updates.width / aspectRatio;
      updates.height = newHeight;
    }
    
    onUpdate(id, updates);
  };

  // Funkcje pomocnicze
  const getOriginalUrl = (embedUrl, videoType) => {
    if (videoType === "youtube") {
      const match = embedUrl.match(/embed\/([^?]+)/);
      if (match) {
        return `https://www.youtube.com/watch?v=${match[1]}`;
      }
    } else if (videoType === "vimeo") {
      const match = embedUrl.match(/video\/(\d+)/);
      if (match) {
        return `https://vimeo.com/${match[1]}`;
      }
    }
    return url;
  };

  // Oblicz minimalne wymiary
  const getMinDimensions = () => {
    if (type === "youtube" || type === "vimeo" || type === "generic") {
      const minWidth = 200;
      const minHeight = Math.round(minWidth / aspectRatio);
      return { minWidth, minHeight };
    } else {
      return { minWidth: 150, minHeight: 85 };
    }
  };

  const { minWidth, minHeight } = getMinDimensions();

  // 🔹 RENDER DLA IFRAME (YouTube/Vimeo/Generic)
  if (type === "youtube" || type === "vimeo" || type === "generic") {
    return (
      <DraggableResizableWrapper
        id={id}
        x={x}
        y={y}
        width={width}
        height={height}
        isSelected={selected}
        onSelect={onSelect}
        onUpdate={handleUpdate}
        aspectRatioLocked={true}
        aspectRatio={aspectRatio}
        panOffset={panOffset}
        limit={limit}
        minWidth={minWidth}
        minHeight={minHeight}
        disabled={tool !== 'cursor'}
        socket={socket}
        whiteboardId={currentWhiteboardId}
        elementType="video"
      >
        <div 
          ref={containerRef}
          className={`video-container iframe-container ${selected ? 'selected' : ''}`}
          onClick={handleContainerClick}
          onDoubleClick={handleDoubleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ 
            position: 'relative', 
            width: '100%', 
            height: '100%',
            cursor: tool === 'cursor' ? 'move' : 'default',
            background: '#000',
            aspectRatio: aspectRatio
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            borderRadius: '4px'
          }}>
            <iframe
              src={type === "youtube" 
                ? `${getYouTubeEmbedUrl(url)}?autoplay=0&controls=1&rel=0&modestbranding=1&showinfo=0`
                : type === "vimeo"
                ? `${url}?title=0&byline=0&portrait=0`
                : url}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                border: 'none',
                pointerEvents: tool === 'cursor' ? 'auto' : 'none',
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%'
              }}
              title={`Embedded video ${id}`}
              loading="lazy"
              onLoad={() => {
                console.log(`Iframe ${id} loaded with aspect ratio ${aspectRatio}`);
                setIsLoaded(true);
              }}
              onError={(e) => {
                console.error(`❌ Failed to load iframe: ${url}`);
                console.error('Error details:', e);
              }}
            />
          </div>
          
          {/* Przycisk usuwania */}
          {(selected || showRemoveButton) && (
            <div className="video-controls-overlay">
              <button 
                className="video-remove-button"
                onClick={handleRemove}
                onMouseDown={(e) => e.stopPropagation()}
                title="Remove video"
                style={{
                  opacity: showRemoveButton ? 1 : 0.7,
                  transition: 'opacity 0.2s'
                }}
              >
                ✕
              </button>
            </div>
          )}
          
          {/* Wskaźnik synchronizacji */}
          {isSyncing && (
            <div className="video-sync-indicator syncing">
              SYNC
            </div>
          )}
          
          {/* Loading indicator */}
          {!isLoaded && (
            <div className="video-loading">
              <div className="loading-spinner"></div>
              <span>Loading {type} video...</span>
            </div>
          )}
        </div>
      </DraggableResizableWrapper>
    );
  }

  // 🔹 RENDER dla wideo bezpośredniego (plik)
  return (    
    <DraggableResizableWrapper
      id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      isSelected={selected}
      onSelect={onSelect}
      onUpdate={handleUpdate}
      aspectRatioLocked={true}
      aspectRatio={aspectRatio}
      panOffset={panOffset}
      limit={limit}
      minWidth={minWidth}
      minHeight={minHeight}
      disabled={tool !== 'cursor'}
      socket={socket}
      whiteboardId={currentWhiteboardId}
      elementType="video"
    >
      <div 
        ref={containerRef}
        className={`video-container ${selected ? 'selected' : ''}`}
        onClick={handleContainerClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ 
          position: 'relative', 
          width: '100%', 
          height: '100%',
          cursor: tool === 'cursor' ? 'move' : 'default'
        }}
      >
        <video
          ref={videoRef}
          src={url}
          width="100%"
          height="100%"
          controls={controls}
          style={{
            objectFit: 'contain',
            backgroundColor: '#000',
            display: 'block',
            borderRadius: '4px',
            pointerEvents: tool === 'cursor' ? 'auto' : 'none'
          }}
          preload="metadata"
          playsInline
          onClick={handleVideoClick}
          onError={(e) => {
            console.error(`❌ Failed to load video: ${url}`);
            console.error('Error details:', e);
          }}
          onContextMenu={(e) => {
            if (tool === 'cursor') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        />
        
        {/* Kontrolki głośności (tylko dla direct video) */}
        {type === "direct" && controls && (
          <div className="video-volume-controls" style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            zIndex: 22,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(0,0,0,0.6)',
            padding: '5px',
            borderRadius: '4px',
            opacity: showRemoveButton ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}>
            <button 
              className="video-volume-button"
              onClick={() => {
                if (videoRef.current) {
                  const newMuted = !videoRef.current.muted;
                  videoRef.current.muted = newMuted;
                  setLocalMuted(newMuted);
                  handleVolumeUpdate(videoRef.current.volume, newMuted);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
                minWidth: '24px'
              }}
              title={localMuted ? "Unmute" : "Mute"}
            >
              {localMuted ? '🔇' : localVolume > 0.5 ? '🔊' : '🔉'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localVolume}
              onChange={(e) => {
                if (videoRef.current) {
                  const newVolume = parseFloat(e.target.value);
                  videoRef.current.volume = newVolume;
                  setLocalVolume(newVolume);
                  handleVolumeUpdate(newVolume, videoRef.current.muted);
                }
              }}
              style={{
                width: '60px',
                cursor: 'pointer'
              }}
              title="Volume"
            />
          </div>
        )}
        
        {/* Przycisk usuwania */}
        {(selected || showRemoveButton) && (
          <div className="video-controls-overlay">
            <button 
              className="video-remove-button"
              onClick={handleRemove}
              onMouseDown={(e) => e.stopPropagation()}
              title="Remove video"
              style={{
                opacity: showRemoveButton ? 1 : 0.7,
                transition: 'opacity 0.2s'
              }}
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Wskaźnik synchronizacji */}
        {isSyncing && (
          <div className="video-sync-indicator syncing">
            SYNC
          </div>
        )}
        
        {/* Loading indicator */}
        {!isLoaded && (
          <div className="video-loading">
            <div className="loading-spinner"></div>
            <span>Loading video...</span>
          </div>
        )}
      </div>
    </DraggableResizableWrapper>
  );
};

// Funkcja pomocnicza do konwersji URL YouTube
function getYouTubeEmbedUrl(url) {
  if (!url) return '';
  
  if (url.includes('youtube.com/embed/')) {
    return url.split('?')[0];
  }
  
  if (url.includes('youtube.com/watch?v=')) {
    const videoId = url.split('v=')[1]?.split('&')[0];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }
  
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }
  
  return url;
}

export default Video;
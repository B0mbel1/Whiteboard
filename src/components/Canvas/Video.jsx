import React, { useRef, useEffect, useState } from "react";
import DraggableResizableWrapper from "./DraggableResizableWrapper";

const Video = ({
  id,
  x,
  y,
  width,
  height,
  url,
  provider,
  playing = false,
  currentTime = 0,
  selected,
  onSelect,
  onUpdate,
  panOffset,
  limit,
  zoom,
  socket,
  whiteboardId
}) => {
  const videoRef = useRef(null);
  const [isInteracting, setIsInteracting] = useState(false); // Tryb interakcji z YouTube
  const isLocalAction = useRef(false);
  const [localState, setLocalState] = useState({
    playing: playing,
    currentTime: currentTime
  });


  useEffect(() => {
    if (!selected) {
      setIsInteracting(false);
    }
  }, [selected]);

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

    // 🔹 USUNIĘTO: handleVideoUpdate z socketu wewnątrz Video.
    // Pozycja jest zarządzana przez Canvas (parent), więc Video nie musi nasłuchiwać
    // zmian pozycji bezpośrednio tutaj, bo dostaje je przez propsy (x, y, width, height).

    socket.on("video-play", handleVideoPlay);
    socket.on("video-pause", handleVideoPause);
    socket.on("video-seek", handleVideoSeek);

    // Request initial sync
    if (socket && whiteboardId && id) {
      socket.emit("video-sync-request", { whiteboardId, videoId: id });
    }

    socket.on("video-sync", (data) => {
      if (data.videoId === id && data.whiteboardId === whiteboardId && videoRef.current) {
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
      socket.off("video-sync");
    };
  }, [socket, id, whiteboardId, provider]);

  // ========== LOKALNE AKCJE (PLAY/PAUSE) ==========
  const emitPlay = () => {
    if (!socket || !videoRef.current) return;
    isLocalAction.current = true;
    const ct = videoRef.current.currentTime;

    socket.emit("video-play", { whiteboardId, id, currentTime: ct });
    if (onUpdate) onUpdate(id, { playing: true, currentTime: ct });
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsInteracting(true); // Włączamy możliwość klikania w YouTube
  };
  const emitPause = () => {
    if (!socket || !videoRef.current) return;
    isLocalAction.current = true;
    const ct = videoRef.current.currentTime;

    socket.emit("video-pause", { whiteboardId, id, currentTime: ct });
    if (onUpdate) onUpdate(id, { playing: false, currentTime: ct });
  };

  const emitSeek = () => {
    if (!socket || !videoRef.current) return;
    isLocalAction.current = true;
    const ct = videoRef.current.currentTime;

    socket.emit("video-seek", { whiteboardId, id, currentTime: ct });
    if (onUpdate) onUpdate(id, { currentTime: ct });
  };

  // ========== AKTUALIZACJA POZYCJI/ROZMIARU ==========
  const handlePositionSizeUpdate = (updates) => {
    // 🔹 POPRAWKA KLUCZOWA:
    // Nie wysyłamy socket.emit("video-update") tutaj!
    // 'updates' zawierają surowe dane ekranowe (piksele).
    // Przekazujemy je tylko do Canvas (przez onUpdate), który:
    // 1. Przeliczy je na współrzędne świata (uwzględniając zoom i pan).
    // 2. Zaktualizuje stan.
    // 3. Wyśle poprawne dane do socketu.

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
      onUpdate={(id, updates) => onUpdate && onUpdate(id, updates)}
      panOffset={panOffset}
      limit={limit}
      zoom={zoom}
      aspectRatioLocked={false}
      style={{ pointerEvents: "auto" }}
    >
      {selected && provider !== "file" && (
        <div style={{
          position: 'absolute',
          top: -25,
          left: 0,
          background: isInteracting ? '#2ecc71' : '#3498db',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 100,
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          {isInteracting ? "Tryb odtwarzania (kliknij obok by wyjść)" : "Dwuklik by odtwarzać"}
        </div>
      )}
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
            objectFit: "contain", // Film zachowa proporcje wewnątrz ramki, ale ramka jest dowolna
            width: '100%',
            height: '100%'
          }}
        />
      )}

      {(provider === "youtube" || provider === "vimeo") && (
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative' // Ważne dla pozycjonowania overlay'a
          }}
          onDoubleClick={handleDoubleClick} // Dwuklik włącza YouTube
        >
          {/* WARSTWA BLOKUJĄCA: Jest aktywna, gdy NIE jesteśmy w trybie interakcji */}
          {!isInteracting && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                background: 'transparent',
                // To jest kluczowe: 'auto' sprawia, że łapiemy ten div zamiast iframe'a
                pointerEvents: 'auto'
              }}
            />
          )}
          {/* Warstwa ochronna - aktywna gdy wideo jest zaznaczone */}
          {selected && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10, // Musi być nad iframe
                background: 'transparent',
                cursor: 'move', // Sugeruje, że można przesuwać
                pointerEvents: 'auto' // <--- DODAJ TO DLA PEWNOŚCI
              }}
            />
          )}

          <iframe
            src={url}
            width="100%"
            height="100%"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{
              border: "none",
              width: '100%',
              height: '100%',
              display: "block",
              // Zabezpieczenie dodatkowe:
              pointerEvents: isInteracting ? "auto" : "none"
            }}
          />
        </div>
      )}
    </DraggableResizableWrapper>
  );
};

export default Video;
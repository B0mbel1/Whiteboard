import React, { useRef } from 'react';
import './MultimediaModal.css';

const MultimediaModal = ({
  onClose,
  onImageCreate,
  onVideoCreate,
  currentMousePosition = { x: 0, y: 0 } // Dodaj pozycję kursora
}) => {
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // ========= IMAGE =========
  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      onImageCreate?.({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: currentMousePosition.x - 200, // Centruj względem kursora
        y: currentMousePosition.y - 150,
        width: 400,
        height: 300,
        url: ev.target.result
      });
      onClose?.();
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ========= VIDEO FILE =========
const handleVideoFile = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const res = await fetch("http://localhost:3001/api/upload-video", {
      method: "POST",
      headers: {
        "x-file-name": encodeURIComponent(file.name)
      },
      body: file
    });

    const data = await res.json();

    if (!data.success) {
      alert("Błąd uploadu wideo");
      return;
    }

    // 🔹 WAŻNE: NIE twórz wideo tutaj!
    // 🔹 TYLKO wyślij informację do backendu przez socket.io
    // 🔹 Backend stworzy wideo i wyśle do wszystkich użytkowników
    
    // Generuj unikalne ID
    const videoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const videoUrl = `http://localhost:3001${data.videoUrl}`;

    console.log(`🎬 Sending video creation request to server:`, { id: videoId, url: videoUrl });

    // 🔹 TYLKO wywołaj callback (który wyśle socket.io)
    onVideoCreate?.({
      id: videoId,
      x: currentMousePosition.x - 240,
      y: currentMousePosition.y - 135,
      width: 480,
      height: 270,
      url: videoUrl,
      playing: false,
      type: "direct"
    });

    onClose?.();
    } catch (err) {
      console.error("Upload error:", err);
      alert("Nie udało się wysłać wideo");
    }

    e.target.value = '';
  };

  // ========= VIDEO LINK =========
const handleVideoLink = async () => {
  const url = prompt('Wklej link do wideo (YouTube, Vimeo, MP4)');
  if (!url) return;

  try {
    const res = await fetch("http://localhost:3001/api/process-video-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const data = await res.json();

    if (!data.success) {
      alert("Nie udało się przetworzyć linku");
      return;
    }

    let videoUrl = data.url;
    let videoType = data.type;
    let videoHeight = 270; // Domyślna wysokość
    
    if (data.type === "youtube") {
      const videoId = data.videoId || extractYouTubeId(url);
      if (videoId) {
        videoUrl = `https://www.youtube.com/embed/${videoId}`;
        videoType = "youtube";
        videoHeight = 270; // Standardowa wysokość dla YouTube
      }
    } else if (data.type === "vimeo") {
      const videoId = data.videoId || extractVimeoId(url);
      if (videoId) {
        videoUrl = `https://player.vimeo.com/video/${videoId}`;
        videoType = "vimeo";
        videoHeight = 270;
      }
    }

    console.log(`🎬 Creating ${videoType} video: ${videoUrl}`);

    onVideoCreate?.({
      id: `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x: currentMousePosition.x - 240,
      y: currentMousePosition.y - 135,
      width: 480,
      height: videoHeight, // 🔹 Używamy ustalonej wysokości
      url: videoUrl,
      type: videoType,
      playing: false
    });

    onClose?.();
  } catch (e) {
    console.error("Video link error:", e);
    alert("Błąd przy linku wideo");
  }
};

// Funkcje pomocnicze
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/watch\?v=([^"&?\/\s]{11})/,
    /youtube\.com\/embed\/([^"&?\/\s]{11})/,
    /youtu\.be\/([^"&?\/\s]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function extractVimeoId(url) {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /vimeo\.com\/video\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
  }

  return (
    <div className="multimedia-modal-overlay" onClick={onClose}>
      <div
        className="multimedia-modal-content"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="multimedia-close-btn"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="multimedia-tiles-container">
          <div
            className="multimedia-tile"
            onClick={() => imageInputRef.current.click()}
            title="Dodaj obraz z komputera"
          >
            🖼️
            <span>Zdjęcie</span>
            <small>Prześlij plik</small>
          </div>

          <div
            className="multimedia-tile"
            onClick={() => videoInputRef.current.click()}
            title="Dodaj wideo z komputera"
          >
            🎬
            <span>Wideo (plik)</span>
            <small>MP4, WebM, etc.</small>
          </div>

          <div
            className="multimedia-tile"
            onClick={handleVideoLink}
            title="Dodaj wideo z linku"
          >
            🔗
            <span>Wideo (link)</span>
            <small>YouTube, Vimeo, etc.</small>
          </div>
        </div>

        {/* INPUTS */}
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          hidden
          onChange={handleImage}
        />

        <input
          type="file"
          accept="video/*"
          ref={videoInputRef}
          hidden
          onChange={handleVideoFile}
        />
      </div>
    </div>
  );
};

export default MultimediaModal;
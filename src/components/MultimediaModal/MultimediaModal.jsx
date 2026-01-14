import React, { useRef } from 'react';
import './MultimediaModal.css';

const MultimediaModal = ({
  onClose,
  onImageCreate,
  onVideoCreate,
  currentMousePosition = { x: 0, y: 0 }
}) => {
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const baseVideoData = () => ({
    x: currentMousePosition.x - 240,
    y: currentMousePosition.y - 135,
    width: 480,
    height: 270,
    currentTime: 0,
    playing: false
  });

  // ========= IMAGE =========
  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      onImageCreate?.({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: currentMousePosition.x - 200,
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
        headers: { "x-file-name": encodeURIComponent(file.name) },
        body: file
      });

      const data = await res.json();
      if (!data.success) {
        alert("Błąd uploadu wideo");
        return;
      }

      const videoUrl = `http://localhost:3001${data.videoUrl}`;

      onVideoCreate?.({
        id: `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...baseVideoData(),
        url: videoUrl,
        provider: "file"
      });

      onClose?.();
    } catch (err) {
      console.error("Upload error:", err);
      alert("Nie udało się wysłać wideo");
    }

    e.target.value = '';
  };

  // ========= VIDEO LINK =========
  const handleVideoLink = () => {
    const url = prompt('Wklej link do wideo (YouTube, Vimeo)');
    if (!url) return;

    let provider = null;
    let finalUrl = url;

    const ytId = extractYouTubeId(url);
    const vimeoId = extractVimeoId(url);

    if (ytId) {
      provider = "youtube";
      finalUrl = `https://www.youtube.com/embed/${ytId}?enablejsapi=1`;
    } else if (vimeoId) {
      provider = "vimeo";
      finalUrl = `https://player.vimeo.com/video/${vimeoId}`;
    } else {
      alert("Obsługiwane są tylko YouTube i Vimeo");
      return;
    }

    onVideoCreate?.({
      id: `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...baseVideoData(),
      url: finalUrl,
      provider
    });

    onClose?.();
  };

  // ========= HELPERS =========
  function extractYouTubeId(url) {
    const patterns = [
      /(?:youtube\.com\/.*[?&]v=|youtu\.be\/)([^"&?\/\s]{11})/,
      /youtube\.com\/embed\/([^"&?\/\s]{11})/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  function extractVimeoId(url) {
    const patterns = [
      /vimeo\.com\/(\d+)/,
      /player\.vimeo\.com\/video\/(\d+)/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  return (
    <div className="multimedia-modal-overlay" onClick={onClose}>
      <div className="multimedia-modal-content" onClick={e => e.stopPropagation()}>
        <button className="multimedia-close-btn" onClick={onClose}>✕</button>

        <div className="multimedia-tiles-container">
          <div className="multimedia-tile" onClick={() => imageInputRef.current.click()}>
            🖼️ <span>Zdjęcie</span><small>Plik</small>
          </div>

          <div className="multimedia-tile" onClick={() => videoInputRef.current.click()}>
            🎬 <span>Wideo</span><small>Plik</small>
          </div>

          <div className="multimedia-tile" onClick={handleVideoLink}>
            🔗 <span>Wideo</span><small>YouTube / Vimeo</small>
          </div>
        </div>

        <input type="file" accept="image/*" ref={imageInputRef} hidden onChange={handleImage} />
        <input type="file" accept="video/*" ref={videoInputRef} hidden onChange={handleVideoFile} />
      </div>
    </div>
  );
};

export default MultimediaModal;

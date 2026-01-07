import React, { useRef } from 'react';
import './MultimediaModal.css';

const MultimediaModal = ({
  onClose,
  onImageCreate,
  onVideoCreate
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
        id: `img_${Date.now()}`,
        x: 200,
        y: 200,
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
  const handleVideoFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      onVideoCreate?.({
        id: `vid_${Date.now()}`,
        x: 200,
        y: 200,
        width: 480,
        height: 270,
        url: ev.target.result,
        type: 'file'
      });
      onClose?.();
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ========= VIDEO LINK =========
  const handleVideoLink = () => {
    const url = prompt('Wklej link do wideo (mp4 / stream)');
    if (!url) return;

    onVideoCreate?.({
      id: `vid_${Date.now()}`,
      x: 200,
      y: 200,
      width: 480,
      height: 270,
      url,
      type: 'link'
    });

    onClose?.();
  };

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
          >
            🖼️
            <span>Zdjęcie</span>
          </div>

          <div
            className="multimedia-tile"
            onClick={() => videoInputRef.current.click()}
          >
            🎬
            <span>Wideo (plik)</span>
          </div>

          <div
            className="multimedia-tile"
            onClick={handleVideoLink}
          >
            🔗
            <span>Wideo (link)</span>
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

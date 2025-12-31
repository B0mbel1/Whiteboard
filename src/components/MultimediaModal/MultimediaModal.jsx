import React, { useRef } from 'react';
import './MultimediaModal.css';

const MultimediaModal = ({ onClose, onImageUpload }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && onImageUpload) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onImageUpload(event.target.result);
        onClose();
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="multimedia-modal-overlay">
      <div className="multimedia-modal-content">
        <button className="multimedia-close-btn" onClick={onClose} title="Zamknij">
          ✕
        </button>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*" 
          onChange={handleFileSelect}
        />

        <div className="multimedia-tiles-container">
          
          {/* Lewy kafelek - Dodaj zdjęcie */}
          <div className="multimedia-tile" onClick={() => fileInputRef.current.click()}>
            <div className="multimedia-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
            <span className="multimedia-label">Dodaj zdjęcie</span>
          </div>

          {/* Prawy kafelek - Inne */}
          <div className="multimedia-tile" onClick={() => console.log('Inne')}>
            <div className="multimedia-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </div>
            <span className="multimedia-label">Inne</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MultimediaModal;

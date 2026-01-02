import React, { useRef, useEffect } from 'react';
import './MultimediaModal.css';

const MultimediaModal = (props) => {
  // Debug: sprawdźmy co przychodzi w propsach zaraz po zamontowaniu
  useEffect(() => {
    console.log("📁 MultimediaModal: Mounted. Props keys:", Object.keys(props));
    console.log("📁 MultimediaModal: onImageCreate is type:", typeof props.onImageCreate);
  }, [props]);

  const fileInputRef = useRef(null);

  const handleImageClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("📁 MultimediaModal: Clicked 'Dodaj zdjęcie'");
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    console.log("📁 MultimediaModal: handleFileChange triggered. File:", file?.name);
    
    if (!file) return;

    const onImageCreate = props.onImageCreate;
    const onClose = props.onClose;

    if (typeof onImageCreate !== 'function') {
      console.error("❌ MultimediaModal: props.onImageCreate is NOT a function! Value:", onImageCreate);
      alert("Błąd: Funkcja dodawania zdjęcia nie jest dostępna.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      console.log("📁 MultimediaModal: FileReader loaded data");
      const url = event.target.result;
      
      const newImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: 200, 
        y: 200,
        url: url,
        width: 300 
      };
      
      try {
        console.log("📁 MultimediaModal: Calling onImageCreate...");
        onImageCreate(newImage);
        console.log("✅ MultimediaModal: onImageCreate returned");
        if (onClose) onClose(); 
      } catch (err) {
        console.error("❌ MultimediaModal: Crash inside onImageCreate:", err);
      }
    };
    
    reader.onerror = (err) => {
      console.error("❌ MultimediaModal: FileReader error:", err);
    };

    reader.readAsDataURL(file);
    
    // Clear the input so the same file can be selected again if needed
    // and to prevent any lingering state.
    e.target.value = '';
  };

  return (
    <div className="multimedia-modal-overlay" onClick={props.onClose}>
      <div className="multimedia-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="multimedia-close-btn" onClick={props.onClose} title="Zamknij">
          ✕
        </button>
        <div className="multimedia-tiles-container">
          
          {/* Lewy kafelek - Dodaj zdjęcie */}
          <div className="multimedia-tile" onClick={handleImageClick}>
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
        
        {/* Input przeniesiony poza kafle dla bezpieczeństwa */}
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default MultimediaModal;
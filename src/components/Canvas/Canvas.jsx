import React, { useState } from 'react';
import './Canvas.css';

const Canvas = () => {
  const [backgroundMode, setBackgroundMode] = useState('grid'); // 'white', 'grid', 'lines', 'black'

  const backgroundModes = [
    { id: 'white', name: 'Białe tło', icon: '🌕' },
    { id: 'grid', name: 'Kratka', icon: '🏁' },
    { id: 'lines', name: 'Siatka linii', icon: '📐' },
    { id: 'black', name: 'Czarne tło', icon: '🌑' }
  ];

  const toggleBackground = () => {
    const currentIndex = backgroundModes.findIndex(mode => mode.id === backgroundMode);
    const nextIndex = (currentIndex + 1) % backgroundModes.length;
    setBackgroundMode(backgroundModes[nextIndex].id);
  };

  const getCurrentBackgroundIcon = () => {
    return backgroundModes.find(mode => mode.id === backgroundMode)?.icon;
  };

  return (
    <div className="canvas-container">
      <div className={`canvas-area background-${backgroundMode}`}>
        {/* Przycisk przełączania tła */}
        <button 
          className="background-toggle"
          onClick={toggleBackground}
          title={`Tło: ${backgroundModes.find(mode => mode.id === backgroundMode)?.name}`}
        >
          {getCurrentBackgroundIcon()}
        </button>
        
        {/* Placeholder canvas */}
      
      </div>
    </div>
  );
};

export default Canvas;
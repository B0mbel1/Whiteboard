import React from 'react';
import Toolbar from '../Toolbar/Toolbar';
import Canvas from '../Canvas/Canvas';
import Sidebar from '../Sidebar/Sidebar';
import './Whiteboard.css';

const Whiteboard = () => {
  return (
    <div className="whiteboard">
      {/* Fullscreen */}
      <div className="whiteboard-header">
        <button className="fullscreen-btn">⛶ Fullscreen</button>
        <div className='save-btn'>Zapisz📝</div>
        <div className="file-menu">Plik ▼</div>
      </div>

      <div className="whiteboard-main">
        {/* Toolbar po lewej */}
        <Toolbar position="left" />
        
        {/* Główny canvas */}
        <Canvas />
        
        {/* Sidebar po prawej */}
        <Sidebar />
      </div>
    </div>
  );
};

export default Whiteboard;
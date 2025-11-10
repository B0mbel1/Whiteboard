import React, { useState } from 'react';
import Toolbar from '../Toolbar/Toolbar';
import Canvas from '../Canvas/Canvas';
import Sidebar from '../Sidebar/Sidebar';
import ColorPicker from '../Toolbar/ColorPicker'; // Import ColorPicker
import PointerTrail from '../Toolbar/PointerTrail';

import './Whiteboard.css';

const Whiteboard = () => {
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState({ pencil: 3, eraser: 10, brush: 5 });
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div className="whiteboard">
      {/* Fullscreen */}
      <div className="whiteboard-header">
        <button className="fullscreen-btn">⛶ Fullscreen</button>
        <div className='save-btn'>Zapisz💾</div>
        <div className="file-menu">Plik ▼</div>
      </div>

      <div className="whiteboard-main">
        {/* Toolbar po lewej */}
        <Toolbar 
          position="left"
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          size={size}
          setSize={setSize}
          showColorPicker={showColorPicker}
          setShowColorPicker={setShowColorPicker}
        />
         {/* 🔴 Czerwony pointer trail */}
        <PointerTrail active={tool === 'pointer'} />
        
        {/* Główny canvas */}
        <Canvas 
          tool={tool}
          color={color}
          size={size[tool]}
          setShowColorPicker={setShowColorPicker}
        />
        
        {/* Sidebar po prawej */}
        <Sidebar />

        {showColorPicker && (
          <div className="color-picker-wrapper">
            <ColorPicker color={color} setColor={setColor} setShowColorPicker={setShowColorPicker} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Whiteboard;
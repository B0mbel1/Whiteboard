import React, { useState } from 'react';
import Toolbar from '../Toolbar/Toolbar';
import Canvas from '../Canvas/Canvas';
import Sidebar from '../Sidebar/Sidebar';
import ColorPicker from '../Toolbar/ColorPicker'; 
import PointerTrail from '../Toolbar/PointerTrail';

import './Whiteboard.css';

const Whiteboard = () => {
  const [tool, setTool] = useState('cursor'); // globalny stan narzędzia
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState({ pencil: 3, eraser: 10, brush: 5 });
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div className="whiteboard">
      <div className="whiteboard-header">
        <button className="fullscreen-btn">⛶ Fullscreen</button>
        <div className='save-btn'>Zapisz💾</div>
        <div className="file-menu">Plik ▼</div>
      </div>

      <div className="whiteboard-main">
        <Toolbar 
          position="left"
          tool={tool}
          setTool={setTool} // ← przekazujemy setter
          color={color}
          setColor={setColor}
          size={size}
          setSize={setSize}
          setShowColorPicker={setShowColorPicker}
        />

        <PointerTrail active={tool === 'pointer'} />

        <Canvas 
          tool={tool}
          setTool={setTool} // ← Canvas może zmienić tool po dodaniu notatki
          color={color}
          size={size}
          setShowColorPicker={setShowColorPicker}
        />

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

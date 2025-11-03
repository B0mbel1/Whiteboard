import React, { useState } from 'react';
import './Toolbar.css';

const Toolbar = ({ position }) => {
  const [toolSizes, setToolSizes] = useState({
    pencil: 3,
    eraser: 3,
    brush: 3
  });

  const [selectedColor, setSelectedColor] = useState('#000000');

  const tools = [
    { icon: '✏️', name: 'Ołówek', size: true, key: 'pencil' },
    { icon: '🧽', name: 'Gumka', size: true, key: 'eraser' },
    { icon: '🖌️', name: 'Pędzle', size: true, key: 'brush' },
    { icon: '🔺', name: 'Kształty' },
    { icon: '📝', name: 'Tekst' },
    { icon: '😊', name: 'Emotki' },
    { icon: '🎨', name: 'Kolory' },
    { icon: '⬆️', name: 'Zaznaczenie' },
    { icon: '🖼️', name: 'Gify' },
    { icon: '📎', name: 'Multimedia' },
  ];

  const handleSizeChange = (toolKey, value) => {
    setToolSizes(prev => ({
      ...prev,
      [toolKey]: parseInt(value, 10)
    }));
  };

  return (
    <div className={`toolbar toolbar-${position}`}>
      <div className="toolbar-section">
        <h4>Narzędzia</h4>
        {tools.map((tool, index) => (
          <div key={index} className="tool-item">
            <button className="tool-btn" title={tool.name}>
              {tool.icon}
            </button>

            {tool.size && tool.key && (
              <div className="tool-size">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={toolSizes[tool.key]}
                  onChange={(e) => handleSizeChange(tool.key, e.target.value)}
                />
                <span className="tool-size-value">{toolSizes[tool.key]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
        <div className="tool-item tool-undo-redo"> 
          <button className="tool-btn" title="Undo">↶</button> 
          <button className="tool-btn" title="Redo">↷</button> 
        </div>
      <div className="toolbar-section">
        <h4>Kolor</h4>
        <div className="color-picker">
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            title="Wybierz kolor"
          />
          <span className="selected-color">{selectedColor}</span>
        </div>
       
      </div>
    </div>
  );
};

export default Toolbar;

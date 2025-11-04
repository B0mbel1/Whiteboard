import React, { useState } from 'react';
import './Toolbar.css';

const Toolbar = ({ position }) => {
const [toolSizes, setToolSizes] = useState({
pencil: 3,
eraser: 3,
brush: 3
});
const [showShapes, setShowShapes] = useState(false);
const [selectedShape, setSelectedShape] = useState(null);
const [selectedColor, setSelectedColor] = useState('#000000');

const handleSizeChange = (toolKey, value) => {
setToolSizes(prev => ({
...prev,
[toolKey]: parseInt(value, 10)
}));
};

const handleShapeClick = (e) => {
const rect = e.target.getBoundingClientRect();
setShowShapes(prev => ({
visible: !prev.visible,
x: rect.right + 10,
y: rect.top - 20
}));
};

const handleSelectShape = (shape) => {
setSelectedShape(shape);
setShowShapes({ visible: false, x: 0, y: 0 });
console.log('Wybrano kształt:', shape);
};

const tools = [
{ icon: '✏️', name: 'Ołówek', size: true, key: 'pencil' },
{ icon: '🧽', name: 'Gumka', size: true, key: 'eraser' },
{ icon: '🖌️', name: 'Pędzle', size: true, key: 'brush' },
{ icon: '🔺', name: 'Kształty', onClick: handleShapeClick },
{ icon: '📝', name: 'Tekst' },
{ icon: '😊', name: 'Emotki' },
{ icon: '🎨', name: 'Kolory' },
{ icon: '⬆️', name: 'Zaznaczenie' },
{ icon: '🖼️', name: 'Gify' },
{ icon: '📎', name: 'Multimedia' },
];

const shapes = [
{ label: '⬛', name: 'Kwadrat' },
{ label: '▭', name: 'Prostokąt' },
{ label: '➡️', name: 'Strzałka' },
{ label: '⚪', name: 'Koło' },
{ label: '⭐', name: 'Gwiazda' },
{ label: '✅', name: 'Zatwierdzenie' },
{ label: '❌', name: 'Zaprzeczenie' },
];

return (
<div className={`toolbar toolbar-${position}`}> <div className="toolbar-section"> <h4>Narzędzia</h4>
{tools.map((tool, index) => ( <div key={index} className="tool-item">
<button
className="tool-btn"
title={tool.name}
onClick={tool.name === 'Kształty' ? handleShapeClick : tool.onClick || null}
>
{tool.icon} </button>
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

    <div className="tool-item tool-undo-redo">
      <button className="tool-btn" title="Cofnij">↶</button>
      <button className="tool-btn" title="Ponów">↷</button>
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

  {showShapes.visible && (
    <div
      className="floating-shapes-popup"
      style={{
        top: `${showShapes.y}px`,
        left: `${showShapes.x}px`
      }}
    >
      {shapes.map((shape, i) => (
        <button
          key={i}
          className={`shape-btn ${selectedShape === shape.name ? 'selected' : ''}`}
          title={shape.name}
          onClick={() => handleSelectShape(shape.name)}
        >
          {shape.label}
        </button>
      ))}
    </div>
  )}
</div>

);
};

export default Toolbar;

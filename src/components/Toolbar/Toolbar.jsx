import React, { useState } from 'react';
import './Toolbar.css';

const Toolbar = ({ position, tool, setTool, color, setColor, size, setSize, setShowColorPicker }) => {
const [showShapes, setShowShapes] = useState(false);
const [showEmojis, setShowEmojis] = useState(false);
const [selectedShape, setSelectedShape] = useState(null);
const [selectedEmoji, setSelectedEmoji] = useState(null);

const handleSizeChange = (tool, value) => {
  setSize(prev => ({ ...prev, [tool]: parseInt(value, 10) }));
};

const handleShapeClick = (e) => {
const rect = e.target.getBoundingClientRect();
setShowShapes(prev => ({
visible: !prev.visible,
x: rect.right + 10,
y: rect.top - 20
}));
};

const handleEmojiClick = (e) => {
const rect = e.target.getBoundingClientRect();
setShowEmojis(prev => ({
visible: !prev.visible,
x: rect.right + 10,
y: rect.top - 20
}));
};

const handleColorClick = () => {
  setShowColorPicker(prev => !prev);
};

const handleSelectShape = (shape) => {
setSelectedShape(shape);
setShowShapes({ visible: false, x: 0, y: 0 });
console.log('Wybrano kształt:', shape);
};

const handleSelectEmoji = (emoji) => {
setSelectedEmoji(emoji);
setShowEmojis({ visible: false, x: 0, y: 0 });
console.log('Wybrano emotkę:', emoji);
};

const tools = [
{
icon: ( <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeDasharray="4 2"> <rect x="3" y="3" width="18" height="18" /> </svg>
),
name: 'Zaznacz obszar',
type: 'select'
},
{ icon: '✏️', name: 'Ołówek', type: 'pencil' },
{ icon: '🧽', name: 'Gumka', type: 'eraser' },
{ icon: '🖌️', name: 'Pędzle', type: 'brush' },
{ icon: '🔺', name: 'Kształty', onClick: handleShapeClick },
{ icon: '📝', name: 'Tekst' },
{ icon: '😊', name: 'Emotki', onClick: handleEmojiClick },
{ 
  icon: ( <div className="color-tool-icon">🎨<div className="color-swatch-indicator" style={{ backgroundColor: color }}></div></div> ), 
  name: 'Kolory', 
  onClick: handleColorClick 
},
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

const emojis = ['😀','😁','😂','🤣','😊','😍','😎','😢','😡','👍','👎','❤️','🔥','🎉','💡'];

return (
<div className={`toolbar toolbar-${position}`}> <div className="toolbar-section"> <h4>Narzędzia</h4>
{tools.map((toolItem, index) => ( <div key={index} className="tool-item">
<button
className={`tool-btn ${tool === toolItem.type ? 'selected' : ''}`}
title={toolItem.name}
onClick={() => toolItem.type ? setTool(toolItem.type) : toolItem.onClick ? toolItem.onClick() : null}
>
{toolItem.icon} </button>
        {(toolItem.type === 'pencil' || toolItem.type === 'eraser' || toolItem.type === 'brush') && (
          <div className="tool-size">
            <input
              type="range"
              min="1"
              max="20"
              value={size[toolItem.type]}
              onChange={(e) => handleSizeChange(toolItem.type, e.target.value)}
            />
            <span className="tool-size-value">{size[toolItem.type]}</span>
          </div>
        )}
      </div>
    ))}

    <div className="tool-item tool-undo-redo">
      <button className="tool-btn" title="Cofnij">↶</button>
      <button className="tool-btn" title="Ponów">↷</button>
    </div>
  </div>

  {/* Popup z kształtami */}
  {showShapes.visible && (
    <div
      className="floating-shapes-popup"
      style={{ top: `${showShapes.y}px`, left: `${showShapes.x}px` }}
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

  {/* Popup z emotkami */}
  {showEmojis.visible && (
    <div
      className="floating-emojis-popup"
      style={{ top: `${showEmojis.y}px`, left: `${showEmojis.x}px` }}
    >
      {emojis.map((emoji, i) => (
        <button
          key={i}
          className={`emoji-btn ${selectedEmoji === emoji ? 'selected' : ''}`}
          title={emoji}
          onClick={() => handleSelectEmoji(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  )}
</div>

);
};

export default Toolbar;

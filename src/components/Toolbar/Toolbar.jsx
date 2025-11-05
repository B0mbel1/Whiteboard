import React, { useState } from 'react';
import './Toolbar.css';

const Toolbar = ({ position }) => {
  const [toolSizes, setToolSizes] = useState({
    pencil: 3,
    eraser: 3,
    brush: 3
  });
  const [showShapes, setShowShapes] = useState({ visible: false, x: 0, y: 0 });
  const [showEmojis, setShowEmojis] = useState({ visible: false, x: 0, y: 0 });
  const [selectedShape, setSelectedShape] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [collapsed, setCollapsed] = useState(false);

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

  const handleEmojiClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    setShowEmojis(prev => ({
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

  const handleSelectEmoji = (emoji) => {
    setSelectedEmoji(emoji);
    setShowEmojis({ visible: false, x: 0, y: 0 });
    console.log('Wybrano emotkę:', emoji);
  };

  const tools = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeDasharray="4 2">
          <rect x="3" y="3" width="18" height="18" />
        </svg>
      ),
      name: 'Zaznacz obszar',
      type: 'select'
    },
    { icon: '✏️', name: 'Ołówek', size: true, key: 'pencil' },
    { icon: '🧽', name: 'Gumka', size: true, key: 'eraser' },
    { icon: '🖌️', name: 'Pędzle', size: true, key: 'brush' },
    { icon: '🔺', name: 'Kształty', onClick: handleShapeClick },
    { icon: '📝', name: 'Tekst' },
    { icon: '😊', name: 'Emotki', onClick: handleEmojiClick },
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
    <>
      <div className={`toolbar toolbar-${position} ${collapsed ? 'collapsed' : ''}`}>
        <div className="toolbar-content">
          <div className="toolbar-section">
            <h4>Narzędzia</h4>
            {tools.map((tool, index) => (
              <div key={index} className="tool-item">
                <button
                  className="tool-btn"
                  title={tool.name}
                  onClick={
                    tool.name === 'Kształty' ? handleShapeClick :
                    tool.name === 'Emotki' ? handleEmojiClick :
                    tool.onClick || null
                  }
                >
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
      </div>

      {/* 🔘 Floating toggle poza toolbar */}
      <div
        className={`collapse-toggle small ${collapsed ? 'collapsed-position' : ''}`}
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Rozwiń pasek' : 'Zwiń pasek'}
      >
        <span className={`arrow ${collapsed ? 'arrow-right' : 'arrow-left'}`}>➤</span>
      </div>
    </>
  );
};

export default Toolbar;

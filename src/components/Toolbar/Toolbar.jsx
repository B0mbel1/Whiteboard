import React, { useState } from 'react';
import './Toolbar.css';

const Toolbar = ({ position, tool, setTool, color, setColor, size, setSize, setShowColorPicker }) => {
  const [showShapes, setShowShapes] = useState({ visible: false, x: 0, y: 0 });
  const [showEmojis, setShowEmojis] = useState({ visible: false, x: 0, y: 0 });
  const [selectedShape, setSelectedShape] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  // 🟢 Kolory z historią
  const [selectedColor, setSelectedColor] = useState(color || '#000000');
  const [recentColors, setRecentColors] = useState([]);
  const [tempColor, setTempColor] = useState(selectedColor);

  const handleSizeChange = (toolKey, value) => {
    setSize(prev => ({ ...prev, [toolKey]: parseInt(value, 10) }));
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
    { icon: '🖱️', name: 'Kursor', type: 'cursor' },
    { icon: '☝️', name: 'Pointer', type: 'pointer' },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeDasharray="4 2">
          <rect x="3" y="3" width="18" height="18" />
        </svg>
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
    // ❌ Usunięty stary przycisk 🎨 Kolory
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
        <div className="toolbar-section">
          <h4>Narzędzia</h4>
          {tools.map((toolItem, index) => (
            <div key={index} className="tool-item">
              <button
                className={`tool-btn ${tool === toolItem.type ? 'selected' : ''}`}
                title={toolItem.name}
                onClick={(e) =>
                  toolItem.type
                    ? setTool(toolItem.type)
                    : toolItem.onClick
                    ? toolItem.onClick(e)
                    : null
                }
              >
                {toolItem.icon}
              </button>

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

        {/* 🎨 Sekcja koloru z historią */}
        <div className="toolbar-section">
          <h4>Kolor</h4>
          <div className="color-picker">
            <input
              type="color"
              value={tempColor}
              onChange={(e) => setTempColor(e.target.value)}
              onMouseUp={(e) => {
                const newColor = e.target.value;
                if (newColor !== selectedColor) {
                  setRecentColors(prev => {
                    const updated = [selectedColor, ...prev.filter(c => c !== selectedColor)];
                    return updated.slice(0, 3);
                  });
                  setSelectedColor(newColor);
                  setColor(newColor);
                }
              }}
              onBlur={(e) => {
                const newColor = e.target.value;
                if (newColor !== selectedColor) {
                  setRecentColors(prev => {
                    const updated = [selectedColor, ...prev.filter(c => c !== selectedColor)];
                    return updated.slice(0, 3);
                  });
                  setSelectedColor(newColor);
                  setColor(newColor);
                }
              }}
            />
            <span className="selected-color">{selectedColor}</span>
          </div>

          <div className="last-colors-section">
            <h4>Ostatnie kolory</h4>
            <div className="last-colors-container">
              {recentColors.length === 0 && <span className="no-colors">Brak</span>}
              {recentColors.map((clr, i) => (
                <div
                  key={i}
                  className="last-color-box"
                  title={`Kliknij, aby użyć ${clr}`}
                  style={{ backgroundColor: clr }}
                  onClick={() => {
                    setSelectedColor(clr);
                    setColor(clr);
                    setTempColor(clr);
                    setRecentColors(prev => {
                      const updated = [clr, ...prev.filter(c => c !== clr)];
                      return updated.slice(0, 3);
                    });
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Popupy */}
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

      {/* 🔘 Strzałka chowająca toolbar */}
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

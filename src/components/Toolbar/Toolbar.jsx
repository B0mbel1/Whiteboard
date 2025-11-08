import React, { useState, useEffect } from 'react';
import './Toolbar.css';
import PointerTrail from './PointerTrail.jsx';
import ToolRangeCircle from './ToolRangeCircle.jsx';

const Toolbar = ({ position, tool, setTool, color, setColor, size, setSize, setShowColorPicker }) => {
  const [showShapes, setShowShapes] = useState({ visible: false, x: 0, y: 0 });
  const [showEmojis, setShowEmojis] = useState({ visible: false, x: 0, y: 0 });
  const [selectedShape, setSelectedShape] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

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
  };

  const handleSelectEmoji = (emoji) => {
    setSelectedEmoji(emoji);
    setShowEmojis({ visible: false, x: 0, y: 0 });
  };

  // 🖌️ Zmiana kursora tylko dla canvas
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    const canvasArea = document.querySelector('.canvas-area');
    const canvasContainer = document.querySelector('.canvas-container');
    
    let cursorStyle = 'default';
    
    switch (tool) {
      case 'pencil':
        cursorStyle = 'url("/cursors/pencil.png") 0 32, auto';
        break;
      case 'brush':
        cursorStyle = 'url("/cursors/brush.png") 0 32, auto';
        break;
      case 'eraser':
        cursorStyle = 'url("/cursors/rubber.png") 0 32, auto';
        break;
      case 'pointer':
        cursorStyle = 'pointer';
        break;
      case 'select':
        cursorStyle = 'url("/cursors/select.png") 0 0, crosshair';
        break;
      case 'cursor':
      default:
        cursorStyle = 'default';
    }

    // Ustaw kursor tylko dla canvas i jego kontenera
    if (canvas) {
      canvas.style.cursor = cursorStyle;
    }
    if (canvasArea) {
      canvasArea.style.cursor = cursorStyle;
    }
    if (canvasContainer) {
      canvasContainer.style.cursor = cursorStyle;
    }

    // Ustaw domyślny kursor dla reszty strony
    document.body.style.cursor = 'default';

    // Ustaw domyślny kursor dla paneli (górny i prawy)
    const topPanel = document.querySelector('.panel-top, .top-panel, .header, .top-bar');
    const rightPanel = document.querySelector('.panel-right, .right-panel, .sidebar-right');
    
    if (topPanel) {
      topPanel.style.cursor = 'default';
    }
    if (rightPanel) {
      rightPanel.style.cursor = 'default';
    }

    // Reset kursora gdy komponent się odmontowuje
    return () => {
      document.body.style.cursor = 'default';
      if (canvas) canvas.style.cursor = 'default';
      if (canvasArea) canvasArea.style.cursor = 'default';
      if (canvasContainer) canvasContainer.style.cursor = 'default';
    };
  }, [tool]);

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
    { icon: '🔺', name: 'Kształty', type: 'shape', onClick: handleShapeClick },
    { icon: '📝', name: 'Tekst', type: 'text' },
    { icon: '😊', name: 'Emotki', type: 'emoji', onClick: handleEmojiClick },
    { icon: '🖼️', name: 'Gify', type: 'gifs' },
    { icon: '📎', name: 'Multimedia', type: 'multi' },
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

  const emojis = ['😀', '😁', '😂', '🤣', '😊', '😍', '😎', '😢', '😡', '👍', '👎', '❤️', '🔥', '🎉', '💡'];

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
                onClick={(e) => {
                  if (toolItem.type) setTool(toolItem.type);
                  if (toolItem.onClick) toolItem.onClick(e);
                }}
                style={{ cursor: 'default' }}
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
                    style={{ cursor: 'default' }}
                  />
                  <span className="tool-size-value">{size[toolItem.type]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="tool-item tool-undo-redo">
          <button className="tool-btn" title="Cofnij" style={{ cursor: 'default' }}>↶</button>
          <button className="tool-btn" title="Ponów" style={{ cursor: 'default' }}>↷</button>
        </div>
        {/* Kolor i historia */}
        <div className="toolbar-section">
          <h4>Kolor</h4>
          <div className="color-picker">
            <input
              type="color"
              value={tempColor}
              onChange={(e) => {
                const newColor = e.target.value;
                setTempColor(newColor);
                setColor(newColor);
              }}
              onMouseUp={() => {
                if (tempColor !== selectedColor) {
                  setRecentColors(prev => [selectedColor, ...prev.filter(c => c !== selectedColor)].slice(0, 3));
                  setSelectedColor(tempColor);
                }
              }}
              style={{ cursor: 'default' }}
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
                  style={{ backgroundColor: clr, cursor: 'default' }}
                  onClick={() => {
                    setSelectedColor(clr);
                    setColor(clr);
                    setTempColor(clr);
                    setRecentColors(prev => [clr, ...prev.filter(c => c !== clr)].slice(0, 3));
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
            style={{ top: `${showShapes.y}px`, left: `${showShapes.x}px`, cursor: 'default' }}
          >
            {shapes.map((shape, i) => (
              <button
                key={i}
                className={`shape-btn ${selectedShape === shape.name ? 'selected' : ''}`}
                title={shape.name}
                onClick={() => handleSelectShape(shape.name)}
                style={{ cursor: 'default' }}
              >
                {shape.label}
              </button>
            ))}
          </div>
        )}

        {showEmojis.visible && (
          <div
            className="floating-emojis-popup"
            style={{ top: `${showEmojis.y}px`, left: `${showEmojis.x}px`, cursor: 'default' }}
          >
            {emojis.map((emoji, i) => (
              <button
                key={i}
                className={`emoji-btn ${selectedEmoji === emoji ? 'selected' : ''}`}
                title={emoji}
                onClick={() => handleSelectEmoji(emoji)}
                style={{ cursor: 'default' }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={`collapse-toggle small ${collapsed ? 'collapsed-position' : ''}`}
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Rozwiń pasek' : 'Zwiń pasek'}
        style={{ cursor: 'default' }}
      >
        <span className={`arrow ${collapsed ? 'arrow-right' : 'arrow-left'}`}>➤</span>
      </div>
      <ToolRangeCircle tool={tool} size={size} />
    </>
  );
};

export default Toolbar;
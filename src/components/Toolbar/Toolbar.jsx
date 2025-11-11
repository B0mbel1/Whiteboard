import React, { useState, useEffect, useRef } from 'react';
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

  const [showGifs, setShowGifs] = useState({ visible: false, x: 0, y: 0 });
  const [gifQuery, setGifQuery] = useState('');

  const [gifs, setGifs] = useState([]); // lista gifów do wyświetlenia
  const searchTimeoutRef = useRef(null);

  const [gifOffset, setGifOffset] = useState(0); // nowy offset
  const [hasMoreGifs, setHasMoreGifs] = useState(true); // czy są jeszcze kolejne GIFy
  const gifCache = useRef({});


  const API_KEY = 'WJnPjdfsVgD5j5MmtTnWeI8Y05htecbA'; // wstaw tutaj swój Giphy API Key
  const GIF_LIMIT = 24; // np. 24 GIFy na stronę

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
  //=====================================GIFY============================
  const handleGifClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    setShowGifs(prev => ({
      visible: !prev.visible,
      x: rect.right + 10,
      y: rect.top - 20
    }));
  };

  const fetchGifs = async (query = '', offset = 0, append = false) => {
    const cacheKey = `${query}_${offset}`;
    if (gifCache.current[cacheKey]) {
      if (append) {
        setGifs(prev => [...prev, ...gifCache.current[cacheKey]]);
      } else {
        setGifs(gifCache.current[cacheKey]);
      }
      return;
    }

    try {
      const url = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}&limit=${GIF_LIMIT}&offset=${offset}`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${API_KEY}&limit=${GIF_LIMIT}&offset=${offset}`;

      const res = await fetch(url);
      const data = await res.json();
      const urls = data.data.map(gif => gif.images.fixed_width.url);

      gifCache.current[cacheKey] = urls; // zapis do cache

      if (append) {
        setGifs(prev => [...prev, ...urls]);
      } else {
        setGifs(urls);
      }

      setHasMoreGifs(data.pagination.total_count > offset + GIF_LIMIT);
    } catch (err) {
      console.error('Błąd pobierania GIFów:', err);
    }
  };

  const handleGifQueryChange = (e) => {
    const value = e.target.value;
    setGifQuery(value);

    // reset poprzedniego timera
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    // szybki debounce
    searchTimeoutRef.current = setTimeout(() => {
      fetchGifs(value.trim());
      setGifOffset(0); // reset offset przy nowym wyszukiwaniu
    }, 100); // 100ms zamiast 200-300
  };

  useEffect(() => {
    if (!showGifs.visible) return;

    // natychmiastowy fetch przy otwarciu popupu (trending GIFy)
    if (gifQuery.trim() === '') {
      fetchGifs();
      return;
    }

    // debounce przy wpisywaniu
    const timer = setTimeout(() => {
      fetchGifs(gifQuery.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [showGifs.visible, gifQuery]);

  const handleGifScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 10) { // blisko dołu
      if (hasMoreGifs) {
        const newOffset = gifOffset + GIF_LIMIT;
        fetchGifs(gifQuery.trim(), newOffset, true);
        setGifOffset(newOffset);
      }
    }
  };

  //===================================EMOJI============================
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
    { icon: '📋', name: 'Notatki', type: 'notes' },
    { icon: '😊', name: 'Emotki', type: 'emoji', onClick: handleEmojiClick },
    { icon: '🖼️', name: 'Gify', type: 'gifs', onClick: handleGifClick },
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
                  if (toolItem.type) setTool(toolItem.type); // ustaw tool
                  if (toolItem.onClick) toolItem.onClick(e); // ← przekaż event!
                }}
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
                  // Ustawiamy wybrany kolor jako aktualny
                  setSelectedColor(tempColor);

                  // Aktualizujemy listę ostatnich kolorów
                  setRecentColors(prev => {
                    const newList = [tempColor, ...prev.filter(c => c !== tempColor)];
                    return newList.slice(0, 3); // ograniczamy do 3 ostatnich
                  });
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
                    // Ustawiamy kolor kliknięty w historii
                    setSelectedColor(clr);
                    setColor(clr);
                    setTempColor(clr);

                    // Przesuwamy kolor na początek historii
                    setRecentColors(prev => {
                      const newList = [clr, ...prev.filter(c => c !== clr)];
                      return newList.slice(0, 3);
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
        {showGifs.visible && (
          <div
            className="floating-gifs-popup"
            style={{ top: `${showGifs.y}px`, left: `${showGifs.x}px` }}
            onScroll={handleGifScroll} // <-- dodane

          >
            <input
              type="text"
              placeholder="Szukaj gifów..."
              value={gifQuery}
              onChange={handleGifQueryChange} // <-- nowa funkcja
              style={{
                width: '200px',
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid #ccc',
                marginBottom: '10px'
              }}
            />
            <div className="gif-results">
              {gifs.length === 0 ? (
                <p>Brak GIFów 😢</p>
              ) : (
                <div className="gif-grid">
                  {gifs.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt="gif"
                      style={{
                        objectFit: 'cover',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                      onClick = {() => console.log('Wybrano GIF:', url)}
                    />
                  ))}
                </div>
              )}
            </div>
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
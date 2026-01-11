import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import './Toolbar.css';
import MultimediaModal from '../MultimediaModal/MultimediaModal.jsx';
import PointerTrail from './PointerTrail.jsx';
import ToolRangeCircle from './ToolRangeCircle.jsx';

const Toolbar = ({ position, tool, setTool, color, setColor, size, setSize, setShowColorPicker, activeEmoji, setActiveEmoji, setActiveGif, setActiveShape, onImageCreate, panOffset, zoom = 1 }) => {
  // DEBUG: Sprawdźmy co Toolbar dostaje
  useEffect(() => {
    console.log("🛠️ Toolbar mounted. Props onImageCreate:", typeof onImageCreate);
  }, [onImageCreate]);

  // 🔹 Zmiana: Wszystkie stany popupów przechowują teraz tylko 'visible', bez x/y
  const [showShapes, setShowShapes] = useState({ visible: false });
  const [showEmojis, setShowEmojis] = useState({ visible: false });
  const [showGifs, setShowGifs] = useState({ visible: false });

  const [selectedShape, setSelectedShape] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  // 🔹 ZMIANA 1: Funkcja pomocnicza do pobierania zapisanego aktywnego koloru
  const getSavedActiveColor = () => {
    try {
      return localStorage.getItem('whiteboard-active-color') || color || '#000000';
    } catch (e) {
      return color || '#000000';
    }
  };

  const handleLocalImageCreate = (imageObj) => {
    // 1. Pobieramy środek ekranu (viewportu) użytkownika
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // 2. Obliczamy pozycję w "świecie gry" (World Coordinates)
    // Wzór: (Pozycja_Ekranu - Przesunięcie_Pan) / Zoom

    // Najpierw odejmujemy przesunięcie (panOffset)
    const relativeX = centerX - (panOffset?.x || 0);
    const relativeY = centerY - (panOffset?.y || 0);

    // Następnie dzielimy przez zoom, aby dopasować jednostki do skali świata
    const worldX = relativeX / zoom;
    const worldY = relativeY / zoom;

    // 3. Centrujemy sam obrazek
    // Odejmujemy połowę jego domyślnej szerokości (150) i wysokości (100)
    // Ważne: Robimy to już na jednostkach świata (po podzieleniu przez zoom)
    const targetX = worldX - 150;
    const targetY = worldY - 100;

    // 4. Tworzymy nowy obiekt zdjęcia z poprawnymi współrzędnymi
    const imageWithCorrectPosition = {
      ...imageObj,
      x: targetX,
      y: targetY,
      // Upewniamy się, że szerokość też jest zgodna z domyślną
      width: imageObj.width || 300
    };

    // 5. Wywołujemy funkcję przekazaną z góry (z WhiteboardRouter)
    if (onImageCreate) {
      onImageCreate(imageWithCorrectPosition);
    }
  };

  // Inicjalizacja stanów koloru z localStorage
  const [selectedColor, setSelectedColor] = useState(getSavedActiveColor);
  const [tempColor, setTempColor] = useState(getSavedActiveColor);

  // 🔹 ZMIANA 1 (Ciąg dalszy): Przy montowaniu komponentu ustawiamy kolor w aplikacji (parent)
  // na ten pobrany z localStorage, żeby narzędzia rysowania o nim wiedziały.
  useEffect(() => {
    const savedColor = getSavedActiveColor();
    if (savedColor && savedColor !== color) {
      setColor(savedColor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Uruchamiamy tylko raz przy starcie

  // Inicjalizacja recentColors z localStorage (z poprzedniego kroku)
  const [recentColors, setRecentColors] = useState(() => {
    try {
      const saved = localStorage.getItem('whiteboard-recent-colors');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Błąd odczytu kolorów z localStorage:", e);
      return [];
    }
  });

  // Zapisywanie recentColors do localStorage przy każdej zmianie
  useEffect(() => {
    localStorage.setItem('whiteboard-recent-colors', JSON.stringify(recentColors));
  }, [recentColors]);

  const [showMultimedia, setShowMultimedia] = useState(false);
  const [gifQuery, setGifQuery] = useState('');

  const [gifs, setGifs] = useState([]);
  const searchTimeoutRef = useRef(null);
  const [gifOffset, setGifOffset] = useState(0);
  const [hasMoreGifs, setHasMoreGifs] = useState(true);
  const gifCache = useRef({});

  const API_KEY = 'XpMqI44Eo56UVR4wh8kFgFdGtR71nNRb';
  const GIF_LIMIT = 24;

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // 🔹 REFS dla dynamicznego pozycjonowania (Kształty, Emoji, GIFy)
  const shapesBtnRef = useRef(null);
  const shapesPopupRef = useRef(null);

  const emojisBtnRef = useRef(null);
  const emojisPopupRef = useRef(null);

  const gifsBtnRef = useRef(null);
  const gifsPopupRef = useRef(null);

  const toolbarRef = useRef(null);

  const handleSizeChange = (toolKey, value) => {
    setSize(prev => ({ ...prev, [toolKey]: parseInt(value, 10) }));
  };

  // 🔹 Uproszczone handlery - tylko przełączanie widoczności
  const handleShapeClick = (e) => {
    setSelectedShape(null); // Czyścimy wybór
    setShowEmojis(prev => ({ ...prev, visible: false }));
    setShowGifs(prev => ({ ...prev, visible: false }));
    setShowShapes(prev => ({ ...prev, visible: !prev.visible }));
  };
  const handleEmojiClick = (e) => {
    setShowShapes(prev => ({ ...prev, visible: false }));
    setShowGifs(prev => ({ ...prev, visible: false }));
    setShowEmojis(prev => ({ ...prev, visible: !prev.visible }));
  };
  const handleGifClick = (e) => {
    setShowShapes(prev => ({ ...prev, visible: false }));
    setShowEmojis(prev => ({ ...prev, visible: false }));
    setShowGifs(prev => ({ ...prev, visible: !prev.visible }));
  };

  // 🔹 ZAKTUALIZOWANY EFEKT POZYCJONOWANIA
  useLayoutEffect(() => {
    const updatePosition = () => {
      if (showShapes.visible && shapesBtnRef.current && shapesPopupRef.current) {
        const btnRect = shapesBtnRef.current.getBoundingClientRect();
        shapesPopupRef.current.style.left = `${btnRect.right + 10}px`;
        shapesPopupRef.current.style.top = `${btnRect.top - 20}px`;
      }
      if (showEmojis.visible && emojisBtnRef.current && emojisPopupRef.current) {
        const btnRect = emojisBtnRef.current.getBoundingClientRect();
        emojisPopupRef.current.style.left = `${btnRect.right + 10}px`;
        emojisPopupRef.current.style.top = `${btnRect.top - 20}px`;
      }
      if (showGifs.visible && gifsBtnRef.current && gifsPopupRef.current) {
        const btnRect = gifsBtnRef.current.getBoundingClientRect();
        gifsPopupRef.current.style.left = `${btnRect.right + 10}px`;
        gifsPopupRef.current.style.top = `${btnRect.top - 20}px`;
      }
    };

    if (showShapes.visible || showEmojis.visible || showGifs.visible) {
      updatePosition();
    }

    const toolbar = toolbarRef.current;
    if (toolbar) {
      toolbar.addEventListener('scroll', updatePosition);
    }
    window.addEventListener('resize', updatePosition);

    return () => {
      if (toolbar) toolbar.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showShapes.visible, showEmojis.visible, showGifs.visible]);

  const handleMultimediaClick = () => {
    setShowMultimedia(true);
  };

  const handleUndo = () => {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar && toolbar.undo) toolbar.undo();
  };

  const handleRedo = () => {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar && toolbar.redo) toolbar.redo();
  };

  const updateUndoRedoState = () => {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      setCanUndo(toolbar.canUndo ? toolbar.canUndo() : false);
      setCanRedo(toolbar.canRedo ? toolbar.canRedo() : false);
    }
  };

  useEffect(() => {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      toolbar.updateUndoRedoState = updateUndoRedoState;
    }
  }, []);

  useEffect(() => {
    const checkState = () => { updateUndoRedoState(); };
    const interval = setInterval(checkState, 100);
    return () => clearInterval(interval);
  }, []);

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

      gifCache.current[cacheKey] = urls;
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
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchGifs(value.trim());
      setGifOffset(0);
    }, 100);
  };

  useEffect(() => {
    if (!showGifs.visible) return;
    if (gifQuery.trim() === '') {
      fetchGifs();
      return;
    }
    const timer = setTimeout(() => {
      fetchGifs(gifQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [showGifs.visible, gifQuery]);

  const handleGifScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      if (hasMoreGifs) {
        const newOffset = gifOffset + GIF_LIMIT;
        fetchGifs(gifQuery.trim(), newOffset, true);
        setGifOffset(newOffset);
      }
    }
  };

  const handleSelectShape = (shapeObj) => {
    setSelectedShape(shapeObj.name);
    if (setActiveShape) setActiveShape(shapeObj.type);
    setTool('shape');
    setShowShapes({ visible: false });
  };

  const handleSelectEmoji = (emoji) => {
    if (setActiveEmoji) setActiveEmoji(emoji);
    setTool('emoji');
    setShowEmojis({ visible: false });
  };

  useEffect(() => {
    const canvas = document.querySelector('canvas');
    const canvasArea = document.querySelector('.canvas-area');
    const canvasContainer = document.querySelector('.canvas-container');

    let cursorStyle = 'default';

    switch (tool) {
      case 'pencil': cursorStyle = 'url("/cursors/pencil.png") 0 32, auto'; break;
      case 'brush': cursorStyle = 'url("/cursors/brush.png") 0 32, auto'; break;
      case 'eraser': cursorStyle = 'url("/cursors/rubber.png") 0 32, auto'; break;
      case 'pointer': cursorStyle = 'pointer'; break;
      case 'select': cursorStyle = 'url("/cursors/select.png") 0 0, crosshair'; break;
      case 'emoji': cursorStyle = 'default'; break;
      case 'cursor':
      default: cursorStyle = 'default';
    }

    if (canvas) canvas.style.cursor = cursorStyle;
    if (canvasArea) canvasArea.style.cursor = cursorStyle;
    if (canvasContainer) canvasContainer.style.cursor = cursorStyle;
    document.body.style.cursor = 'default';

    return () => {
      document.body.style.cursor = 'default';
      if (canvas) canvas.style.cursor = 'default';
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
    { icon: '📎', name: 'Multimedia', type: 'multi', onClick: handleMultimediaClick },
  ];

  const shapes = [
    { label: '⬛', name: 'Kwadrat', type: 'square' },
    { label: '▭', name: 'Prostokąt', type: 'rectangle_outline' },
    { label: '➡️', name: 'Strzałka', type: 'arrow' },
    { label: '⚪', name: 'Koło', type: 'circle' },
    { label: '⭐', name: 'Gwiazda', type: 'star' },
    { label: '✅', name: 'Zatwierdzenie', type: 'check' },
    { label: '❌', name: 'Zaprzeczenie', type: 'cross' },
  ];

  const emojis = ['😀', '😁', '😂', '🤣', '😊', '😍', '😎', '😢', '😡', '👍', '👎', '❤️', '🔥', '🎉', '💡'];

  return (
    <>
      <div
        ref={toolbarRef}
        className={`toolbar toolbar-${position} ${collapsed ? 'collapsed' : ''}`}
      >
        <div className="toolbar-section">
          <h4>Narzędzia</h4>
          {tools.map((toolItem, index) => (
            <div key={index} className="tool-item">
              <button
                ref={
                  toolItem.type === 'shape' ? shapesBtnRef :
                    toolItem.type === 'emoji' ? emojisBtnRef :
                      toolItem.type === 'gifs' ? gifsBtnRef : null
                }
                className={`tool-btn ${tool === toolItem.type ? 'selected' : ''}`}
                title={toolItem.name}
                onClick={(e) => {
                  if (toolItem.type) setTool(toolItem.type);
                  if (toolItem.onClick) toolItem.onClick(e);
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
                // Opcjonalnie: można tu zapisywać localStorage, ale 'onMouseUp' jest bezpieczniejsze dla wydajności
              }}
              onMouseUp={() => {
                // Po puszczeniu suwaka:
                // 1. Aktualizujemy committed color
                setSelectedColor(tempColor);
                // 2. Dodajemy do ostatnich kolorów
                if (tempColor !== selectedColor) {
                  setRecentColors(prev => {
                    const newList = [tempColor, ...prev.filter(c => c !== tempColor)];
                    return newList.slice(0, 3);
                  });
                }
                // 3. 🔹 ZMIANA 2: Zapisujemy AKTUALNY kolor rysowania do pamięci
                localStorage.setItem('whiteboard-active-color', tempColor);
              }}
              style={{ cursor: 'default' }}
            />
            {/* 🔹 ZMIANA 3: Wyświetlamy tempColor zamiast selectedColor, żeby synchronizowało się przy przesuwaniu */}
            <span className="selected-color">{tempColor}</span>
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
                    localStorage.setItem('whiteboard-active-color', clr); // Zapisujemy przy kliknięciu w historię
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

        {/* 🔹 Popup Kształtów */}
        {showShapes.visible && (
          <div
            ref={shapesPopupRef}
            className="floating-shapes-popup"
            style={{ position: 'fixed', cursor: 'default' }}
          >
            {shapes.map((shape, i) => (
              <button
                key={i}
                className={`shape-btn ${selectedShape === shape.name ? 'selected' : ''}`}
                title={shape.name}
                onClick={() => handleSelectShape(shape)}
                style={{ cursor: 'default' }}
              >
                {shape.label}
              </button>
            ))}
          </div>
        )}

        {/* 🔹 Popup Emoji */}
        {showEmojis.visible && (
          <div
            ref={emojisPopupRef}
            className="floating-emojis-popup"
            style={{ position: 'fixed', cursor: 'default' }}
          >
            {emojis.map((emoji, i) => (
              <button
                key={i}
                className={`emoji-btn ${activeEmoji === emoji ? 'selected' : ''}`}
                title={emoji}
                onClick={() => handleSelectEmoji(emoji)}
                style={{ cursor: 'default' }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* 🔹 Popup GIFów */}
        {showGifs.visible && (
          <div
            ref={gifsPopupRef}
            className="floating-gifs-popup"
            style={{ position: 'fixed' }}
            onScroll={handleGifScroll}
          >
            <input
              type="text"
              placeholder="Szukaj gifów..."
              value={gifQuery}
              onChange={handleGifQueryChange}
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
                        width: '60px',
                        height: '60px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setActiveGif(url);
                        setTool('gif');
                        setShowGifs({ visible: false });
                      }}
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

      {showMultimedia && (
        <MultimediaModal
          onClose={() => { setShowMultimedia(false); setTool('cursor'); }}
          onImageCreate={handleLocalImageCreate} // <-- ZMIANA TUTAJ
        />
      )}

      <ToolRangeCircle tool={tool} size={size} />
    </>
  );
};

export default Toolbar;
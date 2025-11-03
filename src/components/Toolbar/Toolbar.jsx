import React from 'react';
import './Toolbar.css';

const Toolbar = ({ position }) => {
  const tools = [
    { icon: '✏️', name: 'Ołówek', size: true },
    { icon: '🧽', name: 'Gumka', size: true },
    { icon: '🖌️', name: 'Pędzle', size: true },
    { icon: '🔺', name: 'Kształty' },
    { icon: '📝', name: 'Tekst' },
    { icon: '😊', name: 'Emotki' },
    { icon: '🎨', name: 'Kolory' },
    { icon: '⬆️', name: 'Zaznaczenie' },
    { icon: '🖼️', name: 'Gify' },
    { icon: '📎', name: 'Multimedia' },
    { icon: '↶', name: 'Undo' },
    { icon: '↷', name: 'Redo' }
  ];

  return (
    <div className={`toolbar toolbar-${position}`}>
      <div className="toolbar-section">
        <h4>Narzędzia</h4>
        {tools.map((tool, index) => (
          <div key={index} className="tool-item">
            <button className="tool-btn" title={tool.name}>
              {tool.icon}
            </button>
            {tool.size && (
              <div className="tool-size">
                <input type="range" min="1" max="10" defaultValue="3" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="toolbar-section">
        <h4>Kolory</h4>
        <div className="color-palette">
          {['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'].map((color, index) => (
            <button 
              key={index} 
              className="color-btn" 
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
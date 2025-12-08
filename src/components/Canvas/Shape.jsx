import React from 'react';

const Shape = ({ id, x, y, type, selected, onSelect, onRemove }) => {
  const handleClick = (e) => {
    e.stopPropagation();
    onSelect(id);
  };

  const style = {
    position: 'absolute',
    left: x,
    top: y,
    transform: 'translate(-50%, -50%)', // Centrowanie względem punktu kliknięcia
    cursor: 'pointer',
    border: selected ? '2px dashed #3498db' : 'none',
    padding: '4px',
    zIndex: 10,
    transition: 'transform 0.1s'
  };

  // Renderowanie odpowiedniego kształtu
  const renderShapeContent = () => {
    switch (type) {
      case 'square': // 1) Kwadrat (czarny wypełniony)
        return <div style={{ width: '60px', height: '60px', background: 'black' }} />;
      
      case 'rectangle_outline': // 2) Obramowanie (puste w środku)
        return <div style={{ width: '80px', height: '50px', border: '3px solid black', background: 'transparent' }} />;
      
      case 'circle': // 4) Koło
        return <div style={{ width: '60px', height: '60px', background: 'black', borderRadius: '50%' }} />;

      case 'arrow': // 3) Czarna strzałka
        return (
          <svg width="60" height="60" viewBox="0 0 24 24" fill="black">
            <path d="M12 2L2 22L12 18L22 22L12 2Z" /> {/* Prosta strzałka/kursor */}
            {/* Lub klasyczna strzałka w prawo: */}
            {/* <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> */}
          </svg>
        );

      case 'star': // 5) Złota gwiazdka
        return (
          <svg width="60" height="60" viewBox="0 0 24 24" fill="#f1c40f">
            <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.62L12 2L9.19 8.62L2 9.24L7.45 13.97L5.82 21L12 17.27Z" />
          </svg>
        );

      case 'check': // 6) Budka checked, zielona
        return (
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );

      case 'cross': // 7) Znak X, czerwony
        return (
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        );

      default:
        return <div style={{ width: '50px', height: '50px', background: '#ccc' }} />;
    }
  };

  return (
    <div 
      className="shape-item" 
      style={style} 
      onClick={handleClick}
      tabIndex={0} // Aby element mógł przyjąć focus (dla delete)
    >
      {renderShapeContent()}
    </div>
  );
};

export default Shape;
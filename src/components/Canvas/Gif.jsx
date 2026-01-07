import React from 'react';
import DraggableResizableWrapper from './DraggableResizableWrapper';

// Dodajemy prop 'onUpdate'
const Gif = ({ id, x, y, url, width = 150, selected, onSelect, onUpdate, tool, panOffset, limit = 1500 }) => {
  const isDrawingTool = ['pencil', 'brush', 'eraser'].includes(tool);
  return (
    <DraggableResizableWrapper
      id={id}
      x={x}
      y={y}
      width={width}
      isSelected={selected}
      onSelect={onSelect}
      onUpdate={onUpdate} // Przekazujemy funkcję update
      aspectRatioLocked={true} // Ważne dla obrazków
      panOffset={panOffset} // 🔹 Przekazujemy offset
      limit={limit}
      style={{ pointerEvents: isDrawingTool ? 'none' : 'auto' }}
    >
      <img
        src={url}
        alt="gif"
        style={{
          width: '100%', // Obrazek wypełnia wrapper
          height: 'auto', // Wysokość dostosowuje się do szerokości
          display: 'block',
          pointerEvents: 'none'
        }}
      />
    </DraggableResizableWrapper>
  );
};

export default Gif;
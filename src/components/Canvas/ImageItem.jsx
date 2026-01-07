import React from 'react';
import DraggableResizableWrapper from './DraggableResizableWrapper';

const ImageItem = ({ id, x, y, url, width = 200, selected, onSelect, onUpdate, panOffset, limit = 1500     // 🔹 Odbieramy
}) => {
  return (
    <DraggableResizableWrapper
      id={id}
      x={x}
      y={y}
      width={width}
      isSelected={selected}
      onSelect={onSelect}
      onUpdate={onUpdate}
      aspectRatioLocked={true}
      panOffset={panOffset} // 🔹 Przekazujemy dalej
      limit={limit}         // 🔹 Przekazujemy dalej
    >
      <img
        src={url}
        alt="uploaded"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      />
    </DraggableResizableWrapper>
  );
};

export default ImageItem;

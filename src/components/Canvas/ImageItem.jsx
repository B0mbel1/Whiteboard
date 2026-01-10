import React from 'react';
import DraggableResizableWrapper from './DraggableResizableWrapper';

// 🔹 Dodajemy 'zoom' do destrukturyzacji propsów (domyślnie 1)
const ImageItem = ({ 
  id, 
  x, 
  y, 
  url, 
  width = 200, 
  selected, 
  onSelect, 
  onUpdate, 
  panOffset, 
  limit = 1500,
  zoom = 1 // 🔹 Odbieramy zoom
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
      panOffset={panOffset}
      limit={limit}
      zoom={zoom} // 🔹 Przekazujemy zoom do wrappera
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
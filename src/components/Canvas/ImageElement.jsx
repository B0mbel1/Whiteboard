import React from 'react';
import DraggableResizableWrapper from './DraggableResizableWrapper';

const ImageElement = ({ id, x, y, url, width = 150, selected, onSelect, onUpdate }) => {
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
    >
      <img 
        src={url} 
        alt="uploaded content" 
        style={{ 
          width: '100%',
          height: 'auto',
          display: 'block',
          pointerEvents: 'none' 
        }} 
      />
    </DraggableResizableWrapper>
  );
};

export default ImageElement;
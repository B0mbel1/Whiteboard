import React from "react";
import DraggableResizableWrapper from "./DraggableResizableWrapper";

const ImageItem = ({
  id,
  x,
  y,
  width,
  height,
  url,
  selected,
  onSelect,
  onUpdate,
  panOffset,
  limit,
  zoom,
  aspectRatio
}) => {
  return (
    <DraggableResizableWrapper
      id={id}
      x={x}
      y={y}
      width={width}
      // Jeśli height nie jest podane, wrapper wyliczy je z aspectRatio
      height={height} 
      isSelected={selected}
      onSelect={onSelect}
      onUpdate={onUpdate}
      panOffset={panOffset}
      limit={limit}
      zoom={zoom}
      aspectRatioLocked={true} // Zdjęcia zazwyczaj mają zablokowane proporcje
      aspectRatio={aspectRatio}
      style={{ pointerEvents: "auto" }}
    >
      <img
        src={url}
        alt="whiteboard item"
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain", // Lub "cover" jeśli wolisz
          pointerEvents: "none",
          display: "block", // 🔹 DODANO: Zapobiega dziwnym odstępom na dole
          userSelect: "none"
        }}
      />
    </DraggableResizableWrapper>
  );
};

export default ImageItem;
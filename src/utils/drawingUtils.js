// 📁 utils/drawingUtils.js
import { getDisplaySize, getToolEffects } from './toolSizes';

export const drawCompletePath = (context, tool, color, size, points) => {
  if (!context || !points || points.length < 2) return;

  const displaySize = getDisplaySize(tool, size);
  const effects = getToolEffects(tool);
  
  context.save();
  context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  context.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
  context.lineWidth = displaySize;
  context.shadowBlur = effects.shadowBlur;
  context.shadowColor = tool === 'eraser' ? 'transparent' : color;
  context.lineCap = effects.lineCap;
  context.lineJoin = effects.lineJoin;

  // Rysuj CAŁĄ ścieżkę jako jeden ciągły linia
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  
  for (let i = 1; i < points.length; i++) {
    context.lineTo(points[i].x, points[i].y);
  }
  
  context.stroke();
    if (effects.shadowBlur > 0) {
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
    // Przerysuj bez shadow aby uniknąć kumulacji
    context.stroke();
  }
  context.restore();
};

// Funkcja do rysowania pojedynczego segmentu (dla real-time)
export const drawPathSegment = (context, tool, color, size, fromPoint, toPoint) => {
  const displaySize = getDisplaySize(tool, size);
  const effects = getToolEffects(tool);
  
  context.save();
  context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  context.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
  context.lineWidth = displaySize;
  context.shadowBlur = effects.shadowBlur;
  context.shadowColor = tool === 'eraser' ? 'transparent' : color;
  context.lineCap = effects.lineCap;
  context.lineJoin = effects.lineJoin;

  context.beginPath();
  context.moveTo(fromPoint.x, fromPoint.y);
  context.lineTo(toPoint.x, toPoint.y);
  context.stroke();
    if (effects.shadowBlur > 0) {
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
    // Przerysuj bez shadow aby uniknąć kumulacji
    context.stroke();
  }
  context.restore();
};
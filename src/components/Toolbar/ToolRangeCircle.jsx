import React, { useState, useEffect } from "react";

// Dodaliśmy prop zoom
const ToolRangeCircle = ({ tool, size, zoom = 1 }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [isOverCanvas, setIsOverCanvas] = useState(false);

  useEffect(() => {
    const handleMove = (e) => {
      setPos({ x: e.clientX, y: e.clientY });
      const canvas = document.querySelector('canvas');
      const target = e.target;
      // Proste sprawdzenie czy jesteśmy nad obszarem roboczym
      const isCanvas = target.closest('.canvas-area') || target.tagName === 'CANVAS';
      setIsOverCanvas(!!isCanvas);
      
      if ((tool === "brush" || tool === "pencil" || tool === "eraser") && isCanvas) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    
    const handleLeave = () => setVisible(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
    };
  }, [tool]);

  if (!visible || !isOverCanvas) return null;

  let multiplier = 2; 
  if (tool === "pencil") multiplier = 1; 
  if (tool === "eraser") multiplier = 2; 

  const toolSize = Number(size?.[tool]) || 5;
  
  // 🧮 SKALOWANIE: Rozmiar * Zoom
  let currentSize = (toolSize * multiplier) * zoom; 

  if (tool === "eraser") {
    currentSize += (5 * zoom);
  }

  const radius = currentSize / 2;
  
  return (
    <div
      style={{
        position: "fixed",
        top: `${pos.y - radius}px`,
        left: `${pos.x - radius}px`,
        width: `${currentSize}px`,
        height: `${currentSize}px`,
        border: "2px solid rgba(0,0,0,0.6)",
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 999999,
        backgroundColor: tool === "eraser" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
        mixBlendMode: tool === "eraser" ? "difference" : "normal",
        boxShadow: "0 0 4px rgba(0,0,0,0.2)",
      }}
    />
  );
};

export default ToolRangeCircle;
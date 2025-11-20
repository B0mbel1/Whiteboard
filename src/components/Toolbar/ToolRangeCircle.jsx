// ToolRangeCircle.jsx
import React, { useState, useEffect } from "react";

const ToolRangeCircle = ({ tool, size }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [isOverCanvas, setIsOverCanvas] = useState(false);

  useEffect(() => {
    const handleMove = (e) => {
      setPos({ x: e.clientX, y: e.clientY });

      // Sprawdzamy czy kursor jest nad canvasem lub jego kontenerem
      const canvas = document.querySelector('canvas');
      const canvasArea = document.querySelector('.canvas-area');
      const canvasContainer = document.querySelector('.canvas-container');

      const target = e.target;
      const isOverCanvasElement =
        target === canvas ||
        target === canvasArea ||
        target === canvasContainer ||
        canvas?.contains(target) ||
        canvasArea?.contains(target) ||
        canvasContainer?.contains(target);

      setIsOverCanvas(isOverCanvasElement);

      if ((tool === "brush" || tool === "pencil" || tool === "eraser") && isOverCanvasElement) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    const handleLeave = () => {
      setVisible(false);
      setIsOverCanvas(false);
    };

    // Dodajemy również sprawdzenie przy wejściu/wyjściu z canvas
    const handleCanvasEnter = () => setIsOverCanvas(true);
    const handleCanvasLeave = () => {
      setIsOverCanvas(false);
      setVisible(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);

    // Dodajemy event listeners dla canvas i jego kontenerów
    const canvas = document.querySelector('canvas');
    const canvasArea = document.querySelector('.canvas-area');
    const canvasContainer = document.querySelector('.canvas-container');

    if (canvas) {
      canvas.addEventListener('mouseenter', handleCanvasEnter);
      canvas.addEventListener('mouseleave', handleCanvasLeave);
    }
    if (canvasArea) {
      canvasArea.addEventListener('mouseenter', handleCanvasEnter);
      canvasArea.addEventListener('mouseleave', handleCanvasLeave);
    }
    if (canvasContainer) {
      canvasContainer.addEventListener('mouseenter', handleCanvasEnter);
      canvasContainer.addEventListener('mouseleave', handleCanvasLeave);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);

      if (canvas) {
        canvas.removeEventListener('mouseenter', handleCanvasEnter);
        canvas.removeEventListener('mouseleave', handleCanvasLeave);
      }
      if (canvasArea) {
        canvasArea.removeEventListener('mouseenter', handleCanvasEnter);
        canvasArea.removeEventListener('mouseleave', handleCanvasLeave);
      }
      if (canvasContainer) {
        canvasContainer.removeEventListener('mouseenter', handleCanvasEnter);
        canvasContainer.removeEventListener('mouseleave', handleCanvasLeave);
      }
    };
  }, [tool]);

  if (!visible || !isOverCanvas) return null;

  // 🎨 Różne mnożniki rozmiaru dla różnych narzędzi
  let multiplier = 2; // domyślnie ×2 dla pędzla
  if (tool === "pencil") multiplier = 1; // ołówek = 1× (czyli 2× mniejszy niż brush)
  if (tool === "eraser") multiplier = 2; // gumka zostaje duża

  const toolSize = Number(size?.[tool]) || 5;
  let currentSize = toolSize * multiplier; // <-- teraz let, można zmieniać

  // 🔹 Dodatkowe +5 dla gumki
  if (tool === "eraser") {
    currentSize += 5;
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
        backgroundColor:
          tool === "eraser" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
        mixBlendMode: tool === "eraser" ? "difference" : "normal",
        boxShadow:
          tool === "eraser"
            ? "0 0 4px rgba(255,255,255,0.5)"
            : "0 0 4px rgba(0,0,0,0.2)",
      }}
    />
  );
};

export default ToolRangeCircle;
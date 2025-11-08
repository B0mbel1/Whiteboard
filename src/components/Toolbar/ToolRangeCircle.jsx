// ToolRangeCircle.jsx
import React, { useState, useEffect } from "react";

const ToolRangeCircle = ({ tool, size }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleMove = (e) => {
      setPos({ x: e.clientX, y: e.clientY });
      if (tool === "brush" || tool === "pencil" || tool === "eraser") {
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

  if (!visible) return null;

  // 🎨 Różne mnożniki rozmiaru dla różnych narzędzi
  let multiplier = 2; // domyślnie ×2 dla pędzla
  if (tool === "pencil") multiplier = 1; // ołówek = 1× (czyli 2× mniejszy niż brush)
  if (tool === "eraser") multiplier = 2; // gumka zostaje duża

  const toolSize = Number(size?.[tool]) || 5;
  const currentSize = toolSize * multiplier;
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

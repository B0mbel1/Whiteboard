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

  const currentSize = size[tool] || 5;
  const radius = currentSize / 2;

  return (
    <div
      style={{
        position: "fixed",
        top: pos.y - radius,
        left: pos.x - radius,
        width: currentSize,
        height: currentSize,
        border: "1px solid rgba(0,0,0,0.5)",
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 999999,
        backgroundColor:
          tool === "eraser" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)",
        mixBlendMode: tool === "eraser" ? "difference" : "normal",
      }}
    />
  );
};

export default ToolRangeCircle;

import React, { useEffect, useRef } from 'react';

const PointerTrail = ({ active, socket, whiteboardId, zoom = 1, panOffset = { x: 0, y: 0 } }) => {
  const canvasRef = useRef(null);
  const trailRef = useRef([]);
  const clicksRef = useRef([]);
  const animationRef = useRef(null);

  // Refy trzymające aktualny stan zoom/pan dla pętli animacji
  const zoomRef = useRef(zoom);
  const panOffsetRef = useRef(panOffset);

  useEffect(() => {
    zoomRef.current = zoom;
    panOffsetRef.current = panOffset;
  }, [zoom, panOffset]);


  
useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      const now = Date.now();
      const currentZoom = zoomRef.current;
      const currentPan = panOffsetRef.current;

      // 1. Pobieramy aktualne przesunięcie samej tablicy względem okna przeglądarki
      // (np. wysokość nagłówka czy szerokość sidebara)
      const mainCanvas = document.querySelector('.canvas-area');
      let offsetLeft = 0;
      let offsetTop = 0;
      
      if (mainCanvas) {
        const rect = mainCanvas.getBoundingClientRect();
        offsetLeft = rect.left;
        offsetTop = rect.top;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 2. Poprawiona funkcja toScreen: uwzględnia teraz pozycję tablicy na stronie
      const toScreen = (x, y) => ({
        x: (x * currentZoom) + currentPan.x + offsetLeft, // 👈 Dodano offsetLeft
        y: (y * currentZoom) + currentPan.y + offsetTop   // 👈 Dodano offsetTop
      });

      // 1. Rysowanie smugi
      for (let i = 0; i < trailRef.current.length; i++) {
        const p = trailRef.current[i];
        const age = (now - p.time) / 300;
        if (age > 1) continue;

        const screenPos = toScreen(p.x, p.y);
        const alpha = 1 - age;
        const radius = (5 + (1 - alpha) * 7.5) * currentZoom;

        const gradient = ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, radius);
        gradient.addColorStop(0, `rgba(255,0,0,1)`);
        gradient.addColorStop(0.7, `rgba(200,0,0,1)`);
        gradient.addColorStop(1, `rgba(150,0,0,0.5)`);
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 2. Rysowanie kliknięć
      for (let i = clicksRef.current.length - 1; i >= 0; i--) {
        const c = clicksRef.current[i];
        const elapsed = now - c.time;
        const progress = elapsed / 500;

        if (progress >= 1) {
          clicksRef.current.splice(i, 1);
          continue;
        }

        const screenPos = toScreen(c.x, c.y);
        const radius = (10 + progress * 60) * currentZoom;
        const alpha = 1 - progress;
        
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255,0,0,${alpha})`;
        ctx.lineWidth = 4 * currentZoom;
        ctx.stroke();
      }

      trailRef.current = trailRef.current.filter((p) => now - p.time < 300);
      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Obsługa myszki lokalnej (Wysyłanie na serwer)
  useEffect(() => {
    const mainCanvas = document.querySelector('.canvas-area');
    if (!mainCanvas) return;

    const isHoveringUI = (target) => {
      return (
        target.closest('.background-toggle') ||
        target.closest('.chat-toggle') ||
        target.closest('.chat-container') ||
        target.closest('.toolbar') ||
        target.closest('.multimedia-modal')
      );
    };

    // Funkcja: Pozycja na ekranie -> Pozycja w świecie
    const toWorld = (clientX, clientY) => {
      const rect = mainCanvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left - panOffsetRef.current.x) / zoomRef.current,
        y: (clientY - rect.top - panOffsetRef.current.y) / zoomRef.current
      };
    };

    const handleMouseMove = (e) => {
      if (!active) return;
      if (isHoveringUI(e.target)) return;

      const rect = mainCanvas.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && 
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        
        const worldPos = toWorld(e.clientX, e.clientY);
        trailRef.current.push({ x: worldPos.x, y: worldPos.y, time: Date.now() });

        if (socket && whiteboardId) {
          socket.emit('pointer-move', { whiteboardId, x: worldPos.x, y: worldPos.y });
        }
      }
    };

    const handleMouseDown = (e) => {
      if (!active) return;
      if (isHoveringUI(e.target)) return;
      
      const worldPos = toWorld(e.clientX, e.clientY);
      clicksRef.current.push({ x: worldPos.x, y: worldPos.y, time: Date.now() });

      if (socket && whiteboardId) {
        socket.emit('pointer-click', { whiteboardId, x: worldPos.x, y: worldPos.y });
      }
    };

    mainCanvas.addEventListener('mousemove', handleMouseMove);
    mainCanvas.addEventListener('mousedown', handleMouseDown);

    return () => {
      mainCanvas.removeEventListener('mousemove', handleMouseMove);
      mainCanvas.removeEventListener('mousedown', handleMouseDown);
    };
  }, [active, socket, whiteboardId]);

  // Obsługa danych z serwera (Odbieranie)
  useEffect(() => {
    if (!socket) return;

    const handleRemoteMove = (data) => {
      if (data.userId === socket.id) return;
      trailRef.current.push({ x: data.x, y: data.y, time: Date.now() });
    };

    const handleRemoteClick = (data) => {
      if (data.userId === socket.id) return;
      clicksRef.current.push({ x: data.x, y: data.y, time: Date.now() });
    };

    socket.on('pointer-move', handleRemoteMove);
    socket.on('pointer-click', handleRemoteClick);

    return () => {
      socket.off('pointer-move', handleRemoteMove);
      socket.off('pointer-click', handleRemoteClick);
    };
  }, [socket]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        pointerEvents: 'none', zIndex: 9999, mixBlendMode: 'normal',
      }}
    />
  );
};

export default PointerTrail;
import React, { useEffect, useRef } from 'react';

const PointerTrail = ({ active, socket, whiteboardId }) => {
  const canvasRef = useRef(null);
  const trailRef = useRef([]);
  const clicksRef = useRef([]);
  const animationRef = useRef(null);

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
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 🔹 1. Rysowanie smugi (zarówno lokalnej, jak i zdalnej)
      for (let i = 0; i < trailRef.current.length; i++) {
        const p = trailRef.current[i];
        const age = (now - p.time) / 300; // Czas życia punktu (300ms)
        if (age > 1) continue;

        const alpha = 1 - age;
        const radius = 5 + (1 - alpha) * 7.5;

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        gradient.addColorStop(0, `rgba(255,0,0,1)`);
        gradient.addColorStop(0.7, `rgba(200,0,0,1)`);
        gradient.addColorStop(1, `rgba(150,0,0,0.5)`);
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 🔴 2. Rysowanie kliknięć (lokalne i zdalne)
      for (let i = clicksRef.current.length - 1; i >= 0; i--) {
        const c = clicksRef.current[i];
        const elapsed = now - c.time;
        const progress = elapsed / 500; // Animacja trwa 500ms

        if (progress >= 1) {
          clicksRef.current.splice(i, 1);
          continue;
        }

        const radius = 10 + progress * 60; // Rosnący promień
        const alpha = 1 - progress;
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255,0,0,${alpha})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Usuń stare punkty smugi
      trailRef.current = trailRef.current.filter((p) => now - p.time < 300);

      animationRef.current = requestAnimationFrame(draw);
    };

    // Zawsze uruchamiaj pętlę rysowania, aby widzieć zdalne efekty
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []); // Uruchom tylko raz przy montowaniu

  // 🔹 Obsługa zdarzeń lokalnych (myszka)
  useEffect(() => {
    const mainCanvas = document.querySelector('.canvas-area');
    if (!mainCanvas) return;

    // Funkcja pomocnicza sprawdzająca, czy najeżdżamy na element UI
    const isHoveringUI = (target) => {
      return (
        target.closest('.background-toggle') || // Przycisk tła
        target.closest('.chat-toggle') ||       // Przycisk czatu
        target.closest('.chat-container') ||    // Okno czatu
        target.closest('.toolbar') ||           // Toolbar (dla pewności)
        target.closest('.multimedia-modal')     // Modale
      );
    };

    const handleMouseMove = (e) => {
      if (!active) return;
      
      // ⛔ BLOKADA: Jeśli najeżdżamy na UI, nie rób nic
      if (isHoveringUI(e.target)) return;

      const rect = mainCanvas.getBoundingClientRect();
      // Sprawdź czy kursor jest nad obszarem roboczym
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        // Dodaj do lokalnej tablicy
        trailRef.current.push({ x: e.clientX, y: e.clientY, time: Date.now() });

        // Wyślij do serwera
        if (socket && whiteboardId) {
          socket.emit('pointer-move', { whiteboardId, x: e.clientX, y: e.clientY });
        }
      }
    };

    const handleMouseDown = (e) => {
      if (!active) return;

      // ⛔ BLOKADA: Jeśli klikamy w UI, nie twórz czerwonego okręgu
      if (isHoveringUI(e.target)) return;

      const rect = mainCanvas.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        // Dodaj lokalnie
        clicksRef.current.push({ x: e.clientX, y: e.clientY, time: Date.now() });

        // Wyślij do serwera
        if (socket && whiteboardId) {
          socket.emit('pointer-click', { whiteboardId, x: e.clientX, y: e.clientY });
        }
      }
    };

    mainCanvas.addEventListener('mousemove', handleMouseMove);
    mainCanvas.addEventListener('mousedown', handleMouseDown);

    return () => {
      mainCanvas.removeEventListener('mousemove', handleMouseMove);
      mainCanvas.removeEventListener('mousedown', handleMouseDown);
    };
  }, [active, socket, whiteboardId]);

  // 🔹 Obsługa zdarzeń zdalnych (socket)
  useEffect(() => {
    if (!socket) return;

    const handleRemoteMove = (data) => {
      // Ignoruj własne zdarzenia (dla pewności, choć serwer używa broadcast)
      if (data.userId === socket.id) return;
      
      // Dodaj zdalny punkt do tablicy rysowania z aktualnym czasem
      trailRef.current.push({ x: data.x, y: data.y, time: Date.now() });
    };

    const handleRemoteClick = (data) => {
      if (data.userId === socket.id) return;
      
      // Dodaj zdalne kliknięcie
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
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
        mixBlendMode: 'normal',
      }}
    />
  );
};

export default PointerTrail;
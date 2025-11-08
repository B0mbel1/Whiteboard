import React, { useEffect, useRef } from 'react';

const PointerTrail = ({ active }) => {
  const canvasRef = useRef(null);
  const trailRef = useRef([]);
  const clicksRef = useRef([]);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      if (!active) return;

      const now = Date.now();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 🔹 lekko przezroczysta czarna warstwa, żeby smuga była płynna
      ctx.fillStyle = 'rgba(0,0,0,0.03)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 🔹 ogon pointera (intensywnie czerwony)
      for (let i = 0; i < trailRef.current.length; i++) {
        const p = trailRef.current[i];
        const age = (now - p.time) / 300;
        if (age > 1) continue;

        const alpha = 1 - age;
        const radius = 5 + (1 - alpha) * 7.5; // zmniejszone o połowę

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        gradient.addColorStop(0, `rgba(255,0,0,1)`);       // pełna czerwień
        gradient.addColorStop(0.7, `rgba(200,0,0,1)`);     // ciemniejsza czerwień
        gradient.addColorStop(1, `rgba(150,0,0,0.5)`);     // minimalne zanikanie
        ctx.fillStyle = gradient;           // zanikanie

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 🔴 kliknięcia = czerwone okręgi
      for (let i = clicksRef.current.length - 1; i >= 0; i--) {
        const c = clicksRef.current[i];
        const elapsed = now - c.time;
        const progress = elapsed / 500; // trwa 0.5s

        if (progress >= 1) {
          clicksRef.current.splice(i, 1);
          continue;
        }

        const radius = 10 + progress * 60; // rosnący promień
        const alpha = 1 - progress;        // zanikanie
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255,0,0,1)`;  // pełna czerwień, mocna
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // usuń stare punkty
      trailRef.current = trailRef.current.filter((p) => now - p.time < 300);

      animationRef.current = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e) => {
      if (!active) return;
      trailRef.current.push({ x: e.clientX, y: e.clientY, time: Date.now() });
    };

    const handleMouseDown = (e) => {
      if (!active) return;
      clicksRef.current.push({ x: e.clientX, y: e.clientY, time: Date.now() });
    };

    if (active) {
      animationRef.current = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      trailRef.current = [];
      clicksRef.current = [];
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [active]);

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
        mixBlendMode: 'normal', // mocny czerwony
      }}
    />
  );
};

export default PointerTrail;

import React, { useEffect, useRef } from 'react';

const PointerTrail = ({ active }) => {
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const lastPointRef = useRef(null);
  const animationRef = useRef(null);
  const lastMoveTimeRef = useRef(Date.now());
  const clicksRef = useRef([]); // 🔴 tu przechowujemy kliknięcia do animacji

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const drawTrail = () => {
      if (!active) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const points = pointsRef.current;
      const now = Date.now();

      // 🔹 Zanik śladu po bezruchu
      if (now - lastMoveTimeRef.current > 150 && points.length > 0) {
        points.shift();
      }

      // 🔹 Rysowanie smugi
      if (points.length >= 2) {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(255,0,0,1)');
        gradient.addColorStop(1, 'rgba(255,0,0,0.6)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();

        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();

        pointsRef.current = points.slice(-35);
      }

      // 🔴 Rysowanie animacji kliknięć ("wybuchów")
      for (let i = clicksRef.current.length - 1; i >= 0; i--) {
        const click = clicksRef.current[i];
        const elapsed = now - click.time;
        const progress = elapsed / 500; // trwa ok. 0.5s

        if (progress >= 1) {
          // usuń kliknięcie po zakończeniu animacji
          clicksRef.current.splice(i, 1);
          continue;
        }

        const radius = 10 + progress * 60; // rosnący promień
        const alpha = 1 - progress; // zanikający kolor

        ctx.beginPath();
        ctx.arc(click.x, click.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(drawTrail);
    };

    if (active) {
      animationRef.current = requestAnimationFrame(drawTrail);
    } else {
      // 🧹 wyłączanie wskaźnika
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pointsRef.current = [];
      clicksRef.current = [];
      lastPointRef.current = null;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    const handleMouseMove = (e) => {
      if (!active) return;
      const newPoint = { x: e.clientX, y: e.clientY };
      const lastPoint = lastPointRef.current;

      if (lastPoint) {
        const dx = newPoint.x - lastPoint.x;
        const dy = newPoint.y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(distance / 2));

        for (let i = 1; i <= steps; i++) {
          const x = lastPoint.x + (dx * i) / steps;
          const y = lastPoint.y + (dy * i) / steps;
          pointsRef.current.push({ x, y });
        }
      } else {
        pointsRef.current.push(newPoint);
      }

      lastPointRef.current = newPoint;
      lastMoveTimeRef.current = Date.now();
    };

    const handleMouseDown = (e) => {
      if (!active) return;
      clicksRef.current.push({
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      });
    };

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
        zIndex: 5000,
      }}
    />
  );
};

export default PointerTrail;

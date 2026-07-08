'use client';

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tailLen: number;
  opacity: number;
  life: number;
  maxLife: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tailLen: number;
  width: number;
  opacity: number;
  life: number;
  maxLife: number;
}

interface Lightning {
  points: { x: number; y: number }[];
  opacity: number;
  life: number;
  maxLife: number;
  color: string;
}

// Recursive midpoint displacement to generate a jagged lightning bolt
function buildLightning(
  x1: number, y1: number,
  x2: number, y2: number,
  depth: number,
): { x: number; y: number }[] {
  if (depth === 0) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * (Math.abs(x2 - x1) + Math.abs(y2 - y1)) * 0.4;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * (Math.abs(x2 - x1) + Math.abs(y2 - y1)) * 0.4;
  return [
    ...buildLightning(x1, y1, mx, my, depth - 1),
    ...buildLightning(mx, my, x2, y2, depth - 1).slice(1),
  ];
}

export default function UniverseBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    // ── Stars ──────────────────────────────────────────────────────────────
    const STAR_COUNT = 300;
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      radius: Math.random() * 1.8 + 0.4,
      twinkleSpeed: Math.random() * 0.018 + 0.004,
      twinklePhase: Math.random() * Math.PI * 2,
    }));

    // ── Nebula glow positions (static ratios) ─────────────────────────────
    const nebulaDefs = [
      { rx: 0.15, ry: 0.25, rr: 0.42, color: [37, 99, 235] as [number,number,number], alpha: 0.18 },
      { rx: 0.82, ry: 0.55, rr: 0.34, color: [124, 58, 237] as [number,number,number], alpha: 0.15 },
      { rx: 0.50, ry: 0.80, rr: 0.28, color: [16, 185, 129] as [number,number,number], alpha: 0.11 },
      { rx: 0.65, ry: 0.15, rr: 0.24, color: [139, 37, 235] as [number,number,number], alpha: 0.13 },
    ];

    const comets: Comet[] = [];
    const shootingStars: ShootingStar[] = [];
    const lightnings: Lightning[] = [];
    let frame = 0;
    // Spawn a comet and a shooting-star burst immediately so the screen
    // isn't empty during the first few seconds
    let nextBurst = 0;

    // ── Spawn helpers ──────────────────────────────────────────────────────
    function spawnComet() {
      const speed = Math.random() * 9 + 5;
      const angle = (Math.random() * Math.PI) / 5 + Math.PI / 8; // ~22–58° downward
      comets.push({
        x: Math.random() * W * 0.8,
        y: Math.random() * H * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        tailLen: Math.random() * 130 + 70,
        opacity: 1,
        life: 0,
        maxLife: Math.floor(Math.random() * 55 + 40),
      });
    }

    // Shooting stars: fast, thin, short-lived, spawn in small bursts
    function spawnShootingStar() {
      // Always travel upper-left → lower-right at a shallow angle
      const speed = Math.random() * 18 + 14;
      const angle = (Math.random() * Math.PI) / 6 + Math.PI / 10; // ~18–48° below horizontal
      const side = Math.random() < 0.5; // spawn from top edge or left edge
      const x = side ? Math.random() * W : 0;
      const y = side ? 0 : Math.random() * H * 0.6;
      shootingStars.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        tailLen: Math.random() * 90 + 50,
        width: Math.random() * 0.8 + 0.4,
        opacity: 1,
        life: 0,
        maxLife: Math.floor(Math.random() * 25 + 18),
      });
    }

    function spawnLightning() {
      const x1 = Math.random() * W;
      const y1 = Math.random() * H * 0.5;
      const x2 = x1 + (Math.random() - 0.5) * 280;
      const y2 = y1 + Math.random() * 220 + 80;
      const colors = ['rgba(100,160,255,', 'rgba(180,120,255,', 'rgba(80,220,200,'];
      lightnings.push({
        points: buildLightning(x1, y1, x2, y2, 5),
        opacity: 0.85,
        life: 0,
        maxLife: Math.floor(Math.random() * 18 + 12),
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // ── Draw ───────────────────────────────────────────────────────────────
    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Deep-space radial gradient — noticeably different from the body #0a0a1a
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, Math.max(W, H) * 0.9);
      bg.addColorStop(0, '#12123a');
      bg.addColorStop(0.45, '#0a0a24');
      bg.addColorStop(1, '#05050f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebula glows (pulse gently)
      nebulaDefs.forEach(n => {
        const pulse = 0.85 + 0.15 * Math.sin(frame * 0.008 + n.rx * 10);
        const nx = n.rx * W;
        const ny = n.ry * H;
        const nr = n.rr * Math.max(W, H) * pulse;
        const [r, g, b] = n.color;
        const g2 = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        g2.addColorStop(0, `rgba(${r},${g},${b},${n.alpha})`);
        g2.addColorStop(0.5, `rgba(${r},${g},${b},${n.alpha * 0.4})`);
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, W, H);
      });

      // Stars with twinkle + glow for bright ones
      stars.forEach(s => {
        s.twinklePhase += s.twinkleSpeed;
        const alpha = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(s.twinklePhase));

        if (s.radius > 1.1) {
          const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius * 6);
          glow.addColorStop(0, `rgba(180,210,255,${alpha * 0.5})`);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius * 6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,248,255,${alpha})`;
        ctx.fill();
      });

      // Shooting stars — burst of 1–3 at random intervals
      if (frame >= nextBurst && shootingStars.length < 6) {
        const count = Math.floor(Math.random() * 3) + 1;
        for (let k = 0; k < count; k++) spawnShootingStar();
        nextBurst = frame + Math.floor(Math.random() * 240 + 120);
      }
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.life++;
        s.x += s.vx;
        s.y += s.vy;
        // Arc: bright flash in first third, then fade
        const progress = s.life / s.maxLife;
        s.opacity = progress < 0.3
          ? progress / 0.3
          : 1 - (progress - 0.3) / 0.7;
        if (s.life >= s.maxLife) { shootingStars.splice(i, 1); continue; }

        const norm = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        const tx = s.x - (s.vx / norm) * s.tailLen;
        const ty = s.y - (s.vy / norm) * s.tailLen;

        const grad = ctx.createLinearGradient(tx, ty, s.x, s.y);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.7, `rgba(210,230,255,${s.opacity * 0.5})`);
        grad.addColorStop(1, `rgba(255,255,255,${s.opacity})`);

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width;
        ctx.moveTo(tx, ty);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        // Tiny bright head dot
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.width * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.opacity})`;
        ctx.fill();
      }

      // Comets — spawn immediately on frame 0, then every ~100 frames
      if ((frame === 0 || frame % 100 === 0) && comets.length < 4) spawnComet();
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.life++;
        c.x += c.vx;
        c.y += c.vy;
        c.opacity = Math.max(0, 1 - c.life / c.maxLife);
        if (c.life >= c.maxLife) { comets.splice(i, 1); continue; }

        const norm = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
        const tx = c.x - (c.vx / norm) * c.tailLen;
        const ty = c.y - (c.vy / norm) * c.tailLen;

        const tail = ctx.createLinearGradient(tx, ty, c.x, c.y);
        tail.addColorStop(0, 'rgba(255,255,255,0)');
        tail.addColorStop(0.6, `rgba(180,210,255,${c.opacity * 0.4})`);
        tail.addColorStop(1, `rgba(220,235,255,${c.opacity})`);

        ctx.beginPath();
        ctx.strokeStyle = tail;
        ctx.lineWidth = 1.5;
        ctx.moveTo(tx, ty);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();

        // Head glow
        const headG = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 8);
        headG.addColorStop(0, `rgba(230,245,255,${c.opacity * 0.9})`);
        headG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = headG;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lightning arcs
      if (frame % 220 === 0 && lightnings.length < 3) spawnLightning();
      for (let i = lightnings.length - 1; i >= 0; i--) {
        const l = lightnings[i];
        l.life++;
        // Flicker: bright flash on first few frames, then fade
        const flicker = l.life < 4 ? 1 : Math.max(0, 1 - (l.life - 4) / (l.maxLife - 4));
        l.opacity = flicker * (0.7 + 0.3 * Math.random());
        if (l.life >= l.maxLife) { lightnings.splice(i, 1); continue; }

        // Outer glow pass
        ctx.beginPath();
        ctx.moveTo(l.points[0].x, l.points[0].y);
        l.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = `${l.color}${l.opacity * 0.25})`;
        ctx.lineWidth = 6;
        ctx.shadowColor = l.color.replace('rgba(', 'rgb(').replace(/,[^,]+\)$/, ')');
        ctx.shadowBlur = 18;
        ctx.stroke();

        // Core bright line
        ctx.beginPath();
        ctx.moveTo(l.points[0].x, l.points[0].y);
        l.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = `rgba(220,235,255,${l.opacity * 0.9})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      frame++;
    }

    let animId: number;
    function loop() {
      draw();
      animId = requestAnimationFrame(loop);
    }
    loop();

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

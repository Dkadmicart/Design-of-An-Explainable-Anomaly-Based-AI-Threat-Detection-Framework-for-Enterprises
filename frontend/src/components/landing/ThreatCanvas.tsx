import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  color: string;
  pulsePhase: number;
  pulseSpeed: number;
}

interface PulsePacket {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  color: string;
}

interface ThreatCanvasProps {
  className?: string;
  threatLevel?: 'Normal' | 'Medium' | 'Critical' | 'Safe';
}

export const ThreatCanvas: React.FC<ThreatCanvasProps> = ({
  className = '',
  threatLevel = 'Normal',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || 600;
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    // Particle Palette
    const colors = {
      normal: ['#F5B700', '#06B6D4', '#10B981', '#38BDF8'],
      medium: ['#F5B700', '#F97316', '#FBBF24', '#06B6D4'],
      critical: ['#EF4444', '#F5B700', '#F43F5E', '#FB7185'],
    };

    let particles: Particle[] = [];
    let packets: PulsePacket[] = [];

    const initParticles = () => {
      particles = [];
      packets = [];
      const count = Math.min(Math.floor((width * height) / 14000), 55);
      const palette = colors[threatLevel.toLowerCase() as keyof typeof colors] || colors.normal;

      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.55,
          vy: (Math.random() - 0.5) * 0.55,
          radius: Math.random() * 2 + 1.2,
          baseAlpha: Math.random() * 0.5 + 0.3,
          color: palette[Math.floor(Math.random() * palette.length)],
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.02 + Math.random() * 0.03,
        });
      }
    };

    initParticles();

    // Mouse Tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: null, y: null };
    };

    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener('mousemove', handleMouseMove);
      parent.addEventListener('mouseleave', handleMouseLeave);
    }

    const maxDist = 130;
    const mouseRadius = 150;

    // Main Render Loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Randomly spawn cyber packet pulses
      if (Math.random() < 0.06 && packets.length < 8 && particles.length > 5) {
        const fromIdx = Math.floor(Math.random() * particles.length);
        // Find a nearby node
        for (let j = 0; j < particles.length; j++) {
          if (fromIdx !== j) {
            const dx = particles[fromIdx].x - particles[j].x;
            const dy = particles[fromIdx].y - particles[j].y;
            const d = Math.hypot(dx, dy);
            if (d < maxDist) {
              packets.push({
                fromIdx,
                toIdx: j,
                progress: 0,
                speed: 0.025 + Math.random() * 0.02,
                color: particles[fromIdx].color,
              });
              break;
            }
          }
        }
      }

      // Update and draw connections
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];

        // Move
        p1.x += p1.vx;
        p1.y += p1.vy;
        p1.pulsePhase += p1.pulseSpeed;

        // Bounce at boundaries
        if (p1.x < 0 || p1.x > width) p1.vx *= -1;
        if (p1.y < 0 || p1.y > height) p1.vy *= -1;

        // Mouse interaction (subtle attraction)
        if (mouseRef.current.x !== null && mouseRef.current.y !== null) {
          const mdx = mouseRef.current.x - p1.x;
          const mdy = mouseRef.current.y - p1.y;
          const md = Math.hypot(mdx, mdy);
          if (md < mouseRadius && md > 0) {
            const force = (1 - md / mouseRadius) * 0.03;
            p1.x += mdx * force;
            p1.y += mdy * force;

            // Draw line to mouse
            const alpha = (1 - md / mouseRadius) * 0.55;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.strokeStyle = `rgba(245, 183, 0, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Connect with nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.22;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }

        // Draw particle node
        const pulse = 1 + Math.sin(p1.pulsePhase) * 0.3;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = p1.color;
        ctx.globalAlpha = p1.baseAlpha;
        ctx.fill();

        // Subtle glow halo
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.radius * pulse * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = p1.color;
        ctx.globalAlpha = p1.baseAlpha * 0.18;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Draw and update packets
      for (let k = packets.length - 1; k >= 0; k--) {
        const pkt = packets[k];
        pkt.progress += pkt.speed;

        if (pkt.progress >= 1) {
          packets.splice(k, 1);
          continue;
        }

        const pFrom = particles[pkt.fromIdx];
        const pTo = particles[pkt.toIdx];
        if (!pFrom || !pTo) {
          packets.splice(k, 1);
          continue;
        }

        const curX = pFrom.x + (pTo.x - pFrom.x) * pkt.progress;
        const curY = pFrom.y + (pTo.y - pFrom.y) * pkt.progress;

        ctx.beginPath();
        ctx.arc(curX, curY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = pkt.color;
        ctx.shadowColor = pkt.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseleave', handleMouseLeave);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [threatLevel]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full opacity-60 transition-opacity duration-700 ${className}`}
    />
  );
};

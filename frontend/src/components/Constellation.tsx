import { useEffect, useRef } from 'react';

// Original particle renderer. Geometry is deterministic and never represents live telemetry.
export default function Constellation({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const particles = Array.from({ length: compact ? 1800 : 5400 }, (_, i) => {
      const y = 1 - (i / (compact ? 1799 : 5399)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = i * 2.399963229728653;
      return [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
    });
    let width = 1, height = 1, frame = 0, visible = true;
    let pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0, time = 0;
    const resize = () => {
      const box = canvas.getBoundingClientRect(); width = box.width; height = box.height;
      const dpr = Math.min(window.devicePixelRatio, 1.75);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }); intersection.observe(canvas);
    const onPointer = (event: PointerEvent) => { pointerX = (event.clientX / window.innerWidth - .5) * .2; pointerY = (event.clientY / window.innerHeight - .5) * .1; };
    window.addEventListener('pointermove', onPointer, { passive: true });
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      if (!reduced.matches) time += .0022;
      smoothX += (pointerX - smoothX) * .035; smoothY += (pointerY - smoothY) * .035;
      ctx.clearRect(0, 0, width, height);
      const radius = Math.min(width * .31, height * .43);
      const cx = width * .5, cy = height * .48;
      const rotation = time + (reduced.matches ? 0 : smoothX), tilt = -.25 + (reduced.matches ? 0 : smoothY);
      const project = (x: number, y: number, z: number) => {
        const xx = x * Math.cos(rotation) + z * Math.sin(rotation);
        const zz = -x * Math.sin(rotation) + z * Math.cos(rotation);
        const yy = y * Math.cos(tilt) - zz * Math.sin(tilt);
        const depth = y * Math.sin(tilt) + zz * Math.cos(tilt);
        const perspective = 3.9 / (3.9 - depth);
        return [cx + xx * radius * perspective, cy + yy * radius * perspective, depth, perspective];
      };
      const atmosphere = ctx.createRadialGradient(cx, cy, radius * .6, cx, cy, radius * 1.55);
      atmosphere.addColorStop(0, 'rgba(21,95,163,0)'); atmosphere.addColorStop(.48, 'rgba(29,114,202,.075)'); atmosphere.addColorStop(.72, 'rgba(41,120,211,.025)'); atmosphere.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = atmosphere; ctx.fillRect(0, 0, width, height);
      // A thin instrument reticle anchors the glowing volume.
      ctx.strokeStyle = 'rgba(116,169,207,.09)'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.ellipse(cx, cy, radius * 1.58, radius * .52, -.27, 0, Math.PI * 2); ctx.stroke();
      for (let line = 0; line < 7; line++) {
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const a = i / 160 * Math.PI * 2;
          const y = -.78 + line * .26, r = Math.sqrt(1 - y * y);
          const p = project(Math.cos(a) * r, y, Math.sin(a) * r);
          if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.strokeStyle = 'rgba(82,155,220,.10)'; ctx.stroke();
      }
      const ordered = particles.map(([x, y, z], i) => ({p: project(x, y, z), i})).sort((a,b) => a.p[2]-b.p[2]);
      ctx.globalCompositeOperation = 'lighter';
      for (const {p, i} of ordered) {
        const front = (p[2] + 1) / 2;
        const shimmer = .66 + .34 * Math.sin(i * .13 + time * 3);
        const alpha = (.07 + front * .67) * shimmer;
        const size = (.35 + front * .5) * p[3];
        ctx.fillStyle = i % 37 === 0 ? `rgba(220,241,255,${alpha})` : `rgba(93,173,245,${alpha})`;
        ctx.fillRect(p[0], p[1], size, size);
      }
      // Bent orbital traces form a signature crossing through the sphere.
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        for (let i = 0; i <= 220; i++) {
          const a = i / 220 * Math.PI * 2;
          const x = Math.cos(a) * (1.03 + ring * .025);
          const y = Math.sin(a) * .39;
          const z = Math.sin(a) * .94;
          const p = project(x, y, z);
          if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.strokeStyle = `rgba(144,212,255,${.27-ring*.06})`; ctx.lineWidth = ring === 0 ? 1.1 : .6; ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const a = i * 1.0472 + time * .6;
        const p = project(Math.cos(a) * 1.055, Math.sin(a) * .39, Math.sin(a) * .94);
        const glow = ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],20);
        const amber = i === 1;
        glow.addColorStop(0, amber ? 'rgba(255,191,110,.9)' : 'rgba(188,230,255,.9)'); glow.addColorStop(.13, amber ? 'rgba(255,166,70,.5)' : 'rgba(99,180,255,.5)'); glow.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = glow; ctx.fillRect(p[0]-20,p[1]-20,40,40);
        ctx.fillStyle = amber ? '#ffe2ae' : '#effaff'; ctx.beginPath(); ctx.arc(p[0],p[1],1.7,0,Math.PI*2);ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    resize(); draw();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); window.removeEventListener('pointermove',onPointer); };
  }, [compact]);
  return <canvas ref={ref} className="constellation" aria-label="An artistic constellation of connected services" role="img" />;
}

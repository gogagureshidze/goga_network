"use client";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/gsap";

type Pt = { x: number; y: number; vx: number; vy: number };

export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const host = c.parentElement!;
    const reduce = prefersReducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0,
      H = 0,
      run = true,
      raf = 0;
    let pts: Pt[] = [];
    const m = { x: -999, y: -999 };

    const size = () => {
      W = c.clientWidth;
      H = c.clientHeight;
      c.width = W * dpr;
      c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(130, (W * H) / 11000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
    };
    const move = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      m.x = e.clientX - r.left;
      m.y = e.clientY - r.top;
    };
    const leave = () => {
      m.x = m.y = -999;
    };

    const loop = () => {
      if (!run) return;
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        const dx = p.x - m.x,
          dy = p.y - m.y,
          d = Math.hypot(dx, dy);
        if (d < 160 && d > 0.001) {
          const f = (1 - d / 160) * 0.9;
          p.vx += (dx / d) * f * 0.06;
          p.vy += (dy / d) * f * 0.06;
        }
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        ctx.fillStyle = "rgba(169,188,217,.7)";
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.2, 0, 6.283);
        ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j],
            d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 120) {
            ctx.strokeStyle = `rgba(169,188,217,${0.16 * (1 - d / 120)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      if (!reduce) raf = requestAnimationFrame(loop);
    };

    size();
    loop();
    window.addEventListener("resize", size);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    const io = new IntersectionObserver(([e]) => {
      run = e.isIntersecting;
      if (run) {
        cancelAnimationFrame(raf);
        loop();
      }
    });
    io.observe(host);
    return () => {
      run = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", size);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <canvas id="fx" ref={ref} aria-hidden="true" />;
}

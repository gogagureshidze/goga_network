"use client";
import type { HTMLAttributes, PointerEvent } from "react";

export default function GlassCard({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div {...rest} className={`glass ${className}`} onPointerMove={move}>
      {children}
    </div>
  );
}

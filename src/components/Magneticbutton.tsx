"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

export default function MagneticButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const b = ref.current!;
    if (prefersReducedMotion() || !window.matchMedia("(pointer:fine)").matches)
      return;
    const qx = gsap.quickTo(b, "x", {
      duration: 0.8,
      ease: "elastic.out(1,.5)",
    });
    const qy = gsap.quickTo(b, "y", {
      duration: 0.8,
      ease: "elastic.out(1,.5)",
    });
    const move = (e: PointerEvent) => {
      const r = b.getBoundingClientRect();
      qx((e.clientX - r.left - r.width / 2) * 0.35);
      qy((e.clientY - r.top - r.height / 2) * 0.5);
    };
    const leave = () => {
      qx(0);
      qy(0);
    };
    b.addEventListener("pointermove", move);
    b.addEventListener("pointerleave", leave);
    return () => {
      b.removeEventListener("pointermove", move);
      b.removeEventListener("pointerleave", leave);
    };
  }, []);
  return (
    <a ref={ref} className="cta" href={href}>
      <i />
      <span>{children}</span>
    </a>
  );
}

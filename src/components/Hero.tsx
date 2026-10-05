"use client";
import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import HeroCanvas from "../components/Herocanvas";
import MagneticButton from "../components/Magneticbutton";

const TITLE = "Rehearse the interview before it counts.";

export default function Hero({
  ctaHref = "#demo",
  ctaLabel = "Try an interview",
}: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(".w span", {
        yPercent: 110,
        opacity: 0,
        duration: 1.4,
        ease: "expo.out",
        stagger: 0.14,
        delay: 0.3,
      });
      gsap.from([".sub", ".cta"], {
        y: 20,
        opacity: 0,
        duration: 1.2,
        ease: "expo.out",
        stagger: 0.15,
        delay: 1.3,
      });
      gsap.to(".hero-in", {
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
        scale: 0.92,
        opacity: 0,
        y: -60,
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <header id="hero" ref={root}>
      <HeroCanvas />
      <div className="hero-in">
        <h1 id="h1">
          {TITLE.split(" ").map((w, i) => (
            <span key={i}>
              <span className="w">
                <span>{w}</span>
              </span>{" "}
            </span>
          ))}
        </h1>
        <p className="sub">
          Etude is a voice-first AI interviewer. It talks, listens, reads your
          code as you write it, and gives you a verdict you can act on.
        </p>
        <MagneticButton href={ctaHref}>{ctaLabel}</MagneticButton>
      </div>
      <div className="scroll-hint" />
    </header>
  );
}

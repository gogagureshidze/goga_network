"use client";
import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

export default function PinnedStory() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current!;
    if (prefersReducedMotion()) {
      el.classList.add("is-static");
      return;
    }
    const ctx = gsap.context(() => {
      const ps = gsap.utils.toArray<HTMLElement>("p");
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "+=270%",
          pin: true,
          scrub: 0.8,
        },
      });
      ps.forEach((p, i) => {
        tl.fromTo(
          p,
          { opacity: 0, scale: 1.12, filter: "blur(14px)", y: 30 },
          {
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            y: 0,
            duration: 1,
            ease: "power2.out",
          },
        );
        if (i < ps.length - 1)
          tl.to(
            p,
            {
              opacity: 0,
              scale: 0.9,
              filter: "blur(14px)",
              y: -30,
              duration: 1,
              ease: "power2.in",
            },
            "+=.6",
          );
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="story" ref={root} aria-label="Why Etude">
      <p>
        Nobody fails because they <em>can&apos;t</em> code.
      </p>
      <p>
        They fail because the room is <em>new</em>.
      </p>
      <p>Make the room familiar.</p>
    </section>
  );
}

"use client";
import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import "./etude.css";
import Hero from "../components/Hero";
import PinnedStory from "../components/Pinnedstory";
import InterviewModule from "./../components/Interviewmodule";
import FeedbackReport, { type FeedbackData } from "../components/Feedbackreport";
import MagneticButton from "./Magneticbutton";

export default function EtudeLanding({
  feedback,
}: {
  feedback?: FeedbackData;
}) {
  const end = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from("h2", {
        scrollTrigger: {
          trigger: end.current,
          start: "top 70%",
          end: "center 55%",
          scrub: true,
        },
        opacity: 0,
        scale: 0.9,
        filter: "blur(10px)",
      });
    }, end);
    return () => ctx.revert();
  }, []);

  return (
    <main className="etude">
      <Hero />
      <PinnedStory />
      <InterviewModule />
      <FeedbackReport data={feedback} />
      <section id="end" ref={end}>
        <div>
          <h2>Walk in having already been there.</h2>
          <MagneticButton href="#hero">
            Start your first interview
          </MagneticButton>
        </div>
      </section>
      <footer>
        <span>Etude, built by Goga Gureshidze</span>
        <span>goga.network</span>
      </footer>
    </main>
  );
}

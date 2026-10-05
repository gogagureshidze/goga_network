"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import GlassCard from "./Glasscard";

const PHASES = [
  {
    name: "Behavioral",
    dur: "10 min",
    min: 0,
    who: "Etude is speaking",
    say: "Tell me about a time a project went sideways. What did you do first?",
    hint: "Speak your answer. Etude is listening.",
    code: false,
  },
  {
    name: "Coding",
    dur: "20 min",
    min: 10,
    who: "Etude is watching your code",
    say: "Walk me through your approach before you type. What are you trading off?",
    hint: "Type in the editor, or speak. Pasted code gets reverted.",
    code: true,
  },
  {
    name: "System design",
    dur: "10 min",
    min: 30,
    who: "Etude is speaking",
    say: "Design a URL shortener for ten million daily users. Where does it break first?",
    hint: "Talk it through. Etude will push on the weak spots.",
    code: false,
  },
  {
    name: "Close",
    dur: "5 min",
    min: 40,
    who: "Etude is wrapping up",
    say: "That is time. Your feedback is ready: strengths, gaps, and what to practise next.",
    hint: "Feedback is saved to your history.",
    code: false,
  },
];
const TOTAL = 45;

export default function InterviewModule() {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const p = PHASES[i];
  const words = p.say.split(" ");

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(words.length);
      return;
    }
    setShown(0);
    const ids = words.map((_, k) =>
      window.setTimeout(() => setShown(k + 1), k * 90 + 80),
    );
    return () => ids.forEach(clearTimeout);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(stage.current, {
        scrollTrigger: {
          trigger: stage.current,
          start: "top 85%",
          end: "top 40%",
          scrub: true,
        },
        y: 80,
        opacity: 0,
        scale: 0.96,
      });
    });
    return () => ctx.revert();
  }, []);

  const key = (e: KeyboardEvent, k: number) => {
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? 3
          : 0;
    if (!next) return;
    e.preventDefault();
    const n = (k + next) % 4;
    tabs.current[n]?.focus();
    setI(n);
  };

  return (
    <section id="demo">
      <h2>One hour. Four rooms. Real clocks.</h2>
      <p>
        Phases switch on a wall clock, not on the model&apos;s mood. Pick a
        phase to see how Etude runs it.
      </p>
      <div className="stage" ref={stage}>
        <GlassCard
          className="rail"
          role="tablist"
          aria-label="Interview phases"
        >
          {PHASES.map((ph, k) => (
            <button
              key={ph.name}
              ref={(el) => {
                tabs.current[k] = el;
              }}
              role="tab"
              aria-selected={k === i}
              onClick={() => setI(k)}
              onKeyDown={(e) => key(e, k)}
            >
              {ph.name} <small>{ph.dur}</small>
            </button>
          ))}
          <div className="clock">
            <svg viewBox="0 0 54 54">
              <circle className="t" cx="27" cy="27" r="24" />
              <circle
                className="p"
                cx="27"
                cy="27"
                r="24"
                strokeDasharray={`${(151 * p.min) / TOTAL} 151`}
              />
            </svg>
            <span>
              Minute {p.min} of {TOTAL}
            </span>
          </div>
        </GlassCard>

        <GlassCard className="view" aria-live="polite">
          <div className="who">
            <i />
            <span>{p.who}</span>
          </div>
          <div className="say">
            {words.map((w, k) => (
              <span key={`${i}-${k}`}>
                <span className={`x${k < shown ? " on" : ""}`}>{w}</span>{" "}
              </span>
            ))}
          </div>
          <pre className={`code${p.code ? " show" : ""}`}>
            {`# Etude is watching this live
def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i`}
          </pre>
          <div className="reply">
            <div className="bars">
              <b />
              <b />
              <b />
              <b />
              <b />
            </div>
            <span>{p.hint}</span>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

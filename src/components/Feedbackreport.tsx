"use client";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/gsap";
import GlassCard from "./Glasscard";

export type FeedbackData = {
  level: string;
  attemptNumber: number;
  overall: number; // 0-100
  topPercent: number; // "top X% of candidates"
  passLine: number; // 0-100
  verdict: string;
  attempts: number[]; // overall score per attempt, oldest first
  languages: {
    name: string;
    score: number;
    topPercent: number;
    median: number;
  }[];
  skills: { name: string; score: number }[]; // 3+ items
  deltas: { name: string; change: number; note: string }[];
  good: { title: string; detail: string }[];
  bad: { title: string; detail: string }[];
  plan: { title: string; detail: string }[];
};

export const SAMPLE_FEEDBACK: FeedbackData = {
  level: "Mid-level, 45 minutes",
  attemptNumber: 4,
  overall: 76,
  topPercent: 18,
  passLine: 70,
  verdict:
    "Strong problem solving and clear communication. You lose points when you start coding before agreeing on edge cases.",
  attempts: [62, 67, 72, 76],
  languages: [
    { name: "Python", score: 84, topPercent: 12, median: 68 },
    { name: "TypeScript", score: 77, topPercent: 21, median: 65 },
    { name: "Java", score: 66, topPercent: 44, median: 64 },
    { name: "SQL", score: 58, topPercent: 61, median: 60 },
  ],
  skills: [
    { name: "Problem solving", score: 86 },
    { name: "Code quality", score: 80 },
    { name: "Communication", score: 72 },
    { name: "Complexity", score: 61 },
    { name: "System design", score: 64 },
    { name: "Testing", score: 78 },
  ],
  deltas: [
    { name: "Communication", change: 9, note: "Fewer long silences" },
    { name: "Problem solving", change: 6, note: "Cleaner first approach" },
    { name: "Testing", change: 4, note: "Edge cases unprompted" },
    {
      name: "System design",
      change: 2,
      note: "Still missing failure handling",
    },
    { name: "Complexity", change: -3, note: "Stated late, twice" },
  ],
  good: [
    {
      title: "You said your approach before typing.",
      detail:
        "At minute 11 you named the hash map trade-off out loud. Interviewers rate this above the code itself.",
    },
    {
      title: "You tested your own solution.",
      detail:
        "You traced an empty array and a duplicate value without being asked.",
    },
    {
      title: "Your Python was idiomatic.",
      detail: "Comprehensions and enumerate, no index juggling.",
    },
  ],
  bad: [
    {
      title: "Silent for 90 seconds in the middle of the coding round.",
      detail: "The interviewer cannot score thinking they cannot hear.",
    },
    {
      title: "Skipped complexity until asked.",
      detail:
        "You gave O(n) only after a prompt. Offer it as soon as the code runs.",
    },
    {
      title: "System design had no failure story.",
      detail: "You scaled reads well, then had no answer for a cache outage.",
    },
  ],
  plan: [
    {
      title: "Narrate while you work",
      detail:
        "Say one sentence every time you change direction. Aim for no silence over 20 seconds.",
    },
    {
      title: "Lead with complexity",
      detail:
        "End every solution with time and space, then the next optimisation you would try.",
    },
    {
      title: "Add a failure pass to designs",
      detail:
        "After the happy path, name three things that break and how the system recovers.",
    },
  ],
};

const L = 40,
  R = 500,
  T = 14,
  B = 160;
const CX = 210,
  CY = 165,
  RAD = 110;

export default function FeedbackReport({
  data = SAMPLE_FEEDBACK,
}: {
  data?: FeedbackData;
}) {
  const root = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  const [k, setK] = useState(0);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!on) return;
    if (prefersReducedMotion()) {
      setK(1);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1600);
      setK(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  const n = data.attempts.length;
  const y = (v: number) => B - ((v - 50) / 50) * (B - T);
  const x = (i: number) => L + (n > 1 ? (i * (R - L)) / (n - 1) : (R - L) / 2);
  const line = data.attempts
    .map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`)
    .join(" ");
  const sk = data.skills.length;
  const rp = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sk;
    return [
      CX + Math.cos(a) * RAD * (v / 100),
      CY + Math.sin(a) * RAD * (v / 100),
    ];
  };
  const gain = data.attempts[n - 1] - data.attempts[0];

  return (
    <section id="report" ref={root}>
      <h2>Feedback that reads like a senior engineer wrote it.</h2>
      <p>
        Every interview ends with this: scores by language and skill, percentile
        against other candidates, and a plan.
      </p>
      <div className="rg">
        <GlassCard className="c5">
          <h3>Overall</h3>
          <p className="cap">
            {data.level}, attempt {data.attemptNumber}
          </p>
          <div className="score">
            <b>{Math.round(data.overall * k)}</b>
            <span>
              / 100 · top {Math.round(data.topPercent * k)}% of candidates
            </span>
          </div>
          {n > 1 && (
            <div className="delta">
              <span className={gain >= 0 ? "up" : "dn"}>
                {gain >= 0 ? "▲" : "▼"} {Math.abs(gain)} points
              </span>
              <span style={{ color: "var(--mute)" }}>since attempt 1</span>
            </div>
          )}
          <p className="verdict">{data.verdict}</p>
        </GlassCard>

        <GlassCard className="c7">
          <h3>Improvement across attempts</h3>
          <p className="cap">
            Overall score per attempt, with the passing line
          </p>
          <svg
            className="ch"
            viewBox="0 0 520 190"
            role="img"
            aria-label={`Scores by attempt: ${data.attempts.join(", ")}`}
          >
            {[50, 60, 70, 80, 90, 100].map((v) => (
              <g key={v}>
                <line
                  x1={L}
                  x2={R}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="rgba(235,233,228,.07)"
                />
                <text x={L - 8} y={y(v) + 4} textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            <line
              x1={L}
              x2={R}
              y1={y(data.passLine)}
              y2={y(data.passLine)}
              stroke="#a9bcd9"
              strokeDasharray="4 5"
              opacity=".5"
            />
            <text x={R} y={y(data.passLine) - 6} textAnchor="end">
              Passing line
            </text>
            <path
              d={`${line} L${x(n - 1)},${B} L${x(0)},${B} Z`}
              fill="rgba(169,188,217,.08)"
            />
            <path
              d={line}
              pathLength={1}
              fill="none"
              stroke="#a9bcd9"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 1,
                strokeDashoffset: on ? 0 : 1,
                transition: "stroke-dashoffset 2s cubic-bezier(.16,1,.3,1)",
                filter: "drop-shadow(0 0 6px rgba(169,188,217,.5))",
              }}
            />
            {data.attempts.map((v, i) => (
              <g key={i}>
                <circle
                  cx={x(i)}
                  cy={y(v)}
                  r={4}
                  fill="#060608"
                  stroke="#a9bcd9"
                  strokeWidth={2}
                />
                <text
                  x={x(i)}
                  y={y(v) - 12}
                  textAnchor="middle"
                  style={{ fill: "#ebe9e4", fontSize: 13 }}
                >
                  {v}
                </text>
                <text x={x(i)} y={B + 22} textAnchor="middle">
                  Attempt {i + 1}
                </text>
              </g>
            ))}
          </svg>
        </GlassCard>

        <GlassCard className="c6">
          <h3>By language</h3>
          <p className="cap">
            Score, with the line marking the median candidate
          </p>
          {data.languages.map((l) => (
            <div className="lang" key={l.name}>
              <div>
                {l.name}
                <small>top {l.topPercent}%</small>
              </div>
              <div className="bar">
                <i style={{ width: on ? `${l.score}%` : 0 }} />
                <u style={{ left: `${l.median}%` }} />
              </div>
              <em>{l.score}</em>
            </div>
          ))}
        </GlassCard>

        <GlassCard className="c6">
          <h3>By skill</h3>
          <p className="cap">The things interviewers actually score</p>
          <svg
            className="ch"
            viewBox="0 0 420 330"
            role="img"
            aria-label="Radar chart of skill scores"
          >
            {[25, 50, 75, 100].map((g) => (
              <polygon
                key={g}
                points={data.skills.map((_, i) => rp(i, g).join(",")).join(" ")}
                fill="none"
                stroke="rgba(235,233,228,.08)"
              />
            ))}
            {data.skills.map((s, i) => {
              const e = rp(i, 100),
                lb = rp(i, 128);
              return (
                <g key={s.name}>
                  <line
                    x1={CX}
                    y1={CY}
                    x2={e[0]}
                    y2={e[1]}
                    stroke="rgba(235,233,228,.06)"
                  />
                  <text
                    x={lb[0]}
                    y={lb[1] + 4}
                    textAnchor={
                      lb[0] < CX - 5
                        ? "end"
                        : lb[0] > CX + 5
                          ? "start"
                          : "middle"
                    }
                  >
                    {s.name} {s.score}
                  </text>
                </g>
              );
            })}
            <polygon
              points={data.skills
                .map((s, i) => rp(i, s.score * k).join(","))
                .join(" ")}
              fill="rgba(169,188,217,.18)"
              stroke="#a9bcd9"
              strokeWidth={1.6}
              style={{ filter: "drop-shadow(0 0 8px rgba(169,188,217,.4))" }}
            />
          </svg>
        </GlassCard>

        <GlassCard className="c12">
          <h3>Change since your last attempt</h3>
          <p className="cap">
            Attempt {Math.max(1, data.attemptNumber - 1)} → attempt{" "}
            {data.attemptNumber}
          </p>
          {data.deltas.map((d) => (
            <div className="dm" key={d.name}>
              <b>{d.name}</b>
              <span>
                <b className={d.change >= 0 ? "up" : "dn"}>
                  {d.change >= 0 ? "▲ +" : "▼ "}
                  {d.change}
                </b>{" "}
                &nbsp;{d.note}
              </span>
            </div>
          ))}
        </GlassCard>

        <GlassCard className="c6">
          <h3>What went well</h3>
          <p className="cap">Keep doing these</p>
          <ul className="fb">
            {data.good.map((g) => (
              <li key={g.title}>
                <b>{g.title}</b>
                <span>{g.detail}</span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="c6">
          <h3>What went badly</h3>
          <p className="cap">Fix these first</p>
          <ul className="fb bad">
            {data.bad.map((g) => (
              <li key={g.title}>
                <b>{g.title}</b>
                <span>{g.detail}</span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="c12">
          <h3>Your plan for the next attempt</h3>
          <p className="cap">
            Ordered by how many points each step is likely to win
          </p>
          <div className="plan">
            {data.plan.map((s) => (
              <div key={s.title}>
                <b>{s.title}</b>
                <span>{s.detail}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

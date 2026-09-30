import { motion, useReducedMotion } from "framer-motion";
import { Flag, Shuffle } from "lucide-react";
import type { RecapSlide } from "../../../convex/recap";
import TeamBadge from "../../components/TeamBadge";
import { formatScore } from "../../lib/utils";
import { CountUp, SlideFrame, SlideHeading } from "./shared";

const W = 1180;
const H = 470;
const PAD = { left: 70, right: 300, top: 24, bottom: 56 };
/** Minimum vertical spacing between end-of-line labels, in chart pixels. */
const LABEL_GAP = 40;
const DRAW_S = 2.6;
const START_S = 0.9;

/** Smooth path through the points with horizontal tangents at each one. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1]!;
    const q = points[i]!;
    const dx = (q.x - p.x) / 2;
    d += ` C ${p.x + dx} ${p.y}, ${q.x - dx} ${q.y}, ${q.x} ${q.y}`;
  }
  return d;
}

/** Nudges label positions apart so no two overlap, keeping them in bounds. */
function spreadLabels(ys: number[], min: number, max: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const placed = order.map((o) => o.y);
  for (let k = 1; k < placed.length; k++) {
    placed[k] = Math.max(placed[k]!, placed[k - 1]! + LABEL_GAP);
  }
  const overflow = placed[placed.length - 1]! - max;
  if (overflow > 0) for (let k = 0; k < placed.length; k++) placed[k] = placed[k]! - overflow;
  for (let k = 0; k < placed.length; k++) placed[k] = Math.max(placed[k]!, min + k * LABEL_GAP);
  const out = new Array<number>(ys.length);
  order.forEach((o, k) => (out[o.i] = placed[k]!));
  return out;
}

export function RaceSlide({ slide }: { slide: Extract<RecapSlide, { kind: "race" }> }) {
  const reduce = useReducedMotion();
  const steps = slide.quizNames.length;
  const columns = steps + 1; // + the final, still to be decided
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const colX = (i: number) => PAD.left + (plotW * i) / (columns - 1);
  const max = Math.max(1, ...slide.lines.flatMap((l) => l.cumulative));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const finals = slide.lines.map((l) => l.cumulative[steps - 1] ?? 0);
  const leaderTotal = Math.max(...finals);
  const ranked = [...slide.lines].sort(
    (a, b) => (b.cumulative[steps - 1] ?? 0) - (a.cumulative[steps - 1] ?? 0),
  );
  const leader = ranked[0]!;
  const labelYs = spreadLabels(
    slide.lines.map((l) => y(l.cumulative[steps - 1] ?? 0)),
    PAD.top,
    H - PAD.bottom,
  );
  const gridValues = [0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const labelsAt = START_S + DRAW_S + 0.1;

  return (
    <SlideFrame>
      <SlideHeading
        eyebrow="Act II"
        title="The Road to the Final"
        subtitle="Championship points, quiz by quiz — right up to tonight"
        accent="#b388ff"
      />

      <div className="relative z-10 mt-8" style={{ width: W, height: H }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible">
          <defs>
            <filter id="race-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid */}
          {gridValues.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={colX(columns - 1)} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.07)" />
              <text x={PAD.left - 12} y={y(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="13" fontWeight={600}>
                {formatScore(v)}
              </text>
            </g>
          ))}
          <line x1={PAD.left} x2={colX(columns - 1)} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.18)" />
          {Array.from({ length: steps }, (_, i) => (
            <line key={i} x1={colX(i)} x2={colX(i)} y1={PAD.top} y2={y(0)} stroke="rgba(255,255,255,0.05)" />
          ))}

          {/* The final: a glowing column still to be written */}
          <motion.rect
            x={colX(columns - 1) - 34}
            width={68}
            y={PAD.top}
            height={plotH}
            rx={18}
            fill="url(#final-col)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: labelsAt }}
          />
          <defs>
            <linearGradient id="final-col" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffc94d" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ffc94d" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Lines */}
          {slide.lines.map((line, li) => {
            const pts = line.cumulative.map((v, i) => ({ x: colX(i), y: y(v) }));
            const last = pts[pts.length - 1]!;
            const isLeader = line.team.teamId === leader.team.teamId;
            return (
              <g key={line.team.teamId}>
                <motion.path
                  d={smoothPath(pts)}
                  fill="none"
                  stroke={line.team.color}
                  strokeWidth={isLeader ? 6 : 4}
                  strokeLinecap="round"
                  filter="url(#race-glow)"
                  initial={{ pathLength: reduce ? 1 : 0, opacity: 0.95 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduce ? 0 : DRAW_S, delay: START_S + li * 0.06, ease: "easeInOut" }}
                />
                {pts.map((p, i) => (
                  <motion.circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={isLeader ? 7 : 5.5}
                    fill={line.team.color}
                    stroke="#08061a"
                    strokeWidth={2.5}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 15,
                      delay: reduce ? 0 : START_S + li * 0.06 + (DRAW_S * i) / Math.max(steps - 1, 1),
                    }}
                    style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                  />
                ))}
                {/* Dashed hand-off into the unknown */}
                <motion.line
                  x1={last.x}
                  y1={last.y}
                  x2={colX(columns - 1)}
                  y2={last.y}
                  stroke={line.team.color}
                  strokeOpacity={0.5}
                  strokeWidth={2.5}
                  strokeDasharray="4 8"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, delay: labelsAt + li * 0.04 }}
                />
              </g>
            );
          })}
        </svg>

        {/* Column labels */}
        {slide.quizNames.map((name, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: START_S + (DRAW_S * i) / Math.max(steps - 1, 1) }}
            className="absolute truncate text-center text-[13px] font-semibold text-white/45"
            style={{
              left: colX(i) - plotW / columns / 2,
              width: plotW / columns,
              top: H - PAD.bottom + 14,
            }}
          >
            {name}
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: labelsAt }}
          className="absolute flex flex-col items-center"
          style={{ left: colX(columns - 1) - 70, width: 140, top: H - PAD.bottom + 8 }}
        >
          <span className="flex items-center gap-1.5 font-display text-sm font-extrabold uppercase tracking-[0.18em] text-sun">
            <Flag className="h-4 w-4" /> Tonight
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: [1, 1.12, 1] }}
          transition={{
            opacity: { delay: labelsAt, duration: 0.4 },
            scale: { delay: labelsAt, duration: 1.6, repeat: Infinity },
          }}
          className="absolute grid place-items-center font-display text-7xl font-black text-sun drop-shadow-[0_0_24px_rgba(255,201,77,0.9)]"
          style={{ left: colX(columns - 1) - 40, width: 80, top: PAD.top + plotH / 2 - 50, height: 100 }}
        >
          ?
        </motion.div>

        {/* End-of-line labels */}
        {slide.lines.map((line, li) => {
          const total = line.cumulative[steps - 1] ?? 0;
          const isLeader = total === leaderTotal;
          return (
            <motion.div
              key={line.team.teamId}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 20, delay: labelsAt + 0.2 + li * 0.07 }}
              className="absolute flex items-center gap-2.5"
              style={{ left: colX(columns - 1) + 52, top: labelYs[li]! - 18, height: 36 }}
            >
              <TeamBadge
                team={{ _id: line.team.teamId, name: line.team.name, color: line.team.color, iconId: line.team.iconId }}
                size="sm"
              />
              <span className="max-w-[150px] truncate font-display text-[15px] font-bold text-white/90">
                {line.team.name}
              </span>
              <span
                className="font-display text-[15px] font-black"
                style={{ color: isLeader ? "#ffc94d" : "rgba(255,255,255,0.55)" }}
              >
                <CountUp value={total} delay={labelsAt} duration={1} />
              </span>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 16, delay: labelsAt + 0.9 }}
        className="glass relative z-10 mt-6 flex items-center gap-3 px-6 py-3"
      >
        <Shuffle className="h-6 w-6 text-neon-2" />
        <span className="font-display text-xl font-bold text-white">
          {slide.leadChanges === 0
            ? `${leader.team.name} have led from the very first quiz…`
            : `The lead changed hands ${slide.leadChanges} ${slide.leadChanges === 1 ? "time" : "times"}`}
        </span>
        <span className="font-display text-xl font-bold text-sun">but tonight decides it.</span>
      </motion.div>
    </SlideFrame>
  );
}

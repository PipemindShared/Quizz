import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Timer, Users, Zap } from "lucide-react";
import type { HostState } from "./types";
import StorageImage from "../components/StorageImage";
import { useCountdown } from "../lib/useCountdown";
import { DIFFICULTY, ANSWER_KIND_LABEL, withAlpha } from "../lib/utils";

export type HostQuestionProps = {
  question: NonNullable<HostState["question"]>;
  game: HostState["game"];
  answeredCount: number;
  playerCount: number;
  onAutoClose: () => void;
};

const CHOICE_LABELS = ["A", "B", "C", "D"];
const CHOICE_ACCENTS = ["#7c5cff", "#ff4d8d", "#4dd0ff", "#ffc94d"];

const MINT: [number, number, number] = [61, 220, 151];
const SUN: [number, number, number] = [255, 201, 77];
const SIREN: [number, number, number] = [255, 84, 112];

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i]! - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Mint above half time, through sun at the midpoint, to siren as it runs out. */
function countdownColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  if (r >= 0.5) return mix(SUN, MINT, (r - 0.5) / 0.5);
  return mix(SIREN, SUN, r / 0.5);
}

export default function HostQuestion({
  question,
  game,
  answeredCount,
  playerCount,
  onAutoClose,
}: HostQuestionProps) {
  const { secondsLeft, ratio, expired } = useCountdown(game.questionStartedAt, game.questionEndsAt);
  const reducedMotion = useReducedMotion();
  const diff = DIFFICULTY[question.points] ?? DIFFICULTY[2]!;
  const color = countdownColor(ratio);
  const urgent = secondsLeft <= 5 && !expired;

  // ---- Auto-close latch: fires onAutoClose at most once per question ----
  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
  }, [question._id]);
  useEffect(() => {
    if (closedRef.current) return;
    const shouldClose = expired || (playerCount > 0 && answeredCount >= playerCount);
    if (shouldClose) {
      closedRef.current = true;
      onAutoClose();
    }
  }, [expired, answeredCount, playerCount, onAutoClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.98 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-screen w-full flex-col overflow-hidden px-8 pt-8 pb-28 sm:px-12"
    >
      {/* Ambient festive glow blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-neon/20 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-10 h-96 w-96 rounded-full bg-punch/15 blur-[120px]" />

      {/* Header */}
      <div className="relative z-10 flex shrink-0 items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="glass-soft rounded-full px-4 py-2 font-display text-sm font-bold uppercase tracking-wide text-white/70">
            Question {question.number}
          </div>
          <div
            className="rounded-full border px-4 py-2 font-display text-sm font-bold uppercase tracking-wide"
            style={{
              backgroundColor: withAlpha(diff.color, 0.16),
              borderColor: withAlpha(diff.color, 0.5),
              color: diff.color,
            }}
          >
            {diff.label} · {question.points} pt{question.points === 1 ? "" : "s"}
          </div>
          <div className="hidden items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wide text-white/45 md:flex">
            {ANSWER_KIND_LABEL[question.answerKind]}
          </div>
        </div>

        <motion.div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 bg-white/5 backdrop-blur-xl"
          style={{ borderColor: color, boxShadow: `0 0 24px -6px ${color}` }}
          animate={urgent && !reducedMotion ? { scale: [1, 1.14, 1] } : { scale: 1 }}
          transition={urgent && !reducedMotion ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" } : undefined}
        >
          <span className="font-display text-4xl font-black tabular-nums" style={{ color }}>
            {secondsLeft}
          </span>
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 mt-4 flex shrink-0 items-center gap-3">
        <Timer className="h-5 w-5 shrink-0 text-white/40" />
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="absolute inset-y-0 left-0 w-full origin-left rounded-full"
            style={{ backgroundColor: color }}
            animate={{ scaleX: ratio }}
            transition={{ duration: 0.2, ease: "linear" }}
          />
        </div>
      </div>

      {/* Main content: prompt + image + choices */}
      <div className="relative z-10 mt-6 flex min-h-0 flex-1 flex-col gap-4">
        <div className="shrink-0">
          <h1 className="text-balance text-center font-display text-[clamp(2rem,5vw,5.5rem)] font-extrabold leading-[1.05] tracking-tight">
            {question.prompt}
          </h1>
          {question.promptImageId && (
            <div className="mx-auto mt-4 h-[clamp(110px,20vh,220px)] max-w-3xl overflow-hidden rounded-3xl border border-white/10">
              <StorageImage storageId={question.promptImageId} className="h-full w-full object-cover" alt="" />
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <ChoicesArea question={question} reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* Answered ticker */}
      <div className="relative z-10 mt-4 flex shrink-0 items-center justify-center gap-2 text-white/60">
        <Users className="h-5 w-5" />
        <span className="font-display text-lg font-bold">
          <span className="tabular-nums text-white">{answeredCount}</span>
          <span className="text-white/40"> / {playerCount} answered</span>
        </span>
      </div>
    </motion.div>
  );
}

function ChoicesArea({
  question,
  reducedMotion,
}: {
  question: HostQuestionProps["question"];
  reducedMotion: boolean | null;
}) {
  if (question.answerKind === "text_input") {
    return (
      <motion.div
        className="flex flex-col items-center gap-5 text-center"
        animate={reducedMotion ? { opacity: 1 } : { opacity: [0.85, 1, 0.85] }}
        transition={reducedMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="glass flex h-24 w-24 items-center justify-center rounded-full">
          <Zap className="h-11 w-11 text-sun" />
        </div>
        <p className="text-balance font-display text-3xl font-extrabold text-white/85 md:text-5xl">
          Type your answer on your phone
        </p>
      </motion.div>
    );
  }

  if (question.answerKind === "text_choice") {
    return (
      <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
        {question.choices.map((choice, i) => (
          <div key={i} className="glass-soft flex min-h-0 items-center gap-4 rounded-2xl px-6 py-5">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-black"
              style={{ backgroundColor: withAlpha(CHOICE_ACCENTS[i]!, 0.2), color: CHOICE_ACCENTS[i] }}
            >
              {CHOICE_LABELS[i]}
            </span>
            <span className="line-clamp-2 font-display text-xl font-bold text-white/90 md:text-2xl">
              {choice.text}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // image_choice / image_text_choice
  return (
    <div className="grid h-full w-full max-w-5xl grid-cols-2 gap-4">
      {question.choices.map((choice, i) => (
        <div key={i} className="relative overflow-hidden rounded-3xl border border-white/10">
          <StorageImage storageId={choice.imageId} className="h-full w-full object-cover" alt="" />
          <span
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full font-display text-sm font-black shadow"
            style={{ backgroundColor: withAlpha(CHOICE_ACCENTS[i]!, 0.9), color: "#08061a" }}
          >
            {CHOICE_LABELS[i]}
          </span>
          {question.answerKind === "image_text_choice" && choice.text && (
            <div className="absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
              <span className="line-clamp-2 font-display text-lg font-bold text-white">{choice.text}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

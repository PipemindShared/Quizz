import { motion, useReducedMotion } from "framer-motion";
import { Bomb, Check, Skull } from "lucide-react";
import type { RecapSlide } from "../../../convex/recap";
import StorageImage from "../../components/StorageImage";
import { DIFFICULTY, cn } from "../../lib/utils";
import { CountUp, Medallion, Rays, SlideFrame, SlideHeading } from "./shared";
import { pop, useAfter } from "./fx";

const LETTERS = ["A", "B", "C", "D"];
const BARS_AT = 1.1;

export function QuestionSlide({ slide }: { slide: Extract<RecapSlide, { kind: "question" }> }) {
  const reduce = useReducedMotion();
  const q = slide.question;
  const isTrap = slide.id === "trap";
  const accent = isTrap ? "#ff8a4d" : "#ff5470";
  const Icon = isTrap ? Bomb : Skull;
  const pct = q.answered > 0 ? Math.round((q.correct / q.answered) * 100) : 0;
  const maxCount = Math.max(1, ...q.choiceCounts);
  const stampAt = BARS_AT + 1.5;
  useAfter(stampAt * 1000 + 100, () => pop(accent, { x: 0.5, y: 0.5 }));
  const difficulty = DIFFICULTY[q.difficulty];

  return (
    <SlideFrame>
      <Rays color={accent} size={1300} speed={50} opacity={0.25} />
      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center">
        <div className="flex items-center gap-6">
          <Medallion icon={<Icon className="h-12 w-12" />} color={accent} size={100} />
          <div className="text-left">
            <SlideHeading eyebrow="Act IV · The Questions" title={slide.title} accent={accent} />
          </div>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-3 text-[clamp(1rem,1.6vw,1.4rem)] font-medium text-white/55"
        >
          {slide.blurb}
        </motion.p>

        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, rotateX: 25 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.5 }}
          className="glass mt-8 flex w-full items-center gap-6 px-8 py-6"
        >
          {q.promptImageId ? (
            <StorageImage storageId={q.promptImageId} fit="contain" className="h-28 w-40 shrink-0 rounded-2xl bg-black/30" />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/40">
              <span>{slide.quizName}</span>
              {difficulty ? (
                <span className="rounded-full px-2.5 py-0.5" style={{ color: difficulty.color, background: `${difficulty.color}22` }}>
                  {difficulty.label}
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-balance font-display text-[clamp(1.6rem,2.8vw,2.6rem)] font-bold leading-tight text-white">
              {q.prompt}
            </div>
          </div>
          {!isTrap ? (
            <div className="flex shrink-0 flex-col items-center">
              <div className="font-display text-[clamp(3rem,6vw,5.5rem)] font-black leading-none" style={{ color: accent }}>
                <CountUp value={pct} delay={BARS_AT} duration={1.6} format={(n) => `${Math.round(n)}%`} />
              </div>
              <div className="mt-1 text-sm font-semibold text-white/50">
                got it right · {q.correct} of {q.answered}
              </div>
            </div>
          ) : null}
        </motion.div>

        {q.answerKind === "text_input" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: stampAt }}
            className="mt-8 flex items-center gap-3 rounded-full bg-mint/15 px-8 py-4 ring-2 ring-mint/60"
          >
            <Check className="h-8 w-8 text-mint" />
            <span className="font-display text-3xl font-black text-white">{q.correctText}</span>
          </motion.div>
        ) : (
          <div className="mt-8 grid w-full grid-cols-2 gap-4">
            {q.choices.map((choice, i) => {
              const count = q.choiceCounts[i] ?? 0;
              const share = q.answered > 0 ? count / q.answered : 0;
              const isCorrect = i === q.correctChoice;
              const isTrapChoice = isTrap && i === slide.trapChoice;
              const barColor = isCorrect ? "#3ddc97" : isTrapChoice ? "#ff5470" : "rgba(255,255,255,0.18)";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 ? 40 : -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                  className={cn(
                    "glass-soft relative flex items-center gap-4 overflow-hidden px-5 py-4",
                    isTrapChoice && "ring-2 ring-siren/70",
                  )}
                >
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    style={{ background: `linear-gradient(90deg, ${barColor}, ${barColor}55)`, opacity: 0.35 }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${(count / maxCount) * 100}%` }}
                    transition={{ duration: reduce ? 0 : 1.3, delay: BARS_AT + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <span
                    className={cn(
                      "relative grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-lg font-black",
                      isCorrect ? "bg-mint text-ink" : isTrapChoice ? "bg-siren text-white" : "bg-white/10 text-white/70",
                    )}
                  >
                    {isCorrect ? <Check className="h-6 w-6" /> : LETTERS[i]}
                  </span>
                  {choice.imageId ? (
                    <StorageImage storageId={choice.imageId} fit="contain" className="relative h-14 w-20 shrink-0 rounded-lg bg-black/30" />
                  ) : null}
                  <span className="relative min-w-0 flex-1 truncate font-display text-[clamp(1.1rem,1.8vw,1.6rem)] font-bold text-white">
                    {choice.text}
                  </span>
                  <span className="relative shrink-0 font-display text-2xl font-black tabular-nums text-white/85">
                    <CountUp value={share * 100} delay={BARS_AT} format={(n) => `${Math.round(n)}%`} />
                  </span>
                  {isTrapChoice ? (
                    <motion.span
                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 3, rotate: -30 }}
                      animate={{ opacity: 1, scale: 1, rotate: -12 }}
                      transition={{ type: "spring", stiffness: 420, damping: 16, delay: stampAt }}
                      className="absolute right-24 top-1/2 -translate-y-1/2 rounded-lg border-[3px] border-siren px-3 py-0.5 font-display text-2xl font-black uppercase tracking-widest text-siren"
                      style={{ boxShadow: "0 0 24px rgba(255,84,112,0.6)" }}
                    >
                      Trap!
                    </motion.span>
                  ) : null}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </SlideFrame>
  );
}

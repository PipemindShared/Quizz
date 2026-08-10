import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { HostState, HostQuestion, HostRevealDistribution, HostRevealTextAnswer, HostBestPlayer, Dot } from "./types";
import StorageImage from "../components/StorageImage";
import TeamBadge from "../components/TeamBadge";
import { cn, seconds } from "../lib/utils";
import { burst } from "../lib/celebrate";
import { Check, X, Sparkles, Star, Trophy } from "lucide-react";

export type HostRevealProps = {
  question: NonNullable<HostState["question"]>;
  reveal: NonNullable<HostState["reveal"]>;
};

type DotWithDelay = Dot & { delaySeconds: number; key: string };
type EnrichedDistribution = HostRevealDistribution & { dots: DotWithDelay[] };
type EnrichedTextAnswer = HostRevealTextAnswer & { dots: DotWithDelay[] };

/** One voter's dot, entrance-staggered by how fast they answered relative to the whole reveal. */
function DotCluster({ dots, reducedMotion }: { dots: DotWithDelay[]; reducedMotion: boolean }) {
  if (dots.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {dots.map((dot) => (
        <motion.span
          key={dot.key}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={
            reducedMotion
              ? { duration: 0.25 }
              : { type: "spring", stiffness: 400, damping: 22, delay: dot.delaySeconds }
          }
          className="h-3 w-3 rounded-full ring-1 ring-white/20"
          style={{ backgroundColor: dot.teamColor }}
          title={seconds(dot.elapsedMs)}
        />
      ))}
    </div>
  );
}

function ChoiceCard({
  letter,
  choice,
  dist,
  totalAnswers,
  reducedMotion,
}: {
  letter: string;
  choice: HostQuestion["choices"][number];
  dist: EnrichedDistribution;
  totalAnswers: number;
  reducedMotion: boolean;
}) {
  const isCorrect = dist.correct;
  const percent = totalAnswers === 0 ? 0 : (dist.count / totalAnswers) * 100;

  return (
    <motion.div
      initial={isCorrect ? { scale: 0.9 } : false}
      animate={{ scale: 1 }}
      transition={isCorrect ? { type: "spring", stiffness: 300, damping: 18 } : undefined}
      className={cn(
        "glass relative overflow-hidden p-5",
        isCorrect ? "ring-2 ring-mint/70" : "opacity-70 grayscale-[0.35]",
      )}
    >
      {isCorrect && (
        <span className="animate-pulse-ring absolute inset-0 -z-10 rounded-3xl bg-mint/20" />
      )}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-sm font-bold",
            isCorrect ? "bg-mint text-ink" : "border border-siren/40 bg-white/5 text-white/70",
          )}
        >
          {letter}
        </span>
        {choice.imageId && (
          <StorageImage
            storageId={choice.imageId}
            alt={choice.text ?? letter}
            fit="contain"
            className="h-16 w-16 shrink-0 rounded-xl bg-white/[0.06]"
          />
        )}
        {choice.text && (
          <span className="flex-1 truncate font-display text-lg font-semibold text-white/90">
            {choice.text}
          </span>
        )}
        {isCorrect ? (
          <Check className="h-6 w-6 shrink-0 text-mint" />
        ) : (
          <X className="h-6 w-6 shrink-0 text-siren/70" />
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between font-display text-xs tabular-nums text-white/50">
          <span>
            {dist.count} {dist.count === 1 ? "vote" : "votes"}
          </span>
          <span>{Math.round(percent)}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className={cn("h-full rounded-full", isCorrect ? "bg-mint" : "bg-siren/60")}
          />
        </div>
      </div>

      <DotCluster dots={dist.dots} reducedMotion={reducedMotion} />
    </motion.div>
  );
}

function TextAnswerRow({
  rank,
  answer,
  totalAnswers,
  reducedMotion,
}: {
  rank: number;
  answer: EnrichedTextAnswer;
  totalAnswers: number;
  reducedMotion: boolean;
}) {
  const isCorrect = answer.correct;
  const percent = totalAnswers === 0 ? 0 : (answer.count / totalAnswers) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: isCorrect ? 0.96 : 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: rank * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "glass relative overflow-hidden p-4",
        isCorrect ? "ring-2 ring-mint/70" : "opacity-80",
      )}
    >
      {isCorrect && (
        <span className="animate-pulse-ring absolute inset-0 -z-10 rounded-3xl bg-mint/20" />
      )}
      <div className="flex items-center gap-3">
        <span className="font-display text-sm font-bold text-white/40">#{rank}</span>
        <span className="flex-1 truncate font-display text-lg font-semibold text-white/90">
          {answer.text}
        </span>
        <span className="shrink-0 font-display text-sm tabular-nums text-white/50">
          {answer.count}× · {Math.round(percent)}%
        </span>
        {isCorrect ? (
          <Check className="h-5 w-5 shrink-0 text-mint" />
        ) : (
          <X className="h-5 w-5 shrink-0 text-siren/70" />
        )}
      </div>
      <DotCluster dots={answer.dots} reducedMotion={reducedMotion} />
    </motion.div>
  );
}

function BestPlayerCard({ bestPlayer }: { bestPlayer: HostBestPlayer }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.3 }}
      className="glass relative flex w-full max-w-xl flex-col items-center gap-3 p-8 text-center"
    >
      <span className="animate-pulse-ring absolute inset-0 -z-10 rounded-3xl bg-sun/20" />
      <div className="flex items-center gap-2 text-sun">
        <Trophy className="h-5 w-5" />
        <span className="font-display text-xs font-bold uppercase tracking-[0.2em]">
          Fastest correct answer
        </span>
        <Trophy className="h-5 w-5" />
      </div>
      <TeamBadge
        size="xl"
        team={{
          _id: bestPlayer.teamId,
          name: bestPlayer.teamName,
          color: bestPlayer.teamColor,
          iconId: bestPlayer.teamIconId,
        }}
      />
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 shrink-0 fill-sun text-sun" />
        <div className="grad-text text-balance font-display text-4xl font-extrabold sm:text-5xl">
          {bestPlayer.name}
        </div>
        <Star className="h-5 w-5 shrink-0 fill-sun text-sun" />
      </div>
      <div className="flex items-center gap-1 text-sm font-semibold text-white/60">
        <Sparkles className="h-3.5 w-3.5" />
        {bestPlayer.teamName}
      </div>
      <div className="mt-2 flex items-center gap-8 font-display">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold tabular-nums text-white">
            {seconds(bestPlayer.elapsedMs)}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-white/40">Time</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold tabular-nums text-mint">+{bestPlayer.points}</span>
          <span className="text-[11px] uppercase tracking-wider text-white/40">Points</span>
        </div>
      </div>
    </motion.div>
  );
}

function NoBestPlayerCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="glass flex w-full max-w-xl flex-col items-center gap-2 p-8 text-center"
    >
      <div className="font-display text-2xl font-bold text-white/80">Nobody got it!</div>
      <p className="text-sm text-white/50">
        Tough one — the whole room is stumped. On to the next!
      </p>
    </motion.div>
  );
}

export default function HostReveal({ question, reveal }: HostRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion ?? false;

  const { distribution, textAnswers } = useMemo(() => {
    const allDots: Dot[] = [
      ...reveal.distribution.flatMap((d) => d.dots),
      ...reveal.textAnswers.flatMap((t) => t.dots),
    ];
    const maxElapsed = Math.max(1, ...allDots.map((d) => d.elapsedMs));

    const enrich = (dots: Dot[], prefix: string): DotWithDelay[] =>
      dots.map((dot, i) => ({
        ...dot,
        delaySeconds: reducedMotion ? 0 : (dot.elapsedMs / maxElapsed) * 1.6,
        key: `${prefix}-${dot.teamId}-${i}`,
      }));

    return {
      distribution: reveal.distribution.map(
        (d): EnrichedDistribution => ({
          ...d,
          dots: enrich(d.dots, `c${d.choiceIndex}`),
        }),
      ),
      textAnswers: reveal.textAnswers.map(
        (t, i): EnrichedTextAnswer => ({
          ...t,
          dots: enrich(t.dots, `t${i}`),
        }),
      ),
    };
  }, [reveal, reducedMotion]);

  useEffect(() => {
    // A fresh HostReveal instance mounts every time a question is revealed (parent keys
    // AnimatePresence by `${status}-${currentIndex}`), so an empty dep array fires this
    // exactly once per reveal — that's the intended, non-repeating celebration burst.
    if (reveal.bestPlayer) burst([reveal.bestPlayer.teamColor]);
  }, []);

  const isTextInput = question.answerKind === "text_input";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex w-full flex-col items-center overflow-x-hidden px-6 pt-8 pb-24 sm:px-10"
    >
      <div className="flex w-full max-w-4xl flex-col items-center gap-2 text-center">
        <span className="glass-soft px-4 py-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Question {question.number}
        </span>
        <h1 className="text-balance font-display text-2xl font-bold text-white/90 sm:text-3xl">
          {question.prompt}
        </h1>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="grad-text font-display text-5xl font-extrabold tabular-nums sm:text-6xl">
            {reveal.correctCount}
          </span>
          <span className="font-display text-lg text-white/50">
            / {reveal.totalAnswers} correct
          </span>
        </div>
      </div>

      <div className="mt-6 w-full max-w-4xl">
        {isTextInput ? (
          <div className="flex flex-col gap-3">
            {reveal.correctText && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="glass relative flex items-center justify-center gap-3 p-5 ring-2 ring-mint/70"
              >
                <span className="animate-pulse-ring absolute inset-0 -z-10 rounded-3xl bg-mint/20" />
                <Check className="h-6 w-6 shrink-0 text-mint" />
                <span className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                  Answer
                </span>
                <span className="text-balance font-display text-2xl font-extrabold text-mint sm:text-3xl">
                  {reveal.correctText}
                </span>
              </motion.div>
            )}
            {textAnswers.length === 0 && (
              <p className="glass p-5 text-center font-display text-sm text-white/50">
                No answers were submitted.
              </p>
            )}
            {textAnswers.map((answer, i) => (
              <TextAnswerRow
                key={`${answer.text}-${i}`}
                rank={i + 1}
                answer={answer}
                totalAnswers={reveal.totalAnswers}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {question.choices.map((choice, i) => {
              const dist = distribution[i];
              if (!dist) return null;
              return (
                <ChoiceCard
                  key={i}
                  letter={String.fromCharCode(65 + i)}
                  choice={choice}
                  dist={dist}
                  totalAnswers={reveal.totalAnswers}
                  reducedMotion={reducedMotion}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex w-full flex-col items-center">
        {reveal.bestPlayer ? (
          <BestPlayerCard bestPlayer={reveal.bestPlayer} />
        ) : (
          <NoBestPlayerCard />
        )}
      </div>
    </motion.div>
  );
}

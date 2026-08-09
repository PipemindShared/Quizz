import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, Sparkles, Trophy } from "lucide-react";
import TeamBadge from "../components/TeamBadge";
import type { HostState } from "./types";
import { rain } from "../lib/celebrate";
import { cn } from "../lib/utils";

export type HostRoundResultsProps = {
  roundScores: NonNullable<HostState["roundScores"]>;
  quizName: string;
};

const BAR_MAX = 200; // px — tallest possible bar, leaves room for badge/score above and player list below

export default function HostRoundResults({ roundScores, quizName }: HostRoundResultsProps) {
  const shouldReduceMotion = useReducedMotion();

  // Fresh mount per round (AnimatePresence remounts this component whenever
  // status/currentIndex changes), so an effectively-empty deps array here
  // really does mean "once per round result screen" — intentional.
  useEffect(() => {
    rain();
  }, []);

  const maxScore = Math.max(...roundScores.map((t) => t.score), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.98 }}
      transition={{ duration: shouldReduceMotion ? 0.15 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex min-h-dvh w-full flex-col items-center overflow-x-hidden overflow-y-auto px-6 pt-10 pb-[96px] sm:px-10"
    >
      {/* Ambient festive glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-neon/25 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full bg-sun/15 blur-[120px]"
      />

      {/* Header */}
      <header className="relative z-10 flex flex-col items-center text-center">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          <Trophy className="h-3.5 w-3.5 text-sun" />
          <span>Round Results</span>
        </div>
        <h1 className="mt-2 text-balance font-display text-[clamp(1.8rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight">
          <span className="grad-text">{quizName}</span>
        </h1>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
          <Sparkles className="h-3.5 w-3.5 text-neon-2" />
          <span>Score shown is the average points per player</span>
        </div>
      </header>

      {/* Podium */}
      {roundScores.length === 0 ? (
        <div className="glass-soft relative z-10 mt-12 px-8 py-6 text-center text-white/40">
          No teams scored this round.
        </div>
      ) : (
        <div className="relative z-10 mt-10 flex w-full flex-1 flex-wrap items-end justify-center gap-5">
          {roundScores.map((team, index) => {
            const isBest = index === 0;
            const pct = team.score / maxScore;
            const targetHeight = Math.max(pct * BAR_MAX, 10);
            // Best team's bar rises LAST, after everyone else has landed — a
            // deliberate suspense build rather than the winner popping first.
            const delay = shouldReduceMotion
              ? 0
              : (roundScores.length - 1 - index) * 0.15;
            const sortedPlayers = [...team.players].sort((a, b) => b.points - a.points);

            return (
              <div
                key={team.teamId}
                className={cn(
                  "flex w-[180px] flex-none flex-col items-center",
                  isBest && "w-[196px]",
                )}
              >
                {/* Reserved crown slot keeps every column's badge aligned regardless of rank */}
                <div className="flex h-7 items-center justify-center">
                  {isBest && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.4, rotate: -18, y: 6 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { delay: delay + 0.55, type: "spring", stiffness: 260, damping: 14 }
                      }
                    >
                      <Crown className="h-6 w-6 text-sun drop-shadow-[0_0_10px_rgba(255,201,77,0.7)]" />
                    </motion.div>
                  )}
                </div>

                <TeamBadge
                  team={{ _id: team.teamId, name: team.name, color: team.color, iconId: team.iconId }}
                  size={isBest ? "xl" : "lg"}
                />

                <div className="mt-2 w-full text-center">
                  <div className="truncate font-display text-sm font-bold leading-tight text-white/90">
                    {team.name}
                  </div>
                  <div
                    className={cn(
                      "mt-1 font-display font-extrabold leading-none tabular-nums",
                      isBest ? "text-4xl grad-text" : "text-2xl text-white/85",
                    )}
                  >
                    {team.score.toFixed(2)}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                    avg / player
                  </div>
                </div>

                {/* Bar */}
                <div className="relative mt-3 h-[200px] w-full">
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 rounded-t-2xl"
                    style={{
                      backgroundColor: team.color,
                      boxShadow: `0 0 24px -6px ${team.color}`,
                    }}
                    initial={{ height: shouldReduceMotion ? targetHeight : 0 }}
                    animate={{ height: targetHeight }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { delay, type: "spring", stiffness: 90, damping: 16 }
                    }
                  />
                </div>

                {/* Per-player breakdown */}
                <div className="no-scrollbar glass-soft mt-3 max-h-28 w-full space-y-1 overflow-y-auto px-3 py-2">
                  {sortedPlayers.map((p, i) => (
                    <div
                      key={`${p.name}-${i}`}
                      className="flex items-center justify-between gap-2 text-xs text-white/70"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="font-semibold tabular-nums text-white/90">{p.points}</span>
                    </div>
                  ))}
                  {sortedPlayers.length === 0 && (
                    <div className="text-center text-[11px] text-white/25">no players</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

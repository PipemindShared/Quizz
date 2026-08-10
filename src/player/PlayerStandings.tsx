import { useEffect, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Crown, Medal, Trophy } from "lucide-react";
import type { RoundScore, Standing } from "./types";
import { sideCannons } from "../lib/celebrate";
import { cn, formatScore, ordinal } from "../lib/utils";

const RANK_TINT: Record<number, string> = {
  1: "#ffc94d",
  2: "#c9d3e0",
  3: "#ff9d4d",
};

export default function PlayerStandings(props: {
  status: "round_results" | "leaderboard" | "finished";
  roundScores: RoundScore[] | null;
  standings: Standing[] | null;
  quizName: string;
  isFinal: boolean;
}) {
  const { status, roundScores, standings, quizName, isFinal } = props;
  const reducedMotion = useReducedMotion();

  if (status === "finished") {
    return (
      <FinishedScreen
        standings={standings}
        quizName={quizName}
        isFinal={isFinal}
        reducedMotion={!!reducedMotion}
      />
    );
  }

  if (status === "round_results") {
    const rows = [...(roundScores ?? [])].sort((a, b) => b.score - a.score);
    return (
      <div className="flex min-h-dvh flex-col px-4 py-6">
        <h1 className="mb-5 text-center font-display text-2xl font-extrabold text-white">
          Round Results
        </h1>
        <ul className="flex flex-col gap-2.5">
          {rows.map((row, i) => (
            <motion.li
              key={row.teamId}
              initial={reducedMotion ? undefined : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reducedMotion ? 0 : i * 0.06 }}
              className={cn(
                "glass-soft flex items-center gap-3 px-4 py-3.5",
                row.isMyTeam && "ring-2 ring-neon/60",
              )}
              style={row.isMyTeam ? { boxShadow: `0 0 0 1px ${row.color}55` } : undefined}
            >
              <span
                className="h-8 w-8 shrink-0 rounded-xl"
                style={{ backgroundColor: row.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base font-semibold text-white">
                  {row.name}
                </span>
                {row.bonusPercent > 0 && (
                  <span className="text-[11px] font-semibold tabular-nums text-mint">
                    +{row.bonusPercent}% attendance
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-lg font-extrabold text-white">
                  {formatScore(row.score)}
                </span>
                {row.bonusPercent > 0 && (
                  <span className="text-[10px] tabular-nums text-white/40">
                    from {formatScore(row.baseScore)}
                  </span>
                )}
              </span>
            </motion.li>
          ))}
          {rows.length === 0 ? (
            <li className="glass-soft px-4 py-6 text-center text-sm text-white/50">
              No scores yet.
            </li>
          ) : null}
        </ul>
      </div>
    );
  }

  // leaderboard
  const rows = [...(standings ?? [])].sort((a, b) => a.rank - b.rank);
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6">
      <h1 className="mb-5 text-center font-display text-2xl font-extrabold text-white">
        Leaderboard
      </h1>
      <ul className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.li
              key={row.teamId}
              layout
              initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.35 }}
              className={cn(
                "glass-soft flex items-center gap-3 px-4 py-3.5",
                row.isMyTeam && "ring-2 ring-neon/60",
              )}
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl font-display text-xs font-bold"
                style={{
                  backgroundColor: row.rank <= 3 ? `${RANK_TINT[row.rank]}22` : "rgba(255,255,255,0.08)",
                  color: row.rank <= 3 ? RANK_TINT[row.rank] : "rgba(255,255,255,0.6)",
                }}
              >
                {row.rank <= 3 ? <Medal className="h-4 w-4" /> : ordinal(row.rank)}
              </span>
              <span
                className="h-6 w-6 shrink-0 rounded-lg"
                style={{ backgroundColor: row.color }}
              />
              <span className="flex-1 truncate font-display text-base font-semibold text-white">
                {row.name}
              </span>
              {row.rank <= 3 ? (
                <span className="text-xs font-semibold text-white/40">
                  {ordinal(row.rank)}
                </span>
              ) : null}
              <span className="font-display text-lg font-extrabold text-white">
                {row.total}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
        {rows.length === 0 ? (
          <li className="glass-soft px-4 py-6 text-center text-sm text-white/50">
            No standings yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function FinishedScreen(props: {
  standings: Standing[] | null;
  quizName: string;
  isFinal: boolean;
  reducedMotion: boolean;
}) {
  const { standings, quizName, isFinal, reducedMotion } = props;
  const champion = isFinal
    ? (standings ?? []).find((s) => s.rank === 1) ?? null
    : null;

  const firedRef = useRef(false);
  useEffect(() => {
    if (champion && !firedRef.current) {
      firedRef.current = true;
      sideCannons();
      if (champion.isMyTeam) sideCannons();
    }
  }, [champion]);

  if (champion) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, scale: 0.7, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="glass flex flex-col items-center gap-3 px-8 py-10"
        >
          <div className="grid h-20 w-20 place-items-center rounded-full bg-sun/15 text-sun">
            <Trophy className="h-11 w-11" />
          </div>
          <p className="font-display text-sm font-semibold uppercase tracking-widest text-white/50">
            Champion
          </p>
          <p
            className="font-display text-2xl font-extrabold"
            style={{ color: champion.color }}
          >
            {champion.name}
          </p>
          {champion.isMyTeam ? (
            <p className="mt-1 font-display text-xl font-extrabold text-sun">
              YOUR TEAM WON!
            </p>
          ) : null}
          <p className="mt-3 text-sm text-white/50">
            Thanks for playing {quizName}!
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white/60">
        <Crown className="h-9 w-9" />
      </div>
      <p className="font-display text-xl font-bold text-white">
        Thanks for playing {quizName}!
      </p>
      <p className="text-sm text-white/50">See you at the next one.</p>
    </div>
  );
}

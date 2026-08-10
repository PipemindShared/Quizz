import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Users, Sparkles, Play } from "lucide-react";
import TeamBadge from "../components/TeamBadge";
import type { HostState } from "./types";
import { cn } from "../lib/utils";

export type HostLobbyProps = {
  quiz: HostState["quiz"];
  code: string;
  teams: HostState["teams"];
  playerCount: number;
  canStart: boolean;
  onStart: () => void;
};

/** Small spring-driven count-up used for the total player count. */
function CountUp({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    const start = performance.now();
    const duration = 420;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduceMotion]);

  return <span>{display}</span>;
}

/**
 * Most recent joiners shown per team, newest first. An uncapped list is what
 * made a 30-player lobby collapse: the chips pushed the screen to 1938px tall,
 * so FitToScreen scaled everything to 56% and the join QR — the one thing that
 * screen exists for — shrank to 156px. Capping keeps the QR full size, and the
 * newest names are the useful ones, since anyone who just scanned is looking
 * for their own name.
 */
const NAMES_SHOWN = 8;

export default function HostLobby({ quiz, code, teams, playerCount, canStart }: HostLobbyProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const joinUrl = `${origin}/play/${code}`;

  return (
    <motion.div
      key="host-lobby"
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex w-full flex-col overflow-x-hidden px-6 pt-8 pb-28 sm:px-10 lg:px-16"
    >
      {/* Ambient festive glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-neon/25 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full bg-punch/20 blur-[120px]"
      />

      {/* Header */}
      <header className="relative z-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-3xl">
          <h1 className="text-balance font-display text-[clamp(2rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight">
            <span className="grad-text">{quiz.name}</span>
          </h1>
          {quiz.description && (
            <p className="mt-3 max-w-2xl text-balance text-base text-white/50 sm:text-lg">
              {quiz.description}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            <Sparkles className="h-3.5 w-3.5 text-sun" />
            <span>{quiz.questionCount} questions</span>
          </div>
        </div>

        <div className="glass flex shrink-0 items-center gap-3 rounded-2xl px-5 py-3">
          <Users className="h-6 w-6 text-neon-2" />
          <div className="leading-none">
            <div className="font-display text-3xl font-extrabold tabular-nums">
              <CountUp value={playerCount} />
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              {playerCount === 1 ? "player" : "players"} joined
            </div>
          </div>
        </div>
      </header>

      {/* Join panel */}
      <section className="relative z-10 mt-6 flex flex-col items-center justify-center gap-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] sm:p-8 lg:flex-row lg:gap-12">
        <div className="rounded-3xl bg-white p-6 shadow-[0_0_60px_-10px_rgba(124,92,255,0.6)] sm:p-8">
          <QRCodeSVG value={joinUrl} size={240} level="M" className="h-[clamp(160px,22vw,280px)] w-[clamp(160px,22vw,280px)]" />
        </div>

        <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Join code
          </span>
          <div className="grad-text font-display text-[clamp(3rem,10vw,8rem)] font-extrabold leading-none tracking-widest">
            {code}
          </div>
          <p className="max-w-sm text-balance text-sm text-white/50 sm:text-base">
            Scan the code, or go to{" "}
            <span className="font-semibold text-white/80">{origin.replace(/^https?:\/\//, "")}/play</span>{" "}
            and enter the code above.
          </p>
          <div
            className={cn(
              "mt-2 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
              canStart ? "bg-mint/15 text-mint" : "bg-white/5 text-white/40",
            )}
          >
            <Play className="h-4 w-4" />
            {canStart ? "Ready to start!" : "Waiting for players…"}
          </div>
        </div>
      </section>

      {/* Team columns */}
      <section className="relative z-10 mt-6">
        {teams.length === 0 ? (
          <p className="text-center text-white/30">No teams yet.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-4">
            {teams.map((team) => (
              <div
                key={team._id}
                className="glass-soft flex w-full max-w-[15rem] flex-1 basis-56 flex-col items-center gap-3 p-5"
              >
                <TeamBadge team={{ _id: team._id, name: team.name, color: team.color, iconId: team.iconId }} size="lg" />
                <div className="text-center">
                  <div className="font-display text-lg font-bold leading-tight">{team.name}</div>
                  <div className="mt-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
                    {team.playerCount} {team.playerCount === 1 ? "player" : "players"}
                  </div>
                </div>
                <div className="flex w-full flex-col items-center gap-1.5">
                  <AnimatePresence initial={false}>
                    {team.playerNames.slice(0, NAMES_SHOWN).map((name) => (
                      <motion.div
                        key={name}
                        initial={{ opacity: 0, y: 12, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="w-full truncate rounded-full bg-white/5 px-3 py-1 text-center text-sm text-white/80"
                        style={{ boxShadow: `inset 0 0 0 1px ${team.color}33` }}
                      >
                        {name}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {team.playerNames.length > NAMES_SHOWN && (
                    <span className="pt-0.5 text-xs font-semibold text-white/45">
                      +{team.playerNames.length - NAMES_SHOWN} more
                    </span>
                  )}
                  {team.playerNames.length === 0 && (
                    <span className="text-xs text-white/25">no one yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}

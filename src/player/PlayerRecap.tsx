import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Award, Crosshair, Layers, Medal, Sparkles, Trophy, Tv, Zap } from "lucide-react";
import type { PlayFinale, PlayMe } from "./types";
import TeamBadge from "../components/TeamBadge";
import CountUp from "../components/CountUp";
import { sideCannons } from "../lib/celebrate";
import { ordinal } from "../lib/utils";

/** Matches the big screen's "and the award goes to…" pause (plus a beat). */
const WINNER_DELAY_MS = 1900;
/** How long "That's you!" covers the screen before handing back to the card. */
const GLORY_MS = 6000;

/**
 * The phone's side of Awards Night: this player's own tournament, while the big
 * screen runs the slideshow — and a moment of glory when the award is theirs.
 *
 * Like every player screen, nothing here starts invisible: entrances move
 * content without fading it, so a locked phone never wakes onto a blank card.
 */
export default function PlayerRecap({ me, finale }: { me: PlayMe; finale: PlayFinale }) {
  const reduce = useReducedMotion();
  const mine = finale.mine;
  const { slide } = finale;

  // The big screen keeps the room waiting before it names a winner; the phone
  // waits just as long, or it would give the award away early.
  const [wonStep, setWonStep] = useState(-1);
  const celebrated = useRef(-1);
  useEffect(() => {
    if (!slide.iWon) return;
    const t = setTimeout(() => {
      setWonStep(finale.step);
      // Celebrate once per award won, not on every re-render of the same slide.
      if (celebrated.current !== finale.step) {
        celebrated.current = finale.step;
        sideCannons([me.teamColor, "#ffc94d", "#ffffff"]);
      }
    }, WINNER_DELAY_MS);
    return () => clearTimeout(t);
  }, [slide.iWon, finale.step, me.teamColor]);
  // The glory moment fades by itself (or on a tap) so the card underneath —
  // now with the new award on it — gets its turn.
  const [dismissedStep, setDismissedStep] = useState(-1);
  useEffect(() => {
    if (wonStep < 0) return;
    const t = setTimeout(() => setDismissedStep(wonStep), GLORY_MS);
    return () => clearTimeout(t);
  }, [wonStep]);
  const showWon = slide.iWon && wonStep === finale.step && dismissedStep !== finale.step;
  const awardAnnounced = slide.iWon && wonStep === finale.step;
  const awards =
    mine && awardAnnounced && slide.title && !mine.awards.includes(slide.title)
      ? [...mine.awards, slide.title]
      : (mine?.awards ?? []);

  const accuracy = mine && mine.answered > 0 ? Math.round((mine.correct / mine.answered) * 100) : 0;

  return (
    <div className="relative flex flex-1 flex-col gap-4 pb-safe pt-6">
      <div className="text-center">
        <p className="flex items-center justify-center gap-1.5 font-display text-xs font-bold uppercase tracking-[0.3em] text-sun">
          <Sparkles className="h-3.5 w-3.5" /> Awards Night
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-white">Your tournament</h1>
      </div>

      {mine ? (
        <>
          <motion.div
            initial={reduce ? false : { y: 16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
            className="relative overflow-hidden rounded-3xl border px-5 py-5"
            style={{
              borderColor: `${me.teamColor}66`,
              background: `linear-gradient(160deg, ${me.teamColor}40, rgba(255,255,255,0.03) 65%)`,
              boxShadow: `0 24px 60px -30px ${me.teamColor}`,
            }}
          >
            <div className="flex items-center gap-4">
              <TeamBadge
                team={{ _id: me.teamId, name: me.teamName, color: me.teamColor, iconId: me.teamIconId }}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-2xl font-extrabold text-white">{me.name}</p>
                <p className="truncate text-sm text-white/60">{me.teamName}</p>
              </div>
            </div>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="label !mb-0">Player rank</p>
                <motion.p
                  initial={reduce ? false : { scale: 1.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.3 }}
                  className="origin-left font-display text-5xl font-black leading-none text-white"
                >
                  {ordinal(mine.rank)}
                </motion.p>
                <p className="mt-1 text-xs text-white/50">of {finale.totalPlayers} players</p>
              </div>
              <div className="text-right">
                <p className="label !mb-0">Points</p>
                <p className="font-display text-4xl font-black leading-none text-sun">
                  <CountUp value={mine.points} duration={1.8} />
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            <Tile icon={<Crosshair className="h-4 w-4" />} label="Accuracy" color="#3ddc97">
              <CountUp value={accuracy} format={(n) => `${Math.round(n)}%`} />
            </Tile>
            <Tile icon={<Layers className="h-4 w-4" />} label="Quizzes played" color="#7c5cff">
              <CountUp value={mine.quizzesPlayed} format={(n) => `${Math.round(n)}`} />
            </Tile>
            <Tile icon={<Zap className="h-4 w-4" />} label="Fastest right answer" color="#4dd0ff">
              {mine.fastestCorrectMs !== null ? `${(mine.fastestCorrectMs / 1000).toFixed(1)}s` : "—"}
            </Tile>
            <Tile icon={<Medal className="h-4 w-4" />} label="Times fastest" color="#ffc94d">
              <CountUp value={mine.bestCount} format={(n) => `${Math.round(n)}`} />
            </Tile>
          </div>

          <AnimatePresence initial={false}>
            {awards.length > 0 ? (
              <motion.div
                initial={reduce ? false : { y: 12 }}
                animate={{ y: 0 }}
                className="glass-soft flex flex-wrap items-center gap-2 px-4 py-3"
              >
                <Award className="h-4 w-4 text-sun" />
                {awards.map((a) => (
                  <span key={a} className="rounded-full bg-sun/15 px-3 py-1 text-xs font-bold text-sun">
                    {a}
                  </span>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      ) : (
        <div className="glass flex flex-col items-center gap-3 px-6 py-8 text-center">
          <Tv className="h-10 w-10 text-white/60" />
          <p className="font-display text-lg font-bold text-white">Eyes on the big screen</p>
        </div>
      )}

      {finale.myTeamRank !== null ? (
        <motion.div
          key={`rank-${finale.myTeamRank}`}
          initial={reduce ? false : { scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14 }}
          className="glass flex items-center gap-3 px-5 py-4"
          style={{ boxShadow: `0 0 0 1.5px ${me.teamColor}88 inset` }}
        >
          <Trophy className="h-6 w-6 text-sun" />
          <p className="font-display text-lg font-bold text-white">
            {me.teamName} finished {ordinal(finale.myTeamRank)} of {finale.teamCount}
          </p>
        </motion.div>
      ) : null}

      <div className="mt-auto flex items-center justify-center gap-2 pt-2 text-sm text-white/50">
        <motion.span
          className="h-2 w-2 rounded-full bg-punch"
          animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <span>
          On the big screen: <span className="font-semibold text-white/80">{slide.title ?? "Awards Night"}</span>
        </span>
      </div>

      <AnimatePresence>
        {showWon ? (
          <motion.div
            key={`won-${finale.step}`}
            initial={reduce ? false : { scale: 0.85 }}
            animate={{ scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            onClick={() => setDismissedStep(finale.step)}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-8 text-center"
            style={{ background: `radial-gradient(circle at 50% 40%, ${me.teamColor}cc, #08061af2 70%)` }}
          >
            <motion.div
              animate={reduce ? undefined : { rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6 }}
            >
              <Trophy className="h-28 w-28 text-sun drop-shadow-[0_0_30px_rgba(255,201,77,0.9)]" strokeWidth={1.6} />
            </motion.div>
            <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-white/80">That's you!</p>
            <p className="font-display text-4xl font-black leading-tight text-white">{slide.title}</p>
            <p className="text-lg text-white/70">Stand up — the room is looking at you.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Tile({
  icon,
  label,
  color,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-soft flex flex-col gap-1 px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
        <span style={{ color }}>{icon}</span>
        {label}
      </span>
      <span className="font-display text-2xl font-extrabold text-white">{children}</span>
    </div>
  );
}


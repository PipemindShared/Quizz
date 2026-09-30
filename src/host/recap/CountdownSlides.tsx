import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Crown, Medal } from "lucide-react";
import type { RecapStanding } from "../../../convex/recap";
import TeamBadge from "../../components/TeamBadge";
import { cn, ordinal } from "../../lib/utils";
import { CountUp, Rays, SlideFrame, SlideHeading } from "./shared";
import { pop } from "./fx";

const MEDAL: Record<number, string> = { 1: "#ffc94d", 2: "#d7dbe6", 3: "#cd8a4d" };

const badge = (s: RecapStanding) => ({
  _id: s.team.teamId,
  name: s.team.name,
  color: s.team.color,
  iconId: s.team.iconId,
});

/**
 * Final standings revealed from last place upwards, one team per click. Stays
 * mounted across its steps (the parent keys every countdown step the same), so
 * each click only animates the newly revealed row.
 */
export function CountdownSlide({
  standings,
  revealed,
}: {
  standings: RecapStanding[];
  revealed: number;
}) {
  const reduce = useReducedMotion();
  const n = standings.length;
  // Ranks strictly greater than this are on screen.
  const threshold = n - revealed;
  const newest = standings[threshold];
  const lastPopped = useRef(-1);

  useEffect(() => {
    if (!newest || lastPopped.current === revealed) return;
    lastPopped.current = revealed;
    const t = setTimeout(() => pop(newest.team.color, { x: 0.5, y: 0.2 + (threshold / n) * 0.6 }), 350);
    return () => clearTimeout(t);
  }, [revealed, newest, threshold, n]);

  const remaining = threshold;
  const subtitle =
    remaining === 1
      ? "Only the champions are left…"
      : remaining === 2
        ? "Two teams left. Who takes silver?"
        : `${remaining} teams still to come`;

  return (
    <SlideFrame>
      <SlideHeading eyebrow="Act V" title="Final Standings" subtitle={subtitle} accent="#ffc94d" />
      <div className="relative z-10 mt-8 flex w-full max-w-4xl flex-col gap-2.5">
        {standings.map((s, i) => {
          const shown = i >= threshold;
          const isNewest = i === threshold;
          const medal = MEDAL[s.rank];
          return (
            <div key={s.team.teamId} className="relative h-[68px]">
              <AnimatePresence mode="popLayout" initial={false}>
                {shown ? (
                  <motion.div
                    key="team"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: 160, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 170, damping: 18 }}
                    className={cn(
                      "absolute inset-0 flex items-center gap-4 overflow-hidden rounded-2xl border px-5",
                      isNewest ? "border-white/30" : "border-white/10",
                    )}
                    style={{
                      background: `linear-gradient(90deg, ${s.team.color}${isNewest ? "55" : "2a"}, rgba(255,255,255,0.03) 70%)`,
                      boxShadow: isNewest ? `0 0 50px -10px ${s.team.color}` : undefined,
                    }}
                  >
                    {isNewest && !reduce ? (
                      <motion.div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 w-40 -skew-x-12 bg-white/25 blur-md"
                        initial={{ left: "-20%" }}
                        animate={{ left: "120%" }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeInOut" }}
                      />
                    ) : null}
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg font-black"
                      style={
                        medal
                          ? { color: medal, boxShadow: `0 0 0 2px ${medal}88 inset`, background: `${medal}22` }
                          : { color: "rgba(255,255,255,0.55)" }
                      }
                    >
                      {medal ? <Medal className="h-6 w-6" /> : ordinal(s.rank)}
                    </div>
                    <TeamBadge team={badge(s)} size="md" />
                    <div className="min-w-0 flex-1 truncate font-display text-2xl font-extrabold text-white">
                      {s.team.name}
                    </div>
                    <div className="shrink-0 text-sm font-bold uppercase tracking-[0.15em] text-white/40">
                      {ordinal(s.rank)}
                    </div>
                    <div className="w-32 shrink-0 text-right font-display text-3xl font-black text-white">
                      <CountUp value={s.total} delay={0.3} duration={1.2} />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="hidden"
                    exit={{ opacity: 0, scale: 0.95, filter: "blur(6px)" }}
                    transition={{ duration: 0.25 }}
                    className="glass-soft absolute inset-0 flex items-center gap-4 px-5"
                  >
                    <div className="grid h-11 w-11 place-items-center rounded-full font-display text-lg font-black text-white/30">
                      {s.rank === 1 ? <Crown className="h-6 w-6 text-sun/60" /> : ordinal(s.rank)}
                    </div>
                    <div className="animate-shimmer h-9 w-9 rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.14),rgba(255,255,255,0.04))] bg-[length:200%_100%]" />
                    <div className="animate-shimmer h-5 w-64 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.14),rgba(255,255,255,0.04))] bg-[length:200%_100%]" />
                    <div className="ml-auto font-display text-3xl font-black text-white/20">?</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </SlideFrame>
  );
}

/** The last breath before the champion: everything else revealed, one card left. */
export function DrumrollSlide({ standings }: { standings: RecapStanding[] }) {
  const reduce = useReducedMotion();
  const runnerUp = standings[1];
  return (
    <SlideFrame className="bg-black/30">
      <Rays color="#ffc94d" size={1600} speed={14} opacity={0.5} />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sun/25 blur-[140px]"
        animate={reduce ? undefined : { scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, letterSpacing: "0em" }}
        animate={{ opacity: 1, letterSpacing: "0.4em" }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 font-display text-[clamp(1rem,1.6vw,1.4rem)] font-bold uppercase text-sun"
      >
        And the champions are
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={
          reduce
            ? { opacity: 1, scale: 1 }
            : { opacity: 1, scale: [1, 1.06, 1], rotate: [0, -1.5, 1.5, -1, 0] }
        }
        transition={{
          opacity: { duration: 0.6, delay: 0.4 },
          scale: { duration: 0.55, repeat: Infinity, delay: 0.4 },
          rotate: { duration: 0.35, repeat: Infinity, delay: 0.4 },
        }}
        className="relative z-10 mt-8 grid h-[clamp(14rem,26vw,22rem)] w-[clamp(14rem,26vw,22rem)] place-items-center rounded-[3rem]"
        style={{
          background: "radial-gradient(circle at 35% 30%, #ffe08a, #ffc94d 40%, #b8860b 100%)",
          boxShadow: "0 0 0 6px #ffc94d55, 0 0 120px 20px #ffc94d88",
        }}
      >
        <Crown className="absolute -top-16 h-24 w-24 text-sun drop-shadow-[0_0_30px_rgba(255,201,77,1)]" strokeWidth={1.8} />
        <span className="font-display text-[clamp(8rem,16vw,14rem)] font-black leading-none text-ink/80">?</span>
      </motion.div>

      {runnerUp ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="relative z-10 mt-10 text-[clamp(1rem,1.5vw,1.3rem)] font-semibold text-white/55"
        >
          Beating {runnerUp.team.name}'s {runnerUp.total.toLocaleString("en-US")} points…
        </motion.div>
      ) : null}
    </SlideFrame>
  );
}

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Crown,
  Flame,
  Laugh,
  Lightbulb,
  Medal,
  ShieldCheck,
  Target,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { AwardId, AwardWinner, RecapSlide, TeamAwardId } from "../../../convex/recap";
import TeamBadge from "../../components/TeamBadge";
import { ordinal, readableOn } from "../../lib/utils";
import { CountUp, Medallion, Rays, SlideFrame, SlideHeading, Suspense } from "./shared";
import { fanfare, formatValue, pop, useAfter, useRevealed } from "./fx";

const AWARD_LOOK: Record<AwardId, { color: string; Icon: typeof Crown }> = {
  mvp: { color: "#ffc94d", Icon: Crown },
  quickest: { color: "#4dd0ff", Icon: Zap },
  sharpshooter: { color: "#3ddc97", Icon: Target },
  hardmode: { color: "#ff5470", Icon: Flame },
  buzzer: { color: "#ff8a4d", Icon: Timer },
  lone: { color: "#b388ff", Icon: Lightbulb },
  fastwrong: { color: "#ff4de0", Icon: Laugh },
};

const TEAM_AWARD_ICON: Record<TeamAwardId, typeof Crown> = {
  bestQuiz: Trophy,
  quizWins: Medal,
  consistent: Activity,
  turnout: Users,
};

/** How long the room waits before the winner appears. */
const SUSPENSE_MS = 1700;

const badge = (w: { team: AwardWinner["team"] }) => ({
  _id: w.team.teamId,
  name: w.team.name,
  color: w.team.color,
  iconId: w.team.iconId,
});

/* ------------------------------------------------------------------ */
/* Individual award                                                      */
/* ------------------------------------------------------------------ */

function WinnerName({ name, color, delay, wobble }: { name: string; color: string; delay: number; wobble: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex flex-wrap justify-center font-display text-[clamp(3rem,7.5vw,7rem)] font-black leading-[1.02] tracking-tight text-white"
      style={{ textShadow: `0 0 40px ${color}, 0 0 90px ${color}88` }}
      animate={wobble && !reduce ? { rotate: [0, -3, 3, -2, 0] } : undefined}
      transition={wobble ? { delay: delay + 1, duration: 0.8, repeat: Infinity, repeatDelay: 1.4 } : undefined}
    >
      {[...name].map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block whitespace-pre"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60, scale: 0.5, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: delay + i * 0.035 }}
        >
          {ch}
        </motion.span>
      ))}
    </motion.div>
  );
}

function StatPill({
  value,
  format,
  unit,
  color,
  delay,
}: {
  value: number;
  format: Extract<RecapSlide, { kind: "award" }>["format"];
  unit: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 15, delay }}
      className="flex items-baseline gap-2 rounded-full px-6 py-2.5"
      style={{ background: `${color}22`, boxShadow: `0 0 0 1.5px ${color}66 inset` }}
    >
      <span className="font-display text-[clamp(1.6rem,2.6vw,2.4rem)] font-black" style={{ color }}>
        <CountUp value={value} delay={delay} format={(n) => formatValue(n, format)} />
      </span>
      <span className="text-[clamp(0.9rem,1.3vw,1.15rem)] font-semibold text-white/60">{unit}</span>
    </motion.div>
  );
}

function SoloWinner({
  w,
  slide,
  accent,
}: {
  w: AwardWinner;
  slide: Extract<RecapSlide, { kind: "award" }>;
  accent: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0, rotate: -180 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
      >
        <TeamBadge team={badge(w)} size="xl" />
      </motion.div>
      <WinnerName name={w.name} color={w.team.color} delay={0.25} wobble={slide.id === "fastwrong"} />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="rounded-full px-4 py-1 font-display text-lg font-bold"
        style={{ background: w.team.color, color: readableOn(w.team.color) }}
      >
        {w.team.name}
      </motion.div>
      <StatPill value={w.value} format={slide.format} unit={slide.unit} color={accent} delay={0.8} />
      {w.detail ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="max-w-3xl text-balance text-center text-[clamp(1rem,1.5vw,1.3rem)] italic text-white/50"
        >
          “{w.detail}”
        </motion.div>
      ) : null}
    </div>
  );
}

function SharedWinners({
  winners,
  slide,
  accent,
}: {
  winners: AwardWinner[];
  slide: Extract<RecapSlide, { kind: "award" }>;
  accent: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        initial={{ opacity: 0, scale: 1.6 }}
        animate={{ opacity: 1, scale: 1 }}
        className="font-display text-sm font-extrabold uppercase tracking-[0.3em]"
        style={{ color: accent }}
      >
        It's a tie!
      </motion.div>
      <div className="flex flex-wrap justify-center gap-6">
        {winners.map((w, i) => (
          <motion.div
            key={w.key}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60, rotate: i % 2 ? 8 : -8 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 15, delay: i * 0.2 }}
            className="glass flex w-[300px] flex-col items-center gap-3 px-6 py-7"
            style={{ boxShadow: `0 0 0 1.5px ${w.team.color}66 inset, 0 30px 70px -30px ${w.team.color}` }}
          >
            <TeamBadge team={badge(w)} size="lg" />
            <div
              className="text-center font-display text-4xl font-black leading-tight text-white"
              style={{ textShadow: `0 0 30px ${w.team.color}` }}
            >
              {w.name}
            </div>
            <div className="text-sm font-bold text-white/55">{w.team.name}</div>
          </motion.div>
        ))}
      </div>
      <StatPill value={winners[0]!.value} format={slide.format} unit={slide.unit} color={accent} delay={0.6} />
    </div>
  );
}

function RunnersUp({
  rows,
  slide,
  after,
}: {
  rows: AwardWinner[];
  slide: Extract<RecapSlide, { kind: "award" }>;
  /** how many places the winners took */
  after: number;
}) {
  if (rows.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.6, duration: 0.6 }}
      className="mt-8 flex items-center gap-3"
    >
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">Hot on their heels</span>
      {rows.map((r, i) => (
        <span key={r.key} className="glass-soft flex items-center gap-2 px-4 py-2">
          <span className="font-display text-sm font-bold text-white/40">{ordinal(after + i + 1)}</span>
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: r.team.color }} />
          <span className="font-display font-semibold text-white/85">{r.name}</span>
          <span className="font-display font-bold tabular-nums text-white/50">
            {formatValue(r.value, slide.format)}
          </span>
        </span>
      ))}
    </motion.div>
  );
}

export function AwardSlide({
  slide,
  index,
  total,
}: {
  slide: Extract<RecapSlide, { kind: "award" }>;
  index: number;
  total: number;
}) {
  const { color, Icon } = AWARD_LOOK[slide.id];
  const revealed = useRevealed(SUSPENSE_MS);
  const lead = slide.winners[0]!;
  useAfter(SUSPENSE_MS + 150, () => fanfare(lead.team.color));

  return (
    <SlideFrame>
      <Rays color={revealed ? lead.team.color : color} size={1300} speed={revealed ? 40 : 70} opacity={0.4} />
      <div className="relative z-10 flex flex-col items-center">
        <Medallion icon={<Icon className="h-14 w-14" strokeWidth={2} />} color={color} size={124} />
        <div className="mt-6">
          <SlideHeading
            eyebrow={`Award ${index} of ${total}`}
            title={slide.title}
            subtitle={slide.blurb}
            accent={color}
            delay={0.2}
          />
        </div>

        <div className="mt-10 flex min-h-[380px] w-full flex-col items-center justify-start">
          <AnimatePresence mode="wait">
            {!revealed ? (
              <Suspense key="wait" label="And the award goes to" color={color} />
            ) : (
              <motion.div
                key="winner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                {slide.winners.length === 1 ? (
                  <SoloWinner w={lead} slide={slide} accent={color} />
                ) : (
                  <SharedWinners winners={slide.winners} slide={slide} accent={color} />
                )}
                <RunnersUp rows={slide.runnersUp} slide={slide} after={slide.winners.length} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </SlideFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Team awards: face-down cards flipping over one by one                 */
/* ------------------------------------------------------------------ */

const FLIP_START_S = 1.3;
const FLIP_EVERY_S = 1.15;

export function TeamAwardsSlide({ slide }: { slide: Extract<RecapSlide, { kind: "teamAwards" }> }) {
  const reduce = useReducedMotion();
  const n = slide.awards.length;

  return (
    <SlideFrame>
      <SlideHeading eyebrow="Act II" title="Team Awards" subtitle={`${n} ${n === 1 ? "trophy" : "trophies"} before the big one`} accent="#ff4d8d" />
      <div className="relative z-10 mt-12 flex flex-wrap justify-center gap-6">
        {slide.awards.map((award, i) => {
          const Icon = TEAM_AWARD_ICON[award.id];
          const flipAt = FLIP_START_S + i * FLIP_EVERY_S;
          return (
            <FlipCard
              key={award.id}
              index={i}
              flipAt={flipAt}
              onFlip={() => pop(award.team.color, { x: (i + 0.5) / n, y: 0.55 })}
              reduce={!!reduce}
              back={
                <div className="glass flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-center">
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-white/5 ring-1 ring-white/15">
                    <Icon className="h-10 w-10 text-white/70" />
                  </div>
                  <div className="font-display text-2xl font-extrabold text-white">{award.title}</div>
                  <div className="text-sm text-white/50">{award.blurb}</div>
                  <div className="animate-shimmer mt-2 h-10 w-24 rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.18),rgba(255,255,255,0.04))] bg-[length:200%_100%]" />
                </div>
              }
              front={
                <div
                  className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border px-6 text-center"
                  style={{
                    borderColor: `${award.team.color}88`,
                    background: `linear-gradient(170deg, ${award.team.color}55, ${award.team.color}11 55%, rgba(8,6,26,0.9))`,
                    boxShadow: `0 30px 80px -30px ${award.team.color}`,
                  }}
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                    <Icon className="h-4 w-4" /> {award.title}
                  </div>
                  <TeamBadge team={badge(award)} size="lg" />
                  <div className="font-display text-3xl font-black leading-tight text-white">{award.team.name}</div>
                  <div className="font-display text-4xl font-black text-sun">
                    <CountUp value={award.value} delay={reduce ? 0 : flipAt + 0.3} format={(v) => formatValue(v, award.format)} />
                  </div>
                  <div className="text-sm font-semibold text-white/60">{award.unit}</div>
                  {award.detail ? <div className="text-sm italic text-white/45">{award.detail}</div> : null}
                </div>
              }
            />
          );
        })}
      </div>
    </SlideFrame>
  );
}

function FlipCard({
  index,
  flipAt,
  onFlip,
  reduce,
  back,
  front,
}: {
  index: number;
  flipAt: number;
  onFlip: () => void;
  reduce: boolean;
  back: React.ReactNode;
  front: React.ReactNode;
}) {
  useAfter(reduce ? 0 : (flipAt + 0.35) * 1000, onFlip);
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 80 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 18, delay: 0.4 + index * 0.12 }}
      style={{ perspective: 1400 }}
    >
      <motion.div
        className="relative h-[390px] w-[290px] [transform-style:preserve-3d]"
        initial={{ rotateY: reduce ? 0 : 180 }}
        animate={{ rotateY: 0, scale: reduce ? 1 : [1, 1.08, 1] }}
        transition={{
          rotateY: { type: "spring", stiffness: 90, damping: 14, delay: flipAt },
          scale: { duration: 0.7, delay: flipAt },
        }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">{front}</div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">{back}</div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Iron players                                                          */
/* ------------------------------------------------------------------ */

const IRON_SHOWN = 36;

export function IronSlide({
  slide,
  index,
  total,
}: {
  slide: Extract<RecapSlide, { kind: "iron" }>;
  index: number;
  total: number;
}) {
  const reduce = useReducedMotion();
  const shown = slide.players.slice(0, IRON_SHOWN);
  const extra = slide.players.length - shown.length;
  useAfter(900, () => pop("#4dd0ff", { x: 0.5, y: 0.3 }));

  return (
    <SlideFrame>
      <Rays color="#4dd0ff" size={1200} speed={80} opacity={0.3} />
      <div className="relative z-10 flex flex-col items-center">
        <Medallion icon={<ShieldCheck className="h-14 w-14" />} color="#4dd0ff" size={124} />
        <div className="mt-6">
          <SlideHeading
            eyebrow={`Award ${index} of ${total}`}
            title="Iron Players"
            subtitle={`Never missed a single one of the ${slide.quizCount} quizzes`}
            accent="#4dd0ff"
            delay={0.2}
          />
        </div>
        <div className="mt-10 flex max-w-6xl flex-wrap justify-center gap-3">
          {shown.map((p, i) => (
            <motion.div
              key={p.key}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -40, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.9 + i * 0.05 }}
              className="flex items-center gap-2.5 rounded-full py-2 pl-2 pr-5"
              style={{ background: `${p.team.color}26`, boxShadow: `0 0 0 1.5px ${p.team.color}66 inset` }}
            >
              <TeamBadge team={badge(p)} size="sm" ring={false} />
              <span className="font-display text-xl font-bold text-white">{p.name}</span>
            </motion.div>
          ))}
          {extra > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 + shown.length * 0.05 }}
              className="glass-soft flex items-center px-5 py-2 font-display text-xl font-bold text-white/60"
            >
              +{extra} more
            </motion.div>
          ) : null}
        </div>
      </div>
    </SlideFrame>
  );
}

import { motion, useReducedMotion } from "framer-motion";
import { Clock, HelpCircle, Layers, MessageSquare, Trophy, Users, Zap } from "lucide-react";
import type { RecapSlide } from "../../../convex/recap";
import TeamBadge from "../../components/TeamBadge";
import { rain } from "../../lib/celebrate";
import { CountUp, Rays, SlideFrame, SlideHeading } from "./shared";
import { formatDuration, useAfter } from "./fx";

/* ------------------------------------------------------------------ */
/* Intro                                                                 */
/* ------------------------------------------------------------------ */

export function IntroSlide({ slide }: { slide: Extract<RecapSlide, { kind: "intro" }> }) {
  const reduce = useReducedMotion();
  useAfter(900, () => rain());
  const words = ["Awards", "Night"];

  return (
    <SlideFrame>
      <Rays color="#ffc94d" size={1400} speed={90} opacity={0.35} />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon/30 blur-[140px]"
      />

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -60, scale: 0.4 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 12, delay: 0.1 }}
        className="relative z-10 mb-8"
      >
        <div className="animate-float">
          <Trophy
            className="h-[clamp(5rem,10vw,9rem)] w-[clamp(5rem,10vw,9rem)] text-sun drop-shadow-[0_0_40px_rgba(255,201,77,0.8)]"
            strokeWidth={1.5}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, letterSpacing: "0.1em" }}
        animate={{ opacity: 1, letterSpacing: "0.45em" }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        className="relative z-10 font-display text-[clamp(0.9rem,1.4vw,1.25rem)] font-bold uppercase text-sun"
      >
        Tournament Finale
      </motion.div>

      <h1 className="relative z-10 mt-4 flex flex-wrap justify-center gap-x-[0.3em] font-display text-[clamp(4rem,11vw,10rem)] font-black leading-none tracking-tight">
        {words.map((word, w) => (
          <span key={word} className="flex">
            {[...word].map((ch, i) => (
              <motion.span
                key={i}
                className="grad-text inline-block"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -120, rotate: -25, scale: 1.6 }}
                animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 14,
                  delay: 0.55 + (w * word.length + i) * 0.06,
                }}
              >
                {ch}
              </motion.span>
            ))}
          </span>
        ))}
      </h1>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.5 }}
        className="relative z-10 mt-6 text-balance text-center font-display text-[clamp(1.4rem,2.6vw,2.4rem)] font-bold text-white/85"
      >
        {slide.tournamentName}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 1.9 }}
        className="relative z-10 mt-6 flex items-center gap-3 text-[clamp(0.9rem,1.3vw,1.15rem)] font-semibold text-white/50"
      >
        <span className="glass-soft px-4 py-1.5">
          {slide.quizCount} {slide.quizCount === 1 ? "quiz" : "quizzes"}
        </span>
        <span className="glass-soft px-4 py-1.5">{slide.teamCount} teams</span>
        <span className="glass-soft px-4 py-1.5">1 champion</span>
      </motion.div>
    </SlideFrame>
  );
}

/* ------------------------------------------------------------------ */
/* The tournament in numbers                                             */
/* ------------------------------------------------------------------ */

function StatTile({
  icon,
  label,
  color,
  index,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  index: number;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 50, scale: 0.8, rotateX: 40 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.5 + index * 0.14 }}
      className="glass relative flex flex-col items-center justify-center gap-2 overflow-hidden px-6 py-7 text-center"
      style={{ boxShadow: `0 0 0 1px ${color}33 inset, 0 30px 60px -30px ${color}88` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 h-32 w-40 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: color }}
      />
      <div className="relative" style={{ color }}>
        {icon}
      </div>
      <div className="relative font-display text-[clamp(2.4rem,4.4vw,4.2rem)] font-black leading-none text-white">
        {children}
      </div>
      <div className="relative text-xs font-bold uppercase tracking-[0.2em] text-white/50">
        {label}
      </div>
    </motion.div>
  );
}

function AccuracyRing({ value, delay }: { value: number; delay: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#3ddc97"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.6, delay, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: "drop-shadow(0 0 8px #3ddc97)" }}
        />
      </svg>
      <div className="absolute font-display text-3xl font-black">
        <CountUp value={value} delay={delay} format={(n) => `${Math.round(n)}%`} />
      </div>
    </div>
  );
}

export function NumbersSlide({ slide }: { slide: Extract<RecapSlide, { kind: "numbers" }> }) {
  const reduce = useReducedMotion();
  const icon = "h-7 w-7";
  const d = (i: number) => 0.6 + i * 0.14;

  return (
    <SlideFrame>
      <SlideHeading eyebrow="Act I" title="The Tournament in Numbers" accent="#4dd0ff" />

      <div className="relative z-10 mt-10 grid w-full max-w-6xl grid-cols-3 gap-5 [perspective:1200px]">
        <StatTile icon={<Layers className={icon} />} label="Quizzes played" color="#7c5cff" index={0}>
          <CountUp value={slide.quizzes} delay={d(0)} />
        </StatTile>
        <StatTile icon={<HelpCircle className={icon} />} label="Questions asked" color="#ff4d8d" index={1}>
          <CountUp value={slide.questions} delay={d(1)} />
        </StatTile>
        <StatTile icon={<MessageSquare className={icon} />} label="Answers submitted" color="#ffc94d" index={2}>
          <CountUp value={slide.answers} delay={d(2)} duration={2} />
        </StatTile>
        <StatTile icon={<Users className={icon} />} label="Players" color="#4dd0ff" index={3}>
          <CountUp value={slide.players} delay={d(3)} />
        </StatTile>
        <StatTile icon={null} label="Answered correctly" color="#3ddc97" index={4}>
          <AccuracyRing value={slide.accuracy} delay={d(4)} />
        </StatTile>
        <StatTile icon={<Clock className={icon} />} label="Spent thinking" color="#ff8a4d" index={5}>
          <CountUp value={slide.thinkingMs} delay={d(5)} duration={2} format={formatDuration} />
        </StatTile>
      </div>

      {slide.fastestCorrect ? (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 16, delay: 2.4 }}
          className="glass relative z-10 mt-6 flex max-w-6xl items-center gap-5 px-6 py-4"
          style={{ boxShadow: `0 0 0 1px ${slide.fastestCorrect.team.color}55 inset` }}
        >
          <Zap className="h-8 w-8 shrink-0 text-sun" />
          <TeamBadge
            team={{
              _id: slide.fastestCorrect.team.teamId,
              name: slide.fastestCorrect.team.name,
              color: slide.fastestCorrect.team.color,
              iconId: slide.fastestCorrect.team.iconId,
            }}
            size="md"
          />
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
              Fastest correct answer of the tournament
            </div>
            <div className="truncate font-display text-2xl font-bold text-white">
              {slide.fastestCorrect.name}{" "}
              <span className="text-white/45">· {slide.fastestCorrect.team.name}</span>
            </div>
          </div>
          <div className="ml-4 shrink-0 font-display text-4xl font-black text-sun">
            {(slide.fastestCorrect.ms / 1000).toFixed(2)}s
          </div>
        </motion.div>
      ) : null}
    </SlideFrame>
  );
}

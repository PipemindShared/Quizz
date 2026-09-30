import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";

export { default as CountUp } from "../../components/CountUp";

/* ------------------------------------------------------------------ */
/* Decoration                                                            */
/* ------------------------------------------------------------------ */

/** Slowly turning spotlight rays, fading out from the centre. */
export function Rays({
  color,
  size = 900,
  speed = 60,
  opacity = 0.5,
  className,
}: {
  color: string;
  size?: number;
  speed?: number;
  opacity?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute left-1/2 top-1/2 rounded-full", className)}
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        opacity,
        background: `repeating-conic-gradient(from 0deg, ${color}55 0deg 7deg, transparent 7deg 18deg)`,
        maskImage: "radial-gradient(circle, black 0%, transparent 68%)",
        WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 68%)",
      }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={reduce ? { scale: 1, opacity } : { scale: 1, opacity, rotate: 360 }}
      transition={{
        scale: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 1.2 },
        rotate: { duration: speed, repeat: Infinity, ease: "linear" },
      }}
    />
  );
}

/** Round glowing badge holding an award's icon. */
export function Medallion({
  icon,
  color,
  size = 120,
  delay = 0,
}: {
  icon: React.ReactNode;
  color: string;
  size?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3, rotate: -40 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 13, delay }}
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${color}, ${color}55 55%, ${color}22 100%)`,
        boxShadow: `0 0 0 3px ${color}66, 0 0 0 10px ${color}14, 0 20px 70px -10px ${color}`,
      }}
    >
      {!reduce && (
        <span
          aria-hidden
          className="animate-pulse-ring absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 0 3px ${color}` }}
        />
      )}
      <div className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">{icon}</div>
    </motion.div>
  );
}

/** Eyebrow + big title, entering in sequence. */
export function SlideHeading({
  eyebrow,
  title,
  subtitle,
  accent = "#ffc94d",
  delay = 0,
  size = "lg",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accent?: string;
  delay?: number;
  size?: "lg" | "xl";
}) {
  const reduce = useReducedMotion();
  const rise = (d: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 24, filter: "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const, delay: delay + d },
  });
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      {eyebrow ? (
        <motion.div
          {...rise(0)}
          className="font-display text-sm font-bold uppercase tracking-[0.35em]"
          style={{ color: accent }}
        >
          {eyebrow}
        </motion.div>
      ) : null}
      <motion.h1
        {...rise(0.1)}
        className={cn(
          "mt-3 text-balance font-display font-black leading-[1.02] tracking-tight text-white",
          size === "xl"
            ? "text-[clamp(3rem,7vw,6.5rem)]"
            : "text-[clamp(2.4rem,5vw,4.5rem)]",
        )}
      >
        {title}
      </motion.h1>
      {subtitle ? (
        <motion.p
          {...rise(0.22)}
          className="mt-3 max-w-3xl text-balance text-[clamp(1rem,1.6vw,1.4rem)] font-medium text-white/55"
        >
          {subtitle}
        </motion.p>
      ) : null}
    </div>
  );
}

/** Three dots bouncing in turn — "wait for it". */
export function Suspense({ label, color = "#ffffff" }: { label: string; color?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(6px)" }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-5"
    >
      <div className="font-display text-[clamp(1.3rem,2.2vw,2rem)] font-semibold italic text-white/60">
        {label}
      </div>
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 18px ${color}` }}
            animate={reduce ? undefined : { y: [0, -16, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/** Standard slide frame: fills the screen and leaves room for the control bar. */
export function SlideFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-8 pb-[110px] pt-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

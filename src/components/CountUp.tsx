import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { cn, formatScore } from "../lib/utils";

/**
 * A number that rolls up from zero on mount, with a soft ease-out, and rolls
 * from its old value to the new one if the value later changes.
 */
export default function CountUp({
  value,
  format = (n) => formatScore(n),
  duration = 1.4,
  delay = 0,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  const timing = useRef({ duration, delay });
  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: timing.current.duration,
      delay: timing.current.delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
      // Later changes roll straight over from wherever the number is now.
      onComplete: () => {
        timing.current = { duration: 0.8, delay: 0 };
      },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={cn("tabular-nums", className)}>{format(shown)}</span>;
}

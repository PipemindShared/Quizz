import { useEffect, useState } from "react";

/**
 * Animation-frame countdown against a server timestamp.
 * `endsAt`/`startedAt` are ms-epoch values from the games table, so every screen
 * (host + every phone) counts down against the same clock.
 */
export function useCountdown(
  startedAt: number | undefined,
  endsAt: number | undefined,
) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [endsAt]);

  if (!endsAt || !startedAt) {
    return { remainingMs: 0, secondsLeft: 0, ratio: 0, expired: false };
  }

  const total = Math.max(1, endsAt - startedAt);
  const remainingMs = Math.max(0, endsAt - now);

  return {
    remainingMs,
    /** whole seconds shown on the clock — never below 0 */
    secondsLeft: Math.ceil(remainingMs / 1000),
    /** 1 at the start, 0 when time is up — drive progress bars with this */
    ratio: Math.max(0, Math.min(1, remainingMs / total)),
    expired: remainingMs <= 0,
  };
}

import { useEffect, useRef, useState } from "react";

/**
 * Animation-frame countdown against the server's clock.
 *
 * `startedAt`/`endsAt` are ms-epoch values stamped by the server, so comparing
 * them to a device's own `Date.now()` is only correct if that device's clock
 * agrees with the server's. It often doesn't, and the failure is brutal: a phone
 * running far enough ahead computes `endsAt - now <= 0` the moment a question
 * opens, so the player is shown "time's up" and locked out of a question
 * everyone else can answer.
 *
 * `serverNow` (sent alongside the game state) fixes that: the difference
 * between it and the local clock is the device's skew, which is then subtracted
 * out. The result is also clamped to the question's real duration, so a stale
 * skew estimate can't hand anyone extra time.
 */
export function useCountdown(
  startedAt: number | undefined,
  endsAt: number | undefined,
  serverNow?: number,
) {
  const [now, setNow] = useState(() => Date.now());
  const skewRef = useRef(0);

  // Re-measured every time the server reports its clock; the local read happens
  // as close to receiving it as React allows, so the error is one render plus
  // network latency rather than the device's full clock drift.
  useEffect(() => {
    if (serverNow === undefined) return;
    skewRef.current = serverNow - Date.now();
  }, [serverNow]);

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

  // Both stamps come from the server, so the duration is skew-free even when
  // the device's clock is not.
  const total = Math.max(1, endsAt - startedAt);
  const remainingMs = Math.min(total, Math.max(0, endsAt - (now + skewRef.current)));

  return {
    remainingMs,
    /** whole seconds shown on the clock — never below 0 */
    secondsLeft: Math.ceil(remainingMs / 1000),
    /** 1 at the start, 0 when time is up — drive progress bars with this */
    ratio: Math.max(0, Math.min(1, remainingMs / total)),
    expired: remainingMs <= 0,
  };
}

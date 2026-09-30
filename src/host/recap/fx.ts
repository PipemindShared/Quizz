import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import type { AwardFormat } from "../../../convex/recap";
import { formatScore } from "../../lib/utils";

/* ------------------------------------------------------------------ */
/* Effects                                                               */
/* ------------------------------------------------------------------ */

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A tight pop of confetti from one point, in a team's colours. */
export function pop(color: string, origin: { x: number; y: number } = { x: 0.5, y: 0.45 }) {
  if (reduced()) return;
  void confetti({
    particleCount: 70,
    spread: 75,
    startVelocity: 38,
    scalar: 0.95,
    origin,
    colors: [color, "#ffffff", "#ffc94d"],
    disableForReducedMotion: true,
  });
}

/** A big celebratory double burst — the winner of an award. */
export function fanfare(color: string) {
  if (reduced()) return;
  const colors = [color, "#ffc94d", "#ffffff"];
  void confetti({ particleCount: 110, spread: 100, startVelocity: 50, origin: { x: 0.5, y: 0.55 }, colors, disableForReducedMotion: true });
  setTimeout(() => {
    void confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors, disableForReducedMotion: true });
    void confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors, disableForReducedMotion: true });
  }, 220);
}

/** Runs `fn` once, `delayMs` after mount. */
export function useAfter(delayMs: number, fn: () => void) {
  useEffect(() => {
    const t = setTimeout(fn, delayMs);
    return () => clearTimeout(t);
    // Deliberately once per mount: every slide remounts when shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** False until `delayMs` after mount — the "and the award goes to…" pause. */
export function useRevealed(delayMs: number): boolean {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(!!reduce);
  useAfter(reduce ? 0 : delayMs, () => setShown(true));
  return shown;
}

/* ------------------------------------------------------------------ */
/* Numbers                                                               */
/* ------------------------------------------------------------------ */

export function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatValue(value: number, format: AwardFormat): string {
  switch (format) {
    case "percent":
      return `${Math.round(value)}%`;
    case "seconds":
      return `${(value / 1000).toFixed(1)}s`;
    case "count":
      return Math.round(value).toLocaleString("en-US");
    default:
      return formatScore(value);
  }
}

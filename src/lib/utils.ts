import clsx, { type ClassValue } from "clsx";

export const cn = (...parts: ClassValue[]) => clsx(parts);

/** Loose comparison used for free-text answers: accent and punctuation insensitive, case insensitive unless `caseSensitive`. */
export function normalizeAnswer(input: string, caseSensitive = false): string {
  const cased = caseSensitive ? input : input.toLowerCase();
  return cased
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(caseSensitive ? /[^a-zA-Z0-9\s]/g : /[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

/** Black or white, whichever stays legible on the given hex background. */
export function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  // Relative luminance
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.6 ? "#0b0820" : "#ffffff";
}

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Default team colours offered in the builder. */
export const TEAM_COLORS = [
  "#ff4d8d",
  "#7c5cff",
  "#4dd0ff",
  "#3ddc97",
  "#ffc94d",
  "#ff8a4d",
  "#ff5470",
  "#a0ff4d",
  "#4d6bff",
  "#ff4de0",
];

export const DIFFICULTY: Record<number, { label: string; color: string }> = {
  1: { label: "Easy", color: "#3ddc97" },
  2: { label: "Normal", color: "#ffc94d" },
  3: { label: "Hard", color: "#ff5470" },
};

export const ANSWER_KIND_LABEL: Record<string, string> = {
  text_input: "Type the answer",
  text_choice: "4 text choices",
  image_choice: "4 image choices",
  image_text_choice: "4 images with titles",
};

/** 1234 -> "1.2s" */
export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/**
 * Scores are whole numbers in the hundreds (points are scaled by 100 so the
 * speed bonus doesn't need decimals), so group the thousands to keep a
 * four-figure total readable across a room.
 */
export const formatScore = (n: number) => Math.round(n).toLocaleString("en-US");

/** Most a question can be worth: its difficulty at full speed. */
export const maxQuestionPoints = (difficulty: number) => difficulty * 100;

/**
 * Scoring, mirrored from the backend so test mode can preview real scores.
 * MUST stay identical to convex/lib.ts#speedFactor / #pointsForCorrectAnswer —
 * the client can't import from convex/, so this is a deliberate, tracked
 * duplicate (as with normalizeAnswer above).
 */
export const SPEED_GRACE_MS = 1500;

export function speedFactor(elapsedMs: number, timeLimitSec: number): number {
  const past = elapsedMs - SPEED_GRACE_MS;
  if (past <= 0) return 1;
  const window = timeLimitSec * 1000 - SPEED_GRACE_MS;
  if (window <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - past / window));
}

/**
 * Attendance bonus, mirrored from convex/lib.ts#presenceBonusPercent so the
 * builder can preview payouts and the lobby can label the goal.
 * MUST stay identical to the backend — another deliberate, tracked duplicate.
 */
export function presenceBonusAt(
  config: {
    mode: "percent" | "count";
    minAttendance: number;
    maxAttendance: number;
    maxBonusPercent: number;
  },
  playersJoined: number,
  rosterSize: number,
): number {
  const attendance =
    config.mode === "count"
      ? playersJoined
      : rosterSize > 0
        ? (playersJoined / rosterSize) * 100
        : 0;
  if (attendance < config.minAttendance) return 0;
  if (attendance >= config.maxAttendance) return config.maxBonusPercent;
  const span = config.maxAttendance - config.minAttendance;
  if (span <= 0) return config.maxBonusPercent;
  return (
    Math.round(
      ((config.maxBonusPercent * (attendance - config.minAttendance)) / span) * 10,
    ) / 10
  );
}

/** Half for being right, half for being quick. */
export function pointsForCorrect(
  difficulty: number,
  elapsedMs: number,
  timeLimitSec: number,
): number {
  const max = maxQuestionPoints(difficulty);
  return Math.round(max * (0.5 + 0.5 * speedFactor(elapsedMs, timeLimitSec)));
}

export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/** Ordinal suffix: 1 -> 1st */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

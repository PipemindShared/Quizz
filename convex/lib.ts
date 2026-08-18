/**
 * Shared backend helpers. These are plain TypeScript functions (not Convex
 * functions) used by the various convex/*.ts modules. Keeping them here avoids
 * duplicating grading, cascade-delete and phase-transition logic across files.
 */
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/* ------------------------------------------------------------------ */
/* Game codes                                                          */
/* ------------------------------------------------------------------ */

/** No ambiguous glyphs: excludes I, O, 0, 1. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Codes are recycled once a game finishes, so uniqueness is only enforced
 * among games that are still "live" (not finished). Retries a handful of
 * times before giving up — collisions are exceedingly unlikely (32^6 space).
 */
export async function generateUniqueGameCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const clashes = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code))
      .collect();
    if (!clashes.some((g) => g.status !== "finished")) return code;
  }
  throw new ConvexError("Could not generate a unique game code — please try again");
}

/* ------------------------------------------------------------------ */
/* Edit tokens                                                          */
/* ------------------------------------------------------------------ */

const TOKEN_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function makeToken(length = 28): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return out;
}

/** Long opaque secret used as a quiz's edit-link token. Collisions are practically impossible (62^28 space), but we still guard against them. */
export async function generateUniqueEditToken(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const token = makeToken();
    const clash = await ctx.db
      .query("quizzes")
      .withIndex("by_editToken", (q) => q.eq("editToken", token))
      .first();
    if (!clash) return token;
  }
  throw new ConvexError("Could not generate an edit link — please try again");
}

/* ------------------------------------------------------------------ */
/* Grading                                                              */
/* ------------------------------------------------------------------ */

/**
 * Case/accent/punctuation-insensitive normalisation for free-text answers.
 * MUST stay identical to src/lib/utils.ts#normalizeAnswer — the backend
 * can't import from src/, so this is a deliberate, tracked duplicate.
 */
export function normalizeAnswer(input: string, caseSensitive = false): string {
  const cased = caseSensitive ? input : input.toLowerCase();
  return cased
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(caseSensitive ? /[^a-zA-Z0-9\s]/g : /[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Points are scaled by 100, so a speed bonus stays a whole number: a question's
 * difficulty (1-3) becomes 100/200/300 at full speed.
 */
export const POINT_SCALE = 100;

/**
 * Answers within this window score full speed credit. Players need a moment to
 * read the question at all, and it stops phone/network latency from deciding
 * the round.
 */
export const SPEED_GRACE_MS = 1500;

/**
 * 1 for an instant answer, falling linearly to 0 as the timer runs out. The
 * grace window is subtracted from both sides so the ramp starts once reading
 * time is over.
 */
export function speedFactor(elapsedMs: number, timeLimitSec: number): number {
  const past = elapsedMs - SPEED_GRACE_MS;
  if (past <= 0) return 1;
  const window = timeLimitSec * 1000 - SPEED_GRACE_MS;
  if (window <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - past / window));
}

/**
 * Half the points are for being right, half for being quick — so a correct
 * answer is always worth at least 50% of the question's value.
 */
export function pointsForCorrectAnswer(
  question: Doc<"questions">,
  elapsedMs: number,
): number {
  const max = question.points * POINT_SCALE;
  return Math.round(max * (0.5 + 0.5 * speedFactor(elapsedMs, question.timeLimit)));
}

export function gradeAnswer(
  question: Doc<"questions">,
  submission: { choiceIndex?: number; text?: string },
  elapsedMs = 0,
): { correct: boolean; points: number } {
  let correct: boolean;
  if (question.answerKind === "text_input") {
    const caseSensitive = question.caseSensitive ?? false;
    const given = normalizeAnswer(submission.text ?? "", caseSensitive);
    const candidates = [question.correctText, ...(question.acceptedAnswers ?? [])]
      .filter((c): c is string => !!c && c.trim().length > 0)
      .map((c) => normalizeAnswer(c, caseSensitive));
    correct = given.length > 0 && candidates.includes(given);
  } else {
    correct =
      submission.choiceIndex !== undefined &&
      submission.choiceIndex === question.correctChoice;
  }
  return { correct, points: correct ? pointsForCorrectAnswer(question, elapsedMs) : 0 };
}

/**
 * Whether a player counts towards the question at `index`. Players who joined
 * mid-game sit out the question that was already open when they arrived, so
 * everyone answering a given question had the same time to do it.
 */
export function isEligibleForQuestion(player: Doc<"players">, index: number): boolean {
  return (player.joinedAtIndex ?? -1) < index;
}

/* ------------------------------------------------------------------ */
/* Presence bonus                                                       */
/* ------------------------------------------------------------------ */

export type PresenceBonusConfig = {
  mode: "percent" | "count";
  minAttendance: number;
  maxAttendance: number;
  maxBonusPercent: number;
};

/**
 * Discounts a team's excused members before the bonus is worked out, so nobody
 * is judged on people who were never expected.
 *
 * The two modes need different treatment, and getting it wrong makes the feature
 * silently useless in one of them:
 *  - percent: the roster is the denominator, so shrinking it is enough. The
 *    thresholds are proportions and stay as they are.
 *  - count: the thresholds are absolute headcounts, so they have to come down
 *    too, otherwise excusing somebody changes nothing at all. The minimum keeps
 *    a floor of 1 so a fully-excused team can't collect the bonus for nobody
 *    turning up.
 */
export function effectiveBonusTarget(
  config: PresenceBonusConfig,
  rosterSize: number,
  excusedCount: number,
): { config: PresenceBonusConfig; rosterSize: number } {
  const excused = Math.max(0, Math.min(excusedCount, rosterSize));
  const roster = Math.max(0, rosterSize - excused);
  if (excused === 0 || config.mode === "percent") {
    return { config, rosterSize: roster };
  }
  const minAttendance = Math.max(1, config.minAttendance - excused);
  return {
    config: {
      ...config,
      minAttendance,
      maxAttendance: Math.max(minAttendance, config.maxAttendance - excused),
    },
    rosterSize: roster,
  };
}

/**
 * A team's attendance in whichever unit the tournament is configured for: a
 * percentage of its roster, or a headcount. A roster of zero has no meaningful
 * percentage, so it reads as 0 rather than dividing by zero.
 */
export function attendanceValue(
  mode: "percent" | "count",
  playersJoined: number,
  rosterSize: number,
): number {
  if (mode === "count") return playersJoined;
  return rosterSize > 0 ? (playersJoined / rosterSize) * 100 : 0;
}

/**
 * How much bonus the current turnout has earned, in percent. Ramps linearly
 * from 0 at minAttendance to maxBonusPercent at maxAttendance. Rounded to one
 * decimal so the lobby's climbing number doesn't jitter.
 *
 * `excusedCount` is the number of roster members excused from this quiz who did
 * not turn up anyway.
 */
export function presenceBonusPercent(
  config: PresenceBonusConfig,
  playersJoined: number,
  rosterSize: number,
  excusedCount = 0,
): number {
  const eff = effectiveBonusTarget(config, rosterSize, excusedCount);
  const attendance = attendanceValue(eff.config.mode, playersJoined, eff.rosterSize);
  if (attendance < eff.config.minAttendance) return 0;
  if (attendance >= eff.config.maxAttendance) return eff.config.maxBonusPercent;
  const span = eff.config.maxAttendance - eff.config.minAttendance;
  // A zero-width band means the minimum is also the maximum: reaching it pays
  // in full rather than dividing by zero.
  if (span <= 0) return eff.config.maxBonusPercent;
  const earned =
    (eff.config.maxBonusPercent * (attendance - eff.config.minAttendance)) / span;
  return Math.round(earned * 10) / 10;
}

/** Applies a bonus percentage to a base score, rounded to a whole point. */
export function applyBonus(baseScore: number, bonusPercent: number): number {
  return Math.round(baseScore * (1 + bonusPercent / 100));
}

/**
 * How many more people need to join before the bonus starts, expressed in
 * players even when the target is a percentage — "5 more to start earning" is
 * something a room can act on, where "37 more" (percentage points) reads like a
 * headcount and is nonsense.
 */
export function playersNeededForBonus(
  config: PresenceBonusConfig,
  playersJoined: number,
  rosterSize: number,
  excusedCount = 0,
): number {
  const eff = effectiveBonusTarget(config, rosterSize, excusedCount);
  const needed =
    eff.config.mode === "count"
      ? eff.config.minAttendance
      : Math.ceil((eff.rosterSize * eff.config.minAttendance) / 100);
  return Math.max(0, Math.ceil(needed - playersJoined));
}

/* ------------------------------------------------------------------ */
/* Questions                                                            */
/* ------------------------------------------------------------------ */

export async function loadOrderedQuestions(
  ctx: QueryCtx | MutationCtx,
  quizId: Id<"quizzes">,
): Promise<Doc<"questions">[]> {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_quiz", (q) => q.eq("quizId", quizId))
    .collect();
  return questions.sort((a, b) => a.order - b.order);
}

/* ------------------------------------------------------------------ */
/* Scoring                                                              */
/* ------------------------------------------------------------------ */

/**
 * Team score for one played quiz, computed question by question: each question
 * contributes the average score of the team members who were present when it
 * opened. Summing those gives a total on the same scale as the quiz maximum,
 * whatever the team's size.
 *
 * Averaging per question rather than over whole-game totals is what makes
 * joining late fair: a player who missed the first two questions is simply
 * absent from those two denominators, instead of diluting the whole team with
 * unavoidable zeroes. A question no team member was present for contributes 0 —
 * those points genuinely weren't earned.
 */
export async function computeTeamScoreForGame(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<"games">,
  teamId: Id<"teams">,
): Promise<{
  score: number;
  playerCount: number;
  players: { name: string; points: number }[];
}> {
  const players = await ctx.db
    .query("players")
    .withIndex("by_game_team", (q) => q.eq("gameId", gameId).eq("teamId", teamId))
    .collect();
  if (players.length === 0) return { score: 0, playerCount: 0, players: [] };

  const game = await ctx.db.get(gameId);
  if (!game) return { score: 0, playerCount: players.length, players: [] };
  const questions = await loadOrderedQuestions(ctx, game.quizId);

  // points[playerId][questionId], plus each player's own running total for the
  // per-team breakdown the host screen shows.
  const byPlayer = new Map<Id<"players">, Map<Id<"questions">, number>>();
  const perPlayerTotal = new Map<Id<"players">, number>();
  for (const p of players) {
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_game_player", (q) => q.eq("gameId", gameId).eq("playerId", p._id))
      .collect();
    const map = new Map<Id<"questions">, number>();
    let total = 0;
    for (const a of answers) {
      map.set(a.questionId, a.points);
      total += a.points;
    }
    byPlayer.set(p._id, map);
    perPlayerTotal.set(p._id, total);
  }

  let score = 0;
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index]!;
    const eligible = players.filter((p) => isEligibleForQuestion(p, index));
    if (eligible.length === 0) continue;
    const sum = eligible.reduce(
      (acc, p) => acc + (byPlayer.get(p._id)?.get(question._id) ?? 0),
      0,
    );
    score += sum / eligible.length;
  }

  const perPlayer = players
    .map((p) => ({ name: p.name, points: perPlayerTotal.get(p._id) ?? 0 }))
    .sort((a, b) => b.points - a.points);

  return { score: Math.round(score), playerCount: players.length, players: perPlayer };
}

/** Map of teamId -> score for one specific game (used for the "roundScore" delta). */
export async function getGameResultsMap(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<"games">,
): Promise<Map<Id<"teams">, number>> {
  const results = await ctx.db
    .query("gameResults")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .collect();
  return new Map(results.map((r) => [r.teamId, r.score]));
}

/**
 * Championship standings: sum of gameResults.score per team across the
 * tournament, ranked descending (ties broken by name ascending for a
 * deterministic, simple order).
 */
export async function buildStandings(
  ctx: QueryCtx | MutationCtx,
  tournamentId: Id<"tournaments">,
  teams: Doc<"teams">[],
): Promise<{ team: Doc<"teams">; total: number; rank: number }[]> {
  const results = await ctx.db
    .query("gameResults")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const totals = new Map<Id<"teams">, number>();
  for (const r of results) {
    totals.set(r.teamId, (totals.get(r.teamId) ?? 0) + r.score);
  }
  const rows = teams.map((team) => ({
    team,
    total: Math.round(totals.get(team._id) ?? 0),
  }));
  rows.sort((a, b) => b.total - a.total || a.team.name.localeCompare(b.team.name));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Correct answer with the smallest elapsedMs for a question; null if nobody was correct. */
export async function bestPlayerForQuestion(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<"games">,
  questionId: Id<"questions">,
): Promise<{ player: Doc<"players">; team: Doc<"teams">; answer: Doc<"answers"> } | null> {
  const answers = await ctx.db
    .query("answers")
    .withIndex("by_game_question", (q) => q.eq("gameId", gameId).eq("questionId", questionId))
    .collect();
  const correctAnswers = answers.filter((a) => a.correct);
  if (correctAnswers.length === 0) return null;
  correctAnswers.sort((a, b) => a.elapsedMs - b.elapsedMs);
  const best = correctAnswers[0]!;
  const player = await ctx.db.get(best.playerId);
  if (!player) return null;
  const team = await ctx.db.get(player.teamId);
  if (!team) return null;
  return { player, team, answer: best };
}

/* ------------------------------------------------------------------ */
/* Phase transitions                                                    */
/* ------------------------------------------------------------------ */

/**
 * How long a question is protected from being forced shut after it opens.
 * Long enough to absorb a double activation, short enough that a host who
 * genuinely wants to move on immediately barely notices.
 */
export const MIN_QUESTION_OPEN_MS = 1200;

/**
 * Closes the current question (question -> reveal). Idempotent: a no-op if
 * the game isn't currently on `question`, or (when `expectedIndex` is given)
 * if the game has already moved past that question — this lets the
 * scheduled safety-net and racing client calls all land harmlessly.
 *
 * Without `force`, only closes once the timer has actually expired or every
 * joined player has answered.
 */
export async function closeQuestion(
  ctx: MutationCtx,
  gameId: Id<"games">,
  opts: { force?: boolean; expectedIndex?: number } = {},
): Promise<void> {
  const game = await ctx.db.get(gameId);
  if (!game || game.status !== "question") return;
  if (opts.expectedIndex !== undefined && game.currentIndex !== opts.expectedIndex) return;

  // A question that has only just opened cannot be forced shut. Two host
  // activations in quick succession — a held Space key repeating, a double-click
  // on Next, or two "advance" calls racing — otherwise advance *into* a question
  // and immediately close it, skipping it with nobody able to answer. This
  // happened in a live game: one question recorded zero answers while every
  // other drew 26-33 from the same 36 players.
  //
  // Only the forced path is guarded. Closing because everyone has answered must
  // stay instant, however fast that is.
  if (opts.force && game.questionStartedAt !== undefined) {
    if (Date.now() - game.questionStartedAt < MIN_QUESTION_OPEN_MS) return;
  }

  if (!opts.force) {
    const questions = await loadOrderedQuestions(ctx, game.quizId);
    const question = questions[game.currentIndex];
    if (!question) return;
    const timeUp = game.questionEndsAt !== undefined && Date.now() >= game.questionEndsAt;
    let allAnswered = false;
    if (!timeUp) {
      const players = await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", gameId))
        .collect();
      // Only players eligible for this question can answer it, so a late
      // joiner sitting out must not keep the question open forever.
      const answerable = players.filter((p) => isEligibleForQuestion(p, game.currentIndex));
      const answers = await ctx.db
        .query("answers")
        .withIndex("by_game_question", (q) => q.eq("gameId", gameId).eq("questionId", question._id))
        .collect();
      allAnswered = answerable.length > 0 && answers.length >= answerable.length;
    }
    if (!timeUp && !allAnswered) return;
  }

  await ctx.db.patch(gameId, { status: "reveal", phaseStartedAt: Date.now() });
}

/* ------------------------------------------------------------------ */
/* Cascading deletes (use indexed queries only, never a full table scan) */
/* ------------------------------------------------------------------ */

export async function deleteGameCascade(ctx: MutationCtx, gameId: Id<"games">): Promise<void> {
  const players = await ctx.db
    .query("players")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .collect();
  for (const p of players) await ctx.db.delete(p._id);

  // "by_game_player" is [gameId, playerId]; querying with just gameId still
  // uses the index and returns every answer for the game.
  const answers = await ctx.db
    .query("answers")
    .withIndex("by_game_player", (q) => q.eq("gameId", gameId))
    .collect();
  for (const a of answers) await ctx.db.delete(a._id);

  const results = await ctx.db
    .query("gameResults")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .collect();
  for (const r of results) await ctx.db.delete(r._id);

  await ctx.db.delete(gameId);
}

export async function deleteQuizCascade(ctx: MutationCtx, quizId: Id<"quizzes">): Promise<void> {
  // Excusals are scoped to the quiz, so they go with it.
  const excusals = await ctx.db
    .query("excusals")
    .withIndex("by_quiz", (q) => q.eq("quizId", quizId))
    .collect();
  for (const e of excusals) await ctx.db.delete(e._id);

  const questions = await ctx.db
    .query("questions")
    .withIndex("by_quiz", (q) => q.eq("quizId", quizId))
    .collect();
  for (const q of questions) await ctx.db.delete(q._id);

  const games = await ctx.db
    .query("games")
    .withIndex("by_quiz", (q) => q.eq("quizId", quizId))
    .collect();
  for (const g of games) await deleteGameCascade(ctx, g._id);

  await ctx.db.delete(quizId);
}

/** Removes a team plus every player/answer/gameResult row that belongs to it. */
export async function deleteTeamCascade(ctx: MutationCtx, team: Doc<"teams">): Promise<void> {
  const quizzes = await ctx.db
    .query("quizzes")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", team.tournamentId))
    .collect();
  for (const quiz of quizzes) {
    const games = await ctx.db
      .query("games")
      .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
      .collect();
    for (const game of games) {
      const players = await ctx.db
        .query("players")
        .withIndex("by_game_team", (q) => q.eq("gameId", game._id).eq("teamId", team._id))
        .collect();
      for (const p of players) {
        const answers = await ctx.db
          .query("answers")
          .withIndex("by_game_player", (q) => q.eq("gameId", game._id).eq("playerId", p._id))
          .collect();
        for (const a of answers) await ctx.db.delete(a._id);
        await ctx.db.delete(p._id);
      }
    }
  }

  const results = await ctx.db
    .query("gameResults")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", team.tournamentId))
    .collect();
  for (const r of results) {
    if (r.teamId === team._id) await ctx.db.delete(r._id);
  }

  // A deleted team's excusals would otherwise linger, pointing at a team that
  // no longer exists.
  for (const quiz of quizzes) {
    const excusals = await ctx.db
      .query("excusals")
      .withIndex("by_quiz_team", (q) => q.eq("quizId", quiz._id).eq("teamId", team._id))
      .collect();
    for (const e of excusals) await ctx.db.delete(e._id);
  }

  await ctx.db.delete(team._id);
}

export async function deleteTournamentCascade(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
): Promise<void> {
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  for (const team of teams) await deleteTeamCascade(ctx, team);

  const quizzes = await ctx.db
    .query("quizzes")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  for (const quiz of quizzes) await deleteQuizCascade(ctx, quiz._id);

  await ctx.db.delete(tournamentId);
}

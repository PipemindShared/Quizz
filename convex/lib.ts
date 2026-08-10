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
export function normalizeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export function gradeAnswer(
  question: Doc<"questions">,
  submission: { choiceIndex?: number; text?: string },
): { correct: boolean; points: number } {
  let correct: boolean;
  if (question.answerKind === "text_input") {
    const given = normalizeAnswer(submission.text ?? "");
    const candidates = [question.correctText, ...(question.acceptedAnswers ?? [])]
      .filter((c): c is string => !!c && c.trim().length > 0)
      .map(normalizeAnswer);
    correct = given.length > 0 && candidates.includes(given);
  } else {
    correct =
      submission.choiceIndex !== undefined &&
      submission.choiceIndex === question.correctChoice;
  }
  return { correct, points: correct ? question.points : 0 };
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
 * Team score for one played quiz = average of its players' summed points.
 * Players who joined but never answered still count (as 0) in the
 * denominator. A team with no players scores 0. Rounded to 2 decimals.
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

  const perPlayer = await Promise.all(
    players.map(async (p) => {
      const answers = await ctx.db
        .query("answers")
        .withIndex("by_game_player", (q) => q.eq("gameId", gameId).eq("playerId", p._id))
        .collect();
      const points = answers.reduce((sum, a) => sum + a.points, 0);
      return { name: p.name, points };
    }),
  );
  const total = perPlayer.reduce((sum, p) => sum + p.points, 0);
  const score = Math.round((total / players.length) * 100) / 100;
  return { score, playerCount: players.length, players: perPlayer.sort((a, b) => b.points - a.points) };
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
    total: Math.round((totals.get(team._id) ?? 0) * 100) / 100,
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
      const answers = await ctx.db
        .query("answers")
        .withIndex("by_game_question", (q) => q.eq("gameId", gameId).eq("questionId", question._id))
        .collect();
      allAnswered = players.length > 0 && answers.length >= players.length;
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

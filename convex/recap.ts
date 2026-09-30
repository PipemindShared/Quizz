/**
 * The tournament finale: statistics and awards for the whole tournament,
 * presented as a slideshow between the final's round results and the champion.
 *
 * Built in two stages so the finale never waits on a heavy computation:
 *
 *  1. Every quiz, when it reaches its results, freezes a `QuizStats` snapshot of
 *     its own answers (see `writeQuizStats`, called from enterRoundResults).
 *  2. The final, in that same step, merges those snapshots into a
 *     `TournamentRecap` (see `writeTournamentRecap`). Only the final's own
 *     answers are read in full; earlier quizzes contribute their small summary.
 *
 * Games played before snapshots existed have none, so the merge computes theirs
 * on the spot — once — and stores it.
 *
 * Players are separate documents per game, so one person across the tournament
 * is identified by team + normalised name (`playerKey`).
 */
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import * as lib from "./lib";

/* ------------------------------------------------------------------ */
/* Types — shared with the client (type-only imports from src/)         */
/* ------------------------------------------------------------------ */

export type PlayerRef = { key: string; name: string; teamId: Id<"teams"> };

export type QuizStatsPlayer = PlayerRef & {
  answered: number;
  correct: number;
  points: number;
  /** correct answers on hard (3-point) questions */
  hardCorrect: number;
  /** times this player was the fastest correct answer on a question */
  bestCount: number;
  /** questions this player was the only one to get right */
  soloCount: number;
  fastestCorrectMs: number | null;
};

export type RecapChoice = { text?: string; imageId?: Id<"_storage"> };

export type QuizStatsQuestion = {
  questionId: Id<"questions">;
  prompt: string;
  promptImageId?: Id<"_storage">;
  answerKind: Doc<"questions">["answerKind"];
  difficulty: number;
  answered: number;
  correct: number;
  choices: RecapChoice[];
  /** index-aligned with `choices`; empty for text_input */
  choiceCounts: number[];
  correctChoice?: number;
  correctText?: string;
  /** the one player who got it right, when exactly one did out of several */
  solo: PlayerRef | null;
};

export type Moment = PlayerRef & { ms: number; prompt: string };

export type QuizStats = {
  gameId: Id<"games">;
  quizId: Id<"quizzes">;
  quizName: string;
  quizOrder: number;
  isFinal: boolean;
  questionCount: number;
  answerCount: number;
  correctCount: number;
  elapsedMsTotal: number;
  players: QuizStatsPlayer[];
  questions: QuizStatsQuestion[];
  fastestCorrect: Moment | null;
  fastestWrong: Moment | null;
  /** correct answer with the least time left; `ms` is the time to spare */
  buzzerBeater: Moment | null;
};

export type RecapTeam = {
  teamId: Id<"teams">;
  name: string;
  color: string;
  iconId?: Id<"_storage">;
};

export type AwardWinner = {
  key: string;
  name: string;
  team: RecapTeam;
  value: number;
  /** extra line under the winner, e.g. the question it happened on */
  detail?: string;
};

export type AwardFormat = "points" | "percent" | "count" | "seconds";

export type AwardId =
  | "mvp"
  | "quickest"
  | "sharpshooter"
  | "hardmode"
  | "buzzer"
  | "lone"
  | "fastwrong";

export type TeamAwardId = "bestQuiz" | "quizWins" | "consistent" | "turnout";

export type TeamAward = {
  id: TeamAwardId;
  title: string;
  blurb: string;
  team: RecapTeam;
  value: number;
  format: AwardFormat;
  unit: string;
  detail?: string;
};

export type RecapStanding = { team: RecapTeam; total: number; rank: number };

export type RecapSlide =
  | { kind: "intro"; tournamentName: string; quizCount: number; teamCount: number }
  | {
      kind: "numbers";
      quizzes: number;
      questions: number;
      answers: number;
      players: number;
      accuracy: number;
      thinkingMs: number;
      fastestCorrect: (Moment & { team: RecapTeam }) | null;
    }
  | {
      kind: "race";
      quizNames: string[];
      finalName: string;
      lines: { team: RecapTeam; cumulative: number[] }[];
      leadChanges: number;
    }
  | { kind: "teamAwards"; awards: TeamAward[] }
  | {
      kind: "award";
      id: AwardId;
      title: string;
      blurb: string;
      format: AwardFormat;
      unit: string;
      winners: AwardWinner[];
      runnersUp: AwardWinner[];
    }
  | {
      kind: "iron";
      quizCount: number;
      players: { key: string; name: string; team: RecapTeam }[];
    }
  | {
      kind: "question";
      id: "killer" | "trap";
      title: string;
      blurb: string;
      quizName: string;
      question: QuizStatsQuestion;
      /** for the trap: the wrong option most people fell for */
      trapChoice?: number;
    }
  | { kind: "countdown"; revealed: number }
  | { kind: "drumroll" };

export type RecapPlayerLine = PlayerRef & {
  points: number;
  rank: number;
  answered: number;
  correct: number;
  quizzesPlayed: number;
  bestCount: number;
  fastestCorrectMs: number | null;
  /** titles of the awards this player won */
  awards: string[];
};

export type TournamentRecap = {
  tournamentName: string;
  slides: RecapSlide[];
  /** final championship standings, best first — drives the countdown */
  standings: RecapStanding[];
  /** every player of the tournament, best first — drives the phone cards */
  players: RecapPlayerLine[];
};

/* ------------------------------------------------------------------ */
/* Stage 1: one game's snapshot                                         */
/* ------------------------------------------------------------------ */

export function playerKey(teamId: Id<"teams">, name: string): string {
  return `${teamId}|${lib.normalizeAnswer(name)}`;
}

/** A correct answer with at most this much time left counts as a buzzer beater. */
const BUZZER_MAX_SPARE_MS = 3000;

/** Fewer answers than this and a question's percentages mean nothing. */
const MIN_ANSWERS_FOR_QUESTION_AWARD = 3;

export async function computeQuizStats(
  ctx: QueryCtx | MutationCtx,
  game: Doc<"games">,
): Promise<QuizStats | null> {
  const quiz = await ctx.db.get(game.quizId);
  if (!quiz) return null;
  const questions = await lib.loadOrderedQuestions(ctx, game.quizId);
  const players = await ctx.db
    .query("players")
    .withIndex("by_game", (q) => q.eq("gameId", game._id))
    .collect();
  const answers = await ctx.db
    .query("answers")
    .withIndex("by_game_player", (q) => q.eq("gameId", game._id))
    .collect();

  const refById = new Map<Id<"players">, PlayerRef>();
  const statsByKey = new Map<string, QuizStatsPlayer>();
  for (const p of players) {
    const ref = { key: playerKey(p.teamId, p.name), name: p.name, teamId: p.teamId };
    refById.set(p._id, ref);
    // A rejoin under the same name is one person, not two.
    if (!statsByKey.has(ref.key)) {
      statsByKey.set(ref.key, {
        ...ref,
        answered: 0,
        correct: 0,
        points: 0,
        hardCorrect: 0,
        bestCount: 0,
        soloCount: 0,
        fastestCorrectMs: null,
      });
    }
  }

  const questionById = new Map(questions.map((q) => [q._id, q]));
  const answersByQuestion = new Map<Id<"questions">, Doc<"answers">[]>();
  let correctCount = 0;
  let elapsedMsTotal = 0;
  let fastestCorrect: Moment | null = null;
  let fastestWrong: Moment | null = null;
  let buzzerBeater: Moment | null = null;

  for (const a of answers) {
    const question = questionById.get(a.questionId);
    const ref = refById.get(a.playerId);
    if (!question || !ref) continue;
    const list = answersByQuestion.get(a.questionId) ?? [];
    list.push(a);
    answersByQuestion.set(a.questionId, list);

    const s = statsByKey.get(ref.key)!;
    s.answered++;
    s.points += a.points;
    elapsedMsTotal += a.elapsedMs;
    if (a.correct) {
      correctCount++;
      s.correct++;
      if (question.points >= 3) s.hardCorrect++;
      if (s.fastestCorrectMs === null || a.elapsedMs < s.fastestCorrectMs) {
        s.fastestCorrectMs = a.elapsedMs;
      }
      if (!fastestCorrect || a.elapsedMs < fastestCorrect.ms) {
        fastestCorrect = { ...ref, ms: a.elapsedMs, prompt: question.prompt };
      }
      const spare = Math.max(0, question.timeLimit * 1000 - a.elapsedMs);
      if (!buzzerBeater || spare < buzzerBeater.ms) {
        buzzerBeater = { ...ref, ms: spare, prompt: question.prompt };
      }
    } else if (!fastestWrong || a.elapsedMs < fastestWrong.ms) {
      fastestWrong = { ...ref, ms: a.elapsedMs, prompt: question.prompt };
    }
  }

  const questionStats: QuizStatsQuestion[] = questions.map((q) => {
    const list = answersByQuestion.get(q._id) ?? [];
    const correct = list.filter((a) => a.correct);
    // Same rule as the reveal's "best player": fastest correct answer.
    const fastest = [...correct].sort((a, b) => a.elapsedMs - b.elapsedMs)[0];
    if (fastest) {
      const ref = refById.get(fastest.playerId);
      if (ref) statsByKey.get(ref.key)!.bestCount++;
    }
    let solo: PlayerRef | null = null;
    if (correct.length === 1 && list.length >= MIN_ANSWERS_FOR_QUESTION_AWARD) {
      solo = refById.get(correct[0]!.playerId) ?? null;
      if (solo) statsByKey.get(solo.key)!.soloCount++;
    }
    return {
      questionId: q._id,
      prompt: q.prompt,
      promptImageId: q.promptImageId,
      answerKind: q.answerKind,
      difficulty: q.points,
      answered: list.length,
      correct: correct.length,
      choices: q.choices,
      choiceCounts:
        q.answerKind === "text_input"
          ? []
          : q.choices.map((_, i) => list.filter((a) => a.choiceIndex === i).length),
      correctChoice: q.correctChoice,
      correctText: q.correctText,
      solo,
    };
  });

  return {
    gameId: game._id,
    quizId: quiz._id,
    quizName: quiz.name,
    quizOrder: quiz.order,
    isFinal: quiz.isFinal,
    questionCount: questions.length,
    answerCount: answers.length,
    correctCount,
    elapsedMsTotal,
    players: [...statsByKey.values()],
    questions: questionStats,
    fastestCorrect,
    fastestWrong,
    buzzerBeater,
  };
}

/** Freezes one game's snapshot (idempotent: replaces any earlier one). */
export async function writeQuizStats(
  ctx: MutationCtx,
  game: Doc<"games">,
): Promise<QuizStats | null> {
  const existing = await ctx.db
    .query("quizStats")
    .withIndex("by_game", (q) => q.eq("gameId", game._id))
    .collect();
  for (const row of existing) await ctx.db.delete(row._id);
  const stats = await computeQuizStats(ctx, game);
  if (stats) {
    await ctx.db.insert("quizStats", {
      gameId: game._id,
      tournamentId: game.tournamentId,
      data: stats,
    });
  }
  return stats;
}

/* ------------------------------------------------------------------ */
/* Stage 2: the tournament recap                                        */
/* ------------------------------------------------------------------ */

/** Everyone who ties the best value, plus the next two as runners-up. */
function podium<T>(
  rows: T[],
  value: (row: T) => number,
  direction: "high" | "low",
): { winners: T[]; runnersUp: T[] } {
  const sorted = [...rows].sort((a, b) =>
    direction === "high" ? value(b) - value(a) : value(a) - value(b),
  );
  if (sorted.length === 0) return { winners: [], runnersUp: [] };
  const best = value(sorted[0]!);
  const winners = sorted.filter((r) => value(r) === best).slice(0, 3);
  const runnersUp = sorted.filter((r) => value(r) !== best).slice(0, 2);
  return { winners, runnersUp };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
}

export async function buildTournamentRecap(
  ctx: MutationCtx,
  finalGame: Doc<"games">,
  finalStats: QuizStats,
): Promise<TournamentRecap | null> {
  const tournament = await ctx.db.get(finalGame.tournamentId);
  if (!tournament) return null;
  const teamDocs = (
    await ctx.db
      .query("teams")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", finalGame.tournamentId))
      .collect()
  ).sort((a, b) => a.order - b.order);
  const teamById = new Map<Id<"teams">, RecapTeam>(
    teamDocs.map((t) => [t._id, { teamId: t._id, name: t.name, color: t.color, iconId: t.iconId }]),
  );
  const rosterById = new Map(teamDocs.map((t) => [t._id, t.members.length]));

  // Exactly the games the championship counts: those with frozen results.
  const results = await ctx.db
    .query("gameResults")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", finalGame.tournamentId))
    .collect();
  const resultsByGame = new Map<Id<"games">, Doc<"gameResults">[]>();
  for (const r of results) {
    if (!teamById.has(r.teamId)) continue;
    const list = resultsByGame.get(r.gameId) ?? [];
    list.push(r);
    resultsByGame.set(r.gameId, list);
  }

  const allStats: QuizStats[] = [];
  for (const gameId of resultsByGame.keys()) {
    if (gameId === finalGame._id) {
      allStats.push(finalStats);
      continue;
    }
    const row = await ctx.db
      .query("quizStats")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .first();
    if (row) {
      allStats.push(row.data as QuizStats);
      continue;
    }
    // Played before snapshots existed: work it out now, and keep it.
    const game = await ctx.db.get(gameId);
    const stats = game ? await writeQuizStats(ctx, game) : null;
    if (stats) allStats.push(stats);
  }
  // Tournament order; the final always last whatever its `order` says.
  allStats.sort(
    (a, b) =>
      Number(a.gameId === finalGame._id) - Number(b.gameId === finalGame._id) ||
      a.quizOrder - b.quizOrder,
  );

  const team = (id: Id<"teams">) => teamById.get(id);

  /* ---- Standings (same rule as lib.buildStandings) ---- */
  const standingsRaw = await lib.buildStandings(ctx, finalGame.tournamentId, teamDocs);
  const standings: RecapStanding[] = standingsRaw.map((s) => ({
    team: teamById.get(s.team._id)!,
    total: s.total,
    rank: s.rank,
  }));

  /* ---- Players across the tournament ---- */
  type Agg = PlayerRef & Omit<RecapPlayerLine, "key" | "name" | "teamId" | "rank" | "awards"> & {
    hardCorrect: number;
    soloCount: number;
  };
  const agg = new Map<string, Agg>();
  for (const stats of allStats) {
    for (const p of stats.players) {
      if (!teamById.has(p.teamId)) continue;
      const a =
        agg.get(p.key) ??
        ({
          key: p.key,
          name: p.name,
          teamId: p.teamId,
          points: 0,
          answered: 0,
          correct: 0,
          quizzesPlayed: 0,
          bestCount: 0,
          fastestCorrectMs: null,
          hardCorrect: 0,
          soloCount: 0,
        } as Agg);
      // Latest spelling wins — the final is the one people just saw.
      a.name = p.name;
      a.points += p.points;
      a.answered += p.answered;
      a.correct += p.correct;
      a.quizzesPlayed += 1;
      a.bestCount += p.bestCount;
      a.hardCorrect += p.hardCorrect;
      a.soloCount += p.soloCount;
      if (
        p.fastestCorrectMs !== null &&
        (a.fastestCorrectMs === null || p.fastestCorrectMs < a.fastestCorrectMs)
      ) {
        a.fastestCorrectMs = p.fastestCorrectMs;
      }
      agg.set(p.key, a);
    }
  }
  const people = [...agg.values()];
  const awardsByKey = new Map<string, string[]>();

  const winner = (p: Agg, value: number, detail?: string): AwardWinner => ({
    key: p.key,
    name: p.name,
    team: team(p.teamId)!,
    value,
    detail,
  });
  const momentWinner = (m: Moment, value: number): AwardWinner | null => {
    const t = team(m.teamId);
    const p = agg.get(m.key);
    return t ? { key: m.key, name: p?.name ?? m.name, team: t, value, detail: m.prompt } : null;
  };

  const playerSlides: RecapSlide[] = [];
  const pushAward = (
    slide: Omit<Extract<RecapSlide, { kind: "award" }>, "kind">,
  ) => {
    if (slide.winners.length === 0) return;
    for (const w of slide.winners) {
      awardsByKey.set(w.key, [...(awardsByKey.get(w.key) ?? []), slide.title]);
    }
    playerSlides.push({ kind: "award", ...slide });
  };
  const podiumAward = (
    base: Omit<Extract<RecapSlide, { kind: "award" }>, "kind" | "winners" | "runnersUp">,
    rows: Agg[],
    value: (p: Agg) => number,
    direction: "high" | "low" = "high",
  ) => {
    const { winners, runnersUp } = podium(rows, value, direction);
    pushAward({
      ...base,
      winners: winners.map((p) => winner(p, value(p))),
      runnersUp: runnersUp.map((p) => winner(p, value(p))),
    });
  };

  const scorers = people.filter((p) => p.points > 0);
  podiumAward(
    {
      id: "mvp",
      title: "Most Valuable Player",
      blurb: "The most points scored across the whole tournament",
      format: "points",
      unit: "points",
    },
    scorers,
    (p) => p.points,
  );

  podiumAward(
    {
      id: "quickest",
      title: "Quickest Draw",
      blurb: "Fastest correct answer on the most questions",
      format: "count",
      unit: "times fastest",
    },
    people.filter((p) => p.bestCount > 0),
    (p) => p.bestCount,
  );

  // Accuracy only means something over a decent number of answers.
  const mostAnswered = Math.max(0, ...people.map((p) => p.answered));
  const minForAccuracy = Math.max(3, Math.ceil(mostAnswered * 0.5));
  podiumAward(
    {
      id: "sharpshooter",
      title: "Sharpshooter",
      blurb: `Best accuracy, among players with ${minForAccuracy}+ answers`,
      format: "percent",
      unit: "correct",
    },
    people.filter((p) => p.answered >= minForAccuracy && p.correct > 0),
    (p) => Math.round((p.correct / p.answered) * 1000) / 10,
  );

  podiumAward(
    {
      id: "hardmode",
      title: "Hard Mode Hero",
      blurb: "Most hard questions answered correctly",
      format: "count",
      unit: "hard questions",
    },
    people.filter((p) => p.hardCorrect > 0),
    (p) => p.hardCorrect,
  );

  // Only a genuine last-second answer earns it; plenty of time left is not a buzzer.
  const buzzer = allStats
    .map((s) => s.buzzerBeater)
    .filter((m): m is Moment => m !== null && teamById.has(m.teamId) && m.ms <= BUZZER_MAX_SPARE_MS)
    .sort((a, b) => a.ms - b.ms)[0];
  if (buzzer) {
    const w = momentWinner(buzzer, buzzer.ms);
    if (w) {
      pushAward({
        id: "buzzer",
        title: "Buzzer Beater",
        blurb: "Right answer, with the least time left on the clock",
        format: "seconds",
        unit: "to spare",
        winners: [w],
        runnersUp: [],
      });
    }
  }

  const lone = podium(
    people.filter((p) => p.soloCount > 0),
    (p) => p.soloCount,
    "high",
  );
  if (lone.winners.length > 0) {
    const soloPrompt = (key: string) =>
      allStats.flatMap((s) => s.questions).find((q) => q.solo?.key === key)?.prompt;
    pushAward({
      id: "lone",
      title: "Lone Genius",
      blurb: "The only person in the room to get it right",
      format: "count",
      unit: lone.winners[0]!.soloCount === 1 ? "question" : "questions",
      winners: lone.winners.map((p) => winner(p, p.soloCount, soloPrompt(p.key))),
      runnersUp: lone.runnersUp.map((p) => winner(p, p.soloCount)),
    });
  }

  const fastWrong = allStats
    .map((s) => s.fastestWrong)
    .filter((m): m is Moment => m !== null && teamById.has(m.teamId))
    .sort((a, b) => a.ms - b.ms)[0];

  /* ---- Iron players ---- */
  const gameCount = allStats.length;
  const iron = people
    .filter((p) => p.quizzesPlayed >= gameCount)
    .sort((a, b) => b.points - a.points);
  if (gameCount >= 2 && iron.length > 0) {
    for (const p of iron) {
      awardsByKey.set(p.key, [...(awardsByKey.get(p.key) ?? []), "Iron Player"]);
    }
    playerSlides.push({
      kind: "iron",
      quizCount: gameCount,
      players: iron.map((p) => ({ key: p.key, name: p.name, team: team(p.teamId)! })),
    });
  }

  // The comic relief goes last, after the serious awards.
  if (fastWrong) {
    const w = momentWinner(fastWrong, fastWrong.ms);
    if (w) {
      pushAward({
        id: "fastwrong",
        title: "Confidently Wrong",
        blurb: "The fastest wrong answer of the tournament",
        format: "seconds",
        unit: "to be wrong",
        winners: [w],
        runnersUp: [],
      });
    }
  }

  /* ---- Team awards (per-quiz scores only — nothing that spoils the ranking) ---- */
  const scoresByTeam = new Map<Id<"teams">, number[]>();
  const teamAwards: TeamAward[] = [];

  let bestQuiz: { r: Doc<"gameResults">; quizName: string } | null = null;
  const winsByTeam = new Map<Id<"teams">, number>();
  const attendanceByTeam = new Map<Id<"teams">, number[]>();
  const bonusByTeam = new Map<Id<"teams">, number>();
  for (const stats of allStats) {
    const rows = resultsByGame.get(stats.gameId) ?? [];
    const top = Math.max(...rows.map((r) => r.score));
    for (const r of rows) {
      scoresByTeam.set(r.teamId, [...(scoresByTeam.get(r.teamId) ?? []), r.score]);
      if (top > 0 && r.score === top) winsByTeam.set(r.teamId, (winsByTeam.get(r.teamId) ?? 0) + 1);
      if (!bestQuiz || r.score > bestQuiz.r.score) bestQuiz = { r, quizName: stats.quizName };
      const roster = rosterById.get(r.teamId) ?? 0;
      if (roster > 0) {
        attendanceByTeam.set(r.teamId, [
          ...(attendanceByTeam.get(r.teamId) ?? []),
          Math.min(100, (r.playerCount / roster) * 100),
        ]);
      }
      bonusByTeam.set(
        r.teamId,
        (bonusByTeam.get(r.teamId) ?? 0) + (r.score - (r.baseScore ?? r.score)),
      );
    }
  }

  if (bestQuiz && bestQuiz.r.score > 0) {
    teamAwards.push({
      id: "bestQuiz",
      title: "Best Single Quiz",
      blurb: "Highest score in one quiz",
      team: team(bestQuiz.r.teamId)!,
      value: bestQuiz.r.score,
      format: "points",
      unit: "points",
      detail: bestQuiz.quizName,
    });
  }
  if (gameCount >= 2) {
    const [topWins] = [...winsByTeam.entries()].sort((a, b) => b[1] - a[1]);
    if (topWins && topWins[1] >= 2) {
      teamAwards.push({
        id: "quizWins",
        title: "Serial Winners",
        blurb: "Won the most individual quizzes",
        team: team(topWins[0])!,
        value: topWins[1],
        format: "count",
        unit: `of ${gameCount} quizzes`,
      });
    }
  }
  if (gameCount >= 3) {
    const steady = [...scoresByTeam.entries()]
      .filter(([, xs]) => xs.length >= 3 && mean(xs) > 0)
      .map(([id, xs]) => {
        const m = mean(xs);
        const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
        return { id, spread: sd / m, m };
      })
      .sort((a, b) => a.spread - b.spread)[0];
    if (steady) {
      teamAwards.push({
        id: "consistent",
        title: "Rock Solid",
        blurb: "The steadiest scores, quiz after quiz",
        team: team(steady.id)!,
        value: Math.round(steady.m),
        format: "points",
        unit: "average per quiz",
      });
    }
  }
  const turnout = [...attendanceByTeam.entries()]
    .map(([id, xs]) => ({ id, avg: mean(xs) }))
    .sort((a, b) => b.avg - a.avg)[0];
  if (turnout && turnout.avg > 0) {
    const bonus = Math.round(bonusByTeam.get(turnout.id) ?? 0);
    teamAwards.push({
      id: "turnout",
      title: "Turnout Trophy",
      blurb: "Best average attendance",
      team: team(turnout.id)!,
      value: Math.round(turnout.avg),
      format: "percent",
      unit: "of the roster, on average",
      detail: bonus > 0 ? `+${bonus.toLocaleString("en-US")} bonus points earned` : undefined,
    });
  }

  /* ---- The race to the final (cumulative, stops before the final) ---- */
  const preFinal = allStats.filter((s) => s.gameId !== finalGame._id);
  let race: RecapSlide | null = null;
  if (preFinal.length >= 2) {
    const lines = teamDocs.map((t) => {
      let running = 0;
      const cumulative = preFinal.map((s) => {
        const r = (resultsByGame.get(s.gameId) ?? []).find((x) => x.teamId === t._id);
        running += r?.score ?? 0;
        return running;
      });
      return { team: teamById.get(t._id)!, cumulative };
    });
    let leadChanges = 0;
    let leader: Id<"teams"> | null = null;
    for (let i = 0; i < preFinal.length; i++) {
      const best = Math.max(...lines.map((l) => l.cumulative[i]!));
      const leaders = lines.filter((l) => l.cumulative[i] === best).map((l) => l.team.teamId);
      // A tie doesn't take the lead away from whoever held it.
      if (leader !== null && leaders.includes(leader)) continue;
      if (leader !== null) leadChanges++;
      leader = leaders[0]!;
    }
    race = {
      kind: "race",
      quizNames: preFinal.map((s) => s.quizName),
      finalName: finalStats.quizName,
      lines,
      leadChanges,
    };
  }

  /* ---- The questions ---- */
  const questionPool = allStats.flatMap((s) =>
    s.questions
      .filter((q) => q.answered >= MIN_ANSWERS_FOR_QUESTION_AWARD)
      .map((q) => ({ q, quizName: s.quizName })),
  );
  const questionSlides: RecapSlide[] = [];
  const killer = [...questionPool].sort(
    (a, b) =>
      a.q.correct / a.q.answered - b.q.correct / b.q.answered ||
      b.q.difficulty - a.q.difficulty,
  )[0];
  if (killer) {
    questionSlides.push({
      kind: "question",
      id: "killer",
      title: "The Killer Question",
      blurb: "Fewest correct answers of the tournament",
      quizName: killer.quizName,
      question: killer.q,
    });
  }
  const traps = questionPool
    .filter((x) => x.q.answerKind !== "text_input" && x.q !== killer?.q)
    .map((x) => {
      let trapChoice = -1;
      let trapCount = 0;
      x.q.choiceCounts.forEach((c, i) => {
        if (i !== x.q.correctChoice && c > trapCount) {
          trapChoice = i;
          trapCount = c;
        }
      });
      return { ...x, trapChoice, share: trapCount / x.q.answered, trapCount };
    })
    .filter((x) => x.trapChoice >= 0 && x.trapCount >= 2 && x.share >= 0.25)
    .sort((a, b) => b.share - a.share);
  const trap = traps[0];
  if (trap) {
    questionSlides.push({
      kind: "question",
      id: "trap",
      title: "The Trap",
      blurb: "The wrong answer the most people fell for",
      quizName: trap.quizName,
      question: trap.q,
      trapChoice: trap.trapChoice,
    });
  }

  /* ---- Tournament in numbers ---- */
  const answerCount = allStats.reduce((a, s) => a + s.answerCount, 0);
  const correctCount = allStats.reduce((a, s) => a + s.correctCount, 0);
  const fastest = allStats
    .map((s) => s.fastestCorrect)
    .filter((m): m is Moment => m !== null && teamById.has(m.teamId))
    .sort((a, b) => a.ms - b.ms)[0];

  /* ---- Assemble ---- */
  const slides: RecapSlide[] = [
    {
      kind: "intro",
      tournamentName: tournament.name,
      quizCount: gameCount,
      teamCount: teamDocs.length,
    },
  ];
  if (answerCount > 0) {
    slides.push({
      kind: "numbers",
      quizzes: gameCount,
      questions: allStats.reduce((a, s) => a + s.questionCount, 0),
      answers: answerCount,
      players: people.length,
      accuracy: Math.round((correctCount / answerCount) * 100),
      thinkingMs: allStats.reduce((a, s) => a + s.elapsedMsTotal, 0),
      fastestCorrect: fastest
        ? { ...fastest, name: agg.get(fastest.key)?.name ?? fastest.name, team: team(fastest.teamId)! }
        : null,
    });
  }
  if (race) slides.push(race);
  if (teamAwards.length > 0) slides.push({ kind: "teamAwards", awards: teamAwards });
  slides.push(...playerSlides, ...questionSlides);
  // Reveal from last place up to second, one team per click, then the drumroll.
  for (let revealed = 1; revealed < standings.length; revealed++) {
    slides.push({ kind: "countdown", revealed });
  }
  slides.push({ kind: "drumroll" });

  const ranked = [...people].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const players: RecapPlayerLine[] = ranked.map((p) => ({
    key: p.key,
    name: p.name,
    teamId: p.teamId,
    points: p.points,
    // Equal points share a rank.
    rank: ranked.findIndex((q) => q.points === p.points) + 1,
    answered: p.answered,
    correct: p.correct,
    quizzesPlayed: p.quizzesPlayed,
    bestCount: p.bestCount,
    fastestCorrectMs: p.fastestCorrectMs,
    awards: awardsByKey.get(p.key) ?? [],
  }));

  return { tournamentName: tournament.name, slides, standings, players };
}

/** Freezes the final's recap (idempotent: replaces any earlier one). */
export async function writeTournamentRecap(
  ctx: MutationCtx,
  finalGame: Doc<"games">,
  finalStats: QuizStats,
): Promise<void> {
  const existing = await ctx.db
    .query("tournamentRecaps")
    .withIndex("by_game", (q) => q.eq("gameId", finalGame._id))
    .collect();
  for (const row of existing) await ctx.db.delete(row._id);
  const recap = await buildTournamentRecap(ctx, finalGame, finalStats);
  if (!recap) return;
  await ctx.db.insert("tournamentRecaps", {
    gameId: finalGame._id,
    tournamentId: finalGame.tournamentId,
    data: recap,
  });
}

export async function loadRecap(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<"games">,
): Promise<TournamentRecap | null> {
  const row = await ctx.db
    .query("tournamentRecaps")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .first();
  return row ? (row.data as TournamentRecap) : null;
}

/** What the current slide means for one player's phone. */
export function slideForPhone(
  recap: TournamentRecap,
  step: number,
): {
  kind: RecapSlide["kind"];
  title: string | null;
  winnerKeys: string[];
  /** countdown: teams revealed so far, last place first */
  revealedTeamIds: Id<"teams">[];
} {
  const slide = recap.slides[step];
  const base = { title: null, winnerKeys: [] as string[], revealedTeamIds: [] as Id<"teams">[] };
  if (!slide) return { kind: "drumroll", ...base };
  switch (slide.kind) {
    case "award":
      return { kind: slide.kind, ...base, title: slide.title, winnerKeys: slide.winners.map((w) => w.key) };
    case "iron":
      return { kind: slide.kind, ...base, title: "Iron Player", winnerKeys: slide.players.map((p) => p.key) };
    case "countdown":
      return {
        kind: slide.kind,
        ...base,
        title: "Final standings",
        revealedTeamIds: [...recap.standings]
          .reverse()
          .slice(0, slide.revealed)
          .map((s) => s.team.teamId),
      };
    case "teamAwards":
      return { kind: slide.kind, ...base, title: "Team awards" };
    case "question":
      return { kind: slide.kind, ...base, title: slide.title };
    case "race":
      return { kind: slide.kind, ...base, title: "The road to the final" };
    case "numbers":
      return { kind: slide.kind, ...base, title: "The tournament in numbers" };
    default:
      return { kind: slide.kind, ...base };
  }
}

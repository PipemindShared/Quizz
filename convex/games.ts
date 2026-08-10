import { ConvexError, v, type Infer } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { gameStatus } from "./schema";
import * as lib from "./lib";

type GameStatus = Infer<typeof gameStatus>;
type Dot = { teamId: Id<"teams">; teamColor: string; elapsedMs: number };

/** Opens `questions[index]`: stamps the timer window and arms the safety net. */
async function enterQuestion(ctx: MutationCtx, game: Doc<"games">, index: number): Promise<void> {
  const questions = await lib.loadOrderedQuestions(ctx, game.quizId);
  const question = questions[index];
  if (!question) throw new ConvexError("No such question");

  const now = Date.now();
  const endsAt = now + question.timeLimit * 1000;
  await ctx.db.patch(game._id, {
    status: "question",
    currentIndex: index,
    questionStartedAt: now,
    questionEndsAt: endsAt,
    phaseStartedAt: now,
    startedAt: game.startedAt ?? now,
  });

  // Safety net: close the question even if every client has gone quiet.
  // `closeQuestion` re-checks status + currentIndex, so this is harmless if
  // a client already closed (or the game moved on) by the time it fires.
  await ctx.scheduler.runAt(endsAt + 750, internal.games.autoClose, { gameId: game._id, index });
}

/** reveal -> round_results: freeze this game's team scores (idempotent). */
async function enterRoundResults(ctx: MutationCtx, game: Doc<"games">): Promise<void> {
  const existing = await ctx.db
    .query("gameResults")
    .withIndex("by_game", (q) => q.eq("gameId", game._id))
    .collect();
  for (const row of existing) await ctx.db.delete(row._id);

  const teams = await ctx.db
    .query("teams")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", game.tournamentId))
    .collect();
  for (const team of teams) {
    const { score, playerCount } = await lib.computeTeamScoreForGame(ctx, game._id, team._id);
    await ctx.db.insert("gameResults", {
      gameId: game._id,
      quizId: game.quizId,
      tournamentId: game.tournamentId,
      teamId: team._id,
      score,
      playerCount,
    });
  }

  await ctx.db.patch(game._id, { status: "round_results", phaseStartedAt: Date.now() });
}

export const create = mutation({
  args: { quizId: v.id("quizzes") },
  returns: v.object({ gameId: v.id("games"), code: v.string() }),
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new ConvexError("Quiz not found");

    const questions = await lib.loadOrderedQuestions(ctx, args.quizId);
    if (questions.length === 0) throw new ConvexError("This quiz has no questions yet");

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", quiz.tournamentId))
      .collect();
    if (teams.length < 2) throw new ConvexError("The tournament needs at least 2 teams");

    const code = await lib.generateUniqueGameCode(ctx);
    const gameId = await ctx.db.insert("games", {
      quizId: args.quizId,
      tournamentId: quiz.tournamentId,
      code,
      status: "lobby",
      currentIndex: -1,
      phaseStartedAt: Date.now(),
    });
    return { gameId, code };
  },
});

export const start = mutation({
  args: { gameId: v.id("games") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new ConvexError("Game not found");
    if (game.status !== "lobby") return null; // idempotent
    await enterQuestion(ctx, game, 0);
    return null;
  },
});

export const closeQuestion = mutation({
  args: { gameId: v.id("games"), force: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await lib.closeQuestion(ctx, args.gameId, { force: args.force });
    return null;
  },
});

/** Scheduled safety net armed by `enterQuestion` — closes on time even with no viewers. */
export const autoClose = internalMutation({
  args: { gameId: v.id("games"), index: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await lib.closeQuestion(ctx, args.gameId, { force: true, expectedIndex: args.index });
    return null;
  },
});

export const advance = mutation({
  args: { gameId: v.id("games") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new ConvexError("Game not found");

    if (game.status === "question") {
      // A stray "next" click while a question is still open just force-closes it.
      await lib.closeQuestion(ctx, game._id, { force: true });
      return null;
    }

    if (game.status === "reveal") {
      const questions = await lib.loadOrderedQuestions(ctx, game.quizId);
      const nextIndex = game.currentIndex + 1;
      if (nextIndex < questions.length) {
        await enterQuestion(ctx, game, nextIndex);
      } else {
        await enterRoundResults(ctx, game);
      }
      return null;
    }

    if (game.status === "round_results") {
      await ctx.db.patch(game._id, { status: "leaderboard", phaseStartedAt: Date.now() });
      const quiz = await ctx.db.get(game.quizId);
      if (quiz?.isFinal) {
        const tournament = await ctx.db.get(game.tournamentId);
        if (tournament && tournament.completedAt === undefined) {
          await ctx.db.patch(game.tournamentId, { completedAt: Date.now() });
        }
      }
      return null;
    }

    if (game.status === "leaderboard") {
      await ctx.db.patch(game._id, {
        status: "finished",
        endedAt: Date.now(),
        phaseStartedAt: Date.now(),
      });
      return null;
    }

    return null; // lobby / finished: no-op
  },
});

export const getHostState = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;
    const quiz = await ctx.db.get(game.quizId);
    if (!quiz) return null;
    const tournament = await ctx.db.get(game.tournamentId);
    if (!tournament) return null;

    const questions = await lib.loadOrderedQuestions(ctx, game.quizId);
    const teamDocs = (
      await ctx.db
        .query("teams")
        .withIndex("by_tournament", (q) => q.eq("tournamentId", game.tournamentId))
        .collect()
    ).sort((a, b) => a.order - b.order);
    const teamById = new Map(teamDocs.map((t) => [t._id, t]));

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const playersByTeam = new Map<Id<"teams">, Doc<"players">[]>();
    for (const p of players) {
      const arr = playersByTeam.get(p.teamId) ?? [];
      arr.push(p);
      playersByTeam.set(p.teamId, arr);
    }

    const teams = teamDocs.map((t) => {
      // Newest joiner first: the lobby only has room to show a handful, and the
      // useful ones are the people who just scanned and are looking for their
      // own name on the screen.
      const ps = [...(playersByTeam.get(t._id) ?? [])].sort(
        (a, b) => b.joinedAt - a.joinedAt,
      );
      return {
        _id: t._id,
        name: t.name,
        color: t.color,
        iconId: t.iconId,
        members: t.members,
        playerCount: ps.length,
        playerNames: ps.map((p) => p.name),
      };
    });

    const currentQuestion = game.currentIndex >= 0 ? questions[game.currentIndex] : undefined;

    let answeredCount = 0;
    let currentAnswers: Doc<"answers">[] = [];
    if (currentQuestion) {
      currentAnswers = await ctx.db
        .query("answers")
        .withIndex("by_game_question", (q) => q.eq("gameId", game._id).eq("questionId", currentQuestion._id))
        .collect();
      answeredCount = currentAnswers.length;
    }

    const showQuestion =
      currentQuestion && (game.status === "question" || game.status === "reveal");
    const question = showQuestion
      ? {
          _id: currentQuestion._id,
          order: currentQuestion.order,
          number: game.currentIndex + 1,
          prompt: currentQuestion.prompt,
          promptImageId: currentQuestion.promptImageId,
          answerKind: currentQuestion.answerKind,
          choices: currentQuestion.choices,
          points: currentQuestion.points,
          timeLimit: currentQuestion.timeLimit,
          // Never leak the answer while the question is still open.
          ...(game.status === "reveal"
            ? { correctChoice: currentQuestion.correctChoice, correctText: currentQuestion.correctText }
            : {}),
        }
      : null;

    let reveal = null;
    if (game.status === "reveal" && currentQuestion) {
      let distribution: {
        choiceIndex: number;
        count: number;
        correct: boolean;
        dots: Dot[];
      }[] = [];
      let textAnswers: { text: string; count: number; correct: boolean; dots: Dot[] }[] = [];

      if (currentQuestion.answerKind === "text_input") {
        const groups = new Map<
          string,
          { text: string; count: number; correct: boolean; dots: Dot[] }
        >();
        for (const a of currentAnswers) {
          const key = lib.normalizeAnswer(a.text ?? "");
          const team = teamById.get(a.teamId);
          const dot: Dot = { teamId: a.teamId, teamColor: team?.color ?? "#888888", elapsedMs: a.elapsedMs };
          const existing = groups.get(key);
          if (existing) {
            existing.count++;
            existing.dots.push(dot);
          } else {
            groups.set(key, { text: a.text ?? "", count: 1, correct: a.correct, dots: [dot] });
          }
        }
        textAnswers = [...groups.values()].sort((a, b) => b.count - a.count);
      } else {
        distribution = currentQuestion.choices.map((_, idx) => {
          const choiceAnswers = currentAnswers.filter((a) => a.choiceIndex === idx);
          return {
            choiceIndex: idx,
            count: choiceAnswers.length,
            correct: idx === currentQuestion.correctChoice,
            dots: choiceAnswers.map((a) => ({
              teamId: a.teamId,
              teamColor: teamById.get(a.teamId)?.color ?? "#888888",
              elapsedMs: a.elapsedMs,
            })),
          };
        });
      }

      const best = await lib.bestPlayerForQuestion(ctx, game._id, currentQuestion._id);
      reveal = {
        correctChoice: currentQuestion.correctChoice,
        correctText: currentQuestion.correctText,
        distribution,
        textAnswers,
        correctCount: currentAnswers.filter((a) => a.correct).length,
        totalAnswers: currentAnswers.length,
        bestPlayer: best
          ? {
              name: best.player.name,
              teamId: best.team._id,
              teamName: best.team.name,
              teamColor: best.team.color,
              teamIconId: best.team.iconId,
              elapsedMs: best.answer.elapsedMs,
              points: best.answer.points,
            }
          : null,
      };
    }

    let roundScores = null;
    if (game.status === "round_results") {
      const results = await ctx.db
        .query("gameResults")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      const rows = await Promise.all(
        results.map(async (r) => {
          const team = teamById.get(r.teamId);
          const { players: rosterPoints } = await lib.computeTeamScoreForGame(ctx, game._id, r.teamId);
          return {
            teamId: r.teamId,
            name: team?.name ?? "?",
            color: team?.color ?? "#888888",
            iconId: team?.iconId,
            score: r.score,
            playerCount: r.playerCount,
            players: rosterPoints,
          };
        }),
      );
      roundScores = rows.sort((a, b) => b.score - a.score);
    }

    let standings = null;
    if (game.status === "leaderboard" || game.status === "finished") {
      const ranked = await lib.buildStandings(ctx, game.tournamentId, teamDocs);
      const roundMap = await lib.getGameResultsMap(ctx, game._id);
      standings = ranked.map((r) => ({
        teamId: r.team._id,
        name: r.team.name,
        color: r.team.color,
        iconId: r.team.iconId,
        total: r.total,
        roundScore: roundMap.get(r.team._id) ?? 0,
        rank: r.rank,
      }));
    }

    return {
      game: {
        _id: game._id,
        code: game.code,
        status: game.status as GameStatus,
        currentIndex: game.currentIndex,
        questionStartedAt: game.questionStartedAt,
        questionEndsAt: game.questionEndsAt,
        phaseStartedAt: game.phaseStartedAt,
      },
      quiz: {
        _id: quiz._id,
        name: quiz.name,
        description: quiz.description,
        isFinal: quiz.isFinal,
        questionCount: questions.length,
      },
      /**
       * The server's clock, so each client can subtract its own drift instead of
       * comparing server timestamps against a device clock that may be wrong.
       */
      serverNow: Date.now(),
      tournament: { _id: tournament._id, name: tournament.name },
      teams,
      playerCount: players.length,
      /**
       * How many players can actually answer the open question. Excludes anyone
       * who joined after it opened, so the "x / y answered" ticker can reach
       * completion and the auto-close isn't blocked by a late arrival.
       */
      answerableCount:
        game.currentIndex >= 0
          ? players.filter((p) => lib.isEligibleForQuestion(p, game.currentIndex)).length
          : players.length,
      answeredCount,
      question,
      reveal,
      roundScores,
      standings,
    };
  },
});

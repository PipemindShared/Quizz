import { ConvexError, v, type Infer } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { gameStatus } from "./schema";
import * as lib from "./lib";

type GameStatus = Infer<typeof gameStatus>;

/** Grace window after `questionEndsAt` to tolerate client/network latency. */
const LATE_GRACE_MS = 1500;

/**
 * Resolves the game a join-code currently points at. Codes are reused once a
 * game finishes, so prefer any non-finished game over the (possibly several)
 * finished games that previously used the same code.
 */
async function findGameByCode(ctx: QueryCtx | MutationCtx, code: string): Promise<Doc<"games"> | null> {
  const candidates = await ctx.db
    .query("games")
    .withIndex("by_code", (q) => q.eq("code", code))
    .collect();
  if (candidates.length === 0) return null;
  const live = candidates.find((g) => g.status !== "finished");
  if (live) return live;
  return candidates.sort((a, b) => b._creationTime - a._creationTime)[0]!;
}

export const getPlayState = query({
  args: { code: v.string(), playerId: v.optional(v.id("players")) },
  handler: async (ctx, args) => {
    let me: Doc<"players"> | null = null;
    let game: Doc<"games"> | null = null;

    if (args.playerId) {
      me = await ctx.db.get(args.playerId);
      if (me) game = await ctx.db.get(me.gameId);
    }
    if (!game) {
      game = await findGameByCode(ctx, args.code.trim().toUpperCase());
    }
    if (!game) return null;

    const quiz = await ctx.db.get(game.quizId);
    const tournament = await ctx.db.get(game.tournamentId);
    if (!quiz || !tournament) return null;

    const questions = await lib.loadOrderedQuestions(ctx, game.quizId);
    const teamDocs = await ctx.db
      .query("teams")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", game.tournamentId))
      .collect();
    teamDocs.sort((a, b) => a.order - b.order);

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const countByTeam = new Map<string, number>();
    for (const p of players) countByTeam.set(p.teamId, (countByTeam.get(p.teamId) ?? 0) + 1);

    const teams = teamDocs.map((t) => ({
      _id: t._id,
      name: t.name,
      color: t.color,
      iconId: t.iconId,
      members: t.members,
      playerCount: countByTeam.get(t._id) ?? 0,
    }));

    let myTotalPoints = 0;
    if (me) {
      const myAnswers = await ctx.db
        .query("answers")
        .withIndex("by_game_player", (q) => q.eq("gameId", game._id).eq("playerId", me!._id))
        .collect();
      myTotalPoints = myAnswers.reduce((sum, a) => sum + a.points, 0);
    }
    const myTeam = me ? teamDocs.find((t) => t._id === me!.teamId) : undefined;

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

    // A player who joined mid-question sits that one out entirely — including
    // its reveal, which would otherwise show them an answer to a question they
    // never saw.
    const sittingOut =
      !!me && game.currentIndex >= 0 && !lib.isEligibleForQuestion(me, game.currentIndex);

    const showQuestion =
      currentQuestion &&
      !sittingOut &&
      (game.status === "question" || game.status === "reveal");
    const question = showQuestion
      ? {
          _id: currentQuestion._id,
          number: game.currentIndex + 1,
          total: questions.length,
          prompt: currentQuestion.prompt,
          promptImageId: currentQuestion.promptImageId,
          answerKind: currentQuestion.answerKind,
          choices: currentQuestion.choices,
          points: currentQuestion.points,
          timeLimit: currentQuestion.timeLimit,
        }
      : null;

    let myAnswer = null;
    const mine = me && currentQuestion ? currentAnswers.find((a) => a.playerId === me!._id) : undefined;
    if (mine) {
      myAnswer = {
        choiceIndex: mine.choiceIndex,
        text: mine.text,
        ...(game.status === "reveal" ? { correct: mine.correct, points: mine.points } : {}),
      };
    }

    let reveal = null;
    if (game.status === "reveal" && currentQuestion) {
      const distribution = currentQuestion.choices.map((_, idx) => ({
        choiceIndex: idx,
        count: currentAnswers.filter((a) => a.choiceIndex === idx).length,
      }));
      const best = await lib.bestPlayerForQuestion(ctx, game._id, currentQuestion._id);
      reveal = {
        correctChoice: currentQuestion.correctChoice,
        correctText: currentQuestion.correctText,
        myCorrect: mine?.correct ?? false,
        myPoints: mine?.points ?? 0,
        distribution,
        bestPlayer: best
          ? {
              name: best.player.name,
              teamName: best.team.name,
              teamColor: best.team.color,
              isMe: me ? best.player._id === me._id : false,
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
      roundScores = results
        .map((r) => {
          const team = teamDocs.find((t) => t._id === r.teamId);
          return {
            teamId: r.teamId,
            name: team?.name ?? "?",
            color: team?.color ?? "#888888",
            score: r.score,
            isMyTeam: me ? r.teamId === me.teamId : false,
          };
        })
        .sort((a, b) => b.score - a.score);
    }

    let standings = null;
    if (game.status === "leaderboard" || game.status === "finished") {
      const ranked = await lib.buildStandings(ctx, game.tournamentId, teamDocs);
      standings = ranked.map((r) => ({
        teamId: r.team._id,
        name: r.team.name,
        color: r.team.color,
        total: r.total,
        rank: r.rank,
        isMyTeam: me ? r.team._id === me.teamId : false,
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
        name: quiz.name,
        description: quiz.description,
        isFinal: quiz.isFinal,
        questionCount: questions.length,
      },
      tournament: { name: tournament.name },
      teams,
      me: me
        ? {
            playerId: me._id,
            name: me.name,
            teamId: me.teamId,
            teamName: myTeam?.name ?? "",
            teamColor: myTeam?.color ?? "#888888",
            teamIconId: myTeam?.iconId,
            totalPoints: myTotalPoints,
          }
        : null,
      playerCount: players.length,
      answeredCount,
      /** True while this player waits out a question that opened before they joined. */
      sittingOut,
      question,
      myAnswer,
      reveal,
      roundScores,
      standings,
    };
  },
});

export const join = mutation({
  args: { code: v.string(), teamId: v.id("teams"), name: v.string() },
  returns: v.object({ playerId: v.id("players") }),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Enter a name");
    if (name.length > 32) throw new ConvexError("Name is too long (max 32 characters)");

    const game = await findGameByCode(ctx, args.code.trim().toUpperCase());
    if (!game) throw new ConvexError("Game not found");
    if (game.status === "finished") throw new ConvexError("This game has already finished");

    const team = await ctx.db.get(args.teamId);
    if (!team || team.tournamentId !== game.tournamentId) {
      throw new ConvexError("That team isn't part of this game");
    }

    const teammates = await ctx.db
      .query("players")
      .withIndex("by_game_team", (q) => q.eq("gameId", game._id).eq("teamId", args.teamId))
      .collect();
    const existing = teammates.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return { playerId: existing._id };

    if (!team.members.some((m) => m.toLowerCase() === name.toLowerCase())) {
      await ctx.db.patch(team._id, { members: [...team.members, name] });
    }

    const playerId = await ctx.db.insert("players", {
      gameId: game._id,
      teamId: args.teamId,
      name,
      joinedAt: Date.now(),
      // Stamps where in the quiz they arrived, so scoring can skip the
      // questions they were never shown. -1 while still in the lobby.
      joinedAtIndex: game.currentIndex,
    });
    return { playerId };
  },
});

export const submitAnswer = mutation({
  args: {
    playerId: v.id("players"),
    questionId: v.id("questions"),
    choiceIndex: v.optional(v.number()),
    text: v.optional(v.string()),
  },
  returns: v.object({ correct: v.boolean(), points: v.number() }),
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new ConvexError("Player not found");
    const game = await ctx.db.get(player.gameId);
    if (!game) throw new ConvexError("Game not found");
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new ConvexError("Question not found");

    if (game.status !== "question") throw new ConvexError("This question isn't open anymore");

    const questions = await lib.loadOrderedQuestions(ctx, game.quizId);
    const currentQuestion = questions[game.currentIndex];
    if (!currentQuestion || currentQuestion._id !== args.questionId) {
      throw new ConvexError("This isn't the current question");
    }
    if (game.questionEndsAt !== undefined && Date.now() > game.questionEndsAt + LATE_GRACE_MS) {
      throw new ConvexError("Time's up");
    }
    if (!lib.isEligibleForQuestion(player, game.currentIndex)) {
      throw new ConvexError("You joined during this question — you're in from the next one");
    }

    const already = await ctx.db
      .query("answers")
      .withIndex("by_player_question", (q) => q.eq("playerId", args.playerId).eq("questionId", args.questionId))
      .collect();
    if (already.length > 0) throw new ConvexError("You already answered this question");

    const elapsedRaw =
      game.questionStartedAt !== undefined ? Date.now() - game.questionStartedAt : 0;
    const elapsedMs = Math.min(Math.max(elapsedRaw, 0), question.timeLimit * 1000);

    const { correct, points } = lib.gradeAnswer(
      question,
      { choiceIndex: args.choiceIndex, text: args.text },
      elapsedMs,
    );

    await ctx.db.insert("answers", {
      gameId: game._id,
      questionId: args.questionId,
      playerId: args.playerId,
      teamId: player.teamId,
      choiceIndex: args.choiceIndex,
      text: args.text,
      correct,
      elapsedMs,
      points,
    });

    // Everyone answered? Skip the rest of the timer and reveal now.
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_game_question", (q) => q.eq("gameId", game._id).eq("questionId", args.questionId))
      .collect();
    if (players.length > 0 && answers.length >= players.length) {
      await lib.closeQuestion(ctx, game._id, { force: true, expectedIndex: game.currentIndex });
    }

    return { correct, points };
  },
});

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import * as lib from "./lib";

/** Only one quiz per tournament may be the final — clear any others. */
async function clearOtherFinals(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  exceptQuizId: Id<"quizzes">,
) {
  const quizzes = await ctx.db
    .query("quizzes")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  for (const quiz of quizzes) {
    if (quiz._id !== exceptQuizId && quiz.isFinal) {
      await ctx.db.patch(quiz._id, { isFinal: false });
    }
  }
}

export const listByTournament = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, args) => {
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", args.tournamentId))
      .collect();
    quizzes.sort((a, b) => a.order - b.order);

    return Promise.all(
      quizzes.map(async (quiz) => {
        const questions = await lib.loadOrderedQuestions(ctx, quiz._id);
        const games = await ctx.db
          .query("games")
          .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
          .collect();
        games.sort((a, b) => b._creationTime - a._creationTime);
        const lastGame = games[0] ?? null;

        return {
          ...quiz,
          questionCount: questions.length,
          totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
          lastGameId: lastGame?._id ?? null,
          lastGameStatus: lastGame?.status ?? null,
        };
      }),
    );
  },
});

export const get = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) return null;
    const tournament = await ctx.db.get(quiz.tournamentId);
    return { ...quiz, tournamentName: tournament?.name ?? "" };
  },
});

export const create = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
    description: v.string(),
    isFinal: v.optional(v.boolean()),
  },
  returns: v.id("quizzes"),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Name is required");
    const existing = await ctx.db
      .query("quizzes")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", args.tournamentId))
      .collect();
    const editToken = await lib.generateUniqueEditToken(ctx);
    const quizId = await ctx.db.insert("quizzes", {
      tournamentId: args.tournamentId,
      name,
      description: args.description,
      isFinal: args.isFinal ?? false,
      order: existing.length,
      editToken,
    });
    if (args.isFinal) await clearOtherFinals(ctx, args.tournamentId, quizId);
    return quizId;
  },
});

export const update = mutation({
  args: {
    quizId: v.id("quizzes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isFinal: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new ConvexError("Quiz not found");
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new ConvexError("Name is required");
      patch.name = name;
    }
    if (args.description !== undefined) patch.description = args.description;
    if (args.isFinal !== undefined) patch.isFinal = args.isFinal;
    await ctx.db.patch(args.quizId, patch);
    if (args.isFinal) await clearOtherFinals(ctx, quiz.tournamentId, args.quizId);
    return null;
  },
});

/** Invalidates the current edit link (e.g. if it leaked) and issues a fresh one. */
export const regenerateEditToken = mutation({
  args: { quizId: v.id("quizzes") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new ConvexError("Quiz not found");
    const editToken = await lib.generateUniqueEditToken(ctx);
    await ctx.db.patch(args.quizId, { editToken });
    return editToken;
  },
});

/** Returns the quiz's edit token, minting one lazily if it predates this feature. */
export const ensureEditToken = mutation({
  args: { quizId: v.id("quizzes") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new ConvexError("Quiz not found");
    if (quiz.editToken) return quiz.editToken;
    const editToken = await lib.generateUniqueEditToken(ctx);
    await ctx.db.patch(args.quizId, { editToken });
    return editToken;
  },
});

/**
 * Makes one quiz playable again: discards every game played against it, and with
 * them the players, answers and frozen results, while keeping the quiz and its
 * questions. The other quizzes in the tournament, and their results, are
 * untouched — this is the single-round counterpart to resetting a tournament.
 *
 * Teams are never involved: they belong to the tournament, not the quiz.
 */
export const reset = mutation({
  args: { quizId: v.id("quizzes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new ConvexError("Quiz not found");

    const games = await ctx.db
      .query("games")
      .withIndex("by_quiz", (q) => q.eq("quizId", args.quizId))
      .collect();
    for (const game of games) await lib.deleteGameCascade(ctx, game._id);

    // A tournament is only "complete" because its final quiz was played. If that
    // is the quiz being reset, the tournament is in progress again.
    const tournament = await ctx.db.get(quiz.tournamentId);
    if (tournament && tournament.completedAt !== undefined) {
      const siblings = await ctx.db
        .query("quizzes")
        .withIndex("by_tournament", (q) => q.eq("tournamentId", quiz.tournamentId))
        .collect();
      const final = siblings.find((s) => s.isFinal);
      let stillComplete = false;
      if (final) {
        const finalGames = await ctx.db
          .query("games")
          .withIndex("by_quiz", (q) => q.eq("quizId", final._id))
          .collect();
        stillComplete = finalGames.some((g) => g.status === "finished");
      }
      if (!stillComplete) {
        await ctx.db.patch(quiz.tournamentId, { completedAt: undefined });
      }
    }
    return null;
  },
});

export const remove = mutation({
  args: { quizId: v.id("quizzes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) return null;
    await lib.deleteQuizCascade(ctx, args.quizId);
    return null;
  },
});

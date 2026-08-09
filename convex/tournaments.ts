import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import * as lib from "./lib";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const tournaments = await ctx.db.query("tournaments").collect();
    tournaments.sort((a, b) => b._creationTime - a._creationTime);

    return Promise.all(
      tournaments.map(async (t) => {
        const teams = await ctx.db
          .query("teams")
          .withIndex("by_tournament", (q) => q.eq("tournamentId", t._id))
          .collect();
        const quizzes = await ctx.db
          .query("quizzes")
          .withIndex("by_tournament", (q) => q.eq("tournamentId", t._id))
          .collect();

        // A quiz counts as "played" once it has at least one finished game.
        let playedCount = 0;
        for (const quiz of quizzes) {
          const games = await ctx.db
            .query("games")
            .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
            .collect();
          if (games.some((g) => g.status === "finished")) playedCount++;
        }

        return {
          _id: t._id,
          _creationTime: t._creationTime,
          name: t.name,
          description: t.description,
          completedAt: t.completedAt,
          teamCount: teams.length,
          quizCount: quizzes.length,
          playedCount,
        };
      }),
    );
  },
});

export const get = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, args) => ctx.db.get(args.tournamentId),
});

export const create = mutation({
  args: { name: v.string(), description: v.optional(v.string()) },
  returns: v.id("tournaments"),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Name is required");
    return ctx.db.insert("tournaments", { name, description: args.description });
  },
});

export const update = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament) throw new ConvexError("Tournament not found");
    const patch: { name?: string; description?: string } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new ConvexError("Name is required");
      patch.name = name;
    }
    if (args.description !== undefined) patch.description = args.description;
    await ctx.db.patch(args.tournamentId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { tournamentId: v.id("tournaments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament) return null;
    await lib.deleteTournamentCascade(ctx, args.tournamentId);
    return null;
  },
});

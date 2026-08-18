import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Roster members excused from a single quiz. Names are compared case-insensitively
 * so an excusal survives the roster being retyped with different capitalisation.
 */
const key = (name: string) => name.trim().toLowerCase();

export const listByQuiz = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) =>
    ctx.db
      .query("excusals")
      .withIndex("by_quiz", (q) => q.eq("quizId", args.quizId))
      .collect(),
});

export const setExcused = mutation({
  args: {
    quizId: v.id("quizzes"),
    teamId: v.id("teams"),
    name: v.string(),
    excused: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("A name is required");

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new ConvexError("Quiz not found");
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new ConvexError("Team not found");
    if (team.tournamentId !== quiz.tournamentId) {
      throw new ConvexError("That team isn't part of this tournament");
    }

    const existing = (
      await ctx.db
        .query("excusals")
        .withIndex("by_quiz_team", (q) =>
          q.eq("quizId", args.quizId).eq("teamId", args.teamId),
        )
        .collect()
    ).filter((e) => key(e.name) === key(name));

    if (args.excused) {
      // Idempotent, and self-healing if duplicates ever crept in.
      if (existing.length === 0) {
        await ctx.db.insert("excusals", { quizId: args.quizId, teamId: args.teamId, name });
      }
      for (const dupe of existing.slice(1)) await ctx.db.delete(dupe._id);
    } else {
      for (const row of existing) await ctx.db.delete(row._id);
    }
    return null;
  },
});

/**
 * Names excused from this quiz for one team, lowercased for comparison.
 */
export async function excusedNamesFor(
  ctx: QueryCtx | MutationCtx,
  quizId: Id<"quizzes">,
  teamId: Id<"teams">,
): Promise<Set<string>> {
  const rows = await ctx.db
    .query("excusals")
    .withIndex("by_quiz_team", (q) => q.eq("quizId", quizId).eq("teamId", teamId))
    .collect();
  return new Set(rows.map((r) => key(r.name)));
}

/**
 * How many of a team's excused members actually stayed away.
 *
 * Somebody marked unavailable who turns up anyway is simply present: they are
 * already in `playersJoined`, so leaving them out of the roster too would let
 * attendance exceed 100%.
 */
export async function effectiveExcusedCount(
  ctx: QueryCtx | MutationCtx,
  quizId: Id<"quizzes">,
  teamId: Id<"teams">,
  joinedNames: string[],
): Promise<number> {
  const excused = await excusedNamesFor(ctx, quizId, teamId);
  if (excused.size === 0) return 0;
  const present = new Set(joinedNames.map(key));
  let count = 0;
  for (const name of excused) if (!present.has(name)) count++;
  return count;
}

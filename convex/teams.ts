import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import * as lib from "./lib";

const MAX_TEAMS = 10;

export const listByTournament = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", args.tournamentId))
      .collect();
    return teams.sort((a, b) => a.order - b.order);
  },
});

export const create = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
    color: v.string(),
    iconId: v.optional(v.id("_storage")),
    members: v.optional(v.array(v.string())),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Name is required");
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", args.tournamentId))
      .collect();
    if (existing.length >= MAX_TEAMS) throw new ConvexError("Maximum of 10 teams");
    return ctx.db.insert("teams", {
      tournamentId: args.tournamentId,
      name,
      color: args.color,
      iconId: args.iconId,
      members: args.members ?? [],
      order: existing.length,
    });
  },
});

export const update = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    iconId: v.optional(v.union(v.id("_storage"), v.null())),
    members: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new ConvexError("Team not found");
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new ConvexError("Name is required");
      patch.name = name;
    }
    if (args.color !== undefined) patch.color = args.color;
    if (args.iconId !== undefined) patch.iconId = args.iconId === null ? undefined : args.iconId;
    if (args.members !== undefined) patch.members = args.members;
    await ctx.db.patch(args.teamId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;
    await lib.deleteTeamCascade(ctx, team);
    return null;
  },
});

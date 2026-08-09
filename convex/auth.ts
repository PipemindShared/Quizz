import { v } from "convex/values";
import { query } from "./_generated/server";

/** Simple shared-passphrase gate for /admin — no user accounts. */
export const check = query({
  args: { passphrase: v.string() },
  returns: v.boolean(),
  handler: async (_ctx, args) => {
    const expected = process.env.ADMIN_PASSPHRASE ?? "quiz";
    return args.passphrase === expected;
  },
});

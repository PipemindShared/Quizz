import { motion, useReducedMotion } from "framer-motion";
import { Hourglass } from "lucide-react";

/**
 * Shown to a player who joined while a question was already open. They sit that
 * one out — answering with only part of the clock left would be both unfair to
 * them and unfair to everyone who had the full time — and start scoring from
 * the next question.
 *
 * Their team is not penalised for the questions they missed: scoring averages
 * each question over only the players who were present when it opened.
 */
export default function PlayerWaiting({ teamColor }: { teamColor: string }) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <motion.div
        className="grid h-20 w-20 place-items-center rounded-full"
        style={{ backgroundColor: `${teamColor}22`, color: teamColor }}
        animate={reducedMotion ? undefined : { scale: [1, 1.06, 1] }}
        transition={
          reducedMotion
            ? undefined
            : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <Hourglass className="h-9 w-9" />
      </motion.div>

      <div>
        <h1 className="font-display text-2xl font-bold text-white">You&apos;re in</h1>
        <p className="mt-2 text-balance text-sm text-white/60">
          A question is already running. You&apos;ll join in on the next one — hold tight.
        </p>
      </div>

      <p className="text-xs text-white/35">
        The questions you missed won&apos;t count against your team.
      </p>
    </div>
  );
}

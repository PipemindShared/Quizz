import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CircleCheck, CircleX, Sparkles, Zap } from "lucide-react";
import type { MyAnswer, PlayQuestion, Reveal } from "./types";
import { burst } from "../lib/celebrate";
import { cn } from "../lib/utils";

export default function PlayerReveal(props: {
  question: PlayQuestion;
  reveal: Reveal;
  myAnswer: MyAnswer | null;
  totalPoints: number;
}) {
  const { question, reveal, myAnswer, totalPoints } = props;
  const reducedMotion = useReducedMotion();

  const noAnswer = myAnswer === null;
  const correct = !noAnswer && reveal.myCorrect === true;
  const wrong = !noAnswer && reveal.myCorrect === false;

  const firedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (correct && firedForRef.current !== question._id) {
      firedForRef.current = question._id;
      burst();
    }
  }, [correct, question._id]);

  const myChoiceLabel =
    myAnswer?.choiceIndex !== undefined
      ? question.choices[myAnswer.choiceIndex]?.text
      : myAnswer?.text;

  const correctLabel =
    reveal.correctChoice !== undefined
      ? question.choices[reveal.correctChoice]?.text
      : reveal.correctText;

  const tint = correct ? "mint" : wrong ? "siren" : "neutral";

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6">
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.4 }}
        className={cn(
          "glass flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center",
          tint === "mint" && "border-mint/40",
          tint === "siren" && "border-siren/40",
        )}
      >
        {correct ? (
          <>
            <div className="grid h-16 w-16 place-items-center rounded-full bg-mint/15 text-mint">
              <CircleCheck className="h-9 w-9" />
            </div>
            <p className="font-display text-2xl font-extrabold text-mint">Correct!</p>
            <p className="font-display text-lg font-bold text-white">
              +{reveal.myPoints} points
            </p>
          </>
        ) : wrong ? (
          <>
            <div className="grid h-16 w-16 place-items-center rounded-full bg-siren/15 text-siren">
              <CircleX className="h-9 w-9" />
            </div>
            <p className="font-display text-2xl font-extrabold text-siren">Not quite</p>
            {myChoiceLabel ? (
              <p className="text-sm text-white/60">
                You answered: <span className="text-white/90">{myChoiceLabel}</span>
              </p>
            ) : null}
            {correctLabel ? (
              <p className="text-sm text-white/60">
                Correct answer: <span className="font-semibold text-mint">{correctLabel}</span>
              </p>
            ) : null}
          </>
        ) : (
          <>
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white/50">
              <CircleX className="h-9 w-9" />
            </div>
            <p className="font-display text-2xl font-extrabold text-white/70">
              You didn&apos;t answer in time
            </p>
            {correctLabel ? (
              <p className="text-sm text-white/60">
                Correct answer: <span className="font-semibold text-mint">{correctLabel}</span>
              </p>
            ) : null}
          </>
        )}

        {reveal.bestPlayer?.isMe ? (
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reducedMotion ? 0 : 0.2 }}
            className="mt-3 flex items-center gap-2 rounded-full bg-sun/15 px-4 py-2 font-display text-sm font-bold text-sun"
          >
            <Zap className="h-4 w-4" />
            FASTEST CORRECT ANSWER
          </motion.div>
        ) : reveal.bestPlayer ? (
          <div
            className="mt-3 flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60"
            style={{ color: reveal.bestPlayer.teamColor }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {reveal.bestPlayer.name} ({reveal.bestPlayer.teamName}) was fastest
          </div>
        ) : null}
      </motion.div>

      <div className="mt-4 text-center font-display text-sm font-semibold text-white/50">
        Your total: {totalPoints} pts
      </div>
    </div>
  );
}

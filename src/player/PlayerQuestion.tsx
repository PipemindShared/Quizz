import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Check, Clock, LoaderCircle } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MyAnswer, PlayQuestion } from "./types";
import { useCountdown } from "../lib/useCountdown";
import StorageImage from "../components/StorageImage";
import { cn, DIFFICULTY } from "../lib/utils";

function errorMessage(err: unknown): string {
  if (err instanceof ConvexError) {
    return typeof err.data === "string" ? err.data : "Something went wrong.";
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

export default function PlayerQuestion(props: {
  playerId: Id<"players">;
  question: PlayQuestion;
  myAnswer: MyAnswer | null;
  answeredCount: number;
  playerCount: number;
  myTeamColor: string;
  questionStartedAt: number | undefined;
  questionEndsAt: number | undefined;
}) {
  const {
    playerId,
    question,
    myAnswer,
    answeredCount,
    playerCount,
    myTeamColor,
    questionStartedAt,
    questionEndsAt,
  } = props;

  const submitAnswer = useMutation(api.play.submitAnswer);
  const reducedMotion = useReducedMotion();
  const { secondsLeft, ratio, expired } = useCountdown(
    questionStartedAt,
    questionEndsAt,
  );

  const [locking, setLocking] = useState(false);
  const lockingRef = useRef(false);
  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const locked = myAnswer !== null || pendingChoice !== null || pendingText !== null;

  async function handleSubmit(args: { choiceIndex?: number; text?: string }) {
    if (lockingRef.current || myAnswer !== null || expired) return;
    lockingRef.current = true;
    setLocking(true);
    setSubmitError(null);
    if (args.choiceIndex !== undefined) setPendingChoice(args.choiceIndex);
    if (args.text !== undefined) setPendingText(args.text);
    try {
      await submitAnswer({ playerId, questionId: question._id, ...args });
    } catch (err) {
      setSubmitError(errorMessage(err));
      setPendingChoice(null);
      setPendingText(null);
    } finally {
      lockingRef.current = false;
      setLocking(false);
    }
  }

  const difficulty = DIFFICULTY[question.points];
  const urgent = secondsLeft <= 5 && !expired;

  const lockedChoiceIndex = myAnswer?.choiceIndex ?? pendingChoice ?? undefined;
  const lockedText = myAnswer?.text ?? pendingText ?? undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-ink/90 px-4 pt-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-sm font-semibold text-white/70">
            Question {question.number} / {question.total}
          </span>
          <span
            className="rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wide"
            style={{
              backgroundColor: difficulty ? `${difficulty.color}22` : "rgba(255,255,255,0.08)",
              color: difficulty ? difficulty.color : "#ffffff",
              border: `1px solid ${difficulty ? `${difficulty.color}55` : "rgba(255,255,255,0.2)"}`,
            }}
          >
            {difficulty ? difficulty.label : "Question"}
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className={cn("h-full rounded-full", urgent ? "bg-siren" : "bg-neon")}
            initial={false}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ ease: "linear", duration: reducedMotion ? 0 : 0.2 }}
          />
        </div>
        <div
          className={cn(
            "mt-1.5 flex items-center gap-1 font-display text-xs font-semibold",
            urgent ? "animate-pulse text-siren" : "text-white/50",
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {expired ? "Time's up" : `${secondsLeft}s left`}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-4 py-5">
        <div>
          <h1 className="text-balance text-xl font-bold leading-snug text-white">
            {question.prompt}
          </h1>
          {question.promptImageId ? (
            <div className="mt-3 overflow-hidden rounded-2xl">
              <StorageImage
                storageId={question.promptImageId}
                alt=""
                className="max-h-64 w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        {expired && myAnswer === null && pendingChoice === null && pendingText === null ? (
          <div className="glass flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <Clock className="h-8 w-8 text-white/40" />
            <p className="font-display text-lg font-semibold text-white/80">
              Time&apos;s up
            </p>
            <p className="text-sm text-white/50">You didn&apos;t answer in time.</p>
          </div>
        ) : locked ? (
          <LockedInPanel
            question={question}
            choiceIndex={lockedChoiceIndex}
            text={lockedText}
            answeredCount={answeredCount}
            playerCount={playerCount}
            teamColor={myTeamColor}
          />
        ) : (
          <AnswerInput
            question={question}
            locking={locking}
            expired={expired}
            textValue={textValue}
            setTextValue={setTextValue}
            onSubmit={handleSubmit}
          />
        )}

        {submitError ? (
          <div className="glass-soft border-siren/40 px-4 py-3 text-sm text-siren">
            {submitError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LockedInPanel(props: {
  question: PlayQuestion;
  choiceIndex: number | undefined;
  text: string | undefined;
  answeredCount: number;
  playerCount: number;
  teamColor: string;
}) {
  const { question, choiceIndex, text, answeredCount, playerCount, teamColor } = props;
  const choice =
    choiceIndex !== undefined ? question.choices[choiceIndex] : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center"
      style={{ boxShadow: `0 0 0 1px ${teamColor}40` }}
    >
      <div
        className="grid h-14 w-14 place-items-center rounded-full"
        style={{ backgroundColor: `${teamColor}22`, color: teamColor }}
      >
        <Check className="h-7 w-7" />
      </div>
      <p className="font-display text-lg font-bold text-white">You&apos;re locked in</p>
      {choice ? (
        <p className="max-w-xs text-balance text-sm text-white/70">
          {choice.text ?? "Your pick"}
        </p>
      ) : text ? (
        <p className="max-w-xs text-balance text-sm text-white/70">&ldquo;{text}&rdquo;</p>
      ) : null}
      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-white/40">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        {answeredCount} of {playerCount} have answered
      </p>
    </motion.div>
  );
}

function AnswerInput(props: {
  question: PlayQuestion;
  locking: boolean;
  expired: boolean;
  textValue: string;
  setTextValue: (v: string) => void;
  onSubmit: (args: { choiceIndex?: number; text?: string }) => void;
}) {
  const { question, locking, expired, textValue, setTextValue, onSubmit } = props;
  const disabled = locking || expired;

  if (question.answerKind === "text_input") {
    const trimmed = textValue.trim();
    return (
      <div className="flex flex-col gap-3">
        <input
          type="text"
          autoCapitalize="off"
          autoComplete="off"
          disabled={disabled}
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder="Type your answer"
          className="field text-base"
        />
        <button
          type="button"
          disabled={disabled || trimmed.length === 0}
          onClick={() => onSubmit({ text: trimmed })}
          className="btn-primary min-h-11 w-full text-base"
        >
          Submit
        </button>
      </div>
    );
  }

  if (question.answerKind === "text_choice") {
    return (
      <div className="flex flex-col gap-2.5">
        {question.choices.map((choice, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onSubmit({ choiceIndex: i })}
            className="glass-soft flex min-h-11 w-full items-center gap-3 px-4 py-3.5 text-left text-base font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 font-display text-xs font-bold">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="text-balance">{choice.text}</span>
          </button>
        ))}
      </div>
    );
  }

  // image_choice / image_text_choice
  return (
    <div className="grid grid-cols-2 gap-2">
      {question.choices.map((choice, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onSubmit({ choiceIndex: i })}
          className="relative aspect-square w-full overflow-hidden rounded-2xl transition active:scale-[0.97] disabled:opacity-40"
        >
          <StorageImage
            storageId={choice.imageId}
            alt={choice.text ?? ""}
            className="h-full w-full"
            fallback={<div className="h-full w-full bg-white/10" />}
          />
          {question.answerKind === "image_text_choice" && choice.text ? (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6">
              <span className="text-balance text-sm font-semibold text-white">
                {choice.text}
              </span>
            </div>
          ) : null}
        </button>
      ))}
    </div>
  );
}

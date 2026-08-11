import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Check, Clock, LoaderCircle, RotateCcw, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import Backdrop from "../components/Backdrop";
import StorageImage from "../components/StorageImage";
import {
  cn,
  DIFFICULTY,
  formatScore,
  maxQuestionPoints,
  normalizeAnswer,
  pointsForCorrect,
} from "../lib/utils";

type Question = Doc<"questions">;

function gradeLocally(
  question: Question,
  submission: { choiceIndex?: number; text?: string },
): boolean {
  if (question.answerKind === "text_input") {
    const caseSensitive = question.caseSensitive ?? false;
    const given = normalizeAnswer(submission.text ?? "", caseSensitive);
    const candidates = [question.correctText, ...(question.acceptedAnswers ?? [])]
      .filter((c): c is string => !!c && c.trim().length > 0)
      .map((c) => normalizeAnswer(c, caseSensitive));
    return given.length > 0 && candidates.includes(given);
  }
  return submission.choiceIndex !== undefined && submission.choiceIndex === question.correctChoice;
}

export default function QuizTest() {
  const { quizId } = useParams() as { quizId: Id<"quizzes"> };
  const quiz = useQuery(api.quizzes.get, { quizId });
  const questions = useQuery(api.questions.listByQuiz, { quizId });

  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [choiceIndex, setChoiceIndex] = useState<number | null>(null);
  const [textValue, setTextValue] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [openedAt, setOpenedAt] = useState<number>(() => Date.now());
  const [earned, setEarned] = useState<number | null>(null);

  const question = questions?.[index];

  useEffect(() => {
    if (!question || answered) return;
    setSecondsLeft(question.timeLimit);
    setOpenedAt(Date.now());
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return null;
        if (s <= 1) {
          clearInterval(t);
          setAnswered(true);
          setCorrect(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [question?._id]);

  function submit(args: { choiceIndex?: number; text?: string }) {
    if (!question || answered) return;
    const isCorrect = gradeLocally(question, args);
    setAnswered(true);
    setCorrect(isCorrect);
    if (args.choiceIndex !== undefined) setChoiceIndex(args.choiceIndex);
    if (args.text !== undefined) setSubmittedText(args.text);
    const elapsedMs = Math.min(
      Math.max(Date.now() - openedAt, 0),
      question.timeLimit * 1000,
    );
    const got = isCorrect
      ? pointsForCorrect(question.points, elapsedMs, question.timeLimit)
      : 0;
    setEarned(got);
    if (got) setScore((s) => s + got);
  }

  function next() {
    setAnswered(false);
    setCorrect(false);
    setChoiceIndex(null);
    setTextValue("");
    setSubmittedText("");
    setEarned(null);
    setIndex((i) => i + 1);
  }

  function restart() {
    setIndex(0);
    setAnswered(false);
    setCorrect(false);
    setChoiceIndex(null);
    setTextValue("");
    setSubmittedText("");
    setEarned(null);
    setScore(0);
  }

  if (quiz === undefined || questions === undefined) {
    return (
      <>
        <Backdrop variant="calm" />
        <div className="mx-auto grid min-h-dvh w-full max-w-lg place-items-center px-4">
          <LoaderCircle className="h-8 w-8 animate-spin text-neon" />
        </div>
      </>
    );
  }

  if (quiz === null) {
    return (
      <>
        <Backdrop variant="calm" />
        <div className="mx-auto w-full max-w-lg px-4 py-12">
          <div className="glass p-6">
            <h2 className="font-display text-xl text-white">Not found</h2>
            <p className="mt-1 text-sm text-white/60">
              This quiz doesn't exist or was deleted.
            </p>
          </div>
        </div>
      </>
    );
  }

  const totalPoints = questions.reduce((s, q) => s + maxQuestionPoints(q.points), 0);
  const finished = index >= questions.length;

  return (
    <>
      <Backdrop variant="calm" />
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-bold text-white">{quiz.name}</p>
            <p className="text-xs text-white/50">Test mode — answers aren't recorded</p>
          </div>
          <button className="btn-ghost text-xs" onClick={restart}>
            <RotateCcw className="h-3.5 w-3.5" />
            Restart
          </button>
        </div>

        {questions.length === 0 ? (
          <div className="glass-soft border-dashed p-6 text-center text-sm text-white/60">
            This quiz has no questions yet.
          </div>
        ) : finished ? (
          <div className="glass flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-display text-2xl font-bold text-white">Done</p>
            <p className="text-white/70">
              {formatScore(score)} / {formatScore(totalPoints)} points
            </p>
            <button className="btn-primary mt-2" onClick={restart}>
              Try again
            </button>
          </div>
        ) : question ? (
          <div className="glass flex flex-1 flex-col gap-5 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-sm font-semibold text-white/70">
                Question {index + 1} / {questions.length}
              </span>
              <span
                className="rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: `${DIFFICULTY[question.points]?.color ?? "#ffffff"}22`,
                  color: DIFFICULTY[question.points]?.color ?? "#ffffff",
                }}
              >
                {DIFFICULTY[question.points]?.label ?? "Question"}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center gap-1 font-display text-xs font-semibold",
                secondsLeft !== null && secondsLeft <= 5 && !answered
                  ? "animate-pulse text-siren"
                  : "text-white/50",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {answered ? "Time's up" : `${secondsLeft ?? question.timeLimit}s left`}
            </div>

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

            {answered ? (
              <ResultPanel
                question={question}
                correct={correct}
                choiceIndex={choiceIndex}
                text={submittedText}
                earned={earned}
              />
            ) : (
              <AnswerInput
                question={question}
                textValue={textValue}
                setTextValue={setTextValue}
                onSubmit={submit}
              />
            )}

            {answered && (
              <button className="btn-primary mt-auto" onClick={next}>
                {index + 1 < questions.length ? "Next question" : "See results"}
              </button>
            )}
          </div>
        ) : null}

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-white/40 hover:text-white/60">
            Quiz Arena
          </Link>
        </div>
      </div>
    </>
  );
}

function ResultPanel({
  question,
  correct,
  choiceIndex,
  text,
  earned,
}: {
  question: Question;
  correct: boolean;
  choiceIndex: number | null;
  text: string;
  earned: number | null;
}) {
  const correctChoiceText =
    question.answerKind !== "text_input" && question.correctChoice !== undefined
      ? question.choices[question.correctChoice]?.text
      : undefined;

  return (
    <div
      className={cn(
        "glass-soft flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center",
      )}
      style={{ boxShadow: `0 0 0 1px ${correct ? "#3ddc9755" : "#ff547055"}` }}
    >
      <div
        className="grid h-12 w-12 place-items-center rounded-full"
        style={{
          backgroundColor: correct ? "#3ddc9722" : "#ff547022",
          color: correct ? "#3ddc97" : "#ff5470",
        }}
      >
        {correct ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}
      </div>
      <p className="font-display text-lg font-bold text-white">
        {correct ? "Correct!" : "Not quite"}
      </p>
      {correct && earned !== null && (
        <p className="font-display text-sm font-bold text-mint">
          +{formatScore(earned)} of {formatScore(maxQuestionPoints(question.points))}
        </p>
      )}
      {!correct && (
        <p className="max-w-xs text-balance text-sm text-white/70">
          Correct answer: {question.answerKind === "text_input" ? question.correctText : correctChoiceText}
        </p>
      )}
      {question.answerKind === "text_input" && text && (
        <p className="text-xs text-white/40">You typed &ldquo;{text}&rdquo;</p>
      )}
      {question.explanation && (
        <p className="max-w-xs text-balance text-xs leading-snug text-sky">
          {question.explanation}
        </p>
      )}
      {question.answerKind !== "text_input" && choiceIndex !== null && (
        <p className="text-xs text-white/40">
          You picked &ldquo;{question.choices[choiceIndex]?.text ?? String.fromCharCode(65 + choiceIndex)}&rdquo;
        </p>
      )}
    </div>
  );
}

function AnswerInput({
  question,
  textValue,
  setTextValue,
  onSubmit,
}: {
  question: Question;
  textValue: string;
  setTextValue: (v: string) => void;
  onSubmit: (args: { choiceIndex?: number; text?: string }) => void;
}) {
  if (question.answerKind === "text_input") {
    const trimmed = textValue.trim();
    return (
      <div className="flex flex-col gap-3">
        <input
          type="text"
          autoCapitalize="off"
          autoComplete="off"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder="Type your answer"
          className="field text-base"
        />
        <button
          type="button"
          disabled={trimmed.length === 0}
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
            onClick={() => onSubmit({ choiceIndex: i })}
            className="glass-soft flex min-h-11 w-full items-center gap-3 px-4 py-3.5 text-left text-base font-medium text-white transition active:scale-[0.98]"
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

  return (
    <div className="grid grid-cols-2 gap-2">
      {question.choices.map((choice, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSubmit({ choiceIndex: i })}
          className="relative aspect-square w-full overflow-hidden rounded-2xl transition active:scale-[0.97]"
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

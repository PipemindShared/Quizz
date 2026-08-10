import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { LoaderCircle, X, Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import ImageUpload from "../components/ImageUpload";
import { ANSWER_KIND_LABEL, DIFFICULTY, clamp, readableOn } from "../lib/utils";

type AnswerKind = Doc<"questions">["answerKind"];

type Props = {
  quizId: Id<"quizzes">;
  question?: Doc<"questions">;
  onDone: () => void;
};

type ChoiceDraft = { text: string; imageId?: Id<"_storage"> };

const ANSWER_KINDS: AnswerKind[] = [
  "text_input",
  "text_choice",
  "image_choice",
  "image_text_choice",
];

const TIME_PRESETS = [5, 10, 15, 20, 30];
const POINT_VALUES = [1, 2, 3] as const;

function errMsg(e: unknown): string {
  return e instanceof ConvexError ? (e.data as string) : "Something went wrong";
}

export default function QuestionEditor({ quizId, question, onDone }: Props) {
  const isEdit = !!question;
  const create = useMutation(api.questions.create);
  const update = useMutation(api.questions.update);

  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [promptImageId, setPromptImageId] = useState<Id<"_storage"> | undefined>(
    question?.promptImageId ?? undefined,
  );

  const [answerKind, setAnswerKind] = useState<AnswerKind>(
    question?.answerKind ?? "text_choice",
  );

  // Shared across text_choice / image_choice / image_text_choice — always length 4.
  const [choices, setChoices] = useState<ChoiceDraft[]>(() => {
    const base: ChoiceDraft[] = [0, 1, 2, 3].map(() => ({ text: "" }));
    question?.choices?.forEach((c, i) => {
      if (i < 4) base[i] = { text: c.text ?? "", imageId: c.imageId };
    });
    return base;
  });
  const [correctChoice, setCorrectChoice] = useState<number>(
    question?.correctChoice ?? 0,
  );

  // text_input slice (fully separate)
  const [correctText, setCorrectText] = useState(question?.correctText ?? "");
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>(
    question?.acceptedAnswers ?? [],
  );
  const [acceptedDraft, setAcceptedDraft] = useState("");
  const [caseSensitive, setCaseSensitive] = useState<boolean>(
    question?.caseSensitive ?? false,
  );

  const [points, setPoints] = useState<number>(question?.points ?? 2);
  const [timeLimit, setTimeLimit] = useState<number>(question?.timeLimit ?? 10);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setChoiceText(i: number, text: string) {
    setChoices((prev) => prev.map((c, idx) => (idx === i ? { ...c, text } : c)));
  }
  function setChoiceImage(i: number, imageId: Id<"_storage"> | undefined) {
    setChoices((prev) => prev.map((c, idx) => (idx === i ? { ...c, imageId } : c)));
  }

  function addAccepted() {
    const v = acceptedDraft.trim();
    if (!v) return;
    if (acceptedAnswers.includes(v)) {
      setAcceptedDraft("");
      return;
    }
    setAcceptedAnswers((prev) => [...prev, v]);
    setAcceptedDraft("");
  }
  function removeAccepted(idx: number) {
    setAcceptedAnswers((prev) => prev.filter((_, i) => i !== idx));
  }

  function errorFor(): string | null {
    if (!prompt.trim()) return "Add a question prompt";
    if (answerKind === "text_input") {
      if (!correctText.trim()) return "Enter the correct answer";
      return null;
    }
    // *_choice kinds
    if (correctChoice < 0 || correctChoice > 3) return "Pick which choice is correct";
    if (answerKind === "text_choice" || answerKind === "image_text_choice") {
      if (choices.some((c) => !c.text.trim())) return "Every choice needs text";
    }
    if (answerKind === "image_choice" || answerKind === "image_text_choice") {
      if (choices.some((c) => !c.imageId)) return "Every choice needs an image";
    }
    return null;
  }

  function buildInput() {
    const common = {
      prompt: prompt.trim(),
      promptImageId: isEdit ? (promptImageId ?? null) : promptImageId,
      answerKind,
      points,
      timeLimit,
    };
    if (answerKind === "text_input") {
      return {
        ...common,
        choices: [],
        correctText: correctText.trim(),
        acceptedAnswers: acceptedAnswers.map((a) => a.trim()).filter(Boolean),
        caseSensitive,
        correctChoice: undefined,
      };
    }
    const outChoices = choices.map((c) => ({
      text: c.text.trim() || undefined,
      imageId: c.imageId,
    }));
    return {
      ...common,
      choices: outChoices,
      correctChoice,
      correctText: undefined,
    };
  }

  async function save() {
    const msg = errorFor();
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const input = buildInput();
      if (isEdit) {
        await update({ questionId: question!._id, ...input });
      } else {
        await create({ quizId, ...input });
      }
      onDone();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg text-white">
          {isEdit ? "Edit question" : "New question"}
        </h3>
        <button
          type="button"
          className="btn-ghost px-2 py-2"
          onClick={onDone}
          aria-label="Close editor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="glass-soft mb-4 flex items-center justify-between gap-3 border-siren/40 px-4 py-3 text-sm text-siren">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <div>
          <label className="label">Question</label>
          <textarea
            className="field"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What is the capital of Canada?"
          />
        </div>

        <ImageUpload
          shape="wide"
          label="Prompt image (optional)"
          value={promptImageId}
          onChange={setPromptImageId}
        />

        <div>
          <label className="label">Answer type</label>
          <div className="flex flex-wrap gap-2">
            {ANSWER_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAnswerKind(k)}
                className={
                  answerKind === k
                    ? "btn-primary px-3 py-1.5 text-sm"
                    : "btn-ghost px-3 py-1.5 text-sm"
                }
              >
                {ANSWER_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        {answerKind === "text_input" ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="label">Correct answer</label>
              <input
                className="field"
                value={correctText}
                onChange={(e) => setCorrectText(e.target.value)}
                placeholder="Ottawa"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              Case sensitive
            </label>
            <div>
              <label className="label">Also accept</label>
              <div className="mb-2 flex flex-wrap gap-2">
                {acceptedAnswers.map((a, i) => (
                  <span
                    key={`${a}-${i}`}
                    className="glass-soft inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-white/80"
                  >
                    {a}
                    <button
                      type="button"
                      onClick={() => removeAccepted(i)}
                      aria-label={`Remove ${a}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                className="field"
                value={acceptedDraft}
                onChange={(e) => setAcceptedDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAccepted();
                  }
                }}
                placeholder="Add an alternate spelling and press Enter"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {choices.map((c, i) => (
              <div key={i} className="glass-soft flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="radio"
                      name="correctChoice"
                      checked={correctChoice === i}
                      onChange={() => setCorrectChoice(i)}
                    />
                    Correct answer
                  </label>
                  {correctChoice === i && (
                    <span className="text-xs text-mint">✓ correct</span>
                  )}
                </div>
                {(answerKind === "image_choice" ||
                  answerKind === "image_text_choice") && (
                  <ImageUpload
                    shape="square"
                    value={c.imageId}
                    onChange={(id) => setChoiceImage(i, id)}
                  />
                )}
                {(answerKind === "text_choice" ||
                  answerKind === "image_text_choice") && (
                  <input
                    className="field"
                    value={c.text}
                    onChange={(e) => setChoiceText(i, e.target.value)}
                    placeholder={`Choice ${i + 1}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="label">Difficulty</label>
          <div className="flex flex-wrap gap-2">
            {POINT_VALUES.map((n) => {
              const d = DIFFICULTY[n]!;
              const selected = points === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPoints(n)}
                  className={selected ? "px-3 py-1.5 text-sm rounded-full" : "glass-soft px-3 py-1.5 text-sm rounded-full"}
                  style={
                    selected
                      ? { backgroundColor: d.color, color: readableOn(d.color) }
                      : { color: d.color, borderColor: d.color }
                  }
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label">Time limit</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {TIME_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeLimit(t)}
                className={
                  timeLimit === t
                    ? "btn-primary px-3 py-1.5 text-sm"
                    : "btn-ghost px-3 py-1.5 text-sm"
                }
              >
                {t}s
              </button>
            ))}
          </div>
          <input
            type="number"
            min={5}
            max={180}
            className="field w-32"
            value={timeLimit}
            onChange={(e) => setTimeLimit(clamp(Number(e.target.value) || 20, 5, 180))}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Save
          </button>
          <button type="button" className="btn-ghost" onClick={onDone}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

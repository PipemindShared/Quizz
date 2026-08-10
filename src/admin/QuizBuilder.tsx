import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FlaskConical,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import Backdrop from "../components/Backdrop";
import { ANSWER_KIND_LABEL, DIFFICULTY } from "../lib/utils";
import QuestionEditor from "./QuestionEditor";

function errMsg(e: unknown): string {
  return e instanceof ConvexError ? (e.data as string) : "Something went wrong";
}

function ConfirmButton({
  onConfirm,
  busy,
  label = "Delete",
  className = "btn-ghost text-siren",
}: {
  onConfirm: () => void;
  busy?: boolean;
  label?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  if (busy) {
    return (
      <button className={className} disabled>
        <LoaderCircle className="h-4 w-4 animate-spin" />
      </button>
    );
  }
  if (!armed) {
    return (
      <button className={className} onClick={() => setArmed(true)}>
        <Trash2 className="h-4 w-4" />
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs text-white/60">Sure?</span>
      <button
        className="btn-ghost text-siren px-3 py-1.5"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        Yes
      </button>
      <button className="btn-ghost px-3 py-1.5" onClick={() => setArmed(false)}>
        No
      </button>
    </span>
  );
}

function InlineText({
  value,
  onSave,
  className,
  placeholder,
  multiline = false,
}: {
  value: string;
  onSave: (v: string) => void | Promise<void>;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const v = draft.trim();
    if (v !== value) void onSave(v);
  };

  if (multiline) {
    return (
      <textarea
        className={className ?? "field"}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  return (
    <input
      className={className ?? "field"}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function EditLinkControls({
  quizId,
  editToken,
}: {
  quizId: Id<"quizzes">;
  editToken?: string;
}) {
  const ensureEditToken = useMutation(api.quizzes.ensureEditToken);
  const regenerate = useMutation(api.quizzes.regenerateEditToken);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function copy() {
    setBusy(true);
    try {
      const token = editToken ?? (await ensureEditToken({ quizId }));
      const url = `${window.location.origin}/quiz/${quizId}/edit/${token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  async function doRegenerate() {
    setConfirming(false);
    setBusy(true);
    try {
      await regenerate({ quizId });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="btn-ghost text-xs"
        onClick={copy}
        disabled={busy}
        title="Anyone with this link can edit this quiz, without the admin passphrase"
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : copied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
        {copied ? "Copied" : "Copy edit link"}
      </button>
      {confirming ? (
        <span className="inline-flex items-center gap-2 text-xs text-white/60">
          Old link stops working.
          <button className="btn-ghost px-3 py-1.5 text-xs text-siren" onClick={doRegenerate}>
            Confirm
          </button>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button className="btn-ghost text-xs" onClick={() => setConfirming(true)} disabled={busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          New link
        </button>
      )}
    </div>
  );
}

function TestLinkControls({ quizId }: { quizId: Id<"quizzes"> }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/quiz/${quizId}/test`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      className="btn-ghost text-xs"
      onClick={copy}
      title="Play through the quiz solo to check questions and answers — nothing is recorded"
    >
      {copied ? <Check className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
      {copied ? "Copied" : "Copy quiz test link"}
    </button>
  );
}

export default function QuizBuilder() {
  const { quizId } = useParams() as { quizId: Id<"quizzes"> };

  const quiz = useQuery(api.quizzes.get, { quizId });
  const questions = useQuery(api.questions.listByQuiz, { quizId });

  const updateQuiz = useMutation(api.quizzes.update);
  const removeQuestion = useMutation(api.questions.remove);
  const duplicateQuestion = useMutation(api.questions.duplicate);
  const reorderQuestions = useMutation(api.questions.reorder);

  const [editing, setEditing] = useState<Doc<"questions"> | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<Id<"questions"> | null>(null);

  if (quiz === undefined || questions === undefined) {
    return (
      <>
        <Backdrop variant="calm" />
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="grid place-items-center py-24">
            <LoaderCircle className="h-8 w-8 animate-spin text-neon" />
          </div>
        </div>
      </>
    );
  }

  if (quiz === null) {
    return (
      <>
        <Backdrop variant="calm" />
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="glass p-6">
            <h2 className="font-display text-xl text-white">Not found</h2>
            <p className="mt-1 text-sm text-white/60">
              This quiz doesn't exist or was deleted.
            </p>
            <Link to="/admin" className="btn-ghost mt-4 inline-flex">
              Back to tournaments
            </Link>
          </div>
        </div>
      </>
    );
  }

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const runtimeSec =
    questions.reduce((s, q) => s + q.timeLimit, 0) + questions.length * 8;

  async function saveQuiz(patch: { name?: string; description?: string }) {
    setError(null);
    try {
      await updateQuiz({ quizId, ...patch });
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function toggleFinal(next: boolean) {
    setError(null);
    try {
      await updateQuiz({ quizId, isFinal: next });
    } catch (e) {
      setError(errMsg(e));
    }
  }

  function move(index: number, dir: -1 | 1) {
    if (!questions) return;
    const ids = questions.map((q) => q._id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    setError(null);
    reorderQuestions({ quizId, orderedIds: ids }).catch((e: unknown) =>
      setError(errMsg(e)),
    );
  }

  async function doDuplicate(id: Id<"questions">) {
    setError(null);
    setBusyId(id);
    try {
      await duplicateQuestion({ questionId: id });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function doRemove(id: Id<"questions">) {
    setError(null);
    setBusyId(id);
    try {
      await removeQuestion({ questionId: id });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Backdrop variant="calm" />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to={`/admin/t/${quiz.tournamentId}`}
          className="btn-ghost mb-4 inline-flex"
        >
          {quiz.tournamentName}
        </Link>

        <div className="glass mb-6 p-5 sm:p-6">
          <InlineText
            value={quiz.name}
            onSave={(v) => saveQuiz({ name: v })}
            className="field font-display text-xl text-white"
            placeholder="Quiz name"
          />
          <InlineText
            value={quiz.description ?? ""}
            onSave={(v) => saveQuiz({ description: v })}
            className="field mt-3 text-sm text-white/70"
            placeholder="Description (optional)"
            multiline
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={quiz.isFinal}
                onChange={(e) => void toggleFinal(e.target.checked)}
              />
              Final quiz
            </label>
            {quiz.isFinal && (
              <span className="glass-soft px-2.5 py-1 text-xs text-sun">Final</span>
            )}
            <span className="text-sm text-white/50">
              Total points: {totalPoints} · Est. runtime: {fmt(runtimeSec)}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <EditLinkControls quizId={quizId} editToken={quiz.editToken} />
            <TestLinkControls quizId={quizId} />
          </div>
        </div>

        {error && (
          <div className="glass-soft mb-4 flex items-center justify-between gap-3 border-siren/40 px-4 py-3 text-sm text-siren">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {questions.length === 0 ? (
          <div className="glass-soft mb-6 border-dashed p-6 text-center text-sm text-white/60">
            No questions yet — add your first.
          </div>
        ) : (
          <div className="mb-6 flex flex-col gap-3">
            {questions.map((q, i) => (
              <div
                key={q._id}
                className="glass-soft flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-sm text-white/50">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{q.prompt}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className="glass-soft px-2 py-0.5"
                        style={{ color: DIFFICULTY[q.points]?.color }}
                      >
                        {DIFFICULTY[q.points]?.label}
                      </span>
                      <span className="glass-soft px-2 py-0.5 text-white/60">
                        {ANSWER_KIND_LABEL[q.answerKind]}
                      </span>
                      <span className="text-white/50">{q.timeLimit}s</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    className="btn-ghost px-2 py-2 disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-ghost px-2 py-2 disabled:opacity-30"
                    disabled={i === questions.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-ghost px-3 py-2"
                    onClick={() => {
                      setEditing(q);
                      setCreating(false);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    className="btn-ghost px-2 py-2"
                    onClick={() => void doDuplicate(q._id)}
                    disabled={busyId === q._id}
                    aria-label="Duplicate"
                  >
                    {busyId === q._id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <ConfirmButton
                    busy={busyId === q._id}
                    onConfirm={() => void doRemove(q._id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {!creating && !editing && (
          <button
            className="btn-primary mb-6"
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
          >
            <Plus className="h-4 w-4" />
            Add question
          </button>
        )}

        {(creating || editing) && (
          <QuestionEditor
            key={editing?._id ?? "new"}
            quizId={quizId}
            question={editing ?? undefined}
            onDone={() => {
              setEditing(null);
              setCreating(false);
            }}
          />
        )}
      </div>
    </>
  );
}

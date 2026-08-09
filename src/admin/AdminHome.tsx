import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import Backdrop from "../components/Backdrop";

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

  const commit = () => {
    const v = draft.trim();
    if (v !== value && v !== "") onSave(v);
    else if (v === "") setDraft(value);
  };

  if (multiline) {
    return (
      <textarea
        className={className}
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
      className={className}
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

export default function AdminHome() {
  const tournaments = useQuery(api.tournaments.list, {});
  const createT = useMutation(api.tournaments.create);
  const updateT = useMutation(api.tournaments.update);
  const removeT = useMutation(api.tournaments.remove);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<Id<"tournaments"> | null>(null);
  const [newName, setNewName] = useState("");

  async function handleCreate() {
    const name = newName.trim();
    if (!name || busy) return;
    setError(null);
    setBusy(true);
    try {
      await createT({ name });
      setNewName("");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: Id<"tournaments">, name: string) {
    setError(null);
    setBusyId(id);
    try {
      await updateT({ tournamentId: id, name });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: Id<"tournaments">) {
    setError(null);
    setBusyId(id);
    try {
      await removeT({ tournamentId: id });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Backdrop variant="calm" />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="grad-text font-display text-3xl font-extrabold sm:text-4xl">
              Tournaments
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Create and manage tournaments, teams and quizzes.
            </p>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <input
              className="field"
              placeholder="Tournament name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary shrink-0"
              disabled={!newName.trim() || busy}
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              New tournament
            </button>
          </form>
        </div>

        {error && (
          <div className="glass-soft mb-4 flex items-center justify-between gap-3 border-siren/40 px-4 py-3 text-sm text-siren">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {tournaments === undefined && (
          <div className="grid place-items-center py-24">
            <LoaderCircle className="h-8 w-8 animate-spin text-neon" />
          </div>
        )}

        {tournaments && tournaments.length === 0 && (
          <div className="glass-soft border-dashed px-6 py-12 text-center">
            <p className="text-white/70">No tournaments yet.</p>
            <p className="mt-1 text-sm text-white/45">
              Create your first tournament using the field above.
            </p>
          </div>
        )}

        {tournaments && tournaments.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <div key={t._id} className="glass flex flex-col gap-3 p-5">
                <InlineText
                  value={t.name}
                  onSave={(name) => handleRename(t._id, name)}
                  className="field font-display text-lg font-bold"
                  placeholder="Tournament name"
                />

                <div className="flex items-center justify-between text-sm text-white/60">
                  <span>
                    {t.teamCount} teams · {t.quizCount} quizzes
                  </span>
                  {t.completedAt ? (
                    <span className="glass-soft rounded-full px-2.5 py-1 text-xs text-mint">
                      Completed
                    </span>
                  ) : t.playedCount > 0 ? (
                    <span className="glass-soft rounded-full px-2.5 py-1 text-xs text-sun">
                      {t.playedCount} played
                    </span>
                  ) : (
                    <span className="rounded-full px-2.5 py-1 text-xs text-white/40">
                      Not played yet
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <Link to={`/admin/t/${t._id}`} className="btn-ghost">
                    Open
                  </Link>
                  <ConfirmButton
                    busy={busyId === t._id}
                    onConfirm={() => handleDelete(t._id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import {
  Check,
  ClipboardPaste,
  Link2,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import Backdrop from "../components/Backdrop";
import PresenceBonusSettings from "./PresenceBonusSettings";
import PasteTeamPanel from "./PasteTeamPanel";
import ImageUpload from "../components/ImageUpload";
import TeamBadge from "../components/TeamBadge";
import { formatScore, TEAM_COLORS } from "../lib/utils";
import { parseNames } from "../lib/parseNames";

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

function CopyEditLinkButton({
  quizId,
  editToken,
}: {
  quizId: Id<"quizzes">;
  editToken?: string;
}) {
  const ensureEditToken = useMutation(api.quizzes.ensureEditToken);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

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

  return (
    <button
      className="btn-ghost text-xs"
      onClick={copy}
      disabled={busy}
      title="Copy a link that lets someone edit just this quiz"
    >
      {busy ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : copied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Link2 className="h-4 w-4" />
      )}
      {copied ? "Copied" : "Edit link"}
    </button>
  );
}

function InlineText({
  value,
  onSave,
  className,
  placeholder,
  multiline = false,
  allowEmpty = false,
}: {
  value: string;
  onSave: (v: string) => void | Promise<void>;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  allowEmpty?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const v = draft.trim();
    if (v === value) return;
    if (v === "" && !allowEmpty) {
      setDraft(value);
      return;
    }
    onSave(v);
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

function TeamCard({
  team,
  onUpdate,
  onRemove,
  busy,
}: {
  team: Doc<"teams">;
  onUpdate: (patch: {
    name?: string;
    color?: string;
    iconId?: Id<"_storage"> | null;
    members?: string[];
  }) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const [memberDraft, setMemberDraft] = useState("");

  function addMember() {
    // Handles a pasted block as well as a single typed name, so the same field
    // serves both without a mode switch.
    const { names } = parseNames(memberDraft, team.members);
    if (names.length === 0) {
      setMemberDraft("");
      return;
    }
    onUpdate({ members: [...team.members, ...names] });
    setMemberDraft("");
  }

  /**
   * A multi-line paste is committed immediately rather than dumped into the
   * single-line input, where only the first name would have survived.
   */
  function handleMemberPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!/[\n\r\t]/.test(text)) return;
    e.preventDefault();
    const { names } = parseNames(text, team.members);
    if (names.length > 0) onUpdate({ members: [...team.members, ...names] });
    setMemberDraft("");
  }

  return (
    <div className="glass flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <TeamBadge team={team} size="lg" />
        <InlineText
          value={team.name}
          onSave={(name) => onUpdate({ name })}
          className="field font-display text-base font-bold"
          placeholder="Team name"
        />
      </div>

      <div>
        <label className="label">Color</label>
        <div className="flex flex-wrap gap-2">
          {TEAM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="h-7 w-7 rounded-full transition"
              style={{
                backgroundColor: c,
                boxShadow: team.color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined,
              }}
              onClick={() => onUpdate({ color: c })}
              aria-label={`Set team color ${c}`}
            />
          ))}
          <input
            type="color"
            value={team.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
            aria-label="Custom team color"
          />
        </div>
      </div>

      <ImageUpload
        shape="square"
        value={team.iconId}
        label="Team icon"
        onChange={(id) => onUpdate({ iconId: id ?? null })}
      />

      <div>
        <label className="label">Members</label>
        <div className="flex flex-wrap gap-2">
          {team.members.map((m, i) => (
            <span
              key={`${m}-${i}`}
              className="glass-soft inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
            >
              {m}
              <button
                onClick={() =>
                  onUpdate({ members: team.members.filter((_, idx) => idx !== i) })
                }
                aria-label={`Remove ${m}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          className="field mt-2"
          placeholder="Add member, or paste a list"
          value={memberDraft}
          onChange={(e) => setMemberDraft(e.target.value)}
          onPaste={handleMemberPaste}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addMember();
            }
          }}
        />
      </div>

      <div className="mt-1 flex justify-end">
        <ConfirmButton busy={busy} onConfirm={onRemove} />
      </div>
    </div>
  );
}

export default function TournamentBuilder() {
  const { tournamentId } = useParams() as { tournamentId: Id<"tournaments"> };

  const tournament = useQuery(api.tournaments.get, { tournamentId });
  const teams = useQuery(api.teams.listByTournament, { tournamentId });
  const quizzes = useQuery(api.quizzes.listByTournament, { tournamentId });

  const updateTournament = useMutation(api.tournaments.update);
  const createTeam = useMutation(api.teams.create);
  const updateTeam = useMutation(api.teams.update);
  const removeTeam = useMutation(api.teams.remove);
  const createQuiz = useMutation(api.quizzes.create);
  const updateQuiz = useMutation(api.quizzes.update);
  const removeQuiz = useMutation(api.quizzes.remove);
  const createGame = useMutation(api.games.create);
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [teamBusyId, setTeamBusyId] = useState<Id<"teams"> | null>(null);
  const [addTeamBusy, setAddTeamBusy] = useState(false);
  const [pastingTeam, setPastingTeam] = useState(false);
  const [quizBusyId, setQuizBusyId] = useState<Id<"quizzes"> | null>(null);
  const [createQuizBusy, setCreateQuizBusy] = useState(false);
  const [startBusyId, setStartBusyId] = useState<Id<"quizzes"> | null>(null);

  if (
    tournament === undefined ||
    teams === undefined ||
    quizzes === undefined
  ) {
    return (
      <>
        <Backdrop variant="calm" />
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="grid place-items-center py-24">
            <LoaderCircle className="h-8 w-8 animate-spin text-neon" />
          </div>
        </div>
      </>
    );
  }

  if (tournament === null) {
    return (
      <>
        <Backdrop variant="calm" />
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="glass p-8 text-center">
            <h1 className="font-display text-2xl font-bold">Not found</h1>
            <p className="mt-1 text-white/60">This tournament doesn't exist anymore.</p>
            <Link to="/admin" className="btn-ghost mt-4 inline-flex">
              Back to tournaments
            </Link>
          </div>
        </div>
      </>
    );
  }

  async function handleTeamUpdate(
    teamId: Id<"teams">,
    patch: {
      name?: string;
      color?: string;
      iconId?: Id<"_storage"> | null;
      members?: string[];
    },
  ) {
    setError(null);
    setTeamBusyId(teamId);
    try {
      await updateTeam({ teamId, ...patch });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setTeamBusyId(null);
    }
  }

  async function handleTeamRemove(teamId: Id<"teams">) {
    setError(null);
    setTeamBusyId(teamId);
    try {
      await removeTeam({ teamId });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setTeamBusyId(null);
    }
  }

  async function handleAddTeam() {
    if (!teams || teams.length >= 10) return;
    setError(null);
    setAddTeamBusy(true);
    try {
      await createTeam({
        tournamentId,
        name: `Team ${teams.length + 1}`,
        color: TEAM_COLORS[teams.length % TEAM_COLORS.length]!,
        members: [],
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setAddTeamBusy(false);
    }
  }

  async function handlePasteTeam(name: string, members: string[]) {
    if (!teams || teams.length >= 10) return;
    setError(null);
    setAddTeamBusy(true);
    try {
      await createTeam({
        tournamentId,
        name,
        color: TEAM_COLORS[teams.length % TEAM_COLORS.length]!,
        members,
      });
      setPastingTeam(false);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setAddTeamBusy(false);
    }
  }

  async function handleCreateQuiz() {
    setError(null);
    setCreateQuizBusy(true);
    try {
      const quizId = await createQuiz({
        tournamentId,
        name: "New quiz",
        description: "",
        isFinal: false,
      });
      navigate(`/admin/quiz/${quizId}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setCreateQuizBusy(false);
    }
  }

  async function handleQuizUpdate(
    quizId: Id<"quizzes">,
    patch: { name?: string; isFinal?: boolean },
  ) {
    setError(null);
    setQuizBusyId(quizId);
    try {
      await updateQuiz({ quizId, ...patch });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setQuizBusyId(null);
    }
  }

  async function handleQuizRemove(quizId: Id<"quizzes">) {
    setError(null);
    setQuizBusyId(quizId);
    try {
      await removeQuiz({ quizId });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setQuizBusyId(null);
    }
  }

  async function handleStartGame(quizId: Id<"quizzes">) {
    setError(null);
    setStartBusyId(quizId);
    try {
      const { gameId } = await createGame({ quizId });
      navigate(`/host/${gameId}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setStartBusyId(null);
    }
  }

  return (
    <>
      <Backdrop variant="calm" />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Link to="/admin" className="btn-ghost mb-4 inline-flex">
          All tournaments
        </Link>

        <div className="glass mb-6 flex flex-col gap-2 p-5">
          <InlineText
            value={tournament.name}
            onSave={(name) => void updateTournament({ tournamentId, name })}
            className="field grad-text font-display text-2xl font-extrabold sm:text-3xl"
            placeholder="Tournament name"
          />
          <InlineText
            multiline
            allowEmpty
            value={tournament.description ?? ""}
            onSave={(description) => void updateTournament({ tournamentId, description })}
            className="field text-sm text-white/70"
            placeholder="Description (optional)"
          />
        </div>

        <PresenceBonusSettings
          tournamentId={tournamentId}
          value={tournament.presenceBonus}
        />

        {error && (
          <div className="glass-soft mb-4 flex items-center justify-between gap-3 border-siren/40 px-4 py-3 text-sm text-siren">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Teams */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Teams</h2>
            <span className="text-sm text-white/50">{teams.length}/10</span>
          </div>

          {teams.length < 2 && (
            <div className="glass-soft mb-4 px-4 py-3 text-sm text-sun">
              Add at least 2 teams to run a game.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => (
              <TeamCard
                key={t._id}
                team={t}
                busy={teamBusyId === t._id}
                onUpdate={(patch) => handleTeamUpdate(t._id, patch)}
                onRemove={() => handleTeamRemove(t._id)}
              />
            ))}

            {pastingTeam && teams.length < 10 && (
              <PasteTeamPanel
                defaultName={`Team ${teams.length + 1}`}
                busy={addTeamBusy}
                onCancel={() => setPastingTeam(false)}
                onCreate={(name, members) => void handlePasteTeam(name, members)}
              />
            )}

            {teams.length >= 10 ? (
              <button
                disabled
                className="glass-soft flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 p-5 text-center opacity-40 pointer-events-none"
              >
                <Plus className="h-6 w-6" />
                <span className="text-sm">Maximum of 10 teams</span>
              </button>
            ) : (
              <div className="flex min-h-[10rem] flex-col gap-2">
                <button
                  onClick={handleAddTeam}
                  disabled={addTeamBusy}
                  className="glass-soft flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 p-5 text-center transition hover:border-neon hover:bg-neon/5"
                >
                  {addTeamBusy ? (
                    <LoaderCircle className="h-6 w-6 animate-spin" />
                  ) : (
                    <Plus className="h-6 w-6" />
                  )}
                  <span className="text-sm text-white/70">Add team</span>
                </button>
                <button
                  onClick={() => setPastingTeam(true)}
                  disabled={addTeamBusy}
                  className="glass-soft flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/20 p-4 text-center transition hover:border-neon hover:bg-neon/5"
                >
                  <ClipboardPaste className="h-5 w-5" />
                  <span className="text-xs text-white/70">Paste a team</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Quizzes */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Quizzes</h2>
            <button
              className="btn-primary"
              onClick={handleCreateQuiz}
              disabled={createQuizBusy}
            >
              {createQuizBusy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              New quiz
            </button>
          </div>

          {quizzes.length === 0 && (
            <div className="glass-soft border-dashed px-6 py-10 text-center">
              <p className="text-white/70">No quizzes yet.</p>
              <p className="mt-1 text-sm text-white/45">
                Create your first quiz using the button above.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {quizzes.map((q) => {
              const canStart = q.questionCount > 0 && teams.length >= 2;
              const reason =
                q.questionCount === 0
                  ? "Add questions first"
                  : teams.length < 2
                    ? "Add at least 2 teams"
                    : null;
              return (
                <div key={q._id} className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <InlineText
                      value={q.name}
                      onSave={(name) => handleQuizUpdate(q._id, { name })}
                      className="field font-display text-base font-bold"
                      placeholder="Quiz name"
                    />
                    {q.isFinal && (
                      <span className="shrink-0 rounded-full px-2.5 py-1 text-xs text-sun">
                        Final
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 text-sm text-white/60">
                    {q.questionCount} questions · {formatScore(q.totalPoints * 100)} pts
                  </div>

                  <label className="flex shrink-0 items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={q.isFinal}
                      disabled={quizBusyId === q._id}
                      onChange={(e) =>
                        handleQuizUpdate(q._id, { isFinal: e.target.checked })
                      }
                    />
                    Final
                  </label>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link to={`/admin/quiz/${q._id}`} className="btn-ghost">
                      Edit
                    </Link>
                    <CopyEditLinkButton quizId={q._id} editToken={q.editToken} />

                    {q.lastGameId && (
                      <Link to={`/host/${q.lastGameId}`} className="btn-ghost text-xs">
                        {q.lastGameStatus === "finished"
                          ? "View (finished)"
                          : `Resume (${q.lastGameStatus})`}
                      </Link>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        className="btn-sun"
                        disabled={!canStart || startBusyId === q._id}
                        onClick={() => handleStartGame(q._id)}
                      >
                        {startBusyId === q._id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          "Start live game"
                        )}
                      </button>
                      {reason && (
                        <span className="text-xs text-white/45">{reason}</span>
                      )}
                    </div>

                    <ConfirmButton
                      busy={quizBusyId === q._id}
                      onConfirm={() => handleQuizRemove(q._id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

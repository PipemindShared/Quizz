import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { LoaderCircle, UserMinus, Users } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { cn } from "../lib/utils";

/**
 * Marks roster members unavailable for this one quiz.
 *
 * Without this, a team whose people are genuinely away — a shift, a holiday —
 * is measured against a roster that was never going to turn up, and loses
 * attendance bonus for absences nobody could help. Excusing someone removes them
 * from that quiz's target only; it doesn't stop them playing, and if they show up
 * anyway they count as present and the excusal is ignored.
 */
export default function QuizAvailability({
  quizId,
  tournamentId,
}: {
  quizId: Id<"quizzes">;
  tournamentId: Id<"tournaments">;
}) {
  const teams = useQuery(api.teams.listByTournament, { tournamentId });
  const excusals = useQuery(api.excusals.listByQuiz, { quizId });
  const tournament = useQuery(api.tournaments.get, { tournamentId });
  const setExcused = useMutation(api.excusals.setExcused);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (teams === undefined || excusals === undefined || tournament === undefined) {
    return null;
  }
  if (teams.length === 0) return null;

  const excusedKeys = new Set(
    excusals.map((e) => `${e.teamId}:${e.name.trim().toLowerCase()}`),
  );
  const isExcused = (team: Doc<"teams">, name: string) =>
    excusedKeys.has(`${team._id}:${name.trim().toLowerCase()}`);

  async function toggle(team: Doc<"teams">, name: string, excused: boolean) {
    const token = `${team._id}:${name}`;
    setBusy(token);
    setError(null);
    try {
      await setExcused({ quizId, teamId: team._id, name, excused });
    } catch (e) {
      setError(e instanceof ConvexError ? (e.data as string) : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const totalExcused = excusals.length;

  return (
    <div className="glass mb-6 flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-neon-2" />
          <span className="font-display text-sm font-bold uppercase tracking-wide text-white/80">
            Availability for this quiz
          </span>
        </div>
        {totalExcused > 0 && (
          <span className="rounded-full bg-sun/15 px-3 py-1 font-display text-xs font-bold text-sun">
            {totalExcused} excused
          </span>
        )}
      </div>

      <p className="text-xs leading-snug text-white/45">
        {tournament?.presenceBonus
          ? "Tap anyone who can't make this quiz. They stop counting towards the attendance bonus for this quiz only — and if they turn up anyway they count as present."
          : "Tap anyone who can't make this quiz. This only affects the attendance bonus, which isn't switched on for this tournament yet."}
      </p>

      {error && <p className="text-sm text-siren">{error}</p>}

      <div className="flex flex-col gap-3">
        {teams.map((team) => {
          const excusedHere = team.members.filter((m) => isExcused(team, m)).length;
          const available = team.members.length - excusedHere;
          return (
            <div key={team._id} className="glass-soft px-4 py-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-sm font-bold text-white/90">
                  {team.name}
                </span>
                <span className="text-xs tabular-nums text-white/45">
                  {available} of {team.members.length} available
                </span>
              </div>
              {team.members.length === 0 ? (
                <p className="text-xs text-white/30">No one on the roster yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {team.members.map((name) => {
                    const off = isExcused(team, name);
                    const token = `${team._id}:${name}`;
                    return (
                      <button
                        key={name}
                        type="button"
                        disabled={busy === token}
                        onClick={() => void toggle(team, name, !off)}
                        aria-pressed={off}
                        title={off ? "Unavailable — tap to restore" : "Tap to mark unavailable"}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition",
                          off
                            ? "border-sun/40 bg-sun/10 text-sun/80 line-through"
                            : "border-white/15 bg-white/5 text-white/85 hover:border-white/30",
                        )}
                      >
                        {busy === token ? (
                          <LoaderCircle className="h-3 w-3 animate-spin" />
                        ) : off ? (
                          <UserMinus className="h-3 w-3" />
                        ) : null}
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

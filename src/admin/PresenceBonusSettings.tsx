import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { LoaderCircle, Users } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { presenceBonusAt } from "../lib/utils";

type Config = NonNullable<Doc<"tournaments">["presenceBonus"]>;

const DEFAULTS: Config = {
  mode: "percent",
  minAttendance: 60,
  maxAttendance: 90,
  maxBonusPercent: 50,
};

/**
 * Rewards teams for turning out in numbers. The bonus ramps from nothing at the
 * minimum attendance to its full value at the maximum, so a team can always see
 * what showing up is still worth.
 */
export default function PresenceBonusSettings({
  tournamentId,
  value,
}: {
  tournamentId: Id<"tournaments">;
  value: Config | undefined;
}) {
  const update = useMutation(api.tournaments.update);
  const [draft, setDraft] = useState<Config>(value ?? DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow the server when it changes underneath us (another tab, or a reset).
  useEffect(() => {
    if (value) setDraft(value);
  }, [value]);

  const enabled = value !== undefined;
  const unit = draft.mode === "percent" ? "%" : " players";

  async function save(next: Config | null) {
    setBusy(true);
    setError(null);
    try {
      await update({ tournamentId, presenceBonus: next });
    } catch (e) {
      setError(e instanceof ConvexError ? (e.data as string) : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const field = (
    key: "minAttendance" | "maxAttendance" | "maxBonusPercent",
    label: string,
    hint: string,
  ) => (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="field w-full"
        min={0}
        value={draft[key]}
        disabled={!enabled || busy}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
        onBlur={() => enabled && void save(draft)}
      />
      <p className="mt-1 text-[11px] leading-snug text-white/40">{hint}</p>
    </div>
  );

  return (
    <div className="glass mb-6 flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-neon-2" />
          <span className="font-display text-sm font-bold uppercase tracking-wide text-white/80">
            Attendance bonus
          </span>
          {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-white/50" />}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => void save(e.target.checked ? draft : null)}
          />
          Reward teams for turning up
        </label>
      </div>

      {error && <p className="text-sm text-siren">{error}</p>}

      {enabled && (
        <>
          <div>
            <label className="label">Measure attendance as</label>
            <div className="flex flex-wrap gap-2">
              {(["percent", "count"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={busy}
                  className={
                    draft.mode === mode
                      ? "btn-primary px-3 py-1.5 text-sm"
                      : "btn-ghost px-3 py-1.5 text-sm"
                  }
                  onClick={() => {
                    const next = { ...draft, mode };
                    setDraft(next);
                    void save(next);
                  }}
                >
                  {mode === "percent" ? "% of the team" : "Number of players"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {field(
              "minAttendance",
              `Bonus minimum (${draft.mode === "percent" ? "%" : "players"})`,
              "Below this, no bonus.",
            )}
            {field(
              "maxAttendance",
              `Bonus maximum (${draft.mode === "percent" ? "%" : "players"})`,
              "At or above this, the full bonus.",
            )}
            {field("maxBonusPercent", "Bonus at maximum (%)", "Extra points at full turnout.")}
          </div>

          {/* Worked examples beat a formula: shows what these settings actually pay out. */}
          <div className="glass-soft px-4 py-3">
            <p className="label !mb-2">
              For a team of 100 {draft.mode === "percent" ? "on the roster" : "players"}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/70">
              {[
                draft.minAttendance - 1,
                draft.minAttendance,
                Math.round((draft.minAttendance + draft.maxAttendance) / 2),
                draft.maxAttendance,
              ]
                .filter((n, i, arr) => n >= 0 && arr.indexOf(n) === i)
                .map((joined) => (
                  <span key={joined} className="tabular-nums">
                    {joined}
                    {unit} present{" "}
                    <span className="font-semibold text-mint">
                      +{presenceBonusAt(draft, joined, 100)}%
                    </span>
                  </span>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

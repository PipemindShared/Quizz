import { useState } from "react";
import { ArrowLeft, LoaderCircle, TriangleAlert, UserPlus } from "lucide-react";
import type { PlayTeam } from "./types";
import TeamBadge from "../components/TeamBadge";
import { cn } from "../lib/utils";

/**
 * Step 2 of the join flow: claim a name. Either tap an existing roster chip
 * (treated as "that's me") or reveal a free-text field for a brand-new name.
 * The actual join mutation lives in the parent (PlayerApp) — this component
 * only ever calls `onJoin(name)` and reflects the `joining`/`error` props back,
 * so double-submits are guarded via the parent-owned `joining` flag rather
 * than any local state.
 */
export default function JoinName(props: {
  team: PlayTeam;
  onBack: () => void;
  onJoin: (name: string) => void;
  joining: boolean;
  error: string | null;
}) {
  const { team, onBack, onJoin, joining, error } = props;
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  // Tracks which control was tapped so only *that* one shows a spinner while
  // `joining` is true (the others stay disabled but stay quiet).
  const [activeName, setActiveName] = useState<string | null>(null);

  const trimmed = customName.trim();

  const handleRosterTap = (name: string) => {
    if (joining) return;
    setActiveName(name);
    onJoin(name);
  };

  const handleCustomSubmit = () => {
    if (joining || !trimmed) return;
    setActiveName(trimmed);
    onJoin(trimmed);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 pb-safe pt-8">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={joining}
          className="btn-ghost !px-3 !py-3"
          aria-label="Back to team selection"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <TeamBadge team={team} size="md" />
        <div>
          <p className="label !mb-0.5">Joining</p>
          <p className="font-display text-lg font-bold text-white">{team.name}</p>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-siren/15 px-4 py-3 text-sm text-white">
          <TriangleAlert className="h-4 w-4 shrink-0 text-siren" />
          <span>{error}</span>
        </div>
      )}

      {team.members.length > 0 && (
        <div>
          <p className="label">That's me</p>
          <div className="flex flex-wrap gap-2">
            {team.members.map((name) => {
              const isActive = joining && activeName === name;
              return (
                <button
                  key={name}
                  type="button"
                  disabled={joining}
                  onClick={() => handleRosterTap(name)}
                  className={cn(
                    "flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-base text-white transition active:scale-[0.97] disabled:opacity-40",
                    isActive && "border-neon/60 bg-neon/10",
                  )}
                >
                  {isActive && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!customOpen ? (
        // Given as much visual weight as the roster chips: anyone who isn't on
        // the list is stuck until they find this, and a faint underlined link is
        // easy to miss on a phone in a noisy room.
        <div className="flex flex-col gap-3">
          {team.members.length > 0 && (
            <div className="flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                or
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          )}
          <button
            type="button"
            disabled={joining}
            onClick={() => setCustomOpen(true)}
            className="btn-ghost min-h-[52px] w-full text-base"
          >
            <UserPlus className="h-5 w-5 shrink-0" />
            I&apos;m not on the list
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="label" htmlFor="join-name-input">
            Type your name
          </label>
          <input
            id="join-name-input"
            className="field text-base"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            maxLength={32}
            autoCapitalize="off"
            autoComplete="off"
            autoFocus
            disabled={joining}
            placeholder="Your name"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustomSubmit();
            }}
          />
          <button
            type="button"
            disabled={joining || !trimmed}
            onClick={handleCustomSubmit}
            className="btn-primary min-h-[44px] w-full"
          >
            {joining && activeName === trimmed ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              "Join game"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

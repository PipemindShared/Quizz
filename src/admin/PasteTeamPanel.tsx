import { useState } from "react";
import { ClipboardPaste, LoaderCircle, X } from "lucide-react";
import { MAX_MEMBERS, parseNames } from "../lib/parseNames";

/**
 * Creates a team from a roster pasted out of a spreadsheet, which beats typing
 * fifteen names into a one-at-a-time field.
 *
 * The parse is previewed before anything is created — a paste can silently drop
 * a header row or a duplicate, and it's better to see that than to discover it
 * on the lobby screen.
 */
export default function PasteTeamPanel({
  defaultName,
  busy,
  onCancel,
  onCreate,
}: {
  defaultName: string;
  busy: boolean;
  onCancel: () => void;
  onCreate: (name: string, members: string[]) => void;
}) {
  const [teamName, setTeamName] = useState(defaultName);
  const [text, setText] = useState("");

  const parsed = parseNames(text);
  const canCreate = teamName.trim().length > 0 && parsed.names.length > 0 && !busy;

  return (
    <div className="glass flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4 text-neon-2" />
          <span className="font-display text-sm font-bold uppercase tracking-wide text-white/80">
            Paste a team
          </span>
        </div>
        <button
          type="button"
          className="btn-ghost px-2 py-2"
          onClick={onCancel}
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="label" htmlFor="paste-team-name">
          Team name
        </label>
        <input
          id="paste-team-name"
          className="field"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Team name"
        />
      </div>

      <div>
        <label className="label" htmlFor="paste-team-members">
          Members — one per line
        </label>
        <textarea
          id="paste-team-members"
          className="field font-mono text-sm"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Paste a column straight from Excel:\n\nHaneen\nMena\nGabriel\nOthmane"}
          autoFocus
        />
      </div>

      <div className="text-xs text-white/55">
        {text.trim().length === 0 ? (
          <span className="text-white/40">
            Copy a column of names and paste it here. Extra columns, a header row
            and duplicates are ignored.
          </span>
        ) : (
          <>
            <span className="font-semibold text-mint">
              {parsed.names.length} {parsed.names.length === 1 ? "name" : "names"}
            </span>
            {parsed.skipped > 0 && (
              <span className="text-white/45">
                {" "}
                · {parsed.skipped} ignored (blank, duplicate or header)
              </span>
            )}
            {parsed.truncated && (
              <span className="text-sun"> · capped at {MAX_MEMBERS}</span>
            )}
            {parsed.names.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {parsed.names.slice(0, 12).map((n) => (
                  <span
                    key={n}
                    className="glass-soft rounded-full px-2.5 py-0.5 text-xs text-white/80"
                  >
                    {n}
                  </span>
                ))}
                {parsed.names.length > 12 && (
                  <span className="px-1 py-0.5 text-xs text-white/45">
                    +{parsed.names.length - 12} more
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary grow"
          disabled={!canCreate}
          onClick={() => onCreate(teamName.trim(), parsed.names)}
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ClipboardPaste className="h-4 w-4" />
          )}
          Create team
          {parsed.names.length > 0 ? ` with ${parsed.names.length}` : ""}
        </button>
        <button type="button" className="btn-ghost grow" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

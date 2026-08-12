import { LoaderCircle, TriangleAlert } from "lucide-react";

/**
 * Confirmation for marking a quiz as the tournament's final one.
 *
 * It reads like a harmless checkbox but it isn't: once the final quiz has been
 * played the tournament is stamped complete, the standings become the result and
 * the host screen crowns a champion. Only one quiz can hold the flag, so setting
 * it here also takes it away from whichever quiz has it now.
 *
 * Only shown when turning the option on — turning it off ends nothing.
 */
export default function FinalQuizWarning({
  /** The quiz currently marked final, if a different one holds it. */
  currentFinalName,
  busy,
  onConfirm,
  onCancel,
}: {
  currentFinalName?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Make this the final quiz?"
      className="glass-soft flex flex-col gap-2 border-l-4 border-l-sun px-4 py-3"
    >
      <div className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.16em] text-sun">
        <TriangleAlert className="h-3.5 w-3.5" />
        This ends the tournament
      </div>
      <p className="text-sm leading-snug text-white/75">
        Once this quiz has been played the tournament is complete: the leaderboard
        becomes the final standings and the host screen crowns a champion.
      </p>
      {currentFinalName && (
        <p className="text-xs leading-snug text-white/50">
          Only one quiz can be the final — &ldquo;{currentFinalName}&rdquo; will stop
          being it.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          className="btn-ghost grow text-sun"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          Yes, make it final
        </button>
        <button type="button" className="btn-ghost grow" onClick={onCancel}>
          No
        </button>
      </div>
    </div>
  );
}

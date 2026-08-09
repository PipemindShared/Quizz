import { Users } from "lucide-react";
import type { PlayTeam } from "./types";
import TeamBadge from "../components/TeamBadge";
import { withAlpha } from "../lib/utils";

/**
 * Step 1 of the join flow: pick a team. Every card is a single giant tap
 * target (>=44px, realistically the whole card) tinted with the team's own
 * colour so it reads correctly even before an icon loads.
 */
export default function JoinTeam(props: {
  quizName: string;
  tournamentName: string;
  teams: PlayTeam[];
  onSelect: (team: PlayTeam) => void;
}) {
  const { quizName, tournamentName, teams, onSelect } = props;

  return (
    <div className="flex flex-1 flex-col gap-6 pb-safe pt-8">
      <header className="text-center">
        <p className="label !mb-1 text-white/40">{tournamentName}</p>
        <h1 className="text-balance font-display text-3xl font-extrabold text-white">
          {quizName}
        </h1>
        <p className="mt-2 text-base text-white/60">Pick your team to join in</p>
      </header>

      {teams.length === 0 ? (
        <div className="glass-soft p-6 text-center text-base text-white/60">
          No teams yet — ask the host to set some up.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <button
              key={team._id}
              type="button"
              onClick={() => onSelect(team)}
              className="glass flex min-h-[140px] flex-col items-center justify-center gap-3 p-5 text-center transition active:scale-[0.97]"
              style={{
                backgroundColor: withAlpha(team.color, 0.14),
                boxShadow: `inset 0 0 0 2px ${withAlpha(team.color, 0.55)}`,
              }}
            >
              <TeamBadge team={team} size="lg" />
              <div className="font-display text-lg font-bold text-white">
                {team.name}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-white/60">
                <Users className="h-4 w-4" />
                {team.playerCount} playing
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Users } from "lucide-react";
import type { PlayMe, PlayTeam } from "./types";
import TeamBadge from "../components/TeamBadge";
import type { TeamLike } from "../components/TeamBadge";
import { cn } from "../lib/utils";

/**
 * Waiting room shown once a player has joined but the host hasn't started the
 * game yet. Purely presentational — no data fetching of its own.
 */
export default function PlayerLobby(props: {
  me: PlayMe;
  teams: PlayTeam[];
  playerCount: number;
  quizName: string;
  tournamentName: string;
  onSwitch: () => void;
}) {
  const { me, teams, playerCount, quizName, tournamentName, onSwitch } = props;
  const reduceMotion = useReducedMotion();

  const myTeamBadge: TeamLike = useMemo(
    () => ({ _id: me.teamId, name: me.teamName, color: me.teamColor, iconId: me.teamIconId }),
    [me.teamId, me.teamName, me.teamColor, me.teamIconId],
  );

  const teammates = teams.find((t) => t._id === me.teamId)?.members ?? [];

  return (
    <div className="flex flex-1 flex-col items-center gap-6 pb-safe pt-8 text-center">
      <div>
        <p className="label !mb-1 text-white/40">{tournamentName}</p>
        <h1 className="text-balance font-display text-2xl font-extrabold text-white">
          {quizName}
        </h1>
      </div>

      <div className="glass flex w-full flex-col items-center gap-3 p-6">
        <p className="label !mb-0">You're in</p>
        <TeamBadge team={myTeamBadge} size="xl" />
        <div>
          <p className="font-display text-2xl font-extrabold text-white">{me.name}</p>
          <p className="text-white/60">{me.teamName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 py-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: me.teamColor }}
            animate={reduceMotion ? undefined : { y: [0, -10, 0], opacity: [0.5, 1, 0.5] }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }
            }
          />
        ))}
      </div>

      <p className="max-w-xs text-balance text-base text-white/70">
        Hang tight — the host will start soon.
      </p>

      <div className="glass-soft flex w-full flex-col gap-2 p-4 text-left">
        <div className="flex items-center gap-2 text-xs font-display font-semibold uppercase tracking-[0.14em] text-white/50">
          <Users className="h-4 w-4" />
          Your teammates here
        </div>
        {teammates.length === 0 ? (
          <p className="text-sm text-white/50">Just you so far.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {teammates.map((name) => (
              <li
                key={name}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  name === me.name
                    ? "border-white/30 bg-white/10 font-semibold text-white"
                    : "border-white/10 text-white/70",
                )}
              >
                {name === me.name ? `★ ${name}` : name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-sm text-white/50">
        <Sparkles className="h-4 w-4" />
        {playerCount} {playerCount === 1 ? "player" : "players"} in the game
      </p>

      <button
        type="button"
        onClick={onSwitch}
        className="mt-1 min-h-[44px] text-sm text-white/50 underline underline-offset-4 transition hover:text-white/80"
      >
        Not you? Switch
      </button>
    </div>
  );
}

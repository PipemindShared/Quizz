import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Trophy, Crown, Medal, Star } from "lucide-react";
import type { HostState } from "./types";
import TeamBadge from "../components/TeamBadge";
import { cn, formatScore, ordinal } from "../lib/utils";
import { burst, sideCannons, rain } from "../lib/celebrate";

export type HostLeaderboardProps = {
  standings: NonNullable<HostState["standings"]>;
  isFinal: boolean;
  status: "leaderboard" | "finished";
};

const MEDAL_COLOR: Record<number, string> = {
  1: "#ffc94d", // sun / gold
  2: "#d7dbe6", // silver
  3: "#cd8a4d", // bronze
};

function RoundScoreChip({ roundScore }: { roundScore: number }) {
  const sign = roundScore >= 0 ? "+" : "";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1",
        "font-display text-sm font-bold tabular-nums",
        "border-mint/30 bg-mint/15 text-mint",
      )}
    >
      {sign}
      {formatScore(roundScore)}
    </span>
  );
}

function RankGlyph({ rank }: { rank: number }) {
  if (rank <= 3) {
    const color = MEDAL_COLOR[rank]!;
    const Icon = rank === 1 ? Trophy : Medal;
    return (
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}33, transparent 70%)`,
          boxShadow: `0 0 0 1.5px ${color}55 inset`,
        }}
      >
        <Icon className="h-6 w-6" style={{ color }} strokeWidth={2.25} />
      </div>
    );
  }
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center font-display text-lg font-bold text-white/40">
      {ordinal(rank)}
    </div>
  );
}

function StandingRow({
  standing,
  large,
}: {
  standing: HostLeaderboardProps["standings"][number];
  large: boolean;
}) {
  const topThree = standing.rank <= 3;
  return (
    <motion.div
      layout
      key={standing.teamId}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{
        layout: { type: "spring", stiffness: 300, damping: 32 },
        delay: standing.rank * 0.05,
      }}
      className={cn(
        "flex items-center gap-4 rounded-2xl border px-5 py-4",
        topThree
          ? "glass border-white/15"
          : "glass-soft border-white/5",
        large ? "py-5" : "",
      )}
      style={
        topThree
          ? {
              boxShadow: `0 0 0 1px ${MEDAL_COLOR[standing.rank]}22 inset, 0 20px 50px -30px ${MEDAL_COLOR[standing.rank]}55`,
            }
          : undefined
      }
    >
      <RankGlyph rank={standing.rank} />
      <TeamBadge
        team={{
          _id: standing.teamId,
          name: standing.name,
          color: standing.color,
          iconId: standing.iconId,
        }}
        size={topThree ? "lg" : "md"}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-lg font-semibold text-white sm:text-xl">
          {standing.name}
        </div>
      </div>
      <RoundScoreChip roundScore={standing.roundScore} />
      <div
        className={cn(
          "shrink-0 text-right font-display font-extrabold tabular-nums text-white",
          topThree ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl",
        )}
      >
        {formatScore(standing.total)}
      </div>
    </motion.div>
  );
}

function ChampionCard({
  champion,
  reduceMotion,
  title,
}: {
  champion: HostLeaderboardProps["standings"][number];
  reduceMotion: boolean;
  title: string;
}) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: -30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.1 }}
      className="relative mb-6 w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/15 px-6 py-6 text-center sm:px-10 sm:py-8"
      style={{
        background: `linear-gradient(180deg, ${champion.color}22, rgba(255,255,255,0.03) 60%)`,
        boxShadow: `0 40px 90px -40px ${champion.color}88, 0 0 0 1px ${champion.color}33 inset`,
      }}
    >
      {/* Localized champion glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/3 rounded-full opacity-60 blur-[90px]"
        style={{ background: champion.color }}
      />

      <div className="relative flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.25em] text-white/70">
          <Crown className="h-5 w-5 text-sun" strokeWidth={2.25} />
          {title}
          <Crown className="h-5 w-5 text-sun" strokeWidth={2.25} />
        </div>

        <TeamBadge
          team={{
            _id: champion.teamId,
            name: champion.name,
            color: champion.color,
            iconId: champion.iconId,
          }}
          size="xl"
        />

        <div className="grad-text text-balance font-display text-4xl font-extrabold leading-tight sm:text-6xl">
          {champion.name}
        </div>

        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-sun" strokeWidth={2} />
          <div className="font-display text-5xl font-black tabular-nums text-white sm:text-7xl">
            {formatScore(champion.total)}
          </div>
          <Trophy className="h-8 w-8 text-sun" strokeWidth={2} />
        </div>

        <RoundScoreChip roundScore={champion.roundScore} />
      </div>
    </motion.div>
  );
}

export default function HostLeaderboard({ standings, isFinal, status }: HostLeaderboardProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const champion = standings[0];

  useEffect(() => {
    if (isFinal && champion && status === "leaderboard") {
      // The payoff of the whole Awards Night countdown: a burst the moment the
      // name lands, cannons from both sides, then a long rain of their colours.
      const colors = [champion.color, "#ffc94d", "#ffffff"];
      burst(colors);
      sideCannons(colors);
      const t = setTimeout(() => rain(colors), 2400);
      return () => clearTimeout(t);
    }
    if (isFinal && champion) {
      sideCannons([champion.color]);
    } else {
      rain();
    }
    // Fire exactly once per mount (this component remounts fresh per phase-entry).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rest = isFinal ? standings.slice(1) : standings;

  let heading = "Leaderboard";
  let subheading = "Standings after this round";
  if (isFinal && status === "finished") {
    heading = champion ? `Tournament Complete — Champions: ${champion.name}` : "Tournament Complete";
    subheading = "The championship has been decided";
  } else if (isFinal && status === "leaderboard") {
    heading = "Champions";
    subheading = "Tournament finale — cumulative standings";
  } else if (!isFinal && status === "finished") {
    heading = "Final Standings";
    subheading = "Game complete";
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="flex w-full flex-col items-center px-6 pb-[96px] pt-8 sm:px-10"
    >
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        {isFinal ? (
          <div className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.3em] text-sun">
            <Star className="h-4 w-4" />
            Tournament Finale
            <Star className="h-4 w-4" />
          </div>
        ) : null}
        <h1 className="grad-text text-balance font-display text-3xl font-extrabold sm:text-5xl">
          {heading}
        </h1>
        <p className="text-sm font-medium text-white/50 sm:text-base">{subheading}</p>
      </div>

      {isFinal && champion ? (
        <ChampionCard
          champion={champion}
          reduceMotion={reduceMotion}
          title={status === "finished" ? "Tournament Champions" : "Currently Leading"}
        />
      ) : null}

      {rest.length > 0 ? (
        <div className="w-full max-w-3xl">
          {isFinal ? (
            <div className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.2em] text-white/40">
              The Field
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {rest.map((standing) => (
                <StandingRow key={standing.teamId} standing={standing} large={!isFinal} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}

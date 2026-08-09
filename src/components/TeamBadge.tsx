import StorageImage from "./StorageImage";
import type { Id } from "../../convex/_generated/dataModel";
import { cn, initials, readableOn } from "../lib/utils";

export type TeamLike = {
  _id: Id<"teams">;
  name: string;
  color: string;
  iconId?: Id<"_storage"> | null;
};

const SIZES = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-lg",
  xl: "h-32 w-32 text-3xl",
};

/** Team icon (or coloured initials) inside a ring of the team colour. */
export default function TeamBadge({
  team,
  size = "md",
  className,
  ring = true,
}: {
  team: TeamLike;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl",
        SIZES[size],
        className,
      )}
      style={{
        backgroundColor: team.color,
        boxShadow: ring ? `0 0 0 2px ${team.color}55, 0 8px 24px -8px ${team.color}` : undefined,
      }}
      title={team.name}
    >
      <StorageImage
        storageId={team.iconId ?? undefined}
        alt={team.name}
        className="h-full w-full"
        fallback={
          <div
            className="grid h-full w-full place-items-center font-display font-extrabold"
            style={{ color: readableOn(team.color) }}
          >
            {initials(team.name)}
          </div>
        }
      />
    </div>
  );
}

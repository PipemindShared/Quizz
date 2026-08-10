import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "../lib/utils";

type Props = {
  storageId?: Id<"_storage"> | null;
  alt?: string;
  className?: string;
  /** Rendered while the URL resolves or when there is no image. */
  fallback?: React.ReactNode;
  /**
   * How the image fills its box. "contain" shows the whole image (never crops
   * a face or logo) and is what the host screens use, since they're viewed
   * from across a room. Defaults to "cover".
   */
  fit?: "cover" | "contain";
};

/**
 * Renders an image stored in Convex file storage. Identical storage ids share a
 * single reactive query, so using this many times on a page is cheap.
 */
export default function StorageImage({
  storageId,
  alt = "",
  className,
  fallback = null,
  fit = "cover",
}: Props) {
  const url = useQuery(
    api.files.getUrl,
    storageId ? { storageId } : "skip",
  );

  if (!storageId) return <>{fallback}</>;
  if (url === undefined) {
    return (
      <div
        className={cn(
          "animate-pulse bg-white/10",
          className ?? "h-full w-full",
        )}
      />
    );
  }
  if (url === null) return <>{fallback}</>;

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={cn(fit === "contain" ? "object-contain" : "object-cover", className)}
    />
  );
}

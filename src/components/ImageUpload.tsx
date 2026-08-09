import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import StorageImage from "./StorageImage";
import { cn } from "../lib/utils";

type Props = {
  value?: Id<"_storage"> | null;
  onChange: (id: Id<"_storage"> | undefined) => void;
  label?: string;
  /** Square for team icons, wide for question images. */
  shape?: "square" | "wide";
  className?: string;
};

/** Click-or-drop image picker that uploads straight into Convex storage. */
export default function ImageUpload({
  value,
  onChange,
  label = "Upload image",
  shape = "wide",
  className,
}: Props) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const url = await generateUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      onChange(storageId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        className={cn(
          "group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/20 bg-black/25 transition hover:border-neon hover:bg-neon/5",
          dragging && "border-neon bg-neon/10",
          shape === "square" ? "aspect-square" : "aspect-video",
        )}
      >
        {value ? (
          <StorageImage storageId={value} className="h-full w-full" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center text-white/45">
            {busy ? (
              <LoaderCircle className="h-6 w-6 animate-spin" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
            <span className="font-display text-xs uppercase tracking-widest">
              {busy ? "Uploading…" : label}
            </span>
          </div>
        )}

        {value && !busy && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white/80 backdrop-blur transition hover:bg-siren hover:text-white"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {value && busy && (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <LoaderCircle className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-1.5 text-xs text-siren">{error}</p>}
    </div>
  );
}

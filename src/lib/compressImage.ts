/**
 * Shrinks an image in the browser before it is uploaded.
 *
 * Quiz images are shown at known, modest sizes — a prompt image fills at most
 * ~768 CSS px on the host screen, a team badge under 100 — but authors upload
 * straight from a phone or camera, so the source is routinely a 12-megapixel,
 * multi-megabyte JPEG. Storing that means every player's phone downloads it in
 * full, mid-game, on whatever connection the venue has.
 *
 * Re-encoding here rather than on read keeps it simple: the oversized original
 * never reaches storage, so nothing downstream has to think about it.
 */

/** Largest edge, in pixels, that each kind of image needs. */
export const MAX_EDGE = {
  /** Prompt and answer images: ~768 CSS px on the host, doubled for HiDPI. */
  question: 1600,
  /** Team badges render under 100 CSS px; this is already generous. */
  icon: 512,
} as const;

/** Files below this are left alone if their dimensions already fit. */
const SKIP_BELOW_BYTES = 300 * 1024;

/** Refuse absurd inputs rather than trying to decode them into memory. */
const REJECT_ABOVE_BYTES = 40 * 1024 * 1024;

const QUALITY = 0.82;

export type CompressResult = {
  /** The upload payload — the original file when re-encoding wasn't worth it. */
  blob: Blob;
  contentType: string;
  originalBytes: number;
  bytes: number;
  width: number;
  height: number;
  /** False when the original was already small enough to pass through. */
  recompressed: boolean;
};

/** Decodes to a bitmap, honouring EXIF orientation so phone photos aren't sideways. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older Safari rejects the options bag; fall through to the <img> path,
      // where browsers apply EXIF orientation by default.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That image could not be read"));
      img.src = url;
    });
  } finally {
    // Safe even though the <img> is used later: the bitmap is already decoded.
    URL.revokeObjectURL(url);
  }
}

function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(
  file: File,
  maxEdge: number = MAX_EDGE.question,
): Promise<CompressResult> {
  if (file.size > REJECT_ABOVE_BYTES) {
    throw new Error("That image is too large — please use one under 40 MB");
  }

  const source = await decode(file);
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height) throw new Error("That image could not be read");

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const alreadySmallEnough = scale === 1 && file.size <= SKIP_BELOW_BYTES;
  if (alreadySmallEnough) {
    if ("close" in source) source.close();
    return {
      blob: file,
      contentType: file.type,
      originalBytes: file.size,
      bytes: file.size,
      width,
      height,
      recompressed: false,
    };
  }

  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH);
  if ("close" in source) source.close();

  // WebP first: it compresses better than JPEG and keeps transparency, which
  // matters for team badges. Browsers that can't encode it hand back a PNG,
  // which is the signal to pick a format ourselves.
  let blob = await encode(canvas, "image/webp", QUALITY);
  let contentType = "image/webp";
  if (!blob || blob.type !== "image/webp") {
    const sourceHasAlpha = /png|webp|gif|avif|svg/i.test(file.type);
    contentType = sourceHasAlpha ? "image/png" : "image/jpeg";
    blob = await encode(canvas, contentType, QUALITY);
  }
  if (!blob) throw new Error("Could not process that image");

  // Re-encoding can backfire — a small, already-optimised PNG can come out
  // bigger. If we didn't also need to shrink it, keep the original.
  if (scale === 1 && blob.size >= file.size) {
    return {
      blob: file,
      contentType: file.type,
      originalBytes: file.size,
      bytes: file.size,
      width,
      height,
      recompressed: false,
    };
  }

  return {
    blob,
    contentType: blob.type || contentType,
    originalBytes: file.size,
    bytes: blob.size,
    width: targetW,
    height: targetH,
    recompressed: true,
  };
}

/** 184320 -> "180 KB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

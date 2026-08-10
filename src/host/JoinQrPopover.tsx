import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { QrCode, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

/**
 * Lets the host bring the join QR back up at any point in the game, so someone
 * who arrives after the lobby can still get in. Lives in the host control bar,
 * so it is available on every phase.
 *
 * Late joiners sit out the question that is already open and start from the
 * next one, which the overlay says out loud — otherwise the host has no way to
 * know why a new player's screen looks idle.
 */
export default function JoinQrPopover({
  code,
  /**
   * Reported so the host screen can suspend its Space / → shortcut: otherwise
   * pressing space to dismiss this would also advance the game.
   */
  onOpenChange,
}: {
  code: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const joinUrl = `${origin}/play/${code}`;

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn-ghost px-3 py-2"
        aria-label="Show the join QR code"
        title="Show the join code again — for anyone joining late"
        onClick={() => setOpen(true)}
      >
        <QrCode className="h-4 w-4" />
      </button>

      {/*
       * Portalled to <body> on purpose. This button sits in the host control
       * bar, which is `.glass` — and a backdrop-filter establishes a containing
       * block for fixed-position descendants. Rendered in place, `fixed inset-0`
       * resolved against the control bar's ~68px strip at the bottom of the
       * screen instead of the viewport, so the panel appeared squashed against
       * the bottom edge and ran off it.
       */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-6 backdrop-blur-md"
              onClick={() => setOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.94, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 8 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="glass flex flex-col items-center gap-5 p-8"
                // The overlay closes on backdrop clicks; don't let clicks on the
                // panel itself bubble up and dismiss it.
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex w-full items-start justify-between gap-6">
                  <div>
                    <p className="font-display text-lg font-bold text-white">Join the game</p>
                    <p className="mt-1 text-sm text-white/50">
                      New players start from the next question.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-2"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-[0_0_60px_-10px_rgba(124,92,255,0.6)]">
                  {/* Sized for scanning from across a room, not from a desk. */}
                  <QRCodeSVG
                    value={joinUrl}
                    size={240}
                    level="M"
                    className="h-[clamp(220px,34vh,420px)] w-[clamp(220px,34vh,420px)]"
                  />
                </div>

                <div className="text-center">
                  <div className="grad-text font-display text-5xl font-extrabold leading-none tracking-widest">
                    {code}
                  </div>
                  <p className="mt-3 text-sm text-white/50">
                    Or go to{" "}
                    <span className="font-semibold text-white/80">
                      {origin.replace(/^https?:\/\//, "")}/play
                    </span>
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

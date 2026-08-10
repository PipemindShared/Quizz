import { useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";
import { WifiOff } from "lucide-react";

/**
 * Says so when the live connection drops.
 *
 * Everything a player sees is a Convex subscription, so a dropped socket leaves
 * the last state frozen on screen — during a game that looks exactly like being
 * stuck on the previous question while everyone else has moved on. Convex
 * reconnects on its own; the point here is that the player (and whoever they
 * complain to) can tell the difference between "the app is broken" and "this
 * phone lost its connection".
 *
 * Brief drops are normal, so this waits before showing anything rather than
 * flickering on every blip.
 */
const GRACE_MS = 2500;

export default function OfflineBanner() {
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't nag during the very first connect — that's just loading.
    if (isWebSocketConnected || !hasEverConnected) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), GRACE_MS);
    return () => clearTimeout(t);
  }, [isWebSocketConnected, hasEverConnected]);

  if (!show) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-30 -mx-4 mb-2 flex items-center justify-center gap-2 bg-siren/90 px-4 py-2 text-center font-display text-xs font-bold text-white backdrop-blur"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      Reconnecting — this screen may be out of date
    </div>
  );
}

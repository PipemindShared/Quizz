import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * Guarantees a host screen always fits one viewport — these screens are shown
 * on a TV or shared over a call, where scrolling isn't an option and anything
 * below the fold is simply lost.
 *
 * The child keeps its natural (unscaled) layout, so `scrollHeight` stays a true
 * measurement; when that natural height exceeds the viewport we shrink the whole
 * screen with a CSS transform. Transforms happen after layout, so scaling never
 * feeds back into the measurement and the loop can't oscillate.
 */
/**
 * Children are expected to reserve their own bottom padding for the fixed host
 * control bar, so that space is part of the natural measurement.
 */
export default function FitToScreen({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const available = outer.clientHeight;
    const natural = inner.scrollHeight;
    if (available <= 0 || natural <= 0) return;

    // Only ever scale down — growing content past its designed size would blur
    // images and break the carefully tuned clamp() typography.
    const next = Math.min(1, available / natural);
    // Ignore sub-pixel churn so a ResizeObserver notification can't ping-pong.
    setScale((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
  }, []);

  useEffect(() => {
    measure();
    const inner = innerRef.current;
    const outer = outerRef.current;
    if (!inner || !outer) return;

    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    observer.observe(outer);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    // Must be a motion component: it sits directly under the host's
    // <AnimatePresence mode="wait">, which waits for the outgoing child to
    // report that it has finished exiting. A plain div never reports, so the
    // next phase would never mount.
    <motion.div
      ref={outerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="relative z-10 h-dvh w-full overflow-hidden"
    >
      <div
        ref={innerRef}
        className="w-full origin-top"
        style={{ transform: scale < 1 ? `scale(${scale})` : undefined }}
      >
        {children}
      </div>
    </motion.div>
  );
}

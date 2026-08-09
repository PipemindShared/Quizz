import { useEffect, useMemo, useRef } from "react";
import { cn } from "../lib/utils";

const DEFAULT_TINT = ["#7c5cff", "#ff4d8d", "#4dd0ff"];

type Props = {
  /** "host" is loud and animated, "calm" is cheaper — used on phones/admin. */
  variant?: "host" | "calm";
  /** Tints the aurora towards these colours (e.g. the leading team's colour). */
  tint?: string[];
  className?: string;
};

/**
 * Full-bleed animated background: three drifting aurora orbs, a canvas field of
 * slow-rising glow motes, and a fine grain overlay. Sits behind everything with
 * pointer-events off. Honours prefers-reduced-motion by dropping the canvas.
 */
export default function Backdrop({ variant = "host", tint, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keyed on the joined string so a caller passing a fresh array literal every
  // render doesn't restart the canvas animation.
  const tintKey = tint?.length ? tint.join(",") : "";
  const colors = useMemo(
    () => (tintKey ? tintKey.split(",") : DEFAULT_TINT),
    [tintKey],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const count = variant === "host" ? 90 : 36;

    type Mote = {
      x: number;
      y: number;
      r: number;
      vy: number;
      vx: number;
      a: number;
      c: string;
    };
    let motes: Mote[] = [];

    const spawn = (): Mote => ({
      x: Math.random() * w,
      y: h + Math.random() * h * 0.4,
      r: 1 + Math.random() * (variant === "host" ? 3.6 : 2.2),
      vy: -(0.12 + Math.random() * 0.45),
      vx: (Math.random() - 0.5) * 0.22,
      a: 0.12 + Math.random() * 0.5,
      c: colors[Math.floor(Math.random() * colors.length)]!,
    });

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes = Array.from({ length: count }, () => {
        const m = spawn();
        m.y = Math.random() * h;
        return m;
      });
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y += m.vy;
        m.x += m.vx;
        if (m.y < -20 || m.x < -20 || m.x > w + 20) Object.assign(m, spawn());
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
        g.addColorStop(0, m.c);
        g.addColorStop(1, "transparent");
        ctx.globalAlpha = m.a;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [variant, colors]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink",
        className,
      )}
    >
      {/* Aurora orbs */}
      <div
        className="absolute -left-[15%] -top-[20%] h-[70vmax] w-[70vmax] rounded-full opacity-45 blur-[110px] animate-float"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${colors[0]}, transparent 62%)`,
          animationDuration: "13s",
        }}
      />
      <div
        className="absolute -right-[18%] top-[8%] h-[62vmax] w-[62vmax] rounded-full opacity-40 blur-[120px] animate-float"
        style={{
          background: `radial-gradient(circle at 60% 40%, ${colors[1 % colors.length]}, transparent 62%)`,
          animationDuration: "17s",
          animationDelay: "-4s",
        }}
      />
      <div
        className="absolute bottom-[-25%] left-[20%] h-[58vmax] w-[58vmax] rounded-full opacity-35 blur-[120px] animate-float"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${colors[2 % colors.length]}, transparent 60%)`,
          animationDuration: "21s",
          animationDelay: "-9s",
        }}
      />

      {/* Rising motes */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Vignette + grain */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(4,2,16,0.85)_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

import confetti from "canvas-confetti";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A single centred pop of confetti. */
export function burst(colors: string[] = ["#ffc94d", "#ff4d8d", "#7c5cff", "#4dd0ff"]) {
  if (reduced()) return;
  void confetti({
    particleCount: 120,
    spread: 90,
    startVelocity: 45,
    origin: { y: 0.55 },
    colors,
    disableForReducedMotion: true,
  });
}

/** Two cannons firing inward from the sides — used for the champion reveal. */
export function sideCannons(colors: string[] = ["#ffc94d", "#ff4d8d", "#7c5cff"]) {
  if (reduced()) return;
  const end = Date.now() + 2200;
  const frame = () => {
    void confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    void confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

/** Gentle rain of confetti from the top — used behind leaderboards. */
export function rain(colors: string[] = ["#ffc94d", "#ff4d8d", "#7c5cff", "#3ddc97"]) {
  if (reduced()) return;
  const end = Date.now() + 3000;
  const frame = () => {
    void confetti({
      particleCount: 3,
      startVelocity: 0,
      ticks: 260,
      gravity: 0.55,
      spread: 360,
      origin: { x: Math.random(), y: -0.05 },
      colors,
      scalar: 1.1,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

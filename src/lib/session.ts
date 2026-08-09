import type { Id } from "../../convex/_generated/dataModel";

/**
 * Player identity, kept in localStorage per game code so a refresh (or a phone
 * locking mid-question) drops the player straight back into the game.
 */
export type PlayerSession = {
  playerId: Id<"players">;
  teamId: Id<"teams">;
  name: string;
};

const key = (code: string) => `quiz.player.${code.toUpperCase()}`;

export function loadSession(code: string): PlayerSession | null {
  try {
    const raw = localStorage.getItem(key(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSession;
    return parsed?.playerId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(code: string, session: PlayerSession) {
  try {
    localStorage.setItem(key(code), JSON.stringify(session));
  } catch {
    /* private browsing — the player just re-joins on refresh */
  }
}

export function clearSession(code: string) {
  try {
    localStorage.removeItem(key(code));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ admin --- */

const ADMIN_KEY = "quiz.admin";

export const isAdminUnlocked = () => {
  try {
    return localStorage.getItem(ADMIN_KEY) === "1";
  } catch {
    return false;
  }
};

export const setAdminUnlocked = (v: boolean) => {
  try {
    if (v) localStorage.setItem(ADMIN_KEY, "1");
    else localStorage.removeItem(ADMIN_KEY);
  } catch {
    /* ignore */
  }
};

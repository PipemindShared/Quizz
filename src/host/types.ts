// Hand-declared to match ARCHITECTURE.md §6 exactly (`convex/games.ts` — host side).
// Kept independent of convex/_generated codegen so the host UI can be built and
// typechecked while the backend is still being written in parallel.
import type { Id } from "../../convex/_generated/dataModel";
import type { RecapSlide, RecapStanding } from "../../convex/recap";

export type GameStatus =
  | "lobby"
  | "question"
  | "reveal"
  | "round_results"
  | "recap"
  | "leaderboard"
  | "finished";

export type AnswerKind =
  | "text_input"
  | "text_choice"
  | "image_choice"
  | "image_text_choice";

export type Dot = {
  teamId: Id<"teams">;
  teamColor: string;
  elapsedMs: number;
};

export type HostTeam = {
  _id: Id<"teams">;
  name: string;
  color: string;
  iconId?: Id<"_storage">;
  members: string[];
  playerCount: number;
  playerNames: string[];
  /** Names on the roster — the denominator for percentage attendance. */
  roster: number;
  /** Live attendance bonus; null when the tournament has none configured. */
  presence: {
    maxBonusPercent: number;
    bonusPercent: number;
    attendance: number;
    /** Extra players needed before any bonus is earned; 0 once it is. */
    playersToMin: number;
  } | null;
};

export type HostQuestion = {
  _id: Id<"questions">;
  order: number;
  number: number; // 1-based
  prompt: string;
  promptImageId?: Id<"_storage">;
  answerKind: AnswerKind;
  choices: { text?: string; imageId?: Id<"_storage"> }[];
  points: number; // 1..3, also the DIFFICULTY key
  timeLimit: number; // seconds
  /** present only when status !== "question" — never leaked early */
  correctChoice?: number;
  correctText?: string;
};

export type HostRevealDistribution = {
  choiceIndex: number;
  count: number;
  correct: boolean;
  dots: Dot[];
};

export type HostRevealTextAnswer = {
  text: string;
  count: number;
  correct: boolean;
  dots: Dot[];
};

export type HostBestPlayer = {
  name: string;
  teamId: Id<"teams">;
  teamName: string;
  teamColor: string;
  teamIconId?: Id<"_storage">;
  elapsedMs: number;
  points: number;
};

export type HostReveal = {
  correctChoice?: number;
  correctText?: string;
  /** Author's note on why — only sent during reveal. */
  explanation?: string;
  /** one entry per choice, index-aligned; empty for text_input */
  distribution: HostRevealDistribution[];
  /** for text_input: what people typed, most common first */
  textAnswers: HostRevealTextAnswer[];
  correctCount: number;
  totalAnswers: number;
  bestPlayer: HostBestPlayer | null;
};

export type HostRoundScore = {
  teamId: Id<"teams">;
  name: string;
  color: string;
  iconId?: Id<"_storage">;
  /** Final score for the round, attendance bonus included. */
  score: number;
  playerCount: number;
  players: { name: string; points: number }[];
  /** Score before the attendance bonus, and the bonus applied (0 when none). */
  baseScore: number;
  bonusPercent: number;
};

export type HostStanding = {
  teamId: Id<"teams">;
  name: string;
  color: string;
  iconId?: Id<"_storage">;
  total: number; // cumulative championship total
  roundScore: number; // this quiz's contribution -> show as "+x.xx"
  rank: number; // 1-based
};

export type HostState = {
  game: {
    _id: Id<"games">;
    code: string;
    status: GameStatus;
    currentIndex: number;
    questionStartedAt?: number;
    questionEndsAt?: number;
    phaseStartedAt: number;
  };
  quiz: {
    _id: Id<"quizzes">;
    name: string;
    description: string;
    isFinal: boolean;
    questionCount: number;
  };
  tournament: { _id: Id<"tournaments">; name: string };
  teams: HostTeam[];
  playerCount: number;
  answeredCount: number;
  /** null in lobby / round_results / leaderboard / finished */
  question: HostQuestion | null;
  /** only when status === "reveal" */
  reveal: HostReveal | null;
  /** only when status === "round_results"; best first */
  roundScores: HostRoundScore[] | null;
  /** only when status === "leaderboard" | "finished" */
  standings: HostStanding[] | null;
  /** final quiz only, from round_results onwards: the awards slideshow */
  finale: HostFinale | null;
};

export type HostFinale = {
  /** current slide while status === "recap"; -1 before it starts */
  step: number;
  tournamentName: string;
  slides: RecapSlide[];
  standings: RecapStanding[];
};

// Shared player-side types, hand-derived verbatim from ARCHITECTURE.md §6
// (the `play.getPlayState` contract). Import these instead of re-declaring
// shapes locally so every player component agrees on exact field names/
// optionality. Do not add host-only fields here (e.g. per-vote dot colors,
// elapsedMs, roundScore deltas) — the player contract deliberately omits them.

import type { Id } from "../../convex/_generated/dataModel";

export type GameStatus =
  | "lobby"
  | "question"
  | "reveal"
  | "round_results"
  | "leaderboard"
  | "finished";

export type AnswerKind =
  | "text_input"
  | "text_choice"
  | "image_choice"
  | "image_text_choice";

export type PlayTeam = {
  _id: Id<"teams">;
  name: string;
  color: string;
  iconId?: Id<"_storage">;
  members: string[];
  playerCount: number;
};

export type PlayMe = {
  playerId: Id<"players">;
  name: string;
  teamId: Id<"teams">;
  teamName: string;
  teamColor: string;
  teamIconId?: Id<"_storage">;
  totalPoints: number;
};

export type PlayChoice = {
  text?: string;
  imageId?: Id<"_storage">;
};

export type PlayQuestion = {
  _id: Id<"questions">;
  number: number;
  total: number;
  prompt: string;
  promptImageId?: Id<"_storage">;
  answerKind: AnswerKind;
  choices: PlayChoice[];
  points: number;
  timeLimit: number;
};

export type MyAnswer = {
  choiceIndex?: number;
  text?: string;
  // Only populated once status === "reveal"; absent while status === "question".
  correct?: boolean;
  points?: number;
};

export type BestPlayer = {
  name: string;
  teamName: string;
  teamColor: string;
  isMe: boolean;
};

export type Reveal = {
  correctChoice?: number;
  correctText?: string;
  myCorrect: boolean;
  myPoints: number;
  distribution: { choiceIndex: number; count: number }[];
  bestPlayer: BestPlayer | null;
};

export type RoundScore = {
  teamId: Id<"teams">;
  name: string;
  color: string;
  score: number;
  isMyTeam: boolean;
};

export type Standing = {
  teamId: Id<"teams">;
  name: string;
  color: string;
  total: number;
  rank: number;
  isMyTeam: boolean;
};

export type PlayState = {
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
    name: string;
    description: string;
    isFinal: boolean;
    questionCount: number;
  };
  tournament: { name: string };
  teams: PlayTeam[];
  me: PlayMe | null;
  playerCount: number;
  answeredCount: number;
  question: PlayQuestion | null;
  myAnswer: MyAnswer | null;
  reveal: Reveal | null;
  roundScores: RoundScore[] | null;
  standings: Standing[] | null;
};

// join: mutation({ code, teamId, name }) => { playerId: Id<"players"> }
// submitAnswer: mutation({ playerId, questionId, choiceIndex?, text? })
//   => { correct: boolean; points: number }

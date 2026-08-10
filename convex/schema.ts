import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Answer layout for a question.
 *  - text_input        : player types a free-text answer
 *  - text_choice       : 4 text choices
 *  - image_choice      : 4 image choices
 *  - image_text_choice : 4 image choices with a title overlaid
 */
export const answerKind = v.union(
  v.literal("text_input"),
  v.literal("text_choice"),
  v.literal("image_choice"),
  v.literal("image_text_choice"),
);

/** One multiple-choice option. `text` and/or `imageId` are used per answerKind. */
export const choice = v.object({
  text: v.optional(v.string()),
  imageId: v.optional(v.id("_storage")),
});

/**
 * Live game phases.
 *  lobby         -> players joining, host shows QR
 *  question      -> question is open, timer running
 *  reveal        -> per-question results + best player
 *  round_results -> team totals for this quiz
 *  leaderboard   -> cumulative championship standings
 *  finished      -> archived (tournament champion shown when quiz.isFinal)
 */
export const gameStatus = v.union(
  v.literal("lobby"),
  v.literal("question"),
  v.literal("reveal"),
  v.literal("round_results"),
  v.literal("leaderboard"),
  v.literal("finished"),
);

/**
 * Rewards teams for turning up in numbers. Attendance is measured per game, as
 * either a percentage of the team's roster or a raw headcount, and converted to
 * a bonus percentage that ramps linearly:
 *
 *   below minAttendance          -> +0%
 *   at or above maxAttendance    -> +maxBonusPercent
 *   in between                   -> proportionally
 *
 * So min 60 / max 90 / bonus 50 means 60% turnout earns nothing, 75% earns
 * +25%, and 90% or better earns the full +50%.
 */
export const presenceBonus = v.object({
  /** "percent" measures against the team's roster; "count" is a raw headcount. */
  mode: v.union(v.literal("percent"), v.literal("count")),
  /** Attendance at which the bonus starts accruing. */
  minAttendance: v.number(),
  /** Attendance at which the bonus is maxed out. */
  maxAttendance: v.number(),
  /** The bonus, in percent, awarded at maxAttendance. */
  maxBonusPercent: v.number(),
});

export default defineSchema({
  tournaments: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    /** set once the final quiz has been played */
    completedAt: v.optional(v.number()),
    /** Absent means no attendance bonus is in play for this tournament. */
    presenceBonus: v.optional(presenceBonus),
  }),

  teams: defineTable({
    tournamentId: v.id("tournaments"),
    name: v.string(),
    color: v.string(), // hex, e.g. "#ff4d8d"
    iconId: v.optional(v.id("_storage")),
    /** roster of player names; grows when a new player self-adds during a game */
    members: v.array(v.string()),
    order: v.number(),
  }).index("by_tournament", ["tournamentId"]),

  quizzes: defineTable({
    tournamentId: v.id("tournaments"),
    name: v.string(),
    description: v.string(),
    /** last quiz of the tournament — playing it ends the tournament */
    isFinal: v.boolean(),
    order: v.number(),
    /**
     * Long opaque secret — holding it grants full edit access to this quiz.
     * Always set for quizzes created after this field was added; optional so
     * quizzes that already existed in the database don't fail schema
     * validation (they get a token lazily the first time one is requested).
     */
    editToken: v.optional(v.string()),
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_editToken", ["editToken"]),

  questions: defineTable({
    quizId: v.id("quizzes"),
    order: v.number(),
    /** the question text, e.g. "What is the capital of Canada?" */
    prompt: v.string(),
    /** optional image shown with the prompt ("Who is this person?") */
    promptImageId: v.optional(v.id("_storage")),
    answerKind,
    /** exactly 4 entries for every *_choice kind; empty for text_input */
    choices: v.array(choice),
    /** index into `choices` for the *_choice kinds */
    correctChoice: v.optional(v.number()),
    /** expected answer for text_input (compared case/accent-insensitively) */
    correctText: v.optional(v.string()),
    /** extra spellings accepted for text_input */
    acceptedAnswers: v.optional(v.array(v.string())),
    /** text_input only: require matching letter case (default false) */
    caseSensitive: v.optional(v.boolean()),
    /** difficulty: 1 easy, 2 normal, 3 hard */
    points: v.number(),
    /** seconds allowed to answer (default 20) */
    timeLimit: v.number(),
  }).index("by_quiz", ["quizId"]),

  games: defineTable({
    quizId: v.id("quizzes"),
    tournamentId: v.id("tournaments"),
    /** short human-typable join code, e.g. "FZ7K2Q" */
    code: v.string(),
    status: gameStatus,
    /** index into the quiz's ordered questions; -1 while in lobby */
    currentIndex: v.number(),
    /** ms epoch when the current question opened */
    questionStartedAt: v.optional(v.number()),
    /** ms epoch when the current question closes */
    questionEndsAt: v.optional(v.number()),
    /** ms epoch of the last phase change — drives entry animations */
    phaseStartedAt: v.number(),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_quiz", ["quizId"]),

  players: defineTable({
    gameId: v.id("games"),
    teamId: v.id("teams"),
    name: v.string(),
    joinedAt: v.number(),
    /**
     * game.currentIndex at the moment this player joined; -1 for anyone who
     * joined from the lobby. A player only counts towards questions that
     * opened after they arrived (index > joinedAtIndex), so joining late never
     * drags down the teammates who were already playing. Optional because
     * players who joined before this field existed are treated as -1.
     */
    joinedAtIndex: v.optional(v.number()),
  })
    .index("by_game", ["gameId"])
    .index("by_game_team", ["gameId", "teamId"]),

  answers: defineTable({
    gameId: v.id("games"),
    questionId: v.id("questions"),
    playerId: v.id("players"),
    teamId: v.id("teams"),
    /** chosen option index for *_choice kinds */
    choiceIndex: v.optional(v.number()),
    /** raw typed answer for text_input */
    text: v.optional(v.string()),
    correct: v.boolean(),
    /** ms between question open and submission — drives the dot animation */
    elapsedMs: v.number(),
    /** question.points when correct, else 0 */
    points: v.number(),
  })
    .index("by_game_question", ["gameId", "questionId"])
    .index("by_player_question", ["playerId", "questionId"])
    .index("by_game_player", ["gameId", "playerId"]),

  /** Frozen per-team result for one played quiz. Written when the game ends. */
  gameResults: defineTable({
    gameId: v.id("games"),
    quizId: v.id("quizzes"),
    tournamentId: v.id("tournaments"),
    teamId: v.id("teams"),
    /**
     * The team's final score for the quiz, presence bonus included. Standings
     * sum this, so it stays the single source of truth for ranking.
     */
    score: v.number(),
    playerCount: v.number(),
    /**
     * Score before the presence bonus, and the bonus that was applied. Kept so
     * the results screens can show what the turnout was worth. Optional because
     * quizzes played before the bonus existed have neither.
     */
    baseScore: v.optional(v.number()),
    bonusPercent: v.optional(v.number()),
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_game", ["gameId"]),
});

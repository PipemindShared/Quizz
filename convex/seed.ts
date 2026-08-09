import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Demo data for kicking the tyres without clicking through the builder.
 *
 *   npx convex run seed:demo
 *   npx convex run seed:wipe        # removes everything it created
 *
 * Only text-based questions are seeded — the image answer kinds need real
 * uploads, so create those in the quiz builder.
 */
export const demo = mutation({
  args: {},
  handler: async (ctx) => {
    const tournamentId = await ctx.db.insert("tournaments", {
      name: "Summer Championship 2026",
      description: "Four weeks, one trophy, a suspicious amount of trivia.",
    });

    const teamSpecs = [
      { name: "Byte Force", color: "#ff4d8d", members: ["Gabriel", "Nadia", "Tom"] },
      { name: "The Refactors", color: "#4dd0ff", members: ["Priya", "Marcus"] },
      { name: "Null Pointers", color: "#3ddc97", members: ["Ines", "Ben", "Sofia"] },
    ];
    for (const [order, spec] of teamSpecs.entries()) {
      await ctx.db.insert("teams", { tournamentId, order, ...spec });
    }

    // ---- Week 1 quiz ------------------------------------------------------
    const weekOne = await ctx.db.insert("quizzes", {
      tournamentId,
      name: "Week 1 — Geography & Pop Culture",
      description: "A gentle start. Mostly.",
      isFinal: false,
      order: 0,
    });

    const weekOneQuestions = [
      {
        prompt: "What is the capital of Canada?",
        answerKind: "text_input" as const,
        choices: [],
        correctText: "Ottawa",
        acceptedAnswers: ["Ottowa"],
        points: 1,
        timeLimit: 20,
      },
      {
        prompt: "Which planet has the most moons?",
        answerKind: "text_choice" as const,
        choices: [
          { text: "Jupiter" },
          { text: "Saturn" },
          { text: "Neptune" },
          { text: "Uranus" },
        ],
        correctChoice: 1,
        points: 2,
        timeLimit: 20,
      },
      {
        prompt: "In what year was the first version of Linux released?",
        answerKind: "text_choice" as const,
        choices: [
          { text: "1989" },
          { text: "1991" },
          { text: "1994" },
          { text: "1996" },
        ],
        correctChoice: 1,
        points: 3,
        timeLimit: 30,
      },
    ];
    for (const [order, q] of weekOneQuestions.entries()) {
      await ctx.db.insert("questions", { quizId: weekOne, order, ...q });
    }

    // ---- The final -------------------------------------------------------
    const grandFinal = await ctx.db.insert("quizzes", {
      tournamentId,
      name: "The Grand Final",
      description: "Winner takes the trophy. Playing this ends the tournament.",
      isFinal: true,
      order: 1,
    });

    const finalQuestions = [
      {
        prompt: "Which company built the first commercial microprocessor?",
        answerKind: "text_choice" as const,
        choices: [
          { text: "Intel" },
          { text: "Motorola" },
          { text: "Texas Instruments" },
          { text: "Fairchild" },
        ],
        correctChoice: 0,
        points: 2,
        timeLimit: 20,
      },
      {
        prompt: "Name the largest ocean on Earth.",
        answerKind: "text_input" as const,
        choices: [],
        correctText: "Pacific",
        acceptedAnswers: ["Pacific Ocean", "The Pacific"],
        points: 3,
        timeLimit: 25,
      },
    ];
    for (const [order, q] of finalQuestions.entries()) {
      await ctx.db.insert("questions", { quizId: grandFinal, order, ...q });
    }

    return { tournamentId, weekOne, grandFinal };
  },
});

/** Deletes every document in every table. Development convenience only. */
export const wipe = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "answers",
      "players",
      "gameResults",
      "games",
      "questions",
      "quizzes",
      "teams",
      "tournaments",
    ] as const;
    let removed = 0;
    for (const table of tables) {
      for (const doc of await ctx.db.query(table).collect()) {
        await ctx.db.delete(doc._id);
        removed++;
      }
    }
    return { removed };
  },
});

/** Simulates a player answering, so the reveal screen can be exercised solo. */
export const fakeAnswer = mutation({
  args: {
    playerId: v.id("players"),
    choiceIndex: v.optional(v.number()),
    text: v.optional(v.string()),
    elapsedMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("No such player");
    const game = await ctx.db.get(player.gameId);
    if (!game || game.currentIndex < 0) throw new Error("Game is not on a question");
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quiz", (q) => q.eq("quizId", game.quizId))
      .collect();
    questions.sort((a, b) => a.order - b.order);
    const question = questions[game.currentIndex];
    if (!question) throw new Error("No current question");

    const correct =
      args.choiceIndex !== undefined
        ? args.choiceIndex === question.correctChoice
        : (args.text ?? "").trim().toLowerCase() ===
          (question.correctText ?? "").trim().toLowerCase();

    await ctx.db.insert("answers", {
      gameId: game._id,
      questionId: question._id,
      playerId: player._id,
      teamId: player.teamId,
      choiceIndex: args.choiceIndex,
      text: args.text,
      correct,
      elapsedMs: args.elapsedMs ?? Math.floor(1000 + Math.random() * 8000),
      points: correct ? question.points : 0,
    });
    return { correct };
  },
});

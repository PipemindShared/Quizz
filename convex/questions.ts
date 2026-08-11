import { ConvexError, v, type Infer } from "convex/values";
import { mutation, query } from "./_generated/server";
import { answerKind, choice } from "./schema";
import * as lib from "./lib";

type AnswerKind = Infer<typeof answerKind>;
type Choice = Infer<typeof choice>;

/** Shape shared by create (all required) and update (all optional). */
const questionFields = {
  prompt: v.string(),
  promptImageId: v.optional(v.union(v.id("_storage"), v.null())),
  answerKind,
  choices: v.array(choice),
  correctChoice: v.optional(v.number()),
  correctText: v.optional(v.string()),
  acceptedAnswers: v.optional(v.array(v.string())),
  caseSensitive: v.optional(v.boolean()),
  explanation: v.optional(v.string()),
  points: v.number(),
  timeLimit: v.number(),
};

const questionFieldsPartial = {
  prompt: v.optional(v.string()),
  promptImageId: v.optional(v.union(v.id("_storage"), v.null())),
  answerKind: v.optional(answerKind),
  choices: v.optional(v.array(choice)),
  correctChoice: v.optional(v.number()),
  correctText: v.optional(v.string()),
  acceptedAnswers: v.optional(v.array(v.string())),
  caseSensitive: v.optional(v.boolean()),
  explanation: v.optional(v.string()),
  points: v.optional(v.number()),
  timeLimit: v.optional(v.number()),
};

function validateQuestion(q: {
  answerKind: AnswerKind;
  choices: Choice[];
  correctChoice?: number;
  correctText?: string;
  points: number;
  timeLimit: number;
}) {
  if (q.points < 1 || q.points > 3) {
    throw new ConvexError("Points must be between 1 and 3");
  }
  if (q.timeLimit < 5 || q.timeLimit > 180) {
    throw new ConvexError("Time limit must be between 5 and 180 seconds");
  }

  if (q.answerKind === "text_input") {
    if (!q.correctText || !q.correctText.trim()) {
      throw new ConvexError("A text-input question needs a correct answer");
    }
    return;
  }

  if (q.choices.length !== 4) {
    throw new ConvexError("Choice questions need exactly 4 choices");
  }
  if (q.answerKind === "text_choice" || q.answerKind === "image_text_choice") {
    if (q.choices.some((c) => !c.text || !c.text.trim())) {
      throw new ConvexError("Every choice needs text");
    }
  }
  if (q.answerKind === "image_choice" || q.answerKind === "image_text_choice") {
    if (q.choices.some((c) => !c.imageId)) {
      throw new ConvexError("Every choice needs an image");
    }
  }
  if (q.correctChoice === undefined || q.correctChoice < 0 || q.correctChoice > 3) {
    throw new ConvexError("Pick which choice is correct");
  }
}

export const listByQuiz = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => lib.loadOrderedQuestions(ctx, args.quizId),
});

export const create = mutation({
  args: { quizId: v.id("quizzes"), ...questionFields },
  returns: v.id("questions"),
  handler: async (ctx, args) => {
    validateQuestion(args);
    const existing = await lib.loadOrderedQuestions(ctx, args.quizId);
    return ctx.db.insert("questions", {
      quizId: args.quizId,
      order: existing.length,
      prompt: args.prompt,
      promptImageId: args.promptImageId ?? undefined,
      answerKind: args.answerKind,
      choices: args.choices,
      correctChoice: args.correctChoice,
      correctText: args.correctText,
      acceptedAnswers: args.acceptedAnswers,
      caseSensitive: args.caseSensitive,
      explanation: args.explanation,
      points: args.points,
      timeLimit: args.timeLimit,
    });
  },
});

export const update = mutation({
  args: { questionId: v.id("questions"), ...questionFieldsPartial },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.questionId);
    if (!existing) throw new ConvexError("Question not found");

    const patch: Record<string, unknown> = {};
    if (args.prompt !== undefined) patch.prompt = args.prompt;
    if (args.promptImageId !== undefined) {
      patch.promptImageId = args.promptImageId === null ? undefined : args.promptImageId;
    }
    if (args.answerKind !== undefined) patch.answerKind = args.answerKind;
    if (args.choices !== undefined) patch.choices = args.choices;
    if (args.correctChoice !== undefined) patch.correctChoice = args.correctChoice;
    if (args.correctText !== undefined) patch.correctText = args.correctText;
    if (args.acceptedAnswers !== undefined) patch.acceptedAnswers = args.acceptedAnswers;
    if (args.caseSensitive !== undefined) patch.caseSensitive = args.caseSensitive;
    if (args.explanation !== undefined) patch.explanation = args.explanation;
    if (args.points !== undefined) patch.points = args.points;
    if (args.timeLimit !== undefined) patch.timeLimit = args.timeLimit;

    const merged = { ...existing, ...patch };
    validateQuestion(merged);

    await ctx.db.patch(args.questionId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { questionId: v.id("questions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.questionId);
    return null;
  },
});

export const reorder = mutation({
  args: { quizId: v.id("quizzes"), orderedIds: v.array(v.id("questions")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await Promise.all(
      args.orderedIds.map((id, index) => ctx.db.patch(id, { order: index })),
    );
    return null;
  },
});

export const duplicate = mutation({
  args: { questionId: v.id("questions") },
  returns: v.id("questions"),
  handler: async (ctx, args) => {
    const original = await ctx.db.get(args.questionId);
    if (!original) throw new ConvexError("Question not found");

    const insertAt = original.order + 1;
    const siblings = await lib.loadOrderedQuestions(ctx, original.quizId);
    for (const sibling of siblings) {
      if (sibling.order >= insertAt) {
        await ctx.db.patch(sibling._id, { order: sibling.order + 1 });
      }
    }

    return ctx.db.insert("questions", {
      quizId: original.quizId,
      order: insertAt,
      prompt: original.prompt,
      promptImageId: original.promptImageId,
      answerKind: original.answerKind,
      choices: original.choices,
      correctChoice: original.correctChoice,
      correctText: original.correctText,
      acceptedAnswers: original.acceptedAnswers,
      caseSensitive: original.caseSensitive,
      explanation: original.explanation,
      points: original.points,
      timeLimit: original.timeLimit,
    });
  },
});

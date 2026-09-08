import "server-only"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { learningPackSchema, visibleInitialQuizQuestions } from "@/lib/ai/learning-pack-schema"
import { EMPTY_QUIZ_DRAFT, quizDraftStateSchema, validateQuizDraft, type QuizDraft } from "./initial-quiz-draft"

export class QuizDraftError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function ownedPack(userId: string, packVersionId: string) {
  const pack = await prisma.learningPackVersion.findFirst({
    where: {
      id: packVersionId,
      learningPack: {
        userId, currentVersionId: packVersionId,
        goalSkill: { userId, lifecycle: { not: "ARCHIVED" }, goal: { userId, status: { in: ["ACTIVE", "MAINTAINING"] } } },
      },
    },
    select: { contentJson: true, _count: { select: { attempts: true } } },
  })
  if (!pack) throw new QuizDraftError("Quiz not found.", 404)
  if (pack._count.attempts) throw new QuizDraftError("This quiz is already complete. Reload to see it.", 409)
  return visibleInitialQuizQuestions(learningPackSchema.parse(JSON.parse(pack.contentJson)))
}

export async function getQuizDraft(userId: string, packVersionId: string): Promise<QuizDraft> {
  const questions = await ownedPack(userId, packVersionId)
  const draft = await prisma.initialQuizDraft.upsert({
    where: { packVersionId }, update: {},
    create: { packVersionId, userId, attemptId: randomUUID(), stateJson: JSON.stringify(EMPTY_QUIZ_DRAFT) },
  })
  if (draft.userId !== userId) throw new QuizDraftError("Quiz not found.", 404)
  return { attemptId: draft.attemptId, startedAt: draft.createdAt.toISOString(), version: draft.version,
    state: validateQuizDraft(quizDraftStateSchema.parse(JSON.parse(draft.stateJson)), questions) }
}

export async function saveQuizDraft(userId: string, packVersionId: string, version: number, value: unknown) {
  const questions = await ownedPack(userId, packVersionId)
  const state = validateQuizDraft(quizDraftStateSchema.parse(value), questions)
  if (state.completedAt && new Date(state.completedAt).getTime() > Date.now() + 300_000) {
    throw new QuizDraftError("Quiz time is invalid.", 400)
  }
  const stateJson = JSON.stringify(state)
  const updated = await prisma.initialQuizDraft.updateMany({
    where: { packVersionId, userId, version },
    data: { stateJson, version: { increment: 1 } },
  })
  if (!updated.count) {
    const current = await prisma.initialQuizDraft.findFirst({ where: { packVersionId, userId } })
    // Repeated request after a lost response is safe; never overwrite another tab.
    if (current?.stateJson === stateJson) return { version: current.version }
    throw new QuizDraftError("This quiz changed in another tab. Reload to resume the latest saved answers.", 409)
  }
  return { version: version + 1 }
}

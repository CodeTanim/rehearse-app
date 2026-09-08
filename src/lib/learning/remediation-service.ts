import "server-only"

import { createHash } from "node:crypto"

import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"

type Transaction = Prisma.TransactionClient
type Clock = () => Date

export type RemediationContent = {
  sourceVersionId: string
  gapLabel: string
  recommendedAction: string
  explanation: string
  workedExample?: string | null
  scaffoldPrompt: string
  scaffoldAnswer: string
  citationLocator: string
  citationExcerpt: string
}

type GapLocation = {
  userId: string
  goalSkillId: string
  conceptVersionId: string
  questionId: string
  questionRevisionId: string
  openedAt: Date
  openedReviewDay: string
  content: RemediationContent
}

export type InitialQuizGapInput = GapLocation & {
  learningPackAttemptId: string
}

export type RecallGapInput = GapLocation & {
  attemptId: string
}

export type LearningGapMutation = {
  gapId: string
  remediationRevisionId: string
  created: boolean
  reopened: boolean
  alreadyRecorded: boolean
}

export type RemediationGapView = {
  id: string
  goalSkillId: string
  status: "OPEN" | "RESOLVED"
  skillTitle: string
  openedAt: string
  remediation: {
    id: string
    revision: number
    gapLabel: string
    recommendedAction: string
    explanation: string
    workedExample: string | null
    scaffoldPrompt: string
    citation: {
      sourceVersionId: string
      sourceName: string
      sourceUrl: string | null
      locator: string
      excerpt: string
    }
    activity: {
      answer: string
      completedAt: string
    } | null
  }
}

export class LearningGapNotFoundError extends Error {
  constructor() {
    super("Learning gap not found.")
    this.name = "LearningGapNotFoundError"
  }
}

export const STALE_REMEDIATION_REVISION_CODE =
  "STALE_REMEDIATION_REVISION" as const

export class StaleRemediationRevisionError extends Error {
  readonly code = STALE_REMEDIATION_REVISION_CODE

  constructor() {
    super("This practice changed. Reload to continue.")
    this.name = "StaleRemediationRevisionError"
  }
}

export class RemediationInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RemediationInputError"
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  )
}

function stableGapId(input: Pick<GapLocation, "userId" | "goalSkillId" | "conceptVersionId">) {
  return `learning_gap_${sha256(
    `${input.userId}:${input.goalSkillId}:${input.conceptVersionId}`,
  ).slice(0, 24)}`
}

function validDate(value: Date, label: string) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new RemediationInputError(`${label} must be a valid date.`)
  }
  return new Date(value)
}

function requiredText(value: string, label: string, maximum: number) {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maximum) {
    throw new RemediationInputError(
      `${label} must contain between 1 and ${maximum} characters.`,
    )
  }
  return trimmed
}

function validateReviewDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RemediationInputError("openedReviewDay must use YYYY-MM-DD.")
  }
  return value
}

function validatedContent(content: RemediationContent): RemediationContent {
  return {
    sourceVersionId: requiredText(content.sourceVersionId, "sourceVersionId", 128),
    gapLabel: requiredText(content.gapLabel, "gapLabel", 200),
    recommendedAction: requiredText(
      content.recommendedAction,
      "recommendedAction",
      500,
    ),
    explanation: requiredText(content.explanation, "explanation", 2_000),
    workedExample:
      content.workedExample == null
        ? null
        : requiredText(content.workedExample, "workedExample", 2_000),
    scaffoldPrompt: requiredText(content.scaffoldPrompt, "scaffoldPrompt", 2_000),
    scaffoldAnswer: requiredText(content.scaffoldAnswer, "scaffoldAnswer", 2_000),
    citationLocator: requiredText(content.citationLocator, "citationLocator", 240),
    citationExcerpt: requiredText(content.citationExcerpt, "citationExcerpt", 600),
  }
}

function validateLocation(input: GapLocation) {
  return {
    userId: requiredText(input.userId, "userId", 128),
    goalSkillId: requiredText(input.goalSkillId, "goalSkillId", 128),
    conceptVersionId: requiredText(input.conceptVersionId, "conceptVersionId", 128),
    questionId: requiredText(input.questionId, "questionId", 128),
    questionRevisionId: requiredText(
      input.questionRevisionId,
      "questionRevisionId",
      128,
    ),
    openedAt: validDate(input.openedAt, "openedAt"),
    openedReviewDay: validateReviewDay(input.openedReviewDay),
    content: validatedContent(input.content),
  }
}

async function findGapForConcept(transaction: Transaction, input: GapLocation) {
  return transaction.learningGap.findUnique({
    where: {
      userId_goalSkillId_conceptVersionId: {
        userId: input.userId,
        goalSkillId: input.goalSkillId,
        conceptVersionId: input.conceptVersionId,
      },
    },
    select: {
      id: true,
      status: true,
      initialLearningPackAttemptId: true,
    },
  })
}

async function findTriggerRevision(
  transaction: Transaction,
  gapId: string,
  triggerKind: "INITIAL_QUIZ" | "RECALL",
  triggerKey: string,
) {
  return transaction.remediationRevision.findUnique({
    where: {
      learningGapId_triggerKind_triggerKey: {
        learningGapId: gapId,
        triggerKind,
        triggerKey,
      },
    },
    select: { id: true },
  })
}

async function createRevision(
  transaction: Transaction,
  input: {
    gapId: string
    triggerKind: "INITIAL_QUIZ" | "RECALL"
    triggerKey: string
    content: RemediationContent
  },
) {
  const existing = await findTriggerRevision(
    transaction,
    input.gapId,
    input.triggerKind,
    input.triggerKey,
  )
  if (existing) return { id: existing.id, alreadyRecorded: true }

  const latest = await transaction.remediationRevision.aggregate({
    where: { learningGapId: input.gapId },
    _max: { revision: true },
  })
  const revision = await transaction.remediationRevision.create({
    data: {
      learningGapId: input.gapId,
      sourceVersionId: input.content.sourceVersionId,
      revision: (latest._max.revision ?? 0) + 1,
      triggerKind: input.triggerKind,
      triggerKey: input.triggerKey,
      gapLabel: input.content.gapLabel,
      recommendedAction: input.content.recommendedAction,
      explanation: input.content.explanation,
      workedExample: input.content.workedExample,
      scaffoldPrompt: input.content.scaffoldPrompt,
      scaffoldAnswer: input.content.scaffoldAnswer,
      citationLocator: input.content.citationLocator,
      citationExcerpt: input.content.citationExcerpt,
    },
    select: { id: true },
  })
  return { id: revision.id, alreadyRecorded: false }
}

export async function createInitialQuizGapInTransaction(
  transaction: Transaction,
  rawInput: InitialQuizGapInput,
): Promise<LearningGapMutation> {
  const input = {
    ...validateLocation(rawInput),
    learningPackAttemptId: requiredText(
      rawInput.learningPackAttemptId,
      "learningPackAttemptId",
      128,
    ),
  }
  const gapId = stableGapId(input)
  const existing = await findGapForConcept(transaction, input)
  const priorRevision = existing
    ? await findTriggerRevision(
        transaction,
        existing.id,
        "INITIAL_QUIZ",
        input.learningPackAttemptId,
      )
    : null

  if (priorRevision) {
    return {
      gapId: existing!.id,
      remediationRevisionId: priorRevision.id,
      created: false,
      reopened: false,
      alreadyRecorded: true,
    }
  }

  if (!existing) {
    await transaction.learningGap.create({
      data: {
        id: gapId,
        userId: input.userId,
        goalSkillId: input.goalSkillId,
        conceptVersionId: input.conceptVersionId,
        questionId: input.questionId,
        questionRevisionId: input.questionRevisionId,
        initialLearningPackAttemptId: input.learningPackAttemptId,
        status: "OPEN",
        openedReviewDay: input.openedReviewDay,
        openedAt: input.openedAt,
      },
    })
  } else {
    await transaction.learningGap.update({
      where: { id: existing.id },
      data: {
        questionId: input.questionId,
        questionRevisionId: input.questionRevisionId,
        initialLearningPackAttemptId:
          existing.initialLearningPackAttemptId ?? input.learningPackAttemptId,
        status: "OPEN",
        openedReviewDay: input.openedReviewDay,
        openedAt: input.openedAt,
        resolvedAt: null,
        resolvedByAttemptId: null,
      },
    })
  }

  const revision = await createRevision(transaction, {
    gapId: existing?.id ?? gapId,
    triggerKind: "INITIAL_QUIZ",
    triggerKey: input.learningPackAttemptId,
    content: input.content,
  })
  return {
    gapId: existing?.id ?? gapId,
    remediationRevisionId: revision.id,
    created: !existing,
    reopened: existing?.status === "RESOLVED",
    alreadyRecorded: revision.alreadyRecorded,
  }
}

export async function createOrReopenRecallGapInTransaction(
  transaction: Transaction,
  rawInput: RecallGapInput,
): Promise<LearningGapMutation> {
  const input = {
    ...validateLocation(rawInput),
    attemptId: requiredText(rawInput.attemptId, "attemptId", 128),
  }
  const gapId = stableGapId(input)
  const existing = await findGapForConcept(transaction, input)
  const priorRevision = existing
    ? await findTriggerRevision(transaction, existing.id, "RECALL", input.attemptId)
    : null

  // A retried grade must never reopen a gap that a later recall already resolved.
  if (priorRevision) {
    return {
      gapId: existing!.id,
      remediationRevisionId: priorRevision.id,
      created: false,
      reopened: false,
      alreadyRecorded: true,
    }
  }

  if (!existing) {
    await transaction.learningGap.create({
      data: {
        id: gapId,
        userId: input.userId,
        goalSkillId: input.goalSkillId,
        conceptVersionId: input.conceptVersionId,
        questionId: input.questionId,
        questionRevisionId: input.questionRevisionId,
        latestRecallAttemptId: input.attemptId,
        status: "OPEN",
        openedReviewDay: input.openedReviewDay,
        openedAt: input.openedAt,
      },
    })
  } else {
    await transaction.learningGap.update({
      where: { id: existing.id },
      data: {
        questionId: input.questionId,
        questionRevisionId: input.questionRevisionId,
        latestRecallAttemptId: input.attemptId,
        status: "OPEN",
        openedReviewDay: input.openedReviewDay,
        openedAt: input.openedAt,
        resolvedAt: null,
        resolvedByAttemptId: null,
      },
    })
  }

  const revision = await createRevision(transaction, {
    gapId: existing?.id ?? gapId,
    triggerKind: "RECALL",
    triggerKey: input.attemptId,
    content: input.content,
  })
  return {
    gapId: existing?.id ?? gapId,
    remediationRevisionId: revision.id,
    created: !existing,
    reopened: existing?.status === "RESOLVED",
    alreadyRecorded: revision.alreadyRecorded,
  }
}

export async function resolveLearningGapFromRecallInTransaction(
  transaction: Transaction,
  input: {
    userId: string
    goalSkillId: string
    conceptVersionId: string
    attemptId: string
    resolvedAt: Date
  },
) {
  const userId = requiredText(input.userId, "userId", 128)
  const goalSkillId = requiredText(input.goalSkillId, "goalSkillId", 128)
  const conceptVersionId = requiredText(
    input.conceptVersionId,
    "conceptVersionId",
    128,
  )
  const attemptId = requiredText(input.attemptId, "attemptId", 128)
  const resolvedAt = validDate(input.resolvedAt, "resolvedAt")
  const gap = await transaction.learningGap.findUnique({
    where: {
      userId_goalSkillId_conceptVersionId: {
        userId,
        goalSkillId,
        conceptVersionId,
      },
    },
    select: {
      id: true,
      status: true,
      openedAt: true,
      latestRecallAttemptId: true,
      resolvedByAttemptId: true,
    },
  })
  if (!gap) return null
  if (gap.status === "RESOLVED") {
    return gap.resolvedByAttemptId === attemptId
      ? { gapId: gap.id, resolved: true, alreadyResolved: true }
      : null
  }
  if (gap.latestRecallAttemptId === attemptId || resolvedAt <= gap.openedAt) return null

  // Resolve only from a persisted, successful, unassisted recall carrying
  // evidence for this competency. Scaffold activities never create Attempt or
  // MasteryEvidence rows, so they cannot satisfy this query.
  const qualifyingAttempt = await transaction.attempt.findFirst({
    where: {
      id: attemptId,
      userId,
      rating: { in: ["HARD", "GOOD", "EASY"] },
      occurredAt: { gt: gap.openedAt },
      sessionItem: { session: { goalSkillId } },
      masteryEvidence: { some: { conceptVersionId } },
    },
    select: { id: true },
  })
  if (!qualifyingAttempt) return null

  const update = await transaction.learningGap.updateMany({
    where: {
      id: gap.id,
      userId,
      goalSkillId,
      conceptVersionId,
      status: "OPEN",
      openedAt: { lt: resolvedAt },
    },
    data: {
      status: "RESOLVED",
      resolvedAt,
      resolvedByAttemptId: attemptId,
    },
  })
  return update.count === 1
    ? { gapId: gap.id, resolved: true, alreadyResolved: false }
    : null
}

export function createRemediationService(
  database: PrismaClient,
  clock: Clock = () => new Date(),
) {
  return {
    async getOwnedLearningGap(
      userId: string,
      goalSkillId: string,
      gapId: string,
    ): Promise<RemediationGapView> {
      const gap = await database.learningGap.findFirst({
        where: {
          id: requiredText(gapId, "gapId", 128),
          userId: requiredText(userId, "userId", 128),
          goalSkillId: requiredText(goalSkillId, "goalSkillId", 128),
        },
        select: {
          id: true,
          goalSkillId: true,
          status: true,
          openedAt: true,
          goalSkill: { select: { skillNode: { select: { title: true } } } },
          remediationRevisions: {
            orderBy: { revision: "desc" },
            take: 1,
            select: {
              id: true,
              revision: true,
              gapLabel: true,
              recommendedAction: true,
              explanation: true,
              workedExample: true,
              scaffoldPrompt: true,
              citationLocator: true,
              citationExcerpt: true,
              sourceVersion: {
                select: {
                  id: true,
                  source: { select: { displayName: true, displayUrl: true } },
                },
              },
              activities: {
                where: { userId },
                orderBy: { completedAt: "desc" },
                take: 1,
                select: { answer: true, completedAt: true },
              },
            },
          },
        },
      })
      const remediation = gap?.remediationRevisions[0]
      if (!gap || !remediation) throw new LearningGapNotFoundError()
      const activity = remediation.activities[0]

      return {
        id: gap.id,
        goalSkillId: gap.goalSkillId,
        status: gap.status as "OPEN" | "RESOLVED",
        skillTitle: gap.goalSkill.skillNode.title,
        openedAt: gap.openedAt.toISOString(),
        remediation: {
          id: remediation.id,
          revision: remediation.revision,
          gapLabel: remediation.gapLabel,
          recommendedAction: remediation.recommendedAction,
          explanation: remediation.explanation,
          workedExample: remediation.workedExample,
          scaffoldPrompt: remediation.scaffoldPrompt,
          citation: {
            sourceVersionId: remediation.sourceVersion.id,
            sourceName: remediation.sourceVersion.source.displayName,
            sourceUrl: remediation.sourceVersion.source.displayUrl,
            locator: remediation.citationLocator,
            excerpt: remediation.citationExcerpt,
          },
          activity: activity
            ? {
                answer: activity.answer,
                completedAt: activity.completedAt.toISOString(),
              }
            : null,
        },
      }
    },

    async completeRemediation(input: {
      userId: string
      goalSkillId: string
      gapId: string
      remediationRevisionId: string
      answer: string
    }) {
      const userId = requiredText(input.userId, "userId", 128)
      const goalSkillId = requiredText(input.goalSkillId, "goalSkillId", 128)
      const gapId = requiredText(input.gapId, "gapId", 128)
      const submittedRevisionId = requiredText(
        input.remediationRevisionId,
        "remediationRevisionId",
        128,
      )
      const answer = requiredText(input.answer, "answer", 4_000)
      const completedAt = validDate(clock(), "clock")

      try {
        return await database.$transaction(
          async (transaction) => {
            const gap = await transaction.learningGap.findFirst({
              where: {
                id: gapId,
                userId,
                goalSkillId,
                remediationRevisions: { some: { id: submittedRevisionId } },
              },
              select: {
                id: true,
                remediationRevisions: {
                  orderBy: { revision: "desc" },
                  take: 1,
                  select: { id: true },
                },
              },
            })
            if (!gap) throw new LearningGapNotFoundError()

            const latestRevisionId = gap.remediationRevisions[0]?.id
            if (!latestRevisionId) throw new LearningGapNotFoundError()
            if (latestRevisionId !== submittedRevisionId) {
              throw new StaleRemediationRevisionError()
            }

            const existing = await transaction.remediationActivity.findUnique({
              where: {
                userId_learningGapId_remediationRevisionId: {
                  userId,
                  learningGapId: gap.id,
                  remediationRevisionId: submittedRevisionId,
                },
              },
              select: { completedAt: true },
            })
            if (existing) {
              return {
                gapId: gap.id,
                remediationRevisionId: submittedRevisionId,
                completedAt: existing.completedAt.toISOString(),
                alreadyCompleted: true,
              }
            }

            const activity = await transaction.remediationActivity.create({
              data: {
                userId,
                learningGapId: gap.id,
                remediationRevisionId: submittedRevisionId,
                answer,
                completedAt,
              },
              select: { completedAt: true },
            })
            return {
              gapId: gap.id,
              remediationRevisionId: submittedRevisionId,
              completedAt: activity.completedAt.toISOString(),
              alreadyCompleted: false,
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        )
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error

        // Two tabs can complete the same immutable scaffold revision at once.
        // Restore the winner instead of surfacing the expected unique race.
        const winner = await database.learningGap.findFirst({
          where: {
            id: gapId,
            userId,
            goalSkillId,
            remediationRevisions: { some: { id: submittedRevisionId } },
          },
          select: {
            id: true,
            remediationRevisions: {
              orderBy: { revision: "desc" },
              take: 1,
              select: {
                id: true,
                activities: {
                  where: { userId },
                  take: 1,
                  select: { completedAt: true },
                },
              },
            },
          },
        })
        const revision = winner?.remediationRevisions[0]
        if (!winner || !revision) throw new LearningGapNotFoundError()
        if (revision.id !== submittedRevisionId) {
          throw new StaleRemediationRevisionError()
        }
        const activity = revision?.activities[0]
        if (!activity) throw error
        return {
          gapId: winner.id,
          remediationRevisionId: revision.id,
          completedAt: activity.completedAt.toISOString(),
          alreadyCompleted: true,
        }
      }
    },
  }
}

const remediationService = createRemediationService(prisma)

export const getOwnedLearningGap = remediationService.getOwnedLearningGap
export const completeRemediation = remediationService.completeRemediation

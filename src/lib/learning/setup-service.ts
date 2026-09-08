import { randomUUID } from "node:crypto"

import { Prisma } from "@prisma/client"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/learning/slug"
import {
  goalSetupSchema,
  questionSetupSchema,
  skillSetupSchema,
} from "@/lib/learning/validation"

const ownerIdSchema = z.string().trim().min(1).max(128)

const createGoalInputSchema = goalSetupSchema.extend({
  userId: ownerIdSchema,
})

const createSkillInputSchema = skillSetupSchema.extend({
  userId: ownerIdSchema,
  goalId: ownerIdSchema,
})

const createQuestionInputSchema = questionSetupSchema.extend({
  userId: ownerIdSchema,
  goalSkillId: ownerIdSchema,
})

const startReviewInputSchema = z.object({
  userId: ownerIdSchema,
  goalSkillId: ownerIdSchema,
})

type CreateGoalInput = z.input<typeof createGoalInputSchema>
type CreateSkillInput = z.input<typeof createSkillInputSchema>
type CreateQuestionInput = z.input<typeof createQuestionInputSchema>
type StartReviewInput = z.input<typeof startReviewInputSchema>
type LearningTransaction = Prisma.TransactionClient

const LIVE_GOAL_STATUSES = ["ACTIVE", "MAINTAINING"] as const
const OPEN_GOAL_SKILL_LIFECYCLES = ["DRAFT", "READY", "ACTIVE"] as const
const OPEN_SESSION_ITEM_STATUSES = ["PRESENTED"] as const
const MAX_FAMILIAR_RECALL_ITEMS = 8

const INITIAL_READINESS_EXPLANATION = JSON.stringify({
  summary: "No reviews yet.",
  evidence: [],
  nextStep: "Complete the first recall.",
})

export class LearningSetupNotFoundError extends Error {
  constructor() {
    super("Learning item not found.")
    this.name = "LearningSetupNotFoundError"
  }
}

export class LearningSetupConflictError extends Error {
  constructor(public readonly publicMessage: string) {
    super(publicMessage)
    this.name = "LearningSetupConflictError"
  }
}

export class LearningSetupInvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LearningSetupInvariantError"
  }
}

export type GoalSetupResult = {
  goalId: string
  graphId: string
}

export type SkillSetupResult = {
  goalSkillId: string
  skillNodeId: string
  scopeVersionId: string
  conceptVersionId: string
}

export type QuestionSetupResult = {
  questionId: string
  questionRevisionId: string
  reviewScheduleId: string
}

export type PracticeSessionResult = {
  sessionId: string
  sessionItemId: string
  resumed: boolean
}

export type QuestionAndSessionResult = QuestionSetupResult & PracticeSessionResult

type RecallQueueCandidate = {
  generatedSpec?: { role: string } | null
  hasOpenGap?: boolean
}

/** Applies the deterministic MVP mix: familiar questions stay the majority. */
export function selectRecallQueue<T extends RecallQueueCandidate>(
  dueSchedules: readonly T[],
): T[] {
  const familiar = dueSchedules
    .filter((schedule) => schedule.generatedSpec?.role !== "TRANSFER")
    .sort((left, right) => Number(Boolean(right.hasOpenGap)) - Number(Boolean(left.hasOpenGap)))
    .slice(0, MAX_FAMILIAR_RECALL_ITEMS)
  const transfer = dueSchedules.filter(
    (schedule) => schedule.generatedSpec?.role === "TRANSFER",
  )
  const transferCount = familiar.length >= 8 ? 2 : familiar.length >= 4 ? 1 : 0

  return [...familiar, ...transfer.slice(0, transferCount)]
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  )
}

async function nextGoalSlug(
  tx: LearningTransaction,
  userId: string,
  title: string,
): Promise<string> {
  const base = slugify(title)

  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`
    const existing = await tx.learningGoal.findUnique({
      where: { userId_slug: { userId, slug: candidate } },
      select: { id: true },
    })

    if (!existing) return candidate
  }

  return `${base}-${randomUUID().slice(0, 8)}`
}

async function nextSkillSlug(
  tx: LearningTransaction,
  graphId: string,
  title: string,
): Promise<string> {
  const base = slugify(title)

  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`
    const existing = await tx.skillNode.findUnique({
      where: { graphId_slug: { graphId, slug: candidate } },
      select: { id: true },
    })

    if (!existing) return candidate
  }

  return `${base}-${randomUUID().slice(0, 8)}`
}

async function createActiveGoalInTransaction(
  tx: LearningTransaction,
  input: z.output<typeof createGoalInputSchema>,
): Promise<GoalSetupResult> {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  })
  if (!user) throw new LearningSetupNotFoundError()

  const existingLiveGoal = await tx.learningGoal.findFirst({
    where: {
      userId: input.userId,
      status: { in: [...LIVE_GOAL_STATUSES] },
    },
    select: { id: true },
  })
  if (existingLiveGoal) {
    throw new LearningSetupConflictError("You already have an active goal.")
  }

  const graph = await tx.skillGraph.upsert({
    where: { userId: input.userId },
    update: {},
    create: { userId: input.userId },
    select: { id: true },
  })
  const slug = await nextGoalSlug(tx, input.userId, input.title)
  const goal = await tx.learningGoal.create({
    data: {
      userId: input.userId,
      graphId: graph.id,
      title: input.title,
      outcome: input.outcome,
      slug,
      status: "ACTIVE",
    },
    select: { id: true },
  })

  return {
    goalId: goal.id,
    graphId: graph.id,
  }
}

export async function createActiveLearningGoal(
  input: CreateGoalInput,
): Promise<GoalSetupResult> {
  const parsed = createGoalInputSchema.parse(input)

  try {
    return await prisma.$transaction((tx) => createActiveGoalInTransaction(tx, parsed))
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new LearningSetupConflictError("You already have an active goal.")
    }
    throw error
  }
}

async function createSkillLeafInTransaction(
  tx: LearningTransaction,
  input: z.output<typeof createSkillInputSchema>,
): Promise<SkillSetupResult> {
  const goal = await tx.learningGoal.findFirst({
    where: {
      id: input.goalId,
      userId: input.userId,
      status: { in: [...LIVE_GOAL_STATUSES] },
      graph: { userId: input.userId },
    },
    select: {
      id: true,
      graphId: true,
    },
  })
  if (!goal) throw new LearningSetupNotFoundError()

  const slug = await nextSkillSlug(tx, goal.graphId, input.title)
  const skillNode = await tx.skillNode.create({
    data: {
      graphId: goal.graphId,
      parentId: null,
      kind: "SKILL",
      title: input.title,
      slug,
      outcome: input.outcome,
      defaultSuccessCriterion: input.successCriterion,
      state: "READY",
    },
    select: { id: true },
  })
  const goalSkill = await tx.goalSkill.create({
    data: {
      userId: input.userId,
      goalId: goal.id,
      skillNodeId: skillNode.id,
      requirement: "REQUIRED",
      lifecycle: "DRAFT",
    },
    select: { id: true },
  })
  const scopeVersion = await tx.goalSkillScopeVersion.create({
    data: {
      goalSkillId: goalSkill.id,
      version: 1,
      outcome: input.outcome,
      successCriterion: input.successCriterion,
      policyVersion: "mastery-v1",
      creationReason: "INITIAL_MANUAL_SETUP",
    },
    select: { id: true },
  })
  const concept = await tx.concept.create({
    data: {
      skillNodeId: skillNode.id,
      canonicalKey: slugify(input.title),
      state: "ACTIVE",
      origin: "MANUAL",
    },
    select: { id: true },
  })
  const conceptVersion = await tx.conceptVersion.create({
    data: {
      conceptId: concept.id,
      revision: 1,
      title: input.title,
      definition: input.outcome,
      createdById: input.userId,
    },
    select: { id: true },
  })

  await tx.concept.update({
    where: { id: concept.id },
    data: { currentVersionId: conceptVersion.id },
  })
  await tx.goalSkillScopeConcept.create({
    data: {
      scopeVersionId: scopeVersion.id,
      conceptVersionId: conceptVersion.id,
      requirement: "REQUIRED",
      weight: 1,
    },
  })
  await tx.goalSkill.update({
    where: { id: goalSkill.id },
    data: {
      currentScopeVersionId: scopeVersion.id,
      lifecycle: "READY",
    },
  })

  return {
    goalSkillId: goalSkill.id,
    skillNodeId: skillNode.id,
    scopeVersionId: scopeVersion.id,
    conceptVersionId: conceptVersion.id,
  }
}

export async function createSkillLeaf(input: CreateSkillInput): Promise<SkillSetupResult> {
  const parsed = createSkillInputSchema.parse(input)
  return prisma.$transaction((tx) => createSkillLeafInTransaction(tx, parsed))
}

async function getOwnedGoalSkillForQuestion(
  tx: LearningTransaction,
  userId: string,
  goalSkillId: string,
) {
  const goalSkill = await tx.goalSkill.findFirst({
    where: {
      id: goalSkillId,
      userId,
      lifecycle: { in: [...OPEN_GOAL_SKILL_LIFECYCLES] },
      goal: {
        userId,
        status: { in: [...LIVE_GOAL_STATUSES] },
      },
      skillNode: {
        kind: "SKILL",
        graph: { userId },
      },
    },
    select: {
      id: true,
      goalId: true,
      skillNodeId: true,
      currentScopeVersionId: true,
      currentScopeVersion: {
        select: {
          id: true,
          goalSkillId: true,
          concepts: {
            where: { requirement: "REQUIRED" },
            select: {
              conceptVersionId: true,
              conceptVersion: {
                select: {
                  concept: {
                    select: { skillNodeId: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!goalSkill) throw new LearningSetupNotFoundError()

  const scope = goalSkill.currentScopeVersion
  if (
    !scope ||
    goalSkill.currentScopeVersionId !== scope.id ||
    scope.goalSkillId !== goalSkill.id
  ) {
    throw new LearningSetupConflictError("Finish the skill scope before adding recall.")
  }

  if (scope.concepts.length !== 1) {
    throw new LearningSetupConflictError(
      "This setup flow needs exactly one required concept.",
    )
  }

  const requiredConcept = scope.concepts[0]
  if (requiredConcept.conceptVersion.concept.skillNodeId !== goalSkill.skillNodeId) {
    throw new LearningSetupInvariantError(
      "The required concept does not belong to this skill.",
    )
  }

  return {
    ...goalSkill,
    scope,
    requiredConceptVersionId: requiredConcept.conceptVersionId,
  }
}

async function createManualQuestionInTransaction(
  tx: LearningTransaction,
  input: z.output<typeof createQuestionInputSchema>,
  now: Date,
): Promise<QuestionSetupResult> {
  const goalSkill = await getOwnedGoalSkillForQuestion(
    tx,
    input.userId,
    input.goalSkillId,
  )

  const existingQuestion = await tx.goalQuestion.findFirst({
    where: {
      goalId: goalSkill.goalId,
      status: "ACTIVE",
      question: {
        userId: input.userId,
        skillNodeId: goalSkill.skillNodeId,
        state: "ACTIVE",
      },
    },
    select: { id: true },
  })
  if (existingQuestion) {
    throw new LearningSetupConflictError("This skill already has a recall prompt.")
  }

  const question = await tx.question.create({
    data: {
      userId: input.userId,
      skillNodeId: goalSkill.skillNodeId,
      state: "ACTIVE",
      origin: "MANUAL",
      type: "FREE_RECALL",
      schedulingEligible: true,
    },
    select: { id: true },
  })
  const revision = await tx.questionRevision.create({
    data: {
      questionId: question.id,
      revision: 1,
      prompt: input.prompt,
      referenceAnswer: input.referenceAnswer,
      createdById: input.userId,
    },
    select: { id: true },
  })

  await tx.questionRevisionConcept.create({
    data: {
      questionRevisionId: revision.id,
      conceptVersionId: goalSkill.requiredConceptVersionId,
      isPrimary: true,
    },
  })
  await tx.question.update({
    where: { id: question.id },
    data: { currentRevisionId: revision.id },
  })
  await tx.goalQuestion.create({
    data: {
      goalId: goalSkill.goalId,
      questionId: question.id,
      status: "ACTIVE",
    },
  })
  const schedule = await tx.reviewSchedule.create({
    data: {
      userId: input.userId,
      questionId: question.id,
      questionRevisionId: revision.id,
      dueAt: now,
      intervalMinutes: 0,
      repetitions: 0,
      lapses: 0,
      algorithmVersion: "schedule-v1",
      version: 0,
    },
    select: { id: true },
  })
  await tx.goalSkillReadiness.upsert({
    where: {
      goalSkillId_scopeVersionId_ruleVersion: {
        goalSkillId: goalSkill.id,
        scopeVersionId: goalSkill.scope.id,
        ruleVersion: "mastery-v1",
      },
    },
    update: {
      stage: "UNASSESSED",
      confidence: "LOW",
      scopeCoverage: 1,
      earliestDueAt: now,
      explanationJson: INITIAL_READINESS_EXPLANATION,
      computedAt: now,
    },
    create: {
      goalSkillId: goalSkill.id,
      scopeVersionId: goalSkill.scope.id,
      ruleVersion: "mastery-v1",
      stage: "UNASSESSED",
      confidence: "LOW",
      scopeCoverage: 1,
      earliestDueAt: now,
      explanationJson: INITIAL_READINESS_EXPLANATION,
      computedAt: now,
    },
  })

  // This is deliberately the final setup mutation: an Active membership is
  // never observable without its current scope, required concept, active
  // question revision, primary concept link, and due schedule.
  await tx.goalSkill.update({
    where: { id: goalSkill.id },
    data: { lifecycle: "ACTIVE" },
  })

  return {
    questionId: question.id,
    questionRevisionId: revision.id,
    reviewScheduleId: schedule.id,
  }
}

export async function createManualQuestion(
  input: CreateQuestionInput,
  options: { now?: Date } = {},
): Promise<QuestionSetupResult> {
  const parsed = createQuestionInputSchema.parse(input)
  const now = options.now ?? new Date()
  return prisma.$transaction((tx) => createManualQuestionInTransaction(tx, parsed, now))
}

async function findActiveSession(
  tx: LearningTransaction,
  userId: string,
  expectedGoalSkillId?: string,
): Promise<PracticeSessionResult | null> {
  const existing = await tx.practiceSession.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      goalSkillId: true,
      goal: { select: { userId: true } },
      goalSkill: { select: { userId: true } },
      items: {
        where: { status: { in: [...OPEN_SESSION_ITEM_STATUSES] } },
        orderBy: { ordinal: "asc" },
        take: 1,
        select: {
          id: true,
          question: { select: { userId: true } },
          responseCheckpoint: { select: { id: true, userId: true } },
        },
      },
    },
  })

  if (!existing) return null
  if (expectedGoalSkillId && existing.goalSkillId !== expectedGoalSkillId) {
    throw new LearningSetupConflictError("Another skill has a recall in progress. Go to Today to resume it before starting this skill.")
  }
  const item = existing.items[0]
  if (
    existing.goal.userId !== userId ||
    existing.goalSkill?.userId !== userId ||
    item?.question.userId !== userId ||
    item?.responseCheckpoint?.userId !== userId
  ) {
    throw new LearningSetupInvariantError(
      "The active practice session has no resumable checkpoint.",
    )
  }

  return {
    sessionId: existing.id,
    sessionItemId: item.id,
    resumed: true,
  }
}

async function startOrResumePracticeInTransaction(
  tx: LearningTransaction,
  input: z.output<typeof startReviewInputSchema>,
  now: Date,
): Promise<PracticeSessionResult> {
  const activeSession = await findActiveSession(tx, input.userId, input.goalSkillId)
  if (activeSession) return activeSession

  const goalSkill = await tx.goalSkill.findFirst({
    where: {
      id: input.goalSkillId,
      userId: input.userId,
      lifecycle: "ACTIVE",
      goal: {
        userId: input.userId,
        status: { in: [...LIVE_GOAL_STATUSES] },
      },
      skillNode: {
        kind: "SKILL",
        graph: { userId: input.userId },
      },
    },
    select: {
      id: true,
      goalId: true,
      skillNodeId: true,
      currentScopeVersionId: true,
      currentScopeVersion: {
        select: {
          id: true,
          goalSkillId: true,
          concepts: {
            where: { requirement: "REQUIRED" },
            select: {
              conceptVersionId: true,
              conceptVersion: {
                select: {
                  concept: { select: { skillNodeId: true } },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!goalSkill) throw new LearningSetupNotFoundError()

  const scope = goalSkill.currentScopeVersion
  if (
    !scope ||
    scope.id !== goalSkill.currentScopeVersionId ||
    scope.goalSkillId !== goalSkill.id ||
    scope.concepts.length === 0 ||
    scope.concepts.some(
      (concept) =>
        concept.conceptVersion.concept.skillNodeId !== goalSkill.skillNodeId,
    )
  ) {
    throw new LearningSetupInvariantError("The active skill has no valid required scope.")
  }

  const dueSchedules = await tx.reviewSchedule.findMany({
    where: {
      userId: input.userId,
      dueAt: { lte: now },
      question: {
        userId: input.userId,
        skillNodeId: goalSkill.skillNodeId,
        state: "ACTIVE",
        schedulingEligible: true,
        goalQuestions: {
          some: {
            goalId: goalSkill.goalId,
            status: "ACTIVE",
          },
        },
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    take: 16,
    select: {
      id: true,
      questionId: true,
      questionRevisionId: true,
      dueAt: true,
      intervalMinutes: true,
      repetitions: true,
      lapses: true,
      algorithmVersion: true,
      question: {
        select: {
          currentRevisionId: true,
          generatedSpec: { select: { role: true } },
        },
      },
      questionRevision: {
        select: {
              concepts: {
                where: { isPrimary: true },
                select: {
                  conceptVersionId: true,
                  conceptVersion: {
                    select: {
                      learningGaps: {
                        where: {
                          userId: input.userId,
                          goalSkillId: goalSkill.id,
                          status: "OPEN",
                        },
                        take: 1,
                        select: { id: true },
                      },
                    },
                  },
                },
              },
        },
      },
    },
  })
  const schedules = selectRecallQueue(
    dueSchedules.map((schedule) => ({
      ...schedule,
      generatedSpec: schedule.question.generatedSpec,
      hasOpenGap: schedule.questionRevision.concepts.some(
        (concept) => (concept.conceptVersion?.learningGaps?.length ?? 0) > 0,
      ),
    })),
  )
  if (schedules.length === 0) {
    throw new LearningSetupConflictError("No review is due for this skill.")
  }

  const requiredConceptIds = new Set(
    scope.concepts.map((concept) => concept.conceptVersionId),
  )
  for (const schedule of schedules) {
    const primaryConcepts = schedule.questionRevision.concepts
    if (
      schedule.question.currentRevisionId !== schedule.questionRevisionId ||
      primaryConcepts.length !== 1 ||
      !requiredConceptIds.has(primaryConcepts[0].conceptVersionId)
    ) {
      throw new LearningSetupInvariantError(
        "A due question is not linked to the current required scope.",
      )
    }
  }

  const session = await tx.practiceSession.create({
    data: {
      userId: input.userId,
      goalId: goalSkill.goalId,
      goalSkillId: goalSkill.id,
      reason: schedules.every((schedule) => schedule.repetitions === 0)
        ? "BASELINE"
        : "DUE",
      status: "ACTIVE",
      targetCount: schedules.length,
    },
    select: { id: true },
  })
  let firstItemId: string | undefined
  for (const [ordinal, schedule] of schedules.entries()) {
    const item = await tx.practiceSessionItem.create({
      data: {
        sessionId: session.id,
        questionId: schedule.questionId,
        questionRevisionId: schedule.questionRevisionId,
        ordinal,
        status: "PRESENTED",
        scheduleDueAtBefore: schedule.dueAt,
        intervalMinutesBefore: schedule.intervalMinutes,
        repetitionsBefore: schedule.repetitions,
        lapsesBefore: schedule.lapses,
        scheduleAlgorithmVersion: schedule.algorithmVersion,
        presentedAt: now,
      },
      select: { id: true },
    })
    firstItemId ??= item.id
    await tx.practiceResponseCheckpoint.create({
      data: {
        sessionItemId: item.id,
        userId: input.userId,
        phase: "PROMPT",
        draftAnswer: "",
        version: 0,
      },
    })
  }
  if (!firstItemId) {
    throw new LearningSetupInvariantError("The recall queue has no practice item.")
  }

  return {
    sessionId: session.id,
    sessionItemId: firstItemId,
    resumed: false,
  }
}

export async function startOrResumePracticeSession(
  input: StartReviewInput,
  options: { now?: Date } = {},
): Promise<PracticeSessionResult> {
  const parsed = startReviewInputSchema.parse(input)
  const now = options.now ?? new Date()

  try {
    return await prisma.$transaction((tx) =>
      startOrResumePracticeInTransaction(tx, parsed, now),
    )
  } catch (error) {
    // The partial unique index is the final defense when two tabs race to
    // create the user's one active session. Resume the winner after rollback.
    if (isUniqueConstraintError(error)) {
      return prisma.$transaction(async (tx) => {
        const activeSession = await findActiveSession(tx, parsed.userId, parsed.goalSkillId)
        if (activeSession) return activeSession
        throw error
      })
    }
    throw error
  }
}

export async function createManualQuestionAndStartSession(
  input: CreateQuestionInput,
  options: { now?: Date } = {},
): Promise<QuestionAndSessionResult> {
  const parsed = createQuestionInputSchema.parse(input)
  const now = options.now ?? new Date()

  try {
    return await prisma.$transaction(async (tx) => {
      const activeSession = await findActiveSession(tx, parsed.userId)
      if (activeSession) {
        throw new LearningSetupConflictError(
          "Finish your open practice session before adding a recall prompt.",
        )
      }

      const question = await createManualQuestionInTransaction(tx, parsed, now)
      const session = await startOrResumePracticeInTransaction(
        tx,
        { userId: parsed.userId, goalSkillId: parsed.goalSkillId },
        now,
      )
      return { ...question, ...session }
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const activeSession = await prisma.$transaction((tx) =>
        findActiveSession(tx, parsed.userId),
      )
      if (activeSession) {
        throw new LearningSetupConflictError(
          "A practice session is already open. Continue it, then add this prompt.",
        )
      }
    }
    throw error
  }
}

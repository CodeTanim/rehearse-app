import "server-only"

import { createHash } from "node:crypto"

import { Prisma } from "@prisma/client"
import { z } from "zod"

import {
  learningPackSchema,
  type LearningPack,
} from "@/lib/ai/learning-pack-schema"
import {
  createInitialQuizGapInTransaction,
  type RemediationContent,
} from "@/lib/learning/remediation-service"
import { toReviewDay } from "@/lib/learning/review-day"
import { LearningSetupNotFoundError } from "@/lib/learning/setup-service"
import { slugify } from "@/lib/learning/slug"
import { prisma } from "@/lib/prisma"

const assessmentSchema = z.enum(["MISSED", "PARTIAL", "MEETS"])
const citationSchema = z.object({
  sourceId: z.string().min(1).max(128),
  locator: z.string().min(1).max(240),
  excerpt: z.string().min(1).max(600),
}).strict()
const responseSchema = z.union([
  z.object({ selectedChoiceIndex: z.number().int().min(0).max(3) }).strict(),
  z.object({ text: z.string().trim().min(1).max(4_000) }).strict(),
])

export const initialQuizAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  goalSkillId: z.string().trim().min(1).max(128),
  packVersionId: z.string().trim().min(1).max(128),
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }),
  answers: z.array(z.object({
    questionIndex: z.number().int().min(0).max(5),
    competencyId: z.string().min(1).max(80),
    questionType: z.enum(["MULTIPLE_CHOICE", "SHORT_RESPONSE"]),
    prompt: z.string().min(1).max(1_000),
    response: responseSchema,
    result: z.object({
      assessment: assessmentSchema,
      isCorrect: z.boolean().nullable(),
    }).strict(),
    referenceAnswer: z.string().min(1).max(2_000),
    explanation: z.string().min(1).max(2_000),
    citation: citationSchema,
  }).strict()).min(1).max(5),
}).strict()

export type InitialQuizAttemptInput = z.input<typeof initialQuizAttemptSchema>

type CanonicalAnswer = {
  questionIndex: number
  competencyId: string
  questionType: "MULTIPLE_CHOICE" | "SHORT_RESPONSE"
  prompt: string
  response: { selectedChoiceIndex: number } | { text: string }
  result: {
    assessment: "MISSED" | "PARTIAL" | "MEETS"
    isCorrect: boolean | null
  }
  referenceAnswer: string
  explanation: string
  citation: {
    sourceId: string
    locator: string
    excerpt: string
  }
}

function initialRemediationContent(
  question: LearningPack["questions"][number],
  competencyTitle: string,
): RemediationContent {
  const label = competencyTitle.trim() || "This idea"

  return {
    sourceVersionId: question.citation.sourceId,
    gapLabel: label,
    recommendedAction: `Review ${label}, then explain it once without looking.`,
    explanation: question.explanation,
    workedExample: question.referenceAnswer,
    scaffoldPrompt:
      question.type === "MULTIPLE_CHOICE"
        ? "In your own words, why is the correct answer supported by the source?"
        : `Explain the key idea behind ${label} in your own words.`,
    scaffoldAnswer: question.referenceAnswer,
    citationLocator: question.citation.locator,
    citationExcerpt: question.citation.excerpt,
  }
}

export class InitialQuizServiceError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "INVALID_ATTEMPT"
      | "ATTEMPT_CONFLICT"
      | "STALE_PACK",
    public readonly publicMessage: string,
    public readonly status: 404 | 409,
  ) {
    super(publicMessage)
    this.name = "InitialQuizServiceError"
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function stableId(prefix: string, value: string) {
  return `${prefix}_${sha256(value).slice(0, 24)}`
}

function isChoiceResponse(
  value: z.output<typeof responseSchema>,
): value is { selectedChoiceIndex: number } {
  return "selectedChoiceIndex" in value
}

function sameCitation(
  left: z.output<typeof citationSchema>,
  right: z.output<typeof citationSchema>,
) {
  return (
    left.sourceId === right.sourceId &&
    left.locator === right.locator &&
    left.excerpt === right.excerpt
  )
}

export function canonicalizeInitialQuizAnswers(
  pack: LearningPack,
  submitted: z.output<typeof initialQuizAttemptSchema>["answers"],
): CanonicalAnswer[] {
  const expected = pack.questions
    .map((question, questionIndex) => ({ question, questionIndex }))
    .filter(({ question }) => !question.isTransferProbe)

  if (submitted.length !== expected.length) {
    throw new InitialQuizServiceError(
      "INVALID_ATTEMPT",
      "Complete every quiz question before saving.",
      409,
    )
  }

  return expected.map(({ question, questionIndex }, position) => {
    const answer = submitted[position]
    if (
      answer.questionIndex !== questionIndex ||
      answer.competencyId !== question.competencyId ||
      answer.questionType !== question.type ||
      answer.prompt !== question.prompt ||
      answer.referenceAnswer !== question.referenceAnswer ||
      answer.explanation !== question.explanation ||
      !sameCitation(answer.citation, question.citation)
    ) {
      throw new InitialQuizServiceError(
        "STALE_PACK",
        "This quiz changed before it was saved. Reload and try again.",
        409,
      )
    }

    if (question.type === "MULTIPLE_CHOICE") {
      if (!isChoiceResponse(answer.response) || question.correctChoiceIndex === null) {
        throw new InitialQuizServiceError(
          "INVALID_ATTEMPT",
          "A multiple-choice answer is invalid.",
          409,
        )
      }
      const isCorrect = answer.response.selectedChoiceIndex === question.correctChoiceIndex
      const assessment = isCorrect ? "MEETS" : "MISSED"
      if (answer.result.isCorrect !== isCorrect || answer.result.assessment !== assessment) {
        throw new InitialQuizServiceError(
          "INVALID_ATTEMPT",
          "A quiz result could not be verified.",
          409,
        )
      }
      return {
        questionIndex,
        competencyId: question.competencyId,
        questionType: question.type,
        prompt: question.prompt,
        response: { selectedChoiceIndex: answer.response.selectedChoiceIndex },
        result: { assessment, isCorrect },
        referenceAnswer: question.referenceAnswer,
        explanation: question.explanation,
        citation: { ...question.citation },
      }
    }

    if (isChoiceResponse(answer.response) || answer.result.isCorrect !== null) {
      throw new InitialQuizServiceError(
        "INVALID_ATTEMPT",
        "A short response result is invalid.",
        409,
      )
    }
    return {
      questionIndex,
      competencyId: question.competencyId,
      questionType: question.type,
      prompt: question.prompt,
      response: { text: answer.response.text },
      result: { assessment: answer.result.assessment, isCorrect: null },
      referenceAnswer: question.referenceAnswer,
      explanation: question.explanation,
      citation: { ...question.citation },
    }
  })
}

export function validateInitialQuizTiming(startedAt: Date, completedAt: Date, now: Date, savedStartedAt?: Date) {
  const resumed = savedStartedAt?.getTime() === startedAt.getTime()
  if (
    Number.isNaN(startedAt.getTime()) ||
    Number.isNaN(completedAt.getTime()) ||
    completedAt < startedAt ||
    (!resumed && completedAt.getTime() - startedAt.getTime() > 8 * 60 * 60 * 1_000) ||
    (!resumed && startedAt.getTime() < now.getTime() - 24 * 60 * 60 * 1_000) ||
    completedAt.getTime() > now.getTime() + 5 * 60 * 1_000
  ) {
    throw new InitialQuizServiceError(
      "INVALID_ATTEMPT",
      "The quiz timing could not be verified. Reload and try again.",
      409,
    )
  }
}

const DAY_MS = 24 * 60 * 60 * 1_000

export type RecallInventoryItem = {
  questionId: string
  revisionId: string
  questionIndex: number
  questionFamilyId: string
  competencyId: string
  role: "CORE" | "TRANSFER"
  responseType: "MULTIPLE_CHOICE" | "SHORT_RESPONSE"
  prompt: string
  choices: string[]
  correctChoiceIndex: number | null
  referenceAnswer: string
  explanation: string
  citation: LearningPack["questions"][number]["citation"]
  dueAt: Date
  intervalMinutes: number
}

/**
 * Builds a deterministic recall inventory from the immutable pack. Core
 * questions return together on day one. The two withheld transfer probes are
 * introduced one per recall day, so a normal successful learner sees a new
 * angle alongside familiar material instead of as a standalone surprise.
 */
export function buildRecallInventory(
  pack: LearningPack,
  packVersionId: string,
  now: Date,
): RecallInventoryItem[] {
  let transferOrdinal = 0

  return pack.questions.map((question, questionIndex) => {
    const role = question.isTransferProbe ? "TRANSFER" : "CORE"
    if (question.isTransferProbe) transferOrdinal += 1
    const daysUntilDue = question.isTransferProbe ? transferOrdinal : 1
    const key = `${packVersionId}:question:${questionIndex}`

    return {
      questionId: stableId("generated_question", key),
      revisionId: stableId("generated_revision", key),
      questionIndex,
      questionFamilyId: question.questionFamilyId,
      competencyId: question.competencyId,
      role,
      responseType: question.type,
      prompt: question.prompt,
      choices: [...question.choices],
      correctChoiceIndex: question.correctChoiceIndex,
      referenceAnswer: question.referenceAnswer,
      explanation: `${question.explanation}\n\nSource: ${question.citation.locator}\n“${question.citation.excerpt}”`,
      citation: { ...question.citation },
      dueAt: new Date(now.getTime() + daysUntilDue * DAY_MS),
      intervalMinutes: daysUntilDue * 24 * 60,
    }
  })
}

async function activateRecallInventory(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    goalSkillId: string
    packVersionId: string
    pack: LearningPack
    attemptId: string
    answers: readonly CanonicalAnswer[]
    now: Date
  },
) {
  const goalSkill = await tx.goalSkill.findFirst({
    where: {
      id: input.goalSkillId,
      userId: input.userId,
      lifecycle: { not: "ARCHIVED" },
      goal: { userId: input.userId, status: { in: ["ACTIVE", "MAINTAINING"] } },
      skillNode: { graph: { userId: input.userId }, kind: "SKILL" },
    },
    select: {
      id: true,
      goalId: true,
      skillNodeId: true,
      currentScopeVersionId: true,
      currentScopeVersion: {
        select: {
          id: true,
          version: true,
        },
      },
      skillNode: {
        select: { title: true, outcome: true, defaultSuccessCriterion: true },
      },
      user: { select: { timezone: true } },
    },
  })
  if (
    !goalSkill ||
    goalSkill.currentScopeVersionId !== goalSkill.currentScopeVersion?.id
  ) {
    throw new LearningSetupNotFoundError()
  }

  const openPractice = await tx.practiceSession.findFirst({
    where: { userId: input.userId, status: "ACTIVE" },
    select: { id: true },
  })
  if (openPractice) {
    throw new InitialQuizServiceError(
      "INVALID_ATTEMPT",
      "Finish your open recall before saving this quiz.",
      409,
    )
  }

  const scope = await tx.goalSkillScopeVersion.create({
    data: {
      goalSkillId: goalSkill.id,
      version: goalSkill.currentScopeVersion.version + 1,
      outcome:
        goalSkill.skillNode.outcome ?? `Understand and apply ${goalSkill.skillNode.title}.`,
      successCriterion:
        goalSkill.skillNode.defaultSuccessCriterion ??
        `Explain and apply the required ideas in ${goalSkill.skillNode.title}.`,
      policyVersion: "mastery-v1",
      creationReason: "GENERATED_LEARNING_PACK",
    },
    select: { id: true },
  })

  const conceptVersionByPackId = new Map<string, string>()
  for (const competency of input.pack.competencies) {
    const key = `${input.packVersionId}:competency:${competency.id}`
    const conceptId = stableId("generated_concept", key)
    const conceptVersionId = stableId("generated_concept_version", key)
    await tx.concept.create({
      data: {
        id: conceptId,
        skillNodeId: goalSkill.skillNodeId,
        canonicalKey: `pack-${sha256(key).slice(0, 20)}-${slugify(competency.id)}`,
        state: "ACTIVE",
        origin: "GENERATED",
      },
    })
    await tx.conceptVersion.create({
      data: {
        id: conceptVersionId,
        conceptId,
        revision: 1,
        title: competency.title,
        definition: `Required competency for ${goalSkill.skillNode.title}.`,
        createdById: input.userId,
      },
    })
    await tx.concept.update({
      where: { id: conceptId },
      data: { currentVersionId: conceptVersionId },
    })
    await tx.goalSkillScopeConcept.create({
      data: {
        scopeVersionId: scope.id,
        conceptVersionId,
        requirement: "REQUIRED",
        weight: 1,
      },
    })
    conceptVersionByPackId.set(competency.id, conceptVersionId)
  }

  // The new pack becomes the canonical scope only after its initial quiz is
  // saved. Retire every prior inventory item in this same transaction so a
  // question mapped to the superseded scope cannot enter the new queue.
  const priorQuestions = await tx.question.findMany({
    where: {
      userId: input.userId,
      skillNodeId: goalSkill.skillNodeId,
      state: { not: "ARCHIVED" },
    },
    select: { id: true },
  })
  const priorQuestionIds = priorQuestions.map(({ id }) => id)
  if (priorQuestionIds.length > 0) {
    await tx.question.updateMany({
      where: { id: { in: priorQuestionIds }, userId: input.userId },
      data: { state: "SUSPENDED", schedulingEligible: false },
    })
    await tx.goalQuestion.updateMany({
      where: {
        goalId: goalSkill.goalId,
        questionId: { in: priorQuestionIds },
      },
      data: { status: "EXCLUDED" },
    })
  }

  const inventory = buildRecallInventory(input.pack, input.packVersionId, input.now)
  const answerByQuestionIndex = new Map(
    input.answers.map((answer) => [answer.questionIndex, answer] as const),
  )
  const competencyTitleById = new Map(
    input.pack.competencies.map((competency) => [competency.id, competency.title] as const),
  )
  let nextGapId: string | undefined

  for (const recall of inventory) {
    const conceptVersionId = conceptVersionByPackId.get(recall.competencyId)
    if (!conceptVersionId) {
      throw new InitialQuizServiceError(
        "INVALID_ATTEMPT",
        "A generated question is outside the current skill scope.",
        409,
      )
    }

    await tx.question.create({
      data: {
        id: recall.questionId,
        userId: input.userId,
        skillNodeId: goalSkill.skillNodeId,
        state: "ACTIVE",
        origin: "GENERATED",
        type: "FREE_RECALL",
        schedulingEligible: true,
      },
    })
    await tx.generatedQuestionSpec.create({
      data: {
        questionId: recall.questionId,
        learningPackVersionId: input.packVersionId,
        sourceVersionId: recall.citation.sourceId,
        questionFamilyId: recall.questionFamilyId,
        role: recall.role,
        originalIndex: recall.questionIndex,
        responseType: recall.responseType,
        choicesJson: JSON.stringify(recall.choices),
        correctChoiceIndex: recall.correctChoiceIndex,
        citationLocator: recall.citation.locator,
        citationExcerpt: recall.citation.excerpt,
      },
    })
    await tx.questionRevision.create({
      data: {
        id: recall.revisionId,
        questionId: recall.questionId,
        revision: 1,
        prompt: recall.prompt,
        referenceAnswer: recall.referenceAnswer,
        explanation: recall.explanation,
        createdById: input.userId,
      },
    })
    await tx.questionRevisionConcept.create({
      data: {
        questionRevisionId: recall.revisionId,
        conceptVersionId,
        isPrimary: true,
      },
    })
    await tx.question.update({
      where: { id: recall.questionId },
      data: { currentRevisionId: recall.revisionId },
    })
    await tx.goalQuestion.create({
      data: { goalId: goalSkill.goalId, questionId: recall.questionId, status: "ACTIVE" },
    })
    await tx.reviewSchedule.create({
      data: {
        userId: input.userId,
        questionId: recall.questionId,
        questionRevisionId: recall.revisionId,
        dueAt: recall.dueAt,
        intervalMinutes: recall.intervalMinutes,
        repetitions: 0,
        lapses: 0,
        algorithmVersion: "schedule-v1",
        version: 0,
      },
    })

    const initialAnswer = answerByQuestionIndex.get(recall.questionIndex)
    if (
      recall.role === "CORE" &&
      initialAnswer &&
      initialAnswer.result.assessment !== "MEETS"
    ) {
      const question = input.pack.questions[recall.questionIndex]
      if (!question) {
        throw new InitialQuizServiceError(
          "INVALID_ATTEMPT",
          "A generated question is missing from the current learning pack.",
          409,
        )
      }
      const gap = await createInitialQuizGapInTransaction(tx, {
        userId: input.userId,
        goalSkillId: input.goalSkillId,
        conceptVersionId,
        questionId: recall.questionId,
        questionRevisionId: recall.revisionId,
        learningPackAttemptId: input.attemptId,
        openedAt: input.now,
        openedReviewDay: toReviewDay(input.now, goalSkill.user.timezone),
        content: initialRemediationContent(
          question,
          competencyTitleById.get(recall.competencyId) ?? recall.competencyId,
        ),
      })
      nextGapId ??= gap.gapId
    }
  }

  const earliestDueAt = inventory.reduce(
    (earliest, recall) => (recall.dueAt < earliest ? recall.dueAt : earliest),
    inventory[0].dueAt,
  )
  await tx.goalSkillReadiness.upsert({
    where: {
      goalSkillId_scopeVersionId_ruleVersion: {
        goalSkillId: goalSkill.id,
        scopeVersionId: scope.id,
        ruleVersion: "mastery-v1",
      },
    },
    update: {
      stage: "UNASSESSED",
      confidence: "LOW",
      scopeCoverage: 1,
      successfulTransferProbes: 0,
      transferReviewDays: 0,
      earliestDueAt,
      explanationJson: JSON.stringify({
        summary: "Initial quiz saved.",
        evidence: [],
        nextStep: "Complete the first source-grounded recall.",
      }),
      computedAt: input.now,
    },
    create: {
      goalSkillId: goalSkill.id,
      scopeVersionId: scope.id,
      ruleVersion: "mastery-v1",
      stage: "UNASSESSED",
      confidence: "LOW",
      scopeCoverage: 1,
      successfulTransferProbes: 0,
      transferReviewDays: 0,
      earliestDueAt,
      explanationJson: JSON.stringify({
        summary: "Initial quiz saved.",
        evidence: [],
        nextStep: "Complete the first source-grounded recall.",
      }),
      computedAt: input.now,
    },
  })
  await tx.goalSkill.update({
    where: { id: goalSkill.id },
    data: { currentScopeVersionId: scope.id, lifecycle: "ACTIVE" },
  })
  await tx.learningPack.update({
    where: { goalSkillId: goalSkill.id },
    data: { state: "ACTIVE" },
  })

  return { nextGapId }
}

export async function saveInitialQuizAttempt(
  input: InitialQuizAttemptInput & { userId: string },
  options: { now?: Date } = {},
) {
  const { userId: untrustedUserId, ...payload } = input
  const parsed = initialQuizAttemptSchema.parse(payload)
  const userId = z.string().trim().min(1).max(128).parse(untrustedUserId)
  const now = options.now ?? new Date()
  const startedAt = new Date(parsed.startedAt)
  const completedAt = new Date(parsed.completedAt)
  const savedDraft = await prisma.initialQuizDraft.findFirst({
    where: { userId, packVersionId: parsed.packVersionId, attemptId: parsed.attemptId },
    select: { createdAt: true },
  })
  validateInitialQuizTiming(startedAt, completedAt, now, savedDraft?.createdAt)

  const packVersion = await prisma.learningPackVersion.findFirst({
    where: {
      id: parsed.packVersionId,
      learningPack: {
        userId,
        goalSkillId: parsed.goalSkillId,
        currentVersionId: parsed.packVersionId,
        goalSkill: { userId },
      },
    },
    select: { id: true, contentJson: true },
  })
  if (!packVersion) {
    throw new InitialQuizServiceError("NOT_FOUND", "Quiz not found.", 404)
  }

  const pack = learningPackSchema.parse(JSON.parse(packVersion.contentJson))
  const answers = canonicalizeInitialQuizAnswers(pack, parsed.answers)
  const canonicalBody = {
    attemptId: parsed.attemptId,
    goalSkillId: parsed.goalSkillId,
    packVersionId: parsed.packVersionId,
    startedAt: parsed.startedAt,
    completedAt: parsed.completedAt,
    answers,
  }
  const bodyHash = sha256(JSON.stringify(canonicalBody))
  const existing = await prisma.learningPackAttempt.findUnique({
    where: { id: parsed.attemptId },
    select: {
      userId: true,
      learningPackVersionId: true,
      bodyHash: true,
      learningGaps: {
        where: { status: "OPEN" },
        orderBy: [{ openedAt: "asc" }, { id: "asc" }],
        take: 1,
        select: { id: true },
      },
    },
  })
  if (existing) {
    if (
      existing.userId === userId &&
      existing.learningPackVersionId === parsed.packVersionId &&
      existing.bodyHash === bodyHash
    ) {
      return {
        attemptId: parsed.attemptId,
        reused: true,
        nextGapId: existing.learningGaps[0]?.id,
      }
    }
    throw new InitialQuizServiceError(
      "ATTEMPT_CONFLICT",
      "This quiz save conflicts with an existing attempt.",
      409,
    )
  }

  const metCount = answers.filter((answer) => answer.result.assessment === "MEETS").length
  const partialCount = answers.filter((answer) => answer.result.assessment === "PARTIAL").length
  const missed = answers.filter((answer) => answer.result.assessment !== "MEETS")
  const result = {
    metCount,
    partialCount,
    missedCount: missed.length,
    remediation: missed.map((answer) => ({
      questionIndex: answer.questionIndex,
      competencyId: answer.competencyId,
      action: "STRENGTHEN" as const,
      citation: answer.citation,
    })),
  }

  let nextGapId: string | undefined
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.learningPackVersion.findFirst({
        where: {
          id: parsed.packVersionId,
          learningPack: {
            userId,
            goalSkillId: parsed.goalSkillId,
            currentVersionId: parsed.packVersionId,
            goalSkill: { userId },
          },
        },
        select: { id: true },
      })
      if (!current) throw new LearningSetupNotFoundError()

      await tx.learningPackAttempt.create({
        data: {
          id: parsed.attemptId,
          userId,
          goalSkillId: parsed.goalSkillId,
          learningPackVersionId: parsed.packVersionId,
          bodyHash,
          answersJson: JSON.stringify(answers),
          resultJson: JSON.stringify(result),
          metCount,
          questionCount: answers.length,
          startedAt,
          completedAt,
        },
      })
      const activation = await activateRecallInventory(tx, {
        userId,
        goalSkillId: parsed.goalSkillId,
        packVersionId: parsed.packVersionId,
        pack,
        attemptId: parsed.attemptId,
        answers,
        now,
      })
      nextGapId = activation.nextGapId
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.learningPackAttempt.findUnique({
        where: { id: parsed.attemptId },
        select: {
          userId: true,
          learningPackVersionId: true,
          bodyHash: true,
          learningGaps: {
            where: { status: "OPEN" },
            orderBy: [{ openedAt: "asc" }, { id: "asc" }],
            take: 1,
            select: { id: true },
          },
        },
      })
      if (
        winner?.userId === userId &&
        winner.learningPackVersionId === parsed.packVersionId &&
        winner.bodyHash === bodyHash
      ) {
        return {
          attemptId: parsed.attemptId,
          reused: true,
          nextGapId: winner.learningGaps[0]?.id,
        }
      }

      // A second tab may submit the same pack under a different attempt ID
      // and lose the one-attempt-per-pack race. Treat that as an explicit
      // completed-quiz conflict instead of leaking a raw database error.
      const completedPack = await prisma.learningPackAttempt.findUnique({
        where: {
          userId_learningPackVersionId: {
            userId,
            learningPackVersionId: parsed.packVersionId,
          },
        },
        select: { id: true },
      })
      if (completedPack) {
        throw new InitialQuizServiceError(
          "ATTEMPT_CONFLICT",
          "This initial quiz was already saved.",
          409,
        )
      }
      throw new InitialQuizServiceError(
        "ATTEMPT_CONFLICT",
        "This initial quiz was already saved.",
        409,
      )
    }
    throw error
  }

  return { attemptId: parsed.attemptId, reused: false, result, nextGapId }
}

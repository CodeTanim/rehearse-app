import "server-only"

import { createHash } from "node:crypto"

import { Prisma } from "@prisma/client"
import { z } from "zod"

import {
  generateLearningPack,
  validateLearningPack,
  type LearningPack,
  type LearningSourceSnapshot,
} from "@/lib/ai/learning-pack"
import {
  generateLocalLearningPack,
  LOCAL_LEARNING_PACK_MODEL,
} from "@/lib/ai/local-learning-pack"
import { LearningSetupNotFoundError } from "@/lib/learning/setup-service"
import { prisma } from "@/lib/prisma"

const GENERATOR_VERSION = "learning-pack-v1"
const GENERATION_WINDOW_MS = 60 * 60 * 1_000
const MAX_GENERATIONS_PER_WINDOW = 5
const GENERATION_LEASE_MS = 15 * 60 * 1_000
const inputSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  goalSkillId: z.string().trim().min(1).max(128),
})

type GeneratePackInput = z.input<typeof inputSchema>
type PackTransaction = Prisma.TransactionClient
type PackGenerator = (input: {
  skillTitle: string
  sources: LearningSourceSnapshot[]
  userId: string
  model?: string
}) => Promise<LearningPack>

export type LearningPackResult = {
  goalSkillId: string
  packVersionId: string
  pack: LearningPack
  reused: boolean
}

export class LearningPackServiceError extends Error {
  constructor(public readonly publicMessage: string) {
    super(publicMessage)
    this.name = "LearningPackServiceError"
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function ownedGoalSkillWhere(
  userId: string,
  goalSkillId: string,
): Prisma.GoalSkillWhereInput {
  return {
    id: goalSkillId,
    userId,
    lifecycle: { not: "ARCHIVED" },
    goal: { userId, status: { in: ["ACTIVE", "MAINTAINING"] } },
    skillNode: { graph: { userId }, kind: "SKILL" },
  }
}

function sourceCitationLocator(displayName: string, revision: number) {
  const suffix = ` · snapshot ${revision}`
  return `${displayName.slice(0, 240 - suffix.length)}${suffix}`
}

async function generationInput(userId: string, goalSkillId: string) {
  const goalSkill = await prisma.goalSkill.findFirst({
    where: ownedGoalSkillWhere(userId, goalSkillId),
    select: {
      id: true,
      skillNode: { select: { id: true, graphId: true, title: true } },
      sourceAssignments: {
        where: {
          userId,
          status: "INCLUDED",
          source: { userId, status: "READY" },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          sourceVersionId: true,
          source: {
            select: {
              id: true,
              userId: true,
              displayName: true,
              displayUrl: true,
            },
          },
          sourceVersion: {
            select: {
              id: true,
              sourceId: true,
              revision: true,
              sha256: true,
              extractedText: true,
            },
          },
        },
      },
    },
  })

  if (!goalSkill) throw new LearningSetupNotFoundError()
  if (goalSkill.sourceAssignments.length === 0) {
    throw new LearningPackServiceError("Add at least one ready source first.")
  }

  const sources = goalSkill.sourceAssignments.map((assignment) => {
    if (
      assignment.source.userId !== userId ||
      assignment.source.id !== assignment.sourceVersion.sourceId ||
      assignment.sourceVersion.id !== assignment.sourceVersionId
    ) {
      throw new LearningPackServiceError("A selected source changed. Refresh and try again.")
    }

    return {
      sourceId: assignment.sourceVersion.id,
      title: assignment.source.displayName,
      locator: sourceCitationLocator(
        assignment.source.displayName,
        assignment.sourceVersion.revision,
      ),
      text: assignment.sourceVersion.extractedText,
    } satisfies LearningSourceSnapshot
  })

  return {
    goalSkillId: goalSkill.id,
    skillNodeId: goalSkill.skillNode.id,
    graphId: goalSkill.skillNode.graphId,
    skillTitle: goalSkill.skillNode.title,
    sourceVersionIds: goalSkill.sourceAssignments.map((item) => item.sourceVersionId),
    sourceHashes: goalSkill.sourceAssignments.map((item) => item.sourceVersion.sha256),
    sources,
  }
}

type PreparedGenerationInput = Awaited<ReturnType<typeof generationInput>>

async function assertGenerationInputCurrent(
  tx: PackTransaction,
  userId: string,
  prepared: PreparedGenerationInput,
) {
  const current = await tx.goalSkill.findFirst({
    where: ownedGoalSkillWhere(userId, prepared.goalSkillId),
    select: {
      skillNode: { select: { id: true, graphId: true, title: true } },
      sourceAssignments: {
        where: {
          userId,
          status: "INCLUDED",
          source: { userId, status: "READY" },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          sourceVersionId: true,
          sourceVersion: { select: { sha256: true } },
        },
      },
    },
  })
  const versionIds = current?.sourceAssignments.map((item) => item.sourceVersionId)
  const hashes = current?.sourceAssignments.map((item) => item.sourceVersion.sha256)
  if (
    !current ||
    current.skillNode.id !== prepared.skillNodeId ||
    current.skillNode.graphId !== prepared.graphId ||
    current.skillNode.title !== prepared.skillTitle ||
    JSON.stringify(versionIds) !== JSON.stringify(prepared.sourceVersionIds) ||
    JSON.stringify(hashes) !== JSON.stringify(prepared.sourceHashes)
  ) {
    throw new LearningPackServiceError(
      "Your topic or sources changed while the quiz was being built. Generate it again.",
    )
  }
}

/**
 * Pack readiness is a learning-state change, never a graph-topology change.
 * Keep this small mutation isolated so retries cannot move a leaf or touch its
 * learner-created connections.
 *
 * @internal Exported for focused independence regression tests.
 */
export async function markSkillPackReady(
  tx: PackTransaction,
  input: {
    skillNodeId: string
  },
) {
  await tx.skillNode.update({
    where: { id: input.skillNodeId },
    data: { state: "READY" },
  })
}

function packInputHash(input: {
  skillTitle: string
  sourceVersionIds: string[]
  sourceHashes: string[]
  modelId: string
}) {
  return sha256(
    JSON.stringify({
      generatorVersion: GENERATOR_VERSION,
      skillTitle: input.skillTitle,
      sourceVersionIds: input.sourceVersionIds,
      sourceHashes: input.sourceHashes,
      modelId: input.modelId,
    }),
  )
}

async function findExistingVersion(
  userId: string,
  prepared: PreparedGenerationInput,
  inputHash: string,
): Promise<LearningPackResult | null> {
  const existing = await prisma.learningPackVersion.findFirst({
    where: {
      inputHash,
      learningPack: {
        userId,
        goalSkillId: prepared.goalSkillId,
        goalSkill: { userId },
      },
    },
    select: {
      id: true,
      contentJson: true,
      _count: { select: { attempts: true } },
      learningPack: { select: { id: true, currentVersionId: true } },
    },
  })
  if (!existing) return null

  const pack = validateLearningPack(
    JSON.parse(existing.contentJson),
    await sourceSnapshotsForVersion(userId, existing.id),
  )
  if (existing.learningPack.currentVersionId !== existing.id) {
    await prisma.$transaction(async (tx) => {
      await assertGenerationInputCurrent(tx, userId, prepared)
      await tx.learningPack.update({
        where: { id: existing.learningPack.id },
        data: {
          currentVersionId: existing.id,
          state: existing._count.attempts > 0 ? "ACTIVE" : "READY",
        },
      })
      await markSkillPackReady(tx, {
        skillNodeId: prepared.skillNodeId,
      })
    })
  }

  return {
    goalSkillId: prepared.goalSkillId,
    packVersionId: existing.id,
    pack,
    reused: true,
  }
}

async function sourceSnapshotsForVersion(
  userId: string,
  packVersionId: string,
): Promise<LearningSourceSnapshot[]> {
  const version = await prisma.learningPackVersion.findFirst({
    where: { id: packVersionId, learningPack: { userId, goalSkill: { userId } } },
    select: {
      sourceLinks: {
        orderBy: { ordinal: "asc" },
        select: {
          sourceVersion: {
            select: {
              id: true,
              revision: true,
              extractedText: true,
              source: { select: { displayName: true } },
            },
          },
        },
      },
    },
  })
  if (!version) throw new LearningSetupNotFoundError()

  if (version.sourceLinks.length === 0) {
    throw new LearningPackServiceError("A quiz source is unavailable.")
  }
  return version.sourceLinks.map(({ sourceVersion: row }) => {
    return {
      sourceId: row.id,
      title: row.source.displayName,
      locator: sourceCitationLocator(row.source.displayName, row.revision),
      text: row.extractedText,
    }
  })
}

async function beginGenerationRequest(input: {
  userId: string
  goalSkillId: string
  inputHash: string
  modelId: string
  sourceVersionIds: string[]
  consentedAt: Date
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.learningPackGenerationRequest.updateMany({
        where: {
          userId: input.userId,
          status: "PENDING",
          expiresAt: { lte: input.consentedAt },
        },
        data: {
          status: "FAILED",
          activeUserKey: null,
          failureCode: "STALE_LEASE",
        },
      })
      const recentCount = await tx.learningPackGenerationRequest.count({
        where: {
          userId: input.userId,
          createdAt: {
            gte: new Date(input.consentedAt.getTime() - GENERATION_WINDOW_MS),
          },
        },
      })
      if (recentCount >= MAX_GENERATIONS_PER_WINDOW) {
        throw new LearningPackServiceError(
          "You've reached the hourly quiz-generation limit. Try again later.",
        )
      }

      return tx.learningPackGenerationRequest.create({
        data: {
          userId: input.userId,
          goalSkillId: input.goalSkillId,
          inputHash: input.inputHash,
          modelId: input.modelId,
          sourceVersionIdsJson: JSON.stringify(input.sourceVersionIds),
          consentedAt: input.consentedAt,
          expiresAt: new Date(input.consentedAt.getTime() + GENERATION_LEASE_MS),
          status: "PENDING",
          activeUserKey: input.userId,
        },
        select: { id: true },
      })
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new LearningPackServiceError(
        "A quiz is already being built for your account. Wait for it to finish.",
      )
    }
    throw error
  }
}

async function failGenerationRequest(requestId: string, error: unknown) {
  const failureCode =
    error instanceof LearningPackServiceError
      ? "PRODUCT_VALIDATION"
      : error instanceof Error
        ? error.name.slice(0, 100) || "GENERATION_FAILED"
        : "GENERATION_FAILED"
  await prisma.learningPackGenerationRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "FAILED", activeUserKey: null, failureCode },
  })
}

export async function generateAndPersistLearningPack(
  input: GeneratePackInput,
  options: {
    generator?: PackGenerator
    model?: string
    now?: Date
  } = {},
): Promise<LearningPackResult> {
  const parsed = inputSchema.parse(input)
  const prepared = await generationInput(parsed.userId, parsed.goalSkillId)
  const localPreview =
    process.env.NODE_ENV !== "production" &&
    !options.generator &&
    !options.model &&
    !process.env.AI_GATEWAY_MODEL &&
    process.env.REHEARSE_LOCAL_GENERATOR === "1"
  const modelId =
    options.model ??
    process.env.AI_GATEWAY_MODEL ??
    (localPreview ? LOCAL_LEARNING_PACK_MODEL : undefined)
  if (!modelId) {
    throw new LearningPackServiceError(
      "Quiz generation is not configured in this environment.",
    )
  }
  const inputHash = packInputHash({ ...prepared, modelId })
  const existing = await findExistingVersion(parsed.userId, prepared, inputHash)
  if (existing) return existing

  const consentedAt = options.now ?? new Date()
  const generationRequest = await beginGenerationRequest({
    userId: parsed.userId,
    goalSkillId: parsed.goalSkillId,
    inputHash,
    modelId,
    sourceVersionIds: prepared.sourceVersionIds,
    consentedAt,
  })

  const generator: PackGenerator = options.generator ??
    (localPreview
      ? async ({ skillTitle, sources }) =>
          generateLocalLearningPack({ skillTitle, sources })
      : generateLearningPack)
  let validated: LearningPack
  try {
    const pack = await generator({
      skillTitle: prepared.skillTitle,
      sources: prepared.sources,
      userId: parsed.userId,
      model: modelId,
    })
    validated = validateLearningPack(pack, prepared.sources)
  } catch (error) {
    await failGenerationRequest(generationRequest.id, error)
    throw error
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await assertGenerationInputCurrent(tx, parsed.userId, prepared)

      const learningPack = await tx.learningPack.upsert({
        where: { goalSkillId: parsed.goalSkillId },
        update: {},
        create: {
          userId: parsed.userId,
          goalSkillId: parsed.goalSkillId,
          state: "READY",
        },
        select: { id: true, userId: true, goalSkillId: true },
      })
      if (
        learningPack.userId !== parsed.userId ||
        learningPack.goalSkillId !== parsed.goalSkillId
      ) {
        throw new LearningSetupNotFoundError()
      }

      const latest = await tx.learningPackVersion.aggregate({
        where: { learningPackId: learningPack.id },
        _max: { version: true },
      })
      const version = await tx.learningPackVersion.create({
        data: {
          learningPackId: learningPack.id,
          version: (latest._max.version ?? 0) + 1,
          inputHash,
          modelId,
          generatorVersion: GENERATOR_VERSION,
          schemaVersion: GENERATOR_VERSION,
          sourceVersionIdsJson: JSON.stringify(prepared.sourceVersionIds),
          contentJson: JSON.stringify(validated),
          consentedAt,
          sourceLinks: {
            create: prepared.sourceVersionIds.map((sourceVersionId, ordinal) => ({
              sourceVersionId,
              ordinal,
            })),
          },
        },
        select: { id: true },
      })
      await tx.learningPack.update({
        where: { id: learningPack.id },
        data: { currentVersionId: version.id, state: "READY" },
      })
      await markSkillPackReady(tx, {
        skillNodeId: prepared.skillNodeId,
      })
      await tx.learningPackGenerationRequest.update({
        where: { id: generationRequest.id },
        data: { status: "SUCCEEDED", activeUserKey: null },
      })

      return {
        goalSkillId: parsed.goalSkillId,
        packVersionId: version.id,
        pack: validated,
        reused: false,
      }
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const winner = await findExistingVersion(parsed.userId, prepared, inputHash)
      if (winner) {
        await prisma.learningPackGenerationRequest.updateMany({
          where: { id: generationRequest.id, status: "PENDING" },
          data: { status: "SUCCEEDED", activeUserKey: null },
        })
        return winner
      }
    }
    await failGenerationRequest(generationRequest.id, error)
    throw error
  }
}

export async function getCurrentLearningPack(input: GeneratePackInput) {
  const parsed = inputSchema.parse(input)
  const row = await prisma.learningPack.findFirst({
    where: {
      userId: parsed.userId,
      goalSkillId: parsed.goalSkillId,
      goalSkill: { userId: parsed.userId },
      currentVersion: { isNot: null },
    },
    select: {
      state: true,
      goalSkill: { select: { skillNode: { select: { title: true } } } },
      currentVersion: {
        select: {
          id: true,
          contentJson: true,
          modelId: true,
          createdAt: true,
          _count: { select: { attempts: true } },
        },
      },
    },
  })
  if (!row?.currentVersion) return null

  const sources = await sourceSnapshotsForVersion(parsed.userId, row.currentVersion.id)
  return {
    goalSkillId: parsed.goalSkillId,
    skillTitle: row.goalSkill.skillNode.title,
    state: row.state,
    packVersionId: row.currentVersion.id,
    modelId: row.currentVersion.modelId,
    createdAt: row.currentVersion.createdAt,
    completed: row.currentVersion._count.attempts > 0,
    pack: validateLearningPack(JSON.parse(row.currentVersion.contentJson), sources),
  }
}

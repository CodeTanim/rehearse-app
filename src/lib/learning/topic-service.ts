import { randomUUID } from "node:crypto"

import { Prisma } from "@prisma/client"
import { z } from "zod"

import {
  LearningSetupInvariantError,
  LearningSetupNotFoundError,
} from "@/lib/learning/setup-service"
import { slugify } from "@/lib/learning/slug"
import { prisma } from "@/lib/prisma"

const createTopicSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  title: z
    .string()
    .trim()
    .min(1, "Topic is required.")
    .max(120, "Topic must be 120 characters or fewer."),
})

const LIVE_GOAL_STATUSES = ["ACTIVE", "MAINTAINING"] as const
const DEFAULT_GOAL = {
  title: "My skills",
  outcome: "Build and maintain the skills I choose to learn.",
  slug: "skill-library",
} as const

type CreateTopicInput = z.input<typeof createTopicSchema>
type LearningTransaction = Prisma.TransactionClient

export type TopicCreationResult = {
  goalId: string
  goalSkillId: string
  skillNodeId: string
  scopeVersionId: string
  conceptVersionId: string
  title: string
  outcome: string
  successCriterion: string
  topicStatus: "NEEDS_SOURCES"
}

export function deriveTopicScope(title: string): {
  outcome: string
  successCriterion: string
} {
  return {
    outcome: `Understand and apply ${title}.`,
    successCriterion: `Explain the core ideas of ${title} and apply them in a realistic example.`,
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  )
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

async function ensureDefaultGoal(
  tx: LearningTransaction,
  userId: string,
): Promise<{ id: string; graphId: string }> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!user) throw new LearningSetupNotFoundError()

  const liveGoal = await tx.learningGoal.findFirst({
    where: {
      userId,
      status: { in: [...LIVE_GOAL_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      graphId: true,
      graph: { select: { userId: true } },
    },
  })
  if (liveGoal) {
    if (liveGoal.graph.userId !== userId) {
      throw new LearningSetupInvariantError("The active goal has a graph owner mismatch.")
    }
    return { id: liveGoal.id, graphId: liveGoal.graphId }
  }

  const graph = await tx.skillGraph.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true },
  })
  const priorDefault = await tx.learningGoal.findUnique({
    where: {
      userId_slug: { userId, slug: DEFAULT_GOAL.slug },
    },
    select: {
      id: true,
      graphId: true,
      graph: { select: { userId: true } },
    },
  })

  if (priorDefault) {
    if (priorDefault.graphId !== graph.id || priorDefault.graph.userId !== userId) {
      throw new LearningSetupInvariantError("The default goal has a graph owner mismatch.")
    }

    const goal = await tx.learningGoal.update({
      where: { id: priorDefault.id },
      data: { status: "ACTIVE" },
      select: { id: true, graphId: true },
    })
    return goal
  }

  return tx.learningGoal.create({
    data: {
      userId,
      graphId: graph.id,
      title: DEFAULT_GOAL.title,
      outcome: DEFAULT_GOAL.outcome,
      slug: DEFAULT_GOAL.slug,
      status: "ACTIVE",
    },
    select: { id: true, graphId: true },
  })
}

async function createTopicInTransaction(
  tx: LearningTransaction,
  input: z.output<typeof createTopicSchema>,
): Promise<TopicCreationResult> {
  const goal = await ensureDefaultGoal(tx, input.userId)
  const slug = await nextSkillSlug(tx, goal.graphId, input.title)
  const { outcome, successCriterion } = deriveTopicScope(input.title)

  const skillNode = await tx.skillNode.create({
    data: {
      graphId: goal.graphId,
      parentId: null,
      kind: "SKILL",
      title: input.title,
      slug,
      outcome,
      defaultSuccessCriterion: successCriterion,
      state: "DRAFT",
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
      outcome,
      successCriterion,
      policyVersion: "mastery-v1",
      creationReason: "TOPIC_PLACEHOLDER",
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
      definition: outcome,
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
    data: { currentScopeVersionId: scopeVersion.id },
  })

  return {
    goalId: goal.id,
    goalSkillId: goalSkill.id,
    skillNodeId: skillNode.id,
    scopeVersionId: scopeVersion.id,
    conceptVersionId: conceptVersion.id,
    title: input.title,
    outcome,
    successCriterion,
    topicStatus: "NEEDS_SOURCES",
  }
}

export async function createTopic(input: CreateTopicInput): Promise<TopicCreationResult> {
  const parsed = createTopicSchema.parse(input)

  try {
    return await prisma.$transaction((tx) => createTopicInTransaction(tx, parsed))
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      // The database constraint resolves a first-topic race between tabs. A
      // retry observes the winning default goal and creates a distinct leaf.
      return prisma.$transaction((tx) => createTopicInTransaction(tx, parsed))
    }
    throw error
  }
}

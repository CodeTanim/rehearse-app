import "server-only"

import { Prisma } from "@prisma/client"
import { z } from "zod"

import { prisma } from "@/lib/prisma"

const relationshipKindSchema = z.enum(["RELATED", "PREREQUISITE"])

const connectRelationshipSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  sourceGoalSkillId: z.string().trim().min(1).max(128),
  targetGoalSkillId: z.string().trim().min(1).max(128),
  kind: relationshipKindSchema,
})

const relationshipMutationSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  relationshipId: z.string().trim().min(1).max(128),
  action: z.enum(["ACCEPT", "DISMISS", "REMOVE"]),
})

export type SkillRelationshipKind = z.infer<typeof relationshipKindSchema>
export type SkillRelationshipErrorCode =
  | "SELF_RELATIONSHIP"
  | "SKILL_UNAVAILABLE"
  | "DUPLICATE_RELATIONSHIP"
  | "PREREQUISITE_CYCLE"
  | "RELATIONSHIP_UNAVAILABLE"
  | "INVALID_STATUS"

export class SkillRelationshipError extends Error {
  constructor(
    public readonly code: SkillRelationshipErrorCode,
    public readonly publicMessage: string,
  ) {
    super(publicMessage)
    this.name = "SkillRelationshipError"
  }
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function orderedRelatedEndpoints(sourceSkillNodeId: string, targetSkillNodeId: string) {
  return sourceSkillNodeId < targetSkillNodeId
    ? { sourceSkillNodeId, targetSkillNodeId }
    : { sourceSkillNodeId: targetSkillNodeId, targetSkillNodeId: sourceSkillNodeId }
}

export function wouldCreatePrerequisiteCycle(
  edges: ReadonlyArray<{ sourceSkillNodeId: string; targetSkillNodeId: string }>,
  sourceSkillNodeId: string,
  targetSkillNodeId: string,
) {
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    const targets = outgoing.get(edge.sourceSkillNodeId)
    if (targets) targets.push(edge.targetSkillNodeId)
    else outgoing.set(edge.sourceSkillNodeId, [edge.targetSkillNodeId])
  }

  const pending = [targetSkillNodeId]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || visited.has(current)) continue
    if (current === sourceSkillNodeId) return true
    visited.add(current)
    pending.push(...(outgoing.get(current) ?? []))
  }
  return false
}

export async function connectSkillRelationship(
  input: z.input<typeof connectRelationshipSchema>,
) {
  const parsed = connectRelationshipSchema.parse(input)
  if (parsed.sourceGoalSkillId === parsed.targetGoalSkillId) {
    throw new SkillRelationshipError(
      "SELF_RELATIONSHIP",
      "Choose two different skills.",
    )
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const ownedSkills = await tx.goalSkill.findMany({
        where: {
          id: { in: [parsed.sourceGoalSkillId, parsed.targetGoalSkillId] },
          userId: parsed.userId,
          lifecycle: { not: "ARCHIVED" },
          goal: { userId: parsed.userId },
          skillNode: {
            kind: "SKILL",
            archivedAt: null,
            graph: { userId: parsed.userId },
          },
        },
        select: {
          id: true,
          skillNode: { select: { id: true, graphId: true } },
        },
      })
      if (ownedSkills.length !== 2) {
        throw new SkillRelationshipError(
          "SKILL_UNAVAILABLE",
          "One of those skills is unavailable.",
        )
      }

      const graphIds = new Set(ownedSkills.map((skill) => skill.skillNode.graphId))
      if (graphIds.size !== 1) {
        throw new SkillRelationshipError(
          "SKILL_UNAVAILABLE",
          "Those skills cannot be connected.",
        )
      }
      const graphId = ownedSkills[0].skillNode.graphId
      const sourceSkillNodeId = ownedSkills.find(
        (skill) => skill.id === parsed.sourceGoalSkillId,
      )?.skillNode.id
      const targetSkillNodeId = ownedSkills.find(
        (skill) => skill.id === parsed.targetGoalSkillId,
      )?.skillNode.id
      if (!sourceSkillNodeId || !targetSkillNodeId || sourceSkillNodeId === targetSkillNodeId) {
        throw new SkillRelationshipError(
          "SELF_RELATIONSHIP",
          "Choose two different skills.",
        )
      }
      const endpoints =
        parsed.kind === "RELATED"
          ? orderedRelatedEndpoints(sourceSkillNodeId, targetSkillNodeId)
          : {
              sourceSkillNodeId,
              targetSkillNodeId,
            }

      if (parsed.kind === "PREREQUISITE") {
        const confirmedPrerequisites = await tx.skillRelationship.findMany({
          where: {
            userId: parsed.userId,
            graphId,
            kind: "PREREQUISITE",
            status: "CONFIRMED",
          },
          select: { sourceSkillNodeId: true, targetSkillNodeId: true },
        })
        if (
          wouldCreatePrerequisiteCycle(
            confirmedPrerequisites,
            endpoints.sourceSkillNodeId,
            endpoints.targetSkillNodeId,
          )
        ) {
          throw new SkillRelationshipError(
            "PREREQUISITE_CYCLE",
            "That prerequisite would create a loop.",
          )
        }
      }

      const existing = await tx.skillRelationship.findUnique({
        where: {
          graphId_kind_sourceSkillNodeId_targetSkillNodeId: {
            graphId,
            kind: parsed.kind,
            ...endpoints,
          },
        },
        select: { id: true, status: true },
      })
      if (existing?.status === "CONFIRMED") {
        throw new SkillRelationshipError(
          "DUPLICATE_RELATIONSHIP",
          "Those skills are already connected that way.",
        )
      }

      if (existing) {
        return tx.skillRelationship.update({
          where: { id: existing.id },
          data: {
            origin: "USER",
            status: "CONFIRMED",
            confidence: null,
            rationale: null,
          },
        })
      }

      return tx.skillRelationship.create({
        data: {
          userId: parsed.userId,
          graphId,
          ...endpoints,
          kind: parsed.kind,
          origin: "USER",
          status: "CONFIRMED",
        },
      })
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new SkillRelationshipError(
        "DUPLICATE_RELATIONSHIP",
        "Those skills are already connected that way.",
      )
    }
    throw error
  }
}

export async function updateSkillRelationshipStatus(
  input: z.input<typeof relationshipMutationSchema>,
) {
  const parsed = relationshipMutationSchema.parse(input)
  return prisma.$transaction(async (tx) => {
    const relationship = await tx.skillRelationship.findFirst({
      where: {
        id: parsed.relationshipId,
        userId: parsed.userId,
        graph: { userId: parsed.userId },
        sourceSkillNode: { graph: { userId: parsed.userId } },
        targetSkillNode: { graph: { userId: parsed.userId } },
      },
      select: { id: true, status: true },
    })
    if (!relationship) {
      throw new SkillRelationshipError(
        "RELATIONSHIP_UNAVAILABLE",
        "That connection is unavailable.",
      )
    }

    const allowedStatus = parsed.action === "REMOVE" ? "CONFIRMED" : "SUGGESTED"
    if (relationship.status !== allowedStatus) {
      throw new SkillRelationshipError(
        "INVALID_STATUS",
        "That connection has already changed.",
      )
    }
    const status =
      parsed.action === "ACCEPT"
        ? "CONFIRMED"
        : parsed.action === "DISMISS"
          ? "DISMISSED"
          : "REMOVED"

    return tx.skillRelationship.update({
      where: { id: relationship.id },
      data: { status },
    })
  })
}

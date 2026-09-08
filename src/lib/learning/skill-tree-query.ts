import { prisma } from "@/lib/prisma"
import { dueStateAt, readinessReason, type DueState } from "@/lib/learning/today-query"

export type SkillTreeDueState = DueState | "NOT_SCHEDULED"

export type SkillTreeLeaf = {
  skillNodeId?: string
  goalId: string
  goalTitle: string
  goalOutcome: string
  goalSkillId: string
  branchTitle: string
  title: string
  outcome: string
  successCriterion: string
  stage: string
  confidence: string
  dueState: SkillTreeDueState
  dueAt: Date | null
  evidenceCount: number
  successCount: number
  reason: string
}

export type SkillTreeRelationship = {
  id: string
  sourceSkillNodeId: string
  sourceTitle: string
  targetSkillNodeId: string
  targetTitle: string
  kind: "RELATED" | "PREREQUISITE"
  origin: "SYSTEM_BRANCH" | "USER"
  status: "SUGGESTED" | "CONFIRMED"
  confidence: number | null
  rationale: string | null
}

export type SkillTreeData = {
  goalId: string
  goalTitle: string
  goalOutcome: string
  leaves: SkillTreeLeaf[]
  relationships: SkillTreeRelationship[]
}

export type SkillGardenData = {
  goalTitle: string
  leaves: SkillTreeLeaf[]
  relationships: SkillTreeRelationship[]
}

const LIVE_GOAL_STATUSES = ["ACTIVE", "MAINTAINING"] as const

const readinessSelect = {
  stage: true,
  confidence: true,
  completedSessions: true,
  successfulFullWeightReviews: true,
  distinctReviewDays: true,
  successfulTransferProbes: true,
  latestRating: true,
} as const

/**
 * Returns the complete visible tree for one owned goal. Ownership is repeated
 * on nested records so malformed cross-owner relationships never become UI
 * data.
 */
export async function getOwnedSkillTree(
  userId: string,
  goalId: string,
  now = new Date(),
): Promise<SkillTreeData | null> {
  const goal = await prisma.learningGoal.findFirst({
    where: { id: goalId, userId },
    select: {
      id: true,
      title: true,
      outcome: true,
      graph: {
        select: {
          relationships: {
            where: {
              userId,
              status: "CONFIRMED",
              origin: "USER",
              sourceSkillNode: {
                graph: { userId },
                goalSkills: { some: { userId, goalId, lifecycle: { not: "ARCHIVED" } } },
              },
              targetSkillNode: {
                graph: { userId },
                goalSkills: { some: { userId, goalId, lifecycle: { not: "ARCHIVED" } } },
              },
            },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              sourceSkillNodeId: true,
              targetSkillNodeId: true,
              kind: true,
              origin: true,
              status: true,
              confidence: true,
              rationale: true,
              sourceSkillNode: { select: { title: true } },
              targetSkillNode: { select: { title: true } },
            },
          },
        },
      },
      goalSkills: {
        where: {
          userId,
          lifecycle: { not: "ARCHIVED" },
          skillNode: { graph: { userId } },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          lifecycle: true,
          skillNode: {
            select: {
              id: true,
              title: true,
              outcome: true,
              defaultSuccessCriterion: true,
              parent: { select: { title: true } },
              questions: {
                where: {
                  userId,
                  state: "ACTIVE",
                  schedulingEligible: true,
                  goalQuestions: {
                    some: {
                      goalId,
                      status: "ACTIVE",
                      goal: { userId },
                    },
                  },
                },
                select: {
                  generatedSpec: { select: { role: true } },
                  reviewSchedules: {
                    where: { userId },
                    orderBy: { dueAt: "asc" },
                    take: 1,
                    select: { dueAt: true },
                  },
                },
              },
            },
          },
          currentScopeVersion: {
            select: {
              outcome: true,
              successCriterion: true,
              readiness: {
                orderBy: { computedAt: "desc" },
                take: 1,
                select: readinessSelect,
              },
            },
          },
        },
      },
    },
  })

  if (!goal) return null

  const leaves = goal.goalSkills.map((goalSkill) => {
    const dueAt = goalSkill.skillNode.questions.reduce<Date | null>((earliest, question) => {
      if (question.generatedSpec?.role === "TRANSFER") return earliest
      const candidate = question.reviewSchedules[0]?.dueAt ?? null
      if (!candidate) return earliest
      if (!earliest || candidate.getTime() < earliest.getTime()) return candidate
      return earliest
    }, null)
    const readiness = goalSkill.currentScopeVersion?.readiness[0] ?? null

    return {
      skillNodeId: goalSkill.skillNode.id,
      goalId: goal.id,
      goalTitle: goal.title,
      goalOutcome: goal.outcome,
      goalSkillId: goalSkill.id,
      branchTitle: goalSkill.skillNode.parent?.title ?? "Independent",
      title: goalSkill.skillNode.title,
      outcome: goalSkill.currentScopeVersion?.outcome ?? goalSkill.skillNode.outcome ?? "",
      successCriterion:
        goalSkill.currentScopeVersion?.successCriterion ??
        goalSkill.skillNode.defaultSuccessCriterion ??
        "",
      stage: readiness?.stage ?? "UNASSESSED",
      confidence: readiness?.confidence ?? "LOW",
      dueState: dueAt ? dueStateAt(dueAt, now) : "NOT_SCHEDULED",
      dueAt,
      evidenceCount: readiness?.completedSessions ?? 0,
      successCount: readiness?.distinctReviewDays ?? 0,
      reason:
        goalSkill.lifecycle !== "ACTIVE"
          ? "Setup is not complete"
          : dueAt
            ? readinessReason(readiness)
            : "No recall scheduled",
    } satisfies SkillTreeLeaf
  })

  return {
    goalId: goal.id,
    goalTitle: goal.title,
    goalOutcome: goal.outcome,
    leaves,
    relationships: (goal.graph?.relationships ?? []).flatMap((relationship) => {
      if (
        !["RELATED", "PREREQUISITE"].includes(relationship.kind) ||
        relationship.status !== "CONFIRMED" ||
        relationship.origin !== "USER"
      ) {
        return []
      }

      return [
        {
          id: relationship.id,
          sourceSkillNodeId: relationship.sourceSkillNodeId,
          sourceTitle: relationship.sourceSkillNode.title,
          targetSkillNodeId: relationship.targetSkillNodeId,
          targetTitle: relationship.targetSkillNode.title,
          kind: relationship.kind as SkillTreeRelationship["kind"],
          origin: relationship.origin as SkillTreeRelationship["origin"],
          status: relationship.status as SkillTreeRelationship["status"],
          confidence: relationship.confidence,
          rationale: relationship.rationale,
        },
      ]
    }),
  }
}

/**
 * Returns one user-wide garden across every live goal. A skill node can be in
 * more than one goal, but the garden renders it once and keeps the oldest live
 * goal's GoalSkill as the stable action target. Connections are graph-wide, so
 * links between skills from different goals remain visible.
 */
export async function getUserSkillGarden(
  userId: string,
  now = new Date(),
): Promise<SkillGardenData | null> {
  const [goals, relationshipRecords] = await Promise.all([
    prisma.learningGoal.findMany({
      where: { userId, status: { in: [...LIVE_GOAL_STATUSES] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        outcome: true,
        goalSkills: {
          where: {
            userId,
            lifecycle: { not: "ARCHIVED" },
            skillNode: { graph: { userId } },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            lifecycle: true,
            skillNode: {
              select: {
                id: true,
                title: true,
                outcome: true,
                defaultSuccessCriterion: true,
                parent: { select: { title: true } },
                questions: {
                  where: {
                    userId,
                    state: "ACTIVE",
                    schedulingEligible: true,
                    goalQuestions: {
                      some: {
                        status: "ACTIVE",
                        goal: {
                          userId,
                          status: { in: [...LIVE_GOAL_STATUSES] },
                        },
                      },
                    },
                  },
                  select: {
                    generatedSpec: { select: { role: true } },
                    goalQuestions: {
                      where: {
                        status: "ACTIVE",
                        goal: {
                          userId,
                          status: { in: [...LIVE_GOAL_STATUSES] },
                        },
                      },
                      select: { goalId: true },
                    },
                    reviewSchedules: {
                      where: { userId },
                      orderBy: { dueAt: "asc" },
                      take: 1,
                      select: { dueAt: true },
                    },
                  },
                },
              },
            },
            currentScopeVersion: {
              select: {
                outcome: true,
                successCriterion: true,
                readiness: {
                  orderBy: { computedAt: "desc" },
                  take: 1,
                  select: readinessSelect,
                },
              },
            },
          },
        },
      },
    }),
    prisma.skillRelationship.findMany({
      where: {
        userId,
        status: "CONFIRMED",
        origin: "USER",
        graph: { userId },
        sourceSkillNode: {
          graph: { userId },
          goalSkills: {
            some: {
              userId,
              lifecycle: { not: "ARCHIVED" },
              goal: { userId, status: { in: [...LIVE_GOAL_STATUSES] } },
            },
          },
        },
        targetSkillNode: {
          graph: { userId },
          goalSkills: {
            some: {
              userId,
              lifecycle: { not: "ARCHIVED" },
              goal: { userId, status: { in: [...LIVE_GOAL_STATUSES] } },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        sourceSkillNodeId: true,
        targetSkillNodeId: true,
        kind: true,
        origin: true,
        status: true,
        confidence: true,
        rationale: true,
        sourceSkillNode: { select: { title: true } },
        targetSkillNode: { select: { title: true } },
      },
    }),
  ])

  if (goals.length === 0) return null

  const leavesBySkillNode = new Map<string, SkillTreeLeaf>()
  for (const goal of goals) {
    for (const goalSkill of goal.goalSkills) {
      if (leavesBySkillNode.has(goalSkill.skillNode.id)) continue

      const dueAt = goalSkill.skillNode.questions.reduce<Date | null>(
        (earliest, question) => {
          if (
            question.generatedSpec?.role === "TRANSFER" ||
            !question.goalQuestions.some((goalQuestion) => goalQuestion.goalId === goal.id)
          ) {
            return earliest
          }
          const candidate = question.reviewSchedules[0]?.dueAt ?? null
          if (!candidate) return earliest
          if (!earliest || candidate.getTime() < earliest.getTime()) return candidate
          return earliest
        },
        null,
      )
      const readiness = goalSkill.currentScopeVersion?.readiness[0] ?? null

      leavesBySkillNode.set(goalSkill.skillNode.id, {
        skillNodeId: goalSkill.skillNode.id,
        goalId: goal.id,
        goalTitle: goal.title,
        goalOutcome: goal.outcome,
        goalSkillId: goalSkill.id,
        branchTitle: goalSkill.skillNode.parent?.title ?? "Independent",
        title: goalSkill.skillNode.title,
        outcome: goalSkill.currentScopeVersion?.outcome ?? goalSkill.skillNode.outcome ?? "",
        successCriterion:
          goalSkill.currentScopeVersion?.successCriterion ??
          goalSkill.skillNode.defaultSuccessCriterion ??
          "",
        stage: readiness?.stage ?? "UNASSESSED",
        confidence: readiness?.confidence ?? "LOW",
        dueState: dueAt ? dueStateAt(dueAt, now) : "NOT_SCHEDULED",
        dueAt,
        evidenceCount: readiness?.completedSessions ?? 0,
        successCount: readiness?.distinctReviewDays ?? 0,
        reason:
          goalSkill.lifecycle !== "ACTIVE"
            ? "Setup is not complete"
            : dueAt
              ? readinessReason(readiness)
              : "No recall scheduled",
      })
    }
  }

  const leaves = [...leavesBySkillNode.values()]
  const visibleSkillNodeIds = new Set(leavesBySkillNode.keys())
  const relationships = relationshipRecords.flatMap((relationship) => {
    if (
      !visibleSkillNodeIds.has(relationship.sourceSkillNodeId) ||
      !visibleSkillNodeIds.has(relationship.targetSkillNodeId) ||
      !["RELATED", "PREREQUISITE"].includes(relationship.kind) ||
      relationship.status !== "CONFIRMED" ||
      relationship.origin !== "USER"
    ) {
      return []
    }

    return [
      {
        id: relationship.id,
        sourceSkillNodeId: relationship.sourceSkillNodeId,
        sourceTitle: relationship.sourceSkillNode.title,
        targetSkillNodeId: relationship.targetSkillNodeId,
        targetTitle: relationship.targetSkillNode.title,
        kind: relationship.kind as SkillTreeRelationship["kind"],
        origin: relationship.origin as SkillTreeRelationship["origin"],
        status: relationship.status as SkillTreeRelationship["status"],
        confidence: relationship.confidence,
        rationale: relationship.rationale,
      },
    ]
  })

  return {
    goalTitle: "Your knowledge garden",
    leaves,
    relationships,
  }
}

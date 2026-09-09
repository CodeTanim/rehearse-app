import "server-only"

import { prisma } from "@/lib/prisma"
import { MASTERY_RULE_VERSION, projectGoalSkillReadiness } from "@/lib/learning/mastery"
import type { MasteryEvidenceInput, ReviewRating } from "@/lib/learning/types"

/** Read-only, current-scope projection. Older saved projections need no backfill. */
export async function getSkillMilestone(userId: string, goalSkillId: string, now = new Date()) {
  const skill = await prisma.goalSkill.findFirst({
    where: { id: goalSkillId, userId, lifecycle: "ACTIVE", goal: { userId, status: { in: ["ACTIVE", "MAINTAINING"] } }, skillNode: { graph: { userId } } },
    select: { goalId: true, skillNodeId: true, currentScopeVersion: { select: {
      goalSkillId: true, policyVersion: true, concepts: { select: { conceptVersionId: true } },
    } } },
  })
  const scope = skill?.currentScopeVersion
  if (!skill || !scope || scope.goalSkillId !== goalSkillId || scope.policyVersion !== MASTERY_RULE_VERSION) return null
  const requiredConceptVersionIds = scope.concepts.map((concept) => concept.conceptVersionId)
  const [rows, schedules] = await Promise.all([
    prisma.masteryEvidence.findMany({
      where: { userId, conceptVersionId: { in: requiredConceptVersionIds }, attempt: { userId, question: { userId, skillNodeId: skill.skillNodeId } } },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      select: { conceptVersionId: true, kind: true, weight: true, reviewDay: true, occurredAt: true,
        attempt: { select: { rating: true, questionId: true, occurredAt: true,
          question: { select: { generatedSpec: { select: { questionFamilyId: true } } } },
          sessionItem: { select: { sessionId: true, completedAt: true, session: { select: { completedAt: true } } } },
        } },
      },
    }),
    prisma.reviewSchedule.findMany({
      where: { userId, question: { userId, state: "ACTIVE", schedulingEligible: true, skillNodeId: skill.skillNodeId,
        goalQuestions: { some: { goalId: skill.goalId, status: "ACTIVE" } } },
        questionRevision: { concepts: { some: { isPrimary: true, conceptVersionId: { in: requiredConceptVersionIds } } } },
      },
      select: { dueAt: true, intervalMinutes: true, questionRevision: { select: {
        concepts: { where: { isPrimary: true }, select: { conceptVersionId: true } },
      } } },
    }),
  ])
  const evidence: MasteryEvidenceInput[] = rows.map((row) => ({
    conceptVersionId: row.conceptVersionId, kind: row.kind, questionId: row.attempt.questionId,
    questionFamilyId: row.attempt.question.generatedSpec?.questionFamilyId,
    sessionId: row.attempt.sessionItem.sessionId,
    sessionCompletedAt: row.attempt.sessionItem.completedAt ?? row.attempt.sessionItem.session.completedAt ?? row.attempt.occurredAt,
    rating: row.attempt.rating as ReviewRating, weight: row.weight as 0 | 0.5 | 1, reviewDay: row.reviewDay, occurredAt: row.occurredAt,
  }))
  const activeSchedules = schedules.flatMap((schedule) => schedule.questionRevision.concepts.map((concept) => ({
    conceptVersionId: concept.conceptVersionId, dueAt: schedule.dueAt, intervalMinutes: schedule.intervalMinutes,
  })))
  return projectGoalSkillReadiness({ requiredConceptVersionIds, activeQuestionConceptVersionIds: activeSchedules.map((schedule) => schedule.conceptVersionId),
    evidence, activeSchedules, computedAt: now })
}

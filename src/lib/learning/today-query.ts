import { prisma } from "@/lib/prisma"

const LIVE_GOAL_STATUSES = ["ACTIVE", "MAINTAINING"] as const

export type DueState = "DUE" | "OVERDUE" | "CURRENT"

export type TodayLeaf = {
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
  dueState: DueState
  dueAt: Date
  evidenceCount: number
  successCount: number
  successfulTransferProbes?: number
  transferReviewDays?: number
  reason: string
}

export type TodayData =
  | { kind: "EMPTY"; href: "/today/new" }
  | { kind: "SESSION_CONFLICT"; requestedTitle: string; activeTitle: string; sessionId: string }
  | {
      kind: "SETUP_SOURCE"
      goalId: string
      goalSkillId: string
      goalTitle: string
      skillTitle: string
      href: string
    }
  | {
      kind: "STRENGTHEN"
      gapId: string
      goalSkillId: string
      skillTitle: string
      gapLabel: string
      href: string
      recall?: { goalSkillId: string; title: string }
    }
  | { kind: "RESUME"; sessionId: string; leaf: TodayLeaf }
  | { kind: "REVIEW"; leaf: TodayLeaf }
  | { kind: "CURRENT"; leaf: TodayLeaf }

/**
 * The database mapper and this pure reducer intentionally share one small
 * candidate shape. Keeping priority here makes multi-skill behavior testable
 * without coupling product rules to Prisma mocks.
 */
export type TodayCandidate = Omit<TodayLeaf, "dueAt" | "dueState"> & {
  lifecycle: string
  createdAt: Date
  dueAt: Date | null
}

type ActiveSessionCandidate = {
  id: string
  goalId: string
  goalSkillId: string
  dueAt: Date | null
}

export type TodayStrengthenCandidate = {
  gapId: string
  goalSkillId: string
  skillTitle: string
  gapLabel: string
  openedAt: Date
}

export function dueStateAt(dueAt: Date, now: Date): DueState {
  if (dueAt.getTime() > now.getTime()) return "CURRENT"
  if (now.getTime() - dueAt.getTime() >= 24 * 60 * 60 * 1_000) return "OVERDUE"
  return "DUE"
}

export function readinessReason(readiness: {
  stage: string
  successfulFullWeightReviews: number
  distinctReviewDays: number
  latestRating: string | null
  successfulTransferProbes?: number
} | null): string {
  if (!readiness || readiness.stage === "UNASSESSED") return "No reviews yet"
  if (readiness.latestRating === "AGAIN") return "Latest recall missed · refresh scheduled"
  if (readiness.stage === "LEARNING") {
    const count = readiness.successfulFullWeightReviews
    if (count === 0) return "First self-rating saved"
    return count === 1 ? "1 review on a new day" : `${count} reviews on new days`
  }
  if (readiness.stage === "DEMONSTRATED") {
    return readiness.successfulTransferProbes
      ? `${readiness.successfulTransferProbes} of 2 new angles met`
      : "Ready for a new-angle check"
  }
  return "Recall held across days and new angles"
}

function candidateOrder(left: TodayCandidate, right: TodayCandidate): number {
  const createdDifference = left.createdAt.getTime() - right.createdAt.getTime()
  return createdDifference || left.goalSkillId.localeCompare(right.goalSkillId)
}

function scheduledOrder(left: TodayCandidate, right: TodayCandidate): number {
  const dueDifference = (left.dueAt?.getTime() ?? 0) - (right.dueAt?.getTime() ?? 0)
  return dueDifference || candidateOrder(left, right)
}

function strengthenOrder(
  left: TodayStrengthenCandidate,
  right: TodayStrengthenCandidate,
): number {
  const openedDifference = left.openedAt.getTime() - right.openedAt.getTime()
  return openedDifference || left.gapId.localeCompare(right.gapId)
}

function toLeaf(candidate: TodayCandidate, dueAt: Date, now: Date): TodayLeaf {
  return {
    goalId: candidate.goalId,
    goalTitle: candidate.goalTitle,
    goalOutcome: candidate.goalOutcome,
    goalSkillId: candidate.goalSkillId,
    branchTitle: candidate.branchTitle,
    title: candidate.title,
    outcome: candidate.outcome,
    successCriterion: candidate.successCriterion,
    stage: candidate.stage,
    confidence: candidate.confidence,
    evidenceCount: candidate.evidenceCount,
    successCount: candidate.successCount,
    successfulTransferProbes: candidate.successfulTransferProbes,
    transferReviewDays: candidate.transferReviewDays,
    reason: candidate.reason,
    dueAt,
    dueState: dueStateAt(dueAt, now),
  }
}

/** Resolve the single primary action shown on Today. */
export function selectTodayData(
  candidates: readonly TodayCandidate[],
  activeSession: ActiveSessionCandidate | null,
  now = new Date(),
  preferredGoalSkillId?: string,
  strengthenCandidates: readonly TodayStrengthenCandidate[] = [],
): TodayData {
  const preferred = preferredGoalSkillId
    ? candidates.find((candidate) => candidate.goalSkillId === preferredGoalSkillId &&
      candidate.lifecycle === "ACTIVE" && candidate.dueAt)
    : null
  if (preferred?.dueAt && activeSession?.goalSkillId !== preferred.goalSkillId) {
    if (preferred.dueAt > now) {
      return { kind: "CURRENT", leaf: toLeaf(preferred, preferred.dueAt, now) }
    }
    const active = activeSession && candidates.find((candidate) =>
      candidate.goalSkillId === activeSession.goalSkillId && candidate.lifecycle === "ACTIVE")
    if (active && activeSession) {
      return {
        kind: "SESSION_CONFLICT", requestedTitle: preferred.title,
        activeTitle: active.title, sessionId: activeSession.id,
      }
    }
    return { kind: "REVIEW", leaf: toLeaf(preferred, preferred.dueAt, now) }
  }
  if (activeSession) {
    const candidate = candidates.find(
      (item) =>
        item.lifecycle === "ACTIVE" &&
        item.goalId === activeSession.goalId &&
        item.goalSkillId === activeSession.goalSkillId,
    )
    const dueAt = candidate?.dueAt ?? activeSession.dueAt
    if (candidate && dueAt) {
      return {
        kind: "RESUME",
        sessionId: activeSession.id,
        leaf: toLeaf(candidate, dueAt, now),
      }
    }
  }

  const scheduled = candidates
    .filter((candidate) => candidate.lifecycle === "ACTIVE" && candidate.dueAt)
    .sort(scheduledOrder)
  const due = scheduled.find((candidate) => candidate.dueAt!.getTime() <= now.getTime())
  const strengthen = [...strengthenCandidates].sort(strengthenOrder)[0]
  if (strengthen) {
    return {
      kind: "STRENGTHEN",
      gapId: strengthen.gapId,
      goalSkillId: strengthen.goalSkillId,
      skillTitle: strengthen.skillTitle,
      gapLabel: strengthen.gapLabel,
      href: `/skills/${strengthen.goalSkillId}/strengthen/${strengthen.gapId}`,
      ...(due ? { recall: { goalSkillId: due.goalSkillId, title: due.title } } : {}),
    }
  }

  if (due) return { kind: "REVIEW", leaf: toLeaf(due, due.dueAt!, now) }

  const current = scheduled[0]
  if (current) return { kind: "CURRENT", leaf: toLeaf(current, current.dueAt!, now) }

  const incomplete = candidates
    .filter((candidate) => candidate.lifecycle !== "ACTIVE")
    .sort(candidateOrder)[0]
  if (incomplete) {
    return {
      kind: "SETUP_SOURCE",
      goalId: incomplete.goalId,
      goalSkillId: incomplete.goalSkillId,
      goalTitle: incomplete.goalTitle,
      skillTitle: incomplete.title,
      href: `/skills/${incomplete.goalSkillId}/sources`,
    }
  }

  return { kind: "EMPTY", href: "/today/new" }
}

export async function getTodayData(
  userId: string,
  now = new Date(),
  preferredGoalSkillId?: string,
): Promise<TodayData> {
  const [activeSessionRecord, learningGaps, goalSkills] = await Promise.all([
    prisma.practiceSession.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        goal: { userId, status: { in: [...LIVE_GOAL_STATUSES] } },
        goalSkill: {
          userId,
          lifecycle: "ACTIVE",
          goal: { userId, status: { in: [...LIVE_GOAL_STATUSES] } },
          skillNode: { graph: { userId }, kind: "SKILL" },
        },
        items: {
          some: {
            status: "PRESENTED",
            question: { userId },
          },
        },
      },
      orderBy: [{ startedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        goalId: true,
        goalSkillId: true,
        items: {
          where: { status: "PRESENTED", question: { userId } },
          orderBy: { ordinal: "asc" },
          take: 1,
          select: { scheduleDueAtBefore: true },
        },
      },
    }),
    prisma.learningGap.findMany({
      where: {
        userId,
        status: "OPEN",
        goalSkill: {
          userId,
          lifecycle: "ACTIVE",
          goal: { userId, status: { in: [...LIVE_GOAL_STATUSES] } },
          skillNode: { graph: { userId }, kind: "SKILL" },
        },
      },
      orderBy: [{ openedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        goalSkillId: true,
        openedAt: true,
        goalSkill: { select: { skillNode: { select: { title: true } } } },
        remediationRevisions: {
          orderBy: [{ revision: "desc" }, { id: "asc" }],
          take: 1,
          select: {
            id: true,
            gapLabel: true,
            activities: {
              where: { userId },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    }),
    prisma.goalSkill.findMany({
      where: {
        userId,
        lifecycle: { not: "ARCHIVED" },
        goal: { userId, status: { in: [...LIVE_GOAL_STATUSES] } },
        skillNode: { graph: { userId }, kind: "SKILL" },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        lifecycle: true,
        createdAt: true,
        goal: { select: { id: true, title: true, outcome: true } },
        skillNode: {
          select: {
            title: true,
            outcome: true,
            defaultSuccessCriterion: true,
            parent: { select: { title: true } },
            questions: {
              where: {
                userId,
                state: "ACTIVE",
                schedulingEligible: true,
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
              select: {
                stage: true,
                confidence: true,
                successfulFullWeightReviews: true,
                completedSessions: true,
                distinctReviewDays: true,
                latestRating: true,
                successfulTransferProbes: true,
                transferReviewDays: true,
              },
            },
          },
        },
      },
    }),
  ])

  const candidates: TodayCandidate[] = goalSkills.map((goalSkill) => {
    const dueAt = goalSkill.skillNode.questions.reduce<Date | null>((earliest, question) => {
      if (question.generatedSpec?.role === "TRANSFER") return earliest
      if (!question.goalQuestions.some(({ goalId }) => goalId === goalSkill.goal.id)) {
        return earliest
      }
      const candidate = question.reviewSchedules[0]?.dueAt ?? null
      if (!candidate || (earliest && earliest.getTime() <= candidate.getTime())) {
        return earliest
      }
      return candidate
    }, null)
    const readiness = goalSkill.currentScopeVersion?.readiness[0] ?? null

    return {
      goalId: goalSkill.goal.id,
      goalTitle: goalSkill.goal.title,
      goalOutcome: goalSkill.goal.outcome,
      goalSkillId: goalSkill.id,
      branchTitle: goalSkill.skillNode.parent?.title ?? "Independent",
      title: goalSkill.skillNode.title,
      outcome:
        goalSkill.currentScopeVersion?.outcome ?? goalSkill.skillNode.outcome ?? "",
      successCriterion:
        goalSkill.currentScopeVersion?.successCriterion ??
        goalSkill.skillNode.defaultSuccessCriterion ??
        "",
      stage: readiness?.stage ?? "UNASSESSED",
      confidence: readiness?.confidence ?? "LOW",
      evidenceCount: readiness?.completedSessions ?? 0,
      successCount: readiness?.distinctReviewDays ?? 0,
      successfulTransferProbes: readiness?.successfulTransferProbes ?? 0,
      transferReviewDays: readiness?.transferReviewDays ?? 0,
      reason:
        goalSkill.lifecycle !== "ACTIVE"
          ? "Setup is not complete"
          : dueAt
            ? readinessReason(readiness)
            : "No recall scheduled",
      lifecycle: goalSkill.lifecycle,
      createdAt: goalSkill.createdAt,
      dueAt,
    }
  })

  const strengthenCandidates: TodayStrengthenCandidate[] = learningGaps.flatMap(
    (gap) => {
      const latestRevision = gap.remediationRevisions[0]
      if (!latestRevision || latestRevision.activities.length > 0) return []

      return [
        {
          gapId: gap.id,
          goalSkillId: gap.goalSkillId,
          skillTitle: gap.goalSkill.skillNode.title,
          gapLabel: latestRevision.gapLabel,
          openedAt: gap.openedAt,
        },
      ]
    },
  )

  const activeSession: ActiveSessionCandidate | null =
    activeSessionRecord?.goalSkillId
      ? {
          id: activeSessionRecord.id,
          goalId: activeSessionRecord.goalId,
          goalSkillId: activeSessionRecord.goalSkillId,
          dueAt: activeSessionRecord.items[0]?.scheduleDueAtBefore ?? null,
        }
      : null

  return selectTodayData(
    candidates,
    activeSession,
    now,
    preferredGoalSkillId,
    strengthenCandidates,
  )
}

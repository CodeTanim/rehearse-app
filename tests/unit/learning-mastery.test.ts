import { describe, expect, it } from "vitest"

import {
  deriveDisplayStage,
  getEvidenceWeight,
  MASTERY_RULE_VERSION,
  projectGoalSkillReadiness,
  WELL_LEARNED_INTERVAL_MINUTES,
} from "@/lib/learning/mastery"
import { deriveDueState } from "@/lib/learning/schedule"
import type {
  GoalSkillReadinessInput,
  MasteryEvidenceInput,
  ReviewRating,
} from "@/lib/learning/types"

const CONCEPT = "concept-v1"
const DAY = 24 * 60

function evidence(
  reviewDay: string,
  index: number,
  options: {
    conceptVersionId?: string
    rating?: ReviewRating
    weight?: 0 | 0.5 | 1
    sessionId?: string
    kind?: string
    questionId?: string
    questionFamilyId?: string
  } = {},
): MasteryEvidenceInput {
  const occurredAt = new Date(new Date(`${reviewDay}T12:00:00.000Z`).getTime() + index * 60_000)
  return {
    conceptVersionId: options.conceptVersionId ?? CONCEPT,
    kind: options.kind,
    questionId: options.questionId,
    questionFamilyId: options.questionFamilyId,
    sessionId: options.sessionId ?? `session-${index}`,
    sessionCompletedAt: new Date(occurredAt.getTime() + 60_000),
    rating: options.rating ?? "GOOD",
    weight: options.weight ?? 1,
    reviewDay,
    occurredAt,
  }
}

function input(overrides: Partial<GoalSkillReadinessInput> = {}): GoalSkillReadinessInput {
  return {
    requiredConceptVersionIds: [CONCEPT],
    activeQuestionConceptVersionIds: [CONCEPT],
    evidence: [],
    activeSchedules: [
      {
        conceptVersionId: CONCEPT,
        dueAt: new Date("2026-02-28T12:00:00.000Z"),
        intervalMinutes: 30 * DAY,
      },
    ],
    computedAt: new Date("2026-02-01T12:00:00.000Z"),
    ...overrides,
  }
}

function wellLearnedEvidence() {
  return [
    evidence("2026-01-01", 0, { weight: 0.5 }),
    evidence("2026-01-02", 1),
    evidence("2026-01-04", 2),
    evidence("2026-01-07", 3),
    evidence("2026-01-10", 4),
    evidence("2026-01-15", 5),
    evidence("2026-01-20", 6, {
      kind: "OBJECTIVE_TRANSFER",
      questionId: "transfer-question-1",
      questionFamilyId: "transfer-family-1",
    }),
    evidence("2026-01-25", 7),
    evidence("2026-01-30", 8, {
      kind: "SELF_ASSESSED_TRANSFER",
      questionId: "transfer-question-2",
      questionFamilyId: "transfer-family-2",
    }),
  ]
}

describe("inspectable Well learned gates", () => {
  it("marks all requirements met exactly when the policy awards the milestone", () => {
    const result = projectGoalSkillReadiness(input({ evidence: wellLearnedEvidence() }))
    expect(result.stage).toBe("WELL_LEARNED")
    expect(result.milestone?.requirements).toHaveLength(8)
    expect(result.milestone?.requirements.every((gate) => gate.met)).toBe(true)
  })

  it.each([
    ["coverage", { activeQuestionConceptVersionIds: [] }],
    ["concepts", { requiredConceptVersionIds: [CONCEPT, "new-concept"] }],
    ["spacing", { evidence: wellLearnedEvidence().slice(0, 3) }],
    ["latest", { evidence: [...wellLearnedEvidence(), evidence("2026-02-01", 9, { rating: "HARD" })] }],
    ["performance", { evidence: [...wellLearnedEvidence(), evidence("2026-02-01", 9, { rating: "AGAIN" })] }],
    ["interval", { activeSchedules: [{ conceptVersionId: CONCEPT, dueAt: new Date("2026-02-01"), intervalMinutes: 20 * DAY }] }],
    ["confidence", { evidence: wellLearnedEvidence().slice(0, 8) }],
    ["transfer", { evidence: wellLearnedEvidence().map((item) => ({ ...item, kind: "SELF_ASSESSED_RECALL" })) }],
  ] as Array<[string, Partial<GoalSkillReadinessInput>]>)("identifies the unmet %s gate", (id, overrides) => {
    const result = projectGoalSkillReadiness(input({ evidence: wellLearnedEvidence(), ...overrides }))
    expect(result.stage).not.toBe("WELL_LEARNED")
    expect(result.milestone?.requirements.find((gate) => gate.id === id)?.met).toBe(false)
  })

  it("does not confuse being overdue with losing earned evidence", () => {
    const past = new Date("2026-01-31")
    const result = projectGoalSkillReadiness(input({ evidence: wellLearnedEvidence(), activeSchedules: [{ conceptVersionId: CONCEPT, dueAt: past, intervalMinutes: 30 * DAY }] }))
    expect(result.milestone?.requirements.every((gate) => gate.met)).toBe(true)
    expect(deriveDisplayStage(result.stage, deriveDueState(past, new Date("2026-02-01")))).toBe("REFRESH_DUE")
  })

  it("does not award an empty scope or inflate spacing just because time passes", () => {
    const empty = projectGoalSkillReadiness(input({ requiredConceptVersionIds: [] }))
    expect(empty.milestone?.requirements.find((gate) => gate.id === "coverage")?.met).toBe(false)
    const waited = projectGoalSkillReadiness(input({ evidence: [evidence("2026-01-01", 0, { weight: 0.5 })], computedAt: new Date("2027-01-01") }))
    expect(waited.milestone?.requirements.find((gate) => gate.id === "spacing")?.met).toBe(false)
    expect(waited.spanDays).toBe(0)
  })
})

describe("mastery-v1 evidence weighting", () => {
  it("uses half weight for the baseline, zero later that day, and full weight on a new day", () => {
    const baseline = evidence("2026-01-01", 0, { weight: 0.5 })

    expect(getEvidenceWeight([], "2026-01-01")).toBe(0.5)
    expect(getEvidenceWeight([baseline], "2026-01-01")).toBe(0)
    expect(getEvidenceWeight([baseline], "2026-01-02")).toBe(1)
  })

  it("rejects malformed calendar days before assigning weight", () => {
    expect(() => getEvidenceWeight([], "2026-02-30")).toThrow(RangeError)
    expect(() =>
      getEvidenceWeight([{ reviewDay: "yesterday" }], "2026-01-01"),
    ).toThrow(RangeError)
  })
})

describe("mastery-v1 readiness projection", () => {
  it("starts unassessed without qualifying evidence", () => {
    const result = projectGoalSkillReadiness(input())

    expect(result).toMatchObject({
      ruleVersion: MASTERY_RULE_VERSION,
      stage: "UNASSESSED",
      confidence: "LOW",
      scopeCoverage: 1,
      selfAssessedIndex: null,
      latestRating: null,
    })
    expect(result.explanation.reasons).toEqual(["NO_QUALIFYING_REVIEWS"])
  })

  it("changes the first reviewed leaf to Learning with an explicit reason", () => {
    const result = projectGoalSkillReadiness(
      input({ evidence: [evidence("2026-01-01", 0, { weight: 0.5 })] }),
    )

    expect(result).toMatchObject({
      stage: "LEARNING",
      confidence: "LOW",
      selfAssessedIndex: 0.85,
      fullWeightReviews: 0,
      distinctReviewDays: 1,
    })
    expect(result.explanation.reasons).toContain("FIRST_REVIEW_RECORDED")
  })

  it("does not let a baseline or same-day repetitions manufacture readiness", () => {
    const result = projectGoalSkillReadiness(
      input({
        evidence: [
          evidence("2026-01-01", 0, { weight: 0.5 }),
          evidence("2026-01-01", 1, { weight: 0, sessionId: "session-repeat-1" }),
          evidence("2026-01-01", 2, { weight: 0, sessionId: "session-repeat-2" }),
          evidence("2026-01-01", 3, { weight: 0, sessionId: "session-repeat-3" }),
        ],
      }),
    )

    expect(result.stage).toBe("LEARNING")
    expect(result.fullWeightReviews).toBe(0)
    expect(result.distinctReviewDays).toBe(1)
  })

  it("becomes Demonstrated after three successful full-weight reviews over multiple days", () => {
    const result = projectGoalSkillReadiness(
      input({
        evidence: [
          evidence("2026-01-01", 0, { weight: 0.5 }),
          evidence("2026-01-02", 1),
          evidence("2026-01-03", 2, { rating: "HARD" }),
          evidence("2026-01-04", 3),
        ],
      }),
    )

    expect(result).toMatchObject({
      stage: "DEMONSTRATED",
      confidence: "MEDIUM",
      successfulFullWeightReviews: 3,
      distinctReviewDays: 4,
    })
    expect(result.explanation.reasons).toContain("DEMONSTRATED_REQUIREMENTS_MET")
  })

  it("requires coverage of every required concept", () => {
    const secondConcept = "concept-v2"
    const result = projectGoalSkillReadiness(
      input({
        requiredConceptVersionIds: [CONCEPT, secondConcept],
        activeQuestionConceptVersionIds: [CONCEPT],
        evidence: [
          evidence("2026-01-01", 0, { weight: 0.5 }),
          evidence("2026-01-02", 1),
          evidence("2026-01-03", 2),
          evidence("2026-01-04", 3),
        ],
      }),
    )

    expect(result.stage).toBe("LEARNING")
    expect(result.scopeCoverage).toBe(0.5)
    expect(result.explanation.reasons).toContain("SCOPE_INCOMPLETE")
  })

  it("does not raise confidence when many full-weight reviews occur on one day", () => {
    const concepts = Array.from({ length: 8 }, (_, index) => `concept-${index}`)
    const result = projectGoalSkillReadiness(
      input({
        requiredConceptVersionIds: concepts,
        activeQuestionConceptVersionIds: concepts,
        evidence: [
          evidence("2026-01-01", 0, {
            conceptVersionId: concepts[0],
            weight: 0.5,
          }),
          ...concepts.map((conceptVersionId, index) =>
            evidence("2026-01-20", index + 1, { conceptVersionId }),
          ),
        ],
      }),
    )

    expect(result.fullWeightReviews).toBe(8)
    expect(result.distinctReviewDays).toBe(2)
    expect(result.confidence).toBe("LOW")
  })

  it("reaches Well learned only after every policy-v1 check is satisfied", () => {
    const result = projectGoalSkillReadiness(input({ evidence: wellLearnedEvidence() }))

    expect(result).toMatchObject({
      stage: "WELL_LEARNED",
      confidence: "HIGH",
      scopeCoverage: 1,
      selfAssessedIndex: 0.85,
      recentThreeSessionIndex: 0.85,
      fullWeightReviews: 8,
      successfulFullWeightReviews: 8,
      distinctReviewDays: 9,
      spanDays: 29,
      completedSessions: 9,
      medianIntervalMinutes: 30 * DAY,
      successfulTransferProbes: 2,
      transferReviewDays: 2,
    })
    expect(result.explanation.reasons).toEqual(["WELL_LEARNED_REQUIREMENTS_MET"])
  })

  it("does not claim Well learned without two spaced transfer families", () => {
    const withoutTransfers = wellLearnedEvidence().map((item) => ({
      ...item,
      kind: "SELF_ASSESSED_RECALL",
      questionFamilyId: undefined,
    }))
    const result = projectGoalSkillReadiness(input({ evidence: withoutTransfers }))

    expect(result.stage).toBe("DEMONSTRATED")
    expect(result.successfulTransferProbes).toBe(0)
    expect(result.explanation.reasons).toContain("NEEDS_TRANSFER_EVIDENCE")
  })

  it("does not claim Well learned below the maintenance interval", () => {
    const result = projectGoalSkillReadiness(
      input({
        evidence: wellLearnedEvidence(),
        activeSchedules: [
          {
            conceptVersionId: CONCEPT,
            dueAt: new Date("2026-02-10T12:00:00.000Z"),
            intervalMinutes: WELL_LEARNED_INTERVAL_MINUTES - 1,
          },
        ],
      }),
    )

    expect(result.stage).toBe("DEMONSTRATED")
    expect(result.explanation.reasons).toContain("NEEDS_STABLE_INTERVAL")
  })

  it("derives Refresh due without demoting Well learned as time passes", () => {
    const readiness = projectGoalSkillReadiness(
      input({
        evidence: wellLearnedEvidence(),
        activeSchedules: [
          {
            conceptVersionId: CONCEPT,
            dueAt: new Date("2026-02-01T12:00:00.000Z"),
            intervalMinutes: 30 * DAY,
          },
        ],
      }),
    )

    expect(readiness.stage).toBe("WELL_LEARNED")
    expect(deriveDisplayStage(readiness.stage, deriveDueState(readiness.earliestDueAt!, new Date("2026-02-02T11:59:59.000Z")))).toBe("REFRESH_DUE")
    expect(deriveDisplayStage(readiness.stage, deriveDueState(readiness.earliestDueAt!, new Date("2026-02-02T12:00:00.000Z")))).toBe("REFRESH_DUE")
  })

  it("recomputes after an Again lapse while retaining all prior evidence", () => {
    const result = projectGoalSkillReadiness(
      input({
        evidence: [
          ...wellLearnedEvidence(),
          evidence("2026-02-01", 9, { rating: "AGAIN" }),
        ],
        activeSchedules: [
          {
            conceptVersionId: CONCEPT,
            dueAt: new Date("2026-02-01T12:10:00.000Z"),
            intervalMinutes: 10,
          },
        ],
      }),
    )

    expect(result.stage).toBe("LEARNING")
    expect(result.confidence).toBe("HIGH")
    expect(result.fullWeightReviews).toBe(9)
    expect(result.latestRating).toBe("AGAIN")
    expect(result.explanation.reasons).toContain("LATEST_REVIEW_WAS_AGAIN")
  })

  it("lets a same-day Again lapse change state even though its readiness weight is zero", () => {
    const result = projectGoalSkillReadiness(
      input({
        evidence: [
          ...wellLearnedEvidence(),
          evidence("2026-01-30", 9, {
            rating: "AGAIN",
            weight: 0,
            sessionId: "same-day-lapse",
          }),
        ],
      }),
    )

    expect(result.stage).toBe("LEARNING")
    expect(result.fullWeightReviews).toBe(8)
    expect(result.latestRating).toBe("AGAIN")
  })

  it("uses the mean of the last three completed sessions, not a lifetime score", () => {
    const history = wellLearnedEvidence()
    const result = projectGoalSkillReadiness(
      input({
        evidence: [
          ...history.slice(0, -3),
          evidence("2026-01-20", 6, { rating: "EASY" }),
          evidence("2026-01-25", 7, { rating: "GOOD" }),
          evidence("2026-01-30", 8, { rating: "HARD" }),
        ],
      }),
    )

    expect(result.recentThreeSessionIndex).toBe(0.8167)
    expect(result.stage).toBe("DEMONSTRATED")
    expect(result.explanation.reasons).toContain("NEEDS_RECENT_PERFORMANCE")
  })

  it("is deterministic and does not mutate caller-owned dates or arrays", () => {
    const source = input({ evidence: wellLearnedEvidence() })
    const originalEvidenceOrder = [...source.evidence]
    const first = projectGoalSkillReadiness(source)
    const second = projectGoalSkillReadiness(source)

    expect(second).toEqual(first)
    expect(source.evidence).toEqual(originalEvidenceOrder)
    expect(first.earliestDueAt).not.toBe(source.activeSchedules[0].dueAt)
    expect(first.computedAt).not.toBe(source.computedAt)
  })

  it("rejects invalid evidence and schedule values", () => {
    expect(() =>
      projectGoalSkillReadiness(
        input({ evidence: [{ ...evidence("2026-01-01", 0), reviewDay: "not-a-day" }] }),
      ),
    ).toThrow(RangeError)
    expect(() =>
      projectGoalSkillReadiness(
        input({ activeSchedules: [{ conceptVersionId: CONCEPT, dueAt: new Date(), intervalMinutes: -1 }] }),
      ),
    ).toThrow(RangeError)
  })
})

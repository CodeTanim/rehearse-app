import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
const mocks = vi.hoisted(() => ({ skill: vi.fn(), evidence: vi.fn(), schedules: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { goalSkill: { findFirst: mocks.skill }, masteryEvidence: { findMany: mocks.evidence }, reviewSchedule: { findMany: mocks.schedules } } }))
import { getSkillMilestone } from "@/lib/learning/skill-milestone-query"

describe("owned current-scope milestone", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.skill.mockResolvedValue({ goalId: "goal", skillNodeId: "node", currentScopeVersion: { goalSkillId: "skill", policyVersion: "mastery-v1", concepts: [{ conceptVersionId: "concept" }] } })
    mocks.evidence.mockResolvedValue([])
    mocks.schedules.mockResolvedValue([])
  })
  it("requires an owned, active, live-goal skill before reading any evidence", async () => {
    mocks.skill.mockResolvedValue(null)
    expect(await getSkillMilestone("owner", "skill")).toBeNull()
    expect(mocks.skill).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "skill", userId: "owner", lifecycle: "ACTIVE", skillNode: { graph: { userId: "owner" } } }) }))
    expect(mocks.evidence).not.toHaveBeenCalled()
  })
  it("does not interpret an unsupported policy using today's thresholds", async () => {
    mocks.skill.mockResolvedValue({ currentScopeVersion: { goalSkillId: "skill", policyVersion: "mastery-v2" } })
    expect(await getSkillMilestone("owner", "skill")).toBeNull()
    expect(mocks.evidence).not.toHaveBeenCalled()
  })
  it("reads only current concept versions and returns a fresh unassessed checklist", async () => {
    const result = await getSkillMilestone("owner", "skill")
    expect(result?.stage).toBe("UNASSESSED")
    expect(result?.milestone?.requirements.every((gate) => !gate.met)).toBe(true)
    expect(mocks.evidence).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner", conceptVersionId: { in: ["concept"] } }) }))
    expect(mocks.schedules).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner", question: expect.objectContaining({ skillNodeId: "node", userId: "owner" }) }) }))
  })
  it("projects stored answers and schedules instead of trusting a stale display stage", async () => {
    const date = new Date("2026-09-01T12:00:00Z")
    mocks.evidence.mockResolvedValue([{ conceptVersionId: "concept", kind: "OBJECTIVE_TRANSFER", weight: 0.5, reviewDay: "2026-09-01", occurredAt: date,
      attempt: { rating: "GOOD", questionId: "question", occurredAt: date, question: { generatedSpec: { questionFamilyId: "family" } },
        sessionItem: { sessionId: "session", completedAt: null, session: { completedAt: null } } } }])
    mocks.schedules.mockResolvedValue([{ dueAt: date, intervalMinutes: 1440, questionRevision: { concepts: [{ conceptVersionId: "concept" }] } }])
    const result = await getSkillMilestone("owner", "skill", date)
    expect(result?.stage).toBe("LEARNING")
    expect(result?.successfulTransferProbes).toBe(1)
    expect(result?.milestone?.requirements.find((gate) => gate.id === "coverage")?.met).toBe(true)
    expect(result?.milestone?.requirements.find((gate) => gate.id === "transfer")?.met).toBe(false)
  })
})

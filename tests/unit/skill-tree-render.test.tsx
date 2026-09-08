import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/actions/skill-position", () => ({ saveSkillPositionAction: vi.fn() }))
vi.mock("@/app/actions/skill-relationships", () => ({ connectSkillRelationshipAction: vi.fn(), manageSkillRelationshipAction: vi.fn() }))
import { SkillTree } from "@/components/learning/skill-tree"
import type { SkillTreeLeaf } from "@/lib/learning/skill-tree-query"

function leaf(overrides: Partial<SkillTreeLeaf> = {}): SkillTreeLeaf {
  return {
    skillNodeId: "node-a",
    goalId: "goal-a",
    goalTitle: "Computer science",
    goalOutcome: "Build reliable software",
    goalSkillId: "skill-a",
    branchTitle: "Data structures",
    title: "Hashmaps",
    outcome: "Use hashmaps",
    successCriterion: "Choose a hashmap when appropriate",
    stage: "LEARNING",
    confidence: "MEDIUM",
    dueState: "CURRENT",
    dueAt: new Date("2026-09-08T12:00:00.000Z"),
    evidenceCount: 2,
    successCount: 1,
    reason: "1 review on a new day",
    ...overrides,
  }
}

describe("SkillTree", () => {
  it.each(["RELATED", "PREREQUISITE"] as const)("exposes %s disconnect controls without opening Manage connections", (kind) => {
    const html = renderToStaticMarkup(createElement(SkillTree, {
      leaves: [leaf(), leaf({ skillNodeId: "node-b", goalSkillId: "skill-b", title: "Arrays" })],
      goalTitle: "Computer science",
      relationships: [{ id: "edge", sourceSkillNodeId: "node-a", sourceTitle: "Hashmaps", targetSkillNodeId: "node-b", targetTitle: "Arrays", kind, status: "CONFIRMED", origin: "USER", confidence: null, rationale: null }],
    }))
    expect(html).toContain('aria-label="Hashmaps connections"')
    expect(html).toContain(`aria-label="Disconnect: Hashmaps is ${kind === "RELATED" ? "related to" : "a prerequisite for"} Arrays"`)
    expect(html).toContain("select connection")
  })
  it("renders independent leaves as an accessible constellation", () => {
    const html = renderToStaticMarkup(
      createElement(SkillTree, {
        leaves: [
          leaf({ dueState: "DUE" }),
          leaf({
            skillNodeId: "node-b",
            goalSkillId: "skill-b",
            title: "Arrays",
            stage: "WELL_LEARNED",
            confidence: "HIGH",
            dueState: "DUE",
            reason: "Well learned for this goal · self-rated",
          }),
          leaf({
            skillNodeId: "node-c",
            goalSkillId: "skill-c",
            branchTitle: "Foundations",
            title: "Complexity",
            dueState: "NOT_SCHEDULED",
            dueAt: null,
          }),
        ],
        goalTitle: "Computer science",
        headingLevel: "h1",
        addSkillHref: "/today/new",
      }),
    )

    expect(html).toContain("<h1")
    expect(html).toContain('data-testid="skill-constellation"')
    expect(html).toContain('aria-label="Skill leaves"')
    expect(html).toContain("Hashmaps")
    expect(html).toContain("Arrays")
    expect(html).toContain("Complexity")
    expect(html).toContain("Well learned")
    expect(html).toContain("Refresh due")
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('href="/today?skill=skill-a"')
    expect(html).toContain('href="/today/new"')
    expect(html).not.toContain("Data structures")
    expect(html).not.toContain("Foundations")
    expect(html).not.toContain("Suggested")
  })

  it("keeps the existing single-leaf call shape usable", () => {
    const html = renderToStaticMarkup(createElement(SkillTree, { leaf: leaf(), compact: true }))

    expect(html).toContain("Skill Tree")
    expect(html).toContain("Hashmaps")
    expect(html).not.toContain("Add skill")
  })

  it("gives an empty owned tree one short next step", () => {
    const html = renderToStaticMarkup(
      createElement(SkillTree, {
        leaves: [],
        goalTitle: "Computer science",
        headingLevel: "h1",
        addSkillHref: "/today/new",
      }),
    )

    expect(html).toContain("Your first skill will appear here.")
    expect(html).toContain("Add skill")
    expect(html).not.toContain("<details")
  })
})

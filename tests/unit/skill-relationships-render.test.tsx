import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/actions/skill-relationships", () => ({
  connectSkillRelationshipAction: vi.fn(),
  manageSkillRelationshipAction: vi.fn(),
}))

import { SkillRelationships } from "@/components/learning/skill-relationships"
import type {
  SkillTreeLeaf,
  SkillTreeRelationship,
} from "@/lib/learning/skill-tree-query"

const leaves = [
  { goalSkillId: "goal-skill-a", title: "Hashmaps" },
  { goalSkillId: "goal-skill-b", title: "Arrays" },
] as SkillTreeLeaf[]

function relationship(
  overrides: Partial<SkillTreeRelationship> = {},
): SkillTreeRelationship {
  return {
    id: "relationship-a",
    sourceSkillNodeId: "node-a",
    sourceTitle: "Arrays",
    targetSkillNodeId: "node-b",
    targetTitle: "Hashmaps",
    kind: "RELATED",
    origin: "SYSTEM_BRANCH",
    status: "SUGGESTED",
    confidence: 0.75,
    rationale: "Arrays and Hashmaps share the Data Structures branch.",
    ...overrides,
  }
}

describe("SkillRelationships", () => {
  it("does not render unsolicited system suggestions", () => {
    const html = renderToStaticMarkup(
      createElement(SkillRelationships, {
        leaves,
        relationships: [relationship()],
      }),
    )

    expect(html).toContain("Manage connections")
    expect(html).toContain("No connections yet.")
    expect(html).not.toContain("Suggested")
    expect(html).not.toContain("Accept")
    expect(html).not.toContain("Dismiss")
    expect(html).not.toContain("Arrays is related to Hashmaps")
  })

  it("renders confirmed directed prerequisites as solid with a remove action", () => {
    const html = renderToStaticMarkup(
      createElement(SkillRelationships, {
        leaves,
        relationships: [
          relationship({
            kind: "PREREQUISITE",
            origin: "USER",
            status: "CONFIRMED",
            confidence: null,
            rationale: null,
          }),
        ],
      }),
    )

    expect(html).toContain("Manage connections")
    expect(html).toContain("Prerequisite")
    expect(html).toContain("Remove")
    expect(html).toContain("Arrays is a prerequisite for Hashmaps")
    expect(html).not.toContain("Suggested")
  })

  it("uses native labeled controls for the compact keyboard-friendly form", () => {
    const html = renderToStaticMarkup(
      createElement(SkillRelationships, { leaves, relationships: [] }),
    )

    expect(html).toContain('for="relationship-from"')
    expect(html).toContain('for="relationship-kind"')
    expect(html).toContain('for="relationship-to"')
    expect(html).toContain("For a prerequisite, From comes before To.")
    expect(html).toContain("Connect two skills")
  })
})

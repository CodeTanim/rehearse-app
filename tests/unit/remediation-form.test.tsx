import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/actions/remediation", () => ({
  completeRemediationAction: vi.fn(),
}))

import { RemediationForm } from "@/components/learning/remediation-form"

describe("RemediationForm", () => {
  it("renders one concise scaffold response", () => {
    const html = renderToStaticMarkup(
      createElement(RemediationForm, {
        goalSkillId: "goal-skill-a",
        gapId: "gap-a",
        remediationRevisionId: "revision-a",
        scaffoldPrompt: "Why does retrieval strengthen memory?",
      }),
    )

    expect(html).toContain("Why does retrieval strengthen memory?")
    expect(html).toContain('name="answer"')
    expect(html).toContain('name="remediationRevisionId"')
    expect(html).toContain('value="revision-a"')
    expect(html).toContain("Finish practice")
    expect(html).not.toContain("autofocus")
  })

  it("states that assisted practice does not raise mastery", () => {
    const html = renderToStaticMarkup(
      createElement(RemediationForm, {
        goalSkillId: "goal-skill-a",
        gapId: "gap-a",
        remediationRevisionId: "revision-a",
        scaffoldPrompt: "Why does retrieval strengthen memory?",
        initialAnswer: "It makes recall pathways easier to access.",
        alreadyCompleted: true,
      }),
    )

    expect(html).toContain("prepares you for your next recall")
    expect(html).toContain("it does not raise mastery")
    expect(html).toContain("Back to skill")
    expect(html).toContain('href="/skills/goal-skill-a"')
    expect(html).toContain('href="/today?skill=goal-skill-a"')
    expect(html).toContain("View recall")
  })
})

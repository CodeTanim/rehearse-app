import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MasteryMilestonePanel } from "@/components/learning/mastery-milestone"
import type { MasteryMilestone } from "@/lib/learning/types"

const milestone: MasteryMilestone = { ruleVersion: "mastery-v1", requirements: [
  { id: "coverage", label: "Cover the skill", met: true, detail: "2 of 2 ideas", next: "Complete setup" },
  { id: "spacing", label: "Remember over time", met: false, detail: "1 day (need 3)", next: "Return for scheduled recalls." },
] }
const render = (stage: string, other = {}) => renderToStaticMarkup(createElement(MasteryMilestonePanel, { milestone, stage, ...other }))

describe("milestone presentation", () => {
  it("shows the next unmet requirement with the full checklist collapsed", () => {
    const html = render("LEARNING")
    expect(html).toContain("Toward Well learned")
    expect(html).toContain("Return for scheduled recalls.")
    expect(html).toContain("What’s still needed")
    expect(html).not.toMatch(/<details[^>]*open/)
    expect(html).toContain("Met: ")
    expect(html).toContain("Still needed: ")
    expect(html).toContain("not an objective accuracy score")
  })
  it("distinguishes an earned transition, maintenance, and refresh due", () => {
    expect(render("WELL_LEARNED", { achieved: true })).toContain("You’ve earned Well learned")
    expect(render("WELL_LEARNED")).not.toContain("You’ve earned")
    expect(render("WELL_LEARNED", { refreshDue: true })).toContain("Your evidence still stands.")
  })
  it("supports old saved summaries without making up evidence", () => {
    expect(render("LEARNING", { milestone: undefined })).toBe("")
  })
  it("labels saved recall evidence as historical rather than today's scope", () => {
    expect(render("LEARNING", { snapshot: true })).toContain("Evidence and scope when this recall was saved")
    expect(render("LEARNING", { snapshot: true })).not.toContain("current scope")
  })
})

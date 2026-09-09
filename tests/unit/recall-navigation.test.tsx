import { type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ today: vi.fn(), garden: vi.fn(), sources: vi.fn(), pack: vi.fn(), gaps: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "user-a" } }) }))
vi.mock("@/lib/prisma", () => ({ prisma: {
  user: { findUnique: async () => ({ timezone: "UTC" }) },
  learningPack: { findFirst: mocks.pack }, learningGap: { findMany: mocks.gaps },
} }))
vi.mock("@/lib/learning/today-query", () => ({ getTodayData: mocks.today }))
vi.mock("@/lib/learning/skill-tree-query", () => ({ getUserSkillGarden: mocks.garden }))
vi.mock("@/lib/learning/source-service", () => ({ getSkillSourceSetup: mocks.sources }))
vi.mock("@/lib/learning/skill-milestone-query", () => ({ getSkillMilestone: async () => null }))
vi.mock("@/components/app/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => children }))
vi.mock("@/components/learning/skill-tree", () => ({ SkillTree: () => null }))
vi.mock("@/components/learning/start-review-form", () => ({ StartReviewForm: () => "Start review form" }))

import TodayPage from "@/app/today/page"
import SkillPage from "@/app/skills/[goalSkillId]/page"

const leaf = { goalSkillId: "maps", title: "Maps", stage: "LEARNING", dueState: "DUE", dueAt: new Date("2026-09-09T12:00:00Z"), evidenceCount: 1, successCount: 1 }
const repair = { kind: "STRENGTHEN", skillTitle: "Arrays", gapLabel: "Index bounds", href: "/skills/arrays/strengthen/gap-a" }
const renderToday = async (skill?: string) => renderToStaticMarkup(await TodayPage({ searchParams: Promise.resolve({ skill }) }))
const renderSkill = async () => renderToStaticMarkup(await SkillPage({ params: Promise.resolve({ goalSkillId: "maps" }) }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.garden.mockResolvedValue({ leaves: [leaf] })
  mocks.sources.mockResolvedValue({ sources: [] })
  mocks.pack.mockResolvedValue(null)
  mocks.gaps.mockResolvedValue([{ id: "gap-a", remediationRevisions: [{ gapLabel: "Key lookup", activities: [] }] }])
})

describe("recall access alongside repair", () => {
  it("shows both repair and the specific due skill on Today", async () => {
    mocks.today.mockResolvedValue({ ...repair, recall: { goalSkillId: "maps", title: "Maps" } })
    const html = await renderToday()
    expect(html).toContain('href="/skills/arrays/strengthen/gap-a"')
    expect(html).toContain('href="/today?skill=maps"')
    expect(html).toContain("Recall · Maps")
  })
  it("does not invent a recall option when nothing is due", async () => {
    mocks.today.mockResolvedValue(repair)
    expect(await renderToday()).not.toContain("Recall also due")
  })
  it("lets a chosen current skill return to its overview without starting early", async () => {
    mocks.today.mockResolvedValue({ kind: "CURRENT", leaf })
    const html = await renderToday("maps")
    expect(html).toContain("Back to skill")
    expect(html).toContain('href="/skills/maps"')
    expect(html).not.toContain("Start review form")
    expect(mocks.today).toHaveBeenCalledWith("user-a", expect.any(Date), "maps")
  })
  it("retains the existing start form for a selected due skill", async () => {
    mocks.today.mockResolvedValue({ kind: "REVIEW", leaf })
    const html = await renderToday("maps")
    expect(html).toContain("Start review form")
    expect(html).toContain('href="/skills/maps"')
  })
  it("offers due recall beside Strengthen on the overview", async () => {
    const html = await renderSkill()
    expect(html).toContain('href="/skills/maps/strengthen/gap-a"')
    expect(html).toContain('href="/today?skill=maps"')
    expect(html).toContain("Recall now")
  })
  it("offers only the schedule when the skill is current", async () => {
    mocks.garden.mockResolvedValue({ leaves: [{ ...leaf, dueState: "CURRENT" }] })
    const html = await renderSkill()
    expect(html).toContain("Recall schedule")
    expect(html).not.toContain("Recall now")
  })
  it("does not offer recall before the initial quiz or without a schedule", async () => {
    mocks.pack.mockResolvedValue({ currentVersion: { _count: { attempts: 0 } } })
    expect(await renderSkill()).not.toContain("/today?skill=")
    mocks.pack.mockResolvedValue(null)
    mocks.garden.mockResolvedValue({ leaves: [{ ...leaf, dueState: "CURRENT", dueAt: null }] })
    expect(await renderSkill()).not.toContain("/today?skill=")
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ updateMany: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({ prisma: { skillNode: { updateMany: mocks.updateMany } } }))
import { saveSkillPosition } from "@/lib/learning/skill-position-service"

describe("saved skill placement", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.updateMany.mockResolvedValue({ count: 1 }) })
  it("updates only an owned live node at the expected version", async () => {
    expect(await saveSkillPosition("owner", { skillNodeId: "node", x: 12, y: -20, version: 3 })).toEqual({ version: 4 })
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "node", kind: "SKILL", archivedAt: null, graph: { userId: "owner" }, positionVersion: 3, goalSkills: { some: { userId: "owner", lifecycle: { not: "ARCHIVED" }, goal: { userId: "owner" } } } },
      data: { mapX: 12, mapY: -20, positionVersion: { increment: 1 } },
    })
  })
  it("rejects stale, missing, archived or foreign nodes without a blind overwrite", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })
    expect(await saveSkillPosition("owner", { skillNodeId: "foreign", x: 0, y: 0, version: 0 })).toHaveProperty("error")
  })
  it.each([Infinity, NaN, 10001, -10001])("rejects invalid coordinate %s", async (x) => {
    await expect(saveSkillPosition("owner", { skillNodeId: "node", x, y: 0, version: 0 })).rejects.toThrow()
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
})

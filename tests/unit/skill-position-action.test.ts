import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ auth: vi.fn(), updateMany: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { skillNode: { updateMany: mocks.updateMany } } }))
import { saveSkillPositionAction } from "@/app/actions/skill-position"

describe("position action boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "owner" } }); mocks.updateMany.mockResolvedValue({ count: 1 }) })
  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue(null)
    expect(await saveSkillPositionAction({ skillNodeId: "node", x: 1, y: 2, version: 0 })).toHaveProperty("error")
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
  it("rejects client-supplied owner fields", async () => {
    expect(await saveSkillPositionAction({ skillNodeId: "node", x: 1, y: 2, version: 0, userId: "someone-else" })).toHaveProperty("error")
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
  it("saves using only the session owner", async () => {
    expect(await saveSkillPositionAction({ skillNodeId: "node", x: 1, y: 2, version: 0 })).toEqual({ version: 1 })
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ graph: { userId: "owner" } }) }))
  })
  it("does not expose infrastructure failures", async () => {
    mocks.updateMany.mockRejectedValue(new Error("private DB path"))
    expect(await saveSkillPositionAction({ skillNodeId: "node", x: 1, y: 2, version: 0 })).toEqual({ error: "The position could not be saved. Try moving the skill again." })
  })
})

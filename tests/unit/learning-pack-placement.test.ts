import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { markSkillPackReady } from "@/lib/learning/learning-pack-service"

describe("learning-pack graph independence", () => {
  const tx = {
    skillNode: {
      create: vi.fn(),
      update: vi.fn(),
    },
    skillRelationship: {
      create: vi.fn(),
      update: vi.fn(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    tx.skillNode.update.mockResolvedValue({ id: "skill-a" })
  })

  it("marks the pack ready without changing parentage or creating graph records", async () => {
    await markSkillPackReady(tx as never, {
      skillNodeId: "skill-a",
    })

    expect(tx.skillNode.update).toHaveBeenCalledWith({
      where: { id: "skill-a" },
      data: { state: "READY" },
    })
    expect(tx.skillNode.create).not.toHaveBeenCalled()
    expect(tx.skillRelationship.create).not.toHaveBeenCalled()
    expect(tx.skillRelationship.update).not.toHaveBeenCalled()
  })

  it("is safe to repeat without introducing topology side effects", async () => {
    await markSkillPackReady(tx as never, {
      skillNodeId: "skill-a",
    })
    await markSkillPackReady(tx as never, {
      skillNodeId: "skill-a",
    })

    expect(tx.skillNode.update).toHaveBeenCalledTimes(2)
    expect(tx.skillNode.create).not.toHaveBeenCalled()
    expect(tx.skillRelationship.create).not.toHaveBeenCalled()
    expect(tx.skillRelationship.update).not.toHaveBeenCalled()
  })
})

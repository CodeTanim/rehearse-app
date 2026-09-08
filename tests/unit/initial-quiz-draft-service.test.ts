import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ pack: vi.fn(), update: vi.fn(), current: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({ prisma: {
  learningPackVersion: { findFirst: mocks.pack },
  initialQuizDraft: { updateMany: mocks.update, findFirst: mocks.current },
} }))
vi.mock("@/lib/ai/learning-pack-schema", () => ({
  learningPackSchema: { parse: (value: unknown) => value },
  visibleInitialQuizQuestions: () => [{ questionIndex: 0, question: { type: "MULTIPLE_CHOICE", choices: ["A", "B", "C", "D"] } }],
}))
import { saveQuizDraft } from "@/lib/learning/initial-quiz-draft-service"
import { EMPTY_QUIZ_DRAFT } from "@/lib/learning/initial-quiz-draft"

describe("account-owned quiz checkpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pack.mockResolvedValue({ contentJson: "{}", _count: { attempts: 0 } })
    mocks.update.mockResolvedValue({ count: 1 })
  })
  it("checks the current owned pack before touching drafts", async () => {
    mocks.pack.mockResolvedValue(null)
    await expect(saveQuizDraft("other-user", "pack", 0, EMPTY_QUIZ_DRAFT)).rejects.toMatchObject({ status: 404 })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.pack).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      learningPack: expect.objectContaining({ userId: "other-user", currentVersionId: "pack" }),
    }) }))
  })
  it("uses optimistic versioning and owner filters", async () => {
    await expect(saveQuizDraft("user", "pack", 3, EMPTY_QUIZ_DRAFT)).resolves.toEqual({ version: 4 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { packVersionId: "pack", userId: "user", version: 3 } }))
  })
  it("does not overwrite a newer tab", async () => {
    mocks.update.mockResolvedValue({ count: 0 })
    mocks.current.mockResolvedValue({ version: 5, stateJson: JSON.stringify({ ...EMPTY_QUIZ_DRAFT, selectedChoiceIndex: 1 }) })
    await expect(saveQuizDraft("user", "pack", 3, EMPTY_QUIZ_DRAFT)).rejects.toMatchObject({ status: 409 })
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })
  it("accepts an identical retry after a lost response", async () => {
    mocks.update.mockResolvedValue({ count: 0 })
    mocks.current.mockResolvedValue({ version: 4, stateJson: JSON.stringify(EMPTY_QUIZ_DRAFT) })
    await expect(saveQuizDraft("user", "pack", 3, EMPTY_QUIZ_DRAFT)).resolves.toEqual({ version: 4 })
  })
  it("refuses changes to a completed quiz", async () => {
    mocks.pack.mockResolvedValue({ contentJson: "{}", _count: { attempts: 1 } })
    await expect(saveQuizDraft("user", "pack", 0, EMPTY_QUIZ_DRAFT)).rejects.toMatchObject({ status: 409 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

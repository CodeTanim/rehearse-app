import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class NotFoundError extends Error {}
  class ConflictError extends Error {
    constructor(public readonly publicMessage: string) {
      super(publicMessage)
    }
  }
  class SourceError extends Error {
    constructor(
      public readonly code: string,
      public readonly publicMessage: string,
    ) {
      super(publicMessage)
    }
  }

  return {
    auth: vi.fn(),
    createTopic: vi.fn(),
    addText: vi.fn(),
    addNote: vi.fn(),
    addPdf: vi.fn(),
    addWebsite: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
    NotFoundError,
    ConflictError,
    SourceError,
  }
})

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/learning/setup-service", () => ({
  LearningSetupNotFoundError: mocks.NotFoundError,
  LearningSetupConflictError: mocks.ConflictError,
}))
vi.mock("@/lib/learning/topic-service", () => ({ createTopic: mocks.createTopic }))
vi.mock("@/lib/learning/source-service", () => ({
  addAuthoredNoteSource: mocks.addNote,
  addPdfSource: mocks.addPdf,
  addPastedTextSource: mocks.addText,
  addWebsiteSource: mocks.addWebsite,
  SourceServiceError: mocks.SourceError,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))

import {
  addSourceAction,
  createTopicAction,
} from "@/app/actions/topic-source"

describe("topic and source Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "user-from-session" } })
    mocks.createTopic.mockResolvedValue({ goalSkillId: "goal-skill-a" })
    mocks.addText.mockResolvedValue({ goalSkillId: "goal-skill-a" })
    mocks.addNote.mockResolvedValue({ goalSkillId: "goal-skill-a" })
    mocks.addPdf.mockResolvedValue({ goalSkillId: "goal-skill-a" })
    mocks.addWebsite.mockResolvedValue({ goalSkillId: "goal-skill-a" })
  })

  it("requires authentication before topic creation", async () => {
    mocks.auth.mockResolvedValue(null)
    const form = new FormData()
    form.set("title", "Hashmaps")

    await expect(createTopicAction({}, form)).resolves.toEqual({
      error: "Sign in to continue.",
    })
    expect(mocks.createTopic).not.toHaveBeenCalled()
  })

  it("creates a topic for the session owner and advances to sources", async () => {
    const form = new FormData()
    form.set("title", "Hashmaps")
    form.set("userId", "untrusted-user")

    await createTopicAction({}, form)

    expect(mocks.createTopic).toHaveBeenCalledWith({
      userId: "user-from-session",
      title: "Hashmaps",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/today")
    expect(mocks.redirect).toHaveBeenCalledWith("/skills/goal-skill-a/sources")
  })

  it("adds pasted text with the stable form contract", async () => {
    const form = new FormData()
    form.set("goalSkillId", "goal-skill-a")
    form.set("sourceType", "TEXT")
    form.set("displayName", "My notes")
    form.set("text", "Hash maps store key/value pairs.")

    await addSourceAction({}, form)

    expect(mocks.addText).toHaveBeenCalledWith({
      userId: "user-from-session",
      goalSkillId: "goal-skill-a",
      displayName: "My notes",
      text: "Hash maps store key/value pairs.",
    })
    expect(mocks.addWebsite).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/skills/goal-skill-a/sources",
    )
    expect(mocks.redirect).toHaveBeenCalledWith("/skills/goal-skill-a/sources")
  })

  it("adds a website without passing inactive pasted-text fields", async () => {
    const form = new FormData()
    form.set("goalSkillId", "goal-skill-a")
    form.set("sourceType", "URL")
    form.set("url", "https://example.com/hashmaps")
    form.set("text", "stale hidden form value")

    await addSourceAction({}, form)

    expect(mocks.addWebsite).toHaveBeenCalledWith({
      userId: "user-from-session",
      goalSkillId: "goal-skill-a",
      url: "https://example.com/hashmaps",
    })
    expect(mocks.addText).not.toHaveBeenCalled()
  })

  it("saves a written note using its authored-note contract", async () => {
    const form = new FormData()
    form.set("goalSkillId", "goal-skill-a")
    form.set("sourceType", "NOTE")
    form.set("displayName", "What I learned")
    form.set("text", "Hash maps trade memory for fast lookup.")

    await addSourceAction({}, form)

    expect(mocks.addNote).toHaveBeenCalledWith({
      userId: "user-from-session",
      goalSkillId: "goal-skill-a",
      title: "What I learned",
      text: "Hash maps trade memory for fast lookup.",
    })
    expect(mocks.addText).not.toHaveBeenCalled()
    expect(mocks.addWebsite).not.toHaveBeenCalled()
    expect(mocks.addPdf).not.toHaveBeenCalled()
  })

  it("passes only an uploaded PDF object to the owner-scoped service", async () => {
    const file = new File(["%PDF-1.7\nfixture"], "hashmaps.pdf", {
      type: "application/pdf",
    })
    const form = new FormData()
    form.set("goalSkillId", "goal-skill-a")
    form.set("sourceType", "PDF")
    form.set("file", file)

    await addSourceAction({}, form)

    expect(mocks.addPdf).toHaveBeenCalledWith({
      userId: "user-from-session",
      goalSkillId: "goal-skill-a",
      file,
    })
    expect(mocks.addText).not.toHaveBeenCalled()
    expect(mocks.addWebsite).not.toHaveBeenCalled()
    expect(mocks.addNote).not.toHaveBeenCalled()
  })

  it("returns safe source validation errors without redirecting", async () => {
    mocks.addWebsite.mockRejectedValue(
      new mocks.SourceError("UNSAFE_IP_ADDRESS", "Use a public website URL."),
    )
    const form = new FormData()
    form.set("goalSkillId", "goal-skill-a")
    form.set("sourceType", "URL")
    form.set("url", "http://127.0.0.1")

    await expect(addSourceAction({}, form)).resolves.toEqual({
      error: "Use a public website URL.",
    })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})

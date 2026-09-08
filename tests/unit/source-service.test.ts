import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"

vi.mock("server-only", () => ({}))

const mocks = vi.hoisted(() => {
  const tx = {
    goalSkill: { findFirst: vi.fn() },
    source: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    sourceVersion: {
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    skillSourceAssignment: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
  return { tx, transaction: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    goalSkill: mocks.tx.goalSkill,
    $transaction: mocks.transaction,
  },
}))

import {
  addAuthoredNoteSource,
  addPdfSource,
  addPastedTextSource,
  addWebsiteSource,
  getSkillSourceSetup,
  SourceServiceError,
} from "@/lib/learning/source-service"
import { LearningSetupNotFoundError } from "@/lib/learning/setup-service"
import type { SafeUrlSnapshot } from "@/lib/learning/safe-url-snapshot"

const now = new Date("2026-09-04T15:00:00.000Z")

describe("source persistence and assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(
      async (work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx),
    )
    mocks.tx.goalSkill.findFirst.mockResolvedValue(ownedGoalSkill())
    mocks.tx.source.findUnique.mockResolvedValue(null)
    mocks.tx.source.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "source-a",
        userId: data.userId,
        type: data.type,
        canonicalKey: data.canonicalKey,
        status: data.status,
        archivedAt: null,
        currentVersionId: null,
        displayName: data.displayName,
        displayUrl: data.displayUrl,
      }),
    )
    mocks.tx.source.update.mockResolvedValue(
      sourceRecord({ currentVersionId: "version-a" }),
    )
    mocks.tx.sourceVersion.findUnique.mockResolvedValue(null)
    mocks.tx.sourceVersion.aggregate.mockResolvedValue({ _max: { revision: null } })
    mocks.tx.sourceVersion.create.mockResolvedValue({
      id: "version-a",
      sourceId: "source-a",
    })
    mocks.tx.skillSourceAssignment.findUnique.mockResolvedValue(null)
    mocks.tx.skillSourceAssignment.count.mockResolvedValue(0)
    mocks.tx.skillSourceAssignment.create.mockResolvedValue(assignmentRecord())
    mocks.tx.skillSourceAssignment.update.mockResolvedValue(assignmentRecord())
  })

  it("persists pasted text as one immediately ready immutable version", async () => {
    const result = await addPastedTextSource(
      {
        userId: "user-a",
        goalSkillId: "goal-skill-a",
        text: "  Hash maps store key/value pairs.\r\n\r\nLookup uses a hash.  ",
        displayName: "  My notes  ",
      },
      { now },
    )

    expect(result).toEqual({
      goalSkillId: "goal-skill-a",
      skillNodeId: "skill-a",
      sourceId: "source-a",
      versionId: "version-a",
      assignmentId: "assignment-a",
      sourceStatus: "READY",
      displayName: "My notes",
      kind: "TEXT",
      locator: "Pasted text",
      deduplicated: false,
    })
    expect(mocks.tx.source.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-a",
        type: "TEXT",
        origin: "PASTED",
        status: "READY",
        displayName: "My notes",
        displayUrl: null,
        canonicalKey: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
      select: expect.any(Object),
    })
    expect(mocks.tx.sourceVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceId: "source-a",
        revision: 1,
        mimeType: "text/plain",
        extractedText: "Hash maps store key/value pairs.\n\nLookup uses a hash.",
        retrievedAt: now,
        extractorVersion: "pasted-text-v1",
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
      select: { id: true, sourceId: true },
    })
    expect(mocks.tx.source.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentVersionId: "version-a" }),
      }),
    )
    expect(mocks.tx.skillSourceAssignment.create).toHaveBeenCalledWith({
      data: {
        userId: "user-a",
        goalSkillId: "goal-skill-a",
        sourceId: "source-a",
        sourceVersionId: "version-a",
        status: "INCLUDED",
        sortOrder: 0,
      },
      select: expect.any(Object),
    })
  })

  it("persists a written note as its own immutable authored source", async () => {
    mocks.tx.source.update.mockResolvedValue(
      sourceRecord({ displayName: "Hash map summary", origin: "AUTHORED" }),
    )
    const result = await addAuthoredNoteSource(
      {
        userId: "user-a",
        goalSkillId: "goal-skill-a",
        title: "  Hash map summary  ",
        text: " Keys are mapped to buckets.\r\nCollisions need a strategy. ",
      },
      { now },
    )

    expect(result).toMatchObject({
      displayName: "Hash map summary",
      kind: "TEXT",
      locator: "Written note",
    })
    expect(mocks.tx.source.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "TEXT",
        origin: "AUTHORED",
        displayName: "Hash map summary",
        canonicalKey: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
      select: expect.any(Object),
    })
    expect(mocks.tx.sourceVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        extractedText: "Keys are mapped to buckets.\nCollisions need a strategy.",
        extractorVersion: "authored-note-v1",
      }),
      select: { id: true, sourceId: true },
    })
  })

  it("extracts and persists a bounded PDF without storing an arbitrary path", async () => {
    mocks.tx.source.update.mockResolvedValue(
      sourceRecord({ displayName: "hashmaps.pdf", type: "PDF", origin: "UPLOAD" }),
    )
    const file = new File(["%PDF-1.7\nfixture"], "hashmaps.pdf", {
      type: "application/pdf",
    })
    const textExtractor = vi.fn(async () => "Page 1\nHash maps use buckets.")

    const result = await addPdfSource(
      { userId: "user-a", goalSkillId: "goal-skill-a", file },
      { now, textExtractor },
    )

    expect(textExtractor).toHaveBeenCalledWith(expect.any(Uint8Array), {
      maxTextBytes: 512 * 1024,
    })
    expect(result).toMatchObject({
      displayName: "hashmaps.pdf",
      kind: "PDF",
      locator: "PDF",
    })
    expect(mocks.tx.source.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "PDF",
        origin: "UPLOAD",
        displayName: "hashmaps.pdf",
        displayUrl: null,
        canonicalKey: digest("%PDF-1.7\nfixture"),
      }),
      select: expect.any(Object),
    })
    expect(mocks.tx.sourceVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mimeType: "application/pdf",
        extractedText: "Page 1\nHash maps use buckets.",
        extractorVersion: "pdfjs-text-v1",
      }),
      select: { id: true, sourceId: true },
    })
  })

  it("checks PDF ownership before reading or extracting uploaded bytes", async () => {
    mocks.tx.goalSkill.findFirst.mockResolvedValue(null)
    const file = new File(["%PDF-1.7\nfixture"], "private.pdf", {
      type: "application/pdf",
    })
    const arrayBuffer = vi.spyOn(file, "arrayBuffer")
    const textExtractor = vi.fn(async () => "Private text")

    await expect(
      addPdfSource(
        { userId: "user-a", goalSkillId: "owned-by-user-b", file },
        { textExtractor },
      ),
    ).rejects.toBeInstanceOf(LearningSetupNotFoundError)

    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(textExtractor).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("rejects PDF metadata mismatches before extraction or persistence", async () => {
    const file = new File(["%PDF-1.7\nfixture"], "hashmaps.txt", {
      type: "text/plain",
    })
    const textExtractor = vi.fn(async () => "Never read")

    await expect(
      addPdfSource(
        { userId: "user-a", goalSkillId: "goal-skill-a", file },
        { textExtractor },
      ),
    ).rejects.toMatchObject({ code: "INVALID_PDF" })

    expect(textExtractor).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("reuses identical source content without mutating or duplicating its version", async () => {
    mocks.tx.source.findUnique.mockResolvedValue(
      sourceRecord({
        currentVersionId: "version-a",
        canonicalKey: digest("Hash maps store key/value pairs."),
      }),
    )
    mocks.tx.sourceVersion.findUnique.mockResolvedValue({
      id: "version-a",
      sourceId: "source-a",
    })
    mocks.tx.skillSourceAssignment.findUnique.mockResolvedValue(assignmentRecord())

    const result = await addPastedTextSource({
      userId: "user-a",
      goalSkillId: "goal-skill-a",
      text: "Hash maps store key/value pairs.",
      displayName: "My notes",
    })

    expect(result.deduplicated).toBe(true)
    expect(mocks.tx.sourceVersion.aggregate).not.toHaveBeenCalled()
    expect(mocks.tx.sourceVersion.create).not.toHaveBeenCalled()
    expect(mocks.tx.source.update).not.toHaveBeenCalled()
    expect(mocks.tx.skillSourceAssignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-a" },
      data: { sourceVersionId: "version-a", status: "INCLUDED" },
      select: expect.any(Object),
    })
  })

  it("creates a new immutable revision when a known website changes", async () => {
    mocks.tx.source.findUnique.mockResolvedValue(
      sourceRecord({
        type: "URL",
        canonicalKey: digest("https://example.com/hashmaps?tracking=removed"),
        currentVersionId: "version-old",
        displayName: "Hash map guide",
        displayUrl: "https://example.com/hashmaps",
      }),
    )
    mocks.tx.sourceVersion.aggregate.mockResolvedValue({ _max: { revision: 1 } })
    mocks.tx.sourceVersion.create.mockResolvedValue({
      id: "version-new",
      sourceId: "source-a",
    })
    mocks.tx.source.update.mockResolvedValue(
      sourceRecord({
        type: "URL",
        canonicalKey: digest("https://example.com/hashmaps?tracking=removed"),
        currentVersionId: "version-new",
        displayName: "Hash map guide",
        displayUrl: "https://example.com/hashmaps",
      }),
    )
    const snapshotFetcher = vi.fn(async () => websiteSnapshot())

    const result = await addWebsiteSource(
      {
        userId: "user-a",
        goalSkillId: "goal-skill-a",
        url: "https://example.com/hashmaps?tracking=removed",
      },
      { snapshotFetcher },
    )

    expect(snapshotFetcher).toHaveBeenCalledWith(
      "https://example.com/hashmaps?tracking=removed",
    )
    expect(result).toMatchObject({
      versionId: "version-new",
      sourceStatus: "READY",
      kind: "URL",
      locator: "https://example.com/hashmaps",
      deduplicated: false,
    })
    expect(mocks.tx.sourceVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceId: "source-a",
        revision: 2,
        extractedText: "A changed guide to hash maps.",
        extractorVersion: "safe-url-text-v1",
      }),
      select: { id: true, sourceId: true },
    })
    expect(mocks.tx.source.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentVersionId: "version-new" }),
      }),
    )
  })

  it("rejects a cross-owner website before DNS or fetch side effects", async () => {
    mocks.tx.goalSkill.findFirst.mockResolvedValue(null)
    const snapshotFetcher = vi.fn(async () => websiteSnapshot())

    await expect(
      addWebsiteSource(
        {
          userId: "user-a",
          goalSkillId: "owned-by-user-b",
          url: "https://example.com/guide",
        },
        { snapshotFetcher },
      ),
    ).rejects.toBeInstanceOf(LearningSetupNotFoundError)

    expect(snapshotFetcher).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("rejects empty or oversized normalized source text before persistence", async () => {
    await expect(
      addPastedTextSource({
        userId: "user-a",
        goalSkillId: "goal-skill-a",
        text: " \r\n ",
      }),
    ).rejects.toBeInstanceOf(SourceServiceError)

    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("returns an owner-scoped setup DTO and hides another user's skill", async () => {
    const createdAt = new Date("2026-09-04T15:01:00.000Z")
    mocks.tx.goalSkill.findFirst.mockResolvedValueOnce({
      id: "goal-skill-a",
      skillNode: { title: "Hashmaps" },
      sourceAssignments: [
        {
          createdAt,
          userId: "user-a",
          sourceId: "source-a",
          sourceVersionId: "version-a",
          source: {
            id: "source-a",
            userId: "user-a",
            type: "TEXT",
            origin: "PASTED",
            status: "READY",
            displayName: "My notes",
            displayUrl: null,
          },
          sourceVersion: {
            id: "version-a",
            sourceId: "source-a",
          },
        },
      ],
    })

    await expect(
      getSkillSourceSetup({ userId: "user-a", goalSkillId: "goal-skill-a" }),
    ).resolves.toEqual({
      goalSkillId: "goal-skill-a",
      skillTitle: "Hashmaps",
      sources: [
        {
          sourceId: "source-a",
          versionId: "version-a",
          displayName: "My notes",
          kind: "TEXT",
          status: "READY",
          locator: "Pasted text",
          createdAt,
        },
      ],
    })

    mocks.tx.goalSkill.findFirst.mockResolvedValueOnce(null)
    await expect(
      getSkillSourceSetup({ userId: "user-a", goalSkillId: "owned-by-user-b" }),
    ).resolves.toBeNull()
  })
})

function ownedGoalSkill() {
  return {
    id: "goal-skill-a",
    userId: "user-a",
    skillNodeId: "skill-a",
    goal: { userId: "user-a" },
    skillNode: {
      kind: "SKILL",
      graph: { userId: "user-a" },
    },
  }
}

function sourceRecord(
  overrides: Partial<{
    currentVersionId: string | null
    type: string
    canonicalKey: string
    displayName: string
    displayUrl: string | null
    origin: string
    status: string
    archivedAt: Date | null
  }> = {},
) {
  return {
    id: "source-a",
    userId: "user-a",
    type: overrides.type ?? "TEXT",
    origin: overrides.origin ?? "PASTED",
    canonicalKey: overrides.canonicalKey ?? "a".repeat(64),
    status: overrides.status ?? "READY",
    archivedAt: overrides.archivedAt ?? null,
    currentVersionId: overrides.currentVersionId ?? null,
    displayName: overrides.displayName ?? "My notes",
    displayUrl: overrides.displayUrl ?? null,
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function assignmentRecord() {
  return {
    id: "assignment-a",
    userId: "user-a",
    goalSkillId: "goal-skill-a",
    sourceId: "source-a",
  }
}

function websiteSnapshot(): SafeUrlSnapshot {
  const bytes = new TextEncoder().encode("<p>A changed guide to hash maps.</p>")
  return {
    finalUrl: "https://example.com/hashmaps?tracking=removed",
    displayUrl: "https://example.com/hashmaps",
    displayName: "Hash map guide",
    mimeType: "text/html",
    bytes,
    extractedText: "A changed guide to hash maps.",
    byteSize: bytes.byteLength,
    sha256: "b".repeat(64),
    retrievedAt: now,
    extractorVersion: "safe-url-text-v1",
  }
}

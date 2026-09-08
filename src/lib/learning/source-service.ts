import { createHash } from "node:crypto"

import { Prisma } from "@prisma/client"
import { z } from "zod"

import {
  extractPdfText,
  MAX_PDF_UPLOAD_BYTES,
  PdfTextExtractionError,
} from "@/lib/learning/pdf-text-extractor"
import {
  LearningSetupInvariantError,
  LearningSetupNotFoundError,
} from "@/lib/learning/setup-service"
import {
  fetchPublicTextSnapshot,
  SafeUrlSnapshotError,
  type SafeUrlSnapshot,
} from "@/lib/learning/safe-url-snapshot"
import { prisma } from "@/lib/prisma"

export const MAX_SOURCE_TEXT_BYTES = 512 * 1024

const ownerIdSchema = z.string().trim().min(1).max(128)
const displayNameSchema = z.string().trim().max(200).optional()

const pastedTextInputSchema = z.object({
  userId: ownerIdSchema,
  goalSkillId: ownerIdSchema,
  text: z
    .string()
    .max(500_000, "Pasted text must be 500,000 characters or fewer."),
  displayName: displayNameSchema,
})

const websiteInputSchema = z.object({
  userId: ownerIdSchema,
  goalSkillId: ownerIdSchema,
  url: z.string().trim().min(1, "Website URL is required.").max(2_048),
})

const authoredNoteInputSchema = z.object({
  userId: ownerIdSchema,
  goalSkillId: ownerIdSchema,
  title: z.string().trim().min(1, "Give your note a name.").max(200),
  text: z
    .string()
    .max(500_000, "Notes must be 500,000 characters or fewer."),
})

const pdfInputSchema = z.object({
  userId: ownerIdSchema,
  goalSkillId: ownerIdSchema,
  file: z.instanceof(File),
})

const readInputSchema = z.object({
  userId: ownerIdSchema,
  goalSkillId: ownerIdSchema,
})

type PastedTextInput = z.input<typeof pastedTextInputSchema>
type WebsiteInput = z.input<typeof websiteInputSchema>
type AuthoredNoteInput = z.input<typeof authoredNoteInputSchema>
type PdfInput = z.input<typeof pdfInputSchema>
type SourceReadInput = z.input<typeof readInputSchema>
type LearningTransaction = Prisma.TransactionClient

type PreparedSource = {
  type: "TEXT" | "URL" | "PDF"
  origin: "PASTED" | "AUTHORED" | "WEBSITE" | "UPLOAD"
  canonicalKey: string
  displayName: string
  displayUrl: string | null
  mimeType: "text/plain" | "text/html" | "application/pdf"
  byteSize: number
  sha256: string
  extractedText: string
  retrievedAt: Date
  extractorVersion: string
}

export type SourceAssignmentResult = {
  goalSkillId: string
  skillNodeId: string
  sourceId: string
  versionId: string
  assignmentId: string
  sourceStatus: "READY"
  displayName: string
  kind: "TEXT" | "URL" | "PDF"
  locator: string
  deduplicated: boolean
}

export type SkillSourceSetup = {
  goalSkillId: string
  skillTitle: string
  sources: Array<{
    sourceId: string
    versionId: string
    displayName: string
    kind: string
    status: string
    locator: string
    createdAt: Date
  }>
}

export class SourceServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly publicMessage: string,
    options?: ErrorOptions,
  ) {
    super(publicMessage, options)
    this.name = "SourceServiceError"
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function normalizeSourceText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
}

function normalizedDisplayName(value: string | undefined, fallback: string): string {
  const normalized = value
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return (normalized || fallback).slice(0, 200)
}

function sourceLocator(
  type: string,
  origin: string,
  displayUrl: string | null,
): string {
  if (type === "URL" && displayUrl) return displayUrl
  if (type === "PDF") return "PDF"
  if (origin === "AUTHORED") return "Written note"
  return "Pasted text"
}

function prepareStoredText(
  extractedText: string,
  metadata: Omit<PreparedSource, "byteSize" | "sha256" | "extractedText">,
): PreparedSource {
  const normalized = normalizeSourceText(extractedText)
  const byteSize = Buffer.byteLength(normalized, "utf8")
  if (byteSize === 0) {
    throw new SourceServiceError("EMPTY_SOURCE", "Add source text before continuing.")
  }
  if (byteSize > MAX_SOURCE_TEXT_BYTES) {
    throw new SourceServiceError(
      "SOURCE_TOO_LARGE",
      "Source text must be 512 KB or smaller.",
    )
  }

  return {
    ...metadata,
    byteSize,
    sha256: sha256(normalized),
    extractedText: normalized,
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  )
}

function ownedGoalSkillWhere(userId: string, goalSkillId: string) {
  return {
    id: goalSkillId,
    userId,
    lifecycle: { not: "ARCHIVED" },
    goal: { userId },
    skillNode: { graph: { userId }, kind: "SKILL" },
  } as const
}

async function assertOwnedGoalSkill(userId: string, goalSkillId: string): Promise<void> {
  const goalSkill = await prisma.goalSkill.findFirst({
    where: ownedGoalSkillWhere(userId, goalSkillId),
    select: { id: true },
  })
  if (!goalSkill) throw new LearningSetupNotFoundError()
}

async function persistSourceAssignmentInTransaction(
  tx: LearningTransaction,
  input: { userId: string; goalSkillId: string },
  prepared: PreparedSource,
): Promise<SourceAssignmentResult> {
  const goalSkill = await tx.goalSkill.findFirst({
    where: ownedGoalSkillWhere(input.userId, input.goalSkillId),
    select: {
      id: true,
      userId: true,
      skillNodeId: true,
      goal: { select: { userId: true } },
      skillNode: {
        select: {
          kind: true,
          graph: { select: { userId: true } },
        },
      },
    },
  })
  if (!goalSkill) throw new LearningSetupNotFoundError()
  if (
    goalSkill.userId !== input.userId ||
    goalSkill.goal.userId !== input.userId ||
    goalSkill.skillNode.graph.userId !== input.userId ||
    goalSkill.skillNode.kind !== "SKILL"
  ) {
    throw new LearningSetupInvariantError("The skill source owner chain is invalid.")
  }

  let source = await tx.source.findUnique({
    where: {
      userId_type_canonicalKey: {
        userId: input.userId,
        type: prepared.type,
        canonicalKey: prepared.canonicalKey,
      },
    },
    select: {
      id: true,
      userId: true,
      type: true,
      canonicalKey: true,
      status: true,
      archivedAt: true,
      currentVersionId: true,
      displayName: true,
      displayUrl: true,
    },
  })

  if (!source) {
    source = await tx.source.create({
      data: {
        userId: input.userId,
        type: prepared.type,
        origin: prepared.origin,
        status: "READY",
        canonicalKey: prepared.canonicalKey,
        displayName: prepared.displayName,
        displayUrl: prepared.displayUrl,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        canonicalKey: true,
        status: true,
        archivedAt: true,
        currentVersionId: true,
        displayName: true,
        displayUrl: true,
      },
    })
  }

  if (
    source.userId !== input.userId ||
    source.type !== prepared.type ||
    source.canonicalKey !== prepared.canonicalKey
  ) {
    throw new LearningSetupInvariantError("The reusable source owner chain is invalid.")
  }

  let version = await tx.sourceVersion.findUnique({
    where: {
      sourceId_sha256: {
        sourceId: source.id,
        sha256: prepared.sha256,
      },
    },
    select: { id: true, sourceId: true },
  })
  const deduplicated = version !== null

  if (!version) {
    const latest = await tx.sourceVersion.aggregate({
      where: { sourceId: source.id },
      _max: { revision: true },
    })
    version = await tx.sourceVersion.create({
      data: {
        sourceId: source.id,
        revision: (latest._max.revision ?? 0) + 1,
        mimeType: prepared.mimeType,
        byteSize: prepared.byteSize,
        sha256: prepared.sha256,
        extractedText: prepared.extractedText,
        retrievedAt: prepared.retrievedAt,
        extractorVersion: prepared.extractorVersion,
      },
      select: { id: true, sourceId: true },
    })
  }

  if (version.sourceId !== source.id) {
    throw new LearningSetupInvariantError("The source version belongs to another source.")
  }

  if (
    source.currentVersionId !== version.id ||
    source.status !== "READY" ||
    source.archivedAt !== null
  ) {
    source = await tx.source.update({
      where: { id: source.id },
      data: {
        currentVersionId: version.id,
        status: "READY",
        archivedAt: null,
        displayName: prepared.displayName,
        displayUrl: prepared.displayUrl,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        canonicalKey: true,
        status: true,
        archivedAt: true,
        currentVersionId: true,
        displayName: true,
        displayUrl: true,
      },
    })
  }

  let assignment = await tx.skillSourceAssignment.findUnique({
    where: {
      goalSkillId_sourceId: {
        goalSkillId: goalSkill.id,
        sourceId: source.id,
      },
    },
    select: {
      id: true,
      userId: true,
      goalSkillId: true,
      sourceId: true,
    },
  })

  if (assignment) {
    if (
      assignment.userId !== input.userId ||
      assignment.goalSkillId !== goalSkill.id ||
      assignment.sourceId !== source.id
    ) {
      throw new LearningSetupInvariantError("The source assignment owner chain is invalid.")
    }
    assignment = await tx.skillSourceAssignment.update({
      where: { id: assignment.id },
      data: {
        sourceVersionId: version.id,
        status: "INCLUDED",
      },
      select: {
        id: true,
        userId: true,
        goalSkillId: true,
        sourceId: true,
      },
    })
  } else {
    const sortOrder = await tx.skillSourceAssignment.count({
      where: { goalSkillId: goalSkill.id, status: "INCLUDED" },
    })
    assignment = await tx.skillSourceAssignment.create({
      data: {
        userId: input.userId,
        goalSkillId: goalSkill.id,
        sourceId: source.id,
        sourceVersionId: version.id,
        status: "INCLUDED",
        sortOrder,
      },
      select: {
        id: true,
        userId: true,
        goalSkillId: true,
        sourceId: true,
      },
    })
  }

  return {
    goalSkillId: goalSkill.id,
    skillNodeId: goalSkill.skillNodeId,
    sourceId: source.id,
    versionId: version.id,
    assignmentId: assignment.id,
    sourceStatus: "READY",
    displayName: source.displayName,
    kind: prepared.type,
    locator: sourceLocator(prepared.type, prepared.origin, source.displayUrl),
    deduplicated,
  }
}

async function persistSourceAssignment(
  input: { userId: string; goalSkillId: string },
  prepared: PreparedSource,
): Promise<SourceAssignmentResult> {
  try {
    return await prisma.$transaction((tx) =>
      persistSourceAssignmentInTransaction(tx, input, prepared),
    )
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      // A repeat submission or second tab observes and reuses the winning
      // immutable source/version on one bounded retry.
      return prisma.$transaction((tx) =>
        persistSourceAssignmentInTransaction(tx, input, prepared),
      )
    }
    throw error
  }
}

export async function addPastedTextSource(
  input: PastedTextInput,
  options: { now?: Date } = {},
): Promise<SourceAssignmentResult> {
  const parsed = pastedTextInputSchema.parse(input)
  const prepared = prepareStoredText(parsed.text, {
    type: "TEXT",
    origin: "PASTED",
    canonicalKey: sha256(normalizeSourceText(parsed.text)),
    displayName: normalizedDisplayName(parsed.displayName, "Pasted text"),
    displayUrl: null,
    mimeType: "text/plain",
    retrievedAt: options.now ?? new Date(),
    extractorVersion: "pasted-text-v1",
  })

  return persistSourceAssignment(
    { userId: parsed.userId, goalSkillId: parsed.goalSkillId },
    prepared,
  )
}

export async function addAuthoredNoteSource(
  input: AuthoredNoteInput,
  options: { now?: Date } = {},
): Promise<SourceAssignmentResult> {
  const parsed = authoredNoteInputSchema.parse(input)
  const normalizedText = normalizeSourceText(parsed.text)
  const prepared = prepareStoredText(normalizedText, {
    type: "TEXT",
    origin: "AUTHORED",
    canonicalKey: sha256(`authored-note\u0000${parsed.title}\u0000${normalizedText}`),
    displayName: normalizedDisplayName(parsed.title, "Note"),
    displayUrl: null,
    mimeType: "text/plain",
    retrievedAt: options.now ?? new Date(),
    extractorVersion: "authored-note-v1",
  })

  return persistSourceAssignment(
    { userId: parsed.userId, goalSkillId: parsed.goalSkillId },
    prepared,
  )
}

type PdfTextExtractor = (
  bytes: Uint8Array,
  options: { maxTextBytes: number },
) => Promise<string>

export async function addPdfSource(
  input: PdfInput,
  options: { now?: Date; textExtractor?: PdfTextExtractor } = {},
): Promise<SourceAssignmentResult> {
  const parsed = pdfInputSchema.parse(input)

  // Confirm ownership before reading or parsing attacker-controlled bytes.
  await assertOwnedGoalSkill(parsed.userId, parsed.goalSkillId)

  if (!Number.isSafeInteger(parsed.file.size) || parsed.file.size <= 0) {
    throw new SourceServiceError("EMPTY_PDF", "Choose a non-empty PDF.")
  }
  if (parsed.file.size > MAX_PDF_UPLOAD_BYTES) {
    throw new SourceServiceError("PDF_TOO_LARGE", "PDFs must be 6 MB or smaller.")
  }
  if (
    parsed.file.type !== "application/pdf" ||
    !parsed.file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new SourceServiceError("INVALID_PDF", "Choose a PDF file.")
  }

  const bytes = new Uint8Array(await parsed.file.arrayBuffer())
  if (bytes.byteLength !== parsed.file.size) {
    throw new SourceServiceError("INVALID_PDF", "That PDF could not be read.")
  }
  // PDF.js may transfer ownership of its input buffer to a worker. Hash the
  // original bytes first so source identity never depends on a detached view.
  const canonicalKey = createHash("sha256").update(bytes).digest("hex")

  let extractedText: string
  try {
    extractedText = await (options.textExtractor ?? extractPdfText)(bytes, {
      maxTextBytes: MAX_SOURCE_TEXT_BYTES,
    })
  } catch (error) {
    if (error instanceof PdfTextExtractionError) {
      throw new SourceServiceError(error.code, error.publicMessage, { cause: error })
    }
    throw error
  }

  const prepared = prepareStoredText(extractedText, {
    type: "PDF",
    origin: "UPLOAD",
    canonicalKey,
    displayName: normalizedDisplayName(parsed.file.name, "PDF"),
    displayUrl: null,
    mimeType: "application/pdf",
    retrievedAt: options.now ?? new Date(),
    extractorVersion: "pdfjs-text-v1",
  })

  return persistSourceAssignment(
    { userId: parsed.userId, goalSkillId: parsed.goalSkillId },
    prepared,
  )
}

type WebsiteSnapshotFetcher = (url: string) => Promise<SafeUrlSnapshot>

export async function addWebsiteSource(
  input: WebsiteInput,
  options: { snapshotFetcher?: WebsiteSnapshotFetcher } = {},
): Promise<SourceAssignmentResult> {
  const parsed = websiteInputSchema.parse(input)

  // Authorization happens before DNS or network access. Persistence repeats
  // the complete owner check inside its transaction to close the TOCTOU gap.
  await assertOwnedGoalSkill(parsed.userId, parsed.goalSkillId)

  let snapshot: SafeUrlSnapshot
  try {
    snapshot = await (options.snapshotFetcher ?? ((url) =>
      fetchPublicTextSnapshot(url, {
        maxCompressedBytes: MAX_SOURCE_TEXT_BYTES,
        maxDecompressedBytes: MAX_SOURCE_TEXT_BYTES,
      })))(parsed.url)
  } catch (error) {
    if (error instanceof SafeUrlSnapshotError) {
      throw new SourceServiceError(error.code, error.message, { cause: error })
    }
    throw error
  }

  const prepared = prepareStoredText(snapshot.extractedText, {
    type: "URL",
    origin: "WEBSITE",
    canonicalKey: sha256(snapshot.finalUrl),
    displayName: normalizedDisplayName(snapshot.displayName, "Website"),
    displayUrl: snapshot.displayUrl,
    mimeType: snapshot.mimeType,
    retrievedAt: snapshot.retrievedAt,
    extractorVersion: snapshot.extractorVersion,
  })

  return persistSourceAssignment(
    { userId: parsed.userId, goalSkillId: parsed.goalSkillId },
    prepared,
  )
}

export async function getSkillSourceSetup(
  input: SourceReadInput,
): Promise<SkillSourceSetup | null> {
  const parsed = readInputSchema.parse(input)
  const goalSkill = await prisma.goalSkill.findFirst({
    where: ownedGoalSkillWhere(parsed.userId, parsed.goalSkillId),
    select: {
      id: true,
      skillNode: { select: { title: true } },
      sourceAssignments: {
        where: { userId: parsed.userId, status: "INCLUDED" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          createdAt: true,
          userId: true,
          sourceId: true,
          sourceVersionId: true,
          source: {
            select: {
              id: true,
              userId: true,
              type: true,
              origin: true,
              status: true,
              displayName: true,
              displayUrl: true,
            },
          },
          sourceVersion: {
            select: { id: true, sourceId: true },
          },
        },
      },
    },
  })

  if (!goalSkill) return null

  const sources = goalSkill.sourceAssignments.map((assignment) => {
    if (
      assignment.userId !== parsed.userId ||
      assignment.source.userId !== parsed.userId ||
      assignment.source.id !== assignment.sourceId ||
      assignment.sourceVersion.id !== assignment.sourceVersionId ||
      assignment.sourceVersion.sourceId !== assignment.sourceId
    ) {
      throw new LearningSetupInvariantError("The source read owner chain is invalid.")
    }

    return {
      sourceId: assignment.sourceId,
      versionId: assignment.sourceVersionId,
      displayName: assignment.source.displayName,
      kind: assignment.source.type,
      status: assignment.source.status,
      locator: sourceLocator(
        assignment.source.type,
        assignment.source.origin,
        assignment.source.displayUrl,
      ),
      createdAt: assignment.createdAt,
    }
  })

  return {
    goalSkillId: goalSkill.id,
    skillTitle: goalSkill.skillNode.title,
    sources,
  }
}

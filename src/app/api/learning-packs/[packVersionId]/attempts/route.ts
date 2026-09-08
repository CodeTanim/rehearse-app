import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import {
  InitialQuizServiceError,
  saveInitialQuizAttempt,
} from "@/lib/learning/initial-quiz-service"

const MAX_ATTEMPT_BODY_BYTES = 100_000

export async function POST(
  request: Request,
  { params }: { params: Promise<{ packVersionId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 })
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(contentLength) || contentLength > MAX_ATTEMPT_BODY_BYTES) {
    return NextResponse.json({ error: "Quiz response is too large." }, { status: 413 })
  }

  let body: unknown
  try {
    const text = await request.text()
    if (Buffer.byteLength(text, "utf8") > MAX_ATTEMPT_BODY_BYTES) {
      return NextResponse.json({ error: "Quiz response is too large." }, { status: 413 })
    }
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: "Quiz response is invalid." }, { status: 400 })
  }

  const { packVersionId } = await params
  try {
    const parsed = z.object({ packVersionId: z.string().min(1).max(128) }).parse({ packVersionId })
    if (
      !body ||
      typeof body !== "object" ||
      (body as { packVersionId?: unknown }).packVersionId !== parsed.packVersionId
    ) {
      return NextResponse.json({ error: "Quiz response is invalid." }, { status: 400 })
    }

    const result = await saveInitialQuizAttempt({
      ...(body as Record<string, unknown>),
      userId: session.user.id,
    } as Parameters<typeof saveInitialQuizAttempt>[0])
    return NextResponse.json({
      attemptId: result.attemptId,
      ...(result.nextGapId ? { nextGapId: result.nextGapId } : {}),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Quiz response is invalid." }, { status: 400 })
    }
    if (error instanceof InitialQuizServiceError) {
      return NextResponse.json({ error: error.publicMessage }, { status: error.status })
    }
    console.error(
      "Initial quiz save failed.",
      error instanceof Error ? error.name : "UnknownError",
    )
    return NextResponse.json({ error: "Quiz could not be saved." }, { status: 500 })
  }
}

import { NextResponse } from "next/server"

import { PracticeServiceError } from "@/lib/learning/practice-service"

export function practiceErrorResponse(error: unknown) {
  if (error instanceof PracticeServiceError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.checkpoint ? { checkpoint: error.checkpoint } : {}),
      },
      { status: error.status },
    )
  }

  console.error("Practice request failed", error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

export async function readJson(request: Request) {
  try {
    return { ok: true as const, body: (await request.json()) as unknown }
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      ),
    }
  }
}

export function validationError(issues: unknown) {
  return NextResponse.json(
    { error: "Check the request and try again.", code: "INVALID_REQUEST", issues },
    { status: 400 },
  )
}

import { NextRequest, NextResponse } from "next/server"

import {
  practiceErrorResponse,
  readJson,
  validationError,
} from "@/app/api/practice/items/_response"
import { auth } from "@/lib/auth"
import { practiceService } from "@/lib/learning/practice-service"
import { revealSchema } from "@/lib/learning/validation"

type RouteContext = { params: Promise<{ itemId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsedBody = await readJson(request)
  if (!parsedBody.ok) return parsedBody.response

  const validated = revealSchema.safeParse(parsedBody.body)
  if (!validated.success) return validationError(validated.error.issues)

  const rawAnswer = (parsedBody.body as { answer: string }).answer
  if (rawAnswer.length > 10_000) {
    return validationError([
      { path: ["answer"], message: "Answer must be 10,000 characters or fewer." },
    ])
  }

  try {
    const { itemId } = await params
    const result = await practiceService.reveal({
      userId: session.user.id,
      itemId,
      // Zod validates a trimmed view, but the immutable pre-reveal answer must
      // preserve exactly what the learner submitted.
      answer: rawAnswer,
      expectedVersion: validated.data.expectedVersion,
    })
    return NextResponse.json(result)
  } catch (error) {
    return practiceErrorResponse(error)
  }
}

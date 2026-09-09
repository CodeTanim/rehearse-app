import { NextRequest, NextResponse } from "next/server"

import {
  practiceErrorResponse,
  readJson,
  validationError,
} from "@/app/api/practice/items/_response"
import { auth } from "@/lib/auth"
import { practiceService } from "@/lib/learning/practice-service"
import { gradeSchema } from "@/lib/learning/validation"

type RouteContext = { params: Promise<{ itemId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsedBody = await readJson(request)
  if (!parsedBody.ok) return parsedBody.response

  const validated = gradeSchema.safeParse(parsedBody.body)
  if (!validated.success) return validationError(validated.error.issues)

  try {
    const { itemId } = await params
    const summary = await practiceService.grade({
      userId: session.user.id,
      itemId,
      rating: validated.data.rating,
      ...(validated.data.assessment ? { assessment: validated.data.assessment } : {}),
      idempotencyKey: validated.data.idempotencyKey,
      expectedVersion: validated.data.expectedVersion,
    })
    return NextResponse.json({ summary })
  } catch (error) {
    return practiceErrorResponse(error)
  }
}

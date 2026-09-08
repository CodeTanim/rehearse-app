import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { checkpointSchema } from "@/lib/learning/validation"
import { practiceService } from "@/lib/learning/practice-service"
import {
  practiceErrorResponse,
  readJson,
  validationError,
} from "@/app/api/practice/items/_response"

type RouteContext = { params: Promise<{ itemId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsedBody = await readJson(request)
  if (!parsedBody.ok) return parsedBody.response

  const validated = checkpointSchema.safeParse(parsedBody.body)
  if (!validated.success) return validationError(validated.error.issues)

  try {
    const { itemId } = await params
    const checkpoint = await practiceService.saveCheckpoint({
      userId: session.user.id,
      itemId,
      answer: validated.data.answer,
      expectedVersion: validated.data.expectedVersion,
    })
    return NextResponse.json({ checkpoint })
  } catch (error) {
    return practiceErrorResponse(error)
  }
}

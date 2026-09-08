import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { QuizDraftError, saveQuizDraft } from "@/lib/learning/initial-quiz-draft-service"
import { quizDraftStateSchema } from "@/lib/learning/initial-quiz-draft"

const schema = z.object({ version: z.number().int().nonnegative(), state: quizDraftStateSchema }).strict()

export async function POST(request: Request, { params }: { params: Promise<{ packVersionId: string }> }) {
  const session = await auth()
  const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
  if (!session?.user?.id) return respond({ error: "Sign in again to save your quiz." }, 401)
  try {
    if (Number(request.headers.get("content-length")) > 100_000) return respond({ error: "Quiz draft is too large." }, 413)
    const text = await request.text()
    if (Buffer.byteLength(text) > 100_000) return respond({ error: "Quiz draft is too large." }, 413)
    const parsed = schema.parse(JSON.parse(text))
    const { packVersionId } = await params
    return respond(await saveQuizDraft(session.user.id, packVersionId, parsed.version, parsed.state))
  } catch (error) {
    if (error instanceof QuizDraftError) return respond({ error: error.message }, error.status)
    if (error instanceof z.ZodError || error instanceof SyntaxError) return respond({ error: "Quiz draft is invalid." }, 400)
    return respond({ error: "Your latest changes could not be saved. Try again." }, 500)
  }
}

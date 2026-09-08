import { notFound, redirect } from "next/navigation"
import { AppShell } from "@/components/app/app-shell"
import { PracticeCard, type PracticeSummary } from "@/components/learning/practice-card"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Recall" }
export const dynamic = "force-dynamic"

function parseSummary(value: string | null): PracticeSummary | undefined {
  if (!value) return undefined

  try {
    const candidate = JSON.parse(value) as Partial<PracticeSummary>
    if (
      typeof candidate.skillTitle === "string" &&
      typeof candidate.stageBefore === "string" &&
      typeof candidate.stageAfter === "string" &&
      typeof candidate.confidence === "string" &&
      typeof candidate.nextReviewAt === "string" &&
      typeof candidate.reason === "string"
    ) {
      return candidate as PracticeSummary
    }
  } catch {
    return undefined
  }

  return undefined
}

export default async function PracticePage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const { sessionId } = await params
  const practiceSession = await prisma.practiceSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
    select: {
      status: true,
      goalSkill: { select: { skillNode: { select: { title: true } } } },
      items: {
        orderBy: { ordinal: "asc" },
        select: {
          id: true,
          ordinal: true,
          status: true,
          resultJson: true,
          question: {
            select: {
              generatedSpec: {
                select: {
                  role: true,
                  responseType: true,
                  choicesJson: true,
                  correctChoiceIndex: true,
                },
              },
            },
          },
          questionRevision: {
            select: { prompt: true, referenceAnswer: true, explanation: true },
          },
          responseCheckpoint: {
            select: {
              phase: true,
              draftAnswer: true,
              lockedAnswer: true,
              version: true,
            },
          },
        },
      },
    },
  })

  const item =
    practiceSession?.items.find((candidate) => candidate.status === "PRESENTED") ??
    practiceSession?.items.at(-1)
  if (!practiceSession || !item) notFound()

  const checkpoint = item.responseCheckpoint
  const completedSummary = parseSummary(item.resultJson)
  const hasRevealed = checkpoint?.phase === "REVEALED" || checkpoint?.phase === "SAVING"
  const phase = completedSummary || practiceSession.status === "COMPLETED"
    ? "COMPLETED"
    : ((checkpoint?.phase ?? "PROMPT") as "PROMPT" | "DRAFTING" | "REVEALED" | "SAVING")

  const generatedSpec = item.question.generatedSpec
  let choices: string[] = []
  if (generatedSpec?.responseType === "MULTIPLE_CHOICE") {
    try {
      const parsed: unknown = JSON.parse(generatedSpec.choicesJson)
      if (
        Array.isArray(parsed) &&
        parsed.length === 4 &&
        parsed.every((choice) => typeof choice === "string")
      ) {
        choices = parsed
      }
    } catch {
      choices = []
    }
    if (choices.length !== 4 || generatedSpec.correctChoiceIndex === null) notFound()
  }
  const lockedChoice = Number(checkpoint?.lockedAnswer)
  const initialObjectiveCorrect =
    hasRevealed &&
    generatedSpec?.responseType === "MULTIPLE_CHOICE" &&
    Number.isInteger(lockedChoice) &&
    generatedSpec.correctChoiceIndex !== null
      ? lockedChoice === generatedSpec.correctChoiceIndex
      : undefined
  const responseType =
    generatedSpec?.responseType === "MULTIPLE_CHOICE"
      ? "MULTIPLE_CHOICE"
      : "SHORT_RESPONSE"

  return (
    <AppShell>
      <PracticeCard
        key={item.id}
        sessionId={sessionId}
        itemId={item.id}
        skillTitle={practiceSession.goalSkill?.skillNode.title ?? "Skill review"}
        prompt={item.questionRevision.prompt}
        initialAnswer={checkpoint?.lockedAnswer ?? checkpoint?.draftAnswer ?? ""}
        initialPhase={phase}
        initialVersion={checkpoint?.version ?? 0}
        initialReferenceAnswer={hasRevealed ? item.questionRevision.referenceAnswer : undefined}
        initialExplanation={hasRevealed ? item.questionRevision.explanation : undefined}
        initialSummary={completedSummary}
        responseType={responseType}
        choices={choices}
        isTransfer={generatedSpec?.role === "TRANSFER"}
        questionNumber={item.ordinal + 1}
        totalQuestions={practiceSession.items.length}
        initialObjectiveCorrect={initialObjectiveCorrect}
      />
    </AppShell>
  )
}

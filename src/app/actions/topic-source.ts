"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { auth } from "@/lib/auth"
import {
  LearningSetupConflictError,
  LearningSetupNotFoundError,
} from "@/lib/learning/setup-service"
import {
  addAuthoredNoteSource,
  addPdfSource,
  addPastedTextSource,
  addWebsiteSource,
  SourceServiceError,
} from "@/lib/learning/source-service"
import { createTopic } from "@/lib/learning/topic-service"
import {
  firstValidationError,
  type LearningActionState,
} from "@/lib/learning/validation"

const sourceTypeSchema = z.enum(["URL", "TEXT", "NOTE", "PDF"], {
  error: "Choose a source type.",
})

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function actionError(error: unknown): LearningActionState {
  if (error instanceof z.ZodError) {
    return { error: firstValidationError(error) }
  }
  if (error instanceof LearningSetupNotFoundError) {
    return { error: "That skill is unavailable." }
  }
  if (error instanceof LearningSetupConflictError) {
    return { error: error.publicMessage }
  }
  if (error instanceof SourceServiceError) {
    return { error: error.publicMessage }
  }

  console.error(
    "Topic/source action failed.",
    error instanceof Error ? error.name : "UnknownError",
  )
  return { error: "We couldn't save that. Try again." }
}

async function authenticatedUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

export async function createTopicAction(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const userId = await authenticatedUserId()
  if (!userId) return { error: "Sign in to continue." }

  let goalSkillId: string
  try {
    const result = await createTopic({
      userId,
      title: formString(formData, "title"),
    })
    goalSkillId = result.goalSkillId
  } catch (error) {
    return actionError(error)
  }

  revalidatePath("/today")
  redirect(`/skills/${goalSkillId}/sources`)
}

export async function addSourceAction(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const userId = await authenticatedUserId()
  if (!userId) return { error: "Sign in to continue." }

  const goalSkillId = formString(formData, "goalSkillId")
  try {
    const sourceType = sourceTypeSchema.parse(formString(formData, "sourceType"))
    if (sourceType === "TEXT") {
      await addPastedTextSource({
        userId,
        goalSkillId,
        text: formString(formData, "text"),
        displayName: formString(formData, "displayName"),
      })
    } else if (sourceType === "URL") {
      await addWebsiteSource({
        userId,
        goalSkillId,
        url: formString(formData, "url"),
      })
    } else if (sourceType === "NOTE") {
      await addAuthoredNoteSource({
        userId,
        goalSkillId,
        title: formString(formData, "displayName"),
        text: formString(formData, "text"),
      })
    } else {
      const file = formData.get("file")
      if (!(file instanceof File)) {
        return { error: "Choose a PDF before continuing." }
      }
      await addPdfSource({ userId, goalSkillId, file })
    }
  } catch (error) {
    return actionError(error)
  }

  const sourcePath = `/skills/${goalSkillId}/sources`
  revalidatePath(sourcePath)
  revalidatePath("/today")
  redirect(sourcePath)
}

"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { LearningPackGenerationError } from "@/lib/ai/learning-pack"
import {
  generateAndPersistLearningPack,
  LearningPackServiceError,
} from "@/lib/learning/learning-pack-service"
import { LearningSetupNotFoundError } from "@/lib/learning/setup-service"
import {
  firstValidationError,
  type LearningActionState,
} from "@/lib/learning/validation"

function value(formData: FormData, key: string) {
  const entry = formData.get(key)
  return typeof entry === "string" ? entry : ""
}

export async function generateLearningPackAction(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Sign in to continue." }
  if (value(formData, "aiConsent") !== "on") {
    return { error: "Confirm source use before generating a quiz." }
  }

  const goalSkillId = value(formData, "goalSkillId")
  try {
    await generateAndPersistLearningPack({ userId: session.user.id, goalSkillId })
  } catch (error) {
    if (error instanceof z.ZodError) return { error: firstValidationError(error) }
    if (error instanceof LearningSetupNotFoundError) {
      return { error: "That skill is unavailable." }
    }
    if (error instanceof LearningPackGenerationError) {
      return { error: error.message }
    }
    if (error instanceof LearningPackServiceError) {
      return { error: error.publicMessage }
    }
    console.error(
      "Learning-pack generation failed.",
      error instanceof Error ? error.name : "UnknownError",
    )
    return { error: "The quiz could not be generated. Try again." }
  }

  revalidatePath(`/skills/${goalSkillId}/sources`)
  revalidatePath("/skills")
  redirect(`/skills/${goalSkillId}/quiz`)
}

"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { auth } from "@/lib/auth"
import {
  createActiveLearningGoal,
  createManualQuestionAndStartSession,
  createSkillLeaf,
  LearningSetupConflictError,
  LearningSetupNotFoundError,
  startOrResumePracticeSession,
} from "@/lib/learning/setup-service"
import {
  firstValidationError,
  type LearningActionState,
} from "@/lib/learning/validation"

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function actionError(error: unknown): LearningActionState {
  if (error instanceof z.ZodError) {
    return { error: firstValidationError(error) }
  }
  if (error instanceof LearningSetupNotFoundError) {
    // A missing record and another learner's record intentionally look alike.
    return { error: "That learning item is unavailable." }
  }
  if (error instanceof LearningSetupConflictError) {
    return { error: error.publicMessage }
  }

  console.error(
    "Learning setup action failed.",
    error instanceof Error ? error.name : "UnknownError",
  )
  return { error: "We couldn't save that. Try again." }
}

async function authenticatedUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

export async function createGoalAction(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const userId = await authenticatedUserId()
  if (!userId) return { error: "Sign in to continue." }

  let goalId: string
  try {
    const result = await createActiveLearningGoal({
      userId,
      title: formString(formData, "title"),
      outcome: formString(formData, "outcome"),
    })
    goalId = result.goalId
  } catch (error) {
    return actionError(error)
  }

  revalidatePath("/today")
  redirect(`/goals/${goalId}/setup/skill`)
}

export async function createSkillAction(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const userId = await authenticatedUserId()
  if (!userId) return { error: "Sign in to continue." }

  let goalId: string
  let goalSkillId: string
  try {
    goalId = formString(formData, "goalId")
    const result = await createSkillLeaf({
      userId,
      goalId,
      title: formString(formData, "title"),
      outcome: formString(formData, "outcome"),
      successCriterion: formString(formData, "successCriterion"),
    })
    goalSkillId = result.goalSkillId
  } catch (error) {
    return actionError(error)
  }

  revalidatePath("/today")
  redirect(`/goals/${goalId}/skills/${goalSkillId}/setup/question`)
}

export async function createQuestionAndStartAction(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const userId = await authenticatedUserId()
  if (!userId) return { error: "Sign in to continue." }

  let sessionId: string
  try {
    const result = await createManualQuestionAndStartSession({
      userId,
      goalSkillId: formString(formData, "goalSkillId"),
      prompt: formString(formData, "prompt"),
      referenceAnswer: formString(formData, "referenceAnswer"),
    })
    sessionId = result.sessionId
  } catch (error) {
    return actionError(error)
  }

  revalidatePath("/today")
  redirect(`/practice/${sessionId}`)
}

export async function startReviewAction(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const userId = await authenticatedUserId()
  if (!userId) return { error: "Sign in to continue." }

  let sessionId: string
  try {
    const result = await startOrResumePracticeSession({
      userId,
      goalSkillId: formString(formData, "goalSkillId"),
    })
    sessionId = result.sessionId
  } catch (error) {
    return actionError(error)
  }

  revalidatePath("/today")
  redirect(`/practice/${sessionId}`)
}

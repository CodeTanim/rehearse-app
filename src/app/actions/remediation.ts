"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/lib/auth"
import {
  completeRemediation,
  LearningGapNotFoundError,
  STALE_REMEDIATION_REVISION_CODE,
  StaleRemediationRevisionError,
} from "@/lib/learning/remediation-service"
import { firstValidationError } from "@/lib/learning/validation"

const remediationSchema = z.object({
  goalSkillId: z
    .string()
    .trim()
    .min(1, "That skill is unavailable.")
    .max(128, "That skill is unavailable."),
  gapId: z
    .string()
    .trim()
    .min(1, "That practice is unavailable.")
    .max(128, "That practice is unavailable."),
  remediationRevisionId: z
    .string()
    .trim()
    .min(1, "Reload this practice to continue.")
    .max(128, "Reload this practice to continue."),
  answer: z
    .string()
    .trim()
    .min(1, "Write an answer before finishing.")
    .max(4_000, "Answer must be 4,000 characters or fewer."),
})

export type RemediationActionState = {
  completed?: boolean
  error?: string
  errorCode?: typeof STALE_REMEDIATION_REVISION_CODE
}

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export async function completeRemediationAction(
  _previousState: RemediationActionState,
  formData: FormData,
): Promise<RemediationActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Sign in to continue." }

  const parsed = remediationSchema.safeParse({
    goalSkillId: formString(formData, "goalSkillId"),
    gapId: formString(formData, "gapId"),
    remediationRevisionId: formString(formData, "remediationRevisionId"),
    answer: formString(formData, "answer"),
  })
  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    await completeRemediation({
      userId: session.user.id,
      ...parsed.data,
    })
  } catch (error) {
    if (error instanceof LearningGapNotFoundError) {
      return { error: "That practice is unavailable." }
    }
    if (error instanceof StaleRemediationRevisionError) {
      return {
        error: error.message,
        errorCode: STALE_REMEDIATION_REVISION_CODE,
      }
    }
    console.error(
      "Remediation action failed.",
      error instanceof Error ? error.name : "UnknownError",
    )
    return { error: "We couldn't save that practice. Try again." }
  }

  const path = `/skills/${parsed.data.goalSkillId}/strengthen/${parsed.data.gapId}`
  revalidatePath(path)
  revalidatePath("/today")
  return { completed: true }
}

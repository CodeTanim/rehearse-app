import { z } from "zod"

const requiredText = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maximum, `${label} must be ${maximum} characters or fewer.`)

export const goalSetupSchema = z.object({
  title: requiredText("Goal", 100),
  outcome: requiredText("Outcome", 500),
})

export const skillSetupSchema = z.object({
  title: requiredText("Skill", 120),
  outcome: requiredText("Outcome", 500),
  successCriterion: requiredText("Success check", 500),
})

export const questionSetupSchema = z.object({
  prompt: requiredText("Prompt", 2_000),
  referenceAnswer: requiredText("Reference answer", 10_000),
})

export const checkpointSchema = z.object({
  answer: z.string().max(10_000, "Answer must be 10,000 characters or fewer."),
  expectedVersion: z.number().int().min(0),
})

export const revealSchema = checkpointSchema.extend({
  answer: z
    .string()
    .trim()
    .max(10_000, "Answer must be 10,000 characters or fewer."),
  skipped: z.boolean().optional(),
}).refine((value) => value.skipped ? value.answer === "" : value.answer.length > 0,
  "Write an answer or choose I don’t know.")

export const gradeSchema = z.object({
  rating: z.enum(["AGAIN", "HARD", "GOOD", "EASY"]),
  assessment: z.enum(["MISSED", "PARTIAL", "MEETS"]).optional(),
  idempotencyKey: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
})

export type LearningActionState = {
  error?: string
}

export function firstValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again."
}

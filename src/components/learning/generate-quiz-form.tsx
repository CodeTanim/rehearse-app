"use client"

import { useActionState } from "react"

import { generateLearningPackAction } from "@/app/actions/learning-pack"
import { SubmitButton } from "@/components/app/submit-button"
import { Alert } from "@/components/ui/alert"

export function GenerateQuizForm({
  goalSkillId,
  disabled = false,
}: {
  goalSkillId: string
  disabled?: boolean
}) {
  const [state, action] = useActionState(generateLearningPackAction, {})

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="goalSkillId" value={goalSkillId} />
      {state.error ? (
        <Alert role="alert" variant="destructive" className="text-sm">
          {state.error}
        </Alert>
      ) : null}
      <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
        <input
          type="checkbox"
          name="aiConsent"
          required
          disabled={disabled}
          className="mt-1 size-4 shrink-0 accent-primary"
        />
        <span>Use these sources to generate my quiz.</span>
      </label>
      <SubmitButton
        size="lg"
        className="w-full sm:w-auto"
        disabled={disabled}
        pendingLabel="Building…"
      >
        Generate quiz
      </SubmitButton>
    </form>
  )
}

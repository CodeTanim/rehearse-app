"use client"

import { useActionState } from "react"
import { startReviewAction } from "@/app/actions/learning-setup"
import { SubmitButton } from "@/components/app/submit-button"
import { Alert } from "@/components/ui/alert"

export function StartReviewForm({ goalSkillId }: { goalSkillId: string }) {
  const [state, action] = useActionState(startReviewAction, {})

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="goalSkillId" value={goalSkillId} />
      {state.error ? (
        <Alert role="alert" variant="destructive" className="text-sm">
          {state.error}
        </Alert>
      ) : null}
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Starting…">
        Review
      </SubmitButton>
    </form>
  )
}

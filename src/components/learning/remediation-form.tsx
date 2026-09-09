"use client"

import { useActionState } from "react"
import { CheckIcon } from "lucide-react"

import {
  completeRemediationAction,
  type RemediationActionState,
} from "@/app/actions/remediation"
import { SubmitButton } from "@/components/app/submit-button"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import { Textarea } from "@/components/ui/textarea"

type RemediationFormProps = {
  goalSkillId: string
  gapId: string
  remediationRevisionId: string
  scaffoldPrompt: string
  initialAnswer?: string
  alreadyCompleted?: boolean
}

export function RemediationForm({
  goalSkillId,
  gapId,
  remediationRevisionId,
  scaffoldPrompt,
  initialAnswer = "",
  alreadyCompleted = false,
}: RemediationFormProps) {
  const initialState: RemediationActionState = alreadyCompleted
    ? { completed: true }
    : {}
  const [state, action] = useActionState(completeRemediationAction, initialState)

  if (state.completed) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <Alert variant="success" className="flex items-start gap-2.5">
          <CheckIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
          <span>
            Practice saved. This prepares you for your next recall; it does not raise mastery.
          </span>
        </Alert>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink href={`/skills/${goalSkillId}`} className="w-full sm:w-auto">
            Back to skill
          </ButtonLink>
          <ButtonLink
            href={`/today?skill=${encodeURIComponent(goalSkillId)}`}
            variant="ghost"
            className="w-full sm:w-auto"
          >
            View recall
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="goalSkillId" value={goalSkillId} />
      <input type="hidden" name="gapId" value={gapId} />
      <input
        type="hidden"
        name="remediationRevisionId"
        value={remediationRevisionId}
      />

      <div className="space-y-2">
        <label htmlFor="remediation-answer" className="block font-medium leading-6">
          {scaffoldPrompt}
        </label>
        <Textarea
          id="remediation-answer"
          name="answer"
          rows={5}
          maxLength={4_000}
          defaultValue={initialAnswer}
          placeholder="Explain it in your own words"
          required
          error={state.error}
        />
      </div>

      {state.errorCode === "STALE_REMEDIATION_REVISION" ? (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => window.location.reload()}
        >
          Reload practice
        </Button>
      ) : (
        <SubmitButton pendingLabel="Saving…" className="w-full sm:w-auto">
          Finish practice
        </SubmitButton>
      )}
    </form>
  )
}

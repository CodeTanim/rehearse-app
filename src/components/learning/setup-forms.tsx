"use client"

import { useActionState } from "react"
import {
  createGoalAction,
  createQuestionAndStartAction,
  createSkillAction,
} from "@/app/actions/learning-setup"
import { createTopicAction } from "@/app/actions/topic-source"
import { SubmitButton } from "@/components/app/submit-button"
import { Alert } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function FormError({ message }: { message?: string }) {
  return message ? (
    <Alert role="alert" variant="destructive" className="text-sm">
      {message}
    </Alert>
  ) : null
}

export function TopicSetupForm() {
  const [state, action] = useActionState(createTopicAction, {})

  return (
    <form action={action} className="space-y-5">
      <FormError message={state.error} />
      <div>
        <label htmlFor="topic-title" className="mb-1.5 block text-sm font-medium">
          Topic
        </label>
        <Input
          id="topic-title"
          name="title"
          maxLength={120}
          autoComplete="off"
          autoFocus
          placeholder="Hashmaps"
          required
        />
      </div>
      <SubmitButton className="w-full sm:w-auto" size="lg" pendingLabel="Adding…">
        Continue
      </SubmitButton>
    </form>
  )
}

export function GoalSetupForm() {
  const [state, action] = useActionState(createGoalAction, {})

  return (
    <form action={action} className="space-y-5">
      <FormError message={state.error} />
      <div>
        <label htmlFor="goal-title" className="mb-1.5 block text-sm font-medium">
          Goal
        </label>
        <Input
          id="goal-title"
          name="title"
          maxLength={100}
          autoFocus
          placeholder="Master HTTP caching"
          required
        />
      </div>
      <div>
        <label htmlFor="goal-outcome" className="mb-1.5 block text-sm font-medium">
          Outcome
        </label>
        <Textarea
          id="goal-outcome"
          name="outcome"
          maxLength={500}
          placeholder="Design a cache and explain the tradeoffs"
          required
        />
      </div>
      <SubmitButton className="w-full sm:w-auto" size="lg" pendingLabel="Creating…">
        Continue
      </SubmitButton>
    </form>
  )
}

export function SkillSetupForm({ goalId }: { goalId: string }) {
  const [state, action] = useActionState(createSkillAction, {})

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="goalId" value={goalId} />
      <FormError message={state.error} />
      <div>
        <label htmlFor="skill-title" className="mb-1.5 block text-sm font-medium">
          Skill
        </label>
        <Input
          id="skill-title"
          name="title"
          maxLength={120}
          autoFocus
          placeholder="Cache invalidation"
          required
        />
      </div>
      <div>
        <label htmlFor="skill-outcome" className="mb-1.5 block text-sm font-medium">
          I can…
        </label>
        <Textarea
          id="skill-outcome"
          name="outcome"
          maxLength={500}
          placeholder="Choose an invalidation strategy"
          required
        />
      </div>
      <div>
        <label htmlFor="success-criterion" className="mb-1.5 block text-sm font-medium">
          Success check
        </label>
        <Textarea
          id="success-criterion"
          name="successCriterion"
          maxLength={500}
          placeholder="Compare two approaches and their tradeoffs"
          required
        />
      </div>
      <SubmitButton className="w-full sm:w-auto" size="lg">
        Continue
      </SubmitButton>
    </form>
  )
}

export function QuestionSetupForm({ goalSkillId }: { goalSkillId: string }) {
  const [state, action] = useActionState(createQuestionAndStartAction, {})

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="goalSkillId" value={goalSkillId} />
      <FormError message={state.error} />
      <div>
        <label htmlFor="recall-prompt" className="mb-1.5 block text-sm font-medium">
          Recall prompt
        </label>
        <Textarea
          id="recall-prompt"
          name="prompt"
          maxLength={2_000}
          autoFocus
          placeholder="When should a cached response be invalidated?"
          required
        />
      </div>
      <div>
        <label htmlFor="reference-answer" className="mb-1.5 block text-sm font-medium">
          Reference answer
        </label>
        <Textarea
          id="reference-answer"
          name="referenceAnswer"
          maxLength={10_000}
          placeholder="Write the key points you want to recall"
          required
        />
      </div>
      <SubmitButton className="w-full sm:w-auto" size="lg" pendingLabel="Starting…">
        Start review
      </SubmitButton>
    </form>
  )
}

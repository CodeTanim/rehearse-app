"use client"

import { useActionState, useEffect, useState } from "react"

import { connectSkillRelationshipAction } from "@/app/actions/skill-relationships"
import { SubmitButton } from "@/components/app/submit-button"
import { Alert } from "@/components/ui/alert"

type SkillOption = { goalSkillId: string; title: string }

export function RelationshipConnectForm({ skills }: { skills: SkillOption[] }) {
  const [state, action] = useActionState(connectSkillRelationshipAction, {})
  const [sourceId, setSourceId] = useState(skills[0]?.goalSkillId ?? "")
  const [targetId, setTargetId] = useState(skills[1]?.goalSkillId ?? "")

  useEffect(() => {
    const selectSource = (event: Event) => {
      const id: unknown = (event as CustomEvent).detail
      if (typeof id !== "string" || !skills.some((skill) => skill.goalSkillId === id)) return
      setSourceId(id)
      setTargetId((current) => current !== id ? current :
        skills.find((skill) => skill.goalSkillId !== id)?.goalSkillId ?? "")
    }
    window.addEventListener("rehearse:connect-skill", selectSource)
    return () => window.removeEventListener("rehearse:connect-skill", selectSource)
  }, [skills])

  return (
    <form action={action} className="space-y-4 pt-3">
      {state.error ? (
        <Alert role="alert" variant="destructive" className="text-sm">
          {state.error}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="min-w-0">
          <label htmlFor="relationship-from" className="mb-1.5 block text-sm font-medium">
            From
          </label>
          <select
            id="relationship-from"
            name="sourceGoalSkillId"
            value={sourceId}
            onChange={(event) => {
              const id = event.target.value
              setSourceId(id)
              if (targetId === id) setTargetId(skills.find((skill) => skill.goalSkillId !== id)?.goalSkillId ?? "")
            }}
            className="paper-input min-h-11 w-full px-3 py-2 text-base sm:text-sm"
            required
          >
            {skills.map((skill) => (
              <option key={skill.goalSkillId} value={skill.goalSkillId}>
                {skill.title}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="relationship-kind" className="mb-1.5 block text-sm font-medium">
            Connection
          </label>
          <select
            id="relationship-kind"
            name="kind"
            aria-describedby="relationship-kind-help"
            className="paper-input min-h-11 w-full px-3 py-2 text-base sm:text-sm"
            required
          >
            <option value="RELATED">Related</option>
            <option value="PREREQUISITE">Prerequisite for</option>
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="relationship-to" className="mb-1.5 block text-sm font-medium">
            To
          </label>
          <select
            id="relationship-to"
            name="targetGoalSkillId"
            className="paper-input min-h-11 w-full px-3 py-2 text-base sm:text-sm"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            required
          >
            {skills.filter((skill) => skill.goalSkillId !== sourceId).map((skill) => (
              <option key={skill.goalSkillId} value={skill.goalSkillId}>
                {skill.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p id="relationship-kind-help" className="text-xs text-muted-foreground">
        For a prerequisite, From comes before To.
      </p>
      <SubmitButton variant="outline" className="w-full sm:w-auto" pendingLabel="Connecting…">
        Connect
      </SubmitButton>
    </form>
  )
}

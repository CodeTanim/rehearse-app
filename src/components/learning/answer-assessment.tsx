"use client"

import { useId } from "react"

export type AnswerAssessment = "MISSED" | "PARTIAL" | "MEETS"

const options = [
  { value: "MISSED", label: "Missed", hint: "Key idea missing" },
  { value: "PARTIAL", label: "Partial", hint: "Some key ideas" },
  { value: "MEETS", label: "Meets", hint: "All key ideas" },
] as const

export function AnswerAssessmentPicker({ value, onChange, disabled = false }: {
  value: AnswerAssessment | null
  onChange: (value: AnswerAssessment) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">How did your answer compare?</legend>
      <p className="mb-3 text-xs text-muted-foreground">Self-rated against the reference, not AI-graded.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <label key={option.value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${value === option.value ? "border-primary bg-sage-light" : "border-border bg-card"}`}>
            <input type="radio" name={id} checked={value === option.value} onChange={() => onChange(option.value)} className="size-4 shrink-0 accent-primary" />
            <span><span className="block font-medium">{option.label}</span><span className="text-xs text-muted-foreground">{option.hint}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

import { Check, Sprout } from "lucide-react"
import type { MasteryMilestone } from "@/lib/learning/types"

export function MasteryMilestonePanel({ milestone, stage, refreshDue = false, achieved = false, snapshot = false }: {
  milestone?: MasteryMilestone
  stage: string
  refreshDue?: boolean
  achieved?: boolean
  snapshot?: boolean
}) {
  if (!milestone) return null
  const learned = stage === "WELL_LEARNED"
  const next = milestone.requirements.find((requirement) => !requirement.met)
  return (
    <section aria-label="Well learned milestone" className={`space-y-3 rounded-xl border p-4 sm:p-5 ${learned ? "border-primary/25 bg-sage-light" : "border-border"}`}>
      <div className="flex items-center gap-2">
        <Sprout aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <h2 className="font-semibold">{learned ? achieved ? "You’ve earned Well learned" : "Well learned" : "Toward Well learned"}</h2>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        {learned
          ? refreshDue ? "Your evidence still stands. A refresh is due to keep this skill ready."
            : "You’ve shown consistent recall over time and applied this skill in new situations."
          : next?.next ?? "Your learning evidence is being checked."}
      </p>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">{learned ? "Why you earned it" : "What’s still needed"}</summary>
        <ul className="divide-y divide-border">
          {milestone.requirements.map((requirement) => (
            <li key={requirement.id} className="flex gap-3 py-3">
              <span className="mt-0.5 shrink-0">{requirement.met ? <Check aria-hidden="true" className="size-4 text-primary" /> : <span aria-hidden="true" className="block size-4 rounded-full border border-muted-foreground/50" />}<span className="sr-only">{requirement.met ? "Met: " : "Still needed: "}</span></span>
              <div><p className="font-medium">{requirement.label}</p><p className="mt-1 leading-5 text-muted-foreground">{requirement.detail}</p></div>
            </li>
          ))}
        </ul>
        <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{snapshot ? "Evidence and scope when this recall was saved" : "For this skill’s current scope"} · {milestone.ruleVersion}. Short answers are self-rated; the performance index is not an objective accuracy score. Skips and source-assisted practice earn no readiness credit.</p>
      </details>
    </section>
  )
}

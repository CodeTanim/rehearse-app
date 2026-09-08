"use client"

import { useState, useTransition } from "react"
import { ArrowRightIcon, MoveHorizontalIcon } from "lucide-react"

import { connectSkillRelationshipAction, manageSkillRelationshipAction } from "@/app/actions/skill-relationships"
import { RelationshipConnectForm } from "@/components/learning/relationship-connect-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type {
  SkillTreeLeaf,
  SkillTreeRelationship,
} from "@/lib/learning/skill-tree-query"

function accessibleRelationship(relationship: SkillTreeRelationship) {
  return relationship.kind === "RELATED"
    ? `${relationship.sourceTitle} is related to ${relationship.targetTitle}`
    : `${relationship.sourceTitle} is a prerequisite for ${relationship.targetTitle}`
}

export function SkillRelationships({
  leaves,
  relationships,
}: {
  leaves: SkillTreeLeaf[]
  relationships: SkillTreeRelationship[]
}) {
  const [removed, setRemoved] = useState<SkillTreeRelationship | null>(null)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function remove(relationship: SkillTreeRelationship) {
    startTransition(async () => {
      setError("")
      try {
        const form = new FormData()
        form.set("relationshipId", relationship.id)
        form.set("intent", "REMOVE")
        const result = await manageSkillRelationshipAction(form)
        if (result.error) setError(result.error)
        else setRemoved(relationship)
      } catch { setError("The connection could not be removed. Try again.") }
    })
  }

  function undo() {
    if (!removed) return
    startTransition(async () => {
      setError("")
      try {
        const form = new FormData()
        form.set("sourceGoalSkillId", leaves.find((leaf) => leaf.skillNodeId === removed.sourceSkillNodeId)?.goalSkillId ?? "")
        form.set("targetGoalSkillId", leaves.find((leaf) => leaf.skillNodeId === removed.targetSkillNodeId)?.goalSkillId ?? "")
        form.set("kind", removed.kind)
        const result = await connectSkillRelationshipAction({}, form)
        if (result.error) setError(result.error)
        else setRemoved(null)
      } catch { setError("The connection could not be restored. Try again.") }
    })
  }

  if (leaves.length < 2) return null
  const skillOptions = leaves.map(({ goalSkillId, title }) => ({ goalSkillId, title }))
  const visibleRelationships = relationships.filter(
    (relationship) =>
      relationship.status === "CONFIRMED" && relationship.origin === "USER",
  )

  return (
    <section aria-labelledby="skill-connections-heading">
      {removed ? <div role="status" className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
        <span>Removed: {accessibleRelationship(removed)}.</span>
        <Button variant="outline" size="sm" disabled={pending} onClick={undo}>Undo removal</Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setRemoved(null)}>Dismiss</Button>
      </div> : null}
      {error ? <p role="alert" className="mb-3 text-sm text-destructive">{error}</p> : null}
      <h2 id="skill-connections-heading" className="sr-only">
        Skill connections
      </h2>
      <details id="skill-connections" className="connection-panel scroll-mt-28">
        <summary>
          <span>Manage connections</span>
          <span className="text-xs font-semibold text-muted-foreground">
            {visibleRelationships.length}
          </span>
        </summary>

        <div className="p-4 sm:p-5">
          {visibleRelationships.length > 0 ? (
            <ul aria-label="Skill connections" className="space-y-2">
              {visibleRelationships.map((relationship) => {
                const description = accessibleRelationship(relationship)
                const Icon =
                  relationship.kind === "RELATED" ? MoveHorizontalIcon : ArrowRightIcon

                return (
                  <li
                    key={relationship.id}
                    className="rounded-2xl border border-border bg-card/70 px-3 py-3"
                  >
                    <article
                      aria-label={`${description}. Connected.`}
                      className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-9 shrink-0 place-items-center rounded-full border border-[color-mix(in_srgb,var(--garden-blue)_32%,var(--border))] text-[var(--garden-blue)]"
                        >
                          <Icon className="size-4" />
                        </span>
                        <p className="min-w-0 break-words text-sm font-medium">
                          {description}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                        <Badge variant="muted">
                          {relationship.kind === "RELATED" ? "Related" : "Prerequisite"}
                        </Badge>
                        <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label={`Remove: ${description}`} onClick={() => remove(relationship)}>Remove</Button>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No connections yet.</p>
          )}

          <div className="mt-5 border-t border-border pt-5">
            <h3 className="font-display text-lg font-semibold">Connect two skills</h3>
            <RelationshipConnectForm skills={skillOptions} />
          </div>
        </div>
      </details>
    </section>
  )
}

import { SkillConstellation } from "@/components/learning/skill-constellation"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button-link"
import type {
  SkillTreeLeaf,
  SkillTreeRelationship,
} from "@/lib/learning/skill-tree-query"

type BadgeVariant = "learning" | "demonstrated" | "learned" | "refresh" | "muted"

type SharedSkillTreeProps = {
  compact?: boolean
  headingLevel?: "h1" | "h2"
  addSkillHref?: string
  relationships?: SkillTreeRelationship[]
  timezone?: string
}

type SkillTreeProps = SharedSkillTreeProps &
  (
    | { leaf: SkillTreeLeaf; leaves?: never; goalTitle?: never }
    | { leaf?: never; leaves: SkillTreeLeaf[]; goalTitle: string }
  )

function stageLabel(leaf: SkillTreeLeaf): { label: string; variant: BadgeVariant } {
  switch (leaf.stage) {
    case "LEARNING":
      return { label: "Learning", variant: "learning" }
    case "DEMONSTRATED":
      return { label: "Demonstrated", variant: "demonstrated" }
    case "WELL_LEARNED":
      return { label: "Well learned", variant: "learned" }
    default:
      return { label: "Unassessed", variant: "muted" }
  }
}

function urgencyLabel(leaf: SkillTreeLeaf) {
  if (leaf.dueState === "NOT_SCHEDULED") return "Not scheduled"
  if (leaf.dueState === "CURRENT") return "Current"
  if (leaf.stage === "WELL_LEARNED") return "Refresh due"
  return leaf.dueState === "OVERDUE" ? "Overdue" : "Due"
}

function CompactSkillTree({
  leaf,
  headingLevel,
}: {
  leaf: SkillTreeLeaf
  headingLevel: "h1" | "h2"
}) {
  const Heading = headingLevel
  const LeafHeading = headingLevel === "h1" ? "h2" : "h3"
  const status = stageLabel(leaf)
  const urgency = urgencyLabel(leaf)

  return (
    <section aria-label="Skill tree" className="min-w-0 space-y-4 overflow-x-clip">
      <header className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {leaf.goalTitle}
        </p>
        <Heading className="font-display mt-1 text-2xl font-semibold tracking-tight">
          Skill Tree
        </Heading>
      </header>

      <article
        aria-label={`${leaf.title}: ${status.label}, ${urgency}, ${leaf.confidence.toLowerCase()} confidence`}
        className="relative overflow-hidden rounded-[1.35rem] border border-[color-mix(in_srgb,var(--primary)_22%,var(--border))] bg-card px-5 py-5 shadow-[0_16px_38px_rgb(31_61_48_/_0.06)]"
      >
        <span
          aria-hidden="true"
          className="absolute -right-10 -top-12 size-36 rounded-full border border-primary/10"
        />
        <div className="relative flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <LeafHeading className="font-display break-words text-xl font-semibold leading-snug">
              {leaf.title}
            </LeafHeading>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {urgency} · {leaf.confidence.toLowerCase()} confidence
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            {leaf.stage === "WELL_LEARNED" &&
            leaf.dueState !== "CURRENT" &&
            leaf.dueState !== "NOT_SCHEDULED" ? (
              <Badge variant="refresh">Refresh due</Badge>
            ) : null}
          </div>
        </div>
      </article>

      <details className="min-w-0 border-t border-border pt-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">Details</summary>
        <p className="pb-2 text-muted-foreground">{leaf.reason}</p>
      </details>
    </section>
  )
}

export function SkillTree(props: SkillTreeProps) {
  const { headingLevel = "h2", addSkillHref, relationships = [], timezone = "UTC" } = props

  if ("leaf" in props && props.leaf) {
    return <CompactSkillTree leaf={props.leaf} headingLevel={headingLevel} />
  }

  const leaves = props.leaves
  const Heading = headingLevel

  return (
    <section aria-label="Skill tree" className="min-w-0 space-y-6 overflow-x-clip">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--garden-blue)]">
            {props.goalTitle}
          </p>
          <Heading className="font-display mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Skill Tree
          </Heading>
        </div>
        {addSkillHref ? (
          <ButtonLink href={addSkillHref} variant="accent" className="w-full shrink-0 sm:w-auto">
            Add skill
          </ButtonLink>
        ) : null}
      </header>

      {leaves.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-border bg-card/55 px-4 py-12 text-center">
          <p className="font-display text-lg font-semibold">Your first skill will appear here.</p>
        </div>
      ) : (
        <SkillConstellation
          leaves={leaves.map((leaf) => ({
            skillNodeId: leaf.skillNodeId ?? leaf.goalSkillId,
            goalId: leaf.goalId,
            goalSkillId: leaf.goalSkillId,
            title: leaf.title,
            stage: leaf.stage,
            confidence: leaf.confidence,
            dueState: leaf.dueState,
            dueAt: leaf.dueAt?.toISOString() ?? null,
            evidenceCount: leaf.evidenceCount,
            successCount: leaf.successCount,
            reason: leaf.reason,
            mapX: leaf.mapX,
            mapY: leaf.mapY,
            positionVersion: leaf.positionVersion,
          }))}
          relationships={relationships}
          timezone={timezone}
        />
      )}
    </section>
  )
}

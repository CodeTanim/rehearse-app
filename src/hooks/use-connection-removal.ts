"use client"

import { useRef, useState } from "react"
import { connectSkillRelationshipAction, manageSkillRelationshipAction } from "@/app/actions/skill-relationships"
import type { SkillTreeRelationship } from "@/lib/learning/skill-tree-query"

type SkillEndpoint = { skillNodeId?: string; goalSkillId: string }

export function connectionDescription(relationship: SkillTreeRelationship) {
  return relationship.kind === "RELATED"
    ? `${relationship.sourceTitle} is related to ${relationship.targetTitle}`
    : `${relationship.sourceTitle} is a prerequisite for ${relationship.targetTitle}`
}

export function useConnectionRemoval(leaves: SkillEndpoint[]) {
  const [removed, setRemoved] = useState<SkillTreeRelationship | null>(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const busy = useRef(false)

  async function remove(relationship: SkillTreeRelationship) {
    if (busy.current) return false
    busy.current = true
    setPending(true)
    setError("")
    try {
      const form = new FormData()
      form.set("relationshipId", relationship.id)
      form.set("intent", "REMOVE")
      const result = await manageSkillRelationshipAction(form)
      if (result.error) { setError(result.error); return false }
      setRemoved(relationship)
      return true
    } catch { setError("The connection could not be removed. Try again."); return false }
    finally { busy.current = false; setPending(false) }
  }

  async function undo() {
    if (!removed || busy.current) return
    busy.current = true
    setPending(true)
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
    finally { busy.current = false; setPending(false) }
  }

  return { removed, error, pending, remove, undo, dismiss: () => { setRemoved(null); setError("") } }
}

"use client"

import { useEffect, useRef, useState } from "react"
import { saveSkillPositionAction } from "@/app/actions/skill-position"
import { boundedPosition, defaultNodePosition, type CanvasPoint } from "@/lib/learning/canvas-geometry"

type PositionedLeaf = { skillNodeId: string; mapX?: number | null; mapY?: number | null; positionVersion?: number }

export function useSkillPlacement(leaves: PositionedLeaf[]) {
  const [positions, setPositions] = useState<Record<string, CanvasPoint>>(() => Object.fromEntries(leaves.map((leaf, index) => [
    leaf.skillNodeId, leaf.mapX != null && leaf.mapY != null ? { x: leaf.mapX, y: leaf.mapY } : defaultNodePosition(index),
  ])))
  const committed = useRef(positions)
  const versions = useRef(Object.fromEntries(leaves.map((leaf) => [leaf.skillNodeId, leaf.positionVersion ?? 0])))
  const busy = useRef(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  function preview(id: string, point: CanvasPoint) {
    setPositions((current) => ({ ...current, [id]: boundedPosition(point) }))
  }

  async function commit(id: string, point: CanvasPoint) {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setError("")
    setMessage("")
    const next = boundedPosition(point)
    preview(id, next)
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        saveSkillPositionAction({ skillNodeId: id, ...next, version: versions.current[id] ?? 0 }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Saving took too long. Reload the map to check the saved position.")), 12_000)
        }),
      ])
      if (result.error || result.version === undefined) throw new Error(result.error ?? "Position could not be saved.")
      versions.current[id] = result.version
      committed.current = { ...committed.current, [id]: next }
      setMessage("Position saved")
    } catch (cause) {
      setPositions((current) => ({ ...current, [id]: committed.current[id] ?? defaultNodePosition(leaves.findIndex((leaf) => leaf.skillNodeId === id)) }))
      setError(cause instanceof Error ? cause.message : "Position could not be saved. Try again.")
    } finally { clearTimeout(timeout); busy.current = false; setSaving(false) }
  }

  useEffect(() => {
    if (!saving) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [saving])

  return { positions, preview, commit, saving, message, error }
}

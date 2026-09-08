"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react"
import {
  CableIcon,
  LeafIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  ScanIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import type { SkillTreeRelationship } from "@/lib/learning/skill-tree-query"
import { connectSkillRelationshipAction } from "@/app/actions/skill-relationships"
import { useSkillPlacement } from "@/hooks/use-skill-placement"
import { boundedPosition, defaultNodePosition, fitCanvas, MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM } from "@/lib/learning/canvas-geometry"

export type SkillConstellationLeaf = {
  mapX?: number | null
  mapY?: number | null
  positionVersion?: number
  skillNodeId: string
  goalId: string
  goalSkillId: string
  title: string
  stage: string
  confidence: string
  dueState: "CURRENT" | "DUE" | "OVERDUE" | "NOT_SCHEDULED"
  dueAt: string | null
  evidenceCount: number
  successCount: number
  reason: string
}

type Point = { x: number; y: number }
type NodeGeometry = Point & { width: number; height: number }

const nodeTilt = ["-3deg", "2deg", "-1deg", "3deg", "-2deg", "1deg"]

const MIN_ZOOM = MIN_CANVAS_ZOOM
const MAX_ZOOM = MAX_CANVAS_ZOOM
const ZOOM_STEP = 0.18

function stageLabel(stage: string) {
  if (stage === "LEARNING") return "Learning"
  if (stage === "DEMONSTRATED") return "Demonstrated"
  if (stage === "WELL_LEARNED") return "Well learned"
  return "Unassessed"
}

function stageBadgeVariant(stage: string) {
  if (stage === "LEARNING") return "learning" as const
  if (stage === "DEMONSTRATED") return "demonstrated" as const
  if (stage === "WELL_LEARNED") return "learned" as const
  return "muted" as const
}

function urgencyLabel(leaf: SkillConstellationLeaf) {
  if (leaf.dueState === "NOT_SCHEDULED") return "Not scheduled"
  if (leaf.dueState === "CURRENT") return "Current"
  if (leaf.stage === "WELL_LEARNED") return "Refresh due"
  return leaf.dueState === "OVERDUE" ? "Overdue" : "Due"
}

function nextReviewLabel(leaf: SkillConstellationLeaf, timezone: string) {
  if (!leaf.dueAt) return "Not scheduled"
  const date = new Date(leaf.dueAt)
  if (Number.isNaN(date.getTime())) return "Not scheduled"

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: timezone,
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date)
  }
}

function curvedPath(source: Point, target: Point) {
  const horizontalDistance = target.x - source.x
  const verticalDistance = target.y - source.y
  const control = Math.max(56, Math.abs(horizontalDistance) * 0.42)
  const direction = horizontalDistance >= 0 ? 1 : -1

  return [
    `M ${source.x.toFixed(1)} ${source.y.toFixed(1)}`,
    `C ${(source.x + control * direction).toFixed(1)} ${(source.y + verticalDistance * 0.12).toFixed(1)}`,
    `${(target.x - control * direction).toFixed(1)} ${(target.y - verticalDistance * 0.12).toFixed(1)}`,
    `${target.x.toFixed(1)} ${target.y.toFixed(1)}`,
  ].join(" ")
}

function edgePoint(from: NodeGeometry, toward: NodeGeometry) {
  const dx = toward.x - from.x
  const dy = toward.y - from.y
  if (dx === 0 && dy === 0) return { x: from.x, y: from.y }

  const radiusX = from.width / 2 + 5
  const radiusY = from.height / 2 + 5
  const scale = 1 / Math.sqrt((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY))

  return {
    x: from.x + dx * scale,
    y: from.y + dy * scale,
  }
}

function relationshipPath(source: NodeGeometry, target: NodeGeometry) {
  return curvedPath(edgePoint(source, target), edgePoint(target, source))
}

function SkillPrimaryAction({ leaf }: { leaf: SkillConstellationLeaf }) {
  if (leaf.dueState === "DUE" || leaf.dueState === "OVERDUE") {
    return (
      <ButtonLink href={`/today?skill=${encodeURIComponent(leaf.goalSkillId)}`} className="w-full">
        Review now
      </ButtonLink>
    )
  }

  return (
      <ButtonLink href={`/skills/${leaf.goalSkillId}`} className="w-full">
      Open skill
    </ButtonLink>
  )
}

function LeafGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M25.8 5.8C16.3 5.7 9.2 9.7 7.2 17.1c-1.1 4.1.7 7.7 4.6 8.8 7.7 2.2 13.2-6.4 14-20.1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7 27c3.1-6.1 7.9-10.9 14.6-14.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12.2 20.5c1.8.1 3.5.6 5 1.5M16.4 15.8c.2-1.8 0-3.4-.6-4.9"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

function isCanvasControlElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest("button, a, input, select, textarea, .constellation-node, .constellation-inspector"),
  )
}

export function SkillConstellation({
  leaves,
  relationships,
  timezone = "UTC",
}: {
  leaves: SkillConstellationLeaf[]
  relationships: SkillTreeRelationship[]
  timezone?: string
}) {
  const markerId = `skill-arrow-${useId().replaceAll(":", "")}`
  const stageRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>())
  const [centers, setCenters] = useState<Record<string, NodeGeometry>>({})
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [selectedId, setSelectedId] = useState(leaves[0]?.skillNodeId ?? "")
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const placement = useSkillPlacement(leaves)
  const [query, setQuery] = useState("")
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [connectionKind, setConnectionKind] = useState<"RELATED" | "PREREQUISITE">("RELATED")
  const [connecting, setConnecting] = useState(false)
  const [connectionMessage, setConnectionMessage] = useState("")
  const [connectionError, setConnectionError] = useState("")
  const [pointer, setPointer] = useState<Point | null>(null)
  const dragRef = useRef<{ id: string; pointerId: number; start: Point; origin: Point; next: Point; moved: boolean } | null>(null)
  const connectionDragRef = useRef<{ sourceId: string; pointerId: number } | null>(null)
  const suppressClick = useRef(false)
  const searchResults = query.trim() ? leaves.filter((leaf) => leaf.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : []
  const panRef = useRef<
    | {
        pointerId: number
        x: number
        y: number
        offsetX: number
        offsetY: number
      }
    | null
  >(null)

  const visibleRelationships = useMemo(
    () =>
      relationships.filter(
        (relationship) =>
          relationship.status === "CONFIRMED" && relationship.origin === "USER",
      ),
    [relationships],
  )

  const selectedLeaf =
    leaves.find((leaf) => leaf.skillNodeId === selectedId) ?? leaves[0]
  const selectedRelationships = selectedLeaf
    ? visibleRelationships.filter(
        (relationship) =>
          relationship.sourceSkillNodeId === selectedLeaf.skillNodeId ||
          relationship.targetSkillNodeId === selectedLeaf.skillNodeId,
      )
    : []

  const stageHeight = 560

  const measureNodes = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const stageRect = stage.getBoundingClientRect()
    const nextCenters: Record<string, NodeGeometry> = {}
    const safeZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))

    for (const leaf of leaves) {
      const node = nodeRefs.current.get(leaf.skillNodeId)
      if (!node) continue
      const nodeRect = node.getBoundingClientRect()
      nextCenters[leaf.skillNodeId] = {
        x: (nodeRect.left - stageRect.left - offset.x) / safeZoom + nodeRect.width / (2 * safeZoom),
        y: (nodeRect.top - stageRect.top - offset.y) / safeZoom + nodeRect.height / (2 * safeZoom),
        width: nodeRect.width / safeZoom,
        height: nodeRect.height / safeZoom,
      }
    }

    setCenters(nextCenters)
    setStageSize({
      width: Math.round(stageRect.width),
      height: Math.round(stageRect.height),
    })
  }, [leaves, offset.x, offset.y, zoom])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let frame = requestAnimationFrame(measureNodes)
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measureNodes)
    })

    observer.observe(stage)
    for (const node of nodeRefs.current.values()) observer.observe(node)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [measureNodes, placement.positions])

  const registerNode = useCallback(
    (skillNodeId: string, node: HTMLButtonElement | null) => {
      if (node) nodeRefs.current.set(skillNodeId, node)
      else nodeRefs.current.delete(skillNodeId)
    },
    [],
  )

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.altKey && event.key.startsWith("Arrow") && !window.matchMedia("(max-width: 767px)").matches) {
        event.preventDefault()
        if (placement.saving || connectFrom) return
        setConnectionMessage("")
        const leaf = leaves[index]
        const point = placement.positions[leaf.skillNodeId] ?? defaultNodePosition(index)
        const step = event.shiftKey ? 80 : 24
        void placement.commit(leaf.skillNodeId, {
          x: point.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
          y: point.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0),
        })
        return
      }
      let nextIndex: number | null = null
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (index + 1) % leaves.length
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (index - 1 + leaves.length) % leaves.length
      } else if (event.key === "Home") {
        nextIndex = 0
      } else if (event.key === "End") {
        nextIndex = leaves.length - 1
      }
      if (nextIndex === null) return

      event.preventDefault()
      const nextLeaf = leaves[nextIndex]
      setSelectedId(nextLeaf.skillNodeId)
      nodeRefs.current.get(nextLeaf.skillNodeId)?.focus({ preventScroll: true })
      revealNode(nextLeaf.skillNodeId)
    }

  function revealNode(id: string) {
    const node = centers[id]
    if (window.matchMedia("(max-width: 767px)").matches) {
      nodeRefs.current.get(id)?.scrollIntoView({ block: "nearest" })
    } else if (node) {
      setZoom(1)
      setOffset({ x: stageSize.width / 2 - node.x, y: stageSize.height / 2 - node.y })
    }
  }

  function fitAll() {
    const view = fitCanvas(Object.values(centers), stageSize.width, stageSize.height)
    setZoom(view.zoom)
    setOffset(view.offset)
  }

  async function selectNode(leaf: SkillConstellationLeaf, explicitSource?: string) {
    if (suppressClick.current) { suppressClick.current = false; return }
    if (connecting) return
    const sourceId = explicitSource ?? connectFrom
    if (!sourceId) { setSelectedId(leaf.skillNodeId); return }
    if (sourceId === leaf.skillNodeId) { setConnectionMessage("Choose a different skill to connect."); return }
    const source = leaves.find((item) => item.skillNodeId === sourceId)
    if (!source) return
    setConnecting(true)
    setConnectionError("")
    try {
      const form = new FormData()
      form.set("sourceGoalSkillId", source.goalSkillId)
      form.set("targetGoalSkillId", leaf.goalSkillId)
      form.set("kind", connectionKind)
      const result = await connectSkillRelationshipAction({}, form)
      if (result.error) setConnectionError(result.error)
      else {
        setConnectionMessage(`${source.title} connected to ${leaf.title}.`)
        setConnectFrom(null)
        setPointer(null)
        setSelectedId(leaf.skillNodeId)
      }
    } catch { setConnectionError("The skills could not be connected. Try again.") }
    finally { setConnecting(false) }
  }

  function startNodeDrag(event: PointerEvent<HTMLButtonElement>, leaf: SkillConstellationLeaf, index: number) {
    if (event.button !== 0 || connectFrom || placement.saving || window.matchMedia("(max-width: 767px)").matches) return
    event.stopPropagation()
    setConnectionMessage("")
    suppressClick.current = false
    const origin = placement.positions[leaf.skillNodeId] ?? defaultNodePosition(index)
    dragRef.current = { id: leaf.skillNodeId, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin, next: origin, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveNodeDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.start.x
    const dy = event.clientY - drag.start.y
    if (!drag.moved && Math.hypot(dx, dy) < 5) return
    drag.moved = true
    drag.next = boundedPosition({ x: drag.origin.x + dx / zoom, y: drag.origin.y + dy / zoom })
    setSelectedId(drag.id)
    placement.preview(drag.id, drag.next)
  }

  function endNodeDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    suppressClick.current = drag.moved
    if (cancelled) placement.preview(drag.id, drag.origin)
    else if (drag.moved) void placement.commit(drag.id, drag.next)
  }

  function beginConnectionDrag(event: PointerEvent<HTMLButtonElement>, leaf: SkillConstellationLeaf) {
    if (event.button !== 0 || connecting) return
    event.stopPropagation()
    suppressClick.current = false
    setSelectedId(leaf.skillNodeId)
    setConnectFrom(leaf.skillNodeId)
    setConnectionError("")
    setConnectionMessage("")
    connectionDragRef.current = { sourceId: leaf.skillNodeId, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function endConnectionDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = connectionDragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    connectionDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (cancelled) { setConnectFrom(null); setPointer(null); return }
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest(".constellation-node-position")
    const targetId = hit?.querySelector<HTMLButtonElement>("[data-skill-node-id]")?.dataset.skillNodeId
    const target = leaves.find((leaf) => leaf.skillNodeId === targetId)
    if (target && target.skillNodeId !== drag.sourceId) void selectNode(target, drag.sourceId)
  }

  const openConnections = useCallback(() => {
    const panel = document.getElementById("skill-connections")
    if (!(panel instanceof HTMLDetailsElement)) return
    panel.open = true
    window.dispatchEvent(new CustomEvent("rehearse:connect-skill", {
      detail: selectedLeaf?.goalSkillId,
    }))
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
    requestAnimationFrame(() => panel.querySelector<HTMLSelectElement>("select")?.focus())
  }, [selectedLeaf?.goalSkillId])

  const clampZoom = useCallback((value: number) => {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
  }, [])

  const zoomAroundPoint = useCallback(
    (nextZoom: number, clientX: number, clientY: number) => {
      const stage = stageRef.current
      if (!stage || leaves.length === 0) return

      const rect = stage.getBoundingClientRect()
      const localX = clientX - rect.left
      const localY = clientY - rect.top
      const safeNext = clampZoom(nextZoom)
      const safeCurrent = clampZoom(zoom)
      if (safeNext === safeCurrent) return

      const logicalX = (localX - offset.x) / safeCurrent
      const logicalY = (localY - offset.y) / safeCurrent

      setZoom(safeNext)
      setOffset({
        x: localX - logicalX * safeNext,
        y: localY - logicalY * safeNext,
      })
    },
    [clampZoom, leaves.length, offset.x, offset.y, zoom],
  )

  const handleWheelZoom = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (window.matchMedia("(max-width: 767px)").matches) return
      if (leaves.length === 0) return
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()

      const nextZoom = clampZoom(zoom * Math.exp(-event.deltaY * 0.01))
      zoomAroundPoint(nextZoom, event.clientX, event.clientY)
    },
    [clampZoom, leaves.length, zoom, zoomAroundPoint],
  )

  const stageCenterPoint = useCallback(() => {
    const stage = stageRef.current
    if (!stage) {
      return null
    }

    const rect = stage.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }, [])

  const beginPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (window.matchMedia("(max-width: 767px)").matches) return
      if (event.button !== 0 || leaves.length === 0 || isCanvasControlElement(event.target)) return
      const stage = stageRef.current
      if (!stage) return

      stage.setPointerCapture(event.pointerId)
      panRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      }
      setIsPanning(true)
    },
    [leaves.length, offset.x, offset.y],
  )

  const updatePan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isPanning || !panRef.current || event.pointerId !== panRef.current.pointerId) return

      setOffset({
        x: panRef.current.offsetX + (event.clientX - panRef.current.x),
        y: panRef.current.offsetY + (event.clientY - panRef.current.y),
      })
    },
    [isPanning],
  )

  const endPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!panRef.current || event.pointerId !== panRef.current.pointerId) return

      const stage = stageRef.current
      if (stage && event.pointerId) {
        try {
          stage.releasePointerCapture(event.pointerId)
        } catch {
          // Some browsers may throw if capture is already lost.
        }
      }
      panRef.current = null
      setIsPanning(false)
    },
    [],
  )

  const resetViewport = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    stage.style.cursor = isPanning ? "grabbing" : "grab"
  }, [isPanning])

  return (
    <div className="constellation-frame" data-testid="skill-constellation" onKeyDown={(event) => {
      if (event.key === "Escape" && !connecting) { connectionDragRef.current = null; setConnectFrom(null); setPointer(null); setConnectionError(""); setQuery("") }
    }}>
      <div className="constellation-frame__bar">
        <div className="constellation-search">
          <label htmlFor={`${markerId}-search`} className="sr-only">Find a skill</label>
          <input id={`${markerId}-search`} type="search" className="paper-input min-h-11 w-full px-3 text-sm" placeholder={`Find a skill (${leaves.length})`} value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="constellation-frame__controls">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => {
              const center = stageCenterPoint()
              if (!center) return
              zoomAroundPoint(zoom / (1 + ZOOM_STEP), center.x, center.y)
            }}
            data-canvas-control
            disabled={leaves.length === 0 || zoom <= MIN_ZOOM}
          >
            <MinusIcon aria-hidden="true" className="size-4" />
            <span className="sr-only">Zoom out</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => {
              const center = stageCenterPoint()
              if (!center) return
              zoomAroundPoint(zoom * (1 + ZOOM_STEP), center.x, center.y)
            }}
            data-canvas-control
            disabled={leaves.length === 0 || zoom >= MAX_ZOOM}
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            <span className="sr-only">Zoom in</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetViewport}
            data-canvas-control
            disabled={zoom === 1 && offset.x === 0 && offset.y === 0}
          >
            <RotateCcwIcon aria-hidden="true" className="size-4" />
            <span className="ml-2 text-xs font-semibold">Reset</span>
            <span className="sr-only">Reset view</span>
          </Button>
          <span
            data-canvas-control
            className="inline-flex min-h-10 items-center px-2 text-sm font-semibold"
            aria-live="polite"
            aria-atomic="true"
          >
            {Math.round(zoom * 100)}%
          </span>
          <Button type="button" variant="outline" size="sm" data-canvas-control disabled={!Object.keys(centers).length} onClick={fitAll}>
            <ScanIcon aria-hidden="true" className="size-4" /> Fit all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={leaves.length < 2 || connecting}
            aria-pressed={Boolean(connectFrom)}
            onClick={() => {
              suppressClick.current = false
              setConnectFrom(connectFrom ? null : selectedLeaf?.skillNodeId ?? null)
              setConnectionError("")
              setConnectionMessage("")
              setPointer(null)
            }}
          >
            <CableIcon aria-hidden="true" className="size-4" />
            Connect
          </Button>
        </div>
      </div>

      {query.trim() ? <div className="constellation-search-results">
        <p role="status" className="text-xs text-muted-foreground">{searchResults.length ? `${searchResults.length} matches` : "No skills found. Try another name."}</p>
        <ul aria-label="Matching skills" className="flex flex-wrap gap-2">
          {searchResults.map((leaf) => <li key={leaf.skillNodeId}><Button variant="outline" size="sm" disabled={connecting} onClick={() => {
            if (connectFrom) { void selectNode(leaf); return }
            setSelectedId(leaf.skillNodeId); setQuery(""); revealNode(leaf.skillNodeId)
            nodeRefs.current.get(leaf.skillNodeId)?.focus({ preventScroll: true })
          }}>{leaf.title}</Button></li>)}
        </ul>
      </div> : null}

      {connectFrom ? <div className="constellation-connect-bar" aria-label="Connect skills">
        <p className="min-w-0 flex-1 break-words text-sm" role="status">{connecting ? "Connecting…" : `From ${leaves.find((leaf) => leaf.skillNodeId === connectFrom)?.title} — choose another skill.`}</p>
        <select aria-label="Map connection type" className="paper-input min-h-11 px-3 text-sm" value={connectionKind} disabled={connecting} onChange={(event) => setConnectionKind(event.target.value as "RELATED" | "PREREQUISITE")}>
          <option value="RELATED">Related</option><option value="PREREQUISITE">Prerequisite for</option>
        </select>
        <Button variant="ghost" size="sm" disabled={connecting} onClick={() => { setConnectFrom(null); setPointer(null) }}>Cancel</Button>
        <Button variant="ghost" size="sm" disabled={connecting} onClick={() => { setConnectFrom(null); openConnections() }}>Use form</Button>
      </div> : null}
      {connectionError || placement.error ? <p role="alert" className="px-5 py-2 text-sm text-destructive">{connectionError || placement.error} {placement.error ? <button type="button" onClick={() => window.location.reload()} className="underline">Reload map</button> : null}</p> : null}
      <p role="status" className="px-5 py-2 text-xs text-muted-foreground">{placement.saving ? "Saving position…" : connectionMessage || placement.message || "Select a skill to explore."}</p>

      <div className="constellation-layout">
        <div
          ref={stageRef}
          className="constellation-stage"
          style={{ height: stageHeight, touchAction: "none" }}
          onWheel={handleWheelZoom}
          onPointerDown={beginPan}
          onPointerMove={(event) => {
            updatePan(event)
            if (connectFrom && !window.matchMedia("(max-width: 767px)").matches) {
              const rect = event.currentTarget.getBoundingClientRect()
              setPointer({ x: (event.clientX - rect.left - offset.x) / zoom, y: (event.clientY - rect.top - offset.y) / zoom })
            }
          }}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onPointerLeave={endPan}
        >
          <div
            className="constellation-viewport"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          >
            {stageSize.width > 0 && stageSize.height > 0 ? (
              <svg
                aria-hidden="true"
                className="constellation-lines"
                viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <marker
                    id={markerId}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--garden-blue)" />
                  </marker>
                </defs>
                {connectFrom && pointer && centers[connectFrom] ? <path className="constellation-line" strokeDasharray="5 6" d={curvedPath(centers[connectFrom], pointer)} /> : null}
                {visibleRelationships.map((relationship) => {
                  const source = centers[relationship.sourceSkillNodeId]
                  const target = centers[relationship.targetSkillNodeId]
                  if (!source || !target) return null
                  const active =
                    relationship.sourceSkillNodeId === selectedLeaf?.skillNodeId ||
                    relationship.targetSkillNodeId === selectedLeaf?.skillNodeId

                  return (
                    <path
                      key={relationship.id}
                      className="constellation-line"
                      data-active={active}
                      data-kind={relationship.kind}
                      d={relationshipPath(source, target)}
                      markerEnd={
                        relationship.kind === "PREREQUISITE" ? `url(#${markerId})` : undefined
                      }
                    />
                  )
                })}
              </svg>
            ) : null}

            <ul className="constellation-node-list" aria-label="Skill leaves">
              {leaves.map((leaf, index) => {
                const point = placement.positions[leaf.skillNodeId] ?? defaultNodePosition(index)
                const style = {
                  left: `${point.x}px`,
                  top: `${point.y}px`,
                  "--node-tilt": nodeTilt[index % nodeTilt.length],
                } as CSSProperties
                const selected = selectedLeaf?.skillNodeId === leaf.skillNodeId
                const stage = stageLabel(leaf.stage)
                const urgency = urgencyLabel(leaf)

                return (
                  <li key={leaf.skillNodeId} className="constellation-node-position" style={style}>
                    <button
                      ref={(node) => registerNode(leaf.skillNodeId, node)}
                      type="button"
                      className="constellation-node"
                      data-skill-node-id={leaf.skillNodeId}
                      data-connection-source={connectFrom === leaf.skillNodeId}
                      aria-describedby={`${markerId}-selection-help`}
                      data-selected={selected}
                      data-stage={leaf.stage}
                      aria-pressed={selected}
                      aria-label={`${leaf.title}: ${stage}, ${urgency}, ${leaf.confidence.toLowerCase()} confidence`}
                      onClick={() => { void selectNode(leaf) }}
                      onKeyDown={(event) => moveFocus(event, index)}
                      onPointerDown={(event) => startNodeDrag(event, leaf, index)}
                      onPointerMove={moveNodeDrag}
                      onPointerUp={(event) => endNodeDrag(event)}
                      onPointerCancel={(event) => endNodeDrag(event, true)}
                    >
                      <span className="constellation-node__content">
                        <span className="constellation-node__glyph">
                          <LeafGlyph />
                        </span>
                        <span className="constellation-node__title">{leaf.title}</span>
                        <span className="constellation-node__state">{stage}</span>
                      </span>
                    </button>
                    {selected && leaves.length > 1 ? <button
                      type="button"
                      className="constellation-connect-handle"
                      aria-label={`Connect from ${leaf.title}`}
                      title="Drag to another skill, or click to choose a target"
                      disabled={connecting}
                      onPointerDown={(event) => beginConnectionDrag(event, leaf)}
                      onPointerUp={(event) => endConnectionDrag(event)}
                      onPointerCancel={(event) => endConnectionDrag(event, true)}
                      onClick={() => { if (!connecting) { suppressClick.current = false; setConnectFrom(leaf.skillNodeId); setConnectionError("") } }}
                    ><CableIcon className="size-4" aria-hidden="true" /></button> : null}
                    {selected ? (
                      <div
                        className="constellation-mobile-detail"
                        aria-label={`${leaf.title} details`}
                      >
                        <p className="text-sm text-muted-foreground">
                          Next recall{" "}
                          <strong className="text-foreground">{nextReviewLabel(leaf, timezone)}</strong>
                          <span aria-hidden="true"> · </span>
                          <strong className="text-foreground">{selectedRelationships.length}</strong>{" "}
                          {selectedRelationships.length === 1 ? "connection" : "connections"}
                        </p>
                        <div className="mt-3">
                          <SkillPrimaryAction leaf={leaf} />
                        </div>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {selectedLeaf ? (
          <aside
            className="constellation-inspector"
            aria-live="polite"
            aria-label={`Selected skill: ${selectedLeaf.title}`}
          >
            <div className="constellation-inspector__orb">
              <LeafIcon aria-hidden="true" className="size-7" strokeWidth={1.5} />
            </div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Selected skill
            </p>
            <h2 className="font-display mt-1 break-words text-2xl font-semibold leading-tight tracking-tight">
              {selectedLeaf.title}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={stageBadgeVariant(selectedLeaf.stage)}>
                {stageLabel(selectedLeaf.stage)}
              </Badge>
              {selectedLeaf.dueState === "DUE" || selectedLeaf.dueState === "OVERDUE" ? (
                <Badge variant={selectedLeaf.stage === "WELL_LEARNED" ? "refresh" : "muted"}>
                  {urgencyLabel(selectedLeaf)}
                </Badge>
              ) : null}
            </div>

            <dl className="constellation-stat-grid">
              <div className="constellation-stat">
                <dt className="text-xs text-muted-foreground">Next recall</dt>
                <dd className="mt-1 font-display text-lg font-semibold">
                  {nextReviewLabel(selectedLeaf, timezone)}
                </dd>
              </div>
              <div className="constellation-stat">
                <dt className="text-xs text-muted-foreground">Connections</dt>
                <dd className="mt-1 font-display text-lg font-semibold">
                  {selectedRelationships.length}
                </dd>
              </div>
            </dl>

            <SkillPrimaryAction leaf={selectedLeaf} />

            <details className="mt-3 text-sm">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">Map controls</summary>
              <p className="text-xs leading-relaxed text-muted-foreground">Drag a skill to move it. Use arrow keys to explore; Alt + arrows moves the focused skill. Drag the background to pan. Ctrl/⌘ + scroll zooms. Fit all brings every skill into view. Connect by dragging the selected skill’s handle to another skill, or choose Connect and then a target. Escape cancels.</p>
            </details>

            <details className="mt-3 text-sm">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">
                Why this state
              </summary>
              <p className="pb-1 text-sm leading-relaxed text-muted-foreground">
                {selectedLeaf.reason}
              </p>
            </details>
          </aside>
        ) : null}
      </div>
      <p id={`${markerId}-selection-help`} className="sr-only">Arrow keys browse skills. Enter selects a skill, or connects it when connection mode is active. Escape cancels connection mode. On desktop, drag or use Alt plus arrow keys to move a skill.</p>
    </div>
  )
}

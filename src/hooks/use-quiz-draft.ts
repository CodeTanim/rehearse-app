"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { QuizDraft, QuizDraftState } from "@/lib/learning/initial-quiz-draft"

export function useQuizDraft(packVersionId: string, initial: QuizDraft | undefined, state: QuizDraftState, enabled: boolean) {
  const snapshot = JSON.stringify(state)
  const [saved, setSaved] = useState(initial ? JSON.stringify(initial.state) : snapshot)
  const [error, setError] = useState<string>()
  const [authRequired, setAuthRequired] = useState(false)
  const [conflict, setConflict] = useState(false)
  const version = useRef(initial?.version ?? 0)
  const lastSaved = useRef(saved)
  const queue = useRef<Promise<void>>(Promise.resolve())

  const save = useCallback((value: QuizDraftState): Promise<void> => {
    if (!initial) return Promise.resolve()
    const serialized = JSON.stringify(value)
    const work = queue.current.catch(() => {}).then(async () => {
      if (lastSaved.current === serialized) return
      try {
        const response = await fetch(`/api/learning-packs/${encodeURIComponent(packVersionId)}/draft`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: version.current, state: value }),
          signal: AbortSignal.timeout(12_000),
        })
        const result = await response.json()
        if (!response.ok) {
          setAuthRequired(response.status === 401)
          setConflict(response.status === 409)
          throw new Error(result.error ?? "Your latest changes could not be saved.")
        }
        version.current = result.version
        lastSaved.current = serialized
        setSaved(serialized)
        setError(undefined)
        setAuthRequired(false)
      } catch (cause) {
        const message = cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "Saving took too long. Try again."
        setError(message)
        throw new Error(message)
      }
    })
    queue.current = work
    return work
  }, [initial, packVersionId])

  const dirty = Boolean(initial && snapshot !== saved)
  useEffect(() => {
    if (!enabled || !dirty || error) return
    const timer = window.setTimeout(() => { void save(JSON.parse(snapshot)).catch(() => {}) }, 300)
    return () => window.clearTimeout(timer)
  }, [dirty, enabled, error, save, snapshot])

  useEffect(() => {
    if (!enabled || !dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    // Internal navigation must finish saving before the component unmounts.
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest("a") : null
      if (!link || link.target || link.hasAttribute("download") || link.origin !== location.origin || link.hash) return
      // Let reauthentication open separately, retaining any unsaved input here.
      event.preventDefault()
      event.stopPropagation()
      void save(JSON.parse(snapshot)).then(() => window.location.assign(link.href)).catch(() => {})
    }
    window.addEventListener("beforeunload", warn)
    document.addEventListener("click", navigate, true)
    return () => {
      window.removeEventListener("beforeunload", warn)
      document.removeEventListener("click", navigate, true)
    }
  }, [dirty, enabled, save, snapshot])

  return { save, error, authRequired, conflict, dirty }
}

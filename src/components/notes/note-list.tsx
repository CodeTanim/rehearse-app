'use client'

import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Edit3, Plus, Search, StickyNote, Trash2, X } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Note } from '@/lib/types/file'

interface NoteListProps {
  notes: Note[]
  onNoteClick?: (note: Note) => void
  onNoteEdit?: (note: Note) => void
  onNoteDelete?: (noteId: string) => Promise<void>
  onCreateNote?: () => void
  isLoading?: boolean
  className?: string
}

type SortKey = 'title' | 'created' | 'updated'

export function NoteList({
  notes,
  onNoteClick,
  onNoteEdit,
  onNoteDelete,
  onCreateNote,
  isLoading = false,
  className = '',
}: NoteListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const createNoteButtonRef = useRef<HTMLButtonElement>(null)
  const searchId = useId()

  const handleSort = useCallback(
    (newSortBy: SortKey) => {
      if (newSortBy === sortBy) setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
      else {
        setSortBy(newSortBy)
        setSortOrder('desc')
      }
    },
    [sortBy],
  )

  const sortedNotes = useMemo(() => {
    const search = searchTerm.toLowerCase()
    const filteredNotes = notes.filter(
      (note) => note.title.toLowerCase().includes(search) || note.content.toLowerCase().includes(search),
    )

    return filteredNotes.sort((first, second) => {
      let value = 0
      if (sortBy === 'title') value = first.title.localeCompare(second.title)
      if (sortBy === 'created') value = new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
      if (sortBy === 'updated') value = new Date(first.updatedAt).getTime() - new Date(second.updatedAt).getTime()
      return sortOrder === 'asc' ? value : -value
    })
  }, [notes, searchTerm, sortBy, sortOrder])

  const openNote = useCallback(
    (note: Note) => {
      if (onNoteClick) onNoteClick(note)
      else onNoteEdit?.(note)
    },
    [onNoteClick, onNoteEdit],
  )

  const requestNoteDeletion = useCallback((note: Note) => {
    setDeleteError(null)
    setNoteToDelete(note)
  }, [])

  const confirmNoteDeletion = useCallback(async () => {
    if (!noteToDelete || !onNoteDelete) return

    setDeleteError(null)
    setIsDeleting(true)
    try {
      await onNoteDelete(noteToDelete.id)
      setNoteToDelete(null)
      requestAnimationFrame(() => {
        const fallback = createNoteButtonRef.current ?? document.getElementById(searchId)
        fallback?.focus({ preventScroll: true })
      })
    } catch (caughtError) {
      console.error('Failed to delete note:', caughtError)
      setDeleteError('Not deleted. Try again.')
    } finally {
      setIsDeleting(false)
    }
  }, [noteToDelete, onNoteDelete, searchId])

  function renderSortIcon(column: SortKey) {
    if (sortBy !== column) return <ArrowUpDown className="size-3.5" aria-hidden="true" />
    return sortOrder === 'asc' ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" />
  }

  if (isLoading && !noteToDelete) {
    return (
      <div className="grid min-h-48 place-items-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-4 border-accent border-t-transparent" aria-hidden="true" />
          <p className="font-bold text-muted-foreground">Loading notes…</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {onCreateNote ? (
            <Button
              ref={createNoteButtonRef}
              type="button"
              size="sm"
              variant="accent"
              onClick={onCreateNote}
              data-note-list-create
            >
              <Plus className="size-4" aria-hidden="true" />
              New note
            </Button>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-64">
            <label htmlFor={searchId} className="sr-only">Search notes</label>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id={searchId}
                type="search"
                placeholder="Search notes"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
            {searchTerm ? (
              <Button type="button" variant="outline" size="icon-sm" onClick={() => setSearchTerm('')} aria-label="Clear note search">
                <X className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Sort notes">
            {([
              ['title', 'Title'],
              ['updated', 'Modified'],
              ['created', 'Created'],
            ] as const).map(([column, label]) => (
              <Button
                key={column}
                type="button"
                variant={sortBy === column ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => handleSort(column)}
                aria-label={`Sort notes by ${label}${sortBy === column ? `, currently ${sortOrder === 'asc' ? 'ascending' : 'descending'}` : ''}`}
              >
                {label}
                {renderSortIcon(column)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {sortedNotes.length === 0 ? (
        <Card tone="note" className="p-8 text-center">
          <div className="mx-auto grid size-16 place-items-center border-[3px] border-foreground bg-card text-2xl" aria-hidden="true">
            <StickyNote className="size-8" />
          </div>
          <h3 className="mt-4 text-xl font-black">
            {searchTerm ? `No notes match “${searchTerm}”.` : 'No notes yet'}
          </h3>
          {!searchTerm ? <p className="mt-2 text-muted-foreground">Capture a takeaway or question.</p> : null}
          {searchTerm ? (
            <Button type="button" variant="outline" className="mt-5" onClick={() => setSearchTerm('')}>Clear search</Button>
          ) : onCreateNote ? (
            <Button type="button" variant="accent" className="mt-5" onClick={onCreateNote}>
              <Plus className="size-4" aria-hidden="true" />
              New note
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedNotes.map((note) => {
            const canOpen = Boolean(onNoteClick || onNoteEdit)
            return (
              <Card key={note.id} interactive={canOpen} className="min-w-0 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center border-2 border-foreground bg-[var(--paper-note)]" aria-hidden="true">
                    <StickyNote className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-black">{note.title}</h3>
                    <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-muted-foreground">
                      {note.content || 'Empty note'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-foreground/20 pt-3 text-xs font-bold text-muted-foreground">
                  <span>Updated {new Date(note.updatedAt).toLocaleDateString()}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {canOpen ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openNote(note)}
                      aria-label={`Open ${note.title}`}
                    >
                      <Edit3 className="size-4" aria-hidden="true" />
                      Open
                    </Button>
                  ) : null}
                  {onNoteDelete ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => requestNoteDeletion(note)}
                      aria-label={`Delete ${note.title}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <AlertDialog
        open={Boolean(noteToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteError(null)
            setNoteToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{noteToDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This note will be permanently deleted. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <Alert variant="destructive" role="alert" className="mx-6 mb-5">
              {deleteError}
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                void confirmNoteDeletion()
              }}
            >
              {isDeleting ? 'Deleting…' : 'Delete note'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

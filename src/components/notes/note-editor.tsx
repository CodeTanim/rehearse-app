'use client'

import { useId, useRef, useState } from 'react'
import { Edit3, Eye, Save, Trash2, X } from 'lucide-react'

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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SafeMarkdown } from '@/components/ui/safe-markdown'
import { Textarea } from '@/components/ui/textarea'
import {
  getNoteContentError,
  getNoteTitleError,
  NOTE_CONTENT_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
} from '@/lib/note-constraints'
import { CreateNoteData, Note, UpdateNoteData } from '@/lib/types/file'

interface NoteEditorProps {
  note?: Note | null
  isOpen: boolean
  onClose: () => void
  onSave: (data: CreateNoteData | UpdateNoteData) => Promise<void>
  onDelete?: () => Promise<void>
  isLoading?: boolean
  mode?: 'create' | 'edit'
}

interface NoteEditorDialogProps extends Omit<NoteEditorProps, 'isOpen' | 'mode'> {
  mode: 'create' | 'edit'
  onCaptureReturnFocus: () => void
}

export function NoteEditor({
  note,
  isOpen,
  mode = note ? 'edit' : 'create',
  ...props
}: NoteEditorProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null)

  function captureReturnFocus() {
    const activeElement = document.activeElement
    returnFocusRef.current =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null
  }

  function closeAndRestoreFocus() {
    const returnTarget = returnFocusRef.current
    props.onClose()

    requestAnimationFrame(() => {
      const fallback = document.querySelector<HTMLElement>('[data-note-list-create]')
        ?? document.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-state="active"]')
      const focusTarget = returnTarget?.isConnected ? returnTarget : fallback
      focusTarget?.focus({ preventScroll: true })
      returnFocusRef.current = null
    })
  }

  if (!isOpen) return null

  return (
    <NoteEditorDialog
      key={`${mode}:${note?.id ?? 'new'}`}
      {...props}
      note={note}
      mode={mode}
      onClose={closeAndRestoreFocus}
      onCaptureReturnFocus={captureReturnFocus}
    />
  )
}

function NoteEditorDialog({
  note,
  onClose,
  onSave,
  onDelete,
  isLoading = false,
  mode,
  onCaptureReturnFocus,
}: NoteEditorDialogProps) {
  const initialTitle = note?.title ?? ''
  const initialContent = note?.content ?? ''
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [isPreview, setIsPreview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const contentInputRef = useRef<HTMLTextAreaElement>(null)
  const formId = useId()
  const titleId = `${formId}-title`
  const titleHintId = `${formId}-title-hint`
  const contentId = `${formId}-content`
  const contentHintId = `${formId}-content-hint`

  const isDirty = title !== initialTitle || content !== initialContent
  const isBusy = isLoading || isSaving
  const titleError = getNoteTitleError(title)
  const contentError = getNoteContentError(content)
  const isValid = !titleError && !contentError

  function requestClose() {
    if (isBusy) return
    if (isDirty) setShowDiscardConfirm(true)
    else onClose()
  }

  async function handleSave() {
    setOperationError(null)

    if (titleError) {
      titleInputRef.current?.focus()
      return
    }

    if (contentError) {
      if (isPreview) {
        setIsPreview(false)
        requestAnimationFrame(() => contentInputRef.current?.focus())
      } else {
        contentInputRef.current?.focus()
      }
      return
    }

    setIsSaving(true)
    try {
      await onSave({ title: title.trim(), content: content.trim() })
      onClose()
    } catch (saveError) {
      console.error('Failed to save note:', saveError)
      setOperationError('Not saved. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return

    setDeleteError(null)
    setIsSaving(true)
    try {
      await onDelete()
      setShowDeleteConfirm(false)
      onClose()
    } catch (deleteError) {
      console.error('Failed to delete note:', deleteError)
      setDeleteError('Not deleted. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      if (isDirty && !isBusy) void handleSave()
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault()
      setIsPreview((current) => !current)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          size="xl"
          showCloseButton={false}
          className="flex h-[min(90dvh,54rem)] flex-col !overflow-hidden"
          onKeyDown={handleKeyDown}
          onOpenAutoFocus={(event) => {
            onCaptureReturnFocus()
            event.preventDefault()
            titleInputRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex flex-col gap-4 border-b-[3px] border-foreground bg-[var(--paper-note)] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <DialogTitle>{mode === 'create' ? 'New note' : 'Edit note'}</DialogTitle>
              <DialogDescription className="sr-only">
                Add a title and note, then save.
              </DialogDescription>
              {isDirty || mode === 'edit' ? (
                <p className="mt-1 text-sm text-foreground/70" aria-live="polite">
                  {isDirty ? 'Unsaved' : 'Saved'}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={isPreview ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setIsPreview((current) => !current)}
                disabled={isBusy}
                aria-pressed={isPreview}
              >
                {isPreview ? <Edit3 className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                {isPreview ? 'Edit' : 'Preview'}
              </Button>
              <Button
                type="button"
                variant="accent"
                size="sm"
                onClick={() => void handleSave()}
                disabled={!isDirty || !isValid || isBusy}
                isLoading={isBusy}
              >
                {!isBusy ? <Save className="size-4" aria-hidden="true" /> : null}
                Save
              </Button>
              {mode === 'edit' && onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  onClick={() => {
                    setDeleteError(null)
                    setShowDeleteConfirm(true)
                  }}
                  disabled={isBusy}
                  aria-label="Delete note"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="icon-sm" onClick={requestClose} disabled={isBusy} aria-label="Close note editor">
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
            {operationError ? <Alert variant="destructive" role="alert">{operationError}</Alert> : null}

            <div>
              <label htmlFor={titleId} className="mb-2 block text-sm font-black">Title</label>
              <Input
                ref={titleInputRef}
                id={titleId}
                placeholder="What did you learn?"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  setOperationError(null)
                }}
                maxLength={NOTE_TITLE_MAX_LENGTH}
                required
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleHintId}
                disabled={isBusy}
                className="text-lg font-black"
              />
              <p
                id={titleHintId}
                className={`mt-1.5 flex flex-wrap justify-between gap-2 text-xs font-bold ${titleError ? 'error-text' : 'text-muted-foreground'}`}
              >
                <span aria-live="polite">{titleError ?? 'Required'}</span>
                <span>{title.length}/{NOTE_TITLE_MAX_LENGTH}</span>
              </p>
            </div>

            <div className="min-h-0 flex-1">
              {isPreview ? (
                <p id={`${contentId}-label`} className="mb-2 block text-sm font-black">Preview</p>
              ) : (
                <label htmlFor={contentId} className="mb-2 block text-sm font-black">Note</label>
              )}
              {isPreview ? (
                <div
                  className="h-[calc(100%-1.75rem)] overflow-auto border-[3px] border-foreground bg-card p-4 sm:p-6"
                  aria-labelledby={`${contentId}-label`}
                  aria-describedby={contentHintId}
                >
                  {content ? <SafeMarkdown content={content} className="text-foreground" /> : <p className="italic text-muted-foreground">Nothing yet.</p>}
                </div>
              ) : (
                <Textarea
                  ref={contentInputRef}
                  id={contentId}
                  placeholder="Takeaway, question, example, or reflection…"
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value)
                    setOperationError(null)
                  }}
                  maxLength={NOTE_CONTENT_MAX_LENGTH}
                  required
                  aria-invalid={Boolean(contentError)}
                  aria-describedby={contentHintId}
                  disabled={isBusy}
                  className="h-[calc(100%-1.75rem)] min-h-48 resize-none font-mono text-sm leading-6"
                />
              )}
              <p
                id={contentHintId}
                className={`mt-1.5 flex flex-wrap justify-between gap-2 text-xs font-bold ${contentError ? 'error-text' : 'text-muted-foreground'}`}
              >
                <span aria-live="polite">{contentError ?? 'Required · Markdown'}</span>
                <span>{content.length.toLocaleString('en-US')}/{NOTE_CONTENT_MAX_LENGTH.toLocaleString('en-US')}</span>
              </p>
            </div>
          </div>

          <div className="hidden justify-end border-t-[3px] border-foreground bg-muted px-4 py-3 text-xs font-bold text-muted-foreground sm:flex">
            <span>Ctrl/⌘ S save · Ctrl/⌘ P preview</span>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!open && !isBusy) {
            setDeleteError(null)
            setShowDeleteConfirm(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>This note will be permanently deleted. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <Alert variant="destructive" role="alert" className="mx-6 mb-5">
              {deleteError}
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isBusy} onClick={(event) => { event.preventDefault(); void handleDelete() }}>
              {isBusy ? 'Deleting…' : 'Delete note'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>Unsaved edits will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onClose}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

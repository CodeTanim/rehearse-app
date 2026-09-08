'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { FileManager } from '@/components/file-upload/file-manager'
import { NoteEditor } from '@/components/notes/note-editor'
import { NoteList } from '@/components/notes/note-list'
import { Alert } from '@/components/ui/alert'
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
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFiles } from '@/hooks/use-files'
import { useNotes } from '@/hooks/use-notes'
import type { CreateNoteData, Note, UpdateNoteData } from '@/lib/types/file'
import type { SkillFolder } from '@/lib/types/skill-folder'

interface SkillFolderDetailProps {
  skillFolder: SkillFolder
  onClose?: () => void
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

type DetailTab = 'files' | 'notes'

type PendingFileDeletion = {
  id: string
  name: string
}

export function SkillFolderDetail({
  skillFolder,
  onClose,
  onEdit,
  onDelete,
  className = '',
}: SkillFolderDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('files')
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false)
  const [noteEditorMode, setNoteEditorMode] = useState<'create' | 'edit'>('create')
  const [pendingFileDeletion, setPendingFileDeletion] = useState<PendingFileDeletion | null>(null)
  const [isFileDeleting, setIsFileDeleting] = useState(false)
  const [fileDeletionError, setFileDeletionError] = useState<string | null>(null)

  const {
    files,
    uploadingFiles,
    isLoading: filesLoading,
    error: filesError,
    fetchFiles,
    uploadMultipleFiles,
    deleteFile,
    cancelUpload,
    retryUpload,
    removeFromUploadList,
  } = useFiles(skillFolder.id)
  const {
    notes,
    isLoading: notesLoading,
    error: notesError,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
  } = useNotes(skillFolder.id)

  useEffect(() => {
    void fetchFiles()
    void fetchNotes()
  }, [fetchFiles, fetchNotes])

  const handleFilesSelected = useCallback(async (fileList: FileList) => {
    try {
      await uploadMultipleFiles(fileList)
    } catch (error) {
      console.error('File upload failed:', error)
    }
  }, [uploadMultipleFiles])

  const requestFileDeletion = useCallback((fileId: string) => {
    const file = files.find((candidate) => candidate.id === fileId)
    setFileDeletionError(null)
    setPendingFileDeletion({
      id: fileId,
      name: file?.originalName || 'this file',
    })
  }, [files])

  const confirmFileDeletion = useCallback(async () => {
    if (!pendingFileDeletion) return

    setFileDeletionError(null)
    setIsFileDeleting(true)
    try {
      await deleteFile(pendingFileDeletion.id)
      setPendingFileDeletion(null)
      requestAnimationFrame(() => {
        const tabs = document.getElementById(`${skillFolder.id}-materials-tabs`)
        const activeTab = tabs?.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-state="active"]')
        activeTab?.focus()
      })
    } catch (caughtError) {
      setFileDeletionError(caughtError instanceof Error ? caughtError.message : 'The file could not be deleted.')
    } finally {
      setIsFileDeleting(false)
    }
  }, [deleteFile, pendingFileDeletion, skillFolder.id])

  const handleCreateNote = useCallback(() => {
    setSelectedNote(null)
    setNoteEditorMode('create')
    setIsNoteEditorOpen(true)
  }, [])

  const handleEditNote = useCallback((note: Note) => {
    setSelectedNote(note)
    setNoteEditorMode('edit')
    setIsNoteEditorOpen(true)
  }, [])

  const handleSaveNote = useCallback(async (data: CreateNoteData | UpdateNoteData) => {
    try {
      if (noteEditorMode === 'create') {
        await createNote(data as CreateNoteData)
      } else if (selectedNote) {
        await updateNote(selectedNote.id, data as UpdateNoteData)
      }
    } catch (error) {
      console.error('Note save failed:', error)
      throw error
    }
  }, [createNote, noteEditorMode, selectedNote, updateNote])

  const handleDeleteNote = useCallback(async () => {
    if (!selectedNote) return

    try {
      await deleteNote(selectedNote.id)
    } catch (error) {
      console.error('Note deletion failed:', error)
      throw error
    }
  }, [deleteNote, selectedNote])

  const handleNoteEditorClose = useCallback(() => {
    setIsNoteEditorOpen(false)
    setSelectedNote(null)
  }, [])

  const fileCount = files.length
  const noteCount = notes.length
  const uploadingCount = uploadingFiles.filter((file) => file.status === 'uploading').length
  return (
    <>
      <section className={`overflow-hidden rounded-lg border border-border ${className}`}>
        <header className="border-b border-border px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            {onClose ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeftIcon aria-hidden="true" className="size-4" />
                Library
              </Button>
            ) : <span />}
            {uploadingCount > 0 ? (
              <span className="text-sm text-info" role="status">
                {uploadingCount} uploading…
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: skillFolder.color || 'var(--pencil-ochre)' }}
                />
                <h1 className="break-words text-3xl font-semibold tracking-tight">
                  {skillFolder.name}
                </h1>
              </div>
              {skillFolder.description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                  {skillFolder.description}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {onEdit ? (
                <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit folder">
                  <PencilIcon aria-hidden="true" className="size-4" />
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onDelete}
                  aria-label="Delete folder"
                  className="text-destructive"
                >
                  <Trash2Icon aria-hidden="true" className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as DetailTab)}
          className="gap-0"
        >
          <div className="border-b border-border px-4 py-2 sm:px-6">
            <TabsList id={`${skillFolder.id}-materials-tabs`} aria-label="Folder materials" className="grid w-full grid-cols-2 gap-1 border-0 bg-transparent p-0 shadow-none sm:w-fit">
              <TabsTrigger value="files" className="font-medium shadow-none">
                Files <span aria-hidden="true">({fileCount})</span>
                <span className="sr-only">, {fileCount} total</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="font-medium shadow-none">
                Notes <span aria-hidden="true">({noteCount})</span>
                <span className="sr-only">, {noteCount} total</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4 sm:p-6">
            <TabsContent value="files">
              <h2 className="sr-only">Files</h2>
              <Alert variant="warning" className="mb-5 text-sm">
                <strong>Test files only.</strong> No private content.
              </Alert>
              <FileManager
                files={files}
                uploadingFiles={uploadingFiles}
                isLoading={filesLoading}
                onFilesSelected={handleFilesSelected}
                onFileDelete={requestFileDeletion}
                onCancelUpload={cancelUpload}
                onRetryUpload={retryUpload}
                onRemoveFromUploadList={removeFromUploadList}
                showUploadZone
              />
            </TabsContent>
            <TabsContent value="notes">
              <h2 className="sr-only">Notes</h2>
              <NoteList
                notes={notes}
                onNoteEdit={handleEditNote}
                onNoteDelete={deleteNote}
                onCreateNote={handleCreateNote}
                isLoading={notesLoading}
              />
            </TabsContent>

            {filesError || notesError ? (
              <Alert role="alert" variant="destructive" className="mt-5">
                {filesError || notesError}
              </Alert>
            ) : null}
          </div>
        </Tabs>
      </section>

      <NoteEditor
        note={selectedNote}
        isOpen={isNoteEditorOpen}
        onClose={handleNoteEditorClose}
        onSave={handleSaveNote}
        onDelete={noteEditorMode === 'edit' ? handleDeleteNote : undefined}
        mode={noteEditorMode}
        isLoading={notesLoading}
      />

      <AlertDialog
        open={pendingFileDeletion !== null}
        onOpenChange={(open) => {
          if (!open && !isFileDeleting) {
            setFileDeletionError(null)
            setPendingFileDeletion(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingFileDeletion?.name}”?</AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">
              This file will be permanently deleted. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {fileDeletionError ? <Alert role="alert" variant="destructive" className="mx-6 mb-5">{fileDeletionError}</Alert> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isFileDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                void confirmFileDeletion()
              }}
              disabled={isFileDeleting}
            >
              {isFileDeleting ? 'Deleting…' : 'Delete file'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

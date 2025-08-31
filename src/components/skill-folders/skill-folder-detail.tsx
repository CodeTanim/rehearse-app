'use client'

import { useState, useCallback, useEffect } from 'react'
import { useFiles } from '@/hooks/use-files'
import { useNotes } from '@/hooks/use-notes'
import { FileManager } from '@/components/file-upload/file-manager'
import { NoteList } from '@/components/notes/note-list'
import { NoteEditor } from '@/components/notes/note-editor'
import { Button } from '@/components/ui/button'
import { Note, CreateNoteData, UpdateNoteData } from '@/lib/types/file'

interface SkillFolder {
  id: string
  name: string
  description?: string | null
  color?: string | null
  createdAt: Date
  updatedAt: Date
  userId: string
}

interface SkillFolderDetailProps {
  skillFolder: SkillFolder
  onClose?: () => void
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

export function SkillFolderDetail({
  skillFolder,
  onClose,
  onEdit,
  onDelete,
  className = ''
}: SkillFolderDetailProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'notes'>('files')
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false)
  const [noteEditorMode, setNoteEditorMode] = useState<'create' | 'edit'>('create')

  // Hooks for managing files and notes
  const fileManager = useFiles(skillFolder.id)
  const noteManager = useNotes(skillFolder.id)

  // Fetch data on mount
  useEffect(() => {
    fileManager.fetchFiles()
    noteManager.fetchNotes()
  }, [fileManager.fetchFiles, noteManager.fetchNotes])

  // File handlers
  const handleFilesSelected = useCallback(async (fileList: FileList) => {
    try {
      await fileManager.uploadMultipleFiles(fileList)
    } catch (error) {
      console.error('File upload failed:', error)
    }
  }, [fileManager])

  const handleFileDelete = useCallback(async (fileId: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      try {
        await fileManager.deleteFile(fileId)
      } catch (error) {
        console.error('File deletion failed:', error)
      }
    }
  }, [fileManager])

  // Note handlers
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
        await noteManager.createNote(data as CreateNoteData)
      } else if (selectedNote) {
        await noteManager.updateNote(selectedNote.id, data as UpdateNoteData)
      }
    } catch (error) {
      console.error('Note save failed:', error)
      throw error // Re-throw to let the editor handle the error
    }
  }, [noteEditorMode, selectedNote, noteManager])

  const handleDeleteNote = useCallback(async () => {
    if (!selectedNote) return
    
    try {
      await noteManager.deleteNote(selectedNote.id)
    } catch (error) {
      console.error('Note deletion failed:', error)
      throw error // Re-throw to let the editor handle the error
    }
  }, [selectedNote, noteManager])

  const handleNoteEditorClose = useCallback(() => {
    setIsNoteEditorOpen(false)
    setSelectedNote(null)
  }, [])

  const fileCounts = {
    total: fileManager.files.length,
    uploading: fileManager.uploadingFiles.filter(f => f.status === 'uploading').length,
    completed: fileManager.uploadingFiles.filter(f => f.status === 'completed').length,
    failed: fileManager.uploadingFiles.filter(f => f.status === 'error').length
  }

  const noteCounts = {
    total: noteManager.notes.length
  }

  return (
    <>
      <div className={`bg-card border border-border rounded-lg shadow-sm ${className}`}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center text-accent-foreground"
                style={{ backgroundColor: skillFolder.color || '#E6A045' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a1 1 0 00-1-1H6a1 1 0 00-1-1V7a2 2 0 012-2h4l2 2h6a2 2 0 012 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{skillFolder.name}</h1>
                {skillFolder.description && (
                  <p className="text-muted-foreground mt-1">{skillFolder.description}</p>
                )}
                <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                  <span>{fileCounts.total} files</span>
                  <span>•</span>
                  <span>{noteCounts.total} notes</span>
                  <span>•</span>
                  <span>Created {new Date(skillFolder.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </Button>
              )}
              
              {onDelete && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive/80"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </Button>
              )}

              {onClose && (
                <Button variant="outline" size="sm" onClick={onClose}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex space-x-0">
            <button
              onClick={() => setActiveTab('files')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'files'
                  ? 'border-accent text-accent bg-accent/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Files</span>
                <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                  {fileCounts.total}
                </span>
                {fileCounts.uploading > 0 && (
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                )}
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'notes'
                  ? 'border-accent text-accent bg-accent/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Notes</span>
                <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                  {noteCounts.total}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'files' ? (
            <FileManager
              files={fileManager.files}
              uploadingFiles={fileManager.uploadingFiles}
              isLoading={fileManager.isLoading}
              error={fileManager.error}
              onFilesSelected={handleFilesSelected}
              onFileDelete={handleFileDelete}
              onCancelUpload={fileManager.cancelUpload}
              onRetryUpload={fileManager.retryUpload}
              onRemoveFromUploadList={fileManager.removeFromUploadList}
              showUploadZone={true}
            />
          ) : (
            <NoteList
              notes={noteManager.notes}
              onNoteEdit={handleEditNote}
              onNoteDelete={noteManager.deleteNote}
              onCreateNote={handleCreateNote}
              isLoading={noteManager.isLoading}
            />
          )}

          {/* Error Display */}
          {(fileManager.error || noteManager.error) && (
            <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-destructive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-destructive font-medium">Error</p>
              </div>
              <p className="text-destructive/80 mt-1">
                {fileManager.error || noteManager.error}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Note Editor Modal */}
      <NoteEditor
        note={selectedNote}
        isOpen={isNoteEditorOpen}
        onClose={handleNoteEditorClose}
        onSave={handleSaveNote}
        onDelete={noteEditorMode === 'edit' ? handleDeleteNote : undefined}
        mode={noteEditorMode}
        isLoading={noteManager.isLoading}
      />
    </>
  )
}
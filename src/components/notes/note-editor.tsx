'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Note, CreateNoteData, UpdateNoteData } from '@/lib/types/file'

interface NoteEditorProps {
  note?: Note | null
  isOpen: boolean
  onClose: () => void
  onSave: (data: CreateNoteData | UpdateNoteData) => Promise<void>
  onDelete?: () => Promise<void>
  isLoading?: boolean
  mode?: 'create' | 'edit'
}

export function NoteEditor({
  note,
  isOpen,
  onClose,
  onSave,
  onDelete,
  isLoading = false,
  mode = note ? 'edit' : 'create'
}: NoteEditorProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const titleInputRef = useRef<HTMLInputElement>(null)
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Initialize form data
  useEffect(() => {
    if (isOpen) {
      setTitle(note?.title || '')
      setContent(note?.content || '')
      setIsDirty(false)
      setIsPreview(false)
      setShowDeleteConfirm(false)
      
      // Focus title input for new notes, content for existing notes
      setTimeout(() => {
        if (mode === 'create') {
          titleInputRef.current?.focus()
        } else {
          contentTextareaRef.current?.focus()
        }
      }, 100)
    }
  }, [isOpen, note, mode])

  // Track dirty state
  useEffect(() => {
    const originalTitle = note?.title || ''
    const originalContent = note?.content || ''
    setIsDirty(title !== originalTitle || content !== originalContent)
  }, [title, content, note])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty && !isSaving) {
          handleSave()
        }
      }

      // Cmd/Ctrl + P to toggle preview
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setIsPreview(!isPreview)
      }

      // Escape to close (with confirmation if dirty)
      if (e.key === 'Escape') {
        if (isDirty) {
          if (confirm('You have unsaved changes. Are you sure you want to close?')) {
            onClose()
          }
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDirty, isSaving, isPreview, onClose])

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      alert('Please enter a title for your note')
      titleInputRef.current?.focus()
      return
    }

    setIsSaving(true)
    try {
      if (mode === 'create') {
        await onSave({ title: title.trim(), content: content.trim() })
      } else {
        await onSave({ title: title.trim(), content: content.trim() })
      }
      setIsDirty(false)
      onClose()
    } catch (error) {
      console.error('Failed to save note:', error)
      alert('Failed to save note. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [title, content, mode, onSave, onClose])

  const handleDelete = useCallback(async () => {
    if (!onDelete) return
    
    setIsSaving(true)
    try {
      await onDelete()
      setShowDeleteConfirm(false)
      onClose()
    } catch (error) {
      console.error('Failed to delete note:', error)
      alert('Failed to delete note. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [onDelete, onClose])

  const handleClose = useCallback(() => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }, [isDirty, onClose])

  // Auto-resize textarea
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    
    // Auto-resize
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  // Simple markdown preview rendering
  const renderMarkdownPreview = useCallback((markdown: string) => {
    // Basic markdown rendering - in a real app, you'd use a proper markdown library
    return markdown
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mb-3">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-medium mb-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/^\* (.*$)/gm, '<li class="ml-4">• $1</li>')
      .replace(/^\d+\. (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/^(?!<[h1-6]|<li|<\/p>)(.*$)/gm, '<p class="mb-4">$1</p>')
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        />
        
        {/* Modal */}
        <div className="relative bg-card rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] mx-auto flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-card">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center">
                <span className="text-lg">📝</span>
              </div>
              <div>
                <h3 className="font-medium text-foreground">
                  {mode === 'create' ? 'Create New Note' : 'Edit Note'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isDirty ? 'Unsaved changes' : 'All changes saved'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Preview Toggle */}
              <Button
                variant={isPreview ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPreview(!isPreview)}
                disabled={isSaving}
              >
                {isPreview ? '📝 Edit' : '👁️ Preview'}
              </Button>
              
              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={!isDirty || !title.trim() || isSaving}
                size="sm"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
                {mode === 'create' ? 'Create Note' : 'Save Changes'}
              </Button>
              
              {/* Delete Button */}
              {mode === 'edit' && onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving}
                  className="text-destructive hover:text-destructive/80"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              )}
              
              {/* Close Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isSaving}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Title Input */}
            <div className="p-4 border-b border-border">
              <input
                ref={titleInputRef}
                type="text"
                placeholder="Note title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSaving}
                className="w-full text-xl font-semibold bg-transparent border-none outline-none placeholder-muted-foreground text-foreground"
              />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              {isPreview ? (
                // Preview Mode
                <div className="h-full overflow-auto p-6 prose prose-sm max-w-none">
                  <div 
                    className="text-foreground"
                    dangerouslySetInnerHTML={{ 
                      __html: content ? renderMarkdownPreview(content) : '<p class="text-muted-foreground italic">Nothing to preview...</p>'
                    }}
                  />
                </div>
              ) : (
                // Edit Mode
                <div className="h-full p-4">
                  <textarea
                    ref={contentTextareaRef}
                    placeholder="Write your note content here... (Markdown supported)"
                    value={content}
                    onChange={handleContentChange}
                    disabled={isSaving}
                    className="w-full h-full bg-transparent border-none outline-none resize-none placeholder-muted-foreground text-foreground font-mono text-sm leading-relaxed"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/30">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center space-x-4">
                  <span>{content.length} characters</span>
                  <span>{content.split(/\s+/).filter(word => word.length > 0).length} words</span>
                  <span>{content.split('\n').length} lines</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span>Ctrl+S to save</span>
                  <span>Ctrl+P to preview</span>
                  <span>Esc to close</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 overflow-hidden">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <div className="relative bg-card rounded-lg shadow-2xl max-w-md w-full mx-auto p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Delete Note</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-foreground mb-6">
                Are you sure you want to delete &quot;<strong>{title}</strong>&quot;?
              </p>
              
              <div className="flex items-center justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  ) : null}
                  Delete Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
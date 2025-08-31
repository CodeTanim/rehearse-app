'use client'

import { useState, useCallback } from 'react'
import { Note } from '@/lib/types/file'
import { Button } from '@/components/ui/button'

interface NoteListProps {
  notes: Note[]
  onNoteClick?: (note: Note) => void
  onNoteEdit?: (note: Note) => void
  onNoteDelete?: (noteId: string) => void
  onCreateNote?: () => void
  isLoading?: boolean
  className?: string
}

export function NoteList({
  notes,
  onNoteClick,
  onNoteEdit,
  onNoteDelete,
  onCreateNote,
  isLoading = false,
  className = ''
}: NoteListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'created' | 'updated'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleSort = useCallback((newSortBy: typeof sortBy) => {
    if (newSortBy === sortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('desc')
    }
  }, [sortBy])

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    let compareValue = 0
    
    switch (sortBy) {
      case 'title':
        compareValue = a.title.localeCompare(b.title)
        break
      case 'created':
        compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        break
      case 'updated':
        compareValue = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        break
    }
    
    return sortOrder === 'asc' ? compareValue : -compareValue
  })

  const handleNoteClick = useCallback((note: Note) => {
    if (onNoteClick) {
      onNoteClick(note)
    } else if (onNoteEdit) {
      onNoteEdit(note)
    }
  }, [onNoteClick, onNoteEdit])

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength).trim() + '...'
  }

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    const now = new Date()
    const diffInHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return d.toLocaleTimeString(undefined, { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    } else if (diffInHours < 24 * 7) {
      return d.toLocaleDateString(undefined, { 
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit'
      })
    } else {
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  const getSortIcon = (column: typeof sortBy) => {
    if (sortBy !== column) {
      return (
        <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    
    return sortOrder === 'asc' ? (
      <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
      </svg>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading notes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left side - Note count and create button */}
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{notes.length}</span> notes
          </div>
          
          {onCreateNote && (
            <Button
              onClick={onCreateNote}
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Note
            </Button>
          )}
        </div>

        {/* Right side - Search and sort */}
        <div className="flex items-center space-x-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-8 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent w-48"
            />
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground hover:text-foreground"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center space-x-1 border border-border rounded-md">
            <button
              onClick={() => handleSort('title')}
              className={`px-3 py-2 text-sm flex items-center space-x-1 rounded-l-md transition-colors ${
                sortBy === 'title' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Title</span>
              {getSortIcon('title')}
            </button>
            <button
              onClick={() => handleSort('updated')}
              className={`px-3 py-2 text-sm flex items-center space-x-1 border-l border-border transition-colors ${
                sortBy === 'updated' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Modified</span>
              {getSortIcon('updated')}
            </button>
            <button
              onClick={() => handleSort('created')}
              className={`px-3 py-2 text-sm flex items-center space-x-1 rounded-r-md transition-colors ${
                sortBy === 'created' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Created</span>
              {getSortIcon('created')}
            </button>
          </div>
        </div>
      </div>

      {/* Notes List */}
      {sortedNotes.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📝</span>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm ? 'No notes found' : 'No notes yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? `No notes match "${searchTerm}"`
                : 'Create your first note to get started'
              }
            </p>
            {searchTerm ? (
              <Button
                variant="outline"
                onClick={() => setSearchTerm('')}
              >
                Clear search
              </Button>
            ) : onCreateNote ? (
              <Button
                onClick={onCreateNote}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Note
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedNotes.map((note) => (
            <div
              key={note.id}
              className="group bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => handleNoteClick(note)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">📝</span>
                  </div>
                  <h3 className="font-medium text-foreground truncate">{note.title}</h3>
                </div>
                
                {/* Actions */}
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onNoteEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onNoteEdit(note)
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Button>
                  )}
                  
                  {onNoteDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Are you sure you want to delete "${note.title}"?`)) {
                          onNoteDelete(note.id)
                        }
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>

              {/* Content Preview */}
              <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                {truncateContent(note.content)}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Modified {formatDate(note.updatedAt)}</span>
                <span>{note.content.length} chars</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
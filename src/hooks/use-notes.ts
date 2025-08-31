import { useState, useCallback } from 'react'
import { Note, CreateNoteData, UpdateNoteData } from '@/lib/types/file'

export function useNotes(skillFolderId: string) {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${skillFolderId}/notes`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch notes')
      }
      
      const data = await response.json()
      setNotes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [skillFolderId])

  const createNote = useCallback(async (data: CreateNoteData): Promise<Note | null> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${skillFolderId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create note')
      }
      
      const newNote = await response.json()
      
      // Update notes list
      setNotes(prev => [newNote, ...prev])
      
      return newNote
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [skillFolderId])

  const updateNote = useCallback(async (noteId: string, data: UpdateNoteData): Promise<Note | null> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${skillFolderId}/notes/${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update note')
      }
      
      const updatedNote = await response.json()
      
      // Update notes list
      setNotes(prev => prev.map(note => 
        note.id === noteId ? updatedNote : note
      ))
      
      return updatedNote
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [skillFolderId])

  const deleteNote = useCallback(async (noteId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${skillFolderId}/notes/${noteId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete note')
      }
      
      setNotes(prev => prev.filter(note => note.id !== noteId))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [skillFolderId])

  const getNote = useCallback(async (noteId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${skillFolderId}/notes/${noteId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch note')
      }
      
      return await response.json()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [skillFolderId])

  const duplicateNote = useCallback(async (noteId: string): Promise<Note | null> => {
    const note = notes.find(n => n.id === noteId)
    if (!note) {
      throw new Error('Note not found')
    }

    const duplicateData: CreateNoteData = {
      title: `${note.title} (Copy)`,
      content: note.content
    }

    return await createNote(duplicateData)
  }, [notes, createNote])

  return {
    notes,
    isLoading,
    error,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    getNote,
    duplicateNote,
  }
}
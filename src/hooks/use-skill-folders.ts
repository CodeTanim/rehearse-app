import { useState, useCallback } from 'react'
import { SkillFolder, CreateSkillFolderData, UpdateSkillFolderData } from '@/lib/types/skill-folder'

export function useSkillFolders() {
  const [skillFolders, setSkillFolders] = useState<SkillFolder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSkillFolders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/skill-folders')
      
      if (!response.ok) {
        throw new Error('Failed to fetch skill folders')
      }
      
      const data = await response.json()
      setSkillFolders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createSkillFolder = useCallback(async (data: CreateSkillFolderData) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/skill-folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create skill folder')
      }
      
      const newFolder = await response.json()
      setSkillFolders(prev => [newFolder, ...prev])
      return newFolder
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateSkillFolder = useCallback(async (id: string, data: UpdateSkillFolderData) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update skill folder')
      }
      
      const updatedFolder = await response.json()
      setSkillFolders(prev => 
        prev.map(folder => folder.id === id ? updatedFolder : folder)
      )
      return updatedFolder
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const deleteSkillFolder = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete skill folder')
      }
      
      setSkillFolders(prev => prev.filter(folder => folder.id !== id))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getSkillFolder = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch skill folder')
      }
      
      return await response.json()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    skillFolders,
    isLoading,
    error,
    fetchSkillFolders,
    createSkillFolder,
    updateSkillFolder,
    deleteSkillFolder,
    getSkillFolder,
  }
}
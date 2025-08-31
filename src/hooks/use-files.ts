import { useState, useCallback } from 'react'
import { FileWithMetadata, FileUploadResponse } from '@/lib/types/file'
import { useUploadProgress, UploadingFile } from '@/components/file-upload/upload-progress'
import { uploadFileWithProgress, uploadMultipleFilesWithProgress } from '@/lib/upload-with-progress'

export function useFiles(skillFolderId: string) {
  const [files, setFiles] = useState<FileWithMetadata[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Upload progress management
  const uploadProgressManager = useUploadProgress()

  const fetchFiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${skillFolderId}/files`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch files')
      }
      
      const data = await response.json()
      setFiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [skillFolderId])

  const uploadFile = useCallback(async (file: File): Promise<FileUploadResponse | null> => {
    const uploadId = uploadProgressManager.addFile(file)
    setError(null)
    
    try {
      const uploader = uploadFileWithProgress(
        `/api/skill-folders/${skillFolderId}/files`,
        file,
        {
          onProgress: (progress) => {
            uploadProgressManager.updateProgress(uploadId, progress)
          },
          onSuccess: (uploadedFile) => {
            // Update files list and mark as completed
            setFiles(prev => [uploadedFile as FileWithMetadata, ...prev])
            const file = uploadedFile as FileWithMetadata
            uploadProgressManager.markCompleted(uploadId, {
              id: file.id,
              url: file.filename,
              originalName: file.originalName,
              size: file.size,
              mimeType: file.mimeType
            })
          },
          onError: (error) => {
            setError(error.message)
            uploadProgressManager.markError(uploadId, error.message)
          }
        }
      )
      
      const result = await uploader.upload()
      return result as FileUploadResponse
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      // Error already handled in onError callback
      throw new Error(errorMessage)
    }
  }, [skillFolderId, uploadProgressManager])

  const uploadMultipleFiles = useCallback(async (fileList: FileList | File[]): Promise<FileUploadResponse[]> => {
    const files = Array.from(fileList)
    setError(null)
    
    // Add all files to upload progress first
    const uploadIds = files.map(file => uploadProgressManager.addFile(file))
    
    try {
      const multiUploader = uploadMultipleFilesWithProgress(
        `/api/skill-folders/${skillFolderId}/files`,
        files,
        {
          onFileProgress: (fileId, progress) => {
            const index = parseInt(fileId.split('-').pop() || '0')
            if (uploadIds[index]) {
              uploadProgressManager.updateProgress(uploadIds[index], progress)
            }
          },
          onFileComplete: (fileId, uploadedFile) => {
            const index = parseInt(fileId.split('-').pop() || '0')
            if (uploadIds[index]) {
              const file = uploadedFile as FileWithMetadata
              setFiles(prev => [file, ...prev])
              uploadProgressManager.markCompleted(uploadIds[index], {
                id: file.id,
                url: file.filename,
                originalName: file.originalName,
                size: file.size,
                mimeType: file.mimeType
              })
            }
          },
          onFileError: (fileId, error) => {
            const index = parseInt(fileId.split('-').pop() || '0')
            if (uploadIds[index]) {
              uploadProgressManager.markError(uploadIds[index], error.message)
            }
          }
        }
      )
      
      const result = await multiUploader.uploadAll()
      return result.successful as FileUploadResponse[]
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      return []
    }
  }, [skillFolderId, uploadProgressManager])

  const cancelUpload = useCallback((uploadId: string) => {
    uploadProgressManager.markCancelled(uploadId)
  }, [uploadProgressManager])

  const retryUpload = useCallback(async (uploadId: string) => {
    const uploadingFile = uploadProgressManager.uploadingFiles.find(f => f.id === uploadId)
    if (uploadingFile) {
      // Remove the failed upload and start a new one
      uploadProgressManager.removeFile(uploadId)
      await uploadFile(uploadingFile.file)
    }
  }, [uploadProgressManager, uploadFile])

  const deleteFile = useCallback(async (fileId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${skillFolderId}/files/${fileId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete file')
      }
      
      setFiles(prev => prev.filter(file => file.id !== fileId))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [skillFolderId])

  const getFileUrl = useCallback((fileId: string, type: 'view' | 'download' = 'view') => {
    return `/api/files/${fileId}/${type}`
  }, [])

  const getFile = useCallback(async (fileId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${skillFolderId}/files/${fileId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch file')
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

  return {
    files,
    isLoading,
    error,
    fetchFiles,
    uploadFile,
    uploadMultipleFiles,
    deleteFile,
    getFileUrl,
    getFile,
    // Upload progress management
    uploadingFiles: uploadProgressManager.uploadingFiles,
    cancelUpload,
    retryUpload,
    removeFromUploadList: uploadProgressManager.removeFile,
    clearCompletedUploads: uploadProgressManager.clearCompleted,
  }
}
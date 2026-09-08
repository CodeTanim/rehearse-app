import { useCallback, useEffect, useRef, useState } from 'react'
import { FileWithMetadata, FileUploadResponse } from '@/lib/types/file'
import { useUploadProgress } from '@/components/file-upload/upload-progress'
import {
  isUploadCancelledError,
  uploadFileWithProgress,
  type UploadWithProgress,
} from '@/lib/upload-with-progress'

interface ActiveUpload {
  controller: AbortController
  uploader: UploadWithProgress
  attempt: symbol
}

export function useFiles(skillFolderId: string) {
  const [files, setFiles] = useState<FileWithMetadata[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const {
    uploadingFiles,
    addFile,
    updateProgress,
    markCompleted,
    markError,
    markCancelled,
    removeFile,
    clearCompleted,
  } = useUploadProgress()
  const activeUploadsRef = useRef(new Map<string, ActiveUpload>())
  const isMountedRef = useRef(true)

  useEffect(() => {
    const activeUploads = activeUploadsRef.current
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      activeUploads.forEach(({ controller }) => controller.abort())
      activeUploads.clear()
    }
  }, [])

  const fetchFiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${skillFolderId}/files`)
      
      if (!response.ok) {
        throw new Error('Couldn’t load files.')
      }
      
      const data = await response.json()
      setFiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsLoading(false)
    }
  }, [skillFolderId])

  const uploadTrackedFile = useCallback(async (
    file: File,
    uploadId: string,
  ): Promise<FileUploadResponse | null> => {
    const attempt = Symbol(uploadId)
    const controller = new AbortController()
    const isCurrentAttempt = () => {
      const activeUpload = activeUploadsRef.current.get(uploadId)
      return isMountedRef.current && activeUpload?.attempt === attempt
    }

    const uploader = uploadFileWithProgress(
      `/api/skill-folders/${skillFolderId}/files`,
      file,
      {
        signal: controller.signal,
        onProgress: (progress) => {
          if (isCurrentAttempt()) updateProgress(uploadId, progress)
        },
        onSuccess: (uploadedFile) => {
          if (!isCurrentAttempt()) return

          const uploadedFileWithMetadata = uploadedFile as FileWithMetadata
          setFiles((current) => [uploadedFileWithMetadata, ...current])
          markCompleted(uploadId, {
            id: uploadedFileWithMetadata.id,
            url: uploadedFileWithMetadata.filename,
            originalName: uploadedFileWithMetadata.originalName,
            size: uploadedFileWithMetadata.size,
            mimeType: uploadedFileWithMetadata.mimeType,
          })
        },
        onError: (uploadError) => {
          if (!isCurrentAttempt()) return
          setError(uploadError.message)
          markError(uploadId, uploadError.message)
        },
        onCancel: () => {
          if (isCurrentAttempt()) markCancelled(uploadId)
        },
      },
    )

    activeUploadsRef.current.set(uploadId, { controller, uploader, attempt })

    try {
      const result = await uploader.upload()
      return result as FileUploadResponse
    } catch (uploadError) {
      if (isUploadCancelledError(uploadError)) return null
      throw uploadError
    } finally {
      if (activeUploadsRef.current.get(uploadId)?.attempt === attempt) {
        activeUploadsRef.current.delete(uploadId)
      }
    }
  }, [markCancelled, markCompleted, markError, skillFolderId, updateProgress])

  const uploadFile = useCallback(async (file: File): Promise<FileUploadResponse | null> => {
    const uploadId = addFile(file)
    setError(null)
    return uploadTrackedFile(file, uploadId)
  }, [addFile, uploadTrackedFile])

  const uploadMultipleFiles = useCallback(async (fileList: FileList | File[]): Promise<FileUploadResponse[]> => {
    const selectedFiles = Array.from(fileList)
    setError(null)

    const uploads = selectedFiles.map((file) => ({ file, uploadId: addFile(file) }))
    const results = await Promise.all(
      uploads.map(async ({ file, uploadId }) => {
        try {
          return await uploadTrackedFile(file, uploadId)
        } catch {
          // The row-level callback already exposes a retryable error state.
          return null
        }
      }),
    )

    return results.filter((result): result is FileUploadResponse => result !== null)
  }, [addFile, uploadTrackedFile])

  const cancelUpload = useCallback((uploadId: string) => {
    const activeUpload = activeUploadsRef.current.get(uploadId)
    if (!activeUpload || activeUpload.controller.signal.aborted || !activeUpload.uploader.isUploading) return

    activeUpload.controller.abort()
  }, [])

  const retryUpload = useCallback(async (uploadId: string) => {
    const uploadingFile = uploadingFiles.find((file) => file.id === uploadId)
    if (uploadingFile) {
      // Remove the failed upload and start a new one
      removeFile(uploadId)
      try {
        await uploadFile(uploadingFile.file)
      } catch {
        // The replacement row already exposes a retryable error state.
      }
    }
  }, [removeFile, uploadFile, uploadingFiles])

  const removeFromUploadList = useCallback((uploadId: string) => {
    const activeUpload = activeUploadsRef.current.get(uploadId)
    activeUpload?.controller.abort()
    removeFile(uploadId)
  }, [removeFile])

  const deleteFile = useCallback(async (fileId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/skill-folders/${skillFolderId}/files/${fileId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Couldn’t delete file.')
      }
      
      setFiles(prev => prev.filter(file => file.id !== fileId))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong.'
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
        throw new Error('Couldn’t load file.')
      }
      
      return await response.json()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong.'
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
    uploadingFiles,
    cancelUpload,
    retryUpload,
    removeFromUploadList,
    clearCompletedUploads: clearCompleted,
  }
}

'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { FileIcons } from '@/lib/file-icons'

export interface UploadingFile {
  id: string
  file: File
  progress: number
  status: 'uploading' | 'completed' | 'error' | 'cancelled'
  error?: string
  uploadedFile?: {
    id: string
    url: string
    originalName: string
    size: number
    mimeType: string
  }
}

interface UploadProgressProps {
  uploadingFiles: UploadingFile[]
  onCancelUpload?: (fileId: string) => void
  onRemoveFromList?: (fileId: string) => void
  onRetryUpload?: (fileId: string) => void
  className?: string
}

export function UploadProgress({ 
  uploadingFiles, 
  onCancelUpload, 
  onRemoveFromList, 
  onRetryUpload, 
  className = '' 
}: UploadProgressProps) {
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set())

  const toggleCollapse = useCallback((fileId: string) => {
    setCollapsedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fileId)) {
        newSet.delete(fileId)
      } else {
        newSet.add(fileId)
      }
      return newSet
    })
  }, [])

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  const formatUploadSpeed = (bytesPerSecond: number): string => {
    return `${formatFileSize(bytesPerSecond)}/s`
  }

  const getStatusIcon = (status: UploadingFile['status']) => {
    switch (status) {
      case 'uploading':
        return (
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'error':
        return (
          <svg className="w-4 h-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'cancelled':
        return (
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636" />
          </svg>
        )
    }
  }

  const getStatusColor = (status: UploadingFile['status']) => {
    switch (status) {
      case 'uploading': return 'bg-accent'
      case 'completed': return 'bg-green-500'
      case 'error': return 'bg-destructive'
      case 'cancelled': return 'bg-muted-foreground'
    }
  }

  const getStatusText = (uploadingFile: UploadingFile) => {
    switch (uploadingFile.status) {
      case 'uploading':
        return `Uploading... ${Math.round(uploadingFile.progress)}%`
      case 'completed':
        return 'Upload complete'
      case 'error':
        return uploadingFile.error || 'Upload failed'
      case 'cancelled':
        return 'Upload cancelled'
    }
  }

  if (uploadingFiles.length === 0) {
    return null
  }

  const completedCount = uploadingFiles.filter(f => f.status === 'completed').length
  const errorCount = uploadingFiles.filter(f => f.status === 'error').length
  const uploadingCount = uploadingFiles.filter(f => f.status === 'uploading').length

  return (
    <div className={`bg-card border border-border rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h3 className="font-medium text-foreground">File Uploads</h3>
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            {uploadingCount > 0 && (
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                <span>{uploadingCount} uploading</span>
              </span>
            )}
            {completedCount > 0 && (
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>{completedCount} completed</span>
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-destructive rounded-full" />
                <span>{errorCount} failed</span>
              </span>
            )}
          </div>
        </div>

        {/* Clear completed/failed button */}
        {(completedCount > 0 || errorCount > 0) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              uploadingFiles
                .filter(f => f.status === 'completed' || f.status === 'error')
                .forEach(f => onRemoveFromList?.(f.id))
            }}
          >
            Clear finished
          </Button>
        )}
      </div>

      {/* File List */}
      <div className="max-h-80 overflow-y-auto">
        {uploadingFiles.map((uploadingFile) => {
          const isCollapsed = collapsedItems.has(uploadingFile.id)
          const fileIcon = FileIcons.getFileIcon(uploadingFile.file.type)
          
          return (
            <div key={uploadingFile.id} className="border-b border-border last:border-b-0">
              <div className="flex items-center space-x-3 p-4">
                {/* File Icon */}
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <span className="text-lg">{fileIcon}</span>
                  </div>
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {uploadingFile.file.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(uploadingFile.file.size)} • {uploadingFile.file.type}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {getStatusIcon(uploadingFile.status)}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1">
                        {uploadingFile.status === 'uploading' && onCancelUpload && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCancelUpload(uploadingFile.id)}
                            className="h-8 w-8 p-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </Button>
                        )}
                        
                        {uploadingFile.status === 'error' && onRetryUpload && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRetryUpload(uploadingFile.id)}
                            className="h-8 w-8 p-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </Button>
                        )}
                        
                        {(uploadingFile.status === 'completed' || uploadingFile.status === 'error' || uploadingFile.status === 'cancelled') && onRemoveFromList && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveFromList(uploadingFile.id)}
                            className="h-8 w-8 p-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Text */}
                  <div className="mt-2">
                    <p className={`text-sm ${
                      uploadingFile.status === 'error' ? 'text-destructive' : 
                      uploadingFile.status === 'completed' ? 'text-green-600' : 
                      'text-muted-foreground'
                    }`}>
                      {getStatusText(uploadingFile)}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  {uploadingFile.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(uploadingFile.status)}`}
                          style={{ width: `${uploadingFile.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Hook for managing upload progress state
export function useUploadProgress() {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  const addFile = useCallback((file: File): string => {
    const id = Math.random().toString(36).substr(2, 9)
    const uploadingFile: UploadingFile = {
      id,
      file,
      progress: 0,
      status: 'uploading'
    }
    setUploadingFiles(prev => [...prev, uploadingFile])
    return id
  }, [])

  const updateProgress = useCallback((fileId: string, progress: number) => {
    setUploadingFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, progress } : file
      )
    )
  }, [])

  const markCompleted = useCallback((fileId: string, uploadedFile: UploadingFile['uploadedFile']) => {
    setUploadingFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, status: 'completed', progress: 100, uploadedFile } : file
      )
    )
  }, [])

  const markError = useCallback((fileId: string, error: string) => {
    setUploadingFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, status: 'error', error } : file
      )
    )
  }, [])

  const markCancelled = useCallback((fileId: string) => {
    setUploadingFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, status: 'cancelled' } : file
      )
    )
  }, [])

  const removeFile = useCallback((fileId: string) => {
    setUploadingFiles(prev => prev.filter(file => file.id !== fileId))
  }, [])

  const clearCompleted = useCallback(() => {
    setUploadingFiles(prev => prev.filter(file => file.status !== 'completed'))
  }, [])

  const clearAll = useCallback(() => {
    setUploadingFiles([])
  }, [])

  return {
    uploadingFiles,
    addFile,
    updateProgress,
    markCompleted,
    markError,
    markCancelled,
    removeFile,
    clearCompleted,
    clearAll
  }
}
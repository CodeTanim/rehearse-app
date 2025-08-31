'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { STORAGE_CONFIG, FileUtils } from '@/lib/file-utils'
import { SUPPORTED_FILE_TYPES } from '@/lib/types/file'

interface FileUploadZoneProps {
  onFilesSelected: (files: FileList) => void
  disabled?: boolean
  maxFiles?: number
  className?: string
  onValidationError?: (errors: string[]) => void
}

export function FileUploadZone({ 
  onFilesSelected, 
  disabled = false, 
  maxFiles = 10,
  className = '',
  onValidationError
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateAndFilterFiles = useCallback((fileList: FileList): { validFiles: File[]; errors: string[] } => {
    const files = Array.from(fileList)
    const validFiles: File[] = []
    const errors: string[] = []

    // Check file count
    if (files.length > maxFiles) {
      errors.push(`You can only upload ${maxFiles} files at once`)
      return { validFiles: [], errors }
    }

    // Validate each file
    files.forEach((file) => {
      const validation = FileUtils.validateFile(file)
      if (validation.isValid) {
        validFiles.push(file)
      } else {
        errors.push(`${file.name}: ${validation.error}`)
      }
    })

    return { validFiles, errors }
  }, [maxFiles])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setDragCounter(prev => prev + 1)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setDragCounter(prev => {
      const newCounter = prev - 1
      if (newCounter === 0) {
        setIsDragOver(false)
      }
      return newCounter
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsDragOver(false)
    setDragCounter(0)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const { validFiles, errors } = validateAndFilterFiles(files)
      
      if (errors.length > 0) {
        onValidationError?.(errors)
      }
      
      if (validFiles.length > 0) {
        // Convert back to FileList-like object
        const dt = new DataTransfer()
        validFiles.forEach(file => dt.items.add(file))
        onFilesSelected(dt.files)
      }
    }
  }, [disabled, onFilesSelected, validateAndFilterFiles, onValidationError])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const { validFiles, errors } = validateAndFilterFiles(files)
      
      if (errors.length > 0) {
        onValidationError?.(errors)
      }
      
      if (validFiles.length > 0) {
        // Convert back to FileList-like object
        const dt = new DataTransfer()
        validFiles.forEach(file => dt.items.add(file))
        onFilesSelected(dt.files)
      }
    }
    // Reset input value so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [onFilesSelected, validateAndFilterFiles, onValidationError])

  const handleBrowseClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [])

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  const supportedExtensions = SUPPORTED_FILE_TYPES.map(type => type.extension).join(', ')

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        accept={SUPPORTED_FILE_TYPES.map(type => type.mimeType).join(',')}
        className="hidden"
        disabled={disabled}
      />
      
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragOver 
            ? 'border-accent bg-accent/10 scale-[1.02]' 
            : 'border-border hover:border-accent/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={!disabled ? handleBrowseClick : undefined}
      >
        <div className="flex flex-col items-center space-y-4">
          {/* Upload Icon */}
          <div className={`
            w-16 h-16 rounded-full flex items-center justify-center transition-colors
            ${isDragOver ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}
          `}>
            <svg 
              className="w-8 h-8" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
          </div>

          {/* Upload Text */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-foreground">
              {isDragOver ? 'Drop files here' : 'Upload your files'}
            </h3>
            <p className="text-muted-foreground">
              Drag and drop files here, or{' '}
              <span className="text-accent hover:text-accent/80 font-medium">
                browse to choose
              </span>
            </p>
          </div>

          {/* File Constraints */}
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Maximum file size: {formatFileSize(STORAGE_CONFIG.maxFileSize)}</div>
            <div>Maximum {maxFiles} files at once</div>
            <div className="text-xs">
              Supported: {supportedExtensions}
            </div>
          </div>

          {/* Browse Button */}
          {!isDragOver && (
            <Button 
              variant="outline" 
              onClick={(e) => {
                e.stopPropagation()
                handleBrowseClick()
              }}
              disabled={disabled}
              className="mt-4"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Choose Files
            </Button>
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-accent/20 border-2 border-accent border-dashed rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="font-medium text-accent">Drop files to upload</p>
          </div>
        </div>
      )}
    </div>
  )
}
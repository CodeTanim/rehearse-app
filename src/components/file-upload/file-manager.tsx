'use client'

import { useState, useCallback, useMemo } from 'react'
import { FileWithMetadata } from '@/lib/types/file'
import { FileUtils } from '@/lib/file-utils'
import { FileList } from './file-list'
import { FileToolbar } from './file-toolbar'
import { FileUploadZone } from './file-upload-zone'
import { UploadProgress, UploadingFile } from './upload-progress'

interface FileManagerProps {
  files: FileWithMetadata[]
  uploadingFiles?: UploadingFile[]
  isLoading?: boolean
  error?: string | null
  onFilesSelected: (files: FileList) => void
  onFileDelete?: (fileId: string) => void
  onFileDownload?: (file: FileWithMetadata) => void
  onCancelUpload?: (fileId: string) => void
  onRetryUpload?: (fileId: string) => void
  onRemoveFromUploadList?: (fileId: string) => void
  showUploadZone?: boolean
  className?: string
}

export function FileManager({
  files,
  uploadingFiles = [],
  isLoading = false,
  error,
  onFilesSelected,
  onFileDelete,
  onFileDownload,
  onCancelUpload,
  onRetryUpload,
  onRemoveFromUploadList,
  showUploadZone = true,
  className = ''
}: FileManagerProps) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showUploadForm, setShowUploadForm] = useState(!files.length && !uploadingFiles.length)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Filter files based on search and category
  const filteredFiles = useMemo(() => {
    let filtered = [...files]

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(file =>
        file.originalName.toLowerCase().includes(searchLower) ||
        file.mimeType.toLowerCase().includes(searchLower)
      )
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(file =>
        FileUtils.getMimeTypeCategory(file.mimeType) === selectedCategory
      )
    }

    return filtered
  }, [files, searchTerm, selectedCategory])

  const handleUploadClick = useCallback(() => {
    setShowUploadForm(true)
  }, [])

  const handleFilesSelected = useCallback((fileList: FileList) => {
    setValidationErrors([]) // Clear previous errors
    onFilesSelected(fileList)
    setShowUploadForm(false)
  }, [onFilesSelected])

  const handleValidationError = useCallback((errors: string[]) => {
    setValidationErrors(errors)
  }, [])

  const hasActiveUploads = uploadingFiles.some(f => f.status === 'uploading')

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <UploadProgress
          uploadingFiles={uploadingFiles}
          onCancelUpload={onCancelUpload}
          onRemoveFromList={onRemoveFromUploadList}
          onRetryUpload={onRetryUpload}
        />
      )}

      {/* Upload Zone */}
      {showUploadZone && (showUploadForm || (!files.length && !uploadingFiles.length)) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-foreground">Upload Files</h3>
            {files.length > 0 && (
              <button
                onClick={() => setShowUploadForm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <FileUploadZone
            onFilesSelected={handleFilesSelected}
            onValidationError={handleValidationError}
            disabled={hasActiveUploads}
          />
        </div>
      )}

      {/* Validation Error Display */}
      {validationErrors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <svg className="w-5 h-5 text-destructive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-destructive font-medium">File Validation Errors</p>
            <button
              onClick={() => setValidationErrors([])}
              className="ml-auto text-destructive/60 hover:text-destructive"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ul className="text-destructive/80 text-sm space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-destructive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-destructive font-medium">Upload Error</p>
          </div>
          <p className="text-destructive/80 mt-1">{error}</p>
        </div>
      )}

      {/* File Management */}
      {(files.length > 0 || searchTerm || selectedCategory !== 'all') && (
        <div className="space-y-4">
          {/* Toolbar */}
          <FileToolbar
            files={filteredFiles}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onUploadClick={showUploadZone ? handleUploadClick : undefined}
          />

          {/* File List */}
          <FileList
            files={filteredFiles}
            viewMode={viewMode}
            onFileDelete={onFileDelete}
            onFileDownload={onFileDownload}
            isLoading={isLoading}
          />

          {/* No Results */}
          {filteredFiles.length === 0 && files.length > 0 && !isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No files found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? `No files match "${searchTerm}"` : 
                   selectedCategory !== 'all' ? 'No files in this category' : 
                   'No files to display'}
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setSelectedCategory('all')
                  }}
                  className="text-accent hover:text-accent/80 text-sm font-medium"
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
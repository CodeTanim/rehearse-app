'use client'

import { useState, useCallback, useMemo } from 'react'
import { SearchX, TriangleAlert, X } from 'lucide-react'
import { FileWithMetadata } from '@/lib/types/file'
import { FileUtils } from '@/lib/file-utils'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FileList } from './file-list'
import { FileToolbar } from './file-toolbar'
import { FileUploadZone } from './file-upload-zone'
import { UploadProgress, UploadingFile } from './upload-progress'

interface FileManagerProps {
  files: FileWithMetadata[]
  uploadingFiles?: UploadingFile[]
  isLoading?: boolean
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-foreground">Upload files</h3>
            </div>
            {files.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setShowUploadForm(false)}
                aria-label="Close file upload form"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
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
        <Alert variant="destructive" role="alert">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-black">Some files weren’t added</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {validationErrors.map((validationError) => (
                  <li key={validationError}>{validationError}</li>
                ))}
              </ul>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setValidationErrors([])}
              aria-label="Dismiss file validation errors"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </Alert>
      )}

      {/* File Management */}
      {(files.length > 0 || searchTerm || selectedCategory !== 'all') && (
        <div className="space-y-4">
          {/* Toolbar */}
          <FileToolbar
            files={files}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onUploadClick={showUploadZone ? handleUploadClick : undefined}
          />

          {/* File List */}
          {filteredFiles.length === 0 && files.length > 0 && !isLoading ? (
            <Card tone="note" className="p-8 text-center">
              <SearchX className="mx-auto size-10" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-black">
                {searchTerm ? `No files match “${searchTerm}”.` : 'No matching files'}
              </h3>
              <Button
                type="button"
                variant="outline"
                className="mt-5"
                  onClick={() => {
                    setSearchTerm('')
                    setSelectedCategory('all')
                  }}
              >
                Clear
              </Button>
            </Card>
          ) : (
            <FileList
              files={filteredFiles}
              viewMode={viewMode}
              onFileDelete={onFileDelete}
              onFileDownload={onFileDownload}
              isLoading={isLoading}
            />
          )}
        </div>
      )}
    </div>
  )
}

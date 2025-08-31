'use client'

import { useState, useCallback } from 'react'
import { FileWithMetadata } from '@/lib/types/file'
import { FileUtils } from '@/lib/file-utils'
import { FileIcons } from '@/lib/file-icons'
import { Button } from '@/components/ui/button'
import { FileViewerModal } from '@/components/file-viewers/file-viewer-modal'

interface FileListProps {
  files: FileWithMetadata[]
  viewMode?: 'list' | 'grid'
  onFileClick?: (file: FileWithMetadata) => void
  onFileDelete?: (fileId: string) => void
  onFileDownload?: (file: FileWithMetadata) => void
  isLoading?: boolean
  className?: string
}

export function FileList({ 
  files, 
  viewMode = 'list',
  onFileClick,
  onFileDelete,
  onFileDownload,
  isLoading = false,
  className = '' 
}: FileListProps) {
  const [selectedFile, setSelectedFile] = useState<FileWithMetadata | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleSort = useCallback((newSortBy: typeof sortBy) => {
    if (newSortBy === sortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('asc')
    }
  }, [sortBy])

  const sortedFiles = [...files].sort((a, b) => {
    let compareValue = 0
    
    switch (sortBy) {
      case 'name':
        compareValue = a.originalName.localeCompare(b.originalName)
        break
      case 'date':
        compareValue = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
        break
      case 'size':
        compareValue = a.size - b.size
        break
      case 'type':
        compareValue = a.mimeType.localeCompare(b.mimeType)
        break
    }
    
    return sortOrder === 'asc' ? compareValue : -compareValue
  })

  const handleFileClick = useCallback((file: FileWithMetadata) => {
    console.log('📁 File clicked:', file.originalName, 'ID:', file.id)
    if (onFileClick) {
      onFileClick(file)
    } else {
      setSelectedFile(file)
      console.log('📁 Opening file viewer modal for:', file.originalName)
    }
  }, [onFileClick])

  const handleFileDownload = useCallback((file: FileWithMetadata) => {
    if (onFileDownload) {
      onFileDownload(file)
    } else {
      // Default download behavior
      const link = document.createElement('a')
      link.href = `/api/files/${file.id}/download`
      link.download = file.originalName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }, [onFileDownload])

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
          <p className="text-muted-foreground">Loading files...</p>
        </div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No files uploaded yet</h3>
          <p className="text-muted-foreground">Upload your first file to get started</p>
        </div>
      </div>
    )
  }

  if (viewMode === 'grid') {
    return (
      <>
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 ${className}`}>
          {sortedFiles.map((file) => {
            const fileIcon = FileIcons.getFileIcon(file.mimeType)
            const fileCategory = FileUtils.getMimeTypeCategory(file.mimeType)
            
            return (
              <div
                key={file.id}
                className="group bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => handleFileClick(file)}
              >
                {/* File Icon/Thumbnail */}
                <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center mb-3 group-hover:bg-muted/80">
                  <span className="text-3xl">{fileIcon}</span>
                </div>
                
                {/* File Info */}
                <div className="space-y-1">
                  <h4 className="font-medium text-foreground text-sm truncate" title={file.originalName}>
                    {file.originalName}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {FileUtils.formatFileSize(file.size)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFileDownload(file)
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </Button>
                  
                  {onFileDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onFileDelete(file.id)
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
            )
          })}
        </div>
        
        {selectedFile && (
          <FileViewerModal
            file={selectedFile}
            isOpen={!!selectedFile}
            onClose={() => setSelectedFile(null)}
            onDownload={() => handleFileDownload(selectedFile)}
            onDelete={onFileDelete ? () => onFileDelete(selectedFile.id) : undefined}
          />
        )}
      </>
    )
  }

  // List view
  return (
    <>
      <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
        {/* Header */}
        <div className="bg-muted/30 border-b border-border">
          <div className="grid grid-cols-12 gap-4 p-4 text-sm font-medium text-muted-foreground">
            <button
              className="col-span-5 flex items-center space-x-2 text-left hover:text-foreground"
              onClick={() => handleSort('name')}
            >
              <span>Name</span>
              {getSortIcon('name')}
            </button>
            <button
              className="col-span-2 flex items-center space-x-2 text-left hover:text-foreground"
              onClick={() => handleSort('size')}
            >
              <span>Size</span>
              {getSortIcon('size')}
            </button>
            <button
              className="col-span-2 flex items-center space-x-2 text-left hover:text-foreground"
              onClick={() => handleSort('type')}
            >
              <span>Type</span>
              {getSortIcon('type')}
            </button>
            <button
              className="col-span-2 flex items-center space-x-2 text-left hover:text-foreground"
              onClick={() => handleSort('date')}
            >
              <span>Modified</span>
              {getSortIcon('date')}
            </button>
            <div className="col-span-1 text-center">Actions</div>
          </div>
        </div>
        
        {/* File List */}
        <div className="divide-y divide-border">
          {sortedFiles.map((file) => {
            const fileIcon = FileIcons.getFileIcon(file.mimeType)
            const fileCategory = FileUtils.getMimeTypeCategory(file.mimeType)
            
            return (
              <div
                key={file.id}
                className="grid grid-cols-12 gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => handleFileClick(file)}
              >
                {/* Name */}
                <div className="col-span-5 flex items-center space-x-3">
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">{fileIcon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{file.originalName}</p>
                    <p className="text-sm text-muted-foreground capitalize">{fileCategory}</p>
                  </div>
                </div>
                
                {/* Size */}
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-muted-foreground">
                    {FileUtils.formatFileSize(file.size)}
                  </span>
                </div>
                
                {/* Type */}
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-muted-foreground font-mono">
                    {file.mimeType.split('/')[1]?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
                
                {/* Date */}
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-muted-foreground">
                    {new Date(file.uploadedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                
                {/* Actions */}
                <div className="col-span-1 flex items-center justify-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFileDownload(file)
                    }}
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </Button>
                  
                  {onFileDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onFileDelete(file.id)
                      }}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      
      {selectedFile && (
        <FileViewerModal
          file={selectedFile}
          isOpen={!!selectedFile}
          onClose={() => setSelectedFile(null)}
          onDownload={() => handleFileDownload(selectedFile)}
          onDelete={onFileDelete ? () => onFileDelete(selectedFile.id) : undefined}
        />
      )}
    </>
  )
}
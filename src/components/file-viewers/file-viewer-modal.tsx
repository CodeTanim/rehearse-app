'use client'

import { useEffect, useCallback } from 'react'
import { FileUtils } from '@/lib/file-utils'
import { FileWithMetadata } from '@/lib/types/file'
import { PDFViewer } from './pdf-viewer'
import { ImageViewer } from './image-viewer'
import { TextViewer } from './text-viewer'
import { Button } from '@/components/ui/button'

interface FileViewerModalProps {
  file: FileWithMetadata
  isOpen: boolean
  onClose: () => void
  onDownload?: () => void
  onDelete?: () => void
}

export function FileViewerModal({ file, isOpen, onClose, onDownload, onDelete }: FileViewerModalProps) {
  const fileCategory = FileUtils.getMimeTypeCategory(file.mimeType)
  const viewUrl = `/api/files/${file.id}/view`
  const downloadUrl = `/api/files/${file.id}/download`

  // Debug: Log when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 FileViewerModal opened:', {
        fileName: file.originalName,
        fileId: file.id,
        category: fileCategory,
        viewUrl,
        mimeType: file.mimeType
      })
    }
  }, [isOpen, file, fileCategory, viewUrl])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload()
    } else {
      // Default download behavior
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = file.originalName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }, [onDownload, downloadUrl, file.originalName])

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete()
    }
  }, [onDelete])

  const renderViewer = useCallback(() => {
    const commonProps = {
      fileUrl: viewUrl,
      fileName: file.originalName,
      mimeType: file.mimeType,
    }

    switch (fileCategory) {
      case 'image':
        return <ImageViewer {...commonProps} />
      case 'document':
        if (file.mimeType === 'application/pdf') {
          return <PDFViewer {...commonProps} />
        }
        // For other documents, show unsupported message
        return <UnsupportedFileViewer file={file} onDownload={handleDownload} />
      case 'text':
        return <TextViewer {...commonProps} />
      default:
        return <UnsupportedFileViewer file={file} onDownload={handleDownload} />
    }
  }, [fileCategory, viewUrl, file, handleDownload])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal content */}
        <div className="relative bg-card rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[90vh] mx-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-card">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center">
                  <span className="text-lg">
                    {fileCategory === 'image' ? '🖼️' : 
                     fileCategory === 'document' ? '📄' : 
                     fileCategory === 'text' ? '📝' : '📎'}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{file.originalName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {FileUtils.formatFileSize(file.size)} • {file.mimeType}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="text-accent hover:text-accent/80"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </Button>
              
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="text-destructive hover:text-destructive/80"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          </div>

          {/* Viewer Content */}
          <div className="h-[calc(100%-5rem)] overflow-hidden">
            {renderViewer()}
          </div>
        </div>
      </div>
    </div>
  )
}

// Component for unsupported file types
function UnsupportedFileViewer({ file, onDownload }: { file: FileWithMetadata; onDownload: () => void }) {
  const fileCategory = FileUtils.getMimeTypeCategory(file.mimeType)
  
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">
            {fileCategory === 'archive' ? '📦' : 
             fileCategory === 'document' ? '📄' : '📎'}
          </span>
        </div>
        
        <h3 className="text-lg font-medium text-foreground mb-2">Preview Not Available</h3>
        <p className="text-muted-foreground mb-6">
          This file type cannot be previewed in the browser. You can download it to view the contents.
        </p>
        
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <div><strong>File:</strong> {file.originalName}</div>
              <div><strong>Type:</strong> {file.mimeType}</div>
              <div><strong>Size:</strong> {FileUtils.formatFileSize(file.size)}</div>
              <div><strong>Uploaded:</strong> {new Date(file.uploadedAt).toLocaleDateString()}</div>
            </div>
          </div>
          
          <Button onClick={onDownload} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download File
          </Button>
        </div>
      </div>
    </div>
  )
}
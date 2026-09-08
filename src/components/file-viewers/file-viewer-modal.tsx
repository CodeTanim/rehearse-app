'use client'

import { useRef, useState } from 'react'
import { Archive, Download, File, FileText, ImageIcon, Trash2, X } from 'lucide-react'

import { ImageViewer } from './image-viewer'
import { PDFViewer } from './pdf-viewer'
import { TextViewer } from './text-viewer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileUtils } from '@/lib/file-utils'
import { FileWithMetadata } from '@/lib/types/file'

interface FileViewerModalProps {
  file: FileWithMetadata
  isOpen: boolean
  onClose: () => void
  onDownload?: () => void
  onDelete?: () => void
}

type FileCategory = ReturnType<typeof FileUtils.getMimeTypeCategory>

function FileCategoryIcon({ category, className = 'size-6' }: { category: FileCategory; className?: string }) {
  const Icon = category === 'image'
    ? ImageIcon
    : category === 'document' || category === 'text'
      ? FileText
      : category === 'archive'
        ? Archive
        : File

  return <Icon className={className} aria-hidden="true" />
}

export function FileViewerModal({ file, isOpen, onClose, onDownload, onDelete }: FileViewerModalProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [isHandingOffDelete, setIsHandingOffDelete] = useState(false)
  const fileCategory = FileUtils.getMimeTypeCategory(file.mimeType)
  const viewUrl = `/api/files/${file.id}/view`
  const downloadUrl = `/api/files/${file.id}/download`

  function handleDownload() {
    if (onDownload) {
      onDownload()
      return
    }

    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = file.originalName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  function captureReturnFocus() {
    const activeElement = document.activeElement
    returnFocusRef.current =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null
  }

  function restoreFocusImmediately(returnTarget = returnFocusRef.current) {
    const fallback = document.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-state="active"]')
    const focusTarget = returnTarget?.isConnected ? returnTarget : fallback
    focusTarget?.focus({ preventScroll: true })
  }

  function closeViewer() {
    onClose()
  }

  function requestDelete() {
    if (!onDelete) return
    setIsHandingOffDelete(true)
  }

  function renderViewer() {
    const commonProps = {
      fileUrl: viewUrl,
      fileName: file.originalName,
      mimeType: file.mimeType,
    }

    if (fileCategory === 'image') return <ImageViewer {...commonProps} />
    if (fileCategory === 'text') return <TextViewer {...commonProps} />
    if (fileCategory === 'document' && file.mimeType === 'application/pdf') {
      return <PDFViewer {...commonProps} />
    }
    return <UnsupportedFileViewer file={file} onDownload={handleDownload} />
  }

  return (
    <Dialog open={isOpen && !isHandingOffDelete} onOpenChange={(open) => !open && closeViewer()}>
      <DialogContent
        size="xl"
        showCloseButton={false}
        className="flex h-[min(90dvh,60rem)] !w-[min(96vw,80rem)] max-w-none flex-col !overflow-hidden"
        onOpenAutoFocus={captureReturnFocus}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (isHandingOffDelete && onDelete) {
            restoreFocusImmediately()
            returnFocusRef.current = null
            queueMicrotask(onDelete)
            return
          }
          restoreFocusImmediately()
          returnFocusRef.current = null
        }}
      >
        <div className="flex flex-col gap-4 border-b-[3px] border-foreground bg-[var(--paper-blue)] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center border-2 border-foreground bg-card text-xl" aria-hidden="true">
              <FileCategoryIcon category={fileCategory} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">{file.originalName}</DialogTitle>
              <DialogDescription className="mt-1 break-all text-foreground/70">
                {FileUtils.formatFileSize(file.size)} · {file.mimeType}
              </DialogDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              aria-label={`Download ${file.originalName}`}
            >
              <Download className="size-4" aria-hidden="true" />
              Download
            </Button>
            {onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={requestDelete}
                aria-label={`Delete ${file.originalName}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={closeViewer}
              aria-label={`Close ${file.originalName} viewer`}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">{renderViewer()}</div>
      </DialogContent>
    </Dialog>
  )
}

function UnsupportedFileViewer({ file, onDownload }: { file: FileWithMetadata; onDownload: () => void }) {
  const fileCategory = FileUtils.getMimeTypeCategory(file.mimeType)

  return (
    <div className="grid h-full place-items-center overflow-y-auto p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center border-[3px] border-foreground bg-muted text-2xl" aria-hidden="true">
          <FileCategoryIcon category={fileCategory} className="size-8" />
        </div>
        <h3 className="text-xl font-black">Preview not available</h3>
        <p className="mt-2 leading-7 text-muted-foreground">
          Download this file to open it.
        </p>

        <dl className="mt-6 grid gap-2 border-[3px] border-foreground bg-muted p-4 text-left text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs font-black uppercase tracking-wide">Type</dt>
            <dd className="break-all">{file.mimeType}</dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-wide">Size</dt>
            <dd>{FileUtils.formatFileSize(file.size)}</dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-wide">Uploaded</dt>
            <dd>{new Date(file.uploadedAt).toLocaleDateString()}</dd>
          </div>
        </dl>

        <Button
          type="button"
          variant="accent"
          onClick={onDownload}
          className="mt-6"
          aria-label={`Download ${file.originalName}`}
        >
          <Download className="size-4" aria-hidden="true" />
          Download
        </Button>
      </div>
    </div>
  )
}

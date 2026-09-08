'use client'

import { useCallback, useState } from 'react'
import { Check, LoaderCircle, RotateCcw, Trash2, UploadCloud, X, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FileIcons } from '@/lib/file-icons'
import { FileUtils } from '@/lib/file-utils'

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

function getStatusText(uploadingFile: UploadingFile) {
  if (uploadingFile.status === 'uploading') return `Uploading, ${Math.round(uploadingFile.progress)}%`
  if (uploadingFile.status === 'completed') return 'Upload complete'
  if (uploadingFile.status === 'error') return uploadingFile.error || 'Upload failed'
  return 'Upload cancelled'
}

function StatusIcon({ status }: { status: UploadingFile['status'] }) {
  if (status === 'uploading') return <LoaderCircle className="size-4 animate-spin text-info" aria-hidden="true" />
  if (status === 'completed') return <Check className="size-4 text-success" aria-hidden="true" />
  if (status === 'error') return <XCircle className="size-4 text-destructive" aria-hidden="true" />
  return <X className="size-4 text-muted-foreground" aria-hidden="true" />
}

export function UploadProgress({
  uploadingFiles,
  onCancelUpload,
  onRemoveFromList,
  onRetryUpload,
  className = '',
}: UploadProgressProps) {
  if (uploadingFiles.length === 0) return null

  const completedCount = uploadingFiles.filter((file) => file.status === 'completed').length
  const errorCount = uploadingFiles.filter((file) => file.status === 'error').length
  const cancelledCount = uploadingFiles.filter((file) => file.status === 'cancelled').length
  const uploadingCount = uploadingFiles.filter((file) => file.status === 'uploading').length

  return (
    <Card className={`overflow-hidden ${className}`} aria-label="File upload progress">
      <div className="flex flex-col gap-4 border-b-[3px] border-foreground bg-[var(--paper-blue)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UploadCloud className="size-5" aria-hidden="true" />
            <h3 className="font-black">Uploads</h3>
          </div>
          <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
            {uploadingCount > 0 ? <Badge variant="demonstrated">{uploadingCount} uploading</Badge> : null}
            {completedCount > 0 ? <Badge variant="learned">{completedCount} complete</Badge> : null}
            {errorCount > 0 ? <Badge variant="refresh">{errorCount} failed</Badge> : null}
            {cancelledCount > 0 ? <Badge variant="muted">{cancelledCount} cancelled</Badge> : null}
          </div>
        </div>

        {completedCount > 0 || errorCount > 0 || cancelledCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              uploadingFiles
                .filter((file) => file.status !== 'uploading')
                .forEach((file) => onRemoveFromList?.(file.id))
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <div className="max-h-80 divide-y-2 divide-foreground/20 overflow-y-auto">
        {uploadingFiles.map((uploadingFile) => {
          const fileIcon = FileIcons.getFileIcon(uploadingFile.file.type)
          const progress = Math.max(0, Math.min(uploadingFile.progress, 100))

          return (
            <article key={uploadingFile.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="grid size-11 shrink-0 place-items-center border-2 border-foreground bg-muted text-[0.65rem] font-black tracking-wide" aria-hidden="true">
                  {fileIcon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-black">{uploadingFile.file.name}</p>
                      <p className="mt-1 break-all text-xs font-medium text-muted-foreground">
                        {FileUtils.formatFileSize(uploadingFile.file.size)} · {uploadingFile.file.type || 'Unknown type'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIcon status={uploadingFile.status} />
                      {uploadingFile.status === 'uploading' && onCancelUpload ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => onCancelUpload(uploadingFile.id)}
                          aria-label={`Cancel upload of ${uploadingFile.file.name}`}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}

                      {uploadingFile.status === 'error' && onRetryUpload ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon-sm"
                          onClick={() => onRetryUpload(uploadingFile.id)}
                          aria-label={`Retry upload of ${uploadingFile.file.name}`}
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}

                      {uploadingFile.status !== 'uploading' && onRemoveFromList ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onRemoveFromList(uploadingFile.id)}
                          aria-label={`Remove ${uploadingFile.file.name} from upload list`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <p
                    className={`mt-2 text-sm font-bold ${
                      uploadingFile.status === 'error'
                        ? 'text-destructive'
                        : uploadingFile.status === 'completed'
                          ? 'text-success'
                          : 'text-muted-foreground'
                    }`}
                    aria-live="polite"
                  >
                    {getStatusText(uploadingFile)}
                  </p>

                  {uploadingFile.status === 'uploading' ? (
                    <div
                      className="mt-2 h-3 overflow-hidden border-2 border-foreground bg-muted"
                      role="progressbar"
                      aria-label={`Upload progress for ${uploadingFile.file.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress)}
                    >
                      <div className="h-full bg-info transition-[width] duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </Card>
  )
}

export function useUploadProgress() {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  const addFile = useCallback((file: File): string => {
    const id = Math.random().toString(36).slice(2, 11)
    setUploadingFiles((current) => [
      ...current,
      { id, file, progress: 0, status: 'uploading' },
    ])
    return id
  }, [])

  const updateProgress = useCallback((fileId: string, progress: number) => {
    setUploadingFiles((current) =>
      current.map((file) =>
        file.id === fileId && file.status === 'uploading' ? { ...file, progress } : file,
      ),
    )
  }, [])

  const markCompleted = useCallback(
    (fileId: string, uploadedFile: UploadingFile['uploadedFile']) => {
      setUploadingFiles((current) =>
        current.map((file) =>
          file.id === fileId && file.status === 'uploading'
            ? { ...file, status: 'completed', progress: 100, uploadedFile }
            : file,
        ),
      )
    },
    [],
  )

  const markError = useCallback((fileId: string, error: string) => {
    setUploadingFiles((current) =>
      current.map((file) =>
        file.id === fileId && file.status === 'uploading'
          ? { ...file, status: 'error', error }
          : file,
      ),
    )
  }, [])

  const markCancelled = useCallback((fileId: string) => {
    setUploadingFiles((current) =>
      current.map((file) =>
        file.id === fileId && file.status === 'uploading'
          ? { ...file, status: 'cancelled', error: undefined }
          : file,
      ),
    )
  }, [])

  const removeFile = useCallback((fileId: string) => {
    setUploadingFiles((current) => current.filter((file) => file.id !== fileId))
  }, [])

  const clearCompleted = useCallback(() => {
    setUploadingFiles((current) => current.filter((file) => file.status !== 'completed'))
  }, [])

  const clearAll = useCallback(() => setUploadingFiles([]), [])

  return {
    uploadingFiles,
    addFile,
    updateProgress,
    markCompleted,
    markError,
    markCancelled,
    removeFile,
    clearCompleted,
    clearAll,
  }
}

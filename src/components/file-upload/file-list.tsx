'use client'

import { useCallback, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Paperclip, Trash2 } from 'lucide-react'

import { FileViewerModal } from '@/components/file-viewers/file-viewer-modal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FileIcons } from '@/lib/file-icons'
import { FileUtils } from '@/lib/file-utils'
import { FileWithMetadata } from '@/lib/types/file'

interface FileListProps {
  files: FileWithMetadata[]
  viewMode?: 'list' | 'grid'
  onFileClick?: (file: FileWithMetadata) => void
  onFileDelete?: (fileId: string) => void
  onFileDownload?: (file: FileWithMetadata) => void
  isLoading?: boolean
  className?: string
}

type SortKey = 'name' | 'date' | 'size' | 'type'

export function FileList({
  files,
  viewMode = 'list',
  onFileClick,
  onFileDelete,
  onFileDownload,
  isLoading = false,
  className = '',
}: FileListProps) {
  const [selectedFile, setSelectedFile] = useState<FileWithMetadata | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleSort = useCallback(
    (newSortBy: SortKey) => {
      if (newSortBy === sortBy) setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
      else {
        setSortBy(newSortBy)
        setSortOrder('asc')
      }
    },
    [sortBy],
  )

  const sortedFiles = useMemo(
    () =>
      [...files].sort((first, second) => {
        let value = 0
        if (sortBy === 'name') value = first.originalName.localeCompare(second.originalName)
        if (sortBy === 'date') value = new Date(first.uploadedAt).getTime() - new Date(second.uploadedAt).getTime()
        if (sortBy === 'size') value = first.size - second.size
        if (sortBy === 'type') value = first.mimeType.localeCompare(second.mimeType)
        return sortOrder === 'asc' ? value : -value
      }),
    [files, sortBy, sortOrder],
  )

  const handleFileClick = useCallback(
    (file: FileWithMetadata) => {
      if (onFileClick) onFileClick(file)
      else setSelectedFile(file)
    },
    [onFileClick],
  )

  const handleFileDownload = useCallback(
    (file: FileWithMetadata) => {
      if (onFileDownload) {
        onFileDownload(file)
        return
      }

      const link = document.createElement('a')
      link.href = `/api/files/${file.id}/download`
      link.download = file.originalName
      document.body.appendChild(link)
      link.click()
      link.remove()
    },
    [onFileDownload],
  )

  function renderSortIcon(column: SortKey) {
    if (sortBy !== column) return <ArrowUpDown className="size-3.5" aria-hidden="true" />
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3.5" aria-hidden="true" />
    ) : (
      <ArrowDown className="size-3.5" aria-hidden="true" />
    )
  }

  function getSortLabel(label: string, column: SortKey) {
    if (sortBy !== column) return `Sort by ${label}`
    return `Sorted by ${label}, ${sortOrder === 'asc' ? 'ascending' : 'descending'}. Reverse order`
  }

  const viewer = selectedFile ? (
    <FileViewerModal
      file={selectedFile}
      isOpen
      onClose={() => setSelectedFile(null)}
      onDownload={() => handleFileDownload(selectedFile)}
      onDelete={
        onFileDelete
          ? () => {
              onFileDelete(selectedFile.id)
              setSelectedFile(null)
            }
          : undefined
      }
    />
  ) : null

  if (isLoading) {
    return (
      <div className="grid min-h-48 place-items-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-4 border-accent border-t-transparent" aria-hidden="true" />
          <p className="font-bold text-muted-foreground">Loading files…</p>
        </div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <Card tone="note" className={`p-8 text-center ${className}`}>
        <div className="mx-auto mb-4 grid size-16 place-items-center border-[3px] border-foreground bg-card text-3xl" aria-hidden="true">
          <Paperclip className="size-8" />
        </div>
        <h3 className="text-lg font-black">No files yet</h3>
        <p className="mt-2 text-muted-foreground">Upload a file to get started.</p>
      </Card>
    )
  }

  if (viewMode === 'grid') {
    return (
      <>
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`}>
          {sortedFiles.map((file) => {
            const fileIcon = FileIcons.getFileIcon(file.mimeType)
            return (
              <Card key={file.id} interactive className="min-w-0 overflow-hidden p-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-0 w-full min-w-0 flex-col items-stretch whitespace-normal p-0 text-left hover:bg-transparent"
                  onClick={() => handleFileClick(file)}
                  aria-label={`Open ${file.originalName}`}
                >
                  <span className="mb-3 grid aspect-[4/3] w-full place-items-center border-2 border-foreground bg-muted text-lg font-black tracking-[0.12em]" aria-hidden="true">
                    {fileIcon}
                  </span>
                  <span className="truncate text-sm font-black" title={file.originalName}>
                    {file.originalName}
                  </span>
                  <span className="mt-1 text-xs font-medium text-muted-foreground">
                    {FileUtils.formatFileSize(file.size)} · {new Date(file.uploadedAt).toLocaleDateString()}
                  </span>
                </Button>

                <div className="mt-4 flex flex-wrap gap-2 border-t-2 border-foreground/20 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => handleFileDownload(file)}
                    aria-label={`Download ${file.originalName}`}
                  >
                    <Download className="size-4" aria-hidden="true" />
                  </Button>
                  {onFileDelete ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => onFileDelete(file.id)}
                      aria-label={`Delete ${file.originalName}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
        {viewer}
      </>
    )
  }

  return (
    <>
      <Card className={`overflow-hidden ${className}`}>
        <div className="flex gap-2 overflow-x-auto border-b-[3px] border-foreground bg-muted p-3" aria-label="Sort files">
          {([
            ['name', 'Name'],
            ['size', 'Size'],
            ['type', 'Type'],
            ['date', 'Date'],
          ] as const).map(([column, label]) => (
            <Button
              key={column}
              type="button"
              variant={sortBy === column ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => handleSort(column)}
              aria-label={getSortLabel(label, column)}
            >
              {label}
              {renderSortIcon(column)}
            </Button>
          ))}
        </div>

        <div className="divide-y-2 divide-foreground/20">
          {sortedFiles.map((file) => {
            const fileIcon = FileIcons.getFileIcon(file.mimeType)
            const fileCategory = FileUtils.getMimeTypeCategory(file.mimeType)

            return (
              <article key={file.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-11 min-w-0 justify-start whitespace-normal p-0 text-left hover:bg-transparent"
                  onClick={() => handleFileClick(file)}
                  aria-label={`Open ${file.originalName}`}
                >
                  <span className="grid size-11 shrink-0 place-items-center border-2 border-foreground bg-muted text-[0.65rem] font-black tracking-wide" aria-hidden="true">
                    {fileIcon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-black">{file.originalName}</span>
                    <span className="mt-1 block text-xs font-medium text-muted-foreground">
                      <span className="capitalize">{fileCategory}</span> · {FileUtils.formatFileSize(file.size)} ·{' '}
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </span>
                  </span>
                </Button>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => handleFileDownload(file)}
                    aria-label={`Download ${file.originalName}`}
                  >
                    <Download className="size-4" aria-hidden="true" />
                  </Button>
                  {onFileDelete ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => onFileDelete(file.id)}
                      aria-label={`Delete ${file.originalName}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      </Card>
      {viewer}
    </>
  )
}

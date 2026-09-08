'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { Plus, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  onValidationError,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const validateAndFilterFiles = useCallback(
    (fileList: FileList): { validFiles: File[]; errors: string[] } => {
      const files = Array.from(fileList)
      const validFiles: File[] = []
      const errors: string[] = []

      if (files.length > maxFiles) {
        errors.push(`You can only upload ${maxFiles} files at once`)
        return { validFiles, errors }
      }

      files.forEach((file) => {
        const validation = FileUtils.validateFile(file)
        if (validation.isValid) validFiles.push(file)
        else errors.push(`${file.name}: ${validation.error}`)
      })

      return { validFiles, errors }
    },
    [maxFiles],
  )

  const submitFiles = useCallback(
    (files: FileList) => {
      const { validFiles, errors } = validateAndFilterFiles(files)
      if (errors.length > 0) onValidationError?.(errors)

      if (validFiles.length > 0) {
        const dataTransfer = new DataTransfer()
        validFiles.forEach((file) => dataTransfer.items.add(file))
        onFilesSelected(dataTransfer.files)
      }
    },
    [onFilesSelected, onValidationError, validateAndFilterFiles],
  )

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current += 1
    if (event.dataTransfer.items.length > 0) setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragOver(false)
      dragCounterRef.current = 0

      if (!disabled && event.dataTransfer.files.length > 0) {
        submitFiles(event.dataTransfer.files)
      }
    },
    [disabled, submitFiles],
  )

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files?.length) submitFiles(event.target.files)
      event.target.value = ''
    },
    [submitFiles],
  )

  return (
    <Card
      tone="blue"
      className={`relative overflow-hidden border-dashed p-6 text-center sm:p-8 ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onDrop={handleDrop}
      aria-disabled={disabled}
    >
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        multiple
        onChange={handleFileInputChange}
        accept={SUPPORTED_FILE_TYPES.map((type) => type.mimeType).join(',')}
        hidden
        disabled={disabled}
      />

      <div className="flex flex-col items-center gap-4">
        <div
          className="grid size-16 place-items-center border-[3px] border-foreground bg-card shadow-[3px_3px_0_var(--paper-shadow)]"
          aria-hidden="true"
        >
          <UploadCloud className="size-8" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-black tracking-tight">
            Drop files here
          </h3>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Or browse your device.
          </p>
        </div>

        <div
          id={`${inputId}-constraints`}
          className="max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm"
        >
          <p className="break-words">
            JPG, PNG, GIF, WebP, PDF, TXT, or MD · {FileUtils.formatFileSize(STORAGE_CONFIG.maxFileSize)} each · up to {maxFiles}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Plus className="size-4" aria-hidden="true" />
          Browse
        </Button>
      </div>

      {isDragOver ? (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center border-[3px] border-dashed border-info bg-[color-mix(in_srgb,var(--paper-blue)_90%,white)]"
          aria-live="polite"
        >
          <div className="paper-stamp bg-card text-info">Drop</div>
        </div>
      ) : null}
    </Card>
  )
}

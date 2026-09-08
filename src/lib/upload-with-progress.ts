/**
 * File upload utility with real progress tracking using XMLHttpRequest
 */

export interface UploadProgressCallback {
  (progress: number): void
}

export interface UploadWithProgressOptions {
  onProgress?: UploadProgressCallback
  onSuccess?: (response: unknown) => void
  onError?: (error: Error) => void
  onCancel?: (error: UploadCancelledError) => void
  signal?: AbortSignal
}

export class UploadCancelledError extends Error {
  constructor(message = 'Upload cancelled') {
    super(message)
    this.name = 'UploadCancelledError'
  }
}

export function isUploadCancelledError(error: unknown): error is UploadCancelledError {
  return error instanceof UploadCancelledError
}

export class UploadWithProgress {
  private xhr: XMLHttpRequest | null = null

  constructor(
    private url: string,
    private file: File,
    private options: UploadWithProgressOptions = {}
  ) {}

  async upload(): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const signal = this.options.signal

      if (signal?.aborted) {
        const error = new UploadCancelledError()
        reject(error)
        this.options.onCancel?.(error)
        return
      }

      const xhr = new XMLHttpRequest()
      this.xhr = xhr
      const formData = new FormData()
      formData.append('file', this.file)
      let settled = false

      const cleanup = () => {
        signal?.removeEventListener('abort', handleSignalAbort)
        if (this.xhr === xhr) this.xhr = null
      }

      const succeed = (response: unknown) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(response)
        this.options.onSuccess?.(response)
      }

      const fail = (error: Error) => {
        if (settled) return
        settled = true
        cleanup()
        reject(error)
        this.options.onError?.(error)
      }

      const cancel = () => {
        if (settled) return
        settled = true
        cleanup()
        const error = new UploadCancelledError()
        reject(error)
        this.options.onCancel?.(error)
      }

      function handleSignalAbort() {
        if (settled) return

        if (xhr.readyState === XMLHttpRequest.UNSENT || xhr.readyState === XMLHttpRequest.DONE) {
          cancel()
          return
        }

        xhr.abort()
      }

      // Progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (!settled && event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          this.options.onProgress?.(Math.round(progress))
        }
      })

      // Success handler
      xhr.addEventListener('load', () => {
        if (settled) return

        if (xhr.status >= 200 && xhr.status < 300) {
          let response: unknown
          try {
            response = JSON.parse(xhr.responseText)
          } catch {
            fail(new Error('Failed to parse response'))
            return
          }
          succeed(response)
        } else {
          let errorMessage = 'Upload failed'
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            errorMessage = errorResponse.error || errorMessage
          } catch {
            // Use default error message if response isn't JSON
          }

          fail(new Error(errorMessage))
        }
      })

      // Error handler
      xhr.addEventListener('error', () => fail(new Error('Network error during upload')))

      // Abort handler
      xhr.addEventListener('abort', cancel)

      // Handle external abort signal
      signal?.addEventListener('abort', handleSignalAbort, { once: true })

      // The signal may have changed between the first check and listener setup.
      if (signal?.aborted) {
        handleSignalAbort()
        return
      }

      // Start upload
      xhr.open('POST', this.url)
      if (!settled) xhr.send(formData)
    })
  }

  abort(): boolean {
    const xhr = this.xhr
    if (!xhr || xhr.readyState === XMLHttpRequest.DONE) return false

    xhr.abort()
    return true
  }

  get isUploading(): boolean {
    return this.xhr !== null && this.xhr.readyState !== XMLHttpRequest.DONE
  }
}

/**
 * Upload multiple files with progress tracking
 */
export class MultiFileUpload {
  private uploads: Map<string, UploadWithProgress> = new Map()
  private abortController = new AbortController()

  constructor(
    private url: string,
    private files: File[],
    private onFileProgress?: (fileId: string, progress: number) => void,
    private onFileComplete?: (fileId: string, response: unknown) => void,
    private onFileError?: (fileId: string, error: Error) => void,
    private onFileCancel?: (fileId: string, error: UploadCancelledError) => void,
  ) {}

  async uploadAll(): Promise<{
    successful: unknown[]
    failed: { fileId: string; error: Error }[]
    cancelled: string[]
  }> {
    const successful: unknown[] = []
    const failed: { fileId: string; error: Error }[] = []
    const cancelled: string[] = []

    const uploadPromises = this.files.map(async (file, index) => {
      const fileId = `${file.name}-${index}`
      
      const upload = new UploadWithProgress(this.url, file, {
        onProgress: (progress) => this.onFileProgress?.(fileId, progress),
        onSuccess: (response) => {
          this.onFileComplete?.(fileId, response)
          successful.push(response)
        },
        onError: (error) => {
          this.onFileError?.(fileId, error)
          failed.push({ fileId, error })
        },
        onCancel: (error) => {
          this.onFileCancel?.(fileId, error)
          cancelled.push(fileId)
        },
        signal: this.abortController.signal
      })

      this.uploads.set(fileId, upload)

      try {
        return await upload.upload()
      } catch {
        // Error already handled in onError callback
        return null
      } finally {
        this.uploads.delete(fileId)
      }
    })

    await Promise.allSettled(uploadPromises)
    
    return { successful, failed, cancelled }
  }

  cancelUpload(fileId: string): void {
    const upload = this.uploads.get(fileId)
    if (upload) {
      upload.abort()
      this.uploads.delete(fileId)
    }
  }

  cancelAll(): void {
    this.abortController.abort()
    this.uploads.clear()
  }

  getUploadStatus(fileId: string): boolean {
    const upload = this.uploads.get(fileId)
    return upload?.isUploading ?? false
  }
}

/**
 * Convenience function for single file upload with progress
 */
export function uploadFileWithProgress(
  url: string,
  file: File,
  options: UploadWithProgressOptions = {}
): UploadWithProgress {
  return new UploadWithProgress(url, file, options)
}

/**
 * Convenience function for multiple file upload with progress
 */
export function uploadMultipleFilesWithProgress(
  url: string,
  files: File[],
  callbacks: {
    onFileProgress?: (fileId: string, progress: number) => void
    onFileComplete?: (fileId: string, response: unknown) => void
    onFileError?: (fileId: string, error: Error) => void
    onFileCancel?: (fileId: string, error: UploadCancelledError) => void
  } = {}
): MultiFileUpload {
  return new MultiFileUpload(
    url,
    files,
    callbacks.onFileProgress,
    callbacks.onFileComplete,
    callbacks.onFileError,
    callbacks.onFileCancel,
  )
}

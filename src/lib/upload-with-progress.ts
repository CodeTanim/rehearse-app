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
  signal?: AbortSignal
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
      this.xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', this.file)

      // Progress tracking
      this.xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          this.options.onProgress?.(Math.round(progress))
        }
      })

      // Success handler
      this.xhr.addEventListener('load', () => {
        if (this.xhr!.status >= 200 && this.xhr!.status < 300) {
          try {
            const response = JSON.parse(this.xhr!.responseText)
            this.options.onSuccess?.(response)
            resolve(response)
          } catch (error) {
            const parseError = new Error('Failed to parse response')
            this.options.onError?.(parseError)
            reject(parseError)
          }
        } else {
          let errorMessage = 'Upload failed'
          try {
            const errorResponse = JSON.parse(this.xhr!.responseText)
            errorMessage = errorResponse.error || errorMessage
          } catch {
            // Use default error message if response isn't JSON
          }
          
          const error = new Error(errorMessage)
          this.options.onError?.(error)
          reject(error)
        }
      })

      // Error handler
      this.xhr.addEventListener('error', () => {
        const error = new Error('Network error during upload')
        this.options.onError?.(error)
        reject(error)
      })

      // Abort handler
      this.xhr.addEventListener('abort', () => {
        const error = new Error('Upload cancelled')
        this.options.onError?.(error)
        reject(error)
      })

      // Handle external abort signal
      if (this.options.signal) {
        this.options.signal.addEventListener('abort', () => {
          this.abort()
        })
      }

      // Start upload
      this.xhr.open('POST', this.url)
      this.xhr.send(formData)
    })
  }

  abort(): void {
    if (this.xhr) {
      this.xhr.abort()
      this.xhr = null
    }
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
    private onFileError?: (fileId: string, error: Error) => void
  ) {}

  async uploadAll(): Promise<{ successful: unknown[]; failed: { fileId: string; error: Error }[] }> {
    const successful: unknown[] = []
    const failed: { fileId: string; error: Error }[] = []

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
        signal: this.abortController.signal
      })

      this.uploads.set(fileId, upload)

      try {
        return await upload.upload()
      } catch (error) {
        // Error already handled in onError callback
        return null
      } finally {
        this.uploads.delete(fileId)
      }
    })

    await Promise.allSettled(uploadPromises)
    
    return { successful, failed }
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
  } = {}
): MultiFileUpload {
  return new MultiFileUpload(
    url,
    files,
    callbacks.onFileProgress,
    callbacks.onFileComplete,
    callbacks.onFileError
  )
}
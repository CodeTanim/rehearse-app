import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MultiFileUpload,
  UploadCancelledError,
  UploadWithProgress,
} from '@/lib/upload-with-progress'

class FakeXMLHttpRequest extends EventTarget {
  static readonly UNSENT = 0
  static readonly OPENED = 1
  static readonly DONE = 4
  static instances: FakeXMLHttpRequest[] = []

  readonly upload = new EventTarget()
  readyState = FakeXMLHttpRequest.UNSENT
  status = 0
  responseText = ''
  aborted = false
  method = ''
  url = ''
  body: Document | XMLHttpRequestBodyInit | null = null

  constructor() {
    super()
    FakeXMLHttpRequest.instances.push(this)
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
    this.readyState = FakeXMLHttpRequest.OPENED
  }

  send(body: Document | XMLHttpRequestBodyInit | null) {
    this.body = body
  }

  abort() {
    if (this.readyState === FakeXMLHttpRequest.DONE) return
    this.aborted = true
    this.readyState = FakeXMLHttpRequest.DONE
    this.dispatchEvent(new Event('abort'))
  }

  reportProgress(loaded: number, total: number) {
    const event = new Event('progress')
    Object.defineProperties(event, {
      lengthComputable: { value: true },
      loaded: { value: loaded },
      total: { value: total },
    })
    this.upload.dispatchEvent(event)
  }

  respond(status: number, response: unknown) {
    this.status = status
    this.responseText = JSON.stringify(response)
    this.readyState = FakeXMLHttpRequest.DONE
    this.dispatchEvent(new Event('load'))
  }
}

const originalXMLHttpRequest = globalThis.XMLHttpRequest

describe('UploadWithProgress', () => {
  beforeEach(() => {
    FakeXMLHttpRequest.instances = []
    globalThis.XMLHttpRequest = FakeXMLHttpRequest as unknown as typeof XMLHttpRequest
  })

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXMLHttpRequest
  })

  it('aborts the active request and reports cancellation separately from errors', async () => {
    const controller = new AbortController()
    const onCancel = vi.fn()
    const onError = vi.fn()
    const onSuccess = vi.fn()
    const uploader = new UploadWithProgress('/upload', new File(['notes'], 'notes.txt'), {
      signal: controller.signal,
      onCancel,
      onError,
      onSuccess,
    })

    const result = uploader.upload()
    const request = FakeXMLHttpRequest.instances[0]
    expect(uploader.isUploading).toBe(true)

    controller.abort()

    await expect(result).rejects.toBeInstanceOf(UploadCancelledError)
    expect(request.aborted).toBe(true)
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(uploader.isUploading).toBe(false)

    request.respond(201, { id: 'too-late' })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('does not start a request when its signal is already aborted', async () => {
    const controller = new AbortController()
    const onCancel = vi.fn()
    const onError = vi.fn()
    controller.abort()

    const uploader = new UploadWithProgress('/upload', new File(['notes'], 'notes.txt'), {
      signal: controller.signal,
      onCancel,
      onError,
    })

    await expect(uploader.upload()).rejects.toBeInstanceOf(UploadCancelledError)
    expect(FakeXMLHttpRequest.instances).toHaveLength(0)
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('tracks progress, settles successfully, and releases its request handle', async () => {
    const onProgress = vi.fn()
    const onSuccess = vi.fn()
    const uploader = new UploadWithProgress('/upload', new File(['notes'], 'notes.txt'), {
      onProgress,
      onSuccess,
    })

    const result = uploader.upload()
    const request = FakeXMLHttpRequest.instances[0]
    request.reportProgress(1, 4)
    request.respond(201, { id: 'file-1' })

    await expect(result).resolves.toEqual({ id: 'file-1' })
    expect(onProgress).toHaveBeenCalledWith(25)
    expect(onSuccess).toHaveBeenCalledWith({ id: 'file-1' })
    expect(uploader.isUploading).toBe(false)
    expect(uploader.abort()).toBe(false)
  })

  it('does not classify a cancelled multi-file upload as failed', async () => {
    const onFileError = vi.fn()
    const onFileCancel = vi.fn()
    const uploads = new MultiFileUpload(
      '/upload',
      [new File(['notes'], 'notes.txt')],
      undefined,
      undefined,
      onFileError,
      onFileCancel,
    )

    const result = uploads.uploadAll()
    uploads.cancelUpload('notes.txt-0')

    await expect(result).resolves.toMatchObject({
      successful: [],
      failed: [],
      cancelled: ['notes.txt-0'],
    })
    expect(onFileCancel).toHaveBeenCalledOnce()
    expect(onFileError).not.toHaveBeenCalled()
  })
})

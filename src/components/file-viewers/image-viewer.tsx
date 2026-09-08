'use client'

import { useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import { Expand, Minus, Plus, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ImageViewerProps {
  fileUrl: string
  fileName: string
  mimeType: string
}

export function ImageViewer({ fileUrl, fileName }: ImageViewerProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  const zoomIn = useCallback(() => setScale((current) => Math.min(current * 1.5, 5)), [])
  const zoomOut = useCallback(() => setScale((current) => Math.max(current / 1.5, 0.1)), [])
  const resetView = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !imageSize) return

    const containerWidth = containerRef.current.clientWidth - 32
    const containerHeight = containerRef.current.clientHeight - 32
    setScale(Math.min(containerWidth / imageSize.width, containerHeight / imageSize.height, 1))
    setPosition({ x: 0, y: 0 })
  }, [imageSize])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomIn()
    } else if (event.key === '-') {
      event.preventDefault()
      zoomOut()
    } else if (event.key === '0') {
      event.preventDefault()
      resetView()
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      fitToScreen()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b-[3px] border-foreground bg-muted p-3 sm:flex-row sm:items-center sm:justify-between">
        {imageSize ? (
          <p className="text-xs font-medium text-muted-foreground">
            {imageSize.width} × {imageSize.height} pixels
          </p>
        ) : <span />}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2" role="group" aria-label="Image zoom">
            <Button type="button" variant="outline" size="icon-sm" onClick={zoomOut} disabled={scale <= 0.1} aria-label="Zoom out">
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <output className="min-w-14 text-center text-sm font-black" aria-label="Current zoom">
              {Math.round(scale * 100)}%
            </output>
            <Button type="button" variant="outline" size="icon-sm" onClick={zoomIn} disabled={scale >= 5} aria-label="Zoom in">
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={fitToScreen} disabled={!imageSize}>
            <Expand className="size-4" aria-hidden="true" />
            Fit
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetView}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring"
        tabIndex={0}
        role="region"
        aria-label={`Image canvas for ${fileName}. Use plus or minus to zoom, F to fit, and 0 to reset.`}
        onKeyDown={handleKeyDown}
        onWheel={(event) => {
          event.preventDefault()
          const delta = event.deltaY > 0 ? 0.9 : 1.1
          setScale((current) => Math.max(0.1, Math.min(current * delta, 5)))
        }}
      >
        <div
          className="flex h-full w-full items-center justify-center"
          onMouseDown={(event) => {
            if (scale <= 1) return
            setIsDragging(true)
            setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y })
          }}
          onMouseMove={(event) => {
            if (!isDragging || scale <= 1) return
            setPosition({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y })
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          style={{ cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default' }}
        >
          <Image
            src={fileUrl}
            alt={fileName}
            width={imageSize?.width ?? 1}
            height={imageSize?.height ?? 1}
            unoptimized
            onLoad={(event) => {
              setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
              setLoading(false)
              setError(false)
            }}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
            className={`max-w-none select-none ${error ? 'invisible' : ''}`}
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 100ms ease-out',
            }}
            draggable={false}
          />
        </div>

        {loading ? (
          <div className="absolute inset-0 grid place-items-center bg-muted" role="status" aria-live="polite">
            <div className="text-center">
              <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-4 border-accent border-t-transparent" aria-hidden="true" />
              <p className="font-bold text-muted-foreground">Loading image…</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 grid place-items-center bg-muted p-6" role="alert">
            <div className="max-w-md text-center">
              <p className="text-lg font-black text-destructive">Couldn’t open this image.</p>
              <p className="mt-2 text-sm text-muted-foreground">It may be damaged or unsupported.</p>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  )
}

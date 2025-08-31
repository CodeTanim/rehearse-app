'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ImageViewerProps {
  fileUrl: string
  fileName: string
  mimeType: string
}

export function ImageViewer({ fileUrl, fileName, mimeType }: ImageViewerProps) {
  const [scale, setScale] = useState<number>(1.0)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<boolean>(false)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const handleImageLoadStart = useCallback(() => {
    setLoading(true)
    setError(false)
  }, [])

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
    setLoading(false)
    setError(false)
  }, [])

  const handleImageError = useCallback(() => {
    setLoading(false)
    setError(true)
  }, [])

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.5, 5.0))
  }, [])

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.5, 0.1))
  }, [])

  const resetView = useCallback(() => {
    setScale(1.0)
    setPosition({ x: 0, y: 0 })
  }, [])

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !imageSize) return
    
    const container = containerRef.current
    const containerWidth = container.clientWidth - 32 // padding
    const containerHeight = container.clientHeight - 32
    
    const scaleX = containerWidth / imageSize.width
    const scaleY = containerHeight / imageSize.height
    const newScale = Math.min(scaleX, scaleY, 1.0) // Don't scale up beyond original size
    
    setScale(newScale)
    setPosition({ x: 0, y: 0 })
  }, [imageSize])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1.0) return // Only allow dragging when zoomed in
    
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }, [scale, position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || scale <= 1.0) return
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }, [isDragging, dragStart, scale])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(prev => Math.max(0.1, Math.min(prev * delta, 5.0)))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body) return // Only when not focusing inputs
      
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault()
          zoomIn()
          break
        case '-':
          e.preventDefault()
          zoomOut()
          break
        case '0':
          e.preventDefault()
          resetView()
          break
        case 'f':
          e.preventDefault()
          fitToScreen()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomIn, zoomOut, resetView, fitToScreen])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading image...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-destructive font-medium">Failed to load image</p>
          <p className="text-muted-foreground text-sm mt-1">The image file may be corrupted or unsupported</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Image Controls */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center space-x-4">
          <h3 className="font-medium text-foreground truncate max-w-xs">{fileName}</h3>
          {imageSize && (
            <span className="text-sm text-muted-foreground">
              {imageSize.width} × {imageSize.height}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-1">
            <Button variant="outline" size="sm" onClick={zoomOut} disabled={scale <= 0.1}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </Button>
            <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="outline" size="sm" onClick={zoomIn} disabled={scale >= 5.0}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Button>
          </div>

          {/* View Controls */}
          <div className="flex items-center space-x-1 border-l border-border pl-2 ml-2">
            <Button variant="outline" size="sm" onClick={fitToScreen}>
              Fit
            </Button>
            <Button variant="outline" size="sm" onClick={resetView}>
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Image Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden bg-gray-100 relative"
        onWheel={handleWheel}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : scale > 1.0 ? 'grab' : 'default' }}
        >
          <img
            ref={imageRef}
            src={fileUrl}
            alt={fileName}
            onLoadStart={handleImageLoadStart}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="max-w-none select-none"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            draggable={false}
          />
        </div>

        {/* Keyboard hints */}
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
          Use +/- to zoom, F to fit, 0 to reset
        </div>
      </div>
    </div>
  )
}
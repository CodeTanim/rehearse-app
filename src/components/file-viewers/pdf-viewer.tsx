'use client'

import { useState, useCallback, useEffect } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, LoaderCircle, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'

// Dynamically import react-pdf components to avoid SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => ({ default: mod.Document })), { 
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center" role="status">
      <LoaderCircle className="size-8 animate-spin text-accent" aria-hidden="true" />
      <span className="sr-only">Loading PDF viewer…</span>
    </div>
  )
})

const Page = dynamic(() => import('react-pdf').then(mod => ({ default: mod.Page })), { 
  ssr: false 
})

interface PDFViewerProps {
  fileUrl: string
  fileName: string
}

export function PDFViewer({ fileUrl, fileName }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState<number>(1.0)

  // Set up PDF.js worker only on client side
  useEffect(() => {
    let active = true

    void import('react-pdf').then((mod) => {
      if (active) {
        mod.pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()
      }
    })

    return () => {
      active = false
    }
  }, [])

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback(() => {
    setError('Couldn’t open this PDF. Download it instead.')
  }, [])

  const goToPrevPage = useCallback(() => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setPageNumber(prev => Math.min(prev + 1, numPages))
  }, [numPages])

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 3.0))
  }, [])

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1.0)
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
          </div>
          <p className="text-destructive font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" aria-label={`PDF viewer for ${fileName}`}>
      {/* PDF Controls */}
      <div className="flex flex-col gap-3 border-b-[3px] border-foreground bg-muted p-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-bold text-muted-foreground">
          {numPages} page{numPages !== 1 ? 's' : ''}
        </span>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2" role="group" aria-label="PDF zoom">
            <Button type="button" variant="outline" size="icon-sm" onClick={zoomOut} disabled={scale <= 0.5} aria-label="Zoom out">
              <Minus aria-hidden="true" className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button type="button" variant="outline" size="icon-sm" onClick={zoomIn} disabled={scale >= 3.0} aria-label="Zoom in">
              <Plus aria-hidden="true" className="size-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetZoom}>
              Reset
            </Button>
          </div>

          {/* Page Navigation */}
          {numPages > 1 && (
            <div className="flex items-center gap-2 sm:border-l-2 sm:border-foreground/30 sm:pl-3" role="group" aria-label="PDF pages">
              <Button type="button" variant="outline" size="icon-sm" onClick={goToPrevPage} disabled={pageNumber <= 1} aria-label="Previous page">
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[4rem] text-center">
                {pageNumber} / {numPages}
              </span>
              <Button type="button" variant="outline" size="icon-sm" onClick={goToNextPage} disabled={pageNumber >= numPages} aria-label="Next page">
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-muted p-4">
        <div className="flex justify-center">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={(
              <div className="flex items-center justify-center p-8" role="status">
                <div className="text-center">
                  <LoaderCircle className="mx-auto mb-4 size-8 animate-spin text-accent" aria-hidden="true" />
                  <p className="text-muted-foreground">Loading…</p>
                </div>
              </div>
            )}
            error={null}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="border-[3px] border-foreground shadow-[5px_5px_0_var(--paper-shadow)]"
            />
          </Document>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { FileWithMetadata } from '@/lib/types/file'
import { FileUtils } from '@/lib/file-utils'

interface FileToolbarProps {
  files: FileWithMetadata[]
  viewMode: 'list' | 'grid'
  onViewModeChange: (mode: 'list' | 'grid') => void
  searchTerm?: string
  onSearchChange?: (term: string) => void
  selectedCategory?: string
  onCategoryChange?: (category: string) => void
  onUploadClick?: () => void
  className?: string
}

export function FileToolbar({
  files,
  viewMode,
  onViewModeChange,
  searchTerm = '',
  onSearchChange,
  selectedCategory = 'all',
  onCategoryChange,
  onUploadClick,
  className = ''
}: FileToolbarProps) {
  const [showFilters, setShowFilters] = useState(false)

  const categories = [
    { id: 'all', label: 'All Files', count: files.length },
    { id: 'image', label: 'Images', count: files.filter(f => FileUtils.getMimeTypeCategory(f.mimeType) === 'image').length },
    { id: 'document', label: 'Documents', count: files.filter(f => FileUtils.getMimeTypeCategory(f.mimeType) === 'document').length },
    { id: 'text', label: 'Text Files', count: files.filter(f => FileUtils.getMimeTypeCategory(f.mimeType) === 'text').length },
    { id: 'archive', label: 'Archives', count: files.filter(f => FileUtils.getMimeTypeCategory(f.mimeType) === 'archive').length },
  ].filter(category => category.count > 0 || category.id === 'all')

  const totalSize = files.reduce((total, file) => total + file.size, 0)

  const handleCategoryClick = useCallback((categoryId: string) => {
    onCategoryChange?.(categoryId)
  }, [onCategoryChange])

  const clearSearch = useCallback(() => {
    onSearchChange?.('')
  }, [onSearchChange])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left side - File count and upload */}
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{files.length}</span> files
            {totalSize > 0 && (
              <span className="ml-2">• {FileUtils.formatFileSize(totalSize)}</span>
            )}
          </div>
          
          {onUploadClick && (
            <Button
              onClick={onUploadClick}
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Files
            </Button>
          )}
        </div>

        {/* Right side - Search and controls */}
        <div className="flex items-center space-x-2">
          {/* Search */}
          {onSearchChange && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 pr-8 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent w-48"
              />
              <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground hover:text-foreground"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Filter Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-muted' : ''}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
            </svg>
            Filter
          </Button>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('list')}
              className="rounded-r-none border-r border-border"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
              className="rounded-l-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      {/* Category Filters */}
      {showFilters && onCategoryChange && (
        <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border border-border">
          <div className="text-sm font-medium text-foreground mb-2 w-full">Filter by type:</div>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCategoryClick(category.id)}
              className="text-xs"
            >
              {category.label}
              <span className="ml-2 bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full text-xs">
                {category.count}
              </span>
            </Button>
          ))}
        </div>
      )}

      {/* Active Filters Display */}
      {(searchTerm || selectedCategory !== 'all') && (
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-muted-foreground">Active filters:</span>
          
          {searchTerm && (
            <div className="flex items-center space-x-1 bg-accent/10 text-accent px-2 py-1 rounded-md">
              <span>Search: &quot;{searchTerm}&quot;</span>
              <button
                onClick={clearSearch}
                className="w-4 h-4 hover:text-accent/80"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          
          {selectedCategory !== 'all' && (
            <div className="flex items-center space-x-1 bg-accent/10 text-accent px-2 py-1 rounded-md">
              <span>Type: {categories.find(c => c.id === selectedCategory)?.label}</span>
              <button
                onClick={() => handleCategoryClick('all')}
                className="w-4 h-4 hover:text-accent/80"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange?.('')
              onCategoryChange?.('all')
            }}
            className="text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
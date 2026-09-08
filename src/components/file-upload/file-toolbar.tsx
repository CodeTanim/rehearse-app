'use client'

import { useCallback, useId, useState } from 'react'
import { Filter, Grid2X2, List, Plus, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FileUtils } from '@/lib/file-utils'
import { FileWithMetadata } from '@/lib/types/file'

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
  className = '',
}: FileToolbarProps) {
  const [showFilters, setShowFilters] = useState(false)
  const filtersId = useId()

  const categories = [
    { id: 'all', label: 'All files', count: files.length },
    { id: 'image', label: 'Images', count: files.filter((file) => FileUtils.getMimeTypeCategory(file.mimeType) === 'image').length },
    { id: 'document', label: 'Documents', count: files.filter((file) => FileUtils.getMimeTypeCategory(file.mimeType) === 'document').length },
    { id: 'text', label: 'Text files', count: files.filter((file) => FileUtils.getMimeTypeCategory(file.mimeType) === 'text').length },
    { id: 'archive', label: 'Archives', count: files.filter((file) => FileUtils.getMimeTypeCategory(file.mimeType) === 'archive').length },
  ].filter((category) => category.count > 0 || category.id === 'all')

  const totalSize = files.reduce((total, file) => total + file.size, 0)

  const handleCategoryClick = useCallback(
    (categoryId: string) => onCategoryChange?.(categoryId),
    [onCategoryChange],
  )

  const clearSearch = useCallback(() => onSearchChange?.(''), [onSearchChange])

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="muted">
            {files.length} {files.length === 1 ? 'file' : 'files'}
            {totalSize > 0 ? ` · ${FileUtils.formatFileSize(totalSize)}` : ''}
          </Badge>
          {onUploadClick ? (
            <Button type="button" size="sm" variant="accent" onClick={onUploadClick}>
              <Plus className="size-4" aria-hidden="true" />
              Upload
            </Button>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {onSearchChange ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-64">
              <label htmlFor={`${filtersId}-search`} className="sr-only">
                Search files
              </label>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id={`${filtersId}-search`}
                  type="search"
                  placeholder="Search files"
                  value={searchTerm}
                  onChange={(event) => onSearchChange(event.target.value)}
                  className="min-w-0 pl-10"
                />
              </div>
              {searchTerm ? (
                <Button type="button" variant="outline" size="icon-sm" onClick={clearSearch} aria-label="Clear file search">
                  <X className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={showFilters ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowFilters((current) => !current)}
              aria-expanded={showFilters}
              aria-controls={filtersId}
            >
              <Filter className="size-4" aria-hidden="true" />
              Filter
            </Button>

            <div className="flex items-center gap-2" role="group" aria-label="File view">
              <Button
                type="button"
                variant={viewMode === 'list' ? 'secondary' : 'outline'}
                size="icon-sm"
                onClick={() => onViewModeChange('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
              >
                <List className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'grid' ? 'secondary' : 'outline'}
                size="icon-sm"
                onClick={() => onViewModeChange('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
              >
                <Grid2X2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showFilters && onCategoryChange ? (
        <Card id={filtersId} tone="note" className="gap-3 p-4">
          <p className="text-sm font-black">Type</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                type="button"
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleCategoryClick(category.id)}
                aria-pressed={selectedCategory === category.id}
              >
                {category.label}
                <span aria-hidden="true">({category.count})</span>
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      {searchTerm || selectedCategory !== 'all' ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active file filters">
          {searchTerm ? <Badge>“{searchTerm}”</Badge> : null}
          {selectedCategory !== 'all' ? (
            <Badge>{categories.find((category) => category.id === selectedCategory)?.label ?? selectedCategory}</Badge>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange?.('')
              onCategoryChange?.('all')
            }}
          >
            Clear
          </Button>
        </div>
      ) : null}
    </div>
  )
}

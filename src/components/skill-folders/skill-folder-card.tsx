'use client'

import { SkillFolder } from '@/lib/types/skill-folder'
import { Button } from '@/components/ui/button'

interface SkillFolderCardProps {
  skillFolder: SkillFolder
  onDelete: (id: string) => void
  onView: (id: string) => void
}

export function SkillFolderCard({ skillFolder, onDelete, onView }: SkillFolderCardProps) {
  const totalItems = (skillFolder._count?.files || 0) + (skillFolder._count?.notes || 0) + (skillFolder._count?.qaPairs || 0)

  return (
    <div 
      className="border border-border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer bg-card"
      style={{ borderLeftColor: skillFolder.color || '#E6A045', borderLeftWidth: '4px' }}
      onClick={() => onView(skillFolder.id)}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground mb-2">{skillFolder.name}</h3>
          {skillFolder.description && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{skillFolder.description}</p>
          )}
        </div>
        <div className="flex space-x-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(skillFolder.id)
            }}
            className="text-destructive hover:text-destructive/80"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div className="flex space-x-4">
          <span>{skillFolder._count?.files || 0} files</span>
          <span>{skillFolder._count?.notes || 0} notes</span>
          <span>{skillFolder._count?.qaPairs || 0} Q&As</span>
        </div>
        <div>
          <span>{totalItems} total items</span>
        </div>
      </div>
      
      <div className="mt-3 text-xs text-muted-foreground/70">
        Created {new Date(skillFolder.createdAt).toLocaleDateString()}
      </div>
    </div>
  )
}
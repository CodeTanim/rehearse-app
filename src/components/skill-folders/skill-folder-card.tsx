'use client'

import { ArrowRightIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PaperCard,
  PaperCardContent,
  PaperCardFooter,
} from '@/components/ui/paper-card'
import type { SkillFolder } from '@/lib/types/skill-folder'

interface SkillFolderCardProps {
  skillFolder: SkillFolder
  onDelete: (id: string) => void
  onView: (id: string) => void
  isDeleting?: boolean
}

export function SkillFolderCard({
  skillFolder,
  onDelete,
  onView,
  isDeleting = false,
}: SkillFolderCardProps) {
  const fileCount = skillFolder._count?.files ?? 0
  const noteCount = skillFolder._count?.notes ?? 0

  return (
    <article aria-labelledby={`folder-${skillFolder.id}-title`} className="h-full">
      <PaperCard
        className={`flex h-full min-h-44 flex-col overflow-hidden transition-opacity ${
          isDeleting ? 'pointer-events-none opacity-55' : ''
        }`}
        aria-busy={isDeleting || undefined}
      >
        <div
          aria-hidden="true"
          className="h-1 w-full"
          style={{ backgroundColor: skillFolder.color || '#79A986' }}
        />

        <PaperCardContent className="flex flex-1 flex-col gap-3 pt-5">
          <h2 id={`folder-${skillFolder.id}-title`} className="min-w-0 break-words text-lg font-semibold">
            {skillFolder.name}
          </h2>
          {skillFolder.description ? (
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
              {skillFolder.description}
            </p>
          ) : null}
          <p className="mt-auto text-sm text-muted-foreground">
            {fileCount} {fileCount === 1 ? 'file' : 'files'} · {noteCount} {noteCount === 1 ? 'note' : 'notes'}
          </p>
        </PaperCardContent>

        <PaperCardFooter className="mt-auto flex items-center gap-2 pt-3">
          <Button type="button" onClick={() => onView(skillFolder.id)} className="min-w-0 flex-1">
            Open
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(skillFolder.id)}
            disabled={isDeleting}
            aria-label={`Delete ${skillFolder.name}`}
            className="shrink-0 text-destructive"
          >
            <Trash2Icon aria-hidden="true" className="size-4" />
          </Button>
        </PaperCardFooter>
      </PaperCard>
    </article>
  )
}

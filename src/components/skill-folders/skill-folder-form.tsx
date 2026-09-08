'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CreateSkillFolderData, SkillFolder, UpdateSkillFolderData } from '@/lib/types/skill-folder'

interface SkillFolderFormProps {
  skillFolder?: SkillFolder
  onSubmit: (data: CreateSkillFolderData | UpdateSkillFolderData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const folderColors = [
  { name: 'Meadow', value: '#79A986' },
  { name: 'Sage', value: '#91B79A' },
  { name: 'Mint', value: '#B7D9C0' },
  { name: 'Eucalyptus', value: '#6F9F96' },
  { name: 'Moss', value: '#789263' },
  { name: 'Soft clay', value: '#C98A7D' },
  { name: 'Fog', value: '#DDE8E0' },
  { name: 'Pine ink', value: '#456052' },
]

interface FormErrors {
  name?: string
  description?: string
}

export function SkillFolderForm({ skillFolder, onSubmit, onCancel, isLoading = false }: SkillFolderFormProps) {
  const [name, setName] = useState(skillFolder?.name || '')
  const [description, setDescription] = useState(skillFolder?.description || '')
  const [color, setColor] = useState(skillFolder?.color || folderColors[0].value)
  const [errors, setErrors] = useState<FormErrors>({})

  const validateForm = () => {
    const newErrors: FormErrors = {}
    const trimmedName = name.trim()

    if (!trimmedName) {
      newErrors.name = 'Name is required'
    } else if (trimmedName.length > 100) {
      newErrors.name = 'Name must be 100 characters or fewer'
    }
    if (description.trim().length > 500) {
      newErrors.description = 'Outcome must be 500 characters or fewer'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!validateForm()) return

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-4">
          <label htmlFor="skill-folder-name" className="text-sm font-medium text-foreground">
            Name
          </label>
          {name.length >= 80 ? (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {name.length}/100
            </span>
          ) : null}
        </div>
        <Input
          id="skill-folder-name"
          name="name"
          data-modal-autofocus
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (errors.name) setErrors({})
          }}
          placeholder="JavaScript fundamentals"
          autoComplete="off"
          maxLength={100}
          required
          disabled={isLoading}
          error={errors.name}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-4">
          <label htmlFor="skill-folder-description" className="text-sm font-medium text-foreground">
            Outcome <span className="font-medium text-muted-foreground">(optional)</span>
          </label>
          {description.length >= 450 ? (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {description.length}/500
            </span>
          ) : null}
        </div>
        <Textarea
          id="skill-folder-description"
          name="description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value)
            if (errors.description) setErrors((current) => ({ ...current, description: undefined }))
          }}
          placeholder="What should you be able to do?"
          disabled={isLoading}
          rows={3}
          maxLength={500}
          error={errors.description}
        />
      </div>

      <details className="rounded-lg border border-border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          Color
          <span
            aria-hidden="true"
            className="ml-2 inline-block size-3 rounded-full border border-border align-middle"
            style={{ backgroundColor: color }}
          />
        </summary>
        <fieldset disabled={isLoading} className="mt-4">
          <legend className="sr-only">Folder color</legend>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {folderColors.map((colorOption) => (
              <button
                key={colorOption.value}
                type="button"
                onClick={() => setColor(colorOption.value)}
                className={`grid size-10 place-items-center rounded-full border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  color === colorOption.value ? 'ring-2 ring-foreground ring-offset-2' : ''
                }`}
                style={{ backgroundColor: colorOption.value }}
                aria-label={`Use ${colorOption.name} marker`}
                aria-pressed={color === colorOption.value}
                title={colorOption.name}
              >
                {color === colorOption.value ? (
                  <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-background text-xs font-semibold text-foreground">
                    ✓
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            {folderColors.find((option) => option.value === color)?.name || 'Custom'} selected
          </p>
        </fieldset>
      </details>

      <div className="grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="w-full">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} isLoading={isLoading} className="w-full">
          {skillFolder ? 'Save' : 'Create'}
        </Button>
      </div>
    </form>
  )
}

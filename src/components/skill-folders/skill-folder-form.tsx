'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SkillFolder, CreateSkillFolderData, UpdateSkillFolderData } from '@/lib/types/skill-folder'

interface SkillFolderFormProps {
  skillFolder?: SkillFolder
  onSubmit: (data: CreateSkillFolderData | UpdateSkillFolderData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const defaultColors = [
  '#E6A045', // Accent/Amber (primary)
  '#6B8C6B', // Success/Green
  '#D4A574', // Terracotta
  '#8FA8B2', // Info/Blue
  '#B91C1C', // Destructive/Red
  '#8B7D70', // Muted
  '#F2ECE4', // Primary/Sage
  '#3D3530', // Foreground/Dark
]

export function SkillFolderForm({ skillFolder, onSubmit, onCancel, isLoading }: SkillFolderFormProps) {
  const [name, setName] = useState(skillFolder?.name || '')
  const [description, setDescription] = useState(skillFolder?.description || '')
  const [color, setColor] = useState(skillFolder?.color || defaultColors[0])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (skillFolder) {
      setName(skillFolder.name)
      setDescription(skillFolder.description || '')
      setColor(skillFolder.color || defaultColors[0])
    }
  }, [skillFolder])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Name is required'
    } else if (name.length > 100) {
      newErrors.name = 'Name must be less than 100 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    }

    await onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          Skill Folder Name *
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., JavaScript, Mathematics, Guitar"
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description (Optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what you'll learn in this skill folder..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Color Theme
        </label>
        <div className="flex flex-wrap gap-3">
          {defaultColors.map((colorOption) => (
            <button
              key={colorOption}
              type="button"
              onClick={() => setColor(colorOption)}
              className={`w-10 h-10 rounded-full border-2 transition-all ${
                color === colorOption 
                  ? 'border-gray-800 scale-110' 
                  : 'border-gray-300 hover:border-gray-500'
              }`}
              style={{ backgroundColor: colorOption }}
              aria-label={`Select color ${colorOption}`}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {isLoading ? 'Saving...' : skillFolder ? 'Update Folder' : 'Create Folder'}
        </Button>
      </div>
    </form>
  )
}
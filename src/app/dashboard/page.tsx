"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSkillFolders } from "@/hooks/use-skill-folders"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { SkillFolderCard } from "@/components/skill-folders/skill-folder-card"
import { SkillFolderForm } from "@/components/skill-folders/skill-folder-form"
import { SkillFolderDetail } from "@/components/skill-folders/skill-folder-detail"
import { SkillFolder, CreateSkillFolderData, UpdateSkillFolderData } from "@/lib/types/skill-folder"

export default function DashboardPage() {
  const { user, logout, isLoading: authLoading } = useAuth()
  const { 
    skillFolders, 
    isLoading, 
    error, 
    fetchSkillFolders, 
    createSkillFolder, 
    updateSkillFolder, 
    deleteSkillFolder 
  } = useSkillFolders()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<SkillFolder | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<SkillFolder | null>(null)

  useEffect(() => {
    if (user) {
      fetchSkillFolders()
    }
  }, [user, fetchSkillFolders])

  const handleCreateFolder = async (data: CreateSkillFolderData | UpdateSkillFolderData) => {
    try {
      // For create, we need name to be required, so we cast appropriately
      await createSkillFolder(data as CreateSkillFolderData)
      setIsCreateModalOpen(false)
    } catch {
      // Error is handled by the hook
    }
  }

  const handleUpdateFolder = async (data: CreateSkillFolderData | UpdateSkillFolderData) => {
    if (!editingFolder) return
    
    try {
      await updateSkillFolder(editingFolder.id, data)
      setIsEditModalOpen(false)
      setEditingFolder(null)
    } catch {
      // Error is handled by the hook
    }
  }

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this skill folder? This action cannot be undone.')) {
      return
    }

    setIsDeleting(id)
    try {
      await deleteSkillFolder(id)
    } catch {
      // Error is handled by the hook
    } finally {
      setIsDeleting(null)
    }
  }

  const handleEditFolder = (folder: SkillFolder) => {
    setEditingFolder(folder)
    setIsEditModalOpen(true)
  }

  const handleViewFolder = (id: string) => {
    const folder = skillFolders.find(f => f.id === id)
    if (folder) {
      setSelectedFolder(folder)
    }
  }

  const handleBackToList = () => {
    setSelectedFolder(null)
  }

  const handleEditSelectedFolder = () => {
    if (selectedFolder) {
      setEditingFolder(selectedFolder)
      setIsEditModalOpen(true)
    }
  }

  const handleDeleteSelectedFolder = async () => {
    if (selectedFolder) {
      await handleDeleteFolder(selectedFolder.id)
      setSelectedFolder(null) // Go back to list after deletion
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-primary-foreground font-bold text-sm">R</span>
              </div>
              <h1 className="text-xl font-semibold text-foreground">Rehearse Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {user?.name || user?.email}
              </span>
              <Button
                onClick={logout}
                variant="outline"
                size="sm"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedFolder ? (
          // Show selected folder detail
          <SkillFolderDetail
            skillFolder={selectedFolder}
            onClose={handleBackToList}
            onEdit={handleEditSelectedFolder}
            onDelete={handleDeleteSelectedFolder}
          />
        ) : (
          // Show folder list
          <>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Skill Folders</h2>
                <p className="text-muted-foreground mt-1">
                  Organize your learning materials and track your progress
                </p>
              </div>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Create Skill Folder
              </Button>
            </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading skill folders...</p>
          </div>
        ) : skillFolders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 1v4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 1v4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No skill folders yet</h3>
            <p className="text-muted-foreground mb-6">Create your first skill folder to start organizing your learning materials.</p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              Create Your First Skill Folder
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {skillFolders.map((folder) => (
              <div key={folder.id} className={isDeleting === folder.id ? 'opacity-50' : ''}>
                <SkillFolderCard
                  skillFolder={folder}
                  onDelete={handleDeleteFolder}
                  onView={handleViewFolder}
                />
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </main>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Skill Folder"
      >
        <SkillFolderForm
          onSubmit={handleCreateFolder}
          onCancel={() => setIsCreateModalOpen(false)}
          isLoading={isLoading}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingFolder(null)
        }}
        title="Edit Skill Folder"
      >
        <SkillFolderForm
          skillFolder={editingFolder || undefined}
          onSubmit={handleUpdateFolder}
          onCancel={() => {
            setIsEditModalOpen(false)
            setEditingFolder(null)
          }}
          isLoading={isLoading}
        />
      </Modal>
    </div>
  )
}
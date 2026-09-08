'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoaderCircleIcon, PlusIcon } from 'lucide-react'
import { AppHeader } from '@/components/app/app-header'
import { Alert } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { PaperCard } from '@/components/ui/paper-card'
import { SkillFolderCard } from '@/components/skill-folders/skill-folder-card'
import { SkillFolderDetail } from '@/components/skill-folders/skill-folder-detail'
import { SkillFolderForm } from '@/components/skill-folders/skill-folder-form'
import { useAuth } from '@/hooks/use-auth'
import { useSkillFolders } from '@/hooks/use-skill-folders'
import type { CreateSkillFolderData, SkillFolder, UpdateSkillFolderData } from '@/lib/types/skill-folder'

type PendingFolderDeletion = Pick<SkillFolder, 'id' | 'name'>

function LibraryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const {
    skillFolders,
    isLoading,
    error,
    fetchSkillFolders,
    createSkillFolder,
    updateSkillFolder,
    deleteSkillFolder,
  } = useSkillFolders()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<SkillFolder | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<PendingFolderDeletion | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const createFolderReturnFocusRef = useRef<HTMLElement | null>(null)
  const selectedFolderId = searchParams.get('folder')

  const selectedFolder = skillFolders.find((folder) => folder.id === selectedFolderId) ?? null
  const hasUser = Boolean(user)

  useEffect(() => {
    if (hasUser) {
      void fetchSkillFolders()
    }
  }, [hasUser, fetchSkillFolders])

  const handleCreateFolder = async (data: CreateSkillFolderData | UpdateSkillFolderData) => {
    setDialogError(null)
    try {
      await createSkillFolder(data as CreateSkillFolderData)
      setIsCreateModalOpen(false)
    } catch (caughtError) {
      setDialogError(caughtError instanceof Error ? caughtError.message : 'The folder could not be created.')
    }
  }

  const handleUpdateFolder = async (data: CreateSkillFolderData | UpdateSkillFolderData) => {
    if (!editingFolder) return

    setDialogError(null)
    try {
      await updateSkillFolder(editingFolder.id, data)
      setEditingFolder(null)
    } catch (caughtError) {
      setDialogError(caughtError instanceof Error ? caughtError.message : 'The folder could not be updated.')
    }
  }

  const requestFolderDeletion = (id: string) => {
    const folder = skillFolders.find((candidate) => candidate.id === id)
    if (!folder) return

    setDialogError(null)
    setPendingDeletion({
      id: folder.id,
      name: folder.name,
    })
  }

  const confirmFolderDeletion = async () => {
    if (!pendingDeletion) return

    const folderId = pendingDeletion.id
    setDialogError(null)
    setIsDeleting(folderId)

    try {
      await deleteSkillFolder(folderId)
      if (selectedFolderId === folderId) router.replace('/library')
      setPendingDeletion(null)
      requestAnimationFrame(() => document.getElementById('folders-heading')?.focus())
    } catch (caughtError) {
      setDialogError(caughtError instanceof Error ? caughtError.message : 'The folder could not be deleted.')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleViewFolder = (id: string) => {
    if (skillFolders.some((folder) => folder.id === id)) {
      const nextSearchParams = new URLSearchParams(searchParams.toString())
      nextSearchParams.set('folder', id)
      router.push(`/library?${nextSearchParams.toString()}`)
    }
  }

  const handleEditSelectedFolder = () => {
    if (selectedFolder) {
      setDialogError(null)
      setEditingFolder(selectedFolder)
    }
  }

  const openCreateFolder = () => {
    createFolderReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDialogError(null)
    setIsCreateModalOpen(true)
  }

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div role="status" className="text-center text-sm text-muted-foreground">
          <LoaderCircleIcon aria-hidden="true" className="mx-auto mb-3 size-5 animate-spin" />
          <p>Opening library…</p>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#library-content"
        className="fixed left-4 top-3 z-[60] -translate-y-24 bg-card px-4 py-2 font-bold text-foreground focus:translate-y-0"
      >
        Skip to content
      </a>

      <AppHeader />

      <main id="library-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {error ? (
          <Alert role="alert" variant="destructive" className="mb-6">
            {error}
          </Alert>
        ) : null}

        {selectedFolder ? (
          <SkillFolderDetail
            skillFolder={selectedFolder}
            onClose={() => router.push('/library')}
            onEdit={handleEditSelectedFolder}
            onDelete={() => requestFolderDeletion(selectedFolder.id)}
          />
        ) : (
          <div className="space-y-6">
            <section className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 id="folders-heading" tabIndex={-1} className="text-3xl font-semibold tracking-tight text-foreground">
                  Library
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">Files and notes.</p>
              </div>
              <Button
                type="button"
                disabled={isLoading}
                onClick={openCreateFolder}
                className="w-full sm:w-auto"
              >
                <PlusIcon aria-hidden="true" className="size-5" />
                New folder
              </Button>
            </section>

            <Alert variant="warning" className="text-sm">
              <strong>Test data only.</strong> No private content.
            </Alert>

            <section aria-labelledby="folders-heading" className="space-y-5">

              {isLoading ? (
                <div role="status" className="grid gap-4 md:grid-cols-2">
                  <span className="sr-only">Loading skill folders…</span>
                  {[0, 1].map((item) => (
                    <PaperCard key={item} className="min-h-40 animate-pulse p-5">
                      <div className="h-5 w-2/3 rounded bg-muted" />
                      <div className="mt-6 h-4 w-1/2 rounded bg-muted" />
                    </PaperCard>
                  ))}
                </div>
              ) : skillFolders.length === 0 ? (
                <section className="mx-auto max-w-xl rounded-lg border border-border p-6 text-center sm:p-8">
                  <h2 className="text-xl font-semibold">No folders yet</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Keep related files and notes together.</p>
                  <Button type="button" disabled={isLoading} onClick={openCreateFolder} className="mt-5 w-full sm:w-auto">
                      New folder
                  </Button>
                </section>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {skillFolders.map((folder) => (
                    <SkillFolderCard
                      key={folder.id}
                      skillFolder={folder}
                      onDelete={requestFolderDeletion}
                      onView={handleViewFolder}
                      isDeleting={isDeleting === folder.id}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!isLoading) {
            setDialogError(null)
            setIsCreateModalOpen(false)
          }
        }}
        title="New folder"
        returnFocusTo={createFolderReturnFocusRef}
      >
        <div className="space-y-5">
          {dialogError ? <Alert role="alert" variant="destructive">{dialogError}</Alert> : null}
          <SkillFolderForm
            onSubmit={handleCreateFolder}
            onCancel={() => {
              setDialogError(null)
              setIsCreateModalOpen(false)
            }}
            isLoading={isLoading}
          />
        </div>
      </Modal>

      <Modal
        isOpen={editingFolder !== null}
        onClose={() => {
          if (!isLoading) {
            setDialogError(null)
            setEditingFolder(null)
          }
        }}
        title="Edit folder"
      >
        <div className="space-y-5">
          {dialogError ? <Alert role="alert" variant="destructive">{dialogError}</Alert> : null}
          <SkillFolderForm
            key={editingFolder?.id}
            skillFolder={editingFolder || undefined}
            onSubmit={handleUpdateFolder}
            onCancel={() => {
              setDialogError(null)
              setEditingFolder(null)
            }}
            isLoading={isLoading}
          />
        </div>
      </Modal>

      <AlertDialog
        open={pendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDialogError(null)
            setPendingDeletion(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDeletion?.name}”?</AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">
              All files and notes will be permanently deleted. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialogError ? <Alert role="alert" variant="destructive" className="mx-6 mb-5">{dialogError}</Alert> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(isDeleting)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                void confirmFolderDeletion()
              }}
              disabled={Boolean(isDeleting)}
            >
              {isDeleting ? 'Deleting…' : 'Delete folder'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function LibraryFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div role="status" className="text-center text-sm text-muted-foreground">
        <LoaderCircleIcon aria-hidden="true" className="mx-auto mb-3 size-5 animate-spin" />
        <p>Opening library…</p>
      </div>
    </main>
  )
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<LibraryFallback />}>
      <LibraryContent />
    </Suspense>
  )
}

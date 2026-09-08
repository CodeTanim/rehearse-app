"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  type DialogSize,
} from "@/components/ui/dialog"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  size?: DialogSize
  returnFocusTo?: React.RefObject<HTMLElement | null>
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  returnFocusTo,
}: ModalProps) {
  const returnFocusRef = React.useRef<HTMLElement | null>(null)

  function handleOpenChange(open: boolean) {
    if (!open) onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        size={size}
        onOpenAutoFocus={(event) => {
          const content = event.currentTarget as HTMLElement
          const activeElement = document.activeElement
          if (!content.contains(activeElement)) {
            returnFocusRef.current =
              activeElement instanceof HTMLElement && activeElement !== document.body
                ? activeElement
                : null
          }

          const initialFocusTarget = content.querySelector<HTMLElement>("[data-modal-autofocus]")
          if (initialFocusTarget) {
            event.preventDefault()
            requestAnimationFrame(() => {
              if (initialFocusTarget.isConnected) {
                initialFocusTarget.focus({ preventScroll: true })
              }
            })
          }
        }}
        onCloseAutoFocus={(event) => {
          const returnTarget = returnFocusTo?.current ?? returnFocusRef.current
          if (returnTarget?.isConnected) {
            event.preventDefault()
            returnTarget.focus()
          }
          returnFocusRef.current = null
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>
            {description ?? "Review this dialog, then save your changes or cancel."}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-6">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

export type { ModalProps }

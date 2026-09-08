"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>
) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal(
  props: React.ComponentProps<typeof DialogPrimitive.Portal>
) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(
  props: React.ComponentProps<typeof DialogPrimitive.Close>
) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "paper-dialog-overlay data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity",
        className
      )}
      {...props}
    />
  )
}

type DialogSize = "sm" | "md" | "lg" | "xl"

interface DialogContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean
  size?: DialogSize
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = "md",
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <div className="pointer-events-none fixed inset-0 z-[51] grid place-items-center overflow-y-auto p-4">
        <DialogPrimitive.Content
          data-slot="dialog-content"
          data-size={size}
          className={cn(
            "paper-dialog-content pointer-events-auto outline-none",
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              className="paper-button paper-button--outline absolute right-4 top-4 z-10 size-11 p-0"
              aria-label="Close dialog"
            >
              <XIcon className="size-5" aria-hidden="true" />
              <span className="sr-only">Close dialog</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-2 border-b-2 border-border px-6 py-5 pr-20 text-left",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-3 border-t-2 border-border px-6 py-5 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-xl font-black leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

export type { DialogContentProps, DialogSize }

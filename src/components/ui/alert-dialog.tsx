"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function AlertDialog(
  props: React.ComponentProps<typeof AlertDialogPrimitive.Root>
) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger(
  props: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>
) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal(
  props: React.ComponentProps<typeof AlertDialogPrimitive.Portal>
) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "paper-dialog-overlay data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  const returnFocusRef = React.useRef<HTMLElement | null>(null)

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <div className="pointer-events-none fixed inset-0 z-[51] grid place-items-center overflow-y-auto p-4">
        <AlertDialogPrimitive.Content
          data-slot="alert-dialog-content"
          data-size="sm"
          className={cn(
            "paper-dialog-content pointer-events-auto outline-none",
            className
          )}
          onOpenAutoFocus={(event) => {
            const activeElement = document.activeElement
            returnFocusRef.current =
              activeElement instanceof HTMLElement && activeElement !== document.body
                ? activeElement
                : null
            onOpenAutoFocus?.(event)
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event)
            if (event.defaultPrevented) return

            const returnTarget = returnFocusRef.current
            if (returnTarget?.isConnected) {
              event.preventDefault()
              returnTarget.focus()
            }
            returnFocusRef.current = null
          }}
          {...props}
        >
          {children}
        </AlertDialogPrimitive.Content>
      </div>
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-3 px-6 py-6 text-left", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-3 border-t-2 border-border px-6 py-5 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-xl font-black leading-tight tracking-tight", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

interface AlertDialogActionProps
  extends React.ComponentProps<typeof AlertDialogPrimitive.Action> {
  variant?: "default" | "destructive"
}

function AlertDialogAction({
  className,
  variant = "default",
  ...props
}: AlertDialogActionProps) {
  return (
    <AlertDialogPrimitive.Action
      data-slot="alert-dialog-action"
      className={cn(
        "paper-button min-h-11 px-4 py-2 text-sm",
        variant === "destructive"
          ? "paper-button--destructive"
          : "paper-button--primary",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      data-slot="alert-dialog-cancel"
      className={cn(
        "paper-button paper-button--outline min-h-11 px-4 py-2 text-sm",
        className
      )}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}

export type { AlertDialogActionProps }

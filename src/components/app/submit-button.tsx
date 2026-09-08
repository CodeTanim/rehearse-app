"use client"

import { useFormStatus } from "react-dom"
import { Button, type ButtonProps } from "@/components/ui/button"

type SubmitButtonProps = Omit<ButtonProps, "type" | "isLoading"> & {
  pendingLabel?: string
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" isLoading={pending} disabled={disabled || pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  )
}

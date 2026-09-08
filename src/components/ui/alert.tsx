import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type AlertVariant = "info" | "warning" | "success" | "destructive"

const variants: Record<AlertVariant, string> = {
  info: "border-info bg-[var(--paper-blue)] text-foreground",
  warning: "border-warning bg-amber-light text-foreground",
  success: "border-success bg-sage-light text-foreground",
  destructive: "border-destructive bg-terracotta-light text-foreground",
}

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
}

export function Alert({ className, variant = "info", ...props }: AlertProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm font-medium leading-6",
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

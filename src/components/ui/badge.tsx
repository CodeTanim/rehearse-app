import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "learning" | "demonstrated" | "learned" | "refresh" | "muted"

const variants: Record<BadgeVariant, string> = {
  default: "border-border bg-card text-muted-foreground",
  learning: "border-border bg-amber-light text-warning",
  demonstrated: "border-border bg-[var(--paper-blue)] text-info",
  learned: "border-border bg-sage-light text-success",
  refresh: "border-border bg-terracotta-light text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

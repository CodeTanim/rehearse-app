import { forwardRef, type HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type CardTone = "plain" | "note" | "sage" | "blue" | "rose"

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
  interactive?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone = "plain", interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      data-tone={tone === "plain" ? undefined : tone}
      data-interactive={interactive || undefined}
      className={cn("paper-sheet flex flex-col", className)}
      {...props}
    />
  ),
)
Card.displayName = "Card"

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn("grid gap-1.5 p-4 sm:p-5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-lg font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 pb-4 sm:px-5 sm:pb-5", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "mt-auto flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    />
  )
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }

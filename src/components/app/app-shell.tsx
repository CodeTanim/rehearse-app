import type { ReactNode } from "react"
import { AppHeader } from "@/components/app/app-header"
import { cn } from "@/lib/utils"

export function AppShell({
  children,
  wide = false,
}: {
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="min-h-screen bg-background" data-testid="app-shell">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[60] -translate-y-24 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm focus:translate-y-0"
      >
        Skip to content
      </a>
      <AppHeader />
      <main
        id="main-content"
        className={cn(
          "mx-auto w-full px-4 py-6 sm:px-6 sm:py-9",
          wide ? "max-w-7xl" : "max-w-5xl",
        )}
      >
        {children}
      </main>
    </div>
  )
}

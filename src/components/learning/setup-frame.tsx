import type { ReactNode } from "react"
import { AppShell } from "@/components/app/app-shell"

type SetupFrameProps = {
  step: number
  title: string
  children: ReactNode
}

export function SetupFrame({ step, title, children }: SetupFrameProps) {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <p className="mb-2 text-sm text-muted-foreground">Step {step} of 3</p>
        <h1 className="mb-8 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {children}
      </div>
    </AppShell>
  )
}

import type { ReactNode } from "react"
import { BrandMark } from "@/components/ui/brand-mark"

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-md">
        <header className="mb-7 flex justify-center">
          <BrandMark />
        </header>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {children}
        </section>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Prototype · use test data only
        </p>
      </div>
    </main>
  )
}

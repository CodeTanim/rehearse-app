"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CircleUserRoundIcon, LogOutIcon, PlusIcon } from "lucide-react"
import { BrandMark } from "@/components/ui/brand-mark"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

const links = [
  { href: "/today", label: "Today" },
  { href: "/skills", label: "Tree" },
  { href: "/progress", label: "Progress" },
]

export function AppHeader() {
  const pathname = usePathname()
  const { user, logout, isLoading } = useAuth()

  return (
    <header className="app-header sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 text-[var(--garden-ink)] shadow-[0_8px_30px_rgb(52_91_70_/_0.06)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-3 py-2 sm:gap-2 sm:px-6">
        <BrandMark className="shrink-0 text-[var(--garden-forest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white [&_.brand-wordmark]:hidden sm:[&_.brand-wordmark]:inline" />

        <nav
          aria-label="Main navigation"
          className="ml-auto flex min-w-0 items-center"
        >
          {links.map((link) => {
            const active =
              pathname === link.href ||
              pathname.startsWith(`${link.href}/`) ||
              (link.href === "/today" && pathname.startsWith("/practice/")) ||
              (link.href === "/skills" && pathname.startsWith("/goals/"))

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "grid min-h-10 place-items-center rounded-full px-1.5 py-2 text-xs font-medium text-[var(--garden-ink-soft)] no-underline transition-colors hover:bg-[var(--muted)] hover:text-[var(--garden-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white min-[360px]:px-2 min-[360px]:text-sm md:px-3",
                  active && "bg-[var(--garden-forest-light)] text-[var(--garden-forest)]",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <ButtonLink
          href="/today/new"
          size="sm"
          className="shrink-0 rounded-full px-3 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-white sm:px-4"
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          <span className="hidden lg:inline">Add skill</span>
          <span className="sr-only lg:hidden">Add skill</span>
        </ButtonLink>

        {user ? (
          <details className="group relative">
            <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-full text-[var(--garden-ink-soft)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--garden-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden">
              <CircleUserRoundIcon aria-hidden="true" className="size-5" />
              <span className="sr-only">Open account menu</span>
            </summary>
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-border bg-card p-2 text-foreground shadow-xl">
              <div className="border-b border-border px-2 pb-2">
                <p className="truncate text-sm font-medium text-foreground">{user?.name || "Account"}</p>
                {user?.email ? (
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-1 w-full justify-start"
                onClick={() => void logout()}
                isLoading={isLoading}
              >
                <LogOutIcon aria-hidden="true" className="size-4" />
                Sign out
              </Button>
            </div>
          </details>
        ) : (
          <ButtonLink
            href={`/auth/login?returnTo=${encodeURIComponent(pathname)}`}
            size="sm"
            variant="outline"
            className="rounded-full focus-visible:ring-[var(--ring)] focus-visible:ring-offset-white"
          >
            Sign in
          </ButtonLink>
        )}
      </div>
    </header>
  )
}

import Link from "next/link"
import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  compact?: boolean
}

export function BrandMark({ className, compact = false }: BrandMarkProps) {
  return (
    <Link
      href="/"
      aria-label="Rehearse home"
      className={cn(
        "group inline-flex min-h-11 items-center gap-2.5 rounded-full font-semibold text-foreground no-underline",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="brand-mark-symbol grid size-9 place-items-center text-current transition-transform group-hover:-rotate-3"
      >
        <svg viewBox="0 0 36 36" className="size-9" fill="none">
          <path d="M18 31V14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M18 20C12 19 8.5 15.5 8 9.5c6 .25 10 3.6 10 10.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M18 15.5C23.7 15 27.3 11.7 28 6c-5.9.1-9.8 3.2-10 9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M18 26c4.6-.1 7.5-2.4 8-6.5-4.6.1-7.6 2.2-8 6.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && <span className="brand-wordmark text-xl">Rehearse</span>}
    </Link>
  )
}

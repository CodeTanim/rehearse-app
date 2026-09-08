import { redirect } from "next/navigation"
import { BrandMark } from "@/components/ui/brand-mark"
import { ButtonLink } from "@/components/ui/button-link"
import { isPortfolioDemoEnabled, PORTFOLIO_DEMO_PATH } from "@/lib/portfolio-demo"

const SAMPLE_LEAVES = [
  { title: "CSS layout", status: "Learning" },
  { title: "Semantic HTML", status: "Well learned" },
  { title: "Accessible UI", status: "Refresh due" },
]

export default async function Home() {
  if (isPortfolioDemoEnabled()) redirect(PORTFOLIO_DEMO_PATH)

  const { auth } = await import("@/lib/auth")
  const session = await auth()
  if (session) redirect("/today")

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <header className="border-b border-border bg-card/95">
        <nav
          aria-label="Public navigation"
          className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6"
        >
          <BrandMark />
          <ButtonLink href="/auth/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
        </nav>
      </header>

      <main className="mx-auto grid max-w-5xl gap-12 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] lg:items-center lg:py-28">
        <section>
            <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">
              Build skills you can prove.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              Add a topic and sources. Rehearse turns them into quizzes and visible mastery.
            </p>
            <ButtonLink href="/auth/register" size="lg" className="mt-7 w-full sm:w-auto">
              Start learning
            </ButtonLink>
        </section>

        <aside aria-labelledby="tree-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="tree-title" className="font-medium">Skill Tree</h2>
            <span className="text-xs text-muted-foreground">Product direction</span>
          </div>

          <div className="mt-5 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium">
            Accessible web interfaces
          </div>
          <div className="ml-5 border-l border-border pl-4 pt-4">
            <ul className="space-y-3" aria-label="Example Skill Leaves">
              {SAMPLE_LEAVES.map((leaf) => (
                <li key={leaf.title} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{leaf.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{leaf.status}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            One-leaf practice is live. Connected branches are next.
          </p>
        </aside>

        <p className="text-xs leading-5 text-muted-foreground lg:col-span-2">
          <strong className="font-medium text-foreground">Use test data only.</strong>{" "}
          This is an early prototype.
        </p>
      </main>
    </div>
  )
}

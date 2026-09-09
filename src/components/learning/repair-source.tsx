type RepairSourceProps = {
  citation: {
    sourceName: string
    sourceUrl: string | null
    locator: string
    excerpt: string
  }
}

export function RepairSource({ citation }: RepairSourceProps) {
  const sourceUrl = citation.sourceUrl && /^https?:\/\//i.test(citation.sourceUrl)
    ? citation.sourceUrl : null

  return (
    <section aria-label="Source passage" className="space-y-3 border-y border-border py-4 text-sm">
      <h2 className="font-semibold">Revisit this passage</h2>
      <p className="break-words text-muted-foreground">{citation.sourceName} · {citation.locator}</p>
      <blockquote className="break-words border-l-2 border-primary pl-3 leading-6">
        “{citation.excerpt}”
      </blockquote>
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
          className="inline-block min-h-11 py-2.5 font-medium text-link underline underline-offset-4 hover:text-link-hover">
          Open source<span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
    </section>
  )
}

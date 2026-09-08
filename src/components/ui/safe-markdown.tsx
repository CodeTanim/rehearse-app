import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

const EXPLICIT_PROTOCOL = /^[a-z][a-z\d+.-]*:/i
const SAFE_PROTOCOL = /^(https?:|mailto:)/i

export function safeMarkdownUrl(url: string, key: string): string {
  const normalizedUrl = url.trim()

  // Notes never load remote images or data URLs while being previewed.
  if (
    key === 'src' ||
    normalizedUrl.startsWith('//') ||
    normalizedUrl.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(normalizedUrl)
  ) return ''

  if (!EXPLICIT_PROTOCOL.test(normalizedUrl)) return normalizedUrl
  return SAFE_PROTOCOL.test(normalizedUrl) ? normalizedUrl : ''
}

const components: Components = {
  h1: ({ children }) => <h1 className="mb-4 text-2xl font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 text-xl font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 text-lg font-medium">{children}</h3>,
  p: ({ children }) => <p className="mb-4 leading-7 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-6">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-4 border-border pl-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-md bg-muted p-4 text-sm">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border bg-muted p-2 font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-border p-2">{children}</td>,
  a: ({ href, children }) => {
    const isExternal = Boolean(href && /^https?:\/\//i.test(href))
    return (
      <a
        href={href}
        className="text-primary underline underline-offset-2"
        rel={isExternal ? 'noreferrer noopener' : undefined}
        target={isExternal ? '_blank' : undefined}
      >
        {children}
      </a>
    )
  },
  img: ({ alt }) => (
    <span className="text-sm italic text-muted-foreground">
      {alt ? `[Image omitted: ${alt}]` : '[Image omitted]'}
    </span>
  ),
}

export function SafeMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={components}
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeMarkdownUrl}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

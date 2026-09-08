import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SafeMarkdown, safeMarkdownUrl } from '@/components/ui/safe-markdown'

describe('SafeMarkdown', () => {
  it('renders raw HTML and active URL payloads inert', () => {
    const content = `
<img src=x onerror="alert(1)">
<svg onload="alert(2)"></svg>
[unsafe](javascript:alert(3))
![tracker](https://tracker.invalid/pixel.gif)
    `
    const html = renderToStaticMarkup(createElement(SafeMarkdown, { content }))

    expect(html).not.toContain('onerror')
    expect(html).not.toContain('onload')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('tracker.invalid')
  })

  it('retains useful Markdown and protects external links', () => {
    const html = renderToStaticMarkup(
      createElement(SafeMarkdown, {
        content: '# Heading\n\n- **Item**\n\n[Source](https://example.com)',
      })
    )

    expect(html).toContain('<h1')
    expect(html).toContain('<strong>Item</strong>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer noopener"')
  })

  it('rejects dangerous and protocol-relative URLs', () => {
    expect(safeMarkdownUrl('javascript:alert(1)', 'href')).toBe('')
    expect(safeMarkdownUrl('  javascript:alert(1)', 'href')).toBe('')
    expect(safeMarkdownUrl('java\nscript:alert(1)', 'href')).toBe('')
    expect(safeMarkdownUrl('data:text/html,boom', 'href')).toBe('')
    expect(safeMarkdownUrl('//tracker.invalid', 'href')).toBe('')
    expect(safeMarkdownUrl('/\\tracker.invalid', 'href')).toBe('')
    expect(safeMarkdownUrl('https://example.com', 'href')).toBe('https://example.com')
    expect(safeMarkdownUrl('/skills/example', 'href')).toBe('/skills/example')
    expect(safeMarkdownUrl('https://example.com/image.png', 'src')).toBe('')
  })
})

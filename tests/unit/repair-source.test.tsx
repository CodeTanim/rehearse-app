import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { RepairSource } from "@/components/learning/repair-source"

const citation = { sourceName: "Map notes", locator: "Page 2", excerpt: "Keys must be unique.", sourceUrl: null as string | null }
const render = (sourceUrl: string | null = null) => renderToStaticMarkup(createElement(RepairSource, { citation: { ...citation, sourceUrl } }))

describe("cited repair", () => {
  it("shows the cited passage without requiring a disclosure or external URL", () => {
    const html = render()
    expect(html).toContain("Revisit this passage")
    expect(html).toContain("Map notes · Page 2")
    expect(html).toContain("Keys must be unique.")
    expect(html).not.toContain("<details")
    expect(html).not.toContain("Open source")
  })
  it("opens website sources separately without losing the repair page", () => {
    const html = render("https://example.com/maps#keys")
    expect(html).toContain('href="https://example.com/maps#keys"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain("opens in a new tab")
  })
  it.each(["javascript:alert(1)", "data:text/html,example", "//example.com", "/private"])("does not render an unsafe source link: %s", (url) => {
    expect(render(url)).not.toContain("href=")
    expect(render(url)).toContain("Keys must be unique.")
  })
})

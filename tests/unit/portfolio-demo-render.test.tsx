import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PortfolioDemo } from "@/components/demo/portfolio-demo"

describe("PortfolioDemo", () => {
  it("renders a usable synthetic refresh without auth or network forms", () => {
    const html = renderToStaticMarkup(createElement(PortfolioDemo))

    expect(html).toContain("Today")
    expect(html).toContain("New angle due")
    expect(html).toContain("Accessible buttons")
    expect(html).toContain(">Tree<")
    expect(html).not.toContain("Sign in")
    expect(html).not.toContain("Create account")
    expect(html).not.toContain("action=")
  })
})

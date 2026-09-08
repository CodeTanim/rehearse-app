import { describe, expect, it } from "vitest"
import {
  isPortfolioDemoEnabled,
  portfolioDemoRouteAction,
} from "@/lib/portfolio-demo"

describe("portfolio demo environment gate", () => {
  it("defaults Vercel to the safe demo and allows an explicit full-app override", () => {
    expect(isPortfolioDemoEnabled({ vercel: "1" })).toBe(true)
    expect(isPortfolioDemoEnabled({ portfolioDemo: "1" })).toBe(true)
    expect(isPortfolioDemoEnabled({ portfolioDemo: "0", vercel: "1" })).toBe(false)
    expect(isPortfolioDemoEnabled({ portfolioDemo: "true" })).toBe(false)
    expect(isPortfolioDemoEnabled({})).toBe(false)
  })
})

describe("portfolio demo route boundary", () => {
  it.each(["/api", "/api/auth/session", "/api/files/id/view"])(
    "disables API path %s",
    (pathname) => {
      expect(portfolioDemoRouteAction(pathname)).toBe("disable-api")
    },
  )

  it.each([
    "/auth/login",
    "/dashboard",
    "/goals/example",
    "/library",
    "/practice/example",
    "/skills",
    "/today",
  ])("redirects application path %s", (pathname) => {
    expect(portfolioDemoRouteAction(pathname)).toBe("redirect-demo")
  })

  it.each(["/", "/demo", "/favicon.ico", "/apiary", "/todayish"])(
    "leaves public path %s alone",
    (pathname) => {
      expect(portfolioDemoRouteAction(pathname)).toBe("allow")
    },
  )
})

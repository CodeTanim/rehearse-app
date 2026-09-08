export const PORTFOLIO_DEMO_PATH = "/demo"

const APP_PATH_PREFIXES = [
  "/auth",
  "/dashboard",
  "/goals",
  "/library",
  "/practice",
  "/progress",
  "/skills",
  "/today",
] as const

export type PortfolioDemoRouteAction = "allow" | "disable-api" | "redirect-demo"

type PortfolioDemoEnvironment = {
  portfolioDemo?: string
  vercel?: string
}

export function isPortfolioDemoEnabled({
  portfolioDemo = process.env.PORTFOLIO_DEMO,
  vercel = process.env.VERCEL,
}: PortfolioDemoEnvironment = {}) {
  if (portfolioDemo === "0") return false
  return portfolioDemo === "1" || vercel === "1"
}

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function portfolioDemoRouteAction(pathname: string): PortfolioDemoRouteAction {
  if (matchesPathPrefix(pathname, "/api")) return "disable-api"
  if (APP_PATH_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix))) {
    return "redirect-demo"
  }
  return "allow"
}

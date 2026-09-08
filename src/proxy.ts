import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server"
import {
  isPortfolioDemoEnabled,
  PORTFOLIO_DEMO_PATH,
  portfolioDemoRouteAction,
} from "@/lib/portfolio-demo"

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isPortfolioDemoEnabled()) {
    const action = portfolioDemoRouteAction(request.nextUrl.pathname)

    if (action === "disable-api") {
      return NextResponse.json(
        { error: "Not available in the portfolio demo." },
        { status: 404 },
      )
    }

    if (action === "redirect-demo") {
      return NextResponse.redirect(new URL(PORTFOLIO_DEMO_PATH, request.url))
    }
  }

  const { authenticatedProxy } = await import("@/lib/auth-proxy")
  return authenticatedProxy(request, event)
}

export const config = {
  matcher: [
    "/today/:path*",
    "/goals/:path*",
    "/skills/:path*",
    "/practice/:path*",
    "/library/:path*",
    "/dashboard/:path*",
    "/auth/:path*",
    "/api/:path*",
  ],
}

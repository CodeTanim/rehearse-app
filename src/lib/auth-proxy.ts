import type { NextAuthRequest } from "next-auth"
import { type NextFetchEvent, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

function handleAuthenticatedRequest(request: NextAuthRequest, event: NextFetchEvent) {
  void event
  const { pathname, search } = request.nextUrl
  const protectedPath = ["/today", "/goals", "/skills", "/practice", "/library", "/dashboard"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  if (protectedPath && !request.auth) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("returnTo", `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith("/auth") && request.auth) {
    return NextResponse.redirect(new URL("/today", request.url))
  }

  return NextResponse.next()
}

export const authenticatedProxy = auth(handleAuthenticatedRequest)

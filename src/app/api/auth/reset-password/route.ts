import { NextResponse } from "next/server"

const unavailableResponse = {
  error: "Password recovery is temporarily unavailable.",
}

export async function POST() {
  return NextResponse.json(unavailableResponse, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  })
}

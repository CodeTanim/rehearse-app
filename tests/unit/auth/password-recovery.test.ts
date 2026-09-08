import { describe, expect, it } from "vitest"
import { POST as requestReset } from "@/app/api/auth/reset-password/route"
import { POST as updatePassword } from "@/app/api/auth/update-password/route"

describe("password recovery safety gate", () => {
  it.each([
    ["request", requestReset],
    ["update", updatePassword],
  ])("returns an honest unavailable response for %s", async (_name, handler) => {
    const response = await handler()

    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      error: "Password recovery is temporarily unavailable.",
    })
  })
})

import { describe, expect, it } from "vitest"
import { sanitizeReturnTo } from "@/lib/auth/return-to"

describe("sanitizeReturnTo", () => {
  it("keeps internal paths, queries, and fragments", () => {
    expect(sanitizeReturnTo("/dashboard?folder=one#notes")).toBe(
      "/dashboard?folder=one#notes",
    )
  })

  it.each([
    undefined,
    null,
    "",
    "dashboard",
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    ["/dashboard"],
  ])("falls back for unsafe input %#", (value) => {
    expect(sanitizeReturnTo(value)).toBe("/today")
  })
})

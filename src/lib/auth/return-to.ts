const DEFAULT_RETURN_TO = "/today"

export function sanitizeReturnTo(value: string | string[] | null | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_RETURN_TO
  }

  try {
    const url = new URL(value, "http://rehearse.local")
    if (url.origin !== "http://rehearse.local") return DEFAULT_RETURN_TO
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_RETURN_TO
  }
}

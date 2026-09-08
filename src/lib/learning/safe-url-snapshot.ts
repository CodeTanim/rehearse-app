import { createHash } from "node:crypto"
import { lookup as dnsLookup } from "node:dns/promises"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"
import { Readable } from "node:stream"
import {
  createBrotliDecompress,
  createGunzip,
  createInflate,
} from "node:zlib"

export const SAFE_URL_SNAPSHOT_LIMITS = {
  defaultTimeoutMs: 10_000,
  maximumTimeoutMs: 30_000,
  defaultMaxRedirects: 4,
  maximumRedirects: 5,
  defaultMaxCompressedBytes: 2 * 1024 * 1024,
  defaultMaxDecompressedBytes: 4 * 1024 * 1024,
  maximumBodyBytes: 8 * 1024 * 1024,
  maximumResolvedAddresses: 16,
} as const

export type SafeUrlSnapshotErrorCode =
  | "ABORTED"
  | "COMPRESSED_BODY_TOO_LARGE"
  | "CREDENTIALS_NOT_ALLOWED"
  | "DECOMPRESSION_FAILED"
  | "DECOMPRESSED_BODY_TOO_LARGE"
  | "DNS_FAILED"
  | "DNS_RETURNED_NO_ADDRESSES"
  | "EMPTY_CONTENT"
  | "FETCH_FAILED"
  | "HTTP_STATUS_NOT_ALLOWED"
  | "INVALID_CONTENT_LENGTH"
  | "INVALID_FETCH_RESPONSE"
  | "INVALID_OPTIONS"
  | "INVALID_REDIRECT"
  | "INVALID_URL"
  | "LOCAL_HOSTNAME_NOT_ALLOWED"
  | "NON_STANDARD_PORT_NOT_ALLOWED"
  | "PEER_ADDRESS_MISMATCH"
  | "REDIRECT_LIMIT_EXCEEDED"
  | "RESOLVER_RETURNED_TOO_MANY_ADDRESSES"
  | "TIMEOUT"
  | "UNSAFE_IP_ADDRESS"
  | "UNSUPPORTED_CHARSET"
  | "UNSUPPORTED_CONTENT_ENCODING"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "UNSUPPORTED_PROTOCOL"

export class SafeUrlSnapshotError extends Error {
  constructor(
    public readonly code: SafeUrlSnapshotErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "SafeUrlSnapshotError"
  }
}

export type ResolvedPublicAddress = {
  address: string
  family: 4 | 6
}

export type SafeUrlResolver = (
  hostname: string,
  context: { signal: AbortSignal },
) => Promise<readonly ResolvedPublicAddress[]>

type SnapshotBody =
  | AsyncIterable<Uint8Array>
  | ReadableStream<Uint8Array>
  | null

export type SafeUrlFetchResponse = {
  status: number
  headers: Headers
  body: SnapshotBody
  cancel?: () => Promise<void> | void
}

export type SafeUrlFetch = (
  url: URL,
  context: {
    signal: AbortSignal
    resolvedAddresses: readonly ResolvedPublicAddress[]
  },
) => Promise<SafeUrlFetchResponse>

export type SafeUrlSnapshotOptions = {
  signal?: AbortSignal
  timeoutMs?: number
  maxRedirects?: number
  maxCompressedBytes?: number
  maxDecompressedBytes?: number
  resolver?: SafeUrlResolver
  fetchImpl?: SafeUrlFetch
}

export type SafeUrlSnapshot = {
  finalUrl: string
  displayUrl: string
  displayName: string
  mimeType: "text/html" | "text/plain"
  bytes: Uint8Array
  extractedText: string
  byteSize: number
  sha256: string
  retrievedAt: Date
  extractorVersion: typeof SAFE_URL_TEXT_EXTRACTOR_VERSION
}

export const SAFE_URL_TEXT_EXTRACTOR_VERSION = "safe-url-text-v1" as const

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAXIMUM_URL_LENGTH = 8_192
const HTML_BLOCK_ELEMENTS = [
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "td",
  "th",
  "tr",
  "ul",
]

const IPV4_DENYLIST: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]

const IPV6_DENYLIST: ReadonlyArray<readonly [string, number]> = [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
]

function snapshotError(
  code: SafeUrlSnapshotErrorCode,
  message: string,
  cause?: unknown,
): SafeUrlSnapshotError {
  return new SafeUrlSnapshotError(code, message, cause === undefined ? undefined : { cause })
}

function readBoundedInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
  label: string,
): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < 0 || resolved > maximum) {
    throw snapshotError(
      "INVALID_OPTIONS",
      `${label} must be a non-negative integer no greater than ${maximum}.`,
    )
  }
  return resolved
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname
}

function parseIpv4(address: string): Uint8Array | null {
  if (isIP(address) !== 4) return null

  const octets = address.split(".").map(Number)
  return octets.length === 4 ? Uint8Array.from(octets) : null
}

function parseIpv6(address: string): Uint8Array | null {
  const unwrapped = stripIpv6Brackets(address)
  if (unwrapped.includes("%") || isIP(unwrapped) !== 6) return null

  let normalized = unwrapped.toLowerCase()
  const ipv4TailMatch = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)
  if (ipv4TailMatch) {
    const ipv4 = parseIpv4(ipv4TailMatch[1])
    if (!ipv4) return null
    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16)
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16)
    normalized = `${normalized.slice(0, -ipv4TailMatch[1].length)}${high}:${low}`
  }

  const halves = normalized.split("::")
  if (halves.length > 2) return null

  const left = halves[0] ? halves[0].split(":") : []
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  const missing = 8 - left.length - right.length
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) {
    return null
  }

  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right]
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    return null
  }

  const bytes = new Uint8Array(16)
  for (const [index, group] of groups.entries()) {
    const value = Number.parseInt(group, 16)
    bytes[index * 2] = value >>> 8
    bytes[index * 2 + 1] = value & 0xff
  }
  return bytes
}

function addressInCidr(address: Uint8Array, network: Uint8Array, prefix: number): boolean {
  if (address.length !== network.length) return false

  const wholeBytes = Math.floor(prefix / 8)
  const remainingBits = prefix % 8
  for (let index = 0; index < wholeBytes; index += 1) {
    if (address[index] !== network[index]) return false
  }

  if (remainingBits === 0) return true
  const mask = (0xff << (8 - remainingBits)) & 0xff
  return (address[wholeBytes] & mask) === (network[wholeBytes] & mask)
}

function isUnsafeIpAddress(address: string): boolean {
  const unwrapped = stripIpv6Brackets(address)
  const family = isIP(unwrapped)

  if (family === 4) {
    const bytes = parseIpv4(unwrapped)
    if (!bytes) return true
    return IPV4_DENYLIST.some(([network, prefix]) => {
      const networkBytes = parseIpv4(network)
      return networkBytes ? addressInCidr(bytes, networkBytes, prefix) : true
    })
  }

  if (family === 6) {
    const bytes = parseIpv6(unwrapped)
    const globalUnicast = parseIpv6("2000::")
    if (!bytes || !globalUnicast || !addressInCidr(bytes, globalUnicast, 3)) return true

    return IPV6_DENYLIST.some(([network, prefix]) => {
      const networkBytes = parseIpv6(network)
      return networkBytes ? addressInCidr(bytes, networkBytes, prefix) : true
    })
  }

  return true
}

function normalizeComparableIp(address: string): string | null {
  const unwrapped = stripIpv6Brackets(address).toLowerCase()
  const ipv4 = parseIpv4(unwrapped)
  if (ipv4) return [...ipv4].join(".")
  const ipv6 = parseIpv6(unwrapped)
  if (
    ipv6 &&
    ipv6.slice(0, 10).every((byte) => byte === 0) &&
    ipv6[10] === 0xff &&
    ipv6[11] === 0xff
  ) {
    return [...ipv6.slice(12)].join(".")
  }
  return ipv6 ? Buffer.from(ipv6).toString("hex") : null
}

function normalizeAndValidateUrl(input: string | URL, base?: URL): URL {
  let url: URL
  try {
    const value = input instanceof URL ? input.href : input
    if (value.length > MAXIMUM_URL_LENGTH) {
      throw snapshotError("INVALID_URL", "The URL is too long.")
    }
    url = new URL(value, base)
  } catch (error) {
    throw snapshotError("INVALID_URL", "Enter a valid public URL.", error)
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw snapshotError("UNSUPPORTED_PROTOCOL", "Only http and https URLs are allowed.")
  }
  if (url.username || url.password) {
    throw snapshotError("CREDENTIALS_NOT_ALLOWED", "URLs cannot include credentials.")
  }
  if (url.port) {
    throw snapshotError(
      "NON_STANDARD_PORT_NOT_ALLOWED",
      "Only the standard port for the URL protocol is allowed.",
    )
  }

  const rawHostname = stripIpv6Brackets(url.hostname)
  const hostname = rawHostname.replace(/\.+$/, "").toLowerCase()
  if (!hostname) throw snapshotError("INVALID_URL", "The URL must include a hostname.")

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "local" ||
    hostname.endsWith(".local") ||
    hostname === "internal" ||
    hostname.endsWith(".internal") ||
    hostname === "home.arpa" ||
    hostname.endsWith(".home.arpa")
  ) {
    throw snapshotError(
      "LOCAL_HOSTNAME_NOT_ALLOWED",
      "Local network hostnames are not allowed.",
    )
  }

  if (isIP(hostname) > 0 && isUnsafeIpAddress(hostname)) {
    throw snapshotError("UNSAFE_IP_ADDRESS", "The URL resolves to a non-public address.")
  }

  url.hostname = isIP(hostname) === 6 ? `[${hostname}]` : hostname
  url.hash = ""
  return url
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return
  if (signal.reason instanceof SafeUrlSnapshotError) throw signal.reason
  throw snapshotError("ABORTED", "The URL snapshot request was cancelled.", signal.reason)
}

async function raceWithAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfAborted(signal)
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      try {
        throwIfAborted(signal)
      } catch (error) {
        reject(error)
      }
    }

    signal.addEventListener("abort", onAbort, { once: true })
    work.then(
      (value) => {
        signal.removeEventListener("abort", onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort)
        reject(error)
      },
    )
  })
}

const defaultResolver: SafeUrlResolver = async (hostname, { signal }) => {
  try {
    return await raceWithAbort(
      dnsLookup(hostname, { all: true, verbatim: true }).then((addresses) =>
        addresses.map(({ address, family }) => ({
          address,
          family: family === 6 ? 6 : 4,
        })),
      ),
      signal,
    )
  } catch (error) {
    if (error instanceof SafeUrlSnapshotError) throw error
    throw snapshotError("DNS_FAILED", "The URL hostname could not be resolved.", error)
  }
}

async function resolvePublicAddresses(
  url: URL,
  resolver: SafeUrlResolver,
  signal: AbortSignal,
): Promise<readonly ResolvedPublicAddress[]> {
  throwIfAborted(signal)
  const hostname = stripIpv6Brackets(url.hostname)
  const literalFamily = isIP(hostname)
  let rawAddresses: readonly ResolvedPublicAddress[]
  try {
    rawAddresses = literalFamily
      ? [{ address: hostname, family: literalFamily as 4 | 6 }]
      : await raceWithAbort(Promise.resolve(resolver(hostname, { signal })), signal)
  } catch (error) {
    if (error instanceof SafeUrlSnapshotError) throw error
    throwIfAborted(signal)
    throw snapshotError("DNS_FAILED", "The URL hostname could not be resolved.", error)
  }

  if (rawAddresses.length === 0) {
    throw snapshotError(
      "DNS_RETURNED_NO_ADDRESSES",
      "The URL hostname did not resolve to an address.",
    )
  }
  if (rawAddresses.length > SAFE_URL_SNAPSHOT_LIMITS.maximumResolvedAddresses) {
    throw snapshotError(
      "RESOLVER_RETURNED_TOO_MANY_ADDRESSES",
      "The URL hostname resolved to too many addresses.",
    )
  }

  const addresses: ResolvedPublicAddress[] = []
  const seen = new Set<string>()
  for (const candidate of rawAddresses) {
    const address = stripIpv6Brackets(candidate.address)
    const actualFamily = isIP(address)
    if (
      (actualFamily !== 4 && actualFamily !== 6) ||
      actualFamily !== candidate.family ||
      isUnsafeIpAddress(address)
    ) {
      throw snapshotError(
        "UNSAFE_IP_ADDRESS",
        "The URL hostname resolves to a non-public address.",
      )
    }

    const comparable = normalizeComparableIp(address)
    if (!comparable || seen.has(comparable)) continue
    seen.add(comparable)
    addresses.push({ address, family: actualFamily })
  }

  if (addresses.length === 0) {
    throw snapshotError(
      "DNS_RETURNED_NO_ADDRESSES",
      "The URL hostname did not resolve to an address.",
    )
  }
  return addresses
}

function responseHeaders(headers: NodeJS.Dict<string | string[]>): Headers {
  const result = new Headers()
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item)
    } else if (value !== undefined) {
      result.set(name, value)
    }
  }
  return result
}

async function fetchPinnedAddress(
  url: URL,
  address: ResolvedPublicAddress,
  signal: AbortSignal,
): Promise<SafeUrlFetchResponse> {
  throwIfAborted(signal)
  const request = url.protocol === "https:" ? httpsRequest : httpRequest
  const originalHostname = stripIpv6Brackets(url.hostname)

  return new Promise<SafeUrlFetchResponse>((resolve, reject) => {
    let settled = false
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      reject(error)
    }

    const outgoing = request(
      {
        protocol: url.protocol,
        hostname: address.address,
        family: address.family,
        port: url.port || undefined,
        method: "GET",
        path: `${url.pathname}${url.search}`,
        headers: {
          Accept: "text/html, text/plain;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "close",
          Host: url.host,
          "User-Agent": "Rehearse-Snapshot/1.0",
        },
        maxHeaderSize: 16 * 1024,
        servername: isIP(originalHostname) ? undefined : originalHostname,
        signal,
        agent: false,
      },
      (incoming) => {
        const peer = incoming.socket.remoteAddress
        const expectedPeer = normalizeComparableIp(address.address)
        const actualPeer = peer ? normalizeComparableIp(peer) : null
        if (!expectedPeer || actualPeer !== expectedPeer) {
          incoming.destroy()
          fail(
            snapshotError(
              "PEER_ADDRESS_MISMATCH",
              "The connection peer did not match the validated public address.",
            ),
          )
          return
        }

        settled = true
        resolve({
          status: incoming.statusCode ?? 0,
          headers: responseHeaders(incoming.headers),
          body: incoming,
          cancel: () => {
            incoming.destroy()
          },
        })
      },
    )

    outgoing.once("error", fail)
    outgoing.end()
  })
}

const defaultFetch: SafeUrlFetch = async (url, { signal, resolvedAddresses }) => {
  let lastError: unknown
  for (const address of resolvedAddresses) {
    try {
      return await fetchPinnedAddress(url, address, signal)
    } catch (error) {
      if (signal.aborted || error instanceof SafeUrlSnapshotError) throw error
      lastError = error
    }
  }

  throw snapshotError("FETCH_FAILED", "The public URL could not be fetched.", lastError)
}

function isReadableStream(
  body: Exclude<SnapshotBody, null>,
): body is ReadableStream<Uint8Array> {
  return typeof (body as ReadableStream<Uint8Array>).getReader === "function"
}

async function* iterateBody(
  body: Exclude<SnapshotBody, null>,
  signal: AbortSignal,
): AsyncGenerator<Uint8Array> {
  if (!isReadableStream(body)) {
    const iterator = body[Symbol.asyncIterator]()
    let completed = false
    try {
      while (true) {
        const result = await raceWithAbort(Promise.resolve(iterator.next()), signal)
        if (result.done) {
          completed = true
          return
        }
        yield result.value
      }
    } finally {
      if (!completed && !signal.aborted && iterator.return) await iterator.return()
    }
  }

  const reader = body.getReader()
  try {
    while (true) {
      const { done, value } = await raceWithAbort(reader.read(), signal)
      if (done) return
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

async function cancelResponse(response: SafeUrlFetchResponse): Promise<void> {
  try {
    if (response.cancel) {
      await response.cancel()
    } else if (response.body && isReadableStream(response.body)) {
      await response.body.cancel()
    }
  } catch {
    // Cancellation is best-effort; the original validation error is more useful.
  }
}

function parseContentLength(value: string | null): number | null {
  if (value === null) return null
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw snapshotError("INVALID_CONTENT_LENGTH", "The response has an invalid length.")
  }

  const length = Number(value)
  if (!Number.isSafeInteger(length)) {
    throw snapshotError("INVALID_CONTENT_LENGTH", "The response has an invalid length.")
  }
  return length
}

function contentEncoding(headers: Headers): "identity" | "gzip" | "deflate" | "br" {
  const value = headers.get("content-encoding")?.trim().toLowerCase()
  if (!value || value === "identity") return "identity"
  if (value === "gzip" || value === "x-gzip") return "gzip"
  if (value === "deflate" || value === "br") return value
  throw snapshotError(
    "UNSUPPORTED_CONTENT_ENCODING",
    "The response uses an unsupported content encoding.",
  )
}

async function readResponseBytes(
  response: SafeUrlFetchResponse,
  limits: { compressed: number; decompressed: number },
  signal: AbortSignal,
): Promise<Uint8Array> {
  let declaredLength: number | null
  let encoding: ReturnType<typeof contentEncoding>
  try {
    declaredLength = parseContentLength(response.headers.get("content-length"))
    encoding = contentEncoding(response.headers)
  } catch (error) {
    await cancelResponse(response)
    throw error
  }
  if (declaredLength !== null && declaredLength > limits.compressed) {
    await cancelResponse(response)
    throw snapshotError(
      "COMPRESSED_BODY_TOO_LARGE",
      "The response body is larger than the snapshot limit.",
    )
  }
  if (!response.body) return new Uint8Array()

  let compressedBytes = 0
  const countedBody = async function* () {
    for await (const chunk of iterateBody(response.body!, signal)) {
      throwIfAborted(signal)
      const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
      compressedBytes += bytes.byteLength
      if (compressedBytes > limits.compressed) {
        throw snapshotError(
          "COMPRESSED_BODY_TOO_LARGE",
          "The compressed response body is larger than the snapshot limit.",
        )
      }
      yield Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    }
  }

  const encoded = Readable.from(countedBody())
  const decoded =
    encoding === "gzip"
      ? encoded.pipe(createGunzip())
      : encoding === "deflate"
        ? encoded.pipe(createInflate())
        : encoding === "br"
          ? encoded.pipe(createBrotliDecompress())
          : encoded

  const chunks: Buffer[] = []
  let decompressedBytes = 0
  try {
    for await (const chunk of decoded) {
      throwIfAborted(signal)
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      decompressedBytes += bytes.byteLength
      if (decompressedBytes > limits.decompressed) {
        throw snapshotError(
          "DECOMPRESSED_BODY_TOO_LARGE",
          "The decompressed response body is larger than the snapshot limit.",
        )
      }
      chunks.push(bytes)
    }
  } catch (error) {
    if (error instanceof SafeUrlSnapshotError) throw error
    throwIfAborted(signal)
    throw snapshotError("DECOMPRESSION_FAILED", "The response body could not be decoded.", error)
  } finally {
    await cancelResponse(response)
  }

  return new Uint8Array(Buffer.concat(chunks, decompressedBytes))
}

function parseContentType(headers: Headers): {
  mediaType: "text/html" | "text/plain"
  charset: string
} {
  const value = headers.get("content-type")
  if (!value) {
    throw snapshotError("UNSUPPORTED_MEDIA_TYPE", "The response must be HTML or plain text.")
  }

  const [rawMediaType, ...parameters] = value.split(";")
  const mediaType = rawMediaType.trim().toLowerCase()
  if (mediaType !== "text/html" && mediaType !== "text/plain") {
    throw snapshotError("UNSUPPORTED_MEDIA_TYPE", "The response must be HTML or plain text.")
  }

  let charset = "utf-8"
  for (const parameter of parameters) {
    const match = parameter.match(/^\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s;]+))\s*$/i)
    if (match) charset = (match[1] ?? match[2] ?? match[3]).trim().toLowerCase()
  }

  return { mediaType, charset }
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  const normalizedCharset = charset === "utf8" ? "utf-8" : charset
  try {
    return new TextDecoder(normalizedCharset, { fatal: false }).decode(bytes)
  } catch (error) {
    throw snapshotError("UNSUPPORTED_CHARSET", "The response uses an unsupported charset.", error)
  }
}

function decodeHtmlEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  }

  return value.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]{2,8}));/gi, (entity, decimal, hex, name) => {
    if (name) return named[String(name).toLowerCase()] ?? entity
    const codePoint = Number.parseInt(decimal ?? hex, decimal ? 10 : 16)
    if (!Number.isSafeInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
      return "�"
    }
    return String.fromCodePoint(codePoint)
  })
}

function normalizeReadableText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function extractReadableHtml(html: string): string {
  let text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|canvas|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")

  const blockPattern = HTML_BLOCK_ELEMENTS.join("|")
  text = text
    .replace(new RegExp(`<\\/?(?:${blockPattern})\\b[^>]*>`, "gi"), "\n")
    .replace(/<[^>]*>/g, " ")

  return normalizeReadableText(decodeHtmlEntities(text))
}

function extractDisplayName(url: URL, decoded: string, mediaType: "text/html" | "text/plain"): string {
  const asDisplayName = (value: string) =>
    normalizeReadableText(value).replace(/\n+/g, " ").slice(0, 200)

  if (mediaType === "text/html") {
    const titleMatch = decoded.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)
    if (titleMatch) {
      const title = asDisplayName(
        decodeHtmlEntities(titleMatch[1].replace(/<[^>]*>/g, " ")),
      )
      if (title) return title
    }
  }

  const pathName = url.pathname.split("/").filter(Boolean).at(-1)
  if (pathName) {
    try {
      return asDisplayName(decodeURIComponent(pathName))
    } catch {
      return asDisplayName(pathName)
    }
  }
  return asDisplayName(stripIpv6Brackets(url.hostname))
}

function createDisplayUrl(url: URL): string {
  const displayUrl = new URL(url.href)
  displayUrl.search = ""
  displayUrl.hash = ""
  return displayUrl.href
}

function validateFetchResponse(response: SafeUrlFetchResponse): void {
  if (
    !Number.isInteger(response.status) ||
    response.status < 100 ||
    response.status > 599 ||
    !(response.headers instanceof Headers)
  ) {
    throw snapshotError("INVALID_FETCH_RESPONSE", "The URL fetcher returned an invalid response.")
  }
}

export async function fetchPublicTextSnapshot(
  input: string | URL,
  options: SafeUrlSnapshotOptions = {},
): Promise<SafeUrlSnapshot> {
  const timeoutMs = readBoundedInteger(
    options.timeoutMs,
    SAFE_URL_SNAPSHOT_LIMITS.defaultTimeoutMs,
    SAFE_URL_SNAPSHOT_LIMITS.maximumTimeoutMs,
    "timeoutMs",
  )
  const maxRedirects = readBoundedInteger(
    options.maxRedirects,
    SAFE_URL_SNAPSHOT_LIMITS.defaultMaxRedirects,
    SAFE_URL_SNAPSHOT_LIMITS.maximumRedirects,
    "maxRedirects",
  )
  const maxCompressedBytes = readBoundedInteger(
    options.maxCompressedBytes,
    SAFE_URL_SNAPSHOT_LIMITS.defaultMaxCompressedBytes,
    SAFE_URL_SNAPSHOT_LIMITS.maximumBodyBytes,
    "maxCompressedBytes",
  )
  const maxDecompressedBytes = readBoundedInteger(
    options.maxDecompressedBytes,
    SAFE_URL_SNAPSHOT_LIMITS.defaultMaxDecompressedBytes,
    SAFE_URL_SNAPSHOT_LIMITS.maximumBodyBytes,
    "maxDecompressedBytes",
  )

  const controller = new AbortController()
  const timeoutError = snapshotError("TIMEOUT", "The URL snapshot request timed out.")
  const timeout = setTimeout(() => controller.abort(timeoutError), timeoutMs)
  const onExternalAbort = () =>
    controller.abort(
      snapshotError("ABORTED", "The URL snapshot request was cancelled.", options.signal?.reason),
    )
  options.signal?.addEventListener("abort", onExternalAbort, { once: true })
  if (options.signal?.aborted) onExternalAbort()

  const resolver = options.resolver ?? defaultResolver
  const fetchImpl = options.fetchImpl ?? defaultFetch

  try {
    let currentUrl = normalizeAndValidateUrl(input)
    let redirectCount = 0

    while (true) {
      throwIfAborted(controller.signal)
      const resolvedAddresses = await resolvePublicAddresses(
        currentUrl,
        resolver,
        controller.signal,
      )

      let response: SafeUrlFetchResponse
      try {
        response = await raceWithAbort(
          fetchImpl(currentUrl, {
            signal: controller.signal,
            resolvedAddresses,
          }),
          controller.signal,
        )
      } catch (error) {
        if (error instanceof SafeUrlSnapshotError) throw error
        throwIfAborted(controller.signal)
        throw snapshotError("FETCH_FAILED", "The public URL could not be fetched.", error)
      }
      validateFetchResponse(response)

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location")
        await cancelResponse(response)
        if (!location) {
          throw snapshotError("INVALID_REDIRECT", "The redirect response has no destination.")
        }
        if (redirectCount >= maxRedirects) {
          throw snapshotError("REDIRECT_LIMIT_EXCEEDED", "The URL redirected too many times.")
        }

        try {
          currentUrl = normalizeAndValidateUrl(location, currentUrl)
        } catch (error) {
          if (error instanceof SafeUrlSnapshotError) throw error
          throw snapshotError("INVALID_REDIRECT", "The redirect destination is invalid.", error)
        }
        redirectCount += 1
        continue
      }

      if (response.status < 200 || response.status > 299) {
        await cancelResponse(response)
        throw snapshotError(
          "HTTP_STATUS_NOT_ALLOWED",
          `The public URL returned HTTP ${response.status}.`,
        )
      }

      let contentType: ReturnType<typeof parseContentType>
      try {
        contentType = parseContentType(response.headers)
      } catch (error) {
        await cancelResponse(response)
        throw error
      }

      const bytes = await readResponseBytes(
        response,
        { compressed: maxCompressedBytes, decompressed: maxDecompressedBytes },
        controller.signal,
      )
      const decoded = decodeBytes(bytes, contentType.charset)
      const text =
        contentType.mediaType === "text/html"
          ? extractReadableHtml(decoded)
          : normalizeReadableText(decoded)
      if (!text) {
        throw snapshotError(
          "EMPTY_CONTENT",
          "The page did not contain readable text. Paste the source text instead.",
        )
      }

      return {
        finalUrl: currentUrl.href,
        displayUrl: createDisplayUrl(currentUrl),
        displayName: extractDisplayName(currentUrl, decoded, contentType.mediaType),
        mimeType: contentType.mediaType,
        bytes,
        extractedText: text,
        byteSize: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        retrievedAt: new Date(),
        extractorVersion: SAFE_URL_TEXT_EXTRACTOR_VERSION,
      }
    }
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", onExternalAbort)
  }
}

export const fetchSafeUrlSnapshot = fetchPublicTextSnapshot

import { createHash } from "node:crypto"
import { gzipSync } from "node:zlib"

import { describe, expect, it, vi } from "vitest"

import {
  fetchPublicTextSnapshot,
  SAFE_URL_TEXT_EXTRACTOR_VERSION,
  type ResolvedPublicAddress,
  type SafeUrlFetch,
  type SafeUrlFetchResponse,
  type SafeUrlResolver,
} from "@/lib/learning/safe-url-snapshot"

const PUBLIC_V4: ResolvedPublicAddress = {
  address: "93.184.216.34",
  family: 4,
}

function chunks(...values: Uint8Array[]): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const value of values) yield value
    },
  }
}

function response(
  body: string | Uint8Array | null,
  init: {
    status?: number
    headers?: HeadersInit
    splitAt?: number
    cancel?: () => void
  } = {},
): SafeUrlFetchResponse {
  const bytes =
    body === null
      ? null
      : typeof body === "string"
        ? new TextEncoder().encode(body)
        : body
  const bodyChunks =
    bytes === null
      ? null
      : init.splitAt === undefined
        ? chunks(bytes)
        : chunks(bytes.slice(0, init.splitAt), bytes.slice(init.splitAt))

  return {
    status: init.status ?? 200,
    headers: new Headers(init.headers),
    body: bodyChunks,
    cancel: init.cancel,
  }
}

function fixedResolver(
  addresses: readonly ResolvedPublicAddress[] = [PUBLIC_V4],
): SafeUrlResolver {
  return vi.fn(async () => addresses)
}

function fixedFetch(value: SafeUrlFetchResponse): SafeUrlFetch {
  return vi.fn(async () => value)
}

function expectCode(work: Promise<unknown>, code: string) {
  return expect(work).rejects.toMatchObject({ code })
}

describe("safe public URL snapshots", () => {
  it.each([
    ["ftp://example.com/file", "UNSUPPORTED_PROTOCOL"],
    ["file:///etc/passwd", "UNSUPPORTED_PROTOCOL"],
    ["https://user@example.com", "CREDENTIALS_NOT_ALLOWED"],
    ["https://user:secret@example.com", "CREDENTIALS_NOT_ALLOWED"],
    ["http://localhost", "LOCAL_HOSTNAME_NOT_ALLOWED"],
    ["http://api.localhost.", "LOCAL_HOSTNAME_NOT_ALLOWED"],
    ["http://printer.local", "LOCAL_HOSTNAME_NOT_ALLOWED"],
    ["http://LOCAL.", "LOCAL_HOSTNAME_NOT_ALLOWED"],
    ["http://instance-data.ec2.internal", "LOCAL_HOSTNAME_NOT_ALLOWED"],
    ["http://router.home.arpa", "LOCAL_HOSTNAME_NOT_ALLOWED"],
    ["https://example.com:8443", "NON_STANDARD_PORT_NOT_ALLOWED"],
    ["http://example.com:443", "NON_STANDARD_PORT_NOT_ALLOWED"],
  ])("rejects a disallowed URL before fetching: %s", async (url, code) => {
    const resolver = fixedResolver()
    const fetchImpl = fixedFetch(
      response("unused", { headers: { "content-type": "text/plain" } }),
    )

    await expectCode(fetchPublicTextSnapshot(url, { resolver, fetchImpl }), code)
    expect(resolver).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    "http://127.1",
    "http://0177.0.0.1",
    "http://0x7f000001",
    "http://2130706433",
    "http://%31%32%37.0.0.1",
    "http://0.1.2.3",
    "http://10.1.2.3",
    "http://100.64.0.1",
    "http://127.255.255.254",
    "http://169.254.169.254/latest/meta-data",
    "http://172.31.0.1",
    "http://192.0.0.9",
    "http://192.0.2.1",
    "http://192.168.1.1",
    "http://198.18.0.1",
    "http://198.51.100.1",
    "http://203.0.113.1",
    "http://224.0.0.1",
    "http://240.0.0.1",
    "http://[::]",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "http://[::ffff:5db8:d822]",
    "http://[fc00::1]",
    "http://[fe80::1]",
    "http://[ff02::1]",
    "http://[2001:db8::1]",
    "http://[2002:7f00:1::]",
    "http://[3fff::1]",
  ])("rejects private, special, or encoded IP literal %s", async (url) => {
    const fetchImpl = fixedFetch(
      response("unused", { headers: { "content-type": "text/plain" } }),
    )

    await expectCode(
      fetchPublicTextSnapshot(url, { resolver: fixedResolver(), fetchImpl }),
      "UNSAFE_IP_ADDRESS",
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("rejects the whole DNS answer set when any address is unsafe", async () => {
    const fetchImpl = fixedFetch(
      response("unused", { headers: { "content-type": "text/plain" } }),
    )
    const resolver = fixedResolver([
      PUBLIC_V4,
      { address: "10.0.0.8", family: 4 },
    ])

    await expectCode(
      fetchPublicTextSnapshot("https://example.test", { resolver, fetchImpl }),
      "UNSAFE_IP_ADDRESS",
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    [[], "DNS_RETURNED_NO_ADDRESSES"],
    [[{ address: "not-an-ip", family: 4 }], "UNSAFE_IP_ADDRESS"],
    [[{ address: "93.184.216.34", family: 6 }], "UNSAFE_IP_ADDRESS"],
  ] as const)("rejects malformed resolver output", async (addresses, code) => {
    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(addresses),
        fetchImpl: fixedFetch(
          response("unused", { headers: { "content-type": "text/plain" } }),
        ),
      }),
      code,
    )
  })

  it("passes only the complete validated address set to the injected fetcher", async () => {
    const resolver = fixedResolver([
      PUBLIC_V4,
      { address: "2606:4700:4700::1111", family: 6 },
    ])
    const fetchImpl = vi.fn<SafeUrlFetch>(async (_url, context) => {
      expect(context.resolvedAddresses).toEqual([
        PUBLIC_V4,
        { address: "2606:4700:4700::1111", family: 6 },
      ])
      return response("Public text", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    })

    await expect(
      fetchPublicTextSnapshot("https://example.test", { resolver, fetchImpl }),
    ).resolves.toMatchObject({ extractedText: "Public text" })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it("allows a globally routable IPv6 literal without invoking DNS", async () => {
    const resolver = fixedResolver()
    const fetchImpl = vi.fn<SafeUrlFetch>(async (_url, context) => {
      expect(context.resolvedAddresses).toEqual([
        { address: "2606:4700:4700::1111", family: 6 },
      ])
      return response("IPv6 source", {
        headers: { "content-type": "text/plain" },
      })
    })

    await expect(
      fetchPublicTextSnapshot("https://[2606:4700:4700::1111]/source", {
        resolver,
        fetchImpl,
      }),
    ).resolves.toMatchObject({ extractedText: "IPv6 source" })
    expect(resolver).not.toHaveBeenCalled()
  })

  it("does not invoke DNS for an already validated public IP literal", async () => {
    const resolver = fixedResolver()
    const fetchImpl = fixedFetch(
      response("Public text", { headers: { "content-type": "text/plain" } }),
    )

    await fetchPublicTextSnapshot("http://93.184.216.34/source", {
      resolver,
      fetchImpl,
    })

    expect(resolver).not.toHaveBeenCalled()
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: "93.184.216.34" }),
      expect.objectContaining({ resolvedAddresses: [PUBLIC_V4] }),
    )
  })

  it("revalidates and re-resolves every redirect before fetching it", async () => {
    const resolver = vi.fn<SafeUrlResolver>(async (hostname) => {
      if (hostname === "first.test") return [PUBLIC_V4]
      return [{ address: "1.1.1.1", family: 4 }]
    })
    const firstCancel = vi.fn()
    const fetchImpl = vi
      .fn<SafeUrlFetch>()
      .mockResolvedValueOnce(
        response("ignored", {
          status: 302,
          headers: { location: "https://second.test/article#section" },
          cancel: firstCancel,
        }),
      )
      .mockResolvedValueOnce(
        response("Done", { headers: { "content-type": "text/plain" } }),
      )

    const result = await fetchPublicTextSnapshot("https://first.test/start", {
      resolver,
      fetchImpl,
    })

    expect(resolver).toHaveBeenNthCalledWith(
      1,
      "first.test",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(resolver).toHaveBeenNthCalledWith(
      2,
      "second.test",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(fetchImpl.mock.calls[1]?.[1].resolvedAddresses).toEqual([
      { address: "1.1.1.1", family: 4 },
    ])
    expect(firstCancel).toHaveBeenCalledOnce()
    expect(result.finalUrl).toBe("https://second.test/article")
  })

  it("blocks a redirect to a private or credential-bearing target", async () => {
    const privateRedirect = fixedFetch(
      response(null, { status: 302, headers: { location: "http://127.1/admin" } }),
    )
    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: privateRedirect,
      }),
      "UNSAFE_IP_ADDRESS",
    )

    const credentialRedirect = fixedFetch(
      response(null, {
        status: 302,
        headers: { location: "https://admin:secret@other.test" },
      }),
    )
    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: credentialRedirect,
      }),
      "CREDENTIALS_NOT_ALLOWED",
    )
  })

  it("enforces the redirect cap and rejects redirects without a location", async () => {
    const endlessRedirect: SafeUrlFetch = vi.fn(async () =>
      response(null, { status: 301, headers: { location: "/again" } }),
    )
    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: endlessRedirect,
        maxRedirects: 1,
      }),
      "REDIRECT_LIMIT_EXCEEDED",
    )
    expect(endlessRedirect).toHaveBeenCalledTimes(2)

    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(response(null, { status: 302 })),
      }),
      "INVALID_REDIRECT",
    )
  })

  it("extracts inert readable HTML and returns persistence metadata", async () => {
    const raw = [
      "<!doctype html><html><head>",
      "<title>Safe &amp; useful</title><style>.hidden{display:none}</style>",
      "</head><body><h1>Cache &lt;rules&gt;</h1>",
      "<script>globalThis.pwned = true</script>",
      "<p>First&nbsp;paragraph.</p><p>Second paragraph.</p>",
      "</body></html>",
    ].join("")
    const bytes = new TextEncoder().encode(raw)

    const result = await fetchPublicTextSnapshot(
      "https://example.test/guide?access_token=secret#part",
      {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(
          response(bytes, {
            headers: {
              "content-type": "Text/HTML; charset=\"utf-8\"",
              "content-length": String(bytes.byteLength),
            },
          }),
        ),
      },
    )

    expect(result).toMatchObject({
      finalUrl: "https://example.test/guide?access_token=secret",
      displayUrl: "https://example.test/guide",
      displayName: "Safe & useful",
      mimeType: "text/html",
      byteSize: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      extractorVersion: SAFE_URL_TEXT_EXTRACTOR_VERSION,
    })
    expect(result.bytes).toEqual(bytes)
    expect(result.extractedText).toContain("Cache <rules>")
    expect(result.extractedText).toContain("First paragraph.")
    expect(result.extractedText).toContain("Second paragraph.")
    expect(result.extractedText).not.toContain("globalThis")
    expect(result.extractedText).not.toContain("display:none")
    expect(result.retrievedAt).toBeInstanceOf(Date)
  })

  it.each([
    ["application/json", "UNSUPPORTED_MEDIA_TYPE"],
    ["text/markdown", "UNSUPPORTED_MEDIA_TYPE"],
    [null, "UNSUPPORTED_MEDIA_TYPE"],
  ])("allows only HTML and plain text media types", async (contentType, code) => {
    const headers = contentType ? { "content-type": contentType } : undefined
    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(response("body", { headers })),
      }),
      code,
    )
  })

  it("rejects non-success responses", async () => {
    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(
          response("not found", {
            status: 404,
            headers: { "content-type": "text/plain" },
          }),
        ),
      }),
      "HTTP_STATUS_NOT_ALLOWED",
    )
  })

  it.each([
    ["   \n\t", "text/plain"],
    ["<html><script>secret()</script><style>body{}</style></html>", "text/html"],
  ])("rejects a %s response without readable text", async (body, contentType) => {
    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(
          response(body, { headers: { "content-type": contentType } }),
        ),
      }),
      "EMPTY_CONTENT",
    )
  })

  it.each(["3, 4", "-1", "NaN", "9007199254740992"])(
    "rejects malformed content length %s",
    async (contentLength) => {
      await expectCode(
        fetchPublicTextSnapshot("https://example.test", {
          resolver: fixedResolver(),
          fetchImpl: fixedFetch(
            response("body", {
              headers: {
                "content-type": "text/plain",
                "content-length": contentLength,
              },
            }),
          ),
        }),
        "INVALID_CONTENT_LENGTH",
      )
    },
  )

  it("rejects an oversized declared or streamed compressed body", async () => {
    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(
          response("tiny", {
            headers: { "content-type": "text/plain", "content-length": "11" },
          }),
        ),
        maxCompressedBytes: 10,
      }),
      "COMPRESSED_BODY_TOO_LARGE",
    )

    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(
          response("12345678901", {
            headers: { "content-type": "text/plain" },
            splitAt: 5,
          }),
        ),
        maxCompressedBytes: 10,
      }),
      "COMPRESSED_BODY_TOO_LARGE",
    )
  })

  it("caps decompressed gzip content independently of its compressed size", async () => {
    const compressed = gzipSync("A".repeat(4_000))
    expect(compressed.byteLength).toBeLessThan(200)

    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(
          response(compressed, {
            headers: {
              "content-type": "text/plain",
              "content-encoding": "gzip",
              "content-length": String(compressed.byteLength),
            },
          }),
        ),
        maxCompressedBytes: 200,
        maxDecompressedBytes: 1_000,
      }),
      "DECOMPRESSED_BODY_TOO_LARGE",
    )
  })

  it("decodes valid gzip only and rejects unsupported or corrupt encodings", async () => {
    const compressed = gzipSync("Compressed note")
    await expect(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(
          response(compressed, {
            headers: {
              "content-type": "text/plain",
              "content-encoding": "gzip",
            },
          }),
        ),
      }),
    ).resolves.toMatchObject({ extractedText: "Compressed note" })

    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(
          response("body", {
            headers: {
              "content-type": "text/plain",
              "content-encoding": "gzip, br",
            },
          }),
        ),
      }),
      "UNSUPPORTED_CONTENT_ENCODING",
    )

    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch(
          response("not gzip", {
            headers: {
              "content-type": "text/plain",
              "content-encoding": "gzip",
            },
          }),
        ),
      }),
      "DECOMPRESSION_FAILED",
    )
  })

  it("applies one timeout across resolution, redirects, and body work", async () => {
    const resolver: SafeUrlResolver = vi.fn(
      () => new Promise<readonly ResolvedPublicAddress[]>(() => undefined),
    )

    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver,
        fetchImpl: fixedFetch(
          response("unused", { headers: { "content-type": "text/plain" } }),
        ),
        timeoutMs: 10,
      }),
      "TIMEOUT",
    )
  })

  it("times out a fetcher or response body that stops making progress", async () => {
    const stalledFetch: SafeUrlFetch = vi.fn(
      () => new Promise<SafeUrlFetchResponse>(() => undefined),
    )
    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: stalledFetch,
        timeoutMs: 10,
      }),
      "TIMEOUT",
    )

    const cancel = vi.fn()
    const stalledBody: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => new Promise<IteratorResult<Uint8Array>>(() => undefined),
        }
      },
    }
    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver: fixedResolver(),
        fetchImpl: fixedFetch({
          status: 200,
          headers: new Headers({ "content-type": "text/plain" }),
          body: stalledBody,
          cancel,
        }),
        timeoutMs: 10,
      }),
      "TIMEOUT",
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  it("maps resolver failures to a stable DNS error", async () => {
    const resolver: SafeUrlResolver = vi.fn(async () => {
      throw new Error("resolver implementation detail")
    })

    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        resolver,
        fetchImpl: fixedFetch(
          response("unused", { headers: { "content-type": "text/plain" } }),
        ),
      }),
      "DNS_FAILED",
    )
  })

  it("honors a caller abort before DNS or fetch", async () => {
    const controller = new AbortController()
    controller.abort(new Error("stop"))
    const resolver = fixedResolver()
    const fetchImpl = fixedFetch(
      response("unused", { headers: { "content-type": "text/plain" } }),
    )

    await expectCode(
      fetchPublicTextSnapshot("https://example.test", {
        signal: controller.signal,
        resolver,
        fetchImpl,
      }),
      "ABORTED",
    )
    expect(resolver).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

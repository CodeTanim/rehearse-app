import "server-only"

export const MAX_PDF_UPLOAD_BYTES = 6 * 1024 * 1024
export const MAX_PDF_PAGES = 150

const PDF_SIGNATURE = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
const PDF_EXTRACTION_TIMEOUT_MS = 15_000

export class PdfTextExtractionError extends Error {
  constructor(
    public readonly code:
      | "EMPTY_PDF"
      | "PDF_TOO_LARGE"
      | "INVALID_PDF"
      | "PDF_PASSWORD_REQUIRED"
      | "PDF_TOO_MANY_PAGES"
      | "PDF_EXTRACTION_TIMEOUT"
      | "PDF_TEXT_TOO_LARGE"
      | "PDF_HAS_NO_TEXT",
    public readonly publicMessage: string,
    options?: ErrorOptions,
  ) {
    super(publicMessage, options)
    this.name = "PdfTextExtractionError"
  }
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return PDF_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

function isPasswordError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "PasswordException"
  )
}

function pageText(items: unknown[]): string {
  let text = ""
  for (const item of items) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("str" in item) ||
      typeof item.str !== "string" ||
      item.str.length === 0
    ) {
      continue
    }
    text += item.str
    text += "hasEOL" in item && item.hasEOL === true ? "\n" : " "
  }
  return text.trim()
}

async function withExtractionTimeout<T>(work: Promise<T>): Promise<T> {
  let timeout: NodeJS.Timeout | undefined
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(
          new PdfTextExtractionError(
            "PDF_EXTRACTION_TIMEOUT",
            "That PDF took too long to read. Try a smaller PDF or paste its text.",
          ),
        )
      }, PDF_EXTRACTION_TIMEOUT_MS)
      timeout.unref?.()
    })
    return await Promise.race([work, timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function extractPdfTextWithinLimits(
  bytes: Uint8Array,
  maxTextBytes: number,
): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loadingTask = getDocument({
    data: bytes,
    disableAutoFetch: true,
    disableFontFace: true,
    disableRange: true,
    disableStream: true,
    enableXfa: false,
    isEvalSupported: false,
    isImageDecoderSupported: false,
    isOffscreenCanvasSupported: false,
    maxImageSize: 4_000_000,
    stopAtErrors: true,
    useSystemFonts: false,
    useWasm: false,
    useWorkerFetch: false,
    verbosity: 0,
  })

  try {
    const document = await loadingTask.promise
    if (document.numPages > MAX_PDF_PAGES) {
      throw new PdfTextExtractionError(
        "PDF_TOO_MANY_PAGES",
        `PDFs can have at most ${MAX_PDF_PAGES} pages.`,
      )
    }

    const pages: string[] = []
    let byteSize = 0
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent({
        disableNormalization: false,
        includeMarkedContent: false,
      })
      const text = pageText(content.items)
      if (!text) continue

      const section = `Page ${pageNumber}\n${text}`
      byteSize += Buffer.byteLength(section, "utf8") + (pages.length > 0 ? 2 : 0)
      if (byteSize > maxTextBytes) {
        throw new PdfTextExtractionError(
          "PDF_TEXT_TOO_LARGE",
          "That PDF contains too much text. Use a shorter PDF or split it into sections.",
        )
      }
      pages.push(section)
    }

    if (pages.length === 0) {
      throw new PdfTextExtractionError(
        "PDF_HAS_NO_TEXT",
        "No selectable text was found. Upload a text-based PDF or paste your notes.",
      )
    }

    return pages.join("\n\n")
  } finally {
    await loadingTask.destroy().catch(() => undefined)
  }
}

export async function extractPdfText(
  bytes: Uint8Array,
  options: { maxTextBytes: number },
): Promise<string> {
  if (bytes.byteLength === 0) {
    throw new PdfTextExtractionError("EMPTY_PDF", "Choose a PDF before continuing.")
  }
  if (bytes.byteLength > MAX_PDF_UPLOAD_BYTES) {
    throw new PdfTextExtractionError(
      "PDF_TOO_LARGE",
      "PDFs must be 6 MB or smaller.",
    )
  }
  if (!hasPdfSignature(bytes)) {
    throw new PdfTextExtractionError(
      "INVALID_PDF",
      "That file is not a valid PDF.",
    )
  }

  try {
    return await withExtractionTimeout(
      extractPdfTextWithinLimits(bytes, options.maxTextBytes),
    )
  } catch (error) {
    if (error instanceof PdfTextExtractionError) throw error
    if (isPasswordError(error)) {
      throw new PdfTextExtractionError(
        "PDF_PASSWORD_REQUIRED",
        "Password-protected PDFs are not supported.",
        { cause: error },
      )
    }
    throw new PdfTextExtractionError(
      "INVALID_PDF",
      "That PDF could not be read. Try another file or paste its text.",
      { cause: error },
    )
  }
}

import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  extractPdfText,
  MAX_PDF_UPLOAD_BYTES,
} from "@/lib/learning/pdf-text-extractor"

describe("PDF source text extraction", () => {
  it("extracts text from in-memory PDF bytes with page locators", async () => {
    const text = await extractPdfText(simplePdf("Hash maps use buckets."), {
      maxTextBytes: 8_192,
    })

    expect(text).toContain("Page 1")
    expect(text).toContain("Hash maps use buckets.")
  })

  it("rejects signature spoofing before invoking the PDF parser", async () => {
    await expect(
      extractPdfText(new TextEncoder().encode("not a PDF"), {
        maxTextBytes: 8_192,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_PDF",
      publicMessage: "That file is not a valid PDF.",
    })
  })

  it("rejects uploads above the byte limit before parsing", async () => {
    const bytes = new Uint8Array(MAX_PDF_UPLOAD_BYTES + 1)
    bytes.set(new TextEncoder().encode("%PDF-"))

    await expect(
      extractPdfText(bytes, { maxTextBytes: 8_192 }),
    ).rejects.toMatchObject({ code: "PDF_TOO_LARGE" })
  })

  it("stops when extracted text exceeds its independent generation bound", async () => {
    await expect(
      extractPdfText(simplePdf("Hash maps use buckets."), {
        maxTextBytes: 10,
      }),
    ).rejects.toMatchObject({ code: "PDF_TEXT_TOO_LARGE" })
  })
})

function simplePdf(text: string): Uint8Array {
  const escaped = text.replace(/([\\()])/g, "\\$1")
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escaped}) Tj\nET`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ]

  let body = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "ascii"))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(body, "ascii")
  body += `xref\n0 ${objects.length + 1}\n`
  body += "0000000000 65535 f \n"
  for (const offset of offsets.slice(1)) {
    body += `${offset.toString().padStart(10, "0")} 00000 n \n`
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  body += `startxref\n${xrefOffset}\n%%EOF\n`

  return new TextEncoder().encode(body)
}

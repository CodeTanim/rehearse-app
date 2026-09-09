import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { AnswerAssessmentPicker } from "@/components/learning/answer-assessment"

describe("shared short-answer assessment", () => {
  it("explains each rating and makes the self-rated nature explicit", () => {
    const html = renderToStaticMarkup(createElement(AnswerAssessmentPicker, { value: "PARTIAL", onChange: vi.fn() }))
    for (const text of ["Missed", "Partial", "Meets", "Key idea missing", "Some key ideas", "All key ideas", "not AI-graded"]) expect(html).toContain(text)
    expect(html.match(/checked=""/g)).toHaveLength(1)
    expect(html).not.toContain("type=\"submit\"")
  })
})

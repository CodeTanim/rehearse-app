import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  generateLocalLearningPack,
  LOCAL_LEARNING_PACK_MODEL,
} from "@/lib/ai/local-learning-pack"
import { initialQuizQuestions } from "@/lib/ai/learning-pack-schema"

describe("local learning-pack preview", () => {
  it("builds a valid mixed Hashmaps quiz and reserves both new-angle prompts", async () => {
    const pack = await generateLocalLearningPack({
      skillTitle: "Hashmaps",
      sources: [
        {
          sourceId: "version-1",
          title: "My notes",
          locator: "My notes · snapshot 1",
          text: "A hash map stores key-value pairs. A hash function maps a key to a bucket.",
        },
      ],
    })

    expect(LOCAL_LEARNING_PACK_MODEL).toBe("local-preview-v1")
    expect(pack.branch).toBe("Data Structures")
    expect(initialQuizQuestions(pack)).toHaveLength(4)
    expect(new Set(initialQuizQuestions(pack).map((question) => question.type))).toEqual(
      new Set(["MULTIPLE_CHOICE", "SHORT_RESPONSE"]),
    )
    expect(pack.questions.filter((question) => question.isTransferProbe)).toHaveLength(2)
  })
})

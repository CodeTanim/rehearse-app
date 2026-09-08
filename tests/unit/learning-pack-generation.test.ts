import { describe, expect, it } from "vitest"

import {
  initialQuizQuestions,
  LearningPackGenerationError,
  validateLearningPack,
  type LearningPack,
} from "@/lib/ai/learning-pack-schema"

const sources = [
  {
    sourceId: "source-1",
    title: "Hash map notes",
    locator: "Notes · paragraph 1",
    text: "A hash map stores key-value pairs. A hash function maps a key to a bucket. Collisions happen when keys map to the same bucket.",
  },
]

const questions: LearningPack["questions"] = [
  {
    competencyId: "storage",
    questionFamilyId: "storage-recognition",
    type: "MULTIPLE_CHOICE",
    prompt: "What does a hash map store?",
    choices: ["Key-value pairs", "Only keys", "Sorted rows", "Tree edges"],
    correctChoiceIndex: 0,
    referenceAnswer: "Key-value pairs",
    explanation: "The source defines the stored unit directly.",
    citation: {
      sourceId: "source-1",
      locator: "Notes · paragraph 1",
      excerpt: "A hash map stores key-value pairs.",
    },
    isTransferProbe: false,
  },
  {
    competencyId: "hashing",
    questionFamilyId: "hashing-explanation",
    type: "SHORT_RESPONSE",
    prompt: "What does a hash function do?",
    choices: [],
    correctChoiceIndex: null,
    referenceAnswer: "It maps a key to a bucket.",
    explanation: "The mapping determines where the implementation looks.",
    citation: {
      sourceId: "source-1",
      locator: "Notes · paragraph 1",
      excerpt: "A hash function maps a key to a bucket.",
    },
    isTransferProbe: false,
  },
  {
    competencyId: "collisions",
    questionFamilyId: "collision-explanation",
    type: "SHORT_RESPONSE",
    prompt: "When does a collision occur?",
    choices: [],
    correctChoiceIndex: null,
    referenceAnswer: "When keys map to the same bucket.",
    explanation: "That is the source's definition of a collision.",
    citation: {
      sourceId: "source-1",
      locator: "Notes · paragraph 1",
      excerpt: "Collisions happen when keys map to the same bucket.",
    },
    isTransferProbe: false,
  },
  {
    competencyId: "storage",
    questionFamilyId: "storage-pairing",
    type: "MULTIPLE_CHOICE",
    prompt: "Which pairing best matches the source?",
    choices: ["Key and value", "Page and chapter", "Node and edge", "Row and column"],
    correctChoiceIndex: 0,
    referenceAnswer: "Key and value",
    explanation: "The source describes key-value pairs.",
    citation: {
      sourceId: "source-1",
      locator: "Notes · paragraph 1",
      excerpt: "A hash map stores key-value pairs.",
    },
    isTransferProbe: false,
  },
  {
    competencyId: "hashing",
    questionFamilyId: "hashing-application",
    type: "SHORT_RESPONSE",
    prompt: "In a new example, where should a lookup start?",
    choices: [],
    correctChoiceIndex: null,
    referenceAnswer: "At the bucket selected from the key.",
    explanation: "This applies the source's key-to-bucket mapping.",
    citation: {
      sourceId: "source-1",
      locator: "Notes · paragraph 1",
      excerpt: "A hash function maps a key to a bucket.",
    },
    isTransferProbe: true,
  },
  {
    competencyId: "collisions",
    questionFamilyId: "collision-application",
    type: "MULTIPLE_CHOICE",
    prompt: "Two new keys select one bucket. What happened?",
    choices: ["A collision", "A sort", "A deletion", "A traversal"],
    correctChoiceIndex: 0,
    referenceAnswer: "A collision",
    explanation: "Two keys mapped to the same bucket.",
    citation: {
      sourceId: "source-1",
      locator: "Notes · paragraph 1",
      excerpt: "Collisions happen when keys map to the same bucket.",
    },
    isTransferProbe: true,
  },
]

function validPack(): LearningPack {
  return {
    branch: "Data Structures",
    placementRationale: "Hash maps are a data-structure topic.",
    competencies: [
      { id: "storage", title: "Stored data" },
      { id: "hashing", title: "Hashing" },
      { id: "collisions", title: "Collisions" },
    ],
    questions: questions.map((question) => ({
      ...question,
      choices: [...question.choices],
      citation: { ...question.citation },
    })),
  }
}

describe("source-grounded learning pack validation", () => {
  it("keeps transfer probes out of the initial mixed quiz", () => {
    const pack = validateLearningPack(validPack(), sources)

    expect(initialQuizQuestions(pack)).toHaveLength(4)
    expect(initialQuizQuestions(pack).every((question) => !question.isTransferProbe)).toBe(true)
    expect(new Set(initialQuizQuestions(pack).map((question) => question.type))).toEqual(
      new Set(["MULTIPLE_CHOICE", "SHORT_RESPONSE"]),
    )
  })

  it("rejects citations whose excerpt is absent from the assigned snapshot", () => {
    const pack = validPack()
    pack.questions[0] = {
      ...pack.questions[0],
      citation: { ...pack.questions[0].citation, excerpt: "Unsupported claim." },
    }

    expect(() => validateLearningPack(pack, sources)).toThrow(LearningPackGenerationError)
  })

  it("rejects packs without a reserved transfer probe", () => {
    const pack = validPack()
    pack.questions[4] = { ...pack.questions[4], isTransferProbe: false }
    pack.questions[5] = { ...pack.questions[5], isTransferProbe: false }

    expect(() => validateLearningPack(pack, sources)).toThrow(
      "Exactly two questions must be reserved transfer probes.",
    )
  })

  it("requires two distinct transfer question families", () => {
    const pack = validPack()
    pack.questions[5] = {
      ...pack.questions[5],
      questionFamilyId: pack.questions[4].questionFamilyId,
    }

    expect(() => validateLearningPack(pack, sources)).toThrow(
      "Reserved transfer probes must use distinct question families.",
    )
  })

  it("rejects missing competency coverage in the initial quiz", () => {
    const pack = validPack()
    pack.questions[2] = { ...pack.questions[2], competencyId: "storage" }

    expect(() => validateLearningPack(pack, sources)).toThrow(
      "The initial quiz must cover every required competency.",
    )
  })
})

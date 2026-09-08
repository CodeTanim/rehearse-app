import "server-only"

import {
  validateLearningPack,
  type LearningPack,
  type LearningSourceSnapshot,
} from "@/lib/ai/learning-pack-schema"

export const LOCAL_LEARNING_PACK_MODEL = "local-preview-v1"

function excerptFrom(source: LearningSourceSnapshot, offset: number) {
  const normalized = source.text.replace(/\s+/g, " ").trim()
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
  const selected = sentences[offset % Math.max(1, sentences.length)] ?? normalized
  return selected.slice(0, 300).trim()
}

function suggestedBranch(skillTitle: string) {
  const title = skillTitle.toLocaleLowerCase("en")
  if (
    /\b(hash\s?maps?|arrays?|linked lists?|stacks?|queues?|trees?|graphs?|heaps?)\b/.test(
      title,
    )
  ) {
    return "Data Structures"
  }
  if (/\b(html|css|javascript|typescript|react|next\.?js|http|web)\b/.test(title)) {
    return "Web Development"
  }
  if (/\b(sql|database|postgres|mysql|indexing)\b/.test(title)) return "Databases"
  return "General learning"
}

/**
 * Deterministic, clearly labelled local-only pack for exercising the product
 * flow without sending source text to an external model. It is not a quality
 * substitute for configured AI generation.
 */
export async function generateLocalLearningPack(input: {
  skillTitle: string
  sources: LearningSourceSnapshot[]
}): Promise<LearningPack> {
  if (input.sources.length === 0) throw new Error("A local preview needs a source.")
  const first = input.sources[0]
  const second = input.sources[1] ?? first
  const excerptA = excerptFrom(first, 0)
  const excerptB = excerptFrom(second, 1)
  if (!excerptA || !excerptB) throw new Error("A local preview needs readable source text.")

  const citationA = {
    sourceId: first.sourceId,
    locator: first.locator,
    excerpt: excerptA,
  }
  const citationB = {
    sourceId: second.sourceId,
    locator: second.locator,
    excerpt: excerptB,
  }
  const correctA = `The source says: ${excerptA}`
  const correctB = `The source says: ${excerptB}`
  const branch = suggestedBranch(input.skillTitle)
  const pack: LearningPack = {
    branch,
    placementRationale: `${input.skillTitle} is semantically related to ${branch.toLocaleLowerCase("en")}; this metadata does not place or connect the Skill Leaf.`,
    competencies: [
      { id: "core-idea", title: "Core idea" },
      { id: "supporting-detail", title: "Supporting detail" },
    ],
    questions: [
      {
        competencyId: "core-idea",
        questionFamilyId: "core-recognition",
        type: "MULTIPLE_CHOICE",
        prompt: "Which statement is supported by your source?",
        choices: [
          correctA,
          "The source says this topic has no practical use.",
          "The source says every example behaves identically.",
          "The source does not describe a core idea.",
        ],
        correctChoiceIndex: 0,
        referenceAnswer: correctA,
        explanation: "The first option repeats an idea from the saved source snapshot.",
        citation: citationA,
        isTransferProbe: false,
      },
      {
        competencyId: "core-idea",
        questionFamilyId: "core-explanation",
        type: "SHORT_RESPONSE",
        prompt: `Explain this idea in your own words: ${excerptA}`,
        choices: [],
        correctChoiceIndex: null,
        referenceAnswer: excerptA,
        explanation: "A strong answer preserves the meaning while using your own wording.",
        citation: citationA,
        isTransferProbe: false,
      },
      {
        competencyId: "supporting-detail",
        questionFamilyId: "detail-recognition",
        type: "MULTIPLE_CHOICE",
        prompt: "Which detail appears in the saved source?",
        choices: [
          correctB,
          "The source rejects the topic entirely.",
          "The source guarantees one universal implementation.",
          "The source contains no supporting details.",
        ],
        correctChoiceIndex: 0,
        referenceAnswer: correctB,
        explanation: "The first option is grounded in the immutable source snapshot.",
        citation: citationB,
        isTransferProbe: false,
      },
      {
        competencyId: "supporting-detail",
        questionFamilyId: "detail-importance",
        type: "SHORT_RESPONSE",
        prompt: `What makes this detail important? ${excerptB}`,
        choices: [],
        correctChoiceIndex: null,
        referenceAnswer: excerptB,
        explanation: "Compare your explanation with the exact source detail.",
        citation: citationB,
        isTransferProbe: false,
      },
      {
        competencyId: "core-idea",
        questionFamilyId: "core-application",
        type: "SHORT_RESPONSE",
        prompt: "How could the core idea guide a new, realistic example?",
        choices: [],
        correctChoiceIndex: null,
        referenceAnswer: `Apply this source-supported idea: ${excerptA}`,
        explanation: "This new-angle prompt applies the same sourced idea in a fresh context.",
        citation: citationA,
        isTransferProbe: true,
      },
      {
        competencyId: "supporting-detail",
        questionFamilyId: "detail-verification",
        type: "MULTIPLE_CHOICE",
        prompt: "In a new example, which source detail should you verify first?",
        choices: [
          correctB,
          "Assume the detail never matters.",
          "Ignore the saved source.",
          "Choose an unrelated detail.",
        ],
        correctChoiceIndex: 0,
        referenceAnswer: correctB,
        explanation: "The correct option carries the sourced detail into a new situation.",
        citation: citationB,
        isTransferProbe: true,
      },
    ],
  }

  return validateLearningPack(pack, input.sources)
}

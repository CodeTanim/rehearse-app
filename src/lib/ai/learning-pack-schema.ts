import { z } from "zod"

const citationSchema = z.object({
  sourceId: z.string().trim().min(1).max(128),
  locator: z.string().trim().min(1).max(240),
  excerpt: z.string().trim().min(1).max(600),
})

const generatedQuestionSchema = z.object({
  competencyId: z.string().trim().min(1).max(80),
  questionFamilyId: z.string().trim().min(1).max(80),
  type: z.enum(["MULTIPLE_CHOICE", "SHORT_RESPONSE"]),
  prompt: z.string().trim().min(1).max(1_000),
  choices: z.array(z.string().trim().min(1).max(400)).max(4),
  correctChoiceIndex: z.number().int().min(0).max(3).nullable(),
  referenceAnswer: z.string().trim().min(1).max(2_000),
  explanation: z.string().trim().min(1).max(2_000),
  citation: citationSchema,
  isTransferProbe: z.boolean(),
})

export const learningPackSchema = z.object({
  branch: z.string().trim().min(1).max(80),
  placementRationale: z.string().trim().min(1).max(300),
  competencies: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        title: z.string().trim().min(1).max(120),
      }),
    )
    .min(2)
    .max(5),
  questions: z.array(generatedQuestionSchema).length(6),
})

export type LearningPack = z.infer<typeof learningPackSchema>

export type LearningSourceSnapshot = {
  sourceId: string
  title: string
  locator: string
  text: string
}

export class LearningPackGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LearningPackGenerationError"
  }
}

function normalizeForMatch(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en")
}

export function validateLearningPack(
  value: unknown,
  sources: LearningSourceSnapshot[],
): LearningPack {
  const pack = learningPackSchema.parse(value)
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]))
  const competencyIds = new Set(pack.competencies.map((competency) => competency.id))
  const familiarCompetencies = new Set<string>()
  const prompts = new Set<string>()
  let transferCount = 0
  const transferFamilies = new Set<string>()
  let familiarMultipleChoice = 0
  let familiarShortResponse = 0

  if (competencyIds.size !== pack.competencies.length) {
    throw new LearningPackGenerationError("Competency identifiers must be unique.")
  }

  for (const question of pack.questions) {
    const promptKey = normalizeForMatch(question.prompt)
    if (prompts.has(promptKey)) {
      throw new LearningPackGenerationError("Generated prompts must be distinct.")
    }
    prompts.add(promptKey)

    if (!competencyIds.has(question.competencyId)) {
      throw new LearningPackGenerationError("Every question must map to a listed competency.")
    }

    if (question.type === "MULTIPLE_CHOICE") {
      if (question.choices.length !== 4 || question.correctChoiceIndex === null) {
        throw new LearningPackGenerationError(
          "Multiple-choice questions need four choices and one correct index.",
        )
      }
      if (new Set(question.choices.map(normalizeForMatch)).size !== 4) {
        throw new LearningPackGenerationError("Multiple-choice options must be unique.")
      }
    } else if (question.choices.length !== 0 || question.correctChoiceIndex !== null) {
      throw new LearningPackGenerationError(
        "Short-response questions cannot contain multiple-choice answers.",
      )
    }

    const source = sourceById.get(question.citation.sourceId)
    if (!source) {
      throw new LearningPackGenerationError("Every citation must reference an assigned source.")
    }
    if (question.citation.locator !== source.locator) {
      throw new LearningPackGenerationError(
        "Every citation must use the assigned snapshot's stable locator.",
      )
    }
    if (
      !normalizeForMatch(source.text).includes(
        normalizeForMatch(question.citation.excerpt),
      )
    ) {
      throw new LearningPackGenerationError(
        "Every citation excerpt must occur in its immutable source snapshot.",
      )
    }

    if (question.isTransferProbe) {
      transferCount += 1
      transferFamilies.add(question.questionFamilyId)
    } else {
      familiarCompetencies.add(question.competencyId)
      if (question.type === "MULTIPLE_CHOICE") familiarMultipleChoice += 1
      else familiarShortResponse += 1
    }
  }

  if (transferCount !== 2) {
    throw new LearningPackGenerationError(
      "Exactly two questions must be reserved transfer probes.",
    )
  }
  if (transferFamilies.size !== transferCount) {
    throw new LearningPackGenerationError(
      "Reserved transfer probes must use distinct question families.",
    )
  }
  if (familiarMultipleChoice === 0 || familiarShortResponse === 0) {
    throw new LearningPackGenerationError("The initial quiz must mix both question types.")
  }
  if ([...competencyIds].some((id) => !familiarCompetencies.has(id))) {
    throw new LearningPackGenerationError(
      "The initial quiz must cover every required competency.",
    )
  }

  return pack
}

export function initialQuizQuestions(pack: LearningPack) {
  return pack.questions.filter((question) => !question.isTransferProbe)
}

export type VisibleInitialQuizQuestion = {
  questionIndex: number
  question: LearningPack["questions"][number]
}

/** Produces the only question data that may be serialized to the initial-quiz client. */
export function visibleInitialQuizQuestions(
  pack: LearningPack,
): VisibleInitialQuizQuestion[] {
  return pack.questions.flatMap((question, questionIndex) =>
    question.isTransferProbe ? [] : [{ questionIndex, question }],
  )
}

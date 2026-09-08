import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const expectedDatabaseUrl = "file:./dev.local.db"
const demoEmail = "demo@rehearse.local"
const demoPassword = "RehearseDemo!2026"

if (process.env.NODE_ENV === "production" || process.env.DATABASE_URL !== expectedDatabaseUrl) {
  throw new Error(
    "The local seed may run only against DATABASE_URL=file:./dev.local.db outside production.",
  )
}

const prisma = new PrismaClient()

try {
  const password = await bcrypt.hash(demoPassword, 10)
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      name: "Local Demo",
      password,
      timezone: "UTC",
    },
    create: {
      id: "local-demo-user",
      email: demoEmail,
      name: "Local Demo",
      password,
      timezone: "UTC",
    },
  })

  const folder = await prisma.skillFolder.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: "System Design Foundations",
      },
    },
    update: {
      color: "#79A986",
      description: "Deterministic local-only material for smoke testing.",
    },
    create: {
      id: "local-demo-folder",
      userId: user.id,
      name: "System Design Foundations",
      color: "#79A986",
      description: "Deterministic local-only material for smoke testing.",
    },
  })

  await prisma.note.upsert({
    where: { id: "local-demo-note" },
    update: {
      skillFolderId: folder.id,
      title: "Idempotent API operations",
      content:
        "An idempotency key lets a client safely retry an operation without creating a duplicate result.",
    },
    create: {
      id: "local-demo-note",
      skillFolderId: folder.id,
      title: "Idempotent API operations",
      content:
        "An idempotency key lets a client safely retry an operation without creating a duplicate result.",
    },
  })

  const graph = await prisma.skillGraph.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      id: "local-demo-graph",
      userId: user.id,
    },
  })

  const goal = await prisma.learningGoal.upsert({
    where: {
      userId_slug: {
        userId: user.id,
        slug: "reliable-api-design",
      },
    },
    update: {
      title: "Reliable API design",
      outcome: "Design retry-safe APIs and explain the tradeoffs.",
    },
    create: {
      id: "local-demo-goal",
      userId: user.id,
      graphId: graph.id,
      title: "Reliable API design",
      outcome: "Design retry-safe APIs and explain the tradeoffs.",
      slug: "reliable-api-design",
      status: "ACTIVE",
    },
  })

  const skill = await prisma.skillNode.upsert({
    where: {
      graphId_slug: {
        graphId: graph.id,
        slug: "idempotent-operations",
      },
    },
    update: {
      parentId: null,
      title: "Idempotent operations",
      outcome: "Explain how idempotency makes retries safe.",
      defaultSuccessCriterion: "Explain the key, duplicate request, and stored-result flow.",
    },
    create: {
      id: "local-demo-skill",
      graphId: graph.id,
      parentId: null,
      kind: "SKILL",
      title: "Idempotent operations",
      slug: "idempotent-operations",
      outcome: "Explain how idempotency makes retries safe.",
      defaultSuccessCriterion: "Explain the key, duplicate request, and stored-result flow.",
      state: "READY",
    },
  })

  const goalSkill = await prisma.goalSkill.upsert({
    where: {
      goalId_skillNodeId: {
        goalId: goal.id,
        skillNodeId: skill.id,
      },
    },
    update: {},
    create: {
      id: "local-demo-goal-skill",
      userId: user.id,
      goalId: goal.id,
      skillNodeId: skill.id,
      requirement: "REQUIRED",
      lifecycle: "DRAFT",
    },
  })

  const supportingSkills = [
    {
      id: "local-demo-backoff-skill",
      goalSkillId: "local-demo-backoff-goal-skill",
      scopeId: "local-demo-backoff-scope-v1",
      readinessId: "local-demo-backoff-readiness",
      slug: "backoff-and-jitter",
      title: "Backoff & jitter",
      outcome: "Choose retry timing that avoids synchronized load spikes.",
      successCriterion: "Explain exponential backoff, jitter, and retry limits.",
      stage: "LEARNING",
      confidence: "MEDIUM",
      sortOrder: 1,
    },
    {
      id: "local-demo-cache-skill",
      goalSkillId: "local-demo-cache-goal-skill",
      scopeId: "local-demo-cache-scope-v1",
      readinessId: "local-demo-cache-readiness",
      slug: "http-caching",
      title: "HTTP caching",
      outcome: "Use validators and cache policy without serving incorrect data.",
      successCriterion: "Distinguish freshness, validation, and invalidation.",
      stage: "DEMONSTRATED",
      confidence: "MEDIUM",
      sortOrder: 2,
    },
    {
      id: "local-demo-queue-skill",
      goalSkillId: "local-demo-queue-goal-skill",
      scopeId: "local-demo-queue-scope-v1",
      readinessId: "local-demo-queue-readiness",
      slug: "queue-delivery",
      title: "Queue delivery",
      outcome: "Reason about duplicate and out-of-order message delivery.",
      successCriterion: "Compare at-most-once and at-least-once delivery.",
      stage: "UNASSESSED",
      confidence: "LOW",
      sortOrder: 3,
    },
  ]

  for (const fixture of supportingSkills) {
    const supportingNode = await prisma.skillNode.upsert({
      where: {
        graphId_slug: {
          graphId: graph.id,
          slug: fixture.slug,
        },
      },
      update: {
        parentId: null,
        title: fixture.title,
        outcome: fixture.outcome,
        defaultSuccessCriterion: fixture.successCriterion,
        sortOrder: fixture.sortOrder,
      },
      create: {
        id: fixture.id,
        graphId: graph.id,
        parentId: null,
        kind: "SKILL",
        title: fixture.title,
        slug: fixture.slug,
        outcome: fixture.outcome,
        defaultSuccessCriterion: fixture.successCriterion,
        state: "READY",
        sortOrder: fixture.sortOrder,
      },
    })

    const supportingGoalSkill = await prisma.goalSkill.upsert({
      where: {
        goalId_skillNodeId: {
          goalId: goal.id,
          skillNodeId: supportingNode.id,
        },
      },
      update: {},
      create: {
        id: fixture.goalSkillId,
        userId: user.id,
        goalId: goal.id,
        skillNodeId: supportingNode.id,
        requirement: "REQUIRED",
        lifecycle: "DRAFT",
      },
    })

    const supportingScope = await prisma.goalSkillScopeVersion.upsert({
      where: {
        goalSkillId_version: {
          goalSkillId: supportingGoalSkill.id,
          version: 1,
        },
      },
      update: {
        outcome: fixture.outcome,
        successCriterion: fixture.successCriterion,
      },
      create: {
        id: fixture.scopeId,
        goalSkillId: supportingGoalSkill.id,
        version: 1,
        outcome: fixture.outcome,
        successCriterion: fixture.successCriterion,
      },
    })

    await prisma.goalSkillReadiness.upsert({
      where: {
        goalSkillId_scopeVersionId_ruleVersion: {
          goalSkillId: supportingGoalSkill.id,
          scopeVersionId: supportingScope.id,
          ruleVersion: "mastery-v1",
        },
      },
      update: {
        stage: fixture.stage,
        confidence: fixture.confidence,
      },
      create: {
        id: fixture.readinessId,
        goalSkillId: supportingGoalSkill.id,
        scopeVersionId: supportingScope.id,
        ruleVersion: "mastery-v1",
        stage: fixture.stage,
        confidence: fixture.confidence,
        scopeCoverage: fixture.stage === "UNASSESSED" ? 0 : 1,
        completedSessions: fixture.stage === "UNASSESSED" ? 0 : 2,
        distinctReviewDays: fixture.stage === "DEMONSTRATED" ? 2 : 1,
        explanationJson: JSON.stringify({
          summary:
            fixture.stage === "UNASSESSED"
              ? "No reviews yet."
              : "Local demo evidence for visual testing.",
          reasons: fixture.stage === "UNASSESSED" ? ["NO_EVIDENCE"] : [],
        }),
      },
    })

    await prisma.goalSkill.update({
      where: { id: supportingGoalSkill.id },
      data: {
        currentScopeVersionId: supportingScope.id,
        lifecycle: "ACTIVE",
      },
    })
  }

  await prisma.skillRelationship.upsert({
    where: {
      graphId_kind_sourceSkillNodeId_targetSkillNodeId: {
        graphId: graph.id,
        kind: "RELATED",
        sourceSkillNodeId: "local-demo-backoff-skill",
        targetSkillNodeId: skill.id,
      },
    },
    update: {
      origin: "USER",
      status: "CONFIRMED",
      confidence: null,
      rationale: null,
    },
    create: {
      id: "local-demo-backoff-idempotency-relationship",
      userId: user.id,
      graphId: graph.id,
      sourceSkillNodeId: "local-demo-backoff-skill",
      targetSkillNodeId: skill.id,
      kind: "RELATED",
      origin: "USER",
      status: "CONFIRMED",
    },
  })

  const scope = await prisma.goalSkillScopeVersion.upsert({
    where: {
      goalSkillId_version: {
        goalSkillId: goalSkill.id,
        version: 1,
      },
    },
    update: {},
    create: {
      id: "local-demo-scope-v1",
      goalSkillId: goalSkill.id,
      version: 1,
      outcome: "Explain how idempotency makes retries safe.",
      successCriterion: "Explain the key, duplicate request, and stored-result flow.",
    },
  })

  const concept = await prisma.concept.upsert({
    where: {
      skillNodeId_canonicalKey: {
        skillNodeId: skill.id,
        canonicalKey: "idempotent-operations",
      },
    },
    update: {},
    create: {
      id: "local-demo-concept",
      skillNodeId: skill.id,
      canonicalKey: "idempotent-operations",
      state: "ACTIVE",
      origin: "MANUAL",
    },
  })

  const conceptVersion = await prisma.conceptVersion.upsert({
    where: {
      conceptId_revision: {
        conceptId: concept.id,
        revision: 1,
      },
    },
    update: {},
    create: {
      id: "local-demo-concept-v1",
      conceptId: concept.id,
      revision: 1,
      title: "Idempotent operations",
      definition: "A repeated request produces the same externally visible result.",
      createdById: user.id,
    },
  })

  await prisma.concept.update({
    where: { id: concept.id },
    data: { currentVersionId: conceptVersion.id },
  })
  await prisma.goalSkillScopeConcept.upsert({
    where: {
      scopeVersionId_conceptVersionId: {
        scopeVersionId: scope.id,
        conceptVersionId: conceptVersion.id,
      },
    },
    update: {},
    create: {
      id: "local-demo-scope-concept",
      scopeVersionId: scope.id,
      conceptVersionId: conceptVersion.id,
      requirement: "REQUIRED",
      weight: 1,
    },
  })

  const question = await prisma.question.upsert({
    where: { id: "local-demo-question" },
    update: {},
    create: {
      id: "local-demo-question",
      userId: user.id,
      skillNodeId: skill.id,
      state: "ACTIVE",
      origin: "MANUAL",
      type: "FREE_RECALL",
      schedulingEligible: true,
    },
  })

  const revision = await prisma.questionRevision.upsert({
    where: {
      questionId_revision: {
        questionId: question.id,
        revision: 1,
      },
    },
    update: {},
    create: {
      id: "local-demo-question-v1",
      questionId: question.id,
      revision: 1,
      prompt: "How does an idempotency key make an API retry safe?",
      referenceAnswer:
        "The server stores the first result under a client-supplied unique key. Repeating the same operation with that key returns the stored result instead of performing the side effect again.",
      createdById: user.id,
    },
  })

  await prisma.question.update({
    where: { id: question.id },
    data: { currentRevisionId: revision.id },
  })
  await prisma.questionRevisionConcept.upsert({
    where: {
      questionRevisionId_conceptVersionId: {
        questionRevisionId: revision.id,
        conceptVersionId: conceptVersion.id,
      },
    },
    update: { isPrimary: true },
    create: {
      id: "local-demo-question-concept",
      questionRevisionId: revision.id,
      conceptVersionId: conceptVersion.id,
      isPrimary: true,
    },
  })
  await prisma.goalQuestion.upsert({
    where: {
      goalId_questionId: {
        goalId: goal.id,
        questionId: question.id,
      },
    },
    update: {},
    create: {
      id: "local-demo-goal-question",
      goalId: goal.id,
      questionId: question.id,
      status: "ACTIVE",
    },
  })
  await prisma.reviewSchedule.upsert({
    where: {
      userId_questionId: {
        userId: user.id,
        questionId: question.id,
      },
    },
    update: {},
    create: {
      id: "local-demo-schedule",
      userId: user.id,
      questionId: question.id,
      questionRevisionId: revision.id,
      dueAt: new Date("2026-01-01T12:00:00.000Z"),
    },
  })
  await prisma.goalSkillReadiness.upsert({
    where: {
      goalSkillId_scopeVersionId_ruleVersion: {
        goalSkillId: goalSkill.id,
        scopeVersionId: scope.id,
        ruleVersion: "mastery-v1",
      },
    },
    update: {},
    create: {
      id: "local-demo-readiness",
      goalSkillId: goalSkill.id,
      scopeVersionId: scope.id,
      ruleVersion: "mastery-v1",
      stage: "UNASSESSED",
      confidence: "LOW",
      scopeCoverage: 1,
      earliestDueAt: new Date("2026-01-01T12:00:00.000Z"),
      explanationJson: JSON.stringify({
        summary: "No reviews yet.",
        reasons: ["NO_EVIDENCE"],
      }),
    },
  })
  await prisma.goalSkill.update({
    where: { id: goalSkill.id },
    data: {
      currentScopeVersionId: scope.id,
      lifecycle: "ACTIVE",
    },
  })

  console.log("Local demo data is ready:")
  console.log(`  Email: ${demoEmail}`)
  console.log(`  Password: ${demoPassword}`)
} finally {
  await prisma.$disconnect()
}

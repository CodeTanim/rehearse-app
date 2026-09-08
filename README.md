# Rehearse

Rehearse is a portfolio prototype for evidence-backed learning. A learner picks any topic, adds trusted sources, practices generated quizzes and recalls, repairs missed ideas, and sees when the evidence supports calling that Skill Leaf **Well learned for its current scope**.

The complete source-first loop now works in the local prototype. Skill Leaves begin as independent nodes; learners may connect them into their own trees without manually classifying every topic.

[Try the live portfolio demo](https://rehearse-app-smoky.vercel.app)

The hosted Vercel build is a stateless walkthrough with synthetic data. It demonstrates recall, self-grading, an explained **Well learned** state, review scheduling, and the Skill Tree without exposing accounts, uploads, APIs, or persistent storage. Inputs reset on refresh.

## Safety status

Use synthetic data only in the local full-app prototype.

The full authenticated prototype still relies on local SQLite and filesystem storage, and its Phase 0 privacy, recovery, and deployment hardening is in progress. Do not upload real, private, regulated, or otherwise sensitive learning material. Do not deploy the authenticated mode as a production service until the planned managed persistence and security work lands. The public demo intentionally disables those surfaces.

See [plan.md](./plan.md) for the reviewed product, security, accessibility, and engineering overhaul specification.

## Product status

| Status | Capability |
|---|---|
| Live on Vercel | Stateless synthetic recall-to-Skill-Tree walkthrough |
| Implemented in the local prototype | Account registration and sign-in |
| Implemented in the local prototype | Topic-only creation of an independent Skill Leaf with no category decision |
| Implemented in the local prototype | Public website, PDF, pasted-text, and authored-note Sources with immutable versions |
| Implemented in the local prototype | Source-grounded mixed quiz packs with citations and withheld new-angle questions |
| Implemented in the local prototype | Cited **Strengthen this** repair after a miss, with a scaffold that cannot raise mastery |
| Implemented in the local prototype | Durable recall drafts, objective MCQ grading, short-response self-rating, attempts, and scheduling |
| Implemented in the local prototype | Account-owned initial-quiz autosave/resume, save status, and final-submission recovery |
| Implemented in the local prototype | Skill overviews and all-skill Progress independent of today's recommendation |
| Implemented in the local prototype | Evidence-derived Unassessed, Learning, Demonstrated, and Well learned policy |
| Implemented in the local prototype | User-wide Constellation Garden with independent leaves and learner-created Related/Prerequisite lines |
| Implemented in the local prototype | Desktop pan/zoom/reset, scrollable mobile skill list, and selected-skill connection context |
| Implemented in the local prototype | Account-saved node placement, Fit all, title search, drawn/click/tap connections, and undo for the latest connection removal |
| Implemented in the local prototype | Soft white-and-green botanical UI with Today, Tree, and Progress navigation |
| Implemented foundation | Strict Vercel AI SDK boundary, citation validation, competency coverage, and hidden transfer probes |
| Legacy local capability | Skill-folder creation and organization |
| Legacy local capability | Basic note and local-file workflows |
| In progress | Phase 0 security, privacy, build, and accessibility baseline |
| Planned next | Managed production database/object storage and provider-backed generation evaluation |
| Planned | State filters, explicit Map/List switching, connection editing, and large-map performance validation |
| Future opt-in | Generate related Skill Trees as previewed, reversible groupings over existing leaves |
| Deferred | Collaboration, public maps, advanced graph overlays, native mobile, offline-first support, and gamification |

The local generator is deliberately deterministic so the full flow can be tested without sending source text to an external model. Provider-backed AI generation, production persistence, reminders, a public user-data product, PWA support, and formal WCAG conformance are not yet shipped.

## Current technology

- Next.js App Router, React, and TypeScript
- Tailwind CSS 4 with a small source-owned botanical component system
- Radix primitives for accessible dialogs, confirmations, and tabs
- Vercel AI SDK with an explicit AI Gateway model boundary for structured learning packs
- Auth.js credentials authentication
- Prisma with an isolated local SQLite database
- Local filesystem uploads for development only

The target architecture in `plan.md` replaces the local database and uploads with managed PostgreSQL, private object storage, durable jobs, isolated ingestion workers, and evidence-derived projections.

The soft white-and-green Constellation Garden system is documented in [docs/design-system.md](./docs/design-system.md). Rehearse keeps the existing accessible primitives while giving the product an organic leaf-and-constellation identity.

## Local development

Requirements:

- Node.js 24
- npm 11

Install the locked dependencies:

```bash
npm ci
```

Start an isolated local environment:

```bash
npm run dev:local
```

This command generates a local auth secret, prepares `prisma/dev.local.db`, applies migrations, idempotently seeds a synthetic Skill Garden plus legacy library fixtures, prints the demo credentials, and starts the development server. The generated database, secret, and uploads are local runtime artifacts and must remain untracked.

Authentication throttles, bounded upload admission, upload-quota arbitration, and filesystem mutation locking are intentionally process-local safeguards for this single-process development build. They are not substitutes for the durable, shared controls specified for production in `plan.md`.

To rerun only the idempotent local seed:

```bash
npm run db:local:seed
```

To remove only the isolated local database, recreate it, and seed fresh demo data:

```bash
npm run db:local:reset
```

### Demo mastery states

The synthetic demo account can be moved through the real scheduling and
mastery policies without waiting several weeks between reviews. Run one
command, then refresh `/today` while signed in as `demo@rehearse.local`:

```bash
npm run demo:state -- well-learned
npm run demo:state -- refresh-due
npm run demo:state -- lapse
```

Each command replaces only the demo goal's practice history. It creates real
completed sessions, attempts, evidence, and schedule transitions, recomputes
readiness with `mastery-v1`, and stops if the result does not match the named
state. `refresh-due` retains Well learned mastery while making its review
overdue; `lapse` records an Again rating, resets the interval to ten minutes,
and recomputes the leaf as Learning. Use `npm run db:local:reset` to return to
the initial Unassessed demo.

Local setup also runs a non-destructive migration preflight. If a legacy database contains duplicate file names within one folder, setup stops with a repair message instead of letting the unique-index migration fail opaquely or discarding either record.

Use `npm run db:local:setup` when the database should be prepared without seeding or starting the development server.

For a separately managed environment, copy `.env.example`, provide the documented values, and use the reviewed database workflow for that environment. The current Prisma schema remains SQLite-backed until the planned PostgreSQL migration lands.

## Verification

```bash
npm run lint:strict
npm run typecheck
npm run test
npm run build
```

Run the complete non-browser gate with:

```bash
npm run check
```

End-to-end browser coverage is available through:

```bash
npm run test:e2e
```

The browser suite starts Rehearse on dedicated port 3107 and will not silently
reuse an unrelated local server.

## Product principles

- Start with the learner's topic, then ask for sources.
- Treat a skill leaf as something the learner can demonstrate.
- Keep source evidence separate from mastery evidence.
- Never increase mastery because content was uploaded, read, or generated.
- Require explicit consent before selected source snapshots enter generation.
- Turn every valid miss into one cited, concrete repair action.
- Let only later unassisted recall—not guided repair—resolve a learning gap.
- Make learning-state claims explainable, scoped, and reversible.
- Keep manual authoring usable without AI.
- Treat private learning material as private by default.
- Make the accessible outline a first-class counterpart to the visual tree.

## Contributing

This repository is in a safety and architecture transition. Before proposing feature work, read `plan.md` and keep public documentation explicit about what is Implemented, Planned, and Deferred.

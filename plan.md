# Rehearse Product and Engineering Overhaul Plan

| Field | Value |
|---|---|
| Status | Active implementation; source-first learning, cited remediation, recall, and the Constellation Garden ship locally |
| Last updated | 2026-09-07 |
| Repository | rehearse-app |
| Release target | Robust portfolio MVP |

## 1. Executive decision

### Skill workspace checkpoint — 2026-09-08

- [x] Desktop drag and Alt + arrow movement save account-owned coordinates with version checks. Conflicts/unavailable skills are not overwritten; failed saves revert the preview and offer recovery.
- [x] Fit all computes the bounds of the skill nodes inside a fixed-height desktop viewport. Search selects and reveals a named skill; keyboard exploration also reveals the focused skill.
- [x] A selected-node handle supports drawing a line to another skill. Connect → target selection supports keyboard/tap, title search, Related/Prerequisite choice, cancellation, and the native form fallback.
- [x] Removing a connection exposes errors and an Undo removal action until dismissed, replaced by another removal, or the page is left. Restoration reuses ownership, duplicate, and prerequisite-cycle validation; evidence is unchanged.
- [x] Mobile remains a normal scrolling list; map gestures and connection handles are desktop-only, while search and tap/form connections remain available.
- [ ] Explicit Map/List toggle, state filters, connection type/direction editing, and live 50-node performance/screen-reader validation remain future work. Fit geometry has 1/10/50-node unit coverage, not a performance certification.

No new dependencies or framework changes. The additive
`20260908000000_skill_map_positions` migration stores positions on SkillNode,
separately from mastery and scheduling data. Automatic related-tree generation
remains deferred and never runs when nodes move or connect.

### Latest implementation checkpoint — 2026-09-07

The first UX-correctness slice is implemented locally. The detailed findings and
verification record are in [the experience review](docs/ux-review-2026-09-07.md).

- [x] Account-owned initial-quiz drafts restore answers, position, feedback, and final-save retry state; show saving/errors and protect unsaved navigation.
- [x] Progress shows all skills independently of today's repair/review recommendation.
- [x] An explicit skill review opens that skill or explains a conflicting active recall.
- [x] Mobile skill lists and Connect remain reachable at 320px and 390px; desktop reset is enabled whenever the viewport is transformed, including one-leaf maps.
- [x] Connect preserves the selected source leaf; Open skill opens a dedicated overview.
- [x] Unit tests, strict lint, type checking, production build, and targeted live browser checks pass.
- [ ] Run expanded automated browser coverage and verify real session expiry, offline recovery, one-node recovery, and 50-node discovery live.

This checkpoint does not complete production readiness or the remaining map, source
management, accessibility, and learning-quality release gates below. No framework
or dependency change was needed; quiz drafts use an additive Prisma migration.

Rehearse will become a source-grounded learning product that lets a learner choose
anything they want to learn, turns their own material into a cited quiz and recall
system, gives every topic its own Skill Leaf, and tells the learner when the evidence
supports calling it **Well learned**. Skill Leaves begin as independent nodes. The
learner can connect them when a relationship is meaningful to them.

The product is not primarily a file manager, note application, generic flashcard generator, or decorative knowledge graph.

The core loop is:

Choose a topic → Add sources → Generate a cited learning pack → Take the initial
quiz → Repair missed competencies → Complete scheduled recall → Update evidence state
→ See the Skill Map → Connect related Skill Leaves when useful → Maintain Well learned skills

The default product path is source-first. Immediately after creating a Skill Leaf,
the learner is prompted to add one or more public website URLs, PDFs, pasted text,
or authored notes. Rehearse uses those sources to create the learning scope and the
first mixed quiz. A Skill Leaf may be saved without a source as an incomplete Draft,
but generated learning and recall cannot begin until at least one usable source is
available. Manual question authoring remains an advanced fallback and a development
seam; it is not the primary onboarding experience.

The learner supplies the topic and the evidence they want to learn from. Rehearse is
responsible for decomposing the topic into assessable competencies and may retain
semantic classification metadata for search and future organization. In the MVP it
does not silently place the Skill Leaf inside a branch or create relationship lines.
The learner may connect nodes manually, but never needs to define a category or
taxonomy before learning can begin.

The product should use two related terms:

- **Skill Map:** the default canvas of independent Skill Leaves and any relationships
  the learner has deliberately created.
- **Skill Tree:** an individual connected structure within that map. In the MVP a
  tree is created through learner connections; a future opt-in action may propose
  multiple trees of related Skill Leaves.

The underlying model remains a graph because real skills can have prerequisites and
related capabilities. The default projection is a spacious constellation of separate
Skill Leaves; only learner-created Related and Prerequisite connections are shown in
the MVP. Automatic grouping is reserved for a future explicit “Generate related
trees” action. That action must preview proposed trees before changing the map and
must never merge learning evidence, sources, or Skill Leaves.

## 2. Product positioning

### Primary user

The initial target is a self-directed learner who has a topic and some material but
does not want to build a curriculum, question bank, review schedule, or taxonomy by
hand. The topic may be as specific as Hashmaps or as broad as interview data
structures. A deadline, exam, or formal Learning Goal is useful context but optional.

### Job to be done

When I decide to learn something, help me turn the sources I trust into an effective
quiz and recall routine, show me exactly what I missed and how to fix it, organize the
skill alongside what I already know, and tell me when I have learned it well enough
to move into maintenance.

### Core promise

Rehearse turns a topic plus trusted sources into cited practice, targeted recovery,
and an evidence-backed constellation of Skill Leaves the learner may connect into
their own Skill Trees.

### Product principles

1. Start with “What do you want to learn?”, not a folder or taxonomy form.
2. Accept the learner's natural topic label; derive assessable competencies behind it.
3. Prompt for sources before generating learning material or recall.
4. Source evidence and mastery evidence are separate.
5. Uploading, reading, generation, retries, or time elapsed never increases mastery.
6. AI output is source-grounded, versioned, inspectable, editable, and reportable.
7. High-confidence validated output may become Ready without a review bottleneck;
   low-confidence or unsupported output stays Draft and asks for one focused decision.
8. Skill Leaves are independent by default. Manual connections are optional and never
   required to start learning; system organization is a future opt-in operation.
9. Every missed answer produces a concrete learning action, not only a lower score.
10. Novel recall questions test transfer fairly; they never use deception or untaught trivia.
11. Every screen presents one obvious next action and hides secondary detail until needed.
12. Mastery is explainable, scoped, reversible, and never presented as permanent.
13. Relationships inform organization and recommendations but never transfer mastery.
14. Private learning material is private by default.
15. The accessible list is a first-class experience, including graph connections.
16. Marketing and documentation describe only behavior that actually ships.
17. Citations prove grounding in the learner's sources, not universal truth; the product
    never labels generated material “fact-checked” merely because it has a citation.
18. The interface is calm and minimal in information density, but visually ownable:
    a constellation layout, organic Skill Leaves, an airy white-and-mist-green field,
    sage, eucalyptus, and deep botanical text. Progressive disclosure prevents the
    distinctive visual system from becoming clutter.

## 3. Product terminology

| Term | Definition | Practiced directly? | Receives mastery? |
|---|---|---:|---:|
| Learning Goal | Optional context, deadline, and practice target used to group or prioritize existing Skill Leaves | No | No |
| Skill Map | The user's canonical canvas of independent and manually connected Skill Leaves | No | No |
| Skill Tree | A connected structure of Skill Leaves; learner-created in the MVP and optionally system-proposed in a future release | No | No |
| Branch | A generated organizational node used only by the future opt-in tree-generation feature | No | No |
| Skill Leaf | A learner-named topic bubble such as Hashmaps, with a versioned assessable scope | Through its competencies | Receives aggregate state |
| Competency | A specific demonstrable outcome derived within a Skill Leaf | Through questions | Receives direct evidence |
| Relationship | A learner-created Related or Prerequisite connection between two Skill Leaves | No | No |
| Source | A PDF, text source (pasted or authored note), or public website URL | No | No |
| Source Version | An immutable snapshot used to preserve extraction and citations | No | No |
| Learning Pack | A versioned, source-grounded scope, quiz bank, explanations, citations, and reserved transfer probes for one Skill Leaf | No | No |
| Question | A multiple-choice or short-response item with answer/rubric, explanation, role, and citations | Yes | Produces evidence when qualifying |
| Transfer Probe | A source-grounded unseen question that applies a learned competency in a new example or framing | Yes | Produces transfer evidence |
| Repair Step | A cited explanation, example, and focused check created for a missed or partial answer | Through its check | Retry itself is non-qualifying |
| Attempt | A submitted and graded response to a Question Revision | N/A | Produces evidence when qualifying |
| Review State | The scheduling state for a question | N/A | No |
| Mastery Evidence | Append-only evidence derived from attempts | N/A | Input to projection |
| Skill Scope Version | The immutable success criterion and required-competency set for one skill | No | Defines readiness scope |
| Skill Evidence Projection | A rebuildable summary of evidence across the Skill Leaf's current competencies | N/A | Display only |
| Skill Readiness | A rebuildable explanation of the Skill Leaf's stage for its current scope version | N/A | Display only |

### Valid skill leaves and scopes

The creation field accepts ordinary topic language. “Hashmaps”, “Arrays”, “React
hooks”, and “IAM” are valid Skill Leaf titles. Rehearse must not ask the learner to
rewrite those labels into instructional-design language.

The system converts each title plus its selected sources into a bounded Skill Scope:

- Hashmaps → explain key/value lookup, choose an appropriate hash map, reason about
  collisions, and analyze typical operation costs.
- React hooks → distinguish state, memoization, event logic, and synchronization,
  scoped to the supplied sources.

Each Active Skill Leaf requires:

- The learner's title and optional intent.
- At least one successfully processed Source Version.
- An independent node position in the Skill Map; no Branch or relationship is required.
- An immutable current Skill Scope Version with one or more required Competencies.
- One Active Learning Pack with full required-Competency coverage and at least one
  active multiple-choice plus one active short-response Question.
- A lifecycle state independent from evidence stage.

A topic that is too broad for a trustworthy pack is not rejected. The system offers
two or three narrower scopes in one compact clarification step and saves the original
topic as Draft until one is chosen.

## 4. Skill Map and Skill Tree model

### Canonical structure

- Each user owns one canonical Skill Map.
- Each Skill Leaf keeps the natural label the learner chose; its assessable
  Competencies live in a versioned scope rather than becoming extra tree clutter.
- Skill Leaves have no required containment parent in the MVP. New leaves are placed
  independently on the canvas and remain separate until the learner connects them.
- Semantic labels or embeddings may be calculated in the background for search and
  future organization, but they do not create visible branches or edges in the MVP.
- A low-confidence semantic classification never blocks setup and does not ask the
  learner to choose a category.
- Learning Goals may select leaves and add context, but a learner can create, schedule,
  and master a Skill Leaf without any Goal record.
- Related and Prerequisite relationships are stored separately from containment.
- The learner creates, changes, and removes Related and Prerequisite relationships.
- A Skill Leaf stays canonical regardless of how many manual relationships it has;
  no connection duplicates its source material, practice history, or mastery evidence.
- Future generated trees are saved as reversible layout/grouping proposals over the
  same canonical Skill Leaves, never as duplicate nodes.

### Relationship types

| Type | Direction | Meaning | MVP behavior |
|---|---|---|---|
| Prerequisite | Directed arrow | Understanding one skill supports learning the other | Created by the learner and shown as a solid directed line |
| Related | Undirected line | Similar or adjacent skill set | Created by the learner and shown as a solid line |
| Generated grouping | Parent-child proposal | Future system-created tree organization | Deferred; previewed only after an explicit user request |

Rules:

- Prerequisite relationships must be acyclic.
- Self-relationships and duplicates are rejected.
- Related endpoints are normalized so A–B and B–A cannot both exist.
- Relationship performance never transfers mastery to another skill.
- A learner-created connection is solid immediately and records User origin.
- The learner can change the type or direction and remove any learner-created
  relationship.
- The MVP relationship vocabulary is deliberately limited to Related and Prerequisite.
- Visual density is bounded by drawing the selected node's connections first and
  offering a secondary Show all connections control.
- No system-generated relationship, branch, or rearrangement appears automatically in
  the MVP.

### How learner-created connections work

Example: the learner adds Hashmaps, then later adds Arrays.

1. Rehearse creates two separate Skill Leaves on the learner's canvas.
2. Neither node is grouped or connected automatically.
3. The learner may draw a Related line, make Arrays a Prerequisite for Hashmaps, or
   leave both nodes independent.
4. The connection is solid immediately and can be edited or removed later.
5. In a future release, the learner may invoke Generate related trees. Rehearse may
   then propose a Data Structures tree containing both leaves, but nothing changes
   until the learner previews and accepts the proposal.

Desktop pointer interaction uses visible node handles: drag from one handle to a
second leaf, then choose Related or Prerequisite and direction. Keyboard and mobile
use Connect skill, select the second leaf, then choose the type/direction. No graph
operation may be drag-only. Selecting a line exposes its type, direction, Edit, and
Remove actions.

### Visual semantics

Do not overload a single color with every meaning.

- Inner categorical fill or pattern and text label: evidence stage.
- Badge or inner ring: review urgency.
- Evidence icon and text: confidence.
- Independent outer halo: keyboard focus.
- Independent selection marker: the node shown in the inspector.
- Solid line plus type label or arrow: learner-created relationship.
- A dashed preview line is reserved for an uncommitted future tree-generation preview;
  it is never displayed as an unsolicited suggestion.
- Error, processing, draft, and archived states use their own icon and explicit text.
- A future generated-tree summary may show demonstrated leaves and leaves due as counts.
- Node sizes remain stable; weaker skills must not appear less important or become smaller targets.
- State is always readable without color.

### Learning state

Content lifecycle and learning state must remain independent.

Skill content lifecycle:

- Draft
- Ready
- Active
- Archived

Evidence stage:

- Unassessed
- Learning
- Demonstrated
- Well learned

Due state:

- Current
- Due
- Overdue

Evidence confidence:

- Low
- Medium
- High

**Refresh due** is a display label for a Well learned skill whose due state is Due or Overdue. Time alone changes urgency; it does not erase demonstrated evidence. A qualifying lapse or a new scope version may demote the evidence stage under the versioned policy.

State precedence:

1. Archived nodes are excluded from the live tree and available only through an Archived filter.
2. Draft nodes appear only in setup or the pack inspector and never look like weak Active skills.
3. Blocking processing errors replace learning-state actions and present Retry, Replace source, or Delete.
4. Processing and stale-projection labels supplement the last valid state rather than blanking it.
5. Due state, evidence confidence, selection, and keyboard focus remain independently visible.
6. Filters never silently hide the selected node; the UI explains the mismatch or clears selection predictably.

### Initial deterministic mastery policy

Policy v1 is a testable pilot hypothesis. It must be stored with every projection and may be changed only by creating a new policy version; historical attempts and prior scope projections are never rewritten.

Definitions:

- **Current scope:** the exact required Competency Versions, weights, and success
  criterion in the current immutable Skill Scope Version. An Active Skill Leaf must
  have at least one required Competency.
- **Scope coverage:** the percentage of required competencies covered by at least one
  Active core question. Optional competencies do not affect the denominator.
- **Qualifying attempt:** an Active core or transfer Question Revision presented in an
  initial quiz or scheduled recall and answered before feedback. Multiple choice is
  graded deterministically. Short response is compared with a visible rubric and the
  learner records Incorrect, Partial, or Meets in the MVP. A preview, skip, revealed scaffold, remediation check,
  repeated save, or ungraded response is not qualifying.
- **Answer outcome:** Incorrect, Partial, Meets, or Guessed. Incorrect, Partial, and
  Guessed create a gap. A correct multiple-choice answer may be changed from Meets to Guessed
  by the learner; a guessed answer never counts as transfer success.
- **Effort rating:** Hard, Good, or Easy, recorded only for a Meets answer. It controls
  scheduling within the successful path but cannot turn an incorrect, partial, or
  guessed answer into success.
- **Successful attempt:** an outcome of Meets. For Well learned, the latest qualifying
  outcome for every required Competency must be Meets with Good or Easy effort.
- **Transfer success:** a successful qualifying attempt on a valid Transfer Probe
  whose presentation count was zero when the session was assembled.
- **Review day:** a distinct calendar day in the learner's saved timezone.
- **Completed session:** a durable session containing at least one qualifying attempt.
- **Evidence performance index:** the weighted mean of Incorrect 0.00, Partial or
  Guessed 0.35, Meets/Hard 0.60, Meets/Good 0.85, and Meets/Easy 1.00. It combines
  objective multiple-choice results with learner-reported rubric outcomes and is never
  labelled objective accuracy or recall probability.
- **Daily evidence cap:** only the first qualifying attempt for a competency on a
  review day receives full readiness weight. Later same-day attempts remain in history
  and may update scheduling but cannot inflate readiness.
- **Baseline evidence:** initializes scheduling at 0.50 evidence weight and cannot by itself produce Demonstrated or Well learned.
- **Assisted evidence:** remediation views, worked examples, revealed answers, and
  scaffold checks receive zero readiness weight. Only a later unassisted recall can
  resolve the gap for mastery purposes.

Evidence confidence for policy v1:

- Low: fewer than three full-weight attempts or fewer than two review days.
- Medium: three to seven full-weight attempts across at least two review days.
- High: at least eight full-weight attempts across at least three review days and a span of at least 14 days.

A Skill Leaf may become **Demonstrated for its current scope version** when:

- Scope coverage is 100 percent.
- Every required competency has at least one successful qualifying attempt.
- It has at least three successful full-weight attempts across at least two review days.
- The latest qualifying attempt for every required competency has outcome Meets.

A Skill Leaf may become **Well learned for its current scope version** when:

- Scope coverage is 100 percent.
- Every required competency has successful qualifying attempts on at least two distinct review days.
- Qualifying attempts span at least 14 days and three distinct review days.
- The latest qualifying attempt for every required competency is Meets with Good or Easy effort.
- The Evidence performance index across the last three completed sessions containing
  qualifying attempts for this Skill and current scope is at least 0.85.
- The median scheduled interval for Active questions covering required competencies is at least 21 days.
- Evidence confidence is High.
- At least two successful unseen Transfer Probes from distinct Question Families
  occurred in two distinct recall sessions on distinct review days. When at least two
  required Competencies have valid transfer inventory, those successes must cover at
  least two Competencies.
- No required competency has an unresolved qualifying lapse newer than its latest
  successful unassisted recall.

Becoming Due or Overdue does not demote Well learned. An Incorrect, Partial, or
Guessed qualifying outcome after Demonstrated or Well learned creates a lapse/gap and
recomputes the evidence stage under the same policy while preserving all history.

The UI says **Well learned** on the compact bubble. Its explanation says “Based on
your current scope and recall evidence,” shows the supporting coverage, spacing, and
transfer evidence, identifies self-assessed components, and never implies permanent
or universal expertise.

### Mastery evidence shown to users

The default node shows:

- Skill name.
- Evidence stage.
- Due state or next review.
- Low-evidence warning when appropriate.

The detail inspector shows:

- Successful reviews and total attempts.
- Distinct practice days and sessions.
- Recent outcomes.
- Required competency and question coverage.
- Successful unseen transfer probes.
- Open learning gaps and the recommended next action.
- Last practiced.
- Next review and current interval.
- Evidence confidence.
- Source coverage.
- Why the status changed.
- How the status is calculated.

Do not show a bare or fictional 0–100 percent mastery number. Policy v1 shows the
Evidence performance index with evidence confidence and coverage, and distinguishes
objective from learner-reported inputs. A future estimated recall probability requires
a separately validated model, clear labelling, and the same explanation context.

### Source and scope changes

- Adding a source never erases prior skill evidence.
- New competencies begin Unassessed and reduce scope coverage when marked required.
- Existing competencies retain their attempts and schedules.
- Removing a source retires unsupported generated questions and recalculates coverage.
- Changed URL content creates a new Source Version and a reviewable diff.
- Question edits retain, invalidate, or reset schedules according to an explicit version policy.
- Every recalculation produces a human-readable explanation.
- A material success-criterion or required-competency change creates a new Skill Scope
  Version. Historical projections remain tied to the scope that produced them.
- Normal source removal retires dependent generated items but retains immutable versions needed by historical attempts. Account/privacy hard deletion may remove raw content and must show a citation-unavailable tombstone afterward.

## 5. Refined core flows

### First-time flow

The onboarding promise is “bring a topic and the material you trust.” Goal, branch,
outcome, taxonomy, and success-criterion forms are not prerequisites.

1. **Choose something to learn**
   - One required field: “What do you want to learn?”
   - Optional one-line intent: “What do you want to be able to do?”
   - Primary CTA: Add sources.
   - Saving creates the Skill Leaf immediately in Needs sources state.
2. **Add sources**
   - Four compact choices: Website, PDF, Paste text, Write note.
   - Accept several sources and allow one source to support several Skill Leaves.
   - Optional focus selects pages, sections, or a guiding question.
   - At least one Source Version must be Ready before Generate quiz is enabled.
3. **Build the learning pack**
   - Before the first integrated run, show one concise disclosure and record consent
     for sending bounded private excerpts under the documented provider policy.
   - Ingest and snapshot the selected sources.
   - Derive a bounded assessment blueprint of required Competencies.
   - Derive optional semantic metadata without changing the visible Skill Map.
   - Generate cited multiple-choice and short-response core questions.
   - Generate and withhold valid Transfer Probes for later recall.
   - Show one resumable progress state: Reading sources → Building quiz → Quiz ready.
4. **Start the initial quiz**
   - A pack-level Start quiz action activates all valid questions in one step.
   - Item-level inspect, edit, exclude, regenerate, and report remain available but
     do not become a mandatory approval queue.
   - Unsupported, uncited, duplicate, or low-confidence questions stay out of practice.
5. **Repair misses**
   - After each Incorrect, Partial, Guessed, or disputed response, offer one compact
     Strengthen this action with the gap, explanation, exact citation, optional worked
     example, and one scaffold check.
   - Assisted repair does not increase mastery. A later unassisted recall is required.
6. **Finish and orient**
   - Show what was demonstrated, what needs work, and the next review date.
   - Reveal the Skill Leaf as an independent node in the Skill Map.
   - Ask about reminders only after this first value loop is complete.

Resumability requirements:

- Save every completed setup step durably.
- Browser Back or refresh never discards a Skill Leaf, source, generated pack, graph
  correction, answer, or repair state.
- Source processing continues after navigation.
- Today shows one Continue setup action with the current stage.
- An expired session returns the learner to the saved step after reauthentication.

Targets:

- Sample topic to completed quiz in under three minutes.
- Supported user source to first completed initial quiz in under five minutes,
  excluding explicitly reported third-party processing outages.
- A valid pack covers every required Competency and contains at least one question of
  each type. The normal target is at least six questions with at least two of each type.
  If narrow sources cannot support the minimum two-type pack, it stays Review and the
  primary action is Add another source or Narrow topic.
- The learner never has to choose a branch, connect a node, or approve every
  individual question before starting a high-confidence valid pack.

### Daily return flow

1. Return to Today.
2. See the due count, estimated time, and one Start recall or Resume action.
3. Complete a queue whose majority is familiar core questions or meaningful variants.
4. Receive zero to two unseen Transfer Probes under the deterministic composition rule.
5. Repair any misses with the same cited Strengthen this flow.
6. See the concise session result, evidence-state changes, and next return.
7. Optionally inspect the Skill Tree or evidence details.

Returning users land on Today, not the material library or tree editor.

Recall composition rules:

- Familiar questions remain the majority and Transfer Probes are capped at 25 percent.
- Select zero Transfer Probes for 1–3 familiar items, one for 4–7 familiar items, and
  two for 8 or more familiar items. The 25 percent final-queue cap still applies.
- A transfer item has zero prior presentations, assesses a required Competency in a
  new example or framing, contains enough context, and remains grounded in the same
  active Learning Pack and Source Version scope.
- The interface calls it New angle, not trick question.
- Transfer items are pre-generated and quality-checked asynchronously so recall never
  waits on a model call. If none is valid, the session proceeds without one.
- Once shown, a Transfer Probe becomes familiar and may later produce variants.
- Session records retain the selection reason, question role, family, novelty state,
  and composition for auditability.

### New source flow

1. Add or attach a user-owned source to one or more Skill Leaves.
2. Optionally state a guiding question or relevant pages/sections.
3. Process it as a new immutable Source Version.
4. Compare it with the active pack and show concise coverage changes.
5. Generate a new immutable Skill Scope and Learning Pack Version when needed.
6. Keep the existing pack active until the replacement is valid and accepted.
7. Refresh internal semantic metadata when needed, but never create, remove, or alter
   visible learner connections.
8. Preserve prior Attempts and explain any coverage or evidence-state change.

Thin or conflicting sources never cause the system to invent content. They produce a
coverage warning, identify the unsupported Competencies, and recommend Add another
source, narrow the topic, or exclude the unsupported scope.

### Skill Tree editing flow

- Viewing and connecting are separate modes so normal exploration stays calm.
- New Skill Leaves are independent and no dashed system suggestions appear in View mode.
- Connect mode exposes visible connection handles.
- Desktop users drag between handles, choose Related or Prerequisite, and set direction
  for a prerequisite. The committed learner edge is solid.
- Keyboard and mobile users choose Connect skill, select the second Skill Leaf, and
  choose relationship type/direction.
- Selecting a line exposes Change and Remove.
- Move, connect, change, and disconnect all have menu and keyboard alternatives.
- Every edit supports undo before persistence or a recoverable undo afterward.
- Cycle or invalid-edge errors explain how to recover.
- A future generated-tree proposal opens a preview with Apply and Cancel, preserves
  all existing manual connections, and offers Undo after application.

### Future opt-in generated trees

This capability is deliberately planned but not exposed as a disabled, fake, or
non-functional control in the MVP.

1. The learner chooses **Generate related trees** from the Skill Map.
2. Rehearse analyzes Skill titles, active scope, source-derived competencies, and
   existing learner-created relationships.
3. It proposes multiple separate trees or clusters where the evidence supports them;
   unrelated or low-confidence leaves remain independent.
4. A preview explains each proposed grouping and relationship in one sentence, marks
   every proposed addition distinctly, and changes no persisted state.
5. The learner may apply all, apply one tree, edit individual connections, or cancel.
6. Applying a proposal creates reversible layout/grouping records and confirmed
   system-origin edges while preserving all canonical Skill IDs, sources, packs,
   attempts, schedules, mastery evidence, and manual connections.
7. Undo restores the prior layout and removes only edges created by that generation run.

Future acceptance criteria:

- No generation starts without the explicit button action.
- No proposal is persisted before preview and confirmation.
- The system may generate several independent trees; it never forces all Skill Leaves
  into one hierarchy.
- A low-confidence or unrelated Skill Leaf stays separate and receives no invented edge.
- Manual connections take precedence and are never removed or redirected by generation.
- Generated trees are organizational views only; evidence and mastery never transfer
  across connected nodes.
- Every generated edge records its model/policy version, confidence, rationale, and
  generation run so it can be explained and undone.

### Practice state machine

Prompt → Submit answer → Feedback/rubric → Effort grade when needed → Durable save
→ Optional repair → Next item

- Multiple-choice answers are graded deterministically on the server.
- An incorrect multiple-choice answer records Incorrect and the scheduler's Again
  transition. A correct answer records Meets/Good by default, with compact Hard, Easy,
  or I guessed adjustments. I guessed records Guessed and cannot qualify as transfer
  success; the learner never declares an objectively incorrect option correct.
- Short responses lock the exact pre-feedback answer, reveal a rubric and cited model
  answer, then ask Missed, Partial, or Meets. Meets defaults to Good with compact Hard
  or Easy adjustment. Missed/Partial create a Learning Gap and cannot be converted to
  success by an effort rating.
- Optional AI semantic grading may be piloted later, but low confidence can never
  silently mark a learner wrong or change mastery.
- Rating controls are disabled until feedback for a short response.
- The exact pre-feedback answer becomes immutable evidence when grading completes.
- Refresh restores the exact state and never creates a duplicate Attempt.
- Skipped items remain due, create no lapse or Mastery Evidence, and return after unseen items unless the learner ends the session.
- Exit always offers Save and resume.
- Missed means the rubric was not met; Partial means only part was met; Meets means the
  required points were present. Hard, Good, and Easy describe effort only after Meets.
- Rating shortcuts never fire while the learner is typing and always have visible button equivalents.

### Missed-answer remediation

Every qualifying miss creates or updates an unresolved Learning Gap for the assessed
Competency and recommends exactly one next action:

1. Name the missed idea in one sentence.
2. Explain it in plain language from the active source scope.
3. Link to the exact source page, heading, or text locator.
4. Show one worked example when it materially clarifies the gap.
5. Ask one easier scaffold question with feedback.
6. Schedule a later unassisted retry and prioritize the gap in the next recall.

A scaffold or immediate retry is explicitly labelled practice and has zero mastery
weight. Reporting a flawed question suspends it from future queues while its prior
evidence remains Under review. An authorized Pending → Upheld/Invalid resolution keeps
or invalidates that evidence through an append-only event and audited projection/
schedule rebuild. The learner cannot erase a lapse by reporting it; history is never rewritten.

## 6. Information architecture and routes

### Public

- Landing
- Interactive sample
- Sign in
- Registration
- Password recovery
- Product status
- Privacy and security explanation

### Authenticated global navigation

- Today
- Tree
- Progress
- Account menu: Settings and Sign out

### Skill detail

- One state-led overview with the current state, evidence summary, and next action.
- Sources, Learning pack/questions, relationships, and History are secondary sections
  reached through one Details control or a deep link; they are not five equal-weight tabs.

### Proposed durable routes

These are the target canonical routes. The local transition currently uses
GoalSkill-backed `/skills/[goalSkillId]/sources`, `/quiz`, and
`/strengthen/[gapId]` routes.

- /
- /demo
- /auth/login
- /auth/register
- /auth/reset-password
- /auth/reset-password/[token]
- /today
- /skills
- /skills/new
- /skills/[skillId]
- /skills/[skillId]/sources
- /skills/[skillId]/pack
- /skills/[skillId]/quiz
- /sources/[sourceId]
- /practice/[sessionId]
- /skills/[skillId]/strengthen/[gapId]
- /progress
- /settings

Requirements:

- Tree in every desktop and mobile navigation opens /skills.
- With no Skill Leaves, /skills presents the single action Learn something.
- /skills/new starts with the topic field and never requires a branch or Learning Goal.
- Learning Goal UI is absent from onboarding and global navigation in this MVP; legacy
  goal routes redirect to the corresponding Skill or remain behind an internal flag.
- Refresh, back, forward, and deep links preserve selected skill context.
- Filters, selected node, viewport position, and generated-tree collapse state when
  that future feature exists are URL-backed or safely persisted.
- Authenticated routes enforce auth server-side before rendering.
- Missing or foreign resources use the same safe not-found behavior.
- A Skill detail route restores Needs sources, Processing, Pack ready, Learning, or
  Recall due setup state and exposes only the relevant next action.

## 7. UI and interaction specification

### Desktop Skill Tree

- A spacious constellation canvas presents every Skill Leaf as an independent node by
  default. The composition may feel organic, but node positions and connection paths
  must remain deterministic and stable between visits.
- Normal mode exposes the current Learn/Recall action plus Map/List, Search, Connect,
  and one More control group.
- Due, Overdue, Learning, Well learned, and Low evidence filters live in one Filter
  menu with an active-filter count.
- Fit, zoom, reset, and layout tools live inside More or one contextual map-tools
  popover.
- Enter or click selects a node and opens a persistent inspector.
- Primary inspector action follows state: Add sources, Continue setup, Start quiz,
  Recall, or Review evidence.
- The selected Skill Leaf's direct Related and Prerequisite edges are emphasized.
  A Show all connections toggle is secondary and guarded by a density limit.
- Learner-created edges are solid. Prerequisite direction remains visible without
  relying on color. Dashed lines occur only inside a future uncommitted generation preview.
- Connection handles appear only in Connect mode and have equivalent menu controls.
- No action exists only on hover.
- The DOM and keyboard order follow creation order or the active List sort rather than
  arbitrary screen coordinates.
- Up and Down move to the previous or next visible node.
- Left and Right move between spatially adjacent visible nodes when Map mode has focus.
- Home and End move to the first or last visible node.
- Type-ahead finds a visible node by label.
- Enter opens the inspector; Space selects the node.
- After move, archive, or deletion, focus moves to the next visible node and never disappears.
- The canvas uses an accessible labelled node list rather than false tree semantics.
  An adjacent labelled relationship list exposes every visible edge, type, direction,
  origin, and action accessibly.
- Switching Map and List preserves focus, selection, filters, and viewport context.

### Mobile Skill Tree

- An accessible vertical Skill Leaf list is the default.
- Leaves are sorted by next action, recent activity, or name; no generated categories
  are required.
- Each skill leaf is at least a 56px row with name, stage, and due badge.
- Selection opens a bottom sheet with evidence and actions.
- Sticky bottom action starts the due queue.
- Today, Tree, and Progress use compact mobile navigation; Settings and Sign out live
  in the account menu.
- Visual map mode is secondary and never required.
- Connect skill opens a searchable second-skill picker followed by the two relationship
  types and prerequisite direction; drawing or pinch gestures are never required.
- No feature requires landscape orientation, pinch gestures, or horizontal page scrolling.
- The bottom sheet is a labelled dialog with a focus trap, visible Close control, and focus restoration.
- Browser Back closes the sheet before leaving the tree route; swipe-to-close is optional.
- Sticky actions respect safe-area insets and never obscure the final row.
- Map and list selections remain synchronized.

### Today

- Show the due count, estimated time, and one dominant Start recall or Resume button.
- When setup is incomplete, replace that action with one Continue setup button.
- If nothing is due, show the next due time and one Learn something action.
- Skills close to Well learned, Refresh due items, files, sources, and question counts
  live behind one compact disclosure and are not competing dashboard cards.

### Practice

- One multiple-choice or short-response question at a time.
- Clear progress and resumability.
- Text progress such as “Question 3 of 10.”
- Answer, rubric, and citation are not visible before submission.
- Objective multiple-choice feedback is immediate after durable submission.
- Short response shows the cited rubric before Missed, Partial, or Meets; Hard/Good/Easy
  effort appears only after Meets.
- A previously unseen transfer question is labelled New angle without revealing why
  it is novel or exposing it before the due session.
- Misses show one Strengthen this action; explanation, citation, example, and scaffold
  appear progressively only after the learner chooses it.
- Keyboard shortcuts have visible alternatives.
- Save failure preserves the answer and retries safely.
- No mandatory time limit.
- Feedback moves focus to its heading or announces it without disorienting the learner.
- Correctness interpretation, schedule change, and save state are announced in text.
- Citation inspection never discards or changes the draft answer.
- Citation copy says “Grounded in your sources.” It never claims that a supplied source
  or generated answer has been independently fact-checked.
- No grade or outcome is communicated by color alone.

### Session summary

- Completed and skipped items.
- Skills strengthened.
- Skills lapsed or still weak.
- Gaps repaired and gaps scheduled for later retry.
- Familiar and New angle results shown separately without a gamified score dump.
- Evidence stage changes.
- Next scheduled review.
- Plain-language explanation of why each status changed.
- Review missed items and Done for today actions.

### Constellation Garden visual direction

The approved direction combines concept 3's spacious “Night Garden” constellation
composition with a softer, brighter “Organic Atlas” palette. Minimal means low copy,
clear hierarchy, and few controls—not a generic white dashboard. Rehearse should be
recognizable from the shape of its Skill Leaves, the rhythm of its connecting paths,
and its white/mist/sage/eucalyptus color system.

- Use a mist-green page field and crisp white work surfaces and navigation. Deep
  botanical ink is for readable text rather than large background fills. Sage is the
  main learning and action accent, eucalyptus is the secondary relationship accent,
  and pale sprout green marks learning or milestones. Soft coral remains reserved for
  urgency and errors.
- Skill nodes use a consistent seed/leaf silhouette or clipped organic capsule. They
  remain large, readable controls rather than decorative illustrations or game tokens.
- Use thin curved botanical/orbital connection paths. Related lines are undirected;
  Prerequisite lines have an explicit arrow and text equivalent.
- A very subtle paper grain or botanical line motif may create atmosphere on the Tree
  canvas, but it must not reduce contrast, compete with nodes, or spread into focused
  setup and practice screens.
- Prefer flat or lightly lifted surfaces, fine borders, soft controlled shadows, and
  stable geometry. Thick black outlines, hard offset shadows, tape, stamps, and
  neobrutalist decoration remain excluded.
- Use one primary content column for setup, quiz, remediation, and summaries. The Tree
  may use the wider canvas it needs, but its controls remain visually quiet.
- Replace dashboard card grids and nested cards with headings, whitespace, simple lists,
  and separators. Never place a card inside another card.
- Maintain one obvious filled primary action per screen. Secondary actions use text,
  subtle outline, an overflow menu, or progressive disclosure.
- Keep primary navigation to Today, Tree, and Progress. Settings and Sign out live in
  one account menu. Do not add a second persistent sidebar or duplicate navigation in
  page content.
- Default toolbars expose only controls needed for the current state. Search, filters,
  graph editing, and advanced evidence details open on demand rather than occupying a
  permanent control strip.
- Skill Tree leaves show the name plus at most two compact status markers;
  prefer one when urgency and evidence stage can be combined without ambiguity.
- Source counts, confidence detail, relationship controls,
  and evidence math appear only after selection or disclosure.
- Use concise labels and short state copy. Do not repeat onboarding education after the
  learner completes a step; help remains available through a contextual disclosure.
- Use Lucide as the single icon set and Radix primitives for dialog, alert-dialog,
  tooltip, menu, and sheet behavior. Icon-only actions require an accessible name and
  visible tooltip, but common primary actions retain text labels.
- Pair a crisp contemporary sans-serif for controls and body copy with a restrained
  editorial serif for the Rehearse wordmark, map labels, or selected Skill names.
  Load both through `next/font`; do not use remote CSS font imports.
- Keep typography to a small, consistent hierarchy and use spacing—not a grid of
  boxes—to establish grouping.
- Skill Leaves use one branded organic silhouette with stable hit areas. Avoid a
  collection of unrelated ornamental contours, stickers, or decorative badges.
- Meet WCAG contrast and focus requirements. Minimal must never mean invisible focus,
  ambiguous controls, or state communicated by color alone.
- Motion is restrained and functional: a short connection-draw transition, gentle
  selection halo, and optional Well learned bloom. Every state works with reduced
  motion and no animation ever interrupts the next action.

#### Visual signature acceptance criteria

- A screenshot of the Tree is distinguishable from a default shadcn/Tailwind dashboard
  without relying on the Rehearse wordmark.
- The default Tree shows separate Skill Leaves, not automatic category boxes, branch
  columns, or pre-connected clusters.
- The initial viewport contains no generic analytics-card grid and no persistent sidebar.
- White, mist, ink, sage, eucalyptus, sprout, and coral are implemented as named semantic tokens;
  no component hard-codes one-off brand colors.
- Every Skill Leaf remains readable at 200 percent zoom and exposes at least a 44 by
  44 CSS-pixel target; its state is understandable in monochrome.
- Decorative grain has no pointer behavior, is hidden from assistive technology, and
  passes reduced-transparency/high-contrast fallbacks.
- The Tree canvas, List view, inspector, setup, quiz, and Today screen feel like one
  product even though only the Tree receives the atmospheric background treatment.
- No generated concept image is copied literally where doing so would harm responsive
  behavior, accessibility, or truthful product state.

#### Density and disclosure rules

- Each route has one purpose, one primary surface, and one dominant next action.
- The initial viewport contains only the page title, current state/next action, and the
  essential task content. Use at most one short helper sentence when the label and state
  are not sufficient.
- Never repeat the same state in navigation, page heading, card, banner, and badge.
- Secondary metadata and actions use one predictable Details, More, or inspector
  disclosure rather than several competing cards or tabs.
- Progressive disclosure never hides the current task, blocking error, save state, due
  urgency, or next action.
- Completed onboarding guidance disappears after first use and remains available from
  contextual Help.
- Setup presents one step at a time: Topic → Sources → Generate. No parallel sidebar,
  preview card, or analytics surface competes with that step.
- Remediation presents Gap → Explanation → Scaffold → Later retry sequentially. The
  source excerpt begins collapsed under Source unless needed to understand the answer.
- Session summary leads with state change, next review, and Done. Per-question results
  stay inside Review details.

#### Clutter budgets

- Each primary screen has one filled primary button in the initial viewport.
- Today shows one status summary, one primary action, and at most one compact due list
  before any disclosure; it has no metric-card grid.
- Setup and Practice show one task at a time and no unrelated navigation actions inside
  the main content region.
- A default page uses no more than two bordered top-level surface regions; dialogs and
  the Tree canvas are exceptions, but nested bordered regions are still prohibited.
- The default Tree toolbar shows Map/List, search, Connect, and one More control;
  filters and zoom live behind Search or More until invoked.
- At 320 CSS pixels and 200 percent zoom, no content, action, or status requires
  horizontal page scrolling.

### Core state and recovery matrix

Every state preserves safe user input and context, names what happened in an accessible status message, and offers one primary recovery action.

| Area | State | Primary recovery |
|---|---|---|
| Onboarding | Needs sources | Add Website, PDF, pasted text, or note |
| Onboarding | Unsupported source | Paste the text or choose another source |
| Onboarding | Processing failure | Retry or replace the source without losing the leaf |
| Onboarding | Thin/conflicting source | Add a source, narrow scope, or exclude unsupported competencies |
| Onboarding | Partial generation | Start only if the valid subset covers every required competency and includes both types; otherwise repair |
| Onboarding | Zero valid questions | Add a better source or narrow the topic |
| Onboarding | Ambiguous semantic classification | Continue with an independent leaf; never block learning on organization |
| Onboarding | Expired session | Sign in and resume the saved setup step |
| Today | First use | Continue setup or try the sample |
| Today | All caught up | Show next due time or optional weak-skill practice |
| Today | Source processing | Continue other work and expose progress |
| Today | Partial fetch failure | Keep valid due work and retry the affected source |
| Tree | No skills | Learn something |
| Tree | No filter matches | Clear or edit filters |
| Tree | Loading or refresh | Keep the last valid tree visible |
| Tree | Stale projection | Show last computed state and retry calculation |
| Tree | Relationship-list failure | Keep independent nodes usable and retry relationships |
| Practice | Item load failure | Retry or skip without creating evidence |
| Practice | Answer-save failure | Preserve answer and retry the idempotent save |
| Practice | Citation unavailable | Keep the rubric visible and explain source removal |
| Practice | No valid transfer probe | Continue familiar recall without blocking the session |
| Practice | Reported flawed item | Suspend it, preserve the report, and rebuild affected projections |
| Practice | Missed answer | Offer one cited Strengthen this action and a later retry |
| Practice | Resumed session | Restore the exact prompt/answer/feedback/grade/repair state |
| Practice | Completed session | Show summary and next review |

Required edge-case fixtures:

- Overly broad or ambiguous topic: generate a bounded four-to-eight-Competency scope
  when support is adequate; otherwise ask one focused question and preserve the Draft.
- Duplicate or synonym topic: warn before creation or suggest a future merge flow, but
  never auto-merge nodes or evidence.
- Multi-category topic: keep one independent Skill Leaf; the learner may create any
  useful cross-domain relationships later.
- Failed/low-confidence semantic classification: keep the independent Skill Leaf with
  source and pack work intact.
- Learner connection followed by a new source: do not silently alter the connection.
- Unsupported, private, paywalled, or JavaScript-only URL: offer paste-text fallback.
- Empty, thin, or conflicting sources: show coverage gaps; do not invent claims.
- Partial generation: retain valid work but activate only a fully covered valid pack.
- No valid Transfer Probe: run familiar recall without blocking or synchronous generation.
- Changed/deleted source: keep historical versions and citations or an explicit
  citation-unavailable tombstone; mark dependent current pack stale.
- Reported flawed question: suspend future use and rebuild affected projections audibly.
- Prerequisite cycle, self-edge, duplicate edge, or cross-user endpoint: reject atomically
  with an accessible explanation.
- Accidental withheld-probe exposure: fail the response/serialization test and rotate the
  probe; it can no longer count as unseen.
- Interrupted mobile or keyboard connection: restore both endpoint selections and do not
  create a partial edge.

Loading requirements:

- Existing content remains visible during background refresh.
- Skeletons preserve the final layout and are static when reduced motion is enabled.
- No spinner runs indefinitely without named progress, a timeout, and a recovery action.
- Background completion is announced once through a restrained live region.

Visual-semantic comprehension gates:

- In a moderated test with at least five representative participants, at least 80 percent identify a node's evidence stage, due state, and evidence confidence without opening the inspector.
- The same task passes in a monochrome rendering.
- At least 80 percent explain why a selected skill changed state after reading the inspector.

## 8. MVP scope and deferrals

### Robust portfolio MVP includes

- One private canonical Skill Map per user.
- Natural-language Skill Leaf creation without a goal, category, or outcome form.
- Independent Skill Leaves plus versioned assessable Competencies beneath each leaf.
- No required parent, automatic branch, or unsolicited relationship suggestion.
- Optional semantic metadata that does not change the visible map.
- Solid learner-drawn Related and Prerequisite lines, including desktop drag handles and
  keyboard/mobile connection flows.
- PDF, TEXT (pasted or authored note), and one active public HTTPS URL ingestion job per user at a time.
- Many-to-many Skill/Source assignment.
- Immutable source snapshots and inspectable citations.
- Versioned Learning Packs with generated assessment blueprint, explanations, and
  question families.
- Mixed multiple-choice and short-response initial quiz.
- Familiar core questions, meaningful variants, and a deterministic zero-to-two
  reserved fair Transfer Probes in later recalls when valid probes exist.
- Pack-level Start quiz activation after deterministic validation; optional item-level
  inspect, edit, exclude, regenerate, and report.
- Targeted missed-answer remediation with cited gap explanation, worked example when
  helpful, scaffold check, and later unassisted retry.
- Manual question and scope authoring as an advanced fallback, visibly labelled when uncited.
- One practice workflow with Initial, Due, Skill, Gap retry, or Transfer selection reasons.
- Missed, Partial, or Meets rubric outcome for short response, with Hard/Good/Easy
  effort only after Meets.
- Deterministic multiple-choice correctness, I guessed, and effort stored separately.
- Versioned transparent scheduler.
- Append-only attempts and mastery evidence.
- Today queue.
- Personal constellation-style Skill Map plus equivalent list and relationship list.
- Distinctive Constellation Garden interface with a white/mist/sage/eucalyptus
  palette, one primary action, bounded controls, and progressive disclosure under the
  Section 7 clutter budgets.
- Well learned evidence stage and Refresh due display state with evidence explanation.
- Transfer evidence required for Well learned.
- At most one outbound daily digest; milestone feedback is in-app or included in that digest.
- Source, account export, and account deletion.
- Seeded public demo.

### Defer until the loop is validated

- Learning Goal creation, deadlines, goal dashboards, and advanced multi-goal planning.
  Target-schema goal records may remain for migration compatibility but are not part of
  onboarding or global navigation.
- Collaborative or public Skill Maps.
- Shared study groups.
- Public skill ontology or marketplace.
- Cross-user or cross-map recommendations.
- **Generate related trees:** opt-in semantic clustering, relationship proposals,
  previews, acceptance, and reversible system-created tree layouts.
- Global relationship recommendations across users or maps.
- Showing every graph edge simultaneously; the MVP prioritizes selected-node locality.
- 3D or physics-based visualization.
- Autonomous AI short-response grading that changes mastery without learner confirmation.
- Essays, timed exams, and multiple practice modes.
- Flashcard mode until the mixed quiz and recall loop is validated.
- OCR, video, audio, authenticated websites, and multi-page crawling.
- Automatic URL change monitoring; the MVP supports an explicit user-requested refresh that creates a new immutable version.
- Custom session builders and separate exam modes.
- Custom machine-learning decay prediction.
- Native mobile application.
- PWA and offline-first operation.
- Gamification economies, leaderboards, and complex streaks.
- Dark mode before the core responsive light interface is complete.
- Alternate visual themes and neobrutalist skins; the approved Constellation Garden
  identity ships as the single coherent theme first.

## 9. Target technical architecture

Browser
→ Next.js App Router
→ Server Components for authenticated initial reads
→ Server Actions and server-only domain services for internal mutations
→ Route Handlers for uploads, private source content, job status, webhooks, and external API boundaries
→ Managed PostgreSQL
→ Private object storage with quarantine and signed operations
→ Durable job queue
→ Isolated ingestion and generation workers
→ Structured redacted logging, error monitoring, and product analytics

### Tech-stack decisions

| Area | Current | Target decision |
|---|---|---|
| Web | Next.js 16 App Router, React 19, TypeScript 6 | Keep; prefer Server Components and server-only domain services |
| UI | Tailwind 4, Radix, CVA, Lucide | Keep the accessible primitives; build a source-owned Constellation Garden token system and SVG/CSS graph presentation with white, mist, ink, sage, eucalyptus, sprout, and coral semantic tokens; add no new UI-framework dependency |
| Auth | Auth.js/NextAuth credentials with Prisma adapter | Keep for MVP, harden recovery, rate limits, session revocation, and production secrets |
| Database | SQLite prototype | Migrate to managed PostgreSQL before real production data |
| ORM | Prisma | Keep; replace prototype schema with the versioned learning/graph schema and tested migrations |
| Files | Local filesystem | Replace with private object storage, quarantine, signed operations, and lifecycle cleanup |
| Background work | In-request/local work | Durable idempotent queue plus isolated ingestion/generation workers |
| AI | Vercel AI SDK boundary with a deterministic local provider; the Gateway path fails closed unless configured | Structured provider generation behind the same adapter; persist every run, prompt version, cost, and citation result |
| Semantic organization | Pack-scoped metadata retained for generation; not rendered and never applied to topology | Keep lightweight metadata for generation/search; defer graph-wide classification and embeddings until the opt-in Generate related trees feature is validated |
| Validation | Zod | Keep; validate every AI payload and mutation at the trust boundary |
| Tests | Vitest and Playwright | Keep; add PostgreSQL integration, worker, generation-evaluation, and accessible graph tests |
| Local development | One-command seeded SQLite | Add one-command PostgreSQL/object-store/worker setup with deterministic AI fixtures; retain a fast fixture mode for UI work |

Local development must support both `fixture` and `integrated` profiles. Fixture mode
uses deterministic stored model outputs and starts quickly with no paid API. Integrated
mode starts the same PostgreSQL migrations, private-storage emulator, queue worker, and
provider adapter used by production. `npm run dev:local` remains the documented entry
point and reports missing optional services with actionable messages.

### Architectural rules

- Authenticated app layout checks the session server-side.
- Initial Today, tree, skill, source, and question reads happen in Server Components.
- Client components are limited to interactive tree controls, upload progress, editors, and practice.
- Domain services receive the authenticated user ID from server context, never request JSON.
- Every nested query is scoped through the owned graph or goal.
- Foreign resources return safe not-found behavior.
- Attempts, mastery evidence, schedule transitions, and projections update atomically or through an idempotent outbox.
- Mastery projections are rebuildable from append-only evidence.
- Integrated generation verifies a current AIProcessingConsent before releasing bounded
  private excerpts to the provider.
- Production uses a provider/configuration contract that does not train on submitted
  private content and does not retain it beyond the clearly disclosed period.
- Ingestion stages are at-least-once and idempotent.
- Queue payloads contain an opaque job ID and a short-lived, single-stage capability, never source content or a tenant claim that is trusted directly.
- An authenticated task broker re-resolves tenant ownership and run state from the job ID, consumes the capability once, and supplies only that stage's required input.
- Stage capabilities are audience-bound, run-bound, operation-bound, short-lived, replay-protected, revocable, and audited.
- Only the task broker holds the least-privileged KMS permission needed to decrypt a selected Source URL; workers never receive a reusable decryption or database credential.

Worker trust zones:

- URL-fetch worker: exchanges its one-time capability with the task broker for one decrypted validated URL and a run-scoped output upload capability; it has restricted HTTPS egress, no application/database credential, and no browser cookies.
- Extraction worker: exchanges its capability for one short-lived read operation on the selected quarantined object and one run-scoped output write; egress is allowlisted only to the task broker and private object endpoint, with no general internet or object-store credential.
- Generation worker: receives only the selected tenant-scoped chunks in a bounded encrypted task response, has egress allowlisted only to the model endpoint, and uses a least-privileged provider credential. It has no arbitrary tools, database credential, or general storage access.
- Workers submit hashes, safe status, and output references through the authenticated broker; the broker validates run ownership and state before promotion.
- Web application: enqueues opaque stored IDs and capabilities and never places source content or long-lived secrets in queue payloads.

### Background jobs

- Scan uploaded source.
- Fetch URL.
- Extract PDF or text.
- Create source chunks.
- Derive bounded semantic metadata for the active Learning Pack without changing the
  visible Skill Map.
- Build an assessment blueprint and immutable Learning Pack Version.
- Generate and validate mixed core questions.
- Pre-generate and withhold Transfer Probes.
- Generate a cited remediation explanation and scaffold when a stored gap needs one.
- Recalculate mastery projection.
- Refresh a URL snapshot only after an explicit user request in the MVP.
- Send due or milestone reminder.
- Delete or quarantine orphaned objects.

The future Generate related trees workflow adds a separate, user-triggered semantic
clustering job. It must not be smuggled into source ingestion or normal pack generation.

Each job requires:

- Tenant scope.
- Idempotency key.
- Versioned input.
- Bounded retry policy.
- Safe error code.
- Observable state.
- Cancellation where meaningful.

## 10. Target data model

The final Prisma schema may use different names, but it must preserve these responsibilities and invariants.

### Identity

**User**

- Normalized email.
- Session version.
- Timezone.
- Soft-delete timestamp.
- Unique normalized email.

**PasswordResetToken**

- User ID.
- Hashed token.
- Expiration.
- Used timestamp.
- Never stores or logs the raw token.

**AIProcessingConsent**

- User, disclosure/policy version, provider configuration class, granted timestamp,
  revoked timestamp, and locale.
- Records consent before private source excerpts leave Rehearse for integrated model
  processing; fixture-mode generation does not claim integrated consent.
- The disclosure states which bounded excerpts are sent, why, the documented provider
  retention period, training-use policy, and how revocation/export/deletion work.

### Map, goals, and nodes

**SkillGraph**

- One canonical graph per user.
- Unique user ID.
- Created and updated timestamps.

**LearningGoal**

- Graph ID and user ID.
- Title.
- Outcome statement.
- Optional context or exam.
- Optional target date.
- Daily goal minutes.
- Active, Maintaining, Completed, or Archived status.
- Unique user slug.
- Optional in the user flow and never required for scheduling a Skill Leaf.
- Completion is user-confirmed. Completed removes that goal's queue priority and
  grouping but does not pause a canonical Skill's recall; pausing recall is an explicit
  Skill action.

**SkillNode**

- Graph ID.
- Optional generated-tree parent ID, unused for independent MVP Skill Leaves.
- Kind: Skill in the MVP; Branch is reserved for accepted future generated trees.
- Title and slug.
- Learner-entered topic title and optional intent for Skill kind.
- Description.
- Draft, Ready, Active, or Archived lifecycle.
- Current Skill Scope Version ID for Skill kind.
- Needs sources, Processing, Pack ready, Learning, and Recall due are derived product
  states, not client-writable columns.
- Importance.
- Sort order.
- Archive timestamp.
- Stable canvas position plus last manual-layout timestamp.
- Compound ownership-safe identifiers and indexes.

**SkillClassificationRun**

- Deferred to Generate related trees.
- Records the selected Skill set, Source Version set, prior graph/layout version,
  provider, model, prompt/policy version, hashes, usage, and safe error.
- Stores proposed trees, edges, confidence, and rationales.
- Previewed, Applied, Undone, Superseded, Failed, or Needs clarification status.
- Never overwrites manual connections or changes learning evidence.

**SkillPlacementDecision**

- Deferred to Generate related trees.
- Skill node, proposed and selected generated tree/Branch, generation run, and actor.
- User accepted, User changed, or Undo reason; there is no auto-applied state.
- Immutable audit record; the canonical Skill Leaf remains independently addressable.

**GoalSkill**

- Goal ID and Skill node ID.
- Required or Optional status.
- Importance.
- Unique goal/skill pair.
- Can reference only a Skill-kind node in the same graph.
- Organizes or prioritizes a Skill Leaf for an optional goal; it does not redefine or
  duplicate the leaf's scope, attempts, schedules, or mastery in the MVP.

**SkillScopeVersion**

- Immutable version number for one Skill node.
- System-derived outcome wording, success criterion, and assessment-blueprint snapshot.
- Policy version and creation reason.
- Superseded timestamp.
- Unique Skill/version and compound same-Skill current-version foreign key.

**SkillScopeCompetency**

- Scope version ID and immutable Competency Version ID.
- Required or Optional status and weight.
- Unique scope-version/Competency-Version pair.

**SkillEdge**

- Graph ID.
- From node.
- To node.
- Prerequisite or Related type.
- User origin in the MVP; System origin is reserved for an accepted future generated-tree proposal.
- Confirmed or Archived status in the MVP. Previewed and Undone states support the
  future generated-tree workflow without rendering unsolicited suggestions.
- Optional confidence, short rationale, and classification/generation run.
- Confirmed, dismissed, and archived timestamps plus actor.
- A future proposal key prevents duplicate previews within one generation run.
- Prerequisite uniqueness on graph, type, from node, and to node.
- Related endpoints stored as ordered low/high IDs and unique on graph, type, low node, and high node.
- Database constraints reject self-edges and out-of-range confidence.
- Both endpoints must be Skill-kind nodes in the same graph.
- Transactional prerequisite insertion runs its own cycle check.
- User-created edges begin Confirmed. Future system edges exist only after the learner
  explicitly applies a preview.

Future generated-tree containment constraints:

- Independent Skill Leaves may have no generated-tree parent.
- An accepted generated parent belongs to the same graph and is a Branch.
- A Skill node can never be a containment parent.
- Applying or editing generated containment runs a transactional cycle check independently
  from prerequisite validation.

### Sources and grounding

**Source**

- User owner and creator. A Source is reusable across Skill Leaves and optional goals.
- Type: PDF, TEXT, or URL.
- TEXT origin: PASTED, AUTHORED_NOTE, or UPLOADED.
- Status.
- Safe display name and redacted display URL.
- Encrypted fetch URL when applicable.
- Nullable current version ID, set only after promotion succeeds.
- A compound same-source foreign key guarantees the current version belongs to this Source.
- Soft-delete timestamp.

**SkillSourceAssignment**

- Skill node and Source.
- Selected Source Version, optional guiding question, relevant page/section range,
  inclusion status, and sort order.
- Assignment creator and timestamps.
- Unique active skill/source pair.
- Both records must belong to the same user.
- Updating an assignment never mutates a previously generated Learning Pack Version.

**SourceVersion**

- Immutable revision.
- Source ID and revision.
- Private storage key.
- MIME type.
- Byte size.
- SHA-256.
- Retrieval time.
- Extractor version.
- Unique source/revision and source/hash.

**SourceChunk**

- Source version.
- Stable ordinal.
- Extracted text.
- Token count.
- Page, heading, or character locator.
- Checksum.

**IngestionRun**

- Source ID.
- Optional input version and output version.
- Overall status.
- Run idempotency key.
- Lease and timing fields.
- Safe error code.

**IngestionJob**

- Ingestion run and stage.
- Optional input version.
- Attempt and status.
- Idempotency key.
- Lease and timing fields.
- Safe error code.

**TaskCapability**

- Hashed single-use token bound to one run/job, worker audience, and allowed operation.
- Expiration, consumed, revoked, and audit timestamps.
- The raw capability exists only in the short-lived delivery envelope and is never logged or stored.

Deletion and retention rules:

- Normal removal soft-retires the Source and dependent generated Questions while retaining Source Versions referenced by historical Question Revisions.
- Referenced chunks use delete restriction so a normal cleanup cannot silently break historical citations.
- Account/privacy hard deletion removes raw content and leaves only a non-content tombstone or checksum when legally appropriate.
- Historical UI explicitly says Citation unavailable after hard deletion; it never fabricates or substitutes a passage.

### Competencies, learning packs, and questions

**Competency**

- Primary skill node.
- Canonical key.
- Current Competency Version ID.
- Draft, Active, or Archived.
- User or System origin.
- Required/Optional belongs to a Skill Scope Version, not the canonical Competency.

**CompetencyVersion**

- Immutable Competency revision number, observable outcome, rubric summary, and
  semantic fingerprint.
- Creation reason, author/origin, and timestamp.
- Unique Competency/revision and a compound same-Competency current-version foreign key.
- Scope definitions, Question Revisions, source links, and Mastery Evidence reference this immutable version.

**CompetencySourceLink**

- Competency Version.
- Source chunk.
- Quote or locator.
- Confidence and origin.

Competency edit rules:

- A label or definition edit creates a new Competency Version and a new Skill Scope
  Version before it affects readiness.
- A semantic merge or split creates replacement Competency records/versions; old
  versions remain for historical scopes and evidence.
- Evidence never transfers to a semantically changed or merged Competency
  automatically. An equivalence migration requires an auditable decision and a new
  policy/scope version.
- Removing a Competency archives current use but does not delete versions referenced by history.

**LearningPack**

- Skill node.
- Current Learning Pack Version ID.
- Processing, Review, Active, Needs repair, Superseded, Failed, or Archived status.
- Only one Active version for a Skill Scope Version.

**LearningPackVersion**

- Immutable pack version, Skill Scope Version, and exact ordered Source Version set.
- Assessment blueprint snapshot, generation run, validation result, and coverage.
- Core-question and reserved-transfer-question counts.
- Processing, Review, Ready, Active, Superseded, or Failed status.
- An older Active pack stays usable until a replacement passes validation and is
  activated, except that individually suspended/reported questions leave its remaining
  valid items usable while deriving Needs repair.

**LearningPackQuestion**

- Learning Pack Version, immutable Question Revision, Core/Transfer role, included
  status, and deterministic order.
- Unique pack-version/question-revision pair.
- Editing creates a new Question Revision and candidate Learning Pack Version; it never
  mutates the active pack snapshot.

**GenerationRun**

- Skill node, Learning Pack Version, and exact bounded Source Chunk set.
- Semantic metadata, Blueprint, Core questions, Transfer probes, Variants, or Remediation kind.
- Queued, Running, Partial, Succeeded, Failed, or Cancelled status.
- Provider and model metadata.
- Prompt version.
- Input and output hashes.
- Token and cost metadata.
- Safe error.

**Question**

- Primary skill node.
- Draft, Active, Suspended, or Archived.
- Multiple choice or Short response type.
- Core, Transfer, or Remediation role.
- Question-family ID and variant relationship.
- Manual or Generated origin.
- Current Question Revision ID.
- Default scheduling eligibility.

**QuestionRevision**

- Immutable prompt, answer/rubric, explanation, type, role, novelty eligibility,
  generation run, and Learning Pack Version used by historical attempts.
- Multiple choice stores ordered options, one correct option, and distractor rationale.
- Short response stores required key points, acceptable alternatives, and a model answer.
- Transfer revisions store the same-scope application rationale and cannot be exposed
  in preview or the initial quiz.
- Created-by and created-at audit fields.

**QuestionFamily**

- Skill node and primary assessed Competency.
- Semantic target shared by familiar prompts and meaningful variants.
- Presentation count and last-presented timestamp are derived from session items.

**QuestionRevisionCompetency**

- Question Revision.
- Immutable Competency Version.
- Primary-assessed flag and optional discovery weight.
- Exactly one primary assessed Competency Version per Active revision.
- Only the primary assessed Competency Version receives Mastery Evidence; secondary
  links support discovery and explanation only.

**QuestionRevisionCitation**

- Question Revision.
- Source chunk.
- Exact quote and locator.
- Generated and source-backed questions require at least one citation before activation.
- Manual uncited questions are allowed and visibly labelled Manual/Uncited.

Activation rules:

- Every generated question passes schema, citation entailment, duplicate, ambiguity,
  answerability, and scope checks before it can become Active.
- An activatable pack covers every required Competency and has at least one valid
  question of each type. The normal target is at least six questions with at least two
  of each type; a smaller pack must still satisfy the two-type minimum.
- Transfer Probes additionally pass a fair-transfer rubric: same required Competency,
  novel context or framing, sufficient information, source-supported answer, no
  deceptive wording, and zero prior presentations at selection time.
- Pack-level Start quiz activates the valid set atomically. Individual questions may
  still be inspected, edited, excluded, regenerated, or reported.
- Every edit creates an immutable candidate Question Revision and reruns schema,
  citation, scope, ambiguity, answerability, duplicate, type, and coverage validation.
- Excluding or suspending an Active question immediately removes it from future queues.
  If this breaks required-Competency coverage or the two-type minimum, the pack derives
  Needs repair, readiness coverage falls, Well learned promotion is blocked, and the
  remaining valid questions may continue until a valid replacement pack is activated.

### Practice and mastery

**ReviewSchedule**

- User and question.
- Due state and due time.
- Stability or ease fields required by the chosen algorithm.
- Repetitions and lapses.
- Last reviewed time.
- Algorithm version.
- Question version.
- Optimistic version.
- Unique user/question pair and index on user, due time, and state.

**PracticeSession**

- User.
- Optional goal or skill scope.
- One Quiz/Recall mode with Initial, Due, Skill, Gap retry, or Transfer selection reason.
- Status.
- Target count.
- Started and completed times.

**PracticeSessionItem**

- Session.
- Question revision.
- Ordinal.
- Pending, Presented, Completed, or Skipped status.
- Schedule snapshot.
- Presented, last-presented, and skipped timestamps.

**PracticeResponseCheckpoint**

- Unique Session Item and user.
- Prompt, Drafting, Submitted, Feedback, Repair, or Saving phase.
- Mutable draft answer before submission and immutable locked pre-feedback answer after submission.
- Submit and feedback timestamps, optimistic version, and updated timestamp.
- Produces no Attempt or Mastery Evidence by itself.
- On grading, one transaction creates the immutable Attempt from the locked answer, updates scheduling/evidence, completes the Session Item, and deletes or retention-redacts the checkpoint.
- On refresh or reauthentication, restores the exact phase; a version conflict returns the latest durable checkpoint rather than overwriting it.

**Attempt**

- Session item.
- User.
- Question.
- Locked pre-feedback submitted answer copied from the checkpoint.
- Feedback state.
- Answer outcome: Incorrect, Partial, Meets, or Guessed.
- Nullable effort rating: Hard, Good, or Easy; allowed only when outcome is Meets.
- Server-derived scheduler grade and evidence score under a versioned mapping.
- Objective correctness is required and server-derived for multiple choice; nullable
  for MVP short response unless a later learner-confirmed grading policy applies.
- Familiar, Variant, or First-presentation Transfer novelty at session assembly.
- Assisted flag and zero-weight reason when created by a scaffold or revealed retry.
- Response time.
- Idempotency key.
- Scheduler before/after metadata.

**MasteryEvidence**

- Append-only.
- User.
- Immutable primary assessed Competency Version.
- Attempt.
- Core recall or Transfer evidence kind.
- Normalized score and weight.
- Occurred time.
- Algorithm version.

**CompetencyMastery**

- Rebuildable user/Competency-Version evidence projection.
- Self-assessed performance summary and evidence confidence.
- Evidence count.
- Last evidence and practice.
- Algorithm version.

**SkillEvidenceProjection**

- Rebuildable user/skill evidence summary across current required Competencies.
- Self-assessed performance.
- Consistency.
- Stability.
- Evidence confidence.
- Evidence and lapse counts.
- Successful unseen transfer count, distinct Question Families, covered Competencies,
  and distinct transfer days.
- Unresolved gap count.
- Algorithm version and computed timestamp.

**SkillReadiness**

- Rebuildable Skill node and Skill Scope Version projection.
- Evidence stage and due state.
- Scope coverage.
- Self-assessed performance.
- Consistency and stability.
- Evidence confidence.
- Weak and lapsed required-competency counts.
- Successful unseen transfer count and transfer qualification state.
- Rule version.
- Explanation payload.
- Computed timestamp.

**LearningGap**

- User, GoalSkill, immutable Competency Version, triggering Question Revision, and
  either an initial LearningPackAttempt or recall Attempt.
- The local slice uses Open and Resolved; Superseded remains a target state for
  invalidated scopes or questions.
- Short plain-language gap label and recommended next action.
- Latest qualifying unassisted retry and resolved timestamp.
- A revealed explanation or scaffold cannot mark the gap resolved for mastery.

**RemediationRevision**

- Learning Gap, immutable Source Version, trigger kind/key, explanation, optional
  worked example, and one scaffold prompt and reference answer.
- Exact source locator and excerpt; future provider-backed revisions also retain
  their Generation Run and validation result.
- Immutable; a reported or invalid revision is superseded, never rewritten.

**RemediationActivity**

- User, Learning Gap, immutable Remediation Revision, scaffold response, and
  completion timestamp.
- Unique per user, gap, and revision so completion is idempotent.
- Records guided practice only; it creates no Mastery Evidence and cannot resolve
  the gap.

**QuestionReport**

- User, Question Revision, optional Attempt, reason, note, and Pending, Upheld, or
  Invalid resolution status.
- Reporting suspends the question from that user's future queue immediately.
- While Pending, the disputed Attempt retains its existing evidence effect; reporting a
  lapse cannot raise mastery. The UI labels the evidence Under review.
- A server-side revalidation policy or authorized reviewer—not the reporting learner—
  resolves the report. Repeated reports for the same revision/attempt are idempotent
  and rate-limited.
- Upheld keeps the immutable Attempt/evidence and lets the learner keep the question
  excluded or reactivate it.
- Invalid creates an EvidenceInvalidation event, rebuilds affected projections, and
  reconstructs the schedule from the last valid transition without editing history.

**EvidenceInvalidation**

- Question Report, Attempt, affected Mastery Evidence IDs, resolver, reason, policy
  version, and timestamp.
- Append-only and unique for an Attempt/resolution policy.
- Excluded during projection and schedule rebuild; never deletes the original records.

**ReminderPreference**

- User.
- Timezone.
- Enabled state.
- Local send time.
- Channel.

Scheduling roll-up rules:

- A Skill Leaf inherits the most urgent state among Active Questions that assess
  required Competencies in its current scope: Overdue, then Due, then Current; ties
  use earliest due time.
- Today selects due Questions across the user's Active Skill Leaves. Optional goals may
  filter or prioritize the queue but never duplicate a canonical Question.
- The initial queue selects at most one Question per Competency before offering second
  questions for that Competency.
- Due recall selects familiar Core questions first, then adds zero Transfer Probes for
  1–3 familiar items, one for 4–7, and two for 8 or more, never exceeding 25 percent of
  the final queue.
- Unresolved Learning Gaps raise priority for the matching Competency without exposing
  the withheld Transfer Probe.
- A daily-minute target truncates the recommended queue using the learner's rolling median item duration, with a documented default when no history exists; the full due queue remains available.
- A skipped item remains due and returns after unseen session items unless the learner ends the session.

### Required data invariants

- Future generated Branches cannot own practice schedules or become Well learned.
- Skill leaves cannot contain child nodes in the MVP.
- A Skill Leaf can be created with only a title. Needs sources cannot become Pack ready
  until at least one assigned Source Version is Ready.
- An Active Skill Leaf requires a current scope, an Active Learning Pack Version, full
  required-Competency question coverage, at least one Active question of each type,
  and scheduling eligibility.
- Every Active Skill Leaf has a current success criterion, at least one required
  Competency Version, and Active core questions of both types. A zero-required scope
  remains Draft.
- Every Active Question Revision has exactly one primary assessed Competency Version.
- Every Active generated or source-backed Question Revision has at least one citation; a manual uncited revision is explicitly labelled.
- Every Active Learning Pack Version refers to the exact immutable Source Versions and
  Skill Scope Version used to generate it.
- A reserved Transfer Probe cannot appear in pack preview, source inspector metadata
  visible to the learner, initial quiz, or API responses for an unstarted recall.
- A Transfer Probe selected as unseen must have zero prior presentations for that user.
- Assisted remediation attempts create no Mastery Evidence.
- Every relationship endpoint belongs to the same user's graph.
- Normal skill creation and pack generation create no relationship or visible parent.
- Future generated-tree edges cannot exist outside a learner-confirmed generation run;
  applying or undoing them cannot alter manual edges.
- Every child record belongs to the same tenant and goal or graph as its parent.
- Clients may submit the short-response rubric outcome, Meets effort, or I guessed flag,
  but cannot submit objective multiple-choice correctness, scheduler grade, mastery
  state, evidence weight, or next due date.
- Historical attempts retain the exact question revision used.
- Source versions are immutable.
- No Source is Ready without retrievable content and checksum.
- A canonical SkillNode cannot become Archived while any GoalSkill membership remains;
  Archive everywhere is one transaction that removes/archives memberships and suspends
  its Questions and schedules.
- Removing a Skill from one goal removes only that GoalSkill and leaves the canonical
  Skill, scope, questions, schedules, and other goal memberships intact.
- A future generated Branch cannot become Archived while it has any non-Archived
  descendant node or descendant GoalSkill. The user must detach those descendants or
  confirm an atomic Archive generated tree operation that preserves canonical leaves
  and applies the documented Question/schedule rules.

### Required uniqueness and check constraints

- SkillGraph user ID is unique.
- ReviewSchedule is unique on user/question.
- PracticeSessionItem is unique on session/ordinal and session/question revision.
- PracticeResponseCheckpoint is unique on Session Item and its optimistic version is checked on every write.
- Attempt is unique on user/idempotency key and on session item.
- MasteryEvidence is unique on attempt/Competency Version.
- CompetencyMastery is unique on user/Competency Version.
- SkillReadiness is unique on Skill/scope version/rule version.
- LearningPackVersion is unique on LearningPack/version.
- SkillSourceAssignment is unique on active skill/source pair.
- A Transfer Question Revision belongs to one Question Family and one immutable
  Learning Pack Version.
- LearningGap is unique on user/originating attempt/Competency Version.
- SourceVersion is unique on Source/revision and Source/SHA-256.
- SourceChunk is unique on SourceVersion/ordinal.
- IngestionRun and IngestionJob idempotency keys are unique in their documented scope.
- TaskCapability token hash is unique and can transition to consumed only once.
- Question current-revision, Source current-version, and every ownership-sensitive relation use compound same-parent foreign keys where the database supports them.
- Checks bound scores, weights, confidence, response duration, byte sizes, ordinals, and graph limits.

## 11. Migration strategy

The committed SQLite database is exposed and must not be treated as a trustworthy production migration source. Purging the canonical remote does not erase prior clones, forks, caches, or downloaded artifacts; credential invalidation, affected-user assessment, notification where appropriate, and an incident record are separate required actions.

### If current data is disposable

1. Purge prisma/dev.db and uploads from Git history.
2. Replace SQLite migrations with a reviewed PostgreSQL baseline.
3. Add a deterministic synthetic seed.
4. Force affected real users to reset credentials if applicable.
5. Keep fixtures separate from runtime databases.

### If legitimate data must be retained

Treat this as a reviewed SQLite-to-PostgreSQL ETL/import, not as a normal Prisma schema migration.

1. Create the new PostgreSQL schema alongside the old application.
2. Add a LegacyEntityMap with old type/ID and new type/ID.
3. Migrate users only after credential reset and consent.
4. Create one Skill Graph per user.
5. Convert each SkillFolder into an independent Skill Leaf with a needs-sources or
   needs-scope-review migration flag; do not infer a Branch, relationship, or Learning
   Goal from a folder name.
6. Create independent Skill Leaves in the canonical Skill Map and preserve any
   legitimate goal metadata separately; do not invent a Branch or Goal merely to make
   scheduling work.
7. Convert Notes into user-owned TEXT Sources with AUTHORED_NOTE origin, immutable
   Source Versions, and SkillSourceAssignments.
8. Convert Files into user-owned Sources and assignments only when bytes are present
   and checksums verify.
9. Mark missing file bytes Failed or Missing, never Ready.
10. Convert QAPairs into Draft Manual/Uncited questions requiring Skill, Competency,
    type, rubric, and citation review; migration creates no Mastery Evidence.
11. Compare counts, ownership, checksums, timestamps, and orphan totals.
12. Freeze legacy writes for final reconciliation, switch to PostgreSQL, and use a forward-only cutover.
13. Application rollback continues to read the new PostgreSQL schema; data rollback uses a verified backup restore. Never resume SQLite writes after unfreezing without a tested dual-write/change-capture design.

Migration acceptance criteria:

- [ ] A fresh PostgreSQL migration succeeds from zero.
- [ ] A sanitized legacy fixture imports successfully.
- [ ] Every legacy row has one mapping or an explicit quarantine reason.
- [ ] No migrated Source is Ready without verified bytes or text.
- [ ] No child record crosses user ownership.
- [ ] Prisma migration diff reports no drift after deployment.
- [ ] Application rollback keeps PostgreSQL as the system of record, and a non-production backup restore is verified before cutover.

## 12. Phased implementation plan

Phase 0 is a hard ordered gate. After it, the numbered phases describe capability
workstreams, not permission to complete months of horizontal infrastructure
before testing the product. The completed manual recall slice remains valuable
infrastructure and a fallback, but it is not the target onboarding flow. The next
vertical slice must prove the corrected topic → source → generated quiz → repair →
recall → independent Skill Leaf → optional manual connection loop before additional
feature expansion.

Delivery slices:

- **Safety baseline:** Phase 0. The current prototype is not used with real data until this gate passes.
- **Completed technical proof:** the existing manual one-leaf recall loop proves durable
  attempts, scheduling, and projections; keep it as a regression fixture.
- **Corrected product slice:** the smallest production-compatible work from Phases 1–7
  that proves source-first AI learning and the learner-connected Skill Map.
- **Portfolio MVP:** Phases 0–9 plus privacy controls, production persistence, quality
  evaluation, operational proof, and an honest public case study.

Each slice must be demoable and releasable behind a feature flag. Work from a later slice cannot be used to waive acceptance criteria in an earlier slice.

### Current vertical slice — Hashmaps to evidence and an optional connection

Build one thin end-to-end path before expanding formats, dashboards, or graph density:

1. Create “Hashmaps” using only the topic field.
2. Add one supported URL or pasted-note fixture and persist an immutable Source Version.
3. Place the Hashmaps Skill Leaf independently on the constellation canvas.
4. Generate a versioned blueprint plus a cited mixed quiz with reserved Transfer Probes.
5. Complete the initial quiz, intentionally miss one item, and complete its cited
   Strengthen this scaffold without awarding mastery for the assisted retry.
6. Assemble a later recall fixture containing familiar material plus one previously
   unseen fair Transfer Probe, then update scheduling and the leaf evidence state.
7. Add “Arrays” as a second independent Skill Leaf with no automatic connection.
8. Create a learner-drawn Related or Prerequisite connection using both pointer and
   keyboard/mobile-equivalent flows, then change and remove it.

Acceptance criteria:

- [x] A learner creates Hashmaps with only a title; no goal, branch, outcome, or success
  criterion input is required.
- [x] At least one Ready Source Version is required before Generate quiz is enabled.
- [x] The generated pack has both question types, complete required-Competency coverage,
  citations for every item, and at least one withheld valid Transfer Probe.
- [x] An incorrect answer produces a competency-specific explanation, exact source locator,
  one recommended action, scaffold check, and later retry.
- [x] The assisted scaffold creates no Mastery Evidence.
- [x] Recall contains familiar material plus a question with zero prior presentations;
  familiar material remains the majority.
- [x] Hashmaps and Arrays remain separate until the learner connects them; no source,
  pack, or recall operation creates an unsolicited branch or edge.
- [ ] A learner connection survives source and learning-pack regeneration unchanged.
- [ ] Related persists as a solid undirected line; Prerequisite persists with an arrow;
  pointer, keyboard, and mobile alternatives work.
- [ ] The complete path survives refresh, retry, and reauthentication without duplicate
  source versions, packs, attempts, edges, or evidence.
- [ ] The golden path works at 320 CSS pixels, 200 percent zoom, keyboard-only, screen
  reader, and reduced motion.

Historical checkpoint (2026-09-03): the manual one-leaf loop ships locally. An
authenticated learner can create one goal, define an observable Skill Leaf and success check,
write one manual recall prompt, resume a durable draft, reveal the reference, self-grade, and see
an atomic evidence/schedule/readiness change with the next review. `/today` is the authenticated
home, `/dashboard` redirects there, the old organizer lives at a visibly labelled `/library`, and
the same leaf state appears in the goal-scoped tree and outline. The local demo can now move the
real seeded records through Well learned, Refresh due without demotion, and a qualifying lapse by
running `npm run demo:state -- well-learned|refresh-due|lapse`; each state self-validates against
the versioned scheduler and mastery projector before it is shown in Today. Narrow-screen,
simulated 200-percent zoom, reduced-motion, post-reveal focus, and initial keyboard navigation are
covered in the browser suite, which also exercises the real Well learned → Refresh due → lapse
sequence end to end. A complete keyboard-only golden path remains open, so that combined
acceptance box stays unchecked. This checkpoint is retained as infrastructure and
regression coverage; it no longer defines the product-led onboarding experience.

Implementation checkpoint (2026-09-06): the corrected local golden path now runs
topic → source → generated mixed quiz → cited Strengthen this → scheduled recall →
updated Skill Leaf. New and legacy-created Skill Leaves are parentless, and pack
generation changes only learning readiness; it cannot create a branch, edge, or
placement. A missed or partial initial answer creates a durable competency-level
Learning Gap and immutable Remediation Revision with its exact Source Version,
locator, explanation, recommended action, worked example, and scaffold prompt.
Completing the scaffold writes an idempotent Remediation Activity and creates no
Mastery Evidence. Open-gap competencies are prioritized inside the next due recall;
an Again or guessed recall reopens the gap, while only a later successful normal
recall attempt with qualifying evidence can resolve it. The complete browser fixture
proves the cited repair and later resolution. Unfinished latest remediation revisions
remain discoverable as the primary Today action, and every submitted scaffold is bound
to the exact immutable revision the learner saw so a concurrent recall cannot silently
retarget their answer. Mid-quiz initial-answer recovery,
Question Report moderation, provider-backed generation quality evaluation, and the
full accessibility study remain open.

Next ordered product work (2026-09-07):

1. Persist and resume the initial quiz at the exact question, answer, and feedback
   state, then complete the keyboard and screen-reader golden path.
2. Expand Why this state into a compact evidence explanation covering scope,
   successful review days, transfer, confidence, and the next requirement.
3. Finish relationship editing, pointer connection handles, search/filter, and the
   synchronized accessible Map/List experience.

### Phase 0 — Incident containment and truthful baseline

Purpose: make the current repository safe enough to continue.

Original baseline findings captured before the 2026-09-03 implementation checkpoint.
Several have since been remediated locally, but the unchecked acceptance criteria below
remain the authoritative production gate:

- Tracked prisma/dev.db contains account records, password hashes, file metadata, and user-authored content; the ignore rules do not exclude runtime databases.
- The file-view route serves private material without an authentication/ownership gate.
- Note Markdown reaches dangerouslySetInnerHTML without a trustworthy sanitization boundary.
- Active upload formats can be served inline on the application origin.
- Password recovery logs a usable reset token instead of delivering a complete safe flow.
- The original production build failed on the login route because useSearchParams was not inside the required Suspense boundary.
- The original production dependency graph contained Critical and High findings across
  authentication, UUID generation, syntax highlighting, and Prisma tooling.
- SQLite and local uploads are not a durable multi-instance or Vercel production architecture.
- The original product loop stopped at folders, files, and notes; it had no durable practice, scheduling, evidence, or mastery loop.
- Folder detail is local UI state instead of a durable route, mobile layouts overflow, and core cards, dialogs, icon actions, tabs, contrast, focus, and error states need accessibility work.
- Landing-page claims, placeholder links, and README behavior do not consistently match the implemented product.

Work:

- Open an incident record for the committed database, inventory affected accounts/content, invalidate exposed password hashes and sessions, and notify affected people if the records are real.
- Purge prisma/dev.db and uploaded user material from Git history.
- Verify the canonical remote no longer contains the object and document that prior clones, forks, and caches may still retain it.
- Add prisma/*.db*, uploads/, and runtime artifacts to .gitignore.
- Replace runtime data with a synthetic seed.
- Require authentication and ownership on every preview/download path.
- Replace the unsafe Markdown renderer with a maintained parser and sanitizer.
- Reject or force-download HTML, SVG, JavaScript, archives, and unsupported Office formats.
- Verify file magic bytes instead of trusting the submitted MIME type.
- Complete the password-reset flow; do not ship a token-logging or UI-only placeholder.
- Hash reset tokens, make them single-use, email real links, and revoke sessions.
- Upgrade Next.js, Auth.js, UUID, syntax-highlighting, and affected dependencies.
- Fix the login Suspense/build failure.
- Add a committed environment example and startup validation.
- Add security headers.
- Remove production debug logging and raw identifiers.
- Rewrite the landing page and README feature matrix to match reality.
- Remove placeholder links, default assets, dead scripts, and unimplemented claims.

Acceptance criteria:

- [ ] The canonical remote history contains no runtime database, password hashes, reset tokens, notes, or uploaded files, and affected credentials/sessions are invalidated independently of the rewrite.
- [ ] The incident record documents affected-data assessment, notification decision, remote verification, and the residual clone/fork risk.
- [ ] Anonymous private preview returns 401.
- [ ] Another user's resource returns safe not-found behavior.
- [ ] Script and active-content upload probes cannot execute on the application origin.
- [ ] Markdown XSS fixtures render inert.
- [ ] Reset tokens are hashed, expiring, single-use, emailed, and never logged.
- [ ] Password reset invalidates prior reset tokens and existing sessions.
- [ ] Production dependency audit has no known Critical or High finding.
- [ ] Production build, type-check, lint with zero warnings, and smoke tests pass.
- [ ] README distinguishes Implemented, Planned, and Deferred functionality.
- [ ] A fresh clone contains no real or ambiguous user data.

Implementation checkpoint (2026-09-03): the working tree now ignores and quarantines the
committed local database, uses synthetic local seed data, enforces ownership on private file
routes, sanitizes Markdown, rejects active-content uploads, disables the incomplete reset flow,
ships truthful product copy, and passes strict lint, type-checking, 174 unit tests, 11 browser smoke
tests, the production build, and tested-flow browser accessibility scans with no npm dependency
advisories. Local-only defenses now also include private runtime file modes, auth throttling,
per-user storage quotas, serialized storage mutations, duplicate-upload arbitration, a non-destructive
legacy-migration preflight, pre-parse multipart size enforcement, bounded upload admission,
end-to-end cancellation cleanup, and bounded note validation. Canonical-remote
history removal, credential/session invalidation,
notification assessment, production storage, and a complete emailed reset flow remain open and
must not be represented as finished.

### Phase 1 — Production platform and accessible app shell

Purpose: replace the local prototype foundation with deployable infrastructure.

Work:

- Move from SQLite to managed PostgreSQL.
- Add private object storage with quarantine and short-lived signed operations.
- Add upload intents, completion verification, and deletion cleanup.
- Add durable queue and worker foundation.
- Add the authenticated task broker and single-use stage-capability exchange.
- Add central authorization, ownership, validation, and typed-error services.
- Add server-authenticated app layout.
- Create durable Today, Tree, Skill, Practice, Progress, and Settings route shells.
- Introduce accessible dialog, sheet, tabs, toast, form, navigation, and confirmation primitives.
- Add loading, error, global-error, unauthorized, and not-found states.
- Build a responsive shell with mobile navigation.
- Add structured redacted logs, error monitoring, health and readiness endpoints.
- Add CI, preview deployments, database migration gates, and staging environment.
- Make `npm run dev:local` provision or verify PostgreSQL, private-storage emulator,
  queue worker, migrations, seed data, and deterministic AI fixtures.
- Add explicit fixture and integrated local profiles with the same domain contracts.

Acceptance criteria:

- [ ] Registration plus representative database and private-object fixtures persist across redeploys and application instances; Goal and Source persistence are gated again in their implementation phases.
- [ ] Private storage objects are not publicly listable or permanently signed.
- [ ] Failed database writes after upload leave a recoverable quarantined object that cleanup removes.
- [ ] Object deletion retries until complete and is auditable.
- [ ] A worker can obtain only one run's permitted input/output operations; expired, replayed, revoked, wrong-audience, and wrong-stage capabilities are rejected and audited.
- [ ] Auth is enforced before authenticated pages render.
- [ ] Direct URL, refresh, back, and forward preserve app location.
- [ ] App shell reflows at 320 CSS pixels and 200 percent zoom without page-level horizontal scrolling.
- [ ] Dialogs and sheets trap and restore focus.
- [ ] Form errors use aria-invalid, aria-describedby, and actionable messages.
- [ ] A clean deploy applies migrations and passes health checks without manual database work.
- [ ] A fresh clone reaches a seeded fixture-mode app with one documented command and
  no paid AI credential.
- [ ] Integrated local mode exercises real PostgreSQL, storage, queue, and provider
  boundaries and fails fast with an actionable missing-service message.
- [ ] Preview and production use separate databases, storage, queues, encryption keys,
  auth secrets, and model budgets.

### Phase 2 — Arbitrary topics and learner-controlled graph primitives

Purpose: let the learner name anything, see each topic as an independent Skill Leaf,
and create only the connections they find useful.

Work:

- Add SkillGraph, SkillNode, SkillScopeVersion, and SkillEdge; retain LearningGoal and
  GoalSkill only as compatibility/future-schema records behind a feature flag.
- Create one graph per user.
- Keep Learning Goal UI out of onboarding, navigation, Skill creation, and scheduling.
- Implement Skill Leaf creation from one natural-language title plus optional intent.
- Add Needs sources, Processing, Pack ready, Learning, and Recall due derived states.
- Keep new Skill Leaves parentless and unconnected on the default map.
- Add confirmed learner-created Related and Prerequisite edges with origin and audit records.
- Add transactional cycle detection, edge normalization, and graph limits.
- Replace SkillFolder language with Skill, Source, and optional Goal.
- Build topic-first setup and a basic accessible constellation/list.
- Build durable skill detail and inspector.
- Add manual move, pointer connect, keyboard/mobile Connect skill, type/direction
  change, disconnect, archive, and undo.
- Migrate or seed representative graph data.

Acceptance criteria:

- [x] A learner creates any Skill Leaf with one title and no branch or goal decision.
- [x] A new leaf is durable in Needs sources state and resumes there after refresh.
- [x] A new Skill Leaf has no parent or edge by default.
- [ ] Skill leaves cannot contain children in the MVP.
- [ ] Self-edges, duplicates, cross-user endpoints, and forbidden cycles are rejected.
- [x] Related edges are normalized.
- [ ] Archiving a Skill with live goal membership is rejected unless the explicit
  atomic archive-everywhere operation succeeds.
- [x] Skill and goal deep links survive refresh.
- [x] Related is stored undirected; Prerequisite is stored with direction and rejects cycles.
- [x] Learner-created edges are solid; the runtime creates no unsolicited dashed suggestions.
- [ ] Pointer, keyboard, and mobile users can create, change, and remove both edge types.
- [x] Source processing and pack-generation jobs cannot overwrite node position or edges.
- [ ] A representative graph with 250 nodes and 500 edges stays within a documented p95 server-query budget of 200 ms in the test environment.
- [ ] All cross-user graph access returns safe not-found behavior.
- [ ] In a moderated test with at least five target users, at least four create a topic
  and find the saved leaf again without assistance.

### Phase 3 — Secure sources: PDF, TEXT, and URL

Purpose: make sources durable, reproducible, and safely ingestible.

Work:

- Add Source, SourceVersion, SourceChunk, IngestionRun, and IngestionJob.
- Make Source user-owned and add many-to-many SkillSourceAssignment with per-skill focus.
- Implement pasted text and authored notes as versioned TEXT Sources with distinct origins.
- Implement signed PDF/text upload to quarantine.
- Add checksum, magic-byte verification, malware scan, and promotion.
- Implement isolated public HTTPS URL ingestion.
- Canonicalize URLs and store encrypted full fetch URL plus redacted display URL.
- Snapshot raw responses privately.
- Extract readable text without executing remote JavaScript.
- Chunk content with stable page, heading, or character locators.
- Add progress, cancellation, retry, quarantine, stale, and partial-success UI.
- Prompt for sources immediately after Skill Leaf creation and gate Generate quiz on at
  least one Ready assigned Source Version.
- Add source count, storage byte, fetch, and processing quotas. AI cost quotas arrive with generation.

URL security requirements:

- HTTPS only.
- Reject userinfo, localhost, .local, cloud metadata, nonstandard ports, and non-HTTP schemes.
- Resolve and reject loopback, private, link-local, multicast, unspecified, reserved IPv4/IPv6, and encoded/numeric IP forms.
- Validate every A, AAAA, and CNAME result; reject if any selected destination is disallowed.
- Revalidate every redirect, pin a validated destination, enforce the connected peer address, and prevent DNS rebinding.
- Preserve TLS SNI and hostname verification when connecting through a pinned address.
- Send no user browser cookies, authorization, or ambient credentials.
- Apply redirect, concurrency, connect, read, total-time, compressed-byte, and decompressed-byte limits.
- Apply maximum HTML/DOM complexity and extraction-depth limits.
- Reject misleading MIME types and decompression bombs.
- Redact query strings and fragments from telemetry.
- Treat source text as untrusted data, never instructions.
- Permit at most one active URL IngestionRun per user in the MVP.

Acceptance criteria:

- [ ] PDF and text sources produce ordered chunks with stable locators and checksums.
- [ ] Public HTTPS articles produce a stored immutable snapshot and cited chunks.
- [ ] Authenticated, paywalled, JavaScript-only, and unsupported URLs fail clearly with a paste-text fallback.
- [ ] Repeating an upload completion, fetch, or extraction job creates no duplicate versions or chunks.
- [ ] Automated tests block localhost, RFC1918, IPv6 loopback/ULA, metadata addresses, DNS rebinding, private redirects, redirect loops, slow responses, oversized responses, and decompression bombs.
- [ ] Raw private content never appears in logs or public URLs.
- [ ] URL telemetry contains only the redacted display URL and safe error code.
- [ ] Fetch and extraction worker environments contain no application database credential or general object-storage credential.
- [ ] Failed and quarantined sources offer retry and delete.
- [ ] Source processing continues safely if the user navigates away.
- [ ] An explicit refresh of changed URL content produces a new version without mutating old citations; automatic monitoring is absent from the MVP.
- [ ] Source rows, versions, and private objects persist across redeploys and application instances.
- [ ] One source can support several skills and one skill can use several sources without
  duplicating immutable Source Versions.
- [ ] A failed source returns the learner to Add sources without losing the Skill Leaf.
- [ ] Empty, thin, and conflicting source fixtures produce a coverage warning and never
  unsupported generated claims.

### Phase 4 — Generated learning packs

Purpose: make source-grounded quiz creation the core product without letting
unsupported output become learning evidence or silently reorganize the Skill Map.

Implementation checkpoint (2026-09-04): a server-only Vercel AI SDK boundary and
strict structured-output contract now define a six-item source-grounded pack.
Validation requires mixed multiple-choice and short-response items, initial-quiz
coverage of every listed Competency, citations whose excerpts and locators match
an assigned immutable snapshot, unique prompts/options, and one or two withheld
Transfer Probes. The boundary requires an explicit AI Gateway model and fails
closed when it is absent. Persistence, private-source consent, ingestion, human
pack approval, budgets, and the learner-facing quiz remain open, so generated
packs are not yet exposed in the product.

Implementation checkpoint (2026-09-06): the strict pack is now persisted and exposed
through the source-first local flow. The deterministic local provider makes that flow
testable without sending private source text to an external model; the production AI
Gateway boundary remains fail-closed until a model is explicitly configured. Pack
generation retains semantic metadata for future opt-in organization but neither
renders it nor mutates Skill Map topology.

Work:

- Detect likely duplicates/synonyms and suggest merge; never merge evidence automatically.
- Add Competency, immutable CompetencyVersion, source links, and Skill Scope Version.
- Add LearningPack and immutable LearningPackVersion with exact source-version set.
- Generate Question Families, mixed Core questions, meaningful variants, and withheld
  Transfer Probes with strict bounded structured output.
- Persist provider, model, prompt/policy version, hashes, usage, cost, citations, and
  validation outcomes for every run.
- Add per-user generation budgets, cancellation, idempotent retry, safe partial success,
  and prompt-injection evaluation.
- Validate schema, coverage, citation support, answerability, distractors, ambiguity,
  duplication, and fair transfer before activation.
- Build one pack-level Start quiz action plus optional item inspect, edit, exclude,
  regenerate, and report.
- Make edit/exclude create candidate immutable revisions and rerun all item plus pack
  coverage/type validation before replacement activation.
- Keep manual uncited creation as an advanced, persistently labelled fallback.

Acceptance criteria:

- [x] Creating or regenerating a pack does not create, move, group, or connect Skill Leaves.
- [x] Any semantic metadata produced for question generation is not rendered as a
  category, branch, or relationship suggestion.
- [ ] Duplicate/synonym detection never auto-merges a node or its evidence.
- [x] A Learning Pack Version records the exact Skill Scope and Source Versions used.
- [x] An activatable pack covers every required Competency and represents both multiple
  choice and short response; every generated question has supporting citations.
- [ ] MCQ distractors are unique and plausible, one option is correct, and the cited
  explanation supports why it is correct.
- [ ] Every reserved Transfer Probe passes the same-scope, novel-context, sufficient-
  information, source-support, and non-deceptive-wording rubric.
- [x] Transfer prompts are absent from all learner-visible payloads until selected in a
  started recall session.
- [ ] Start quiz activates the validated pack atomically in one action while retaining
  item-level controls.
- [ ] Editing a question creates an immutable revision and candidate pack; it cannot
  activate until citation, scope, clarity, answerability, duplicate, type, and coverage
  checks pass.
- [ ] Excluding or suspending an item removes it from queues immediately. If coverage or
  the two-type minimum breaks, the pack becomes Needs repair, remaining valid recall
  continues, and readiness cannot promote until a valid replacement activates.
- [ ] Schema-invalid, uncited, unsupported, duplicate, ambiguous, or low-confidence
  items cannot become Active.
- [x] Retrying generation creates no duplicate nodes, packs, questions, or edges.
- [x] Generation sees only the current user's explicitly assigned bounded Source Chunks.
- [ ] Integrated generation cannot start without a current consent record that names
  bounded-excerpt use, provider/configuration class, retention period, training policy,
  revocation, export, and deletion behavior.
- [ ] The generation worker has no application-database or general object-storage
  credential and can exchange its capability only for the selected chunks.
- [ ] Instructions inside a source cannot grant tools, network access, secrets, broader
  storage, or cross-tenant data.
- [ ] Provider, model, prompt/policy version, hashes, usage, cost, and validation outcomes
  are auditable without logging raw private content.
- [ ] On a frozen evaluation set of at least 100 generated questions across at least 10
  representative public or synthetic sources, at least 95 percent of citations support
  the answer, no more than 5 percent have a major factual error, and at least 80 percent
  pass the published clarity and fair-assessment rubric.

### Phase 5 — Initial quiz, grading, and targeted remediation

Purpose: turn the generated pack into a reliable first learning experience and make
every miss actionable.

Implementation checkpoint (2026-09-06): `LearningGap`, immutable
`RemediationRevision`, and append-only `RemediationActivity` now support the local
generated path. The learner sees one source-cited Strengthen this action after an
initial miss or recall lapse. The scaffold is idempotent and structurally incapable
of writing Mastery Evidence. Gap identity follows the assessed Competency rather
than one prompt, so a later successful unassisted variant can resolve it. Recall
summaries expose both newly opened and newly resolved gaps, and due queue composition
puts open-gap competencies first while preserving the familiar/transfer ratio.

Work:

- Add ReviewSchedule, PracticeSession, PracticeSessionItem, mutable PracticeResponseCheckpoint, Attempt, and append-only MasteryEvidence.
- Add Initial, Due, Skill, and Transfer selection reasons, plus explicit open-gap
  priority metadata within normal recall sessions.
- Build one-question-at-a-time mixed quiz practice.
- Grade multiple choice deterministically on the server.
- Lock a short response before showing its cited rubric and self-grade controls.
- Implement Prompt → Submit → Feedback/rubric → Grade → Durable save → optional
  Strengthen this → Next item.
- Add the defined Incorrect/Partial/Meets/Guessed outcomes and conditional
  Hard/Good/Easy effort controls.
- Add session pause, resume, save retry, and completion.
- Add Pending, Presented, Completed, and Skipped session-item states.
- Record immutable schedule-before and schedule-after data.
- Build session summary.
- Add LearningGap, RemediationRevision, and QuestionReport.
- Generate or retrieve a cited explanation, exact source locator, optional worked
  example, one scaffold check, and later unassisted retry for every valid miss.
- Suspend a reported item from that learner's future queues, keep evidence in effect
  while Pending, and support authorized Upheld/Invalid resolution with schedule and
  projection repair.
- Ship deterministic generated-pack and missed-answer fixtures for the guest flow.

Acceptance criteria:

- [x] A learner starts the valid generated pack with one action and completes both
  question types.
- [x] Attempt, MasteryEvidence, and schedule update are atomic.
- [ ] Completing the initial quiz creates immutable Attempts and ReviewSchedules for
  the active core bank; refresh or retry creates no duplicate Attempt or transition.
- [x] Retrying an attempt with the same idempotency key creates one final attempt and one schedule transition.
- [x] The client cannot choose MCQ objective correctness, evidence weight, mastery
  state, or next due date; short-response self-grade remains explicitly labelled.
- [ ] Incorrect, Partial, Meets, and Guessed outcomes map deterministically to evidence
  and scheduling; effort is accepted only for Meets, and Guessed cannot satisfy transfer.
- [x] Answer-save failure preserves the typed answer and offers retry.
- [ ] A session refresh restores the exact prompt, draft, feedback, repair, or saving
  checkpoint without duplicating an Attempt.
- [x] A checkpoint alone creates no Attempt or MasteryEvidence; grading atomically
  consumes its locked pre-feedback answer into the final Attempt.
- [x] Short-response rating controls are disabled before feedback; shortcuts do not
  fire while typing and have visible equivalents.
- [ ] A skipped item creates no Attempt, lapse, or MasteryEvidence, remains due, and follows the documented return rule.
- [x] Historical Attempts retain the exact Question Revision, citations, and primary
  Competency Version practiced even after later edits.
- [x] Draft, Suspended, and Archived items never enter the due queue.
- [x] Every Incorrect/Partial/Guessed fixture produces a gap label, cited explanation,
  exact locator, one primary action, scaffold check, and later retry.
- [x] Remediation views, examples, scaffolds, and immediate retries create zero-weight
  assisted records and cannot manufacture readiness.
- [x] A successful later unassisted retry can resolve the Learning Gap.
- [x] Repeated misses for the same Skill and Competency reuse or reopen one gap;
  each distinct trigger creates at most one immutable remediation revision.
- [x] Completing a scaffold is idempotent, records only a Remediation Activity,
  and creates no Mastery Evidence.
- [x] Open-gap prioritization preserves the familiar-majority and Transfer Probe cap.
- [x] Only qualifying later unassisted recall for the same Competency can resolve
  the gap.
- [ ] Reporting a flawed item removes it from future queues immediately but does not
  erase its evidence while Pending; Upheld retains it and Invalid emits an immutable
  invalidation plus deterministic schedule/projection rebuild.
- [ ] Repeated reports are idempotent and rate-limited, and the reporting learner cannot
  resolve their own report.
- [ ] At least four of five representative users complete topic → source → pack →
  initial quiz without assistance.
- [ ] On a frozen human-scored set of at least 100 missed-answer cases across at least
  10 domains, including thin and conflicting sources, at least 95 percent of repair
  citations support the explanation, no more than 3 percent contain a major factual
  error, at least 90 percent address the assessed Competency, and at least 80 percent
  receive a useful recommended-action rating under the published rubric.

### Phase 6 — Scheduled recall, transfer evidence, and mastery

Purpose: distinguish durable learning from initial familiarity and tell the learner
when a skill is genuinely well supported by evidence.

Work:

- Select and document a transparent versioned scheduling algorithm.
- Build Today due queue, estimated duration, timezone-safe calculations, and resumable
  session assembly.
- Select familiar Core questions or meaningful variants first, then add zero Transfer
  Probes for 1–3 familiar items, one for 4–7, and two for 8 or more, capped at 25 percent.
- Pre-generate and validate transfer inventory asynchronously; never block recall if no
  valid probe is available.
- Add rebuildable CompetencyMastery, SkillEvidenceProjection, and SkillReadiness.
- Implement versioned Unassessed, Learning, Demonstrated, and Well learned evidence policies plus independent Current, Due, and Overdue urgency.
- Derive Refresh due only as the Well learned plus Due/Overdue display state.
- Add evidence confidence and low-evidence behavior.
- Require two successful first-presentation Transfer Probes on distinct recall days for
  Well learned, in addition to coverage, spacing, recent performance, and confidence.
- Add explicit new-source scope review; accepting required-Competency changes creates a
  new immutable Skill Scope Version and recalculates only that scope.
- Add projection rebuild and audit tooling.

Acceptance criteria:

- [ ] Uploads, reading activity, source count, AI generation, and elapsed time create no Mastery Evidence.
- [ ] Only qualifying attempts produce mastery evidence.
- [ ] Identical scheduler and queue-composition fixtures produce identical results.
- [ ] Queue fixtures with 1, 2, 3, 4, 7, and 8 familiar items select respectively 0,
  0, 0, 1, 1, and 2 valid unseen probes; familiar items remain at least 75 percent of
  every final queue.
- [ ] If no valid Transfer Probe exists, recall completes with familiar questions and
  records the omission without generating synchronously.
- [ ] Rebuilding projections from append-only evidence yields the same result.
- [ ] Demonstrated and Well learned transitions match versioned golden fixtures.
- [ ] Becoming Due or Overdue does not demote Well learned; it derives Refresh due for display.
- [ ] A qualifying Incorrect/Partial/Guessed lapse recomputes the evidence stage without deleting history.
- [ ] Well learned cannot be reached without 100 percent required-Competency coverage,
  spaced evidence, High confidence, retained recent performance, and two successful
  unseen Transfer Probes from distinct Question Families on distinct sessions and days;
  when inventory permits, they cover at least two Competencies.
- [ ] New required competencies lower coverage without resetting existing evidence.
- [ ] Related and prerequisite skill performance never changes another leaf's mastery.
- [ ] Every status exposes a plain-language Why this changed explanation.
- [ ] A valid failed Transfer Probe creates a Learning Gap and tightens scheduling under
  the documented policy; history is preserved.
- [ ] Time alone never demotes a skill. Due/Overdue on Well learned derives Refresh due.
- [ ] Timezone, daylight-saving, retry, and idempotent session-assembly fixtures pass.

### Phase 7 — Constellation Skill Map and distinctive minimal UI

Purpose: make independent evidence-backed Skill Leaves, learner-controlled
relationships, and the Constellation Garden visual language the signature experience
without overwhelming the learner.

Implementation checkpoint (2026-09-05): the user-wide Tree now renders every live
Skill Leaf across goals as an independent organic node on the Constellation Garden.
The approved white, mist green, sage, eucalyptus, sprout, and restrained coral palette
is implemented with an ownable botanical mark, serif display voice, subtle grain,
curved paths, and stage-specific leaves. Only confirmed learner-created
relationships appear. Selecting a leaf updates a desktop inspector; mobile places a
compact action panel directly below the selected leaf. The accessible connection
manager supports Related and Prerequisite creation and removal without dragging.
Dates use the learner timezone, Review now preserves the selected leaf, and the map
has been visually verified without horizontal overflow at 1440, 390, and 320 CSS
pixels. The deterministic local fixture now contains four stage-varied leaves and
one manual relationship for meaningful UI testing.

Design decision (2026-09-05): concept 3's spacious constellation composition remains,
while the earlier dark-green header and beige field are replaced by a softer
white-and-light-green system. The current implementation is the first
production-shaped slice of that direction. Search, filtering, bounded zoom/pan,
pointer connection handles, edge editing, and the opt-in future tree generator remain
open; no placeholder control is shown for unshipped behavior.

Work:

- Inventory repeated copy, nested cards, excessive badges, hard shadows, and
  always-visible tools before adding the approved visual identity.
- Define the named Constellation Garden tokens for white, mist, ink, sage, eucalyptus,
  sprout, coral, surface, divider, focus, and semantic states; keep component
  behavior independent from visual skin.
- Build the desktop map with deterministic independent-node placement, selected-node
  edge emphasis, search, filters, and bounded zoom/pan.
- Build synchronized accessible outline and mobile-first list/bottom-sheet experience.
- Show learner-created edges as solid, with visible prerequisite arrows and text alternatives.
- Add desktop connection handles plus keyboard/mobile Connect skill flow.
- Add edge inspector with type, direction, origin, Change, and Remove.
- Show Skill name plus no more than two compact state markers on a node.
- Add one consistent seed/leaf node silhouette, subtle canvas grain, curved connection
  paths, and a serif display accent without reducing readability.
- Make every page choose exactly one dominant primary CTA based on durable state.
- Add Why this changed evidence explanation and reduced-motion Well learned feedback.
- Preserve focus, selection, filters, and viewport context across Map/List changes.

Acceptance criteria:

- [x] Hashmaps and Arrays render as separate Skill Leaves until the learner deliberately
  connects them; normal creation produces no category box or dashed suggestion.
- [x] Bubble and list row show only name plus at most two status markers; rationale and
  evidence detail appear on selection.
- [ ] Today, setup, Skill detail, Practice, and Summary each open with one H1, at most
  one short helper sentence, one filled primary CTA, and no duplicated state message.
- [ ] Today's initial viewport contains only due/next state, estimated duration when
  relevant, and the primary action; optional metrics require one Details disclosure.
- [ ] No primary route opens with more than one expanded secondary panel.
- [ ] No default route uses nested cards or more than two bordered top-level surfaces.
- [ ] Skill detail uses a state-led overview rather than five equal-weight tabs; its
  next action is visible without opening Details.
- [ ] Normal Tree mode shows no connection handles and no more than three utility
  control groups; filters and map tools are grouped and keyboard reachable.
- [ ] Practice never shows more than one question, feedback state, or next-step panel
  at once. Summary shows outcome, next review, and Done before item breakdown.
- [ ] The list exposes the same stage, urgency, and learner-created relationships as the map.
- [x] Every relationship operation works without drag and has an accessible result/error.
- [ ] Bubble state and edge type remain understandable in monochrome and forced colors.
- [ ] Map keyboard navigation implements Up, Down, Left, Right, Home, End, type-ahead,
  Enter, and Space; graph connection controls follow logical focus order.
- [ ] At 50 visible leaves, selection, pan/zoom, edge focus, and filter feedback
  have p95 interaction latency below 100 ms on documented representative hardware.
- [ ] Initial interactive tree renders within 2.5 seconds on the representative mobile profile.
- [x] No page-level horizontal overflow occurs at 320 CSS pixels or 200 percent zoom.
- [ ] Removing color, grain, and shadow does not reduce comprehension of task,
  selection, focus, validation, mastery stage, due urgency, or edge direction in
  monochrome and forced-colors modes.
- [ ] Map/List switching and mutations preserve or predictably restore focus and selection.
- [ ] At least four of five representative users identify node independence,
  relationship type, learning stage, and next action without assistance.
- [ ] In an unbranded screenshot comparison, at least four of five representative users
  distinguish the Rehearse Tree from a generic component-library dashboard.
- [ ] At least four of five representative users identify the current state and next
  action within five seconds on Today, setup, Practice, and Skill detail without prompting.

### Phase 8 — Return loop, progress, and notifications

Purpose: help learners return and maintain skills rather than merely finish setup.

Work:

- Finalize Today prioritization and resume behavior.
- Add one configurable outbound daily digest after first-session completion.
- Add in-app Well learned, Refresh due, and overdue feedback; include it in the digest when relevant rather than sending separate notifications.
- Add Progress with evidence trends, due adherence, difficult skills, and maintenance history.
- Add unresolved-gap and transfer-evidence summaries with one recommended next action.
- Add account export, content export, account deletion, and retention controls.
- Instrument activation, practice, return, quality, cost, and failure events.
- Keep analytics free of source text, answers, URLs with queries, or sensitive identifiers.

Acceptance criteria:

- [ ] Reminder opt-in is offered only after the first completed session.
- [ ] Digest timing respects timezone and opt-out immediately, and no user receives more than one outbound digest per day.
- [ ] A Well learned milestone includes its supporting evidence and next maintenance review.
- [ ] Progress separates coverage, Evidence performance, evidence confidence, and due adherence.
- [ ] Empty or low-data insights show requirements instead of zero-value charts.
- [ ] Account export contains documented user-owned data.
- [ ] Account deletion removes or irreversibly schedules deletion of database rows, objects, jobs, and generated content.
- [ ] Analytics events contain no private source content or submitted answers.
- [ ] Product funnel can measure skill created → source ready → pack started → initial
  quiz completed → remediation completed when offered → first recall → first transfer
  success → Well learned.

### Phase 9 — Portfolio release and operational proof

Purpose: present a credible, safe, reproducible case study rather than a feature list.

Work:

- Polish and freeze the deterministic demo data introduced in Phase 5.
- Verify the guest sample demonstrates topic → source → generated mixed quiz → one
  repair → scheduled recall fixture → updated independent leaf in under five minutes;
  manual connection is an optional follow-on interaction.
- Deploy production and preview environments.
- Add real screenshots and short product walkthrough.
- Add architecture, data-flow, and threat-model diagrams.
- Add ADRs for graph projection, scheduler, PostgreSQL, object storage, queue, source snapshots, and mastery policy.
- Rewrite README with exact setup, architecture, implemented features, limitations, roadmap, and real links.
- Add license, contribution guide, environment example, and one-command local setup.
- Exercise backup restore, incident response, and deletion.
- Run documented usability and accessibility sessions with target users.
- Publish honest before/after product and engineering results.

Acceptance criteria:

- [ ] Guest demo reaches a completed generated quiz, cited repair, scheduled recall
  fixture, and updated Skill Leaf in under five minutes.
- [ ] Fresh clone setup works from the documented commands.
- [ ] README links, badges, screenshots, demo, and architecture match the deployed product.
- [ ] Backup restoration succeeds in a non-production environment.
- [ ] Full user deletion is verified end to end.
- [ ] Error dashboards report auth anomalies, ingestion failures, generation failures, and latency without sensitive content.
- [ ] Release evidence records test build, device/browser, task script, participant criteria, result, and known limitations.

Pilot exit criteria for expanding scope, not technical launch blockers:

- With at least 10 representative participants using the same moderated task, at least
  80 percent complete topic → source → pack → initial quiz without assistance.
- Across at least 10 supported happy-path source sessions, median source-to-first-
  completed-quiz time is under five minutes, excluding explicitly reported third-party
  processing outages.
- The frozen Phase 4 evaluation meets its citation, major-error, clarity, and fair-
  transfer thresholds.
- Of at least 30 activated pilot users observed for a full seven-day window, at least 40 percent complete a second session within seven days.

## 13. Cross-cutting acceptance standards

### Security and privacy

- [ ] Every user-owned domain operation has a two-user authorization integration test.
- [ ] IDs are never treated as authorization.
- [ ] Private files and snapshots use authorization or extremely short-lived signed access.
- [ ] Active content is never rendered inline on the authenticated application origin.
- [ ] Source fetching passes the complete SSRF and resource-exhaustion test suite.
- [ ] Secrets, tokens, source text, answers, and full private URLs are redacted from logs.
- [ ] Private excerpts are sent to a model provider only after versioned disclosure and
  consent, using a no-training configuration and a retention period no longer than the
  documented limit.
- [ ] Consent revocation stops new integrated runs; export includes the consent history;
  deletion covers stored generations and documented provider-retention handling.
- [ ] Rate limits and quotas cover auth, reset, uploads, URL ingestion, generation, and reminders.
- [ ] Security headers include CSP, nosniff, frame restrictions, referrer policy, and permissions policy.
- [ ] Production dependencies have no unaccepted Critical or High advisory.

### Accessibility

- [ ] Primary flows meet WCAG 2.2 AA.
- [ ] Normal text contrast is at least 4.5:1.
- [ ] Large text, focus indicators, and meaningful graphics meet at least 3:1.
- [ ] State is never encoded by color alone.
- [ ] Product touch targets are at least 44 by 44 CSS pixels.
- [ ] The complete golden path works with keyboard alone.
- [ ] Keyboard task passes: Today → Start recall → Answer → Feedback → Rate when needed → Summary.
- [ ] Desktop screen-reader task passes: Tree search → Skill → Inspector → Practice.
- [ ] Mobile screen-reader task passes: Outline → Bottom sheet → Sticky review action.
- [ ] The tree has a fully equivalent outline/list view.
- [ ] If the view becomes a non-tree graph, the accessible outline is not misrepresented with ARIA tree semantics.
- [ ] No action is hover-only, drag-only, gesture-only, or motion-dependent.
- [ ] Details, More, Filter, and inspector disclosures announce expanded/collapsed state,
  expose all controls in logical keyboard order, and restore focus to their trigger.
- [ ] VoiceOver/Safari, NVDA/Chrome, and mobile screen-reader smoke tests pass.
- [ ] Forced-colors mode preserves focus, selection, urgency, stage, and actionable controls.
- [ ] Progress charts have equivalent text summaries or data tables.
- [ ] Tree mutation and route-transition tests report no lost focus.
- [ ] Practice announces feedback, repair availability, save state, schedule change,
  and textual session progress without exposing the answer prematurely.
- [ ] Automated accessibility checks report no Serious or Critical violation.

### Reliability and data integrity

- [ ] Mutations use idempotency where retry can occur.
- [ ] Jobs are idempotent and safe under at-least-once delivery.
- [ ] Storage and database lifecycle failures reconcile automatically.
- [ ] Source versions, question revisions, attempts, and mastery evidence remain immutable.
- [ ] Projections can be rebuilt and compared with stored results.
- [ ] Destructive operations are named, scoped, auditable, and recoverable where practical.
- [ ] Loading, partial success, error, retry, and empty states exist for every async core flow.
- [ ] Background refresh retains existing content, skeletons preserve layout, and no unnamed spinner can run beyond its documented timeout without recovery.
- [ ] Reduced-motion loading states are static and background completion is announced only once.

### Performance

- [ ] Today and skill detail avoid client-fetch waterfalls for initial content.
- [ ] Representative mobile measurements target p75 LCP at or below 2.5 seconds, INP at or below 200 ms, and CLS at or below 0.1; any exception is documented before release.
- [ ] Tree interaction meets the Phase 7 50-visible-leaf and p95 100 ms budget.
- [ ] Practice input and grading provide immediate local feedback while the durable save completes.
- [ ] Large sources process asynchronously and never block the web request lifecycle.
- [ ] All list queries are paginated or intentionally bounded.

### Product integrity

- [ ] Marketing contains no unimplemented shipped claim.
- [ ] Every generated pack is source-grounded and every item can be inspected, edited,
  excluded, regenerated, or reported without making per-item approval mandatory.
- [ ] New skills remain independent; source processing, pack generation, and recall
  never create or alter visible branches, positions, or relationships.
- [ ] Future generated-tree output is explicit, previewed, explainable, reversible,
  and never overwrites manual connections.
- [ ] Every learning-state claim can be explained from attempts and coverage.
- [ ] No generated tree or relationship silently transfers mastery.
- [ ] No source view, generation, repair view, scaffold, or same-day assisted retry
  silently creates mastery evidence.
- [ ] Every qualifying miss has a cited recommended action and later unassisted retry.
- [ ] Transfer questions are source-supported, same-scope, genuinely unseen, sufficiently
  contextualized, and non-deceptive.
- [ ] Product copy says grounded in your sources and never equates a citation with
  independent fact-checking or universal truth, including for conflicting sources.
- [ ] No empty or low-evidence state displays false precision.
- [ ] The app always makes the recommended next action apparent.
- [ ] Every primary screen has one visually dominant action and every node shows at most
  two compact status markers until selected.
- [ ] Primary routes contain no nested cards, no meaningless decoration, no duplicated
  status copy, and no more than one expanded secondary panel on entry; atmospheric
  Tree decoration remains inert and subordinate to the task.
- [ ] Progressive disclosure never hides blocking errors, save state, due urgency, the
  current task, or the next action; every disclosure is keyboard/screen-reader operable
  and restores focus to its trigger.
- [ ] Every completed onboarding step is durable; Back, refresh, reauthentication, and background processing preserve context, and Today exposes Continue setup.
- [ ] Source-first onboarding can start only after the active pack covers every required
  Competency with validated questions; partial invalid output never enters the queue.

## 14. Test strategy and CI gates

### Unit tests

- Graph edge validation and independent-node defaults.
- Cycle detection and undirected-edge normalization.
- No-edge side effects during skill creation, source processing, pack generation, or recall.
- Duplicate/synonym warning without automatic evidence merge.
- Skill lifecycle and mastery transitions.
- Skill Scope Version creation and skill-scoped readiness.
- Competency Version replacement, merge/split isolation, and zero-required-scope handling.
- Scheduler golden fixtures and algorithm-version migration.
- Answer-outcome/effort matrix, including correct-but-guessed MCQ and partial short response.
- Recall composition: familiar majority, novelty check, transfer cap, and no-probe fallback.
- Transfer fairness rubric and pre-presentation secrecy filter.
- Transfer diversity: two variants from one Question Family cannot satisfy Well learned;
  multi-Competency inventory requires multi-Competency transfer coverage.
- Mastery projection from evidence.
- Multi-skill sessions contribute only their matching Skill/current-scope attempts to
  each leaf's recent-session policy window.
- URL parser, every A/AAAA/CNAME classification, peer-address enforcement, redirect rules, TLS hostname behavior, and resource limits.
- Validation schemas and length bounds.
- Markdown sanitization.
- MIME and content-disposition policy.
- Question activation invariants.
- Mixed-pack coverage, MCQ option, citation, duplicate, and question-family invariants.
- One-primary-Competency attribution and same-day evidence caps.
- Assisted-remediation zero weighting and Learning Gap resolution.
- Canonical Skill archive and GoalSkill lifecycle rules.
- Future generated-tree preview/apply/undo isolation when that phase begins.

### Integration tests

Use ephemeral PostgreSQL and an S3-compatible test service.

- Fresh migrations and migration drift.
- Sanitized legacy ETL/import.
- Two-user ownership matrix for graph, goals, sources, questions, sessions, attempts, and previews.
- Upload intent, quarantine, scan, promotion, deletion retry, and orphan cleanup.
- URL ingestion retries and idempotency.
- SkillSourceAssignment ownership and source reuse across skills.
- Generation retry and tenant isolation.
- Pack regeneration preserves node position and learner-created edges.
- Learning Pack activation is atomic and retains the prior active version on failure.
- Question edit/exclude revalidation, candidate pack activation, Needs repair fallback,
  and coverage/type recovery.
- Attempt, schedule, evidence, and projection atomicity.
- Response-checkpoint optimistic writes, submission lock, grade consumption, repair
  resume, and retention cleanup.
- Question-revision edits cannot change historical citations or Competency attribution.
- Question-report Pending, Upheld, Invalid, repeated-report idempotency, future
  suspension, schedule repair, and audited projection rebuild.
- Scope edits preserve historical readiness and compute against a new immutable scope version.
- Password reset and session revocation.
- Graph traversal bounds and query plans.
- Account export and deletion.

### End-to-end tests

- Guest sample → topic → source → mixed quiz → cited repair → recall → updated bubble.
- Register → Hashmaps title → independent leaf → source → generated pack → initial quiz → next due.
- Add Arrays → independent second leaf → create/change/remove a learner connection.
- Draw Related and Prerequisite connections with pointer and keyboard/mobile flows.
- PDF, URL, pasted text, and authored note each reach a cited mixed pack and quiz.
- New required Competency added to a Well learned skill → new scope version → coverage explanation.
- Initial quiz never exposes reserved Transfer Probe; later recall presents it once as New angle.
- Miss → exact citation → scaffold → zero mastery weight → later unassisted retry.
- Report flawed question → suspension → audited projection rebuild.
- Edit/exclude active question → Needs repair when coverage breaks → generate valid
  replacement → atomic pack activation.
- Well learned → Due → Refresh due display without evidence-stage demotion.
- Well learned → qualifying Incorrect/Partial/Guessed lapse → evidence-stage
  recomputation with history preserved.
- Practice refresh at Prompt, Draft answer, Feedback, Repair, and Durable save states →
  no duplicate Attempt.
- Cross-user resource guessing.
- Expired session during upload and practice.
- Mobile outline and practice.
- Complete keyboard-only golden path.
- Minimal-density assertions for Today, setup, Skill detail, Practice, Summary, and Tree:
  one filled primary action, bounded top-level surfaces, no nested cards, no duplicate
  state copy, and secondary panels collapsed on entry.
- Monochrome and forced-colors visual checks with grain, color, and shadow disabled.

### Required CI pipeline

1. Clean install with locked dependencies.
2. Secret and committed-data scan.
3. Prisma generate and validate.
4. Fresh PostgreSQL migration.
5. Sanitized legacy ETL/import.
6. ESLint with zero warnings.
7. TypeScript no-emit.
8. Unit tests with at least 80 percent branch coverage for domain modules and at least 90 percent branch coverage for authorization, scheduler, mastery-policy, and URL-security modules.
9. Integration tests.
10. Production Next.js build.
11. Browser smoke and accessibility tests.
12. Dependency, OSV, and static security scanning.
13. Preview deployment smoke.
14. Gated production migration and deployment.

Main-branch deployment stops if migrations, authorization tests, production build, Critical/High dependency gates, or golden-path tests fail.

## 15. Product metrics

### North-star metric

Weekly completed due recalls with resolved learning gaps by activated users.

### Activation

- Percentage who complete skill created → source ready → pack started → initial quiz.
- Median supported-source-to-first-completed-quiz time.
- Percentage offered remediation who complete the cited Strengthen this step.

### Retention

- Percentage completing a second practice session within seven days.
- Week-four users completing at least two sessions per week.
- Due-review completion rate.
- Percentage completing a first scheduled recall after the initial quiz.

### Learning evidence

- Skill leaves reaching Demonstrated.
- Skill leaves reaching Well learned.
- Well learned leaves that pass their first maintenance review.
- Lapse and Refresh due rates.
- Evidence coverage and confidence distribution.
- First-presentation Transfer Probe success rate.
- Learning Gap resolution rate and median recalls to resolution.

### Generation quality

- Valid-pack Start quiz rate.
- Question inspect, exclusion, major-edit, regeneration, and deletion rate.
- Reported factual-error rate.
- Citation/source-match accuracy.
- Processing and generation success rate.
- Time from source submission to the first reviewable cited item.
- Cost per activated learner.
- Manual connection creation, change, and removal rate.
- Future generated-tree preview, apply, edit, and Undo rate after that feature ships.
- Generated-question report, suspension, and evidence-invalidation rate.
- Transfer Probe validation rejection rate and source-support accuracy.
- Remediation citation-support, major-error, Competency-match, and recommended-action
  usefulness rates.

Do not use raw signup, folder, file, source, or generated-question counts as evidence that the retention product works.

## 16. Release definition

The project may be called a robust portfolio MVP only when:

- [ ] Phases 0 through 9 technical acceptance criteria are satisfied. Pilot exit metrics are tracked separately.
- [ ] Phase 0 security/privacy, tenant isolation, data integrity, build, and deployment/import gates are non-waivable. A non-safety product feature may move to Deferred only through an ADR and an accurate public limitations document.
- [ ] The public demo completes Topic → Source → Generated mixed quiz → Cited repair →
  Scheduled recall fixture → Updated independent Skill Leaf.
- [ ] A returning user can complete the Today queue on desktop and mobile.
- [ ] A skill cannot reach Well learned without full current-scope coverage, spaced
  evidence, High confidence, and two successful unseen Transfer Probes from distinct
  Question Families on distinct sessions/days; it later displays Refresh due without
  time-based demotion.
- [ ] The Skill Map and accessible list show identical learning state.
- [ ] Today, setup, Skill detail, Practice, Summary, and Tree meet the Section 7 clutter
  budgets and Constellation Garden criteria: one primary action, no nested cards,
  bounded controls, and an ownable visual identity.
- [ ] Hashmaps and Arrays begin as separate leaves; the learner can connect, change,
  and remove both relationship types without affecting either skill's evidence.
- [ ] PDF, TEXT (pasted or authored), and supported public URL sources produce durable cited content.
- [ ] Learner-facing citation language says grounded in your sources and does not claim
  independent fact-checking.
- [ ] Generated content cannot reach practice without deterministic validation and
  pack-level activation; all items remain inspectable and reportable.
- [ ] Missed answers produce targeted cited remediation and later unassisted retry;
  assisted steps cannot create mastery.
- [ ] Build, type-check, zero-warning lint, tests, accessibility, security, PostgreSQL migration, and legacy-import gates pass.
- [ ] Production data persists across deployments and private content remains private.
- [ ] README, demo, screenshots, architecture, and limitations are accurate.

## 17. Open decisions to resolve before implementation

- Which transparent scheduling algorithm and version will be used initially?
- What measured user need and quality threshold justify starting the deferred Generate
  related trees feature?
- What confidence threshold permits a relationship or grouping to appear in that
  future preview, and which frozen cross-domain fixtures calibrate it?
- What exact pack-size rule adapts the six-question target for legitimately narrow sources?
- Does the first MVP pre-generate all remediation or generate it on a miss from bounded
  chunks with a deterministic fallback?
- Which managed PostgreSQL, object storage, queue, email, and monitoring services fit the intended deployment?
- Does pilot evidence justify a policy v2 change to the explicit Demonstrated, Well learned, or confidence thresholds? Any change creates a new version rather than editing policy v1.
- Which exact representative hardware, dataset, and environment define the 250-node server-query and 50-visible-leaf interaction budgets?
- Which public HTML extraction policy and crawl/robots behavior will be supported?
- What question revision changes retain versus reset scheduling?
- What learner-confirmed AI assistance, if any, follows rubric-backed short-response
  self-grading without silently affecting mastery?
- Which source formats should be removed from the current UI until safely implemented?
- What product analytics platform can meet the privacy constraints?
- Which key-management service encrypts full URL values, and what is the key-rotation process?
- Which channel delivers the one daily digest in the MVP?
- What evidence and usability threshold must be met before showing all graph edges at
  once rather than only the selected node's neighborhood?

Each decision must be captured in an ADR before the dependent phase is considered complete.

## 18. Product-agent review

The independent product pass concludes that the corrected flow is materially stronger
because it removes curriculum-design work from the learner while keeping the system's
claims inspectable. The prior manual loop remains useful infrastructure, but presenting
it as onboarding would optimize for authoring instead of learning.

The product flow is approved with these conditions:

1. Topic creation stays one-field-first; source collection immediately follows it.
2. Skill Leaves are separate by default. The learner may connect them manually; normal
   setup never auto-groups, auto-connects, or asks for taxonomy input.
3. Pack activation is one action after deterministic validation, not an item-by-item gate.
4. A miss always leads to a source-grounded next action and a later unassisted retry.
5. New angle questions test transfer fairly and stay hidden until recall.
6. Well learned requires transfer plus spacing, coverage, confidence, and recent success.
7. The graph never transfers mastery, silently changes a learner connection, or forces
   pointer-only editing.
8. The future Generate related trees action is opt-in, previewed, reversible, and may
   leave unrelated nodes separate. It is not represented as shipped in the MVP.
9. Minimal UI means restrained content and controls, not visual anonymity. The approved
   identity uses the Constellation Garden composition and palette while preserving one
   primary action, progressive disclosure, no nested cards, and no more than two compact
   status markers per Skill Leaf.

A follow-up visual review confirms that this does not require a framework rewrite:
retain Tailwind, Radix, CVA, and Lucide, keep the simplified information hierarchy,
and implement the ownable Constellation Garden identity through source-owned tokens,
CSS, and SVG. The Section 7 clutter and visual-signature criteria are release gates.

The highest product risk is not model novelty; it is trust. Citation support,
question fairness, remediation usefulness, and the explanation behind Well learned
must therefore be evaluated as release gates rather than treated as polish. When the
future tree generator begins, grouping and relationship quality receives its own
evaluation gate before any proposal can be applied.

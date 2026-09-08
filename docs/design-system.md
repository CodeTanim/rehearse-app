# Rehearse design system

Status: implemented baseline; remaining screens and accessibility validation are tracked feature by feature

## Skill workspace update — 2026-09-08

The soft-green constellation remains the desktop workspace. Its viewport is fixed
at 560px high regardless of node count; Fit all and title search recover off-screen
skills. Leaves use stable world coordinates saved to the learner's account. Drag a
leaf or use Alt + arrow keys to reposition it. Ordinary wheel scrolling remains
page scrolling; Ctrl/Command + wheel zooms the map.

Only the selected leaf exposes a 44px connection handle. Draw from it to a target,
or use Connect then click/tap/keyboard selection. Connection type is explicit in
the contextual bar; Escape cancels, and Use form retains source context. Errors
remain visible. The latest removed connection can be restored with Undo removal.

Mobile keeps the normal-flow list, search and contextual connection choices, with
no drag interception or map zoom controls. Movement/connection changes never
change learning evidence. Automatic grouping remains deferred.

Last updated: 2026-09-07

## Direction

Rehearse uses the **Constellation Garden** direction: a quiet, content-first
interface with a spacious constellation of organic Skill Leaves. The learner
should see the current state and next action before anything else. An airy
white-and-mist field, stable leaf forms, restrained botanical lines, clear type,
and generous space provide visual identity without turning the product into a
game or illustration.

The implementation is Next-native and source-owned. Tailwind, CVA, and Radix
remain useful implementation tools, but Rehearse does not depend on a visual
component framework or copy a Paper UI/neobrutalist skin.

## Visual primitives

- Mist green is the default page and map field; white is the primary focused
  surface and navigation color.
- Deep botanical ink is reserved for readable text and high-contrast line work,
  not large background fields.
- Sage is the main learning and action accent. Eucalyptus provides the secondary
  relationship accent, while pale sprout green marks learning or milestones.
- Coral is reserved for urgency and errors. Every semantic state also has a text
  label or icon; color never carries meaning alone.
- One-pixel dividers, fine borders, modest radii, soft controlled shadows, a
  small type scale, and generous spacing establish hierarchy.
- Skill Leaves use one consistent seed/leaf silhouette or organic capsule with
  stable geometry and hit areas. They are controls, not ornamental stickers.
- A very subtle paper grain or botanical line motif may appear on the map only
  when it preserves contrast and does not compete with content.

Avoid heavy textures, tape, stamps, arbitrary rotations, thick black outlines,
hard offset shadows, unrelated decorative illustrations, nested cards, and rows
of competing buttons. Neobrutalist and scrapbook decoration are not part of the
approved theme.

## Composition rules

1. Give each screen one H1 and one dominant action.
2. Put supporting detail behind a labelled disclosure when it is not needed to
   choose the next action.
3. Use no more than two bordered top-level surfaces in a default view.
4. Do not nest cards. Prefer spacing, headings, and dividers.
5. Show a Skill name and at most two compact state markers in map leaves and
   list rows. Put evidence math and relationship tools behind selection or
   disclosure.
6. Use `Button` and `ButtonLink` for actions instead of duplicating class lists.
7. Use Radix-backed dialogs and tabs where their interaction behavior is
   needed; do not add a second component framework.
8. Icon-only actions need contextual accessible names. Destructive actions
   need explicit confirmation.
9. Keep actions available on touch and keyboard; hover may not be the only
   affordance.

## Navigation

The primary authenticated navigation is Today, Tree, and Progress. Tree opens
the learner's canonical Skill Map, where Skill Leaves may remain independent;
“Tree” remains the compact MVP navigation label. Identity and sign-out live in
the account disclosure. Library and setup utilities are secondary destinations,
not peers of the daily learning loop.

## Strengthen flow

- Use one focused column: missed idea, explanation, optional example, collapsed
  Source evidence, then one scaffold prompt.
- Finish practice is the sole dominant action.
- Completion explicitly says guided practice does not raise mastery and only a
  later unassisted recall can resolve the gap.

## Skill leaves and mastery

A Skill Leaf is a domain component. It may show these text states:

- Unassessed
- Learning
- Demonstrated
- Well learned
- Refresh due

Color is secondary. Rehearse does not use a bare mastery percentage. “Well
learned” appears only when the evidence policy supports it and always means
well learned for the current scope. The reason and underlying evidence remain
available in Details.

## Skill Map and connections

- New Skill Leaves appear as independent constellation nodes. Creation, source
  processing, quiz generation, and recall do not place them in a branch or
  connect them automatically.
- The MVP shows only relationships the learner deliberately creates. Related
  connections use a solid undirected line; Prerequisites use a solid line with
  an explicit arrow and text equivalent.
- Normal View mode contains no unsolicited dashed suggestions. A dashed line is
  reserved for an uncommitted preview in the future opt-in tree-generation
  workflow.
- Connecting is optional and separate from learning. Pointer interaction has a
  keyboard and mobile equivalent; no graph operation may be drag-only.
- The accessible node and relationship lists expose the same leaves, states,
  edge types, directions, and actions as the visual map.
- **Generate related trees** is a future explicit, previewed, reversible action.
  It is not exposed in the MVP as a button, disabled control, teaser, or silent
  background behavior.

## Accessibility and motion

- Primary interactive targets are at least 44 by 44 CSS pixels.
- Focus is clearly visible and independent of selection or status.
- Dialogs have a labelled title, focus trap, Escape close, and focus restore.
- Status uses text in addition to color.
- `prefers-reduced-motion` is honored globally.
- Layout has no page-level horizontal scroll at 320 CSS pixels or 200% zoom.

## Review checklist

- The task and next action are identifiable in five seconds.
- Today, setup, Practice, summary, and Skill detail have one dominant action.
- Optional metrics and tools start collapsed.
- No route opens with nested cards or more than one expanded secondary panel.
- Keyboard, screen-reader, forced-color, reduced-motion, and narrow viewport
  behavior remain usable.
- There are no console errors, hydration warnings, or Next.js error overlays.
- Planned concept previews are visibly labelled and never presented as shipped
  behavior.
- New Skill Leaves remain independent until the learner connects them.
- Default views contain no automatic branch, unsolicited relationship, or
  dashed suggestion.
- No Generate related trees control appears until the opt-in preview workflow
  is implemented end to end.

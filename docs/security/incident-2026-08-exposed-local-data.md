# Incident record: committed local user data

Status: **open — local containment complete; remote remediation pending**

Discovered: 2026-08-31

## Summary

The repository contains a populated SQLite runtime database in Git history and
previously contained uploaded user documents. A normal deletion commit cannot
remove either artifact from existing commits, forks, clones, caches, or local
copies.

Do not copy account identifiers, password hashes, note text, or document
contents into issues, pull requests, CI logs, or this record.

## Known affected data classes

- `prisma/dev.db`: three account email addresses and password hashes, three
  file-metadata records, and one non-empty user-authored note.
- Historical `uploads/**`: three user-uploaded documents, including one PDF
  and two images.

The database first appears in commit `0c26a61`. The uploaded documents also
appear in that commit and were deleted from the working tree in `17749e6`, but
remain reachable in history.

## Containment completed in this working copy

- The populated database was removed from the tracked working-tree path and a
  recoverable local copy was placed under ignored `.local/quarantine/`.
- `prisma/*.db*`, `uploads/`, `.local/`, and environment files are ignored.
- New local development uses the disposable `prisma/dev.local.db` database and
  deterministic synthetic seed data.
- Private file responses and note rendering are being hardened in Phase 0.

## Required repository-owner actions

- [ ] Determine whether the affected records belong to real people and record
  the notification decision outside this public repository.
- [ ] Treat exposed passwords as compromised: require password changes for
  affected accounts and invalidate active sessions independently of the Git
  rewrite.
- [ ] Rotate any authentication secret that may have been used with this data.
- [ ] Rewrite every canonical branch and tag to remove both `prisma/dev.db` and
  `uploads/**`, then force-update the remote from a controlled clean mirror.
- [ ] Ask GitHub Support about cached views or unreachable sensitive objects if
  applicable.
- [ ] Verify the sensitive object IDs and paths are unreachable from every
  remote ref after the rewrite.
- [ ] State explicitly in the closure record that prior clones, forks, and
  downloads may retain the exposed data.

History rewriting is destructive for collaborators and requires coordinated
owner approval. It must not be run casually from an active development
worktree.

## Closure evidence

Attach sanitized evidence for each checkbox above, the remediation date, the
decision owner, and any follow-up controls. Never attach the exposed artifacts
themselves.

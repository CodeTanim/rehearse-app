import { readFileSync, readdirSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { describe, expect, it } from "vitest"

const root = `${process.cwd()}/prisma/migrations`
const latest = "20260908010000_allow_explicit_unknown_answers"

describe("unknown-answer database migration", () => {
  it("replays the complete migration history and preserves dependent triggers", () => {
    const db = new DatabaseSync(":memory:")
    try {
      for (const name of readdirSync(root).filter((name) => /^\d/.test(name) && name !== latest).sort()) {
        db.exec(readFileSync(`${root}/${name}/migration.sql`, "utf8"))
      }
      const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all()
      db.exec(readFileSync(`${root}/${latest}/migration.sql`, "utf8"))
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
      expect(db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all()).toEqual(triggers)
      expect(db.prepare("PRAGMA foreign_keys").get()).toMatchObject({ foreign_keys: 1 })
    } finally { db.close() }
  })

  it("keeps saved answers byte-for-byte and enforces the unknown-answer rating guard", () => {
    const db = new DatabaseSync(":memory:")
    try {
      const original = readFileSync(`${root}/20260902130000_add_manual_learning_loop/migration.sql`, "utf8")
      // Isolate the two rebuilt tables; referential integrity is tested above and
      // against the backed-up local database when applying the migration.
      db.exec("PRAGMA foreign_keys=OFF")
      for (const name of ["practice_response_checkpoints", "attempts"]) {
        const ddl = original.slice(original.indexOf(`CREATE TABLE "${name}"`))
        db.exec(ddl.slice(0, ddl.indexOf("\n);") + 3))
      }
      db.exec(`INSERT INTO practice_response_checkpoints (id, session_item_id, user_id, phase, draft_answer, locked_answer, revealed_at, version, updated_at)
        VALUES ('checkpoint', 'item', 'user', 'REVEALED', '  exact answer  ', '  exact answer  ', 1, 2, 1)`)
      db.exec(`INSERT INTO attempts (id, user_id, session_item_id, question_id, question_revision_id, locked_answer, rating, revealed_at, response_time_ms,
        idempotency_key, due_at_before, due_at_after, interval_minutes_before, interval_minutes_after, repetitions_before, repetitions_after,
        lapses_before, lapses_after, schedule_algorithm_version, evidence_stage_before, evidence_stage_after, confidence_before, confidence_after)
        VALUES ('attempt', 'user', 'item', 'question', 'revision', '  exact answer  ', 'GOOD', 1, 1, 'key', 1, 2, 0, 10, 0, 1, 0, 0, 'schedule-v1', 'LEARNING', 'LEARNING', 'LOW', 'LOW')`)
      const before = db.prepare("SELECT * FROM attempts").all()
      const checkpoint = db.prepare("SELECT * FROM practice_response_checkpoints").all()
      db.exec(readFileSync(`${root}/${latest}/migration.sql`, "utf8"))
      expect(db.prepare("SELECT * FROM attempts").all()).toEqual(before)
      expect(db.prepare("SELECT * FROM practice_response_checkpoints").all()).toEqual(checkpoint)
      db.exec("PRAGMA foreign_keys=OFF")
      expect(() => db.exec("UPDATE attempts SET locked_answer = ''")).toThrow(/CHECK constraint/)
      db.exec("UPDATE attempts SET locked_answer = '', rating = 'AGAIN'")
      expect(() => db.exec("UPDATE attempts SET rating = 'EASY'")).toThrow(/CHECK constraint/)
      expect(() => db.exec("UPDATE attempts SET locked_answer = '   '")).toThrow(/CHECK constraint/)
      db.exec("UPDATE practice_response_checkpoints SET locked_answer = '', draft_answer = ''")
      expect(() => db.exec("UPDATE practice_response_checkpoints SET phase = 'SAVING', pending_rating = 'GOOD', grade_idempotency_key = 'key'")).toThrow(/CHECK constraint/)
    } finally { db.close() }
  })
})

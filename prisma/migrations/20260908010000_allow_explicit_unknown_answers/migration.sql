-- Empty locked answers encode an explicit I do not know response.
-- Preserve existing history, constraints, foreign keys, and indexes.
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;
BEGIN TRANSACTION;

CREATE TABLE "new_practice_response_checkpoints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'PROMPT',
    "draft_answer" TEXT NOT NULL DEFAULT '',
    "locked_answer" TEXT,
    "revealed_at" DATETIME,
    "pending_rating" TEXT,
    "grade_idempotency_key" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "practice_checkpoints_phase_check" CHECK ("phase" IN ('PROMPT', 'DRAFTING', 'REVEALED', 'SAVING')),
    CONSTRAINT "practice_checkpoints_draft_check" CHECK (length("draft_answer") <= 10000),
    CONSTRAINT "practice_checkpoints_locked_check" CHECK ("locked_answer" IS NULL OR "locked_answer" = '' OR length(trim("locked_answer")) BETWEEN 1 AND 10000),
    CONSTRAINT "practice_checkpoints_skip_rating_check" CHECK ("locked_answer" != '' OR "pending_rating" IS NULL OR "pending_rating" = 'AGAIN'),
    CONSTRAINT "practice_checkpoints_version_check" CHECK ("version" >= 0),
    CONSTRAINT "practice_checkpoints_reveal_state_check" CHECK ((("phase" IN ('PROMPT', 'DRAFTING')) AND "locked_answer" IS NULL AND "revealed_at" IS NULL) OR (("phase" IN ('REVEALED', 'SAVING')) AND "locked_answer" IS NOT NULL AND "revealed_at" IS NOT NULL)),
    CONSTRAINT "practice_checkpoints_grade_state_check" CHECK (("phase" != 'SAVING' AND "pending_rating" IS NULL AND "grade_idempotency_key" IS NULL) OR ("phase" = 'SAVING' AND "pending_rating" IN ('AGAIN', 'HARD', 'GOOD', 'EASY') AND length(trim("grade_idempotency_key")) BETWEEN 1 AND 200)),
    CONSTRAINT "practice_response_checkpoints_session_item_id_fkey" FOREIGN KEY ("session_item_id") REFERENCES "practice_session_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "practice_response_checkpoints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_practice_response_checkpoints" ("id", "session_item_id", "user_id", "phase", "draft_answer", "locked_answer", "revealed_at", "pending_rating", "grade_idempotency_key", "version", "updated_at")
SELECT "id", "session_item_id", "user_id", "phase", "draft_answer", "locked_answer", "revealed_at", "pending_rating", "grade_idempotency_key", "version", "updated_at" FROM "practice_response_checkpoints";
DROP TABLE "practice_response_checkpoints";
ALTER TABLE "new_practice_response_checkpoints" RENAME TO "practice_response_checkpoints";

CREATE UNIQUE INDEX "practice_response_checkpoints_session_item_id_key" ON "practice_response_checkpoints"("session_item_id");
CREATE INDEX "practice_response_checkpoints_user_id_phase_idx" ON "practice_response_checkpoints"("user_id", "phase");
CREATE UNIQUE INDEX "practice_response_checkpoints_user_id_grade_idempotency_key_key" ON "practice_response_checkpoints"("user_id", "grade_idempotency_key");

CREATE TABLE "new_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "session_item_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "question_revision_id" TEXT NOT NULL,
    "locked_answer" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "revealed_at" DATETIME NOT NULL,
    "response_time_ms" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at_before" DATETIME NOT NULL,
    "due_at_after" DATETIME NOT NULL,
    "interval_minutes_before" INTEGER NOT NULL,
    "interval_minutes_after" INTEGER NOT NULL,
    "repetitions_before" INTEGER NOT NULL,
    "repetitions_after" INTEGER NOT NULL,
    "lapses_before" INTEGER NOT NULL,
    "lapses_after" INTEGER NOT NULL,
    "schedule_algorithm_version" TEXT NOT NULL,
    "evidence_stage_before" TEXT NOT NULL,
    "evidence_stage_after" TEXT NOT NULL,
    "confidence_before" TEXT NOT NULL,
    "confidence_after" TEXT NOT NULL,
    CONSTRAINT "attempts_answer_check" CHECK (("locked_answer" = '' AND "rating" = 'AGAIN') OR length(trim("locked_answer")) BETWEEN 1 AND 10000),
    CONSTRAINT "attempts_rating_check" CHECK ("rating" IN ('AGAIN', 'HARD', 'GOOD', 'EASY')),
    CONSTRAINT "attempts_response_time_check" CHECK ("response_time_ms" >= 0),
    CONSTRAINT "attempts_idempotency_key_check" CHECK (length(trim("idempotency_key")) BETWEEN 1 AND 200),
    CONSTRAINT "attempts_intervals_check" CHECK ("interval_minutes_before" BETWEEN 0 AND 525600 AND "interval_minutes_after" BETWEEN 0 AND 525600),
    CONSTRAINT "attempts_counts_check" CHECK ("repetitions_before" >= 0 AND "repetitions_after" >= 0 AND "lapses_before" >= 0 AND "lapses_after" >= 0),
    CONSTRAINT "attempts_stage_before_check" CHECK ("evidence_stage_before" IN ('UNASSESSED', 'LEARNING', 'DEMONSTRATED', 'WELL_LEARNED')),
    CONSTRAINT "attempts_stage_after_check" CHECK ("evidence_stage_after" IN ('UNASSESSED', 'LEARNING', 'DEMONSTRATED', 'WELL_LEARNED')),
    CONSTRAINT "attempts_confidence_before_check" CHECK ("confidence_before" IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT "attempts_confidence_after_check" CHECK ("confidence_after" IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT "attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attempts_session_item_id_fkey" FOREIGN KEY ("session_item_id") REFERENCES "practice_session_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "attempts_question_revision_id_fkey" FOREIGN KEY ("question_revision_id") REFERENCES "question_revisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_attempts" ("id", "user_id", "session_item_id", "question_id", "question_revision_id", "locked_answer", "rating", "revealed_at", "response_time_ms", "idempotency_key", "occurred_at", "due_at_before", "due_at_after", "interval_minutes_before", "interval_minutes_after", "repetitions_before", "repetitions_after", "lapses_before", "lapses_after", "schedule_algorithm_version", "evidence_stage_before", "evidence_stage_after", "confidence_before", "confidence_after")
SELECT "id", "user_id", "session_item_id", "question_id", "question_revision_id", "locked_answer", "rating", "revealed_at", "response_time_ms", "idempotency_key", "occurred_at", "due_at_before", "due_at_after", "interval_minutes_before", "interval_minutes_after", "repetitions_before", "repetitions_after", "lapses_before", "lapses_after", "schedule_algorithm_version", "evidence_stage_before", "evidence_stage_after", "confidence_before", "confidence_after" FROM "attempts";
DROP TABLE "attempts";
ALTER TABLE "new_attempts" RENAME TO "attempts";

CREATE UNIQUE INDEX "attempts_session_item_id_key" ON "attempts"("session_item_id");
CREATE INDEX "attempts_user_id_occurred_at_idx" ON "attempts"("user_id", "occurred_at");
CREATE UNIQUE INDEX "attempts_user_id_idempotency_key_key" ON "attempts"("user_id", "idempotency_key");

COMMIT;
PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;

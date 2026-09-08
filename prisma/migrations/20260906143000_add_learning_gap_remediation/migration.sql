CREATE TABLE "learning_gaps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "goal_skill_id" TEXT NOT NULL,
    "concept_version_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "question_revision_id" TEXT NOT NULL,
    "initial_learning_pack_attempt_id" TEXT,
    "latest_recall_attempt_id" TEXT,
    "resolved_by_attempt_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "opened_review_day" TEXT NOT NULL,
    "opened_at" DATETIME NOT NULL,
    "resolved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "learning_gaps_status_check" CHECK ("status" IN ('OPEN', 'RESOLVED')),
    CONSTRAINT "learning_gaps_origin_check" CHECK (
        "initial_learning_pack_attempt_id" IS NOT NULL OR "latest_recall_attempt_id" IS NOT NULL
    ),
    CONSTRAINT "learning_gaps_review_day_check" CHECK (
        length("opened_review_day") = 10 AND
        substr("opened_review_day", 5, 1) = '-' AND
        substr("opened_review_day", 8, 1) = '-'
    ),
    CONSTRAINT "learning_gaps_resolution_check" CHECK (
        ("status" = 'OPEN' AND "resolved_at" IS NULL AND "resolved_by_attempt_id" IS NULL) OR
        ("status" = 'RESOLVED' AND "resolved_at" IS NOT NULL AND "resolved_by_attempt_id" IS NOT NULL)
    ),
    CONSTRAINT "learning_gaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_gaps_goal_skill_id_fkey" FOREIGN KEY ("goal_skill_id") REFERENCES "goal_skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_gaps_concept_version_id_fkey" FOREIGN KEY ("concept_version_id") REFERENCES "concept_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "learning_gaps_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "learning_gaps_question_revision_id_fkey" FOREIGN KEY ("question_revision_id") REFERENCES "question_revisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "learning_gaps_initial_learning_pack_attempt_id_fkey" FOREIGN KEY ("initial_learning_pack_attempt_id") REFERENCES "learning_pack_attempts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "learning_gaps_latest_recall_attempt_id_fkey" FOREIGN KEY ("latest_recall_attempt_id") REFERENCES "attempts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "learning_gaps_resolved_by_attempt_id_fkey" FOREIGN KEY ("resolved_by_attempt_id") REFERENCES "attempts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "learning_gaps_user_id_goal_skill_id_concept_version_id_key"
ON "learning_gaps"("user_id", "goal_skill_id", "concept_version_id");

CREATE INDEX "learning_gaps_user_id_status_opened_at_idx"
ON "learning_gaps"("user_id", "status", "opened_at");

CREATE INDEX "learning_gaps_goal_skill_id_status_idx"
ON "learning_gaps"("goal_skill_id", "status");

CREATE TABLE "remediation_revisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learning_gap_id" TEXT NOT NULL,
    "source_version_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "trigger_kind" TEXT NOT NULL,
    "trigger_key" TEXT NOT NULL,
    "gap_label" TEXT NOT NULL,
    "recommended_action" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "worked_example" TEXT,
    "scaffold_prompt" TEXT NOT NULL,
    "scaffold_answer" TEXT NOT NULL,
    "citation_locator" TEXT NOT NULL,
    "citation_excerpt" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "remediation_revisions_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "remediation_revisions_trigger_kind_check" CHECK ("trigger_kind" IN ('INITIAL_QUIZ', 'RECALL')),
    CONSTRAINT "remediation_revisions_trigger_key_check" CHECK (length(trim("trigger_key")) BETWEEN 1 AND 128),
    CONSTRAINT "remediation_revisions_label_check" CHECK (length(trim("gap_label")) BETWEEN 1 AND 200),
    CONSTRAINT "remediation_revisions_action_check" CHECK (length(trim("recommended_action")) BETWEEN 1 AND 500),
    CONSTRAINT "remediation_revisions_explanation_check" CHECK (length(trim("explanation")) BETWEEN 1 AND 2000),
    CONSTRAINT "remediation_revisions_example_check" CHECK ("worked_example" IS NULL OR length(trim("worked_example")) BETWEEN 1 AND 2000),
    CONSTRAINT "remediation_revisions_scaffold_prompt_check" CHECK (length(trim("scaffold_prompt")) BETWEEN 1 AND 2000),
    CONSTRAINT "remediation_revisions_scaffold_answer_check" CHECK (length(trim("scaffold_answer")) BETWEEN 1 AND 2000),
    CONSTRAINT "remediation_revisions_locator_check" CHECK (length(trim("citation_locator")) BETWEEN 1 AND 240),
    CONSTRAINT "remediation_revisions_excerpt_check" CHECK (length(trim("citation_excerpt")) BETWEEN 1 AND 600),
    CONSTRAINT "remediation_revisions_learning_gap_id_fkey" FOREIGN KEY ("learning_gap_id") REFERENCES "learning_gaps" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "remediation_revisions_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "source_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "remediation_revisions_learning_gap_id_revision_key"
ON "remediation_revisions"("learning_gap_id", "revision");

CREATE UNIQUE INDEX "remediation_revisions_learning_gap_id_trigger_kind_trigger_key_key"
ON "remediation_revisions"("learning_gap_id", "trigger_kind", "trigger_key");

CREATE INDEX "remediation_revisions_source_version_id_idx"
ON "remediation_revisions"("source_version_id");

CREATE TABLE "remediation_activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "learning_gap_id" TEXT NOT NULL,
    "remediation_revision_id" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "completed_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "remediation_activities_answer_check" CHECK (length(trim("answer")) BETWEEN 1 AND 4000),
    CONSTRAINT "remediation_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "remediation_activities_learning_gap_id_fkey" FOREIGN KEY ("learning_gap_id") REFERENCES "learning_gaps" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "remediation_activities_remediation_revision_id_fkey" FOREIGN KEY ("remediation_revision_id") REFERENCES "remediation_revisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "remediation_activities_user_id_learning_gap_id_remediation_revision_id_key"
ON "remediation_activities"("user_id", "learning_gap_id", "remediation_revision_id");

CREATE INDEX "remediation_activities_learning_gap_id_completed_at_idx"
ON "remediation_activities"("learning_gap_id", "completed_at");

-- Application queries scope all reads, and these triggers provide the final
-- ownership/cross-record boundary for writes in SQLite.
CREATE TRIGGER "learning_gaps_validate_insert"
BEFORE INSERT ON "learning_gaps"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "goal_skills" AS "goal_skill"
        JOIN "questions" AS "question" ON "question"."id" = NEW."question_id"
        JOIN "question_revisions" AS "revision" ON "revision"."id" = NEW."question_revision_id"
        JOIN "question_revision_concepts" AS "revision_concept"
          ON "revision_concept"."question_revision_id" = "revision"."id"
        JOIN "concept_versions" AS "concept_version"
          ON "concept_version"."id" = NEW."concept_version_id"
        JOIN "concepts" AS "concept" ON "concept"."id" = "concept_version"."concept_id"
        WHERE "goal_skill"."id" = NEW."goal_skill_id"
          AND "goal_skill"."user_id" = NEW."user_id"
          AND "question"."user_id" = NEW."user_id"
          AND "question"."skill_node_id" = "goal_skill"."skill_node_id"
          AND "revision"."question_id" = "question"."id"
          AND "revision_concept"."concept_version_id" = "concept_version"."id"
          AND "concept"."skill_node_id" = "goal_skill"."skill_node_id"
    ) THEN RAISE(ABORT, 'learning gap owner, question, or concept mismatch') END;

    SELECT CASE WHEN NEW."initial_learning_pack_attempt_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "learning_pack_attempts"
        WHERE "id" = NEW."initial_learning_pack_attempt_id"
          AND "user_id" = NEW."user_id"
          AND "goal_skill_id" = NEW."goal_skill_id"
    ) THEN RAISE(ABORT, 'learning gap initial attempt mismatch') END;

    SELECT CASE WHEN NEW."latest_recall_attempt_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM "attempts" AS "attempt"
        JOIN "practice_session_items" AS "item" ON "item"."id" = "attempt"."session_item_id"
        JOIN "practice_sessions" AS "session" ON "session"."id" = "item"."session_id"
        WHERE "attempt"."id" = NEW."latest_recall_attempt_id"
          AND "attempt"."user_id" = NEW."user_id"
          AND "attempt"."question_id" = NEW."question_id"
          AND "attempt"."question_revision_id" = NEW."question_revision_id"
          AND "session"."goal_skill_id" = NEW."goal_skill_id"
    ) THEN RAISE(ABORT, 'learning gap recall attempt mismatch') END;

    SELECT CASE WHEN NEW."resolved_by_attempt_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM "attempts" AS "attempt"
        JOIN "practice_session_items" AS "item" ON "item"."id" = "attempt"."session_item_id"
        JOIN "practice_sessions" AS "session" ON "session"."id" = "item"."session_id"
        JOIN "mastery_evidence" AS "evidence" ON "evidence"."attempt_id" = "attempt"."id"
        WHERE "attempt"."id" = NEW."resolved_by_attempt_id"
          AND "attempt"."user_id" = NEW."user_id"
          AND "session"."goal_skill_id" = NEW."goal_skill_id"
          AND "evidence"."concept_version_id" = NEW."concept_version_id"
    ) THEN RAISE(ABORT, 'learning gap resolution attempt mismatch') END;
END;

CREATE TRIGGER "learning_gaps_validate_update"
BEFORE UPDATE OF "user_id", "goal_skill_id", "concept_version_id", "question_id", "question_revision_id", "initial_learning_pack_attempt_id", "latest_recall_attempt_id", "resolved_by_attempt_id"
ON "learning_gaps"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "goal_skills" AS "goal_skill"
        JOIN "questions" AS "question" ON "question"."id" = NEW."question_id"
        JOIN "question_revisions" AS "revision" ON "revision"."id" = NEW."question_revision_id"
        JOIN "question_revision_concepts" AS "revision_concept"
          ON "revision_concept"."question_revision_id" = "revision"."id"
        JOIN "concept_versions" AS "concept_version"
          ON "concept_version"."id" = NEW."concept_version_id"
        JOIN "concepts" AS "concept" ON "concept"."id" = "concept_version"."concept_id"
        WHERE "goal_skill"."id" = NEW."goal_skill_id"
          AND "goal_skill"."user_id" = NEW."user_id"
          AND "question"."user_id" = NEW."user_id"
          AND "question"."skill_node_id" = "goal_skill"."skill_node_id"
          AND "revision"."question_id" = "question"."id"
          AND "revision_concept"."concept_version_id" = "concept_version"."id"
          AND "concept"."skill_node_id" = "goal_skill"."skill_node_id"
    ) THEN RAISE(ABORT, 'learning gap owner, question, or concept mismatch') END;

    SELECT CASE WHEN NEW."initial_learning_pack_attempt_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "learning_pack_attempts"
        WHERE "id" = NEW."initial_learning_pack_attempt_id"
          AND "user_id" = NEW."user_id"
          AND "goal_skill_id" = NEW."goal_skill_id"
    ) THEN RAISE(ABORT, 'learning gap initial attempt mismatch') END;

    SELECT CASE WHEN NEW."latest_recall_attempt_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM "attempts" AS "attempt"
        JOIN "practice_session_items" AS "item" ON "item"."id" = "attempt"."session_item_id"
        JOIN "practice_sessions" AS "session" ON "session"."id" = "item"."session_id"
        WHERE "attempt"."id" = NEW."latest_recall_attempt_id"
          AND "attempt"."user_id" = NEW."user_id"
          AND "attempt"."question_id" = NEW."question_id"
          AND "attempt"."question_revision_id" = NEW."question_revision_id"
          AND "session"."goal_skill_id" = NEW."goal_skill_id"
    ) THEN RAISE(ABORT, 'learning gap recall attempt mismatch') END;

    SELECT CASE WHEN NEW."resolved_by_attempt_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM "attempts" AS "attempt"
        JOIN "practice_session_items" AS "item" ON "item"."id" = "attempt"."session_item_id"
        JOIN "practice_sessions" AS "session" ON "session"."id" = "item"."session_id"
        JOIN "mastery_evidence" AS "evidence" ON "evidence"."attempt_id" = "attempt"."id"
        WHERE "attempt"."id" = NEW."resolved_by_attempt_id"
          AND "attempt"."user_id" = NEW."user_id"
          AND "session"."goal_skill_id" = NEW."goal_skill_id"
          AND "evidence"."concept_version_id" = NEW."concept_version_id"
    ) THEN RAISE(ABORT, 'learning gap resolution attempt mismatch') END;
END;

CREATE TRIGGER "remediation_revisions_validate_insert"
BEFORE INSERT ON "remediation_revisions"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "learning_gaps" AS "gap"
        JOIN "sources" AS "source" ON "source"."user_id" = "gap"."user_id"
        JOIN "source_versions" AS "source_version"
          ON "source_version"."id" = NEW."source_version_id"
         AND "source_version"."source_id" = "source"."id"
        WHERE "gap"."id" = NEW."learning_gap_id"
    ) THEN RAISE(ABORT, 'remediation source owner mismatch') END;
END;

CREATE TRIGGER "remediation_revisions_reject_update"
BEFORE UPDATE ON "remediation_revisions"
BEGIN
    SELECT RAISE(ABORT, 'remediation revisions are immutable');
END;

CREATE TRIGGER "remediation_activities_validate_insert"
BEFORE INSERT ON "remediation_activities"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "learning_gaps" AS "gap"
        JOIN "remediation_revisions" AS "revision"
          ON "revision"."id" = NEW."remediation_revision_id"
         AND "revision"."learning_gap_id" = "gap"."id"
        WHERE "gap"."id" = NEW."learning_gap_id"
          AND "gap"."user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'remediation activity owner or revision mismatch') END;
END;

CREATE TRIGGER "remediation_activities_reject_update"
BEFORE UPDATE ON "remediation_activities"
BEGIN
    SELECT RAISE(ABORT, 'remediation activities are immutable');
END;

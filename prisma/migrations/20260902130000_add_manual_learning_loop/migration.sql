-- Add the learner timezone used to classify distinct review days. Historical
-- evidence also snapshots the timezone, so changing this value is forward-only.
ALTER TABLE "users" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- One canonical map per user.
CREATE TABLE "skill_graphs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "skill_graphs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "learning_goals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "graph_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "target_date" DATETIME,
    "daily_minutes" INTEGER NOT NULL DEFAULT 10,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "learning_goals_title_check" CHECK (length(trim("title")) BETWEEN 1 AND 100),
    CONSTRAINT "learning_goals_outcome_check" CHECK (length(trim("outcome")) BETWEEN 1 AND 500),
    CONSTRAINT "learning_goals_slug_check" CHECK (length(trim("slug")) BETWEEN 1 AND 120),
    CONSTRAINT "learning_goals_status_check" CHECK ("status" IN ('ACTIVE', 'MAINTAINING', 'COMPLETED', 'ARCHIVED')),
    CONSTRAINT "learning_goals_daily_minutes_check" CHECK ("daily_minutes" BETWEEN 1 AND 1440),
    CONSTRAINT "learning_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_goals_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "skill_graphs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "skill_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "graph_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "outcome" TEXT,
    "default_success_criterion" TEXT,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "skill_nodes_kind_check" CHECK ("kind" IN ('BRANCH', 'SKILL')),
    CONSTRAINT "skill_nodes_title_check" CHECK (length(trim("title")) BETWEEN 1 AND 120),
    CONSTRAINT "skill_nodes_slug_check" CHECK (length(trim("slug")) BETWEEN 1 AND 140),
    CONSTRAINT "skill_nodes_outcome_check" CHECK ("outcome" IS NULL OR length(trim("outcome")) BETWEEN 1 AND 500),
    CONSTRAINT "skill_nodes_success_criterion_check" CHECK ("default_success_criterion" IS NULL OR length(trim("default_success_criterion")) BETWEEN 1 AND 500),
    CONSTRAINT "skill_nodes_state_check" CHECK ("state" IN ('DRAFT', 'READY', 'ARCHIVED')),
    CONSTRAINT "skill_nodes_sort_order_check" CHECK ("sort_order" >= 0),
    CONSTRAINT "skill_nodes_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "skill_graphs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "skill_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "skill_nodes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "goal_skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "skill_node_id" TEXT NOT NULL,
    "requirement" TEXT NOT NULL DEFAULT 'REQUIRED',
    "lifecycle" TEXT NOT NULL DEFAULT 'DRAFT',
    "current_scope_version_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "goal_skills_requirement_check" CHECK ("requirement" IN ('REQUIRED', 'OPTIONAL')),
    CONSTRAINT "goal_skills_lifecycle_check" CHECK ("lifecycle" IN ('DRAFT', 'READY', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT "goal_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goal_skills_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "learning_goals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goal_skills_skill_node_id_fkey" FOREIGN KEY ("skill_node_id") REFERENCES "skill_nodes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "goal_skills_current_scope_version_id_fkey" FOREIGN KEY ("current_scope_version_id") REFERENCES "goal_skill_scope_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "goal_skill_scope_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goal_skill_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "success_criterion" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL DEFAULT 'mastery-v1',
    "creation_reason" TEXT NOT NULL DEFAULT 'INITIAL_MANUAL_SETUP',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" DATETIME,
    CONSTRAINT "goal_skill_scope_versions_version_check" CHECK ("version" > 0),
    CONSTRAINT "goal_skill_scope_versions_outcome_check" CHECK (length(trim("outcome")) BETWEEN 1 AND 500),
    CONSTRAINT "goal_skill_scope_versions_success_check" CHECK (length(trim("success_criterion")) BETWEEN 1 AND 500),
    CONSTRAINT "goal_skill_scope_versions_goal_skill_id_fkey" FOREIGN KEY ("goal_skill_id") REFERENCES "goal_skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "concepts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skill_node_id" TEXT NOT NULL,
    "canonical_key" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "current_version_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "concepts_key_check" CHECK (length(trim("canonical_key")) BETWEEN 1 AND 140),
    CONSTRAINT "concepts_state_check" CHECK ("state" IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT "concepts_origin_check" CHECK ("origin" IN ('MANUAL', 'GENERATED')),
    CONSTRAINT "concepts_skill_node_id_fkey" FOREIGN KEY ("skill_node_id") REFERENCES "skill_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "concepts_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "concept_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "concept_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "concept_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "definition" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "concept_versions_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "concept_versions_title_check" CHECK (length(trim("title")) BETWEEN 1 AND 120),
    CONSTRAINT "concept_versions_definition_check" CHECK ("definition" IS NULL OR length(trim("definition")) BETWEEN 1 AND 1000),
    CONSTRAINT "concept_versions_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "concept_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "goal_skill_scope_concepts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope_version_id" TEXT NOT NULL,
    "concept_version_id" TEXT NOT NULL,
    "requirement" TEXT NOT NULL DEFAULT 'REQUIRED',
    "weight" REAL NOT NULL DEFAULT 1,
    CONSTRAINT "goal_skill_scope_concepts_requirement_check" CHECK ("requirement" IN ('REQUIRED', 'OPTIONAL')),
    CONSTRAINT "goal_skill_scope_concepts_weight_check" CHECK ("weight" > 0 AND "weight" <= 100),
    CONSTRAINT "goal_skill_scope_concepts_scope_version_id_fkey" FOREIGN KEY ("scope_version_id") REFERENCES "goal_skill_scope_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goal_skill_scope_concepts_concept_version_id_fkey" FOREIGN KEY ("concept_version_id") REFERENCES "concept_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "skill_node_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "type" TEXT NOT NULL DEFAULT 'FREE_RECALL',
    "current_revision_id" TEXT,
    "scheduling_eligible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "questions_state_check" CHECK ("state" IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    CONSTRAINT "questions_origin_check" CHECK ("origin" IN ('MANUAL', 'GENERATED')),
    CONSTRAINT "questions_type_check" CHECK ("type" = 'FREE_RECALL'),
    CONSTRAINT "questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "questions_skill_node_id_fkey" FOREIGN KEY ("skill_node_id") REFERENCES "skill_nodes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "questions_current_revision_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "question_revisions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "goal_questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goal_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "goal_questions_status_check" CHECK ("status" IN ('ACTIVE', 'EXCLUDED')),
    CONSTRAINT "goal_questions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "learning_goals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goal_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "question_revisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "reference_answer" TEXT NOT NULL,
    "explanation" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "question_revisions_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "question_revisions_prompt_check" CHECK (length(trim("prompt")) BETWEEN 1 AND 2000),
    CONSTRAINT "question_revisions_answer_check" CHECK (length(trim("reference_answer")) BETWEEN 1 AND 10000),
    CONSTRAINT "question_revisions_explanation_check" CHECK ("explanation" IS NULL OR length(trim("explanation")) BETWEEN 1 AND 5000),
    CONSTRAINT "question_revisions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "question_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "question_revision_concepts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question_revision_id" TEXT NOT NULL,
    "concept_version_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "question_revision_concepts_primary_check" CHECK ("is_primary" IN (0, 1)),
    CONSTRAINT "question_revision_concepts_question_revision_id_fkey" FOREIGN KEY ("question_revision_id") REFERENCES "question_revisions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "question_revision_concepts_concept_version_id_fkey" FOREIGN KEY ("concept_version_id") REFERENCES "concept_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "review_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "question_revision_id" TEXT NOT NULL,
    "due_at" DATETIME NOT NULL,
    "interval_minutes" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "last_reviewed_at" DATETIME,
    "algorithm_version" TEXT NOT NULL DEFAULT 'schedule-v1',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "review_schedules_interval_check" CHECK ("interval_minutes" BETWEEN 0 AND 525600),
    CONSTRAINT "review_schedules_repetitions_check" CHECK ("repetitions" >= 0),
    CONSTRAINT "review_schedules_lapses_check" CHECK ("lapses" >= 0),
    CONSTRAINT "review_schedules_version_check" CHECK ("version" >= 0),
    CONSTRAINT "review_schedules_algorithm_check" CHECK ("algorithm_version" = 'schedule-v1'),
    CONSTRAINT "review_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "review_schedules_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "review_schedules_question_revision_id_fkey" FOREIGN KEY ("question_revision_id") REFERENCES "question_revisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "practice_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "goal_skill_id" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "target_count" INTEGER NOT NULL DEFAULT 1,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    CONSTRAINT "practice_sessions_reason_check" CHECK ("reason" IN ('BASELINE', 'DUE', 'SKILL')),
    CONSTRAINT "practice_sessions_status_check" CHECK ("status" IN ('ACTIVE', 'COMPLETED')),
    CONSTRAINT "practice_sessions_target_check" CHECK ("target_count" > 0),
    CONSTRAINT "practice_sessions_completion_check" CHECK (("status" = 'ACTIVE' AND "completed_at" IS NULL) OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL)),
    CONSTRAINT "practice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "practice_sessions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "learning_goals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "practice_sessions_goal_skill_id_fkey" FOREIGN KEY ("goal_skill_id") REFERENCES "goal_skills" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "practice_session_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "question_revision_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENTED',
    "schedule_due_at_before" DATETIME NOT NULL,
    "interval_minutes_before" INTEGER NOT NULL,
    "repetitions_before" INTEGER NOT NULL,
    "lapses_before" INTEGER NOT NULL,
    "schedule_algorithm_version" TEXT NOT NULL,
    "presented_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "result_json" TEXT,
    CONSTRAINT "practice_session_items_ordinal_check" CHECK ("ordinal" >= 0),
    CONSTRAINT "practice_session_items_status_check" CHECK ("status" IN ('PRESENTED', 'COMPLETED')),
    CONSTRAINT "practice_session_items_interval_check" CHECK ("interval_minutes_before" BETWEEN 0 AND 525600),
    CONSTRAINT "practice_session_items_counts_check" CHECK ("repetitions_before" >= 0 AND "lapses_before" >= 0),
    CONSTRAINT "practice_session_items_completion_check" CHECK (("status" = 'PRESENTED' AND "completed_at" IS NULL) OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL)),
    CONSTRAINT "practice_session_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "practice_session_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "practice_session_items_question_revision_id_fkey" FOREIGN KEY ("question_revision_id") REFERENCES "question_revisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "practice_response_checkpoints" (
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
    CONSTRAINT "practice_checkpoints_locked_check" CHECK ("locked_answer" IS NULL OR length(trim("locked_answer")) BETWEEN 1 AND 10000),
    CONSTRAINT "practice_checkpoints_version_check" CHECK ("version" >= 0),
    CONSTRAINT "practice_checkpoints_reveal_state_check" CHECK ((("phase" IN ('PROMPT', 'DRAFTING')) AND "locked_answer" IS NULL AND "revealed_at" IS NULL) OR (("phase" IN ('REVEALED', 'SAVING')) AND "locked_answer" IS NOT NULL AND "revealed_at" IS NOT NULL)),
    CONSTRAINT "practice_checkpoints_grade_state_check" CHECK (("phase" != 'SAVING' AND "pending_rating" IS NULL AND "grade_idempotency_key" IS NULL) OR ("phase" = 'SAVING' AND "pending_rating" IN ('AGAIN', 'HARD', 'GOOD', 'EASY') AND length(trim("grade_idempotency_key")) BETWEEN 1 AND 200)),
    CONSTRAINT "practice_response_checkpoints_session_item_id_fkey" FOREIGN KEY ("session_item_id") REFERENCES "practice_session_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "practice_response_checkpoints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "attempts" (
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
    CONSTRAINT "attempts_answer_check" CHECK (length(trim("locked_answer")) BETWEEN 1 AND 10000),
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

CREATE TABLE "mastery_evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "concept_version_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SELF_ASSESSED_RECALL',
    "normalized_score" REAL NOT NULL,
    "weight" REAL NOT NULL,
    "review_day" TEXT NOT NULL,
    "review_timezone" TEXT NOT NULL,
    "occurred_at" DATETIME NOT NULL,
    "algorithm_version" TEXT NOT NULL DEFAULT 'mastery-v1',
    CONSTRAINT "mastery_evidence_kind_check" CHECK ("kind" = 'SELF_ASSESSED_RECALL'),
    CONSTRAINT "mastery_evidence_score_check" CHECK ("normalized_score" BETWEEN 0 AND 1),
    CONSTRAINT "mastery_evidence_weight_check" CHECK ("weight" IN (0, 0.5, 1)),
    CONSTRAINT "mastery_evidence_day_check" CHECK (length("review_day") = 10),
    CONSTRAINT "mastery_evidence_timezone_check" CHECK (length(trim("review_timezone")) BETWEEN 1 AND 100),
    CONSTRAINT "mastery_evidence_algorithm_check" CHECK ("algorithm_version" = 'mastery-v1'),
    CONSTRAINT "mastery_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mastery_evidence_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mastery_evidence_concept_version_id_fkey" FOREIGN KEY ("concept_version_id") REFERENCES "concept_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "goal_skill_readiness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goal_skill_id" TEXT NOT NULL,
    "scope_version_id" TEXT NOT NULL,
    "rule_version" TEXT NOT NULL DEFAULT 'mastery-v1',
    "stage" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "scope_coverage" REAL NOT NULL DEFAULT 0,
    "self_assessed_index" REAL,
    "recent_three_session_index" REAL,
    "full_weight_reviews" INTEGER NOT NULL DEFAULT 0,
    "successful_full_weight_reviews" INTEGER NOT NULL DEFAULT 0,
    "distinct_review_days" INTEGER NOT NULL DEFAULT 0,
    "span_days" INTEGER NOT NULL DEFAULT 0,
    "completed_sessions" INTEGER NOT NULL DEFAULT 0,
    "latest_rating" TEXT,
    "earliest_due_at" DATETIME,
    "explanation_json" TEXT NOT NULL,
    "computed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goal_skill_readiness_rule_check" CHECK ("rule_version" = 'mastery-v1'),
    CONSTRAINT "goal_skill_readiness_stage_check" CHECK ("stage" IN ('UNASSESSED', 'LEARNING', 'DEMONSTRATED', 'WELL_LEARNED')),
    CONSTRAINT "goal_skill_readiness_confidence_check" CHECK ("confidence" IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT "goal_skill_readiness_coverage_check" CHECK ("scope_coverage" BETWEEN 0 AND 1),
    CONSTRAINT "goal_skill_readiness_index_check" CHECK (("self_assessed_index" IS NULL OR "self_assessed_index" BETWEEN 0 AND 1) AND ("recent_three_session_index" IS NULL OR "recent_three_session_index" BETWEEN 0 AND 1)),
    CONSTRAINT "goal_skill_readiness_counts_check" CHECK ("full_weight_reviews" >= 0 AND "successful_full_weight_reviews" >= 0 AND "distinct_review_days" >= 0 AND "span_days" >= 0 AND "completed_sessions" >= 0),
    CONSTRAINT "goal_skill_readiness_latest_rating_check" CHECK ("latest_rating" IS NULL OR "latest_rating" IN ('AGAIN', 'HARD', 'GOOD', 'EASY')),
    CONSTRAINT "goal_skill_readiness_explanation_check" CHECK (length(trim("explanation_json")) > 0),
    CONSTRAINT "goal_skill_readiness_goal_skill_id_fkey" FOREIGN KEY ("goal_skill_id") REFERENCES "goal_skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goal_skill_readiness_scope_version_id_fkey" FOREIGN KEY ("scope_version_id") REFERENCES "goal_skill_scope_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "skill_graphs_user_id_key" ON "skill_graphs"("user_id");
CREATE INDEX "learning_goals_user_id_status_idx" ON "learning_goals"("user_id", "status");
CREATE INDEX "learning_goals_graph_id_idx" ON "learning_goals"("graph_id");
CREATE UNIQUE INDEX "learning_goals_user_id_slug_key" ON "learning_goals"("user_id", "slug");
CREATE UNIQUE INDEX "learning_goals_one_live_per_user_key" ON "learning_goals"("user_id") WHERE "status" IN ('ACTIVE', 'MAINTAINING');
CREATE INDEX "skill_nodes_graph_id_parent_id_sort_order_idx" ON "skill_nodes"("graph_id", "parent_id", "sort_order");
CREATE UNIQUE INDEX "skill_nodes_graph_id_slug_key" ON "skill_nodes"("graph_id", "slug");
CREATE UNIQUE INDEX "goal_skills_current_scope_version_id_key" ON "goal_skills"("current_scope_version_id");
CREATE INDEX "goal_skills_user_id_lifecycle_idx" ON "goal_skills"("user_id", "lifecycle");
CREATE UNIQUE INDEX "goal_skills_goal_id_skill_node_id_key" ON "goal_skills"("goal_id", "skill_node_id");
CREATE UNIQUE INDEX "goal_skill_scope_versions_goal_skill_id_version_key" ON "goal_skill_scope_versions"("goal_skill_id", "version");
CREATE UNIQUE INDEX "concepts_current_version_id_key" ON "concepts"("current_version_id");
CREATE UNIQUE INDEX "concepts_skill_node_id_canonical_key_key" ON "concepts"("skill_node_id", "canonical_key");
CREATE UNIQUE INDEX "concept_versions_concept_id_revision_key" ON "concept_versions"("concept_id", "revision");
CREATE UNIQUE INDEX "goal_skill_scope_concepts_scope_version_id_concept_version_id_key" ON "goal_skill_scope_concepts"("scope_version_id", "concept_version_id");
CREATE UNIQUE INDEX "questions_current_revision_id_key" ON "questions"("current_revision_id");
CREATE INDEX "questions_user_id_state_idx" ON "questions"("user_id", "state");
CREATE UNIQUE INDEX "goal_questions_goal_id_question_id_key" ON "goal_questions"("goal_id", "question_id");
CREATE UNIQUE INDEX "question_revisions_question_id_revision_key" ON "question_revisions"("question_id", "revision");
CREATE UNIQUE INDEX "question_revision_concepts_question_revision_id_concept_version_id_key" ON "question_revision_concepts"("question_revision_id", "concept_version_id");
CREATE UNIQUE INDEX "question_revision_concepts_one_primary_key" ON "question_revision_concepts"("question_revision_id") WHERE "is_primary" = 1;
CREATE INDEX "review_schedules_user_id_due_at_idx" ON "review_schedules"("user_id", "due_at");
CREATE UNIQUE INDEX "review_schedules_user_id_question_id_key" ON "review_schedules"("user_id", "question_id");
CREATE INDEX "practice_sessions_user_id_status_idx" ON "practice_sessions"("user_id", "status");
CREATE UNIQUE INDEX "practice_sessions_one_active_per_user_key" ON "practice_sessions"("user_id") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "practice_session_items_session_id_ordinal_key" ON "practice_session_items"("session_id", "ordinal");
CREATE UNIQUE INDEX "practice_session_items_session_id_question_revision_id_key" ON "practice_session_items"("session_id", "question_revision_id");
CREATE UNIQUE INDEX "practice_response_checkpoints_session_item_id_key" ON "practice_response_checkpoints"("session_item_id");
CREATE INDEX "practice_response_checkpoints_user_id_phase_idx" ON "practice_response_checkpoints"("user_id", "phase");
CREATE UNIQUE INDEX "practice_response_checkpoints_user_id_grade_idempotency_key_key" ON "practice_response_checkpoints"("user_id", "grade_idempotency_key");
CREATE UNIQUE INDEX "attempts_session_item_id_key" ON "attempts"("session_item_id");
CREATE INDEX "attempts_user_id_occurred_at_idx" ON "attempts"("user_id", "occurred_at");
CREATE UNIQUE INDEX "attempts_user_id_idempotency_key_key" ON "attempts"("user_id", "idempotency_key");
CREATE INDEX "mastery_evidence_user_id_concept_version_id_review_day_idx" ON "mastery_evidence"("user_id", "concept_version_id", "review_day");
CREATE UNIQUE INDEX "mastery_evidence_attempt_id_concept_version_id_key" ON "mastery_evidence"("attempt_id", "concept_version_id");
CREATE UNIQUE INDEX "goal_skill_readiness_goal_skill_id_scope_version_id_rule_version_key" ON "goal_skill_readiness"("goal_skill_id", "scope_version_id", "rule_version");

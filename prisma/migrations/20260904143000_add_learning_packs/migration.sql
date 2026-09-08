CREATE TABLE "learning_packs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "goal_skill_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'READY',
    "current_version_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "learning_packs_state_check" CHECK ("state" IN ('READY', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT "learning_packs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_packs_goal_skill_id_fkey" FOREIGN KEY ("goal_skill_id") REFERENCES "goal_skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_packs_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "learning_pack_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "learning_pack_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learning_pack_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "input_hash" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "generator_version" TEXT NOT NULL DEFAULT 'learning-pack-v1',
    "schema_version" TEXT NOT NULL DEFAULT 'learning-pack-v1',
    "source_version_ids_json" TEXT NOT NULL,
    "content_json" TEXT NOT NULL,
    "consented_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_pack_versions_version_check" CHECK ("version" > 0),
    CONSTRAINT "learning_pack_versions_input_hash_check" CHECK (length("input_hash") = 64 AND "input_hash" NOT GLOB '*[^0-9a-f]*'),
    CONSTRAINT "learning_pack_versions_model_check" CHECK (length(trim("model_id")) BETWEEN 1 AND 200),
    CONSTRAINT "learning_pack_versions_generator_check" CHECK (length(trim("generator_version")) BETWEEN 1 AND 100),
    CONSTRAINT "learning_pack_versions_schema_check" CHECK (length(trim("schema_version")) BETWEEN 1 AND 100),
    CONSTRAINT "learning_pack_versions_source_ids_check" CHECK (json_valid("source_version_ids_json")),
    CONSTRAINT "learning_pack_versions_content_check" CHECK (json_valid("content_json")),
    CONSTRAINT "learning_pack_versions_learning_pack_id_fkey" FOREIGN KEY ("learning_pack_id") REFERENCES "learning_packs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "learning_pack_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "goal_skill_id" TEXT NOT NULL,
    "learning_pack_version_id" TEXT NOT NULL,
    "body_hash" TEXT NOT NULL,
    "answers_json" TEXT NOT NULL,
    "result_json" TEXT NOT NULL,
    "met_count" INTEGER NOT NULL,
    "question_count" INTEGER NOT NULL,
    "started_at" DATETIME NOT NULL,
    "completed_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_pack_attempts_body_hash_check" CHECK (length("body_hash") = 64 AND "body_hash" NOT GLOB '*[^0-9a-f]*'),
    CONSTRAINT "learning_pack_attempts_answers_check" CHECK (json_valid("answers_json")),
    CONSTRAINT "learning_pack_attempts_result_check" CHECK (json_valid("result_json")),
    CONSTRAINT "learning_pack_attempts_counts_check" CHECK ("question_count" > 0 AND "met_count" BETWEEN 0 AND "question_count"),
    CONSTRAINT "learning_pack_attempts_time_check" CHECK ("completed_at" >= "started_at"),
    CONSTRAINT "learning_pack_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_pack_attempts_goal_skill_id_fkey" FOREIGN KEY ("goal_skill_id") REFERENCES "goal_skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_pack_attempts_learning_pack_version_id_fkey" FOREIGN KEY ("learning_pack_version_id") REFERENCES "learning_pack_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "learning_packs_goal_skill_id_key" ON "learning_packs"("goal_skill_id");
CREATE UNIQUE INDEX "learning_packs_current_version_id_key" ON "learning_packs"("current_version_id");
CREATE UNIQUE INDEX "learning_packs_user_id_goal_skill_id_key" ON "learning_packs"("user_id", "goal_skill_id");
CREATE INDEX "learning_packs_user_id_state_idx" ON "learning_packs"("user_id", "state");
CREATE UNIQUE INDEX "learning_pack_versions_learning_pack_id_version_key" ON "learning_pack_versions"("learning_pack_id", "version");
CREATE UNIQUE INDEX "learning_pack_versions_learning_pack_id_input_hash_key" ON "learning_pack_versions"("learning_pack_id", "input_hash");
CREATE INDEX "learning_pack_versions_learning_pack_id_created_at_idx" ON "learning_pack_versions"("learning_pack_id", "created_at");
CREATE INDEX "learning_pack_attempts_user_id_goal_skill_id_completed_at_idx" ON "learning_pack_attempts"("user_id", "goal_skill_id", "completed_at");
CREATE UNIQUE INDEX "learning_pack_attempts_user_id_learning_pack_version_id_key" ON "learning_pack_attempts"("user_id", "learning_pack_version_id");

CREATE TRIGGER "learning_packs_validate_insert"
BEFORE INSERT ON "learning_packs"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "goal_skills"
        WHERE "id" = NEW."goal_skill_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'learning pack owner mismatch') END;
END;

CREATE TRIGGER "learning_packs_validate_update"
BEFORE UPDATE OF "user_id", "goal_skill_id", "current_version_id" ON "learning_packs"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "goal_skills"
        WHERE "id" = NEW."goal_skill_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'learning pack owner mismatch') END;
    SELECT CASE WHEN NEW."current_version_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "learning_pack_versions"
        WHERE "id" = NEW."current_version_id" AND "learning_pack_id" = NEW."id"
    ) THEN RAISE(ABORT, 'current learning pack version mismatch') END;
END;

CREATE TRIGGER "learning_pack_versions_reject_update"
BEFORE UPDATE ON "learning_pack_versions"
BEGIN
    SELECT RAISE(ABORT, 'learning pack versions are immutable');
END;

CREATE TRIGGER "learning_pack_attempts_validate_insert"
BEFORE INSERT ON "learning_pack_attempts"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "goal_skills"
        WHERE "id" = NEW."goal_skill_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'learning pack attempt owner mismatch') END;
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "learning_pack_versions" AS version
        JOIN "learning_packs" AS pack ON pack."id" = version."learning_pack_id"
        WHERE version."id" = NEW."learning_pack_version_id"
          AND pack."goal_skill_id" = NEW."goal_skill_id"
          AND pack."user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'learning pack attempt version mismatch') END;
END;

CREATE TRIGGER "learning_pack_attempts_reject_update"
BEFORE UPDATE ON "learning_pack_attempts"
BEGIN
    SELECT RAISE(ABORT, 'learning pack attempts are immutable');
END;

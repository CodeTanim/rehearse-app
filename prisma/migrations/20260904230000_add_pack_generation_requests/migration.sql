CREATE TABLE "learning_pack_generation_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "goal_skill_id" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "source_version_ids_json" TEXT NOT NULL,
    "consented_at" DATETIME NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "active_user_key" TEXT,
    "failure_code" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "learning_pack_generation_requests_hash_check" CHECK (length("input_hash") = 64 AND "input_hash" NOT GLOB '*[^0-9a-f]*'),
    CONSTRAINT "learning_pack_generation_requests_model_check" CHECK (length(trim("model_id")) BETWEEN 1 AND 200),
    CONSTRAINT "learning_pack_generation_requests_sources_check" CHECK (json_valid("source_version_ids_json") AND json_array_length("source_version_ids_json") > 0),
    CONSTRAINT "learning_pack_generation_requests_status_check" CHECK ("status" IN ('PENDING', 'SUCCEEDED', 'FAILED')),
    CONSTRAINT "learning_pack_generation_requests_expiry_check" CHECK ("expires_at" > "consented_at"),
    CONSTRAINT "learning_pack_generation_requests_active_check" CHECK (("status" = 'PENDING' AND "active_user_key" = "user_id") OR ("status" != 'PENDING' AND "active_user_key" IS NULL)),
    CONSTRAINT "learning_pack_generation_requests_failure_check" CHECK (("status" = 'FAILED' AND "failure_code" IS NOT NULL) OR ("status" != 'FAILED' AND "failure_code" IS NULL)),
    CONSTRAINT "learning_pack_generation_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_pack_generation_requests_goal_skill_id_fkey" FOREIGN KEY ("goal_skill_id") REFERENCES "goal_skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "learning_pack_generation_requests_active_user_key_key"
ON "learning_pack_generation_requests"("active_user_key");

CREATE INDEX "learning_pack_generation_requests_user_id_created_at_idx"
ON "learning_pack_generation_requests"("user_id", "created_at");

CREATE INDEX "learning_pack_generation_requests_goal_skill_id_status_idx"
ON "learning_pack_generation_requests"("goal_skill_id", "status");

CREATE TRIGGER "learning_pack_generation_requests_validate_insert"
BEFORE INSERT ON "learning_pack_generation_requests"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "goal_skills"
        WHERE "id" = NEW."goal_skill_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'learning pack generation request owner mismatch') END;
END;

CREATE TRIGGER "learning_pack_generation_requests_validate_update"
BEFORE UPDATE OF "user_id", "goal_skill_id" ON "learning_pack_generation_requests"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "goal_skills"
        WHERE "id" = NEW."goal_skill_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'learning pack generation request owner mismatch') END;
END;

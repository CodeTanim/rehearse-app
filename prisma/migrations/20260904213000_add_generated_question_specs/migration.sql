ALTER TABLE "goal_skill_readiness" ADD COLUMN "successful_transfer_probes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "goal_skill_readiness" ADD COLUMN "transfer_review_days" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "learning_pack_version_sources" (
    "learning_pack_version_id" TEXT NOT NULL,
    "source_version_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    PRIMARY KEY ("learning_pack_version_id", "source_version_id"),
    CONSTRAINT "learning_pack_version_sources_ordinal_check" CHECK ("ordinal" >= 0),
    CONSTRAINT "learning_pack_version_sources_learning_pack_version_id_fkey" FOREIGN KEY ("learning_pack_version_id") REFERENCES "learning_pack_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_pack_version_sources_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "source_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "learning_pack_version_sources_learning_pack_version_id_ordinal_key"
ON "learning_pack_version_sources"("learning_pack_version_id", "ordinal");

CREATE INDEX "learning_pack_version_sources_source_version_id_idx"
ON "learning_pack_version_sources"("source_version_id");

INSERT INTO "learning_pack_version_sources" (
    "learning_pack_version_id",
    "source_version_id",
    "ordinal"
)
SELECT
    version."id",
    source_id.value,
    CAST(source_id.key AS INTEGER)
FROM "learning_pack_versions" AS version,
     json_each(version."source_version_ids_json") AS source_id;

CREATE TABLE "generated_question_specs" (
    "question_id" TEXT NOT NULL PRIMARY KEY,
    "learning_pack_version_id" TEXT NOT NULL,
    "source_version_id" TEXT NOT NULL,
    "question_family_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "original_index" INTEGER NOT NULL,
    "response_type" TEXT NOT NULL,
    "choices_json" TEXT NOT NULL,
    "correct_choice_index" INTEGER,
    "citation_locator" TEXT NOT NULL,
    "citation_excerpt" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_question_specs_role_check" CHECK ("role" IN ('CORE', 'TRANSFER')),
    CONSTRAINT "generated_question_specs_index_check" CHECK ("original_index" BETWEEN 0 AND 5),
    CONSTRAINT "generated_question_specs_response_type_check" CHECK ("response_type" IN ('MULTIPLE_CHOICE', 'SHORT_RESPONSE')),
    CONSTRAINT "generated_question_specs_choices_check" CHECK (json_valid("choices_json")),
    CONSTRAINT "generated_question_specs_answer_shape_check" CHECK (
        ("response_type" = 'MULTIPLE_CHOICE' AND json_array_length("choices_json") = 4 AND "correct_choice_index" BETWEEN 0 AND 3)
        OR
        ("response_type" = 'SHORT_RESPONSE' AND json_array_length("choices_json") = 0 AND "correct_choice_index" IS NULL)
    ),
    CONSTRAINT "generated_question_specs_family_check" CHECK (length(trim("question_family_id")) BETWEEN 1 AND 80),
    CONSTRAINT "generated_question_specs_locator_check" CHECK (length(trim("citation_locator")) BETWEEN 1 AND 240),
    CONSTRAINT "generated_question_specs_excerpt_check" CHECK (length(trim("citation_excerpt")) BETWEEN 1 AND 600),
    CONSTRAINT "generated_question_specs_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "generated_question_specs_learning_pack_version_id_fkey" FOREIGN KEY ("learning_pack_version_id") REFERENCES "learning_pack_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "generated_question_specs_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "source_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "generated_question_specs_learning_pack_version_id_original_index_key"
ON "generated_question_specs"("learning_pack_version_id", "original_index");

CREATE INDEX "generated_question_specs_learning_pack_version_id_role_idx"
ON "generated_question_specs"("learning_pack_version_id", "role");

CREATE INDEX "generated_question_specs_source_version_id_idx"
ON "generated_question_specs"("source_version_id");

CREATE TRIGGER "generated_question_specs_validate_insert"
BEFORE INSERT ON "generated_question_specs"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "questions" AS question
        JOIN "learning_pack_versions" AS version ON version."id" = NEW."learning_pack_version_id"
        JOIN "learning_packs" AS pack ON pack."id" = version."learning_pack_id"
        WHERE question."id" = NEW."question_id"
          AND question."origin" = 'GENERATED'
          AND question."user_id" = pack."user_id"
          AND question."skill_node_id" = (
              SELECT "skill_node_id" FROM "goal_skills" WHERE "id" = pack."goal_skill_id"
          )
    ) THEN RAISE(ABORT, 'generated question owner or skill mismatch') END;

    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "learning_pack_versions" AS version,
             json_each(version."source_version_ids_json") AS source_id
        WHERE version."id" = NEW."learning_pack_version_id"
          AND source_id.value = NEW."source_version_id"
    ) THEN RAISE(ABORT, 'generated question source is outside pack') END;
END;

CREATE TRIGGER "generated_question_specs_reject_update"
BEFORE UPDATE ON "generated_question_specs"
BEGIN
    SELECT RAISE(ABORT, 'generated question specs are immutable');
END;

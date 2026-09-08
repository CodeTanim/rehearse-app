CREATE TABLE "sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "canonical_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "display_url" TEXT,
    "current_version_id" TEXT,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sources_type_check" CHECK ("type" IN ('TEXT', 'URL')),
    CONSTRAINT "sources_origin_check" CHECK (
        ("type" = 'TEXT' AND "origin" = 'PASTED') OR
        ("type" = 'URL' AND "origin" = 'WEBSITE')
    ),
    CONSTRAINT "sources_status_check" CHECK ("status" IN ('READY', 'FAILED', 'ARCHIVED')),
    CONSTRAINT "sources_key_check" CHECK (
        length("canonical_key") = 64 AND
        "canonical_key" NOT GLOB '*[^0-9a-f]*'
    ),
    CONSTRAINT "sources_display_name_check" CHECK (length(trim("display_name")) BETWEEN 1 AND 200),
    CONSTRAINT "sources_display_url_check" CHECK (
        ("type" = 'TEXT' AND "display_url" IS NULL) OR
        ("type" = 'URL' AND length(trim("display_url")) BETWEEN 1 AND 2048)
    ),
    CONSTRAINT "sources_archive_state_check" CHECK (
        ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL) OR
        ("status" != 'ARCHIVED' AND "archived_at" IS NULL)
    ),
    CONSTRAINT "sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sources_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "source_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "source_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "extracted_text" TEXT NOT NULL,
    "retrieved_at" DATETIME NOT NULL,
    "extractor_version" TEXT NOT NULL DEFAULT 'text-v1',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "source_versions_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "source_versions_mime_check" CHECK ("mime_type" IN ('text/plain', 'text/html')),
    CONSTRAINT "source_versions_byte_size_check" CHECK ("byte_size" BETWEEN 1 AND 524288),
    CONSTRAINT "source_versions_sha_check" CHECK (
        length("sha256") = 64 AND
        "sha256" NOT GLOB '*[^0-9a-f]*'
    ),
    CONSTRAINT "source_versions_text_check" CHECK (length(trim("extracted_text")) BETWEEN 1 AND 524288),
    CONSTRAINT "source_versions_extractor_check" CHECK (length(trim("extractor_version")) BETWEEN 1 AND 100),
    CONSTRAINT "source_versions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "skill_source_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "goal_skill_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_version_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INCLUDED',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "skill_source_assignments_status_check" CHECK ("status" IN ('INCLUDED', 'EXCLUDED')),
    CONSTRAINT "skill_source_assignments_sort_check" CHECK ("sort_order" >= 0),
    CONSTRAINT "skill_source_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "skill_source_assignments_goal_skill_id_fkey" FOREIGN KEY ("goal_skill_id") REFERENCES "goal_skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "skill_source_assignments_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "skill_source_assignments_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "source_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sources_current_version_id_key" ON "sources"("current_version_id");
CREATE UNIQUE INDEX "sources_user_id_type_canonical_key_key" ON "sources"("user_id", "type", "canonical_key");
CREATE INDEX "sources_user_id_status_idx" ON "sources"("user_id", "status");
CREATE UNIQUE INDEX "source_versions_source_id_revision_key" ON "source_versions"("source_id", "revision");
CREATE UNIQUE INDEX "source_versions_source_id_sha256_key" ON "source_versions"("source_id", "sha256");
CREATE INDEX "source_versions_source_id_created_at_idx" ON "source_versions"("source_id", "created_at");
CREATE UNIQUE INDEX "skill_source_assignments_goal_skill_id_source_id_key" ON "skill_source_assignments"("goal_skill_id", "source_id");
CREATE INDEX "skill_source_assignments_user_id_goal_skill_id_status_idx" ON "skill_source_assignments"("user_id", "goal_skill_id", "status");

-- Source versions are immutable audit snapshots. Cascading deletion remains
-- available for a future explicit account hard-delete workflow.
CREATE TRIGGER "source_versions_reject_update"
BEFORE UPDATE ON "source_versions"
BEGIN
    SELECT RAISE(ABORT, 'source versions are immutable');
END;

-- SQLite cannot express these ownership-sensitive compound relations in the
-- current Prisma model, so triggers provide the final database boundary.
CREATE TRIGGER "sources_validate_current_version_insert"
BEFORE INSERT ON "sources"
WHEN NEW."current_version_id" IS NOT NULL
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "source_versions"
        WHERE "id" = NEW."current_version_id" AND "source_id" = NEW."id"
    ) THEN RAISE(ABORT, 'current source version must belong to source') END;
END;

CREATE TRIGGER "sources_validate_current_version_update"
BEFORE UPDATE OF "current_version_id" ON "sources"
WHEN NEW."current_version_id" IS NOT NULL
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "source_versions"
        WHERE "id" = NEW."current_version_id" AND "source_id" = NEW."id"
    ) THEN RAISE(ABORT, 'current source version must belong to source') END;
END;

CREATE TRIGGER "skill_source_assignments_validate_insert"
BEFORE INSERT ON "skill_source_assignments"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "goal_skills"
        WHERE "id" = NEW."goal_skill_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'goal skill owner mismatch') END;
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "sources"
        WHERE "id" = NEW."source_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'source owner mismatch') END;
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "source_versions"
        WHERE "id" = NEW."source_version_id" AND "source_id" = NEW."source_id"
    ) THEN RAISE(ABORT, 'source version mismatch') END;
END;

CREATE TRIGGER "skill_source_assignments_validate_update"
BEFORE UPDATE OF "user_id", "goal_skill_id", "source_id", "source_version_id" ON "skill_source_assignments"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "goal_skills"
        WHERE "id" = NEW."goal_skill_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'goal skill owner mismatch') END;
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "sources"
        WHERE "id" = NEW."source_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'source owner mismatch') END;
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "source_versions"
        WHERE "id" = NEW."source_version_id" AND "source_id" = NEW."source_id"
    ) THEN RAISE(ABORT, 'source version mismatch') END;
END;

CREATE TABLE "initial_quiz_drafts" (
  "pack_version_id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "attempt_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "state_json" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "initial_quiz_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "initial_quiz_drafts_pack_version_id_fkey" FOREIGN KEY ("pack_version_id") REFERENCES "learning_pack_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "initial_quiz_drafts_attempt_id_key" ON "initial_quiz_drafts"("attempt_id");
CREATE INDEX "initial_quiz_drafts_user_id_idx" ON "initial_quiz_drafts"("user_id");

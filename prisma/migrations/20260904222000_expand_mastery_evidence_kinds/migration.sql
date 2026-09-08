PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_mastery_evidence" (
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
    CONSTRAINT "mastery_evidence_kind_check" CHECK ("kind" IN ('SELF_ASSESSED_RECALL', 'OBJECTIVE_RECALL', 'SELF_ASSESSED_TRANSFER', 'OBJECTIVE_TRANSFER')),
    CONSTRAINT "mastery_evidence_score_check" CHECK ("normalized_score" BETWEEN 0 AND 1),
    CONSTRAINT "mastery_evidence_weight_check" CHECK ("weight" IN (0, 0.5, 1)),
    CONSTRAINT "mastery_evidence_day_check" CHECK (length("review_day") = 10),
    CONSTRAINT "mastery_evidence_timezone_check" CHECK (length(trim("review_timezone")) BETWEEN 1 AND 100),
    CONSTRAINT "mastery_evidence_algorithm_check" CHECK ("algorithm_version" = 'mastery-v1'),
    CONSTRAINT "mastery_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mastery_evidence_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mastery_evidence_concept_version_id_fkey" FOREIGN KEY ("concept_version_id") REFERENCES "concept_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_mastery_evidence" (
    "algorithm_version",
    "attempt_id",
    "concept_version_id",
    "id",
    "kind",
    "normalized_score",
    "occurred_at",
    "review_day",
    "review_timezone",
    "user_id",
    "weight"
)
SELECT
    "algorithm_version",
    "attempt_id",
    "concept_version_id",
    "id",
    "kind",
    "normalized_score",
    "occurred_at",
    "review_day",
    "review_timezone",
    "user_id",
    "weight"
FROM "mastery_evidence";

DROP TABLE "mastery_evidence";
ALTER TABLE "new_mastery_evidence" RENAME TO "mastery_evidence";

CREATE INDEX "mastery_evidence_user_id_concept_version_id_review_day_idx"
ON "mastery_evidence"("user_id", "concept_version_id", "review_day");

CREATE UNIQUE INDEX "mastery_evidence_attempt_id_concept_version_id_key"
ON "mastery_evidence"("attempt_id", "concept_version_id");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

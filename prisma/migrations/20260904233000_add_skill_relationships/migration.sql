CREATE TABLE "skill_relationships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "graph_id" TEXT NOT NULL,
    "source_skill_node_id" TEXT NOT NULL,
    "target_skill_node_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" REAL,
    "rationale" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "skill_relationships_kind_check" CHECK ("kind" IN ('RELATED', 'PREREQUISITE')),
    CONSTRAINT "skill_relationships_origin_check" CHECK ("origin" IN ('SYSTEM_BRANCH', 'USER')),
    CONSTRAINT "skill_relationships_status_check" CHECK ("status" IN ('SUGGESTED', 'CONFIRMED', 'DISMISSED', 'REMOVED')),
    CONSTRAINT "skill_relationships_no_self_check" CHECK ("source_skill_node_id" <> "target_skill_node_id"),
    CONSTRAINT "skill_relationships_related_order_check" CHECK ("kind" <> 'RELATED' OR "source_skill_node_id" < "target_skill_node_id"),
    CONSTRAINT "skill_relationships_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
    CONSTRAINT "skill_relationships_rationale_check" CHECK ("rationale" IS NULL OR length(trim("rationale")) BETWEEN 1 AND 500),
    CONSTRAINT "skill_relationships_suggestion_check" CHECK ("status" <> 'SUGGESTED' OR ("origin" = 'SYSTEM_BRANCH' AND "kind" = 'RELATED' AND "confidence" IS NOT NULL AND "rationale" IS NOT NULL)),
    CONSTRAINT "skill_relationships_user_confidence_check" CHECK ("origin" <> 'USER' OR "confidence" IS NULL),
    CONSTRAINT "skill_relationships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "skill_relationships_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "skill_graphs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "skill_relationships_source_skill_node_id_fkey" FOREIGN KEY ("source_skill_node_id") REFERENCES "skill_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "skill_relationships_target_skill_node_id_fkey" FOREIGN KEY ("target_skill_node_id") REFERENCES "skill_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "skill_relationships_graph_id_kind_source_skill_node_id_target_skill_node_id_key"
ON "skill_relationships"("graph_id", "kind", "source_skill_node_id", "target_skill_node_id");

CREATE INDEX "skill_relationships_user_id_status_created_at_idx"
ON "skill_relationships"("user_id", "status", "created_at");

CREATE INDEX "skill_relationships_source_skill_node_id_idx"
ON "skill_relationships"("source_skill_node_id");

CREATE INDEX "skill_relationships_target_skill_node_id_idx"
ON "skill_relationships"("target_skill_node_id");

CREATE TRIGGER "skill_relationships_validate_insert"
BEFORE INSERT ON "skill_relationships"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "skill_graphs"
        WHERE "id" = NEW."graph_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'skill relationship graph owner mismatch') END;

    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "skill_nodes" AS "skill_node"
        JOIN "skill_graphs" AS "skill_graph" ON "skill_graph"."id" = "skill_node"."graph_id"
        WHERE "skill_node"."id" = NEW."source_skill_node_id"
          AND "skill_graph"."user_id" = NEW."user_id"
          AND "skill_node"."graph_id" = NEW."graph_id"
          AND "skill_node"."kind" = 'SKILL'
          AND "skill_node"."archived_at" IS NULL
    ) THEN RAISE(ABORT, 'skill relationship source mismatch') END;

    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "skill_nodes" AS "skill_node"
        JOIN "skill_graphs" AS "skill_graph" ON "skill_graph"."id" = "skill_node"."graph_id"
        WHERE "skill_node"."id" = NEW."target_skill_node_id"
          AND "skill_graph"."user_id" = NEW."user_id"
          AND "skill_node"."graph_id" = NEW."graph_id"
          AND "skill_node"."kind" = 'SKILL'
          AND "skill_node"."archived_at" IS NULL
    ) THEN RAISE(ABORT, 'skill relationship target mismatch') END;
END;

CREATE TRIGGER "skill_relationships_validate_update"
BEFORE UPDATE OF "user_id", "graph_id", "source_skill_node_id", "target_skill_node_id" ON "skill_relationships"
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM "skill_graphs"
        WHERE "id" = NEW."graph_id" AND "user_id" = NEW."user_id"
    ) THEN RAISE(ABORT, 'skill relationship graph owner mismatch') END;

    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "skill_nodes" AS "skill_node"
        JOIN "skill_graphs" AS "skill_graph" ON "skill_graph"."id" = "skill_node"."graph_id"
        WHERE "skill_node"."id" = NEW."source_skill_node_id"
          AND "skill_graph"."user_id" = NEW."user_id"
          AND "skill_node"."graph_id" = NEW."graph_id"
          AND "skill_node"."kind" = 'SKILL'
          AND "skill_node"."archived_at" IS NULL
    ) THEN RAISE(ABORT, 'skill relationship source mismatch') END;

    SELECT CASE WHEN NOT EXISTS (
        SELECT 1
        FROM "skill_nodes" AS "skill_node"
        JOIN "skill_graphs" AS "skill_graph" ON "skill_graph"."id" = "skill_node"."graph_id"
        WHERE "skill_node"."id" = NEW."target_skill_node_id"
          AND "skill_graph"."user_id" = NEW."user_id"
          AND "skill_node"."graph_id" = NEW."graph_id"
          AND "skill_node"."kind" = 'SKILL'
          AND "skill_node"."archived_at" IS NULL
    ) THEN RAISE(ABORT, 'skill relationship target mismatch') END;
END;

CREATE TRIGGER "skill_relationships_reject_prerequisite_cycle_insert"
BEFORE INSERT ON "skill_relationships"
WHEN NEW."kind" = 'PREREQUISITE' AND NEW."status" = 'CONFIRMED'
BEGIN
    SELECT CASE WHEN EXISTS (
        WITH RECURSIVE "reachable"("skill_node_id") AS (
            SELECT "target_skill_node_id"
            FROM "skill_relationships"
            WHERE "graph_id" = NEW."graph_id"
              AND "kind" = 'PREREQUISITE'
              AND "status" = 'CONFIRMED'
              AND "source_skill_node_id" = NEW."target_skill_node_id"
            UNION
            SELECT "edge"."target_skill_node_id"
            FROM "skill_relationships" AS "edge"
            JOIN "reachable" ON "edge"."source_skill_node_id" = "reachable"."skill_node_id"
            WHERE "edge"."graph_id" = NEW."graph_id"
              AND "edge"."kind" = 'PREREQUISITE'
              AND "edge"."status" = 'CONFIRMED'
        )
        SELECT 1 FROM "reachable"
        WHERE "skill_node_id" = NEW."source_skill_node_id"
    ) THEN RAISE(ABORT, 'prerequisite cycle') END;
END;

CREATE TRIGGER "skill_relationships_reject_prerequisite_cycle_update"
BEFORE UPDATE OF "graph_id", "source_skill_node_id", "target_skill_node_id", "kind", "status" ON "skill_relationships"
WHEN NEW."kind" = 'PREREQUISITE' AND NEW."status" = 'CONFIRMED'
BEGIN
    SELECT CASE WHEN EXISTS (
        WITH RECURSIVE "reachable"("skill_node_id") AS (
            SELECT "target_skill_node_id"
            FROM "skill_relationships"
            WHERE "id" <> NEW."id"
              AND "graph_id" = NEW."graph_id"
              AND "kind" = 'PREREQUISITE'
              AND "status" = 'CONFIRMED'
              AND "source_skill_node_id" = NEW."target_skill_node_id"
            UNION
            SELECT "edge"."target_skill_node_id"
            FROM "skill_relationships" AS "edge"
            JOIN "reachable" ON "edge"."source_skill_node_id" = "reachable"."skill_node_id"
            WHERE "edge"."id" <> NEW."id"
              AND "edge"."graph_id" = NEW."graph_id"
              AND "edge"."kind" = 'PREREQUISITE'
              AND "edge"."status" = 'CONFIRMED'
        )
        SELECT 1 FROM "reachable"
        WHERE "skill_node_id" = NEW."source_skill_node_id"
    ) THEN RAISE(ABORT, 'prerequisite cycle') END;
END;

-- Skill Leaves are independent by default. Earlier local slices used parent_id
-- for automatic category placement; keep those category rows for audit/history
-- while detaching every leaf from implicit hierarchy.
UPDATE "skill_nodes"
SET "parent_id" = NULL
WHERE "kind" = 'SKILL'
  AND "parent_id" IS NOT NULL;

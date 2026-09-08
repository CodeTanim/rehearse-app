ALTER TABLE "skill_nodes" ADD COLUMN "map_x" REAL;
ALTER TABLE "skill_nodes" ADD COLUMN "map_y" REAL;
ALTER TABLE "skill_nodes" ADD COLUMN "position_version" INTEGER NOT NULL DEFAULT 0;

-- Enforce the same rule as the upload API at the concurrency boundary.
CREATE UNIQUE INDEX "files_skill_folder_id_original_name_key"
ON "files"("skill_folder_id", "original_name");

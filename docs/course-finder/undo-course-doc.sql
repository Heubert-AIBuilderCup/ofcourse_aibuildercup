-- Undo of migration 0025_course_doc, run by hand. Kept out of the migrations folder on purpose,
-- where the migrator would read it.
-- The vector extension stays installed (other objects may use it; it costs nothing idle).
-- The migration's journal row must be deleted by hand too, or the migrator will not run 0025 again:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1792175649983;
DROP TABLE IF EXISTS course_doc;

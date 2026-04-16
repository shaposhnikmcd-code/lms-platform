-- Flip displayMode semantics: 'solo' is now default (each bundle alone in its own row);
-- 'auto' becomes opt-in grouping. Existing 'auto' records are migrated to 'solo' since
-- none were intentionally set under the new semantics.
ALTER TABLE "Bundle" ALTER COLUMN "displayMode" SET DEFAULT 'solo';
UPDATE "Bundle" SET "displayMode" = 'solo' WHERE "displayMode" = 'auto';

-- Indexes для гарячих Bundle queries.
-- IF NOT EXISTS — безпечно повторно застосовно.

-- Основний публічний запит /courses:
--   WHERE published = true AND suspendedAt IS NULL
--   ORDER BY sortOrder ASC, createdAt DESC
CREATE INDEX IF NOT EXISTS "Bundle_published_suspendedAt_sortOrder_createdAt_idx"
  ON "Bundle"("published", "suspendedAt", "sortOrder", "createdAt");

-- Auto-resume у courses page (throttled fire-and-forget):
--   WHERE suspendedAt IS NOT NULL AND resumeAt IS NOT NULL AND resumeAt <= NOW()
CREATE INDEX IF NOT EXISTS "Bundle_suspendedAt_resumeAt_idx"
  ON "Bundle"("suspendedAt", "resumeAt");

-- News templates: form-based templates (Article/Event) з фіксованою структурою.
--
-- 1. Enum `NewsTemplateKind` — два пресети layout-у.
-- 2. `News.isTemplate` — blueprint-маркер (true для взірців, false для звичайних
--    новин). Blueprint-и приховані з публічного /news; з них клонуються
--    template-news через /api/admin/news/from-template.
-- 3. `News.templateKind` — посилання на presets. null = free-canvas (legacy).
-- 4. `News.templateData` — JSON-payload з типізованими слотами (cover, title,
--    sections/specialist/education тощо).
--
-- Після цієї міграції потрібно одноразово запустити seed-скрипт, щоб створити
-- 2 blueprint-записи (slug=__template_article, __template_event):
--   node scripts/seed-news-templates.mjs --prod
-- (див. scripts/seed-news-templates.mjs — самоідентифікується по slug і не
-- дублюється при повторних запусках).

CREATE TYPE "NewsTemplateKind" AS ENUM ('ARTICLE', 'EVENT');

ALTER TABLE "News"
  ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "templateKind" "NewsTemplateKind",
  ADD COLUMN "templateData" TEXT;

-- News parent template: звʼязок blueprint → child (кастомний шаблон або новина).
--
-- 1. `parentTemplateId` — nullable FK на News.id (self-relation).
--    - Дефолтні blueprint-и (seeded `__template_*`) мають parentTemplateId = null.
--    - Кастомні blueprint-и менеджера (isTemplate=true, з власною назвою) мають
--      parentTemplateId = id дефолтного того ж kind.
--    - Звичайні новини, створені через /api/admin/news/from-template, мають
--      parentTemplateId = id того blueprint-у (дефолтного або кастомного),
--      з якого створено.
-- 2. ON DELETE SET NULL — видалення parent-а не каскадить на children; вони
--    лишаються незалежними копіями (legacy-режим: groupування за kind).
-- 3. Index [isTemplate, parentTemplateId] — для швидкої вибірки кастомних
--    blueprint-ів під своїм дефолтним у /dashboard/admin/news.

ALTER TABLE "News" ADD COLUMN "parentTemplateId" TEXT;

ALTER TABLE "News" ADD CONSTRAINT "News_parentTemplateId_fkey"
  FOREIGN KEY ("parentTemplateId") REFERENCES "News"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "News_isTemplate_parentTemplateId_idx"
  ON "News"("isTemplate", "parentTemplateId");

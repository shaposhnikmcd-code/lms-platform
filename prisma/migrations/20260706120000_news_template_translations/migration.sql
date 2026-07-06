-- EN/PL-переклади шаблонного контенту новин:
-- templateBlocksEn/Pl — block-based контент EVENT/ARTICLE-карток (головне джерело тексту),
-- templateDataEn/Pl   — legacy form-based fallback.
-- Генеруються у translateNewsAllLocales при save новини; рендер обирає за locale
-- з fallback на UK-оригінал (lib/news/render.tsx, app/[locale]/news/[slug]/page.tsx).
-- Колонки вже додані на dev через db:push; цей файл доставляє їх на pre/prod через migrate deploy.
-- IF NOT EXISTS — щоб повторне застосування (де колонка вже є) не падало.
ALTER TABLE "News" ADD COLUMN IF NOT EXISTS "templateDataEn" TEXT;
ALTER TABLE "News" ADD COLUMN IF NOT EXISTS "templateDataPl" TEXT;
ALTER TABLE "News" ADD COLUMN IF NOT EXISTS "templateBlocksEn" TEXT;
ALTER TABLE "News" ADD COLUMN IF NOT EXISTS "templateBlocksPl" TEXT;

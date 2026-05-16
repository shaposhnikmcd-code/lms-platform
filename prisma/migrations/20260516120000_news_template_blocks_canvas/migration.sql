-- Block-based template constructor (Session 3+ refactor).
-- Додає 2 nullable-колонки до News:
--   templateBlocks — JSON Block[] для конструктора шаблонів. Заповнено у нових
--     blueprint-ах; null у legacy (рендеряться через structured templateData).
--   templateCanvas — розмір canvas-у шаблону у форматі "WxH" (600x400 EVENT,
--     360x400 ARTICLE). null = default за templateKind.
--
-- Backward compat: обидві колонки nullable, поточні новини не потребують міграції
-- даних. Public render у /news пріоритет templateBlocks → fallback на templateData.

-- AlterTable
ALTER TABLE "News" ADD COLUMN "templateBlocks" TEXT;
ALTER TABLE "News" ADD COLUMN "templateCanvas" TEXT;

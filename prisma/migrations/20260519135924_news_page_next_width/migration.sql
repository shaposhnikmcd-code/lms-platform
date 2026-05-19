-- Staged-ширина «папера» для Білдер наступної сторінки. Копіюється у pageWidth
-- при swap (publishStagedNewsPage). Може існувати на dev-Neon (через db:push) —
-- тому IF NOT EXISTS, щоб migrate deploy не впав з "column already exists".
ALTER TABLE "NewsPage" ADD COLUMN IF NOT EXISTS "nextPageWidth" INTEGER;

-- Ширина «папера» на момент архівації. Зберігається при swap, відновлюється
-- при restore-actions (потрібна для коректної геометрії px-блоків).
ALTER TABLE "NewsPageArchive" ADD COLUMN IF NOT EXISTS "pageWidth" INTEGER;

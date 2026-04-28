-- Adds News.pageBgColor (background color of the news inner "page" container).
-- Schema field already exists; this migration aligns prod DB with prisma client.
ALTER TABLE "News" ADD COLUMN "pageBgColor" TEXT;

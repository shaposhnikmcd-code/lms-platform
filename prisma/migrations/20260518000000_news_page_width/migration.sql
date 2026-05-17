-- NewsPage.pageWidth: налаштована ширина «папера» сторінки /news у px.
-- null = дефолт 920. Менеджер міняє з білдера /dashboard/admin/news/page-builder
-- через інлайн-input (діапазон 850..1450, step 10). Публічний рендер
-- app/[locale]/news/page.tsx читає це поле і застосовує як width контентної
-- колонки. Окремі новини /news/[slug] не зачіпаються — у них своя CANVAS_WIDTH=920.

ALTER TABLE "NewsPage" ADD COLUMN "pageWidth" INTEGER;

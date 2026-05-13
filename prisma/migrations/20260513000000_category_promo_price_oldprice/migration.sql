-- Додає `price` і `oldPrice` у CategoryPromoOverride.
-- Раніше категорійна ціна (Конектор / Річна / Місячна / Bundle) бралася виключно
-- з коду — `lib/connectorPricing.ts`, `lib/yearlyPricing.ts`. Тепер менеджер
-- може редагувати їх з /dashboard/admin/courses. `price` — поточна, `oldPrice`
-- — перекреслена «стара» на сторінці продукту. NULL = використовується дефолт із коду.

ALTER TABLE "CategoryPromoOverride"
  ADD COLUMN "price"    INTEGER,
  ADD COLUMN "oldPrice" INTEGER;

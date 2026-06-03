-- AlterTable: ручне підтвердження оплати (manual_payment action) — поля додавались через db:push на dev,
-- ця міграція доносить їх на pre/prod, бо роут деталей Річної їх select-ить (інакше 500 «Не вдалося завантажити деталі»).
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "manualMethod" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "manualNote" TEXT;

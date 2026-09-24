-- Два мерчанти WayForPay одночасно (з 30.09.2026).
--
-- Нові оплати йдуть на новий мерчант, а вже створені правила автосписання Річної
-- лишаються в кабінеті старого: правило належить тому мерчанту, який його створив, і
-- зміна env його не переносить. Щоб після перемикання кожен серверний виклик WFP
-- (STATUS / CHANGE / REMOVE / перевірка підпису callback-у) ішов кредами ПОТРІБНОГО
-- мерчанта, кожне замовлення і кожна підписка з регуляркою мають знати свій мерчант.

ALTER TABLE "Payment" ADD COLUMN "wfpMerchantAccount" TEXT;
ALTER TABLE "YearlyProgramSubscription" ADD COLUMN "wfpMerchantAccount" TEXT;

-- Бекфіл: усе, що існує на момент цієї міграції, створено на СТАРОМУ мерчанті —
-- іншого до 30.09.2026 не було. Пишемо логін явно, а не лишаємо NULL з правилом
-- «NULL = старий», бо після міграції NULL може означати лише рядок, створений уже
-- після переходу (тобто новий мерчант), і два різні сенси одного NULL зробили б
-- вибір кредів неоднозначним.
--
-- ⚠️ Логін-літерал має збігатися зі значенням WAYFORPAY_LEGACY_MERCHANT_LOGIN у Vercel.
-- Якщо він інший — резолвер кредів не мовчить, а відмовляє з текстом
-- «Невідомий мерчант WayForPay «…»», і помилка видно у «Помилках» адмінки Річної.
-- Лагодиться одним UPDATE по тих самих умовах.

-- Ручні платежі (manualMethod) у WayForPay не існують — мерчанта в них немає взагалі.
-- Не-wayforpay провайдери (paddle) і продажі з чужих сайтів (source <> 'UIMP', вони
-- проходять через касу власника сайту) теж лишаються NULL.
UPDATE "Payment"
SET "wfpMerchantAccount" = 'freelance_user_6682b2f59c38a'
WHERE "wfpMerchantAccount" IS NULL
  AND "manualMethod" IS NULL
  AND "paymentProvider" = 'wayforpay'
  AND "source" = 'UIMP';

UPDATE "YearlyProgramSubscription"
SET "wfpMerchantAccount" = 'freelance_user_6682b2f59c38a'
WHERE "wfpMerchantAccount" IS NULL;

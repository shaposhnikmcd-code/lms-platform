-- Snapshot from-адреси для кожного відправленого сертифіката (RESEND_FROM_EMAIL на
-- момент відправки). Адмінка показує цю колонку в таблицях Курси/Річна програма
-- ("Лист надійшов з"). Старі сертифікати залишаються NULL — UI рендерить '—'.
ALTER TABLE "Certificate" ADD COLUMN "emailFromAddress" TEXT;

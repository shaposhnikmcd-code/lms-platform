-- Нормалізація регістру email у User: історичні акаунти створювались із сирим
-- email покупця ("Polandemigrants@..."), через що lowercase-пошук (forgot-password,
-- логін, адмінські лукапи) їх не знаходив. Приводимо до lower() тільки безконфліктні
-- рядки: якщо раптом існує пара, що відрізняється лише регістром, обидва лишаємо
-- як є (розрулюється вручну, unique-констрейнт не ламаємо).
UPDATE "User" u
SET "email" = lower(u."email")
WHERE u."email" <> lower(u."email")
  AND NOT EXISTS (
    SELECT 1 FROM "User" v
    WHERE lower(v."email") = lower(u."email") AND v."id" <> u."id"
  );

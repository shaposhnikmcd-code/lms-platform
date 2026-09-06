-- User.adminNote — вільна нотатка адміна/менеджера про студента (наприклад, у Річній
-- програмі). Живе на User, а не на YearlyProgramSubscription: перенесені студенти щороку
-- отримують нову підписку в новому наборі, нотатка має пережити перенесення.
-- adminNoteUpdatedAt/adminNoteUpdatedBy — коли й ким востаннє змінено (для підпису під
-- textarea в адмінці). Всі колонки nullable — безпечно застосовувати повторно.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminNote" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminNoteUpdatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminNoteUpdatedBy" TEXT;

-- Аудит зміни ролі адміністратора/менеджера: подія тепер пишеться в UserAuditLog,
-- а не лише у Runtime Logs (`[audit] ROLE_CHANGED`).
ALTER TYPE "UserAuditEvent" ADD VALUE IF NOT EXISTS 'ROLE_CHANGED';

-- Роль ДО зміни (для ROLE_CHANGED). Для решти подій лишається NULL.
ALTER TABLE "UserAuditLog" ADD COLUMN IF NOT EXISTS "previousRole" "UserRole";

-- Лог подій життєвого циклу акаунтів ADMIN/MANAGER
-- (хто і кого додав/видалив/відновив).

CREATE TYPE "UserAuditEvent" AS ENUM ('CREATED', 'DELETED', 'RESTORED');

CREATE TABLE "UserAuditLog" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "eventType"   "UserAuditEvent" NOT NULL,
    "targetName"  TEXT,
    "targetEmail" TEXT NOT NULL,
    "targetRole"  "UserRole" NOT NULL,
    "actorId"     TEXT,
    "actorName"   TEXT,
    "actorEmail"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAuditLog_createdAt_idx" ON "UserAuditLog"("createdAt");
CREATE INDEX "UserAuditLog_userId_idx" ON "UserAuditLog"("userId");
CREATE INDEX "UserAuditLog_eventType_idx" ON "UserAuditLog"("eventType");

ALTER TABLE "UserAuditLog"
  ADD CONSTRAINT "UserAuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

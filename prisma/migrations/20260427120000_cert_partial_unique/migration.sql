-- Replace the strict unique constraint (userId, type, courseId) with a partial
-- unique index that only enforces uniqueness when the certificate is NOT revoked.
-- This allows reissuing a new certificate after the previous one was revoked.

ALTER TABLE "Certificate" DROP CONSTRAINT IF EXISTS "Certificate_userId_type_courseId_key";
DROP INDEX IF EXISTS "Certificate_userId_type_courseId_key";

CREATE UNIQUE INDEX "Certificate_active_userId_type_courseId_key"
  ON "Certificate" ("userId", "type", "courseId")
  WHERE "revoked" = false;

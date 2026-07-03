-- Anonymous (no-signup) users
ALTER TABLE "User" ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "User_isAnonymous_createdAt_idx" ON "User"("isAnonymous", "createdAt");
